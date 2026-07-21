import React, { useState } from 'react';
import { ChevronRight, Check, Sparkles, MapPin } from 'lucide-react';
import { api } from '../services/api';

interface Props {
  onComplete: (preferences: StylePreferences) => void;
  onSkip: () => void;
}

export interface StylePreferences {
  styleColors: string[];
  styleStyles: string[];
  styleOccasions: string[];
  locationName: string;
}

const COLORS = [
  { id: 'black', label: 'Negro', hex: '#000000' },
  { id: 'white', label: 'Blanco', hex: '#FFFFFF' },
  { id: 'blue', label: 'Azul', hex: '#3B82F6' },
  { id: 'red', label: 'Rojo', hex: '#EF4444' },
  { id: 'green', label: 'Verde', hex: '#22C55E' },
  { id: 'pink', label: 'Rosa', hex: '#EC4899' },
  { id: 'brown', label: 'Marrón', hex: '#92400E' },
  { id: 'gray', label: 'Gris', hex: '#6B7280' },
  { id: 'beige', label: 'Beige', hex: '#D4A574' },
  { id: 'purple', label: 'Morado', hex: '#8B5CF6' },
];

const STYLES = [
  { id: 'casual', label: 'Casual', icon: '👕' },
  { id: 'elegant', label: 'Elegante', icon: '✨' },
  { id: 'sporty', label: 'Deportivo', icon: '👟' },
  { id: 'bohemian', label: 'Bohemio', icon: '🌸' },
  { id: 'minimalist', label: 'Minimalista', icon: '◻️' },
  { id: 'classic', label: 'Clásico', icon: '👔' },
  { id: 'streetwear', label: 'Streetwear', icon: '🧢' },
  { id: 'romantic', label: 'Romántico', icon: '💖' },
];

const OCCASIONS = [
  { id: 'work', label: 'Trabajo', icon: '💼' },
  { id: 'casual', label: 'Casual', icon: '☕' },
  { id: 'party', label: 'Fiesta', icon: '🎉' },
  { id: 'sport', label: 'Deporte', icon: '⚽' },
  { id: 'date', label: 'Cita', icon: '💕' },
  { id: 'travel', label: 'Viaje', icon: '✈️' },
];

const STEPS = [
  { title: '¿Qué colores prefieres?', subtitle: 'Elige tus favoritos (máx. 5)', key: 'colors' as const },
  { title: '¿Cuál es tu estilo?', subtitle: 'Elige los que más te gusten', key: 'styles' as const },
  { title: '¿Para qué ocasiones?', subtitle: '¿Dónde usarás tu ropa?', key: 'occasions' as const },
  { title: '¿De dónde eres?', subtitle: 'Para mostrarte el tiempo local', key: 'location' as const },
];

export default function StyleQuiz({ onComplete, onSkip }: Props) {
  const [step, setStep] = useState(0);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>([]);
  const [locationName, setLocationName] = useState('');

  const toggle = (arr: string[], set: (v: string[]) => void, id: string, max: number = 5) => {
    if (arr.includes(id)) {
      set(arr.filter(i => i !== id));
    } else if (arr.length < max) {
      set([...arr, id]);
    }
  };

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const canNext =
    (step === 0 && selectedColors.length > 0) ||
    (step === 1 && selectedStyles.length > 0) ||
    (step === 2 && selectedOccasions.length > 0) ||
    (step === 3 && true);

  const handleComplete = () => {
    const prefs: StylePreferences = {
      styleColors: selectedColors,
      styleStyles: selectedStyles,
      styleOccasions: selectedOccasions,
      locationName,
    };
    api.updateUserPreferences(prefs as unknown as Record<string, unknown>).catch(() => {});
    onComplete(prefs);
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[var(--bg-base)]">
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-light)' }}>
        <button onClick={onSkip} className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Saltar</button>
        <div className="flex gap-1">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === step ? 20 : 6,
                backgroundColor: i <= step ? 'var(--color-primary)' : 'var(--border-light)',
              }}
            />
          ))}
        </div>
        <div className="w-10" />
      </div>

      <div className="flex-1 px-4 py-6 overflow-y-auto">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            {step === 3 ? (
              <MapPin size={24} style={{ color: 'var(--color-primary)' }} />
            ) : (
              <Sparkles size={24} style={{ color: 'var(--color-primary)' }} />
            )}
          </div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{current.title}</h2>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{current.subtitle}</p>
        </div>

        {step === 0 && (
          <div className="grid grid-cols-5 gap-3">
            {COLORS.map(c => (
              <button
                key={c.id}
                onClick={() => toggle(selectedColors, setSelectedColors, c.id)}
                className="flex flex-col items-center gap-1.5"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center relative"
                  style={{
                    backgroundColor: c.hex,
                    border: selectedColors.includes(c.id) ? '3px solid var(--color-primary)' : '2px solid var(--border-light)',
                    boxShadow: selectedColors.includes(c.id) ? '0 0 0 2px var(--color-primary)' : 'none',
                  }}
                >
                  {selectedColors.includes(c.id) && (
                    <Check size={16} className={c.id === 'white' ? 'text-gray-800' : 'text-white'} />
                  )}
                </div>
                <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{c.label}</span>
              </button>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="grid grid-cols-2 gap-3">
            {STYLES.map(s => (
              <button
                key={s.id}
                onClick={() => toggle(selectedStyles, setSelectedStyles, s.id, 3)}
                className="p-4 rounded-xl text-left flex items-center gap-3"
                style={{
                  backgroundColor: selectedStyles.includes(s.id) ? 'rgba(255,77,148,0.1)' : 'var(--bg-card)',
                  border: selectedStyles.includes(s.id) ? '2px solid var(--color-primary)' : '1px solid var(--border-light)',
                }}
              >
                <span className="text-2xl">{s.icon}</span>
                <div>
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{s.label}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-2 gap-3">
            {OCCASIONS.map(o => (
              <button
                key={o.id}
                onClick={() => toggle(selectedOccasions, setSelectedOccasions, o.id, 4)}
                className="p-4 rounded-xl text-left flex items-center gap-3"
                style={{
                  backgroundColor: selectedOccasions.includes(o.id) ? 'rgba(255,77,148,0.1)' : 'var(--bg-card)',
                  border: selectedOccasions.includes(o.id) ? '2px solid var(--color-primary)' : '1px solid var(--border-light)',
                }}
              >
                <span className="text-2xl">{o.icon}</span>
                <div>
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{o.label}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Ej: Madrid, Barcelona, México..."
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
            <p className="text-[10px] text-center" style={{ color: 'var(--text-muted)' }}>
              Esto nos ayuda a mostrarte el tiempo en tu zona. Puedes cambiarlo después en ajustes.
            </p>
          </div>
        )}
      </div>

      <div className="px-4 pb-6">
        <button
          onClick={() => {
            if (isLast) {
              handleComplete();
            } else {
              setStep(step + 1);
            }
          }}
          disabled={!canNext}
          className="w-full py-4 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          {isLast ? 'Completar' : 'Siguiente'}
          {!isLast && <ChevronRight size={18} />}
        </button>
      </div>
    </div>
  );
}
