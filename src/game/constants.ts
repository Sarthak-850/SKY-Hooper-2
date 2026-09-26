/**
 * Sky Hopper - Comprehensive Game Constants & Configuration
 */

import { NovaSkin, Mission, Achievement, GameSettings, GameStatistics } from './types';

// Virtual canvas resolution (2:3 aspect ratio, scales seamlessly to any screen)
export const VIRTUAL_WIDTH = 480;
export const VIRTUAL_HEIGHT = 720;

// Physics constants
export const GRAVITY = 1100; // px/s²
export const FLAP_IMPULSE = -360; // px/s upward burst
export const MAX_FALL_SPEED = 560; // px/s downward clamp
export const MAX_RISE_SPEED = -450; // px/s upward clamp

// Nova starting configuration
export const NOVA_START_X = 120;
export const NOVA_START_Y = 360;
export const NOVA_RADIUS = 15; // Hitbox radius (forgiving circle)

// World progression & scrolling
export const BASE_WORLD_SPEED = 185; // px/s horizontal scroll
export const MAX_WORLD_SPEED = 285; // px/s at high scores
export const SPEED_ACCEL_PER_SCORE = 1.8; // speed added per passed gate

// Energy Gates layout
export const GATE_WIDTH = 64;
export const GATE_SPACING = 270; // px between successive gates
export const INITIAL_GATE_GAP = 180; // px opening height
export const MIN_GATE_GAP = 136; // minimum opening height (guaranteed fair & passable)
export const MIN_GATE_MARGIN = 90; // margin from top/bottom boundary

// Scoring Rewards
export const SCORE_NORMAL_GATE = 1;
export const SCORE_PERFECT_GATE = 3;
export const SCORE_NEAR_MISS = 2;
export const SCORE_STAR = 5;
export const SCORE_COIN = 10;
export const MAX_COMBO = 10;

// Power-Up Durations & Attributes
export const STARS_PER_SLOW_MO = 5;
export const SLOW_MO_DURATION = 6.0; // seconds
export const SLOW_MO_TIME_SCALE = 0.55; // world slows down to 55% target speed
export const SLOW_MO_NOVA_SCALE = 0.85; // Nova stays snappy and responsive!
export const SLOW_MO_ENTER_DURATION = 0.5; // 0.5 seconds to smoothly ease into slow-mo
export const SLOW_MO_EXIT_DURATION = 1.2; // seconds to smoothly ease back to normal speed

export const SHIELD_DURATION = 8.0;
export const MAGNET_DURATION = 8.0;
export const MAGNET_RADIUS = 180; // px
export const MULTIPLIER_DURATION = 8.0;
export const GHOST_DURATION = 5.0;
export const POWERUP_SPAWN_CHANCE = 0.18; // 18% of gates have a power-up orb

// Collectibles
export const STAR_RADIUS = 13;
export const STAR_SPAWN_CHANCE = 0.85; // 85% of gates have a star
export const COIN_RADIUS = 11;
export const COIN_SPAWN_CHANCE = 0.55; // 55% of gates have a coin

// Sky Zone Score Thresholds
export const ZONE_THRESHOLDS = {
  NEON_CLOUDS: 0,
  CRYSTAL_SKIES: 15,
  STORM_REALM: 35,
  COSMIC_VOID: 60,
  AURORA_DIMENSION: 90,
};

// Storage Keys
export const STORAGE_SAVE_KEY = 'skyhopper_save_v2';
export const STORAGE_BACKUP_KEY = 'skyhopper_backup';

// Cosmetic Skins Catalogue
export const NOVA_SKINS: NovaSkin[] = [
  {
    id: 'default',
    name: 'Classic Nova',
    description: 'The original celestial flyer with a vibrant neon magenta aura.',
    cost: 0,
    unlockedByDefault: true,
    palette: {
      primary: '#f472b6',
      secondary: '#7c3aed',
      accent: '#fef08a',
      belly: '#ffffff',
      wing: '#e0e7ff',
      aura: 'rgba(192, 132, 252, 0.45)',
      trailColors: ['#c084fc', '#818cf8', '#38bdf8', '#f472b6'],
    },
  },
  {
    id: 'galaxy',
    name: 'Galaxy Nova',
    description: 'Forged from deep cosmic nebulae and twinkling distant starfields.',
    cost: 250,
    unlockedByDefault: false,
    palette: {
      primary: '#818cf8',
      secondary: '#312e81',
      accent: '#38bdf8',
      belly: '#c7d2fe',
      wing: '#67e8f9',
      aura: 'rgba(56, 189, 248, 0.45)',
      trailColors: ['#38bdf8', '#818cf8', '#c084fc', '#e0e7ff'],
    },
  },
  {
    id: 'fire',
    name: 'Solar Flare',
    description: 'Blazing with thermonuclear solar energy and hot ember trails.',
    cost: 450,
    unlockedByDefault: false,
    palette: {
      primary: '#fb923c',
      secondary: '#b91c1c',
      accent: '#fef08a',
      belly: '#ffedd5',
      wing: '#fde047',
      aura: 'rgba(251, 146, 60, 0.5)',
      trailColors: ['#f97316', '#ef4444', '#eab308', '#fef08a'],
    },
  },
  {
    id: 'ice',
    name: 'Glacial Frost',
    description: 'Sculpted from crystalline comets and zero-degree diamond ice.',
    cost: 450,
    unlockedByDefault: false,
    palette: {
      primary: '#38bdf8',
      secondary: '#0369a1',
      accent: '#ffffff',
      belly: '#f0f9ff',
      wing: '#bae6fd',
      aura: 'rgba(125, 211, 252, 0.5)',
      trailColors: ['#7dd3fc', '#38bdf8', '#bae6fd', '#ffffff'],
    },
  },
  {
    id: 'shadow',
    name: 'Phantom Void',
    description: 'A stealth apparition woven from the dark matter of the cosmic abyss.',
    cost: 650,
    unlockedByDefault: false,
    palette: {
      primary: '#a855f7',
      secondary: '#18181b',
      accent: '#e879f9',
      belly: '#d8b4fe',
      wing: '#c084fc',
      aura: 'rgba(168, 85, 247, 0.5)',
      trailColors: ['#a855f7', '#7c3aed', '#c084fc', '#27272a'],
    },
  },
  {
    id: 'gold',
    name: 'Radiant Champion',
    description: 'Pure gilded brilliance awarded to legendary masters of the skies.',
    cost: 1000,
    unlockedByDefault: false,
    requiredAchievementId: 'sky_legend',
    palette: {
      primary: '#fbbf24',
      secondary: '#b45309',
      accent: '#ffffff',
      belly: '#fef3c7',
      wing: '#fef08a',
      aura: 'rgba(251, 191, 36, 0.6)',
      trailColors: ['#fde047', '#fbbf24', '#f59e0b', '#ffffff'],
    },
  },
];

