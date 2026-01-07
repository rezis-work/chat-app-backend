import { CookieOptions } from 'express';
import { env } from './env';

/**
 * Get cookie options for refresh token
 * httpOnly prevents XSS attacks
 * secure ensures HTTPS-only in production
 * sameSite prevents CSRF attacks
 */
export function getRefreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/auth/refresh',
    maxAge: env.REFRESH_TOKEN_TTL,
  };
}

/**
 * Get cookie options for clearing refresh token
 */
export function getClearCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/auth/refresh',
    maxAge: 0,
  };
}
