import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

// ============= SCHEMAS =============

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email inválido'),
  password: z.string().min(8, 'Contraseña debe tener al menos 8 caracteres'),
  name: z.string().min(2, 'Nombre debe tener al menos 2 caracteres'),
  gender: z.enum(['male', 'female', 'other']).optional(),
  birthDate: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

export const productSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  category: z.string().min(1, 'Categoría requerida'),
  color: z.string().optional(),
  season: z.enum(['summer', 'winter', 'spring', 'autumn', 'all', 'transition']).optional(),
  brand: z.string().optional(),
  size: z.string().optional(),
  price: z.union([z.number(), z.string()]).optional(),
  forSale: z.union([z.boolean(), z.string()]).optional(),
  isWashing: z.union([z.boolean(), z.string()]).optional(),
  description: z.string().optional(),
  condition: z.enum(['new', 'good', 'fair', 'worn']).optional(),
  usageCount: z.union([z.number(), z.string()]).optional(),
});

export const lookSchema = z.object({
  title: z.string().min(1, 'Título requerido'),
  productIds: z.union([z.string(), z.array(z.string())]),
  isPublic: z.union([z.boolean(), z.string()]).optional(),
  mood: z.string().optional(),
});

export const plannerSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  lookId: z.string().nullable().optional(),
  eventNote: z.string().optional(),
  userId: z.string().optional(),
});

export const tripSchema = z.object({
  destination: z.string().min(1, 'Destino requerido'),
  dateStart: z.string().min(1, 'Fecha de inicio requerida'),
  dateEnd: z.string().min(1, 'Fecha de fin requerida'),
  items: z.array(z.object({
    label: z.string(),
    checked: z.boolean().optional(),
    isEssential: z.boolean().optional(),
  })).optional(),
  garmentIds: z.array(z.string()).optional(),
});

export const commentSchema = z.object({
  lookId: z.string().min(1, 'Look ID requerido'),
  content: z.string().min(1, 'El comentario no puede estar vacío').max(500, 'Comentario muy largo'),
  parentId: z.string().optional(),
});

export const favoriteSchema = z.object({
  lookId: z.string().optional(),
  productId: z.string().optional(),
}).refine(data => data.lookId || data.productId, {
  message: 'Debe proporcionar lookId o productId',
});

export const followSchema = z.object({
  targetUserId: z.string().min(1, 'Target user ID requerido'),
});

// ============= MIDDLEWARE VALIDATOR =============

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email inválido'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token requerido'),
  newPassword: z.string().min(8, 'Contraseña debe tener al menos 8 caracteres'),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token requerido'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Contraseña actual requerida'),
  newPassword: z.string().min(8, 'Nueva contraseña debe tener al menos 8 caracteres'),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2, 'Nombre debe tener al menos 2 caracteres').optional().nullable(),
  bio: z.string().max(500, 'Bio muy larga').optional().nullable(),
  gender: z.enum(['male', 'female', 'other']).optional().nullable(),
  birthDate: z.string().optional().nullable(),
  mood: z.string().optional().nullable(),
  emailNotifications: z.union([z.boolean(), z.string()]).optional().nullable(),
  emailChat: z.union([z.boolean(), z.string()]).optional().nullable(),
  emailFollows: z.union([z.boolean(), z.string()]).optional().nullable(),
  emailWashing: z.union([z.boolean(), z.string()]).optional().nullable(),
  emailChallenges: z.union([z.boolean(), z.string()]).optional().nullable(),
  cycleTracking: z.union([z.boolean(), z.string()]).optional().nullable(),
  musicSync: z.union([z.boolean(), z.string()]).optional().nullable(),
});

export const conversationSchema = z.object({
  targetUserId: z.string().min(1, 'Usuario destino requerido'),
  otherUserId: z.string().optional(),
  itemId: z.string().optional(),
  itemTitle: z.string().optional(),
  itemImage: z.string().optional(),
  initialMessage: z.string().max(1000).optional(),
});

export const messageSchema = z.object({
  content: z.string().max(2000).optional(),
  imageUrl: z.string().optional(),
  productId: z.string().optional(),
  conversationId: z.string().min(1, 'Conversación ID requerida').optional(),
  otherUserId: z.string().optional(),
}).refine(data => data.content || data.imageUrl, {
  message: 'Debe proporcionar contenido o imagen',
});

export const resendVerificationSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email inválido'),
});

export const testEmailSchema = z.object({
  email: z.string().email('Email inválido').optional(),
});

export const validate = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Error de validación',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      }
      next(error);
    }
  };
};

// ============= HELPER FUNCTIONS =============

export const sanitizeProduct = (body: any) => {
  const parsedPrice = body.price ? parseFloat(body.price) : null;
  return {
    ...body,
    price: (parsedPrice !== null && !isNaN(parsedPrice)) ? parsedPrice : null,
    forSale: body.forSale === 'true' || body.forSale === true,
    usageCount: body.usageCount ? parseInt(body.usageCount) : undefined,
  };
};

export const sanitizeLook = (body: any) => {
  return {
    ...body,
    productIds: typeof body.productIds === 'string' ? JSON.parse(body.productIds) : body.productIds,
    isPublic: body.isPublic === 'true' || body.isPublic === true,
  };
};
