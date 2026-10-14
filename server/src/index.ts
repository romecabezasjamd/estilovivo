import 'dotenv/config';
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import multer from 'multer';
import { mkdirSync, existsSync, unlinkSync, readFileSync } from 'fs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { createServer } from 'http';
import { Server } from 'socket.io';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { z } from 'zod';
import logger from './logger.js';
import { processImage } from './imageProcessor.js';
import {
  validate,
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  changePasswordSchema,
  updateProfileSchema,
  conversationSchema,
  messageSchema,
  resendVerificationSchema,
  testEmailSchema,
  productSchema,
  lookSchema,
  lookUpdateSchema,
  commentSchema,
  favoriteSchema,
  followSchema,
  plannerSchema,
  tripSchema,
  refreshSchema
} from './validators.js';
import { fashionTrendsService } from './fashionTrends.js';
import { awardPoints } from './gamification.js';
import {
  awardXp, removeXp, levelFromXp, xpProgress,
  checkAndUnlockAchievements, checkAndUnlockBadges,
  updateStreak, ACHIEVEMENTS, BADGES, XP_VALUES
} from './gamificationSystem.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.DATABASE_URL || 'file:/app/data/dev.db';
if (!process.env.DATABASE_URL) {
  logger.warn(`DATABASE_URL not set, defaulting to ${DB_PATH}`);
}

const app: Express = express();
const httpServer = createServer(app);
const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: DB_PATH
  })
});

// Trust first proxy (Docker / reverse proxy / Coolify)
app.set('trust proxy', 1);

const PORT = parseInt(process.env.PORT || '3000', 10);
const UPLOADS_DIR = process.env.UPLOADS_DIR || '/app/uploads';
const NODE_ENV = process.env.NODE_ENV || 'development';

// ============= VALIDAR VARIABLES CRÍTICAS =============
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  logger.error('FATAL ERROR: JWT_SECRET environment variable is required');
  logger.error('Please set JWT_SECRET in your .env file');
  logger.error('Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}

const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];
const missingVars = requiredEnvVars.filter(key => !process.env[key]);
if (missingVars.length > 0) {
  console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
  logger.error(`Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

// ============= SMTP CONFIGURATION =============
// Check if SMTP is properly configured
const isEmailConfigured = !!(
  process.env.SMTP_HOST &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS
);

if (!isEmailConfigured) {
  logger.warn('SMTP not configured. Email features (forgot-password, notifications) will be disabled.');
  logger.warn('To enable emails, set these environment variables:');
  logger.warn('  SMTP_HOST=smtp.gmail.com  SMTP_PORT=587  SMTP_USER=tu-email@gmail.com  SMTP_PASS=tu-app-password');
  logger.warn('For Gmail, use an App Password (not your regular password): https://support.google.com/accounts/answer/185833');
}

// Only create transporter if SMTP is configured
const transporter = isEmailConfigured
  ? nodemailer.createTransport({
    host: process.env.SMTP_HOST!,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465' || process.env.SMTP_SECURE === 'true',
    requireTLS: process.env.SMTP_PORT !== '465',
    tls: process.env.SMTP_TLS_REJECT_UNAUTHORIZED === 'false' ? { rejectUnauthorized: false } : undefined,
    logger: true,
    debug: process.env.SMTP_DEBUG === 'true',
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
    },
  })
  : null;

if (transporter) {
  logger.info('SMTP configured. Email sending is active.', { host: process.env.SMTP_HOST, port: process.env.SMTP_PORT });
  transporter.verify().then(() => {
    logger.info('SMTP connection verified successfully');
  }).catch((err) => {
    logger.error('SMTP connection failed. Check your SMTP credentials and server firewall.', { error: String(err) });
    logger.error('Common issues: wrong password, 2FA enabled (use App Password), port blocked by firewall');
  });
}

const getFrontendUrl = () => {
  const defaultUrl = NODE_ENV === 'production' ? 'https://estilovivo.xyoncloud.win' : 'http://localhost:5173';
  const rawUrl = process.env.FRONTEND_URL || '';
  const baseUrl = (NODE_ENV === 'production' && (rawUrl.includes('localhost') || rawUrl.includes('127.0.0.1') || !rawUrl))
    ? defaultUrl
    : (rawUrl || defaultUrl);
  return baseUrl.replace(/\/+$/, '');
};

// Generate email-friendly URLs that work on Android emulator and web
const getEmailFriendlyUrl = (path: string = '') => {
  const defaultUrl = NODE_ENV === 'production' ? 'https://estilovivo.xyoncloud.win' : 'http://localhost:5173';
  const rawUrl = process.env.FRONTEND_URL || '';
  const baseUrl = (NODE_ENV === 'production' && (rawUrl.includes('localhost') || rawUrl.includes('127.0.0.1') || !rawUrl))
    ? defaultUrl
    : (rawUrl || defaultUrl);
  const cleanBase = baseUrl.replace(/\/+$/, '');
  // Replace localhost with 10.0.2.2 ONLY in development for Android emulator compatibility
  const androidFriendly = NODE_ENV !== 'production'
    ? cleanBase.replace('localhost', '10.0.2.2')
    : cleanBase;
  return `${androidFriendly}${path}`;
};

// Email template helper with logo and styling
const getEmailTemplate = (content: string, title: string = 'Estilo Vivo') => `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          background-color: #f8f9fa;
          margin: 0;
          padding: 0;
          color: #333;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #ff4d94 0%, #00b4d8 100%);
          padding: 30px 20px;
          text-align: center;
          color: white;
        }
        .logo {
          font-size: 28px;
          font-weight: 900;
          margin-bottom: 5px;
          letter-spacing: -1px;
        }
        .tagline {
          font-size: 13px;
          opacity: 0.9;
          font-weight: 500;
        }
        .content {
          padding: 40px 30px;
        }
        .greeting {
          font-size: 18px;
          font-weight: 600;
          color: #1a1a1a;
          margin-bottom: 15px;
        }
        .message {
          font-size: 14px;
          line-height: 1.6;
          color: #555;
          margin-bottom: 25px;
        }
        .button {
          display: inline-block;
          background: linear-gradient(135deg, #ff4d94 0%, #ff6bb3 100%);
          color: white;
          padding: 14px 32px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 15px;
          margin: 20px 0;
          transition: transform 0.2s;
        }
        .button:hover {
          transform: translateY(-2px);
        }
        .info-box {
          background-color: #f0f7ff;
          border-left: 4px solid #00b4d8;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
          font-size: 13px;
          color: #0066b3;
        }
        .footer {
          border-top: 1px solid #eee;
          padding: 20px 30px;
          font-size: 12px;
          color: #999;
          text-align: center;
          background-color: #fafafa;
        }
        .divider {
          height: 1px;
          background-color: #eee;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">✨ ESTILO VIVO</div>
          <div class="tagline">Tu armario, Tu comunidad, Tu estilo</div>
        </div>
        <div class="content">
          ${content}
        </div>
        <div class="footer">
          <p>© 2026 Estilo Vivo. Todos los derechos reservados.</p>
          <p>Este correo fue enviado porque registraste una cuenta en nuestra plataforma.</p>
        </div>
      </div>
    </body>
  </html>
`;

const sendMailWithRetry = async (mailOptions: any, retries = 2) => {
  if (!transporter) {
    throw new Error('SMTP transporter is not configured');
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.SMTP_USER!,
        ...mailOptions,
      });
    } catch (error) {
      lastError = error;
      logger.warn('Email send attempt failed', {
        attempt: attempt + 1,
        retries: retries + 1,
        to: mailOptions.to,
        error
      });
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
  }

  throw lastError;
};

if (transporter) {
  transporter.verify()
    .then(() => logger.info('SMTP transporter verified successfully'))
    .catch((error) => logger.error('SMTP transporter verification failed', { error }));
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const DUMMY_BCRYPT_HASH = bcrypt.hashSync('estilovivo-dummy-password', 10);

// Escapa texto de usuario antes de interpolarlo en HTML de emails
const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

// Sólo se aceptan URLs de imagen servidas por nosotros (evita javascript:, tracking externo, etc.)
const isOwnUploadUrl = (value: unknown): value is string =>
  typeof value === 'string' && /^\/api\/uploads\/[A-Za-z0-9._\/-]+$/.test(value) && !value.includes('..');

// Administradores: IDs separados por comas en ADMIN_USER_IDS
const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || '').split(',').map(v => v.trim()).filter(Boolean);
const isAdmin = (userId?: string) => !!userId && ADMIN_USER_IDS.includes(userId);

// Borra un fichero subido sin lanzar si ya no existe
const safeUnlink = (filePath?: string) => {
  if (!filePath) return;
  try { if (existsSync(filePath)) unlinkSync(filePath); } catch { /* ignore */ }
};

const findUsersByEmail = async (email: string) => {
  const normalizedEmail = normalizeEmail(email);
  const matches = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM "User"
    WHERE LOWER(TRIM(email)) = ${normalizedEmail}
    ORDER BY "createdAt" ASC
  `;

  if (matches.length === 0) return [];

  return prisma.user.findMany({
    where: { id: { in: matches.map(m => m.id) } },
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { followers: true, following: true } } }
  });
};

const sendPreferenceEmail = async (params: {
  userId: string;
  subject: string;
  html: string;
  text?: string;
  context?: Record<string, unknown>;
  preference?: 'emailChat' | 'emailFollows' | 'emailWashing' | 'emailChallenges';
}) => {
  if (!transporter) return false;

  const recipient = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { email: true, emailNotifications: true, name: true, emailChat: true, emailFollows: true, emailWashing: true, emailChallenges: true }
  });

  if (!recipient?.email || !recipient.emailNotifications) return false;
  if (params.preference && !(recipient as any)[params.preference]) return false;

  try {
    await sendMailWithRetry({
      to: recipient.email,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    logger.info('Notification email sent', { userId: params.userId, subject: params.subject, ...params.context });
    return true;
  } catch (error) {
    logger.warn('Could not send notification email', { userId: params.userId, subject: params.subject, error, ...params.context });
    return false;
  }
};

// Crear directorio de uploads si no existe
if (!existsSync(UPLOADS_DIR)) {
  mkdirSync(UPLOADS_DIR, { recursive: true });
}

// La extensión se deriva del MIME validado, nunca del nombre que envía el cliente
const MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${MIME_EXT[file.mimetype] || '.bin'}`);
  },
});

const imageFileFilter = (_: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  cb(null, allowed.includes(file.mimetype));
};

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: imageFileFilter });

// Middleware - CORS configuration
const allowedOrigins = [
  process.env.SERVICE_FQDN_APP ? `https://${process.env.SERVICE_FQDN_APP}` : null,
  process.env.SERVICE_URL_APP,
  process.env.FRONTEND_URL,
  'https://estilovivo.xyoncloud.win',
  'http://localhost:5173',
  'http://localhost:3000',
  'capacitor://localhost', // Potential Capacitor/Mobile origin
  'https://localhost',
  'http://localhost',
].filter(Boolean) as string[]; // Remove undefined values

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    // Check if origin is in allowed list
    if (allowedOrigins.some(allowed => origin === allowed)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.some(allowed => origin === allowed)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }
});

const parseCookieHeader = (header?: string): Record<string, string> => {
  const out: Record<string, string> = {};
  (header || '').split(';').forEach(part => {
    const idx = part.indexOf('=');
    if (idx > 0) {
      try { out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim()); } catch { /* ignore */ }
    }
  });
  return out;
};

// Autenticación obligatoria en el handshake: el userId sale del token, nunca del cliente
io.use((socket, next) => {
  const token = socket.handshake.auth?.token
    || socket.handshake.headers?.authorization?.replace('Bearer ', '')
    || parseCookieHeader(socket.handshake.headers?.cookie).auth_token;
  if (!token) return next(new Error('Authentication required'));
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (!decoded?.userId) return next(new Error('Invalid token'));
    socket.data.userId = decoded.userId;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

const isConversationParticipant = async (conversationId: unknown, userId: string) => {
  if (typeof conversationId !== 'string' || !conversationId) return false;
  const p = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } }
  });
  return !!p;
};

io.on('connection', (socket) => {
  const authUserId: string = socket.data.userId;
  logger.info(`Socket connected: ${socket.id}`);
  // La sala personal se asigna siempre a partir del token
  socket.join(`user_${authUserId}`);

  socket.on('join_user', () => {
    // Compatibilidad con clientes antiguos: la sala personal ya está asignada
    socket.join(`user_${authUserId}`);
  });

  socket.on('join_room', async (roomId) => {
    try {
      if (await isConversationParticipant(roomId, authUserId)) socket.join(`conv_${roomId}`);
    } catch (e) { logger.warn('join_room failed', { e }); }
  });

  socket.on('leave_room', (roomId) => {
    if (typeof roomId === 'string') socket.leave(`conv_${roomId}`);
  });

  socket.on('typing', (payload) => {
    const roomId = payload?.roomId;
    if (typeof roomId === 'string' && socket.rooms.has(`conv_${roomId}`)) {
      socket.to(`conv_${roomId}`).emit('typing', { userId: authUserId, roomId });
    }
  });

  socket.on('stop_typing', (payload) => {
    const roomId = payload?.roomId;
    if (typeof roomId === 'string' && socket.rooms.has(`conv_${roomId}`)) {
      socket.to(`conv_${roomId}`).emit('stop_typing', { userId: authUserId, roomId });
    }
  });

  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

app.disable('x-powered-by');

// Cabeceras de seguridad básicas
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  if (NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Los presets del probador incluyen miniaturas en base64
app.use('/api/tryon-presets', express.json({ limit: '3mb' }));
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: true, limit: '200kb' }));
app.use(cookieParser());
app.use('/api/uploads', express.static(UPLOADS_DIR, {
  dotfiles: 'deny',
  index: false,
  setHeaders: (res) => {
    // Un upload nunca se interpreta como documento activo
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; sandbox");
    res.setHeader('Cache-Control', 'public, max-age=604800');
  },
}));

// Digital Asset Links para los deep links verificados de la app Android
app.get('/.well-known/assetlinks.json', (req: Request, res: Response) => {
  const fingerprints = (process.env.ANDROID_SHA256_FINGERPRINTS || '').split(',').map(v => v.trim()).filter(Boolean);
  res.json(fingerprints.length === 0 ? [] : [{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: process.env.ANDROID_PACKAGE_NAME || 'com.estilovivo.app',
      sha256_cert_fingerprints: fingerprints,
    },
  }]);
});

// Prevent browser/PWA from caching API responses (ensures fresh data per user)
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/uploads/')) return next();
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  next();
});

