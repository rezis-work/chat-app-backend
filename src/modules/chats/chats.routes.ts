import { Router, type Router as ExpressRouter } from 'express';
import {
  validateCreateDmChat,
  validateCreateGroupChat,
  validateMarkChatAsRead,
} from './chats.validation';
import {
  createDmChatHandler,
  createGroupChatHandler,
  getInboxHandler,
  getChatDetailsHandler,
  markChatAsReadHandler,
} from './chats.controller';
import { authMiddleware } from '../../middleware/auth';
import messagesRouter from '../messages/messages.routes';
import languagePreferencesRouter from './language-preferences.routes';

const router: ExpressRouter = Router();

// All routes require authentication
router.use(authMiddleware);

// Chat routes
router.post('/dm', validateCreateDmChat, createDmChatHandler);
router.post('/group', validateCreateGroupChat, createGroupChatHandler);
router.get('/', getInboxHandler);
router.get('/:chatId', getChatDetailsHandler);
router.post('/:chatId/read', validateMarkChatAsRead, markChatAsReadHandler);

// Messages routes (nested under chats, chatId available via req.params.chatId)
router.use('/:chatId/messages', messagesRouter);

// Language preference routes (nested under chats, chatId available via req.params.chatId)
router.use('/:chatId/language', languagePreferencesRouter);

export default router;

