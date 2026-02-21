import React, { useState, useEffect, useMemo, useRef } from 'react';
import { UserState, Look, Garment, PlannerEntry } from '../types';
import { api } from '../services/api';
import {
  User, Settings, LogOut, Heart, Camera, Edit3, Save, X,
  ShoppingBag, Shirt, Calendar, Star, TrendingUp, ChevronRight,
  Eye, Bookmark, Bell, Shield, Moon, Music, BarChart3, Download,
  HelpCircle, Lock, Palette
} from 'lucide-react';
import { applyTheme, getSavedTheme, ThemeColor, THEMES } from '../utils/theme';

interface ProfileProps {
  user: UserState;
  plannerEntries: PlannerEntry[];
  looks: Look[];
  onUpdateUser: (user: UserState) => void;
  garments: Garment[];
  onNavigate: (tab: string) => void;
}

const Profile: React.FC<ProfileProps> = ({ user, plannerEntries, looks, onUpdateUser, garments, onNavigate }) => {
  const [activeSection, setActiveSection] = useState<'stats' | 'favorites' | 'settings'>('stats');
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [editBio, setEditBio] = useState(user.bio || '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loadingFavs, setLoadingFavs] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [currentTheme, setCurrentTheme] = useState<ThemeColor>(getSavedTheme());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Settings state
  const [cycleTracking, setCycleTracking] = useState(user.cycleTracking || false);
  const [musicSync, setMusicSync] = useState(user.musicSync || false);

  // Load stats
  useEffect(() => {
    const loadStats = async () => {
      try {
        const s = await api.getStats();
        setStats(s);
      } catch (e) {
        console.warn('Could not load stats:', e);
      }
    };
    loadStats();
  }, []);

  // Load favorites when tab selected
  useEffect(() => {
    if (activeSection === 'favorites' && favorites.length === 0) {
      setLoadingFavs(true);
      api.getFavorites()
        .then(data => setFavorites(data))
        .catch(e => console.warn('Could not load favorites:', e))
        .finally(() => setLoadingFavs(false));
    }
  }, [activeSection]);

  // Computed stats
  const totalGarments = garments.length;
  const totalLooks = looks.length;
  const plannedDays = plannerEntries.filter(p => p.lookId).length;
  const avgUsage = useMemo(() => {
    if (garments.length === 0) return 0;
    return Math.round(garments.reduce((sum, g) => sum + (g.usageCount || 0), 0) / garments.length);
  }, [garments]);

  const mostWornGarment = useMemo(() => {
    if (garments.length === 0) return null;
    return [...garments].sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))[0];
  }, [garments]);

  const categoryBreakdown = useMemo(() => {
    const cats: Record<string, number> = {};
    garments.forEach(g => {
      cats[g.type] = (cats[g.type] || 0) + 1;
    });
    return Object.entries(cats)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
  }, [garments]);

  const seasonBreakdown = useMemo(() => {
    const seasons: Record<string, number> = {};
    garments.forEach(g => {
      const s = g.season || 'all';
      seasons[s] = (seasons[s] || 0) + 1;
    });
    return seasons;
  }, [garments]);

  // Avatar selection
  const handleAvatarClick = () => {
    if (editing) fileInputRef.current?.click();
  };
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Save profile
  const handleSave = async () => {
    setSaving(true);
    try {
      let updatedUser: UserState;
      if (avatarFile) {
        const formData = new FormData();
        formData.append('avatar', avatarFile);
        formData.append('name', editName);
        formData.append('bio', editBio);
        updatedUser = await api.updateProfileWithAvatar(formData);
      } else {
        updatedUser = await api.updateProfile({ name: editName, bio: editBio });
      }
      onUpdateUser(updatedUser);
      setEditing(false);
      setAvatarFile(null);
      setAvatarPreview(null);
    } catch (error) {
      console.error('Error saving profile:', error);
      // Fallback local
      onUpdateUser({ ...user, name: editName, bio: editBio });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  // Save settings
  const handleToggleSetting = async (setting: 'cycleTracking' | 'musicSync', value: boolean) => {
    if (setting === 'cycleTracking') setCycleTracking(value);
    else setMusicSync(value);

    try {
      await api.updateProfile({ [setting]: value });
      onUpdateUser({ ...user, [setting]: value });
    } catch (e) {
      console.warn('Error saving setting:', e);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await api.logout();
    } catch (e) {
      console.warn('Error logging out:', e);
    } finally {
      localStorage.removeItem('beyour_token');
      localStorage.removeItem('beyour_user');
      window.location.reload();
    }
  };

  const handleMoveToWardrobe = async (fav: any) => {
    if (!fav.product) return;

    setActionLoadingId(fav.id);
    try {
      // Create a new garment from the product
      const garmentData = {
        name: fav.product.name,
        category: fav.product.category || 'otro',
        color: fav.product.color || 'neutral',
      };

      await api.addGarment(garmentData);

      // Toggle favorite to remove it
      await api.toggleFavorite(undefined, fav.product.id);

      // Update favorites list
      setFavorites(favorites.filter(f => f.id !== fav.id));
    } catch (e) {
      console.warn('Error moving to wardrobe:', e);
    } finally {
      setActionLoadingId(null);
    }
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditName(user.name);
    setEditBio(user.bio || '');
    setAvatarPreview(null);
    setAvatarFile(null);
  };

  const seasonLabels: Record<string, string> = {
    summer: 'Verano',
    winter: 'Invierno',
    all: 'Todo el año',
    transition: 'Entretiempo'
  };

  const avatarUrl = avatarPreview || user.avatar;

  return (
    <div className="max-w-md mx-auto pb-6 animate-fade-in">
      {/* Header */}
      <div className="bg-gradient-to-br from-[var(--color-primary)] via-[var(--color-primary-dark)] to-[var(--color-accent)] rounded-b-3xl p-6 pb-24 relative transition-all duration-500 overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full -ml-16 -mb-16" />

        <div className="flex justify-between items-start relative z-10">
          <div>
            <h1 className="text-white text-2xl font-bold mb-1">Mi Perfil</h1>
            <p className="text-white/70 text-sm">Gestiona tu información</p>
          </div>
          <div className="flex gap-2">
            {editing ? (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-white/20 backdrop-blur-sm p-2.5 rounded-xl text-white hover:bg-white/30 transition shadow-lg"
                >
                  {saving ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Save size={20} />}
                </button>
                <button
                  onClick={cancelEdit}
                  className="bg-white/20 backdrop-blur-sm p-2.5 rounded-xl text-white hover:bg-white/30 transition shadow-lg"
                >
                  <X size={20} />
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="bg-white/20 backdrop-blur-sm p-2.5 rounded-xl text-white hover:bg-white/30 transition shadow-lg"
              >
                <Edit3 size={20} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Avatar & Info Card */}
      <div className="px-6 -mt-16 relative z-10">
        <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-50">
          <div className="flex flex-col items-center -mt-20 mb-6">
            <div
              className={`relative w-28 h-28 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center overflow-hidden shadow-xl border-4 border-white transition-all duration-300 ${editing ? 'cursor-pointer ring-4 ring-pink-200 scale-105' : ''}`}
              onClick={handleAvatarClick}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User size={48} className="text-white" />
              )}
              {editing && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm">
                  <Camera size={24} className="text-white" />
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>

            <div className="text-center mt-4 w-full">
              {editing ? (
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="text-xl font-bold w-full text-center border-b-2 border-pink-300 focus:border-pink-500 outline-none pb-2 transition"
                  placeholder="Tu nombre"
                />
              ) : (
                <h2 className="text-xl font-bold text-gray-800">{user.name}</h2>
              )}
              <p className="text-sm text-gray-400 mt-1">{user.email}</p>
            </div>
          </div>

          {/* Bio */}
          {editing ? (
            <textarea
              value={editBio}
              onChange={e => setEditBio(e.target.value)}
              className="w-full border-2 border-gray-100 rounded-2xl p-4 text-sm resize-none focus:ring-2 focus:ring-pink-300 focus:border-transparent outline-none transition"
              rows={3}
              placeholder="Escribe algo sobre ti..."
              maxLength={160}
            />
          ) : (
            <p className="text-sm text-gray-600 text-center mb-6">{user.bio || 'Sin bio todavía...'}</p>
          )}

          {/* Follow Stats */}
          <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-800 mb-1">{user.followersCount || 0}</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Seguidores</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-800 mb-1">{user.followingCount || 0}</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Siguiendo</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-800 mb-1">{totalLooks}</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Looks</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-800 mb-1">{totalGarments}</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Prendas</p>
            </div>
          </div>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-50 p-1.5 mx-6 mt-6">
        <div className="flex gap-1">
          {[
            { id: 'stats' as const, icon: <BarChart3 size={18} />, label: 'Stats' },
            { id: 'favorites' as const, icon: <Bookmark size={18} />, label: 'Favoritos' },
            { id: 'settings' as const, icon: <Settings size={18} />, label: 'Ajustes' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${activeSection === tab.id
                  ? 'bg-gradient-to-r from-primary to-primary-dark text-white shadow-lg scale-105'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                }`}
            >
              <span className={`transition-transform ${activeSection === tab.id ? 'scale-110' : ''}`}>
                {tab.icon}
              </span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Stats Section */}
      {activeSection === 'stats' && (
        <div className="px-6 mt-6 space-y-4 animate-fade-in-up">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-2xl p-5 border border-pink-100 transform hover:scale-105 transition-transform duration-300">
              <div className="w-10 h-10 bg-gradient-to-br from-pink-400 to-rose-500 rounded-xl flex items-center justify-center mb-3 shadow-lg">
                <Shirt size={20} className="text-white" />
              </div>
              <p className="text-3xl font-bold text-gray-800 mb-1">{totalGarments}</p>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Prendas</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-5 border border-purple-100 transform hover:scale-105 transition-transform duration-300">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-xl flex items-center justify-center mb-3 shadow-lg">
                <Eye size={20} className="text-white" />
              </div>
              <p className="text-3xl font-bold text-gray-800 mb-1">{totalLooks}</p>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Looks</p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-5 border border-blue-100 transform hover:scale-105 transition-transform duration-300">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-xl flex items-center justify-center mb-3 shadow-lg">
                <Calendar size={20} className="text-white" />
              </div>
              <p className="text-3xl font-bold text-gray-800 mb-1">{plannedDays}</p>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Planificados</p>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-5 border border-emerald-100 transform hover:scale-105 transition-transform duration-300">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-green-500 rounded-xl flex items-center justify-center mb-3 shadow-lg">
                <TrendingUp size={20} className="text-white" />
              </div>
              <p className="text-3xl font-bold text-gray-800 mb-1">{avgUsage}<span className="text-lg text-gray-400">x</span></p>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Uso medio</p>
            </div>
          </div>

          {/* Most Worn */}
          {mostWornGarment && (
            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl p-5 border border-amber-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-lg flex items-center justify-center">
                  <Star size={16} className="text-white" />
                </div>
                <h3 className="text-sm font-bold text-gray-700">Prenda Favorita</h3>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-white shadow-md flex-shrink-0 border border-amber-100">
                  {mostWornGarment.imageUrl ? (
                    <img src={mostWornGarment.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Shirt size={32} className="text-gray-300" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-800 mb-1">{mostWornGarment.name || mostWornGarment.type}</p>
                  <p className="text-sm text-gray-500 capitalize">{mostWornGarment.color}</p>
                  <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 bg-amber-100 rounded-full">
                    <span className="text-xs font-semibold text-amber-700">Usado {mostWornGarment.usageCount || 0} veces</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Category Breakdown */}
          {categoryBreakdown.length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h3 className="text-sm font-bold text-gray-700 mb-4">Distribución por categoría</h3>
              <div className="space-y-3">
                {categoryBreakdown.map(([cat, count]) => {
                  const pct = Math.round((count / totalGarments) * 100);
                  return (
                    <div key={cat} className="group">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="capitalize font-medium text-gray-700">{cat}</span>
                        <span className="text-gray-400 font-semibold">{count} <span className="text-xs">({pct}%)</span></span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-primary via-primary-dark to-accent h-3 rounded-full transition-all duration-500 group-hover:shadow-md"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Season Breakdown */}
          {Object.keys(seasonBreakdown).length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h3 className="text-sm font-bold text-gray-700 mb-4">Prendas por temporada</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(seasonBreakdown).map(([season, count]) => (
                  <div key={season} className="px-4 py-3 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200 text-center">
                    <p className="text-2xl font-bold text-gray-800">{count}</p>
                    <p className="text-xs text-gray-500 mt-1">{seasonLabels[season] || season}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Server stats */}
          {stats && (
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-5 border border-indigo-100 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-lg flex items-center justify-center">
                  <BarChart3 size={16} className="text-white" />
                </div>
                <h3 className="text-sm font-bold text-gray-700">Insights avanzados</h3>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {stats.mostWorn && (
                  <div className="bg-white/50 rounded-xl p-3 backdrop-blur-sm">
                    <p className="text-xs text-gray-500 mb-1">Más usada</p>
                    <p className="font-bold text-gray-800 truncate">{stats.mostWorn.name || stats.mostWorn.category}</p>
                    <p className="text-xs text-indigo-600 font-semibold mt-1">{stats.mostWorn.usageCount}x</p>
                  </div>
                )}
                {stats.leastWorn && (
                  <div className="bg-white/50 rounded-xl p-3 backdrop-blur-sm">
                    <p className="text-xs text-gray-500 mb-1">Menos usada</p>
                    <p className="font-bold text-gray-800 truncate">{stats.leastWorn.name || stats.leastWorn.category}</p>
                    <p className="text-xs text-purple-600 font-semibold mt-1">{stats.leastWorn.usageCount}x</p>
                  </div>
                )}
                {stats.favoriteColor && (
                  <div className="bg-white/50 rounded-xl p-3 backdrop-blur-sm">
                    <p className="text-xs text-gray-500 mb-1">Color favorito</p>
                    <p className="font-bold text-gray-800 capitalize">{stats.favoriteColor}</p>
                  </div>
                )}
                {stats.favoriteCategory && (
                  <div className="bg-white/50 rounded-xl p-3 backdrop-blur-sm">
                    <p className="text-xs text-gray-500 mb-1">Categoría top</p>
                    <p className="font-bold text-gray-800 capitalize">{stats.favoriteCategory}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quick links */}
          <div className="space-y-3">
            <button
              onClick={() => onNavigate('wardrobe')}
              className="w-full flex items-center gap-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md hover:scale-[1.02] transition-all group"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-pink-400 to-rose-500 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                <Shirt size={22} className="text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-bold text-gray-800">Mi Armario</p>
                <p className="text-xs text-gray-400">Gestiona tus prendas</p>
              </div>
              <ChevronRight size={20} className="text-gray-300 group-hover:text-primary transition-colors" />
            </button>
            <button
              onClick={() => onNavigate('suitcase')}
              className="w-full flex items-center gap-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md hover:scale-[1.02] transition-all group"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                <ShoppingBag size={22} className="text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-bold text-gray-800">Mis Maletas</p>
                <p className="text-xs text-gray-400">Organiza tus viajes</p>
              </div>
              <ChevronRight size={20} className="text-gray-300 group-hover:text-primary transition-colors" />
            </button>
            <button
              onClick={() => onNavigate('planner')}
              className="w-full flex items-center gap-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md hover:scale-[1.02] transition-all group"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                <Calendar size={22} className="text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-bold text-gray-800">Mi Planificador</p>
                <p className="text-xs text-gray-400">Planea tus outfits</p>
              </div>
              <ChevronRight size={20} className="text-gray-300 group-hover:text-primary transition-colors" />
            </button>
          </div>
        </div>
      )}

      {/* Favorites Section */}
      {activeSection === 'favorites' && (
        <div className="px-6 mt-6 animate-fade-in-up">
          {loadingFavs ? (
            <div className="flex justify-center py-16">
              <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          ) : favorites.length === 0 ? (
            <div className="text-center py-16 bg-gradient-to-br from-pink-50 to-rose-50 rounded-3xl border-2 border-dashed border-pink-200 px-6">
              <Bookmark size={56} className="mx-auto text-pink-200 mb-4" />
              <p className="text-gray-500 font-semibold mb-2">No tienes favoritos aún</p>
              <p className="text-sm text-gray-400 mb-6">Explora la sección social y guarda los looks que más te inspiren</p>
              <button
                onClick={() => onNavigate('social')}
                className="px-6 py-2.5 bg-gradient-to-r from-primary to-primary-dark text-white rounded-xl font-semibold text-sm shadow-lg hover:shadow-xl transition-all hover:scale-105"
              >
                Explorar Social
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Looks */}
              {favorites.some(f => f.look) && (
                <div>
                  <h3 className="text-sm font-bold text-gray-700 mb-3">Looks guardados</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {favorites.filter(f => f.look).map((fav: any) => (
                      <div key={fav.id} className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-all group">
                        <div className="aspect-square bg-gray-100 relative">
                          {fav.look.imageUrl || (fav.look.garments && fav.look.garments[0]?.imageUrl) ? (
                            <img
                              src={fav.look.imageUrl || fav.look.garments[0].imageUrl}
                              alt={fav.look.name}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Eye size={28} className="text-gray-300" />
                            </div>
                          )}
                          <div className="absolute top-2 right-2 bg-white/90 rounded-full p-1.5 shadow-md">
                            <Heart size={14} className="text-rose-500 fill-rose-500" />
                          </div>
                        </div>
                        <div className="p-2">
                          <p className="text-[11px] font-semibold text-gray-800 truncate">{fav.look.name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Products */}
              {favorites.some(f => f.product) && (
                <div>
                  <h3 className="text-sm font-bold text-gray-700 mb-3">Productos guardados</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {favorites.filter(f => f.product).map((fav: any) => (
                      <div key={fav.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all group">
                        <div className="aspect-square bg-gray-100 relative">
                          {fav.product.imageUrl || fav.product.images?.[0]?.url ? (
                            <img
                              src={fav.product.imageUrl || fav.product.images?.[0]?.url}
                              alt={fav.product.name}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ShoppingBag size={32} className="text-gray-300" />
                            </div>
                          )}
                          <div className="absolute top-2 right-2 bg-white/90 rounded-full p-1.5 shadow-md">
                            <Bookmark size={14} className="text-primary fill-primary" />
                          </div>
                          {fav.product.price && (
                            <div className="absolute top-2 left-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-md">
                              {fav.product.price}€
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <p className="text-xs font-semibold text-gray-800 truncate mb-2">{fav.product.name}</p>
                          <button
                            onClick={() => handleMoveToWardrobe(fav)}
                            disabled={actionLoadingId === fav.id}
                            className="w-full text-[10px] font-bold text-white bg-primary px-2 py-1.5 rounded-lg disabled:opacity-60 hover:bg-primary-dark transition-colors"
                          >
                            {actionLoadingId === fav.id ? '...' : 'Mover'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Settings Section */}
      {activeSection === 'settings' && (
        <div className="px-6 mt-6 pb-8 animate-fade-in-up">
          <div className="space-y-4">
            {/* Profile Settings */}
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-5 border border-blue-100">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <User size={24} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-800 mb-1">Información del Perfil</h3>
                  <p className="text-xs text-gray-600 mb-3">Personaliza tu nombre, biografía y foto de perfil</p>
                  <button className="px-4 py-2 bg-blue-500 text-white text-xs font-bold rounded-lg hover:bg-blue-600 transition-colors">
                    Editar Perfil
                  </button>
                </div>
              </div>
            </div>

            {/* Preferences - Gender & Cycle */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-50">
                <h3 className="text-sm font-bold text-gray-700">Preferencias</h3>
              </div>
              <div className="divide-y divide-gray-50">
                <div className="p-4">
                  <p className="text-sm font-medium mb-3 text-gray-700">Sexo</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'female', label: 'Mujer', emoji: '♀️' },
                      { id: 'male', label: 'Hombre', emoji: '♂️' },
                      { id: 'other', label: 'Otro', emoji: '✨' }
                    ].map(option => (
                      <button
                        key={option.id}
                        onClick={async () => {
                          try {
                            const updated = await api.updateProfile({ gender: option.id as any });
                            onUpdateUser(updated);
                          } catch (e) {
                            console.warn('Error saving gender:', e);
                            onUpdateUser({ ...user, gender: option.id as any });
                          }
                        }}
                        className={`py-2.5 px-3 rounded-lg text-xs font-bold transition transform hover:scale-105 ${user.gender === option.id
                            ? 'bg-gradient-to-br from-primary to-primary-dark text-white shadow-md'
                            : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                          }`}
                      >
                        <span className="text-lg block mb-0.5">{option.emoji}</span>
                        <p>{option.label}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg flex items-center justify-center">
                      <Moon size={18} className="text-purple-500" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-800">Seguimiento del ciclo</p>
                      <p className="text-xs text-gray-500">Ajusta sugerencias según tu ciclo</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleSetting('cycleTracking', !cycleTracking)}
                    className={`w-11 h-6 rounded-full transition-colors ${cycleTracking ? 'bg-gradient-to-r from-purple-400 to-pink-500' : 'bg-gray-200'} ${user.gender === 'male' ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={user.gender === 'male'}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform ${cycleTracking ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-100 to-emerald-100 rounded-lg flex items-center justify-center">
                      <Music size={18} className="text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-800">Sincronización musical</p>
                      <p className="text-xs text-gray-500">Conecta música con tu mood</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleSetting('musicSync', !musicSync)}
                    className={`w-11 h-6 rounded-full transition-colors ${musicSync ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gray-200'}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform ${musicSync ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Theme Settings */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-50 flex items-center gap-2">
                <Palette size={18} className="text-primary" />
                <h3 className="text-sm font-bold text-gray-700">Tema Visual</h3>
              </div>
              <div className="p-5">
                <p className="text-xs text-gray-500 mb-4">Personaliza el color principal de toda la aplicación</p>
                <div className="flex flex-wrap gap-4">
                  {(Object.keys(THEMES) as ThemeColor[]).map(themeKey => (
                    <button
                      key={themeKey}
                      onClick={() => {
                        applyTheme(themeKey);
                        setCurrentTheme(themeKey);
                      }}
                      className={`group relative flex flex-col items-center gap-2 transition-all ${currentTheme === themeKey ? 'scale-110' : 'hover:scale-105'
                        }`}
                    >
                      <div
                        className={`w-12 h-12 rounded-full border-4 transition-all shadow-md ${currentTheme === themeKey ? 'border-primary' : 'border-transparent'
                          }`}
                        style={{ backgroundColor: THEMES[themeKey].primary }}
                      >
                        {currentTheme === themeKey && (
                          <div className="absolute inset-x-0 -bottom-1 flex justify-center">
                            <div className="bg-primary text-white p-0.5 rounded-full shadow-sm">
                              <Save size={10} />
                            </div>
                          </div>
                        )}
                      </div>
                      <span className={`text-[10px] font-bold capitalize ${currentTheme === themeKey ? 'text-primary' : 'text-gray-400'
                        }`}>
                        {themeKey === 'pink' ? 'Rosa' :
                          themeKey === 'blue' ? 'Azul' :
                            themeKey === 'green' ? 'Verde' :
                              themeKey === 'lavender' ? 'Lavanda' : 'Ámbar'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Privacy Settings */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-5 border border-purple-100">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Lock size={24} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-800 mb-1">Privacidad y Seguridad</h3>
                  <p className="text-xs text-gray-600 mb-3">Controla quién puede ver tu perfil, favoritos y actividad</p>
                  <button className="px-4 py-2 bg-purple-500 text-white text-xs font-bold rounded-lg hover:bg-purple-600 transition-colors">
                    Configurar Privacidad
                  </button>
                </div>
              </div>
            </div>

            {/* Notifications */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-5 border border-amber-100">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Bell size={24} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-800 mb-1">Notificaciones</h3>
                  <p className="text-xs text-gray-600 mb-3">Elige qué notificaciones deseas recibir</p>
                  <button className="px-4 py-2 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 transition-colors">
                    Preferencias
                  </button>
                </div>
              </div>
            </div>

            {/* Account Info */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-50">
                <h3 className="text-sm font-bold text-gray-700">Cuenta</h3>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Shield size={18} className="text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Email</p>
                    <p className="text-sm font-semibold text-gray-800">{user.email}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Data & Download */}
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl p-5 border border-indigo-100">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-400 to-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Download size={24} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-800 mb-1">Datos y Descargas</h3>
                  <p className="text-xs text-gray-600 mb-3">Descarga tus datos o solicita la eliminación de tu cuenta</p>
                  <button className="px-4 py-2 bg-indigo-500 text-white text-xs font-bold rounded-lg hover:bg-indigo-600 transition-colors">
                    Más Opciones
                  </button>
                </div>
              </div>
            </div>

            {/* Help & Support */}
            <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-2xl p-5 border border-red-100">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-red-400 to-rose-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <HelpCircle size={24} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-800 mb-1">Ayuda y Soporte</h3>
                  <p className="text-xs text-gray-600 mb-3">Preguntas frecuentes, contacta con nosotros o reporta un problema</p>
                  <button className="px-4 py-2 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors">
                    Contactar
                  </button>
                </div>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full mt-8 px-4 py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white font-bold rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all shadow-md hover:shadow-lg disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loggingOut ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Cerrando sesión...
                </>
              ) : (
                <>
                  <LogOut size={18} />
                  Cerrar Sesión
                </>
              )}
            </button>

            {/* App Info */}
            <div className="text-center pt-6 pb-2">
              <p className="text-xs text-gray-400">Estilovivo v1.0.0</p>
              <p className="text-xs text-gray-300 mt-1">Hecho con amor en España</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
