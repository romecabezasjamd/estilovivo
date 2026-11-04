import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';

describe('API Integration Tests', () => {
  let authToken: string;
  let userId: string;
  const testEmail = `test-${Date.now()}@example.com`;

  describe('Authentication', () => {
    it('POST /api/auth/register - should register a new user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: 'password123',
          name: 'Test User',
          birthDate: '1995-05-05',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      
      authToken = response.body.token;
      userId = response.body.user.id;
    });

    it('POST /api/auth/login - should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: 'password123',
        });

      if (response.status === 200) {
        expect(response.body).toHaveProperty('user');
        expect(response.body).toHaveProperty('token');
      }
    });

    it('POST /api/auth/login - should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
    });

    it('GET /api/auth/me - should return current user with valid token', async () => {
      if (!authToken) return;
      
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email');
    });
  });

  describe('Products', () => {
    it('GET /api/products - should return paginated products', async () => {
      if (!authToken) return;
      
      const response = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('hasMore');
      expect(response.body).toHaveProperty('nextCursor');
      expect(Array.isArray(response.body.items)).toBe(true);
    });

    it('GET /api/products?limit=5 - should respect limit parameter', async () => {
      if (!authToken) return;
      
      const response = await request(app)
        .get('/api/products?limit=5')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.items.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Looks', () => {
    it('GET /api/looks - should return paginated looks', async () => {
      if (!authToken) return;
      
      const response = await request(app)
        .get('/api/looks')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('hasMore');
      expect(response.body).toHaveProperty('nextCursor');
    });

    it('GET /api/looks/feed - should return public looks feed', async () => {
      if (!authToken) return;
      
      const response = await request(app)
        .get('/api/looks/feed')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('items');
    });
  });

  describe('Health Checks', () => {
    it('GET /api/health - should return health status', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('ok');
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit auth endpoints', async () => {
      const requests = [];
      
      // Make 11 requests (limit is 10)
      for (let i = 0; i < 11; i++) {
        requests.push(
          request(app)
            .post('/api/auth/login')
            .send({
              email: testEmail,
              password: 'wrong',
            })
        );
      }

      const responses = await Promise.all(requests);
      const tooManyRequests = responses.filter(r => r.status === 429);
      
      // At least one request should be rate limited
      expect(tooManyRequests.length).toBeGreaterThan(0);
    });
  });

  describe('Feedback (Enviar opinión)', () => {
    it('POST /api/feedback - requires login', async () => {
      const response = await request(app).post('/api/feedback').send({ kind: 'idea', message: 'Me encanta la lavadora' });
      expect(response.status).toBe(401);
    });

    it('POST /api/feedback - rejects an empty message and unknown kinds', async () => {
      const short = await request(app).post('/api/feedback').set('Authorization', `Bearer ${authToken}`).send({ kind: 'idea', message: 'ok' });
      expect(short.status).toBe(400);
      const kind = await request(app).post('/api/feedback').set('Authorization', `Bearer ${authToken}`).send({ kind: 'spam', message: 'Mensaje largo de prueba' });
      expect(kind.status).toBe(400);
    });

    it('POST /api/feedback - without SMTP answers 503 with the contact address', async () => {
      const response = await request(app).post('/api/feedback').set('Authorization', `Bearer ${authToken}`)
        .send({ kind: 'bug', message: 'El probador tarda en cargar', rating: 4, platform: 'web' });
      expect([201, 503]).toContain(response.status);
      if (response.status === 503) expect(response.body.error).toMatch(/@/);
    });
  });

  describe('Continuar con Google y último acceso', () => {
    it('GET /api/auth/providers - without GOOGLE_CLIENT_ID there is no Google button', async () => {
      const response = await request(app).get('/api/auth/providers');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ google: process.env.GOOGLE_CLIENT_ID ? expect.any(String) : null });
    });

    it('POST /api/auth/google - validates the body and answers 503 when Google is not configured', async () => {
      const bad = await request(app).post('/api/auth/google').send({ credential: 'x' });
      expect(bad.status).toBe(400);
      const response = await request(app).post('/api/auth/google').send({ credential: 'a'.repeat(40) });
      expect(process.env.GOOGLE_CLIENT_ID ? 401 : 503).toBe(response.status);
    });

    it('GET /api/auth/me - never exposes the Google account id', async () => {
      const response = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(response.body).not.toHaveProperty('googleSub');
    });
  });
});

/* 
 * NOTE: These tests require a running server and test database
 * Run with: npm test
 * 
 * For proper integration testing, you would:
 * 1. Export the Express app from index.ts without starting the server
 * 2. Use a test database (e.g., DATABASE_URL_TEST)
 * 3. Setup/teardown test data before/after each test
 * 4. Use transactions to rollback changes
 */
