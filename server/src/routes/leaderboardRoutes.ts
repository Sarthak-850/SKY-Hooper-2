/**
 * Leaderboard Routes
 */

import { Router } from 'express';
import { leaderboardController } from '../controllers/leaderboardController.ts';
import { requireAuth } from '../middleware/auth.ts';
import { searchRateLimiter } from '../middleware/rateLimiter.ts';

export const leaderboardRouter = Router();

leaderboardRouter.get('/world', (req, res, next) => leaderboardController.getWorld(req, res, next));
leaderboardRouter.get('/country/:countryCode', (req, res, next) => leaderboardController.getCountry(req, res, next));
leaderboardRouter.get('/countries', (req, res, next) => leaderboardController.getCountries(req, res, next));
leaderboardRouter.get('/me', requireAuth, (req, res, next) => leaderboardController.getMe(req, res, next));
leaderboardRouter.get('/search', searchRateLimiter, (req, res, next) => leaderboardController.search(req, res, next));
