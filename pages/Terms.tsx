import React from 'react'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { termsSections, TERMS_UPDATED } from '../src/legal'

interface Props {
  onBack: () => void
}

const CONTACT_EMAIL = 'appestilovivo@gmail.com'
const CONTROLLER =
  'la persona titular del proyecto, cuyos datos figuran en la versión web de estas condiciones (estilovivo.xyoncloud.win/condiciones)'

// Mismo texto que la página pública /condiciones y que la app (fuente: src/legal.ts).
export default function Terms({ onBack }: Props) {
  const sections = termsSections(CONTROLLER, CONTACT_EMAIL)
  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <div className="flex items-center gap-3 px-4 py-4 border-b" style={{ borderColor: 'var(--border-light)' }}>
        <button onClick={onBack} className="p-1 rounded-lg" aria-label="Volver"><ArrowLeft size={20} style={{ color: 'var(--text-primary)' }} /></button>
        <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Condiciones de uso</h1>
      </div>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Última actualización: {TERMS_UPDATED}</p>
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{s.title}</h2>
            {(s.paragraphs || []).map((p) => <p key={p} className="mb-1">{p}</p>)}
            {s.bullets?.length ? (
              <ul className="list-disc pl-4 mt-1 space-y-1">
                {s.bullets.map((b) => <li key={b}>{b}</li>)}
              </ul>
            ) : null}
          </section>
        ))}
        <a href="/condiciones" target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-semibold" style={{ color: 'var(--text-primary)' }}>
          Ver la versión pública <ExternalLink size={14} />
        </a>
      </div>
    </div>
  )
}
