import { Capacitor } from '@capacitor/core';
import { Garment, Look, PlannerEntry, UserState, Trip, Comment, CommunityPost, ShopItem, ChatConversation, ChatMessage, StoryEntry } from '../types';
import { getSecureItem, setSecureItem, removeSecureItem } from '../src/utils/secureStorage';

const normalizeApiBase = (value?: string) => {
    const base = (value || '').trim().replace(/\/+$/, '');
    return base.endsWith('/api') ? base : `${base}/api`;
};

const PRODUCTION_API = 'https://estilovivo.xyoncloud.win/api';

const isNativeApp = () => {
    if (typeof window === 'undefined') return false;
    const platform = Capacitor?.getPlatform?.() || '';
    return platform !== 'web' && platform !== '';
};

const isDevMode = () => {
    const fromEnv = (import.meta as any).env?.VITE_API_BASE || (import.meta as any).env?.VITE_API_URL;
    if (fromEnv?.trim()) return true;
    return (import.meta as any).env?.DEV === true;
};

const resolveDefaultApiBase = (): string => {
    const fromEnv = (import.meta as any).env?.VITE_API_BASE || (import.meta as any).env?.VITE_API_URL;
    if (fromEnv?.trim()) return normalizeApiBase(fromEnv);

    if (typeof window !== 'undefined') {
        if (isNativeApp()) {
            return normalizeApiBase(PRODUCTION_API);
        }
        return '/api';
    }
    return normalizeApiBase(PRODUCTION_API);
};

export let API_BASE = resolveDefaultApiBase();
export let API_ORIGIN = API_BASE.replace(/\/api\/?$/, '');

// Fallback URLs for dev/testing on Android emulator
const DEV_FALLBACKS = [
    'http://127.0.0.1:3000/api',
    PRODUCTION_API,
];

// Add 10.0.2.2 only when on a native Android device (emulator)
if (isNativeApp()) {
    DEV_FALLBACKS.unshift('http://10.0.2.2:3000/api');
}

// In dev mode, try fallbacks to find a local server (emulator dev only).
// Skip entirely if we're already on the production origin to avoid mixed content warnings.
if (typeof window !== 'undefined' && isDevMode()) {
    const currentOrigin = window.location.origin;
    if (currentOrigin === 'https://estilovivo.xyoncloud.win') {
        // Already on production — no need to probe fallbacks
        console.log('[API] Production origin detected, skipping dev fallback loop');
    } else {
        (async () => {
            for (const url of DEV_FALLBACKS) {
                try {
                    const controller = new AbortController();
                    const id = setTimeout(() => controller.abort(), 3000);
                    const res = await fetch(`${url.replace('/api', '')}/api/health`, { signal: controller.signal });
                    clearTimeout(id);
                    if (res.ok) {
                        API_BASE = url;
                        API_ORIGIN = url.replace(/\/api\/?$/, '');
                        console.log(`[API] Dev mode connected to: ${url}`);
                        return;
                    }
                } catch { /* try next */ }
            }
        })();
    }
}

const AUTH_TOKEN_KEY = 'beyour_token';
const REMEMBER_ME_KEY = 'beyour_remember_me';
const SESSION_KEYS = [
    AUTH_TOKEN_KEY,
    REMEMBER_ME_KEY,
    'beyour_user',
    'beyour_garments',
    'beyour_looks',
    'beyour_planner',
    'beyour_trips'
];
let currentAuthToken: string | null = null;

const getRememberMe = () => localStorage.getItem(REMEMBER_ME_KEY) === 'true';
export const setRememberMeFlag = (remember: boolean) => {
    localStorage.setItem(REMEMBER_ME_KEY, remember ? 'true' : 'false');
};

export const clearPersistedSession = () => {
    SESSION_KEYS.forEach(key => localStorage.removeItem(key));
};

const getAuthTokenSync = () => localStorage.getItem(AUTH_TOKEN_KEY) || currentAuthToken;

export const loadAuthToken = async (): Promise<void> => {
    if (!getRememberMe()) {
        currentAuthToken = null;
        localStorage.removeItem(AUTH_TOKEN_KEY);
        return;
    }

    const secureToken = await getSecureItem(AUTH_TOKEN_KEY);
    if (secureToken) {
        localStorage.setItem(AUTH_TOKEN_KEY, secureToken);
    }
};

