import { Router, type Router as ExpressRouter } from 'express';
import {
  validateRegister,
  validateLogin,
  validateVerifyEmail,
  validateResendVerification,
  validateForgotPassword,
  validateResetPassword,
} from './auth.validation';
import {
  register,
  login,
  refresh,
  logout,
  verifyEmailHandler,
  resendVerification,
  forgotPasswordHandler,
  resetPasswordHandler,
} from './auth.controller';

const router: ExpressRouter = Router();

// Public routes
router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/verify-email', validateVerifyEmail, verifyEmailHandler);
router.post('/resend-verification', validateResendVerification, resendVerification);
router.post('/forgot-password', validateForgotPassword, forgotPasswordHandler);
router.post('/reset-password', validateResetPassword, resetPasswordHandler);

export default router;