// ============= RATE LIMITING =============
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiados intentos. Por favor, espera 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiados intentos. Por favor, espera 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}-${(req.body?.email || '').toLowerCase().trim()}`,
});

const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100, // 100 requests por minuto
  message: { error: 'Demasiadas peticiones. Por favor, espera un momento.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Aplicar rate limiter general a todas las rutas API
app.use('/api/', generalLimiter);

// ============= AUTH MIDDLEWARE =============
const authenticateToken = (req: any, res: Response, next: NextFunction) => {
  // Check for token in cookie first, then fall back to Authorization header
  let token = req.cookies?.auth_token;

  if (!token) {
    const authHeader = req.headers['authorization'];
    token = authHeader && authHeader.split(' ')[1];
  }

  if (!token) return res.status(401).json({ error: 'Token required' });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      logger.warn('Invalid token attempt', { error: err.message });
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Optional authentication - allows public access but sets req.user if token is valid
const optionalAuth = (req: any, res: Response, next: NextFunction) => {
  let token = req.cookies?.auth_token;

  if (!token) {
    const authHeader = req.headers['authorization'];
    token = authHeader && authHeader.split(' ')[1];
  }

  if (token) {
    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (!err) {
        req.user = user;
      }
      next();
    });
  } else {
    next();
  }
};

// ============= REFRESH TOKEN HELPERS =============
const REFRESH_TOKEN_EXPIRY_DAYS = 30;

const generateRefreshToken = async (userId: string): Promise<string> => {
  const token = crypto.randomBytes(64).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  // Clean up expired tokens for this user
  await prisma.refreshToken.deleteMany({
    where: { userId, expiresAt: { lt: new Date() } }
  });

  // Limit to 5 active refresh tokens per user
  const existingTokens = await prisma.refreshToken.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' }
  });
  if (existingTokens.length >= 5) {
    await prisma.refreshToken.deleteMany({
      where: { id: { in: existingTokens.slice(0, existingTokens.length - 4).map(t => t.id) } }
    });
  }

  await prisma.refreshToken.create({
    data: { token, userId, expiresAt }
  });

  return token;
};

const issueTokenPair = async (userId: string, res: Response) => {
  const accessToken = jwt.sign({ userId }, JWT_SECRET!, { expiresIn: '7d' });
  const refreshToken = await generateRefreshToken(userId);

  res.cookie('auth_token', accessToken, {
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return { accessToken, refreshToken };
};

const invalidateRefreshTokens = async (userId: string) => {
  await prisma.refreshToken.deleteMany({ where: { userId } });
};

// Borra una imagen procesada y sus variantes (-medium / -thumb / -original)
const unlinkImageVariants = (filename?: string | null) => {
  if (!filename) return;
  const name = path.basename(filename);
  const base = name.replace(/-(medium|thumb|original)\.[a-z0-9]+$/i, '');
  safeUnlink(path.join(UPLOADS_DIR, name));
  if (base !== name) {
    for (const suffix of ['-medium.webp', '-thumb.webp', '-original.webp', '-original.jpg', '-original.png', '-original.gif']) {
      safeUnlink(path.join(UPLOADS_DIR, base + suffix));
    }
  }
};

// Convierte una URL /api/uploads/... en ruta de disco (o null si no es nuestra)
const uploadUrlToPath = (url?: string | null) => {
  if (!isOwnUploadUrl(url)) return null;
  return path.join(UPLOADS_DIR, url.replace(/^\/api\/uploads\//, ''));
};

// ============= ACCESS HELPERS =============

// ---- Bloqueos: ids bloqueados en cualquier sentido (a quien bloqueé + quien me bloqueó). 1 consulta indexada.
const getBlockedIds = async (userId?: string | null): Promise<string[]> => {
  if (!userId) return [];
  const rows = await prisma.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true }
  });
  return [...new Set(rows.map(r => (r.blockerId === userId ? r.blockedId : r.blockerId)))];
};
const isBlockedBetween = async (a: string, b: string): Promise<boolean> =>
  !!(await prisma.block.findFirst({
    where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] },
    select: { id: true }
  }));
// Fragmento Prisma "campo notIn ids" (vacío si no hay bloqueos)
const notBlocked = (ids: string[], field = 'userId') => (ids.length ? { [field]: { notIn: ids } } : {});
// ¿Algún otro participante de la conversación está bloqueado (en cualquier sentido) respecto a userId?
const conversationHasBlocked = async (conversationId: string, userId: string): Promise<boolean> => {
  const others = await prisma.conversationParticipant.findMany({ where: { conversationId, userId: { not: userId } }, select: { userId: true } });
  if (others.length === 0) return false;
  const blocked = new Set(await getBlockedIds(userId));
  return others.some(o => blocked.has(o.userId));
};

// Un look es visible si es propio, o público y de un perfil público / seguido (y sin bloqueo con el autor)
const canViewLook = async (lookId: unknown, viewerId?: string) => {
  if (typeof lookId !== 'string' || !lookId) return null;
  const look = await prisma.look.findUnique({
    where: { id: lookId },
    select: { id: true, userId: true, isPublic: true, user: { select: { isProfilePublic: true } } }
  });
  if (!look) return null;
  if (viewerId && look.userId === viewerId) return look;
  if (viewerId && (await isBlockedBetween(viewerId, look.userId))) return null;
  if (!look.isPublic) return null;
  if (look.user?.isProfilePublic === false) {
    if (!viewerId) return null;
    const follows = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: viewerId, followingId: look.userId } }
    });
    if (!follows) return null;
  }
  return look;
};

// Filtra una lista de IDs de prendas dejando sólo las del usuario
const ownProductIds = async (ids: unknown, userId: string): Promise<string[]> => {
  if (!Array.isArray(ids)) return [];
  const clean = ids.filter((v): v is string => typeof v === 'string' && v.length > 0).slice(0, 200);
  if (clean.length === 0) return [];
  const rows = await prisma.product.findMany({ where: { id: { in: clean }, userId }, select: { id: true } });
  return rows.map(r => r.id);
};

const parseJsonArray = (value: unknown): unknown[] | null => {
  if (value === undefined || value === null || value === '') return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

// Procesa con sharp las imágenes subidas; si falla, se descarta el fichero (nunca se sirve el original sin validar)
const processUploadedImages = async (files: Express.Multer.File[] | undefined, removeBg = false) => {
  const out: { filename: string; url: string }[] = [];
  for (const file of files || []) {
    try {
      const processed = await processImage(file.path, UPLOADS_DIR, file.filename, removeBg);
      out.push({ filename: processed.medium, url: `/api/uploads/${processed.medium}` });
    } catch (imgError) {
      logger.error('Image processing failed', { error: imgError, filename: file.filename });
    } finally {
      safeUnlink(file.path);
    }
  }
  return out;
};

// Re-codifica una imagen suelta (chat, retos) para eliminar contenido no-imagen y metadatos EXIF
const reencodeSingleImage = async (file: Express.Multer.File, dir: string = UPLOADS_DIR): Promise<string | null> => {
  try {
    const sharp = (await import('sharp')).default;
    const outName = `${path.basename(file.filename, path.extname(file.filename))}.webp`;
    await sharp(file.path).rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toFile(path.join(dir, outName));
    return outName;
  } catch (e) {
    logger.warn('Image re-encode failed', { e, filename: file.filename });
    return null;
  } finally {
    safeUnlink(file.path);
  }
};

// ============= HEALTH =============
app.get('/api/health', async (req: Request, res: Response) => {
  const healthCheck: any = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: 'unknown',
    version: process.env.npm_package_version || '0.0.0'
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    healthCheck.database = 'connected';
    res.status(200).json(healthCheck);
  } catch (error: any) {
    healthCheck.status = 'error';
    healthCheck.database = 'disconnected';
    logger.error('Health check DB error', { error: error?.message });
    res.status(503).json(healthCheck);
  }
});

// Health check detallado (solo para desarrollo o admin)
app.get('/api/health/detailed', authenticateToken, async (req: any, res: Response) => {
  if (!isAdmin(req.user.userId)) return res.status(403).json({ error: 'Admin only' });
  try {
    const [userCount, productCount, lookCount] = await Promise.all([
      prisma.user.count(),
      prisma.product.count(),
      prisma.look.count(),
    ]);

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: NODE_ENV,
      database: 'connected',
      stats: {
        users: userCount,
        products: productCount,
        looks: lookCount,
      },
      memory: process.memoryUsage(),
      versions: {
        node: process.version,
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching health details' });
  }
});

// ============= AUTHENTICATION =============

app.post('/api/auth/register', authLimiter, validate(registerSchema), async (req: Request, res: Response) => {
  try {
    const normalizedEmail = normalizeEmail(req.body.email);
    const { password, name, gender, birthDate } = req.body;

    // Case-insensitive check to prevent duplicate emails with different casing
    const existingUser = (await findUsersByEmail(normalizedEmail))[0];

    if (existingUser) return res.status(400).json({ error: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        name,
        gender: gender || 'female',
        birthDate: birthDate ? new Date(birthDate) : null,
        verificationToken
      }
    });

    // Send verification email
    let emailSent = false;
    if (transporter) {
      const verifyUrl = `${getEmailFriendlyUrl('/auth?verifyToken=' + verificationToken)}`;
      const emailContent = `
        <p class="greeting">¡Bienvenida a Estilo Vivo, ${escapeHtml(user.name)}! 🎉</p>
        <p class="message">
          Gracias por unirte a nuestra comunidad. Para empezar a usar tu cuenta y acceder a todas nuestras funciones, 
          verifica tu correo electrónico haciendo clic en el botón de abajo.
        </p>
        <div style="text-align: center;">
          <a href="${verifyUrl}" class="button">✓ Verificar mi Cuenta</a>
        </div>
        <div class="info-box">
          <strong>👇 Si el botón no funciona:</strong><br>
          Copia y pega este enlace en tu navegador:<br>
          <code style="background: #e8f4f8; padding: 4px 8px; border-radius: 3px; word-break: break-all; display: block; margin-top: 8px;">${verifyUrl}</code>
        </div>
        <p class="message" style="font-size: 12px; color: #999;">
          Este es un correo automático. Por favor, no respondas a este mensaje. Si tienes preguntas, 
          contacta con nuestro equipo de soporte.
        </p>
      `;

      try {
        await sendMailWithRetry({
          to: user.email,
          subject: '✓ Verifica tu cuenta - Estilo Vivo',
          html: getEmailTemplate(emailContent, 'Bienvenida a Estilo Vivo')
        });
        logger.info('Verification email sent', { userId: user.id });
        emailSent = true;
      } catch (mailError) {
        logger.error('Failed to send verification email, auto-verifying user as fallback', { userId: user.id, error: mailError });
      }
    } else {
      logger.warn('SMTP not configured. Auto-verifying user.', { userId: user.id });
    }

    // Auto-verify if email failed or SMTP is not configured
    if (!emailSent) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isVerified: true, verificationToken: null }
      });
      user.isVerified = true;
    }

    const { password: _, verificationToken: _vt, resetToken: _rt, resetTokenExpiry: _rte, ...safe } = user;
    if (emailSent) {
      logger.info('User registered (pending verification)', { userId: user.id, email: user.email });
      res.status(201).json({
        user: safe,
        message: 'verificationEmailSent',
        requiresVerification: true
      });
    } else {
      logger.info('User registered & auto-verified', { userId: user.id, email: user.email });
      const { accessToken, refreshToken } = await issueTokenPair(user.id, res);
      res.status(201).json({
        user: safe,
        token: accessToken,
        refreshToken,
        requiresVerification: false
      });
    }
  } catch (error: any) {
    logger.error('Registration error', { error: error.message });
    res.status(500).json({ error: 'Error during registration' });
  }
});

app.post('/api/auth/login', loginLimiter, validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const normalizedEmail = normalizeEmail(req.body.email);
    const { password } = req.body;

    const candidates = await findUsersByEmail(normalizedEmail);

    if (candidates.length === 0) {
      // Igualamos el tiempo de respuesta para no revelar qué emails existen
      await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
      logger.warn('Login failed: User not found');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password for each candidate until one matches
    let user = null;
    for (const candidate of candidates) {
      const isMatch = await bcrypt.compare(password, candidate.password);
      if (isMatch) {
        user = candidate;
        break;
      }
    }

    if (!user) {
      logger.warn('Login failed: Password mismatch for all candidates', { email: normalizedEmail, count: candidates.length });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const requiresVerification = !user.isVerified;
    if (requiresVerification && transporter) {
      logger.warn('Login for unverified account allowed, verification still pending', { userId: user.id });
    } else if (requiresVerification) {
      logger.warn('Login for unverified account allowed because SMTP is unavailable', { userId: user.id });
      await prisma.user.update({
        where: { id: user.id },
        data: { isVerified: true, verificationToken: null }
      });
      user.isVerified = true;
    }

    const { accessToken, refreshToken } = await issueTokenPair(user.id, res);

    const { password: _, _count, verificationToken: _vt, resetToken: _rt, resetTokenExpiry: _rte, ...safe } = user;
    logger.info('User logged in', { userId: user.id });
    res.json({
      user: { ...safe, followersCount: _count.followers, followingCount: _count.following },
      token: accessToken,
      refreshToken,
      requiresVerification
    });
  } catch (error: any) {
    logger.error('Login error', { error });
    res.status(500).json({ error: 'Error interno en el inicio de sesión' });
  }
});

app.post('/api/auth/resend-verification', authLimiter, validate(resendVerificationSchema), async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const normalizedEmail = normalizeEmail(email);

    const user = (await findUsersByEmail(normalizedEmail))[0];

    // Respuesta genérica: no revela si el email existe o ya está verificado
    if (!user || user.isVerified) return res.json({ success: true });

    if (!transporter) {
      logger.error('Resend verification blocked: SMTP not configured', { userId: user.id, email: user.email });
      return res.status(503).json({ error: 'SMTP not configured' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    await prisma.user.update({
      where: { id: user.id },
      data: { verificationToken }
    });

    const verifyUrl = `${getEmailFriendlyUrl('/auth?verifyToken=' + verificationToken)}`;
    const emailContent = `
      <p class="greeting">Hola ${escapeHtml(user.name)},</p>
      <p class="message">
        Hemos recibido tu solicitud para reenviar el enlace de verificación de correo. 
        Por favor, confirma tu dirección de correo electrónico haciendo clic en el botón de abajo para activar todas las funciones de tu cuenta.
      </p>
      <div style="text-align: center;">
        <a href="${verifyUrl}" class="button">✓ Verificar mi Correo</a>
      </div>
      <div class="info-box">
        <strong>⏱️ Este enlace expira en 24 horas</strong><br>
        Una vez verificado, podrás acceder a todas nuestras funciones: crear looks, compartir, chat y más.
      </div>
      <div class="divider"></div>
      <p class="message" style="font-size: 12px;">
        Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
        <code style="background: #f5f5f5; padding: 4px 8px; border-radius: 3px; word-break: break-all; display: block; margin-top: 8px;">${verifyUrl}</code>
      </p>
    `;

    await sendMailWithRetry({
      to: user.email,
      subject: '✓ Verifica tu correo - Estilo Vivo',
      html: getEmailTemplate(emailContent, 'Verificar Correo')
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Resend verification error', { error });
    res.status(500).json({ error: 'Error resending verification email' });
  }
});

app.post('/api/auth/logout', async (req: Request, res: Response) => {
  // Try to invalidate refresh token if user is authenticated
  try {
    let token = req.cookies?.auth_token;
    if (!token) {
      const authHeader = req.headers['authorization'];
      token = authHeader && authHeader.split(' ')[1];
    }
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET!) as any;
      if (decoded?.userId) {
        await invalidateRefreshTokens(decoded.userId);
      }
    }
  } catch {}
  res.clearCookie('auth_token');
  res.json({ success: true });
});

app.post('/api/auth/refresh', validate(refreshSchema), async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true }
    });

    if (!storedToken) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    if (storedToken.expiresAt < new Date()) {
      await prisma.refreshToken.delete({ where: { id: storedToken.id } });
      return res.status(401).json({ error: 'Refresh token expired' });
    }

    // Rotate: delete old refresh token and issue new pair
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });
    const { accessToken, refreshToken: newRefreshToken } = await issueTokenPair(storedToken.userId, res);

    const { password: _, verificationToken: _vt, resetToken: _rt, resetTokenExpiry: _rte, ...safe } = storedToken.user;
    res.json({
      token: accessToken,
      refreshToken: newRefreshToken,
      user: safe
    });
  } catch (error: any) {
    logger.error('Refresh token error', { error: error.message });
    res.status(500).json({ error: 'Error refreshing token' });
  }
});

// ============= ACCOUNT MANAGEMENT =============

app.post('/api/auth/change-password', authenticateToken, validate(changePasswordSchema), async (req: any, res: Response) => {
  try {
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ error: 'invalidCurrentPassword' });

    if (currentPassword === newPassword) return res.status(400).json({ error: 'samePassword' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    // Cierra el resto de sesiones y entrega un par nuevo a la sesión actual
    await invalidateRefreshTokens(userId);
    const { accessToken, refreshToken } = await issueTokenPair(userId, res);
    res.json({ success: true, token: accessToken, refreshToken });
  } catch (error) {
    res.status(500).json({ error: 'Error changing password' });
  }
});

app.post('/api/auth/test-email', authenticateToken, validate(testEmailSchema), async (req: any, res: Response) => {
  if (!isAdmin(req.user.userId)) return res.status(403).json({ error: 'Admin only' });
  if (!transporter) return res.status(503).json({ error: 'SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS.' });
  try {
    await transporter.verify();
    const info = await transporter.sendMail({
      to: req.body.email || process.env.SMTP_USER,
      subject: 'Test Email - Estilo Vivo',
      text: 'Si recibes este correo, la configuración SMTP funciona correctamente.',
    });
    logger.info('Test email sent', { messageId: info.messageId, response: info.response });
    res.json({ success: true, messageId: info.messageId });
  } catch (err: any) {
    logger.error('Test email failed', { error: String(err) });
    res.status(500).json({ error: `SMTP Error: ${err.message || err.code || 'Unknown'}` });
  }
});

app.post('/api/auth/forgot-password', authLimiter, validate(forgotPasswordSchema), async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const user = (await findUsersByEmail(email))[0];

    if (!user) {
      // Don't reveal if user exists for security, just send success
      return res.json({ success: true, message: 'recoveryEmailSent' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 3600000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: token,
        resetTokenExpiry: expiry
      }
    });

    const resetUrl = `${getEmailFriendlyUrl('/api/reset-password/' + token)}`;

    if (!transporter) {
      logger.error('Forgot password blocked: SMTP not configured', { userId: user.id, email: user.email });
      return res.status(503).json({ error: 'SMTP not configured' });
    }

    const emailContent = `
      <p class="greeting">Hola ${escapeHtml(user.name)},</p>
      <p class="message">
        Hemos recibido una solicitud para restablecer tu contraseña en Estilo Vivo. 
        Si no fuiste tú, puedes ignorar este correo.
      </p>
      <div style="text-align: center;">
        <a href="${resetUrl}" class="button">Restablecer Contraseña</a>
      </div>
      <div class="info-box">
        <strong>⏱️ Este enlace expira en 1 hora</strong><br>
        Por razones de seguridad, los enlaces de recuperación tienen validez limitada.
      </div>
      <div class="divider"></div>
      <p class="message">
        Si tienes problemas para acceder al botón, copia y pega este enlace en tu navegador:<br>
        <code style="background: #f5f5f5; padding: 2px 6px; border-radius: 3px; word-break: break-all;">${resetUrl}</code>
      </p>
    `;

    await sendMailWithRetry({
      to: user.email,
      subject: '🔐 Recuperar contraseña - Estilo Vivo',
      html: getEmailTemplate(emailContent, 'Recuperar Contraseña')
    });

    res.json({ success: true, message: 'recoveryEmailSent' });
  } catch (error) {
    logger.error('Forgot password error', { error });
    res.status(500).json({ error: 'Error processing request' });
  }
});

app.post('/api/auth/reset-password', authLimiter, validate(resetPasswordSchema), async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() }
      }
    });

    if (!user) return res.status(400).json({ error: 'Invalid or expired token' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null
      }
    });
    await invalidateRefreshTokens(user.id);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error resetting password' });
  }
});

// Root-level recovery routes
const handleResetTokenRedirect = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() }
      }
    });

    if (!user) {
      logger.warn('GET /reset-password/:token: Invalid or expired token attempt');
      return res.redirect(`${getFrontendUrl()}/auth?error=invalid_token`);
    }

    logger.info('GET /reset-password/:token: Valid token redirection', { userId: user.id });
    res.redirect(`${getFrontendUrl()}/auth?token=${encodeURIComponent(token)}&type=reset`);
  } catch (error) {
    logger.error('Error in GET /reset-password/:token', { error });
    res.redirect(`${getFrontendUrl()}/auth?error=server_error`);
  }
};

app.get('/reset-password/:token', handleResetTokenRedirect);
app.get('/api/reset-password/:token', handleResetTokenRedirect);

app.post('/reset-password', authLimiter, async (req: Request, res: Response) => {
  try {
    const { token, newPassword, password } = req.body;
    const actualNewPassword = newPassword || password;

    if (!token) {
      return res.status(400).json({ error: 'Token requerido' });
    }
    if (!actualNewPassword || actualNewPassword.length < 8) {
      return res.status(400).json({ error: 'Contraseña debe tener al menos 8 caracteres' });
    }

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() }
      }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const hashedPassword = await bcrypt.hash(actualNewPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null
      }
    });
    await invalidateRefreshTokens(user.id);

    logger.info('POST /reset-password: Password reset successfully', { userId: user.id });
    res.json({ success: true });
  } catch (error) {
    logger.error('Error resetting password on root endpoint', { error });
    res.status(500).json({ error: 'Error resetting password' });
  }
});

app.post('/api/auth/verify-email', authLimiter, validate(verifyEmailSchema), async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    const user = await prisma.user.findFirst({
      where: { verificationToken: token }
    });

    if (!user) return res.status(400).json({ error: 'Invalid or expired verification token' });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        verificationToken: null
      }
    });

    logger.info('Email verified successfully', { userId: user.id });
    res.json({ success: true });
  } catch (error) {
    logger.error('Email verification error', { error });
    res.status(500).json({ error: 'Error verifying email' });
  }
});

app.delete('/api/auth/profile', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.user.userId;

    // Invalidate all refresh tokens before deleting
    await invalidateRefreshTokens(userId);

    // Recoge las imágenes del usuario para borrarlas del disco (RGPD)
    const [productImages, lookImages, owner, submissions, stories, messages, tryonThumbs] = await Promise.all([
      prisma.productImage.findMany({ where: { product: { userId } }, select: { filename: true } }),
      prisma.lookImage.findMany({ where: { look: { userId } }, select: { filename: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { avatar: true, fullBodyAvatar: true } }),
      prisma.challengeSubmission.findMany({ where: { userId }, select: { imageUrl: true } }),
      prisma.story.findMany({ where: { userId }, select: { imageUrl: true } }),
      prisma.message.findMany({ where: { senderId: userId, imageUrl: { not: null } }, select: { imageUrl: true } }),
      prisma.tryonPreset.findMany({ where: { userId }, select: { thumbnail: true } }),
    ]);

    // Cascading deletes in Prisma will handle products, looks, etc.
    await prisma.user.delete({
      where: { id: userId }
    });

    for (const img of [...productImages, ...lookImages]) unlinkImageVariants(img.filename);
    // Conversaciones que se quedan sin participantes (huérfanas) se eliminan; las de otros usuarios se conservan
    await prisma.conversation.deleteMany({ where: { participants: { none: {} } } });
    for (const url of [owner?.avatar, owner?.fullBodyAvatar, ...tryonThumbs.map(t => t.thumbnail), ...submissions.map(s => s.imageUrl), ...stories.map(s => s.imageUrl), ...messages.map(m => m.imageUrl)]) {
      const p = uploadUrlToPath(url);
      if (p) safeUnlink(p);
    }
    res.clearCookie('auth_token');
    logger.info('User deleted account successfully', { userId });
    res.json({ success: true });
  } catch (error) {
    logger.error('Account deletion error', { error });
    res.status(500).json({ error: 'Error deleting account' });
  }
});


app.get('/api/auth/me', authenticateToken, async (req: any, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: { _count: { select: { followers: true, following: true, products: true, looks: true } } }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password: _, _count, verificationToken: _vt, resetToken: _rt, resetTokenExpiry: _rte, ...safe } = user;
    res.json({
      ...safe,
      followersCount: _count.followers,
      followingCount: _count.following,
      garmentCount: _count.products,
      lookCount: _count.looks
    });
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error fetching user' });
  }
});

app.put('/api/auth/profile', authenticateToken, upload.fields([{ name: 'avatar', maxCount: 1 }, { name: 'fullBodyAvatar', maxCount: 1 }]), validate(updateProfileSchema), async (req: any, res: Response) => {
  try {
    const { name, bio, mood, cycleTracking, musicSync, emailNotifications, emailChat, emailFollows, emailWashing, emailChallenges, gender, birthDate, themePreset, customColor, fontSize, highContrast, isProfilePublic, locationName, darkModeSetting, language, dialect, styleColors, styleStyles, styleOccasions, styleFabrics } = req.body;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const avatarFile = files?.['avatar']?.[0];
    const fullBodyFile = files?.['fullBodyAvatar']?.[0];

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (bio !== undefined) updateData.bio = bio;
    if (mood !== undefined) updateData.mood = mood;
    if (themePreset !== undefined) updateData.themePreset = themePreset;
    if (customColor !== undefined) updateData.customColor = customColor;
    if (cycleTracking !== undefined) updateData.cycleTracking = cycleTracking === 'true' || cycleTracking === true;
    if (musicSync !== undefined) updateData.musicSync = musicSync === 'true' || musicSync === true;
    if (emailNotifications !== undefined) updateData.emailNotifications = emailNotifications === 'true' || emailNotifications === true;
    if (emailChat !== undefined) updateData.emailChat = emailChat === 'true' || emailChat === true;
    if (emailFollows !== undefined) updateData.emailFollows = emailFollows === 'true' || emailFollows === true;
    if (emailWashing !== undefined) updateData.emailWashing = emailWashing === 'true' || emailWashing === true;
    if (emailChallenges !== undefined) updateData.emailChallenges = emailChallenges === 'true' || emailChallenges === true;
    if (gender !== undefined) updateData.gender = gender;
    if (birthDate !== undefined) updateData.birthDate = birthDate ? new Date(birthDate) : null;
    if (fontSize !== undefined) updateData.fontSize = fontSize;
    if (highContrast !== undefined) updateData.highContrast = highContrast === 'true' || highContrast === true;
    if (isProfilePublic !== undefined) updateData.isProfilePublic = isProfilePublic === 'true' || isProfilePublic === true;
    if (locationName !== undefined) updateData.locationName = locationName;
    if (darkModeSetting !== undefined) updateData.darkModeSetting = darkModeSetting;
    if (language !== undefined) updateData.language = language;
    if (dialect !== undefined) updateData.dialect = dialect;
    if (styleColors !== undefined) updateData.styleColors = styleColors;
    if (styleStyles !== undefined) updateData.styleStyles = styleStyles;
    if (styleOccasions !== undefined) updateData.styleOccasions = styleOccasions;
    if (styleFabrics !== undefined) updateData.styleFabrics = styleFabrics;
    const previous = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { avatar: true, fullBodyAvatar: true } });
    if (avatarFile) {
      const stored = await reencodeSingleImage(avatarFile);
      if (!stored) return res.status(400).json({ error: 'No se pudo procesar la foto de perfil' });
      updateData.avatar = `/api/uploads/${stored}`;
    }
    if (fullBodyFile) {
      const stored = await reencodeSingleImage(fullBodyFile);
      if (!stored) return res.status(400).json({ error: 'No se pudo procesar la foto de cuerpo entero' });
      updateData.fullBodyAvatar = `/api/uploads/${stored}`;
    }

    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data: updateData,
      include: { _count: { select: { followers: true, following: true } } }
    });
    // Borra las imágenes anteriores reemplazadas
    if (updateData.avatar && isOwnUploadUrl(previous?.avatar)) safeUnlink(path.join(UPLOADS_DIR, path.basename(previous!.avatar!)));
    if (updateData.fullBodyAvatar && isOwnUploadUrl(previous?.fullBodyAvatar)) safeUnlink(path.join(UPLOADS_DIR, path.basename(previous!.fullBodyAvatar!)));
    const { password: _, _count, verificationToken: _vt, resetToken: _rt, resetTokenExpiry: _rte, ...safe } = user;
    res.json({ ...safe, followersCount: _count.followers, followingCount: _count.following });
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error updating profile' });
  }
});

app.put('/api/auth/preferences', authenticateToken, async (req: any, res: Response) => {
  try {
    const booleanKeys = ['cycleTracking', 'musicSync', 'emailNotifications', 'emailChat', 'emailFollows', 'emailWashing', 'emailChallenges', 'isProfilePublic', 'highContrast'];
    const stringKeys = ['themePreset', 'customColor', 'styleColors', 'styleStyles', 'styleOccasions', 'styleFabrics', 'locationName', 'darkModeSetting', 'fontSize', 'language', 'dialect'];
    const updateData: any = {};
    for (const key of booleanKeys) {
      const val = req.body[key];
      if (val === undefined) continue;
      if (typeof val === 'boolean') updateData[key] = val;
      else if (val === 'true' || val === '1') updateData[key] = true;
      else if (val === 'false' || val === '0') updateData[key] = false;
      else return res.status(400).json({ error: `Invalid value for ${key}` });
    }
    for (const key of stringKeys) {
      const val = req.body[key];
      if (val === undefined) continue;
      if (val === null) { updateData[key] = null; continue; }
      const str = Array.isArray(val) ? JSON.stringify(val) : typeof val === 'string' ? val : null;
      if (str === null || str.length > 2000) return res.status(400).json({ error: `Invalid value for ${key}` });
      updateData[key] = str;
    }
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No valid preferences provided' });
    }
    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data: updateData,
    });
    const { password: _, verificationToken: _vt, resetToken: _rt, resetTokenExpiry: _rte, ...safe } = user;
    res.json(safe);
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error updating preferences' });
  }
});

// ============= PRODUCTOS =============

app.get('/api/products', authenticateToken, async (req: any, res: Response) => {
  try {
    const { cursor, limit = '20' } = req.query;
    const pageSize = Math.max(1, Math.min(100, parseInt(limit as string) || 20));
    const take = pageSize + 1;

    const products = await prisma.product.findMany({
      where: { userId: req.user.userId },
      include: { images: true, user: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
      take,
      ...(cursor ? { cursor: { id: cursor as string }, skip: 1 } : {}),
    });

    const hasMore = products.length > pageSize;
    const items = hasMore ? products.slice(0, -1) : products;
    const nextCursor = hasMore ? items[items.length - 1]?.id : null;

    res.json({ items, nextCursor, hasMore });
  } catch (error: any) {
    logger.error('Error fetching products', {
      error: error.message,
      stack: error.stack,
      userId: req.user.userId
    });
    res.status(500).json({ error: 'Error fetching products' });
  }
});

app.get('/api/products/shop', authenticateToken, async (req: any, res: Response) => {
  try {
    const { search, category } = req.query;
    const shopBlocked = await getBlockedIds(req.user.userId);
    const where: any = { forSale: true, userId: { notIn: [req.user.userId, ...shopBlocked] } };
    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { brand: { contains: search as string } },
        { category: { contains: search as string } },
      ];
    }
    if (category && category !== 'all') where.category = category as string;

    const products = await prisma.product.findMany({
      where,
      include: { images: true, user: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json(products);
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error fetching shop products' });
  }
});

app.post('/api/products', authenticateToken, upload.array('images', 5), validate(productSchema), async (req: any, res: Response) => {
  try {
    const { name, category, color, season, brand, size, condition, description, price, forSale, isWashing } = req.body;
    const files = req.files as Express.Multer.File[] | undefined;

    // Enforce sale limit for non-premium users (max 5 items for sale)
    if (forSale === true || forSale === 'true') {
      const saleCount = await prisma.product.count({
        where: { userId: req.user.userId, forSale: true }
      });
      if (saleCount >= 5) {
        return res.status(403).json({ error: 'Los usuarios gratuitos pueden tener un máximo de 5 prendas a la venta. Actualiza a Premium para ventas ilimitadas.' });
      }
    }

    const processedImages = await processUploadedImages(files, true);
    if (files && files.length > 0 && processedImages.length === 0) {
      return res.status(400).json({ error: 'No se pudo procesar la imagen. Prueba con otra foto (JPG, PNG o WEBP).' });
    }

    const parsedPrice = price !== undefined && price !== null && price !== '' ? parseFloat(price) : null;
    if (parsedPrice !== null && (isNaN(parsedPrice) || parsedPrice < 0 || parsedPrice > 100000)) {
      return res.status(400).json({ error: 'Precio inválido' });
    }

    const product = await prisma.product.create({
      data: {
        name: name || category || 'Sin nombre',
        category: category || 'top',
        color: color || null,
        season: season || 'all',
        brand: brand || null,
        size: size || null,
        condition: condition || 'new',
        description: description || null,
        price: parsedPrice,
        forSale: forSale === 'true' || forSale === true,
        isWashing: isWashing === 'true' || isWashing === true,
        userId: req.user.userId,
        images: {
          create: processedImages.map(img => ({
            filename: img.filename,
            url: img.url
          })),
        },
      },
      include: { images: true, user: { select: { id: true, name: true, avatar: true } } },
    });

    logger.info('Product created', { productId: product.id, userId: req.user.userId });
    res.status(201).json(product);
    // Fire-and-forget: award XP for uploading a garment
    awardPoints(prisma, req.user.userId, 'garment').catch(e => logger.warn('awardPoints failed', { e }));
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error creating product' });
  }
});

app.put('/api/products/:id', authenticateToken, upload.array('images', 5), validate(productSchema), async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { name, category, color, season, brand, size, condition, description, price, forSale, usageCount, isWashing } = req.body;
    const files = req.files as Express.Multer.File[] | undefined;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.user.userId) return res.status(403).json({ error: 'Not authorized' });

    // Enforce sale limit for non-premium users when toggling forSale to true
    if ((forSale === true || forSale === 'true') && !existing.forSale) {
      const saleCount = await prisma.product.count({
        where: { userId: req.user.userId, forSale: true }
      });
      if (saleCount >= 5) {
        return res.status(403).json({ error: 'Los usuarios gratuitos pueden tener un máximo de 5 prendas a la venta. Actualiza a Premium para ventas ilimitadas.' });
      }
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (category !== undefined) updateData.category = category;
    if (color !== undefined) updateData.color = color;
    if (season !== undefined) updateData.season = season;
    if (brand !== undefined) updateData.brand = brand;
    if (size !== undefined) updateData.size = size;
    if (condition !== undefined) updateData.condition = condition;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) {
      const parsedPrice = price === null || price === '' ? null : parseFloat(price);
      if (parsedPrice !== null && (isNaN(parsedPrice) || parsedPrice < 0 || parsedPrice > 100000)) {
        return res.status(400).json({ error: 'Precio inválido' });
      }
      updateData.price = parsedPrice;
    }
    if (forSale !== undefined) updateData.forSale = forSale === 'true' || forSale === true;
    if (isWashing !== undefined) updateData.isWashing = isWashing === 'true' || isWashing === true;
    if (usageCount !== undefined) {
      const parsedUsage = parseInt(usageCount);
      if (!isNaN(parsedUsage) && parsedUsage >= 0) updateData.usageCount = parsedUsage;
    }

    const processedImages = await processUploadedImages(files, true);

    // Delete old images when new ones are uploaded (replace, not append)
    if (processedImages.length > 0) {
      const oldImages = await prisma.productImage.findMany({ where: { productId: id } });
      for (const img of oldImages) unlinkImageVariants(img.filename);
      await prisma.productImage.deleteMany({ where: { productId: id } });
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...updateData,
        ...(processedImages.length > 0 ? {
          images: { create: processedImages.map((img) => ({ filename: img.filename, url: img.url })) }
        } : {}),
      },
      include: { images: true, user: { select: { id: true, name: true, avatar: true } } },
    });

    if (existing.isWashing !== updateData.isWashing && updateData.isWashing === true) {
      const notification = await prisma.notification.create({
        data: {
          type: 'WASHING',
          content: `La prenda "${product.name}" está ahora en la lavadora`,
          userId: req.user.userId
        }
      });
      io.to(`user_${req.user.userId}`).emit('notification', notification);
      void sendPreferenceEmail({
        userId: req.user.userId,
        subject: 'Tu prenda está en la lavadora - Estilo Vivo',
        text: `La prenda "${product.name}" está ahora en la lavadora`,
        html: `<p>La prenda <strong>${escapeHtml(product.name)}</strong> está ahora en la lavadora.</p>`,
        context: { type: 'WASHING', productId: product.id },
        preference: 'emailWashing'
      });
    }

    res.json(product);
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error updating product' });
  }
});

app.delete('/api/products/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.product.findUnique({ where: { id }, include: { images: true } });
    if (!existing || existing.userId !== req.user.userId) return res.status(403).json({ error: 'Not authorized' });

    await prisma.product.delete({ where: { id } });
    for (const img of existing.images) unlinkImageVariants(img.filename);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error deleting product' });
  }
});

app.post('/api/products/:id/wear', authenticateToken, async (req: any, res: Response) => {
  try {
    const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.user.userId) return res.status(403).json({ error: 'Not authorized' });
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { usageCount: { increment: 1 }, lastWorn: new Date() },
      include: { images: true }
    });
    res.json(product);
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error updating wear count' });
  }
});

// ============= LOOKS =============

app.get('/api/looks', authenticateToken, async (req: any, res: Response) => {
  try {
    const { cursor, limit = '20' } = req.query;
    const pageSize = Math.max(1, Math.min(100, parseInt(limit as string) || 20));
    const take = pageSize + 1;

    const looks = await prisma.look.findMany({
      where: { userId: req.user.userId },
      include: {
        images: true,
        user: { select: { id: true, name: true, avatar: true } },
        products: { include: { images: true } },
        _count: { select: { likes: true, comments: true } }
      },
      orderBy: { createdAt: 'desc' },
      take,
      ...(cursor ? { cursor: { id: cursor as string }, skip: 1 } : {}),
    });

    const hasMore = looks.length > pageSize;
    const items = hasMore ? looks.slice(0, -1) : looks;

    const likedIds = new Set((await prisma.like.findMany({
      where: { userId: req.user.userId, lookId: { in: items.map(l => l.id) } },
      select: { lookId: true }
    })).map(l => l.lookId));

    const looksWithMeta = items.map(l => ({
      ...l, likesCount: l._count.likes, commentsCount: l._count.comments, isLiked: likedIds.has(l.id)
    }));

    const nextCursor = hasMore ? items[items.length - 1]?.id : null;

    res.json({ items: looksWithMeta, nextCursor, hasMore });
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error fetching looks' });
  }
});

app.get('/api/looks/feed', optionalAuth, async (req: any, res: Response) => {
  try {
    const { cursor, limit = '20' } = req.query;
    const pageSize = Math.max(1, Math.min(100, parseInt(limit as string) || 20));
    const take = pageSize + 1;

    const feedBlocked = await getBlockedIds(req.user?.userId);
    const looks = await prisma.look.findMany({
      where: { isPublic: true, products: { none: { forSale: true } }, ...notBlocked(feedBlocked) },
      include: {
        images: true,
        user: { select: { id: true, name: true, avatar: true } },
        products: { include: { images: true } },
        _count: { select: { likes: true, comments: true } }
      },
      orderBy: { createdAt: 'desc' },
      take,
      ...(cursor ? { cursor: { id: cursor as string }, skip: 1 } : {}),
    });

    const hasMore = looks.length > pageSize;
    const items = hasMore ? looks.slice(0, -1) : looks;
    const lookIds = items.map(l => l.id);

    // Only fetch user-specific data if user is authenticated
    let likedIds = new Set<string>();
    let favIds = new Set<string>();

    if (req.user?.userId) {
      const likedLooks = await prisma.like.findMany({
        where: { userId: req.user.userId, lookId: { in: lookIds } },
        select: { lookId: true }
      });
      likedIds = new Set(likedLooks.map(l => l.lookId));

      const favLooks = await prisma.favorite.findMany({
        where: { userId: req.user.userId, lookId: { in: lookIds } },
        select: { lookId: true }
      });
      favIds = new Set(favLooks.map(f => f.lookId));
    }

    const looksWithMeta = items.map(l => ({
      ...l, likesCount: l._count.likes, commentsCount: l._count.comments,
      isLiked: likedIds.has(l.id), isFavorited: favIds.has(l.id)
    }));

    const nextCursor = hasMore ? items[items.length - 1]?.id : null;

    res.json({ items: looksWithMeta, nextCursor, hasMore });
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error fetching feed' });
  }
});

app.post('/api/looks', authenticateToken, upload.array('images', 10), validate(lookSchema), async (req: any, res: Response) => {
  try {
    const { title, productIds, isPublic, mood, tags } = req.body;
    const files = req.files as Express.Multer.File[] | undefined;
    const rawIds = parseJsonArray(productIds);
    if (!rawIds) {
      (files || []).forEach(file => safeUnlink(file.path));
      return res.status(400).json({ error: 'Invalid productIds' });
    }
    const parsedTags = parseJsonArray(tags);
    if (!parsedTags) {
      (files || []).forEach(file => safeUnlink(file.path));
      return res.status(400).json({ error: 'Invalid tags' });
    }
    // Sólo se pueden vincular prendas propias
    const parsedIds = await ownProductIds(rawIds, req.user.userId);

    const processedImages = await processUploadedImages(files);

    const look = await prisma.look.create({
      data: {
        title,
        userId: req.user.userId,
        isPublic: isPublic === 'true' || isPublic === true,
        mood: mood || null,
        tags: parsedTags.length > 0 ? JSON.stringify(parsedTags.filter(t => typeof t === 'string').slice(0, 20)) : null,
        products: { connect: parsedIds.map((id: string) => ({ id })) },
        images: {
          create: processedImages.map(img => ({
            filename: img.filename,
            url: img.url
          }))
        },
      },
      include: {
        images: true, products: { include: { images: true } },
        user: { select: { id: true, name: true, avatar: true } },
        _count: { select: { likes: true, comments: true } }
      },
    });

    logger.info('Look created', { lookId: look.id, userId: req.user.userId });
    res.status(201).json({ ...look, likesCount: 0, commentsCount: 0, isLiked: false });
    // Fire-and-forget: award XP for creating a look
    awardPoints(prisma, req.user.userId, 'look').catch(e => logger.warn('awardPoints failed', { e }));
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error creating look' });
  }
});

app.put('/api/looks/:id', authenticateToken, validate(lookUpdateSchema), async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { title, isPublic, mood, productIds, tags } = req.body;
    const existing = await prisma.look.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.user.userId) return res.status(403).json({ error: 'Not authorized' });

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (isPublic !== undefined) updateData.isPublic = isPublic === 'true' || isPublic === true;
    if (mood !== undefined) updateData.mood = mood;
    if (tags !== undefined) {
      const parsedTags = parseJsonArray(tags);
      if (!parsedTags) return res.status(400).json({ error: 'Invalid tags' });
      updateData.tags = parsedTags.length > 0 ? JSON.stringify(parsedTags.filter(t => typeof t === 'string').slice(0, 20)) : null;
    }
    if (productIds !== undefined) {
      const rawIds = parseJsonArray(productIds);
      if (!rawIds) return res.status(400).json({ error: 'Invalid productIds JSON' });
      const ids = await ownProductIds(rawIds, req.user.userId);
      updateData.products = { set: ids.map((pid: string) => ({ id: pid })) };
    }

    const look = await prisma.look.update({
      where: { id }, data: updateData,
      include: { images: true, products: { include: { images: true } }, user: { select: { id: true, name: true, avatar: true } } },
    });
    res.json(look);
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error updating look' });
  }
});

app.delete('/api/looks/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.look.findUnique({ where: { id }, include: { images: true } });
    if (!existing || existing.userId !== req.user.userId) return res.status(403).json({ error: 'Not authorized' });
    await prisma.look.delete({ where: { id } });
    for (const img of existing.images) unlinkImageVariants(img.filename);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error deleting look' });
  }
});

// ============= TRYON PRESETS =============

app.get('/api/tryon-presets', authenticateToken, async (req: any, res: Response) => {
  try {
    const presets = await prisma.tryonPreset.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'asc' },
    });
    res.json(presets.map(p => ({
      id: p.id,
      name: p.name,
      thumbnail: p.thumbnail,
      layers: JSON.parse(p.layers || '[]'),
      rating: p.rating,
      occasion: p.occasion,
    })));
  } catch (error) {
    logger.error('Error fetching tryon presets', { error });
    res.status(500).json({ error: 'Error fetching presets' });
  }
});

app.post('/api/tryon-presets', authenticateToken, async (req: any, res: Response) => {
  try {
    const { name, thumbnail, layers, rating, occasion } = req.body;
    if (layers !== undefined && !Array.isArray(layers)) return res.status(400).json({ error: 'Invalid layers' });
    if (thumbnail && (typeof thumbnail !== 'string' || !/^data:image\/(png|jpeg|webp);base64,/.test(thumbnail) && !isOwnUploadUrl(thumbnail))) {
      return res.status(400).json({ error: 'Invalid thumbnail' });
    }
    const presetCount = await prisma.tryonPreset.count({ where: { userId: req.user.userId } });
    if (presetCount >= 50) return res.status(400).json({ error: 'Has alcanzado el máximo de 50 looks guardados' });
    const preset = await prisma.tryonPreset.create({
      data: {
        userId: req.user.userId,
        name: typeof name === 'string' && name.trim() ? name.trim().slice(0, 80) : 'Look',
        thumbnail: thumbnail || null,
        layers: JSON.stringify(layers || []),
        rating: rating || null,
        occasion: occasion || null,
      },
    });
    res.json({
      id: preset.id,
      name: preset.name,
      thumbnail: preset.thumbnail,
      layers: JSON.parse(preset.layers || '[]'),
      rating: preset.rating,
      occasion: preset.occasion,
    });
  } catch (error) {
    logger.error('Error creating tryon preset', { error });
    res.status(500).json({ error: 'Error creating preset' });
  }
});

app.put('/api/tryon-presets/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.tryonPreset.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.user.userId) return res.status(403).json({ error: 'Not authorized' });
    const { name, thumbnail, layers, rating, occasion } = req.body;
    const preset = await prisma.tryonPreset.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(thumbnail !== undefined && { thumbnail }),
        ...(layers !== undefined && { layers: JSON.stringify(layers) }),
        ...(rating !== undefined && { rating }),
        ...(occasion !== undefined && { occasion }),
      },
    });
    res.json({
      id: preset.id,
      name: preset.name,
      thumbnail: preset.thumbnail,
      layers: JSON.parse(preset.layers || '[]'),
      rating: preset.rating,
      occasion: preset.occasion,
    });
  } catch (error) {
    logger.error('Error updating tryon preset', { error });
    res.status(500).json({ error: 'Error updating preset' });
  }
});

app.delete('/api/tryon-presets/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.tryonPreset.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.user.userId) return res.status(403).json({ error: 'Not authorized' });
    await prisma.tryonPreset.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting tryon preset', { error });
    res.status(500).json({ error: 'Error deleting preset' });
  }
});

// ============= SOCIAL =============

app.post('/api/social/like', authenticateToken, async (req: any, res: Response) => {
  try {
    const { lookId } = req.body;
    const userId = req.user.userId;
    const look = await canViewLook(lookId, userId);
    if (!look) return res.status(404).json({ error: 'Look no encontrado' });
    let liked = false;
    try {
      await prisma.like.create({ data: { userId, lookId } });
      liked = true;
    } catch (e: any) {
      if (e.code === 'P2002') {
        await prisma.like.delete({ where: { userId_lookId: { userId, lookId } } });
      } else {
        throw e;
      }
    }
    // El XP de "recibir like" es para el autor del look (y se retira al quitar el like)
    if (look.userId !== userId) {
      if (liked) awardXp(prisma, look.userId, XP_VALUES.receiveLike).catch(() => {});
      else removeXp(prisma, look.userId, XP_VALUES.receiveLike).catch(() => {});
    }
    if (liked) {
      if (look.userId !== userId) {
        const me = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
        const notif = await prisma.notification.create({
          data: { type: 'LIKE', content: `A ${me?.name || 'alguien'} le gustó tu publicación`, userId: look.userId, relatedId: lookId }
        });
        io.to(`user_${look.userId}`).emit('notification', notif);
        void sendPreferenceEmail({
          userId: look.userId,
          subject: 'A alguien le gustó tu publicación - Estilo Vivo',
          text: `A ${me?.name || 'alguien'} le gustó tu publicación`,
          html: `<p>A <strong>${escapeHtml(me?.name || 'Alguien')}</strong> le gustó tu publicación.</p>`,
          context: { type: 'LIKE', relatedId: lookId }
        });
      }
    }
    res.json({ liked, likesCount: await prisma.like.count({ where: { lookId } }) });
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error toggling like' });
  }
});

// Lista paginada (cursor) de quién dio "me gusta" a un look: más recientes primero.
// Cursor opaco = base64url("<createdAt ms>:<likeId>"); orden estable (createdAt desc, id desc).
const LIKES_PAGE_DEFAULT = 30;
const LIKES_PAGE_MAX = 50;
const likesQuerySchema = z.object({
  limit: z.preprocess(
    (v) => (v === undefined || v === '' ? LIKES_PAGE_DEFAULT : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : NaN),
    z.number({ invalid_type_error: 'limit debe ser un entero' }).int().min(1, 'limit mínimo 1').max(LIKES_PAGE_MAX, `limit máximo ${LIKES_PAGE_MAX}`)
  ),
  cursor: z.string().max(200, 'cursor inválido').optional()
});
const encodeLikesCursor = (createdAt: Date, id: string) =>
  Buffer.from(`${createdAt.getTime()}:${id}`, 'utf8').toString('base64url');
const decodeLikesCursor = (raw: string): { createdAt: Date; id: string } | null => {
  if (!/^[A-Za-z0-9_-]+$/.test(raw)) return null;
  const m = /^(\d{1,15}):([A-Za-z0-9_-]{1,64})$/.exec(Buffer.from(raw, 'base64url').toString('utf8'));
  if (!m) return null;
  const createdAt = new Date(Number(m[1]));
  return isNaN(createdAt.getTime()) ? null : { createdAt, id: m[2] };
};

app.get('/api/social/likes/:lookId', authenticateToken, async (req: any, res: Response) => {
  try {
    const parsed = likesQuerySchema.safeParse({
      limit: typeof req.query.limit === 'string' ? req.query.limit : req.query.limit === undefined ? undefined : 'x',
      cursor: typeof req.query.cursor === 'string' ? req.query.cursor : req.query.cursor === undefined ? undefined : 'x'
    });
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Error de validación',
        details: parsed.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
      });
    }
    const { limit, cursor } = parsed.data;
    let after: { createdAt: Date; id: string } | null = null;
    if (cursor) {
      after = decodeLikesCursor(cursor);
      if (!after) return res.status(400).json({ error: 'Error de validación', details: [{ field: 'cursor', message: 'cursor inválido' }] });
    }
    const lookId = req.params.lookId;
    // Misma regla de acceso que POST /like y GET /comments (404 si no existe / privado sin seguir)
    if (!(await canViewLook(lookId, req.user.userId))) return res.status(404).json({ error: 'Look no encontrado' });

    const rows = await prisma.like.findMany({
      where: {
        lookId,
        ...notBlocked(await getBlockedIds(req.user.userId)),
        ...(after ? { OR: [{ createdAt: { lt: after.createdAt } }, { createdAt: after.createdAt, id: { lt: after.id } }] } : {})
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: { id: true, createdAt: true, user: { select: { id: true, name: true, avatar: true } } }
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    res.json({
      users: page.map(r => ({ id: r.user.id, name: r.user.name, avatar: r.user.avatar })),
      nextCursor: hasMore && last ? encodeLikesCursor(last.createdAt, last.id) : null
    });
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error fetching likes' });
  }
});

app.post('/api/social/comment', authenticateToken, validate(commentSchema), async (req: any, res: Response) => {
  try {
    const { lookId, content, parentId } = req.body;
    const visibleLook = await canViewLook(lookId, req.user.userId);
    if (!visibleLook) return res.status(404).json({ error: 'Look no encontrado' });
    if (parentId) {
      const parentComment = await prisma.comment.findUnique({ where: { id: parentId }, select: { lookId: true } });
      if (!parentComment || parentComment.lookId !== lookId) return res.status(400).json({ error: 'Comentario padre inválido' });
    }
    const comment = await prisma.comment.create({
      data: { userId: req.user.userId, lookId, content, parentId: parentId || null },
      include: { user: { select: { id: true, name: true, avatar: true } }, replies: { include: { user: { select: { id: true, name: true, avatar: true } } }, orderBy: { createdAt: 'asc' } } }
    });
    const look = await prisma.look.findUnique({ where: { id: lookId }, select: { userId: true } });
    if (look && look.userId !== req.user.userId) {
      const me = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { name: true } });
      const notif = await prisma.notification.create({
        data: { type: 'COMMENT', content: `${me?.name || 'Alguien'} comentó tu publicación`, userId: look.userId, relatedId: lookId }
      });
      io.to(`user_${look.userId}`).emit('notification', notif);
      void sendPreferenceEmail({
        userId: look.userId,
        subject: 'Nuevo comentario en tu publicación - Estilo Vivo',
        text: `${me?.name || 'Alguien'} comentó tu publicación`,
        html: `<p><strong>${escapeHtml(me?.name || 'Alguien')}</strong> comentó tu publicación.</p>`,
        context: { type: 'COMMENT', relatedId: lookId }
      });
    }
    if (parentId) {
      const parent = await prisma.comment.findUnique({ where: { id: parentId }, select: { userId: true } });
      if (parent && parent.userId !== req.user.userId) {
        const me = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { name: true } });
        const notif = await prisma.notification.create({
          data: { type: 'COMMENT', content: `${me?.name || 'Alguien'} respondió a tu comentario`, userId: parent.userId, relatedId: lookId }
        });
        io.to(`user_${parent.userId}`).emit('notification', notif);
        void sendPreferenceEmail({
          userId: parent.userId,
          subject: 'Respuesta a tu comentario - Estilo Vivo',
          text: `${me?.name || 'Alguien'} respondió a tu comentario`,
          html: `<p><strong>${escapeHtml(me?.name || 'Alguien')}</strong> respondió a tu comentario.</p>`,
          context: { type: 'COMMENT_REPLY', relatedId: lookId }
        });
      }
    }
    res.status(201).json(comment);
    awardXp(prisma, req.user.userId, XP_VALUES.comment).catch(() => {});
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error adding comment' });
  }
});

app.get('/api/social/comments/:lookId', authenticateToken, async (req: any, res: Response) => {
  try {
    if (!(await canViewLook(req.params.lookId, req.user.userId))) return res.status(404).json({ error: 'Look no encontrado' });
    const cBlocked = await getBlockedIds(req.user.userId);
    const comments = await prisma.comment.findMany({
      where: { lookId: req.params.lookId, parentId: null, ...notBlocked(cBlocked) },
      include: { user: { select: { id: true, name: true, avatar: true } }, replies: { where: notBlocked(cBlocked), include: { user: { select: { id: true, name: true, avatar: true } } }, orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(comments);
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error fetching comments' });
  }
});

app.delete('/api/social/comment/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const existing = await prisma.comment.findUnique({ where: { id: req.params.id }, include: { look: { select: { userId: true } } } });
    // Puede borrar el autor del comentario o el dueño del look (moderación)
    if (!existing || (existing.userId !== req.user.userId && existing.look?.userId !== req.user.userId)) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    await prisma.comment.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error deleting comment' });
  }
});

app.post('/api/social/favorite', authenticateToken, validate(favoriteSchema), async (req: any, res: Response) => {
  try {
    const { lookId, productId } = req.body;
    const userId = req.user.userId;
    if (lookId) {
      if (!(await canViewLook(lookId, userId))) return res.status(404).json({ error: 'Look no encontrado' });
      let favorited = false;
      try {
        await prisma.favorite.create({ data: { userId, lookId } });
        favorited = true;
      } catch (e: any) {
        if (e.code === 'P2002') {
          await prisma.favorite.delete({ where: { userId_lookId: { userId, lookId } } });
        } else { throw e; }
      }
      res.json({ favorited });
    } else if (productId) {
      const product = await prisma.product.findUnique({ where: { id: productId }, select: { userId: true, forSale: true } });
      if (!product || (product.userId !== userId && !product.forSale)) return res.status(404).json({ error: 'Prenda no encontrada' });
      let favorited = false;
      try {
        await prisma.favorite.create({ data: { userId, productId } });
        favorited = true;
      } catch (e: any) {
        if (e.code === 'P2002') {
          await prisma.favorite.delete({ where: { userId_productId: { userId, productId } } });
        } else { throw e; }
      }
      res.json({ favorited });
    } else {
      res.status(400).json({ error: 'lookId or productId required' });
    }
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error toggling favorite' });
  }
});

app.get('/api/social/favorites', authenticateToken, async (req: any, res: Response) => {
  try {
    const favBlocked = await getBlockedIds(req.user.userId);
    const favorites = await prisma.favorite.findMany({
      where: {
        userId: req.user.userId,
        ...(favBlocked.length ? { AND: [
          { OR: [{ lookId: null }, { look: { userId: { notIn: favBlocked } } }] },
          { OR: [{ productId: null }, { product: { userId: { notIn: favBlocked } } }] }
        ] } : {})
      },
      include: {
        look: { include: { images: true, user: { select: { id: true, name: true, avatar: true } }, products: { include: { images: true } }, _count: { select: { likes: true, comments: true } } } },
        product: { include: { images: true, user: { select: { id: true, name: true, avatar: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(favorites);
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error fetching favorites' });
  }
});

app.post('/api/social/follow', authenticateToken, validate(followSchema), async (req: any, res: Response) => {
  try {
    const { targetUserId } = req.body;
    const userId = req.user.userId;
    if (userId === targetUserId) return res.status(400).json({ error: 'Cannot follow yourself' });

    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId }, select: { isProfilePublic: true } });
    if (!targetUser) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (await isBlockedBetween(userId, targetUserId)) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Si ya le sigue, el botón siempre deja de seguir (también en perfiles privados)
    const alreadyFollowing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: userId, followingId: targetUserId } }
    });
    if (alreadyFollowing) {
      await prisma.follow.delete({ where: { id: alreadyFollowing.id } });
      await prisma.followRequest.deleteMany({ where: { requesterId: userId, targetId: targetUserId } });
      return res.json({ following: false });
    }

    if (targetUser.isProfilePublic === false) {
      // Private profile: create a follow request instead of direct follow
      const existing = await prisma.followRequest.findUnique({
        where: { requesterId_targetId: { requesterId: userId, targetId: targetUserId } }
      });
      if (existing) {
        if (existing.status === 'pending') {
          // Segundo toque: cancelar la solicitud
          await prisma.followRequest.delete({ where: { id: existing.id } });
          return res.json({ requesting: false, following: false });
        }
        await prisma.followRequest.update({ where: { id: existing.id }, data: { status: 'pending', createdAt: new Date() } });
      } else {
        await prisma.followRequest.create({ data: { requesterId: userId, targetId: targetUserId } });
      }
      const me = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, avatar: true } });
      const notif = await prisma.notification.create({
        data: { type: 'FOLLOW', content: `${me?.name || 'Alguien'} quiere seguirte`, userId: targetUserId, relatedId: userId }
      });
      io.to(`user_${targetUserId}`).emit('notification', notif);
      return res.json({ requesting: true });
    }

    // Public profile: direct follow toggle
    let following = false;
    try {
      await prisma.follow.create({ data: { followerId: userId, followingId: targetUserId } });
      following = true;
    } catch (e: any) {
      if (e.code === 'P2002') {
        await prisma.follow.delete({ where: { followerId_followingId: { followerId: userId, followingId: targetUserId } } });
      } else { throw e; }
    }
    if (following) {
      const me = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, avatar: true } });
      const notif = await prisma.notification.create({
        data: { type: 'FOLLOW', content: `${me?.name || 'Alguien'} te siguió`, userId: targetUserId, relatedId: userId }
      });
      io.to(`user_${targetUserId}`).emit('notification', notif);
      void sendPreferenceEmail({
        userId: targetUserId,
        subject: 'Nuevo seguidor en Estilo Vivo',
        text: `${me?.name || 'Alguien'} te siguió`,
        html: `<p><strong>${escapeHtml(me?.name || 'Alguien')}</strong> te siguió.</p><p><a href="${getEmailFriendlyUrl('/user/' + encodeURIComponent(userId))}">Ver perfil</a></p>`,
        context: { type: 'FOLLOW' },
        preference: 'emailFollows'
      });
    }
    res.json({ following });
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error toggling follow' });
  }
});

// ============= FOLLOW REQUESTS =============
app.get('/api/social/follow-requests', authenticateToken, async (req: any, res: Response) => {
  try {
    const requests = await prisma.followRequest.findMany({
      where: { targetId: req.user.userId, status: 'pending' },
      include: { requester: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(requests);
  } catch (error) {
    logger.error('Error fetching follow requests', { error });
    res.status(500).json({ error: 'Error fetching follow requests' });
  }
});

app.put('/api/social/follow-requests/:id/approve', authenticateToken, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const request = await prisma.followRequest.findUnique({ where: { id } });
    if (!request || request.targetId !== req.user.userId) return res.status(403).json({ error: 'Not authorized' });
    if (request.status !== 'pending') return res.status(400).json({ error: 'La solicitud ya fue gestionada' });
    await prisma.followRequest.update({ where: { id }, data: { status: 'approved' } });
    await prisma.follow.upsert({
      where: { followerId_followingId: { followerId: request.requesterId, followingId: request.targetId } },
      update: {},
      create: { followerId: request.requesterId, followingId: request.targetId },
    });
    // Notify requester
    const me = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { name: true, avatar: true } });
    const notif = await prisma.notification.create({
      data: { type: 'FOLLOW', content: `${me?.name || 'Alguien'} aceptó tu solicitud de seguimiento`, userId: request.requesterId, relatedId: req.user.userId }
    });
    io.to(`user_${request.requesterId}`).emit('notification', notif);
    res.json({ approved: true });
  } catch (error) {
    logger.error('Error approving follow request', { error });
    res.status(500).json({ error: 'Error approving follow request' });
  }
});

app.put('/api/social/follow-requests/:id/reject', authenticateToken, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const request = await prisma.followRequest.findUnique({ where: { id } });
    if (!request || request.targetId !== req.user.userId) return res.status(403).json({ error: 'Not authorized' });
    await prisma.followRequest.update({ where: { id }, data: { status: 'rejected' } });
    res.json({ rejected: true });
  } catch (error) {
    logger.error('Error rejecting follow request', { error });
    res.status(500).json({ error: 'Error rejecting follow request' });
  }
});

// ============= MODERACIÓN: DENUNCIAS Y BLOQUEOS =============

const REPORT_TARGETS = ['USER', 'LOOK', 'COMMENT', 'STORY', 'MESSAGE'] as const;
const REPORT_REASONS = ['SPAM', 'HARASSMENT', 'INAPPROPRIATE', 'IMPERSONATION', 'OTHER'] as const;
const reportSchema = z.object({
  targetType: z.enum(REPORT_TARGETS),
  targetId: z.string().trim().min(1).max(100),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(500, 'details máximo 500 caracteres').optional()
});
const blockSchema = z.object({ userId: z.string().trim().min(1).max(100) });
const userKeyLimiter = (max: number, windowMs: number, message: string) => rateLimit({
  windowMs, max, message: { error: message }, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req: any) => `u:${req.user?.userId || 'anon'}`,
});
// Anti-abuso: máx. REPORT_RATE_MAX denuncias por usuario y hora (defecto 20)
const reportLimiter = userKeyLimiter(parseInt(process.env.REPORT_RATE_MAX || '20', 10), 60 * 60 * 1000, 'Demasiadas denuncias. Inténtalo más tarde.');
const exportLimiter = userKeyLimiter(parseInt(process.env.EXPORT_RATE_MAX || '3', 10), 60 * 60 * 1000, 'Solo puedes exportar tus datos 3 veces por hora.');

app.post('/api/reports', authenticateToken, reportLimiter, validate(reportSchema), async (req: any, res: Response) => {
  try {
    const { targetType, targetId, reason, details } = req.body;
    const reporterId: string = req.user.userId;
    let ownerId: string | null = null; // autor del objetivo (para impedir la auto-denuncia)

    if (targetType === 'USER') {
      const u = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
      ownerId = u?.id ?? null;
    } else if (targetType === 'LOOK') {
      ownerId = (await canViewLook(targetId, reporterId))?.userId ?? null;
    } else if (targetType === 'COMMENT') {
      const c = await prisma.comment.findUnique({ where: { id: targetId }, select: { userId: true, lookId: true } });
      if (c && (await canViewLook(c.lookId, reporterId))) ownerId = c.userId;
    } else if (targetType === 'STORY') {
      const s = await prisma.story.findUnique({ where: { id: targetId }, select: { userId: true, expiresAt: true } });
      if (s && (s.userId === reporterId || !(await isBlockedBetween(reporterId, s.userId)))) ownerId = s.userId;
    } else if (targetType === 'MESSAGE') {
      const m = await prisma.message.findUnique({ where: { id: targetId }, select: { senderId: true, conversationId: true } });
      if (m) {
        const part = await prisma.conversationParticipant.findUnique({ where: { conversationId_userId: { conversationId: m.conversationId, userId: reporterId } } });
        if (part) ownerId = m.senderId;
      }
    }
    if (!ownerId) return res.status(404).json({ error: 'Contenido no encontrado' });
    if (ownerId === reporterId) return res.status(400).json({ error: 'No puedes denunciarte a ti mismo' });

    // Misma denuncia abierta del mismo usuario y objetivo: no se duplica (idempotente)
    const dup = await prisma.report.findFirst({ where: { reporterId, targetType, targetId, status: 'OPEN' }, select: { id: true } });
    if (dup) return res.status(200).json({ ok: true, duplicate: true });

    await prisma.report.create({ data: { reporterId, targetType, targetId, reason, details: details || null } });
    logger.info('Report created', { reporterId, targetType, targetId, reason });
    res.status(201).json({ ok: true });
  } catch (error) {
    logger.error('Error creating report', { error });
    res.status(500).json({ error: 'Error al enviar la denuncia' });
  }
});

app.post('/api/blocks', authenticateToken, validate(blockSchema), async (req: any, res: Response) => {
  try {
    const blockerId: string = req.user.userId;
    const blockedId: string = req.body.userId;
    if (blockerId === blockedId) return res.status(400).json({ error: 'No puedes bloquearte a ti mismo' });
    const target = await prisma.user.findUnique({ where: { id: blockedId }, select: { id: true } });
    if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });
    await prisma.$transaction([
      prisma.block.upsert({
        where: { blockerId_blockedId: { blockerId, blockedId } },
        create: { blockerId, blockedId },
        update: {}
      }),
      prisma.follow.deleteMany({ where: { OR: [{ followerId: blockerId, followingId: blockedId }, { followerId: blockedId, followingId: blockerId }] } }),
      prisma.followRequest.deleteMany({ where: { OR: [{ requesterId: blockerId, targetId: blockedId }, { requesterId: blockedId, targetId: blockerId }] } }),
    ]);
    res.json({ ok: true });
  } catch (error) {
    logger.error('Error blocking user', { error });
    res.status(500).json({ error: 'Error al bloquear' });
  }
});

app.delete('/api/blocks/:userId', authenticateToken, async (req: any, res: Response) => {
  try {
    await prisma.block.deleteMany({ where: { blockerId: req.user.userId, blockedId: req.params.userId } });
    res.json({ ok: true });
  } catch (error) {
    logger.error('Error unblocking user', { error });
    res.status(500).json({ error: 'Error al desbloquear' });
  }
});

// Solo los que YO he bloqueado (no quién me ha bloqueado a mí)
app.get('/api/blocks', authenticateToken, async (req: any, res: Response) => {
  try {
    const rows = await prisma.block.findMany({
      where: { blockerId: req.user.userId },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: { blocked: { select: { id: true, name: true, avatar: true } } }
    });
    res.json({ users: rows.map(r => r.blocked) });
  } catch (error) {
    logger.error('Error listing blocks', { error });
    res.status(500).json({ error: 'Error al listar bloqueos' });
  }
});

// ============= PORTABILIDAD DE DATOS =============
// Exporta SOLO los datos del propio usuario (sin hash de contraseña ni tokens). Límites por colección para acotar tamaño.
app.get('/api/auth/export', authenticateToken, exportLimiter, async (req: any, res: Response) => {
  try {
    const userId: string = req.user.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password: _p, verificationToken: _vt, resetToken: _rt, resetTokenExpiry: _rte, ...profile } = user as any;
    const LIM = { products: 2000, looks: 2000, comments: 5000, favorites: 5000, likes: 10000, stories: 500, messages: 10000, notifications: 1000, other: 1000 };
    const [products, looks, comments, favorites, likes, stories, submissions, convs, notifications, follows, blocks, tryonPresets, plannerEntries, trips, achievements, badges, streak] = await Promise.all([
      prisma.product.findMany({ where: { userId }, include: { images: true }, orderBy: { createdAt: 'desc' }, take: LIM.products }),
      prisma.look.findMany({ where: { userId }, include: { images: true, products: { select: { id: true } } }, orderBy: { createdAt: 'desc' }, take: LIM.looks }),
      prisma.comment.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: LIM.comments }),
      prisma.favorite.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: LIM.favorites }),
      prisma.like.findMany({ where: { userId }, select: { lookId: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: LIM.likes }),
      prisma.story.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: LIM.stories }),
      prisma.challengeSubmission.findMany({ where: { userId }, include: { challenge: { select: { title: true, tag: true } } }, orderBy: { createdAt: 'desc' }, take: LIM.other }),
      prisma.conversation.findMany({
        where: { participants: { some: { userId } } },
        select: {
          id: true, createdAt: true, itemId: true, itemTitle: true,
          participants: { select: { user: { select: { id: true, name: true } } } },
          messages: { orderBy: { createdAt: 'desc' }, take: LIM.messages, select: { id: true, senderId: true, content: true, imageUrl: true, productId: true, storyId: true, storyThumb: true, createdAt: true } }
        },
        take: LIM.other
      }),
      prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: LIM.notifications }),
      prisma.follow.findMany({ where: { OR: [{ followerId: userId }, { followingId: userId }] }, select: { followerId: true, followingId: true, createdAt: true }, take: LIM.other }),
      prisma.block.findMany({ where: { blockerId: userId }, select: { blockedId: true, createdAt: true } }),
      prisma.tryonPreset.findMany({ where: { userId }, take: LIM.other }),
      prisma.plannerEntry.findMany({ where: { userId }, take: LIM.other }),
      prisma.trip.findMany({ where: { userId }, include: { items: true }, take: LIM.other }),
      prisma.userAchievement.findMany({ where: { userId } }),
      prisma.userBadge.findMany({ where: { userId } }),
      prisma.userStreak.findUnique({ where: { userId } }),
    ]);
    const payload = {
      exportedAt: new Date().toISOString(),
      format: 'estilovivo-export-v1',
      note: 'Contiene solo tus datos. Los mensajes incluyen los de la otra persona en tus conversaciones. Límites por colección aplicados.',
      profile,
      preferences: {
        emailNotifications: user.emailNotifications, emailChat: user.emailChat, emailFollows: user.emailFollows,
        emailWashing: user.emailWashing, emailChallenges: user.emailChallenges, language: user.language, dialect: user.dialect,
        darkModeSetting: user.darkModeSetting, fontSize: user.fontSize, highContrast: user.highContrast, themePreset: user.themePreset,
        isProfilePublic: user.isProfilePublic
      },
      products, looks, comments, favorites, likes, stories,
      challengeSubmissions: submissions,
      conversations: convs.map(c => ({ ...c, participants: c.participants.map(p => p.user) })),
      notifications, follows, blocks, tryonPresets, plannerEntries, trips, achievements, badges, streak,
    };
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="estilovivo-datos-${new Date().toISOString().slice(0, 10)}.json"`);
    res.send(JSON.stringify(payload, null, 2));
  } catch (error) {
    logger.error('Error exporting data', { error });
    res.status(500).json({ error: 'Error al exportar los datos' });
  }
});

