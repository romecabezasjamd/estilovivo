import { afterEach, describe, expect, it, vi } from 'vitest';

const photo = (id: string) => ({
  id, color: '#C19A6B', alt_description: 'mujer con abrigo camel',
  urls: { small: `https://images.unsplash.com/photo-${id}?ixid=abc&w=400` },
  links: { html: `https://unsplash.com/photos/${id}`, download_location: `https://api.unsplash.com/photos/${id}/download?ixid=abc` },
  user: { name: 'Ana Foto', username: 'anafoto', links: { html: 'https://unsplash.com/@anafoto' } },
});

describe('inspirationPhotos (Unsplash)', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });

  it('sin clave no llama a Unsplash y devuelve una lista vacía', async () => {
    vi.stubEnv('UNSPLASH_ACCESS_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { inspirationPhotos } = await import('../unsplash.js');
    expect(await inspirationPhotos(['Camel'])).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('usa la URL de la API (hotlinking), da el crédito con utm y avisa de la descarga', async () => {
    vi.stubEnv('UNSPLASH_ACCESS_KEY', 'clave-de-prueba');
    let n = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/search/photos')) return new Response(JSON.stringify({ results: [photo(`p${n++}`)] }));
      return new Response('{}');
    });
    vi.stubGlobal('fetch', fetchMock);
    const { inspirationPhotos } = await import('../unsplash.js');
    const photos = await inspirationPhotos(['Camel', 'Punto', 'Desconocida']);
    expect(photos).toHaveLength(2);
    expect(photos[0].image).toBe('https://images.unsplash.com/photo-p0?ixid=abc&w=400');
    expect(photos[0].photographer).toBe('Ana Foto');
    expect(photos[0].photographerUrl).toBe('https://unsplash.com/@anafoto?utm_source=estilo_vivo&utm_medium=referral');
    expect(photos[0].unsplashUrl).toBe('https://unsplash.com/?utm_source=estilo_vivo&utm_medium=referral');
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('/search/photos') && u.includes('content_filter=high'))).toBe(true);
    expect(urls.some((u) => u.includes('/photos/p0/download'))).toBe(true);
    // La clave va en la cabecera, nunca en la URL
    expect(urls.every((u) => !u.includes('clave-de-prueba'))).toBe(true);
    // Segunda llamada: sale de la caché, sin volver a buscar
    const before = fetchMock.mock.calls.length;
    await inspirationPhotos(['Camel', 'Punto', 'Desconocida']);
    expect(fetchMock.mock.calls.length).toBe(before);
  });
});
