import React from 'react'

interface PoseGuideProps {
  onStart: () => void
  compact?: boolean
}

function PoseSvg({ label, desc, active, children }: { label: string; desc: string; active?: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-colors ${active ? 'bg-primary/8 border border-primary/25' : ''}`}>
      <svg width="90" height="130" viewBox="0 0 90 130" className="text-[var(--text-secondary)]">
        {children}
      </svg>
      <span className="text-xs font-bold text-center text-[var(--text-primary)]">{label}</span>
      <span className="text-[10px] text-[var(--text-muted)] text-center leading-tight max-w-[80px]">{desc}</span>
    </div>
  )
}

export default function PoseGuide({ onStart, compact }: PoseGuideProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">¿Cómo posar?</h2>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Sigue estas recomendaciones para obtener el mejor resultado
        </p>
      </div>

      <div className={`grid ${compact ? 'grid-cols-2 gap-2' : 'grid-cols-2 gap-4'}`}>
        <PoseSvg label="De frente" desc="Mira directamente a la cámara" active>
          <circle cx="45" cy="14" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" opacity="0.5" />
          <line x1="45" y1="22" x2="45" y2="60" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          <line x1="45" y1="34" x2="22" y2="48" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />
          <line x1="45" y1="34" x2="68" y2="48" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />
          <line x1="45" y1="60" x2="32" y2="90" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />
          <line x1="45" y1="60" x2="58" y2="90" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />
          <line x1="32" y1="90" x2="28" y2="118" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.4" />
          <line x1="58" y1="90" x2="62" y2="118" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.4" />
          <circle cx="45" cy="14" r="3" fill="currentColor" opacity="0.15" />
        </PoseSvg>

        <PoseSvg label="Postura recta" desc="Espalda erguida, sin inclinarte" active>
          <circle cx="45" cy="14" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" opacity="0.5" />
          <line x1="45" y1="22" x2="45" y2="62" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          <line x1="45" y1="34" x2="24" y2="46" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />
          <line x1="45" y1="34" x2="66" y2="46" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />
          <line x1="45" y1="62" x2="34" y2="92" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />
          <line x1="45" y1="62" x2="56" y2="92" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />
          <line x1="34" y1="92" x2="30" y2="118" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.4" />
          <line x1="56" y1="92" x2="60" y2="118" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.4" />
          <line x1="42" y1="14" x2="48" y2="14" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.3" />
          <line x1="45" y1="11" x2="45" y2="17" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.3" />
        </PoseSvg>

        <PoseSvg label="Brazos relajados" desc="Brazos ligeramente separados del cuerpo" active>
          <circle cx="45" cy="14" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" opacity="0.5" />
          <line x1="45" y1="22" x2="45" y2="60" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          <path d="M45 34 Q28 42 18 52" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.45" />
          <path d="M45 34 Q62 42 72 52" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.45" />
          <line x1="45" y1="60" x2="34" y2="90" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />
          <line x1="45" y1="60" x2="56" y2="90" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />
          <line x1="34" y1="90" x2="30" y2="118" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.4" />
          <line x1="56" y1="90" x2="60" y2="118" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.4" />
          <circle cx="18" cy="52" r="3" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.25" />
          <circle cx="72" cy="52" r="3" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.25" />
        </PoseSvg>

        <PoseSvg label="Buena iluminación" desc="Luz frontal y uniforme, sin sombras" active>
          <defs>
            <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="14" cy="14" r="20" fill="url(#sunGlow)" />
          <circle cx="14" cy="14" r="7" fill="none" stroke="#fbbf24" strokeWidth="1" opacity="0.5" />
          <line x1="14" y1="3" x2="14" y2="6" stroke="#fbbf24" strokeWidth="0.8" strokeLinecap="round" opacity="0.4" />
          <line x1="14" y1="22" x2="14" y2="25" stroke="#fbbf24" strokeWidth="0.8" strokeLinecap="round" opacity="0.4" />
          <line x1="3" y1="14" x2="6" y2="14" stroke="#fbbf24" strokeWidth="0.8" strokeLinecap="round" opacity="0.4" />
          <line x1="22" y1="14" x2="25" y2="14" stroke="#fbbf24" strokeWidth="0.8" strokeLinecap="round" opacity="0.4" />
          <circle cx="45" cy="14" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" opacity="0.5" />
          <line x1="45" y1="22" x2="45" y2="60" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          <line x1="45" y1="34" x2="24" y2="46" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />
          <line x1="45" y1="34" x2="66" y2="46" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />
          <line x1="45" y1="60" x2="34" y2="90" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />
          <line x1="45" y1="60" x2="56" y2="90" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />
          <line x1="34" y1="90" x2="30" y2="118" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.4" />
          <line x1="56" y1="90" x2="60" y2="118" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.4" />
        </PoseSvg>
      </div>

      <div className="bg-amber-50/80 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-700/30 rounded-2xl p-4 flex items-start gap-3">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500 mt-0.5 flex-shrink-0">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <div>
          <p className="text-xs font-bold text-amber-800 dark:text-amber-200">Consejos</p>
          <ul className="text-[11px] text-amber-700 dark:text-amber-300 mt-1 space-y-1 list-disc list-inside">
            <li>Usa ropa ajustada para mejor detección</li>
            <li>Fondo claro y sin distracciones</li>
            <li>Foto de cuerpo completo, de pies a cabeza</li>
          </ul>
        </div>
      </div>

      {!compact && (
        <button
          onClick={onStart}
          className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-primary-dark active:scale-[0.98] transition-all shadow-lg shadow-primary/30"
        >
          Tomar foto
        </button>
      )}
    </div>
  )
}
