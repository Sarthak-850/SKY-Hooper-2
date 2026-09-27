/**
 * Server Configuration & Environment Variables
 */

import dotenv from 'dotenv';
import path from 'path';

// Load .env if present
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  
  // Database configuration
  // If DATABASE_URL is provided, backend connects via standard PostgreSQL client (pg.Pool).
  // Otherwise, backend uses embedded PostgreSQL (PGlite) for zero-dependency local dev/tests.
  databaseUrl: process.env.DATABASE_URL || '',
  pgliteDir: process.env.PGLITE_DIR || path.resolve(process.cwd(), 'data/postgres_pglite'),

  // Authentication & Security
  jwtSecret: process.env.JWT_SECRET || 'sky-hooper-secure-development-jwt-secret-key-32chars',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cookieSecret: process.env.COOKIE_SECRET || 'sky-hooper-secure-cookie-secret-key',
  corsOrigin: process.env.CORS_ORIGIN || '*',

  // Anti-Cheat & Game Limits
  antiCheat: {
    maxScoreRatePerSec: parseFloat(process.env.MAX_SCORE_RATE_PER_SEC || '220'),
    minGameDurationSec: parseFloat(process.env.MIN_GAME_DURATION_SEC || '3'),
    maxAbsoluteScore: parseInt(process.env.MAX_ABSOLUTE_SCORE || '1000000', 10),
    maxRapidSubmissionsPerMin: parseInt(process.env.MAX_RAPID_SUBMISSIONS_PER_MIN || '30', 10),
    countryChangeCooldownHours: parseInt(process.env.COUNTRY_CHANGE_COOLDOWN_HOURS || '24', 10),
  },
};
