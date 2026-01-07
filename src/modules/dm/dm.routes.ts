import { Router, type Router as ExpressRouter } from 'express';
import {
  validateAcceptDmRequest,
  validateDeclineDmRequest,
  validateBlockDmRequest,
} from './dm.validation';
import {
  getDmRequestsHandler,
  acceptDmRequestHandler,
  declineDmRequestHandler,
  blockViaDmRequestHandler,
} from './dm.controller';
import { authMiddleware } from '../../middleware/auth';

const router: ExpressRouter = Router();

// All routes require authentication
router.use(authMiddleware);

router.get('/requests', getDmRequestsHandler);
router.post(
  '/requests/:userId/accept',
  validateAcceptDmRequest,
  acceptDmRequestHandler
);
router.post(
  '/requests/:userId/decline',
  validateDeclineDmRequest,
  declineDmRequestHandler
);
router.post(
  '/requests/:userId/block',
  validateBlockDmRequest,
  blockViaDmRequestHandler
);

export default router;

