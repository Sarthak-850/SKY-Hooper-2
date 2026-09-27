/**
 * Rate Limiting Middleware
 * Protects auth, games, search, and score endpoints against abusive traffic and DDoS attacks.
 */

import { Request, Response, NextFunction } from 'express';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
  code?: string;
}

interface ClientRecord {
  timestamps: number[];
}

export function createRateLimiter(options: RateLimitConfig) {
  const clients = new Map<string, ClientRecord>();

  // Cleanup old timestamps every 2 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of clients.entries()) {
      record.timestamps = record.timestamps.filter((t) => now - t < options.windowMs);
      if (record.timestamps.length === 0) {
        clients.delete(key);
      }
    }
  }, 120000);

  return (req: Request, res: Response, next: NextFunction): void => {
    // Identify client by user ID if authenticated, else IP address
    const ip = req.ip || req.socket.remoteAddress || 'unknown-ip';
    const clientKey = req.user?.userId ? `user_${req.user.userId}` : `ip_${ip}`;

    const now = Date.now();
    let record = clients.get(clientKey);

    if (!record) {
      record = { timestamps: [] };
      clients.set(clientKey, record);
    }

    // Filter within window
    record.timestamps = record.timestamps.filter((t) => now - t < options.windowMs);

    if (record.timestamps.length >= options.maxRequests) {
      res.status(429).json({
        success: false,
        error: {
          code: options.code || 'RATE_LIMIT_EXCEEDED',
          message: options.message || 'Too many requests. Please slow down and try again later.',
        },
      });
      return;
    }

    record.timestamps.push(now);
    next();
  };
}

// Preset rate limiters
export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 20,
  code: 'AUTH_RATE_LIMIT',
  message: 'Too many authentication attempts. Please wait a minute before trying again.',
});

export const gameRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 35,
  code: 'GAME_RATE_LIMIT',
  message: 'Too many game actions. Please wait a moment.',
});

export const searchRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 60,
  code: 'SEARCH_RATE_LIMIT',
  message: 'Too many search queries. Please wait a moment.',
});
