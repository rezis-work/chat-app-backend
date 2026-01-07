import { AppError } from '../middleware/error-handler';

export class ValidationError extends Error implements AppError {
  statusCode = 400;
  status = 400;

  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends Error implements AppError {
  statusCode = 401;
  status = 401;

  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ConflictError extends Error implements AppError {
  statusCode = 409;
  status = 409;

  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class NotFoundError extends Error implements AppError {
  statusCode = 404;
  status = 404;

  constructor(message: string = 'Not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ForbiddenError extends Error implements AppError {
  statusCode = 403;
  status = 403;

  constructor(message: string = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}
