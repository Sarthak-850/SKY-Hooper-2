/**
 * User & Profile Controller
 * Endpoints for fetching/updating profile, game history, and statistics.
 */

import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/userService.ts';

export class UserController {
  public async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const profile = await userService.getProfileWithRanks(userId);
      res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (err) {
      next(err);
    }
  }

  public async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { displayName, avatar, countryCode } = req.body;

      const updated = await userService.updateProfile(userId, {
        displayName,
        avatar,
        countryCode,
      });

      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  public async getGames(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;

      const result = await userService.getUserGames(userId, page, limit);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  public async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const stats = await userService.getUserStats(userId);
      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const userController = new UserController();
