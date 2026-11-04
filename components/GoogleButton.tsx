import React, { useEffect, useRef, useState } from 'react';

/**
 * "Continuar con Google" (Google Identity Services). El script de Google NO se carga al abrir la página: solo cuando
 * la persona pulsa el botón (así Google no recibe nada de quien no lo usa y no hacen falta avisos de cookies).
 * Al cargarlo se abre el selector de cuentas de Google y, por si el navegador lo bloquea, se muestra el botón oficial.
 */

declare global {
  interface Window { google?: any }
}

const GSI_SRC = 'https://accounts.google.com/gsi/client';
let gsiPromise: Promise<void> | null = null;

const loadGsi = () => {
  gsiPromise ??= new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const s = document.createElement('script');
    s.src = GSI_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { gsiPromise = null; reject(new Error('No se pudo cargar Google')); };
    document.head.appendChild(s);
  });
  return gsiPromise;
};

const GoogleLogo = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

interface Props {
  clientId: string;
  onCredential: (credential: string) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}

const GoogleButton: React.FC<Props> = ({ clientId, onCredential, onError, disabled }) => {
  const [state, setState] = useState<'idle' | 'loading' | 'ready'>('idle');
  const slot = useRef<HTMLDivElement>(null);
  const cb = useRef(onCredential);
  cb.current = onCredential;

  const start = async () => {
    setState('loading');
    try {
      await loadGsi();
      const id = window.google.accounts.id;
      id.initialize({
        client_id: clientId,
        callback: (r: { credential?: string }) => { if (r?.credential) cb.current(r.credential); },
        ux_mode: 'popup',
        context: 'signin',
        cancel_on_tap_outside: true,
        use_fedcm_for_prompt: true,
        itp_support: true,
      });
      setState('ready');
      id.prompt();
    } catch {
      setState('idle');
      onError('No se ha podido abrir Google. Comprueba tu conexión o entra con tu correo.');
    }
  };

  // Botón oficial de Google, por si el selector automático no aparece
  useEffect(() => {
    if (state !== 'ready' || !slot.current) return;
    slot.current.innerHTML = '';
    window.google?.accounts?.id?.renderButton(slot.current, {
      type: 'standard', theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', locale: 'es',
      width: Math.min(400, slot.current.clientWidth || 320),
    });
  }, [state]);

  if (state === 'ready') {
    return (
      <div className="space-y-2">
        <div ref={slot} className="w-full flex justify-center min-h-[44px]" />
        <p className="text-center text-[11px] text-[var(--text-muted)]">Elige tu cuenta de Google. Si no se abre, pulsa el botón de arriba.</p>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={start}
      disabled={disabled || state === 'loading'}
      className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl border border-[var(--border-light)] bg-white text-[#1f1f1f] font-bold text-sm shadow-sm hover:shadow-md active:scale-[0.98] transition-all disabled:opacity-60"
    >
      {state === 'loading'
        ? <div className="w-5 h-5 border-[3px] border-gray-200 border-t-gray-500 rounded-full animate-spin" />
        : <GoogleLogo />}
      <span>Continuar con Google</span>
    </button>
  );
};

export default GoogleButton;