app.get('/api/users/top', optionalAuth, async (req: any, res: Response) => {
  try {
    const topBlocked = await getBlockedIds(req.user?.userId);
    const topUsers = await prisma.user.findMany({
      where: topBlocked.length ? { id: { notIn: topBlocked } } : undefined,
      orderBy: { experiencePoints: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        avatar: true,
        experiencePoints: true,
        level: true
      }
    });
    res.json(topUsers);
  } catch (error) {
    logger.error('Error fetching top users', { error });
    res.status(500).json({ error: 'Error fetching top users' });
  }
});

app.get('/api/users/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const viewerId = req.user.userId;
    if (id !== viewerId && (await isBlockedBetween(viewerId, id))) return res.status(404).json({ error: 'User not found' });
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        _count: { select: { followers: true, following: true, products: true, looks: true } },
        products: {
          where: { forSale: true },
          take: 6,
          include: { images: true },
          orderBy: { createdAt: 'desc' },
        },
        looks: {
          where: { isPublic: true },
          take: 6,
          include: { images: true, products: { include: { images: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const {
      password: _, _count, email: _email, verificationToken: _vt, resetToken: _rt, resetTokenExpiry: _rte,
      birthDate: _bd, cycleTracking: _ct, ...safe
    } = user as any;
    const isFollowing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: viewerId, followingId: id } },
    });
    const followRequest = await prisma.followRequest.findUnique({
      where: { requesterId_targetId: { requesterId: viewerId, targetId: id } },
      select: { id: true, status: true }
    });

    // Server-side access control: hide products/looks for private profiles if not following
    const canViewContent = safe.isProfilePublic !== false || !!isFollowing || id === viewerId;
    // Las prendas en venta son públicas (tienda); los looks dependen de la privacidad

    res.json({
      ...safe,
      products: safe.products,
      looks: canViewContent ? safe.looks : [],
      isProfilePublic: safe.isProfilePublic ?? true,
      followersCount: _count.followers,
      followingCount: _count.following,
      garmentCount: _count.products,
      lookCount: _count.looks,
      isFollowing: !!isFollowing,
      hasPendingRequest: followRequest?.status === 'pending',
      pendingRequestId: followRequest?.status === 'pending' ? followRequest.id : null,
    });
  } catch (error) {
    logger.error('Error fetching user profile', { error });
    res.status(500).json({ error: 'Error fetching user profile' });
  }
});

