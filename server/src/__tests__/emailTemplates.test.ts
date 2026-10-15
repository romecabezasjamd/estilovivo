import { describe, it, expect } from 'vitest';
import { renderEmail, renderHeadline, REASON_PREFS } from '../emailTemplates.js';

const base = {
  preheader: 'Vista previa',
  eyebrow: 'Tu armario',
  headline: 'Tu prenda está en la *lavadora*',
  reason: REASON_PREFS,
  baseUrl: 'https://estilovivo.example/',
};

describe('plantilla de correo', () => {
  it('pinta la palabra entre asteriscos en serif cursiva', () => {
    const h = renderHeadline('Hola, *Ana*');
    expect(h).toContain('Hola, <em');
    expect(h).toContain('font-style:italic');
    expect(h).toContain('>Ana</em>');
    expect(h).not.toContain('*');
  });

  it('escapa nombres y textos de usuarios (sin HTML inyectado)', () => {
    const html = renderEmail({
      ...base,
      headline: '*<script>alert(1)</script>* te ha escrito',
      quote: '<img src=x onerror=alert(1)>',
      intro: '"comillas" & <b>negrita</b>',
    });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<b>negrita</b>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&quot;comillas&quot; &amp;');
  });

  it('solo admite enlaces e imágenes http(s)', () => {
    const html = renderEmail({
      ...base,
      cta: { label: 'Abrir', url: 'javascript:alert(1)' },
      imageUrl: 'data:image/png;base64,AAAA',
    });
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('data:image');
  });

  it('incluye logo, botón, foto y pie con el origen sin barra doble', () => {
    const html = renderEmail({
      ...base,
      imageUrl: 'https://estilovivo.example/api/uploads/a.webp',
      cta: { label: 'Ver mi armario', url: 'https://estilovivo.example/' },
      quote: 'hola',
    });
    expect(html).toContain('https://estilovivo.example/estilo-vivo-logo-icon.png');
    expect(html).not.toContain('example//estilo');
    expect(html).toContain('Ver mi armario');
    expect(html).toContain('https://estilovivo.example/api/uploads/a.webp');
    expect(html).toContain('Perfil › Ajustes › Avisos por email');
    expect(html).toContain('hola');
  });

  it('omite secciones vacías', () => {
    const html = renderEmail(base);
    expect(html).not.toContain('<img src="https://estilovivo.example/api');
    expect(html).not.toContain('¿El botón no funciona?');
    expect(html).not.toContain('→');
  });
});
