import express, { Express } from 'express';
import morgan from 'morgan';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middleware/error-handler';
import { notFoundHandler } from './middleware/not-found';
import healthRouter from './routes/health';
import authRouter from './modules/auth/auth.routes';
import friendsRouter from './modules/friends/friends.routes';
import blocksRouter from './modules/blocks/blocks.routes';
import dmRouter from './modules/dm/dm.routes';
import chatsRouter from './modules/chats/chats.routes';
import messagesRootRouter from './modules/messages/messages-root.routes';
import { getMe } from './modules/auth/auth.controller';
import { authMiddleware } from './middleware/auth';

export const createApp = (): Express => {
  const app = express();

  // Security middleware
  app.use(helmet());

  // CORS middleware (placeholder - configure as needed)
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true,
    })
  );

  // Request logging
  app.use(morgan('combined'));

  // Cookie parser middleware
  app.use(cookieParser());

  // Body parsing middleware with size limit
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Routes
  app.use(healthRouter);
  app.use('/auth', authRouter);
  app.use('/friends', friendsRouter);
  app.use('/blocks', blocksRouter);
  app.use('/dm', dmRouter);
  app.use('/chats', chatsRouter);
  app.use('/messages', authMiddleware, messagesRootRouter);
  app.get('/me', authMiddleware, getMe);

  // 404 handler
  app.use(notFoundHandler);

  // Global error handler (must be last)
  app.use(errorHandler);

  return app;
};
