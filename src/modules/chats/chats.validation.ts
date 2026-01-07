import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../../utils/errors';

export const createDmChatSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

export const createGroupChatSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title too long'),
  memberIds: z.array(z.string().min(1)).min(1, 'At least one member is required'),
});

export const markChatAsReadSchema = z.object({
  lastReadMessageId: z.string().min(1, 'Message ID is required'),
});

export type CreateDmChatInput = z.infer<typeof createDmChatSchema>;
export type CreateGroupChatInput = z.infer<typeof createGroupChatSchema>;
export type MarkChatAsReadInput = z.infer<typeof markChatAsReadSchema>;

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

export const validateCreateDmChat = createValidationMiddleware(
  createDmChatSchema
);
export const validateCreateGroupChat = createValidationMiddleware(
  createGroupChatSchema
);
export const validateMarkChatAsRead = createValidationMiddleware(
  markChatAsReadSchema
);

