/**
 * Authentication Middleware
 * Validates JWT tokens from Authorization Header or HTTP-only cookies.
 */

import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService.ts';
import { AuthTokenPayload } from '../types/index.ts';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

/**
 * Require valid authenticated JWT session
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Please log in or provide a valid Bearer token.',
      },
    });
    return;
  }

  try {
    const payload = authService.verifyToken(token);
    req.user = payload;
    next();
  } catch (err: any) {
    res.status(401).json({
      success: false,
      error: {
        code: err.code || 'INVALID_TOKEN',
        message: err.message || 'Invalid or expired authentication token.',
      },
    });
  }
}

/**
 * Optional authentication: attaches user if token is present, does not reject guests
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (token) {
    try {
      req.user = authService.verifyToken(token);
    } catch {
      // ignore guest
    }
  }
  next();
}

function extractToken(req: Request): string | null {
  // 1. Authorization header: "Bearer <token>"
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  // 2. HTTP-only / signed cookie
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }

  return null;
}