// ============= RETOS SEMANALES =============

const CHALLENGES_ROTATION = [
  { title: 'Color Block', description: 'Combina colores vibrantes en un solo look. Usa al menos 3 colores diferentes que contrasten entre sí de forma armoniosa.', reward: 50, tag: 'Color Block', tips: ['Usa 3 colores como máximo', 'Busca contraste entre prendas', 'Añade un accesorio neutro', 'La luz natural resalta los tonos'] },
  { title: 'Look Monocromático', description: 'Crea un outfit con una sola familia de color. Usa tonos similares y buena iluminación para que se aprecien los matices.', reward: 60, tag: 'Monocromo', tips: ['Usa tonos similares y buena iluminación', 'Varía texturas para evitar monotonía', 'Añade un accesorio en tono metalizado', 'Juega con claroscuros'] },
  { title: 'Street Style', description: 'Combina lo urbano con lo chic. Mezcla prendas casual con elegantes para un look de calle con personalidad.', reward: 50, tag: 'Street', tips: ['Mezcla prendas casual con elegantes', 'Las zapatillas blancas funcionan siempre', 'Añade una chaqueta estructurada', 'Busca fondos urbanos para la foto'] },
  { title: 'Retro Vibes', description: 'Busca inspiración vintage. Prendas de segunda mano, estampados clásicos y complementos que evoquen décadas pasadas.', reward: 55, tag: 'Retro', tips: ['Prendas de segunda mano o herencia', 'Estampados de los 70s u 80s', 'Complementos retro', 'Tono sepia en la foto'] },
  { title: 'Eco Friendly', description: 'Usa prendas sostenibles o recicladas. Materiales naturales, colores tierra y un enfoque consciente de la moda.', reward: 55, tag: 'Eco', tips: ['Materiales naturales o reciclados', 'Colores tierra y verdes', 'Muestra el entorno natural', 'Menos es más'] },
  { title: 'Noche de Gala', description: 'Un look elegante para una ocasión especial. Tejidos nobles, joyería sutil y un acabado impecable.', reward: 60, tag: 'Gala', tips: ['Tejidos nobles como seda o terciopelo', 'Joyas o bisutería elegante', 'Maquillaje acorde', 'Fondo oscuro para destacar'] },
  { title: 'Verano Tropical', description: 'Un look fresco y colorido para el verano. Estampados tropicales, colores vibrantes y tejidos ligeros.', reward: 55, tag: 'Verano', tips: ['Tejidos ligeros como lino o algodón', 'Colores vibrantes y estampados', 'Complementos de playa', 'Luz natural y fondo verde'] },
  { title: 'Otoño Boho', description: 'Looks bohemios con tonos tierra, capas y texturas naturales. Combina prendas holgadas con accesorios artesanales.', reward: 55, tag: 'Boho', tips: ['Capas y texturas naturales', 'Tonos tierra y naranjas', 'Accesorios artesanales', 'Fondo con hojas otoñales'] },
  { title: 'Minimalista Chic', description: 'Menos es más. Un look monocromático con líneas limpias y cortes precisos. La calidad sobre la cantidad.', reward: 60, tag: 'Minimalista', tips: ['Líneas limpias y cortes precisos', 'Paleta de colores neutros', 'Tejidos de calidad', 'Fondo minimalista'] },
  { title: 'Deportivo Elegante', description: 'Athleisure: combina prendas deportivas con toques elegantes para un look versátil y moderno.', reward: 50, tag: 'Sporty', tips: ['Mezcla deportivo con formal', 'Zapatillas blancas o clean', 'Tejidos técnicos', 'Energía y movimiento en la foto'] },
];

