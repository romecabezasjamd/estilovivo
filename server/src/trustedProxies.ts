// Proxies de confianza para saber la dirección real de cada persona (req.ip), que usan los límites de intentos.
// Camino de una petición: persona → Cloudflare → proxy de Coolify (red interna) → servidor. Solo se confía en
// las redes internas y en los rangos publicados de Cloudflare (https://www.cloudflare.com/ips/), así que nadie
// puede falsear su dirección añadiendo cabeceras: la primera dirección "no de confianza" es la de la persona.
// TRUSTED_PROXIES (separadas por comas) permite añadir otros rangos si cambia la infraestructura.

export const CLOUDFLARE_RANGES = [
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18', '108.162.192.0/18',
  '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13',
  '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
  '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32', '2a06:98c0::/29', '2c0f:f248::/32',
];

export function trustedProxies(env: NodeJS.ProcessEnv = process.env): string[] {
  const extra = (env.TRUSTED_PROXIES || '').split(',').map((v) => v.trim()).filter(Boolean);
  return ['loopback', 'linklocal', 'uniquelocal', ...CLOUDFLARE_RANGES, ...extra];
}
