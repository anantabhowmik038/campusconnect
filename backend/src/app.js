import express from 'express';
import healthRoutes from './routes/healthRoutes.js';
import { createEventRouter } from './routes/eventRoutes.js';
import { createPublicEventRouter } from './routes/publicEventRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
app.disable('x-powered-by');
app.use('/api/events', createPublicEventRouter());
app.use('/api/events', createEventRouter());
app.use(express.json({ limit: '1mb' }));
app.use('/api/health', healthRoutes);
app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found' }));
app.use(errorHandler);

export default app;
