import { prisma } from '../../db/prisma';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../utils/errors';
import { normalizeUserPair } from '../../utils/user-pairs';
import type { UserBlock } from '@prisma/client';

export interface BlockedUser {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  blockedAt: Date;
}

/**
 * Block a user
 */
export async function blockUser(
  blockerId: string,
  blockedId: string
): Promise<UserBlock> {
  // Cannot block yourself
  if (blockerId === blockedId) {
    throw new ValidationError('Cannot block yourself');
  }

  // Check if already blocked
  const existingBlock = await prisma.userBlock.findUnique({
    where: {
      blockerId_blockedId: {
        blockerId,
        blockedId,
      },
    },
  });

  if (existingBlock) {
    throw new ConflictError('User is already blocked');
  }

  // Create block record
  const userBlock = await prisma.userBlock.create({
    data: {
      blockerId,
      blockedId,
    },
  });

  // Optionally decline/delete any pending friend requests
  // Decline any pending friendships
  const { userAId, userBId } = normalizeUserPair(blockerId, blockedId);

  await prisma.friendship.updateMany({
    where: {
      userAId,
      userBId,
      status: 'PENDING',
    },
    data: {
      status: 'DECLINED',
    },
  });

  return userBlock;
}

/**
 * Unblock a user
 */
export async function unblockUser(
  blockerId: string,
  blockedId: string
): Promise<void> {
  const block = await prisma.userBlock.findUnique({
    where: {
      blockerId_blockedId: {
        blockerId,
        blockedId,
      },
    },
  });

  if (!block) {
    throw new NotFoundError('User is not blocked');
  }

  await prisma.userBlock.delete({
    where: {
      id: block.id,
    },
  });
}

/**
 * Get all users blocked by a user
 */
export async function getBlockedUsers(userId: string): Promise<BlockedUser[]> {
  const blocks = await prisma.userBlock.findMany({
    where: {
      blockerId: userId,
    },
    include: {
      blocked: {
        include: {
          settings: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return blocks.map(block => ({
    id: block.blocked.id,
    email: block.blocked.email,
    displayName: block.blocked.settings?.displayName || null,
    avatarUrl: block.blocked.settings?.avatarUrl || null,
    blockedAt: block.createdAt,
  }));
}

