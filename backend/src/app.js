
import express from 'express';
import cors from 'cors';

import healthRoutes from './routes/healthRoutes.js';
import authRoutes from './routes/authRoutes.js';
import clubRoutes from './routes/clubRoutes.js';
import communicationRoutes from './routes/communicationRoutes.js';
import feedbackRoutes from './routes/feedbackRoutes.js';

import { createEventRouter } from './routes/eventRoutes.js';
import { createPublicEventRouter } from './routes/publicEventRoutes.js';
import { verifyEventToken } from './middleware/eventAuthMiddleware.js';

import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.disable('x-powered-by');
app.use(cors());

// F05: Public event discovery
app.use('/api/events', createPublicEventRouter());

// F04: Authenticate supported proposal and approval routes
function protectF04Routes(req, res, next) {
  const path = req.path.replace(/\/+$/, '') || '/';
  const method = req.method;

  const isProtected =
    (method === 'POST' && path === '/') ||
    (method === 'GET' && /^\/(proposals|pending)$/i.test(path)) ||
    (method === 'PATCH' && /^\/[^/]+$/.test(path)) ||
    (method === 'POST' && /^\/[^/]+\/submit$/i.test(path)) ||
    (method === 'PATCH' && /^\/[^/]+\/review$/i.test(path));

  if (!isProtected) return next();

  return verifyEventToken(req, res, next);
}

app.use('/api/events', protectF04Routes, createEventRouter());

// Other API modules
app.use(express.json({ limit: '1mb' }));

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/clubs', clubRoutes);
app.use('/api', communicationRoutes);
app.use('/api', feedbackRoutes);

// Unknown routes
app.use('/api', (_req, res) => {
  res.status(404).json({
    error: 'API route not found',
  });
});

app.use(errorHandler);

export default app;
