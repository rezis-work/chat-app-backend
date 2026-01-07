import { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../middleware/auth';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationCount,
} from './notifications.service';

export async function getNotificationsHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const cursor = req.query.cursor as string | undefined;
    const limit = parseInt((req.query.limit as string) || '30', 10);

    const result = await getNotifications(userId, cursor, limit);

    res.json({
      ok: true,
      notifications: result.notifications,
      nextCursor: result.nextCursor,
    });
  } catch (error) {
    next(error);
  }
}

export async function markNotificationReadHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const notificationId = req.params.id;

    await markNotificationAsRead(userId, notificationId);

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}

export async function markAllNotificationsReadHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;

    await markAllNotificationsAsRead(userId);

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}

export async function getUnreadCountHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;

    const count = await getUnreadNotificationCount(userId);

    res.json({
      ok: true,
      count,
    });
  } catch (error) {
    next(error);
  }
}