export const cacheAuthToken = async (token: string, remember: boolean = true): Promise<void> => {
    currentAuthToken = token;
    setRememberMeFlag(remember);

    if (remember) {
        localStorage.setItem(AUTH_TOKEN_KEY, token);
        await setSecureItem(AUTH_TOKEN_KEY, token);
    } else {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        await removeSecureItem(AUTH_TOKEN_KEY);
    }
};

export const clearAuthToken = async (): Promise<void> => {
    currentAuthToken = null;
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setRememberMeFlag(false);
    await removeSecureItem(AUTH_TOKEN_KEY);
};

const resolveAssetUrl = (url?: string | null): string | undefined => {
    if (!url) return undefined;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
        return url;
    }
    if (url.startsWith('/')) return `${API_ORIGIN}${url}`;
    return `${API_ORIGIN}/${url}`;
};

const normalizeUser = (user: any): UserState => ({
    ...user,
    avatar: resolveAssetUrl(user?.avatar),
    fullBodyAvatar: resolveAssetUrl(user?.fullBodyAvatar),
});

const normalizeAssetsDeep = <T>(value: T): T => {
    if (Array.isArray(value)) return value.map(item => normalizeAssetsDeep(item)) as T;
    if (!value || typeof value !== 'object') return value;

    const normalized: any = { ...(value as any) };
    for (const key of Object.keys(normalized)) {
        const item = normalized[key];
        if (typeof item === 'string' && (item.startsWith('/api/uploads') || item.startsWith('/uploads'))) {
            normalized[key] = resolveAssetUrl(item);
        } else if (Array.isArray(item) || (item && typeof item === 'object')) {
            normalized[key] = normalizeAssetsDeep(item);
        }
    }
    return normalized;
};

const getHeaders = () => {
    const token = getAuthTokenSync();
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
};

export const getAuthHeader = () => {
    const token = getAuthTokenSync();
    return {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
};

// Simple in-memory cache for GET requests
const cache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCached = (key: string) => {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expiry) return entry.data;
  cache.delete(key);
  return null;
};

const setCache = (key: string, data: any) => {
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL });
};

const invalidateCache = (prefix?: string) => {
  if (prefix) {
    for (const key of cache.keys()) {
      if (key.startsWith(prefix)) cache.delete(key);
    }
  } else {
    cache.clear();
  }
};

export const getSocketOrigin = () => API_ORIGIN;

export const parseApiErrorMessage = async (res: Response): Promise<string> => {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        const body = await res.json().catch(() => ({}));
        if (typeof body?.error === 'string') return body.error;
        if (typeof body?.message === 'string') return body.message;
        if (typeof body?.detail === 'string') return body.detail;
        return `Error ${res.status}`;
    }
    const text = await res.text().catch(() => '');
    if (text) {
        return text.length > 200 ? `Error ${res.status}` : text;
    }
    return `Error ${res.status}: no se pudo procesar la respuesta del servidor`;
};

const fetchWithRetry = async (url: string, options: RequestInit = {}, retries = 1): Promise<Response> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);
            const res = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timeout);
            return res;
        } catch (err: any) {
            if (attempt === retries || err?.name === 'AbortError') throw err;
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
    }
    throw new Error('Request failed');
};

const handleResponse = async (res: Response) => {
    if (!res.ok) {
        const message = await parseApiErrorMessage(res);
        const error = { error: message };

        // Auto-logout en caso de token expirado o inválido (401 o 403 por token)
        if (res.status === 401 || (res.status === 403 && error.error === 'Invalid or expired token')) {
            await clearAuthToken();
            clearPersistedSession();
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('auth:expired'));
            }
        }

        throw new Error(error.error || 'Request failed');
    }
    if (res.status === 204) return null;
    return res.json().catch(() => {
        throw new Error('Respuesta inválida del servidor');
    });
};

// Helper: map backend product to frontend Garment
const mapProductToGarment = (p: any): Garment | undefined => {
    if (!p) return undefined;
    return {
        id: p.id,
        imageUrl: resolveAssetUrl(p.images?.[0]?.url) || `${API_ORIGIN}/api/uploads/placeholder.png`,
        name: p.name || p.category,
        type: p.category || 'top',
        color: p.color || 'varios',
        season: p.season || 'all',
        usageCount: p.usageCount || 0,
        lastWorn: p.lastWorn || undefined,
        forSale: p.forSale || false,
        price: p.price || 0,
        brand: p.brand || undefined,
        size: p.size || undefined,
        condition: p.condition || 'new',
        description: p.description || undefined,
        userId: p.userId || p.user?.id,
        userName: p.user?.name,
        userAvatar: resolveAssetUrl(p.user?.avatar),
    };
};

