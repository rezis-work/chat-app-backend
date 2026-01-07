import { Response, NextFunction } from 'express';
import {
  createOrGetDmChat,
  createGroupChat,
  getInbox,
  getChatDetails,
  markChatAsRead,
} from './chats.service';
import type {
  CreateDmChatInput,
  CreateGroupChatInput,
  MarkChatAsReadInput,
} from './chats.validation';
import type { AuthRequest } from '../../middleware/auth';

/**
 * Create or get DM chat endpoint handler
 */
export async function createDmChatHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { userId } = req.body as CreateDmChatInput;
    const currentUserId = req.user!.userId;

    const result = await createOrGetDmChat(currentUserId, userId);

    res.status(201).json({
      ok: true,
      chat: {
        id: result.chat.id,
        type: result.chat.type,
        title: result.chat.title,
        createdAt: result.chat.createdAt,
        updatedAt: result.chat.updatedAt,
      },
      members: result.members.map(m => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create group chat endpoint handler
 */
export async function createGroupChatHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { title, memberIds } = req.body as CreateGroupChatInput;
    const creatorId = req.user!.userId;

    const result = await createGroupChat(creatorId, title, memberIds);

    res.status(201).json({
      ok: true,
      chat: {
        id: result.chat.id,
        type: result.chat.type,
        title: result.chat.title,
        createdAt: result.chat.createdAt,
        updatedAt: result.chat.updatedAt,
      },
      members: result.members.map(m => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get inbox endpoint handler
 */
export async function getInboxHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const inbox = await getInbox(userId);

    res.json({
      ok: true,
      chats: inbox,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get chat details endpoint handler
 */
export async function getChatDetailsHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { chatId } = req.params;
    const userId = req.user!.userId;

    const chatDetails = await getChatDetails(userId, chatId);

    res.json({
      ok: true,
      chat: chatDetails,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Mark chat as read endpoint handler
 */
export async function markChatAsReadHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { chatId } = req.params;
    const { lastReadMessageId } = req.body as MarkChatAsReadInput;
    const userId = req.user!.userId;

    await markChatAsRead(userId, chatId, lastReadMessageId);

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}
