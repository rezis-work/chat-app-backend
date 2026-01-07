import { Response, NextFunction } from 'express';
import {
  requestFriendship,
  acceptFriendship,
  declineFriendship,
  removeFriendship,
  getFriends,
  getFriendRequests,
} from './friends.service';
import type {
  RequestFriendshipInput,
  AcceptFriendshipInput,
  DeclineFriendshipInput,
  RemoveFriendshipInput,
} from './friends.validation';
import type { AuthRequest } from '../../middleware/auth';

/**
 * Request friendship endpoint handler
 */
export async function requestFriendshipHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { userId } = req.body as RequestFriendshipInput;
    const requesterId = req.user!.userId;

    const friendship = await requestFriendship(requesterId, userId);

    res.status(201).json({
      ok: true,
      friendship: {
        id: friendship.id,
        status: friendship.status,
        createdAt: friendship.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Accept friendship endpoint handler
 */
export async function acceptFriendshipHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { userId } = req.body as AcceptFriendshipInput;
    const currentUserId = req.user!.userId;

    const friendship = await acceptFriendship(currentUserId, userId);

    res.json({
      ok: true,
      friendship: {
        id: friendship.id,
        status: friendship.status,
        updatedAt: friendship.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Decline friendship endpoint handler
 */
export async function declineFriendshipHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { userId } = req.body as DeclineFriendshipInput;
    const currentUserId = req.user!.userId;

    await declineFriendship(currentUserId, userId);

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}

/**
 * Remove friendship endpoint handler
 */
export async function removeFriendshipHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { userId } = req.body as RemoveFriendshipInput;
    const currentUserId = req.user!.userId;

    await removeFriendship(currentUserId, userId);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

/**
 * Get friends list endpoint handler
 */
export async function getFriendsHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const friends = await getFriends(userId);

    res.json({
      ok: true,
      friends,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get friend requests endpoint handler
 */
export async function getFriendRequestsHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const requests = await getFriendRequests(userId);

    res.json({
      ok: true,
      requests,
    });
  } catch (error) {
    next(error);
  }
}

