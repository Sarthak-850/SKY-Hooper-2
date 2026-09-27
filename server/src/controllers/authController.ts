/**
 * Authentication Controller
 * Handles registration, login, logout, and current session fetching.
 */

import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService.ts';
import { userService } from '../services/userService.ts';
import { config } from '../config/env.ts';

export class AuthController {
  public async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { username, email, password, countryCode, countryName } = req.body;

      const result = await authService.register({
        username,
        email,
        password,
        countryCode: countryCode || 'IN',
        countryName,
      });

      // Set secure HTTP-only cookie
      res.cookie('token', result.token, {
        httpOnly: true,
        secure: config.isProduction,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  public async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { loginIdentifier, email, username, password } = req.body;
      const idToUse = loginIdentifier || email || username;

      const result = await authService.login(idToUse, password);

      // Set secure HTTP-only cookie
      res.cookie('token', result.token, {
        httpOnly: true,
        secure: config.isProduction,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  public async logout(_req: Request, res: Response): Promise<void> {
    res.clearCookie('token');
    res.status(200).json({
      success: true,
      data: { message: 'Logged out successfully.' },
    });
  }

  public async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated.' },
        });
        return;
      }

      const profile = await userService.getProfileWithRanks(req.user.userId);
      res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
