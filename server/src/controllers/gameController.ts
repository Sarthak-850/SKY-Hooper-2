/**
 * Game Session & Scoring Controller
 * Authoritative session starts and score validation submissions.
 */

import { Request, Response, NextFunction } from 'express';
import { gameService } from '../services/gameService.ts';

export class GameController {
  public async start(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const gameMode = (req.body.gameMode as string) || 'CLASSIC';

      const session = await gameService.startSession(userId, gameMode);
      res.status(200).json({
        success: true,
        data: session,
      });
    } catch (err) {
      next(err);
    }
  }

  public async finish(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { sessionId, score, duration, metrics } = req.body;

      if (!sessionId) {
        res.status(400).json({
          success: false,
          error: { code: 'MISSING_SESSION_ID', message: 'Game session ID is required.' },
        });
        return;
      }

      const result = await gameService.finishSession(userId, {
        sessionId,
        score,
        duration,
        metrics,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const gameController = new GameController();