// Achievements Definition
export const ACHIEVEMENTS_LIST: Achievement[] = [
  {
    id: 'first_flight',
    title: 'First Flight',
    description: 'Complete your first flight through the Energy Gates.',
    icon: 'Feather',
    unlocked: false,
  },
  {
    id: 'star_collector',
    title: 'Star Collector',
    description: 'Collect 100 total glowing stars across your runs.',
    icon: 'Star',
    unlocked: false,
  },
  {
    id: 'combo_master',
    title: 'Combo Master',
    description: 'Reach a maximum x10 Combo multiplier in a single run.',
    icon: 'Flame',
    unlocked: false,
  },
  {
    id: 'perfect_pilot',
    title: 'Perfect Pilot',
    description: 'Perform 25 center-aligned Perfect Gate passes.',
    icon: 'Target',
    unlocked: false,
  },
  {
    id: 'close_call',
    title: 'Close Call',
    description: 'Perform 15 Near Miss maneuvers without colliding.',
    icon: 'Zap',
    unlocked: false,
  },
  {
    id: 'sky_explorer',
    title: 'Sky Explorer',
    description: 'Reach every Sky Zone from Neon Clouds to Aurora Dimension.',
    icon: 'Compass',
    unlocked: false,
  },
  {
    id: 'coin_hunter',
    title: 'Coin Hunter',
    description: 'Amass 500 total coins in your sky treasury.',
    icon: 'Coins',
    unlocked: false,
  },
  {
    id: 'sky_legend',
    title: 'Sky Legend',
    description: 'Achieve a score of 50 or higher in a single run.',
    icon: 'Crown',
    unlocked: false,
  },
];

// Missions Pool
export const MISSIONS_POOL: Omit<Mission, 'completed' | 'claimed'>[] = [
  {
    id: 'm_stars_20',
    title: 'Starlight Harvester',
    description: 'Collect 20 Stars in any game mode.',
    goal: 20,
    current: 0,
    rewardCoins: 50,
    type: 'COLLECT_STARS',
  },
  {
    id: 'm_coins_30',
    title: 'Treasury Seeker',
    description: 'Collect 30 Coins from the skies.',
    goal: 30,
    current: 0,
    rewardCoins: 60,
    type: 'COLLECT_COINS',
  },
  {
    id: 'm_score_30',
    title: 'High Altitude',
    description: 'Reach a score of 30 in a single flight.',
    goal: 30,
    current: 0,
    rewardCoins: 75,
    type: 'REACH_SCORE',
  },
  {
    id: 'm_perfect_8',
    title: 'Surgical Precision',
    description: 'Execute 8 Perfect Gate passes.',
    goal: 8,
    current: 0,
    rewardCoins: 70,
    type: 'PERFECT_GATES',
  },
  {
    id: 'm_nearmiss_5',
    title: 'Daredevil',
    description: 'Perform 5 Near Misses by grazing gate pylons.',
    goal: 5,
    current: 0,
    rewardCoins: 80,
    type: 'NEAR_MISSES',
  },
  {
    id: 'm_combo_7',
    title: 'Rhythm Flyer',
    description: 'Achieve an x7 Combo or higher.',
    goal: 7,
    current: 0,
    rewardCoins: 65,
    type: 'MAX_COMBO',
  },
  {
    id: 'm_powerups_3',
    title: 'Powered Up',
    description: 'Collect 3 Power-Up orbs in your flights.',
    goal: 3,
    current: 0,
    rewardCoins: 60,
    type: 'USE_POWERUPS',
  },
  {
    id: 'm_zone_crystal',
    title: 'Crystal Skies Voyager',
    description: 'Reach Zone 2 (Crystal Skies).',
    goal: 1,
    current: 0,
    rewardCoins: 90,
    type: 'REACH_ZONE',
  },
];

// Default Settings
export const DEFAULT_SETTINGS: GameSettings = {
  soundEnabled: true,
  musicEnabled: true,
  particlesLevel: 'HIGH',
  screenShake: true,
  reducedMotion: false,
};

// Default Statistics
export const DEFAULT_STATISTICS: GameStatistics = {
  totalRuns: 0,
  totalGates: 0,
  totalStars: 0,
  totalCoins: 0,
  highestScore: 0,
  highestCombo: 0,
  perfectGates: 0,
  nearMisses: 0,
  longestRunSeconds: 0,
  zonesReached: 1,
  powerUpsCollected: 0,
  modeBestScores: {
    CLASSIC: 0,
    TIME_ATTACK: 0,
    STAR_RUSH: 0,
    HARDCORE: 0,
    ZEN: 0,
  },
};
