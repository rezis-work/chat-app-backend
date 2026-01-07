import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../../utils/errors';

export const sendMessageSchema = z.object({
  content: z
    .string()
    .min(1, 'Message content is required')
    .max(5000, 'Message content too long (max 5000 characters)'),
});

export const editMessageSchema = z.object({
  content: z
    .string()
    .min(1, 'Message content is required')
    .max(5000, 'Message content too long (max 5000 characters)'),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type EditMessageInput = z.infer<typeof editMessageSchema>;

// Generic validation middleware factory
const createValidationMiddleware = (schema: z.ZodObject<any>) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
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
};

export const validateSendMessage = createValidationMiddleware(sendMessageSchema);
export const validateEditMessage = createValidationMiddleware(editMessageSchema);

