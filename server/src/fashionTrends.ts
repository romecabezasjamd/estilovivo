// Titulares de moda de revistas y webs españolas, a partir de sus feeds RSS PÚBLICOS (los que las propias
// publicaciones ofrecen para que se enlacen sus artículos). No se usan webs que bloquean el acceso automático.
// Por derechos de autor solo se muestran el TITULAR, la publicación, la fecha y el ENLACE a su web: nunca sus fotos
// ni sus textos (los hiperenlaces y los fragmentos muy breves están permitidos: art. 129 bis LPI / art. 15 Directiva
// 2019/790). Las apps muestran el nombre de cada publicación con diseño propio (no su logotipo, que es marca registrada).
import logger from './logger.js';

export interface MagazineHeadline {
  id: string;
  title: string;
  /** Nombre corto de la publicación ("Vogue", "Telva"…), para el sello y el botón "Leer en …". */
  source: string;
  sourceName: string;
  link: string;
  publishedAt: string | null;
  category: string;
}

export interface Feed {
  url: string;
  source: string;
  sourceName: string;
}

// Ordenadas de más a menos conocidas: así salen primero en la lista
export const FEEDS: Feed[] = [
  { url: 'https://www.vogue.es/feed/rss', source: 'Vogue', sourceName: 'Vogue España' },
  { url: 'https://www.revistagq.com/feed/rss', source: 'GQ', sourceName: 'GQ España' },
  { url: 'https://www.glamour.es/feed/rss', source: 'Glamour', sourceName: 'Glamour España' },
  { url: 'https://www.marie-claire.es/rss', source: 'Marie Claire', sourceName: 'Marie Claire España' },
  { url: 'https://www.telva.com/rss/portada.xml', source: 'Telva', sourceName: 'Telva' },
  { url: 'https://www.elmundo.es/rss/yodona.xml', source: 'Yo Dona', sourceName: 'Yo Dona (El Mundo)' },
  { url: 'https://www.mujerhoy.com/rss/2.0/portada', source: 'Mujerhoy', sourceName: 'Mujerhoy' },
  { url: 'https://www.trendencias.com/index.xml', source: 'Trendencias', sourceName: 'Trendencias' },
];

const PER_SOURCE = 3;
const MAX_AGE_DAYS = 7;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

const clean = (s: string) => decodeEntities(s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();

function tag(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? clean(m[1]) : '';
}

// Secciones de moda: por la categoría que pone la revista o por la ruta del enlace (/moda/…, /zapatos-mujer/…)
const FASHION_PATH = /^\/(?:[a-z-]+\/)?(moda|moda-[a-z-]+|zapatos-[a-z-]+|calzado-[a-z-]+|ropa-[a-z-]+|street-style|tendencias|shopping)(\/|$)/i;
const NOT_FASHION_PATH = /^\/(?:[a-z-]+\/)?(belleza|bienestar|vida-saludable|salud|horoscopo|lifestyle|planeta-mujer|silver|celebrities|vivir)(\/|$)/i;
const SECTION_LABEL: Record<string, string> = {
  tendencias: 'Tendencias', 'street-style': 'Street style', shopping: 'Compras', 'zapatos-mujer': 'Zapatos', 'calzado-ellos': 'Zapatillas',
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Sección de moda del artículo ("Tendencias", "Relojes y Accesorios"…), o null si no es de moda. */
export function fashionSection(categories: string[], link: string): string | null {
  let path = '';
  try { path = new URL(link).pathname; } catch { return null; }
  // Artículos publicados en otras secciones (belleza, bienestar…) aunque lleven la etiqueta "Moda"
  if (NOT_FASHION_PATH.test(path)) return null;
  const moda = categories.filter((c) => c.split('/').some((p) => /^moda$/i.test(p.trim())));
  if (moda.length > 0) {
    const sub = moda.flatMap((c) => c.split('/').map((p) => p.trim())).filter((p) => !/^(moda|compras)$/i.test(p)).pop();
    return sub && sub.length <= 30 ? sub : 'Moda';
  }
  const m = path.match(FASHION_PATH);
  if (!m) return null;
  const segments = path.split('/').filter(Boolean);
  const after = segments[segments.indexOf(m[1]) + 1];
  if (/^moda$/i.test(m[1]) && after && SECTION_LABEL[after]) return SECTION_LABEL[after];
  return SECTION_LABEL[m[1].toLowerCase()] || (/^moda/i.test(m[1]) ? 'Moda' : capitalize(m[1].replace(/-/g, ' ')));
}

/** Convierte un feed RSS en titulares de moda recientes (máximo [limit]). */
export function parseFeed(xml: string, feed: Feed, limit = PER_SOURCE, now = Date.now()): MagazineHeadline[] {
  return xml.split(/<item[\s>]/).slice(1, 40)
    .map((item) => {
      const categories = [...item.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/gi)].map((m) => clean(m[1]));
      const link = tag(item, 'link') || tag(item, 'guid');
      const date = new Date(tag(item, 'pubDate') || tag(item, 'dc:date'));
      return { title: tag(item, 'title'), link, section: fashionSection(categories, link), date: isNaN(date.getTime()) ? null : date };
    })
    .filter((x) => x.section && x.title && /^https:\/\//i.test(x.link) && (!x.date || now - x.date.getTime() < MAX_AGE_DAYS * 86400000))
    // Lo más reciente primero (los artículos sin fecha, al final)
    .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0))
    .slice(0, limit)
    .map((x, i) => ({
      id: `${feed.source}-${i}-${x.link.length}`.replace(/\s+/g, ''),
      title: x.title.slice(0, 180),
      source: feed.source,
      sourceName: feed.sourceName,
      link: x.link,
      publishedAt: x.date ? x.date.toISOString() : null,
      category: x.section!,
    }));
}

/** Intercala las publicaciones en su orden de fama: la 1.ª de cada una, luego la 2.ª de cada una… */
export function interleave(lists: MagazineHeadline[][]): MagazineHeadline[] {
  const out: MagazineHeadline[] = [];
  for (let i = 0; i < PER_SOURCE; i++) for (const list of lists) if (list[i]) out.push(list[i]);
  return out;
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
          const res = await fetch(feed.url, { signal: ctrl.signal, headers: { 'User-Agent': 'EstiloVivo/1.0 (+https://estilovivo.xyoncloud.win)' } });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return parseFeed(await res.text(), feed);
        } catch (error) {
          logger.warn('No se pudo leer el feed de tendencias', { source: feed.source, error: (error as Error)?.message });
          return [];
        } finally {
          clearTimeout(timer);
        }
      }));
      const merged = interleave(results);
      if (merged.length > 0) { this.cache = merged; this.lastUpdate = Date.now(); }
    } catch (error) {
      logger.error('Error al actualizar los titulares de moda', { error });
    }
    // Si fallan las revistas se devuelven los últimos titulares buenos (o ninguno): nunca contenido inventado
    return this.cache;
  }
}

export const magazineHeadlines = new MagazineHeadlinesService();
