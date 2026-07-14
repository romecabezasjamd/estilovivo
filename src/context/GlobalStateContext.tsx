import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserState, Garment, Look, PlannerEntry, Trip } from '../../types';
import { api, loadAuthToken } from '../../services/api';
import { useNotification } from './NotificationContext';
import { useLanguage } from './LanguageContext';
import { prepareGarmentUpload } from '../utils/garmentProcessor';
import { syncGet, syncSet, SYNC_KEYS } from '../utils/syncStore';
import { analytics, crashlytics } from '../utils/firebase';
import { trackSession } from '../utils/review';
import { registerForPushNotifications, setupNotificationListeners } from '../utils/notifications';

const AUTH_TOKEN_KEY = 'beyour_token';
const REMEMBER_ME_KEY = 'beyour_remember_me';

// ─── Types ───────────────────────────────────────────────────────────────────

interface GlobalStateContextValue {
    // State
    user: UserState | null;
    garments: Garment[];
    looks: Look[];
    planner: PlannerEntry[];
    trips: Trip[];
    isLoading: boolean;

    // User
    setUser: React.Dispatch<React.SetStateAction<UserState | null>>;
    handleAuthSuccess: (userData: UserState, remember?: boolean) => void;
    handleMoodChange: (mood: string) => Promise<void>;
    handleUpdateUser: (updatedUser: UserState) => Promise<void>;

    // Garments
    addGarment: (garment: Garment, file?: File) => Promise<void>;
    removeGarment: (id: string) => Promise<void>;
    updateGarment: (g: Garment) => Promise<void>;

    // Looks
    saveLook: (look: Look, onAfterSave?: () => void) => Promise<void>;
    deleteLook: (id: string) => Promise<void>;

    // Planner
    updatePlannerEntry: (entry: PlannerEntry) => Promise<void>;

    // Trips
    addTrip: (newTrip: Trip) => Promise<void>;
    deleteTrip: (id: string) => Promise<void>;
    updateTrip: (trip: Trip) => Promise<void>;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const GlobalStateContext = createContext<GlobalStateContextValue | null>(null);

// ─── Helper ──────────────────────────────────────────────────────────────────

const sanitize = <T,>(data: any[]): T[] => {
    if (!Array.isArray(data)) return [];
    return data.filter(item => item && (item.id || item.date)) as T[];
};

const SESSION_KEYS = [
    'beyour_user',
    'beyour_garments',
    'beyour_looks',
    'beyour_planner',
    'beyour_trips',
    'beyour_token',
    'beyour_remember_me'
];

const clearPersistedSession = () => {
    SESSION_KEYS.forEach(key => localStorage.removeItem(key));
};

const isJwtLikelyValid = (token: string): boolean => {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return false;
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (typeof payload?.exp === 'number') {
            return payload.exp * 1000 > Date.now();
        }
        return true;
    } catch {
        return false;
    }
};

// ─── Provider ────────────────────────────────────────────────────────────────

