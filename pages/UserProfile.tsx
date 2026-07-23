import React, { useEffect, useState } from 'react';
import { ArrowLeft, Heart, MapPin, ShoppingBag, Shirt, Users, UserPlus, UserCheck, ExternalLink } from 'lucide-react';
import { api } from '../services/api';

interface Props {
  userId: string;
  onBack: () => void;
  onNavigate: (tab: string, subTab?: string) => void;
  onStartChat?: (userId: string) => void;
}

interface UserProfileData {
  id: string;
  name: string;
  avatar: string | null;
  bio: string | null;
  locationName: string | null;
  followersCount: number;
  followingCount: number;
  garmentCount: number;
  lookCount: number;
  isFollowing: boolean;
  products: any[];
  looks: any[];
}

export default function UserProfile({ userId, onBack, onNavigate, onStartChat }: Props) {
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState<'looks' | 'items'>('looks');

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    try {
      const data = await api.getUserProfile(userId);
      setProfile(data);
      setFollowing(data.isFollowing);
    } catch (e) {
      console.error('Error loading profile:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    try {
      const res = await api.toggleFollow(userId);
      setFollowing(res.following);
      setProfile(prev => prev ? {
        ...prev,
        followersCount: res.following ? prev.followersCount + 1 : prev.followersCount - 1,
        isFollowing: res.following,
      } : prev);
    } catch (e) {
      console.error('Error following:', e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex flex-col items-center justify-center px-4">
        <p className="text-[var(--text-secondary)]">Usuario no encontrado</p>
        <button onClick={onBack} className="mt-4 text-primary font-medium text-sm">Volver</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] pb-24">
      <div className="sticky top-0 z-10 bg-[var(--bg-base)] border-b border-[var(--border-light)]">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={onBack} className="p-2 rounded-xl hover:bg-[var(--bg-card)] transition-colors">
            <ArrowLeft size={20} className="text-[var(--text-primary)]" />
          </button>
          <h1 className="text-lg font-bold text-[var(--text-primary)]">{profile.name}</h1>
        </div>
      </div>

      <div className="px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-[var(--bg-card)] border-2 border-primary/20">
            {profile.avatar ? (
              <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-primary">
                {profile.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1">
            <div className="flex gap-6 text-center">
              <div>
                <div className="text-lg font-bold text-[var(--text-primary)]">{profile.garmentCount}</div>
                <div className="text-xs text-[var(--text-muted)]">Prendas</div>
              </div>
              <div>
                <div className="text-lg font-bold text-[var(--text-primary)]">{profile.lookCount}</div>
                <div className="text-xs text-[var(--text-muted)]">Looks</div>
              </div>
              <div>
                <div className="text-lg font-bold text-[var(--text-primary)]">{profile.followersCount}</div>
                <div className="text-xs text-[var(--text-muted)]">Seguidores</div>
              </div>
            </div>
          </div>
        </div>

        {profile.bio && (
          <p className="text-sm text-[var(--text-secondary)] mb-4">{profile.bio}</p>
        )}

        {profile.locationName && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mb-4">
            <MapPin size={14} />
            <span>{profile.locationName}</span>
          </div>
        )}

        <div className="flex gap-2 mb-6">
          <button
            onClick={handleFollow}
            className={`flex-1 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${
              following
                ? 'bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-light)]'
                : 'bg-primary text-white'
            }`}
          >
            {following ? <UserCheck size={16} /> : <UserPlus size={16} />}
            {following ? 'Siguiendo' : 'Seguir'}
          </button>

          {onStartChat && (
            <button
              onClick={() => onStartChat(profile.id)}
              className="py-2.5 px-4 rounded-xl font-semibold text-sm border border-[var(--border-light)] text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-all active:scale-95"
            >
              Chat
            </button>
          )}
        </div>

        <div className="flex gap-2 border-b border-[var(--border-light)] mb-4">
          <button
            onClick={() => setActiveTab('looks')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              activeTab === 'looks' ? 'text-primary border-b-2 border-primary' : 'text-[var(--text-muted)]'
            }`}
          >
            Looks ({profile.looks.length})
          </button>
          <button
            onClick={() => setActiveTab('items')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              activeTab === 'items' ? 'text-primary border-b-2 border-primary' : 'text-[var(--text-muted)]'
            }`}
          >
            En venta ({profile.products.length})
          </button>
        </div>

        {activeTab === 'looks' && (
          <div className="grid grid-cols-2 gap-3">
            {profile.looks.map(look => (
              <div key={look.id} className="rounded-2xl overflow-hidden bg-[var(--bg-card)] border border-[var(--border-light)]">
                {look.images?.[0]?.url ? (
                  <img src={look.images[0].url} alt={look.title} className="w-full aspect-square object-cover" />
                ) : (
                  <div className="w-full aspect-square bg-[var(--bg-elevated)] flex items-center justify-center">
                    <Shirt size={24} className="text-[var(--text-muted)]" />
                  </div>
                )}
                <div className="p-2">
                  <p className="text-xs font-medium text-[var(--text-primary)] truncate">{look.title}</p>
                </div>
              </div>
            ))}
            {profile.looks.length === 0 && (
              <p className="col-span-2 text-center text-sm text-[var(--text-muted)] py-8">No hay looks públicos</p>
            )}
          </div>
        )}

        {activeTab === 'items' && (
          <div className="grid grid-cols-2 gap-3">
            {profile.products.map(item => (
              <div key={item.id} className="rounded-2xl overflow-hidden bg-[var(--bg-card)] border border-[var(--border-light)]">
                {item.images?.[0]?.url ? (
                  <img src={item.images[0].url} alt={item.name} className="w-full aspect-square object-cover" />
                ) : (
                  <div className="w-full aspect-square bg-[var(--bg-elevated)] flex items-center justify-center">
                    <Shirt size={24} className="text-[var(--text-muted)]" />
                  </div>
                )}
                <div className="p-2">
                  <p className="text-xs font-medium text-[var(--text-primary)] truncate">{item.name}</p>
                  {item.price && (
                    <p className="text-xs font-bold text-primary">{item.price.toFixed(2)} EUR</p>
                  )}
                </div>
              </div>
            ))}
            {profile.products.length === 0 && (
              <p className="col-span-2 text-center text-sm text-[var(--text-muted)] py-8">No hay prendas en venta</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
