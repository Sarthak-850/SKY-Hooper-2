/**
 * Legacy & Frontend Compatibility Routes
 * Maps existing frontend requests (/api/leaderboard/*, /api/detect-country, /api/countries, etc.)
 * directly to the new PostgreSQL database and services, ensuring existing gameplay is never disrupted.
 */

import { Router, Request, Response } from 'express';
import { leaderboardService } from '../services/leaderboardService.ts';
import { gameService } from '../services/gameService.ts';
import { userService } from '../services/userService.ts';
import { authService } from '../services/authService.ts';
import { COUNTRIES_LIST, findCountry } from '../utils/countries.ts';
import { db } from '../database/index.ts';

export const compatRouter = Router();

// 1. Detect Country via IP/Headers
compatRouter.get('/detect-country', (req: Request, res: Response) => {
  const cloudflareCountry = req.headers['cf-ipcountry'] as string;
  const vercelCountry = req.headers['x-vercel-ip-country'] as string;
  const detected = cloudflareCountry || vercelCountry || 'IN';

  const country = findCountry(detected);
  res.json({
    countryCode: country.code,
    countryName: country.name,
    countryFlag: country.flag,
  });
});

// 2. Countries list
compatRouter.get('/countries', (_req: Request, res: Response) => {
  res.json(COUNTRIES_LIST);
});

// 3. Legacy Player Register / Sync
compatRouter.post('/player/register', async (req: Request, res: Response) => {
  try {
    const { id, username, countryCode, countryName } = req.body;
    const cleanId = id || `pilot_${Date.now()}`;
    const cleanUsername = username?.trim() || 'Nova Pilot';
    const country = findCountry(countryCode || 'IN');

    // Upsert player into users & player_profiles
    const existing = await db.query('SELECT id FROM users WHERE id = $1', [cleanId]);
    if (existing.rows.length === 0) {
      await db.transaction(async (tx) => {
        await tx.query(
          `INSERT INTO users (id, username, email, password_hash, country_code, country_name, avatar, created_at, updated_at, last_active_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), NOW())
           ON CONFLICT (id) DO NOTHING`,
          [cleanId, cleanUsername, `${cleanId}@guest.skyhooper.local`, 'guest_account', country.code, countryName || country.name, 'default_pilot']
        );

        await tx.query(
          `INSERT INTO player_profiles (id, user_id, display_name, country_code, country_name, avatar, best_score, total_games, total_score, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, 0, 0, 0, NOW(), NOW())
           ON CONFLICT (id) DO NOTHING`,
          [`prf_${cleanId}`, cleanId, cleanUsername, country.code, countryName || country.name, 'default_pilot']
        );
      });
    }

    const profile = await userService.getProfileWithRanks(cleanId);
    res.json(profile);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Legacy Player Stats
compatRouter.get('/player/:id', async (req: Request, res: Response) => {
  try {
    const stats = await userService.getUserStats(req.params.id);
    const profile = await userService.getProfileWithRanks(req.params.id);
    res.json({
      player: profile,
      stats,
      worldRank: profile.worldRank,
      countryRank: profile.countryRank,
    });
  } catch {
    res.status(404).json({ error: 'Player not found' });
  }
});

// 5. Legacy Session Start
compatRouter.post('/session/start', async (req: Request, res: Response) => {
  try {
    const playerId = req.body.playerId || 'guest_pilot';
    // Ensure user exists
    const userCheck = await db.query('SELECT id FROM users WHERE id = $1', [playerId]);
    if (userCheck.rows.length === 0) {
      await db.query(
        `INSERT INTO users (id, username, email, password_hash, country_code, country_name, avatar)
         VALUES ($1, $2, $3, $4, 'IN', 'India', 'default_pilot')
         ON CONFLICT (id) DO NOTHING`,
        [playerId, 'Guest Pilot', `${playerId}@guest.local`, 'guest']
      );
      await db.query(
        `INSERT INTO player_profiles (id, user_id, display_name, country_code, country_name, avatar)
         VALUES ($1, $2, 'Guest Pilot', 'IN', 'India', 'default_pilot')
         ON CONFLICT (user_id) DO NOTHING`,
        [`prf_${playerId}`, playerId]
      );
    }

    const session = await gameService.startSession(playerId, req.body.gameMode || 'CLASSIC');
    res.json({
      sessionId: session.sessionId,
      startTime: session.serverTimestamp,
      token: 'session_token',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Legacy Score Submit
compatRouter.post('/scores/submit', async (req: Request, res: Response) => {
  try {
    const { playerId, sessionId, score, durationSeconds, maxCombo, perfectGates, nearMisses, stars } = req.body;

    // Check if session exists; if not, create one on the fly for guest fallback
    const sessionRes = await db.query('SELECT id FROM game_sessions WHERE id = $1', [sessionId]);
    if (sessionRes.rows.length === 0) {
      await db.query(
        `INSERT INTO game_sessions (id, user_id, started_at, status, validation_status)
         VALUES ($1, $2, NOW() - INTERVAL '1 minute', 'ACTIVE', 'PENDING')`,
        [sessionId, playerId]
      );
    }

    const result = await gameService.finishSession(playerId, {
      sessionId,
      score: Number(score),
      duration: Number(durationSeconds || 10),
      metrics: { maxCombo, perfectGates, nearMisses, stars },
    });

    res.json({
      success: true,
      score: result.score,
      isNewBest: result.isNewBest,
      previousBest: result.previousBest,
      worldRank: result.worldRank,
      previousWorldRank: null,
      worldRankImprovement: 0,
      countryRank: result.countryRank,
      previousCountryRank: null,
      countryRankImprovement: 0,
      totalWorldPlayers: 100,
      totalCountryPlayers: 50,
      message: result.message,
    });
  } catch (err: any) {
    res.status(err.status || 400).json({
      success: false,
      error: { code: err.code || 'VALIDATION_FAILED', message: err.message },
    });
  }
});

// 7. Singular /api/leaderboard/* alias routing to plural /api/leaderboards/*
compatRouter.get('/leaderboard/world', async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 50;
  const search = req.query.search as string;
  const result = await leaderboardService.getWorldLeaderboard({ page, limit, search });
  res.json({
    category: 'world',
    totalEntries: result.total,
    entries: result.entries,
    page: result.page,
    totalPages: result.totalPages,
  });
});

compatRouter.get('/leaderboard/country/:countryCode', async (req: Request, res: Response) => {
  const countryCode = req.params.countryCode;
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 50;
  const result = await leaderboardService.getCountryLeaderboard(countryCode, { page, limit });
  res.json({
    category: 'country',
    country: result.country,
    totalEntries: result.total,
    entries: result.entries,
    page: result.page,
    totalPages: result.totalPages,
  });
});

compatRouter.get('/leaderboard/countries', async (req: Request, res: Response) => {
  const sortBy = (req.query.sortBy as any) || 'totalScore';
  const result = await leaderboardService.getCountryCompetition(sortBy);
  res.json({
    sortedBy: result.metricUsed,
    rankings: result.rankings,
  });
});

compatRouter.get('/leaderboard/search', async (req: Request, res: Response) => {
  const q = (req.query.q as string) || '';
  const result = await leaderboardService.searchLeaderboard(q);
  res.json(result);
});

// 8. Legacy SSE Stream
compatRouter.get('/leaderboard/live', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send initial ping
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: Date.now() })}\n\n`);

  const unsubscribe = gameService.onLeaderboardUpdate((event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  req.on('close', () => {
    unsubscribe();
  });
});
