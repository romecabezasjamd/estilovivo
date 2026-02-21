
import React, { useEffect, useState } from 'react';
import { Calendar, CloudSun, CheckSquare, Plus, ArrowRight, Trash2, MapPin, ArrowLeft, X, Shirt } from 'lucide-react';
import { Garment, Trip, TripItem } from '../types';
import DateRangePicker from '../components/DateRangePicker';
import { useLanguage } from '../src/context/LanguageContext';

interface SuitcaseProps {
    trips: Trip[];
    garments: Garment[];
    onAddTrip: (trip: Trip) => void;
    onDeleteTrip: (id: string) => void;
    onUpdateTrip: (trip: Trip) => void;
    isEmbedded?: boolean;
}

const Suitcase: React.FC<SuitcaseProps> = ({ trips, garments, onAddTrip, onDeleteTrip, onUpdateTrip, isEmbedded = false }) => {
    const { t } = useLanguage();
    // Navigation State
    const [activeTripId, setActiveTripId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    // Form State for New Trip
    const [newTripForm, setNewTripForm] = useState({
        destination: '',
        dateStart: '' as string,
        dateEnd: '' as string,
        garmentIds: [] as string[]
    });

    // Input States
    const [newItemText, setNewItemText] = useState('');
    const [isAddingItem, setIsAddingItem] = useState(false);
    const [isEditingGarments, setIsEditingGarments] = useState(false);
    const [editedGarmentIds, setEditedGarmentIds] = useState<string[]>([]);

    // --- DERIVED STATE ---
    const activeTrip = trips.find(t => t.id === activeTripId);

    useEffect(() => {
        if (activeTrip) {
            setEditedGarmentIds(activeTrip.garments?.filter(g => !!g).map(g => g.id) || []);
        } else {
            setEditedGarmentIds([]);
        }
        setIsEditingGarments(false);
    }, [activeTripId, activeTrip]);

    // --- HANDLERS ---
    const handleCreateTrip = () => {
        if (!newTripForm.destination || !newTripForm.dateStart) return;

        const formatDateStr = (isoStr: string) => {
            const date = new Date(isoStr + 'T12:00:00');
            const formatter = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });
            return formatter.format(date);
        };

        const selectedGarments = garments.filter(g => newTripForm.garmentIds.includes(g.id));

        const newTrip: Trip = {
            id: `t-${Date.now()}`,
            destination: newTripForm.destination,
            dateStart: formatDateStr(newTripForm.dateStart),
            dateEnd: newTripForm.dateEnd ? formatDateStr(newTripForm.dateEnd) : formatDateStr(newTripForm.dateStart),
            items: [
                { id: `i-${Date.now()}-1`, label: 'Documentación', checked: false, isEssential: true },
                { id: `i-${Date.now()}-2`, label: 'Neceser básico', checked: false, isEssential: true },
            ],
            garments: selectedGarments
        };

        onAddTrip(newTrip);
        setNewTripForm({ destination: '', dateStart: '', dateEnd: '', garmentIds: [] });
        setIsCreating(false);
        setActiveTripId(newTrip.id);
    };

    const handleDeleteTrip = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        onDeleteTrip(id);
        if (activeTripId === id) setActiveTripId(null);
    };

    const toggleCheck = (itemId: string) => {
        if (!activeTrip) return;
        const updatedTrip = {
            ...activeTrip,
            items: activeTrip.items.map(i => i.id === itemId ? { ...i, checked: !i.checked } : i)
        };
        onUpdateTrip(updatedTrip);
    };

    const addItemToTrip = () => {
        if (!newItemText.trim() || !activeTrip) return;
        const newItem: TripItem = {
            id: `i-${Date.now()}`,
            label: newItemText,
            checked: false,
            isEssential: false
        };

        onUpdateTrip({
            ...activeTrip,
            items: [...activeTrip.items, newItem]
        });

        setNewItemText('');
        setIsAddingItem(false);
    };

    const toggleNewTripGarment = (garmentId: string) => {
        setNewTripForm((prev) => ({
            ...prev,
            garmentIds: prev.garmentIds.includes(garmentId)
                ? prev.garmentIds.filter(id => id !== garmentId)
                : [...prev.garmentIds, garmentId]
        }));
    };

    const toggleEditGarment = (garmentId: string) => {
        setEditedGarmentIds((prev) => (
            prev.includes(garmentId)
                ? prev.filter(id => id !== garmentId)
                : [...prev, garmentId]
        ));
    };

    const handleSaveGarments = () => {
        if (!activeTrip) return;
        const selected = garments.filter(g => editedGarmentIds.includes(g.id));
        onUpdateTrip({ ...activeTrip, garments: selected });
        setIsEditingGarments(false);
    };

    const progress = activeTrip
        ? Math.round((activeTrip.items.filter(i => i.checked).length / activeTrip.items.length) * 100) || 0
        : 0;

    // --- RENDER VIEW: LIST OF TRIPS ---
    if (!activeTrip && !isCreating) {
        return (
            <div className={`h-full flex flex-col ${isEmbedded ? 'px-6 bg-transparent' : 'p-6 pb-24 bg-blue-50/50'}`}>
                <header className={`flex justify-between items-end mb-6 ${isEmbedded ? 'mt-2' : 'mt-4'}`}>
                    <div>
                        <h1 className={`${isEmbedded ? 'text-xl' : 'text-2xl'} font-bold text-gray-800`}>{t('myTrips')}</h1>
                        <p className="text-gray-500 text-sm">{trips.length} {t('plannedAdventures')}</p>
                    </div>
                    <button
                        onClick={() => setIsCreating(true)}
                        className="bg-primary text-white p-2 rounded-xl shadow-lg shadow-primary/30"
                    >
                        <Plus size={isEmbedded ? 20 : 24} />
                    </button>
                </header>

                <div className="space-y-4 overflow-y-auto no-scrollbar pb-20 flex-1">
                    {trips.map(trip => {
                        const tripProgress = Math.round((trip.items.filter(i => i.checked).length / trip.items.length) * 100) || 0;
                        return (
                            <div
                                key={trip.id}
                                onClick={() => setActiveTripId(trip.id)}
                                className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />

                                <div className="relative z-10 flex justify-between items-start">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-800 mb-1">{trip.destination}</h3>
                                        <div className="flex items-center text-gray-400 text-xs font-medium">
                                            <Calendar size={12} className="mr-1" />
                                            <span>{trip.dateStart} - {trip.dateEnd}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => handleDeleteTrip(e, trip.id)}
                                        className="text-gray-300 hover:text-red-400 p-1"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                <div className="mt-4">
                                    <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                                        <span>Progreso</span>
                                        <span>{tripProgress}%</span>
                                    </div>
                                    <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                        <div className="h-full bg-primary rounded-full" style={{ width: `${tripProgress}%` }} />
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {trips.length === 0 && (
                        <div className="text-center py-10 opacity-60">
                            <MapPin size={48} className="mx-auto text-gray-300 mb-2" />
                            <p className="text-gray-500">No tienes viajes creados.</p>
                            <button onClick={() => setIsCreating(true)} className="text-primary font-bold mt-2">Crear uno ahora</button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (isCreating) {
        return (
            <div className={`h-full flex flex-col ${isEmbedded ? 'px-6' : 'bg-white'}`}>
                <div className="flex items-center mb-4 mt-4 px-6">
                    <button onClick={() => setIsCreating(false)} className="mr-4 text-gray-500 hover:bg-gray-100 p-1 rounded-full">
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-xl font-bold text-gray-800">Nuevo Viaje</h1>
                </div>

                <div className="space-y-4 overflow-y-auto flex-1 px-6 pb-4" style={{ scrollbarWidth: 'thin' }}>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Destino</label>
                        <input
                            type="text"
                            className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 text-lg font-medium outline-none focus:border-primary"
                            placeholder="Ej: París, Playa..."
                            value={newTripForm.destination}
                            onChange={e => setNewTripForm({ ...newTripForm, destination: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Fechas del Viaje</label>
                        <DateRangePicker
                            startDate={newTripForm.dateStart}
                            endDate={newTripForm.dateEnd}
                            onStartDateChange={(date) => setNewTripForm({ ...newTripForm, dateStart: date })}
                            onEndDateChange={(date) => setNewTripForm({ ...newTripForm, dateEnd: date })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Prendas para el viaje</label>
                        {garments.length === 0 ? (
                            <div className="text-sm text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-2xl p-4">
                                Añade prendas en tu armario para seleccionarlas aquí.
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-3">
                                {garments.map(garment => {
                                    const isSelected = newTripForm.garmentIds.includes(garment.id);
                                    return (
                                        <button
                                            key={garment.id}
                                            type="button"
                                            onClick={() => toggleNewTripGarment(garment.id)}
                                            className={`text-left rounded-2xl border p-2 transition-all ${isSelected ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-gray-200 bg-white'}`}
                                        >
                                            <div className="aspect-[4/3] rounded-xl overflow-hidden bg-gray-100 mb-2 relative">
                                                <img src={garment.imageUrl} alt={garment.name} className="w-full h-full object-cover" />
                                                {isSelected && (
                                                    <div className="absolute top-1.5 right-1.5 bg-primary text-white rounded-full p-0.5">
                                                        <CheckSquare size={14} />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-sm font-semibold text-gray-800 truncate">{garment.name}</div>
                                            <div className="text-xs text-gray-400 truncate">{garment.type}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex-shrink-0 px-6 pb-24 pt-3 bg-white border-t border-gray-100">
                    <button
                        disabled={!newTripForm.destination || !newTripForm.dateStart}
                        onClick={handleCreateTrip}
                        className="w-full bg-primary disabled:bg-gray-300 text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary/30 transition-colors"
                    >
                        Crear Maleta
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={`h-full flex flex-col ${isEmbedded ? 'px-6 bg-transparent' : 'p-6 bg-blue-50/50'}`}>
            <header className={`flex justify-between items-end mb-6 flex-shrink-0 ${isEmbedded ? 'mt-2' : 'mt-4'}`}>
                <div className="flex items-center">
                    <button onClick={() => setActiveTripId(null)} className="mr-3 bg-white p-1.5 rounded-full text-gray-500 shadow-sm border border-gray-100">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-gray-800">{t('suitcase')}</h1>
                        <p className="text-gray-500 text-xs">Preparando viaje</p>
                    </div>
                </div>
            </header>

            {activeTrip && (
                <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
                    <div className="bg-white rounded-3xl p-6 shadow-xl shadow-blue-900/5 relative overflow-hidden mb-6 transition-all border border-blue-50">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-50 rounded-full -mr-8 -mt-8" />
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-md mb-2 inline-block uppercase">{t('nextTrip')}</span>
                                    <h2 className="text-3xl font-bold text-primary">{activeTrip.destination}</h2>
                                    <div className="flex items-center text-gray-400 text-sm mt-1">
                                        <Calendar size={14} className="mr-1" />
                                        <span>{activeTrip.dateStart} - {activeTrip.dateEnd}</span>
                                    </div>
                                </div>
                                <div className="flex flex-col items-center bg-gray-50 p-2 rounded-xl border border-gray-100">
                                    <CloudSun size={24} className="text-yellow-500 mb-1" />
                                    <span className="text-xs font-bold text-gray-600">--°C</span>
                                </div>
                            </div>
                            <div className="mb-4">
                                <div className="flex justify-between text-xs font-medium mb-1">
                                    <span className="text-gray-500">Maleta llena</span>
                                    <span className="text-primary">{progress}%</span>
                                </div>
                                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                    <div className="h-full bg-primary rounded-full transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-gray-800 flex items-center">
                                <CheckSquare size={18} className="mr-2 text-primary" />
                                {t('essentials')}
                            </h3>
                            <button
                                onClick={() => setIsAddingItem(!isAddingItem)}
                                className={`text-primary p-1 rounded-full transition-colors ${isAddingItem ? 'bg-primary text-white' : 'bg-primary/10'}`}
                            >
                                {isAddingItem ? <X size={16} /> : <Plus size={16} />}
                            </button>
                        </div>

                        {isAddingItem && (
                            <div className="flex mb-4 gap-2">
                                <input
                                    autoFocus
                                    type="text"
                                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-primary"
                                    placeholder="Nuevo item..."
                                    value={newItemText}
                                    onChange={(e) => setNewItemText(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && addItemToTrip()}
                                />
                                <button onClick={addItemToTrip} className="text-xs font-bold bg-primary text-white px-3 rounded-lg">OK</button>
                            </div>
                        )}

                        <div className="pr-1">
                            <ul className="space-y-3">
                                {activeTrip.items.map((item) => (
                                    <li key={item.id} className="flex items-center group cursor-pointer" onClick={() => toggleCheck(item.id)}>
                                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center mr-3 transition-colors ${item.checked ? 'bg-primary border-primary text-white' : 'border-gray-300'}`}>
                                            {item.checked && <span className="text-xs">✓</span>}
                                        </div>
                                        <span className={`flex-1 transition-colors ${item.checked ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                                            {item.label}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Suitcase;