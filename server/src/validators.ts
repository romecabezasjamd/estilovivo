import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { unlink } from 'fs';

// ============= SCHEMAS =============

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email inválido'),
  password: z.string().min(8, 'Contraseña debe tener al menos 8 caracteres').max(128, 'Contraseña demasiado larga'),
  name: z.string().trim().min(2, 'Nombre debe tener al menos 2 caracteres').max(60, 'Nombre demasiado largo'),
  gender: z.enum(['male', 'female', 'other']).optional(),
  birthDate: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida').max(128),
});

export const productSchema = z.object({
  name: z.string().trim().min(1, 'Nombre requerido').max(100, 'Nombre demasiado largo'),
  category: z.string().min(1, 'Categoría requerida').max(50),
  color: z.string().max(50).optional(),
  season: z.enum(['summer', 'winter', 'spring', 'autumn', 'all', 'transition']).optional(),
  brand: z.string().max(80).optional(),
  size: z.string().max(20).optional(),
  price: z.union([z.number(), z.string()]).optional(),
  forSale: z.union([z.boolean(), z.string()]).optional(),
  isWashing: z.union([z.boolean(), z.string()]).optional(),
  description: z.string().max(1000, 'Descripción demasiado larga').optional(),
  condition: z.enum(['new', 'good', 'fair', 'worn']).optional(),
  usageCount: z.union([z.number(), z.string()]).optional(),
});

export const lookSchema = z.object({
  title: z.string().trim().min(1, 'Título requerido').max(100, 'Título demasiado largo'),
  productIds: z.union([z.string(), z.array(z.string())]).optional(),
  isPublic: z.union([z.boolean(), z.string()]).optional(),
  mood: z.string().max(50).optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
});

// En la edición todos los campos son opcionales (p. ej. sólo cambiar la visibilidad)
export const lookUpdateSchema = lookSchema.partial();

export const plannerSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  lookId: z.string().nullable().optional(),
  eventNote: z.string().max(300, 'Nota demasiado larga').optional(),
});

export const tripSchema = z.object({
  destination: z.string().trim().min(1, 'Destino requerido').max(100),
  dateStart: z.string().trim().min(1, 'Fecha de inicio requerida').max(40),
  dateEnd: z.string().trim().min(1, 'Fecha de fin requerida').max(40),
  items: z.array(z.object({
    label: z.string().trim().min(1).max(120),
    checked: z.boolean().optional(),
    isEssential: z.boolean().optional(),
  })).max(200).optional(),
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
  newPassword: z.string().min(8, 'Contraseña debe tener al menos 8 caracteres').max(128),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token requerido'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Contraseña actual requerida'),
  newPassword: z.string().min(8, 'Nueva contraseña debe tener al menos 8 caracteres').max(128),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Nombre debe tener al menos 2 caracteres').max(60, 'Nombre demasiado largo').optional(),
  bio: z.string().max(500, 'Bio muy larga').optional().nullable(),
  gender: z.enum(['male', 'female', 'other']).optional().nullable(),
  birthDate: z.string().optional().nullable(),
  mood: z.string().max(50).optional().nullable(),
  emailNotifications: z.union([z.boolean(), z.string()]).optional().nullable(),
  emailChat: z.union([z.boolean(), z.string()]).optional().nullable(),
  emailFollows: z.union([z.boolean(), z.string()]).optional().nullable(),
  emailWashing: z.union([z.boolean(), z.string()]).optional().nullable(),
  emailChallenges: z.union([z.boolean(), z.string()]).optional().nullable(),
  cycleTracking: z.union([z.boolean(), z.string()]).optional().nullable(),
  musicSync: z.union([z.boolean(), z.string()]).optional().nullable(),
  themePreset: z.string().optional().nullable(),
  customColor: z.string().optional().nullable(),
  darkModeSetting: z.string().optional().nullable(),
  fontSize: z.string().optional().nullable(),
  highContrast: z.union([z.boolean(), z.string()]).optional().nullable(),
  isProfilePublic: z.union([z.boolean(), z.string()]).optional().nullable(),
  hideFromTrends: z.union([z.boolean(), z.string()]).optional().nullable(),
  locationName: z.string().max(120).optional().nullable(),
  hapticFeedback: z.union([z.boolean(), z.string()]).optional().nullable(),
}).passthrough();

export const conversationSchema = z.object({
  targetUserId: z.string().min(1, 'Usuario destino requerido'),
  otherUserId: z.string().optional(),
  itemId: z.string().optional(),
  itemTitle: z.string().max(200).optional(),
  itemImage: z.string().max(500).optional(),
  initialMessage: z.string().max(1000).optional(),
});

export const messageSchema = z.object({
  content: z.string().max(2000).optional(),
  imageUrl: z.string().max(300).optional(),
  productId: z.string().optional(),
  conversationId: z.string().min(1, 'Conversación ID requerida').optional(),
  otherUserId: z.string().optional(),
}).refine(data => data.content || data.imageUrl, {
  message: 'Debe proporcionar contenido o imagen',
});

export const resendVerificationSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email inválido'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).max(256),
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
        // Si multer ya guardó ficheros, se eliminan para no dejar basura en disco
        const anyReq = req as any;
        const files: any[] = [
          ...(anyReq.file ? [anyReq.file] : []),
          ...(Array.isArray(anyReq.files) ? anyReq.files : Object.values(anyReq.files || {}).flat()),
        ];
        files.forEach(f => f?.path && unlink(f.path, () => {}));
        return res.status(400).json({
          error: 'Error de validación',
          details: error.issues.map(e => ({
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
