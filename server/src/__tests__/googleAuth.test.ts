import { afterEach, describe, expect, it } from 'vitest';
import { GoogleAuthError, googleClientIds, googleDisplayName, isGoogleEnabled, verifyGoogleIdToken } from '../googleAuth.js';

describe('googleAuth', () => {
  const saved = process.env.GOOGLE_CLIENT_ID;
  afterEach(() => { if (saved === undefined) delete process.env.GOOGLE_CLIENT_ID; else process.env.GOOGLE_CLIENT_ID = saved; });

  it('reads one or several client ids (the first one is the web one)', () => {
    process.env.GOOGLE_CLIENT_ID = ' web.apps.googleusercontent.com , otro.apps.googleusercontent.com ,';
    expect(googleClientIds()).toEqual(['web.apps.googleusercontent.com', 'otro.apps.googleusercontent.com']);
    expect(isGoogleEnabled()).toBe(true);
    delete process.env.GOOGLE_CLIENT_ID;
    expect(isGoogleEnabled()).toBe(false);
  });

  it('rejects tokens when disabled or when the token is not a real Google token', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    await expect(verifyGoogleIdToken('abc')).rejects.toThrow(GoogleAuthError);
    process.env.GOOGLE_CLIENT_ID = 'web.apps.googleusercontent.com';
    await expect(verifyGoogleIdToken('no.es.un.token')).rejects.toMatchObject({ message: 'invalid' });
  });

  it('builds a valid display name', () => {
    expect(googleDisplayName('  Lucía   Pérez ', 'x@y.com')).toBe('Lucía Pérez');
    expect(googleDisplayName('', 'maria.lopez@gmail.com')).toBe('maria lopez');
    expect(googleDisplayName('A', 'b@c.com')).toBe('Estilo Vivo');
    expect(googleDisplayName('x'.repeat(80), 'a@b.com')).toHaveLength(60);
  });
});