// Helper: map backend look to frontend Look
const mapLook = (l: any): Look | undefined => {
    if (!l) return undefined;
    return {
        id: l.id,
        name: l.title || l.name,
        garmentIds: (l.products || l.garments)?.filter((p: any) => !!p).map((p: any) => p.id) || [],
        garments: (l.products || l.garments)?.map(mapProductToGarment).filter((g: any) => !!g) || [],
        tags: l.mood ? [l.mood] : [],
        mood: l.mood,
        createdAt: l.createdAt,
        isPublic: l.isPublic,
        imageUrl: resolveAssetUrl(l.images?.[0]?.url || l.products?.[0]?.images?.[0]?.url),
        userId: l.userId || l.user?.id,
        userName: l.user?.name,
        userAvatar: resolveAssetUrl(l.user?.avatar),
        likesCount: l.likesCount ?? l._count?.likes ?? 0,
        commentsCount: l.commentsCount ?? l._count?.comments ?? 0,
        isLiked: l.isLiked || false,
        isFavorited: l.isFavorited || false,
    };
};

export const api = {
    auth: async (credentials: { email: string; password: string }, remember: boolean = true) => {
        const res = await fetch(`${API_BASE}/auth/login`, {
            credentials: 'include',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials),
        });

        const data = await handleResponse(res);
        if (data.token) {
            await cacheAuthToken(data.token, remember);
        }
        return { ...data, user: normalizeUser(data.user) };
    },

    login: async (credentials: { email: string; password: string }, remember: boolean = true) => {
        return api.auth(credentials, remember);
    },

    register: async (userData: { email: string; password: string; name: string; gender?: 'male' | 'female' | 'other'; birthDate?: string }, remember: boolean = true) => {
        const res = await fetch(`${API_BASE}/auth/register`, {
            credentials: 'include', method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        const data = await handleResponse(res);
        if (data.token) {
            await cacheAuthToken(data.token, remember);
        }
        return data;
    },

    logout: async () => {
        try {
            await fetch(`${API_BASE}/auth/logout`, {
                credentials: 'include',
                method: 'POST'
            });
        } catch (e) {
            console.error('Logout error', e);
        } finally {
            clearPersistedSession();
            await clearAuthToken();
        }
    },

    deleteAccount: async () => {
        const res = await fetch(`${API_BASE}/auth/profile`, {
            credentials: 'include',
            method: 'DELETE'
        });
        return handleResponse(res);
    },

    changePassword: async (passwords: { currentPassword: string; newPassword: string }) => {
        const res = await fetch(`${API_BASE}/auth/change-password`, {
            credentials: 'include',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(passwords)
        });
        return handleResponse(res);
    },

    forgotPassword: async (email: string) => {
        const res = await fetch(`${API_BASE}/auth/forgot-password`, {
            credentials: 'include',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        return handleResponse(res);
    },

    resetPassword: async (data: { token: string; newPassword: string }) => {
        const res = await fetch(`${API_BASE}/auth/reset-password`, {
            credentials: 'include',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return handleResponse(res);
    },

    resendVerification: async (email: string) => {
        const res = await fetch(`${API_BASE}/auth/resend-verification`, {
            credentials: 'include',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        return handleResponse(res);
    },

    verifyEmail: async (token: string) => {
        const res = await fetch(`${API_BASE}/auth/verify-email`, {
            credentials: 'include',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
        return handleResponse(res);
    },

    getMe: async (): Promise<UserState> => {
        const res = await fetch(`${API_BASE}/auth/me`, { headers: getHeaders(), credentials: 'include' });
        const updated = await handleResponse(res);
        return normalizeUser(updated);
    },

    updateProfile: async (data: Partial<UserState>): Promise<UserState> => {
        const res = await fetch(`${API_BASE}/auth/profile`, {
            credentials: 'include', method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        const updated = await handleResponse(res);
        return normalizeUser(updated);
    },

    updateProfileWithAvatar: async (data: FormData): Promise<UserState> => {
        const res = await fetch(`${API_BASE}/auth/profile`, {
            credentials: 'include', method: 'PUT',
            headers: getAuthHeader() as any,
            body: data
        });
        const updated = await handleResponse(res);
        return normalizeUser(updated);
    },

    updateUserPreferences: async (preferences: Record<string, unknown>): Promise<void> => {
        await fetch(`${API_BASE}/auth/preferences`, {
            credentials: 'include', method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(preferences)
        });
    },


    // ============= GARMENTS / PRODUCTS =============
    getGarments: async (): Promise<Garment[]> => {
        const res = await fetch(`${API_BASE}/products`, { headers: getHeaders(), credentials: 'include' });
        const data = await handleResponse(res);
        // Backend now returns { items, nextCursor, hasMore } for pagination
        const items = data.items || data; // Fallback for backwards compatibility
        return items.map(mapProductToGarment).filter((g: any) => !!g);
    },

    addGarment: async (garment: { file?: File; name?: string; category: string; color?: string; season?: string; brand?: string; size?: string; forSale?: boolean; price?: number; condition?: string; description?: string }): Promise<Garment> => {
        const formData = new FormData();
        formData.append('name', garment.name || garment.category);
        formData.append('category', garment.category);
        if (garment.color) formData.append('color', garment.color);
        if (garment.season) formData.append('season', garment.season);
        if (garment.brand) formData.append('brand', garment.brand);
        if (garment.size) formData.append('size', garment.size);
        if (garment.forSale !== undefined) formData.append('forSale', String(garment.forSale));
        if (garment.price !== undefined) formData.append('price', String(garment.price));
        if (garment.condition) formData.append('condition', garment.condition);
        if (garment.description) formData.append('description', garment.description);
        if (garment.file) formData.append('images', garment.file);

        const res = await fetch(`${API_BASE}/products`, {
            credentials: 'include', method: 'POST',
            headers: getAuthHeader() as any,
            body: formData
        });
        const p = await handleResponse(res);
        return mapProductToGarment(p)!;
    },

    updateGarment: async (id: string, data: Partial<Garment>): Promise<Garment> => {
        const res = await fetch(`${API_BASE}/products/${id}`, {
            credentials: 'include', method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({
                name: data.name || data.type,
                category: data.type,
                color: data.color,
                season: data.season,
                price: data.price === null ? null : data.price,
                forSale: data.forSale,
                usageCount: data.usageCount,
                isWashing: data.isWashing,
                brand: data.brand,
                size: data.size,
                condition: data.condition,
                description: data.description,
            })
        });
        const p = await handleResponse(res);
        return mapProductToGarment(p)!;
    },

    deleteGarment: async (id: string): Promise<void> => {
        const res = await fetch(`${API_BASE}/products/${id}`, {
            credentials: 'include', method: 'DELETE',
            headers: getHeaders()
        });
        await handleResponse(res);
    },

    markAsWorn: async (id: string): Promise<Garment> => {
        const res = await fetch(`${API_BASE}/products/${id}/wear`, {
            credentials: 'include', method: 'POST',
            headers: getHeaders()
        });
        const p = await handleResponse(res);
        return mapProductToGarment(p)!;
    },

    getShopProducts: async (search?: string, category?: string): Promise<ShopItem[]> => {
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (category) params.append('category', category);

        const res = await fetch(`${API_BASE}/products/shop?${params.toString()}`, { headers: getHeaders(), credentials: 'include' });
        const data = await handleResponse(res);
        return data.map((p: any): ShopItem => ({
            id: p.id,
            user: p.user?.name || 'Vendedor',
            userId: p.user?.id || '',
            avatar: resolveAssetUrl(p.user?.avatar) || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.user?.name || 'V')}&background=0F4C5C&color=fff`,
            image: resolveAssetUrl(p.images?.[0]?.url) || `${API_ORIGIN}/api/uploads/placeholder.png`,
            title: p.name || p.category,
            price: p.price || 0,
            size: p.size || 'Única',
            brand: p.brand || 'Sin marca',
            condition: p.condition || 'new',
        }));
    },

    // ============= LOOKS =============
    getLooks: async (): Promise<Look[]> => {
        const res = await fetch(`${API_BASE}/looks`, { headers: getHeaders(), credentials: 'include' });
        const data = await handleResponse(res);
        // Backend now returns { items, nextCursor, hasMore } for pagination
        const items = data.items || data; // Fallback for backwards compatibility
        return items.map(mapLook).filter((l: any) => !!l);
    },

    getCommunityFeed: async (cursor?: string): Promise<{ items: Look[]; nextCursor?: string | null; hasMore?: boolean }> => {
        const params = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
        const res = await fetchWithRetry(`${API_BASE}/looks/feed${params}`, { headers: getHeaders(), credentials: 'include' });
        const data = await handleResponse(res);
        const items = (data.items || data).map(mapLook).filter((l: any) => !!l);
        return { items, nextCursor: data.nextCursor, hasMore: data.hasMore };
    },

    saveLook: async (look: Look): Promise<Look> => {
        const res = await fetch(`${API_BASE}/looks`, {
            credentials: 'include', method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                title: look.name,
                productIds: JSON.stringify(look.garmentIds),
                isPublic: look.isPublic || false,
                mood: look.mood,
            })
        });
        const l = await handleResponse(res);
        return mapLook(l)!;
    },

    saveLookWithImage: async (name: string, productIds: string[], imageBlob: Blob): Promise<Look> => {
        const formData = new FormData();
        formData.append('title', name);
        formData.append('productIds', JSON.stringify(productIds));
        formData.append('images', imageBlob, 'look.png');
        
        const res = await fetch(`${API_BASE}/looks`, {
            credentials: 'include', method: 'POST',
            headers: getAuthHeader() as any,
            body: formData
        });
        const l = await handleResponse(res);
        return mapLook(l)!;
    },

    updateLook: async (id: string, data: Partial<Look>): Promise<Look> => {
        const res = await fetch(`${API_BASE}/looks/${id}`, {
            credentials: 'include', method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({
                title: data.name,
                isPublic: data.isPublic,
                mood: data.mood,
                productIds: data.garmentIds ? JSON.stringify(data.garmentIds) : undefined,
            })
        });
        const l = await handleResponse(res);
        return mapLook(l)!;
    },

    deleteLook: async (id: string): Promise<void> => {
        const res = await fetch(`${API_BASE}/looks/${id}`, {
            credentials: 'include', method: 'DELETE',
            headers: getHeaders()
        });
        await handleResponse(res);
    },

    // ============= TRYON PRESETS =============
    getTryonPresets: async (): Promise<any[]> => {
        const res = await fetch(`${API_BASE}/tryon-presets`, { headers: getHeaders(), credentials: 'include' });
        return handleResponse(res);
    },

    saveTryonPreset: async (preset: { name: string; thumbnail?: string; layers: any[]; rating?: number; occasion?: string }): Promise<any> => {
        const res = await fetch(`${API_BASE}/tryon-presets`, {
            method: 'POST',
            headers: { ...getHeaders(), 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(preset),
        });
        return handleResponse(res);
    },

    updateTryonPreset: async (id: string, data: Partial<{ name: string; thumbnail?: string; layers: any[]; rating?: number; occasion?: string }>): Promise<any> => {
        const res = await fetch(`${API_BASE}/tryon-presets/${id}`, {
            method: 'PUT',
            headers: { ...getHeaders(), 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data),
        });
        return handleResponse(res);
    },

    deleteTryonPreset: async (id: string): Promise<void> => {
        const res = await fetch(`${API_BASE}/tryon-presets/${id}`, {
            credentials: 'include', method: 'DELETE',
            headers: getHeaders()
        });
        await handleResponse(res);
    },

    // ============= PLANNER =============
    getPlanner: async (): Promise<PlannerEntry[]> => {
        const res = await fetch(`${API_BASE}/planner/me`, { headers: getHeaders(), credentials: 'include' });
        const data = await handleResponse(res);
        return data.map((e: any) => ({
            date: e.date,
            lookId: e.lookId,
            look: e.look ? mapLook(e.look) : undefined,
            eventNote: e.eventNote || undefined,
        }));
    },

    updatePlanner: async (entry: PlannerEntry): Promise<PlannerEntry> => {
        const res = await fetch(`${API_BASE}/planner`, {
            credentials: 'include', method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ ...entry, userId: 'me' })
        });
        const e = await handleResponse(res);
        return {
            date: e.date,
            lookId: e.lookId,
            look: e.look ? mapLook(e.look) : undefined,
            eventNote: e.eventNote || undefined,
        };
    },

    deletePlannerEntry: async (date: string): Promise<void> => {
        const res = await fetch(`${API_BASE}/planner/${date}`, {
            credentials: 'include', method: 'DELETE',
            headers: getHeaders()
        });
        await handleResponse(res);
    },

    // ============= TRIPS =============
    getTrips: async (): Promise<Trip[]> => {
        const res = await fetch(`${API_BASE}/trips/me`, { headers: getHeaders(), credentials: 'include' });
        return handleResponse(res);
    },

    saveTrip: async (trip: Trip): Promise<Trip> => {
        const { garments, ...rest } = trip;
        const payload = {
            ...rest,
            garmentIds: garments ? garments.map(g => g.id) : []
        };
        const res = await fetch(`${API_BASE}/trips`, {
            credentials: 'include', method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(payload)
        });
        return handleResponse(res);
    },

    updateTrip: async (trip: Trip): Promise<Trip> => {
        const { garments, ...rest } = trip;
        const payload = {
            ...rest,
            garmentIds: garments ? garments.map(g => g.id) : []
        };
        const res = await fetch(`${API_BASE}/trips/${trip.id}`, {
            credentials: 'include', method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(payload)
        });
        return handleResponse(res);
    },

    deleteTrip: async (id: string): Promise<void> => {
        const res = await fetch(`${API_BASE}/trips/${id}`, {
            credentials: 'include', method: 'DELETE',
            headers: getHeaders()
        });
        await handleResponse(res);
    },

    addTripItem: async (tripId: string, label: string, isEssential: boolean = false) => {
        const res = await fetch(`${API_BASE}/trips/${tripId}/items`, {
            credentials: 'include', method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ label, isEssential })
        });
        return handleResponse(res);
    },

    updateTripItem: async (tripId: string, itemId: string, data: { checked?: boolean; label?: string }) => {
        const res = await fetch(`${API_BASE}/trips/${tripId}/items/${itemId}`, {
            credentials: 'include', method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return handleResponse(res);
    },

    deleteTripItem: async (tripId: string, itemId: string) => {
        const res = await fetch(`${API_BASE}/trips/${tripId}/items/${itemId}`, {
            credentials: 'include', method: 'DELETE',
            headers: getHeaders()
        });
        return handleResponse(res);
    },

    // ============= SOCIAL =============
    toggleLike: async (lookId: string): Promise<{ liked: boolean; likesCount: number }> => {
        const res = await fetch(`${API_BASE}/social/like`, {
            credentials: 'include', method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ lookId })
        });
        return handleResponse(res);
    },

    addComment: async (lookId: string, content: string, parentId?: string): Promise<Comment> => {
        const res = await fetch(`${API_BASE}/social/comment`, {
            credentials: 'include', method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ lookId, content, parentId })
        });
        const c = await handleResponse(res);
        return {
            id: c.id,
            content: c.content,
            userId: c.user?.id || c.userId,
            userName: c.user?.name || 'Usuario',
            userAvatar: resolveAssetUrl(c.user?.avatar),
            parentId: c.parentId,
            replies: (c.replies || []).map((r: any) => ({
                id: r.id,
                content: r.content,
                userId: r.user?.id || r.userId,
                userName: r.user?.name || 'Usuario',
                userAvatar: resolveAssetUrl(r.user?.avatar),
                createdAt: r.createdAt,
            })),
            createdAt: c.createdAt,
        };
    },

    getComments: async (lookId: string): Promise<Comment[]> => {
        const res = await fetch(`${API_BASE}/social/comments/${lookId}`, { headers: getHeaders(), credentials: 'include' });
        const data = await handleResponse(res);
        return data.map((c: any) => ({
            id: c.id,
            content: c.content,
            userId: c.user?.id || c.userId,
            userName: c.user?.name || 'Usuario',
            userAvatar: resolveAssetUrl(c.user?.avatar),
            parentId: c.parentId,
            replies: (c.replies || []).map((r: any) => ({
                id: r.id,
                content: r.content,
                userId: r.user?.id || r.userId,
                userName: r.user?.name || 'Usuario',
                userAvatar: resolveAssetUrl(r.user?.avatar),
                createdAt: r.createdAt,
            })),
            createdAt: c.createdAt,
        }));
    },

    deleteComment: async (id: string): Promise<void> => {
        const res = await fetch(`${API_BASE}/social/comment/${id}`, {
            credentials: 'include', method: 'DELETE',
            headers: getHeaders()
        });
        await handleResponse(res);
    },

    toggleFavorite: async (lookId?: string, productId?: string): Promise<{ favorited: boolean }> => {
        const res = await fetch(`${API_BASE}/social/favorite`, {
            credentials: 'include', method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ lookId, productId })
        });
        return handleResponse(res);
    },

    getFavorites: async () => {
        const res = await fetch(`${API_BASE}/social/favorites`, { headers: getHeaders(), credentials: 'include' });
        const data = await handleResponse(res);
        return normalizeAssetsDeep(data);
    },

    toggleFollow: async (targetUserId: string): Promise<{ following: boolean }> => {
        const res = await fetch(`${API_BASE}/social/follow`, {
            credentials: 'include', method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ targetUserId })
        });
        return handleResponse(res);
    },

    // ============= STATS =============
    getStats: async () => {
        const res = await fetch(`${API_BASE}/stats`, { headers: getHeaders(), credentials: 'include' });
        const data = await handleResponse(res);
        return normalizeAssetsDeep(data);
    },

    getTopUsers: async (forceRefresh = false) => {
        if (!forceRefresh) {
            const cached = getCached('topUsers');
            if (cached) return cached;
        }
        const res = await fetchWithRetry(`${API_BASE}/users/top`, { headers: getHeaders(), credentials: 'include' });
        const data = await handleResponse(res);
        const normalized = normalizeAssetsDeep(data);
        setCache('topUsers', normalized);
        return normalized;
    },

    // ============= STORIES =============
    getStories: async (): Promise<StoryEntry[]> => {
        const res = await fetch(`${API_BASE}/stories`, { headers: getHeaders(), credentials: 'include' });
        const data = await handleResponse(res);
        const currentUserId = (() => {
            try {
                const raw = localStorage.getItem('beyour_user');
                return raw ? JSON.parse(raw).id : null;
            } catch { return null; }
        })();
        return (data || []).map((s: any) => ({
            id: s.id,
            userId: s.userId,
            userName: s.user?.name || 'Usuario',
            userAvatar: resolveAssetUrl(s.user?.avatar),
            type: s.type,
            text: s.text || undefined,
            imageUrl: resolveAssetUrl(s.imageUrl),
            views: s.views,
            createdAt: s.createdAt,
            expiresAt: s.expiresAt,
            isOwn: s.userId === currentUserId,
        }));
    },

    createStory: async (data: { type: string; text?: string; imageUrl?: string; imageFile?: File | null }): Promise<StoryEntry> => {
        const formData = new FormData();
        formData.append('type', data.type);
        if (data.text) formData.append('text', data.text);
        if (data.imageFile) {
            formData.append('image', data.imageFile);
        } else if (data.imageUrl) {
            formData.append('imageUrl', data.imageUrl);
        }
        const res = await fetch(`${API_BASE}/stories`, {
            credentials: 'include', method: 'POST',
            headers: getAuthHeader() as any,
            body: formData,
        });
        const s = await handleResponse(res);
        const currentUserId = (() => {
            try {
                const raw = localStorage.getItem('beyour_user');
                return raw ? JSON.parse(raw).id : null;
            } catch { return null; }
        })();
        return {
            id: s.id,
            userId: s.userId,
            userName: s.user?.name || 'Usuario',
            userAvatar: resolveAssetUrl(s.user?.avatar),
            type: s.type,
            text: s.text || undefined,
            imageUrl: resolveAssetUrl(s.imageUrl),
            views: s.views,
            createdAt: s.createdAt,
            expiresAt: s.expiresAt,
            isOwn: s.userId === currentUserId,
        };
    },

    viewStory: async (storyId: string): Promise<void> => {
        const res = await fetch(`${API_BASE}/stories/${storyId}/view`, {
            credentials: 'include', method: 'POST',
            headers: getHeaders(),
        });
        await handleResponse(res);
    },

    deleteStory: async (storyId: string): Promise<void> => {
        const res = await fetch(`${API_BASE}/stories/${storyId}`, {
            credentials: 'include', method: 'DELETE',
            headers: getHeaders(),
        });
        await handleResponse(res);
    },

    reactToStory: async (storyId: string, emoji: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_BASE}/stories/${storyId}/reaction`, {
            credentials: 'include', method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ emoji }),
        });
        return handleResponse(res);
    },

    // ============= CHAT =============
    getConversations: async (): Promise<ChatConversation[]> => {
        const res = await fetch(`${API_BASE}/chat/conversations`, { headers: getHeaders(), credentials: 'include' });
        const data = await handleResponse(res);
        return normalizeAssetsDeep(data);
    },

    createConversation: async (payload: { targetUserId: string; itemId?: string; itemTitle?: string; itemImage?: string; initialMessage?: string; }) => {
        const res = await fetch(`${API_BASE}/chat/conversations`, {
            credentials: 'include', method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(payload)
        });
        return handleResponse(res);
    },

    getConversationMessages: async (conversationId: string): Promise<ChatMessage[]> => {
        const res = await fetch(`${API_BASE}/chat/conversations/${conversationId}/messages`, { headers: getHeaders(), credentials: 'include' });
        const data = await handleResponse(res);
        return normalizeAssetsDeep(data);
    },

    sendConversationMessage: async (conversationId: string, content: string, imageUrl?: string, productId?: string): Promise<ChatMessage> => {
        const res = await fetch(`${API_BASE}/chat/conversations/${conversationId}/messages`, {
            credentials: 'include', method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ content, imageUrl, productId })
        });
        return handleResponse(res);
    },

    uploadChatImage: async (file: File): Promise<{ imageUrl: string }> => {
        const formData = new FormData();
        formData.append('image', file);
        const res = await fetch(`${API_BASE}/chat/upload`, {
            credentials: 'include', method: 'POST',
            headers: { ...getAuthHeader() },
            body: formData
        });
        return handleResponse(res);
    },

    getTrends: async (forceRefresh = false) => {
        if (!forceRefresh) {
            const cached = getCached('trends');
            if (cached) return cached;
        }
        const res = await fetchWithRetry(`${API_BASE}/trends`, { headers: getHeaders(), credentials: 'include' });
        const data = await handleResponse(res);
        setCache('trends', data);
        return data;
    },

    invalidateCache: (prefix?: string) => invalidateCache(prefix),

    // ============= CHALLENGES =============
    getCurrentChallenge: async () => {
        const res = await fetch(`${API_BASE}/challenges/current`, { headers: getHeaders(), credentials: 'include' });
        return handleResponse(res);
    },

    getMySubmissions: async () => {
        const res = await fetch(`${API_BASE}/challenges/my-submissions`, { headers: getHeaders(), credentials: 'include' });
        return handleResponse(res);
    },

    getChallengeHistory: async () => {
        const res = await fetch(`${API_BASE}/challenges/history`, { headers: getHeaders(), credentials: 'include' });
        return handleResponse(res);
    },

    submitChallenge: async (formData: FormData) => {
        const res = await fetch(`${API_BASE}/challenges/submit`, {
            credentials: 'include', method: 'POST',
            headers: { ...getAuthHeader() },
            body: formData
        });
        return handleResponse(res);
    },

    deleteChallengeSubmission: async (id: string) => {
        const res = await fetch(`${API_BASE}/challenges/submissions/${id}`, {
            credentials: 'include', method: 'DELETE',
            headers: { ...getAuthHeader() }
        });
        return handleResponse(res);
    },

    forceRotateChallenge: async () => {
        const res = await fetch(`${API_BASE}/challenges/force-rotate`, {
            credentials: 'include', method: 'POST',
            headers: { ...getAuthHeader() }
        });
        return handleResponse(res);
    },

    // ============= GAMIFICATION =============
    getGamificationProgress: async () => {
        const res = await fetch(`${API_BASE}/gamification/progress`, { headers: getHeaders(), credentials: 'include' });
        return handleResponse(res);
    },

    getAchievements: async () => {
        const res = await fetch(`${API_BASE}/gamification/achievements`, { headers: getHeaders(), credentials: 'include' });
        return handleResponse(res);
    },

    getBadges: async () => {
        const res = await fetch(`${API_BASE}/gamification/badges`, { headers: getHeaders(), credentials: 'include' });
        return handleResponse(res);
    },

    checkAchievements: async () => {
        const res = await fetch(`${API_BASE}/gamification/check-achievements`, {
            credentials: 'include', method: 'POST',
            headers: { ...getAuthHeader() }
        });
        return handleResponse(res);
    },

    gamificationLogin: async () => {
        const res = await fetch(`${API_BASE}/gamification/login`, {
            credentials: 'include', method: 'POST',
            headers: { ...getAuthHeader() }
        });
        return handleResponse(res);
    },
};

