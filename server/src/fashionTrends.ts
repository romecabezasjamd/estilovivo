// Titulares de moda de Vogue España y GQ España (sus feeds RSS públicos).
// Por derechos de autor solo se muestran el TITULAR, la revista, la fecha y el ENLACE a su web: nunca sus fotos
// ni sus textos (los hiperenlaces y los fragmentos muy breves están permitidos: art. 129 bis LPI / art. 15 Directiva
// 2019/790). La imagen de cada tarjeta la pone la app con diseño propio.
import logger from './logger.js';

export interface MagazineHeadline {
  id: string;
  title: string;
  /** Nombre corto para el botón "Leer en …". */
  source: 'Vogue' | 'GQ';
  sourceName: string;
  link: string;
  publishedAt: string | null;
  category: string;
}

const FEEDS: { url: string; source: MagazineHeadline['source']; sourceName: string }[] = [
  { url: 'https://www.vogue.es/feed/rss', source: 'Vogue', sourceName: 'Vogue España' },
  { url: 'https://www.revistagq.com/feed/rss', source: 'GQ', sourceName: 'GQ España' },
];

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

function tag(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  if (!m) return '';
  return decodeEntities(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}

/** Convierte un feed RSS en titulares (solo los de moda, máximo [limit]). */
export function parseFeed(xml: string, feed: (typeof FEEDS)[number], limit = 5): MagazineHeadline[] {
  return xml.split('<item>').slice(1, 20)
    .map((item) => {
      // Las revistas clasifican cada artículo ("Moda", "Compras / Moda", "Moda / Tendencias", "Belleza", "Living"…):
      // solo se usan los de la sección Moda, y como etiqueta su subsección ("Tendencias", "Relojes y Accesorios"…)
      const categories = [...item.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/gi)]
        .map((m) => decodeEntities(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).trim());
      const moda = categories.filter((c) => c.split('/').some((p) => /^moda$/i.test(p.trim())));
      const section = moda.flatMap((c) => c.split('/').map((p) => p.trim())).filter((p) => !/^(moda|compras)$/i.test(p)).pop();
      return { title: tag(item, 'title'), link: tag(item, 'link'), isModa: moda.length > 0, category: section || 'Moda', date: tag(item, 'pubDate') };
    })
    .filter((x) => x.isModa && x.title && /^https:\/\//i.test(x.link))
    .slice(0, limit)
    .map((x, i) => {
      const d = x.date ? new Date(x.date) : null;
      return {
        id: `${feed.source}-${i}-${x.link.length}`,
        title: x.title.slice(0, 160),
        source: feed.source,
        sourceName: feed.sourceName,
        link: x.link,
        publishedAt: d && !isNaN(d.getTime()) ? d.toISOString() : null,
        category: (x.category || 'Moda').slice(0, 30),
      };
    });
}

class MagazineHeadlinesService {
  private cache: MagazineHeadline[] = [];
  private lastUpdate = 0;
  private readonly ttl = 60 * 60 * 1000;

  async get(): Promise<MagazineHeadline[]> {
    if (this.cache.length > 0 && Date.now() - this.lastUpdate < this.ttl) return this.cache;
    try {
      const results = await Promise.all(FEEDS.map(async (feed) => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);
        try {
          const xml = await fetch(feed.url, { signal: ctrl.signal }).then((r) => r.text());
          return parseFeed(xml, feed);
        } catch (error) {
          logger.warn('No se pudo leer el feed de tendencias', { source: feed.source, error: (error as Error)?.message });
          return [];
        } finally {
          clearTimeout(timer);
        }
      }));
      // Intercaladas: Vogue, GQ, Vogue, GQ…
      const merged: MagazineHeadline[] = [];
      for (let i = 0; i < 5; i++) for (const list of results) if (list[i]) merged.push(list[i]);
      if (merged.length > 0) { this.cache = merged; this.lastUpdate = Date.now(); }
    } catch (error) {
      logger.error('Error al actualizar los titulares de moda', { error });
    }
    // Si fallan las revistas se devuelven los últimos titulares buenos (o ninguno): nunca contenido inventado
    return this.cache;
  }
}

export const magazineHeadlines = new MagazineHeadlinesService();
