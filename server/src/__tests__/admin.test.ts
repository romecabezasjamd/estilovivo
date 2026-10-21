import { describe, it, expect } from 'vitest';
import { crashSignature, maskEmail } from '../admin.js';
import { decisionMessage } from '../moderation.js';
import { isExplicit } from '../nsfw.js';

describe('crashSignature', () => {
  it('agrupa el mismo fallo aunque cambien números de línea', () => {
    const a = crashSignature('TypeError: x is undefined\n    at foo (app.js:10:5)\n    at bar (app.js:20:1)');
    const b = crashSignature('TypeError: x is undefined\n    at foo (app.js:11:7)\n    at bar (app.js:22:3)');
    expect(a.signature).toBe(b.signature);
    expect(a.title).toBe('TypeError: x is undefined');
  });
  it('separa fallos distintos', () => {
    expect(crashSignature('Error A').signature).not.toBe(crashSignature('Error B').signature);
  });
});

describe('maskEmail', () => {
  it('oculta parte del correo', () => {
    expect(maskEmail('andrea@gmail.com')).toBe('an••••@gmail.com');
    expect(maskEmail('ab@x.es')).toBe('ab•@x.es');
  });
});

describe('decisionMessage (aviso de moderación, DSA art. 17)', () => {
  it('incluye motivo, que lo decidió una persona y cómo reclamar', () => {
    const m = decisionMessage({ kind: 'removed', what: 'publicación', reason: 'Spam o publicidad' }, 'equipo@ejemplo.es');
    expect(m.text).toContain('Motivo: Spam o publicidad');
    expect(m.text).toContain('una persona del equipo');
    expect(m.text).toContain('equipo@ejemplo.es');
    expect(m.notification).toContain('publicación');
  });
  it('la suspensión no deja aviso en la app (no puede entrar), solo correo', () => {
    const m = decisionMessage({ kind: 'suspended', reason: 'Acoso' }, 'e@e.es');
    expect(m.notification).toBeUndefined();
    expect(m.subject).toContain('suspendida');
  });
});

describe('isExplicit (fotos íntimas)', () => {
  const p = (v: Record<string, number>) => (n: string) => v[n] ?? 0;
  it('bloquea contenido explícito', () => expect(isExplicit(p({ Porn: 0.5 }))).toBe(true));
  it('bloquea desnudo parcial o pose sexual', () => expect(isExplicit(p({ Porn: 0.36, Hentai: 0.05, Sexy: 0.49 }))).toBe(true));
  it('permite bikini o lencería de catálogo', () => expect(isExplicit(p({ Porn: 0.02, Sexy: 0.97 }))).toBe(false));
  it('permite ropa deportiva', () => expect(isExplicit(p({ Porn: 0.22, Sexy: 0.76 }))).toBe(false));
});
