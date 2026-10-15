// Mide la latencia LOCAL de las peticiones principales de la app/web (mediana de N repeticiones).
// Uso (servidor local arrancado): node scripts/measure-endpoints.mjs <userId> [repeticiones]
import 'dotenv/config';
import jwt from 'jsonwebtoken';

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error(`Solo local: ${BASE}`);
const userId = process.argv[2];
const N = Number(process.argv[3] || 7);
if (!userId) throw new Error('Uso: node scripts/measure-endpoints.mjs <userId> [n]');
const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '10m' });
const paths = [
  '/api/auth/me', '/api/products?limit=100', '/api/looks?limit=100', '/api/looks/feed', '/api/products/shop',
  '/api/stories', '/api/chat/conversations', '/api/notifications', '/api/social/favorites', '/api/planner/me',
  '/api/trips/me', '/api/gamification/profile', '/api/stats', '/api/users/top', '/api/challenges/current',
];
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const out = [];
for (const p of paths) {
  const times = [];
  let status = 0;
  for (let i = 0; i < N; i++) {
    const t = performance.now();
    const r = await fetch(BASE + p, { headers: { Authorization: `Bearer ${token}` } });
    await r.arrayBuffer();
    status = r.status;
    times.push(performance.now() - t);
  }
  out.push({ path: p, status, medianMs: Math.round(median(times)) });
}
console.table(out);
