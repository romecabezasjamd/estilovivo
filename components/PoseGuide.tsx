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
          <circle cx="45" cy="14" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.45" />
          <line x1="45" y1="21.5" x2="45" y2="58" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.45" />
          <line x1="45" y1="32" x2="24" y2="46" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.4" />
          <line x1="45" y1="32" x2="66" y2="46" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.4" />
          <line x1="45" y1="58" x2="34" y2="88" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.4" />
          <line x1="45" y1="58" x2="56" y2="88" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.4" />
          <line x1="34" y1="88" x2="30" y2="116" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.35" />
          <line x1="56" y1="88" x2="60" y2="116" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.35" />
        </PoseSvg>

        <PoseSvg label="Postura recta" desc="Espalda erguida, hombros alineados" active>
          <circle cx="45" cy="14" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.45" />
          <line x1="45" y1="21.5" x2="45" y2="60" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.45" />
          <line x1="45" y1="32" x2="26" y2="44" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.4" />
          <line x1="45" y1="32" x2="64" y2="44" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.4" />
          <line x1="45" y1="60" x2="36" y2="90" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.4" />
          <line x1="45" y1="60" x2="54" y2="90" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.4" />
          <line x1="36" y1="90" x2="32" y2="116" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.35" />
          <line x1="54" y1="90" x2="58" y2="116" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.35" />
          <line x1="41" y1="32" x2="49" y2="32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.2" />
        </PoseSvg>

        <PoseSvg label="Brazos relajados" desc="Brazos ligeramente abiertos" active>
          <circle cx="45" cy="14" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.45" />
          <line x1="45" y1="21.5" x2="45" y2="58" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.45" />
          <path d="M45 32 Q30 40 20 50" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.4" />
          <path d="M45 32 Q60 40 70 50" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.4" />
          <line x1="45" y1="58" x2="36" y2="88" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.4" />
          <line x1="45" y1="58" x2="54" y2="88" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.4" />
          <line x1="36" y1="88" x2="32" y2="116" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.35" />
          <line x1="54" y1="88" x2="58" y2="116" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.35" />
          <circle cx="20" cy="50" r="2.5" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.2" />
          <circle cx="70" cy="50" r="2.5" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.2" />
        </PoseSvg>

        <PoseSvg label="Buena iluminación" desc="Luz frontal y uniforme" active>
          <defs>
            <radialGradient id="pgSun" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="14" cy="14" r="18" fill="url(#pgSun)" />
          <circle cx="14" cy="14" r="6" fill="none" stroke="#fbbf24" strokeWidth="0.8" opacity="0.4" />
          <line x1="14" y1="4" x2="14" y2="7" stroke="#fbbf24" strokeWidth="0.6" strokeLinecap="round" opacity="0.3" />
          <line x1="14" y1="21" x2="14" y2="24" stroke="#fbbf24" strokeWidth="0.6" strokeLinecap="round" opacity="0.3" />
          <line x1="4" y1="14" x2="7" y2="14" stroke="#fbbf24" strokeWidth="0.6" strokeLinecap="round" opacity="0.3" />
          <line x1="21" y1="14" x2="24" y2="14" stroke="#fbbf24" strokeWidth="0.6" strokeLinecap="round" opacity="0.3" />
          <circle cx="45" cy="14" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.45" />
          <line x1="45" y1="21.5" x2="45" y2="58" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.45" />
          <line x1="45" y1="32" x2="26" y2="44" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.4" />
          <line x1="45" y1="32" x2="64" y2="44" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.4" />
          <line x1="45" y1="58" x2="36" y2="88" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.4" />
          <line x1="45" y1="58" x2="54" y2="88" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.4" />
          <line x1="36" y1="88" x2="32" y2="116" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.35" />
          <line x1="54" y1="88" x2="58" y2="116" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.35" />
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
