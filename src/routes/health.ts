import { Router, Request, Response } from 'express';

const router = Router();

router.get('/health', (req: Request, res: Response) => {
  res.json({
    ok: true,
    service: 'chat-backend',
    time: new Date().toISOString(),
  });
});

export default router;

