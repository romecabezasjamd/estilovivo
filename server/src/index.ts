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
  commentSchema,
  favoriteSchema,
  followSchema,
  plannerSchema,
  tripSchema
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

const app: Express = express();
const httpServer = createServer(app);
const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL || 'file:./dev.db'
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

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Middleware - CORS configuration
const allowedOrigins = [
  process.env.SERVICE_FQDN_APP ? `https://${process.env.SERVICE_FQDN_APP}` : null,
  process.env.SERVICE_URL_APP,
  process.env.FRONTEND_URL,
  'https://estilovivo.xyoncloud.win',
  'http://localhost:5173',
  'http://localhost:3000',
  'capacitor://localhost', // Potential Capacitor/Mobile origin
  'http://localhost',
].filter(Boolean) as string[]; // Remove undefined values

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    // Check if origin is in allowed list
    if (allowedOrigins.some(allowed => origin.startsWith(allowed || ''))) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked origin: ${origin}`);
      callback(null, true); // Allow anyway in production to avoid issues
    }
  },
  credentials: true,
}));

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.some(allowed => origin.startsWith(allowed || ''))) {
        callback(null, true);
      } else {
        callback(null, true); // Allow all for simplicity inside the proxy
      }
    },
    credentials: true,
  }
});

io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id}`);

  socket.on('join_user', (userId) => {
    socket.join(`user_${userId}`);
    logger.info(`User ${userId} joined their personal room`);
  });

  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    logger.info(`Socket ${socket.id} joined room ${roomId}`);
  });

  socket.on('leave_room', (roomId) => {
    socket.leave(roomId);
  });

  socket.on('typing', ({ roomId, userId }) => {
    socket.to(roomId).emit('typing', { userId });
  });

  socket.on('stop_typing', ({ roomId, userId }) => {
    socket.to(roomId).emit('stop_typing', { userId });
  });

  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/api/uploads', express.static(UPLOADS_DIR));

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

// ============= HEALTH =============
app.get('/api/health', async (req: Request, res: Response) => {
  const healthCheck = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
    database: 'unknown',
    version: process.env.npm_package_version || '0.0.0'
  };

  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    healthCheck.database = 'connected';
    res.status(200).json(healthCheck);
  } catch (error) {
    healthCheck.status = 'error';
    healthCheck.database = 'disconnected';
    res.status(503).json(healthCheck);
  }
});

