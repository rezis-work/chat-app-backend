import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../../utils/errors';

export const blockUserSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

export type BlockUserInput = z.infer<typeof blockUserSchema>;

export const validateBlockUser = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    req.body = blockUserSchema.parse(req.body);
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
};

