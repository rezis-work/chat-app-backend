import { Router, type Router as ExpressRouter } from 'express';
import {
  editMessageHandler,
  deleteMessageHandler,
  validateEditMessage,
} from './messages.routes';

const router: ExpressRouter = Router();

// Edit and delete routes at root level (/messages/:id)
router.patch('/:id', validateEditMessage, editMessageHandler);
router.delete('/:id', deleteMessageHandler);

export default router;

