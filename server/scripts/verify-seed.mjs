// Comprueba por API que el seed local (seed-local-demo.mjs) se ve bien para la autora. Uso: node scripts/verify-seed.mjs <creds.json>
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const c = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const get = async (p, t) => (await fetch(BASE + p, { headers: t ? { Authorization: `Bearer ${t}` } : {} }));
const lr = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: c.author.email, password: c.password }) });
const t = (await lr.json()).token; assert.ok(t, 'login');
const convs = await (await get('/api/chat/conversations', t)).json();
const withThumb = convs.filter((x) => x.messages[0]?.storyThumb);
assert.equal(withThumb.length, 1); assert.ok(convs.some((x) => x.messages[0]?.storyId && x.messages[0].storyThumb === null));
assert.equal((await get(withThumb[0].messages[0].storyThumb)).status, 200);
console.log('chat: 2 reacciones; miniatura accesible (200):', withThumb[0].messages[0].storyThumb);
const cur = await (await get('/api/challenges/current', t)).json(); assert.equal(cur.id, c.challengeId);
const subs = await (await get('/api/challenges/my-submissions', t)).json(); assert.equal(subs[0].status, 'PENDING'); assert.equal((await get(subs[0].imageUrl)).status, 200);
console.log('reto actual:', cur.title, '| participación:', subs[0].status, subs[0].imageUrl);
const mine = (await (await get('/api/products', t)).json()).items.filter((p) => p.forSale);
assert.equal(mine.length, 2); for (const p of mine) { assert.ok(p.price > 0); assert.equal((await get(p.images[0].url)).status, 200); }
const shop = await (await get('/api/products/shop', t)).json();
assert.deepEqual(shop.map((p) => p.id).filter((id) => id === c.otherSellerProductId), [c.otherSellerProductId]); assert.ok(!shop.some((p) => mine.map((m) => m.id).includes(p.id)));
console.log('prendas en venta propias:', mine.map((p) => `${p.name} ${p.price}`).join(', '), '| tienda ve la de otro usuario y no las propias');
console.log('SEED OK');
