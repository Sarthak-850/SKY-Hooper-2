/**
 * Database Seed Script
 * 
 * 1. Populates official countries into 'countries' table.
 * 2. In development environment, populates realistic seed player accounts, scores,
 *    and country aggregates for local testing.
 * 
 * CLEARLY MARKED AS DEVELOPMENT DATA - NOT LOADED IN PRODUCTION UNLESS EXPLICITLY REQUESTED.
 */

import bcrypt from 'bcryptjs';
import { db } from './index.ts';
import { runMigrations } from './migrate.ts';
import { COUNTRIES_LIST } from '../utils/countries.ts';
import { config } from '../config/env.ts';

const DEV_SEED_PLAYERS = [
  // India 🇮🇳
  { username: 'aarav_sky', email: 'aarav@example.com', displayName: 'Aarav Sharma', countryCode: 'IN', countryName: 'India', bestScore: 19850, games: 42 },
  { username: 'diya_nova', email: 'diya@example.com', displayName: 'Diya Patel', countryCode: 'IN', countryName: 'India', bestScore: 17420, games: 31 },
  { username: 'vikram_jet', email: 'vikram@example.com', displayName: 'Vikram Rao', countryCode: 'IN', countryName: 'India', bestScore: 15300, games: 25 },
  { username: 'ananya_ace', email: 'ananya@example.com', displayName: 'Ananya Sen', countryCode: 'IN', countryName: 'India', bestScore: 13900, games: 19 },
  { username: 'rohan_speed', email: 'rohan@example.com', displayName: 'Rohan Verma', countryCode: 'IN', countryName: 'India', bestScore: 11200, games: 15 },

  // Japan 🇯🇵
  { username: 'kenji_blade', email: 'kenji@example.com', displayName: 'Kenji Takahashi', countryCode: 'JP', countryName: 'Japan', bestScore: 21500, games: 65 },
  { username: 'sakura_glide', email: 'sakura@example.com', displayName: 'Sakura Tanaka', countryCode: 'JP', countryName: 'Japan', bestScore: 18600, games: 38 },
  { username: 'ren_phantom', email: 'ren@example.com', displayName: 'Ren Sato', countryCode: 'JP', countryName: 'Japan', bestScore: 16100, games: 29 },

  // USA 🇺🇸
  { username: 'apex_pilot', email: 'apex@example.com', displayName: 'Marcus Vance', countryCode: 'US', countryName: 'United States', bestScore: 20400, games: 58 },
  { username: 'chloe_storm', email: 'chloe@example.com', displayName: 'Chloe Bennett', countryCode: 'US', countryName: 'United States', bestScore: 17950, games: 34 },
  { username: 'tyler_rush', email: 'tyler@example.com', displayName: 'Tyler Hayes', countryCode: 'US', countryName: 'United States', bestScore: 14750, games: 22 },

  // United Kingdom 🇬🇧
  { username: 'arthur_hawk', email: 'arthur@example.com', displayName: 'Arthur Pendelton', countryCode: 'GB', countryName: 'United Kingdom', bestScore: 19100, games: 47 },
  { username: 'freya_wind', email: 'freya@example.com', displayName: 'Freya Davies', countryCode: 'GB', countryName: 'United Kingdom', bestScore: 16800, games: 30 },

  // Germany 🇩🇪
  { username: 'lukas_blitz', email: 'lukas@example.com', displayName: 'Lukas Weber', countryCode: 'DE', countryName: 'Germany', bestScore: 18400, games: 36 },
  { username: 'elena_aero', email: 'elena@example.com', displayName: 'Elena Schmidt', countryCode: 'DE', countryName: 'Germany', bestScore: 15600, games: 24 },

  // Brazil 🇧🇷
  { username: 'mateo_samba', email: 'mateo@example.com', displayName: 'Mateo Silva', countryCode: 'BR', countryName: 'Brazil', bestScore: 17200, games: 28 },

  // France 🇫🇷
  { username: 'julien_mirage', email: 'julien@example.com', displayName: 'Julien Laurent', countryCode: 'FR', countryName: 'France', bestScore: 16900, games: 27 },

  // Australia 🇦🇺
  { username: 'liam_thunder', email: 'liam@example.com', displayName: 'Liam O’Connor', countryCode: 'AU', countryName: 'Australia', bestScore: 16400, games: 23 },

  // South Korea 🇰🇷
  { username: 'minho_hyper', email: 'minho@example.com', displayName: 'Minho Park', countryCode: 'KR', countryName: 'South Korea', bestScore: 20900, games: 54 },

  // Canada 🇨🇦
  { username: 'noah_aurora', email: 'noah@example.com', displayName: 'Noah Tremblay', countryCode: 'CA', countryName: 'Canada', bestScore: 15800, games: 20 },
];

