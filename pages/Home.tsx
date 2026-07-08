
import React, { useMemo, useEffect, useRef } from 'react';
import { UserState, MoodOption, Look, PlannerEntry, Garment } from '../types';
import {
  Sun, TrendingUp, Heart, Sparkles, ChevronRight, Shirt
} from 'lucide-react';
import { useLanguage } from '../src/context/LanguageContext';
import Logo from '../components/Logo';
import LevelProgress from '../components/LevelProgress';
import {
  getCyclePeriod,
  isDateInCycle,
  isTodayInCycle,
  getMotivationalMessageForToday,
  getMotivationalMessageForDate,
} from '../src/utils/cycleTracking';
import { useNotification } from '../src/context/NotificationContext';
import CycleDayMarker from '../src/components/CycleDayMarker';

interface HomeProps {
  user: UserState;
  onMoodChange: (mood: string) => void;
  onNavigate: (tab: string, subTab?: string, date?: string) => void;
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
  const { notify } = useNotification();
  const moods = getMoods(user?.gender, t);
  const showCycleFeatures = user.gender === 'female' && user.cycleTracking;
  const cyclePeriod = useMemo(
    () => (user.cycleTracking && user.gender === 'female' ? getCyclePeriod(user.id) : null),
    [user.id, user.cycleTracking, user.gender]
  );
  const cycleActiveToday = useMemo(
    () => Boolean(user.cycleTracking && user.gender === 'female' && isTodayInCycle(user.id, cyclePeriod)),
    [user.cycleTracking, user.gender, user.id, cyclePeriod]
  );
  const cycleMessage = useMemo(
    () => (user.cycleTracking && user.gender === 'female' ? getMotivationalMessageForToday(user.id) : null),
    [user.cycleTracking, user.gender, user.id, cyclePeriod]
  );
  const moodAutoSetRef = useRef(false);

  useEffect(() => {
    if (cycleActiveToday && !moodAutoSetRef.current) {
      moodAutoSetRef.current = true;
      if (user.mood !== 'confident') {
        onMoodChange('confident');
      }
    }
    if (!cycleActiveToday) {
      moodAutoSetRef.current = false;
    }
  }, [cycleActiveToday, user.mood, onMoodChange]);

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

      const isCycleDay = Boolean(
        showCycleFeatures && cyclePeriod && isDateInCycle(dateStr, cyclePeriod)
      );

