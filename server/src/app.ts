/**
 * Sky Hopper Backend Express Application
 * Configures Helmet, CORS, Cookie-Parser, JSON parsers, API routes, and Error Handling.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config/env.ts';
import { authRouter } from './routes/authRoutes.ts';
import { userRouter } from './routes/userRoutes.ts';
import { gameRouter } from './routes/gameRoutes.ts';
import { leaderboardRouter } from './routes/leaderboardRoutes.ts';
import { healthRouter } from './routes/healthRoutes.ts';
import { compatRouter } from './routes/compatRoutes.ts';
import { errorHandler } from './middleware/errorHandler.ts';

export const app = express();

// Trust reverse proxy (for Cloudflare, Vercel, Railway, Render, etc.)
app.set('trust proxy', 1);

// Security Headers (Helmet)
app.use(
  helmet({
    contentSecurityPolicy: false, // Let frontend load fonts and Vite HMR
    crossOriginEmbedderPolicy: false,
  })
);

// CORS Configuration
app.use(
  cors({
    origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Body Parsers & Cookie Parser
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser(config.cookieSecret));

// Mount API Routes
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/games', gameRouter);
app.use('/api/leaderboards', leaderboardRouter);

// Mount compatibility endpoints for frontend
app.use('/api', compatRouter);

// 404 handler for unmatched API routes
app.all('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `The requested endpoint ${req.method} ${req.originalUrl} does not exist.`,
    },
  });
});

// Central Error Handler
app.use(errorHandler);
