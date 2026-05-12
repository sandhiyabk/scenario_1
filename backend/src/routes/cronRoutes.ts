import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

const router = Router();
const prisma = new PrismaClient();

router.post('/timeout', async (req, res) => {
  // Simple check for Vercel Cron header to ensure it's not called publicly
  // In production, you'd use a secret key
  const authHeader = req.headers.authorization;
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  logger.info('[Cron] Starting timeout sweep');
  try {
    const activeExecutions = await prisma.execution.findMany({
      where: { status: { in: ['IN_PROGRESS', 'PENDING'] } },
      include: { workflow: { include: { steps: true } } }
    });

    const now = new Date().getTime();
    let processedCount = 0;

    for (const execution of activeExecutions) {
      const pendingLogs = await prisma.executionLog.findMany({
        where: { execution_id: execution.id, status: { in: ['IN_PROGRESS', 'PENDING'] } }
      });

      for (const log of pendingLogs) {
        const step = execution.workflow.steps.find(s => s.name === log.step_name);
        if (!step) continue;

        const metadata = step.metadata as any;
        const timeoutMs = metadata?.timeout_ms;

        if (timeoutMs) {
          const elapsed = now - new Date(log.started_at).getTime();
          
          if (elapsed > timeoutMs) {
            processedCount++;
            // Fail the log and execution (logic from timeoutWorker.ts)
            await prisma.$transaction([
              prisma.executionLog.update({
                where: { id: log.id },
                data: {
                  status: 'FAILED',
                  ended_at: new Date(),
                  error_message: `Step exceeded maximum timeout of ${timeoutMs}ms`,
                }
              }),
              prisma.execution.update({
                where: { id: execution.id },
                data: {
                  status: 'FAILED',
                  ended_at: new Date(),
                  active_step_ids: JSON.stringify([]) as any
                }
              })
            ]);
          }
        }
      }
    }
    res.json({ success: true, processed: processedCount });
  } catch (error: any) {
    logger.error('[Cron] Error during sweep:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
