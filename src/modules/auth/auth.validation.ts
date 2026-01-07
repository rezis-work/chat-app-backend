import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../../utils/errors';

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Validation middleware for register endpoint
 */
export function validateRegister(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    req.body = registerSchema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(
        new ValidationError(error.errors[0]?.message || 'Validation failed')
      );
    } else {
      next(error);
    }
  }
}

/**
 * Validation middleware for login endpoint
 */
export function validateLogin(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    req.body = loginSchema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(
        new ValidationError(error.errors[0]?.message || 'Validation failed')
      );
    } else {
      next(error);
    }
  }
}
