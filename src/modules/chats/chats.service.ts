import { prisma } from '../../db/prisma';
import { normalizeUserPair } from '../../utils/user-pairs';
import { validateMessagePermission } from '../../utils/message-permissions';
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from '../../utils/errors';
import type { Chat, ChatMember, ChatType, MemberRole } from '@prisma/client';

export interface ChatWithMembers {
  chat: Chat;
  members: ChatMember[];
}

export interface InboxChat {
  id: string;
  type: ChatType;
  title: string | null;
  otherMembers: Array<{
    id: string;
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
  }>;
  lastMessage: {
    id: string;
    content: string;
    createdAt: Date;
    senderId: string;
  } | null;
  unreadCount: number;
  updatedAt: Date;
}

export interface ChatDetails {
  id: string;
  type: ChatType;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
  members: Array<{
    id: string;
    userId: string;
    userEmail: string;
    userDisplayName: string | null;
    userAvatarUrl: string | null;
    role: MemberRole;
    joinedAt: Date;
  }>;
}

/**
 * Create or get existing DM chat
 */
export async function createOrGetDmChat(
  userId: string,
  otherUserId: string
): Promise<ChatWithMembers> {
  // Cannot create DM with yourself
  if (userId === otherUserId) {
    throw new ValidationError('Cannot create DM chat with yourself');
  }

  // Check rules engine (blocked check)
  await validateMessagePermission(userId, otherUserId);

  // Normalize user pair
  const { userAId, userBId } = normalizeUserPair(userId, otherUserId);

  // Check if DmChat already exists
  const existingDmChat = await prisma.dmChat.findUnique({
    where: {
      userAId_userBId: {
        userAId,
        userBId,
      },
    },
    include: {
      chat: {
        include: {
          members: {
            include: {
              user: {
                include: {
                  settings: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (existingDmChat) {
    return {
      chat: existingDmChat.chat,
      members: existingDmChat.chat.members,
    };
  }

  // Create new DM chat
  const chat = await prisma.chat.create({
    data: {
      type: 'DM',
      title: null,
      createdById: userId,
      members: {
        create: [
          {
            userId: userAId,
            role: 'MEMBER',
          },
          {
            userId: userBId,
            role: 'MEMBER',
          },
        ],
      },
      dmChat: {
        create: {
          userAId,
          userBId,
        },
      },
    },
    include: {
      members: {
        include: {
          user: {
            include: {
              settings: true,
            },
          },
        },
      },
    },
  });

  return {
    chat,
    members: chat.members,
  };
}

/**
 * Create a group chat
 */
export async function createGroupChat(
  creatorId: string,
  title: string,
  memberIds: string[]
): Promise<ChatWithMembers> {
  // Validate title
  if (!title || title.trim().length === 0) {
    throw new ValidationError('Group chat title is required');
  }

  // Validate memberIds
  if (!memberIds || memberIds.length === 0) {
    throw new ValidationError('At least one member is required');
  }

  // Remove duplicates and creator from memberIds
  const uniqueMemberIds = Array.from(new Set(memberIds)).filter(
    id => id !== creatorId
  );

  // Create group chat with creator as OWNER and members as MEMBER
  const chat = await prisma.chat.create({
    data: {
      type: 'GROUP',
      title: title.trim(),
      createdById: creatorId,
      members: {
        create: [
          {
            userId: creatorId,
            role: 'OWNER',
          },
          ...uniqueMemberIds.map(memberId => ({
            userId: memberId,
            role: 'MEMBER' as MemberRole,
          })),
        ],
      },
    },
    include: {
      members: {
        include: {
          user: {
            include: {
              settings: true,
            },
          },
        },
      },
    },
  });

  return {
    chat,
    members: chat.members,
  };
}

/**
 * Calculate unread count for a chat
 */
export async function calculateUnreadCount(
  chatId: string,
  lastReadMessageId: string | null
): Promise<number> {
  if (!lastReadMessageId) {
    // Count all messages if never read
    return await prisma.message.count({
      where: {
        chatId,
        deletedAt: null,
      },
    });
  }

  // Get the last read message to get its createdAt
  const lastReadMessage = await prisma.message.findUnique({
    where: {
      id: lastReadMessageId,
    },
  });

  if (!lastReadMessage) {
    // If message doesn't exist, count all messages
    return await prisma.message.count({
      where: {
        chatId,
        deletedAt: null,
      },
    });
  }

  // Count messages created after the last read message
  const unreadCount = await prisma.message.count({
    where: {
      chatId,
      createdAt: {
        gt: lastReadMessage.createdAt,
      },
      deletedAt: null,
    },
  });

  return unreadCount;
}

/**
 * Get inbox (list of chats for a user)
 */
export async function getInbox(userId: string): Promise<InboxChat[]> {
  // Get all chats where user is a member
  const chatMembers = await prisma.chatMember.findMany({
    where: {
      userId,
    },
    include: {
      chat: {
        include: {
          members: {
            include: {
              user: {
                include: {
                  settings: true,
                },
              },
            },
          },
          messages: {
            where: {
              deletedAt: null,
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
            include: {
              sender: {
                include: {
                  settings: true,
                },
              },
            },
          },
          dmChat: true,
        },
      },
    },
    orderBy: {
      chat: {
        updatedAt: 'desc',
      },
    },
  });

  const inboxChats: InboxChat[] = await Promise.all(
    chatMembers.map(async member => {
      const chat = member.chat;
      const lastMessage = chat.messages[0] || null;

      // Get other members (for DM preview or group members)
      const otherMembers = chat.members
        .filter(m => m.userId !== userId)
        .map(m => ({
          id: m.user.id,
          email: m.user.email,
          displayName: m.user.settings?.displayName || null,
          avatarUrl: m.user.settings?.avatarUrl || null,
        }));

      // Calculate unread count
      const unreadCount = await calculateUnreadCount(
        chat.id,
        member.lastReadMessageId
      );

      return {
        id: chat.id,
        type: chat.type,
        title: chat.title,
        otherMembers,
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              content: lastMessage.content,
              createdAt: lastMessage.createdAt,
              senderId: lastMessage.senderId,
            }
          : null,
        unreadCount,
        updatedAt: chat.updatedAt,
      };
    })
  );

  return inboxChats;
}

/**
 * Get chat details
 */
export async function getChatDetails(
  userId: string,
  chatId: string
): Promise<ChatDetails> {
  // Verify membership
  const member = await prisma.chatMember.findUnique({
    where: {
      chatId_userId: {
        chatId,
        userId,
      },
    },
  });

  if (!member) {
    throw new ForbiddenError('You are not a member of this chat');
  }

  // Get chat with all members
  const chat = await prisma.chat.findUnique({
    where: {
      id: chatId,
    },
    include: {
      members: {
        include: {
          user: {
            include: {
              settings: true,
            },
          },
        },
      },
    },
  });

  if (!chat) {
    throw new NotFoundError('Chat not found');
  }

  return {
    id: chat.id,
    type: chat.type,
    title: chat.title,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    members: chat.members.map(m => ({
      id: m.id,
      userId: m.userId,
      userEmail: m.user.email,
      userDisplayName: m.user.settings?.displayName || null,
      userAvatarUrl: m.user.settings?.avatarUrl || null,
      role: m.role,
      joinedAt: m.joinedAt,
    })),
  };
}

/**
 * Mark chat as read
 */
export async function markChatAsRead(
  userId: string,
  chatId: string,
  lastReadMessageId: string
): Promise<void> {
  // Verify membership
  const member = await prisma.chatMember.findUnique({
    where: {
      chatId_userId: {
        chatId,
        userId,
      },
    },
  });

  if (!member) {
    throw new ForbiddenError('You are not a member of this chat');
  }

  // Verify message exists and belongs to this chat
  const message = await prisma.message.findUnique({
    where: {
      id: lastReadMessageId,
    },
  });

  if (!message) {
    throw new NotFoundError('Message not found');
  }

  if (message.chatId !== chatId) {
    throw new ValidationError('Message does not belong to this chat');
  }

  // Update lastReadMessageId
  await prisma.chatMember.update({
    where: {
      id: member.id,
    },
    data: {
      lastReadMessageId,
    },
  });
}

/**
 * Verify user is a member of a chat
 */
export async function verifyChatMembership(
  userId: string,
  chatId: string
): Promise<ChatMember> {
  const member = await prisma.chatMember.findUnique({
    where: {
      chatId_userId: {
        chatId,
        userId,
      },
    },
  });

  if (!member) {
    throw new ForbiddenError('You are not a member of this chat');
  }

  return member;
}
