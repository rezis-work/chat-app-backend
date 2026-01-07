import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../../utils/errors';

export const requestFriendshipSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

export const acceptFriendshipSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

export const declineFriendshipSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

export const removeFriendshipSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

export type RequestFriendshipInput = z.infer<typeof requestFriendshipSchema>;
export type AcceptFriendshipInput = z.infer<typeof acceptFriendshipSchema>;
export type DeclineFriendshipInput = z.infer<typeof declineFriendshipSchema>;
export type RemoveFriendshipInput = z.infer<typeof removeFriendshipSchema>;

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

export const validateRequestFriendship = createValidationMiddleware(
  requestFriendshipSchema
);
export const validateAcceptFriendship = createValidationMiddleware(
  acceptFriendshipSchema
);
export const validateDeclineFriendship = createValidationMiddleware(
  declineFriendshipSchema
);
export const validateRemoveFriendship = createValidationMiddleware(
  removeFriendshipSchema
);

