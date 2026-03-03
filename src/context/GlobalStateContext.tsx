import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserState, Garment, Look, PlannerEntry, Trip } from '../../types';
import { api } from '../../services/api';
import { loadFromLocalStorage } from '../../hooks/useLocalStorage';
import { useNotification } from './NotificationContext';
import { useLanguage } from './LanguageContext';
import { applyTheme, getSavedTheme } from '../utils/theme';

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
    handleAuthSuccess: (userData: UserState) => void;
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
        applyTheme(getSavedTheme());

        const init = async () => {
            const hasSession = localStorage.getItem('beyour_user');
            if (hasSession) {
                try {
                    let userData: UserState;
                    try {
                        userData = await api.getMe();
                        setUser(userData);
                        localStorage.setItem('beyour_user', JSON.stringify(userData));
                    } catch {
                        const savedUser = localStorage.getItem('beyour_user');
                        if (savedUser) {
                            userData = JSON.parse(savedUser);
                            setUser(userData);
                        } else {
                            throw new Error('No user data');
                        }
                    }

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
                        localStorage.setItem('beyour_garments', JSON.stringify(sanitized));
                    } else {
                        setGarments(sanitize<Garment>(loadFromLocalStorage('beyour_garments', [])));
                    }

                    if (fetchedLooks.status === 'fulfilled') {
                        const sanitized = sanitize<Look>(fetchedLooks.value);
                        setLooks(sanitized);
                        localStorage.setItem('beyour_looks', JSON.stringify(sanitized));
                    } else {
                        setLooks(sanitize<Look>(loadFromLocalStorage('beyour_looks', [])));
                    }

                    if (fetchedPlanner.status === 'fulfilled') {
                        const sanitized = sanitize<PlannerEntry>(fetchedPlanner.value);
                        setPlanner(sanitized);
                        localStorage.setItem('beyour_planner', JSON.stringify(sanitized));
                    } else {
                        setPlanner(sanitize<PlannerEntry>(loadFromLocalStorage('beyour_planner', [])));
                    }

                    if (fetchedTrips.status === 'fulfilled') {
                        const sanitized = sanitize<Trip>(fetchedTrips.value);
                        setTrips(sanitized);
                        localStorage.setItem('beyour_trips', JSON.stringify(sanitized));
                    } else {
                        setTrips(sanitize<Trip>(loadFromLocalStorage('beyour_trips', [])));
                    }
                } catch (error) {
                    console.error('Critical error during initialization:', error);
                    localStorage.removeItem('beyour_token');
                    localStorage.removeItem('beyour_user');
                    setUser(null);
                }
            }
            setIsLoading(false);
        };

        init();
    }, []);

    // ── Auth ─────────────────────────────────────────────────────────────────

    const handleAuthSuccess = useCallback((userData: UserState) => {
        setUser(userData);
        localStorage.setItem('beyour_user', JSON.stringify(userData));
        window.location.reload();
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
        localStorage.setItem('beyour_user', JSON.stringify(updatedUser));
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
            localStorage.setItem('beyour_garments', JSON.stringify(updated));
            return updated;
        });

        try {
            const saved = await api.addGarment({
                file,
                name: garment.name || garment.type,
                category: garment.type,
                color: garment.color,
                season: garment.season,
            });

            setGarments(prev => {
                const updated = sanitize<Garment>(prev.map(g => g.id === tempId ? saved : g));
                localStorage.setItem('beyour_garments', JSON.stringify(updated));
                return updated;
            });

            notify(`✓ ${t('garmentAdded')}`, 'success');
        } catch (error) {
            setGarments(prev => {
                const filtered = prev.filter(g => g.id !== tempId);
                localStorage.setItem('beyour_garments', JSON.stringify(filtered));
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
            localStorage.setItem('beyour_garments', JSON.stringify(filtered));
            return filtered;
        });

        try {
            await api.deleteGarment(id);
            notify(`✓ ${t('garmentDeleted')}`, 'success');
        } catch (error) {
            setGarments(previousGarments);
            localStorage.setItem('beyour_garments', JSON.stringify(previousGarments));
            notify(`✗ ${t('garmentDeleteError')}`, 'error');
            console.error('Error deleting garment:', error);
        }
    }, [notify, t]);

    const updateGarment = useCallback(async (g: Garment) => {
        let previousGarments: Garment[] = [];

        setGarments(prev => {
            previousGarments = [...prev];
            const updated = sanitize<Garment>(prev.map(item => item.id === g.id ? g : item));
            localStorage.setItem('beyour_garments', JSON.stringify(updated));
            return updated;
        });

        try {
            await api.updateGarment(g.id, g);
            notify(`✓ ${t('garmentUpdated')}`, 'success');
        } catch (error) {
            setGarments(previousGarments);
            localStorage.setItem('beyour_garments', JSON.stringify(previousGarments));
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
            localStorage.setItem('beyour_looks', JSON.stringify(updated));
            return updated;
        });

        try {
            const savedLook = await api.saveLook(look);

            setLooks(prev => {
                const updated = prev.map(l => l.id === tempId ? savedLook : l);
                localStorage.setItem('beyour_looks', JSON.stringify(updated));
                return updated;
            });

            notify(`✓ ${t('lookSaved')}`, 'success');
            onAfterSave?.();
        } catch (error) {
            setLooks(prev => {
                const filtered = prev.filter(l => l.id !== tempId);
                localStorage.setItem('beyour_looks', JSON.stringify(filtered));
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
            localStorage.setItem('beyour_looks', JSON.stringify(filtered));
            return filtered;
        });

        try {
            await api.deleteLook(id);
            notify(`✓ ${t('lookDeleted')}`, 'success');
        } catch (error) {
            setLooks(previousLooks);
            localStorage.setItem('beyour_looks', JSON.stringify(previousLooks));
            notify(`✗ ${t('lookDeleteError')}`, 'error');
            console.error('Error deleting look:', error);
        }
    }, [notify, t]);

    // ── Planner ───────────────────────────────────────────────────────────────

    const updatePlannerEntry = useCallback(async (entry: PlannerEntry) => {
        setPlanner(prev => {
            const updated = [...prev.filter(p => p.date !== entry.date), entry];
            localStorage.setItem('beyour_planner', JSON.stringify(updated));
            return updated;
        });

        try {
            const saved = await api.updatePlanner(entry);
            setPlanner(prev => {
                const final = [...prev.filter(p => p.date !== entry.date), saved];
                localStorage.setItem('beyour_planner', JSON.stringify(final));
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
            localStorage.setItem('beyour_trips', JSON.stringify(updated));
            return updated;
        });

        try {
            const saved = await api.saveTrip(newTrip);
            setTrips(prev => {
                // Replace the optimistic entry (matched by destination + dates) with the real one
                const updated = [saved, ...prev.filter(t => t.id !== newTrip.id)];
                localStorage.setItem('beyour_trips', JSON.stringify(updated));
                return updated;
            });
        } catch (error) {
            console.error('Error saving trip:', error);
        }
    }, []);

    const deleteTrip = useCallback(async (id: string) => {
        setTrips(prev => {
            const filtered = prev.filter(t => t.id !== id);
            localStorage.setItem('beyour_trips', JSON.stringify(filtered));
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
            localStorage.setItem('beyour_trips', JSON.stringify(updated));
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
