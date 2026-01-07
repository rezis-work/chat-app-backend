import { prisma } from '../../db/prisma';
import { normalizeUserPair } from '../../utils/user-pairs';
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '../../utils/errors';
import { validateMessagePermission } from '../../utils/message-permissions';
import { createNotification } from '../notifications/notifications.service';
import type { DmRequest, DmRequestStatus } from '@prisma/client';

export interface DmRequestInfo {
  id: string;
  senderId: string;
  senderEmail: string;
  senderDisplayName: string | null;
  senderAvatarUrl: string | null;
  status: DmRequestStatus;
  lastMessageAt: Date | null;
  createdAt: Date;
}

/**
 * Get incoming DM requests for a user (PENDING where user is receiver)
 */
export async function getDmRequests(userId: string): Promise<DmRequestInfo[]> {
  const dmRequests = await prisma.dmRequest.findMany({
    where: {
      AND: [
        {
          OR: [{ userAId: userId }, { userBId: userId }],
        },
        { status: 'PENDING' },
        { initiatedById: { not: userId } }, // User is not the initiator
      ],
    },
    include: {
      userA: {
        include: {
          settings: true,
        },
      },
      userB: {
        include: {
          settings: true,
        },
      },
      initiatedBy: {
        include: {
          settings: true,
        },
      },
    },
    orderBy: {
      lastMessageAt: 'desc',
    },
  });

  return dmRequests.map(request => {
    // Determine which user is the sender (initiator)
    const sender = request.initiatedBy;

    return {
      id: request.id,
      senderId: sender.id,
      senderEmail: sender.email,
      senderDisplayName: sender.settings?.displayName || null,
      senderAvatarUrl: sender.settings?.avatarUrl || null,
      status: request.status,
      lastMessageAt: request.lastMessageAt,
      createdAt: request.createdAt,
    };
  });
}

/**
 * Accept a DM request
 */
export async function acceptDmRequest(
  userId: string,
  senderId: string
): Promise<DmRequest> {
  const { userAId, userBId } = normalizeUserPair(userId, senderId);

  const dmRequest = await prisma.dmRequest.findUnique({
    where: {
      userAId_userBId: {
        userAId,
        userBId,
      },
    },
  });

  if (!dmRequest) {
    throw new NotFoundError('DM request not found');
  }

  // Verify user is the receiver (not the sender)
  if (dmRequest.initiatedById === userId) {
    throw new ForbiddenError('Cannot accept your own DM request');
  }

  // Verify status is PENDING
  if (dmRequest.status !== 'PENDING') {
    throw new ConflictError(
      `DM request is already ${dmRequest.status.toLowerCase()}`
    );
  }

  // Update status to ACCEPTED
  const updatedRequest = await prisma.dmRequest.update({
    where: {
      id: dmRequest.id,
    },
    data: {
      status: 'ACCEPTED',
    },
  });

  return updatedRequest;
}

/**
 * Decline a DM request
 */
export async function declineDmRequest(
  userId: string,
  senderId: string
): Promise<void> {
  const { userAId, userBId } = normalizeUserPair(userId, senderId);

  const dmRequest = await prisma.dmRequest.findUnique({
    where: {
      userAId_userBId: {
        userAId,
        userBId,
      },
    },
  });

  if (!dmRequest) {
    throw new NotFoundError('DM request not found');
  }

  // Verify user is the receiver
  if (dmRequest.initiatedById === userId) {
    throw new ForbiddenError('Cannot decline your own DM request');
  }

  // Update status to DECLINED
  await prisma.dmRequest.update({
    where: {
      id: dmRequest.id,
    },
    data: {
      status: 'DECLINED',
    },
  });
}

/**
 * Block a user via DM request
 */
export async function blockViaDmRequest(
  userId: string,
  senderId: string
): Promise<void> {
  const { userAId, userBId } = normalizeUserPair(userId, senderId);

  const dmRequest = await prisma.dmRequest.findUnique({
    where: {
      userAId_userBId: {
        userAId,
        userBId,
      },
    },
  });

  if (!dmRequest) {
    throw new NotFoundError('DM request not found');
  }

  // Verify user is the receiver
  if (dmRequest.initiatedById === userId) {
    throw new ForbiddenError('Cannot block yourself');
  }

  // Update DM request status to BLOCKED
  await prisma.dmRequest.update({
    where: {
      id: dmRequest.id,
    },
    data: {
      status: 'BLOCKED',
    },
  });

  // Create UserBlock record if it doesn't exist
  await prisma.userBlock.upsert({
    where: {
      blockerId_blockedId: {
        blockerId: userId,
        blockedId: senderId,
      },
    },
    create: {
      blockerId: userId,
      blockedId: senderId,
    },
    update: {}, // No update needed if exists
  });
}

