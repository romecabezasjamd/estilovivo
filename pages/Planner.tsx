
import React, { useState, useMemo } from 'react';
import { Look, PlannerEntry } from '../types';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, MoreVertical, Plus, X, Shirt, Trash2 } from 'lucide-react';
import { useLanguage } from '../src/context/LanguageContext';

interface PlannerProps {
    looks: Look[];
    plannerEntries: PlannerEntry[];
    onUpdateEntry: (entry: PlannerEntry) => void;
}

const Planner: React.FC<PlannerProps> = ({ looks, plannerEntries, onUpdateEntry }) => {
    const { t } = useLanguage();
    const [weekOffset, setWeekOffset] = useState(0);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [eventNoteInput, setEventNoteInput] = useState('');
    const [editingNote, setEditingNote] = useState<string | null>(null);

    const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    // Generate dynamic dates for the current week offset
    const weekDates = useMemo(() => {
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0=Sun
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

        return Array.from({ length: 7 }).map((_, i) => {
            const d = new Date(today);
            d.setDate(today.getDate() + mondayOffset + i + (weekOffset * 7));
            return d.toISOString().split('T')[0];
        });
    }, [weekOffset]);

    const todayStr = new Date().toISOString().split('T')[0];

    // Month/year label for header
    const headerLabel = useMemo(() => {
        const first = new Date(weekDates[0]);
        const last = new Date(weekDates[6]);
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        if (first.getMonth() === last.getMonth()) {
            return `${months[first.getMonth()]} ${first.getFullYear()}`;
        }
        return `${months[first.getMonth()].slice(0, 3)} - ${months[last.getMonth()].slice(0, 3)} ${last.getFullYear()}`;
    }, [weekDates]);

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

    return (
        <div className="p-6 pb-24 relative h-full">
            <header className="flex justify-between items-center mb-8 mt-4">
                <h1 className="text-2xl font-bold text-gray-800">{t('planner')}</h1>
                <div className="flex items-center space-x-2">
                    <button onClick={() => setWeekOffset(w => w - 1)} className="p-1 text-gray-400 hover:text-primary">
                        <ChevronLeft size={20} />
                    </button>
                    <div className="flex items-center space-x-2 text-gray-600 text-sm font-medium bg-white px-3 py-1.5 rounded-full border border-gray-200">
                        <CalendarIcon size={14} />
                        <span>{headerLabel}</span>
                    </div>
                    <button onClick={() => setWeekOffset(w => w + 1)} className="p-1 text-gray-400 hover:text-primary">
                        <ChevronRight size={20} />
                    </button>
                    {weekOffset !== 0 && (
                        <button onClick={() => setWeekOffset(0)} className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-full">
                            {t('today')}
                        </button>
                    )}
                </div>
            </header>

            <div className="space-y-4">
                {weekDates.map((date, idx) => {
                    const entry = getEntry(date);
                    const look = entry ? getLook(entry.lookId) : null;
                    const dayNum = date.split('-')[2];
                    const isToday = date === todayStr;
                    const isPast = date < todayStr;
                    const lookImg = getLookImage(look || undefined);

                    return (
                        <div key={date} className="flex group">
                            {/* Date Col */}
                            <div className="flex flex-col items-center mr-4 w-12 pt-2">
                                <span className={`text-xs font-semibold uppercase ${isToday ? 'text-primary' : 'text-gray-400'}`}>{weekDays[idx]}</span>
                                <span className={`text-lg font-bold ${isToday ? 'text-white bg-primary w-8 h-8 rounded-full flex items-center justify-center' : isPast ? 'text-gray-400' : 'text-gray-800'}`}>
                                    {dayNum}
                                </span>
                                {idx !== 6 && <div className="w-px h-full bg-gray-200 my-2" />}
                            </div>

                            {/* Card */}
                            <div className={`flex-1 bg-white rounded-2xl p-3 shadow-sm border min-h-[5rem] transition-all ${isToday ? 'border-primary/30 shadow-md' : 'border-gray-100'}`}>
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
                                                <h4 className="font-bold text-gray-800 text-sm">{look.name}</h4>
                                                {look.garments && look.garments.length > 0 && (
                                                    <p className="text-[10px] text-gray-400">{look.garments.length} prendas</p>
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
                                            <button onClick={() => setSelectedDate(date)} className="text-gray-300 hover:text-gray-500 p-1">
                                                <MoreVertical size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center space-x-4 w-full">
                                        <div className="w-14 h-14 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50 flex-shrink-0">
                                            <Plus size={20} className="text-gray-400" />
                                        </div>
                                        <div className="flex flex-col flex-1">
                                            <span className="text-sm font-medium text-gray-400">Sin planificar</span>
                                            {editingNote === date ? (
                                                <div className="flex items-center space-x-1 mt-1">
                                                    <input
                                                        type="text"
                                                        value={eventNoteInput}
                                                        onChange={e => setEventNoteInput(e.target.value)}
                                                        onKeyDown={e => e.key === 'Enter' && handleSaveNote(date)}
                                                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 flex-1 outline-none focus:border-primary"
                                                        placeholder="Nota del evento..."
                                                        autoFocus
                                                    />
                                                    <button onClick={() => handleSaveNote(date)} className="text-[10px] font-bold text-primary">OK</button>
                                                    <button onClick={() => setEditingNote(null)} className="text-gray-400"><X size={12} /></button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => { setEditingNote(date); setEventNoteInput(entry?.eventNote || ''); }}
                                                    className="text-[10px] text-gray-400 text-left hover:text-primary"
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

            {/* Selection Modal */}
            {selectedDate && (
                <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center">
                    <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-fade-in-up h-[70vh] flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800">{t('edit')} Look</h3>
                                <p className="text-xs text-gray-500">Para el {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                            </div>
                            <button onClick={() => setSelectedDate(null)}><X size={24} className="text-gray-400" /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3 no-scrollbar">
                            {looks.length === 0 ? (
                                <p className="text-center text-gray-400 mt-10">No tienes looks guardados aún.</p>
                            ) : (
                                looks.map(look => {
                                    const lookImg = getLookImage(look);
                                    return (
                                        <button
                                            key={look.id}
                                            onClick={() => handleAssign(look.id)}
                                            className="w-full flex items-center space-x-4 p-3 rounded-2xl border border-gray-100 hover:border-primary hover:bg-primary/5 transition-all text-left"
                                        >
                                            {lookImg ? (
                                                <img src={lookImg} className="w-14 h-14 rounded-lg object-cover" alt={look.name} />
                                            ) : (
                                                <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                                                    <Shirt size={20} />
                                                </div>
                                            )}
                                            <div>
                                                <p className="font-bold text-gray-800">{look.name}</p>
                                                <p className="text-xs text-gray-500">
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
