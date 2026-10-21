import React from 'react'
import SlideToStart from './SlideToStart'

interface Props {
  onStart: () => void
}

/**
 * Pantalla de bienvenida, igual que la de la app (WelcomeScreen.kt): foto de moda a pantalla completa con zoom lento,
 * "ESTILO VIVO" en letras gigantes que suben una a una, titular con serif cursiva y botón "Empezar".
 */
export default function Welcome({ onStart }: Props) {
  const word = (text: string, delay: number, indent = false) => (
    <div className={`flex ${indent ? 'pl-14' : ''}`} aria-hidden="true">
      {text.split('').map((ch, i) => (
        <span key={i} className="ev-giant-letter" style={{ animationDelay: `${delay + i * 90}ms` }}>{ch}</span>
      ))}
    </div>
  )
  return (
    <div className="fixed inset-0 z-50 overflow-hidden" style={{ background: '#7D848F' }}>
      <img src="/welcome-hero.jpg" alt="" className="ev-kenburns absolute inset-0 w-full h-full object-cover" />
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(125,132,143,.55) 0%, transparent 45%, rgba(20,23,29,.55) 62%, rgba(20,23,29,.97) 100%)' }}
      />
      <div className="relative h-full max-w-md mx-auto flex flex-col justify-between px-6 pt-12 pb-8" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 3rem)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)' }}>
        <h1 className="sr-only">Estilo Vivo</h1>
        <div>
          {word('ESTILO', 250)}
          {word('VIVO', 700, true)}
        </div>
        <div className="space-y-5">
          <h2 className="ev-headline text-[32px] ev-reveal" style={{ animationDelay: '1100ms', color: '#fff' }}>
            Eleva tu <span className="ev-accent" style={{ background: 'none' }}>estilo</span>,<br />
            vive tu <span className="ev-accent" style={{ background: 'none' }}>armario</span>.
          </h2>
          <p className="text-white/80 text-[15px] leading-relaxed ev-reveal" style={{ animationDelay: '1350ms' }}>
            Organiza tu ropa, crea looks, pruébatelos y comparte tu estilo con la comunidad.
          </p>
          <SlideToStart label="Empezar" onComplete={onStart} className="ev-reveal" style={{ animationDelay: '1600ms' }} />
        </div>
      </div>
    </div>
  )
}