async function getChallengeWeekBounds(now: Date): Promise<{ monday: Date; sunday: Date }> {
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday };
}

async function analyzeChallengeImage(filePath: string): Promise<{ uniform: boolean; score: number; conclusive: boolean }> {
  try {
    const sharp = (await import('sharp')).default;
    const { data, info } = await sharp(filePath)
      .resize(32, 32, { fit: 'cover' })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const pixels = data;
    const totalPixels = info.width * info.height;
    let totalR = 0, totalG = 0, totalB = 0;
    for (let i = 0; i < totalPixels; i++) {
      totalR += pixels[i * 3];
      totalG += pixels[i * 3 + 1];
      totalB += pixels[i * 3 + 2];
    }
    const avgR = totalR / totalPixels;
    const avgG = totalG / totalPixels;
    const avgB = totalB / totalPixels;
    let variance = 0;
    for (let i = 0; i < totalPixels; i++) {
      const dr = pixels[i * 3] - avgR;
      const dg = pixels[i * 3 + 1] - avgG;
      const db = pixels[i * 3 + 2] - avgB;
      variance += dr * dr + dg * dg + db * db;
    }
    variance /= totalPixels * 3;
    const maxVariance = 16384;
    const score = Math.max(0, Math.min(100, 100 - (variance / maxVariance) * 100));
    return { uniform: score >= 30, score, conclusive: true };
  } catch {
    // Sin análisis fiable: no se puede afirmar nada (nunca se marca INVALID por un fallo técnico)
    return { uniform: true, score: 50, conclusive: false };
  }
}

