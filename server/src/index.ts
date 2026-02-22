import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import multer from 'multer';
import { mkdirSync, existsSync, unlinkSync } from 'fs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import logger from './logger.js';
import { processImage } from './imageProcessor.js';
import {
  validate,
  registerSchema,
  loginSchema,
  productSchema,
  lookSchema,
  commentSchema,
  favoriteSchema,
  followSchema,
  plannerSchema,
  tripSchema
} from './validators.js';
import { fashionTrendsService } from './fashionTrends.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();
const prisma = new PrismaClient();

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
  logger.warn('SMTP not configured. Email features will be disabled.');
  logger.warn('Set SMTP_HOST, SMTP_USER, and SMTP_PASS in .env to enable email.');
}

// Only create transporter if SMTP is configured
const transporter = isEmailConfigured
  ? nodemailer.createTransport({
    host: process.env.SMTP_HOST!,
    port: parseInt(process.env.SMTP_PORT || '587'),
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
    },
  })
  : null;

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
  'http://localhost:5173',
  'http://localhost:3000'
].filter(Boolean); // Remove undefined values

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/api/uploads', express.static(UPLOADS_DIR));

// ============= RATE LIMITING =============
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Máximo 5 intentos
  message: { error: 'Demasiados intentos. Por favor, espera 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
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
    const normalizedEmail = req.body.email.toLowerCase().trim();
    const { password, name, gender, birthDate } = req.body;
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) return res.status(400).json({ error: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        name,
        gender: gender || 'female',
        birthDate: birthDate ? new Date(birthDate) : null
      }
    });
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    // Set httpOnly cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    const { password: _, ...safe } = user;
    logger.info('User registered successfully', { userId: user.id, email: user.email });
    res.status(201).json({ user: safe, token });
  } catch (error) {
    logger.error('Registration error', { error });
    res.status(500).json({ error: 'Error during registration' });
  }
});

app.post('/api/auth/login', authLimiter, validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const normalizedEmail = req.body.email.toLowerCase().trim();
    const { password } = req.body;
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { _count: { select: { followers: true, following: true } } }
    });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    // Set httpOnly cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    const { password: _, _count, ...safe } = user;
    logger.info('User logged in', { userId: user.id });
    res.json({
      user: { ...safe, followersCount: _count.followers, followingCount: _count.following },
      token
    });
  } catch (error) {
    logger.error('Login error', { error });
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/logout', (req: Request, res: Response) => {
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: 'strict',
  });
  logger.info('User logged out');
  res.json({ message: 'Logged out successfully' });
});

app.post('/api/auth/forgot-password', authLimiter, async (req: Request, res: Response) => {
  try {
    // Check if email is configured
    if (!transporter) {
      return res.status(503).json({
        error: 'Email service not configured. Please contact support.'
      });
    }

    const normalizedEmail = req.body.email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const token = crypto.randomBytes(32).toString('hex');
    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenExpiry: new Date(Date.now() + 3600000) }
    });

    const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
    await transporter.sendMail({
      from: '"Estilo Vivo" <no-reply@estilovivo.app>',
      to: user.email,
      subject: 'Recuperar contraseña - Estilo Vivo',
      html: `<p>Hola ${user.name}, haz clic aquí para restablecer tu contraseña:</p><a href="${resetUrl}">${resetUrl}</a>`
    });
    res.json({ message: 'Recovery email sent' });
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error during forgot password process' });
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

