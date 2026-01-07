import { Response, NextFunction } from 'express';
import {
  getDmRequests,
  acceptDmRequest,
  declineDmRequest,
  blockViaDmRequest,
} from './dm.service';
import type { AuthRequest } from '../../middleware/auth';

/**
 * Get DM requests endpoint handler
 */
export async function getDmRequestsHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const requests = await getDmRequests(userId);

    res.json({
      ok: true,
      requests,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Accept DM request endpoint handler
 */
export async function acceptDmRequestHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { userId } = req.params;
    const currentUserId = req.user!.userId;

    const dmRequest = await acceptDmRequest(currentUserId, userId);

    res.json({
      ok: true,
      dmRequest: {
        id: dmRequest.id,
        status: dmRequest.status,
        updatedAt: dmRequest.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Decline DM request endpoint handler
 */
export async function declineDmRequestHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { userId } = req.params;
    const currentUserId = req.user!.userId;

    await declineDmRequest(currentUserId, userId);

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}

/**
 * Block via DM request endpoint handler
 */
export async function blockViaDmRequestHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { userId } = req.params;
    const currentUserId = req.user!.userId;

    await blockViaDmRequest(currentUserId, userId);

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}