type ChallengeStatus = 'VALID' | 'INVALID' | 'PENDING';
// Reglas objetivas por tag. 'monocromo' exige gama uniforme; 'Color Block' (y cualquier otro) NO.
const challengeRequiresUniformColor = (tag: string | null | undefined) => (tag || '').toLowerCase().includes('monocromo');

// Sin IA con visión no hay evidencia fiable de que la foto cumpla el reto: solo se marca INVALID en el caso
// objetivo (monocromo con varianza alta). Nunca se devuelve VALID automáticamente (queda para moderación futura).
function evaluateChallengeSubmission(tag: string | null | undefined, analysis: { uniform: boolean; conclusive: boolean }): { status: ChallengeStatus; reason: string; verified: boolean } {
  if (challengeRequiresUniformColor(tag)) {
    if (!analysis.conclusive) {
      return { status: 'PENDING', reason: 'No se pudo analizar el color de la foto; pendiente de revisión.', verified: true };
    }
    if (!analysis.uniform) {
      return { status: 'INVALID', reason: 'La foto no tiene una gama de color uniforme, que es lo que pide este reto.', verified: false };
    }
    return { status: 'PENDING', reason: 'La gama de color es uniforme, pero el servidor no puede comprobar que la foto sea un look; pendiente de revisión.', verified: true };
  }
  return { status: 'PENDING', reason: 'El servidor no puede validar automáticamente este tipo de reto; pendiente de revisión.', verified: true };
}

app.get('/api/challenges/current', optionalAuth, async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const { monday, sunday } = await getChallengeWeekBounds(now);

    let challenge = await prisma.weeklyChallenge.findFirst({
      where: {
        startDate: { gte: monday, lte: sunday },
        active: true
      },
      orderBy: { startDate: 'desc' }
    });

    if (!challenge) {
      challenge = await prisma.weeklyChallenge.findFirst({
        where: { startDate: { lte: now }, endDate: { gte: now }, active: true },
        orderBy: { startDate: 'desc' }
      });
    }

    if (!challenge) {
      const weekIndex = Math.floor(now.getTime() / 1000 / 60 / 60 / 24 / 7);
      const fallback = CHALLENGES_ROTATION[weekIndex % CHALLENGES_ROTATION.length];
      challenge = await prisma.weeklyChallenge.create({
        data: {
          title: fallback.title,
          description: fallback.description,
          reward: fallback.reward,
          tag: fallback.tag,
          startDate: monday,
          endDate: sunday,
          active: true,
        }
      });
    }

    res.json(challenge);
  } catch (error) {
    logger.error('Error fetching current challenge', { error });
    res.status(500).json({ error: 'Error fetching current challenge' });
  }
});

app.get('/api/challenges/my-submissions', authenticateToken, async (req: any, res: Response) => {
  try {
    const submissions = await prisma.challengeSubmission.findMany({
      where: { userId: req.user.userId },
      include: { challenge: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(submissions);
  } catch (error) {
    logger.error('Error fetching my submissions', { error });
    res.status(500).json({ error: 'Error fetching submissions' });
  }
});

app.get('/api/challenges/history', authenticateToken, async (req: any, res: Response) => {
  try {
    const now = new Date();
    const pastChallenges = await prisma.weeklyChallenge.findMany({
      where: { endDate: { lt: now } },
      include: {
        submissions: {
          where: { userId: req.user.userId },
          select: { id: true, imageUrl: true, description: true, verified: true, awarded: true, status: true, reason: true, createdAt: true }
        }
      },
      orderBy: { endDate: 'desc' },
      take: 50
    });
    const totalXp = pastChallenges.reduce((sum, c) => {
      const s = c.submissions[0];
      return sum + (s?.awarded ? c.reward : 0);
    }, 0);
    res.json({ challenges: pastChallenges, totalXp });
  } catch (error) {
    logger.error('Error fetching challenge history', { error });
    res.status(500).json({ error: 'Error fetching challenge history' });
  }
});

app.post('/api/challenges/submit', authenticateToken, upload.fields([{ name: 'image', maxCount: 1 }]), async (req: any, res: Response) => {
  try {
    const { challengeId, description } = req.body;
    if (!challengeId) return res.status(400).json({ error: 'Falta el ID del reto' });

    const challenge = await prisma.weeklyChallenge.findUnique({ where: { id: challengeId } });
    const challengeError = !challenge
      ? { status: 404, error: 'Reto no encontrado' }
      : (!challenge.active || challenge.endDate < new Date())
        ? { status: 400, error: 'Este reto ya no está activo' }
        : null;
    if (challengeError || !challenge) {
      const fs = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      safeUnlink(fs?.['image']?.[0]?.path);
      return res.status(challengeError?.status || 404).json({ error: challengeError?.error || 'Reto no encontrado' });
    }

    const existing = await prisma.challengeSubmission.findUnique({
      where: { userId_challengeId: { userId: req.user.userId, challengeId } }
    });
    if (existing) {
      const fs = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      safeUnlink(fs?.['image']?.[0]?.path);
      return res.status(400).json({ error: 'Ya participaste en este reto' });
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const imageFile = files?.['image']?.[0];

    if (!imageFile) {
      return res.status(400).json({ error: 'Debes subir una imagen para participar en el reto' });
    }

    const desc = (typeof description === 'string' ? description : '').trim();
    const descError = !desc
      ? 'Debes añadir una descripción de al menos 10 caracteres'
      : desc.length < 10
        ? 'La descripción debe tener al menos 10 caracteres'
        : desc.length > 500
          ? 'La descripción no puede superar los 500 caracteres'
          : null;
    if (descError) {
      safeUnlink(imageFile.path);
      return res.status(400).json({ error: descError });
    }

    const analysis = await analyzeChallengeImage(imageFile.path);
    const storedName = await reencodeSingleImage(imageFile);
    if (!storedName) return res.status(400).json({ error: 'No se pudo procesar la imagen' });

    const { status, reason, verified } = evaluateChallengeSubmission(challenge.tag, analysis);

    const submission = await prisma.challengeSubmission.create({
      data: {
        userId: req.user.userId,
        challengeId,
        imageUrl: `/api/uploads/${storedName}`,
        description: desc,
        verified,
        status,
        reason,
        awarded: true, // XP: decisión pendiente (ver docs/API_CHALLENGE_VALIDATION.md); sin cambios por ahora
      }
    });

    const xpResult = await awardXp(prisma, req.user.userId, challenge.reward);

    checkAndUnlockAchievements(prisma, req.user.userId, io).catch(e =>
      logger.warn('Failed to check achievements after challenge submit', { e })
    );

    res.status(201).json({
      ...submission,
      experiencePoints: xpResult.experiencePoints,
      level: xpResult.level,
      leveledUp: xpResult.leveledUp,
      validationMessage: verified ? null : 'La imagen no parece tener una gama de color uniforme. Aún así, has ganado tus puntos.'
    });
  } catch (error) {
    logger.error('Error submitting challenge', { error });
    res.status(500).json({ error: 'Error al participar en el reto' });
  }
});

app.delete('/api/challenges/submissions/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const submission = await prisma.challengeSubmission.findUnique({
      where: { id: req.params.id },
      include: { challenge: true }
    });
    if (!submission) return res.status(404).json({ error: 'Participación no encontrada' });
    if (submission.userId !== req.user.userId) return res.status(403).json({ error: 'No autorizado' });

    if (submission.awarded) {
      await removeXp(prisma, req.user.userId, submission.challenge.reward);
    }

    await prisma.challengeSubmission.delete({ where: { id: req.params.id } });
    if (isOwnUploadUrl(submission.imageUrl)) {
      safeUnlink(path.join(UPLOADS_DIR, path.basename(submission.imageUrl)));
    }
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting challenge submission', { error });
    res.status(500).json({ error: 'Error al eliminar la participación' });
  }
});

app.post('/api/challenges/force-rotate', authenticateToken, async (req: any, res: Response) => {
  if (!isAdmin(req.user.userId)) return res.status(403).json({ error: 'Admin only' });
  try {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfToday);
    endOfWeek.setDate(startOfToday.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    await prisma.weeklyChallenge.updateMany({
      where: { active: true },
      data: { active: false },
    });

    const challengeCount = await prisma.weeklyChallenge.count();
    const rotationIndex = challengeCount % CHALLENGES_ROTATION.length;
    const next = CHALLENGES_ROTATION[rotationIndex];

    const challenge = await prisma.weeklyChallenge.create({
      data: {
        title: next.title,
        description: next.description,
        reward: next.reward,
        tag: next.tag,
        startDate: startOfToday,
        endDate: endOfWeek,
        active: true,
      }
    });

    // Only delete submissions from previously active challenges, preserve historical data
    await prisma.challengeSubmission.deleteMany({
      where: { challenge: { active: true, id: { not: challenge.id } } },
    });

    res.json({ success: true, challenge });
  } catch (error) {
    logger.error('Error force-rotating challenge', { error });
    res.status(500).json({ error: 'Error al cambiar el reto' });
  }
});

// ============= GAMIFICACIÓN =============

app.get('/api/gamification/progress', authenticateToken, async (req: any, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: {
        achievements: { orderBy: { unlockedAt: 'desc' } },
        badges: { orderBy: { unlockedAt: 'desc' } },
        streak: true,
        _count: { select: { challengeSubmissions: true } },
      },
    });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    const xp = user.experiencePoints || 0;
    const level = user.level || 1;
    const progress = xpProgress(xp, level);
    res.json({
      experiencePoints: xp,
      level,
      xpCurrent: progress.current,
      xpNeeded: progress.needed,
      xpPercentage: Math.round(progress.percentage),
      streak: user.streak ? { loginCount: user.streak.loginCount, lastDate: user.streak.lastDate } : { loginCount: 0, lastDate: null },
      achievements: user.achievements || [],
      badges: user.badges || [],
      challengeCount: user._count.challengeSubmissions || 0,
    });
  } catch (error) {
    logger.error('Error fetching gamification progress', { error });
    res.status(500).json({ error: 'Error al cargar progreso' });
  }
});

