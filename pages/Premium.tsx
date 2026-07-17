import React from 'react';
import { ArrowLeft, Crown, Sparkles, Shield, Zap, Mail } from 'lucide-react';

interface Props {
  onBack: () => void;
}

const FEATURES = [
  { icon: <Zap size={18} />, title: 'Probador virtual ilimitado', desc: 'Prueba prendas sin límites diarios' },
  { icon: <Sparkles size={18} />, title: 'Ventas ilimitadas', desc: 'Publica todas las prendas que quieras a la venta' },
  { icon: <Shield size={18} />, title: 'Sin anuncios', desc: 'Experiencia limpia sin interrupciones' },
  { icon: <Crown size={18} />, title: 'Soporte prioritario', desc: 'Respuesta en menos de 24 horas' },
];

export default function Premium({ onBack }: Props) {
  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <div className="flex items-center gap-3 px-4 py-4 border-b" style={{ borderColor: 'var(--border-light)' }}>
        <button onClick={onBack} className="p-1 rounded-lg hover:scale-110 active:scale-95 transition-transform"><ArrowLeft size={20} style={{ color: 'var(--text-primary)' }} /></button>
        <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Estilo Vivo Premium</h1>
      </div>

      <div className="px-4 py-6 space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center mx-auto mb-4 shadow-lg animate-pulse">
            <Crown size={32} className="text-white" />
          </div>
          <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Desbloquea todo el potencial</h2>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Lleva tu estilo al siguiente nivel</p>
        </div>

        <div className="space-y-3">
          {FEATURES.map((f, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-xl hover:scale-[1.02] transition-transform" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)', animationDelay: `${i * 100}ms` }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>
                {f.icon}
              </div>
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{f.title}</p>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl p-6 text-center space-y-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>¿Quieres ser Premium?</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Contáctanos y te activamos tu cuenta premium
          </p>
          <a
            href="mailto:appestilovivo@gmail.com?subject=Quiero%20ser%20Premium%20-%20Estilo%20Vivo"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-bold hover:scale-105 active:scale-95 transition-transform shadow-lg"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            <Mail size={16} />
            appetilovivo@gmail.com
          </a>
        </div>
      </div>
    </div>
  );
}
