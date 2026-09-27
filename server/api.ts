/**
 * Express API Router & Realtime SSE Event System
 * Handles all leaderboard, anti-cheat validation, country competition, and player profile routes.
 */

import express, { Request, Response } from 'express';
import crypto from 'node:crypto';
import { db } from './db.ts';
import { antiCheat } from './antiCheat.ts';
import { findCountry, COUNTRIES_LIST } from './countries.ts';
import { seedDatabaseIfNeeded } from './seedData.ts';
import {
  LeaderboardLiveEvent,
  LeaderboardTimeframe,
  CountrySortMetric,
  ScoreSubmissionPayload,
} from '../src/types/leaderboard.ts';

// Auto-seed database with realistic data on startup if empty
seedDatabaseIfNeeded();

export const apiRouter = express.Router();
apiRouter.use(express.json());

// Set of active SSE client response objects for live updates
const sseClients = new Set<Response>();

export function broadcastLiveEvent(event: LeaderboardLiveEvent) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(data);
    } catch {
      sseClients.delete(res);
    }
  }
}

// Keep-alive heartbeat for SSE every 25 seconds
setInterval(() => {
  const ping = `: ping\n\n`;
  for (const res of sseClients) {
    try {
      res.write(ping);
    } catch {
      sseClients.delete(res);
    }
  }
}, 25000);

// --- Health ---
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    game: 'Sky Hopper',
    system: 'Global Leaderboard & Country Competition',
    totalPlayers: db.getPlayerCount(),
    timestamp: Date.now(),
  });
});

// --- Country Detection & List ---
apiRouter.get('/detect-country', (req: Request, res: Response) => {
  // Check headers provided by CDNs / reverse proxies
  const headers = req.headers;
  const cfCountry = headers['cf-ipcountry'] as string;
  const xCountry = (headers['x-country-code'] || headers['x-vercel-ip-country']) as string;
  const detectedCode = (cfCountry || xCountry || '').trim().toUpperCase();

  let country = findCountry('IN'); // Default fallback India
  if (detectedCode && detectedCode.length === 2) {
    country = findCountry(detectedCode);
  }

  res.json({
    countryCode: country.code,
    countryName: country.name,
    countryFlag: country.flag,
    detected: Boolean(detectedCode),
  });
});

apiRouter.get('/countries', (_req: Request, res: Response) => {
  res.json(COUNTRIES_LIST);
});

// --- Player Profile ---
apiRouter.post('/player/register', (req: Request, res: Response) => {
  const { id, username, countryCode } = req.body;
  const playerId = id && typeof id === 'string' && id.trim().length > 0
    ? id.trim()
    : `pilot_${crypto.randomUUID()}`;

  const cleanName = username && typeof username === 'string' && username.trim().length > 0
    ? username.trim().slice(0, 24)
    : 'Nova Pilot';

  const country = findCountry(countryCode || 'IN');

  const profile = db.upsertPlayer({
    id: playerId,
    username: cleanName,
    countryCode: country.code,
    countryName: country.name,
    countryFlag: country.flag,
  });

  res.json(profile);
});

apiRouter.get('/player/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const player = db.getPlayer(id);
  if (!player) {
    res.status(404).json({ error: 'Player not found' });
    return;
  }

  const details = db.getPlayerRankDetails(id);
  res.json({
    player,
    ...details,
  });
});

// --- Game Session & Anti-Cheat ---
apiRouter.post('/session/start', (req: Request, res: Response) => {
  const { playerId } = req.body;
  if (!playerId || typeof playerId !== 'string') {
    res.status(400).json({ error: 'Player ID is required to start a game session' });
    return;
  }

  // Ensure player exists
  let player = db.getPlayer(playerId);
  if (!player) {
    player = db.upsertPlayer({
      id: playerId,
      username: 'Nova Pilot',
      countryCode: 'IN',
      countryName: 'India',
      countryFlag: '🇮🇳',
    });
  }

  const sessionId = `sess_${crypto.randomUUID()}`;
  const token = antiCheat.generateSessionToken(playerId, sessionId);

  db.createSession(sessionId, playerId, token);

  res.json({
    sessionId,
    token,
    startTime: Date.now(),
  });
});

