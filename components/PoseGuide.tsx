import React from 'react'

interface PoseGuideProps {
  onStart: () => void
  compact?: boolean
}

const PoseIllustration: React.FC<{ label: string; desc: string; active?: boolean }> = ({ label, desc, active }) => (
  <div className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-colors ${active ? 'bg-primary/10 border border-primary/30' : ''}`}>
    <svg width="80" height="120" viewBox="0 0 80 120" className="text-gray-600 dark:text-gray-300">
      <circle cx="40" cy="15" r="10" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <line x1="40" y1="25" x2="40" y2="60" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="40" y1="40" x2="18" y2="55" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="40" y1="40" x2="62" y2="55" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="40" y1="60" x2="40" y2="95" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="40" y1="75" x2="20" y2="90" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="40" y1="75" x2="60" y2="90" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="40" y1="95" x2="30" y2="118" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="40" y1="95" x2="50" y2="118" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
    <span className="text-xs font-bold text-center">{label}</span>
    <span className="text-[10px] text-gray-500 dark:text-gray-400 text-center leading-tight">{desc}</span>
  </div>
)

export default function PoseGuide({ onStart, compact }: PoseGuideProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-xl font-bold">¿Cómo posar?</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Sigue estas recomendaciones para obtener el mejor resultado
        </p>
      </div>

      <div className={`grid ${compact ? 'grid-cols-2 gap-2' : 'grid-cols-2 gap-4'}`}>
        <PoseIllustration
          label="De frente"
          desc="Mira directamente a la cámara"
          active
        />
        <PoseIllustration
          label="Postura recta"
          desc="Espalda erguida, sin inclinarte"
          active
        />
        <PoseIllustration
          label="Brazos relajados"
          desc="Brazos ligeramente separados del cuerpo"
          active
        />
        <PoseIllustration
          label="Buena iluminación"
          desc="Luz frontal y uniforme, sin sombras"
          active
        />
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 rounded-2xl p-4 flex items-start gap-3">
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
