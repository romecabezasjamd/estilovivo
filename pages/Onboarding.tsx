import React, { useState } from 'react';
import { ChevronRight, ChevronLeft, Shirt, Camera, Users, Sparkles } from 'lucide-react';
import StyleQuiz from '../components/StyleQuiz';

interface Props {
  onComplete: () => void;
}

const STEPS = [
  {
    icon: <Shirt size={48} className="text-primary" />,
    title: 'Tu armario digital',
    description: 'Organiza todas tus prendas en un solo lugar. Sube fotos y clasifica tu ropa por categorías.',
  },
  {
    icon: <Camera size={48} className="text-primary" />,
    title: 'Probador virtual',
    description: 'Prueba prendas virtuales en tu cuerpo usando inteligencia artificial. Sin necesidad de probarte la ropa.',
  },
  {
    icon: <Users size={48} className="text-primary" />,
    title: 'Comunidad de estilo',
    description: 'Comparte tus looks favoritos, sigue a otras personas y descubre inspiración de moda.',
  },
  {
    icon: <Sparkles size={48} className="text-primary" />,
    title: 'Organiza tu semana',
    description: 'Planifica tu outfit día por día. Nunca más perderás tiempo decidiendo qué ponerte.',
  },
];

export default function Onboarding({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [showQuiz, setShowQuiz] = useState(false);
  const current = STEPS[step];

  if (showQuiz) {
    return <StyleQuiz onComplete={() => onComplete()} onSkip={() => onComplete()} />;
  }

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[var(--bg-base)]">
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center mb-8">
          {current.icon}
        </div>
        <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
          {current.title}
        </h2>
        <p className="text-sm leading-relaxed max-w-xs" style={{ color: 'var(--text-secondary)' }}>
          {current.description}
        </p>
      </div>

      <div className="px-8 pb-8">
        <div className="flex justify-center gap-2 mb-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === step ? 24 : 8,
                backgroundColor: i === step ? 'var(--color-primary)' : 'var(--border-light)',
              }}
            />
          ))}
        </div>

        <div className="flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="py-4 px-5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-secondary)',
              }}
            >
              <ChevronLeft size={18} />
              Atrás
            </button>
          )}

          <button
            onClick={() => {
              if (step < STEPS.length - 1) {
                setStep(step + 1);
              } else {
                setShowQuiz(true);
              }
            }}
            className="flex-1 py-4 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {step < STEPS.length - 1 ? (
              <>
                Siguiente
                <ChevronRight size={18} />
              </>
            ) : (
              'Personalizar estilo'
            )}
          </button>
        </div>

        {step < STEPS.length - 1 && (
          <button
            onClick={() => setShowQuiz(true)}
            className="w-full py-3 text-xs font-medium mt-2"
            style={{ color: 'var(--text-muted)' }}
          >
            Saltar
          </button>
        )}
      </div>
    </div>
  );
}
