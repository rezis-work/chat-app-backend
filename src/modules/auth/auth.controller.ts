import { Request, Response, NextFunction } from 'express';
import {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  getUserById,
} from './auth.service';
import {
  getRefreshCookieOptions,
  getClearCookieOptions,
} from '../../config/cookies';
import type { RegisterInput, LoginInput } from './auth.validation';
import type { AuthRequest } from '../../middleware/auth';

/**
 * Register endpoint handler
 */
export async function register(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data = req.body as RegisterInput;
    const result = await registerUser(data);

    res.status(201).json({
      user: result.user,
      ...(result.verificationToken && {
        verificationToken: result.verificationToken,
      }),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Login endpoint handler
 */
export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data = req.body as LoginInput;
    const userAgent = req.get('user-agent');
    const ip = req.ip || req.socket.remoteAddress;

    const { user, accessToken, refreshToken } = await loginUser(
      data,
      userAgent,
      ip
    );

    // Set refresh token cookie
    res.cookie('refreshToken', refreshToken, getRefreshCookieOptions());

    res.json({
      user,
      accessToken,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Refresh token endpoint handler
 */
export async function refresh(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      res.status(401).json({ error: { message: 'Refresh token required' } });
      return;
    }

    const { accessToken, refreshToken: newRefreshToken } =
      await refreshAccessToken(refreshToken);

    // Set new refresh token cookie
    res.cookie('refreshToken', newRefreshToken, getRefreshCookieOptions());

    res.json({
      accessToken,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Logout endpoint handler
 */
export async function logout(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (refreshToken) {
      await logoutUser(refreshToken);
    }

    // Clear refresh token cookie
    res.cookie('refreshToken', '', getClearCookieOptions());

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

/**
 * Get current user endpoint handler
 */
export async function getMe(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.userId;

    if (!userId) {
      res.status(401).json({ error: { message: 'Unauthorized' } });
      return;
    }

    const user = await getUserById(userId);

    res.json({ user });
  } catch (error) {
    next(error);
  }
}
