/**
 * Leaderboards & Country Competition Service
 * Database-backed queries for world rankings, country rankings, country vs country battle,
 * contextual nearby player brackets, and indexed search.
 */

import { db } from '../database/index.ts';
import {
  WorldLeaderboardEntry,
  CountryLeaderboardEntry,
  CountryCompetitionEntry,
  PlayerRankResponse,
} from '../types/index.ts';
import { findCountry } from '../utils/countries.ts';

export class LeaderboardService {
  /**
   * World Leaderboard (Paginated)
   */
  public async getWorldLeaderboard(params: {
    page?: number;
    limit?: number;
    search?: string;
  } = {}): Promise<{
    entries: WorldLeaderboardEntry[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 50));
    const offset = (page - 1) * limit;
    const search = params.search ? `%${params.search.trim().toLowerCase()}%` : null;

    let countSql = 'SELECT COUNT(*)::INTEGER AS total FROM player_profiles';
    const countParams: any[] = [];
    if (search) {
      countSql += ' WHERE LOWER(display_name) LIKE $1';
      countParams.push(search);
    }
    const countRes = await db.query(countSql, countParams);
    const total = countRes.rows[0]?.total || 0;

    let querySql = `
      WITH ranked AS (
        SELECT 
          p.id,
          p.user_id,
          u.username,
          p.display_name,
          p.country_code,
          p.country_name,
          p.avatar,
          p.best_score,
          p.updated_at,
          DENSE_RANK() OVER (ORDER BY p.best_score DESC, p.created_at ASC) AS rank
        FROM player_profiles p
        JOIN users u ON u.id = p.user_id
      )
      SELECT * FROM ranked
    `;

