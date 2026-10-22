import { describe, it, expect } from 'vitest';
import { parseFeed, decodeEntities, fashionSection, interleave } from '../fashionTrends.js';
import { topShares, categoryLabel, colorHex } from '../communityTrends.js';

const NOW = Date.parse('2026-10-22T12:00:00Z');
const vogue = { url: 'x', source: 'Vogue', sourceName: 'Vogue España' };
const rss = `<rss><channel>
<item><title><![CDATA[Las 5 tendencias de moda del otoño &#8216;2026&#8217;]]></title><link>https://www.vogue.es/articulos/tendencias</link>
<category>Moda</category><category>Moda / Tendencias</category><pubDate>Tue, 21 Oct 2026 10:00:00 GMT</pubDate>
<description><![CDATA[<p>Texto largo del artículo</p>]]></description><media:thumbnail url="https://media.vogue.es/foto.jpg"/></item>
<item><title>Receta de cocina</title><link>https://www.vogue.es/cocina</link><category>Cocina</category><pubDate>Tue, 21 Oct 2026 10:00:00 GMT</pubDate></item>
<item><title>Bolso de la temporada</title><link>javascript:alert(1)</link><category>Moda</category></item>
<item><title>Uñas para otoño</title><link>https://www.vogue.es/belleza/unas</link><category>Moda</category><pubDate>Tue, 21 Oct 2026 10:00:00 GMT</pubDate></item>
<item><title>Abrigos de hace meses</title><link>https://www.vogue.es/moda/abrigos</link><category>Moda</category><pubDate>Fri, 26 Jun 2026 10:00:00 GMT</pubDate></item>
</channel></rss>`;

describe('titulares de revistas', () => {
  it('solo titular, publicación, fecha y enlace: sin foto ni texto del artículo', () => {
    const items = parseFeed(rss, vogue, 3, NOW);
    expect(items).toHaveLength(1);
    const h = items[0];
    expect(h.title).toBe('Las 5 tendencias de moda del otoño ‘2026’');
    expect(h.source).toBe('Vogue');
    expect(h.category).toBe('Tendencias');
    expect(h.publishedAt).toBe('2026-10-21T10:00:00.000Z');
    expect(JSON.stringify(h)).not.toContain('foto.jpg');
    expect(JSON.stringify(h)).not.toContain('Texto largo');
  });

  it('descarta lo que no es moda, los enlaces no seguros, la sección de belleza y lo antiguo', () => {
    const titles = parseFeed(rss, vogue, 10, NOW).map((h) => h.title);
    expect(titles).toEqual(['Las 5 tendencias de moda del otoño ‘2026’']);
  });

  it('reconoce la sección de moda por la ruta cuando no hay categorías', () => {
    expect(fashionSection([], 'https://www.telva.com/moda/tendencias/2026/10/22/x.html')).toBe('Tendencias');
    expect(fashionSection([], 'https://www.mujerhoy.com/moda/no-te-pierdas/looks.html')).toBe('Moda');
    expect(fashionSection([], 'https://www.elmundo.es/yodona/moda/2026/10/22/x.html')).toBe('Moda');
    expect(fashionSection([], 'https://www.trendencias.com/zapatos-mujer/nauticos')).toBe('Zapatos');
    expect(fashionSection([], 'https://www.trendencias.com/salud/entrenadora')).toBeNull();
    expect(fashionSection(['YoDona', 'belleza'], 'https://www.elmundo.es/yodona/belleza/x.html')).toBeNull();
  });

  it('intercala las publicaciones en su orden', () => {
    const mk = (source: string, n: number) => Array.from({ length: n }, (_, i) => ({ id: `${source}${i}`, title: '', source, sourceName: source, link: '', publishedAt: null, category: 'Moda' }));
    expect(interleave([mk('A', 2), mk('B', 1), mk('C', 2)]).map((h) => h.id)).toEqual(['A0', 'B0', 'C0', 'A1', 'C1']);
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
