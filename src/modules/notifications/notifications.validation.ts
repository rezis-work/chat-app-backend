import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../../utils/errors';

export const getNotificationsSchema = z.object({
  query: z.object({
    cursor: z.string().optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).default('30'),
  }),
});

export const markNotificationReadSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
});

// Generic validation middleware factory
const createValidationMiddleware = (schema: z.ZodObject<any>) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse({
        query: req.query,
        params: req.params,
        body: req.body,
      });
      // Merge parsed values back into req
      if (parsed.query) req.query = parsed.query as any;
      if (parsed.params) req.params = parsed.params as any;
      if (parsed.body) req.body = parsed.body;
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

export const validateGetNotifications = createValidationMiddleware(
  getNotificationsSchema
);
export const validateMarkNotificationRead = createValidationMiddleware(
  markNotificationReadSchema
);

