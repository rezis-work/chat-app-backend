import { prisma } from '../../db/prisma';
import { normalizeUserPair } from '../../utils/user-pairs';
import {
  ConflictError,
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from '../../utils/errors';
import { createNotification } from '../notifications/notifications.service';
import type { Friendship, FriendshipStatus } from '@prisma/client';

export interface Friend {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: string;
  createdAt: Date;
}

export interface FriendRequest {
  id: string;
  requesterId: string;
  requesterEmail: string;
  requesterDisplayName: string | null;
  requesterAvatarUrl: string | null;
  status: FriendshipStatus;
  createdAt: Date;
}

/**
 * Request a friendship with another user
 */
export async function requestFriendship(
  requesterId: string,
  addresseeId: string
): Promise<Friendship> {
  // Cannot friend yourself
  if (requesterId === addresseeId) {
    throw new ValidationError('Cannot send friend request to yourself');
  }

  // Normalize user pair
  const { userAId, userBId } = normalizeUserPair(requesterId, addresseeId);

  // Check if friendship already exists
  const existingFriendship = await prisma.friendship.findUnique({
    where: {
      userAId_userBId: {
        userAId,
        userBId,
      },
    },
  });

  if (existingFriendship) {
    if (existingFriendship.status === 'PENDING') {
      throw new ConflictError('Friend request already pending');
    }
    if (existingFriendship.status === 'ACCEPTED') {
      throw new ConflictError('Already friends');
    }
    if (existingFriendship.status === 'BLOCKED') {
      throw new ForbiddenError('Cannot send friend request');
    }
    // If DECLINED, allow new request
  }

  // Check if blocked
  const blockCheck = await prisma.userBlock.findFirst({
    where: {
      OR: [
        {
          blockerId: addresseeId,
          blockedId: requesterId,
        },
        {
          blockerId: requesterId,
          blockedId: addresseeId,
        },
      ],
    },
  });

  if (blockCheck) {
    throw new ForbiddenError('Cannot send friend request - user is blocked');
  }

  // Create new friendship request
  const friendship = await prisma.friendship.create({
    data: {
      userAId,
      userBId,
      requestedById: requesterId,
      status: 'PENDING',
    },
  });

  // Create notification for receiver
  const requester = await prisma.user.findUnique({
    where: { id: requesterId },
    include: { settings: true },
  });

  const requesterDisplayName =
    requester?.settings?.displayName || requester?.email;

  // Don't wait for notification (fire and forget)
  createNotification({
    userId: addresseeId,
    type: 'FRIEND_REQUEST',
    fromUserId: requesterId,
    title: 'New friend request',
    body: `${requesterDisplayName} wants to be your friend`,
    data: {
      friendshipId: friendship.id,
    },
  }).catch(error => {
    console.error('Error creating friend request notification:', error);
  });

  return friendship;
}

/**
 * Accept a friend request
 */
export async function acceptFriendship(
  userId: string,
  friendId: string
): Promise<Friendship> {
  const { userAId, userBId } = normalizeUserPair(userId, friendId);

  const friendship = await prisma.friendship.findUnique({
    where: {
      userAId_userBId: {
        userAId,
        userBId,
      },
    },
  });

  if (!friendship) {
    throw new NotFoundError('Friend request not found');
  }

  // Verify user is the addressee (not the requester)
  if (friendship.requestedById === userId) {
    throw new ForbiddenError('Cannot accept your own friend request');
  }

  // Verify status is PENDING
  if (friendship.status !== 'PENDING') {
    throw new ConflictError(
      `Friend request is already ${friendship.status.toLowerCase()}`
    );
  }

  // Update status to ACCEPTED
  const updatedFriendship = await prisma.friendship.update({
    where: {
      id: friendship.id,
    },
    data: {
      status: 'ACCEPTED',
    },
  });

  return updatedFriendship;
}

/**
 * Decline a friend request
 */
export async function declineFriendship(
  userId: string,
  friendId: string
): Promise<void> {
  const { userAId, userBId } = normalizeUserPair(userId, friendId);

  const friendship = await prisma.friendship.findUnique({
    where: {
      userAId_userBId: {
        userAId,
        userBId,
      },
    },
  });

  if (!friendship) {
    throw new NotFoundError('Friend request not found');
  }

  // Verify user is the addressee
  if (friendship.requestedById === userId) {
    throw new ForbiddenError('Cannot decline your own friend request');
  }

  // Update status to DECLINED
  await prisma.friendship.update({
    where: {
      id: friendship.id,
    },
    data: {
      status: 'DECLINED',
    },
  });
}

/**
 * Remove a friendship
 */
export async function removeFriendship(
  userId: string,
  friendId: string
): Promise<void> {
  const { userAId, userBId } = normalizeUserPair(userId, friendId);

  const friendship = await prisma.friendship.findUnique({
    where: {
      userAId_userBId: {
        userAId,
        userBId,
      },
    },
  });

  if (!friendship) {
    throw new NotFoundError('Friendship not found');
  }

  // Delete the friendship
  await prisma.friendship.delete({
    where: {
      id: friendship.id,
    },
  });
}

/**
 * Get all friends for a user (ACCEPTED friendships only)
 */
export async function getFriends(userId: string): Promise<Friend[]> {
  const friendships = await prisma.friendship.findMany({
    where: {
      AND: [
        {
          OR: [
            { userAId: userId },
            { userBId: userId },
          ],
        },
        { status: 'ACCEPTED' },
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
    },
  });

  const friends: Friend[] = friendships.map(friendship => {
    // Determine which user is the friend
    const friendUser =
      friendship.userAId === userId ? friendship.userB : friendship.userA;

    return {
      id: friendUser.id,
      email: friendUser.email,
      displayName: friendUser.settings?.displayName || null,
      avatarUrl: friendUser.settings?.avatarUrl || null,
      status: friendUser.status,
      createdAt: friendUser.createdAt,
    };
  });

  return friends;
}

/**
 * Get incoming friend requests (PENDING where user is addressee)
 */
export async function getFriendRequests(
  userId: string
): Promise<FriendRequest[]> {
  const friendships = await prisma.friendship.findMany({
    where: {
      AND: [
        {
          OR: [
            { userAId: userId },
            { userBId: userId },
          ],
        },
        { status: 'PENDING' },
        { requestedById: { not: userId } }, // User is not the requester
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
      requestedBy: {
        include: {
          settings: true,
        },
      },
    },
  });

  const requests: FriendRequest[] = friendships.map(friendship => {
    return {
      id: friendship.id,
      requesterId: friendship.requestedById,
      requesterEmail: friendship.requestedBy.email,
      requesterDisplayName: friendship.requestedBy.settings?.displayName || null,
      requesterAvatarUrl: friendship.requestedBy.settings?.avatarUrl || null,
      status: friendship.status,
      createdAt: friendship.createdAt,
    };
  });

  return requests;
}