export async function seedDatabase(forceDevData = false): Promise<void> {
  console.log('🌱 Starting database seed...');
  await db.waitReady();
  await runMigrations();

  // 1. Seed Countries
  console.log('🌍 Seeding official countries list...');
  for (const c of COUNTRIES_LIST) {
    await db.query(
      `INSERT INTO countries (code, name, flag, player_count, total_score, average_score, best_score, updated_at)
       VALUES ($1, $2, $3, 0, 0, 0, 0, NOW())
       ON CONFLICT (code) DO UPDATE
       SET name = EXCLUDED.name, flag = EXCLUDED.flag`,
      [c.code, c.name, c.flag]
    );
  }
  console.log(`✅ Loaded ${COUNTRIES_LIST.length} countries.`);

  // 2. Seed Development Players (Only if not production or forced)
  const shouldSeedDevData = forceDevData || (!config.isProduction);

  if (shouldSeedDevData) {
    console.log('\n======================================================');
    console.log('⚠️  DEVELOPMENT SEED DATA LOADED');
    console.log('    Creating test pilots with hashed passwords for local dev...');
    console.log('======================================================');

    const defaultPassword = 'Password123!';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    for (const p of DEV_SEED_PLAYERS) {
      // Check if user exists
      const existing = await db.query('SELECT id FROM users WHERE username = $1', [p.username]);
      if (existing.rows.length === 0) {
        const userId = `usr_dev_${p.username}`;
        const profileId = `prf_dev_${p.username}`;
        const totalScore = p.bestScore * p.games * 0.7; // approximate total

        // Insert User
        await db.query(
          `INSERT INTO users (id, username, email, password_hash, country_code, country_name, avatar, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
          [userId, p.username, p.email, passwordHash, p.countryCode, p.countryName, 'default_pilot']
        );

        // Insert Player Profile
        await db.query(
          `INSERT INTO player_profiles (id, user_id, display_name, country_code, country_name, avatar, best_score, total_games, total_score, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
          [profileId, userId, p.displayName, p.countryCode, p.countryName, 'default_pilot', p.bestScore, p.games, Math.round(totalScore)]
        );

        // Insert completed game session
        const sessId = `sess_dev_${p.username}`;
        await db.query(
          `INSERT INTO game_sessions (id, user_id, started_at, ended_at, final_score, duration, status, validation_status, created_at)
           VALUES ($1, $2, NOW() - INTERVAL '10 minutes', NOW(), $3, 120, 'COMPLETED', 'VALID', NOW())`,
          [sessId, userId, p.bestScore]
        );

        // Insert score record
        const scoreId = `scr_dev_${p.username}`;
        await db.query(
          `INSERT INTO scores (id, user_id, game_session_id, score, country_code, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [scoreId, userId, sessId, p.bestScore, p.countryCode]
        );
      }
    }

    // 3. Recalculate Country Aggregates safely from actual profiles
    await recalculateCountryStats();

    console.log(`✅ Loaded ${DEV_SEED_PLAYERS.length} development pilot profiles.`);
    console.log('   All seed pilots have password: Password123!');
  }

  console.log('✨ Database seeding finished successfully.\n');
}

/**
 * Safe aggregation logic for countries table from player_profiles
 */
export async function recalculateCountryStats(): Promise<void> {
  await db.query(`
    WITH stats AS (
      SELECT 
        country_code,
        COUNT(*)::INTEGER AS player_count,
        COALESCE(SUM(best_score), 0)::BIGINT AS total_score,
        COALESCE(AVG(best_score), 0)::REAL AS average_score,
        COALESCE(MAX(best_score), 0)::INTEGER AS best_score
      FROM player_profiles
      GROUP BY country_code
    )
    UPDATE countries c
    SET 
      player_count = COALESCE(s.player_count, 0),
      total_score = COALESCE(s.total_score, 0),
      average_score = COALESCE(s.average_score, 0),
      best_score = COALESCE(s.best_score, 0),
      updated_at = NOW()
    FROM stats s
    WHERE c.code = s.country_code;
  `);
}

// Standalone execution support
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('seed.ts')) {
  seedDatabase(true)
    .then(() => {
      console.log('Seed command completed.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seed command failed:', err);
      process.exit(1);
    });
}
