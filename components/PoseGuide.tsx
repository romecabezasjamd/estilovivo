import React from 'react'

interface PoseGuideProps {
  onStart: () => void
}

function FrontalFigure() {
  return (
    <svg viewBox="0 0 120 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <circle cx="60" cy="28" r="16" stroke="var(--text-muted)" strokeWidth="1.5" fill="none" />
      <line x1="60" y1="44" x2="60" y2="120" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="60" y1="60" x2="30" y2="95" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="60" y1="60" x2="90" y2="95" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="60" y1="120" x2="38" y2="180" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="60" y1="120" x2="82" y2="180" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="54" cy="25" r="1.5" fill="var(--text-muted)" />
      <circle cx="66" cy="25" r="1.5" fill="var(--text-muted)" />
      <path d="M55 33 Q60 37 65 33" stroke="var(--text-muted)" strokeWidth="1" fill="none" strokeLinecap="round" />
    </svg>
  )
}

function SideFigure() {
  return (
    <svg viewBox="0 0 120 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <circle cx="55" cy="28" r="16" stroke="var(--text-muted)" strokeWidth="1.5" fill="none" />
      <path d="M55 44 Q52 80 54 120" stroke="var(--text-muted)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <line x1="54" y1="65" x2="35" y2="85" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="54" y1="65" x2="75" y2="90" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M54 120 Q48 150 42 180" stroke="var(--text-muted)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M54 120 Q60 150 66 180" stroke="var(--text-muted)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <circle cx="49" cy="25" r="1.5" fill="var(--text-muted)" />
      <path d="M50 33 Q55 36 58 33" stroke="var(--text-muted)" strokeWidth="1" fill="none" strokeLinecap="round" />
    </svg>
  )
}

function ArmsFigure() {
  return (
    <svg viewBox="0 0 120 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <circle cx="60" cy="28" r="16" stroke="var(--text-muted)" strokeWidth="1.5" fill="none" />
      <line x1="60" y1="44" x2="60" y2="120" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="60" y1="58" x2="15" y2="82" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="60" y1="58" x2="105" y2="82" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="60" y1="120" x2="38" y2="180" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="60" y1="120" x2="82" y2="180" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="54" cy="25" r="1.5" fill="var(--text-muted)" />
      <circle cx="66" cy="25" r="1.5" fill="var(--text-muted)" />
      <path d="M55 33 Q60 37 65 33" stroke="var(--text-muted)" strokeWidth="1" fill="none" strokeLinecap="round" />
    </svg>
  )
}

function LightIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 mx-auto">
      <circle cx="20" cy="18" r="7" stroke="var(--text-muted)" strokeWidth="1.5" fill="none" />
      <line x1="20" y1="5" x2="20" y2="8" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="20" y1="28" x2="20" y2="31" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="7" y1="18" x2="10" y2="18" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="30" y1="18" x2="33" y2="18" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="10.8" y1="8.8" x2="12.9" y2="10.9" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="27.1" y1="25.1" x2="29.2" y2="27.2" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="29.2" y1="8.8" x2="27.1" y2="10.9" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12.9" y1="25.1" x2="10.8" y2="27.2" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="14" y="32" width="12" height="3" rx="1.5" stroke="var(--text-muted)" strokeWidth="1.2" fill="none" />
    </svg>
  )
}

export default function PoseGuide({ onStart }: PoseGuideProps) {
  const poses = [
    { Component: FrontalFigure, label: 'De frente', tip: 'Mira a la camara' },
    { Component: SideFigure, label: 'Postura recta', tip: 'Hombros alineados' },
    { Component: ArmsFigure, label: 'Brazos relajados', tip: 'Postura natural' },
  ]

  const tips = [
    { icon: '📐', text: 'Foto de cuerpo entero, de pies a cabeza' },
    { icon: '💡', text: 'Buena iluminacion, sin sombras fuertes' },
    { icon: '🧍', text: 'Posicion frontal, brazos relajados a los lados' },
    { icon: '🚫', text: 'Evita ropa oscura pegada que se funda con el fondo' },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Como posar
        </h3>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          Sigue estas guias para obtener el mejor resultado
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {poses.map(({ Component, label, tip }) => (
          <div key={label} className="flex flex-col items-center gap-1">
            <div
              className="w-full aspect-[2/3] p-1.5 rounded-xl flex items-center justify-center overflow-hidden"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
              }}
            >
              <Component />
            </div>
            <span className="text-[10px] font-semibold" style={{ color: 'var(--text-primary)' }}>
              {label}
            </span>
            <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
              {tip}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2.5 mt-1">
        <div className="flex items-center justify-center gap-2">
          <LightIcon />
          <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
            Iluminacion ideal
          </span>
        </div>
        {tips.map(({ icon, text }) => (
          <div
            key={text}
            className="flex items-start gap-2.5 px-3 py-2 rounded-lg text-xs"
            style={{
              backgroundColor: 'var(--bg-secondary, rgba(0,0,0,0.03))',
              color: 'var(--text-secondary)',
            }}
          >
            <span className="text-sm flex-shrink-0 mt-px">{icon}</span>
            <span>{text}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onStart}
        className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity active:opacity-80"
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        Tomar mi foto
      </button>
    </div>
  )
}
