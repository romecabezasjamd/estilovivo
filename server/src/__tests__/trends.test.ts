import { describe, it, expect } from 'vitest';
import { parseFeed, decodeEntities } from '../fashionTrends.js';
import { topShares, categoryLabel, colorHex } from '../communityTrends.js';

const feed = { url: 'x', source: 'Vogue' as const, sourceName: 'Vogue España' };
const rss = `<rss><channel>
<item><title><![CDATA[Las 5 tendencias de moda del otoño &#8216;2026&#8217;]]></title><link>https://www.vogue.es/moda/articulo</link>
<category>Moda</category><pubDate>Tue, 21 Oct 2026 10:00:00 GMT</pubDate><description><![CDATA[<p>Texto largo del artículo</p>]]></description>
<media:thumbnail url="https://media.vogue.es/foto.jpg"/></item>
<item><title>Receta de cocina</title><link>https://www.vogue.es/cocina</link><category>Cocina</category></item>
<item><title>Bolso de la temporada</title><link>javascript:alert(1)</link><category>Moda</category></item>
<item><title>Mercurio retrógrado y tu estilo</title><link>https://www.vogue.es/astro</link><category>Living</category></item>
<item><title>Abrigos del otoño</title><link>https://www.vogue.es/abrigos</link><category>Moda</category><category>Moda / Tendencias</category></item>
</channel></rss>`;

describe('titulares de revistas', () => {
  it('solo titular, revista, fecha y enlace: sin foto ni texto del artículo', () => {
    const items = parseFeed(rss, feed);
    expect(items).toHaveLength(2);
    expect(items[1].category).toBe('Tendencias');
    const h = items[0];
    expect(h.title).toBe('Las 5 tendencias de moda del otoño ‘2026’');
    expect(h.link).toBe('https://www.vogue.es/moda/articulo');
    expect(h.publishedAt).toBe('2026-10-21T10:00:00.000Z');
    expect(JSON.stringify(h)).not.toContain('foto.jpg');
    expect(JSON.stringify(h)).not.toContain('Texto largo');
  });
  it('descarta lo que no es moda y los enlaces no seguros', () => {
    const titles = parseFeed(rss, feed).map((h) => h.title);
    expect(titles).not.toContain('Receta de cocina');
    expect(titles).not.toContain('Bolso de la temporada');
    expect(titles).not.toContain('Mercurio retrógrado y tu estilo');
  });
  it('decodifica entidades HTML', () => expect(decodeEntities('A &amp; B &#233;')).toBe('A & B é'));
});

describe('tendencias de la comunidad', () => {
  it('cuenta y da porcentajes', () => {
    expect(topShares(['negro', 'negro', 'blanco', ''], 2)).toEqual([{ name: 'negro', share: 67 }, { name: 'blanco', share: 33 }]);
  });
  it('agrupa categorías en inglés y español', () => {
    expect(categoryLabel('top')).toBe('Partes de arriba');
    expect(categoryLabel('Bottoms')).toBe('Partes de abajo');
    expect(categoryLabel('Abrigos')).toBe('Abrigos y chaquetas');
    expect(categoryLabel('shoes')).toBe('Calzado');
    expect(categoryLabel('cosa rara')).toBe('Otras prendas');
  });
  it('muestra de color para nombres conocidos', () => {
    expect(colorHex('Azul marino')).toBe('#1F2A44');
    expect(colorHex('color inventado')).toBeNull();
  });
});
