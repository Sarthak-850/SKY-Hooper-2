/**
 * User & Profile Management Service
 * Calculates dynamic world/country rankings, profile updates with country change safeguards,
 * game history, and user statistics.
 */

import { db } from '../database/index.ts';
import { PlayerProfileWithRanks, GameHistoryItem, PlayerStatsResponse } from '../types/index.ts';
import { findCountry } from '../utils/countries.ts';
import { config } from '../config/env.ts';
import { recalculateCountryStats } from '../database/seed.ts';

export class UserService {
  /**
   * Fetch user profile along with exact dynamically calculated world and country ranks
   */
  public async getProfileWithRanks(userId: string): Promise<PlayerProfileWithRanks> {
    const res = await db.query(
      `SELECT 
        p.id,
        p.user_id AS "userId",
        u.username,
        p.display_name AS "displayName",
        p.country_code AS "countryCode",
        p.country_name AS "countryName",
        p.avatar,
        p.best_score AS "bestScore",
        p.total_games AS "totalGames",
        p.total_score AS "totalScore",
        p.created_at AS "createdAt",
        p.updated_at AS "updatedAt",
        (SELECT COUNT(*) + 1 FROM player_profiles WHERE best_score > p.best_score) AS "worldRank",
        (SELECT COUNT(*) + 1 FROM player_profiles WHERE country_code = p.country_code AND best_score > p.best_score) AS "countryRank"
       FROM player_profiles p
       JOIN users u ON u.id = p.user_id
       WHERE p.user_id = $1`,
      [userId]
    );

    if (res.rows.length === 0) {
      throw { status: 404, code: 'USER_NOT_FOUND', message: 'Player profile not found.' };
    }

    const row = res.rows[0];
    const country = findCountry(row.countryCode);

    return {
      ...row,
      worldRank: parseInt(row.worldRank, 10),
      countryRank: parseInt(row.countryRank, 10),
      countryFlag: country.flag,
    };
  }

  /**
   * Update profile (display name, avatar, country) with anti-manipulation cooldowns
   */
  public async updateProfile(
    userId: string,
    updates: {
      displayName?: string;
      avatar?: string;
      countryCode?: string;
    }
  ): Promise<PlayerProfileWithRanks> {
    const profileRes = await db.query(
      'SELECT id, country_code, last_country_change_at FROM player_profiles WHERE user_id = $1',
      [userId]
    );

    if (profileRes.rows.length === 0) {
      throw { status: 404, code: 'USER_NOT_FOUND', message: 'User profile does not exist.' };
    }

    const currentProfile = profileRes.rows[0];
    let newCountryCode = currentProfile.country_code;
    let newCountryName: string | undefined = undefined;
    let updateCountryTimestamp = false;

    // Check country change and cooldown safeguard
    if (updates.countryCode && updates.countryCode.toUpperCase() !== currentProfile.country_code) {
      const targetCountry = findCountry(updates.countryCode);
      newCountryCode = targetCountry.code;
      newCountryName = targetCountry.name;

      if (currentProfile.last_country_change_at) {
        const lastChange = new Date(currentProfile.last_country_change_at).getTime();
        const cooldownMs = config.antiCheat.countryChangeCooldownHours * 3600 * 1000;
        const timePassed = Date.now() - lastChange;

        if (timePassed < cooldownMs) {
          const remainingHours = Math.ceil((cooldownMs - timePassed) / (3600 * 1000));
          throw {
            status: 429,
            code: 'COUNTRY_CHANGE_COOLDOWN',
            message: `Country changes are limited to prevent ranking manipulation. Please wait ${remainingHours} hour(s) before changing country again.`,
          };
        }
      }
      updateCountryTimestamp = true;
    }

    // Apply updates in a transaction
    await db.transaction(async (tx) => {
      if (updates.displayName || updates.avatar || newCountryName) {
        await tx.query(
          `UPDATE users
           SET country_code = COALESCE($1, country_code),
               country_name = COALESCE($2, country_name),
               avatar = COALESCE($3, avatar),
               updated_at = NOW()
           WHERE id = $4`,
          [newCountryCode, newCountryName, updates.avatar, userId]
        );

        await tx.query(
          `UPDATE player_profiles
           SET display_name = COALESCE($1, display_name),
               country_code = COALESCE($2, country_code),
               country_name = COALESCE($3, country_name),
               avatar = COALESCE($4, avatar),
               last_country_change_at = CASE WHEN $5::BOOLEAN THEN NOW() ELSE last_country_change_at END,
               updated_at = NOW()
           WHERE user_id = $6`,
          [
            updates.displayName?.trim() || null,
            newCountryCode,
            newCountryName,
            updates.avatar || null,
            updateCountryTimestamp,
            userId,
          ]
        );
      }
    });

    if (updateCountryTimestamp) {
      recalculateCountryStats().catch((err) => console.warn('Recalculate country stats error:', err));
    }

    return this.getProfileWithRanks(userId);
  }

  /**
   * Get user's game history with pagination
   */
  public async getUserGames(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ games: GameHistoryItem[]; total: number; page: number; totalPages: number }> {
    const pageNum = Math.max(1, page);
    const limitNum = Math.min(100, Math.max(1, limit));
    const offset = (pageNum - 1) * limitNum;

    const countRes = await db.query(
      'SELECT COUNT(*)::INTEGER as count FROM game_sessions WHERE user_id = $1',
      [userId]
    );
    const total = countRes.rows[0]?.count || 0;

    const res = await db.query(
      `SELECT 
        id,
        COALESCE(final_score, 0)::INTEGER AS score,
        COALESCE(duration, 0)::REAL AS duration,
        validation_status AS "validationStatus",
        started_at AS "date"
       FROM game_sessions
       WHERE user_id = $1
       ORDER BY started_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limitNum, offset]
    );

    const games: GameHistoryItem[] = res.rows.map((r) => ({
      id: r.id,
      score: r.score,
      duration: Math.round(r.duration),
      validationStatus: r.validationStatus,
      date: new Date(r.date).toISOString(),
    }));

    return {
      games,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    };
  }

  /**
   * Calculate aggregated player statistics strictly from valid game records
   */
  public async getUserStats(userId: string): Promise<PlayerStatsResponse> {
    const profile = await this.getProfileWithRanks(userId);

    const statsRes = await db.query(
      `SELECT 
        COALESCE(MAX(final_score), 0)::INTEGER AS "bestScore",
        COUNT(*)::INTEGER AS "totalGames",
        COALESCE(AVG(final_score), 0)::REAL AS "averageScore",
        COALESCE(SUM(final_score), 0)::BIGINT AS "totalScore",
        COUNT(CASE WHEN started_at >= NOW() - INTERVAL '7 days' THEN 1 END)::INTEGER AS "gamesThisWeek",
        COUNT(CASE WHEN started_at >= NOW() - INTERVAL '30 days' THEN 1 END)::INTEGER AS "gamesThisMonth"
       FROM game_sessions
       WHERE user_id = $1 AND validation_status = 'VALID'`,
      [userId]
    );

    const stats = statsRes.rows[0];

    return {
      bestScore: Math.max(profile.bestScore, stats?.bestScore || 0),
      totalGames: stats?.totalGames || profile.totalGames,
      averageScore: Math.round(stats?.averageScore || 0),
      totalScore: Number(stats?.totalScore || profile.totalScore),
      worldRank: profile.worldRank,
      countryRank: profile.countryRank,
      gamesThisWeek: stats?.gamesThisWeek || 0,
      gamesThisMonth: stats?.gamesThisMonth || 0,
    };
  }
}

export const userService = new UserService();
