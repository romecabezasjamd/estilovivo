import { describe, it, expect } from 'vitest';
import { renderModerationPage, signModerationLink, verifyModerationLink } from '../moderation.js';

const SECRET = 'secreto-de-prueba';

describe('enlaces de moderación', () => {
  it('un enlace firmado es válido para su denuncia', () => {
    const { e, s } = signModerationLink(SECRET, 'rep1');
    expect(verifyModerationLink(SECRET, 'rep1', e, s)).toBe(true);
  });

  it('no sirve para otra denuncia, con otra firma o con otro secreto', () => {
    const { e, s } = signModerationLink(SECRET, 'rep1');
    expect(verifyModerationLink(SECRET, 'rep2', e, s)).toBe(false);
    expect(verifyModerationLink(SECRET, 'rep1', e, s.slice(0, -2) + 'xx')).toBe(false);
    expect(verifyModerationLink('otro', 'rep1', e, s)).toBe(false);
    expect(verifyModerationLink(SECRET, 'rep1', String(Number(e) + 1), s)).toBe(false);
  });

  it('caduca a los 30 días y rechaza basura', () => {
    const now = Date.UTC(2026, 9, 15);
    const { e, s } = signModerationLink(SECRET, 'rep1', now);
    expect(verifyModerationLink(SECRET, 'rep1', e, s, now + 29 * 86400e3)).toBe(true);
    expect(verifyModerationLink(SECRET, 'rep1', e, s, now + 31 * 86400e3)).toBe(false);
    expect(verifyModerationLink(SECRET, 'rep1', undefined, s)).toBe(false);
    expect(verifyModerationLink(SECRET, 'rep1', 'abc', s)).toBe(false);
    expect(verifyModerationLink(SECRET, 'rep1', e, ['x'])).toBe(false);
  });
});

describe('página de moderación', () => {
  const base = {
    reportId: 'rep1', e: '1', s: 'firma', targetType: 'COMMENT', reason: 'HARASSMENT', status: 'OPEN',
    createdAt: new Date('2026-10-15T10:00:00Z'), reporterName: 'Ana', ownerName: 'Luis <luis@x.es>', ownerSuspended: false,
    contentText: '<script>alert(1)</script> eres tonto', contentImage: null, contentGone: false, otherOpenReports: 0,
  };

  it('escapa el contenido denunciado y muestra las acciones', () => {
    const html = renderModerationPage(base);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Luis &lt;luis@x.es&gt;');
    expect(html).toContain('value="remove"');
    expect(html).toContain('value="suspend"');
    expect(html).toContain('value="dismiss"');
    expect(html).toContain('Acoso o insultos');
  });

  it('las acciones son POST con la firma oculta (un GET nunca ejecuta nada)', () => {
    const html = renderModerationPage(base);
    expect(html.match(/<form method="post"/g)?.length).toBe(3);
    expect(html).toContain('<input type="hidden" name="s" value="firma">');
  });

  it('cuenta suspendida y denuncia cerrada: solo reactivar', () => {
    const html = renderModerationPage({ ...base, status: 'SUSPENDED', ownerSuspended: true });
    expect(html).toContain('value="unsuspend"');
    expect(html).not.toContain('value="remove"');
    expect(html).not.toContain('value="dismiss"');
  });
});