    const queryParams: any[] = [];
    if (search) {
      querySql += ' WHERE LOWER(display_name) LIKE $1';
      queryParams.push(search);
    }
    querySql += ` ORDER BY rank ASC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);

    const res = await db.query(querySql, queryParams);

    const entries: WorldLeaderboardEntry[] = res.rows.map((r) => {
      const country = findCountry(r.country_code);
      return {
        rank: parseInt(r.rank, 10),
        playerId: r.user_id,
        username: r.username,
        displayName: r.display_name,
        countryCode: r.country_code,
        countryName: r.country_name,
        countryFlag: country.flag,
        avatar: r.avatar,
        score: r.best_score,
        updatedAt: new Date(r.updated_at).toISOString(),
      };
    });

    return {
      entries,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Country Leaderboard (Paginated, includes both countryRank and worldRank)
   */
  public async getCountryLeaderboard(
    countryCode: string,
    params: { page?: number; limit?: number } = {}
  ): Promise<{
    country: { code: string; name: string; flag: string };
    entries: CountryLeaderboardEntry[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const country = findCountry(countryCode);
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 50));
    const offset = (page - 1) * limit;

    const countRes = await db.query(
      'SELECT COUNT(*)::INTEGER AS total FROM player_profiles WHERE country_code = $1',
      [country.code]
    );
    const total = countRes.rows[0]?.total || 0;

    const res = await db.query(
      `WITH all_ranked AS (
        SELECT 
          p.id,
          p.user_id,
          u.username,
          p.display_name,
          p.country_code,
          p.country_name,
          p.avatar,
          p.best_score,
          DENSE_RANK() OVER (ORDER BY p.best_score DESC, p.created_at ASC) AS world_rank,
          DENSE_RANK() OVER (PARTITION BY p.country_code ORDER BY p.best_score DESC, p.created_at ASC) AS country_rank
        FROM player_profiles p
        JOIN users u ON u.id = p.user_id
      )
      SELECT * FROM all_ranked
      WHERE country_code = $1
      ORDER BY country_rank ASC
      LIMIT $2 OFFSET $3`,
      [country.code, limit, offset]
    );

    const entries: CountryLeaderboardEntry[] = res.rows.map((r) => ({
      countryRank: parseInt(r.country_rank, 10),
      worldRank: parseInt(r.world_rank, 10),
      playerId: r.user_id,
      username: r.username,
      displayName: r.display_name,
      countryCode: r.country_code,
      countryName: r.country_name,
      countryFlag: country.flag,
      avatar: r.avatar,
      score: r.best_score,
    }));

    return {
      country: {
        code: country.code,
        name: country.name,
        flag: country.flag,
      },
      entries,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Country-vs-Country Competition
   * Supports sorting by totalScore, averageScore, bestScore, playerCount
   */
  public async getCountryCompetition(
    sortBy: 'totalScore' | 'averageScore' | 'bestScore' | 'playerCount' = 'totalScore'
  ): Promise<{
    metricUsed: string;
    rankings: CountryCompetitionEntry[];
  }> {
    let orderColumn = 'total_score';
    if (sortBy === 'averageScore') orderColumn = 'average_score';
    if (sortBy === 'bestScore') orderColumn = 'best_score';
    if (sortBy === 'playerCount') orderColumn = 'player_count';

    // Query aggregated statistics from active countries
    const res = await db.query(`
      WITH country_agg AS (
        SELECT 
          c.code,
          c.name,
          c.flag,
          COUNT(p.id)::INTEGER AS player_count,
          COALESCE(SUM(p.best_score), 0)::BIGINT AS total_score,
          COALESCE(AVG(p.best_score), 0)::REAL AS average_score,
          COALESCE(MAX(p.best_score), 0)::INTEGER AS best_score
        FROM countries c
        LEFT JOIN player_profiles p ON p.country_code = c.code
        GROUP BY c.code, c.name, c.flag
      )
      SELECT 
        code,
        name,
        flag,
        player_count AS "playerCount",
        total_score AS "totalScore",
        ROUND(average_score::numeric, 1)::REAL AS "averageScore",
        best_score AS "bestScore",
        DENSE_RANK() OVER (ORDER BY ${orderColumn} DESC, total_score DESC) AS rank
      FROM country_agg
      WHERE player_count > 0 OR best_score > 0
      ORDER BY rank ASC
      LIMIT 100
    `);

    const rankings: CountryCompetitionEntry[] = res.rows.map((r) => ({
      rank: parseInt(r.rank, 10),
      code: r.code,
      name: r.name,
      flag: r.flag,
      playerCount: r.playerCount,
      totalScore: Number(r.totalScore),
      averageScore: r.averageScore,
      bestScore: r.bestScore,
    }));

    return {
      metricUsed: sortBy,
      rankings,
    };
  }

  /**
   * Player Rank & Nearby Competitors (#85, #86, #87 YOU, #88, #89)
   */
  public async getPlayerRankAndNearby(userId: string): Promise<PlayerRankResponse> {
    const profileRes = await db.query(
      `SELECT 
        p.id,
        p.user_id,
        p.display_name,
        p.country_code,
        p.country_name,
        p.best_score,
        p.total_score,
        p.total_games,
        (SELECT COUNT(*) + 1 FROM player_profiles WHERE best_score > p.best_score) AS world_rank,
        (SELECT COUNT(*) + 1 FROM player_profiles WHERE country_code = p.country_code AND best_score > p.best_score) AS country_rank
       FROM player_profiles p
       WHERE p.user_id = $1`,
      [userId]
    );

    if (profileRes.rows.length === 0) {
      throw { status: 404, code: 'USER_NOT_FOUND', message: 'Player profile not found.' };
    }

    const current = profileRes.rows[0];
    const worldRank = parseInt(current.world_rank, 10);
    const countryRank = parseInt(current.country_rank, 10);
    const country = findCountry(current.country_code);

    // Fetch nearby bracket: 2 above, current player, 2 below
    const minRank = Math.max(1, worldRank - 2);
    const maxRank = worldRank + 2;

    const nearbyRes = await db.query(
      `WITH ranked AS (
        SELECT 
          p.user_id,
          p.display_name,
          p.country_code,
          p.best_score,
          DENSE_RANK() OVER (ORDER BY p.best_score DESC, p.created_at ASC) AS rank
        FROM player_profiles p
      )
      SELECT * FROM ranked
      WHERE rank BETWEEN $1 AND $2
      ORDER BY rank ASC`,
      [minRank, maxRank]
    );

    const nearbyPlayers = nearbyRes.rows.map((r) => {
      const c = findCountry(r.country_code);
      return {
        rank: parseInt(r.rank, 10),
        displayName: r.display_name,
        score: r.best_score,
        countryFlag: c.flag,
        isCurrentPlayer: r.user_id === userId,
      };
    });

    return {
      worldRank,
      countryRank,
      bestScore: current.best_score,
      totalScore: Number(current.total_score),
      totalGames: current.total_games,
      countryCode: current.country_code,
      countryName: current.country_name,
      countryFlag: country.flag,
      nearbyPlayers,
    };
  }

  /**
   * Search players by username or display name with ranks
   */
  public async searchLeaderboard(
    query: string,
    limit: number = 20
  ): Promise<(WorldLeaderboardEntry & { countryRank: number; worldRank: number })[]> {
    if (!query || !query.trim()) return [];
    const term = `%${query.trim().toLowerCase()}%`;
    const limitNum = Math.min(50, Math.max(1, limit));

    const res = await db.query(
      `WITH ranked AS (
        SELECT 
          p.id,
          p.user_id,
          u.username,
          p.display_name,
          p.country_code,
          p.country_name,
          p.avatar,
          p.best_score,
          p.updated_at,
          DENSE_RANK() OVER (ORDER BY p.best_score DESC, p.created_at ASC) AS world_rank,
          DENSE_RANK() OVER (PARTITION BY p.country_code ORDER BY p.best_score DESC, p.created_at ASC) AS country_rank
        FROM player_profiles p
        JOIN users u ON u.id = p.user_id
        WHERE LOWER(u.username) LIKE $1 OR LOWER(p.display_name) LIKE $1
      )
      SELECT * FROM ranked
      ORDER BY world_rank ASC
      LIMIT $2`,
      [term, limitNum]
    );

    return res.rows.map((r) => {
      const c = findCountry(r.country_code);
      return {
        rank: parseInt(r.world_rank, 10),
        worldRank: parseInt(r.world_rank, 10),
        countryRank: parseInt(r.country_rank, 10),
        playerId: r.user_id,
        username: r.username,
        displayName: r.display_name,
        countryCode: r.country_code,
        countryName: r.country_name,
        countryFlag: c.flag,
        avatar: r.avatar,
        score: r.best_score,
        updatedAt: new Date(r.updated_at).toISOString(),
      };
    });
  }
}

export const leaderboardService = new LeaderboardService();
