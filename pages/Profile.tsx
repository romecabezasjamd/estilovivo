import React, { useState, useEffect, useMemo, useRef } from 'react';
import { UserState, Look, Garment, PlannerEntry } from '../types';
import { api, clearAuthToken, clearPersistedSession } from '../services/api';
import {
  User, Settings, LogOut, Heart, Camera, Edit3, Save, X,
  ShoppingBag, Shirt, Calendar, Star, TrendingUp, ChevronRight,
  Eye, Bookmark, Bell, Shield, Moon, BarChart3, Download,
  HelpCircle, Lock, Palette, Languages, Globe, AlertCircle, FileText,
  Award, Flame, Trophy, Gem
} from 'lucide-react';
import { ThemeColor, THEMES } from '../src/utils/theme';
import { useTheme } from '../src/context/ThemeContext';
import { useDarkMode } from '../src/context/DarkModeContext';
import { isHapticEnabled, setHapticEnabled } from '../src/utils/haptic';
import { normalizeHex } from '../src/utils/colorUtils';
import { getCyclePeriod, saveCyclePeriod } from '../src/utils/cycleTracking';
import { useLanguage } from '../src/context/LanguageContext';
import { languages, dialects } from '../src/utils/translations';
import Logo from '../components/Logo';
import DonutChart from '../components/DonutChart';

interface ProfileProps {
  user: UserState;
  plannerEntries: PlannerEntry[];
  looks: Look[];
  onUpdateUser: (user: UserState) => void;
  garments: Garment[];
  onNavigate: (tab: string) => void;
}

