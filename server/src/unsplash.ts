// Fotos de inspiración de Unsplash para el tablero de la semana.
// Normas de su API (https://unsplash.com/api-terms y las API Guidelines):
//  - las fotos se muestran con las URL que devuelve la API (hotlinking), nunca copiadas a nuestro servidor;
//  - cada foto lleva "Foto de <fotógrafo> en Unsplash" con enlace a su perfil y a Unsplash (con utm_source);
//  - al usar una foto se avisa a su `download_location`;
//  - la clave (Access Key) solo vive en el servidor (UNSPLASH_ACCESS_KEY) y las búsquedas se hacen desde aquí,
//    así que a Unsplash no le llega ningún dato de la cuenta de nadie.
import logger from './logger.js';

export interface InspirationPhoto {
  id: string;
  /** URL de la imagen tal como la da la API (con su `ixid`), en tamaño pequeño para el tablero. */
  image: string;
  alt: string;
  color: string | null;
  /** Palabra de la semana con la que se buscó. */
  keyword: string;
  photographer: string;
  photographerUrl: string;
  photoUrl: string;
  unsplashUrl: string;
}

const UTM = 'utm_source=estilo_vivo&utm_medium=referral';
const withUtm = (url: string) => url + (url.includes('?') ? '&' : '?') + UTM;

// Palabras de la semana (vocabulario propio) → búsqueda en inglés, que es como mejor responde Unsplash
const QUERY: Record<string, string> = {
  Vaqueros: 'denim jeans outfit', Abrigos: 'coat outfit', Chaquetas: 'jacket outfit', Americanas: 'blazer outfit',
  Gabardinas: 'trench coat outfit', Plumas: 'puffer jacket outfit', Punto: 'knit sweater outfit', Faldas: 'skirt outfit',
  Vestidos: 'dress outfit', Pantalones: 'trousers outfit', Camisas: 'shirt outfit', Camisetas: 't-shirt outfit',
  Zapatillas: 'sneakers outfit', Bailarinas: 'ballet flats outfit', 'Náuticos': 'boat shoes outfit', Mocasines: 'loafers outfit',
  Botas: 'boots outfit', Tacones: 'heels outfit', Bolsos: 'handbag fashion', Relojes: 'wristwatch fashion', 'Gafas de sol': 'sunglasses fashion',
  Burdeos: 'burgundy outfit', 'Marrón': 'brown outfit', Camel: 'camel coat outfit', Beige: 'beige outfit', Negro: 'all black outfit',
  Blanco: 'white outfit', Rojo: 'red outfit', Rosa: 'pink outfit', Verde: 'olive green outfit', 'Azul marino': 'navy outfit',
  Paisley: 'paisley fashion', Cuadros: 'plaid outfit', Rayas: 'striped outfit', Lunares: 'polka dot outfit', 'Animal print': 'leopard print outfit',
  Terciopelo: 'velvet fashion', Piel: 'leather jacket outfit', Tweed: 'tweed outfit', Oversize: 'oversized outfit', Midi: 'midi skirt outfit',
  Vintage: 'vintage outfit', Minimalismo: 'minimalist outfit',
};
const FALLBACK = 'street style outfit';
const MAX_PHOTOS = 4;
// Solo para pruebas locales con un Unsplash simulado; en producción no se define
const API_BASE = (process.env.UNSPLASH_API_BASE || 'https://api.unsplash.com').replace(/\/$/, '');
const TTL = 12 * 60 * 60 * 1000;
const MIN_REFRESH = 60 * 60 * 1000;

let cache: { at: number; key: string; photos: InspirationPhoto[] } = { at: 0, key: '', photos: [] };
let inFlight: Promise<InspirationPhoto[]> | null = null;
const notified = new Set<string>();

async function api(path: string, key: string): Promise<any> {
  const res = await fetch(API_BASE + path, {
    headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Unsplash ${res.status}`);
  return res.json();
}

async function search(keyword: string, key: string, used: Set<string>): Promise<InspirationPhoto | null> {
  const q = encodeURIComponent(QUERY[keyword] || FALLBACK);
  const data = await api(`/search/photos?query=${q}&per_page=10&orientation=portrait&content_filter=high`, key);
  const p = (data?.results || []).find((r: any) => r?.id && !used.has(r.id) && r.urls?.small && r.user?.name);
  if (!p) return null;
  used.add(p.id);
  // Aviso de uso que pide Unsplash (una vez por foto mientras el servidor esté encendido)
  if (p.links?.download_location && !notified.has(p.id)) {
    notified.add(p.id);
    const loc = String(p.links.download_location).replace(/^https?:\/\/[^/]+/, '');
    api(loc, key).catch(() => notified.delete(p.id));
  }
  return {
    id: p.id,
    image: p.urls.small,
    alt: p.alt_description || p.description || `Foto de moda: ${keyword}`,
    color: typeof p.color === 'string' ? p.color : null,
    keyword,
    photographer: p.user.name,
    photographerUrl: withUtm(p.user.links?.html || `https://unsplash.com/@${p.user.username}`),
    photoUrl: withUtm(p.links?.html || `https://unsplash.com/photos/${p.id}`),
    unsplashUrl: withUtm('https://unsplash.com/'),
  };
}

/** Hasta 4 fotos de Unsplash buscadas con las palabras de la semana. Sin clave configurada (o si Unsplash falla) → []. */
export async function inspirationPhotos(keywords: string[]): Promise<InspirationPhoto[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY?.trim();
  if (!key) return [];
  const words = keywords.filter((k) => QUERY[k]).slice(0, MAX_PHOTOS);
  const cacheKey = words.join('|');
  const age = Date.now() - cache.at;
  if (cache.photos.length > 0 && (age < MIN_REFRESH || (cache.key === cacheKey && age < TTL))) return cache.photos;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const used = new Set<string>();
      const list = words.length > 0 ? words : ['', '', ''];
      const photos: InspirationPhoto[] = [];
      for (const w of list) {
        const p = await search(w, key, used).catch(() => null);
        if (p) photos.push(p);
      }
      if (photos.length > 0) cache = { at: Date.now(), key: cacheKey, photos };
      return photos.length > 0 ? photos : cache.photos;
    } catch (error) {
      logger.warn('No se pudieron cargar las fotos de Unsplash', { error: String(error) });
      return cache.photos;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}
