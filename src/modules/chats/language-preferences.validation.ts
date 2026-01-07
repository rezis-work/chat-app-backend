import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../../utils/errors';

export const setLanguagePreferenceSchema = z.object({
  myLanguage: z.string().min(1, 'myLanguage is required'),
  viewLanguage: z.string().min(1, 'viewLanguage is required'),
});

export type SetLanguagePreferenceInput = z.infer<
  typeof setLanguagePreferenceSchema
>;

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

export const validateSetLanguagePreference = createValidationMiddleware(
  setLanguagePreferenceSchema
);

