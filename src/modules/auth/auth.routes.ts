import { Router, type Router as ExpressRouter } from 'express';
import { validateRegister, validateLogin } from './auth.validation';
import { register, login, refresh, logout } from './auth.controller';

const router: ExpressRouter = Router();

// Public routes
router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);
router.post('/refresh', refresh);
router.post('/logout', logout);

export default router;
