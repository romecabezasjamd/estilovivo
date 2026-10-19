import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';

/**
 * Regresiones de seguridad: acceso a datos de otra usuaria (IDOR),
 * subida de ficheros y fugas de información.
 */
describe('Security regressions', () => {
  const stamp = Date.now();
  let tokenA = '';
  let tokenB = '';
  let userA = '';

  const register = async (email: string) => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'password123', name: 'Usuaria Test', birthDate: '1995-05-05' });
    expect(res.status).toBe(201);
    return { token: res.body.token as string, id: res.body.user.id as string };
  };

  beforeAll(async () => {
    const a = await register(`sec-a-${stamp}@example.com`);
    const b = await register(`sec-b-${stamp}@example.com`);
    tokenA = a.token;
    userA = a.id;
    tokenB = b.token;
  });

  it('no expone campos sensibles al registrarse', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.password).toBeUndefined();
    expect(res.body.verificationToken).toBeUndefined();
    expect(res.body.resetToken).toBeUndefined();
  });

  it('no permite leer el planner de otra usuaria', async () => {
    const res = await request(app)
      .get(`/api/planner/${userA}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(403);
  });

  it('no permite escribir en el planner de otra usuaria', async () => {
    const res = await request(app)
      .post('/api/planner')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ date: '2030-01-01', eventNote: 'intrusión', userId: userA });
    expect(res.status).toBe(200);
    // La entrada se crea en la cuenta de B, nunca en la de A
    const aPlanner = await request(app)
      .get('/api/planner/me')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(aPlanner.body.find((e: any) => e.date === '2030-01-01')).toBeUndefined();
  });

  it('no permite leer los viajes de otra usuaria', async () => {
    const res = await request(app)
      .get(`/api/trips/${userA}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(403);
  });

  it('no permite modificar items de un viaje ajeno', async () => {
    const tripA = await request(app)
      .post('/api/trips')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ destination: 'Roma', dateStart: '2030-05-01', dateEnd: '2030-05-03', items: [{ label: 'Pasaporte' }] });
    expect(tripA.status).toBe(201);
    const itemId = tripA.body.items[0].id;

    const tripB = await request(app)
      .post('/api/trips')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ destination: 'Lisboa', dateStart: '2030-06-01', dateEnd: '2030-06-02' });
    expect(tripB.status).toBe(201);

    // B usa SU viaje pero el item de A
    const res = await request(app)
      .put(`/api/trips/${tripB.body.id}/items/${itemId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ checked: true });
    expect(res.status).toBe(404);
  });

  it('no permite vincular prendas ajenas a un look', async () => {
    const product = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Camisa', category: 'top' });
    expect(product.status).toBe(201);

    const look = await request(app)
      .post('/api/looks')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ title: 'Look', productIds: JSON.stringify([product.body.id]) });
    expect(look.status).toBe(201);
    expect(look.body.products).toHaveLength(0);
  });

  it('no permite dar like a un look privado ajeno', async () => {
    const look = await request(app)
      .post('/api/looks')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Privado', productIds: '[]', isPublic: false });
    const res = await request(app)
      .post('/api/social/like')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ lookId: look.body.id });
    expect(res.status).toBe(404);
  });

  it('rechaza imageUrl externas en mensajes de chat', async () => {
    const conv = await request(app)
      .post('/api/chat/conversations')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ targetUserId: userA });
    expect([200, 201]).toContain(conv.status);
    const res = await request(app)
      .post(`/api/chat/conversations/${conv.body.id}/messages`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ content: 'hola', imageUrl: 'javascript:alert(1)' });
    expect(res.status).toBe(400);
  });

  it('el health check no expone datos internos', async () => {
    const res = await request(app).get('/api/health');
    expect(res.body.databaseUrl).toBeUndefined();
    expect(res.body.userCount).toBeUndefined();
  });

  it('los endpoints de depuración ya no existen', async () => {
    const res = await request(app)
      .get('/api/debug-db')
      .set('Authorization', `Bearer ${tokenA}`);
    expect([401, 403, 404]).toContain(res.status);
  });
});
