import { prisma } from '../../db/prisma';
import {
  hashPassword,
  verifyPassword,
  hashToken,
  generateRandomToken,
} from '../../utils/crypto';
import { signAccessToken } from '../../utils/jwt';
import { env } from '../../config/env';
import {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
} from '../../utils/errors';
import type { RegisterInput, LoginInput } from './auth.validation';

export interface SafeUser {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  settings: {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
    locale: string;
    timezone: string | null;
  } | null;
}

/**
 * Register a new user
 * Creates user, user settings, and email verification token
 */
export async function registerUser(
  data: RegisterInput
): Promise<{ user: SafeUser; verificationToken?: string }> {
  // Check if email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existingUser) {
    throw new ConflictError('Email already exists');
  }

  // Hash password
  const passwordHash = await hashPassword(data.password);

  // Generate verification token
  const verificationToken = generateRandomToken();
  const verificationTokenHash = hashToken(verificationToken);

  // Calculate expiration (24 hours)
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  // Create user, settings, and verification token in transaction
  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash,
      status: 'ACTIVE',
      settings: {
        create: {
          displayName: data.displayName || null,
          locale: 'en',
        },
      },
      emailVerificationTokens: {
        create: {
          tokenHash: verificationTokenHash,
          expiresAt,
        },
      },
    },
    include: {
      settings: true,
    },
  });

  // Return safe user (no passwordHash)
  const safeUser: SafeUser = {
    id: user.id,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    settings: user.settings
      ? {
          id: user.settings.id,
          displayName: user.settings.displayName,
          avatarUrl: user.settings.avatarUrl,
          locale: user.settings.locale,
          timezone: user.settings.timezone,
        }
      : null,
  };

  // Return verification token only in test environment
  if (env.NODE_ENV === 'test') {
    return { user: safeUser, verificationToken };
  }

  return { user: safeUser };
}

/**
 * Login user
 * Verifies password and creates session with refresh token
 */
export async function loginUser(
  data: LoginInput,
  userAgent?: string,
  ip?: string
): Promise<{ user: SafeUser; accessToken: string; refreshToken: string }> {
  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email: data.email },
    include: { settings: true },
  });

  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  // Check if user is active
  if (user.status !== 'ACTIVE') {
    throw new UnauthorizedError('Account is disabled');
  }

  // Verify password
  const isValidPassword = await verifyPassword(
    user.passwordHash,
    data.password
  );
  if (!isValidPassword) {
    throw new UnauthorizedError('Invalid email or password');
  }

  // Generate refresh token
  const refreshToken = generateRandomToken();
  const refreshTokenHash = hashToken(refreshToken);

  // Calculate expiration
  const expiresAt = new Date();
  expiresAt.setTime(expiresAt.getTime() + env.REFRESH_TOKEN_TTL);

  // Create session
  await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash,
      status: 'ACTIVE',
      userAgent: userAgent || null,
      ip: ip || null,
      expiresAt,
    },
  });

  // Generate access token
  const accessToken = signAccessToken(user.id);

  // Return safe user
  const safeUser: SafeUser = {
    id: user.id,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    settings: user.settings
      ? {
          id: user.settings.id,
          displayName: user.settings.displayName,
          avatarUrl: user.settings.avatarUrl,
          locale: user.settings.locale,
          timezone: user.settings.timezone,
        }
      : null,
  };

  return {
    user: safeUser,
    accessToken,
    refreshToken,
  };
}

/**
 * Refresh access token
 * Rotates refresh token (invalidates old one)
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const refreshTokenHash = hashToken(refreshToken);

  // Find session by refresh token hash
  const session = await prisma.session.findFirst({
    where: {
      refreshTokenHash,
      status: 'ACTIVE',
    },
    include: {
      user: true,
    },
  });

  if (!session) {
    throw new UnauthorizedError('Invalid refresh token');
  }

  // Check if session is expired
  if (session.expiresAt < new Date()) {
    // Mark session as revoked
    await prisma.session.update({
      where: { id: session.id },
      data: { status: 'REVOKED' },
    });
    throw new UnauthorizedError('Refresh token expired');
  }

  // Check if user is still active
  if (session.user.status !== 'ACTIVE') {
    await prisma.session.update({
      where: { id: session.id },
      data: { status: 'REVOKED' },
    });
    throw new UnauthorizedError('Account is disabled');
  }

  // Generate new refresh token (rotation)
  const newRefreshToken = generateRandomToken();
  const newRefreshTokenHash = hashToken(newRefreshToken);

  // Calculate new expiration
  const expiresAt = new Date();
  expiresAt.setTime(expiresAt.getTime() + env.REFRESH_TOKEN_TTL);

  // Update session with new refresh token hash
  await prisma.session.update({
    where: { id: session.id },
    data: {
      refreshTokenHash: newRefreshTokenHash,
      expiresAt,
    },
  });

  // Generate new access token
  const accessToken = signAccessToken(session.userId);

  return {
    accessToken,
    refreshToken: newRefreshToken,
  };
}

/**
 * Logout user
 * Revokes/deletes session
 */
export async function logoutUser(refreshToken: string): Promise<void> {
  const refreshTokenHash = hashToken(refreshToken);

  // Find and delete session
  await prisma.session.deleteMany({
    where: {
      refreshTokenHash,
      status: 'ACTIVE',
    },
  });
}

/**
 * Get user by ID
 * Returns safe user with settings
 */
export async function getUserById(userId: string): Promise<SafeUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { settings: true },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return {
    id: user.id,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    settings: user.settings
      ? {
          id: user.settings.id,
          displayName: user.settings.displayName,
          avatarUrl: user.settings.avatarUrl,
          locale: user.settings.locale,
          timezone: user.settings.timezone,
        }
      : null,
  };
}
