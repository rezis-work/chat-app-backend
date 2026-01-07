import { Router, type Router as ExpressRouter } from 'express';
import {
  validateRequestFriendship,
  validateAcceptFriendship,
  validateDeclineFriendship,
  validateRemoveFriendship,
} from './friends.validation';
import {
  requestFriendshipHandler,
  acceptFriendshipHandler,
  declineFriendshipHandler,
  removeFriendshipHandler,
  getFriendsHandler,
  getFriendRequestsHandler,
} from './friends.controller';
import { authMiddleware } from '../../middleware/auth';

const router: ExpressRouter = Router();

// All routes require authentication
router.use(authMiddleware);

// Friend request routes
router.post('/request', validateRequestFriendship, requestFriendshipHandler);
router.post('/accept', validateAcceptFriendship, acceptFriendshipHandler);
router.post('/decline', validateDeclineFriendship, declineFriendshipHandler);
router.delete('/remove', validateRemoveFriendship, removeFriendshipHandler);

// Get routes
router.get('/', getFriendsHandler);
router.get('/requests', getFriendRequestsHandler);

export default router;

