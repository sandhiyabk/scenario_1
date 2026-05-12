import express from 'express';
import cors from 'cors';
import workflowRoutes from './routes/workflowRoutes.js';
import stepRoutes from './routes/stepRoutes.js';
import ruleRoutes from './routes/ruleRoutes.js';
import executionRoutes from './routes/executionRoutes.js';
import statsRoutes from './routes/statsRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import cronRoutes from './routes/cronRoutes.js';
import { runSeed } from './seed.js';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Middleware
const allowedOrigins = process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    query: req.query,
    body: req.method !== 'GET' ? req.body : undefined,
    ip: req.ip
  });
  next();
});

// Routes
app.use('/workflows', workflowRoutes);
app.use('/steps', stepRoutes);
app.use('/rules', ruleRoutes);
app.use('/executions', executionRoutes);
app.use('/stats', statsRoutes);
app.use('/notifications', notificationRoutes);
app.use('/cron', cronRoutes);

// Seed endpoint — populates sample workflows for demo
app.post('/seed', async (req, res) => {
  try {
    await runSeed();
    res.json({ success: true, message: 'Sample workflows seeded successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global Error Handler (MUST BE LAST)
app.use(errorHandler);

export default app;
