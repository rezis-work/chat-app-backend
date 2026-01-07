import { Router, type Router as ExpressRouter } from 'express';
import { validateSetLanguagePreference } from './language-preferences.validation';
import {
  setLanguagePreferenceHandler,
  getLanguagePreferenceHandler,
} from './language-preferences.controller';
import { authMiddleware } from '../../middleware/auth';

const router: ExpressRouter = Router({ mergeParams: true });

// All routes require authentication
router.use(authMiddleware);

// Language preference routes
router.put('/', validateSetLanguagePreference, setLanguagePreferenceHandler);
router.get('/', getLanguagePreferenceHandler);

export default router;

