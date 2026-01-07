import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import {
  getNotificationsHandler,
  markNotificationReadHandler,
  markAllNotificationsReadHandler,
  getUnreadCountHandler,
} from './notifications.controller';
import {
  validateGetNotifications,
  validateMarkNotificationRead,
} from './notifications.validation';

const router = Router();

router.use(authMiddleware);

router.get('/', validateGetNotifications, getNotificationsHandler);
router.post('/:id/read', validateMarkNotificationRead, markNotificationReadHandler);
router.post('/read-all', markAllNotificationsReadHandler);
router.get('/unread-count', getUnreadCountHandler);

export default router;

