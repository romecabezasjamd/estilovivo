// Panel de administración. La administradora es una cuenta normal con permiso extra, que solo se concede desde el
// servidor (ADMIN_EMAILS / ADMIN_USER_IDS en Coolify). Para entrar al panel además hay que confirmar un código de un
// solo uso enviado al correo de la cuenta (segundo paso). Cada acción queda registrada en AdminAction.
// Nunca se muestran contraseñas, mensajes privados no denunciados ni la fecha de nacimiento (solo "menor/adulto").
import express from 'express';
import type { Express, Request, Response, NextFunction, RequestHandler } from 'express';
import type { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { REASON_LABEL, TYPE_LABEL, type ModerationDecision } from './moderation.js';
import { ageFrom, ADULT_AGE } from './minors.js';

type Mail = { to: string; subject: string; text: string; html?: string };

export interface AdminDeps {
  prisma: PrismaClient;
  logger: { info: (...a: any[]) => void; warn: (...a: any[]) => void; error: (...a: any[]) => void };
  jwtSecret: string;
  production: boolean;
  authenticateToken: RequestHandler;
  isAdminUser: (userId?: string) => Promise<boolean>;
  sendMail: ((m: Mail) => Promise<unknown>) | null;
  teamEmail: () => string;
  describeReportTarget: (type: string, id: string) => Promise<{ ownerId: string; text?: string | null; image?: string | null } | null>;
  removeReportedContent: (type: string, id: string) => Promise<boolean>;
  removeProduct: (id: string) => Promise<{ userId: string; name: string } | null>;
  suspendUser: (id: string) => Promise<void>;
  unsuspendUser: (id: string) => Promise<void>;
  notifyModerationDecision: (userId: string, d: ModerationDecision) => Promise<void>;
  removeXp: (userId: string, xp: number) => Promise<unknown>;
  /** Crea un aviso del servicio para todas las cuentas activas (con push). Devuelve a cuántas. */
  broadcast: (content: string) => Promise<number>;
}

export const PRIVACY_TYPES: Record<string, string> = {
  ACCESS: 'Acceso a mis datos',
  RECTIFY: 'Corregir mis datos',
  DELETE: 'Borrar mis datos',
  OBJECT: 'Oponerme a un uso de mis datos',
  RESTRICT: 'Limitar el uso de mis datos',
  PORTABILITY: 'Llevarme mis datos',
  OTHER: 'Otra consulta de privacidad',
};

const DAY = 24 * 3600 * 1000;
export const PRIVACY_DEADLINE_DAYS = 30;
const ADMIN_SESSION_HOURS = 12;
const CODE_MINUTES = 10;

/** Huella de un fallo: primeras líneas significativas sin números (líneas, ids, horas), para agrupar repeticiones. */
export function crashSignature(trace: string): { signature: string; title: string } {
  const lines = trace.split('\n').map((l) => l.trim()).filter(Boolean);
  const title = (lines[0] || 'Error').slice(0, 200);
  const key = lines.slice(0, 4).join('\n').replace(/\d+/g, '#').replace(/0x[0-9a-f]+/gi, '#');
  return { signature: crypto.createHash('sha1').update(key).digest('hex').slice(0, 16), title };
}

/** Guarda un informe de cierre. isNew = primera vez que se ve este fallo en 24 h (para avisar por correo solo entonces). */
export async function recordCrash(prisma: PrismaClient, r: { trace: string; source: string; version?: string; device?: string; userId?: string | null }) {
  const { signature, title } = crashSignature(r.trace);
  const recent = await prisma.crashReport.count({ where: { signature, createdAt: { gte: new Date(Date.now() - DAY) } } });
  await prisma.crashReport.create({
    data: { signature, title, source: r.source, version: r.version || null, device: r.device || null, userId: r.userId || null, trace: r.trace },
  });
  return { isNew: recent === 0, signature };
}

/** Borra lo que ya no hace falta guardar (minimización de datos, RGPD art. 5.1.e). */
export async function purgeOldAdminData(prisma: PrismaClient, now = Date.now()) {
  const d90 = new Date(now - 90 * DAY);
  const y3 = new Date(now - 3 * 365 * DAY);
  await Promise.all([
    prisma.blockedUpload.deleteMany({ where: { createdAt: { lt: d90 } } }),
    prisma.crashReport.deleteMany({ where: { createdAt: { lt: d90 } } }),
    prisma.adminAction.deleteMany({ where: { createdAt: { lt: y3 } } }),
    prisma.privacyRequest.deleteMany({ where: { status: { not: 'OPEN' }, resolvedAt: { lt: y3 } } }),
  ]);
}

export const maskEmail = (email: string) => {
  const [u, d] = email.split('@');
  return `${u.slice(0, 2)}${'•'.repeat(Math.max(1, Math.min(6, u.length - 2)))}@${d || ''}`;
};

const ageBand = (birthDate: Date | null) => {
  const age = ageFrom(birthDate);
  if (age === null) return 'Sin fecha';
  return age < ADULT_AGE ? 'Menor (14-17)' : 'Mayor de edad';
};

const str = (v: unknown, min: number, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length >= min && t.length <= max ? t : null;
};

export function registerAdminRoutes(app: Express, deps: AdminDeps) {
  const { prisma, logger } = deps;
  const adminSecret = `${deps.jwtSecret}:admin-panel`;
  const codes = new Map<string, { hash: string; exp: number; tries: number }>();
  const codeSends = new Map<string, number[]>();
  let lastBroadcast = 0;

  const log = (adminId: string, action: string, targetType?: string | null, targetId?: string | null, details?: string | null) =>
    prisma.adminAction.create({ data: { adminId, action, targetType: targetType || null, targetId: targetId || null, details: details?.slice(0, 1000) || null } })
      .catch((error) => logger.error('No se pudo registrar la acción de administración', { error }));

  const onlyAdmin: RequestHandler = (req: any, res, next) => {
    deps.isAdminUser(req.user?.userId).then((ok) => (ok ? next() : res.status(403).json({ error: 'No tienes permiso de administración', code: 'NOT_ADMIN' })))
      .catch(() => res.status(500).json({ error: 'Error al comprobar el permiso' }));
  };

  /** Comprueba el segundo paso: token del panel firmado para esta misma cuenta. */
  const panelSession: RequestHandler = (req: any, res, next) => {
    const token = req.headers['x-admin-token'];
    try {
      const p: any = jwt.verify(typeof token === 'string' ? token : '', adminSecret);
      if (p?.scope !== 'admin' || p?.sub !== req.user.userId) throw new Error('otra cuenta');
      next();
    } catch {
      res.status(403).json({ error: 'Confirma el código enviado a tu correo para entrar al panel', code: 'ADMIN_2FA_REQUIRED' });
    }
  };

  const wrap = (fn: (req: any, res: Response) => Promise<unknown>) => (req: Request, res: Response, _next: NextFunction) =>
    fn(req, res).catch((error) => {
      logger.error('Error en el panel de administración', { route: req.originalUrl, error: error?.message || error });
      if (!res.headersSent) res.status(500).json({ error: 'Error en el panel de administración' });
    });

  // ---------- Segundo paso (código por correo) ----------
  app.post('/api/admin/session/start', deps.authenticateToken, onlyAdmin, wrap(async (req, res) => {
    const userId: string = req.user.userId;
    const sends = (codeSends.get(userId) || []).filter((t) => Date.now() - t < 15 * 60 * 1000);
    if (sends.length >= 5) return res.status(429).json({ error: 'Has pedido muchos códigos. Espera 15 minutos.' });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
    if (!user) return res.status(404).json({ error: 'Cuenta no encontrada' });
    if (!deps.sendMail && deps.production) return res.status(503).json({ error: 'El correo no está configurado en el servidor' });
    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    codes.set(userId, { hash: crypto.createHash('sha256').update(code).digest('hex'), exp: Date.now() + CODE_MINUTES * 60 * 1000, tries: 0 });
    codeSends.set(userId, [...sends, Date.now()]);
    if (deps.sendMail) {
      await deps.sendMail({
        to: user.email,
        subject: `Tu código del panel: ${code} - Estilo Vivo`,
        text: `Hola ${user.name}:\n\nTu código para entrar al panel de administración de Estilo Vivo es ${code}. Caduca en ${CODE_MINUTES} minutos.\n\nSi no has sido tú, cambia tu contraseña cuanto antes.`,
      });
    } else {
      logger.info('Código del panel (solo en local, sin correo configurado)', { code });
    }
    res.json({ sent: true, email: maskEmail(user.email), minutes: CODE_MINUTES });
  }));

  app.post('/api/admin/session/verify', deps.authenticateToken, onlyAdmin, wrap(async (req, res) => {
    const userId: string = req.user.userId;
    const entry = codes.get(userId);
    const code = String(req.body?.code || '').replace(/\D/g, '');
    if (!entry || entry.exp < Date.now()) { codes.delete(userId); return res.status(400).json({ error: 'El código ha caducado. Pide otro.' }); }
    entry.tries += 1;
    if (entry.tries > 5) { codes.delete(userId); return res.status(429).json({ error: 'Demasiados intentos. Pide otro código.' }); }
    const given = crypto.createHash('sha256').update(code).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(given), Buffer.from(entry.hash))) return res.status(400).json({ error: 'El código no es correcto' });
    codes.delete(userId);
    const adminToken = jwt.sign({ sub: userId, scope: 'admin' }, adminSecret, { expiresIn: `${ADMIN_SESSION_HOURS}h` });
    void log(userId, 'PANEL_LOGIN');
    res.json({ adminToken, expiresAt: new Date(Date.now() + ADMIN_SESSION_HOURS * 3600 * 1000).toISOString() });
  }));

  const r = express.Router();
  r.use(deps.authenticateToken, onlyAdmin, panelSession);

  // ---------- Resumen ----------
  r.get('/overview', wrap(async (_req, res) => {
    const weekAgo = new Date(Date.now() - 7 * DAY);
    const [openReports, blocked7, crashes7, privacyOpen, privacySoon, users, newUsers, suspended, forSale] = await Promise.all([
      prisma.report.count({ where: { status: 'OPEN' } }),
      prisma.blockedUpload.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.crashReport.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.privacyRequest.count({ where: { status: 'OPEN' } }),
      prisma.privacyRequest.count({ where: { status: 'OPEN', createdAt: { lt: new Date(Date.now() - (PRIVACY_DEADLINE_DAYS - 7) * DAY) } } }),
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.user.count({ where: { suspendedAt: { not: null } } }),
      prisma.product.count({ where: { forSale: true } }),
    ]);
    res.json({ openReports, blocked7, crashes7, privacyOpen, privacySoon, users, newUsers, suspended, forSale });
  }));

  // ---------- Denuncias ----------
  r.get('/reports', wrap(async (req, res) => {
    const open = req.query.status !== 'CLOSED';
    const reports = await prisma.report.findMany({
      where: open ? { status: 'OPEN' } : { status: { not: 'OPEN' } },
      orderBy: { createdAt: open ? 'asc' : 'desc' },
      take: 50,
    });
    const items = await Promise.all(reports.map(async (rep) => {
      const target = await deps.describeReportTarget(rep.targetType, rep.targetId);
      const ownerId = target?.ownerId ?? (rep.targetType === 'USER' ? rep.targetId : null);
      const [reporter, owner, others] = await Promise.all([
        prisma.user.findUnique({ where: { id: rep.reporterId }, select: { name: true } }),
        ownerId ? prisma.user.findUnique({ where: { id: ownerId }, select: { id: true, name: true, suspendedAt: true } }) : null,
        prisma.report.count({ where: { targetType: rep.targetType, targetId: rep.targetId, status: 'OPEN', id: { not: rep.id } } }),
      ]);
      return {
        id: rep.id, status: rep.status, createdAt: rep.createdAt,
        targetType: rep.targetType, targetLabel: TYPE_LABEL[rep.targetType] || rep.targetType,
        reason: rep.reason, reasonLabel: REASON_LABEL[rep.reason] || rep.reason, details: rep.details,
        reporterName: reporter?.name || '(cuenta eliminada)',
        ownerId: owner?.id || null, ownerName: owner?.name || '(desconocido o eliminado)', ownerSuspended: !!owner?.suspendedAt,
        contentText: target?.text || null, contentImage: target?.image || null, contentGone: !target, otherOpenReports: others,
      };
    }));
    res.json(items);
  }));

  r.post('/reports/:id/action', wrap(async (req, res) => {
    const adminId: string = req.user.userId;
    const action = String(req.body?.action || '');
    const rep = await prisma.report.findUnique({ where: { id: req.params.id } });
    if (!rep) return res.status(404).json({ error: 'La denuncia ya no existe' });
    const target = await deps.describeReportTarget(rep.targetType, rep.targetId);
    const ownerId = target?.ownerId ?? (rep.targetType === 'USER' ? rep.targetId : null);
    const reasonLabel = REASON_LABEL[rep.reason] || rep.reason;
    const what = (TYPE_LABEL[rep.targetType] || 'contenido').toLowerCase();
    const closeAll = (status: string) =>
      prisma.report.updateMany({ where: { targetType: rep.targetType, targetId: rep.targetId, status: 'OPEN' }, data: { status } });

    if (action === 'remove' && rep.targetType !== 'USER') {
      const removed = await deps.removeReportedContent(rep.targetType, rep.targetId);
      await closeAll('REMOVED');
      if (removed && ownerId) void deps.notifyModerationDecision(ownerId, { kind: 'removed', what, reason: reasonLabel });
      void log(adminId, 'REPORT_REMOVE', rep.targetType, rep.targetId, reasonLabel);
      return res.json({ ok: true, message: removed ? 'Contenido eliminado y autor avisado' : 'El contenido ya no existía' });
    }
    if (action === 'suspend' && ownerId) {
      if (ownerId === adminId || (await deps.isAdminUser(ownerId))) return res.status(400).json({ error: 'No se puede suspender una cuenta de administración' });
      await deps.suspendUser(ownerId);
      await closeAll('SUSPENDED');
      void deps.notifyModerationDecision(ownerId, { kind: 'suspended', reason: reasonLabel });
      void log(adminId, 'USER_SUSPEND', 'USER', ownerId, `Denuncia ${rep.id}: ${reasonLabel}`);
      return res.json({ ok: true, message: 'Cuenta suspendida y avisada por correo' });
    }
    if (action === 'unsuspend' && ownerId) {
      await deps.unsuspendUser(ownerId);
      void deps.notifyModerationDecision(ownerId, { kind: 'unsuspended', reason: '' });
      void log(adminId, 'USER_UNSUSPEND', 'USER', ownerId, `Denuncia ${rep.id}`);
      return res.json({ ok: true, message: 'Cuenta reactivada' });
    }
    if (action === 'dismiss' && rep.status === 'OPEN') {
      await prisma.report.update({ where: { id: rep.id }, data: { status: 'DISMISSED' } });
      void log(adminId, 'REPORT_DISMISS', rep.targetType, rep.targetId);
      return res.json({ ok: true, message: 'Denuncia descartada' });
    }
    res.status(400).json({ error: 'Esta acción no se puede hacer sobre esta denuncia' });
  }));

  // ---------- Fotos bloqueadas automáticamente (sin la foto) ----------
  r.get('/blocked-uploads', wrap(async (_req, res) => {
    const since = new Date(Date.now() - 30 * DAY);
    const [rows, repeat] = await Promise.all([
      prisma.blockedUpload.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
      prisma.blockedUpload.groupBy({ by: ['userId'], where: { createdAt: { gte: since }, userId: { not: null } }, _count: { _all: true } }),
    ]);
    const ids = [...new Set([...rows.map((x) => x.userId), ...repeat.map((x) => x.userId)].filter(Boolean) as string[])];
    const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, suspendedAt: true } });
    const byId = new Map(users.map((u) => [u.id, u]));
    const routeLabel = (route: string) =>
      route.includes('/looks') ? 'Publicación' : route.includes('/products') ? 'Prenda o anuncio' : route.includes('/stories') ? 'Historia'
        : route.includes('/chat') ? 'Chat' : route.includes('/challenges') ? 'Reto' : route.includes('/profile') ? 'Foto de perfil' : 'Otra subida';
    res.json({
      items: rows.map((x) => ({ id: x.id, createdAt: x.createdAt, where: routeLabel(x.route), score: Math.round(x.score * 100), userId: x.userId, userName: (x.userId && byId.get(x.userId)?.name) || '(sin cuenta o eliminada)' })),
      repeatOffenders: repeat.filter((x) => x._count._all >= 3).map((x) => ({ userId: x.userId, userName: byId.get(x.userId!)?.name || '(eliminada)', count: x._count._all, suspended: !!byId.get(x.userId!)?.suspendedAt }))
        .sort((a, b) => b.count - a.count),
    });
  }));

  // ---------- Usuarios ----------
  r.get('/users', wrap(async (req, res) => {
    const q = String(req.query.q || '').trim().slice(0, 80);
    const users = await prisma.user.findMany({
      where: q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] } : undefined,
      orderBy: { createdAt: 'desc' }, take: 30,
      select: { id: true, name: true, email: true, avatar: true, createdAt: true, suspendedAt: true, isVerified: true, birthDate: true },
    });
    res.json(users.map(({ birthDate, ...u }) => ({ ...u, ageBand: ageBand(birthDate) })));
  }));

  r.get('/users/:id', wrap(async (req, res) => {
    const u = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, name: true, email: true, avatar: true, bio: true, createdAt: true, suspendedAt: true, isVerified: true, birthDate: true, isProfilePublic: true,
        guardianLink: { select: { status: true, marketplaceAllowed: true } },
        _count: { select: { looks: true, products: true, followers: true, following: true, stories: true } },
      },
    });
    if (!u) return res.status(404).json({ error: 'Cuenta no encontrada' });
    const [forSale, reportsAgainst, reportsMade, blocked, history, admin] = await Promise.all([
      prisma.product.count({ where: { userId: u.id, forSale: true } }),
      prisma.report.count({ where: { targetType: 'USER', targetId: u.id } }),
      prisma.report.count({ where: { reporterId: u.id } }),
      prisma.blockedUpload.count({ where: { userId: u.id } }),
      prisma.adminAction.findMany({ where: { targetId: u.id }, orderBy: { createdAt: 'desc' }, take: 20 }),
      deps.isAdminUser(u.id),
    ]);
    const { birthDate, _count, guardianLink, ...rest } = u;
    res.json({
      ...rest, isAdmin: admin, ageBand: ageBand(birthDate),
      guardian: guardianLink ? { status: guardianLink.status, marketplaceAllowed: guardianLink.marketplaceAllowed } : null,
      counts: { ..._count, forSale, reportsAgainst, reportsMade, blockedUploads: blocked },
      history: history.map((h) => ({ action: h.action, details: h.details, createdAt: h.createdAt })),
    });
  }));

  r.post('/users/:id/suspend', wrap(async (req, res) => {
    const adminId: string = req.user.userId;
    const reason = str(req.body?.reason, 3, 500);
    if (!reason) return res.status(400).json({ error: 'Escribe el motivo (se le envía a la persona)' });
    const id = req.params.id;
    if (id === adminId || (await deps.isAdminUser(id))) return res.status(400).json({ error: 'No se puede suspender una cuenta de administración' });
    const u = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!u) return res.status(404).json({ error: 'Cuenta no encontrada' });
    await deps.suspendUser(id);
    void deps.notifyModerationDecision(id, { kind: 'suspended', reason });
    void log(adminId, 'USER_SUSPEND', 'USER', id, reason);
    res.json({ ok: true, message: 'Cuenta suspendida y avisada por correo' });
  }));

  r.post('/users/:id/unsuspend', wrap(async (req, res) => {
    const adminId: string = req.user.userId;
    const u = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!u) return res.status(404).json({ error: 'Cuenta no encontrada' });
    await deps.unsuspendUser(u.id);
    void deps.notifyModerationDecision(u.id, { kind: 'unsuspended', reason: '' });
    void log(adminId, 'USER_UNSUSPEND', 'USER', u.id);
    res.json({ ok: true, message: 'Cuenta reactivada' });
  }));

  // ---------- Tienda de segunda mano ----------
  r.get('/products', wrap(async (req, res) => {
    const q = String(req.query.q || '').trim().slice(0, 80);
    const products = await prisma.product.findMany({
      where: { forSale: true, ...(q ? { OR: [{ name: { contains: q } }, { brand: { contains: q } }, { description: { contains: q } }] } : {}) },
      orderBy: { createdAt: 'desc' }, take: 40,
      select: { id: true, name: true, description: true, price: true, brand: true, createdAt: true, images: { take: 1, select: { url: true } }, user: { select: { id: true, name: true } } },
    });
    res.json(products.map((p) => ({ id: p.id, name: p.name, description: p.description, price: p.price, brand: p.brand, createdAt: p.createdAt, image: p.images[0]?.url || null, ownerId: p.user.id, ownerName: p.user.name })));
  }));

  r.post('/products/:id/remove', wrap(async (req, res) => {
    const adminId: string = req.user.userId;
    const reason = str(req.body?.reason, 3, 500);
    if (!reason) return res.status(400).json({ error: 'Escribe el motivo (se le envía a la persona)' });
    const removed = await deps.removeProduct(req.params.id);
    if (!removed) return res.status(404).json({ error: 'El anuncio ya no existe' });
    void deps.notifyModerationDecision(removed.userId, { kind: 'removed', what: `anuncio "${removed.name}"`, reason });
    void log(adminId, 'PRODUCT_REMOVE', 'PRODUCT', req.params.id, `${removed.name}: ${reason}`);
    res.json({ ok: true, message: 'Anuncio retirado y vendedor avisado' });
  }));

  // ---------- Retos ----------
  r.get('/challenges', wrap(async (_req, res) => {
    const list = await prisma.weeklyChallenge.findMany({ orderBy: { startDate: 'desc' }, take: 20, include: { _count: { select: { submissions: true } } } });
    res.json(list.map(({ _count, ...c }) => ({ ...c, submissions: _count.submissions })));
  }));

  const challengeInput = (b: any, partial: boolean) => {
    const out: any = {};
    const title = b?.title === undefined && partial ? undefined : str(b?.title, 3, 80);
    const description = b?.description === undefined && partial ? undefined : str(b?.description, 10, 400);
    const tag = b?.tag === undefined && partial ? undefined : str(b?.tag, 2, 40);
    if (title === null || description === null || tag === null) return { error: 'Revisa el título (3-80), la descripción (10-400) y la etiqueta' };
    if (title !== undefined) out.title = title;
    if (description !== undefined) out.description = description;
    if (tag !== undefined) out.tag = tag;
    if (b?.reward !== undefined) {
      const reward = Number(b.reward);
      if (!Number.isInteger(reward) || reward < 10 || reward > 500) return { error: 'Los puntos deben ser entre 10 y 500' };
      out.reward = reward;
    } else if (!partial) out.reward = 50;
    if (b?.endDate !== undefined || !partial) {
      const end = new Date(b?.endDate);
      if (isNaN(end.getTime()) || end.getTime() < Date.now()) return { error: 'La fecha de fin debe ser futura' };
      end.setHours(23, 59, 59, 999);
      out.endDate = end;
    }
    if (b?.active !== undefined) out.active = !!b.active;
    return { data: out };
  };

  r.post('/challenges', wrap(async (req, res) => {
    const adminId: string = req.user.userId;
    const parsed = challengeInput(req.body, false);
    if ('error' in parsed) return res.status(400).json({ error: parsed.error });
    const active = req.body?.active !== false;
    if (active) await prisma.weeklyChallenge.updateMany({ where: { active: true }, data: { active: false } });
    const c = await prisma.weeklyChallenge.create({ data: { ...parsed.data, active, startDate: new Date() } });
    void log(adminId, 'CHALLENGE_CREATE', 'CHALLENGE', c.id, c.title);
    res.status(201).json(c);
  }));

  r.put('/challenges/:id', wrap(async (req, res) => {
    const adminId: string = req.user.userId;
    const parsed = challengeInput(req.body, true);
    if ('error' in parsed) return res.status(400).json({ error: parsed.error });
    const exists = await prisma.weeklyChallenge.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!exists) return res.status(404).json({ error: 'Reto no encontrado' });
    if (parsed.data.active === true) await prisma.weeklyChallenge.updateMany({ where: { active: true, id: { not: req.params.id } }, data: { active: false } });
    const c = await prisma.weeklyChallenge.update({ where: { id: req.params.id }, data: parsed.data });
    void log(adminId, 'CHALLENGE_EDIT', 'CHALLENGE', c.id, Object.keys(parsed.data).join(', '));
    res.json(c);
  }));

  r.get('/challenges/:id/submissions', wrap(async (req, res) => {
    const subs = await prisma.challengeSubmission.findMany({
      where: { challengeId: req.params.id }, orderBy: { createdAt: 'desc' }, take: 100,
      select: { id: true, imageUrl: true, description: true, status: true, reason: true, createdAt: true, user: { select: { id: true, name: true } } },
    });
    res.json(subs.map(({ user, ...s }) => ({ ...s, userId: user.id, userName: user.name })));
  }));

  r.post('/submissions/:id/invalidate', wrap(async (req, res) => {
    const adminId: string = req.user.userId;
    const reason = str(req.body?.reason, 3, 300);
    if (!reason) return res.status(400).json({ error: 'Escribe el motivo (se le envía a la persona)' });
    const s = await prisma.challengeSubmission.findUnique({ where: { id: req.params.id }, include: { challenge: { select: { reward: true, title: true } } } });
    if (!s) return res.status(404).json({ error: 'Participación no encontrada' });
    if (s.status === 'INVALID') return res.status(400).json({ error: 'Ya estaba invalidada' });
    if (s.awarded) await deps.removeXp(s.userId, s.challenge.reward);
    await prisma.challengeSubmission.update({ where: { id: s.id }, data: { status: 'INVALID', verified: false, awarded: false, reason } });
    void deps.notifyModerationDecision(s.userId, { kind: 'submission_invalid', what: `tu participación en el reto "${s.challenge.title}"`, reason });
    void log(adminId, 'SUBMISSION_INVALIDATE', 'SUBMISSION', s.id, reason);
    res.json({ ok: true, message: 'Participación invalidada; se han retirado los puntos' });
  }));

  // ---------- Avisos de errores ----------
  r.get('/crashes', wrap(async (_req, res) => {
    const groups = await prisma.crashReport.groupBy({ by: ['signature'], _count: { _all: true }, _max: { createdAt: true }, orderBy: { _max: { createdAt: 'desc' } }, take: 50 });
    const items = await Promise.all(groups.map(async (g) => {
      const last = await prisma.crashReport.findFirst({ where: { signature: g.signature }, orderBy: { createdAt: 'desc' } });
      const versions = await prisma.crashReport.findMany({ where: { signature: g.signature }, distinct: ['version'], select: { version: true }, take: 5 });
      return {
        signature: g.signature, count: g._count._all, lastAt: g._max.createdAt, title: last?.title, source: last?.source,
        device: last?.device, versions: versions.map((v) => v.version).filter(Boolean), trace: last?.trace.slice(0, 4000),
      };
    }));
    res.json(items);
  }));

  r.post('/crashes/:signature/resolve', wrap(async (req, res) => {
    const n = await prisma.crashReport.deleteMany({ where: { signature: req.params.signature } });
    void log(req.user.userId, 'CRASH_RESOLVE', 'CRASH', req.params.signature, `${n.count} informes`);
    res.json({ ok: true, message: 'Marcado como arreglado' });
  }));

  // ---------- Estadísticas (solo números, sin datos personales) ----------
  r.get('/stats', wrap(async (_req, res) => {
    const WEEKS = 8;
    const start = new Date(); start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - 7 * (WEEKS - 1)); // lunes de hace 7 semanas
    const where = { createdAt: { gte: start } };
    const sel = { select: { createdAt: true } } as const;
    const [users, looks, sales, stories, subs, reports, totals] = await Promise.all([
      prisma.user.findMany({ where, ...sel }), prisma.look.findMany({ where, ...sel }),
      prisma.product.findMany({ where: { ...where, forSale: true }, ...sel }), prisma.story.findMany({ where, ...sel }),
      prisma.challengeSubmission.findMany({ where, ...sel }), prisma.report.findMany({ where, ...sel }),
      Promise.all([prisma.user.count(), prisma.look.count(), prisma.product.count({ where: { forSale: true } })]),
    ]);
    const bucket = (rows: { createdAt: Date }[]) => {
      const out = new Array(WEEKS).fill(0);
      for (const r0 of rows) { const i = Math.floor((r0.createdAt.getTime() - start.getTime()) / (7 * DAY)); if (i >= 0 && i < WEEKS) out[i]++; }
      return out;
    };
    const weeks = Array.from({ length: WEEKS }, (_, i) => new Date(start.getTime() + i * 7 * DAY).toISOString().slice(0, 10));
    res.json({
      weeks,
      series: { users: bucket(users), looks: bucket(looks), sales: bucket(sales), stories: bucket(stories), challenges: bucket(subs), reports: bucket(reports) },
      totals: { users: totals[0], looks: totals[1], forSale: totals[2] },
    });
  }));

  // ---------- Aviso a todos (solo avisos del servicio, nunca publicidad: LSSI art. 21) ----------
  r.post('/broadcast', wrap(async (req, res) => {
    const adminId: string = req.user.userId;
    const message = str(req.body?.message, 5, 300);
    if (!message) return res.status(400).json({ error: 'El aviso debe tener entre 5 y 300 caracteres' });
    if (Date.now() - lastBroadcast < 10 * 60 * 1000) return res.status(429).json({ error: 'Ya se envió un aviso hace poco. Espera 10 minutos.' });
    lastBroadcast = Date.now();
    const count = await deps.broadcast(message);
    void log(adminId, 'BROADCAST', null, null, message);
    res.json({ ok: true, message: `Aviso enviado a ${count} cuentas` });
  }));

  // ---------- Solicitudes de privacidad ----------
  r.get('/privacy-requests', wrap(async (req, res) => {
    const open = req.query.status !== 'CLOSED';
    const list = await prisma.privacyRequest.findMany({ where: open ? { status: 'OPEN' } : { status: { not: 'OPEN' } }, orderBy: { createdAt: open ? 'asc' : 'desc' }, take: 100 });
    res.json(list.map((p) => ({ ...p, typeLabel: PRIVACY_TYPES[p.type] || p.type, dueAt: new Date(p.createdAt.getTime() + PRIVACY_DEADLINE_DAYS * DAY) })));
  }));

  r.post('/privacy-requests/:id/resolve', wrap(async (req, res) => {
    const adminId: string = req.user.userId;
    const status = req.body?.status === 'REJECTED' ? 'REJECTED' : 'DONE';
    const response = str(req.body?.response, 10, 2000);
    if (!response) return res.status(400).json({ error: 'Escribe la respuesta (mínimo 10 caracteres); se envía a la persona' });
    const p = await prisma.privacyRequest.findUnique({ where: { id: req.params.id } });
    if (!p) return res.status(404).json({ error: 'Solicitud no encontrada' });
    if (p.status !== 'OPEN') return res.status(400).json({ error: 'Ya estaba respondida' });
    await prisma.privacyRequest.update({ where: { id: p.id }, data: { status, response, resolvedAt: new Date() } });
    if (deps.sendMail) {
      void deps.sendMail({
        to: p.email,
        subject: `Respuesta a tu solicitud de privacidad - Estilo Vivo`,
        text: `Hola${p.name ? ' ' + p.name : ''}:\n\nSobre tu solicitud "${PRIVACY_TYPES[p.type] || p.type}" del ${p.createdAt.toLocaleDateString('es-ES')}:\n\n${response}\n\nSi no estás de acuerdo con la respuesta, puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).\n\nEstilo Vivo`,
      }).catch((error) => logger.error('No se pudo enviar la respuesta de privacidad', { error }));
    }
    void log(adminId, status === 'DONE' ? 'PRIVACY_DONE' : 'PRIVACY_REJECT', 'PRIVACY', p.id, PRIVACY_TYPES[p.type]);
    res.json({ ok: true, message: 'Respuesta enviada por correo' });
  }));

  // ---------- Registro de acciones ----------
  r.get('/log', wrap(async (_req, res) => {
    const rows = await prisma.adminAction.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    const admins = await prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((x) => x.adminId))] } }, select: { id: true, name: true } });
    const byId = new Map(admins.map((a) => [a.id, a.name]));
    res.json(rows.map((x) => ({ ...x, adminName: byId.get(x.adminId) || '(eliminada)' })));
  }));

  app.use('/api/admin', r);

  // ---------- Lado de la persona usuaria: pedir sus derechos de privacidad ----------
  const privacySends = new Map<string, number[]>();
  app.post('/api/privacy-requests', deps.authenticateToken, wrap(async (req, res) => {
    const userId: string = req.user.userId;
    const type = String(req.body?.type || '');
    const message = str(req.body?.message, 10, 2000);
    if (!PRIVACY_TYPES[type]) return res.status(400).json({ error: 'Elige el tipo de solicitud' });
    if (!message) return res.status(400).json({ error: 'Explica tu solicitud (mínimo 10 caracteres)' });
    const sends = (privacySends.get(userId) || []).filter((t) => Date.now() - t < DAY);
    if (sends.length >= 5) return res.status(429).json({ error: 'Has enviado varias solicitudes hoy. Te responderemos pronto.' });
    privacySends.set(userId, [...sends, Date.now()]);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
    if (!user) return res.status(404).json({ error: 'Cuenta no encontrada' });
    const p = await prisma.privacyRequest.create({ data: { userId, email: user.email, name: user.name, type, message } });
    const dueAt = new Date(p.createdAt.getTime() + PRIVACY_DEADLINE_DAYS * DAY);
    if (deps.sendMail) {
      void deps.sendMail({
        to: deps.teamEmail(),
        subject: `Solicitud de privacidad: ${PRIVACY_TYPES[type]} - Estilo Vivo`,
        text: `${user.name} ha enviado una solicitud de privacidad (${PRIVACY_TYPES[type]}).\n\n${message}\n\nPlazo para responder: ${dueAt.toLocaleDateString('es-ES')}. Respóndela desde el Panel de la app.`,
      }).catch((error) => logger.error('No se pudo avisar de la solicitud de privacidad', { error }));
    }
    res.status(201).json({ id: p.id, dueAt, message: `Solicitud enviada. Te responderemos por correo antes del ${dueAt.toLocaleDateString('es-ES')}.` });
  }));

  app.get('/api/privacy-requests/mine', deps.authenticateToken, wrap(async (req, res) => {
    const list = await prisma.privacyRequest.findMany({ where: { userId: req.user.userId }, orderBy: { createdAt: 'desc' }, take: 20 });
    res.json(list.map((p) => ({ id: p.id, type: p.type, typeLabel: PRIVACY_TYPES[p.type] || p.type, status: p.status, response: p.response, createdAt: p.createdAt, resolvedAt: p.resolvedAt })));
  }));
}
