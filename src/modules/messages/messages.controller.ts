import { Response, NextFunction } from 'express';
import {
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
} from './messages.service';
import type { SendMessageInput, EditMessageInput } from './messages.validation';
import type { AuthRequest } from '../../middleware/auth';

/**
 * Get messages endpoint handler
 */
export async function getMessagesHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { chatId } = req.params;
    const userId = req.user!.userId;
    const cursor = req.query.cursor as string | undefined;
    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 30;

    const result = await getMessages(userId, chatId, cursor, limit);

    res.json({
      ok: true,
      messages: result.messages,
      nextCursor: result.nextCursor,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Send message endpoint handler
 */
export async function sendMessageHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { chatId } = req.params;
    const { content } = req.body as SendMessageInput;
    const userId = req.user!.userId;

    const message = await sendMessage(userId, chatId, content);

    res.status(201).json({
      ok: true,
      message,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Edit message endpoint handler
 */
export async function editMessageHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { content } = req.body as EditMessageInput;
    const userId = req.user!.userId;

    const message = await editMessage(userId, id, content);

    res.json({
      ok: true,
      message,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete message endpoint handler
 */
export async function deleteMessageHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    await deleteMessage(userId, id);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

