/**
 * Sky Hopper - SQLite Database Architecture using Node.js DatabaseSync
 */

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import {
  PlayerProfile,
  LeaderboardEntry,
  LeaderboardTimeframe,
  CountryCompetitionEntry,
  CountrySortMetric,
} from '../src/types/leaderboard.ts';

// Path for persistent database file
const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const DB_PATH = path.join(DATA_DIR, 'skyhooper.sqlite');

export class LeaderboardDatabase {
  private db: DatabaseSync;

  constructor(customPath?: string) {
    this.db = new DatabaseSync(customPath || DB_PATH);
    this.init();
  }

  private init() {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;

      CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        country_code TEXT NOT NULL,
        country_name TEXT NOT NULL,
        country_flag TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS scores (
        id TEXT PRIMARY KEY,
        player_id TEXT NOT NULL REFERENCES players(id),
        score INTEGER NOT NULL,
        max_combo INTEGER NOT NULL DEFAULT 1,
        perfect_gates INTEGER NOT NULL DEFAULT 0,
        near_misses INTEGER NOT NULL DEFAULT 0,
        stars INTEGER NOT NULL DEFAULT 0,
        coins INTEGER NOT NULL DEFAULT 0,
        duration_seconds REAL NOT NULL DEFAULT 0,
        zone_reached TEXT NOT NULL DEFAULT 'NEON_CLOUDS',
        game_mode TEXT NOT NULL DEFAULT 'CLASSIC',
        session_id TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS player_bests (
        player_id TEXT PRIMARY KEY REFERENCES players(id),
        best_score INTEGER NOT NULL,
        best_score_id TEXT NOT NULL REFERENCES scores(id),
        country_code TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS game_sessions (
        session_id TEXT PRIMARY KEY,
        player_id TEXT NOT NULL,
        start_time INTEGER NOT NULL,
        token TEXT NOT NULL,
        used INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_players_country ON players(country_code);
      CREATE INDEX IF NOT EXISTS idx_players_username ON players(username COLLATE NOCASE);
      CREATE INDEX IF NOT EXISTS idx_scores_player ON scores(player_id);
      CREATE INDEX IF NOT EXISTS idx_scores_score_desc ON scores(score DESC);
      CREATE INDEX IF NOT EXISTS idx_scores_created_at ON scores(created_at);
      CREATE INDEX IF NOT EXISTS idx_scores_session ON scores(session_id);
      CREATE INDEX IF NOT EXISTS idx_bests_score ON player_bests(best_score DESC);
      CREATE INDEX IF NOT EXISTS idx_bests_country_score ON player_bests(country_code, best_score DESC);
    `);
  }

  // --- Players ---

  public upsertPlayer(player: {
    id: string;
    username: string;
    countryCode: string;
    countryName: string;
    countryFlag: string;
  }): PlayerProfile {
    const now = Date.now();
    const existing = this.getPlayer(player.id);

    if (existing) {
      const stmt = this.db.prepare(`
        UPDATE players
        SET username = ?, country_code = ?, country_name = ?, country_flag = ?, updated_at = ?
        WHERE id = ?
      `);
      stmt.run(player.username, player.countryCode, player.countryName, player.countryFlag, now, player.id);

      // Also update country_code in player_bests if best exists
      const updateBest = this.db.prepare(`
        UPDATE player_bests
        SET country_code = ?
        WHERE player_id = ?
      `);
      updateBest.run(player.countryCode, player.id);

      return {
        id: player.id,
        username: player.username,
        countryCode: player.countryCode,
        countryName: player.countryName,
        countryFlag: player.countryFlag,
        createdAt: existing.createdAt,
        updatedAt: now,
      };
    } else {
      const stmt = this.db.prepare(`
        INSERT INTO players (id, username, country_code, country_name, country_flag, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(player.id, player.username, player.countryCode, player.countryName, player.countryFlag, now, now);

      return {
        id: player.id,
        username: player.username,
        countryCode: player.countryCode,
        countryName: player.countryName,
        countryFlag: player.countryFlag,
        createdAt: now,
        updatedAt: now,
      };
    }
  }

  public getPlayer(id: string): PlayerProfile | null {
    const stmt = this.db.prepare(`
      SELECT id, username, country_code as countryCode, country_name as countryName, country_flag as countryFlag, created_at as createdAt, updated_at as updatedAt
      FROM players
      WHERE id = ?
    `);
    const row = stmt.get(id) as unknown as PlayerProfile | undefined;
    return row || null;
  }

  public getPlayerCount(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM players');
    const row = stmt.get() as { count: number };
    return row.count;
  }

  // --- Sessions & Anti-Cheat ---

  public createSession(sessionId: string, playerId: string, token: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO game_sessions (session_id, player_id, start_time, token, used)
      VALUES (?, ?, ?, ?, 0)
    `);
    stmt.run(sessionId, playerId, Date.now(), token);
  }

  public getSession(sessionId: string): { session_id: string; player_id: string; start_time: number; token: string; used: number } | null {
    const stmt = this.db.prepare('SELECT * FROM game_sessions WHERE session_id = ?');
    const row = stmt.get(sessionId) as unknown as { session_id: string; player_id: string; start_time: number; token: string; used: number } | undefined;
    return row || null;
  }

  public markSessionUsed(sessionId: string): void {
    const stmt = this.db.prepare('UPDATE game_sessions SET used = 1 WHERE session_id = ?');
    stmt.run(sessionId);
  }

  // --- Scores ---

  public recordScore(data: {
    id: string;
    playerId: string;
    score: number;
    maxCombo: number;
    perfectGates: number;
    nearMisses: number;
    stars: number;
    coins: number;
    durationSeconds: number;
    zoneReached: string;
    gameMode: string;
    sessionId: string;
    createdAt?: number;
  }): {
    isNewBest: boolean;
    previousBest: number;
    newBest: number;
    previousWorldRank: number | null;
    newWorldRank: number;
    previousCountryRank: number | null;
    newCountryRank: number;
  } {
    const now = data.createdAt || Date.now();
    const player = this.getPlayer(data.playerId);
    if (!player) {
      throw new Error(`Player ${data.playerId} not found`);
    }

    // Previous best & ranks
    const bestStmt = this.db.prepare('SELECT best_score, best_score_id FROM player_bests WHERE player_id = ?');
    const bestRow = bestStmt.get(data.playerId) as { best_score: number; best_score_id: string } | undefined;
    const previousBest = bestRow ? bestRow.best_score : 0;
    const previousWorldRank = bestRow ? this.getWorldRankByScore(previousBest) : null;
    const previousCountryRank = bestRow ? this.getCountryRankByScore(player.countryCode, previousBest) : null;

    // Insert score
    const insertScore = this.db.prepare(`
      INSERT INTO scores (
        id, player_id, score, max_combo, perfect_gates, near_misses,
        stars, coins, duration_seconds, zone_reached, game_mode, session_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertScore.run(
      data.id,
      data.playerId,
      data.score,
      data.maxCombo,
      data.perfectGates,
      data.nearMisses,
      data.stars,
      data.coins,
      data.durationSeconds,
      data.zoneReached,
      data.gameMode,
      data.sessionId,
      now
    );

    const isNewBest = !bestRow || data.score > bestRow.best_score;
    let newBest = previousBest;

    if (isNewBest) {
      newBest = data.score;
      const upsertBest = this.db.prepare(`
        INSERT INTO player_bests (player_id, best_score, best_score_id, country_code, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(player_id) DO UPDATE SET
          best_score = excluded.best_score,
          best_score_id = excluded.best_score_id,
          country_code = excluded.country_code,
          updated_at = excluded.updated_at
      `);
      upsertBest.run(data.playerId, data.score, data.id, player.countryCode, now);
    }

    const newWorldRank = this.getWorldRankByScore(newBest);
    const newCountryRank = this.getCountryRankByScore(player.countryCode, newBest);

    return {
      isNewBest,
      previousBest,
      newBest,
      previousWorldRank,
      newWorldRank,
      previousCountryRank,
      newCountryRank,
    };
  }

  // --- Ranks Calculation ---

  public getWorldRankByScore(score: number): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as rankHigher FROM player_bests WHERE best_score > ?');
    const row = stmt.get(score) as { rankHigher: number };
    return row.rankHigher + 1;
  }

  public getCountryRankByScore(countryCode: string, score: number): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as rankHigher
      FROM player_bests
      WHERE country_code = ? AND best_score > ?
    `);
    const row = stmt.get(countryCode, score) as { rankHigher: number };
    return row.rankHigher + 1;
  }

  public getPlayerRankDetails(playerId: string): {
    bestScore: number;
    worldRank: number | null;
    countryRank: number | null;
    totalWorldPlayers: number;
    totalCountryPlayers: number;
    totalRuns: number;
  } {
    const player = this.getPlayer(playerId);
    if (!player) {
      return {
        bestScore: 0,
        worldRank: null,
        countryRank: null,
        totalWorldPlayers: 0,
        totalCountryPlayers: 0,
        totalRuns: 0,
      };
    }

    const bestStmt = this.db.prepare('SELECT best_score FROM player_bests WHERE player_id = ?');
    const bestRow = bestStmt.get(playerId) as { best_score: number } | undefined;

    const runsStmt = this.db.prepare('SELECT COUNT(*) as runCount FROM scores WHERE player_id = ?');
    const runsRow = runsStmt.get(playerId) as { runCount: number };

    const totalWorldStmt = this.db.prepare('SELECT COUNT(*) as count FROM player_bests');
    const totalWorld = (totalWorldStmt.get() as { count: number }).count;

    const totalCountryStmt = this.db.prepare('SELECT COUNT(*) as count FROM player_bests WHERE country_code = ?');
    const totalCountry = (totalCountryStmt.get(player.countryCode) as { count: number }).count;

    if (!bestRow) {
      return {
        bestScore: 0,
        worldRank: null,
        countryRank: null,
        totalWorldPlayers: totalWorld,
        totalCountryPlayers: totalCountry,
        totalRuns: runsRow.runCount,
      };
    }

    const bestScore = bestRow.best_score;
    const worldRank = this.getWorldRankByScore(bestScore);
    const countryRank = this.getCountryRankByScore(player.countryCode, bestScore);

    return {
      bestScore,
      worldRank,
      countryRank,
      totalWorldPlayers: totalWorld,
      totalCountryPlayers: totalCountry,
      totalRuns: runsRow.runCount,
    };
  }

  // --- Leaderboards ---

  public getWorldLeaderboard(options: {
    timeframe?: LeaderboardTimeframe;
    limit?: number;
    offset?: number;
  }): { entries: LeaderboardEntry[]; total: number } {
    const timeframe = options.timeframe || 'all';
    const limit = Math.min(options.limit || 50, 100);
    const offset = Math.max(options.offset || 0, 0);

    if (timeframe === 'all') {
      const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM player_bests');
      const total = (countStmt.get() as { count: number }).count;

      const stmt = this.db.prepare(`
        SELECT
          p.id as playerId,
          p.username,
          p.country_code as countryCode,
          p.country_name as countryName,
          p.country_flag as countryFlag,
          b.best_score as score,
          s.max_combo as maxCombo,
          s.zone_reached as zone,
          s.game_mode as gameMode,
          s.created_at as createdAt
        FROM player_bests b
        JOIN players p ON b.player_id = p.id
        JOIN scores s ON b.best_score_id = s.id
        ORDER BY b.best_score DESC, b.updated_at ASC
        LIMIT ? OFFSET ?
      `);
      const rows = stmt.all(limit, offset) as unknown as Omit<LeaderboardEntry, 'rank'>[];
      const entries: LeaderboardEntry[] = rows.map((r, idx) => ({
        ...r,
        rank: offset + idx + 1,
      }));

      return { entries, total };
    } else {
      const since = this.getTimeframeSince(timeframe);
      const countStmt = this.db.prepare(`
        SELECT COUNT(DISTINCT player_id) as count
        FROM scores
        WHERE created_at >= ?
      `);
      const total = (countStmt.get(since) as { count: number }).count;

      const stmt = this.db.prepare(`
        SELECT
          p.id as playerId,
          p.username,
          p.country_code as countryCode,
          p.country_name as countryName,
          p.country_flag as countryFlag,
          MAX(s.score) as score,
          MAX(s.max_combo) as maxCombo,
          s.zone_reached as zone,
          s.game_mode as gameMode,
          MAX(s.created_at) as createdAt
        FROM scores s
        JOIN players p ON s.player_id = p.id
        WHERE s.created_at >= ?
        GROUP BY s.player_id
        ORDER BY score DESC, createdAt ASC
        LIMIT ? OFFSET ?
      `);
      const rows = stmt.all(since, limit, offset) as unknown as Omit<LeaderboardEntry, 'rank'>[];
      const entries: LeaderboardEntry[] = rows.map((r, idx) => ({
        ...r,
        rank: offset + idx + 1,
      }));

      return { entries, total };
    }
  }

  public getCountryLeaderboard(countryCode: string, options: {
    timeframe?: LeaderboardTimeframe;
    limit?: number;
    offset?: number;
  }): { entries: LeaderboardEntry[]; total: number } {
    const timeframe = options.timeframe || 'all';
    const limit = Math.min(options.limit || 50, 100);
    const offset = Math.max(options.offset || 0, 0);
    const code = countryCode.toUpperCase();

    if (timeframe === 'all') {
      const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM player_bests WHERE country_code = ?');
      const total = (countStmt.get(code) as { count: number }).count;

      const stmt = this.db.prepare(`
        SELECT
          p.id as playerId,
          p.username,
          p.country_code as countryCode,
          p.country_name as countryName,
          p.country_flag as countryFlag,
          b.best_score as score,
          s.max_combo as maxCombo,
          s.zone_reached as zone,
          s.game_mode as gameMode,
          s.created_at as createdAt
        FROM player_bests b
        JOIN players p ON b.player_id = p.id
        JOIN scores s ON b.best_score_id = s.id
        WHERE b.country_code = ?
        ORDER BY b.best_score DESC, b.updated_at ASC
        LIMIT ? OFFSET ?
      `);
      const rows = stmt.all(code, limit, offset) as unknown as Omit<LeaderboardEntry, 'rank'>[];
      const entries: LeaderboardEntry[] = rows.map((r, idx) => ({
        ...r,
        rank: offset + idx + 1,
      }));

      return { entries, total };
    } else {
      const since = this.getTimeframeSince(timeframe);
      const countStmt = this.db.prepare(`
        SELECT COUNT(DISTINCT s.player_id) as count
        FROM scores s
        JOIN players p ON s.player_id = p.id
        WHERE p.country_code = ? AND s.created_at >= ?
      `);
      const total = (countStmt.get(code, since) as { count: number }).count;

      const stmt = this.db.prepare(`
        SELECT
          p.id as playerId,
          p.username,
          p.country_code as countryCode,
          p.country_name as countryName,
          p.country_flag as countryFlag,
          MAX(s.score) as score,
          MAX(s.max_combo) as maxCombo,
          s.zone_reached as zone,
          s.game_mode as gameMode,
          MAX(s.created_at) as createdAt
        FROM scores s
        JOIN players p ON s.player_id = p.id
        WHERE p.country_code = ? AND s.created_at >= ?
        GROUP BY s.player_id
        ORDER BY score DESC, createdAt ASC
        LIMIT ? OFFSET ?
      `);
      const rows = stmt.all(code, since, limit, offset) as unknown as Omit<LeaderboardEntry, 'rank'>[];
      const entries: LeaderboardEntry[] = rows.map((r, idx) => ({
        ...r,
        rank: offset + idx + 1,
      }));

      return { entries, total };
    }
  }

  public getCountryCompetition(sortBy: CountrySortMetric = 'totalScore'): CountryCompetitionEntry[] {
    const stmt = this.db.prepare(`
      SELECT
        p.country_code as countryCode,
        p.country_name as countryName,
        p.country_flag as countryFlag,
        COUNT(DISTINCT p.id) as playerCount,
        SUM(b.best_score) as totalScore,
        ROUND(AVG(b.best_score), 0) as averageScore,
        MAX(b.best_score) as bestScore
      FROM player_bests b
      JOIN players p ON b.player_id = p.id
      GROUP BY p.country_code
    `);
    const rows = stmt.all() as {
      countryCode: string;
      countryName: string;
      countryFlag: string;
      playerCount: number;
      totalScore: number;
      averageScore: number;
      bestScore: number;
    }[];

    // Find best player name per country
    const bestPlayerStmt = this.db.prepare(`
      SELECT p.username
      FROM player_bests b
      JOIN players p ON b.player_id = p.id
      WHERE b.country_code = ?
      ORDER BY b.best_score DESC
      LIMIT 1
    `);

    // Sort according to metric
    rows.sort((a, b) => {
      if (sortBy === 'averageScore') return b.averageScore - a.averageScore;
      if (sortBy === 'bestScore') return b.bestScore - a.bestScore;
      if (sortBy === 'playerCount') return b.playerCount - a.playerCount;
      return b.totalScore - a.totalScore;
    });

    return rows.map((row, idx) => {
      const bp = bestPlayerStmt.get(row.countryCode) as { username: string } | undefined;
      return {
        rank: idx + 1,
        countryCode: row.countryCode,
        countryName: row.countryName,
        countryFlag: row.countryFlag,
        playerCount: Number(row.playerCount),
        totalScore: Number(row.totalScore),
        averageScore: Number(row.averageScore),
        bestScore: Number(row.bestScore),
        bestPlayerName: bp?.username || 'Top Pilot',
      };
    });
  }

  public getNearbyCompetitors(playerId: string, scope: 'world' | 'country' = 'world'): LeaderboardEntry[] {
    const player = this.getPlayer(playerId);
    if (!player) return [];

    const bestStmt = this.db.prepare('SELECT best_score FROM player_bests WHERE player_id = ?');
    const best = bestStmt.get(playerId) as { best_score: number } | undefined;
    if (!best) return [];

    const rank = scope === 'world'
      ? this.getWorldRankByScore(best.best_score)
      : this.getCountryRankByScore(player.countryCode, best.best_score);

    const offset = Math.max(0, rank - 3);
    const limit = 5;

    const query = scope === 'world'
      ? this.getWorldLeaderboard({ limit, offset })
      : this.getCountryLeaderboard(player.countryCode, { limit, offset });

    return query.entries.map((entry) => ({
      ...entry,
      isCurrentPlayer: entry.playerId === playerId,
    }));
  }

  public searchLeaderboard(query: string, limit: number = 20): (LeaderboardEntry & { countryRank: number; worldRank: number })[] {
    const searchPattern = `%${query.trim()}%`;
    const stmt = this.db.prepare(`
      SELECT
        p.id as playerId,
        p.username,
        p.country_code as countryCode,
        p.country_name as countryName,
        p.country_flag as countryFlag,
        b.best_score as score,
        s.max_combo as maxCombo,
        s.zone_reached as zone,
        s.game_mode as gameMode,
        s.created_at as createdAt
      FROM player_bests b
      JOIN players p ON b.player_id = p.id
      JOIN scores s ON b.best_score_id = s.id
      WHERE p.username LIKE ? OR p.country_name LIKE ? OR p.country_code LIKE ?
      ORDER BY b.best_score DESC
      LIMIT ?
    `);

    const rows = stmt.all(searchPattern, searchPattern, searchPattern, limit) as unknown as Omit<LeaderboardEntry, 'rank'>[];

    return rows.map((r) => {
      const worldRank = this.getWorldRankByScore(r.score);
      const countryRank = this.getCountryRankByScore(r.countryCode, r.score);
      return {
        ...r,
        rank: worldRank,
        worldRank,
        countryRank,
      };
    });
  }

  private getTimeframeSince(timeframe: LeaderboardTimeframe): number {
    const now = new Date();
    if (timeframe === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      return startOfDay;
    }
    if (timeframe === 'week') {
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime();
      return startOfWeek;
    }
    if (timeframe === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      return startOfMonth;
    }
    return 0;
  }
}

export const db = new LeaderboardDatabase();
