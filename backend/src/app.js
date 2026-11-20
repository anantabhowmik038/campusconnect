import express from 'express';
import cors from 'cors';
import healthRoutes from './routes/healthRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import clubRoutes from './routes/clubRoutes.js';

const app = express();
app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/clubs', clubRoutes);
app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found' }));
app.use(errorHandler);

export default app;