import React from 'react'

interface PoseGuideProps {
  onStart: () => void
  compact?: boolean
}

function PoseSvg({ label, desc, active, children }: { label: string; desc: string; active?: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-colors ${active ? 'bg-primary/8 border border-primary/25' : ''}`}>
      <svg width="90" height="130" viewBox="0 0 90 130" className="text-[var(--text-secondary)] dark:text-[var(--text-muted)]">
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
          <defs>
            <linearGradient id="skin1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f5cba7" />
              <stop offset="100%" stopColor="#e8b88a" />
            </linearGradient>
            <linearGradient id="hair1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5c4033" />
              <stop offset="100%" stopColor="#3d2b1f" />
            </linearGradient>
            <linearGradient id="shirt1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d4c5b0" />
              <stop offset="100%" stopColor="#c0b096" />
            </linearGradient>
          </defs>
          <ellipse cx="45" cy="16" rx="10" ry="11" fill="url(#skin1)" stroke="currentColor" strokeWidth="0.8" opacity="0.7" />
          <path d="M38 8 Q45 4 52 8 Q54 12 52 18 Q45 22 38 18 Q36 12 38 8Z" fill="url(#hair1)" opacity="0.85" />
          <ellipse cx="41" cy="14" rx="1.8" ry="1.5" fill="#4a3728" />
          <ellipse cx="49" cy="14" rx="1.8" ry="1.5" fill="#4a3728" />
          <path d="M43 18 Q45 20 47 18" fill="none" stroke="#c97b5a" strokeWidth="0.6" strokeLinecap="round" />
          <path d="M45 27 L45 55" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.5" />
          <path d="M45 33 Q28 38 20 44" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />
          <path d="M45 33 Q62 38 70 44" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />
          <path d="M45 55 L45 88" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.5" />
          <path d="M45 67 Q32 72 28 80" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.45" />
          <path d="M45 67 Q58 72 62 80" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.45" />
          <path d="M45 88 Q40 105 35 120" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.45" />
          <path d="M45 88 Q50 105 55 120" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.45" />
          <path d="M42 27 Q43 29 45 29 Q47 29 48 27" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
          <rect x="38" y="40" width="14" height="18" rx="4" fill="url(#shirt1)" opacity="0.6" />
        </PoseSvg>

        <PoseSvg label="Postura recta" desc="Espalda erguida, sin inclinarte" active>
          <defs>
            <linearGradient id="skin2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f5cba7" />
              <stop offset="100%" stopColor="#e8b88a" />
            </linearGradient>
            <linearGradient id="hair2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4a3728" />
              <stop offset="100%" stopColor="#2d1f14" />
            </linearGradient>
          </defs>
          <ellipse cx="45" cy="16" rx="9.5" ry="10.5" fill="url(#skin2)" stroke="currentColor" strokeWidth="0.8" opacity="0.7" />
          <path d="M38 9 Q43 4 48 8 Q52 11 52 16 L52 18 Q48 21 45 21 Q40 21 38 18Z" fill="url(#hair2)" opacity="0.85" />
          <ellipse cx="41.5" cy="14" rx="1.6" ry="1.4" fill="#3d2b1f" />
          <ellipse cx="48.5" cy="14" rx="1.6" ry="1.4" fill="#3d2b1f" />
          <path d="M44 18 Q45 19.5 46 18" fill="none" stroke="#c97b5a" strokeWidth="0.5" strokeLinecap="round" />
          <line x1="45" y1="26" x2="45" y2="55" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.5" />
          <line x1="45" y1="32" x2="25" y2="40" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />
          <line x1="45" y1="32" x2="65" y2="40" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />
          <line x1="45" y1="55" x2="45" y2="88" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.5" />
          <line x1="45" y1="66" x2="28" y2="78" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.45" />
          <line x1="45" y1="66" x2="62" y2="78" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.45" />
          <line x1="45" y1="88" x2="38" y2="118" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.45" />
          <line x1="45" y1="88" x2="52" y2="118" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.45" />
          <path d="M34 34 L38 33 L42 34" fill="none" stroke="currentColor" strokeWidth="0.7" opacity="0.35" />
          <path d="M48 34 L52 33 L56 34" fill="none" stroke="currentColor" strokeWidth="0.7" opacity="0.35" />
        </PoseSvg>

        <PoseSvg label="Brazos relajados" desc="Brazos ligeramente separados del cuerpo" active>
          <defs>
            <linearGradient id="skin3" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f2c79e" />
              <stop offset="100%" stopColor="#e0b080" />
            </linearGradient>
            <linearGradient id="hair3" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6b4c3b" />
              <stop offset="100%" stopColor="#4a3528" />
            </linearGradient>
          </defs>
          <ellipse cx="45" cy="15" rx="9" ry="10" fill="url(#skin3)" stroke="currentColor" strokeWidth="0.8" opacity="0.7" />
          <path d="M38 8 Q43 4 49 7 Q53 10 52 16 Q50 20 45 20 Q39 20 37 17Z" fill="url(#hair3)" opacity="0.85" />
          <ellipse cx="41.5" cy="13" rx="1.5" ry="1.3" fill="#3d2b1f" />
          <ellipse cx="48.5" cy="13" rx="1.5" ry="1.3" fill="#3d2b1f" />
          <path d="M44 17 Q45 18.5 46 17" fill="none" stroke="#c97b5a" strokeWidth="0.5" strokeLinecap="round" />
          <line x1="45" y1="25" x2="45" y2="54" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.5" />
          <path d="M45 30 Q30 40 16 48" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />
          <path d="M45 30 Q60 40 74 48" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />
          <line x1="16" y1="48" x2="18" y2="55" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
          <line x1="74" y1="48" x2="72" y2="55" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
          <line x1="45" y1="54" x2="45" y2="86" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.5" />
          <line x1="45" y1="65" x2="30" y2="76" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.45" />
          <line x1="45" y1="65" x2="60" y2="76" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.45" />
          <line x1="45" y1="86" x2="38" y2="116" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.45" />
          <line x1="45" y1="86" x2="52" y2="116" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.45" />
          <circle cx="16" cy="50" r="3.5" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.3" />
          <circle cx="74" cy="50" r="3.5" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.3" />
        </PoseSvg>

        <PoseSvg label="Buena iluminación" desc="Luz frontal y uniforme, sin sombras" active>
          <defs>
            <linearGradient id="skin4" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fadcbd" />
              <stop offset="100%" stopColor="#ecc69e" />
            </linearGradient>
            <linearGradient id="hair4" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7a5a44" />
              <stop offset="100%" stopColor="#5c4033" />
            </linearGradient>
            <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.35" />
              <stop offset="60%" stopColor="#fbbf24" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="13" cy="13" r="22" fill="url(#sunGlow)" />
          <circle cx="13" cy="13" r="8" fill="none" stroke="#fbbf24" strokeWidth="1.2" opacity="0.7" />
          <path d="M13 2 L13 4 M13 22 L13 24 M2 13 L4 13 M22 13 L24 13" stroke="#fbbf24" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
          <ellipse cx="45" cy="16" rx="9.5" ry="10.5" fill="url(#skin4)" stroke="currentColor" strokeWidth="0.8" opacity="0.7" />
          <path d="M38 9 Q43 5 49 8 Q52 11 52 16 L52 18 Q48 21 44 21 Q39 21 37 18Z" fill="url(#hair4)" opacity="0.85" />
          <ellipse cx="41.5" cy="14" rx="1.6" ry="1.3" fill="#3d2b1f" />
          <ellipse cx="48.5" cy="14" rx="1.6" ry="1.3" fill="#3d2b1f" />
          <path d="M44 18 Q45 19.5 46 18" fill="none" stroke="#c97b5a" strokeWidth="0.5" strokeLinecap="round" />
          <line x1="45" y1="26" x2="45" y2="55" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.5" />
          <line x1="45" y1="32" x2="25" y2="40" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />
          <line x1="45" y1="32" x2="65" y2="40" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />
          <line x1="45" y1="55" x2="45" y2="88" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.5" />
          <line x1="45" y1="66" x2="28" y2="78" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.45" />
          <line x1="45" y1="66" x2="62" y2="78" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.45" />
          <line x1="45" y1="88" x2="38" y2="118" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.45" />
          <line x1="45" y1="88" x2="52" y2="118" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.45" />
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