const Profile: React.FC<ProfileProps> = ({ user, plannerEntries, looks, onUpdateUser, garments, onNavigate }) => {
  const [activeSection, setActiveSection] = useState<'stats' | 'favorites' | 'settings' | 'progress'>('stats');
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [editBio, setEditBio] = useState(user.bio || '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [fullBodyAvatarPreview, setFullBodyAvatarPreview] = useState<string | null>(null);
  const [fullBodyAvatarFile, setFullBodyAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loadingFavs, setLoadingFavs] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const { presetTheme, customColor, isCustom, setPresetTheme, setCustomColor, resetToDefault } = useTheme();
  const [pickerValue, setPickerValue] = useState(customColor || THEMES[presetTheme].primary);
  const { setting: darkModeSetting, setDarkMode } = useDarkMode();
  const [fontSize, setFontSize] = useState<'small' | 'normal' | 'large'>(() => {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('ev_font_size') : null;
    return (stored === 'small' || stored === 'large') ? stored : 'normal';
  });
  const [highContrast, setHighContrast] = useState(() => {
    return typeof localStorage !== 'undefined' ? localStorage.getItem('ev_high_contrast') === 'on' : false;
  });
  const [hapticEnabledState, setHapticEnabledState] = useState(isHapticEnabled());
  const { t, language, setLanguage, dialect, setDialect } = useLanguage();
  const [showLanguageSettings, setShowLanguageSettings] = useState(false);
  const [showSecuritySettings, setShowSecuritySettings] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  // Gamification progress
  const [gameProgress, setGameProgress] = useState<any>(null);
  const [gameAchievements, setGameAchievements] = useState<any[]>([]);
  const [gameBadges, setGameBadges] = useState<any[]>([]);
  const [loadingGame, setLoadingGame] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fullBodyInputRef = useRef<HTMLInputElement>(null);

  // Settings state
  const [cycleTracking, setCycleTracking] = useState(user.cycleTracking || false);
  const [emailNotifications, setEmailNotifications] = useState(user.emailNotifications ?? true);
  const [emailChat, setEmailChat] = useState(user.emailChat ?? true);
  const [emailFollows, setEmailFollows] = useState(user.emailFollows ?? true);
  const [emailWashing, setEmailWashing] = useState(user.emailWashing ?? true);
  const [emailChallenges, setEmailChallenges] = useState(user.emailChallenges ?? true);
  const [cycleStartDate, setCycleStartDate] = useState('');
  const [cycleEndDate, setCycleEndDate] = useState('');
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [cycleSaveSuccess, setCycleSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setEmailNotifications(user.emailNotifications ?? true);
  }, [user.emailNotifications]);

  useEffect(() => {
    setCycleTracking(user.cycleTracking || false);
  }, [user.cycleTracking]);

  useEffect(() => {
    setPickerValue(customColor || THEMES[presetTheme].primary);
  }, [customColor, presetTheme]);

  useEffect(() => {
    if (user.id) {
      const period = getCyclePeriod(user.id);
      if (period) {
        setCycleStartDate(period.startDate);
        setCycleEndDate(period.endDate);
      }
    }
  }, [user.id]);

  // Font size
  useEffect(() => {
    const el = document.documentElement;
    el.style.fontSize = fontSize === 'small' ? '14px' : fontSize === 'large' ? '18px' : '';
    try { localStorage.setItem('ev_font_size', fontSize); } catch {}
  }, [fontSize]);

  // High contrast
  useEffect(() => {
    const el = document.documentElement;
    el.classList.toggle('high-contrast', highContrast);
    try { localStorage.setItem('ev_high_contrast', highContrast ? 'on' : 'off'); } catch {}
  }, [highContrast]);

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

  useEffect(() => {
    if (activeSection === 'progress' && !gameProgress) {
      setLoadingGame(true);
      Promise.all([
        api.getGamificationProgress(),
        api.getAchievements(),
        api.getBadges(),
      ])
        .then(([progress, achievements, badges]) => {
          setGameProgress(progress);
          setGameAchievements(achievements);
          setGameBadges(badges);
        })
        .catch(e => console.warn('Could not load gamification:', e))
        .finally(() => setLoadingGame(false));
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

  const handleFullBodyChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFullBodyAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setFullBodyAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);

    // Auto-save just the full body avatar
    try {
      const formData = new FormData();
      formData.append('fullBodyAvatar', file);
      const updatedUser = await api.updateProfileWithAvatar(formData);
      onUpdateUser(updatedUser);
    } catch (e) {
      console.warn('Error uploading full body avatar directly', e);
    }
  };

  // Save profile
  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      let updatedUser: UserState;
      if (avatarFile || fullBodyAvatarFile) {
        const formData = new FormData();
        if (avatarFile) formData.append('avatar', avatarFile);
        if (fullBodyAvatarFile) formData.append('fullBodyAvatar', fullBodyAvatarFile);
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
      setFullBodyAvatarFile(null);
      setFullBodyAvatarPreview(null);
    } catch (error: any) {
      console.error('Error saving profile:', error);
      setSaveError(error?.message || 'No se pudo guardar el perfil');
    } finally {
      setSaving(false);
    }
  };

  // Save settings
  const handleToggleSetting = async (setting: string, value: boolean) => {
    const prev: any = {
      cycleTracking, emailNotifications, emailChat, emailFollows, emailWashing, emailChallenges,
    };

    if (setting === 'cycleTracking') {
      setCycleTracking(value);
      if (!value && user.id) {
        saveCyclePeriod(user.id, null);
        setCycleStartDate('');
        setCycleEndDate('');
      }
    } else if (setting === 'emailNotifications') {
      setEmailNotifications(value);
      // When master toggle changes, sync all sub-toggles
      setEmailChat(value); setEmailFollows(value); setEmailWashing(value); setEmailChallenges(value);
    } else if (setting === 'emailChat') setEmailChat(value);
    else if (setting === 'emailFollows') setEmailFollows(value);
    else if (setting === 'emailWashing') setEmailWashing(value);
    else if (setting === 'emailChallenges') setEmailChallenges(value);

    setSettingsError(null);
    try {
      const data: any = { [setting]: value };
      if (setting === 'emailNotifications') {
        data.emailChat = value; data.emailFollows = value; data.emailWashing = value; data.emailChallenges = value;
      }
      const updated = await api.updateProfile(data);
      onUpdateUser({ ...user, ...updated, ...data });
    } catch (e: any) {
      const prevVal = prev[setting];
      if (setting === 'cycleTracking') setCycleTracking(prevVal);
      else if (setting === 'emailNotifications') { setEmailNotifications(prevVal); setEmailChat(prev.emailChat); setEmailFollows(prev.emailFollows); setEmailWashing(prev.emailWashing); setEmailChallenges(prev.emailChallenges); }
      else if (setting === 'emailChat') setEmailChat(prevVal);
      else if (setting === 'emailFollows') setEmailFollows(prevVal);
      else if (setting === 'emailWashing') setEmailWashing(prevVal);
      else if (setting === 'emailChallenges') setEmailChallenges(prevVal);
      setSettingsError(e?.message || 'No se pudo guardar la preferencia');
      console.warn('Error saving setting:', e);
    }
  };

  const handleSaveCycleDates = () => {
    if (!user.id) return;
    if (!cycleStartDate || !cycleEndDate) {
      setSettingsError('Indica fecha de inicio y fin del periodo');
      return;
    }
    if (cycleStartDate > cycleEndDate) {
      setSettingsError('La fecha de fin debe ser posterior al inicio');
      return;
    }
    saveCyclePeriod(user.id, { startDate: cycleStartDate, endDate: cycleEndDate });
    setSettingsError(null);
    setCycleSaveSuccess(true);
    setTimeout(() => setCycleSaveSuccess(false), 3000);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await api.logout();
    } catch (e) {
      console.warn('Error logging out:', e);
    } finally {
      clearPersistedSession();
      await clearAuthToken();
      window.location.reload();
    }
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      await api.deleteAccount();
      clearPersistedSession();
      await clearAuthToken();
      window.location.reload();
    } catch (e) {
      console.warn('Error al eliminar la cuenta:', e);
      alert('Error al eliminar la cuenta');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError(t('passwordsDoNotMatch'));
      return;
    }

    setPasswordLoading(true);
    setPasswordError(null);
    setPasswordSuccess(false);

    try {
      await api.changePassword({ currentPassword, newPassword });
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (e: any) {
      setPasswordError(e.message === 'invalidCurrentPassword' ? t('invalidCurrentPassword') : 'Error al cambiar la contraseña');
    } finally {
      setPasswordLoading(false);
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
              className={`relative w-28 h-28 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center overflow-hidden shadow-xl border-4 border-white transition-all duration-300 ${editing ? 'cursor-pointer ring-4 ring-primary/30 scale-105' : ''}`}
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
          {saveError && editing && (
            <p className="text-xs text-red-600 font-medium text-center mb-3">{saveError}</p>
          )}
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
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col items-center text-center group hover:border-primary/30 transition-colors">
              <p className="text-2xl font-bold text-gray-800">{totalGarments}</p>
              <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mt-1">{t('totalItems')}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col items-center text-center group hover:border-primary/30 transition-colors">
              <p className="text-2xl font-bold text-gray-800">{totalLooks}</p>
              <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mt-1">{t('totalOutfits')}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col items-center text-center group hover:border-primary/30 transition-colors">
              <p className="text-2xl font-bold text-gray-800">{plannedDays}</p>
              <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mt-1">{t('outfittedDays')}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col items-center text-center group hover:border-primary/30 transition-colors">
              <p className="text-2xl font-bold text-gray-800">{avgUsage}</p>
              <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mt-1">{t('avgUsageCount')}</p>
            </div>
          </div>

          {/* Full Body Avatar */}
          <div className="mt-6 border-t border-gray-100 pt-6 animate-fade-in-up">
            <h3 className="text-sm font-bold text-gray-700 text-center mb-3">Tu Modelo (Cuerpo Entero)</h3>
            <div 
              className="relative mx-auto w-32 h-48 rounded-2xl bg-gray-50 flex items-center justify-center overflow-hidden shadow-inner border-2 border-dashed border-gray-200 transition-all cursor-pointer hover:border-pink-300 ring-4 ring-transparent hover:ring-pink-100"
              onClick={() => fullBodyInputRef.current?.click()}
            >
              {fullBodyAvatarPreview || user.fullBodyAvatar ? (
                <img src={fullBodyAvatarPreview || user.fullBodyAvatar} alt="Cuerpo Entero" className="w-full h-full object-cover" />
              ) : (
                <div className="text-gray-400 text-center flex flex-col items-center p-2">
                  <User size={32} className="mb-2 opacity-50" />
                  <span className="text-[10px] font-medium leading-tight">Sin modelo físico</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[2px] opacity-0 hover:opacity-100 transition-opacity">
                <Camera size={24} className="text-white" />
              </div>
              <input
                ref={fullBodyInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFullBodyChange}
              />
            </div>
            <p className="text-[10px] text-center text-gray-400 mt-2">Sube una foto de cuerpo entero para probarte la ropa</p>
          </div>

        </div>
      </div>

      {/* Section Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-50 p-1.5 mx-6 mt-6">
        <div className="flex gap-1">
          {[
            { id: 'stats' as const, icon: <BarChart3 size={18} />, label: 'Stats' },
            { id: 'progress' as const, icon: <Award size={18} />, label: 'Progreso' },
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
            <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl p-5 border border-primary/20 transform hover:scale-105 transition-transform duration-300">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center mb-3 shadow-lg">
                <Shirt size={20} className="text-white" />
              </div>
              <p className="text-3xl font-bold text-gray-800 mb-1">{totalGarments}</p>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Prendas</p>
            </div>
            <div className="bg-gradient-to-br from-secondary/10 to-primary/10 rounded-2xl p-5 border border-secondary/20 transform hover:scale-105 transition-transform duration-300">
              <div className="w-10 h-10 bg-gradient-to-br from-secondary to-primary rounded-xl flex items-center justify-center mb-3 shadow-lg">
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
                <div className="bg-gradient-to-br from-amber-400 to-orange-500 w-8 h-8 rounded-lg flex items-center justify-center shadow-sm">
                  <Star size={18} className="text-white" />
                </div>
                <h3 className="text-sm font-bold text-gray-700">{t('mostUsedGarment')}</h3>
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
                    <span className="text-xs font-semibold text-amber-700">{mostWornGarment.usageCount || 0} {t('usedXTimes')}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Donut Charts */}
          <div className="grid grid-cols-2 gap-4">
            {categoryBreakdown.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <h3 className="text-xs font-bold text-gray-700 mb-3 text-center">Por categoría</h3>
                <DonutChart
                  slices={categoryBreakdown.map(([cat, count], i) => ({
                    label: cat,
                    value: count,
                    color: i === 0 ? 'var(--color-primary)' : i === 1 ? 'var(--color-accent)' : i === 2 ? 'var(--color-secondary)' : ['#f59e0b', '#22c55e', '#3b82f6', '#ec4899'][i - 3] || '#d1d5db',
                  }))}
                  size={100}
                  strokeWidth={14}
                />
              </div>
            )}
            {Object.keys(seasonBreakdown).length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <h3 className="text-xs font-bold text-gray-700 mb-3 text-center">Por temporada</h3>
                <DonutChart
                  slices={[
                    { label: 'Verano', value: seasonBreakdown.summer || 0, color: 'var(--color-primary)' },
                    { label: 'Invierno', value: seasonBreakdown.winter || 0, color: 'var(--color-accent)' },
                    { label: 'Entretiempo', value: seasonBreakdown.transition || 0, color: 'var(--color-secondary)' },
                    { label: 'T. año', value: (seasonBreakdown.all || 0) + (seasonBreakdown.any || 0), color: '#d1d5db' },
                  ].filter(s => s.value > 0)}
                  size={100}
                  strokeWidth={14}
                />
              </div>
            )}
          </div>

          {/* Category Breakdown */}
          {categoryBreakdown.length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h3 className="text-sm font-bold text-gray-700 mb-4">{t('categoryDistribution')}</h3>
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
              <h3 className="text-sm font-bold text-gray-700 mb-4">{t('itemsBySeason')}</h3>
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
                <h3 className="text-sm font-bold text-gray-700">{t('advancedInsights')}</h3>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {stats.mostWorn && (
                  <div className="bg-white/50 rounded-xl p-3 backdrop-blur-sm">
                    <p className="text-xs text-gray-500 mb-1">{t('mostUsed')}</p>
                    <p className="font-bold text-gray-800 truncate">{stats.mostWorn.name || stats.mostWorn.category}</p>
                    <p className="text-xs text-indigo-600 font-semibold mt-1">{stats.mostWorn.usageCount}x</p>
                  </div>
                )}
                {stats.leastWorn && (
                  <div className="bg-white/50 rounded-xl p-3 backdrop-blur-sm">
                    <p className="text-xs text-gray-500 mb-1">{t('leastUsed')}</p>
                    <p className="font-bold text-gray-800 truncate">{stats.leastWorn.name || stats.leastWorn.category}</p>
                    <p className="text-xs text-purple-600 font-semibold mt-1">{stats.leastWorn.usageCount}x</p>
                  </div>
                )}
                {stats.favoriteColor && (
                  <div className="bg-white/50 rounded-xl p-3 backdrop-blur-sm">
                    <p className="text-xs text-gray-500 mb-1">{t('favColor')}</p>
                    <p className="font-bold text-gray-800 capitalize">{stats.favoriteColor}</p>
                  </div>
                )}
                {stats.favoriteCategory && (
                  <div className="bg-white/50 rounded-xl p-3 backdrop-blur-sm">
                    <p className="text-xs text-gray-500 mb-1">{t('topCategory')}</p>
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
              <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                <Shirt size={22} className="text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-bold text-gray-800">{t('myWardrobe')}</p>
                <p className="text-xs text-gray-400">{t('manageGarments')}</p>
              </div>
              <ChevronRight size={20} className="text-gray-300 group-hover:text-primary transition-colors" />
            </button>
            <button
              onClick={() => onNavigate('suitcase')}
              className="w-full flex items-center gap-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md hover:scale-[1.02] transition-all group"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-secondary to-primary rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                <ShoppingBag size={22} className="text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-bold text-gray-800">{t('mySuitcases')}</p>
                <p className="text-xs text-gray-400">{t('organizeTrips')}</p>
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
                <p className="font-bold text-gray-800">{t('myPlanner')}</p>
                <p className="text-xs text-gray-400">{t('planOutfits')}</p>
              </div>
              <ChevronRight size={20} className="text-gray-300 group-hover:text-primary transition-colors" />
            </button>
          </div>
        </div>
      )}

      {/* Progress Section */}
      {activeSection === 'progress' && (
        <div className="px-6 mt-6 space-y-4 animate-fade-in-up">
          {loadingGame || !gameProgress ? (
            <div className="flex justify-center py-16">
              <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Level & XP Card */}
              <div className="bg-gradient-to-br from-primary to-accent rounded-2xl p-5 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase tracking-wider bg-white/20 px-2 py-1 rounded-full font-semibold">
                      Nivel {gameProgress.level}
                    </span>
                    <Award size={24} className="text-white/60" />
                  </div>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-3xl font-bold">{gameProgress.level}</span>
                    <span className="text-sm text-white/70">— {gameProgress.experiencePoints} XP total</span>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-white/80 mb-1">
                      <span>{gameProgress.xpCurrent} XP</span>
                      <span>{gameProgress.xpNeeded} XP para nivel {gameProgress.level + 1}</span>
                    </div>
                    <div className="h-2.5 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${gameProgress.xpPercentage}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-white/60 mt-1">
                      <span>Nivel {gameProgress.level}</span>
                      <span>{Math.round(gameProgress.xpPercentage)}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Streak Card */}
              <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl p-4 border border-primary/20 flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center shadow-md flex-shrink-0">
                  <Flame size={28} className="text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-800">{gameProgress.streak?.loginCount || 0} días</p>
                  <p className="text-xs text-gray-500">Racha actual</p>
                  {gameProgress.streak?.loginCount > 0 && gameProgress.streak?.loginCount < 3 && (
              <p className="text-[10px] text-primary/70 mt-1">¡Sigue así! {3 - gameProgress.streak.loginCount} días más para lograr una racha</p>
              )}
              {gameProgress.streak?.loginCount >= 3 && gameProgress.streak?.loginCount < 7 && (
                <p className="text-[10px] text-primary/70 mt-1">🔥 Racha de 3 días conseguida</p>
                  )}
              {gameProgress.streak?.loginCount >= 7 && gameProgress.streak?.loginCount < 30 && (
                <p className="text-[10px] text-primary/70 mt-1">🔥 Racha de 7 días conseguida</p>
                  )}
              {gameProgress.streak?.loginCount >= 30 && (
                <p className="text-[10px] text-primary/70 mt-1">💪 ¡Racha de 30 días!</p>
                  )}
                </div>
              </div>

              {/* Challenge count */}
              <div className="bg-gradient-to-br from-secondary/10 to-primary/10 rounded-2xl p-4 border border-secondary/20 flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-secondary to-primary rounded-2xl flex items-center justify-center shadow-md flex-shrink-0">
                  <Trophy size={28} className="text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-800">{gameProgress.challengeCount || 0}</p>
                  <p className="text-xs text-gray-500">Retos completados</p>
                </div>
              </div>

              {/* Badges */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-4">
                  <Gem size={18} className="text-primary" />
                  <h3 className="text-sm font-bold text-gray-800">Insignias</h3>
                </div>
                {gameBadges.filter((b: any) => b.unlocked).length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">Aún no tienes insignias. ¡Sigue participando!</p>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {gameBadges.filter((b: any) => b.unlocked).map((badge: any) => (
                      <div key={badge.badgeKey} className="flex flex-col items-center gap-1 p-2 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-100">
                        <span className="text-2xl">{badge.icon}</span>
                        <span className="text-[9px] font-semibold text-gray-700 text-center leading-tight">{badge.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Achievements */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-4">
                  <Award size={18} className="text-primary" />
                  <h3 className="text-sm font-bold text-gray-800">Logros</h3>
                </div>
                {gameAchievements.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">No hay logros disponibles</p>
                ) : (
                  <div className="space-y-2">
                    {gameAchievements.map((ach: any) => (
                      <div key={ach.key} className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${ach.unlocked ? 'bg-primary/5 border border-primary/10' : 'bg-gray-50 border border-gray-100 opacity-60'}`}>
                        <span className={`text-xl ${ach.unlocked ? '' : 'grayscale'}`}>{ach.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`text-xs font-bold ${ach.unlocked ? 'text-gray-800' : 'text-gray-500'}`}>{ach.title}</p>
                            {ach.unlocked && <span className="text-[9px] text-emerald-600 font-semibold">+{ach.xpReward} XP</span>}
                          </div>
                          <p className="text-[10px] text-gray-500 truncate">{ach.description}</p>
                        </div>
                        {ach.unlocked ? (
                          <span className="text-emerald-500 text-xs">✓</span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
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
              <p className="text-gray-500 font-semibold mb-2">{t('noFavorites')}</p>
              <p className="text-sm text-gray-400 mb-6">{t('exploreSocialDesc')}</p>
              <button
                onClick={() => onNavigate('social')}
                className="px-6 py-2.5 bg-gradient-to-r from-primary to-primary-dark text-white rounded-xl font-semibold text-sm shadow-lg hover:shadow-xl transition-all hover:scale-105"
              >
                {t('exploreSocial')}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Looks */}
              {favorites.some(f => f.look) && (
                <div>
                  <h3 className="text-sm font-bold text-gray-700 mb-3">{t('savedLooks')}</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {favorites.filter(f => f.look).map((fav: any) => (
                      <div key={fav.id} className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-all group">
                        <div className="aspect-square bg-gray-100 relative">
                          {fav.look.imageUrl || (fav.look.garments && fav.look.garments.filter(g => !!g).length > 0) ? (
                            <img
                              src={fav.look.imageUrl || fav.look.garments.filter(g => !!g)[0].imageUrl}
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
                <div className="mt-6">
                  <h3 className="text-sm font-bold text-gray-700 mb-3">{t('savedProducts')}</h3>
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
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSection('stats');
                      setEditing(true);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="px-4 py-2 bg-blue-500 text-white text-xs font-bold rounded-lg hover:bg-blue-600 transition-colors"
                  >
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
                            const payload: Record<string, unknown> = { gender: option.id };
                            if (option.id !== 'female' && user.cycleTracking) {
                              payload.cycleTracking = false;
                              setCycleTracking(false);
                              if (user.id) saveCyclePeriod(user.id, null);
                            }
                            const updated = await api.updateProfile(payload as any);
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
                {user.gender === 'female' && (
                  <>
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg flex items-center justify-center">
                          <Moon size={18} className="text-purple-500" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-800">Seguimiento del ciclo</p>
                          <p className="text-xs text-gray-500">Calendario y mensajes en Inicio</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleSetting('cycleTracking', !cycleTracking)}
                        className={`w-11 h-6 rounded-full transition-colors ${cycleTracking ? 'bg-gradient-to-r from-primary to-accent' : 'bg-gray-200'}`}
                      >
                        <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform ${cycleTracking ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                    {cycleTracking && (
                      <div className="px-4 pb-4 space-y-3 border-t border-gray-50 pt-3">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 mb-1 block">Inicio del periodo</label>
                          <input
                            type="date"
                            value={cycleStartDate}
                            onChange={(e) => setCycleStartDate(e.target.value)}
                            className="w-full bg-gray-50 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 mb-1 block">Fin del periodo</label>
                          <input
                            type="date"
                            value={cycleEndDate}
                            onChange={(e) => setCycleEndDate(e.target.value)}
                            className="w-full bg-gray-50 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleSaveCycleDates}
                          className="w-full py-2.5 rounded-xl bg-primary text-white text-xs font-bold"
                        >
                          Guardar fechas del ciclo
                        </button>
                        {cycleSaveSuccess && (
                          <p className="text-xs text-green-600 font-semibold text-center animate-fade-in">
                            Fechas guardadas correctamente
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
                <div id="email-notifications-setting" className="p-4 border-b border-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-sky-100 to-blue-100 rounded-lg flex items-center justify-center">
                        <Bell size={18} className="text-blue-500" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-800">Notificaciones por correo</p>
                        <p className="text-xs text-gray-500">Activar o desactivar tipos de aviso</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleSetting('emailNotifications', !emailNotifications)}
                      className={`w-11 h-6 rounded-full transition-colors ${emailNotifications ? 'bg-gradient-to-r from-sky-400 to-blue-500' : 'bg-gray-200'}`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform ${emailNotifications ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                </div>
                <div className="px-4 pb-4 space-y-3 pt-3">
                  {[
                    { key: 'emailChat', label: 'Mensajes del chat', desc: 'Cuando recibes un mensaje nuevo', icon: '💬' },
                    { key: 'emailFollows', label: 'Usuarios seguidos', desc: 'Cuando alguien a quien sigues publica', icon: '👤' },
                    { key: 'emailWashing', label: 'Alertas de lavado', desc: 'Recordatorios de prendas en lavado', icon: '🧺' },
                    { key: 'emailChallenges', label: 'Retos semanales', desc: 'Nuevos retos y recordatorios', icon: '🏆' },
                  ].map(item => {
                    const val = item.key === 'emailChat' ? emailChat : item.key === 'emailFollows' ? emailFollows : item.key === 'emailWashing' ? emailWashing : emailChallenges;
                    return (
                      <div key={item.key} className="flex items-center justify-between pl-1">
                        <div className="flex items-center gap-2.5">
                          <span className="text-sm">{item.icon}</span>
                          <div>
                            <p className="text-xs font-semibold text-gray-700">{item.label}</p>
                            <p className="text-[10px] text-gray-400">{item.desc}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleSetting(item.key as any, !val)}
                          disabled={!emailNotifications}
                          className={`w-9 h-5 rounded-full transition-colors ${!emailNotifications ? 'bg-gray-100' : val ? 'bg-gradient-to-r from-sky-400 to-blue-500' : 'bg-gray-200'}`}
                        >
                          <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${val ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                {settingsError && (
                  <p className="px-4 pb-3 text-xs text-red-600 font-medium">{settingsError}</p>
                )}
              </div>
            </div>

            {/* Theme Settings */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-50 flex items-center gap-2">
                <Palette size={18} className="text-primary" />
                <h3 className="text-sm font-bold text-gray-700">Color de la app</h3>
              </div>
              <div className="p-5 space-y-5">
                <p className="text-xs text-gray-500">
                  Elige una paleta o un color personalizado. Se guarda de forma segura y se aplica al instante.
                </p>

                <div className="flex flex-wrap gap-4">
                  {(Object.keys(THEMES) as ThemeColor[]).map(themeKey => (
                    <button
                      key={themeKey}
                      type="button"
                      onClick={() => setPresetTheme(themeKey)}
                      className={`group relative flex flex-col items-center gap-2 transition-all ${
                        !isCustom && presetTheme === themeKey ? 'scale-110' : 'hover:scale-105'
                      }`}
                    >
                      <div
                        className={`w-12 h-12 rounded-full border-4 transition-all shadow-md ${
                          !isCustom && presetTheme === themeKey ? 'border-primary' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: THEMES[themeKey].primary }}
                      >
                        {!isCustom && presetTheme === themeKey && (
                          <div className="absolute inset-x-0 -bottom-1 flex justify-center">
                            <div className="bg-primary text-white p-0.5 rounded-full shadow-sm">
                              <Save size={10} />
                            </div>
                          </div>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-bold capitalize ${
                          !isCustom && presetTheme === themeKey ? 'text-primary' : 'text-gray-400'
                        }`}
                      >
                        {themeKey === 'pink' ? 'Rosa' :
                          themeKey === 'blue' ? 'Azul' :
                            themeKey === 'green' ? 'Verde' :
                              themeKey === 'lavender' ? 'Lavanda' :
                                themeKey === 'amber' ? 'Ámbar' :
                                  themeKey === 'rose' ? 'Coral' :
                                    themeKey === 'indigo' ? 'Índigo' :
                                      themeKey === 'teal' ? 'Teal' :
                                        themeKey === 'forest' ? 'Bosque' :
                                          themeKey === 'midnight' ? 'Noche' :
                                            themeKey === 'petrol' ? 'Petrol' : 'Vivo'}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="pt-3 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-600 mb-3">Color personalizado</p>
                  <div className="flex items-center gap-3">
                    <label
                      className="relative w-14 h-14 rounded-2xl border-2 border-gray-200 overflow-hidden cursor-pointer shadow-sm flex-shrink-0"
                      style={{ backgroundColor: pickerValue }}
                    >
                      <input
                        type="color"
                        value={pickerValue}
                        onChange={(e) => {
                          const hex = normalizeHex(e.target.value);
                          if (!hex) return;
                          setPickerValue(hex);
                          setCustomColor(hex);
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        aria-label="Selector de color"
                      />
                    </label>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono font-semibold text-gray-800 uppercase">{pickerValue}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {isCustom ? 'Color activo en toda la app' : 'Toca el cuadrado para elegir'}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => resetToDefault()}
                  className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50 transition-colors"
                >
                  Restablecer color por defecto (Rosa)
                </button>
              </div>
            </div>

            {/* Dark Mode & Accessibility Settings */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-50 flex items-center gap-2">
                <Moon size={18} className="text-primary" />
                <h3 className="text-sm font-bold text-gray-700">Apariencia y accesibilidad</h3>
              </div>
              <div className="p-5 space-y-5">
                {/* Dark mode */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Modo oscuro</p>
                    <p className="text-[11px] text-gray-400">Automático según el sistema o manual</p>
                  </div>
                  <select
                    value={darkModeSetting}
                    onChange={(e) => setDarkMode(e.target.value as any)}
                    className="text-xs font-semibold rounded-xl border border-gray-200 px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    aria-label="Modo oscuro"
                  >
                    <option value="system">Automático</option>
                    <option value="on">Activado</option>
                    <option value="off">Desactivado</option>
                  </select>
                </div>

                <div className="h-px bg-gray-100" />

                {/* Font size */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Tamaño de texto</p>
                    <p className="text-[11px] text-gray-400">Aumenta la legibilidad</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {['Pequeño', 'Normal', 'Grande'].map((label, i) => {
                      const val = i === 0 ? 'small' : i === 1 ? 'normal' : 'large';
                      return (
                        <button
                          key={val}
                          onClick={() => setFontSize(val as any)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${fontSize === val ? 'bg-primary text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="h-px bg-gray-100" />

                {/* High contrast */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Alto contraste</p>
                    <p className="text-[11px] text-gray-400">Para mejorar la legibilidad</p>
                  </div>
                  <button
                    onClick={() => setHighContrast(!highContrast)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${highContrast ? 'bg-primary' : 'bg-gray-300'}`}
                    role="switch"
                    aria-checked={highContrast}
                    aria-label="Alto contraste"
                  >
                    <div className={`w-5 h-5 bg-white rounded-full shadow-sm absolute top-0.5 transition-transform ${highContrast ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                <div className="h-px bg-gray-100" />

                {/* Haptic feedback */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Vibración háptica</p>
                    <p className="text-[11px] text-gray-400">Vibración al completar acciones</p>
                  </div>
                  <button
                    onClick={() => { const next = !hapticEnabled; setHapticEnabled(next); setHapticEnabledState(next); }}
                    className={`relative w-11 h-6 rounded-full transition-colors ${hapticEnabled ? 'bg-primary' : 'bg-gray-300'}`}
                    role="switch"
                    aria-checked={hapticEnabled}
                    aria-label="Vibración háptica"
                  >
                    <div className={`w-5 h-5 bg-white rounded-full shadow-sm absolute top-0.5 transition-transform ${hapticEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Language & Dialect Settings */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Languages size={18} className="text-primary" />
                  <h3 className="text-sm font-bold text-gray-700">{t('language')} & {t('dialect')}</h3>
                </div>
                <button
                  onClick={() => setShowLanguageSettings(!showLanguageSettings)}
                  className="text-primary text-xs font-bold"
                >
                  {showLanguageSettings ? t('back') : t('edit')}
                </button>
              </div>

              <div className="p-5">
                {!showLanguageSettings ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-800">
                        {languages.find(l => l.id === language)?.label}
                      </p>
                      {language === 'es' && dialect !== 'none' && (
                        <p className="text-xs text-gray-500">
                          {dialects.find(d => d.id === dialect)?.label}
                        </p>
                      )}
                    </div>
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <Globe size={20} className="text-primary" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 animate-fade-in">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">{t('language')}</label>
                      <div className="grid grid-cols-2 gap-2">
                        {languages.map(l => (
                          <button
                            key={l.id}
                            onClick={() => setLanguage(l.id)}
                            className={`py-2 px-4 rounded-xl text-xs font-bold transition-all ${language === l.id ? 'bg-primary text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                              }`}
                          >
                            {l.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {language === 'es' && (
                      <div className="pt-2 border-t border-gray-50">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">{t('dialect')}</label>
                        <div className="grid grid-cols-2 gap-2">
                          {dialects.map(d => (
                            <button
                              key={d.id}
                              onClick={() => setDialect(d.id)}
                              className={`py-2 px-4 rounded-xl text-xs font-bold transition-all ${dialect === d.id ? 'bg-primary text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                }`}
                            >
                              {d.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Privacy & Security Settings */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock size={18} className="text-primary" />
                  <h3 className="text-sm font-bold text-gray-700">Privacidad y Seguridad</h3>
                </div>
                <button
                  onClick={() => setShowSecuritySettings(!showSecuritySettings)}
                  className="text-primary text-xs font-bold"
                >
                  {showSecuritySettings ? t('back') : t('edit')}
                </button>
              </div>

              <div className="p-5">
                {!showSecuritySettings ? (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">Controla quién puede ver tu perfil y gestiona tu contraseña</p>
                    <div className="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center">
                      <Shield size={20} className="text-purple-500" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6 animate-fade-in">
                    {/* Password Change Form */}
                    <form onSubmit={handleChangePassword} className="space-y-4">
                      <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('changePassword')}</h4>

                      <div className="space-y-3">
                        <div className="relative">
                          <input
                            type="password"
                            placeholder={t('currentPassword')}
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="w-full bg-gray-50 border-none rounded-xl py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                            required
                          />
                        </div>
                        <div className="relative">
                          <input
                            type="password"
                            placeholder={t('newPassword')}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full bg-gray-50 border-none rounded-xl py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                            required
                          />
                        </div>
                        <div className="relative">
                          <input
                            type="password"
                            placeholder={t('confirmPassword')}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full bg-gray-50 border-none rounded-xl py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                            required
                          />
                        </div>
                      </div>

                      {passwordError && (
                        <p className="text-[10px] text-red-500 font-bold">{passwordError}</p>
                      )}

                      {passwordSuccess && (
                        <p className="text-[10px] text-green-500 font-bold">{t('passwordChangedSuccess')}</p>
                      )}

                      <button
                        type="submit"
                        disabled={passwordLoading}
                        className="w-full bg-gradient-to-r from-primary to-primary-dark text-white font-bold py-3 rounded-xl shadow-lg shadow-primary/20 transition-all transform active:scale-95 disabled:opacity-50"
                      >
                        {passwordLoading ? '...' : t('save')}
                      </button>
                    </form>

                    {/* Other security options placeholders */}
                    <div className="pt-4 border-t border-gray-50 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-700">Perfil Público</span>
                        <button className="w-11 h-6 bg-primary rounded-full relative">
                          <div className="absolute right-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
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
                  <button
                    type="button"
                    onClick={() => {
                      document.getElementById('email-notifications-setting')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    className="px-4 py-2 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 transition-colors"
                  >
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

            {/* Danger Zone */}
            <div className="mt-8 pt-8 border-t border-gray-100" data-delete-account>
              <div className="bg-red-50 rounded-2xl p-6 border border-red-100">
                <h3 className="text-red-800 font-bold mb-2 flex items-center gap-2">
                  <AlertCircle size={18} />
                  {t('deleteAccount')}
                </h3>
                <p className="text-red-600 text-xs mb-4">
                  {t('deleteAccountWarning')}
                </p>

                {showDeleteConfirm ? (
                  <div className="space-y-3 animate-fade-in">
                    <p className="text-sm font-bold text-red-900">{t('deleteAccountConfirm')}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleConfirmDelete}
                        disabled={deleting}
                        className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 transition shadow-lg shadow-red-200 disabled:opacity-50"
                      >
                        {deleting ? '...' : t('deleteAccount')}
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 bg-white text-gray-500 font-bold py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition"
                      >
                        {t('cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full bg-red-500 text-white font-bold py-3 rounded-xl hover:bg-red-600 transition shadow-lg shadow-red-200 flex items-center justify-center gap-2"
                  >
                    <X size={18} />
                    {t('deleteAccount')}
                  </button>
                )}
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
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteConfirm(true);
                      setTimeout(() => {
                        document.querySelector('[data-delete-account]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }, 100);
                    }}
                    className="px-4 py-2 bg-indigo-500 text-white text-xs font-bold rounded-lg hover:bg-indigo-600 transition-colors"
                  >
                    Más Opciones
                  </button>
                </div>
              </div>
            </div>

            {/* Terms & Conditions */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center flex-shrink-0">
                  <FileText size={18} className="text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-800 text-sm mb-1">Términos y Condiciones</h3>
                  <p className="text-xs text-gray-500">Información legal sobre el uso de Estilo Vivo</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTerms(true)}
                  className="px-3 py-1.5 bg-primary text-white text-[10px] font-bold rounded-lg hover:opacity-90 transition-opacity"
                >
                  Ver
                </button>
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
                  <button
                    type="button"
                    onClick={() => {
                      window.location.href = 'mailto:appestilovivo@gmail.com?subject=Soporte%20Estilo%20Vivo';
                    }}
                    className="px-4 py-2 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors"
                  >
                    Contactar
                  </button>
                </div>
              </div>
            </div>

            {/* Terms Modal */}
            {showTerms && (
              <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowTerms(false)}>
                <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl animate-pop-in max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
                    <h3 className="text-lg font-bold text-gray-900">Términos y Condiciones</h3>
                    <button onClick={() => setShowTerms(false)} className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 transition-colors">
                      <X size={20} />
                    </button>
                  </div>
                  <div className="p-5 overflow-y-auto no-scrollbar space-y-4 text-sm text-gray-600 leading-relaxed flex-1">
                    <div className="bg-gradient-to-r from-primary/5 to-accent/5 rounded-2xl p-4 border border-primary/10">
                      <h4 className="font-bold text-primary text-sm mb-2">Originalidad del Diseño</h4>
                      <p className="text-xs text-gray-700">
                        El diseño, estructura, interfaz y experiencia de usuario de Estilo Vivo son originales y propiedad exclusiva de Andrea Rodríguez Sánchez. Cualquier similitud con otras plataformas es únicamente por el uso de patrones de diseño comunes en la industria. Queda prohibida la copia, reproducción o uso no autorizado del software, diseño o identidad visual.
                      </p>
                    </div>

                    <h4 className="font-bold text-gray-800 text-sm pt-2">1. Aceptación de los Términos</h4>
                    <p>Al acceder y usar Estilo Vivo, aceptas cumplir con estos términos y condiciones. Si no estás de acuerdo, no debes usar la plataforma.</p>

                    <h4 className="font-bold text-gray-800 text-sm pt-2">2. Propiedad Intelectual</h4>
                    <p>Todo el contenido, diseño, logotipos, gráficos, interfaces y software de Estilo Vivo están protegidos por las leyes de propiedad intelectual. Queda prohibida su reproducción, distribución o modificación sin autorización expresa.</p>

                    <h4 className="font-bold text-gray-800 text-sm pt-2">3. Uso de la Plataforma</h4>
                    <p>El usuario se compromete a usar Estilo Vivo de forma responsable, sin infringir derechos de terceros ni realizar actividades ilícitas. No está permitido publicar contenido ofensivo, discriminatorio o que viole la privacidad de otros usuarios.</p>

                    <h4 className="font-bold text-gray-800 text-sm pt-2">4. Privacidad y Datos</h4>
                    <p>Los datos personales proporcionados se gestionan conforme a nuestra política de privacidad. No compartimos información personal con terceros sin consentimiento, salvo obligación legal.</p>

                    <h4 className="font-bold text-gray-800 text-sm pt-2">5. Limitación de Responsabilidad</h4>
                    <p>Estilo Vivo no se hace responsable por daños directos o indirectos derivados del uso de la plataforma, incluyendo pérdida de datos o interrupción del servicio.</p>

                    <h4 className="font-bold text-gray-800 text-sm pt-2">6. Modificaciones</h4>
                    <p>Nos reservamos el derecho de modificar estos términos en cualquier momento. Los cambios serán notificados a través de la plataforma.</p>

                    <h4 className="font-bold text-gray-800 text-sm pt-2">7. Contacto</h4>
                    <p>Para cualquier consulta sobre estos términos, contacta a través de: <a href="mailto:appestilovivo@gmail.com" className="text-primary font-semibold">appestilovivo@gmail.com</a></p>

                    <p className="text-xs text-gray-400 text-center pt-4 border-t border-gray-100">Última actualización: Junio 2026</p>
                  </div>
                </div>
              </div>
            )}

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
            <div className="text-center pt-6 pb-2 flex flex-col items-center gap-4">
              <Logo variant="icon" className="w-16 h-16" />
              <div>
                <p className="text-xs text-gray-400">Estilovivo v1.0.0</p>
                <p className="text-xs text-gray-300 mt-1">Hecho con amor en España</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