/**
 * Create or update a DM request
 * Called by chat module when a message is sent
 */
export async function createOrUpdateDmRequest(
  senderId: string,
  receiverId: string
): Promise<DmRequest> {
  // Validate message permission first
  await validateMessagePermission(senderId, receiverId);

  const { userAId, userBId } = normalizeUserPair(senderId, receiverId);

  // Check if DM request already exists
  const existingRequest = await prisma.dmRequest.findUnique({
    where: {
      userAId_userBId: {
        userAId,
        userBId,
      },
    },
  });

  if (existingRequest) {
    // If already ACCEPTED, just update lastMessageAt
    if (existingRequest.status === 'ACCEPTED') {
      return await prisma.dmRequest.update({
        where: {
          id: existingRequest.id,
        },
        data: {
          lastMessageAt: new Date(),
        },
      });
    }

    // If PENDING or DECLINED, update lastMessageAt
    if (
      existingRequest.status === 'PENDING' ||
      existingRequest.status === 'DECLINED'
    ) {
      return await prisma.dmRequest.update({
        where: {
          id: existingRequest.id,
        },
        data: {
          lastMessageAt: new Date(),
          // Reset to PENDING if it was DECLINED
          status: existingRequest.status === 'DECLINED' ? 'PENDING' : 'PENDING',
        },
      });
    }

    // If BLOCKED, throw error
    if (existingRequest.status === 'BLOCKED') {
      throw new ForbiddenError('Cannot send message - user is blocked');
    }
  }

  // Create new DM request
  const dmRequest = await prisma.dmRequest.create({
    data: {
      userAId,
      userBId,
      initiatedById: senderId,
      status: 'PENDING',
      lastMessageAt: new Date(),
    },
  });

  // Create notification for receiver (if not already created by message flow)
  // Note: This notification will be created even if a message notification is also created
  // The message notification will have more context (messageId, chatId)
  // receiverId parameter is already the receiver, use it directly

  const sender = await prisma.user.findUnique({
    where: { id: senderId },
    include: { settings: true },
  });

  const senderDisplayName = sender?.settings?.displayName || sender?.email;

  // Don't wait for notification (fire and forget)
  createNotification({
    userId: receiverId,
    type: 'DM_REQUEST',
    fromUserId: senderId,
    title: 'New message request',
    body: `${senderDisplayName} wants to send you a message`,
    data: {
      dmRequestId: dmRequest.id,
    },
  }).catch(error => {
    console.error('Error creating DM request notification:', error);
  });

  return dmRequest;
}

/**
 * Auto-accept DM request when receiver replies
 * Called by chat module when receiver sends a message back
 */
export async function autoAcceptDmRequestOnReply(
  replierId: string,
  originalSenderId: string
): Promise<void> {
  const { userAId, userBId } = normalizeUserPair(replierId, originalSenderId);

  const dmRequest = await prisma.dmRequest.findUnique({
    where: {
      userAId_userBId: {
        userAId,
        userBId,
      },
    },
  });

  if (!dmRequest) {
    // No DM request exists, create one as ACCEPTED
    await prisma.dmRequest.create({
      data: {
        userAId,
        userBId,
        initiatedById: originalSenderId,
        status: 'ACCEPTED',
        lastMessageAt: new Date(),
      },
    });
    return;
  }

  // If PENDING and replier is the receiver, auto-accept
  if (
    dmRequest.status === 'PENDING' &&
    dmRequest.initiatedById !== replierId
  ) {
    await prisma.dmRequest.update({
      where: {
        id: dmRequest.id,
      },
      data: {
        status: 'ACCEPTED',
        lastMessageAt: new Date(),
      },
    });
  } else if (dmRequest.status === 'ACCEPTED') {
    // Already accepted, just update lastMessageAt
    await prisma.dmRequest.update({
      where: {
        id: dmRequest.id,
      },
      data: {
        lastMessageAt: new Date(),
      },
    });
  }
}

