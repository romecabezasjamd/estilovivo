
import React, { useState, useMemo } from 'react';
import { Look, PlannerEntry } from '../types';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, MoreVertical, Plus, X, Shirt, Trash2, CalendarDays } from 'lucide-react';
import { useLanguage } from '../src/context/LanguageContext';
import { useGlobalState } from '../src/context/GlobalStateContext';
import { getCyclePeriod, isDateInCycle } from '../src/utils/cycleTracking';
import CycleDayMarker from '../src/components/CycleDayMarker';

interface PlannerProps {
    looks: Look[];
    plannerEntries: PlannerEntry[];
    onUpdateEntry: (entry: PlannerEntry) => void;
    initialDate?: string;
}

const Planner: React.FC<PlannerProps> = ({ looks, plannerEntries, onUpdateEntry, initialDate }) => {
    const { t } = useLanguage();
    const [weekOffset, setWeekOffset] = useState(0);
    const [monthOffset, setMonthOffset] = useState(0);
    const [selectedDate, setSelectedDate] = useState<string | null>(initialDate || null);
    const [eventNoteInput, setEventNoteInput] = useState('');
    const [editingNote, setEditingNote] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'monthly' | 'weekly' | 'daily'>(initialDate ? 'daily' : 'weekly');
    const [dailyViewDate, setDailyViewDate] = useState(initialDate || '');
    const [monthlyClickedDay, setMonthlyClickedDay] = useState<string | null>(null);

    const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    // Weekly dates
    const weekDates = useMemo(() => {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        return Array.from({ length: 7 }).map((_, i) => {
            const d = new Date(today);
            d.setDate(today.getDate() + mondayOffset + i + (weekOffset * 7));
            return d.toISOString().split('T')[0];
        });
    }, [weekOffset]);

    const todayStr = new Date().toISOString().split('T')[0];

    // Weekly header label
    const headerLabel = useMemo(() => {
        const first = new Date(weekDates[0]);
        const last = new Date(weekDates[6]);
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        if (first.getMonth() === last.getMonth()) {
            return `${months[first.getMonth()]} ${first.getFullYear()}`;
        }
        return `${months[first.getMonth()].slice(0, 3)} - ${months[last.getMonth()].slice(0, 3)} ${last.getFullYear()}`;
    }, [weekDates]);

    // Monthly calendar grid
    const baseToday = useMemo(() => new Date(), []);
    const currentMonth = useMemo(() => {
        const d = new Date(baseToday.getFullYear(), baseToday.getMonth() + monthOffset, 1);
        return d;
    }, [monthOffset]);

    const calendarGrid = useMemo(() => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const startOffset = firstDay === 0 ? 6 : firstDay - 1;
        const grid: (string | null)[] = [];
        for (let i = 0; i < startOffset; i++) {
            grid.push(null);
        }
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            grid.push(dateStr);
        }
        return grid;
    }, [currentMonth]);

    const monthLabel = useMemo(() => {
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return `${months[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;
    }, [currentMonth]);

    const { user } = useGlobalState();
    const showCycleFeatures = user?.gender === 'female' && user?.cycleTracking;
    const cyclePeriod = useMemo(
        () => (showCycleFeatures ? getCyclePeriod(user?.id) : null),
        [user?.id, showCycleFeatures]
    );
    const isActiveCycle = showCycleFeatures && cyclePeriod !== null;

    const getEntry = (date: string) => plannerEntries.find(p => p.date === date);
    const getLook = (id: string | null) => looks.find(l => l.id === id);

    const getLookImage = (look: Look | undefined) => {
        if (!look) return null;
        if (look.imageUrl) return look.imageUrl;
        if (look.garments && look.garments.length > 0) return look.garments[0].imageUrl;
        return null;
    };

    const handleAssign = (lookId: string) => {
        if (selectedDate) {
            onUpdateEntry({
                date: selectedDate,
                lookId: lookId,
                eventNote: getEntry(selectedDate)?.eventNote
            });
            setSelectedDate(null);
        }
    };

    const handleSaveNote = (date: string) => {
        const entry = getEntry(date);
        onUpdateEntry({
            date,
            lookId: entry?.lookId || null,
            eventNote: eventNoteInput.trim() || undefined,
        });
        setEditingNote(null);
        setEventNoteInput('');
    };

    const handleClearLook = (date: string) => {
        const entry = getEntry(date);
        onUpdateEntry({
            date,
            lookId: null,
            eventNote: entry?.eventNote
        });
    };

    const navigateDaily = (dir: number) => {
        const d = new Date((dailyViewDate || todayStr) + 'T12:00:00');
        d.setDate(d.getDate() + dir);
        setDailyViewDate(d.toISOString().split('T')[0]);
    };

    const goToDailyView = (date: string) => {
        setDailyViewDate(date);
        setViewMode('daily');
    };

    const effectiveDailyDate = useMemo(() => {
        return dailyViewDate || todayStr;
    }, [dailyViewDate]);

    const dailyEntry = useMemo(() => getEntry(effectiveDailyDate), [effectiveDailyDate, plannerEntries]);
    const dailyLook = useMemo(() => dailyEntry ? getLook(dailyEntry.lookId) : null, [dailyEntry]);

    return (
        <div className="p-6 pb-24 relative h-full">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 mt-4 gap-3">
                <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('planner')}</h1>
                <div className="flex items-center space-x-1 bg-gray-100 rounded-xl p-1 self-start">
                    <button
                        onClick={() => setViewMode('monthly')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${viewMode === 'monthly' ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        <CalendarDays size={14} className="inline mr-1.5 -mt-0.5" />
                        Mensual
                    </button>
                    <button
                        onClick={() => setViewMode('weekly')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${viewMode === 'weekly' ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        <CalendarIcon size={14} className="inline mr-1.5 -mt-0.5" />
                        Semanal
                    </button>
                    <button
                        onClick={() => { setDailyViewDate(todayStr); setViewMode('daily'); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${viewMode === 'daily' ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        <CalendarIcon size={14} className="inline mr-1.5 -mt-0.5" />
                        Diario
                    </button>
                </div>
            </header>

            {/* ---- MONTHLY VIEW ---- */}
            {viewMode === 'monthly' && (
                <div>
                    <div className="flex items-center justify-between mb-6">
                        <button onClick={() => setMonthOffset(m => m - 1)} className="p-1 text-[var(--text-muted)] hover:text-primary">
                            <ChevronLeft size={20} />
                        </button>
                        <div className="flex items-center space-x-2 text-[var(--text-secondary)] text-sm font-medium bg-[var(--bg-card)] px-3 py-1.5 rounded-full border border-[var(--border-light)]">
                            <CalendarIcon size={14} />
                            <span>{monthLabel}</span>
                        </div>
                        <button onClick={() => setMonthOffset(m => m + 1)} className="p-1 text-[var(--text-muted)] hover:text-primary">
                            <ChevronRight size={20} />
                        </button>
                        {monthOffset !== 0 && (
                            <button onClick={() => setMonthOffset(0)} className="ml-2 text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-full">
                                {t('today')}
                            </button>
                        )}
                    </div>

                    <div className="bg-[var(--bg-card)] rounded-2xl shadow-sm border border-[var(--border-light)] p-3 sm:p-4">
                        <div className="grid grid-cols-7 mb-2">
                            {weekDays.map(day => (
                                <div key={day} className="text-center text-[10px] font-semibold text-[var(--text-muted)] uppercase pb-2">
                                    {day}
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7">
                            {calendarGrid.map((dateStr, idx) => {
                                if (!dateStr) {
                                    return <div key={`e-${idx}`} className="aspect-square" />;
                                }
                                const dayNum = parseInt(dateStr.split('-')[2], 10);
                                const entry = getEntry(dateStr);
                                const look = entry ? getLook(entry.lookId) : null;
                                const lookImg = getLookImage(look || undefined);
                                const isToday = dateStr === todayStr;
                                const hasEntry = !!entry;
                                const isClicked = dateStr === monthlyClickedDay;
                                const _isCycleDay = isActiveCycle && isDateInCycle(dateStr, cyclePeriod!);
                                return (
                                    <button
                                        key={dateStr}
                                        onClick={() => setMonthlyClickedDay(dateStr === monthlyClickedDay ? null : dateStr)}
                                        className={`aspect-square flex flex-col items-center justify-center rounded-xl text-sm transition-all relative overflow-hidden
                                            ${isToday ? 'bg-primary/10 text-primary font-bold' : _isCycleDay ? 'bg-rose-50/80 hover:bg-rose-100/80 text-[var(--text-primary)]' : 'hover:bg-gray-50 text-[var(--text-primary)]'}
                                            ${isClicked ? 'ring-2 ring-primary' : _isCycleDay && !isToday ? 'cycle-day-cell--active' : ''}
                                        `}
                                    >
                                        <span className="relative z-10">{dayNum}</span>
                                        {hasEntry && lookImg ? (
                                            <img src={lookImg} className="w-5 h-5 rounded object-cover mt-0.5 relative z-10" alt="" />
                                        ) : hasEntry ? (
                                            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-0.5 relative z-10" />
                                        ) : null}
                                        {_isCycleDay && <CycleDayMarker />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {monthlyClickedDay && (() => {
                        const entry = getEntry(monthlyClickedDay);
                        const look = entry ? getLook(entry.lookId) : null;
                        const lookImg = getLookImage(look || undefined);
                        const dayDate = new Date(monthlyClickedDay + 'T12:00:00');
                        const dayName = dayDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
                        return (
                            <div className="mt-4 bg-[var(--bg-card)] rounded-2xl p-4 shadow-sm border border-[var(--border-light)]">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-bold text-[var(--text-primary)] capitalize">{dayName}</h3>
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={() => goToDailyView(monthlyClickedDay)}
                                            className="text-[10px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full hover:bg-primary/20"
                                        >
                                            Ver día completo
                                        </button>
                                        <button
                                            onClick={() => setMonthlyClickedDay(null)}
                                            className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                </div>
                                {look ? (
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                            {lookImg ? (
                                                <img src={lookImg} className="w-14 h-14 rounded-xl object-cover" alt={look.name} />
                                            ) : (
                                                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                                    <Shirt size={22} />
                                                </div>
                                            )}
                                            <div>
                                                <h4 className="font-bold text-[var(--text-primary)] text-sm">{look.name}</h4>
                                                {look.garments && look.garments.filter(g => !!g).length > 0 && (
                                                    <p className="text-[10px] text-[var(--text-muted)]">{look.garments.filter(g => !!g).length} prendas</p>
                                                )}
                                                {entry?.eventNote && (
                                                    <span className="text-xs text-accent font-medium bg-orange-50 px-2 py-0.5 rounded-md mt-1 inline-block">
                                                        {entry.eventNote}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleClearLook(monthlyClickedDay)}
                                            className="text-gray-300 hover:text-red-400 p-1"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-14 h-14 rounded-xl border-2 border-dashed border-[var(--border-light)] flex items-center justify-center bg-gray-50">
                                                <Plus size={20} className="text-[var(--text-muted)]" />
                                            </div>
                                            <span className="text-sm font-medium text-[var(--text-muted)]">Sin planificar</span>
                                        </div>
                                        <button
                                            onClick={() => { setSelectedDate(monthlyClickedDay); setMonthlyClickedDay(null); }}
                                            className="text-xs font-bold text-primary border border-primary/30 px-3 py-1.5 rounded-full hover:bg-primary/5"
                                        >
                                            {t('assign')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* ---- WEEKLY VIEW ---- */}
            {viewMode === 'weekly' && (
                <>
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center space-x-2">
                            <button onClick={() => setWeekOffset(w => w - 1)} className="p-1 text-[var(--text-muted)] hover:text-primary">
                                <ChevronLeft size={20} />
                            </button>
                            <div className="flex items-center space-x-2 text-[var(--text-secondary)] text-sm font-medium bg-[var(--bg-card)] px-3 py-1.5 rounded-full border border-[var(--border-light)]">
                                <CalendarIcon size={14} />
                                <span>{headerLabel}</span>
                            </div>
                            <button onClick={() => setWeekOffset(w => w + 1)} className="p-1 text-[var(--text-muted)] hover:text-primary">
                                <ChevronRight size={20} />
                            </button>
                            {weekOffset !== 0 && (
                                <button onClick={() => setWeekOffset(0)} className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-full">
                                    {t('today')}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4">
                        {weekDates.map((date, idx) => {
                            const entry = getEntry(date);
                            const look = entry ? getLook(entry.lookId) : null;
                            const dayNum = date.split('-')[2];
                            const isToday = date === todayStr;
                            const isPast = date < todayStr;
                            const lookImg = getLookImage(look || undefined);
                            const _isCycleDay = isActiveCycle && isDateInCycle(date, cyclePeriod!);

                            return (
                                <div key={date} className="flex group">
                                    <div className="flex flex-col items-center mr-4 w-12 pt-2 relative">
                                        <span className={`text-xs font-semibold uppercase ${isToday ? 'text-primary' : 'text-[var(--text-muted)]'}`}>{weekDays[idx]}</span>
                                        <span className={`text-lg font-bold relative ${isToday ? 'text-white bg-primary w-8 h-8 rounded-full flex items-center justify-center' : _isCycleDay ? 'text-[var(--text-primary)] bg-rose-50/80 w-8 h-8 rounded-full flex items-center justify-center' : isPast ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>
                                            {dayNum}
                                        </span>
                                        {_isCycleDay && !isToday && <div className="absolute -bottom-0.5 right-0"><CycleDayMarker /></div>}
                                        {idx !== 6 && <div className="w-px h-full bg-gray-200 my-2" />}
                                    </div>

                                    <div className={`flex-1 bg-[var(--bg-card)] rounded-2xl p-3 shadow-sm border min-h-[5rem] transition-all ${isToday ? 'border-primary/30 shadow-md' : 'border-[var(--border-light)]'}`}>
                                        {look ? (
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-3">
                                                    {lookImg ? (
                                                        <img src={lookImg} className="w-14 h-14 rounded-xl object-cover" alt={look.name} />
                                                    ) : (
                                                        <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                                            <Shirt size={22} />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <h4 className="font-bold text-[var(--text-primary)] text-sm">{look.name}</h4>
                                                        {look.garments && look.garments.filter(g => !!g).length > 0 && (
                                                            <p className="text-[10px] text-[var(--text-muted)]">{look.garments.filter(g => !!g).length} prendas</p>
                                                        )}
                                                        {entry?.eventNote && (
                                                            <span className="text-xs text-accent font-medium bg-orange-50 px-2 py-0.5 rounded-md mt-1 inline-block">
                                                                {entry.eventNote}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-1">
                                                    <button onClick={() => handleClearLook(date)} className="text-gray-300 hover:text-red-400 p-1">
                                                        <Trash2 size={14} />
                                                    </button>
                                                    <button onClick={() => setSelectedDate(date)} className="text-gray-300 hover:text-[var(--text-secondary)] p-1">
                                                        <MoreVertical size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center space-x-4 w-full">
                                                <div className="w-14 h-14 rounded-xl border-2 border-dashed border-[var(--border-light)] flex items-center justify-center bg-gray-50 flex-shrink-0">
                                                    <Plus size={20} className="text-[var(--text-muted)]" />
                                                </div>
                                                <div className="flex flex-col flex-1">
                                                    <span className="text-sm font-medium text-[var(--text-muted)]">Sin planificar</span>
                                                    {editingNote === date ? (
                                                        <div className="flex items-center space-x-1 mt-1">
                                                            <input
                                                                type="text"
                                                                value={eventNoteInput}
                                                                onChange={e => setEventNoteInput(e.target.value)}
                                                                onKeyDown={e => e.key === 'Enter' && handleSaveNote(date)}
                                                                className="text-xs border border-[var(--border-light)] rounded-lg px-2 py-1 flex-1 outline-none focus:border-primary"
                                                                placeholder="Nota del evento..."
                                                                autoFocus
                                                            />
                                                            <button onClick={() => handleSaveNote(date)} className="text-[10px] font-bold text-primary">OK</button>
                                                            <button onClick={() => setEditingNote(null)} className="text-[var(--text-muted)]"><X size={12} /></button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => { setEditingNote(date); setEventNoteInput(entry?.eventNote || ''); }}
                                                            className="text-[10px] text-[var(--text-muted)] text-left hover:text-primary"
                                                        >
                                                            {entry?.eventNote || '+ Añadir nota'}
                                                        </button>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => setSelectedDate(date)}
                                                    className="ml-auto text-xs font-bold text-primary border border-primary/30 px-3 py-1.5 rounded-full hover:bg-primary/5 flex-shrink-0"
                                                >
                                                    {t('assign')}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* ---- DAILY VIEW ---- */}
            {viewMode === 'daily' && (
                <div>
                    <div className="flex items-center justify-between mb-6">
                        <button onClick={() => navigateDaily(-1)} className="p-1 text-[var(--text-muted)] hover:text-primary">
                            <ChevronLeft size={20} />
                        </button>
                        <div className="flex items-center space-x-2 text-[var(--text-secondary)] text-sm font-medium bg-[var(--bg-card)] px-3 py-1.5 rounded-full border border-[var(--border-light)]">
                            <CalendarIcon size={14} />
                            <span className="capitalize">
                                {new Date(effectiveDailyDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                            </span>
                        </div>
                        <button onClick={() => navigateDaily(1)} className="p-1 text-[var(--text-muted)] hover:text-primary">
                            <ChevronRight size={20} />
                        </button>
                        {effectiveDailyDate !== todayStr && (
                            <button onClick={() => setDailyViewDate(todayStr)} className="ml-2 text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-full">
                                {t('today')}
                            </button>
                        )}
                    </div>

                    <div className={`bg-[var(--bg-card)] rounded-2xl p-4 shadow-sm border min-h-[8rem] transition-all ${effectiveDailyDate === todayStr ? 'border-primary/30 shadow-md' : 'border-[var(--border-light)]'}`}>
                        {dailyLook ? (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center space-x-4">
                                    {(dailyLook && getLookImage(dailyLook)) ? (
                                        <img src={getLookImage(dailyLook)!} className="w-20 h-20 rounded-xl object-cover" alt={dailyLook.name} />
                                    ) : (
                                        <div className="w-20 h-20 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                            <Shirt size={32} />
                                        </div>
                                    )}
                                    <div>
                                        <h3 className="font-bold text-[var(--text-primary)] text-lg">{dailyLook!.name}</h3>
                                        {dailyLook!.garments && dailyLook!.garments.filter(g => !!g).length > 0 && (
                                            <p className="text-xs text-[var(--text-muted)] mt-0.5">{dailyLook!.garments.filter(g => !!g).length} prendas</p>
                                        )}
                                        {dailyEntry?.eventNote && (
                                            <span className="text-xs text-accent font-medium bg-orange-50 px-2 py-0.5 rounded-md mt-2 inline-block">
                                                {dailyEntry.eventNote}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={() => setSelectedDate(effectiveDailyDate)}
                                        className="text-xs font-bold text-primary border border-primary/30 px-3 py-1.5 rounded-full hover:bg-primary/5"
                                    >
                                        Cambiar look
                                    </button>
                                    <button onClick={() => handleClearLook(effectiveDailyDate)} className="text-gray-300 hover:text-red-400 p-1.5">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-8">
                                <div className="w-20 h-20 rounded-xl border-2 border-dashed border-[var(--border-light)] flex items-center justify-center bg-gray-50 mb-4">
                                    <Plus size={28} className="text-[var(--text-muted)]" />
                                </div>
                                <span className="text-base font-medium text-[var(--text-muted)] mb-4">Sin planificar</span>
                                <button
                                    onClick={() => setSelectedDate(effectiveDailyDate)}
                                    className="text-xs font-bold text-primary border border-primary/30 px-4 py-2 rounded-full hover:bg-primary/5"
                                >
                                    {t('assign')}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Event note in daily view */}
                    <div className="mt-4 bg-[var(--bg-card)] rounded-2xl p-4 shadow-sm border border-[var(--border-light)]">
                        <h4 className="text-sm font-bold text-[var(--text-primary)] mb-3">Nota del evento</h4>
                        {editingNote === effectiveDailyDate ? (
                            <div className="flex items-center space-x-2">
                                <input
                                    type="text"
                                    value={eventNoteInput}
                                    onChange={e => setEventNoteInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSaveNote(effectiveDailyDate)}
                                    className="text-sm border border-[var(--border-light)] rounded-lg px-3 py-2 flex-1 outline-none focus:border-primary"
                                    placeholder="Nota del evento..."
                                    autoFocus
                                />
                                <button onClick={() => handleSaveNote(effectiveDailyDate)} className="text-xs font-bold text-primary bg-primary/10 px-3 py-2 rounded-lg">OK</button>
                                <button onClick={() => setEditingNote(null)} className="text-[var(--text-muted)]"><X size={16} /></button>
                            </div>
                        ) : (
                            <button
                                onClick={() => { setEditingNote(effectiveDailyDate); setEventNoteInput(dailyEntry?.eventNote || ''); }}
                                className="w-full text-sm text-[var(--text-muted)] text-left hover:text-primary py-2 px-3 rounded-lg border border-dashed border-[var(--border-light)] hover:border-primary/30"
                            >
                                {dailyEntry?.eventNote || '+ Añadir nota del evento'}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Selection Modal */}
            {selectedDate && (
                <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center">
                    <div className="bg-[var(--bg-card)] w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-fade-in-up h-[70vh] flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-[var(--text-primary)]">{t('edit')} Look</h3>
                                <p className="text-xs text-[var(--text-secondary)]">Para el {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                            </div>
                            <button onClick={() => setSelectedDate(null)}><X size={24} className="text-[var(--text-muted)]" /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3 no-scrollbar">
                            {looks.length === 0 ? (
                                <p className="text-center text-[var(--text-muted)] mt-10">No tienes looks guardados aún.</p>
                            ) : (
                                looks.map(look => {
                                    const lookImg = getLookImage(look);
                                    return (
                                        <button
                                            key={look.id}
                                            onClick={() => handleAssign(look.id)}
                                            className="w-full flex items-center space-x-4 p-3 rounded-2xl border border-[var(--border-light)] hover:border-primary hover:bg-primary/5 transition-all text-left"
                                        >
                                            {lookImg ? (
                                                <img src={lookImg} className="w-14 h-14 rounded-lg object-cover" alt={look.name} />
                                            ) : (
                                                <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center text-[var(--text-muted)]">
                                                    <Shirt size={20} />
                                                </div>
                                            )}
                                            <div>
                                                <p className="font-bold text-[var(--text-primary)]">{look.name}</p>
                                                <p className="text-xs text-[var(--text-secondary)]">
                                                    {look.garments ? `${look.garments.length} prendas` : look.tags?.join(', ') || 'Look personalizado'}
                                                </p>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Planner;
