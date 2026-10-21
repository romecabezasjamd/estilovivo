import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { trustedProxies } from '../trustedProxies.js';

// Igual que en producción: la petición llega desde el proxy interno (aquí, localhost) con X-Forwarded-For.
const app = express();
app.set('trust proxy', trustedProxies({}));
app.get('/ip', (req, res) => { res.send(req.ip); });

describe('dirección real detrás de Cloudflare', () => {
  it('es la de la persona, no la del servidor de Cloudflare', async () => {
    const r = await request(app).get('/ip').set('X-Forwarded-For', '203.0.113.5, 104.16.0.1');
    expect(r.text).toBe('203.0.113.5');
  });

  it('no se puede falsear añadiendo una cabecera inventada', async () => {
    // La persona envía "1.2.3.4"; Cloudflare añade su dirección real (203.0.113.5) y la suya propia
    const r = await request(app).get('/ip').set('X-Forwarded-For', '1.2.3.4, 203.0.113.5, 172.64.1.1');
    expect(r.text).toBe('203.0.113.5');
  });

  it('con Cloudflare por IPv6 también', async () => {
    const r = await request(app).get('/ip').set('X-Forwarded-For', '198.51.100.7, 2606:4700::1');
    expect(r.text).toBe('198.51.100.7');
  });
});
