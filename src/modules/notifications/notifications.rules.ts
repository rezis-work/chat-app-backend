import { prisma } from '../../db/prisma';
import { isUserOnline, isUserInChatRoom } from '../../realtime/presence.service';

export interface NotificationContext {
  userId: string; // Receiver
  chatId?: string;
  messageId?: string;
  fromUserId?: string;
  type: 'MESSAGE' | 'DM_REQUEST' | 'FRIEND_REQUEST' | 'SYSTEM';
}

export interface NotificationDecision {
  shouldNotify: boolean;
  reason?: string;
}

/**
 * Evaluate notification rules for a message
 */
export async function shouldNotifyForMessage(
  context: NotificationContext
): Promise<NotificationDecision> {
  const { userId, chatId } = context;

  if (!chatId) {
    return { shouldNotify: false, reason: 'No chatId provided' };
  }

  // Check if chat is muted
  const chatMember = await prisma.chatMember.findUnique({
    where: {
      chatId_userId: {
        chatId,
        userId,
      },
    },
  });

  if (chatMember?.mutedUntil && chatMember.mutedUntil > new Date()) {
    return {
      shouldNotify: false,
      reason: 'Chat is muted',
    };
  }

  // Check if user is online and currently in chat
  const isOnline = await isUserOnline(userId);
  const isInChat = await isUserInChatRoom(userId, chatId);

  if (isOnline && isInChat) {
    // User is online and viewing the chat - optional: still notify softly
    // For v1, we'll still notify but could add a "soft" flag later
    return { shouldNotify: true, reason: 'User online but notify anyway' };
  }

  return { shouldNotify: true };
}

/**
 * Evaluate notification rules for DM request
 */
export async function shouldNotifyForDmRequest(
  _context: NotificationContext
): Promise<NotificationDecision> {
  // DM requests should always notify (strong notification)
  return { shouldNotify: true };
}

/**
 * Evaluate notification rules for friend request
 */
export async function shouldNotifyForFriendRequest(
  _context: NotificationContext
): Promise<NotificationDecision> {
  // Friend requests should always notify
  return { shouldNotify: true };
}