app.get('/api/gamification/achievements', authenticateToken, async (req: any, res: Response) => {
  try {
    const userAchs = await prisma.userAchievement.findMany({
      where: { userId: req.user.userId },
      select: { achievementKey: true, unlockedAt: true },
    });
    const unlockedMap = new Map(userAchs.map(a => [a.achievementKey, a.unlockedAt]));
    const all = ACHIEVEMENTS.map(a => ({
      ...a,
      unlocked: unlockedMap.has(a.key),
      unlockedAt: unlockedMap.get(a.key) || null,
    }));
    res.json(all);
  } catch (error) {
    logger.error('Error fetching achievements', { error });
    res.status(500).json({ error: 'Error al cargar logros' });
  }
});

app.get('/api/gamification/badges', authenticateToken, async (req: any, res: Response) => {
  try {
    const userBgs = await prisma.userBadge.findMany({
      where: { userId: req.user.userId },
      select: { badgeKey: true, unlockedAt: true },
    });
    const unlockedMap = new Map(userBgs.map(b => [b.badgeKey, b.unlockedAt]));
    const all = BADGES.map(b => ({
      ...b,
      unlocked: unlockedMap.has(b.key),
      unlockedAt: unlockedMap.get(b.key) || null,
    }));
    res.json(all);
  } catch (error) {
    logger.error('Error fetching badges', { error });
    res.status(500).json({ error: 'Error al cargar insignias' });
  }
});

app.post('/api/gamification/check-achievements', authenticateToken, async (req: any, res: Response) => {
  try {
    // checkAndUnlockAchievements ya otorga el XP y emite los eventos de socket
    const newlyUnlocked = await checkAndUnlockAchievements(prisma, req.user.userId, io);
    res.json({ newlyUnlocked });
  } catch (error) {
    logger.error('Error checking achievements', { error });
    res.status(500).json({ error: 'Error al verificar logros' });
  }
});

app.post('/api/gamification/login', authenticateToken, async (req: any, res: Response) => {
  try {
    const streakResult = await updateStreak(prisma, req.user.userId);
    let xpAwarded = 0;
    if (streakResult.updated) {
      await awardXp(prisma, req.user.userId, XP_VALUES.dailyLogin);
      xpAwarded = XP_VALUES.dailyLogin;
    }
    const badges = await checkAndUnlockBadges(prisma, req.user.userId, streakResult.count);
    res.json({ streakCount: streakResult.count, xpAwarded, newBadges: badges });
  } catch (error) {
    logger.error('Error processing login', { error });
    res.status(500).json({ error: 'Error al procesar inicio de sesión' });
  }
});

// ============= TRENDS =============
app.get('/api/trends', async (req: Request, res: Response) => {
  try {
    const trends = await fashionTrendsService.getTrends();
    res.json(trends);
  } catch (error) {
    logger.error('Error in trends route:', error);
    res.status(500).json({ error: 'Error fetching trends' });
  }
});


// ============= PLANNER =============

app.get('/api/planner/:userId', authenticateToken, async (req: any, res: Response) => {
  try {
    if (req.params.userId !== 'me' && req.params.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const userId = req.user.userId;
    const entries = await prisma.plannerEntry.findMany({
      where: { userId },
      include: { look: { include: { images: true, products: { include: { images: true } } } } }
    });
    res.json(entries);
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error fetching planner' });
  }
});

app.post('/api/planner', authenticateToken, validate(plannerSchema), async (req: any, res: Response) => {
  try {
    const { date, lookId, eventNote } = req.body;
    // El planner siempre es del usuario autenticado (antes se aceptaba userId del cliente)
    const targetUserId = req.user.userId;
    if (lookId) {
      const ownLook = await prisma.look.findFirst({ where: { id: lookId, userId: targetUserId }, select: { id: true } });
      if (!ownLook) return res.status(400).json({ error: 'Look no válido' });
    }

    // Get previous entry to handle look change
    const previousEntry = await prisma.plannerEntry.findUnique({
      where: { userId_date: { userId: targetUserId, date } },
      include: { look: { include: { products: true } } }
    });

    const entry = await prisma.plannerEntry.upsert({
      where: { userId_date: { userId: targetUserId, date } },
      update: { lookId: lookId || null, eventNote },
      create: { date, lookId: lookId || null, eventNote, userId: targetUserId },
      include: { look: { include: { images: true, products: { include: { images: true } } } } }
    });

    // Decrement usage count for previous look's garments (if look changed)
    const lookChanged = (previousEntry?.lookId || null) !== (lookId || null);
    if (previousEntry?.lookId && lookChanged && previousEntry.look) {
      await prisma.product.updateMany({
        where: { id: { in: previousEntry.look.products.map(p => p.id) }, usageCount: { gt: 0 } },
        data: { usageCount: { decrement: 1 } }
      });
    }

    // Increment usage count only when the look actually changes (evita inflar el contador al editar la nota)
    if (lookId && lookChanged) {
      const look = await prisma.look.findUnique({ where: { id: lookId }, include: { products: true } });
      if (look) {
        await prisma.product.updateMany({
          where: { id: { in: look.products.map(p => p.id) } },
          data: { usageCount: { increment: 1 }, lastWorn: new Date() }
        });
      }
    }

    res.json(entry);
    // XP sólo al planificar un día nuevo (evita farmear XP re-guardando)
    if (!previousEntry) awardPoints(prisma, targetUserId, 'planner').catch(e => logger.warn('awardPoints failed', { e }));
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error updating planner' });
  }
});

app.delete('/api/planner/:date', authenticateToken, async (req: any, res: Response) => {
  try {
    const existing = await prisma.plannerEntry.findUnique({
      where: { userId_date: { userId: req.user.userId, date: req.params.date } },
      include: { look: { include: { products: true } } }
    });
    if (!existing) return res.status(404).json({ error: 'Entrada no encontrada' });
    if (existing.look?.products?.length) {
      await prisma.product.updateMany({
        where: { id: { in: existing.look.products.map(p => p.id) }, usageCount: { gt: 0 } },
        data: { usageCount: { decrement: 1 } }
      });
    }
    await prisma.plannerEntry.delete({ where: { userId_date: { userId: req.user.userId, date: req.params.date } } });
    res.json({ success: true });
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error deleting planner entry' });
  }
});

// ============= TRIPS =============

app.get('/api/trips/:userId', authenticateToken, async (req: any, res: Response) => {
  try {
    if (req.params.userId !== 'me' && req.params.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const userId = req.user.userId;
    const trips = await prisma.trip.findMany({
      where: { userId },
      include: { items: true, garments: { include: { product: { include: { images: true } } } } },
      orderBy: { dateStart: 'asc' }
    });
    const mapped = trips.map(trip => ({
      ...trip,
      garments: trip.garments.map(g => g.product)
    }));
    res.json(mapped);
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error fetching trips' });
  }
});

app.post('/api/trips', authenticateToken, validate(tripSchema), async (req: any, res: Response) => {
  try {
    const { destination, dateStart, dateEnd, items, garmentIds } = req.body;
    const isoRe = /^\d{4}-\d{2}-\d{2}$/;
    if (isoRe.test(dateStart) && isoRe.test(dateEnd) && dateEnd < dateStart) return res.status(400).json({ error: 'La fecha de vuelta debe ser posterior a la de ida' });
    const ownGarments = await ownProductIds(garmentIds, req.user.userId);
    const garmentsData = ownGarments.length > 0
      ? { garments: { create: ownGarments.map((id: string) => ({ productId: id })) } }
      : {};
    const trip = await prisma.trip.create({
      data: {
        destination, dateStart, dateEnd, userId: req.user.userId,
        items: { create: items ? items.map((i: any) => ({ label: i.label, checked: i.checked || false, isEssential: i.isEssential || false })) : [] },
        ...garmentsData
      },
      include: { items: true, garments: { include: { product: { include: { images: true } } } } }
    });
    res.status(201).json({
      ...trip,
      garments: trip.garments.map(g => g.product)
    });
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error creating trip' });
  }
});

app.put('/api/trips/:id', authenticateToken, validate(tripSchema), async (req: any, res: Response) => {
  try {
    const existing = await prisma.trip.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.user.userId) return res.status(403).json({ error: 'Not authorized' });
    const { destination, dateStart, dateEnd, garmentIds } = req.body;
    const updateData: any = {
      ...(destination && { destination }),
      ...(dateStart && { dateStart }),
      ...(dateEnd && { dateEnd })
    };
    const newStart = dateStart || existing.dateStart;
    const newEnd = dateEnd || existing.dateEnd;
    const isoRe = /^\d{4}-\d{2}-\d{2}$/;
    if (isoRe.test(newStart) && isoRe.test(newEnd) && newEnd < newStart) return res.status(400).json({ error: 'La fecha de vuelta debe ser posterior a la de ida' });
    if (Array.isArray(garmentIds)) {
      const ownGarments = await ownProductIds(garmentIds, req.user.userId);
      updateData.garments = {
        deleteMany: {},
        create: ownGarments.map((id: string) => ({ productId: id }))
      };
    }
    const trip = await prisma.trip.update({
      where: { id: req.params.id },
      data: updateData,
      include: { items: true, garments: { include: { product: { include: { images: true } } } } }
    });
    res.json({
      ...trip,
      garments: trip.garments.map(g => g.product)
    });
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error updating trip' });
  }
});

app.delete('/api/trips/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const existing = await prisma.trip.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.user.userId) return res.status(403).json({ error: 'Not authorized' });
    await prisma.trip.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error deleting trip' });
  }
});

app.put('/api/trips/:tripId/items/:itemId', authenticateToken, async (req: any, res: Response) => {
  try {
    const trip = await prisma.trip.findUnique({ where: { id: req.params.tripId } });
    if (!trip || trip.userId !== req.user.userId) return res.status(403).json({ error: 'Not authorized' });
    const { checked, label, isEssential } = req.body;
    const existingItem = await prisma.tripItem.findFirst({ where: { id: req.params.itemId, tripId: trip.id } });
    if (!existingItem) return res.status(404).json({ error: 'Item not found' });
    const item = await prisma.tripItem.update({
      where: { id: existingItem.id },
      data: {
        ...(typeof checked === 'boolean' && { checked }),
        ...(typeof label === 'string' && label.trim() && { label: label.trim().slice(0, 120) }),
        ...(typeof isEssential === 'boolean' && { isEssential }),
      }
    });
    res.json(item);
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error updating trip item' });
  }
});

app.post('/api/trips/:tripId/items', authenticateToken, async (req: any, res: Response) => {
  try {
    const trip = await prisma.trip.findUnique({ where: { id: req.params.tripId } });
    if (!trip || trip.userId !== req.user.userId) return res.status(403).json({ error: 'Not authorized' });
    const label = typeof req.body.label === 'string' ? req.body.label.trim().slice(0, 120) : '';
    if (!label) return res.status(400).json({ error: 'Label required' });
    const item = await prisma.tripItem.create({
      data: { label, isEssential: req.body.isEssential === true, tripId: req.params.tripId }
    });
    res.json(item);
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error adding trip item' });
  }
});

app.delete('/api/trips/:tripId/items/:itemId', authenticateToken, async (req: any, res: Response) => {
  try {
    const trip = await prisma.trip.findUnique({ where: { id: req.params.tripId } });
    if (!trip || trip.userId !== req.user.userId) return res.status(403).json({ error: 'Not authorized' });
    const deleted = await prisma.tripItem.deleteMany({ where: { id: req.params.itemId, tripId: trip.id } });
    if (deleted.count === 0) return res.status(404).json({ error: 'Item not found' });
    res.json({ success: true });
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error deleting trip item' });
  }
});

// ============= NOTIFICATIONS =============

app.get('/api/notifications', authenticateToken, async (req: any, res: Response) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json(notifications);
  } catch (error) {
    logger.error('Error fetching notifications', { error });
    res.status(500).json({ error: 'Error fetching notifications' });
  }
});

app.put('/api/notifications/read-all', authenticateToken, async (req: any, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.userId, isRead: false },
      data: { isRead: true }
    });
    res.json({ success: true });
  } catch (error) {
    logger.error('Error marking all notifications read', { error });
    res.status(500).json({ error: 'Error updating notifications' });
  }
});

app.put('/api/notifications/:id/read', authenticateToken, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== req.user.userId) return res.status(403).json({ error: 'Not authorized' });

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true }
    });
    res.json(updated);
  } catch (error) {
    logger.error('Error marking notification read', { error });
    res.status(500).json({ error: 'Error updating notification' });
  }
});

// ============= CHAT =============

app.get('/api/chat/conversations', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.user.userId;
    const convBlocked = await getBlockedIds(userId);
    const conversations = await prisma.conversation.findMany({
      where: {
        participants: { some: { userId } },
        ...(convBlocked.length ? { NOT: { participants: { some: { userId: { in: convBlocked } } } } } : {})
      },
      include: {
        participants: { include: { user: { select: { id: true, name: true, avatar: true } } } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { sender: { select: { id: true, name: true, avatar: true } } }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
    // Compute otherUser server-side so client always has the name
    const result = conversations.map(c => {
      const other = c.participants.find(p => p.userId !== userId);
      const otherUser = other?.user ? { id: other.user.id, name: other.user.name, avatar: other.user.avatar } : null;
      return { ...c, otherUser };
    });
    res.json(result);
  } catch (error) {
    logger.error('Error fetching conversations', { error });
    res.status(500).json({ error: 'Error fetching conversations' });
  }
});

app.post('/api/chat/conversations', authenticateToken, validate(conversationSchema), async (req: any, res: Response) => {
  try {
    // Accept both targetUserId (frontend) and otherUserId (legacy)
    const { targetUserId, otherUserId, itemId, itemTitle, itemImage, initialMessage } = req.body;
    const recipientId = targetUserId || otherUserId;
    if (!recipientId) return res.status(400).json({ error: 'targetUserId required' });
    if (recipientId === req.user.userId) return res.status(400).json({ error: 'Cannot chat with yourself' });
    const recipient = await prisma.user.findUnique({ where: { id: recipientId }, select: { id: true } });
    if (!recipient) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (await isBlockedBetween(req.user.userId, recipientId)) return res.status(403).json({ error: 'No puedes enviar mensajes a este usuario' });
    const safeItemImage = itemImage && (isOwnUploadUrl(itemImage) || /^https:\/\//.test(itemImage)) ? itemImage : null;

    let whereClause: any = {
      AND: [
        { participants: { some: { userId: req.user.userId } } },
        { participants: { some: { userId: recipientId } } }
      ]
    };
    if (itemId) whereClause.AND.push({ itemId });

    const existing = await prisma.conversation.findFirst({
      where: whereClause,
      include: { participants: { include: { user: { select: { id: true, name: true, avatar: true } } } } }
    });

    if (existing) return res.json({ id: existing.id, ...existing });

    const conversation = await prisma.conversation.create({
      data: {
        itemId: itemId || null,
        itemTitle: itemTitle ? String(itemTitle).slice(0, 200) : null,
        itemImage: safeItemImage,
        itemOwnerId: recipientId,
        participants: { create: [{ userId: req.user.userId }, { userId: recipientId }] },
        ...(initialMessage ? {
          messages: { create: [{ senderId: req.user.userId, content: initialMessage }] }
        } : {})
      },
      include: { participants: { include: { user: { select: { id: true, name: true, avatar: true } } } } }
    });

    // Emit initial message via socket so recipient sees it in real-time
    if (initialMessage) {
      const senderUser = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { id: true, name: true, avatar: true } });
      const msgWithSender = {
        id: `init_${conversation.id}_${Date.now()}`,
        conversationId: conversation.id,
        senderId: req.user.userId,
        content: initialMessage,
        createdAt: conversation.createdAt,
        sender: senderUser,
      };
      io.to(`user_${recipientId}`).emit('new_message', msgWithSender);
    }

    res.status(201).json({ id: conversation.id, ...conversation });
  } catch (error) {
    logger.error('Error creating conversation', { error });
    res.status(500).json({ error: 'Error creating conversation' });
  }
});

app.get('/api/chat/conversations/:id/messages', authenticateToken, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const participation = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: id, userId: req.user.userId } }
    });
    if (!participation) return res.status(403).json({ error: 'Not authorized' });
    if (await conversationHasBlocked(id, req.user.userId)) return res.status(404).json({ error: 'Conversación no encontrada' });

    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      include: { sender: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    messages.reverse();
    res.json(messages);
  } catch (error) {
    logger.error('Error fetching messages', { error });
    res.status(500).json({ error: 'Error fetching messages' });
  }
});

app.post('/api/chat/upload', authenticateToken, upload.single('image'), async (req: any, res: Response) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No image provided' });
    const storedName = await reencodeSingleImage(file);
    if (!storedName) return res.status(400).json({ error: 'No se pudo procesar la imagen' });
    res.json({ imageUrl: `/api/uploads/${storedName}` });
  } catch (error) {
    logger.error('Error uploading chat image', { error });
    res.status(500).json({ error: 'Error uploading image' });
  }
});