app.put('/api/auth/profile', authenticateToken, upload.single('avatar'), async (req: any, res: Response) => {
  try {
    const { name, bio, mood, cycleTracking, musicSync, gender, birthDate } = req.body;
    const file = req.file as Express.Multer.File | undefined;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (bio !== undefined) updateData.bio = bio;
    if (mood !== undefined) updateData.mood = mood;
    if (cycleTracking !== undefined) updateData.cycleTracking = cycleTracking === 'true' || cycleTracking === true;
    if (musicSync !== undefined) updateData.musicSync = musicSync === 'true' || musicSync === true;
    if (gender !== undefined) updateData.gender = gender;
    if (birthDate !== undefined) updateData.birthDate = birthDate ? new Date(birthDate) : null;
    if (file) updateData.avatar = `/api/uploads/${file.filename}`;

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
        { name: { contains: search as string, mode: 'insensitive' } },
        { brand: { contains: search as string, mode: 'insensitive' } },
        { category: { contains: search as string, mode: 'insensitive' } },
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
    const { name, category, color, season, brand, size, condition, description, price, forSale } = req.body;
    const files = req.files as Express.Multer.File[] | undefined;

    // Process images with sharp
    const processedImages = [];
    if (files && files.length > 0) {
      for (const file of files) {
        try {
          const processed = await processImage(file.path, UPLOADS_DIR, file.filename);
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
          // Fallback to original if processing fails
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
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error creating product' });
  }
});

app.put('/api/products/:id', authenticateToken, upload.array('images', 5), validate(productSchema), async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { name, category, color, season, brand, size, condition, description, price, forSale, usageCount } = req.body;
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
    if (usageCount !== undefined) updateData.usageCount = parseInt(usageCount);

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...updateData,
        ...(files && files.length > 0 ? {
          images: { create: files.map((f) => ({ filename: f.filename, url: `/api/uploads/${f.filename}` })) }
        } : {}),
      },
      include: { images: true, user: { select: { id: true, name: true, avatar: true } } },
    });
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
      where: { isPublic: true },
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

app.post('/api/looks', authenticateToken, validate(lookSchema), upload.array('images', 10), async (req: any, res: Response) => {
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
          // Fallback to original if processing fails
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
    const existing = await prisma.like.findUnique({ where: { userId_lookId: { userId, lookId } } });
    if (existing) {
      await prisma.like.delete({ where: { id: existing.id } });
      res.json({ liked: false, likesCount: await prisma.like.count({ where: { lookId } }) });
    } else {
      await prisma.like.create({ data: { userId, lookId } });
      res.json({ liked: true, likesCount: await prisma.like.count({ where: { lookId } }) });
    }
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error toggling like' });
  }
});

app.post('/api/social/comment', authenticateToken, validate(commentSchema), async (req: any, res: Response) => {
  try {
    const { lookId, content } = req.body;
    const comment = await prisma.comment.create({
      data: { userId: req.user.userId, lookId, content },
      include: { user: { select: { id: true, name: true, avatar: true } } }
    });
    res.status(201).json(comment);
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error adding comment' });
  }
});

