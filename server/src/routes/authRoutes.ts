/**
 * Auth Routes
 */

import { Router } from 'express';
import { authController } from '../controllers/authController.ts';
import { requireAuth } from '../middleware/auth.ts';
import { authRateLimiter } from '../middleware/rateLimiter.ts';

export const authRouter = Router();

authRouter.post('/register', authRateLimiter, (req, res, next) => authController.register(req, res, next));
authRouter.post('/login', authRateLimiter, (req, res, next) => authController.login(req, res, next));
authRouter.post('/logout', (req, res) => authController.logout(req, res));
authRouter.get('/me', requireAuth, (req, res, next) => authController.me(req, res, next));
