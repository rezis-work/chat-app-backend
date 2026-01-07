import { Router, type Router as ExpressRouter } from 'express';
import { validateBlockUser } from './blocks.validation';
import {
  blockUserHandler,
  unblockUserHandler,
  getBlockedUsersHandler,
} from './blocks.controller';
import { authMiddleware } from '../../middleware/auth';

const router: ExpressRouter = Router();

// All routes require authentication
router.use(authMiddleware);

router.post('/', validateBlockUser, blockUserHandler);
router.delete('/:userId', unblockUserHandler);
router.get('/', getBlockedUsersHandler);

export default router;

