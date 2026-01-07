import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma';

const router: Router = Router();

router.get('/health', async (_req: Request, res: Response) => {
  const time = new Date().toISOString();
  let dbStatus: 'up' | 'down' = 'down';

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'up';
  } catch (error) {
    // Database is down - log error but don't expose stack trace
    console.error(
      'Database health check failed:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    dbStatus = 'down';
  }

  res.json({
    ok: true,
    service: 'chat-backend',
    time,
    db: dbStatus,
    redis: 'skip_for_now',
  });
});

export default router;
