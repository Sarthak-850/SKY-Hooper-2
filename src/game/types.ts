/**
 * Sky Hopper - Comprehensive Game Types & Interfaces
 */

export type GameState = 'MENU' | 'PLAYING' | 'PAUSED' | 'GAMEOVER';

export type GameMode = 'CLASSIC' | 'TIME_ATTACK' | 'STAR_RUSH' | 'HARDCORE' | 'ZEN';

export type SkyZone =
  | 'NEON_CLOUDS'
  | 'CRYSTAL_SKIES'
  | 'STORM_REALM'
  | 'COSMIC_VOID'
  | 'AURORA_DIMENSION';

export type GateType =
  | 'NORMAL'
  | 'MOVING'
  | 'NARROW'
  | 'ROTATING'
  | 'ZIG_ZAG'
  | 'PULSING'
  | 'DOUBLE'
  | 'VANISHING';

export type PowerUpType =
  | 'SLOW_MO'
  | 'SHIELD'
  | 'MAGNET'
  | 'STAR_MULTIPLIER'
  | 'GHOST';

export type NovaSkinId =
  | 'default'
  | 'galaxy'
  | 'fire'
  | 'ice'
  | 'shadow'
  | 'gold';

export interface NovaSkin {
  id: NovaSkinId;
  name: string;
  description: string;
  cost: number;
  unlockedByDefault: boolean;
  requiredAchievementId?: string;
  palette: {
    primary: string;
    secondary: string;
    accent: string;
    belly: string;
    wing: string;
    aura: string;
    trailColors: string[];
  };
}

export interface Nova {
  x: number;
  y: number;
  vy: number;
  radius: number;
  rotation: number;
  targetRotation: number;
  wingAngle: number;
  wingSpeed: number;
  squashX: number;
  squashY: number;
  blinkTimer: number;
  isBlinking: boolean;
  trailTimer: number;
  // Active power-up states
  hasShield: boolean;
  shieldPulse: number;
  isGhost: boolean;
  magnetActive: boolean;
  starMultiplierActive: boolean;
  invulnerabilityTimer: number; // brief grace period after shield break
}

export interface EnergyGate {
  id: number;
  x: number;
  width: number;
  gapY: number;
  baseGapY: number;
  gapHeight: number;
  oscillationAmp: number;
  oscillationFreq: number;
  oscillationPhase: number;
  gateType: GateType;
  passed: boolean;
  perfectChecked: boolean;
  nearMissChecked: boolean;
  colorTheme: 'cyan' | 'violet' | 'amber' | 'emerald' | 'crimson';
  rotationAngle?: number;
  pulseTimer?: number;
  opacity?: number;
  isDoubleSibling?: boolean;
}

export interface CollectibleStar {
  id: number;
  x: number;
  y: number;
  baseY: number;
  radius: number;
  floatPhase: number;
  collected: boolean;
  sparkleTimer: number;
}

export interface CollectibleCoin {
  id: number;
  x: number;
  y: number;
  baseY: number;
  radius: number;
  floatPhase: number;
  collected: boolean;
  rotation: number;
}

export interface ActivePowerUpItem {
  id: number;
  x: number;
  y: number;
  baseY: number;
  type: PowerUpType;
  radius: number;
  floatPhase: number;
  collected: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  shape?: 'circle' | 'star' | 'ring' | 'line' | 'sparkle' | 'lightning';
}

export interface FloatingText {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
  alpha: number;
  scale: number;
  life: number;
  maxLife: number;
  isBig?: boolean;
}

export interface ParallaxStar {
  x: number;
  y: number;
  size: number;
  alpha: number;
  speed: number;
  twinkleSpeed: number;
  twinklePhase: number;
  color?: string;
}

export interface DistantIsland {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  variant: number;
}

export interface WeatherEventState {
  type: 'NONE' | 'LIGHTNING' | 'METEORS' | 'AURORA' | 'WIND';
  intensity: number;
  timer: number;
  duration: number;
  lightningFlash: number;
  windForce: number;
}

export interface VoidBeastState {
  active: boolean;
  progress: number; // 0 to 1
  duration: number;
  timer: number;
  x: number; // relative distance behind Nova
  y: number;
  gatesSurvived: number;
  requiredGates: number;
  defeated: boolean;
}

export interface GhostPoint {
  t: number;
  y: number;
  vy: number;
}

export interface GhostRunData {
  score: number;
  points: GhostPoint[];
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  goal: number;
  current: number;
  rewardCoins: number;
  completed: boolean;
  claimed: boolean;
  type:
    | 'COLLECT_STARS'
    | 'COLLECT_COINS'
    | 'REACH_SCORE'
    | 'PERFECT_GATES'
    | 'NEAR_MISSES'
    | 'MAX_COMBO'
    | 'SURVIVE_TIME'
    | 'USE_POWERUPS'
    | 'REACH_ZONE';
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: number;
}

export interface GameSettings {
  soundEnabled: boolean;
  musicEnabled: boolean;
  particlesLevel: 'HIGH' | 'LOW';
  screenShake: boolean;
  reducedMotion: boolean;
}

export interface GameStatistics {
  totalRuns: number;
  totalGates: number;
  totalStars: number;
  totalCoins: number;
  highestScore: number;
  highestCombo: number;
  perfectGates: number;
  nearMisses: number;
  longestRunSeconds: number;
  zonesReached: number;
  powerUpsCollected: number;
  modeBestScores: Record<GameMode, number>;
}

export interface DailyChallengeData {
  dateKey: string; // YYYY-MM-DD
  title: string;
  description: string;
  targetScore: number;
  modifier: 'FASTER_GATES' | 'STAR_RUSH' | 'NARROW_PASSAGE' | 'WINDY_CONDITIONS';
  rewardCoins: number;
  completed: boolean;
}

export interface GameStats {
  score: number;
  highScore: number;
  starsInRun: number;
  coinsInRun: number;
  totalCoins: number;
  totalStars: number;
  combo: number;
  maxCombo: number;
  perfectGatesInRun: number;
  nearMissesInRun: number;
  zone: SkyZone;
  zoneProgress: number; // 0 to 1
  gameMode: GameMode;
  timeRemaining?: number; // For TIME_ATTACK

  // Power-up counters
  slowMoActive: boolean;
  slowMoEntering: boolean;
  slowMoRecovering: boolean;
  slowMoBlend: number; // 0 to 1 smooth easing factor
  slowMoTimeRemaining: number;
  slowMoMaxDuration: number;
  starsTowardsSlowMo: number;
  starsRequiredForSlowMo: number;

  shieldActive: boolean;
  shieldTimeRemaining: number;

  magnetActive: boolean;
  magnetTimeRemaining: number;

  multiplierActive: boolean;
  multiplierTimeRemaining: number;

  ghostActive: boolean;
  ghostTimeRemaining: number;

  isNewHighScore: boolean;
  voidBeastActive: boolean;
  voidBeastProgress: number;
}
