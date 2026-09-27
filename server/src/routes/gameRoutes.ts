/**
 * Game Routes
 */

import { Router } from 'express';
import { gameController } from '../controllers/gameController.ts';
import { requireAuth } from '../middleware/auth.ts';
import { gameRateLimiter } from '../middleware/rateLimiter.ts';

export const gameRouter = Router();

gameRouter.post('/start', requireAuth, gameRateLimiter, (req, res, next) => gameController.start(req, res, next));
gameRouter.post('/finish', requireAuth, gameRateLimiter, (req, res, next) => gameController.finish(req, res, next));
