import React from 'react'

interface PoseGuideProps {
  onStart: () => void
}

function StickFigure({ variant = 'front' }: { variant?: 'front' | 'side' | 'arms' }) {
  const strokeColor = 'var(--text-primary)'
  const accentColor = 'var(--text-muted)'

  if (variant === 'front') {
    return (
      <svg viewBox="0 0 200 380" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Head */}
        <circle cx="100" cy="42" r="22" stroke={strokeColor} strokeWidth="2.5" fill="none" />
        {/* Body */}
        <line x1="100" y1="64" x2="100" y2="200" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
        {/* Shoulders */}
        <line x1="55" y1="90" x2="145" y2="90" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
        {/* Arms - relaxed at sides */}
        <line x1="55" y1="90" x2="42" y2="170" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="145" y1="90" x2="158" y2="170" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
        {/* Hips */}
        <line x1="100" y1="200" x2="100" y2="205" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="75" y1="205" x2="125" y2="205" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
        {/* Legs */}
        <line x1="75" y1="205" x2="65" y2="340" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="125" y1="205" x2="135" y2="340" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
        {/* Feet */}
        <line x1="65" y1="340" x2="50" y2="345" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="135" y1="340" x2="150" y2="345" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
        {/* Shoulder width indicator */}
        <line x1="55" y1="82" x2="145" y2="82" stroke={accentColor} strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
        <line x1="55" y1="82" x2="55" y2="88" stroke={accentColor} strokeWidth="1" opacity="0.5" />
        <line x1="145" y1="82" x2="145" y2="88" stroke={accentColor} strokeWidth="1" opacity="0.5" />
      </svg>
    )
  }

  if (variant === 'side') {
    return (
      <svg viewBox="0 0 200 380" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Head */}
        <circle cx="100" cy="42" r="22" stroke={strokeColor} strokeWidth="2.5" fill="none" />
        {/* Body - slightly curved for natural pose */}
        <path d="M100 64 Q98 130 100 200" stroke={strokeColor} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* Arm - relaxed */}
        <path d="M100 90 Q80 130 75 175" stroke={strokeColor} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* Hips */}
        <line x1="85" y1="205" x2="115" y2="205" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
        {/* Legs */}
        <line x1="90" y1="205" x2="82" y2="340" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="110" y1="205" x2="118" y2="340" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
        {/* Feet */}
        <line x1="82" y1="340" x2="70" y2="345" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="118" y1="340" x2="130" y2="345" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 200 380" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Head */}
      <circle cx="100" cy="42" r="22" stroke={strokeColor} strokeWidth="2.5" fill="none" />
      {/* Body */}
      <line x1="100" y1="64" x2="100" y2="200" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
      {/* Shoulders */}
      <line x1="55" y1="90" x2="145" y2="90" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
      {/* Arms - raised slightly for better visibility */}
      <line x1="55" y1="90" x2="35" y2="140" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="145" y1="90" x2="165" y2="140" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
      {/* Hips */}
      <line x1="75" y1="205" x2="125" y2="205" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
      {/* Legs */}
      <line x1="75" y1="205" x2="65" y2="340" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="125" y1="205" x2="135" y2="340" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
      {/* Feet */}
      <line x1="65" y1="340" x2="50" y2="345" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="135" y1="340" x2="150" y2="345" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

function PhotoTip({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-light)]">
      <div className="mt-0.5 text-primary">{icon}</div>
      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{text}</p>
    </div>
  )
}

export default function PoseGuide({ onStart }: PoseGuideProps) {
  return (
    <div className="flex flex-col gap-6 pb-4">
      <div className="text-center">
        <h2 className="text-xl font-bold">¿Cómo posar?</h2>
        <p className="text-sm text-[var(--text-secondary)] mt-2">
          Para obtener los mejores resultados, sigue estas recomendaciones
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 h-48">
        <div className="flex flex-col items-center gap-2">
          <div className="flex-1 w-full p-2 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-light)]">
            <StickFigure variant="front" />
          </div>
          <span className="text-[10px] font-bold text-[var(--text-muted)]">Frontal</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="flex-1 w-full p-2 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-light)]">
            <StickFigure variant="side" />
          </div>
          <span className="text-[10px] font-bold text-[var(--text-muted)]">Lateral</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="flex-1 w-full p-2 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-light)]">
            <StickFigure variant="arms" />
          </div>
          <span className="text-[10px] font-bold text-[var(--text-muted)]">Brazos</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <PhotoTip
          icon={<span className="text-lg">📸</span>}
          text="Foto de cuerpo completo, de pies a cabeza"
        />
        <PhotoTip
          icon={<span className="text-lg">💡</span>}
          text="Buena iluminación, sin sombras fuertes"
        />
        <PhotoTip
          icon={<span className="text-lg">🧍</span>}
          text="Posición frontal, brazos relajados a los lados"
        />
        <PhotoTip
          icon={<span className="text-lg">🚫</span>}
          text="Sin ropa ajustada oscura que se confunda con el fondo"
        />
      </div>

      <button
        onClick={onStart}
        className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-sm active:scale-[0.98] transition-all shadow-lg shadow-primary/30"
      >
        Tomar mi foto
      </button>
    </div>
  )
}
