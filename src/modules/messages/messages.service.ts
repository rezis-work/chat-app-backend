import { prisma } from '../../db/prisma';
import { verifyChatMembership } from '../chats/chats.service';
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from '../../utils/errors';
import {
  createOrUpdateDmRequest,
  autoAcceptDmRequestOnReply,
} from '../dm/dm.service';
import { normalizeUserPair } from '../../utils/user-pairs';
import { canSendMessage } from '../../utils/message-permissions';
import type { MessageType } from '@prisma/client';

export interface MessageDTO {
  id: string;
  chatId: string;
  senderId: string;
  type: MessageType;
  content: string;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
}

export interface MessagesPage {
  messages: MessageDTO[];
  nextCursor?: string;
}

/**
 * Get messages with cursor pagination (oldest-first)
 */
export async function getMessages(
  userId: string,
  chatId: string,
  cursor?: string,
  limit: number = 30
): Promise<MessagesPage> {
  // Verify membership
  await verifyChatMembership(userId, chatId);

  // Build query
  const where: any = {
    chatId,
    deletedAt: null,
  };

  // If cursor provided, get messages after cursor
  if (cursor) {
    // Get cursor message to get its createdAt
    const cursorMessage = await prisma.message.findUnique({
      where: { id: cursor },
    });

    if (cursorMessage && cursorMessage.chatId === chatId) {
      where.createdAt = {
        gt: cursorMessage.createdAt,
      };
    }
  }

  // Fetch limit+1 to check if there are more messages
  const messages = await prisma.message.findMany({
    where,
    orderBy: {
      createdAt: 'asc', // Oldest first
    },
    take: limit + 1,
    include: {
      sender: {
        include: {
          settings: true,
        },
      },
    },
  });

  // Check if there are more messages
  const hasMore = messages.length > limit;
  const messagesToReturn = hasMore ? messages.slice(0, limit) : messages;

  // Determine next cursor
  const nextCursor = hasMore
    ? messagesToReturn[messagesToReturn.length - 1].id
    : undefined;

  return {
    messages: messagesToReturn.map(msg => ({
      id: msg.id,
      chatId: msg.chatId,
      senderId: msg.senderId,
      type: msg.type,
      content: msg.content,
      createdAt: msg.createdAt,
      editedAt: msg.editedAt,
      deletedAt: msg.deletedAt,
    })),
    nextCursor,
  };
}

/**
 * Send a message
 */
export async function sendMessage(
  userId: string,
  chatId: string,
  content: string
): Promise<MessageDTO> {
  // Validate content
  if (!content || content.trim().length === 0) {
    throw new ValidationError('Message content is required');
  }

  if (content.length > 5000) {
    throw new ValidationError('Message content too long (max 5000 characters)');
  }

  // Verify membership
  await verifyChatMembership(userId, chatId);

  // Get chat to check type
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: {
      dmChat: true,
    },
  });

  if (!chat) {
    throw new NotFoundError('Chat not found');
  }

  // If DM chat, handle DM request logic
  if (chat.type === 'DM' && chat.dmChat) {
    // Get other user ID
    const otherUserId =
      chat.dmChat.userAId === userId
        ? chat.dmChat.userBId
        : chat.dmChat.userAId;

    // Check message permission
    const permission = await canSendMessage(userId, otherUserId);

    if (!permission.allowed) {
      throw new ForbiddenError(permission.reason || 'Message not allowed');
    }

    // If requires DM request, create/update it
    if (permission.requiresDmRequest) {
      // Check if this is a reply (receiver sending back to original sender)
      // We need to check if there's an existing DM request where the other user initiated
      const { userAId, userBId } = normalizeUserPair(userId, otherUserId);
      const existingDmRequest = await prisma.dmRequest.findUnique({
        where: {
          userAId_userBId: {
            userAId,
            userBId,
          },
        },
      });

      if (
        existingDmRequest &&
        existingDmRequest.initiatedById === otherUserId &&
        existingDmRequest.status === 'PENDING'
      ) {
        // This is a reply - auto-accept
        await autoAcceptDmRequestOnReply(userId, otherUserId);
      } else {
        // Create or update DM request
        await createOrUpdateDmRequest(userId, otherUserId);
      }
    }
  }

  // Create message
  const message = await prisma.message.create({
    data: {
      chatId,
      senderId: userId,
      type: 'TEXT',
      content: content.trim(),
    },
    include: {
      sender: {
        include: {
          settings: true,
        },
      },
    },
  });

  // Update chat updatedAt
  await prisma.chat.update({
    where: { id: chatId },
    data: { updatedAt: new Date() },
  });

  return {
    id: message.id,
    chatId: message.chatId,
    senderId: message.senderId,
    type: message.type,
    content: message.content,
    createdAt: message.createdAt,
    editedAt: message.editedAt,
    deletedAt: message.deletedAt,
  };
}

/**
 * Edit a message
 */
export async function editMessage(
  userId: string,
  messageId: string,
  content: string
): Promise<MessageDTO> {
  // Validate content
  if (!content || content.trim().length === 0) {
    throw new ValidationError('Message content is required');
  }

  if (content.length > 5000) {
    throw new ValidationError('Message content too long (max 5000 characters)');
  }

  // Get message
  const message = await prisma.message.findUnique({
    where: { id: messageId },
  });

  if (!message) {
    throw new NotFoundError('Message not found');
  }

  // Verify sender is userId
  if (message.senderId !== userId) {
    throw new ForbiddenError('You can only edit your own messages');
  }

  // Verify not deleted
  if (message.deletedAt) {
    throw new ForbiddenError('Cannot edit deleted message');
  }

  // Update message
  const updatedMessage = await prisma.message.update({
    where: { id: messageId },
    data: {
      content: content.trim(),
      editedAt: new Date(),
    },
  });

  return {
    id: updatedMessage.id,
    chatId: updatedMessage.chatId,
    senderId: updatedMessage.senderId,
    type: updatedMessage.type,
    content: updatedMessage.content,
    createdAt: updatedMessage.createdAt,
    editedAt: updatedMessage.editedAt,
    deletedAt: updatedMessage.deletedAt,
  };
}

/**
 * Delete a message (soft delete)
 */
export async function deleteMessage(
  userId: string,
  messageId: string
): Promise<void> {
  // Get message
  const message = await prisma.message.findUnique({
    where: { id: messageId },
  });

  if (!message) {
    throw new NotFoundError('Message not found');
  }

  // Verify sender is userId
  if (message.senderId !== userId) {
    throw new ForbiddenError('You can only delete your own messages');
  }

  // Verify not already deleted
  if (message.deletedAt) {
    throw new ForbiddenError('Message already deleted');
  }

  // Soft delete
  await prisma.message.update({
    where: { id: messageId },
    data: {
      deletedAt: new Date(),
    },
  });
}

