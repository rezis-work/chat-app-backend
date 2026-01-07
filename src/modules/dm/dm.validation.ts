import { Request, Response, NextFunction } from 'express';

// No body validation needed for DM request endpoints
// userId comes from URL params

export const validateAcceptDmRequest = (
  _req: Request,
  _res: Response,
  next: NextFunction
): void => {
  // Validate userId param exists (handled by Express route)
  next();
};

export const validateDeclineDmRequest = (
  _req: Request,
  _res: Response,
  next: NextFunction
): void => {
  next();
};

export const validateBlockDmRequest = (
  _req: Request,
  _res: Response,
  next: NextFunction
): void => {
  next();
};