app.get('/api/debug-db', async (req: Request, res: Response) => {
  try {
    const results = [];
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "experiencePoints" INTEGER NOT NULL DEFAULT 0;`);
      results.push('Added experiencePoints column');
    } catch (e: any) {
      results.push('Error adding experiencePoints: ' + e.message);
    }
    
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "level" INTEGER NOT NULL DEFAULT 1;`);
      results.push('Added level column');
    } catch (e: any) {
      results.push('Error adding level: ' + e.message);
    }

    try {
      try { await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN "isWashing" BOOLEAN NOT NULL DEFAULT false;`); results.push('Added isWashing column'); } catch (e: any) { results.push('Error adding isWashing' + e.message); }
      const tablesOptions = [`CREATE TABLE IF NOT EXISTS "Notification" ( "id" TEXT NOT NULL, "type" TEXT NOT NULL, "content" TEXT, "isRead" BOOLEAN NOT NULL DEFAULT false, "userId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Notification_pkey" PRIMARY KEY ("id") );`, `CREATE TABLE IF NOT EXISTS "Conversation" ( "id" TEXT NOT NULL, "itemId" TEXT, "itemTitle" TEXT, "itemImage" TEXT, "itemOwnerId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id") );`, `CREATE TABLE IF NOT EXISTS "ConversationParticipant" ( "id" TEXT NOT NULL, "conversationId" TEXT NOT NULL, "userId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id") );`, `CREATE TABLE IF NOT EXISTS "Message" ( "id" TEXT NOT NULL, "conversationId" TEXT NOT NULL, "senderId" TEXT NOT NULL, "content" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Message_pkey" PRIMARY KEY ("id") );`];
      for (const sql of tablesOptions) { try { await prisma.$executeRawUnsafe(sql); results.push('Created table'); } catch (e: any) { results.push('Error: ' + e.message); } }
      const users = await prisma.$queryRaw`SELECT id, "experiencePoints", "level" FROM "User" LIMIT 1`;
      results.push({ userCheck: users });
    } catch (e: any) {
      results.push('Error selecting users: ' + e.message);
    }
    
    res.json({ success: true, results });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/server-logs', async (req: Request, res: Response) => {
  try {
    const logFile = path.join(process.cwd(), 'combined.log'); // Typical winston log file
    const errFile = path.join(process.cwd(), 'error.log');
    
    let logs = '';
    if (existsSync(errFile)) {
      logs += '=== ERROR.LOG ===\n' + readFileSync(errFile, 'utf-8').slice(-5000) + '\n\n';
    }
    if (existsSync(logFile)) {
      logs += '=== COMBINED.LOG ===\n' + readFileSync(logFile, 'utf-8').slice(-5000) + '\n\n';
    }
    
    if (!logs) logs = 'No log files found in ' + process.cwd();
    
    res.type('text/plain').send(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Health check detallado (solo para desarrollo o admin)
app.get('/api/health/detailed', authenticateToken, async (req: any, res: Response) => {
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
        <p class="greeting">¡Bienvenida a Estilo Vivo, ${user.name}! 🎉</p>
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

    const { password: _, ...safe } = user;
    if (emailSent) {
      logger.info('User registered (pending verification)', { userId: user.id, email: user.email });
      res.status(201).json({
        user: safe,
        message: 'verificationEmailSent',
        requiresVerification: true
      });
    } else {
      logger.info('User registered & auto-verified', { userId: user.id, email: user.email });
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      res.status(201).json({
        user: safe,
        token,
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
      logger.warn('Login failed: User not found', { email: normalizedEmail });
      return res.status(404).json({ error: 'User not found' });
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

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    // Set httpOnly cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    const { password: _, _count, ...safe } = user;
    logger.info('User logged in', { userId: user.id });
    res.json({
      user: { ...safe, followersCount: _count.followers, followingCount: _count.following },
      token,
      requiresVerification
    });
  } catch (error: any) {
    logger.error('Login error', { error });
    res.status(500).json({ error: `Error en login: ${error.message || 'Error interno'}` });
  }
});

app.post('/api/auth/resend-verification', authLimiter, validate(resendVerificationSchema), async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const normalizedEmail = normalizeEmail(email);

    const user = (await findUsersByEmail(normalizedEmail))[0];

    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (user.isVerified) return res.status(400).json({ error: 'La cuenta ya está verificada' });

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
      <p class="greeting">Hola ${user.name},</p>
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

app.post('/api/auth/logout', (req: Request, res: Response) => {
  res.clearCookie('auth_token');
  res.json({ success: true });
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

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error changing password' });
  }
});

app.post('/api/auth/test-email', validate(testEmailSchema), async (req: Request, res: Response) => {
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
      <p class="greeting">Hola ${user.name},</p>
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
      logger.warn('GET /reset-password/:token: Invalid or expired token attempt', { token });
      return res.redirect(`${getFrontendUrl()}/auth?error=invalid_token`);
    }

    logger.info('GET /reset-password/:token: Valid token redirection', { userId: user.id });
    res.redirect(`${getFrontendUrl()}/auth?token=${token}&type=reset`);
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

    // Cascading deletes in Prisma will handle products, looks, etc.
    await prisma.user.delete({
      where: { id: userId }
    });

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
    const { password: _, _count, ...safe } = user;
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
    const { name, bio, mood, cycleTracking, musicSync, emailNotifications, emailChat, emailFollows, emailWashing, emailChallenges, gender, birthDate } = req.body;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const avatarFile = files?.['avatar']?.[0];
    const fullBodyFile = files?.['fullBodyAvatar']?.[0];

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (bio !== undefined) updateData.bio = bio;
    if (mood !== undefined) updateData.mood = mood;
    if (cycleTracking !== undefined) updateData.cycleTracking = cycleTracking === 'true' || cycleTracking === true;
    if (musicSync !== undefined) updateData.musicSync = musicSync === 'true' || musicSync === true;
    if (emailNotifications !== undefined) updateData.emailNotifications = emailNotifications === 'true' || emailNotifications === true;
    if (emailChat !== undefined) updateData.emailChat = emailChat === 'true' || emailChat === true;
    if (emailFollows !== undefined) updateData.emailFollows = emailFollows === 'true' || emailFollows === true;
    if (emailWashing !== undefined) updateData.emailWashing = emailWashing === 'true' || emailWashing === true;
    if (emailChallenges !== undefined) updateData.emailChallenges = emailChallenges === 'true' || emailChallenges === true;
    if (gender !== undefined) updateData.gender = gender;
    if (birthDate !== undefined) updateData.birthDate = birthDate ? new Date(birthDate) : null;
    if (avatarFile) updateData.avatar = `/api/uploads/${avatarFile.filename}`;
    if (fullBodyFile) updateData.fullBodyAvatar = `/api/uploads/${fullBodyFile.filename}`;

    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data: updateData,
      include: { _count: { select: { followers: true, following: true } } }
    });
    const { password: _, _count, ...safe } = user;
    res.json({ ...safe, followersCount: _count.followers, followingCount: _count.following });
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error updating profile' });
  }
});

// ============= PRODUCTOS =============

app.get('/api/products', authenticateToken, async (req: any, res: Response) => {
  try {
    const { cursor, limit = '20' } = req.query;
    const take = parseInt(limit as string) + 1;

    const products = await prisma.product.findMany({
      where: { userId: req.user.userId },
      include: { images: true, user: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
      take,
      ...(cursor ? { cursor: { id: cursor as string }, skip: 1 } : {}),
    });

    const hasMore = products.length > parseInt(limit as string);
    const items = hasMore ? products.slice(0, -1) : products;
    const nextCursor = hasMore ? items[items.length - 1]?.id : null;

    res.json({ items, nextCursor, hasMore });
  } catch (error: any) {
    logger.error('Error fetching products', {
      error: error.message,
      stack: error.stack,
      userId: req.user.userId
    });
    res.status(500).json({ error: 'Error fetching products', detail: error.message });
  }
});

app.get('/api/products/shop', authenticateToken, async (req: any, res: Response) => {
  try {
    const { search, category } = req.query;
    const where: any = { forSale: true, userId: { not: req.user.userId } };
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

    // Process images with sharp
    const processedImages = [];
    if (files && files.length > 0) {
      for (const file of files) {
        try {
          const processed = await processImage(file.path, UPLOADS_DIR, file.filename, true);
          processedImages.push({
            filename: processed.medium,
            url: `/api/uploads/${processed.medium}`,
            thumbnail: `/api/uploads/${processed.thumbnail}`,
            original: `/api/uploads/${processed.original}`,
          });
          // Delete original uploaded file
          unlinkSync(file.path);
        } catch (imgError) {
          logger.error('Image processing failed', { error: imgError, filename: file.filename });
          try { unlinkSync(file.path); } catch { /* file may not exist */ }
          processedImages.push({
            filename: file.filename,
            url: `/api/uploads/${file.filename}`,
          });
        }
      }
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
        price: price ? parseFloat(price) : null,
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

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (category !== undefined) updateData.category = category;
    if (color !== undefined) updateData.color = color;
    if (season !== undefined) updateData.season = season;
    if (brand !== undefined) updateData.brand = brand;
    if (size !== undefined) updateData.size = size;
    if (condition !== undefined) updateData.condition = condition;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined && price !== null) updateData.price = parseFloat(price);
    if (price === null) updateData.price = null;
    if (forSale !== undefined) updateData.forSale = forSale === 'true' || forSale === true;
    if (isWashing !== undefined) updateData.isWashing = isWashing === 'true' || isWashing === true;
    if (usageCount !== undefined) updateData.usageCount = parseInt(usageCount);

    const processedImages = [];
    if (files && files.length > 0) {
      for (const file of files) {
        try {
          const processed = await processImage(file.path, UPLOADS_DIR, file.filename, true);
          processedImages.push({
            filename: processed.medium,
            url: `/api/uploads/${processed.medium}`,
            thumbnail: `/api/uploads/${processed.thumbnail}`,
            original: `/api/uploads/${processed.original}`,
          });
          unlinkSync(file.path);
        } catch (imgError) {
          logger.error('Image processing failed in PUT', { error: imgError, filename: file.filename });
          try { unlinkSync(file.path); } catch { /* file may not exist */ }
          processedImages.push({
            filename: file.filename,
            url: `/api/uploads/${file.filename}`,
          });
        }
      }
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
      await sendPreferenceEmail({
        userId: req.user.userId,
        subject: 'Tu prenda está en la lavadora - Estilo Vivo',
        text: `La prenda "${product.name}" está ahora en la lavadora`,
        html: `<p>La prenda <strong>${product.name}</strong> está ahora en la lavadora.</p>`,
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

    for (const img of existing.images) {
      const filePath = path.join(UPLOADS_DIR, img.filename);
      if (existsSync(filePath)) { try { unlinkSync(filePath); } catch (e) { /* ignore */ } }
    }
    await prisma.product.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error deleting product' });
  }
});

app.post('/api/products/:id/wear', authenticateToken, async (req: any, res: Response) => {
  try {
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
    const take = parseInt(limit as string) + 1;

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

    const hasMore = looks.length > parseInt(limit as string);
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

app.get('/api/looks/feed', authenticateToken, async (req: any, res: Response) => {
  try {
    const { cursor, limit = '20' } = req.query;
    const take = parseInt(limit as string) + 1;

    const looks = await prisma.look.findMany({
      where: { isPublic: true, products: { none: { forSale: true } } },
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

    const hasMore = looks.length > parseInt(limit as string);
    const items = hasMore ? looks.slice(0, -1) : looks;
    const lookIds = items.map(l => l.id);

    const likedIds = new Set((await prisma.like.findMany({
      where: { userId: req.user.userId, lookId: { in: lookIds } },
      select: { lookId: true }
    })).map(l => l.lookId));

    const favIds = new Set((await prisma.favorite.findMany({
      where: { userId: req.user.userId, lookId: { in: lookIds } },
      select: { lookId: true }
    })).map(f => f.lookId));

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
    const { title, productIds, isPublic, mood } = req.body;
    const files = req.files as Express.Multer.File[] | undefined;
    const parsedIds = productIds ? (typeof productIds === 'string' ? JSON.parse(productIds) : productIds) : [];

    // Process images with sharp
    const processedImages = [];
    if (files && files.length > 0) {
      for (const file of files) {
        try {
          const processed = await processImage(file.path, UPLOADS_DIR, file.filename);
          processedImages.push({
            filename: processed.medium,
            url: `/api/uploads/${processed.medium}`,
          });
          // Delete original uploaded file
          unlinkSync(file.path);
        } catch (imgError) {
          logger.error('Image processing failed', { error: imgError, filename: file.filename });
          try { unlinkSync(file.path); } catch { /* file may not exist */ }
          processedImages.push({
            filename: file.filename,
            url: `/api/uploads/${file.filename}`,
          });
        }
      }
    }

    const look = await prisma.look.create({
      data: {
        title,
        userId: req.user.userId,
        isPublic: isPublic === 'true' || isPublic === true,
        mood: mood || null,
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

app.put('/api/looks/:id', authenticateToken, validate(lookSchema), async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { title, isPublic, mood, productIds } = req.body;
    const existing = await prisma.look.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.user.userId) return res.status(403).json({ error: 'Not authorized' });

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (isPublic !== undefined) updateData.isPublic = isPublic === 'true' || isPublic === true;
    if (mood !== undefined) updateData.mood = mood;
    if (productIds) updateData.products = { set: JSON.parse(productIds).map((pid: string) => ({ id: pid })) };

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
    const existing = await prisma.look.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.user.userId) return res.status(403).json({ error: 'Not authorized' });
    await prisma.look.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error deleting look' });
  }
});

// ============= SOCIAL =============

app.post('/api/social/like', authenticateToken, async (req: any, res: Response) => {
  try {
    const { lookId } = req.body;
    const userId = req.user.userId;
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
    if (liked) {
      awardXp(prisma, userId, XP_VALUES.receiveLike).catch(() => {});
      const look = await prisma.look.findUnique({ where: { id: lookId }, select: { userId: true } });
      if (look && look.userId !== userId) {
        const me = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
        const notif = await prisma.notification.create({
          data: { type: 'LIKE', content: `${me?.name || 'Alguien'} le gustó tu publicación`, userId: look.userId, relatedId: lookId }
        });
        io.to(`user_${look.userId}`).emit('notification', notif);
        await sendPreferenceEmail({
          userId: look.userId,
          subject: 'A alguien le gustó tu publicación - Estilo Vivo',
          text: `${me?.name || 'Alguien'} le gustó tu publicación`,
          html: `<p><strong>${me?.name || 'Alguien'}</strong> le gustó tu publicación.</p>`,
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

app.post('/api/social/comment', authenticateToken, validate(commentSchema), async (req: any, res: Response) => {
  try {
    const { lookId, content, parentId } = req.body;
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
      await sendPreferenceEmail({
        userId: look.userId,
        subject: 'Nuevo comentario en tu publicación - Estilo Vivo',
        text: `${me?.name || 'Alguien'} comentó tu publicación`,
        html: `<p><strong>${me?.name || 'Alguien'}</strong> comentó tu publicación.</p>`,
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
        await sendPreferenceEmail({
          userId: parent.userId,
          subject: 'Respuesta a tu comentario - Estilo Vivo',
          text: `${me?.name || 'Alguien'} respondió a tu comentario`,
          html: `<p><strong>${me?.name || 'Alguien'}</strong> respondió a tu comentario.</p>`,
          context: { type: 'COMMENT_REPLY', relatedId: lookId }
        });
      }
    }
    res.status(201).json(comment);
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error adding comment' });
  }
});

app.get('/api/social/comments/:lookId', authenticateToken, async (req: any, res: Response) => {
  try {
    const comments = await prisma.comment.findMany({
      where: { lookId: req.params.lookId, parentId: null },
      include: { user: { select: { id: true, name: true, avatar: true } }, replies: { include: { user: { select: { id: true, name: true, avatar: true } } }, orderBy: { createdAt: 'asc' } } },
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
    const existing = await prisma.comment.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.user.userId) return res.status(403).json({ error: 'Not authorized' });
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
    const favorites = await prisma.favorite.findMany({
      where: { userId: req.user.userId },
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
      const me = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
      const notif = await prisma.notification.create({
        data: { type: 'FOLLOW', content: `${me?.name || 'Alguien'} te siguió`, userId: targetUserId }
      });
      io.to(`user_${targetUserId}`).emit('notification', notif);
      await sendPreferenceEmail({
        userId: targetUserId,
        subject: 'Nuevo seguidor en Estilo Vivo',
        text: `${me?.name || 'Alguien'} te siguió`,
        html: `<p><strong>${me?.name || 'Alguien'}</strong> te siguió.</p>`,
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

app.get('/api/users/top', async (req: Request, res: Response) => {
  try {
    const topUsers = await prisma.user.findMany({
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

async function analyzeChallengeImage(filePath: string): Promise<{ uniform: boolean; score: number }> {
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
    return { uniform: score >= 30, score };
  } catch {
    return { uniform: true, score: 50 };
  }
}

app.get('/api/challenges/current', authenticateToken, async (req: Request, res: Response) => {
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
          select: { id: true, imageUrl: true, description: true, verified: true, awarded: true, createdAt: true }
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
    if (!challenge) return res.status(404).json({ error: 'Reto no encontrado' });
    if (!challenge.active) return res.status(400).json({ error: 'Este reto ya no está activo' });

    const existing = await prisma.challengeSubmission.findUnique({
      where: { userId_challengeId: { userId: req.user.userId, challengeId } }
    });
    if (existing) return res.status(400).json({ error: 'Ya participaste en este reto' });

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const imageFile = files?.['image']?.[0];

    if (!imageFile) {
      return res.status(400).json({ error: 'Debes subir una imagen para participar en el reto' });
    }

    const desc = (description || '').trim();
    if (!desc) {
      return res.status(400).json({ error: 'Debes añadir una descripción de al menos 10 caracteres' });
    }
    if (desc.length < 10) {
      return res.status(400).json({ error: 'La descripción debe tener al menos 10 caracteres' });
    }
    if (desc.length > 500) {
      return res.status(400).json({ error: 'La descripción no puede superar los 500 caracteres' });
    }

    const analysis = await analyzeChallengeImage(imageFile.path);

    const challengeTag = (challenge.tag || '').toLowerCase();
    const needsUniformColor = challengeTag.includes('monocromo') || challengeTag.includes('color');
    const verified = needsUniformColor ? analysis.uniform : true;

    const submission = await prisma.challengeSubmission.create({
      data: {
        userId: req.user.userId,
        challengeId,
        imageUrl: `/api/uploads/${imageFile.filename}`,
        description: description,
        verified,
        awarded: true,
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
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting challenge submission', { error });
    res.status(500).json({ error: 'Error al eliminar la participación' });
  }
});

app.post('/api/challenges/force-rotate', authenticateToken, async (req: any, res: Response) => {
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

    await prisma.challengeSubmission.deleteMany({
      where: { challengeId: { notIn: [challenge.id] } },
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
    const newlyUnlocked = await checkAndUnlockAchievements(prisma, req.user.userId, io);
    for (const ach of newlyUnlocked) {
      if (ach.xpReward > 0) {
        const result = await awardXp(prisma, req.user.userId, ach.xpReward);
        if (result.leveledUp) {
          const progress = xpProgress(result.experiencePoints, result.level);
          const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
            include: { streak: true },
          });
          io?.to(`user_${req.user.userId}`).emit('level_up', {
            level: result.level,
            xp: result.experiencePoints,
            xpCurrent: progress.current,
            xpNeeded: progress.needed,
            xpPercentage: Math.round(progress.percentage),
            streak: user?.streak ? { loginCount: user.streak.loginCount, lastDate: user.streak.lastDate } : null,
          });
        }
      }
      io?.to(`user_${req.user.userId}`).emit('achievement_unlocked', ach);
    }
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
    const userId = req.params.userId === 'me' ? req.user.userId : req.params.userId;
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
    const { date, lookId, eventNote, userId } = req.body;
    const targetUserId = (userId === 'me' || !userId) ? req.user.userId : userId;

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
    if (previousEntry?.lookId && previousEntry.lookId !== lookId) {
      await prisma.product.updateMany({
        where: { id: { in: previousEntry.look.products.map(p => p.id) } },
        data: { usageCount: { decrement: 1 } }
      });
    }

    // Increment usage count for garments in the newly assigned look
    if (lookId) {
      const look = await prisma.look.findUnique({ where: { id: lookId }, include: { products: true } });
      if (look) {
        await prisma.product.updateMany({
          where: { id: { in: look.products.map(p => p.id) } },
          data: { usageCount: { increment: 1 }, lastWorn: new Date() }
        });
      }
    }

    res.json(entry);
    // Fire-and-forget: award XP for planning the day
    awardPoints(prisma, targetUserId, 'planner').catch(e => logger.warn('awardPoints failed', { e }));
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error updating planner' });
  }
});

app.delete('/api/planner/:date', authenticateToken, async (req: any, res: Response) => {
  try {
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
    const userId = req.params.userId === 'me' ? req.user.userId : req.params.userId;
    const trips = await prisma.trip.findMany({
      where: { userId },
      include: { items: true, garments: { include: { product: true } } },
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
    const garmentsData = Array.isArray(garmentIds)
      ? { garments: { create: garmentIds.map((id: string) => ({ productId: id })) } }
      : {};
    const trip = await prisma.trip.create({
      data: {
        destination, dateStart, dateEnd, userId: req.user.userId,
        items: { create: items ? items.map((i: any) => ({ label: i.label, checked: i.checked || false, isEssential: i.isEssential || false })) : [] },
        ...garmentsData
      },
      include: { items: true, garments: { include: { product: true } } }
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
    if (Array.isArray(garmentIds)) {
      updateData.garments = {
        deleteMany: {},
        create: garmentIds.map((id: string) => ({ productId: id }))
      };
    }
    const trip = await prisma.trip.update({
      where: { id: req.params.id },
      data: updateData,
      include: { items: true, garments: { include: { product: true } } }
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
    const { checked, label, isEssential } = req.body;
    const item = await prisma.tripItem.update({
      where: { id: req.params.itemId },
      data: { ...(checked !== undefined && { checked }), ...(label !== undefined && { label }), ...(isEssential !== undefined && { isEssential }) }
    });
    res.json(item);
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error updating trip item' });
  }
});

app.post('/api/trips/:tripId/items', authenticateToken, async (req: any, res: Response) => {
  try {
    const item = await prisma.tripItem.create({
      data: { label: req.body.label, isEssential: req.body.isEssential || false, tripId: req.params.tripId }
    });
    res.json(item);
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error adding trip item' });
  }
});

app.delete('/api/trips/:tripId/items/:itemId', authenticateToken, async (req: any, res: Response) => {
  try {
    await prisma.tripItem.delete({ where: { id: req.params.itemId } });
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
    const conversations = await prisma.conversation.findMany({
      where: { participants: { some: { userId: req.user.userId } } },
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
    res.json(conversations);
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
        itemTitle: itemTitle || null,
        itemImage: itemImage || null,
        itemOwnerId: recipientId,
        participants: { create: [{ userId: req.user.userId }, { userId: recipientId }] },
        ...(initialMessage ? {
          messages: { create: [{ senderId: req.user.userId, content: initialMessage }] }
        } : {})
      },
      include: { participants: { include: { user: { select: { id: true, name: true, avatar: true } } } } }
    });
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

    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      include: { sender: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'asc' }
    });
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
    const url = `/api/uploads/${file.filename}`;
    res.json({ imageUrl: url });
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

    const participation = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId: req.user.userId } }
    });
    if (!participation) return res.status(403).json({ error: 'Not authorized' });

    const message = await prisma.message.create({
      data: { conversationId, content: content || '', imageUrl: imageUrl || null, productId: productId || null, senderId: req.user.userId },
      include: { sender: { select: { id: true, name: true, avatar: true } } }
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() }
    });

    io.to(conversationId).emit('new_message', message);

    // Notify the other participant
    const otherParticipant = await prisma.conversationParticipant.findFirst({
      where: { conversationId, userId: { not: req.user.userId } }
    });
    if (otherParticipant) {
      const notification = await prisma.notification.create({
        data: {
          type: 'CHAT',
          content: `${message.sender.name} te ha enviado un mensaje`,
          userId: otherParticipant.userId,
          relatedId: conversationId,
        }
      });
      io.to(`user_${otherParticipant.userId}`).emit('notification', notification);

      const otherUser = await prisma.user.findUnique({ where: { id: otherParticipant.userId } });
      if (transporter && otherUser?.email && otherUser.emailNotifications && otherUser.emailChat) {
        try {
          const emailContent = `
            <p class="greeting">Nuevo mensaje de ${message.sender.name} 💬</p>
            <p class="message">"${message.content}"</p>
            <div style="text-align: center;">
              <a href="${getEmailFriendlyUrl('/social?tab=chat')}" class="button">Ver Conversación</a>
            </div>
          `;
          await sendMailWithRetry({
            to: otherUser.email,
            subject: `💬 Nuevo mensaje de ${message.sender.name} - Estilo Vivo`,
            html: getEmailTemplate(emailContent, 'Nuevo Mensaje')
          });
        } catch (mailErr) {
          logger.warn('Could not send chat email notification', { error: mailErr, userId: otherParticipant.userId });
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
    const { conversationId, content, otherUserId, imageUrl, productId } = req.body;
    if (!content && !imageUrl) return res.status(400).json({ error: 'content or imageUrl required' });
    const message = await prisma.message.create({
      data: { conversationId, content: content || '', senderId: req.user.userId, imageUrl: imageUrl || null, productId: productId || null },
      include: { sender: { select: { id: true, name: true, avatar: true } } }
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() }
    });

    io.to(conversationId).emit('new_message', message);

    if (otherUserId) {
      const notification = await prisma.notification.create({
        data: {
          type: 'CHAT',
          content: `${message.sender.name} te ha enviado un mensaje`,
          userId: otherUserId,
          relatedId: conversationId,
        }
      });
      io.to(`user_${otherUserId}`).emit('notification', notification);

      const otherUser = await prisma.user.findUnique({ where: { id: otherUserId } });
      if (transporter && otherUser?.email && otherUser.emailNotifications && otherUser.emailChat) {
        try {
          const emailContent = `
            <p class="greeting">Nuevo mensaje de ${message.sender.name} 💬</p>
            <p class="message">"${message.content}"</p>
            <div style="text-align: center;">
              <a href="${getEmailFriendlyUrl('/social?tab=chat')}" class="button">Ver Conversación</a>
            </div>
          `;
          await sendMailWithRetry({
            to: otherUser.email,
            subject: `💬 Nuevo mensaje de ${message.sender.name} - Estilo Vivo`,
            html: getEmailTemplate(emailContent, 'Nuevo Mensaje')
          });
        } catch (mailErr) {
          logger.warn('Could not send chat email notification', { error: mailErr, userId: otherUserId });
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
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'story-' + uniqueSuffix + path.extname(file.originalname));
  },
});
const storyUpload = multer({ storage: storyStorage, limits: { fileSize: 10 * 1024 * 1024 } });

app.get('/api/stories', authenticateToken, async (req: any, res: Response) => {
  try {
    const stories = await prisma.story.findMany({
      where: { expiresAt: { gt: new Date() } },
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

    if (type === 'image' && file) {
      imageUrl = `/api/uploads/stories/${file.filename}`;
    } else if (type === 'image' && req.body.imageUrl) {
      imageUrl = req.body.imageUrl;
    }

    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

    const story = await prisma.story.create({
      data: {
        userId: req.user.userId,
        type,
        text: text || null,
        imageUrl,
        expiresAt,
      },
      include: { user: { select: { id: true, name: true, avatar: true } } },
    });

    res.status(201).json(story);
  } catch (error) {
    logger.error('Error creating story', { error });
    res.status(500).json({ error: 'Error creating story' });
  }
});

app.post('/api/stories/:id/view', authenticateToken, async (req: any, res: Response) => {
  try {
    const story = await prisma.story.update({
      where: { id: req.params.id },
      data: { views: { increment: 1 } },
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
    if (!emoji) return res.status(400).json({ error: 'Emoji requerido' });

    const story = await prisma.story.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { id: true, name: true, avatar: true } } },
    });
    if (!story) return res.status(404).json({ error: 'Historia no encontrada' });

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
      },
      include: { sender: { select: { id: true, name: true, avatar: true } } },
    });

    try { await prisma.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } }); } catch (e) { logger.error('Error updating conversation updatedAt', { e }); }

    try { io.to(conversation.id).emit('new_message', message); } catch (e) { logger.error('Error emitting new_message', { e }); }

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

    res.status(201).json({ message, conversationId: conversation.id });
  } catch (error: any) {
    logger.error('Error reacting to story', { error: error?.message || error, stack: error?.stack });
    res.status(500).json({ error: 'Error al reaccionar a la historia', detail: error?.message || '' });
  }
});

app.delete('/api/stories/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const story = await prisma.story.findUnique({ where: { id } });
    if (!story) return res.status(404).json({ error: 'Historia no encontrada' });
    if (story.userId !== req.user.userId) return res.status(403).json({ error: 'No autorizado' });
    await prisma.story.delete({ where: { id } });
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
      if (filePath.includes('/assets/')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    }
  }));
  app.get('*', (req: Request, res: Response) => {
    if (!req.path.startsWith('/api') && !req.path.match(/\.(js|mjs|css|wasm|png|jpg|jpeg|gif|svg|ico|json|woff|woff2|ttf|eot)$/)) {
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
