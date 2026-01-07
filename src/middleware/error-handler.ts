import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

export interface AppError extends Error {
  statusCode?: number;
  status?: number;
}

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const error = err as AppError;
  const statusCode = error.statusCode || error.status || 500;
  const isDevelopment = env.NODE_ENV === 'development';

  // Log error details
  console.error('Error:', {
    message: error.message || 'Unknown error',
    stack: error.stack,
    statusCode,
    path: req.path,
    method: req.method,
  });

  // Never leak stack traces in production
  res.status(statusCode).json({
    error: {
      message: isDevelopment ? (error.message || 'Internal server error') : 'Internal server error',
      ...(isDevelopment && { stack: error.stack }),
    },
  });
};

