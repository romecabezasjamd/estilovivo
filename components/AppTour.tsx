import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Headline from './Headline';

const TOUR_KEY = 'ev_tour_done';
const PERMS_KEY = 'ev_permissions_asked'; // lo guarda AccountPrompts al cerrar el aviso de permisos

const STEPS = [
  { tab: 'home', emoji: '👋', title: 'Te damos la *bienvenida*', body: 'Este es tu inicio. Dinos cómo te sientes y, con el tiempo que hace, te proponemos un look con tu propia ropa.' },
  { tab: 'wardrobe', emoji: '👗', title: 'Tu *armario*', body: 'Sube cada prenda con una foto. Para lavar algo, arrástralo hasta la lavadora y desaparece de tus looks hasta que lo saques.' },
  { tab: 'social', emoji: '✨', title: 'La *comunidad*', body: 'Inspírate con looks y tendencias, sigue a otras personas y compra o vende ropa de segunda mano.' },
  { tab: 'profile', emoji: '💛', title: 'Tu *perfil*', body: 'Tu nivel, tus retos y tus ajustes. En "Enviar opinión" puedes contarnos ideas o fallos: lo leemos todo.' },
];

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };

/** Tour de bienvenida (una vez en este navegador, después del aviso de permisos): recorre las cuatro pestañas. */
const AppTour: React.FC<{ onShowTab: (tab: string) => void }> = ({ onShowTab }) => {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (read(TOUR_KEY) === '1') return;
    const id = window.setInterval(() => {
      if (read(PERMS_KEY) !== '1') return;
      window.clearInterval(id);
      setVisible(true);
      onShowTab(STEPS[0].tab);
    }, 1000);
    return () => window.clearInterval(id);
  }, [onShowTab]);

  const go = (i: number) => { setStep(i); onShowTab(STEPS[i].tab); };
  const finish = () => {
    try { localStorage.setItem(TOUR_KEY, '1'); } catch {}
    setVisible(false);
    onShowTab('home');
  };
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div className="fixed inset-0 z-[230] bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          role="dialog" aria-modal="true" aria-label="Tour de bienvenida">
          <div className="absolute left-4 right-4 bottom-28 mx-auto max-w-md bg-[var(--bg-card)] rounded-[30px] p-5 shadow-2xl">
            <AnimatePresence mode="wait">
              <motion.div key={step} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} aria-live="polite">
                <div className="text-4xl mb-2">{s.emoji}</div>
                <Headline text={s.title} />
                <p className="text-sm text-[var(--text-secondary,#55545c)] mt-2">{s.body}</p>
              </motion.div>
            </AnimatePresence>
            <div className="flex items-center gap-1.5 mt-4">
              {STEPS.map((_, i) => <span key={i} className={`h-1.5 rounded-full ${i === step ? 'w-5 bg-[var(--ink,#0B0B0F)]' : 'w-1.5 bg-gray-300'}`} />)}
              <span className="ml-auto text-[11px] font-semibold text-gray-400">{step + 1} de {STEPS.length}</span>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={finish} className="px-5 py-3 rounded-full text-sm font-bold text-gray-600">Saltar</button>
              <button onClick={() => (last ? finish() : go(step + 1))} className="flex-1 py-3 rounded-full bg-[var(--ink,#0B0B0F)] text-white text-sm font-bold">
                {last ? '¡Empezar!' : 'Siguiente'}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AppTour;
