import crypto from 'crypto';
import argon2 from 'argon2';

/**
 * Hash a token using SHA-256
 * Tokens are hashed before storage in the database
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Hash a password using Argon2
 * Argon2 is resistant to timing attacks and GPU cracking
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  hash: string,
  password: string
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/**
 * Generate a random token (32+ bytes)
 * Used for refresh tokens and verification tokens
 */
export function generateRandomToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
