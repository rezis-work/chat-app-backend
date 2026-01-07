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

const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

const resendVerificationSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(
      /[^a-zA-Z0-9]/,
      'Password must contain at least one special character'
    ),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

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

/**
 * Validation middleware for verify email endpoint
 */
export function validateVerifyEmail(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    req.body = verifyEmailSchema.parse(req.body);
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
 * Validation middleware for resend verification endpoint
 */
export function validateResendVerification(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    req.body = resendVerificationSchema.parse(req.body);
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
 * Validation middleware for forgot password endpoint
 */
export function validateForgotPassword(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    req.body = forgotPasswordSchema.parse(req.body);
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
 * Validation middleware for reset password endpoint
 */
export function validateResetPassword(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    req.body = resetPasswordSchema.parse(req.body);
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
