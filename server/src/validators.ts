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
  season: z.enum(['summer', 'winter', 'all', 'transition']).optional(),
  brand: z.string().optional(),
  size: z.string().optional(),
  price: z.union([z.number(), z.string()]).optional(),
  forSale: z.union([z.boolean(), z.string()]).optional(),
  isWashing: z.union([z.boolean(), z.string()]).optional(),
  description: z.string().optional(),
  condition: z.string().optional(),
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

export const validate = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
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
  return {
    ...body,
    price: body.price ? parseFloat(body.price) : null,
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