      return {
        day: days[i],
        date: dateStr,
        isToday: d.toDateString() === today.toDateString(),
        lookImage,
        lookName: look?.name || null,
        hasEntry: !!entry,
        isCycleDay,
      };
    });
  }, [plannerEntries, looks, today, cyclePeriod, showCycleFeatures]);

  const handleCycleDayTap = (dateStr: string) => {
    const msg = getMotivationalMessageForDate(dateStr, user.id);
    if (msg) notify(msg, 'info');
  };

  // Today's plan
  const todayStr = today.toISOString().split('T')[0];
  const todayEntry = plannerEntries.find(e => e.date === todayStr);
  const todayLook = todayEntry ? looks.find(l => l.id === todayEntry.lookId) : null;

  return (
    <div className="p-6 space-y-8 animate-fade-in pb-28">
      {/* Header & Welcome */}
      <header className="space-y-6 mt-4">
        <Logo variant="icon" className="w-16 h-16 mx-auto" />
        <h1 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">
          Hola, <span className="text-primary">{user.name}</span>
        </h1>
        <p className="text-[var(--text-secondary)] text-lg font-light">{t('howAreYouFeeling')}</p>
        <LevelProgress user={user} />
      </header>

      {showCycleFeatures && cycleMessage && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100 rounded-2xl px-4 py-3 flex items-start gap-3 animate-fade-in">
          <span className="text-lg flex-shrink-0 animate-pulse">🌙</span>
          <p className="text-sm font-medium text-purple-900 leading-snug">{cycleMessage}</p>
        </div>
      )}

      {/* Mood Selector */}
      <section className="flex space-x-3 overflow-x-auto no-scrollbar py-2">
        {moods.map((m) => {
          const isSelected = user.mood === m.id;
          const isCycleHighlight = cycleActiveToday && m.id === 'confident';
          const isActive = isSelected || isCycleHighlight;
          return (
          <button
            key={m.id}
            onClick={() => onMoodChange(m.id)}
            className={`flex-shrink-0 px-4 py-3 rounded-2xl border flex items-center space-x-2 transition-all transform active:scale-95 ${isActive
              ? 'bg-primary text-white border-primary shadow-lg ring-2 ring-offset-2 ring-primary/30'
              : 'bg-[var(--bg-card)] border-[var(--border-light)] text-[var(--text-secondary)] shadow-sm hover:border-[var(--border-light)]'
              } ${isCycleHighlight && !isSelected ? 'ring-2 ring-purple-300 border-purple-200' : ''}`}
          >
            <span className="text-xl">{m.emoji}</span>
            <span className="font-medium text-sm">{m.label}</span>
          </button>
        );
        })}
      </section>

      {/* Today's Look or CTA */}
      <section>
        {todayLook ? (
          <div className="bg-primary text-white p-5 rounded-3xl shadow-xl shadow-primary/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--bg-card)]/5 rounded-full -mr-8 -mt-8" />
            <div className="flex items-center space-x-4 relative z-10">
              {todayLook.imageUrl || (todayLook.garments && todayLook.garments.length > 0) ? (
                <img
                  src={todayLook.imageUrl || todayLook.garments?.[0]?.imageUrl}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-white/30"
                  alt={todayLook.name}
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-[var(--bg-card)]/20 flex items-center justify-center">
                  <Shirt size={28} className="text-white/70" />
                </div>
              )}
              <div className="flex-1">
                <span className="text-[10px] uppercase tracking-widest text-teal-200 font-bold">Look de hoy</span>
                <h3 className="font-bold text-xl">{todayLook.name}</h3>
                {todayLook.garments && (
                  <p className="text-sm text-teal-100">{todayLook.garments.filter(g => !!g).length} prendas</p>
                )}
              </div>
              <button onClick={() => onNavigate('planner')} className="bg-[var(--bg-card)]/10 p-2 rounded-full hover:bg-[var(--bg-card)]/20">
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => onNavigate('wardrobe', 'createLook')}
            className="w-full bg-primary text-white p-5 rounded-3xl shadow-xl shadow-primary/20 flex items-center justify-between group hover:bg-teal-900 transition-colors"
          >
            <div className="flex flex-col items-start">
              <span className="font-bold text-lg">Crear Look de Hoy</span>
              <span className="text-primary-100 text-sm opacity-80">
                Basado en tu mood {user.mood ? `"${moods.find(m => m.id === user.mood)?.label}"` : ''}
              </span>
            </div>
            <div className="bg-[var(--bg-card)]/10 p-2 rounded-full group-hover:bg-[var(--bg-card)]/20 transition-colors">
              <Sparkles size={24} className="text-accent" />
            </div>
          </button>
        )}
      </section>

      {/* Weekly Summary */}
      <section className="space-y-4">
        <div className="flex justify-between items-end">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Tu Semana</h2>
          <button onClick={() => onNavigate('planner')} className="text-xs text-primary font-semibold flex items-center">
            Ver todo <ChevronRight size={14} />
          </button>
        </div>
        <div className="flex space-x-3 overflow-x-auto no-scrollbar pb-2">
          {weeklyPlanner.map((day) => (
            <div key={day.date} className="flex flex-col items-center space-y-2 flex-shrink-0">
              <span className={`text-xs font-medium ${day.isToday ? 'text-primary' : 'text-[var(--text-muted)]'}`}>{day.day}</span>
              {day.isCycleDay && showCycleFeatures ? (
                <button
                  type="button"
                  onClick={() => handleCycleDayTap(day.date)}
                  className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center relative overflow-hidden border-rose-200/80 bg-rose-50/90 cycle-day-cell--active touch-manipulation ${
                    day.isToday ? 'ring-2 ring-primary/30' : ''
                  }`}
                  aria-label="Día de ciclo — ver mensaje"
                >
                  {day.lookImage ? (
                    <img src={day.lookImage} className="w-full h-full object-cover opacity-60" alt="" />
                  ) : null}
                  <CycleDayMarker />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigate('planner', undefined, day.date)}
                  className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center relative overflow-hidden transition-all hover:scale-105 ${
                    day.isToday
                      ? 'border-accent shadow-md'
                      : day.lookImage
                        ? 'border-primary/30'
                        : 'border-dashed border-[var(--border-light)] bg-gray-50'
                  }`}
                >
                  {day.lookImage ? (
                    <img src={day.lookImage} className="w-full h-full object-cover" alt={day.lookName || 'Look'} loading="lazy" />
                  ) : day.isToday ? (
                    <span className="text-gray-300 text-[10px] text-center leading-none px-1">Planear</span>
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-gray-200" />
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Stats Grid */}
      <section className="grid grid-cols-2 gap-3">
        <div className="stagger-child bg-[var(--bg-card)] p-4 rounded-2xl border border-[var(--border-light)] shadow-sm hover:shadow-md hover:border-primary/30 transition-all">
          <div className="flex items-center space-x-2 text-primary mb-2">
            <Shirt size={16} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Armario</span>
          </div>
          <span className="text-2xl font-bold text-[var(--text-primary)]">{totalGarments}</span>
          <span className="text-xs text-[var(--text-muted)] ml-1">prendas</span>
        </div>
        <div className="stagger-child bg-[var(--bg-card)] p-4 rounded-2xl border border-[var(--border-light)] shadow-sm hover:shadow-md hover:border-primary/30 transition-all">
          <div className="flex items-center space-x-2 text-primary mb-2">
            <TrendingUp size={16} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Looks</span>
          </div>
          <span className="text-2xl font-bold text-[var(--text-primary)]">{totalLooks}</span>
          <span className="text-xs text-[var(--text-muted)] ml-1">creados</span>
        </div>
      </section>

      {/* Quick Access Grid */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <button onClick={() => onNavigate('wardrobe')} className="stagger-child p-4 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-2xl shadow-sm text-left hover:border-primary/30 hover:shadow-md transition-all">
          <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
            <Shirt size={16} />
          </div>
          <span className="font-medium text-[var(--text-primary)] text-sm">Mi Armario</span>
          <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Organiza tus prendas</p>
        </button>
        <button onClick={() => onNavigate('wishlist')} className="stagger-child p-4 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-2xl shadow-sm text-left hover:border-primary/30 hover:shadow-md transition-all">
          <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mb-2">
            <Heart size={16} />
          </div>
          <span className="font-medium text-[var(--text-primary)] text-sm">Wishlist</span>
          <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Tus deseos de compra</p>
        </button>
        <button onClick={() => onNavigate('suitcase')} className="stagger-child p-4 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-2xl shadow-sm text-left hover:border-primary/30 hover:shadow-md transition-all">
          <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
            <Briefcase size={16} />
          </div>
          <span className="font-medium text-[var(--text-primary)] text-sm">Mis Viajes</span>
          <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Planifica tu maleta</p>
        </button>
        <button onClick={() => onNavigate('community')} className="stagger-child p-4 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-2xl shadow-sm text-left hover:border-primary/30 hover:shadow-md transition-all">
          <div className="w-8 h-8 rounded-full bg-yellow-50 text-yellow-600 flex items-center justify-center mb-2">
            <Sun size={16} />
          </div>
          <span className="font-medium text-[var(--text-primary)] text-sm">Comunidad</span>
          <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Inspírate con looks</p>
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
