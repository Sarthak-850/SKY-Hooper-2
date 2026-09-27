/**
 * Game Session & Server-Authoritative Score Validation Service
 * Manages game sessions, validates gameplay physics & score progression,
 * updates personal bests, and triggers real-time leaderboard broadcast events.
 */

import crypto from 'crypto';
import { db } from '../database/index.ts';
import { config } from '../config/env.ts';
import { userService } from './userService.ts';
import { findCountry } from '../utils/countries.ts';
import { recalculateCountryStats } from '../database/seed.ts';

export interface ScoreSubmissionResult {
  success: boolean;
  score: number;
  isNewBest: boolean;
  previousBest: number;
  worldRank: number;
  countryRank: number;
  message?: string;
  flagged?: boolean;
}

export type LeaderboardEventListener = (event: {
  type: string;
  player: string;
  country: string;
  flag: string;
  score: number;
  worldRank: number;
  timestamp: number;
}) => void;

class GameService {
  private eventListeners: Set<LeaderboardEventListener> = new Set();

  public onLeaderboardUpdate(listener: LeaderboardEventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  private broadcastUpdate(event: {
    type: string;
    player: string;
    country: string;
    flag: string;
    score: number;
    worldRank: number;
    timestamp: number;
  }) {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (err) {
        console.warn('Leaderboard update listener error:', err);
      }
    }
  }

  /**
   * Start a secure game session for an authenticated player
   */
  public async startSession(
    userId: string,
    gameMode: string = 'CLASSIC'
  ): Promise<{ sessionId: string; serverTimestamp: number; sessionConfig: any }> {
    const sessionId = `sess_${crypto.randomUUID()}`;
    const serverTimestamp = Date.now();

    // Check if player has excessive unclosed sessions in the past 5 minutes (rate limit abuse check)
    const recentSessionsRes = await db.query(
      `SELECT COUNT(*)::INTEGER AS count
       FROM game_sessions
       WHERE user_id = $1 AND started_at >= NOW() - INTERVAL '5 minutes' AND status = 'ACTIVE'`,
      [userId]
    );

    const activeCount = recentSessionsRes.rows[0]?.count || 0;
    if (activeCount >= config.antiCheat.maxRapidSubmissionsPerMin) {
      throw {
        status: 429,
        code: 'TOO_MANY_SESSIONS',
        message: 'Too many rapid game sessions started. Please wait before starting another game.',
      };
    }

    // Insert game session
    await db.query(
      `INSERT INTO game_sessions (id, user_id, started_at, status, validation_status, created_at)
       VALUES ($1, $2, NOW(), 'ACTIVE', 'PENDING', NOW())`,
      [sessionId, userId]
    );

    return {
      sessionId,
      serverTimestamp,
      sessionConfig: {
        gameMode,
        maxScoreRate: config.antiCheat.maxScoreRatePerSec,
        minDuration: config.antiCheat.minGameDurationSec,
      },
    };
  }

