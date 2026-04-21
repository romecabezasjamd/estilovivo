import { Garment, Look, PlannerEntry, UserState, Trip, Comment, CommunityPost, ShopItem, ChatConversation, ChatMessage } from '../types';

const API_BASE = '/api';

const getHeaders = () => {
    const token = localStorage.getItem('beyour_token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
};

const getAuthHeader = () => {
    const token = localStorage.getItem('beyour_token');
    return {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
};

const handleResponse = async (res: Response) => {
    if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Request failed' }));

        // Auto-logout en caso de token expirado o inválido (401 o 403 por token)
        if (res.status === 401 || (res.status === 403 && error.error === 'Invalid or expired token')) {
            localStorage.removeItem('beyour_token');
            localStorage.removeItem('beyour_user');
            window.location.href = '/';
        }

        throw new Error(error.error || 'Request failed');
    }
    return res.json();
};

// Helper: map backend product to frontend Garment
const mapProductToGarment = (p: any): Garment | null => {
    if (!p) return null;
    return {
        id: p.id,
        imageUrl: p.images?.[0]?.url || '/api/uploads/placeholder.png',
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
        userAvatar: p.user?.avatar,
    };
};

// Helper: map backend look to frontend Look
const mapLook = (l: any): Look | null => {
    if (!l) return null;
    return {
        id: l.id,
        name: l.title || l.name,
        garmentIds: (l.products || l.garments)?.filter((p: any) => !!p).map((p: any) => p.id) || [],
        garments: (l.products || l.garments)?.map(mapProductToGarment).filter((g: any) => !!g) || [],
        tags: l.mood ? [l.mood] : [],
        mood: l.mood,
        createdAt: l.createdAt,
        isPublic: l.isPublic,
        imageUrl: l.images?.[0]?.url || l.products?.[0]?.images?.[0]?.url || undefined,
        userId: l.userId || l.user?.id,
        userName: l.user?.name,
        userAvatar: l.user?.avatar,
        likesCount: l.likesCount ?? l._count?.likes ?? 0,
        commentsCount: l.commentsCount ?? l._count?.comments ?? 0,
        isLiked: l.isLiked || false,
        isFavorited: l.isFavorited || false,
    };
};

export const api = {
    // ============= AUTH =============
    login: async (credentials: { email: string; password: string }) => {
        const res = await fetch(`${API_BASE}/auth/login`, {
            credentials: 'include', method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials)
        });
        const data = await handleResponse(res);
        if (data.token) {
            localStorage.setItem('beyour_token', data.token);
        }
        return data;
    },

    register: async (userData: { email: string; password: string; name: string; gender?: 'male' | 'female' | 'other'; birthDate?: string }) => {
        const res = await fetch(`${API_BASE}/auth/register`, {
            credentials: 'include', method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        const data = await handleResponse(res);
        if (data.token) {
            localStorage.setItem('beyour_token', data.token);
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
            localStorage.removeItem('beyour_user');
            localStorage.removeItem('beyour_token');
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
        return handleResponse(res);
    },

    updateProfile: async (data: Partial<UserState>): Promise<UserState> => {
        const res = await fetch(`${API_BASE}/auth/profile`, {
            credentials: 'include', method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return handleResponse(res);
    },

    updateProfileWithAvatar: async (data: FormData): Promise<UserState> => {
        const res = await fetch(`${API_BASE}/auth/profile`, {
            credentials: 'include', method: 'PUT',
            headers: getAuthHeader() as any,
            body: data
        });
        return handleResponse(res);
    },


    // ============= GARMENTS / PRODUCTS =============
    getGarments: async (): Promise<Garment[]> => {
        const res = await fetch(`${API_BASE}/products`, { headers: getHeaders(), credentials: 'include' });
        const data = await handleResponse(res);
        // Backend now returns { items, nextCursor, hasMore } for pagination
        const items = data.items || data; // Fallback for backwards compatibility
        return items.map(mapProductToGarment).filter((g: any) => !!g);
    },

    addGarment: async (garment: { file?: File; name?: string; category: string; color?: string; season?: string; brand?: string; size?: string }): Promise<Garment> => {
        const formData = new FormData();
        formData.append('name', garment.name || garment.category);
        formData.append('category', garment.category);
        if (garment.color) formData.append('color', garment.color);
        if (garment.season) formData.append('season', garment.season);
        if (garment.brand) formData.append('brand', garment.brand);
        if (garment.size) formData.append('size', garment.size);
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
            avatar: p.user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.user?.name || 'V')}&background=0F4C5C&color=fff`,
            image: p.images?.[0]?.url || '/api/uploads/placeholder.png',
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

    getCommunityFeed: async (): Promise<Look[]> => {
        const res = await fetch(`${API_BASE}/looks/feed`, { headers: getHeaders(), credentials: 'include' });
        const data = await handleResponse(res);
        // Backend now returns { items, nextCursor, hasMore } for pagination
        const items = data.items || data; // Fallback for backwards compatibility
        return items.map(mapLook).filter((l: any) => !!l);
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

    addComment: async (lookId: string, content: string): Promise<Comment> => {
        const res = await fetch(`${API_BASE}/social/comment`, {
            credentials: 'include', method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ lookId, content })
        });
        const c = await handleResponse(res);
        return {
            id: c.id,
            content: c.content,
            userId: c.user?.id || c.userId,
            userName: c.user?.name || 'Usuario',
            userAvatar: c.user?.avatar,
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
            userAvatar: c.user?.avatar,
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
        return handleResponse(res);
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
        return handleResponse(res);
    },

    getTopUsers: async () => {
        const res = await fetch(`${API_BASE}/users/top`, { headers: getHeaders(), credentials: 'include' });
        return handleResponse(res);
    },

    // ============= CHAT =============
    getConversations: async (): Promise<ChatConversation[]> => {
        const res = await fetch(`${API_BASE}/chat/conversations`, { headers: getHeaders(), credentials: 'include' });
        return handleResponse(res);
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
        return handleResponse(res);
    },

    sendConversationMessage: async (conversationId: string, content: string): Promise<ChatMessage> => {
        const res = await fetch(`${API_BASE}/chat/conversations/${conversationId}/messages`, {
            credentials: 'include', method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ content })
        });
        return handleResponse(res);
    },

    getTrends: async () => {
        const res = await fetch(`${API_BASE}/trends`, { headers: getHeaders(), credentials: 'include' });
        return handleResponse(res);
    },
};