app.post('/api/chat/conversations/:id/messages', authenticateToken, validate(messageSchema), async (req: any, res: Response) => {
  try {
    const conversationId = req.params.id;
    const { content, imageUrl, productId } = req.body;
    if (!content && !imageUrl) return res.status(400).json({ error: 'content or imageUrl required' });
    if (imageUrl && !isOwnUploadUrl(imageUrl)) return res.status(400).json({ error: 'Invalid imageUrl' });

    const participation = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId: req.user.userId } }
    });
    if (!participation) return res.status(403).json({ error: 'Not authorized' });
    if (await conversationHasBlocked(conversationId, req.user.userId)) return res.status(403).json({ error: 'No puedes enviar mensajes a este usuario' });

    const message = await prisma.message.create({
      data: { conversationId, content: content || '', imageUrl: imageUrl || null, productId: productId || null, senderId: req.user.userId },
      include: { sender: { select: { id: true, name: true, avatar: true } } }
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() }
    });

    // Emit to other participants' user rooms only (sender excluded — they use optimistic UI)
    const otherParticipants = await prisma.conversationParticipant.findMany({
      where: { conversationId, userId: { not: req.user.userId } }
    });
    for (const p of otherParticipants) {
      io.to(`user_${p.userId}`).emit('new_message', message);
    }

    // Notify the other participant
    if (otherParticipants.length > 0) {
      const op = otherParticipants[0];
      const notification = await prisma.notification.create({
        data: {
          type: 'CHAT',
          content: `${message.sender.name} te ha enviado un mensaje`,
          userId: op.userId,
          relatedId: conversationId,
        }
      });
      io.to(`user_${op.userId}`).emit('notification', notification);

      const otherUser = await prisma.user.findUnique({ where: { id: op.userId } });
      if (transporter && otherUser?.email && otherUser.emailNotifications && otherUser.emailChat) {
        try {
          const emailContent = `
            <p class="greeting">Nuevo mensaje de ${escapeHtml(message.sender.name)} 💬</p>
            <p class="message">"${escapeHtml(message.content.slice(0, 300))}"</p>
            <div style="text-align: center;">
              <a href="${getEmailFriendlyUrl('/social?tab=chat')}" class="button">Ver Conversación</a>
            </div>
          `;
          await sendMailWithRetry({
            to: otherUser.email,
            subject: `💬 Nuevo mensaje de ${String(message.sender.name).replace(/[\r\n]/g, ' ')} - Estilo Vivo`,
            html: getEmailTemplate(emailContent, 'Nuevo Mensaje')
          });
        } catch (mailErr) {
          logger.warn('Could not send chat email notification', { error: mailErr, userId: op.userId });
        }
      }
    }

    res.status(201).json(message);
  } catch (error) {
    logger.error('Error sending message', { error });
    res.status(500).json({ error: 'Error sending message' });
  }
});

app.post('/api/chat/messages', authenticateToken, validate(messageSchema), async (req: any, res: Response) => {
  try {
    const { conversationId, content, imageUrl, productId } = req.body;
    if (!content && !imageUrl) return res.status(400).json({ error: 'content or imageUrl required' });
    if (imageUrl && !isOwnUploadUrl(imageUrl)) return res.status(400).json({ error: 'Invalid imageUrl' });
    const participant = await prisma.conversationParticipant.findFirst({
      where: { conversationId, userId: req.user.userId }
    });
    if (!participant) return res.status(403).json({ error: 'Not a participant in this conversation' });
    if (await conversationHasBlocked(conversationId, req.user.userId)) return res.status(403).json({ error: 'No puedes enviar mensajes a este usuario' });
    const message = await prisma.message.create({
      data: { conversationId, content: content || '', senderId: req.user.userId, imageUrl: imageUrl || null, productId: productId || null },
      include: { sender: { select: { id: true, name: true, avatar: true } } }
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() }
    });

    // Emit to other participants' user rooms only
    const otherParticipants2 = await prisma.conversationParticipant.findMany({
      where: { conversationId, userId: { not: req.user.userId } }
    });
    for (const p of otherParticipants2) {
      io.to(`user_${p.userId}`).emit('new_message', message);
    }

    // Notifications: use server-determined participants, NOT client-provided otherUserId
    for (const p of otherParticipants2) {
      const notification = await prisma.notification.create({
        data: {
          type: 'CHAT',
          content: `${message.sender.name} te ha enviado un mensaje`,
          userId: p.userId,
          relatedId: conversationId,
        }
      });
      io.to(`user_${p.userId}`).emit('notification', notification);

      const otherUser = await prisma.user.findUnique({ where: { id: p.userId } });
      if (transporter && otherUser?.email && otherUser.emailNotifications && otherUser.emailChat) {
        try {
          const emailContent = `
            <p class="greeting">Nuevo mensaje de ${escapeHtml(message.sender.name)} 💬</p>
            <p class="message">"${escapeHtml(message.content.slice(0, 300))}"</p>
            <div style="text-align: center;">
              <a href="${getEmailFriendlyUrl('/social?tab=chat')}" class="button">Ver Conversación</a>
            </div>
          `;
          await sendMailWithRetry({
            to: otherUser.email,
            subject: `💬 Nuevo mensaje de ${String(message.sender.name).replace(/[\r\n]/g, ' ')} - Estilo Vivo`,
            html: getEmailTemplate(emailContent, 'Nuevo Mensaje')
          });
        } catch (mailErr) {
          logger.warn('Could not send chat email notification', { error: mailErr, userId: p.userId });
        }
      }
    }
    res.status(201).json(message);
  } catch (error) {
    logger.error('Error sending message', { error });
    res.status(500).json({ error: 'Error sending message' });
  }
});

// ============= STATS =============

app.get('/api/stats', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.user.userId;
    const [garmentCount, lookCount, salesCount, tripsCount, totalUsage] = await Promise.all([
      prisma.product.count({ where: { userId } }),
      prisma.look.count({ where: { userId } }),
      prisma.product.count({ where: { userId, forSale: true } }),
      prisma.trip.count({ where: { userId } }),
      prisma.product.aggregate({ where: { userId }, _sum: { usageCount: true } }),
    ]);

    const mostWorn = await prisma.product.findFirst({
      where: { userId }, orderBy: { usageCount: 'desc' }, include: { images: true }
    });
    const leastWorn = await prisma.product.findMany({
      where: { userId, usageCount: { lt: 2 } }, include: { images: true }, take: 5
    });

    res.json({
      garmentCount, lookCount, salesCount, tripsCount,
      totalUsage: totalUsage._sum.usageCount || 0,
      mostWorn, leastWornCount: leastWorn.length, leastWorn
    });
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error fetching stats' });
  }
});

// ============= STORIES =============

const STORIES_DIR = path.join(UPLOADS_DIR, 'stories');
if (!existsSync(STORIES_DIR)) {
  mkdirSync(STORIES_DIR, { recursive: true });
}

const storyStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, STORIES_DIR),
  filename: (req, file, cb) => {
    cb(null, `story-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${MIME_EXT[file.mimetype] || '.bin'}`);
  },
});
const storyUpload = multer({ storage: storyStorage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: imageFileFilter });

app.get('/api/stories', optionalAuth, async (req: any, res: Response) => {
  try {
    const viewerId: string | undefined = req.user?.userId;
    const followingIds = viewerId
      ? (await prisma.follow.findMany({ where: { followerId: viewerId }, select: { followingId: true } })).map(f => f.followingId)
      : [];
    const storyBlocked = await getBlockedIds(viewerId);
    const stories = await prisma.story.findMany({
      where: {
        expiresAt: { gt: new Date() },
        ...notBlocked(storyBlocked),
        OR: [
          { user: { isProfilePublic: true } },
          ...(viewerId ? [{ userId: viewerId }, { userId: { in: followingIds } }] : []),
        ],
      },
      include: { user: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(stories);
  } catch (error) {
    logger.error('Error fetching stories', { error });
    res.status(500).json({ error: 'Error fetching stories' });
  }
});

app.post('/api/stories', authenticateToken, storyUpload.single('image'), async (req: any, res: Response) => {
  try {
    const { type, text } = req.body;
    const file = req.file;
    let imageUrl: string | null = null;

    if (type !== 'image' && type !== 'text') {
      safeUnlink(file?.path);
      return res.status(400).json({ error: 'Tipo de historia inválido' });
    }
    const cleanText = typeof text === 'string' ? text.trim().slice(0, 500) : '';

    if (type === 'image' && file) {
      const storedName = await reencodeSingleImage(file, STORIES_DIR);
      if (!storedName) return res.status(400).json({ error: 'No se pudo procesar la imagen' });
      imageUrl = `/api/uploads/stories/${storedName}`;
    } else if (type === 'image' && isOwnUploadUrl(req.body.imageUrl)) {
      imageUrl = req.body.imageUrl;
    } else if (type === 'image') {
      return res.status(400).json({ error: 'Falta la imagen de la historia' });
    } else if (!cleanText) {
      safeUnlink(file?.path);
      return res.status(400).json({ error: 'La historia no puede estar vacía' });
    } else {
      safeUnlink(file?.path);
    }

    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

    const story = await prisma.story.create({
      data: {
        userId: req.user.userId,
        type,
        text: cleanText || null,
        imageUrl,
        expiresAt,
      },
      include: { user: { select: { id: true, name: true, avatar: true } } },
    });

    res.status(201).json(story);
    awardXp(prisma, req.user.userId, XP_VALUES.publishStory).catch(() => {});
  } catch (error) {
    logger.error('Error creating story', { error });
    res.status(500).json({ error: 'Error creating story' });
  }
});

app.post('/api/stories/:id/view', authenticateToken, async (req: any, res: Response) => {
  try {
    const existingStory = await prisma.story.findUnique({ where: { id: req.params.id }, select: { userId: true } });
    if (!existingStory) return res.status(404).json({ error: 'Historia no encontrada' });
    if (existingStory.userId !== req.user.userId && (await isBlockedBetween(req.user.userId, existingStory.userId))) return res.status(404).json({ error: 'Historia no encontrada' });
    // Las visitas propias no cuentan
    if (existingStory.userId === req.user.userId) return res.json({ success: true });
    const story = await prisma.story.update({
      where: { id: req.params.id },
      data: { views: { increment: 1 } },
      select: { id: true, views: true },
    });
    res.json(story);
  } catch (error) {
    logger.error('Error incrementing story views', { error });
    res.status(500).json({ error: 'Error incrementing story views' });
  }
});

app.post('/api/stories/:id/reaction', authenticateToken, async (req: any, res: Response) => {
  try {
    const { emoji } = req.body;
    if (typeof emoji !== 'string' || !emoji.trim() || [...emoji].length > 4) return res.status(400).json({ error: 'Emoji requerido' });

    const story = await prisma.story.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { id: true, name: true, avatar: true } } },
    });
    if (!story) return res.status(404).json({ error: 'Historia no encontrada' });
    if (story.userId !== req.user.userId && (await isBlockedBetween(req.user.userId, story.userId))) return res.status(404).json({ error: 'Historia no encontrada' });

    // Cannot react to own story
    if (story.userId === req.user.userId) {
      return res.status(200).json({ message: null, conversationId: null });
    }

    const reactor = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, name: true, avatar: true },
    });
    if (!reactor) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Find or create conversation
    let conversation = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: req.user.userId } } },
          { participants: { some: { userId: story.userId } } },
        ],
        itemId: null,
      },
      include: { participants: { include: { user: { select: { id: true, name: true, avatar: true } } } } },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          participants: { create: [{ userId: req.user.userId }, { userId: story.userId }] },
        },
        include: { participants: { include: { user: { select: { id: true, name: true, avatar: true } } } } },
      });
    }

    // Send message with reaction including reactor name
    const storyRef = story.imageUrl ? 'una foto' : (story.text ? `"${story.text.slice(0, 60)}"` : 'tu historia');
    const messageContent = `${reactor.name} reaccionó ${emoji} a tu historia: ${storyRef}`;

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: req.user.userId,
        content: messageContent,
        storyId: story.id,
        storyThumb: story.imageUrl ?? null,
      },
      include: { sender: { select: { id: true, name: true, avatar: true } } },
    });

    try { await prisma.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } }); } catch (e) { logger.error('Error updating conversation updatedAt', { e }); }

    try { io.to(`user_${story.userId}`).emit('new_message', message); } catch (e) { logger.error('Error emitting new_message', { e }); }

    // Notify story author
    if (story.userId !== req.user.userId) {
      try {
        const notification = await prisma.notification.create({
          data: {
            type: 'STORY_REACTION',
            content: `${reactor.name} reaccionó ${emoji} a tu historia`,
            userId: story.userId,
            relatedId: conversation.id,
          }
        });
        try { io.to(`user_${story.userId}`).emit('notification', notification); } catch (e) { logger.error('Error emitting notification', { e }); }
      } catch (e) { logger.error('Error creating notification', { e }); }
    }

    awardXp(prisma, req.user.userId, XP_VALUES.storyReaction).catch((e) => { logger.error('Error awarding XP for story reaction', { e }); });
    // (el XP por reacción es de 1 punto; el rate limit general evita abusos)

    res.status(201).json({ message, conversationId: conversation.id });
  } catch (error: any) {
    logger.error('Error reacting to story', { error: error?.message || error, stack: error?.stack });
    res.status(500).json({ error: 'Error al reaccionar a la historia' });
  }
});

app.delete('/api/stories/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const story = await prisma.story.findUnique({ where: { id } });
    if (!story) return res.status(404).json({ error: 'Historia no encontrada' });
    if (story.userId !== req.user.userId) return res.status(403).json({ error: 'No autorizado' });
    await prisma.story.delete({ where: { id } });
    if (story.imageUrl?.startsWith('/api/uploads/stories/')) {
      safeUnlink(path.join(STORIES_DIR, path.basename(story.imageUrl)));
    }
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting story', { error });
    res.status(500).json({ error: 'Error al eliminar la historia' });
  }
});

// ============= FRONTEND SPA =============

const frontendPath = NODE_ENV === 'production'
  ? path.join(__dirname, '../public')
  : path.join(__dirname, '../../dist');

if (NODE_ENV === 'production') {
  app.use(express.static(frontendPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
        res.setHeader('Content-Type', 'application/javascript');
      } else if (filePath.endsWith('.wasm')) {
        res.setHeader('Content-Type', 'application/wasm');
      } else if (filePath.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
      }
      const basename = filePath.split('/').pop() || '';
      if (basename === 'sw.js' || basename.startsWith('workbox-') || basename === 'registerSW.js') {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      } else if (filePath.includes('/assets/')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    }
  }));
  app.get('*', (req: Request, res: Response) => {
    if (!req.path.startsWith('/api') && !req.path.match(/\.(js|mjs|css|wasm|png|jpg|jpeg|gif|svg|ico|json|woff|woff2|ttf|eot)$/)) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(frontendPath, 'index.html'));
    } else {
      res.status(404).end();
    }
  });
}

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', { error: err.message, path: req.path });
  res.status(err.status || 500).json({ error: 'Internal server error' });
});

// Inicialización del servidor
const startServer = async () => {
  try {
    await prisma.$connect();
    // Attempt to automatically fix schema on startup
    try {
      logger.info('Running startup database schema checks...');
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "experiencePoints" INTEGER NOT NULL DEFAULT 0;`);
      } catch (e: any) {
        if (!String(e.message).toLowerCase().includes('duplicate column')) {
          throw e;
        }
      }
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "level" INTEGER NOT NULL DEFAULT 1;`);
      } catch (e: any) {
        if (!String(e.message).toLowerCase().includes('duplicate column')) {
          throw e;
        }
      }
      const tableChecks = [
        `CREATE TABLE IF NOT EXISTS "UserAchievement" ("id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "achievementKey" TEXT NOT NULL, "title" TEXT NOT NULL, "description" TEXT NOT NULL, "icon" TEXT NOT NULL, "xpReward" INTEGER NOT NULL DEFAULT 0, "unlockedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE);`,
        `CREATE TABLE IF NOT EXISTS "UserBadge" ("id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "badgeKey" TEXT NOT NULL, "title" TEXT NOT NULL, "description" TEXT NOT NULL, "icon" TEXT NOT NULL, "unlockedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE);`,
        `CREATE TABLE IF NOT EXISTS "UserStreak" ("id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL UNIQUE, "loginCount" INTEGER NOT NULL DEFAULT 0, "lastDate" DATETIME, CONSTRAINT "UserStreak_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE);`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "UserAchievement_userId_achievementKey_key" ON "UserAchievement" ("userId", "achievementKey");`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "UserBadge_userId_badgeKey_key" ON "UserBadge" ("userId", "badgeKey");`,
        `CREATE INDEX IF NOT EXISTS "UserAchievement_userId_idx" ON "UserAchievement" ("userId");`,
        `CREATE INDEX IF NOT EXISTS "UserBadge_userId_idx" ON "UserBadge" ("userId");`,
      ];
      for (const sql of tableChecks) {
        try { await prisma.$executeRawUnsafe(sql); } catch (e: any) { logger.warn('Table creation warning', { error: e.message }); }
      }
      logger.info('Database gamification schema checks passed.');
    } catch (schemaError: any) {
      logger.warn('Schema startup checks could not be completed cleanly', { error: schemaError.message });
    }

    httpServer.listen(PORT, '0.0.0.0', () => {
      logger.info(`Server running on port ${PORT} in ${NODE_ENV} mode`);
      logger.info(`Uploads directory config: ${UPLOADS_DIR}`);
      const dbUrl = process.env.DATABASE_URL || 'file:./dev.db';
      const isAbsolute = dbUrl.includes('/app/data');
      logger.info(`Database URL path: ${dbUrl.replace(/\/[^/]+\//, '/.../')}`);
      logger.info(`Database persistent: ${isAbsolute ? 'YES (/app/data mounted)' : 'NO (relative path - data will be lost on restart!)'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

export { app, startServer };

const isMain = process.argv[1]
  ? pathToFileURL(process.argv[1]).href === import.meta.url
  : false;

if (isMain) {
  startServer();
}

const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  await prisma.$disconnect();
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason: String(reason) });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
  shutdown('uncaughtException');
});
