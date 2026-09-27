/**
 * User & Profile Routes
 */

import { Router } from 'express';
import { userController } from '../controllers/userController.ts';
import { requireAuth } from '../middleware/auth.ts';

export const userRouter = Router();

userRouter.get('/me', requireAuth, (req, res, next) => userController.getProfile(req, res, next));
userRouter.patch('/me', requireAuth, (req, res, next) => userController.updateProfile(req, res, next));
userRouter.get('/me/games', requireAuth, (req, res, next) => userController.getGames(req, res, next));
userRouter.get('/me/stats', requireAuth, (req, res, next) => userController.getStats(req, res, next));