export const GlobalStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { notify } = useNotification();
    const { t } = useLanguage();

    const [user, setUser] = useState<UserState | null>(null);
    const [garments, setGarments] = useState<Garment[]>([]);
    const [looks, setLooks] = useState<Look[]>([]);
    const [planner, setPlanner] = useState<PlannerEntry[]>([]);
    const [trips, setTrips] = useState<Trip[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // ── Init ─────────────────────────────────────────────────────────────────

    useEffect(() => {
        const handleAuthExpired = () => {
            clearPersistedSession();
            setUser(null);
            setGarments([]);
            setLooks([]);
            setPlanner([]);
            setTrips([]);
        };

        window.addEventListener('auth:expired', handleAuthExpired as EventListener);

        const init = async () => {
            const shouldRestoreSession = localStorage.getItem(REMEMBER_ME_KEY) === 'true';

            const [cachedUser, cachedGarments, cachedLooks, cachedPlanner, cachedTrips] =
                await Promise.all([
                    syncGet<UserState>(SYNC_KEYS.USER),
                    syncGet<Garment[]>(SYNC_KEYS.GARMENTS),
                    syncGet<Look[]>(SYNC_KEYS.LOOKS),
                    syncGet<PlannerEntry[]>(SYNC_KEYS.PLANNER),
                    syncGet<Trip[]>(SYNC_KEYS.TRIPS),
                ]);

            if (cachedUser) {
                setUser(cachedUser);
            }

            setGarments(sanitize<Garment>(cachedGarments || []));
            setLooks(sanitize<Look>(cachedLooks || []));
            setPlanner(sanitize<PlannerEntry>(cachedPlanner || []));
            setTrips(sanitize<Trip>(cachedTrips || []));

            if (!shouldRestoreSession) {
                clearPersistedSession();
                setIsLoading(false);
                return;
            }

            try {
                await loadAuthToken();
                const token = localStorage.getItem(AUTH_TOKEN_KEY) || '';
                const hasSession = !!token;
                if (!hasSession) {
                    clearPersistedSession();
                    setUser(null);
                    setIsLoading(false);
                    return;
                }

                if (!isJwtLikelyValid(token)) {
                    clearPersistedSession();
                    setUser(null);
                    setIsLoading(false);
                    return;
                }

                let userData: UserState;
                try {
                    userData = await api.getMe();
                    setUser(userData);
                    await syncSet(SYNC_KEYS.USER, userData);
                    window.dispatchEvent(new CustomEvent('ev:user-loaded', { detail: userData }));
                } catch (error: any) {
                    const tokenStillPresent = !!localStorage.getItem(AUTH_TOKEN_KEY);
                    const isUserNotFound = error?.message === 'User not found';
                    if (!tokenStillPresent || isUserNotFound) {
                        clearPersistedSession();
                        setUser(null);
                        setIsLoading(false);
                        return;
                    }

                    if (cachedUser) {
                        userData = cachedUser;
                        setUser(userData);
                    } else {
                        throw error;
                    }
                }

                api.gamificationLogin().catch(() => {});

                const [fetchedGarments, fetchedLooks, fetchedPlanner, fetchedTrips] =
                    await Promise.allSettled([
                        api.getGarments(),
                        api.getLooks(),
                        api.getPlanner(),
                        api.getTrips(),
                    ]);

                if (fetchedGarments.status === 'fulfilled') {
                    const sanitized = sanitize<Garment>(fetchedGarments.value);
                    setGarments(sanitized);
                    syncSet(SYNC_KEYS.GARMENTS, sanitized);
                }

                if (fetchedLooks.status === 'fulfilled') {
                    const sanitized = sanitize<Look>(fetchedLooks.value);
                    setLooks(sanitized);
                    syncSet(SYNC_KEYS.LOOKS, sanitized);
                }

                if (fetchedPlanner.status === 'fulfilled') {
                    const sanitized = sanitize<PlannerEntry>(fetchedPlanner.value);
                    setPlanner(sanitized);
                    syncSet(SYNC_KEYS.PLANNER, sanitized);
                }

                if (fetchedTrips.status === 'fulfilled') {
                    const sanitized = sanitize<Trip>(fetchedTrips.value);
                    setTrips(sanitized);
                    syncSet(SYNC_KEYS.TRIPS, sanitized);
                }

                const syncFailures: string[] = [];
                if (fetchedGarments.status === 'rejected') syncFailures.push('armario');
                if (fetchedLooks.status === 'rejected') syncFailures.push('looks');
                if (fetchedPlanner.status === 'rejected') syncFailures.push('planificador');
                if (fetchedTrips.status === 'rejected') syncFailures.push('maletas');
                if (syncFailures.length > 0) {
                    console.warn(
                        `No se pudo sincronizar con el servidor: ${syncFailures.join(', ')}. Se muestran datos en caché si están disponibles.`
                    );
                }
            } catch (error) {
                console.error('Critical error during initialization:', error);
                clearPersistedSession();
                setUser(null);
            } finally {
                setIsLoading(false);
            }
        };

        init();

        return () => {
            window.removeEventListener('auth:expired', handleAuthExpired as EventListener);
        };
    }, []);

    // ── Auth ─────────────────────────────────────────────────────────────────

    const handleAuthSuccess = useCallback(async (userData: UserState, remember: boolean = true) => {
        setUser(userData);
        window.dispatchEvent(new CustomEvent('ev:user-loaded', { detail: userData }));

        analytics.setUserId(userData.id);
        analytics.logEvent('login', { method: 'email' });
        crashlytics.setUserId(userData.id);
        trackSession();
        registerForPushNotifications();
        setupNotificationListeners(
            (title, body) => console.log('Notification received:', title, body),
            (data) => console.log('Notification tapped:', data)
        );

        if (remember) {
            syncSet(SYNC_KEYS.USER, userData);
        } else {
            clearPersistedSession();
        }

        try {
            const [fetchedGarments, fetchedLooks, fetchedPlanner, fetchedTrips] =
                await Promise.allSettled([
                    api.getGarments(),
                    api.getLooks(),
                    api.getPlanner(),
                    api.getTrips(),
                ]);

            if (fetchedGarments.status === 'fulfilled') {
                const sanitized = sanitize<Garment>(fetchedGarments.value);
                setGarments(sanitized);
                syncSet(SYNC_KEYS.GARMENTS, sanitized);
            }
            if (fetchedLooks.status === 'fulfilled') {
                const sanitized = sanitize<Look>(fetchedLooks.value);
                setLooks(sanitized);
                syncSet(SYNC_KEYS.LOOKS, sanitized);
            }
            if (fetchedPlanner.status === 'fulfilled') {
                const sanitized = sanitize<PlannerEntry>(fetchedPlanner.value);
                setPlanner(sanitized);
                syncSet(SYNC_KEYS.PLANNER, sanitized);
            }
            if (fetchedTrips.status === 'fulfilled') {
                const sanitized = sanitize<Trip>(fetchedTrips.value);
                setTrips(sanitized);
                syncSet(SYNC_KEYS.TRIPS, sanitized);
            }
        } catch (e) {
            console.warn('Failed to fetch data after auth:', e);
        }
    }, []);

    const handleMoodChange = useCallback(async (mood: string) => {
        setUser(prev => prev ? { ...prev, mood } : prev);
        try {
            await api.updateProfile({ mood });
        } catch (e) {
            console.warn('Failed to save mood:', e);
        }
    }, []);

    const handleUpdateUser = useCallback(async (updatedUser: UserState) => {
        setUser(updatedUser);
        syncSet(SYNC_KEYS.USER, updatedUser);
        window.dispatchEvent(new CustomEvent('ev:user-loaded', { detail: updatedUser }));
        try {
            await api.updateProfile(updatedUser);
        } catch (error) {
            console.warn('Error saving profile:', error);
        }
    }, []);

    // ── Garments ─────────────────────────────────────────────────────────────

    const addGarment = useCallback(async (garment: Garment, file?: File) => {
        const tempId = `temp-${Date.now()}`;
        const optimisticGarment = { ...garment, id: tempId };

        setGarments(prev => {
            const updated = sanitize<Garment>([optimisticGarment, ...prev]);
            syncSet(SYNC_KEYS.GARMENTS, updated);
            return updated;
        });

        try {
            let uploadFile = file;
            if (uploadFile && typeof window !== 'undefined') {
                try {
                    const prepared = await prepareGarmentUpload(uploadFile, { maxSize: 1600 });
                    uploadFile = prepared.file;
                } catch (prepError) {
                    console.warn('No se pudo preparar la prenda para el probador', prepError);
                }
            }

            const saved = await api.addGarment({
                file: uploadFile,
                name: garment.name || garment.type,
                category: garment.type,
                color: garment.color,
                season: garment.season,
                forSale: garment.forSale,
                price: garment.price,
                condition: garment.condition,
                description: garment.description,
                size: garment.size,
                brand: garment.brand,
            });

            setGarments(prev => {
                const updated = sanitize<Garment>(prev.map(g => g.id === tempId ? saved : g));
                syncSet(SYNC_KEYS.GARMENTS, updated);
                return updated;
            });

            analytics.logEvent('add_garment', { category: garment.type });
            notify(`✓ ${t('garmentAdded')}`, 'success');
        } catch (error) {
            setGarments(prev => {
                const filtered = prev.filter(g => g.id !== tempId);
                syncSet(SYNC_KEYS.GARMENTS, filtered);
                return filtered;
            });
            notify(`✗ ${t('garmentAddError')}`, 'error');
            console.error('Error adding garment:', error);
        }
    }, [notify, t]);

    const removeGarment = useCallback(async (id: string) => {
        let previousGarments: Garment[] = [];

        setGarments(prev => {
            previousGarments = [...prev];
            const filtered = sanitize<Garment>(prev.filter(g => g.id !== id));
            syncSet(SYNC_KEYS.GARMENTS, filtered);
            return filtered;
        });

        try {
            await api.deleteGarment(id);
            notify(`✓ ${t('garmentDeleted')}`, 'success');
        } catch (error) {
            setGarments(previousGarments);
            syncSet(SYNC_KEYS.GARMENTS, previousGarments);
            notify(`✗ ${t('garmentDeleteError')}`, 'error');
            console.error('Error deleting garment:', error);
        }
    }, [notify, t]);

    const updateGarment = useCallback(async (g: Garment) => {
        let previousGarments: Garment[] = [];

        setGarments(prev => {
            previousGarments = [...prev];
            const updated = sanitize<Garment>(prev.map(item => item.id === g.id ? g : item));
            syncSet(SYNC_KEYS.GARMENTS, updated);
            return updated;
        });

        try {
            await api.updateGarment(g.id, g);
            notify(`✓ ${t('garmentUpdated')}`, 'success');
        } catch (error) {
            setGarments(previousGarments);
            syncSet(SYNC_KEYS.GARMENTS, previousGarments);
            notify(`✗ ${t('garmentUpdateError')}`, 'error');
            console.error('Error updating garment:', error);
        }
    }, [notify, t]);

    // ── Looks ─────────────────────────────────────────────────────────────────

    const saveLook = useCallback(async (look: Look, onAfterSave?: () => void) => {
        const tempId = `temp-${Date.now()}`;
        const optimisticLook = { ...look, id: tempId };

        setLooks(prev => {
            const updated = sanitize<Look>([optimisticLook, ...prev]);
            syncSet(SYNC_KEYS.LOOKS, updated);
            return updated;
        });

        try {
            const savedLook = await api.saveLook(look);

            setLooks(prev => {
                const updated = prev.map(l => l.id === tempId ? savedLook : l);
                syncSet(SYNC_KEYS.LOOKS, updated);
                return updated;
            });

            analytics.logEvent('save_look', { garment_count: look.garments?.length || 0 });
            notify(`✓ ${t('lookSaved')}`, 'success');
            onAfterSave?.();
        } catch (error) {
            setLooks(prev => {
                const filtered = prev.filter(l => l.id !== tempId);
                syncSet(SYNC_KEYS.LOOKS, filtered);
                return filtered;
            });
            notify(`✗ ${t('lookSaveError')}`, 'error');
            console.error('Error saving look:', error);
            onAfterSave?.();
        }
    }, [notify, t]);

    const deleteLook = useCallback(async (id: string) => {
        let previousLooks: Look[] = [];

        setLooks(prev => {
            previousLooks = [...prev];
            const filtered = prev.filter(l => l.id !== id);
            syncSet(SYNC_KEYS.LOOKS, filtered);
            return filtered;
        });

        try {
            await api.deleteLook(id);
            notify(`✓ ${t('lookDeleted')}`, 'success');
        } catch (error) {
            setLooks(previousLooks);
            syncSet(SYNC_KEYS.LOOKS, previousLooks);
            notify(`✗ ${t('lookDeleteError')}`, 'error');
            console.error('Error deleting look:', error);
        }
    }, [notify, t]);

    // ── Planner ───────────────────────────────────────────────────────────────

    const updatePlannerEntry = useCallback(async (entry: PlannerEntry) => {
        setPlanner(prev => {
            const updated = [...prev.filter(p => p.date !== entry.date), entry];
            syncSet(SYNC_KEYS.PLANNER, updated);
            return updated;
        });

        try {
            const saved = await api.updatePlanner(entry);
            setPlanner(prev => {
                const final = [...prev.filter(p => p.date !== entry.date), saved];
                syncSet(SYNC_KEYS.PLANNER, final);
                return final;
            });
        } catch (error) {
            console.error('Error updating planner:', error);
        }
    }, []);

    // ── Trips ─────────────────────────────────────────────────────────────────

    const addTrip = useCallback(async (newTrip: Trip) => {
        setTrips(prev => {
            const updated = [newTrip, ...prev];
            syncSet(SYNC_KEYS.TRIPS, updated);
            return updated;
        });

        try {
            const saved = await api.saveTrip(newTrip);
            setTrips(prev => {
                // Replace the optimistic entry (matched by destination + dates) with the real one
                const updated = [saved, ...prev.filter(t => t.id !== newTrip.id)];
                syncSet(SYNC_KEYS.TRIPS, updated);
                return updated;
            });
        } catch (error) {
            console.error('Error saving trip:', error);
        }
    }, []);

    const deleteTrip = useCallback(async (id: string) => {
        setTrips(prev => {
            const filtered = prev.filter(t => t.id !== id);
            syncSet(SYNC_KEYS.TRIPS, filtered);
            return filtered;
        });

        try {
            await api.deleteTrip(id);
        } catch (error) {
            console.error('Error deleting trip:', error);
        }
    }, []);

    const updateTrip = useCallback(async (trip: Trip) => {
        setTrips(prev => {
            const updated = prev.map(t => t.id === trip.id ? trip : t);
            syncSet(SYNC_KEYS.TRIPS, updated);
            return updated;
        });

        try {
            await api.updateTrip(trip);
        } catch (error) {
            console.error('Error updating trip:', error);
        }
    }, []);

    // ── Context value ─────────────────────────────────────────────────────────

    const value: GlobalStateContextValue = {
        user, garments, looks, planner, trips, isLoading,
        setUser,
        handleAuthSuccess, handleMoodChange, handleUpdateUser,
        addGarment, removeGarment, updateGarment,
        saveLook, deleteLook,
        updatePlannerEntry,
        addTrip, deleteTrip, updateTrip,
    };

    return (
        <GlobalStateContext.Provider value={value}>
            {children}
        </GlobalStateContext.Provider>
    );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useGlobalState = (): GlobalStateContextValue => {
    const ctx = useContext(GlobalStateContext);
    if (!ctx) {
        throw new Error('useGlobalState must be used inside <GlobalStateProvider>');
    }
    return ctx;
};
