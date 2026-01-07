import { prisma } from '../../db/prisma';
import { NotificationType } from '@prisma/client';
import {
  shouldNotifyForMessage,
  shouldNotifyForDmRequest,
  shouldNotifyForFriendRequest,
  NotificationContext,
} from './notifications.rules';
import { emitNotificationEvent } from '../../realtime/notification-events';
import { NotFoundError, ForbiddenError } from '../../utils/errors';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  chatId?: string;
  messageId?: string;
  fromUserId?: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

/**
 * Create a notification after evaluating rules
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<void> {
  const context: NotificationContext = {
    userId: input.userId,
    chatId: input.chatId,
    messageId: input.messageId,
    fromUserId: input.fromUserId,
    type: input.type,
  };

  // Evaluate rules based on type
  let decision;
  if (input.type === 'MESSAGE') {
    decision = await shouldNotifyForMessage(context);
  } else if (input.type === 'DM_REQUEST') {
    decision = await shouldNotifyForDmRequest(context);
  } else if (input.type === 'FRIEND_REQUEST') {
    decision = await shouldNotifyForFriendRequest(context);
  } else {
    // SYSTEM notifications always notify
    decision = { shouldNotify: true };
  }

  if (!decision.shouldNotify) {
    return; // Skip notification
  }

  // Create notification
  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      chatId: input.chatId,
      messageId: input.messageId,
      fromUserId: input.fromUserId,
      title: input.title,
      body: input.body,
      data: input.data || {},
    },
    include: {
      fromUser: {
        include: {
          settings: true,
        },
      },
      chat: true,
      message: true,
    },
  });

  // Emit socket event to user's personal room
  await emitNotificationEvent(input.userId, notification);
}

/**
 * Get notifications for a user (cursor pagination)
 */
export async function getNotifications(
  userId: string,
  cursor?: string,
  limit: number = 30
): Promise<{
  notifications: any[];
  nextCursor?: string;
}> {
  const where: any = {
    userId,
  };

  if (cursor) {
    const cursorNotification = await prisma.notification.findUnique({
      where: { id: cursor },
    });
    if (cursorNotification && cursorNotification.userId === userId) {
      where.createdAt = {
        lt: cursorNotification.createdAt,
      };
    }
  }

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: {
      createdAt: 'desc', // Newest first
    },
    take: limit + 1,
    include: {
      fromUser: {
        include: {
          settings: true,
        },
      },
      chat: true,
      message: true,
    },
  });

  const hasMore = notifications.length > limit;
  const notificationsToReturn = hasMore
    ? notifications.slice(0, limit)
    : notifications;

  const nextCursor = hasMore
    ? notificationsToReturn[notificationsToReturn.length - 1].id
    : undefined;

  return {
    notifications: notificationsToReturn,
    nextCursor,
  };
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(
  userId: string,
  notificationId: string
): Promise<void> {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new NotFoundError('Notification not found');
  }

  if (notification.userId !== userId) {
    throw new ForbiddenError('Cannot mark notification as read');
  }

  await prisma.notification.update({
    where: { id: notificationId },
    data: {
      readAt: new Date(),
    },
  });
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(
  userId: string
): Promise<void> {
  await prisma.notification.updateMany({
    where: {
      userId,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });
}

/**
 * Get unread notification count
 */
export async function getUnreadNotificationCount(
  userId: string
): Promise<number> {
  return await prisma.notification.count({
    where: {
      userId,
      readAt: null,
    },
  });
}