// --- Score Submission with Authoritative Anti-Cheat ---
apiRouter.post('/scores/submit', (req: Request, res: Response) => {
  const payload: ScoreSubmissionPayload = req.body;

  // Run authoritative anti-cheat checks
  const validation = antiCheat.validate(payload);
  if (!validation.isValid) {
    res.status(400).json({
      success: false,
      reason: validation.reason || 'Score validation failed',
    });
    return;
  }

  // Mark session as used immediately
  db.markSessionUsed(payload.sessionId);

  try {
    const scoreId = `sc_${crypto.randomUUID()}`;
    const result = db.recordScore({
      id: scoreId,
      playerId: payload.playerId,
      score: payload.score,
      maxCombo: payload.maxCombo,
      perfectGates: payload.perfectGates,
      nearMisses: payload.nearMisses,
      stars: payload.stars,
      coins: payload.coins,
      durationSeconds: payload.durationSeconds,
      zoneReached: payload.zoneReached,
      gameMode: payload.gameMode,
      sessionId: payload.sessionId,
      createdAt: payload.timestamp || Date.now(),
    });

    const player = db.getPlayer(payload.playerId);
    const details = db.getPlayerRankDetails(payload.playerId);

    const worldRankImprovement = result.previousWorldRank && result.previousWorldRank > result.newWorldRank
      ? result.previousWorldRank - result.newWorldRank
      : 0;

    const countryRankImprovement = result.previousCountryRank && result.previousCountryRank > result.newCountryRank
      ? result.previousCountryRank - result.newCountryRank
      : 0;

    // Broadcast live event if high rank or notable achievement
    if (player && result.isNewBest) {
      let eventType: LeaderboardLiveEvent['type'] = 'NEW_HIGH_SCORE';
      let message = `${player.username} scored ${payload.score.toLocaleString()}!`;

      if (result.newWorldRank <= 100) {
        eventType = 'NEW_TOP_100';
        message = `🔥 ${player.username} entered the World Top 100 (#${result.newWorldRank})!`;
      } else if (worldRankImprovement >= 3) {
        eventType = 'RANK_UP';
        message = `⚡ ${player.username} moved up ${worldRankImprovement} positions to #${result.newWorldRank}!`;
      }

      broadcastLiveEvent({
        id: `ev_${crypto.randomUUID()}`,
        type: eventType,
        message,
        playerName: player.username,
        countryFlag: player.countryFlag,
        countryCode: player.countryCode,
        score: payload.score,
        rank: result.newWorldRank,
        timestamp: Date.now(),
      });
    }

    res.json({
      success: true,
      score: payload.score,
      isNewBest: result.isNewBest,
      previousBest: result.previousBest,
      worldRank: result.newWorldRank,
      previousWorldRank: result.previousWorldRank,
      worldRankImprovement,
      countryRank: result.newCountryRank,
      previousCountryRank: result.previousCountryRank,
      countryRankImprovement,
      totalWorldPlayers: details.totalWorldPlayers,
      totalCountryPlayers: details.totalCountryPlayers,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database error recording score';
    res.status(500).json({ success: false, reason: message });
  }
});

// --- World Leaderboard ---
apiRouter.get('/leaderboard/world', (req: Request, res: Response) => {
  const timeframe = (req.query.timeframe as LeaderboardTimeframe) || 'all';
  const limit = parseInt(req.query.limit as string, 10) || 50;
  const offset = parseInt(req.query.offset as string, 10) || 0;
  const playerId = (req.query.playerId as string) || '';

  const { entries, total } = db.getWorldLeaderboard({ timeframe, limit, offset });

  // Get podium (top 3)
  const podiumQuery = db.getWorldLeaderboard({ timeframe, limit: 3, offset: 0 });
  const podium = podiumQuery.entries;

  let playerEntry = null;
  let nearbyEntries = undefined;

  if (playerId) {
    const player = db.getPlayer(playerId);
    if (player) {
      const details = db.getPlayerRankDetails(playerId);
      if (details.worldRank !== null && details.bestScore > 0) {
        playerEntry = {
          rank: details.worldRank,
          playerId: player.id,
          username: player.username,
          countryCode: player.countryCode,
          countryName: player.countryName,
          countryFlag: player.countryFlag,
          score: details.bestScore,
          maxCombo: 1,
          zone: 'NEON_CLOUDS',
          gameMode: 'CLASSIC',
          createdAt: player.createdAt,
          isCurrentPlayer: true,
        };
        nearbyEntries = db.getNearbyCompetitors(playerId, 'world');
      }
    }
  }

  res.json({
    category: 'world',
    timeframe,
    total,
    page: Math.floor(offset / limit) + 1,
    limit,
    entries: entries.map((e) => ({
      ...e,
      isCurrentPlayer: playerId ? e.playerId === playerId : false,
    })),
    podium,
    playerEntry,
    nearbyEntries,
  });
});

// --- Country-Specific Leaderboard (e.g., India) ---
apiRouter.get('/leaderboard/country/:code', (req: Request, res: Response) => {
  const countryCode = req.params.code.toUpperCase();
  const timeframe = (req.query.timeframe as LeaderboardTimeframe) || 'all';
  const limit = parseInt(req.query.limit as string, 10) || 50;
  const offset = parseInt(req.query.offset as string, 10) || 0;
  const playerId = (req.query.playerId as string) || '';

  const { entries, total } = db.getCountryLeaderboard(countryCode, { timeframe, limit, offset });
  const podiumQuery = db.getCountryLeaderboard(countryCode, { timeframe, limit: 3, offset: 0 });
  const podium = podiumQuery.entries;

  let playerEntry = null;
  let nearbyEntries = undefined;

  if (playerId) {
    const player = db.getPlayer(playerId);
    if (player && player.countryCode === countryCode) {
      const details = db.getPlayerRankDetails(playerId);
      if (details.countryRank !== null && details.bestScore > 0) {
        playerEntry = {
          rank: details.countryRank,
          playerId: player.id,
          username: player.username,
          countryCode: player.countryCode,
          countryName: player.countryName,
          countryFlag: player.countryFlag,
          score: details.bestScore,
          maxCombo: 1,
          zone: 'NEON_CLOUDS',
          gameMode: 'CLASSIC',
          createdAt: player.createdAt,
          isCurrentPlayer: true,
        };
        nearbyEntries = db.getNearbyCompetitors(playerId, 'country');
      }
    }
  }

  res.json({
    category: 'country',
    countryCode,
    timeframe,
    total,
    page: Math.floor(offset / limit) + 1,
    limit,
    entries: entries.map((e) => ({
      ...e,
      isCurrentPlayer: playerId ? e.playerId === playerId : false,
    })),
    podium,
    playerEntry,
    nearbyEntries,
  });
});

// --- Country vs Country Competition Leaderboard ---
apiRouter.get('/leaderboard/countries', (req: Request, res: Response) => {
  const sortBy = (req.query.sortBy as CountrySortMetric) || 'totalScore';
  const countries = db.getCountryCompetition(sortBy);

  const descriptions: Record<CountrySortMetric, string> = {
    totalScore: 'Ranked by aggregate combined score of all players representing this nation',
    averageScore: 'Ranked by average pilot flight efficiency and score per player',
    bestScore: 'Ranked by the national champion highest individual flight record',
    playerCount: 'Ranked by the total active pilot population enrolled for this country',
  };

  const playerCountryCode = (req.query.countryCode as string || '').toUpperCase();
  const playerCountryEntry = playerCountryCode
    ? countries.find((c) => c.countryCode === playerCountryCode) || null
    : null;

  res.json({
    metric: sortBy,
    metricDescription: descriptions[sortBy] || descriptions.totalScore,
    totalCountries: countries.length,
    countries,
    playerCountryEntry,
  });
});

// --- Nearby Competitors ---
apiRouter.get('/leaderboard/nearby/:playerId', (req: Request, res: Response) => {
  const { playerId } = req.params;
  const scope = (req.query.scope as 'world' | 'country') || 'world';
  const nearby = db.getNearbyCompetitors(playerId, scope);
  res.json(nearby);
});

// --- Search Players / Countries ---
apiRouter.get('/leaderboard/search', (req: Request, res: Response) => {
  const query = (req.query.q as string || '').trim();
  if (!query) {
    res.json([]);
    return;
  }
  const results = db.searchLeaderboard(query, 25);
  res.json(results);
});

// --- Real-Time Server-Sent Events (SSE) Stream ---
apiRouter.get('/leaderboard/live', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send initial welcome event
  res.write(
    `data: ${JSON.stringify({
      id: `ev_welcome_${Date.now()}`,
      type: 'CONNECT',
      message: 'Connected to Sky Hopper Real-time Radar',
      timestamp: Date.now(),
    })}\n\n`
  );

  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

// Create express app wrapping apiRouter for Vite middleware / standalone
export const apiApp = express();
apiApp.use('/api', apiRouter);
// Also route if mounted directly at root
apiApp.use('/', apiRouter);
