// Tras un despliegue, un móvil puede tener guardada (service worker) la web antigua, que pide trozos de código que
// ya no existen en el servidor. En Safari eso da "Importing a module script failed" y la web entraba en un bucle de
// "Algo salió mal" → recargar. Aquí se detecta, se borra la copia antigua y se recarga UNA vez con la versión nueva.

const FLAG = 'ev_stale_recovered_at';

export function isStaleChunkError(error: unknown): boolean {
  const msg = String((error as any)?.message || error || '');
  return /Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Unable to preload CSS|ChunkLoadError|Loading chunk \d+ failed/i.test(msg);
}

/** Borra cachés y service worker y recarga. Devuelve false si ya se intentó hace poco (para no hacer bucles). */
export async function recoverFromStaleBuild(): Promise<boolean> {
  try {
    const last = Number(sessionStorage.getItem(FLAG) || 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(FLAG, String(Date.now()));
  } catch { /* sin sessionStorage: se intenta igualmente */ }
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) || [];
    await Promise.all(regs.map((r) => r.unregister()));
  } catch { /* sin service worker */ }
  try {
    const keys = (await (window as any).caches?.keys?.()) || [];
    await Promise.all(keys.map((k: string) => caches.delete(k)));
  } catch { /* sin Cache API */ }
  window.location.reload();
  return true;
}

/** Envía al servidor un error de la web (para poder arreglarlo). Solo datos técnicos. */
export function reportWebError(error: unknown, where: string) {
  try {
    const e = error as any;
    const body = JSON.stringify({
      trace: `[web:${where}] ${e?.name || 'Error'}: ${e?.message || String(error)}\n${String(e?.stack || '').slice(0, 6000)}`,
      appVersion: 'web',
      android: navigator.userAgent.slice(0, 40),
      device: navigator.userAgent.slice(0, 80),
      at: new Date().toISOString(),
    });
    fetch('/api/diagnostics/crash', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  } catch { /* nada */ }
}
