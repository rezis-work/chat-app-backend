/**
 * Message permissions rules engine
 * Reusable by chat module to determine if messages can be sent
 */

import { prisma } from '../db/prisma';
import { normalizeUserPair } from './user-pairs';
import { ForbiddenError } from './errors';
import type { DmRequestStatus } from '@prisma/client';

export interface MessagePermissionResult {
  allowed: boolean;
  reason?: string;
  requiresDmRequest?: boolean;
}

/**
 * Check if user A can send a message to user B
 * Implements the core rules:
 * 1. If B blocked A → not allowed
 * 2. If A blocked B → not allowed
 * 3. If friendship is ACCEPTED → allowed (direct)
 * 4. Else → allowed but requires DM request (PENDING)
 *
 * @param senderId - User ID of the sender
 * @param receiverId - User ID of the receiver
 * @returns Permission result with allowed status and reason
 */
export async function canSendMessage(
  senderId: string,
  receiverId: string
): Promise<MessagePermissionResult> {
  // Check if receiver blocked sender
  const receiverBlockedSender = await prisma.userBlock.findUnique({
    where: {
      blockerId_blockedId: {
        blockerId: receiverId,
        blockedId: senderId,
      },
    },
  });

  if (receiverBlockedSender) {
    return {
      allowed: false,
      reason: 'You have been blocked by this user',
    };
  }

  // Check if sender blocked receiver
  const senderBlockedReceiver = await prisma.userBlock.findUnique({
    where: {
      blockerId_blockedId: {
        blockerId: senderId,
        blockedId: receiverId,
      },
    },
  });

  if (senderBlockedReceiver) {
    return {
      allowed: false,
      reason: 'You have blocked this user',
    };
  }

  // Check if friendship is ACCEPTED
  const { userAId, userBId } = normalizeUserPair(senderId, receiverId);
  const friendship = await prisma.friendship.findUnique({
    where: {
      userAId_userBId: {
        userAId,
        userBId,
      },
    },
  });

  if (friendship && friendship.status === 'ACCEPTED') {
    return {
      allowed: true,
      requiresDmRequest: false,
    };
  }

  // Not friends, but not blocked - allowed but requires DM request
  return {
    allowed: true,
    requiresDmRequest: true,
  };
}

/**
 * Get the current DM request status between two users
 *
 * @param senderId - User ID of the sender
 * @param receiverId - User ID of the receiver
 * @returns Current DM request status or null if no request exists
 */
export async function getDmRequestStatus(
  senderId: string,
  receiverId: string
): Promise<DmRequestStatus | null> {
  const { userAId, userBId } = normalizeUserPair(senderId, receiverId);

  const dmRequest = await prisma.dmRequest.findUnique({
    where: {
      userAId_userBId: {
        userAId,
        userBId,
      },
    },
  });

  return dmRequest?.status || null;
}

/**
 * Check if a DM request should be created/updated
 * Returns true if message is allowed but requires DM request
 *
 * @param senderId - User ID of the sender
 * @param receiverId - User ID of the receiver
 * @returns True if DM request is needed
 */
export async function shouldCreateDmRequest(
  senderId: string,
  receiverId: string
): Promise<boolean> {
  const permission = await canSendMessage(senderId, receiverId);
  return permission.allowed && permission.requiresDmRequest === true;
}

/**
 * Validate message permission and throw error if not allowed
 * Convenience function for services that need to enforce permissions
 *
 * @param senderId - User ID of the sender
 * @param receiverId - User ID of the receiver
 * @throws ForbiddenError if message is not allowed
 */
export async function validateMessagePermission(
  senderId: string,
  receiverId: string
): Promise<void> {
  const permission = await canSendMessage(senderId, receiverId);
  if (!permission.allowed) {
    throw new ForbiddenError(permission.reason || 'Message not allowed');
  }
}

