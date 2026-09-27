/**
 * Leaderboards Controller
 * Public & authenticated endpoints for rankings, country competition, and player proximity.
 */

import { Request, Response, NextFunction } from 'express';
import { leaderboardService } from '../services/leaderboardService.ts';

export class LeaderboardController {
  public async getWorld(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 50;
      const search = (req.query.search as string) || (req.query.q as string);

      const result = await leaderboardService.getWorldLeaderboard({ page, limit, search });
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  public async getCountry(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const countryCode = req.params.countryCode;
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 50;

      if (!countryCode || countryCode.length !== 2) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_COUNTRY_CODE', message: 'Valid 2-letter country code required.' },
        });
        return;
      }

      const result = await leaderboardService.getCountryLeaderboard(countryCode, { page, limit });
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  public async getCountries(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sortBy = (req.query.sortBy as any) || 'totalScore';
      const result = await leaderboardService.getCountryCompetition(sortBy);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  public async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const result = await leaderboardService.getPlayerRankAndNearby(userId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  public async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req.query.q as string) || (req.query.search as string) || '';
      const limit = parseInt(req.query.limit as string, 10) || 20;

      const result = await leaderboardService.searchLeaderboard(query, limit);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const leaderboardController = new LeaderboardController();
