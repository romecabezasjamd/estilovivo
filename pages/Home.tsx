
import React, { useMemo, useState } from 'react';
import { UserState, MoodOption, Look, PlannerEntry, Garment } from '../types';
import {
  Sun, Search, Bell, TrendingUp, Calendar, Heart, ArrowRight, Sparkles, User, LogOut,
  Palette, Smartphone, Sync, Moon, Music, BarChart3, Info, ChevronRight, RefreshCcw, Shirt, AlertTriangle
} from 'lucide-react';
import { useLanguage } from '../src/context/LanguageContext';

interface HomeProps {
  user: UserState;
  onMoodChange: (mood: string) => void;
  onNavigate: (tab: string) => void;
  plannerEntries: PlannerEntry[];
  looks: Look[];
  garments: Garment[];
}

const getMoods = (gender?: string, t?: (key: any) => string): MoodOption[] => {
  const isMale = gender === 'male';
  const translate = (key: any) => t ? t(key) : key;

  return [
    { id: 'confident', label: isMale ? 'Seguro' : 'Segura', emoji: '🦁', colorClass: 'bg-orange-100 text-orange-700 border-orange-200' },
    { id: 'Sport', label: translate('sport'), emoji: '🏃', colorClass: 'bg-orange-100 text-orange-700 border-orange-200' },
    { id: 'creative', label: isMale ? 'Creativo' : 'Creativa', emoji: '🎨', colorClass: 'bg-purple-100 text-purple-700 border-purple-200' },
    { id: 'relaxed', label: isMale ? 'Relajado' : 'Relajada', emoji: '🧘‍♀️', colorClass: 'bg-teal-100 text-teal-700 border-teal-200' },
    { id: 'powerful', label: isMale ? 'Poderoso' : 'Poderosa', emoji: '⚡', colorClass: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    { id: 'elegant', label: 'Elegante', emoji: '✨', colorClass: 'bg-pink-100 text-pink-700 border-pink-200' },
    { id: 'casual', label: 'Casual', emoji: '🌿', colorClass: 'bg-green-100 text-green-700 border-green-200' },
  ];
};

const Home: React.FC<HomeProps> = ({ user, onMoodChange, onNavigate, plannerEntries, looks, garments }) => {
  const { t } = useLanguage();
  const moods = getMoods(user?.gender, t);

  // Real stats
  const mostUsedGarment = useMemo(
    () => [...garments].sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))[0],
    [garments]
  );
  const topUsedGarments = useMemo(
    () => [...garments].sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0)).slice(0, 3),
    [garments]
  );
  const lowUsageGarments = useMemo(
    () => garments.filter(g => (g.usageCount || 0) < 2).slice(0, 3),
    [garments]
  );
  const lowUsageCount = useMemo(
    () => garments.filter(g => (g.usageCount || 0) < 2).length,
    [garments]
  );
  const totalGarments = garments.length;
  const totalLooks = looks.length;

  // Weekly Planner logic - dynamic current week
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const today = new Date();

  const weeklyPlanner = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(today.getDate() - today.getDay() + i);
      const dateStr = d.toISOString().split('T')[0];
      const entry = plannerEntries.find(e => e.date === dateStr);
      const look = entry ? looks.find(l => l.id === entry.lookId) : null;

      // Get real image from look's garments
      let lookImage: string | null = null;
      if (look) {
        if (look.imageUrl) {
          lookImage = look.imageUrl;
        } else if (look.garments && look.garments.length > 0) {
          lookImage = look.garments[0].imageUrl;
        }
      }

      return {
        day: days[i],
        date: dateStr,
        isToday: d.toDateString() === today.toDateString(),
        lookImage,
        lookName: look?.name || null,
        hasEntry: !!entry
      };
    });
  }, [plannerEntries, looks, today]);

  // Today's plan
  const todayStr = today.toISOString().split('T')[0];
  const todayEntry = plannerEntries.find(e => e.date === todayStr);
  const todayLook = todayEntry ? looks.find(l => l.id === todayEntry.lookId) : null;

  return (
    <div className="p-6 space-y-8 animate-fade-in pb-28">
      {/* Header & Welcome */}
      <header className="space-y-2 mt-4">
        <h1 className="text-3xl font-bold text-gray-800 tracking-tight">
          Hola, <span className="text-primary">{user.name}</span>
        </h1>
        <p className="text-gray-500 text-lg font-light">{t('howAreYouFeeling')}</p>
      </header>

      {/* Mood Selector */}
      <section className="flex space-x-3 overflow-x-auto no-scrollbar py-2">
        {moods.map((m) => (
          <button
            key={m.id}
            onClick={() => onMoodChange(m.id)}
            className={`flex-shrink-0 px-4 py-3 rounded-2xl border flex items-center space-x-2 transition-all transform active:scale-95 ${user.mood === m.id
                ? 'bg-primary text-white border-primary shadow-lg ring-2 ring-offset-2 ring-primary/30'
                : 'bg-white border-gray-100 text-gray-600 shadow-sm hover:border-gray-200'
              }`}
          >
            <span className="text-xl">{m.emoji}</span>
            <span className="font-medium text-sm">{m.label}</span>
          </button>
        ))}
      </section>

      {/* Today's Look or CTA */}
      <section>
        {todayLook ? (
          <div className="bg-primary text-white p-5 rounded-3xl shadow-xl shadow-primary/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-8 -mt-8" />
            <div className="flex items-center space-x-4 relative z-10">
              {todayLook.imageUrl || (todayLook.garments && todayLook.garments.length > 0) ? (
                <img
                  src={todayLook.imageUrl || todayLook.garments?.[0]?.imageUrl}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-white/30"
                  alt={todayLook.name}
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
                  <Shirt size={28} className="text-white/70" />
                </div>
              )}
              <div className="flex-1">
                <span className="text-[10px] uppercase tracking-widest text-teal-200 font-bold">Look de hoy</span>
                <h3 className="font-bold text-xl">{todayLook.name}</h3>
                {todayLook.garments && (
                  <p className="text-sm text-teal-100">{todayLook.garments.length} prendas</p>
                )}
              </div>
              <button onClick={() => onNavigate('planner')} className="bg-white/10 p-2 rounded-full hover:bg-white/20">
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => onNavigate('create')}
            className="w-full bg-primary text-white p-5 rounded-3xl shadow-xl shadow-primary/20 flex items-center justify-between group hover:bg-teal-900 transition-colors"
          >
            <div className="flex flex-col items-start">
              <span className="font-bold text-lg">Crear Look de Hoy</span>
              <span className="text-primary-100 text-sm opacity-80">
                Basado en tu mood {user.mood ? `"${moods.find(m => m.id === user.mood)?.label}"` : ''}
              </span>
            </div>
            <div className="bg-white/10 p-2 rounded-full group-hover:bg-white/20 transition-colors">
              <Sparkles size={24} className="text-accent" />
            </div>
          </button>
        )}
      </section>

      {/* Weekly Summary */}
      <section className="space-y-4">
        <div className="flex justify-between items-end">
          <h2 className="text-xl font-bold text-gray-800">Tu Semana</h2>
          <button onClick={() => onNavigate('planner')} className="text-xs text-primary font-semibold flex items-center">
            Ver todo <ChevronRight size={14} />
          </button>
        </div>
        <div className="flex space-x-3 overflow-x-auto no-scrollbar pb-2">
          {weeklyPlanner.map((day) => (
            <div key={day.date} className="flex flex-col items-center space-y-2">
              <span className={`text-xs font-medium ${day.isToday ? 'text-primary' : 'text-gray-400'}`}>{day.day}</span>
              <div className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center relative overflow-hidden ${day.isToday ? 'border-accent shadow-md' : day.lookImage ? 'border-primary/30' : 'border-dashed border-gray-200 bg-gray-50'}`}>
                {day.lookImage ? (
                  <img src={day.lookImage} className="w-full h-full object-cover" alt={day.lookName || 'Look'} />
                ) : day.isToday ? (
                  <button onClick={() => onNavigate('planner')} className="w-full h-full flex items-center justify-center">
                    <span className="text-gray-300 text-[10px] text-center leading-none px-1">Planear</span>
                  </button>
                ) : (
                  <div className="w-2 h-2 rounded-full bg-gray-200" />
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Stats Grid */}
      <section className="grid grid-cols-2 gap-3">
        <div className="stagger-child bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-primary/30 transition-all">
          <div className="flex items-center space-x-2 text-primary mb-2">
            <Shirt size={16} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Armario</span>
          </div>
          <span className="text-2xl font-bold text-gray-800">{totalGarments}</span>
          <span className="text-xs text-gray-400 ml-1">prendas</span>
        </div>
        <div className="stagger-child bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-primary/30 transition-all">
          <div className="flex items-center space-x-2 text-primary mb-2">
            <TrendingUp size={16} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Looks</span>
          </div>
          <span className="text-2xl font-bold text-gray-800">{totalLooks}</span>
          <span className="text-xs text-gray-400 ml-1">creados</span>
        </div>
      </section>

      {/* Sustainability / Usage Stats */}
      <section className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex items-center space-x-2 text-primary">
          <RefreshCcw size={18} />
          <h3 className="font-bold">Armario Consciente</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="stagger-child bg-lavender-50 p-3 rounded-2xl hover:shadow-md transition-all">
            <p className="text-xs text-gray-500 mb-1">Más usada</p>
            <div className="flex items-center space-x-2">
              {mostUsedGarment ? (
                <>
                  <img src={mostUsedGarment.imageUrl} className="w-8 h-8 rounded-full object-cover" alt={mostUsedGarment.type} />
                  <div>
                    <span className="text-[10px] font-semibold text-gray-700 line-clamp-1 capitalize">{mostUsedGarment.name || mostUsedGarment.type}</span>
                    <span className="text-[10px] text-gray-400 block">{mostUsedGarment.usageCount} usos</span>
                  </div>
                </>
              ) : (
                <span className="text-[10px] text-gray-400">Sin datos aún</span>
              )}
            </div>
          </div>
          <div className="stagger-child bg-orange-50 p-3 rounded-2xl hover:shadow-md transition-all">
            <p className="text-xs text-gray-500 mb-1">Baja rotación</p>
            <div className="flex items-center space-x-2">
              {lowUsageCount > 0 ? (
                <>
                  <AlertTriangle size={18} className="text-accent" />
                  <div>
                    <span className="text-xl font-bold text-accent">{lowUsageCount}</span>
                    <span className="text-[10px] text-gray-600 block leading-tight">prendas olvidadas</span>
                  </div>
                </>
              ) : (
                <span className="text-[10px] text-gray-500">Todas en rotación</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Most Used Garments */}
      <section className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm animate-fade-in-up">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-800">Tus prendas mas usadas</h3>
          <button onClick={() => onNavigate('wardrobe')} className="text-xs text-primary font-semibold">
            Ver armario
          </button>
        </div>
        {topUsedGarments.length === 0 ? (
          <p className="text-sm text-gray-400">Aun no hay suficiente uso registrado.</p>
        ) : (
          <div className="space-y-3">
            {topUsedGarments.map(item => (
              <div key={item.id} className="flex items-center gap-3">
                <img src={item.imageUrl} alt={item.name || item.type} className="w-12 h-12 rounded-xl object-cover" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800 truncate">{item.name || item.type}</p>
                  <p className="text-xs text-gray-400 capitalize">{item.color} · {item.usageCount || 0} usos</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Low Usage Garments */}
      <section className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm animate-fade-in-up">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-800">Prendas olvidadas</h3>
          <button onClick={() => onNavigate('wardrobe')} className="text-xs text-primary font-semibold">
            Reactivar
          </button>
        </div>
        {lowUsageGarments.length === 0 ? (
          <p className="text-sm text-gray-400">Todo tu armario esta en rotacion.</p>
        ) : (
          <div className="space-y-3">
            {lowUsageGarments.map(item => (
              <div key={item.id} className="flex items-center gap-3">
                <img src={item.imageUrl} alt={item.name || item.type} className="w-12 h-12 rounded-xl object-cover" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800 truncate">{item.name || item.type}</p>
                  <p className="text-xs text-gray-400 capitalize">{item.color} · {item.usageCount || 0} usos</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Quick Access Grid */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <button onClick={() => onNavigate('wardrobe')} className="stagger-child p-4 bg-white border border-gray-100 rounded-2xl shadow-sm text-left hover:border-primary/30 hover:shadow-md transition-all">
          <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
            <Shirt size={16} />
          </div>
          <span className="font-medium text-gray-700 text-sm">Mi Armario</span>
          <p className="text-[10px] text-gray-400 mt-0.5">Organiza tus prendas</p>
        </button>
        <button onClick={() => onNavigate('wishlist')} className="stagger-child p-4 bg-white border border-gray-100 rounded-2xl shadow-sm text-left hover:border-primary/30 hover:shadow-md transition-all">
          <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mb-2">
            <Heart size={16} />
          </div>
          <span className="font-medium text-gray-700 text-sm">Wishlist</span>
          <p className="text-[10px] text-gray-400 mt-0.5">Tus deseos de compra</p>
        </button>
        <button onClick={() => onNavigate('suitcase')} className="stagger-child p-4 bg-white border border-gray-100 rounded-2xl shadow-sm text-left hover:border-primary/30 hover:shadow-md transition-all">
          <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
            <Briefcase size={16} />
          </div>
          <span className="font-medium text-gray-700 text-sm">Mis Viajes</span>
          <p className="text-[10px] text-gray-400 mt-0.5">Planifica tu maleta</p>
        </button>
        <button onClick={() => onNavigate('community')} className="stagger-child p-4 bg-white border border-gray-100 rounded-2xl shadow-sm text-left hover:border-primary/30 hover:shadow-md transition-all">
          <div className="w-8 h-8 rounded-full bg-yellow-50 text-yellow-600 flex items-center justify-center mb-2">
            <Sun size={16} />
          </div>
          <span className="font-medium text-gray-700 text-sm">Comunidad</span>
          <p className="text-[10px] text-gray-400 mt-0.5">Inspírate con looks</p>
        </button>
      </div>
    </div>
  );
};

const Briefcase = ({ size, className }: { size: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);

export default Home;
