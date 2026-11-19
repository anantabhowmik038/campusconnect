import express from 'express';
import healthRoutes from './routes/healthRoutes.js';
<<<<<<< Updated upstream
=======
import communicationRoutes from './routes/communicationRoutes.js';
import feedbackRoutes from './routes/feedbackRoutes.js';
>>>>>>> Stashed changes
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use('/api/health', healthRoutes);
<<<<<<< Updated upstream
=======
app.use('/api', communicationRoutes);
app.use('/api', feedbackRoutes);
>>>>>>> Stashed changes
app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found' }));
app.use(errorHandler);

export default app;