  /**
   * Complete game session with comprehensive server-side score and anti-cheat validation
   */
  public async finishSession(
    userId: string,
    params: {
      sessionId: string;
      score: number;
      duration: number;
      metrics?: {
        maxCombo?: number;
        perfectGates?: number;
        nearMisses?: number;
        stars?: number;
      };
    }
  ): Promise<ScoreSubmissionResult> {
    const { sessionId, score, duration } = params;

    // 1. Basic Type Validation
    if (typeof score !== 'number' || !Number.isFinite(score) || score < 0) {
      throw { status: 400, code: 'INVALID_SCORE', message: 'Score must be a positive number.' };
    }
    const cleanScore = Math.floor(score);

    if (typeof duration !== 'number' || !Number.isFinite(duration) || duration < 0) {
      throw { status: 400, code: 'INVALID_DURATION', message: 'Game duration must be a valid number.' };
    }

    // 2. Fetch Session from Database
    const sessionRes = await db.query(
      'SELECT id, user_id, started_at, status FROM game_sessions WHERE id = $1',
      [sessionId]
    );

    if (sessionRes.rows.length === 0) {
      throw { status: 404, code: 'SESSION_NOT_FOUND', message: 'Game session does not exist or has expired.' };
    }

    const session = sessionRes.rows[0];

    // 3. Ownership Validation
    if (session.user_id !== userId) {
      throw { status: 403, code: 'UNAUTHORIZED_SESSION', message: 'Game session does not belong to authenticated user.' };
    }

    // 4. Session Status Check (prevent replay / duplicate submission)
    if (session.status !== 'ACTIVE') {
      throw { status: 409, code: 'SESSION_ALREADY_COMPLETED', message: 'This game session has already been completed and scored.' };
    }

    // Check duplicate in scores table
    const scoreCheck = await db.query('SELECT id FROM scores WHERE game_session_id = $1', [sessionId]);
    if (scoreCheck.rows.length > 0) {
      throw { status: 409, code: 'DUPLICATE_SUBMISSION', message: 'A score for this session has already been recorded.' };
    }

    // 5. Anti-Cheat & Physics Validation
    const antiCheatFlags: string[] = [];
    let isSuspicious = false;
    let isRejected = false;

    // Check 5a: Absolute impossible score
    if (cleanScore > config.antiCheat.maxAbsoluteScore) {
      antiCheatFlags.push(`EXCEEDS_MAX_ABSOLUTE_SCORE (${cleanScore} > ${config.antiCheat.maxAbsoluteScore})`);
      isRejected = true;
    }

    // Check 5b: Minimum duration check for meaningful scores
    const serverDuration = (Date.now() - new Date(session.started_at).getTime()) / 1000;
    const effectiveDuration = Math.max(duration, serverDuration);

    if (cleanScore > 500 && effectiveDuration < config.antiCheat.minGameDurationSec) {
      antiCheatFlags.push(`DURATION_TOO_SHORT (${effectiveDuration.toFixed(1)}s for score ${cleanScore})`);
      isRejected = true;
    }

    // Check 5c: Score/Time rate check
    // Max theoretical score rate in Sky Hopper with maximum 10x combo and star multipliers is ~150-180 pts/sec.
    // Anything above config.antiCheat.maxScoreRatePerSec (default 220) is physically impossible.
    const scoreRate = effectiveDuration > 0 ? cleanScore / effectiveDuration : cleanScore;
    if (cleanScore > 300 && scoreRate > config.antiCheat.maxScoreRatePerSec) {
      antiCheatFlags.push(`IMPOSSIBLE_SCORE_RATE (${scoreRate.toFixed(1)} pts/sec > max ${config.antiCheat.maxScoreRatePerSec})`);
      isRejected = true;
    }

    // Check 5d: Negative or timestamp distortion
    if (duration < 0 || serverDuration < -5) {
      antiCheatFlags.push('NEGATIVE_OR_DISTORTED_TIMESTAMP');
      isRejected = true;
    }

    if (isRejected) {
      // Mark session as REJECTED in database for audit trail
      await db.query(
        `UPDATE game_sessions
         SET ended_at = NOW(),
             final_score = $1,
             duration = $2,
             status = 'COMPLETED',
             validation_status = 'REJECTED',
             anti_cheat_flags = $3
         WHERE id = $4`,
        [cleanScore, duration, antiCheatFlags.join('; '), sessionId]
      );

      throw {
        status: 400,
        code: 'INVALID_SCORE_PROGRESSION',
        message: 'The submitted score could not be validated. Score progression exceeds physical game boundaries.',
        details: antiCheatFlags,
      };
    }

    // 6. Record Valid/Verified Score
    const scoreId = `scr_${crypto.randomUUID()}`;
    const userProfile = await userService.getProfileWithRanks(userId);
    const country = findCountry(userProfile.countryCode);

    let isNewBest = false;
    const previousBest = userProfile.bestScore;

    await db.transaction(async (tx) => {
      // Update session to COMPLETED & VALID
      await tx.query(
        `UPDATE game_sessions
         SET ended_at = NOW(),
             final_score = $1,
             duration = $2,
             status = 'COMPLETED',
             validation_status = 'VALID',
             anti_cheat_flags = $3
         WHERE id = $4`,
        [cleanScore, duration, antiCheatFlags.length > 0 ? antiCheatFlags.join('; ') : null, sessionId]
      );

      // Insert score entry
      await tx.query(
        `INSERT INTO scores (id, user_id, game_session_id, score, country_code, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [scoreId, userId, sessionId, cleanScore, country.code]
      );

      // Update player profile statistics (total games, total score, best score)
      if (cleanScore > previousBest) {
        isNewBest = true;
        await tx.query(
          `UPDATE player_profiles
           SET best_score = $1,
               total_games = total_games + 1,
               total_score = total_score + $2,
               updated_at = NOW()
           WHERE user_id = $3`,
          [cleanScore, cleanScore, userId]
        );
      } else {
        await tx.query(
          `UPDATE player_profiles
           SET total_games = total_games + 1,
               total_score = total_score + $1,
               updated_at = NOW()
           WHERE user_id = $2`,
          [cleanScore, userId]
        );
      }
    });

    // Recalculate country totals safely
    recalculateCountryStats().catch((err) => console.warn('Recalculate country stats error:', err));

    // Calculate updated ranks
    const updatedProfile = await userService.getProfileWithRanks(userId);

    // If new personal best, broadcast real-time event to connected clients!
    if (isNewBest) {
      this.broadcastUpdate({
        type: 'NEW_HIGH_SCORE',
        player: userProfile.displayName,
        country: country.code,
        flag: country.flag,
        score: cleanScore,
        worldRank: updatedProfile.worldRank,
        timestamp: Date.now(),
      });
    }

    return {
      success: true,
      score: cleanScore,
      isNewBest,
      previousBest,
      worldRank: updatedProfile.worldRank,
      countryRank: updatedProfile.countryRank,
      message: isNewBest ? '🎉 New Personal Best achieved!' : 'Score recorded successfully.',
      flagged: isSuspicious,
    };
  }
}

export const gameService = new GameService();
