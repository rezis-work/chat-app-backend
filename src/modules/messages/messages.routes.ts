import { Router, type Router as ExpressRouter } from 'express';
import { validateSendMessage, validateEditMessage } from './messages.validation';
import {
  getMessagesHandler,
  sendMessageHandler,
  editMessageHandler,
  deleteMessageHandler,
} from './messages.controller';

const router: ExpressRouter = Router({ mergeParams: true });

// Messages routes (chatId comes from parent route when nested under /chats/:chatId/messages)
router.get('/', getMessagesHandler);
router.post('/', validateSendMessage, sendMessageHandler);

// Export handlers for root-level routes (edit/delete)
export { editMessageHandler, deleteMessageHandler, validateEditMessage };

export default router;

