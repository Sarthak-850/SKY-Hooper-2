/**
 * Initial Realistic Seed Data for Global Leaderboard & Country Competition
 * Seeds real persistent player accounts and valid game scores in SQLite.
 * All rankings and metrics are dynamically calculated via SQL queries.
 */

import { db } from './db.ts';
import { findCountry } from './countries.ts';

interface SeedPilot {
  id: string;
  name: string;
  countryCode: string;
  score: number;
  maxCombo: number;
  duration: number;
  zone: string;
  perfectGates: number;
  nearMisses: number;
  stars: number;
  coins: number;
  daysAgo?: number;
}

export const INITIAL_PILOTS: SeedPilot[] = [
  // --- Japan ---
  { id: 'pilot_jp_01', name: 'Kaito_Skyline', countryCode: 'JP', score: 18920, maxCombo: 28, duration: 245, zone: 'AURORA_DIMENSION', perfectGates: 36, nearMisses: 18, stars: 142, coins: 52 },
  { id: 'pilot_jp_02', name: 'SakuraAce', countryCode: 'JP', score: 16420, maxCombo: 22, duration: 210, zone: 'COSMIC_VOID', perfectGates: 28, nearMisses: 14, stars: 110, coins: 41 },
  { id: 'pilot_jp_03', name: 'Ren_Phantom', countryCode: 'JP', score: 14200, maxCombo: 19, duration: 185, zone: 'STORM_REALM', perfectGates: 22, nearMisses: 11, stars: 95, coins: 33 },
  { id: 'pilot_jp_04', name: 'Yuki_Glider', countryCode: 'JP', score: 11800, maxCombo: 15, duration: 160, zone: 'CRYSTAL_SKIES', perfectGates: 18, nearMisses: 9, stars: 74, coins: 28 },

  // --- India ---
  { id: 'pilot_in_01', name: 'Aarav_Pulse', countryCode: 'IN', score: 17450, maxCombo: 25, duration: 228, zone: 'AURORA_DIMENSION', perfectGates: 32, nearMisses: 16, stars: 128, coins: 48 },
  { id: 'pilot_in_02', name: 'Rohan_Vortex', countryCode: 'IN', score: 15920, maxCombo: 21, duration: 202, zone: 'COSMIC_VOID', perfectGates: 26, nearMisses: 13, stars: 105, coins: 39 },
  { id: 'pilot_in_03', name: 'Priya_Nova', countryCode: 'IN', score: 14880, maxCombo: 20, duration: 192, zone: 'STORM_REALM', perfectGates: 24, nearMisses: 12, stars: 98, coins: 36 },
  { id: 'pilot_in_04', name: 'Vikram_Aero', countryCode: 'IN', score: 13250, maxCombo: 17, duration: 174, zone: 'CRYSTAL_SKIES', perfectGates: 20, nearMisses: 10, stars: 82, coins: 31 },
  { id: 'pilot_in_05', name: 'Ananya_Sky', countryCode: 'IN', score: 11640, maxCombo: 14, duration: 155, zone: 'CRYSTAL_SKIES', perfectGates: 17, nearMisses: 8, stars: 69, coins: 25 },
  { id: 'pilot_in_06', name: 'Dev_Falcon', countryCode: 'IN', score: 9850, maxCombo: 12, duration: 138, zone: 'NEON_CLOUDS', perfectGates: 14, nearMisses: 7, stars: 55, coins: 20 },

  // --- United States ---
  { id: 'pilot_us_01', name: 'ViperZero', countryCode: 'US', score: 16980, maxCombo: 24, duration: 218, zone: 'AURORA_DIMENSION', perfectGates: 30, nearMisses: 15, stars: 121, coins: 46 },
  { id: 'pilot_us_02', name: 'StarHawk99', countryCode: 'US', score: 15200, maxCombo: 20, duration: 198, zone: 'COSMIC_VOID', perfectGates: 25, nearMisses: 12, stars: 102, coins: 38 },
  { id: 'pilot_us_03', name: 'Maverick_X', countryCode: 'US', score: 13750, maxCombo: 18, duration: 180, zone: 'STORM_REALM', perfectGates: 21, nearMisses: 11, stars: 88, coins: 32 },
  { id: 'pilot_us_04', name: 'CyberPulse', countryCode: 'US', score: 10500, maxCombo: 13, duration: 145, zone: 'CRYSTAL_SKIES', perfectGates: 15, nearMisses: 8, stars: 62, coins: 22 },

  // --- United Kingdom ---
  { id: 'pilot_gb_01', name: 'RoyalSpitfire', countryCode: 'GB', score: 15600, maxCombo: 22, duration: 204, zone: 'COSMIC_VOID', perfectGates: 27, nearMisses: 13, stars: 108, coins: 40 },
  { id: 'pilot_gb_02', name: 'Oliver_Neon', countryCode: 'GB', score: 13400, maxCombo: 17, duration: 178, zone: 'STORM_REALM', perfectGates: 21, nearMisses: 10, stars: 85, coins: 30 },
  { id: 'pilot_gb_03', name: 'LondonDrift', countryCode: 'GB', score: 11100, maxCombo: 14, duration: 152, zone: 'CRYSTAL_SKIES', perfectGates: 16, nearMisses: 7, stars: 66, coins: 24 },

  // --- Germany ---
  { id: 'pilot_de_01', name: 'BlitzFlieger', countryCode: 'DE', score: 16100, maxCombo: 23, duration: 208, zone: 'COSMIC_VOID', perfectGates: 29, nearMisses: 14, stars: 112, coins: 42 },
  { id: 'pilot_de_02', name: 'Klaus_V', countryCode: 'DE', score: 12900, maxCombo: 16, duration: 170, zone: 'STORM_REALM', perfectGates: 19, nearMisses: 9, stars: 78, coins: 27 },
  { id: 'pilot_de_03', name: 'EchoPilot', countryCode: 'DE', score: 9400, maxCombo: 11, duration: 132, zone: 'NEON_CLOUDS', perfectGates: 13, nearMisses: 6, stars: 52, coins: 18 },

  // --- Brazil ---
  { id: 'pilot_br_01', name: 'Rio_Racer', countryCode: 'BR', score: 14600, maxCombo: 19, duration: 190, zone: 'STORM_REALM', perfectGates: 23, nearMisses: 11, stars: 94, coins: 34 },
  { id: 'pilot_br_02', name: 'SilvaWing', countryCode: 'BR', score: 12200, maxCombo: 15, duration: 164, zone: 'CRYSTAL_SKIES', perfectGates: 18, nearMisses: 8, stars: 72, coins: 26 },

  // --- Canada ---
  { id: 'pilot_ca_01', name: 'MapleMach', countryCode: 'CA', score: 14950, maxCombo: 20, duration: 194, zone: 'STORM_REALM', perfectGates: 24, nearMisses: 12, stars: 97, coins: 35 },
  { id: 'pilot_ca_02', name: 'AuroraFrost', countryCode: 'CA', score: 11400, maxCombo: 14, duration: 156, zone: 'CRYSTAL_SKIES', perfectGates: 16, nearMisses: 8, stars: 68, coins: 25 },

  // --- Australia ---
  { id: 'pilot_au_01', name: 'BoomerangX', countryCode: 'AU', score: 14100, maxCombo: 18, duration: 186, zone: 'STORM_REALM', perfectGates: 22, nearMisses: 10, stars: 90, coins: 32 },
  { id: 'pilot_au_02', name: 'SydneySurfer', countryCode: 'AU', score: 10800, maxCombo: 13, duration: 148, zone: 'CRYSTAL_SKIES', perfectGates: 15, nearMisses: 7, stars: 63, coins: 22 },

  // --- France ---
  { id: 'pilot_fr_01', name: 'MirageBleu', countryCode: 'FR', score: 15300, maxCombo: 21, duration: 200, zone: 'COSMIC_VOID', perfectGates: 26, nearMisses: 12, stars: 104, coins: 38 },
  { id: 'pilot_fr_02', name: 'Luc_Spectre', countryCode: 'FR', score: 11950, maxCombo: 15, duration: 162, zone: 'CRYSTAL_SKIES', perfectGates: 17, nearMisses: 8, stars: 71, coins: 25 },

  // --- South Korea ---
  { id: 'pilot_kr_01', name: 'SeoulApex', countryCode: 'KR', score: 16700, maxCombo: 23, duration: 215, zone: 'AURORA_DIMENSION', perfectGates: 30, nearMisses: 14, stars: 118, coins: 44 },
  { id: 'pilot_kr_02', name: 'MinHo_Drift', countryCode: 'KR', score: 13800, maxCombo: 18, duration: 182, zone: 'STORM_REALM', perfectGates: 22, nearMisses: 10, stars: 89, coins: 31 },
];

export function seedDatabaseIfNeeded(): void {
  const currentCount = db.getPlayerCount();
  if (currentCount > 0) {
    return; // Already seeded or populated with real players
  }

  const now = Date.now();
  for (let i = 0; i < INITIAL_PILOTS.length; i++) {
    const p = INITIAL_PILOTS[i];
    const country = findCountry(p.countryCode);
    const createdAt = now - (i * 3600 * 1000 + Math.floor(Math.random() * 86400000));

    // Register player
    db.upsertPlayer({
      id: p.id,
      username: p.name,
      countryCode: country.code,
      countryName: country.name,
      countryFlag: country.flag,
    });

    // Record verified score
    db.recordScore({
      id: `score_${p.id}_01`,
      playerId: p.id,
      score: p.score,
      maxCombo: p.maxCombo,
      perfectGates: p.perfectGates,
      nearMisses: p.nearMisses,
      stars: p.stars,
      coins: p.coins,
      durationSeconds: p.duration,
      zoneReached: p.zone,
      gameMode: 'CLASSIC',
      sessionId: `init_session_${p.id}`,
      createdAt,
    });
  }
}
