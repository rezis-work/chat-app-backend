import { Response, NextFunction } from 'express';
import { blockUser, unblockUser, getBlockedUsers } from './blocks.service';
import type { BlockUserInput } from './blocks.validation';
import type { AuthRequest } from '../../middleware/auth';

/**
 * Block user endpoint handler
 */
export async function blockUserHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { userId } = req.body as BlockUserInput;
    const blockerId = req.user!.userId;

    const userBlock = await blockUser(blockerId, userId);

    res.status(201).json({
      ok: true,
      block: {
        id: userBlock.id,
        blockedId: userBlock.blockedId,
        createdAt: userBlock.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Unblock user endpoint handler
 */
export async function unblockUserHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { userId } = req.params;
    const blockerId = req.user!.userId;

    await unblockUser(blockerId, userId);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

/**
 * Get blocked users endpoint handler
 */
export async function getBlockedUsersHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const blockedUsers = await getBlockedUsers(userId);

    res.json({
      ok: true,
      blockedUsers,
    });
  } catch (error) {
    next(error);
  }
}

