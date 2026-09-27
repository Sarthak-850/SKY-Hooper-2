/**
 * Health Check Routes
 * Reports server uptime, database connectivity, and environment status.
 */

import { Router, Request, Response } from 'express';
import { db } from '../database/index.ts';
import { config } from '../config/env.ts';

export const healthRouter = Router();

healthRouter.get('/', async (_req: Request, res: Response) => {
  let dbStatus = 'disconnected';
  try {
    const test = await db.query('SELECT 1 AS ok');
    if (test.rows.length > 0 && test.rows[0].ok === 1) {
      dbStatus = 'connected';
    }
  } catch (err: any) {
    dbStatus = `error: ${err.message}`;
  }

  res.status(200).json({
    status: 'ok',
    database: dbStatus,
    engine: db.isUsingPgLite() ? 'PostgreSQL (PGlite)' : 'PostgreSQL (Pool)',
    uptime: Math.floor(process.uptime()),
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
  });
});
