/**
 * Uniform API Error Handling Middleware
 * Ensures every error follows standard:
 * {
 *   "success": false,
 *   "error": {
 *     "code": "...",
 *     "message": "..."
 *   }
 * }
 */

import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env.ts';

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const status = typeof err.status === 'number' ? err.status : 500;
  const code = err.code || (status === 404 ? 'NOT_FOUND' : status === 400 ? 'BAD_REQUEST' : 'INTERNAL_SERVER_ERROR');
  const message = err.message || 'An unexpected server error occurred.';

  const responseBody: any = {
    success: false,
    error: {
      code,
      message,
    },
  };

  if (err.details && !config.isProduction) {
    responseBody.error.details = err.details;
  }

  if (status >= 500) {
    console.error('Unhandled Server Error:', err);
  }

  res.status(status).json(responseBody);
}