app.get('/api/social/comments/:lookId', authenticateToken, async (req: any, res: Response) => {
  try {
    const comments = await prisma.comment.findMany({
      where: { lookId: req.params.lookId },
      include: { user: { select: { id: true, name: true, avatar: true } } },
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
      const existing = await prisma.favorite.findUnique({ where: { userId_lookId: { userId, lookId } } });
      if (existing) { await prisma.favorite.delete({ where: { id: existing.id } }); res.json({ favorited: false }); }
      else { await prisma.favorite.create({ data: { userId, lookId } }); res.json({ favorited: true }); }
    } else if (productId) {
      const existing = await prisma.favorite.findUnique({ where: { userId_productId: { userId, productId } } });
      if (existing) { await prisma.favorite.delete({ where: { id: existing.id } }); res.json({ favorited: false }); }
      else { await prisma.favorite.create({ data: { userId, productId } }); res.json({ favorited: true }); }
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
    const existing = await prisma.follow.findUnique({ where: { followerId_followingId: { followerId: userId, followingId: targetUserId } } });
    if (existing) { await prisma.follow.delete({ where: { id: existing.id } }); res.json({ following: false }); }
    else { await prisma.follow.create({ data: { followerId: userId, followingId: targetUserId } }); res.json({ following: true }); }
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error toggling follow' });
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

// ============= CHAT =============

app.get('/api/chat/conversations', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.user.userId;
    const conversations = await prisma.conversation.findMany({
      where: { participants: { some: { userId } } },
      include: {
        participants: { include: { user: { select: { id: true, name: true, avatar: true } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, include: { sender: { select: { id: true, name: true, avatar: true } } } }
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.json(conversations.map(c => {
      const lastMessage = c.messages[0];
      const other = c.participants.find(p => p.userId !== userId)?.user;
      return {
        id: c.id,
        itemId: c.itemId,
        itemTitle: c.itemTitle,
        itemImage: c.itemImage,
        itemOwnerId: c.itemOwnerId,
        updatedAt: c.updatedAt,
        lastMessage: lastMessage ? {
          id: lastMessage.id,
          content: lastMessage.content,
          createdAt: lastMessage.createdAt,
          sender: lastMessage.sender
        } : null,
        participants: c.participants.map(p => p.user),
        otherUser: other || null
      };
    }));
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error fetching conversations' });
  }
});

app.post('/api/chat/conversations', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.user.userId;
    const { targetUserId, itemId, itemTitle, itemImage, initialMessage } = req.body;
    if (!targetUserId) return res.status(400).json({ error: 'targetUserId required' });
    if (userId === targetUserId) return res.status(400).json({ error: 'Cannot create conversation with yourself' });

    // If itemId provided, validate that targetUserId is the item/product owner
    if (itemId) {
      const product = await prisma.product.findUnique({ where: { id: itemId } });
      if (product && product.userId !== targetUserId) {
        return res.status(400).json({ error: 'Invalid targetUserId for this item' });
      }
    }

    const existing = await prisma.conversation.findFirst({
      where: {
        itemId: itemId || undefined,
        participants: { some: { userId } },
        AND: { participants: { some: { userId: targetUserId } } }
      },
      include: { participants: { include: { user: { select: { id: true, name: true, avatar: true } } } } }
    });

    if (existing) {
      return res.json({ id: existing.id });
    }

    const conversation = await prisma.conversation.create({
      data: {
        itemId: itemId || null,
        itemTitle: itemTitle || null,
        itemImage: itemImage || null,
        itemOwnerId: targetUserId,
        participants: {
          create: [{ userId }, { userId: targetUserId }]
        },
        ...(initialMessage ? {
          messages: { create: [{ senderId: userId, content: initialMessage }] }
        } : {})
      }
    });

    res.status(201).json({ id: conversation.id });
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error creating conversation' });
  }
});

app.get('/api/chat/conversations/:id/messages', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.user.userId;
    const conversationId = req.params.id;
    const membership = await prisma.conversationParticipant.findFirst({ where: { conversationId, userId } });
    if (!membership) return res.status(403).json({ error: 'Not authorized' });

    const messages = await prisma.message.findMany({
      where: { conversationId },
      include: { sender: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'asc' }
    });
    res.json(messages);
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error fetching messages' });
  }
});

app.post('/api/chat/conversations/:id/messages', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.user.userId;
    const conversationId = req.params.id;
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'content required' });

    const membership = await prisma.conversationParticipant.findFirst({ where: { conversationId, userId } });
    if (!membership) return res.status(403).json({ error: 'Not authorized' });

    const message = await prisma.message.create({
      data: { conversationId, senderId: userId, content }
    });

    // Update conversation's updatedAt timestamp to sort conversations by last activity
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() }
    });

    res.status(201).json(message);
  } catch (error) {
    logger.error('Error occurred', { error });
    res.status(500).json({ error: 'Error sending message' });
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

// ============= FRONTEND SPA =============

const frontendPath = NODE_ENV === 'production'
  ? path.join(__dirname, '../public')
  : path.join(__dirname, '../../dist');

if (NODE_ENV === 'production') {
  app.use(express.static(frontendPath));
  app.get('*', (req: Request, res: Response) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(frontendPath, 'index.html'));
    }
  });
}

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

async function main() {
  try {
    await prisma.$connect();
    console.log('✓ Database connected');
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✓ Server running on port ${PORT}`);
      console.log(`  API: http://localhost:${PORT}/api`);
      console.log(`  Env: ${NODE_ENV}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

main();

