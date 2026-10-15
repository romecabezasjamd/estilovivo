import React from 'react'

interface Props {
  /** Texto con la palabra destacada entre *asteriscos*, como EvHeadline en la app: "Tu *armario*, a mano." */
  text: string
  className?: string
  as?: 'h1' | 'h2'
}

/** Titular de la app: Poppins negrita + palabra destacada en serif cursiva subrayada con el color de marca. */
export default function Headline({ text, className = 'text-3xl', as: Tag = 'h1' }: Props) {
  const parts = text.split(/(\*[^*]+\*)/g).filter(Boolean)
  return (
    <Tag className={`ev-headline ${className}`}>
      {parts.map((p, i) =>
        p.startsWith('*') && p.endsWith('*')
          ? <span key={i} className="ev-accent">{p.slice(1, -1)}</span>
          : <React.Fragment key={i}>{p}</React.Fragment>,
      )}
    </Tag>
  )
}
