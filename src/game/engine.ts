/**
 * Sky Hopper - Core Game Engine
 * Comprehensive arcade engine handling:
 * - Physics integration & unified inputs
 * - 5 Game Modes (Classic, Time Attack, Star Rush, Hardcore, Zen)
 * - Combo Multiplier system (up to x10)
 * - Perfect Gate detection & Near Miss detection
 * - Collectible Stars & 3D Spinning Coins
 * - 5 Power-Up systems (Slow-Mo, Shield, Magnet, Multiplier, Ghost Mode)
 * - 5 Sky Zones with seamless transitions
 * - 8 Special Gate variations with guaranteed fair procedural generation
 * - Weather Events & Void Beast survival chase sequence
 * - Personal Ghost Run recording & playback
 * - Real-time Missions & Achievements tracking
 */

import {
  VIRTUAL_WIDTH,
  VIRTUAL_HEIGHT,
  GRAVITY,
  FLAP_IMPULSE,
  MAX_FALL_SPEED,
  MAX_RISE_SPEED,
  NOVA_START_X,
  NOVA_START_Y,
  NOVA_RADIUS,
  BASE_WORLD_SPEED,
  MAX_WORLD_SPEED,
  SPEED_ACCEL_PER_SCORE,
  GATE_WIDTH,
  GATE_SPACING,
  INITIAL_GATE_GAP,
  MIN_GATE_GAP,
  MIN_GATE_MARGIN,
  SCORE_NORMAL_GATE,
  SCORE_PERFECT_GATE,
  SCORE_NEAR_MISS,
  SCORE_STAR,
  SCORE_COIN,
  MAX_COMBO,
  STARS_PER_SLOW_MO,
  SLOW_MO_DURATION,
  SLOW_MO_TIME_SCALE,
  SLOW_MO_NOVA_SCALE,
  SLOW_MO_ENTER_DURATION,
  SLOW_MO_EXIT_DURATION,
  SHIELD_DURATION,
  MAGNET_DURATION,
  MAGNET_RADIUS,
  MULTIPLIER_DURATION,
  GHOST_DURATION,
  POWERUP_SPAWN_CHANCE,
  STAR_RADIUS,
  STAR_SPAWN_CHANCE,
  COIN_RADIUS,
  COIN_SPAWN_CHANCE,
  ZONE_THRESHOLDS,
} from './constants';
import {
  GameState,
  GameMode,
  SkyZone,
  GateType,
  PowerUpType,
  NovaSkinId,
  Nova,
  EnergyGate,
  CollectibleStar,
  CollectibleCoin,
  ActivePowerUpItem,
  GameStats,
  GhostPoint,
  GhostRunData,
  WeatherEventState,
  VoidBeastState,
} from './types';
import { ParticleSystem } from './particles';
import { GameRenderer } from './renderer';
import { audioManager } from './audio';
import { saveDataManager } from './saveData';
import { leaderboardClient } from '../services/leaderboardClient';
import { ScoreSubmissionResult } from '../types/leaderboard';

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private renderer: GameRenderer;
  private particles: ParticleSystem;

  private state: GameState = 'MENU';
  private gameMode: GameMode = 'CLASSIC';
  private isDailyChallengeRun: boolean = false;
  private animationFrameId: number | null = null;
  private lastTime: number = 0;

  // Nova Entity
  private nova!: Nova;
  private equippedSkin: NovaSkinId = 'default';

  // Game Entities
  private gates: EnergyGate[] = [];
  private stars: CollectibleStar[] = [];
  private coins: CollectibleCoin[] = [];
  private powerUps: ActivePowerUpItem[] = [];
  private nextGateId = 1;
  private nextStarId = 1;
  private nextCoinId = 1;
  private nextPowerUpId = 1;

  // Stats & Scoring
  private score: number = 0;
  private highScore: number = 0;
  private starsInRun: number = 0;
  private coinsInRun: number = 0;
  private combo: number = 1;
  private maxCombo: number = 1;
  private perfectGatesInRun: number = 0;
  private nearMissesInRun: number = 0;
  private powerUpsInRun: number = 0;
  private runDurationSeconds: number = 0;
  private timeAttackRemaining: number = 60;
  private isNewHighScore: boolean = false;

  // Leaderboard result tracking
  public onLeaderboardResult?: (result: ScoreSubmissionResult) => void;
  public latestLeaderboardResult: ScoreSubmissionResult | null = null;

  // Sky Zone
  private currentZone: SkyZone = 'NEON_CLOUDS';

  // Power-Up Timers & Transitions
  private slowMoActive: boolean = false;
  private slowMoEntering: boolean = false;
  private slowMoRecovering: boolean = false;
  private slowMoTimer: number = 0;
  private slowMoEnterTimer: number = 0;
  private slowMoEnterStartBlend: number = 0;
  private slowMoExitTimer: number = 0;
  private slowMoExitStartBlend: number = 1.0;
  private slowMoBlend: number = 0; // 0.0 (normal speed) to 1.0 (full slow-mo)
  private starsTowardsSlowMo: number = 0;

  private shieldActive: boolean = false;
  private shieldTimer: number = 0;

  private magnetActive: boolean = false;
  private magnetTimer: number = 0;

  private multiplierActive: boolean = false;
  private multiplierTimer: number = 0;

  private ghostActive: boolean = false;
  private ghostTimer: number = 0;

  // Weather Event State
  private weather: WeatherEventState = {
    type: 'NONE',
    intensity: 0,
    timer: 0,
    duration: 0,
    lightningFlash: 0,
    windForce: 0,
  };

  // Void Beast Chase Sequence
  private voidBeast: VoidBeastState = {
    active: false,
    progress: 0,
    duration: 18,
    timer: 0,
    x: -180,
    y: NOVA_START_Y,
    gatesSurvived: 0,
    requiredGates: 6,
    defeated: false,
  };

  // Ghost Recording & Playback
  private currentRunGhostPoints: GhostPoint[] = [];
  private ghostRecordTimer: number = 0;
  private playbackGhostRun: GhostRunData | null = null;
  private currentPlaybackIndex: number = 0;

  // Visual effects
  private screenShake: number = 0;
  private idleTime: number = 0;

  // UI Event Callbacks
  private onStatsChange?: (stats: GameStats) => void;
  private onStateChange?: (state: GameState) => void;
  private onNotification?: (title: string, message: string, icon?: string) => void;

  constructor(
    canvas: HTMLCanvasElement,
    onStatsChange?: (stats: GameStats) => void,
    onStateChange?: (state: GameState) => void,
    onNotification?: (title: string, message: string, icon?: string) => void
  ) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get canvas 2D context');
    this.ctx = context;

    this.onStatsChange = onStatsChange;
    this.onStateChange = onStateChange;
    this.onNotification = onNotification;

    this.particles = new ParticleSystem();
    this.renderer = new GameRenderer(this.ctx);

    this.loadPersistedData();
    this.resetNova();
    this.notifyStats();
  }

  private loadPersistedData() {
    const data = saveDataManager.getData();
    this.highScore = data.highScore;
    this.equippedSkin = data.equippedSkin;
    this.playbackGhostRun = data.ghostRun;
  }

  public setEquippedSkin(skinId: NovaSkinId) {
    this.equippedSkin = skinId;
    saveDataManager.equipSkin(skinId);
  }

  public setGameMode(mode: GameMode) {
    this.gameMode = mode;
    this.isDailyChallengeRun = false;
  }

  public startDailyChallenge() {
    this.gameMode = 'CLASSIC';
    this.isDailyChallengeRun = true;
    this.start();
  }

  private resetNova() {
    this.nova = {
      x: NOVA_START_X,
      y: NOVA_START_Y,
      vy: 0,
      radius: NOVA_RADIUS,
      rotation: 0,
      targetRotation: 0,
      wingAngle: 0,
      wingSpeed: 10,
      squashX: 1,
      squashY: 1,
      blinkTimer: 2.5,
      isBlinking: false,
      trailTimer: 0,
      hasShield: false,
      shieldPulse: 0,
      isGhost: false,
      magnetActive: false,
      starMultiplierActive: false,
      invulnerabilityTimer: 0,
    };
  }

  public getState(): GameState {
    return this.state;
  }

  public getStats(): GameStats {
    const data = saveDataManager.getData();
    const threshold = this.getZoneThreshold(this.currentZone);
    const nextThreshold = this.getNextZoneThreshold(this.currentZone);
    const zoneProgress = Math.min(
      1,
      Math.max(0, (this.score - threshold) / (nextThreshold - threshold))
    );

    return {
      score: this.score,
      highScore: this.gameMode === 'CLASSIC' ? this.highScore : data.statistics.modeBestScores[this.gameMode] || 0,
      starsInRun: this.starsInRun,
      coinsInRun: this.coinsInRun,
      totalCoins: data.totalCoins,
      totalStars: data.totalStars,
      combo: this.combo,
      maxCombo: this.maxCombo,
      perfectGatesInRun: this.perfectGatesInRun,
      nearMissesInRun: this.nearMissesInRun,
      zone: this.currentZone,
      zoneProgress,
      gameMode: this.gameMode,
      timeRemaining: this.gameMode === 'TIME_ATTACK' ? Math.max(0, this.timeAttackRemaining) : undefined,

      slowMoActive: this.slowMoActive,
      slowMoEntering: this.slowMoEntering,
      slowMoRecovering: this.slowMoRecovering,
      slowMoBlend: this.slowMoBlend,
      slowMoTimeRemaining: Math.max(0, this.slowMoTimer),
      slowMoMaxDuration: SLOW_MO_DURATION,
      starsTowardsSlowMo: this.starsTowardsSlowMo,
      starsRequiredForSlowMo: STARS_PER_SLOW_MO,

      shieldActive: this.shieldActive,
      shieldTimeRemaining: Math.max(0, this.shieldTimer),

      magnetActive: this.magnetActive,
      magnetTimeRemaining: Math.max(0, this.magnetTimer),

      multiplierActive: this.multiplierActive,
      multiplierTimeRemaining: Math.max(0, this.multiplierTimer),

      ghostActive: this.ghostActive,
      ghostTimeRemaining: Math.max(0, this.ghostTimer),

      isNewHighScore: this.isNewHighScore,
      voidBeastActive: this.voidBeast.active,
      voidBeastProgress: this.voidBeast.progress,
    };
  }

  private notifyStats() {
    if (this.onStatsChange) {
      this.onStatsChange(this.getStats());
    }
  }

  private setState(newState: GameState) {
    this.state = newState;
    if (this.onStateChange) {
      this.onStateChange(newState);
    }
    this.notifyStats();
  }

  private getZoneForScore(score: number): SkyZone {
    if (score >= ZONE_THRESHOLDS.AURORA_DIMENSION) return 'AURORA_DIMENSION';
    if (score >= ZONE_THRESHOLDS.COSMIC_VOID) return 'COSMIC_VOID';
    if (score >= ZONE_THRESHOLDS.STORM_REALM) return 'STORM_REALM';
    if (score >= ZONE_THRESHOLDS.CRYSTAL_SKIES) return 'CRYSTAL_SKIES';
    return 'NEON_CLOUDS';
  }

  private getZoneThreshold(zone: SkyZone): number {
    return ZONE_THRESHOLDS[zone] || 0;
  }

  private getNextZoneThreshold(zone: SkyZone): number {
    if (zone === 'NEON_CLOUDS') return ZONE_THRESHOLDS.CRYSTAL_SKIES;
    if (zone === 'CRYSTAL_SKIES') return ZONE_THRESHOLDS.STORM_REALM;
    if (zone === 'STORM_REALM') return ZONE_THRESHOLDS.COSMIC_VOID;
    if (zone === 'COSMIC_VOID') return ZONE_THRESHOLDS.AURORA_DIMENSION;
    return ZONE_THRESHOLDS.AURORA_DIMENSION + 30;
  }

  /**
   * Start or restart flight
   */
  public start() {
    audioManager.ensureAudio();
    this.latestLeaderboardResult = null;
    leaderboardClient.startSession(this.gameMode);
    this.score = 0;
    this.starsInRun = 0;
    this.coinsInRun = 0;
    this.combo = 1;
    this.maxCombo = 1;
    this.perfectGatesInRun = 0;
    this.nearMissesInRun = 0;
    this.powerUpsInRun = 0;
    this.runDurationSeconds = 0;
    this.timeAttackRemaining = 60;
    this.starsTowardsSlowMo = 0;
    this.slowMoActive = false;
    this.slowMoEntering = false;
    this.slowMoRecovering = false;
    this.slowMoTimer = 0;
    this.slowMoEnterTimer = 0;
    this.slowMoEnterStartBlend = 0;
    this.slowMoExitTimer = 0;
    this.slowMoExitStartBlend = 1.0;
    this.slowMoBlend = 0;
    this.shieldActive = false;
    this.shieldTimer = 0;
    this.magnetActive = false;
    this.magnetTimer = 0;
    this.multiplierActive = false;
    this.multiplierTimer = 0;
    this.ghostActive = false;
    this.ghostTimer = 0;
    this.screenShake = 0;
    this.isNewHighScore = false;
    this.currentZone = 'NEON_CLOUDS';

    this.currentRunGhostPoints = [];
    this.ghostRecordTimer = 0;
    this.currentPlaybackIndex = 0;
    this.playbackGhostRun = saveDataManager.getGhostRun();

    this.voidBeast = {
      active: false,
      progress: 0,
      duration: 18,
      timer: 0,
      x: -180,
      y: NOVA_START_Y,
      gatesSurvived: 0,
      requiredGates: 6,
      defeated: false,
    };

    this.weather = {
      type: 'NONE',
      intensity: 0,
      timer: 0,
      duration: 0,
      lightningFlash: 0,
      windForce: 0,
    };

    this.resetNova();
    this.particles.reset();
    this.gates = [];
    this.stars = [];
    this.coins = [];
    this.powerUps = [];
    this.nextGateId = 1;
    this.nextStarId = 1;
    this.nextCoinId = 1;
    this.nextPowerUpId = 1;

    this.spawnInitialGates();

    this.setState('PLAYING');
    this.flap();
  }

  public pause() {
    if (this.state === 'PLAYING') {
      this.setState('PAUSED');
    }
  }

  public resume() {
    if (this.state === 'PAUSED') {
      this.setState('PLAYING');
      this.lastTime = performance.now();
    }
  }

  public togglePause() {
    if (this.state === 'PLAYING') {
      this.pause();
    } else if (this.state === 'PAUSED') {
      this.resume();
    }
  }

  /**
   * Refactored slow-motion activation trigger:
   * Smoothly eases world speed down to 55% over a 0.5-second transition period
   * and preserves state across pauses.
   */
  public triggerSlowMo(duration: number = SLOW_MO_DURATION) {
    this.activatePowerUp('SLOW_MO', duration);
  }

  public activateSlowMotion(duration: number = SLOW_MO_DURATION) {
    this.activatePowerUp('SLOW_MO', duration);
  }

  public goToMenu() {
    this.setState('MENU');
    this.slowMoActive = false;
    this.slowMoEntering = false;
    this.slowMoRecovering = false;
    this.slowMoTimer = 0;
    this.slowMoEnterTimer = 0;
    this.slowMoExitTimer = 0;
    this.slowMoBlend = 0;
    this.resetNova();
    this.gates = [];
    this.stars = [];
    this.coins = [];
    this.powerUps = [];
  }

  public flap() {
    if (this.state === 'MENU' || this.state === 'GAMEOVER') {
      this.start();
      return;
    }

    if (this.state !== 'PLAYING') return;

    audioManager.playFlap();

    let impulse = FLAP_IMPULSE;
    if (this.slowMoBlend > 0) {
      impulse *= 1.0 - this.slowMoBlend * (1.0 - SLOW_MO_NOVA_SCALE);
    }
    if (this.gameMode === 'HARDCORE') impulse *= 0.96;
    if (this.gameMode === 'ZEN') impulse *= 0.88;

    this.nova.vy = impulse;
    this.nova.targetRotation = -0.45;
    this.nova.squashX = 1.18;
    this.nova.squashY = 0.82;
    this.nova.wingSpeed = 36;

    const skin = saveDataManager.getData().equippedSkin;
    this.particles.emitFlapPuff(this.nova.x, this.nova.y);
  }

  public startLoop() {
    if (this.animationFrameId !== null) return;
    this.lastTime = performance.now();
    const loop = (time: number) => {
      const dt = Math.min((time - this.lastTime) / 1000, 0.1);
      this.lastTime = time;

      this.update(dt);
      this.draw(dt);

      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  public stopLoop() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private spawnInitialGates() {
    const firstGateX = VIRTUAL_WIDTH + 140;
    for (let i = 0; i < 4; i++) {
      this.spawnGateAt(firstGateX + i * GATE_SPACING, i === 0 ? VIRTUAL_HEIGHT / 2 : undefined);
    }
  }

  /**
   * Fair procedural gate generator with variety
   */
  private spawnGateAt(x: number, forcedGapY?: number) {
    const gapProgress = Math.min(this.score / 35, 1);
    let gapHeight = INITIAL_GATE_GAP - (INITIAL_GATE_GAP - MIN_GATE_GAP) * gapProgress;

    // Game mode adjustments
    if (this.gameMode === 'HARDCORE') gapHeight = Math.max(126, gapHeight - 16);
    if (this.gameMode === 'ZEN') gapHeight = Math.max(170, gapHeight + 25);

    // Oscillation parameters
    let amp = 0;
    let freq = 0;
    if (this.score >= 5 && this.gameMode !== 'ZEN') {
      const oscProgress = Math.min((this.score - 5) / 25, 1);
      amp = 18 + 28 * oscProgress;
      freq = 1.0 + 0.5 * Math.random();
    }

    // Determine gate type
    let gateType: GateType = 'NORMAL';
    if (this.score >= 4) {
      const roll = Math.random();
      if (amp > 0 && roll < 0.28) gateType = 'MOVING';
      else if (this.score >= 12 && roll < 0.45) gateType = 'NARROW';
      else if (this.score >= 20 && roll < 0.6) gateType = 'PULSING';
      else if (this.score >= 28 && roll < 0.75) gateType = 'VANISHING';
      else if (this.score >= 35 && roll < 0.88) gateType = 'ZIG_ZAG';
    }

    if (gateType === 'NARROW') {
      gapHeight = Math.max(136, gapHeight - 14);
    }

    const minCenterY = MIN_GATE_MARGIN + gapHeight / 2 + amp;
    const maxCenterY = VIRTUAL_HEIGHT - MIN_GATE_MARGIN - gapHeight / 2 - amp;

    let baseGapY: number;
    if (forcedGapY !== undefined) {
      baseGapY = forcedGapY;
    } else if (this.gates.length > 0) {
      const prevGate = this.gates[this.gates.length - 1];
      const maxStep = 135; // strictly clamped for fair reaction flight
      const desiredY = minCenterY + Math.random() * (maxCenterY - minCenterY);
      baseGapY = Math.max(
        minCenterY,
        Math.min(maxCenterY, prevGate.baseGapY + (desiredY - prevGate.baseGapY) * 0.7)
      );
      baseGapY = Math.max(prevGate.baseGapY - maxStep, Math.min(prevGate.baseGapY + maxStep, baseGapY));
    } else {
      baseGapY = VIRTUAL_HEIGHT / 2;
    }

    // Color theme matching zone
    const themes: ('cyan' | 'violet' | 'amber' | 'emerald' | 'crimson')[] = [
      'cyan',
      'violet',
      'amber',
      'emerald',
    ];
    const colorTheme = themes[this.nextGateId % themes.length];

    const gate: EnergyGate = {
      id: this.nextGateId++,
      x,
      width: GATE_WIDTH,
      gapY: baseGapY,
      baseGapY,
      gapHeight,
      oscillationAmp: amp,
      oscillationFreq: freq,
      oscillationPhase: Math.random() * Math.PI * 2,
      gateType,
      passed: false,
      perfectChecked: false,
      nearMissChecked: false,
      colorTheme,
      opacity: 1,
    };

    this.gates.push(gate);

    // Collectibles & Power-Ups Generation
    this.spawnCollectiblesForGate(gate);
  }

  private spawnCollectiblesForGate(gate: EnergyGate) {
    const starChance = this.gameMode === 'STAR_RUSH' ? 1.0 : STAR_SPAWN_CHANCE;
    if (Math.random() < starChance) {
      this.stars.push({
        id: this.nextStarId++,
        x: gate.x + gate.width / 2,
        y: gate.baseGapY,
        baseY: gate.baseGapY,
        radius: STAR_RADIUS,
        floatPhase: Math.random() * Math.PI * 2,
        collected: false,
        sparkleTimer: 0,
      });
    }

    // Spawn Coin with 55% chance (positioned slightly offset from star or between gates)
    if (Math.random() < COIN_SPAWN_CHANCE) {
      const coinOffset = (Math.random() - 0.5) * 35;
      this.coins.push({
        id: this.nextCoinId++,
        x: gate.x + gate.width / 2 + (Math.random() > 0.5 ? 45 : -45),
        y: gate.baseGapY + coinOffset,
        baseY: gate.baseGapY + coinOffset,
        radius: COIN_RADIUS,
        floatPhase: Math.random() * Math.PI * 2,
        collected: false,
        rotation: 0,
      });
    }

    // Spawn Power-Up Orb (18% chance, balanced)
    if (this.gameMode !== 'HARDCORE' && Math.random() < POWERUP_SPAWN_CHANCE && this.score > 2) {
      const types: PowerUpType[] = ['SHIELD', 'MAGNET', 'STAR_MULTIPLIER', 'GHOST'];
      const chosenType = types[Math.floor(Math.random() * types.length)];
      this.powerUps.push({
        id: this.nextPowerUpId++,
        x: gate.x + gate.width + 55,
        y: gate.baseGapY,
        baseY: gate.baseGapY,
        type: chosenType,
        radius: 14,
        floatPhase: Math.random() * Math.PI * 2,
        collected: false,
      });
    }
  }

  private update(dt: number) {
    if (this.state === 'MENU') {
      this.updateMenuIdle(dt);
      return;
    }

    if (this.state === 'GAMEOVER') {
      this.updateGameOver(dt);
      return;
    }

    if (this.state !== 'PLAYING') return;

    this.runDurationSeconds += dt;

    // Time Attack Mode timer countdown
    if (this.gameMode === 'TIME_ATTACK') {
      this.timeAttackRemaining -= dt;
      if (this.timeAttackRemaining <= 0) {
        this.timeAttackRemaining = 0;
        this.triggerGameOver();
        return;
      }
    }

    // Base speed progression
    let targetWorldSpeed = BASE_WORLD_SPEED + Math.min(this.score * SPEED_ACCEL_PER_SCORE, MAX_WORLD_SPEED - BASE_WORLD_SPEED);
    if (this.gameMode === 'HARDCORE') targetWorldSpeed *= 1.25;
    if (this.gameMode === 'ZEN') targetWorldSpeed *= 0.72;
    if (this.isDailyChallengeRun && saveDataManager.getData().dailyChallenge?.modifier === 'FASTER_GATES') {
      targetWorldSpeed *= 1.2;
    }

    // Power-Up countdowns & transitions
    this.updatePowerUpTimers(dt);

    // Smooth speed multiplier: continuous interpolation with zero speed jumps
    const timeScale = 1.0 - this.slowMoBlend * (1.0 - SLOW_MO_TIME_SCALE);
    const currentWorldSpeed = targetWorldSpeed * timeScale;

    // Weather & Zone updates
    this.updateZoneAndWeather(dt);

    // Void Beast Survival Chase Sequence
    this.updateVoidBeast(dt);

    // 1. Nova Physics
    this.updateNovaPhysics(dt, timeScale);

    // 2. Energy Gates
    this.updateGates(dt, currentWorldSpeed);

    // 3. Collectibles & Power-Ups
    this.updateCollectibles(dt, currentWorldSpeed);

    // 4. Ghost Tracking
    this.updateGhostRun(dt);

    // 5. Particles
    this.particles.update(dt, timeScale);

    // 6. Screen Shake
    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 4);
    }

    // 7. Collision checks
    this.checkCollisions();
  }

  private updatePowerUpTimers(dt: number) {
    // Smooth Slow Motion transition logic with 0.5s activation easing and smooth recovery
    if (this.slowMoActive) {
      // 1. Slow-motion countdown timer
      this.slowMoTimer -= dt;

      // 2. Smooth 0.5-second easing into slow motion (activation trigger transition)
      if (this.slowMoEntering) {
        this.slowMoEnterTimer += dt;
        const enterProgress = Math.min(1.0, this.slowMoEnterTimer / SLOW_MO_ENTER_DURATION);
        // Smooth S-curve easing (smoothstep: 3t^2 - 2t^3)
        const smoothFactor = enterProgress * enterProgress * (3 - 2 * enterProgress);
        this.slowMoBlend = Math.min(
          1.0,
          this.slowMoEnterStartBlend + (1.0 - this.slowMoEnterStartBlend) * smoothFactor
        );

        if (enterProgress >= 1.0) {
          this.slowMoEntering = false;
          this.slowMoBlend = 1.0;
        }
      } else {
        this.slowMoBlend = 1.0;
      }

      // Check if slow motion has expired
      if (this.slowMoTimer <= 0) {
        this.slowMoActive = false;
        this.slowMoEntering = false;
        this.slowMoTimer = 0;
        this.slowMoRecovering = true;
        this.slowMoExitTimer = 0;
        this.slowMoExitStartBlend = this.slowMoBlend;
        audioManager.playSlowMoEnd();
        this.notifyStats();
      }
    } else if (this.slowMoRecovering || this.slowMoBlend > 0) {
      // Smooth speed recovery: gradually restore speed back to normal (1.0) over SLOW_MO_EXIT_DURATION (1.2s)
      this.slowMoExitTimer += dt;
      const exitProgress = Math.min(1.0, this.slowMoExitTimer / SLOW_MO_EXIT_DURATION);
      // Smooth S-curve easing back to normal speed
      const smoothFactor = exitProgress * exitProgress * (3 - 2 * exitProgress);
      this.slowMoBlend = Math.max(0.0, this.slowMoExitStartBlend * (1.0 - smoothFactor));

      if (exitProgress >= 1.0 || this.slowMoBlend <= 0.001) {
        this.slowMoBlend = 0.0;
        this.slowMoRecovering = false;
        this.slowMoExitTimer = 0;
        this.notifyStats();
      }
    }

    if (this.shieldActive) {
      this.shieldTimer -= dt;
      if (this.shieldTimer <= 0) {
        this.shieldActive = false;
        this.nova.hasShield = false;
        this.notifyStats();
      }
    }

    if (this.magnetActive) {
      this.magnetTimer -= dt;
      if (this.magnetTimer <= 0) {
        this.magnetActive = false;
        this.nova.magnetActive = false;
        this.notifyStats();
      }
    }

    if (this.multiplierActive) {
      this.multiplierTimer -= dt;
      if (this.multiplierTimer <= 0) {
        this.multiplierActive = false;
        this.nova.starMultiplierActive = false;
        this.notifyStats();
      }
    }

    if (this.ghostActive) {
      this.ghostTimer -= dt;
      if (this.ghostTimer <= 0) {
        this.ghostActive = false;
        this.nova.isGhost = false;
        this.notifyStats();
      }
    }

    if (this.nova.invulnerabilityTimer > 0) {
      this.nova.invulnerabilityTimer = Math.max(0, this.nova.invulnerabilityTimer - dt);
    }
  }

  private updateZoneAndWeather(dt: number) {
    const newZone = this.getZoneForScore(this.score);
    if (newZone !== this.currentZone) {
      this.currentZone = newZone;
      audioManager.playZoneTransition();
      const zoneNames: Record<SkyZone, string> = {
        NEON_CLOUDS: 'ZONE 1 — NEON CLOUDS',
        CRYSTAL_SKIES: 'ZONE 2 — CRYSTAL SKIES',
        STORM_REALM: 'ZONE 3 — STORM REALM',
        COSMIC_VOID: 'ZONE 4 — COSMIC VOID',
        AURORA_DIMENSION: 'ZONE 5 — AURORA DIMENSION',
      };
      this.particles.addFloatingText(zoneNames[newZone], VIRTUAL_WIDTH / 2, 180, '#38bdf8', true);

      saveDataManager.updateMissionProgress('REACH_ZONE', 1);
      if (newZone === 'AURORA_DIMENSION') {
        const ach = saveDataManager.unlockAchievement('sky_explorer');
        if (ach && this.onNotification) {
          this.onNotification('ACHIEVEMENT UNLOCKED!', ach.title);
          audioManager.playAchievement();
        }
      }
      this.notifyStats();
    }

    // Weather events in specific zones
    if (this.currentZone === 'STORM_REALM') {
      this.weather.type = 'LIGHTNING';
      if (Math.random() < 0.015) {
        this.weather.lightningFlash = 1.0;
      }
    } else if (this.currentZone === 'COSMIC_VOID') {
      this.weather.type = 'METEORS';
    } else if (this.currentZone === 'AURORA_DIMENSION') {
      this.weather.type = 'AURORA';
    } else {
      this.weather.type = 'NONE';
    }

    if (this.weather.lightningFlash > 0) {
      this.weather.lightningFlash = Math.max(0, this.weather.lightningFlash - dt * 5);
    }
  }

  private updateVoidBeast(dt: number) {
    // Void beast chase triggers at score 45
    if (this.score >= 45 && !this.voidBeast.active && !this.voidBeast.defeated) {
      this.voidBeast.active = true;
      this.voidBeast.timer = 0;
      this.voidBeast.gatesSurvived = 0;
      this.particles.addFloatingText('WARNING: VOID BEAST CHASING!', VIRTUAL_WIDTH / 2, 210, '#ef4444', true);
      this.screenShake = 0.5;
    }

    if (this.voidBeast.active) {
      this.voidBeast.timer += dt;
      this.voidBeast.x += (60 - this.voidBeast.x) * (0.8 * dt);
      this.voidBeast.progress = Math.min(1, this.voidBeast.gatesSurvived / this.voidBeast.requiredGates);

      if (this.voidBeast.gatesSurvived >= this.voidBeast.requiredGates) {
        this.voidBeast.active = false;
        this.voidBeast.defeated = true;
        audioManager.playAchievement();
        this.particles.addFloatingText('ESCAPED! +50 COINS', VIRTUAL_WIDTH / 2, 220, '#fbbf24', true);
        saveDataManager.addCoins(50);
        this.coinsInRun += 50;
      }
    }
  }

  private updateGhostRun(dt: number) {
    // Record current trajectory every 0.15s
    this.ghostRecordTimer += dt;
    if (this.ghostRecordTimer >= 0.15) {
      this.ghostRecordTimer = 0;
      this.currentRunGhostPoints.push({
        t: this.runDurationSeconds,
        y: this.nova.y,
        vy: this.nova.vy,
      });
    }
  }

  public getCurrentGhostPoint(): GhostPoint | null {
    if (!this.playbackGhostRun || this.playbackGhostRun.points.length === 0) return null;
    const pts = this.playbackGhostRun.points;
    while (
      this.currentPlaybackIndex < pts.length - 1 &&
      pts[this.currentPlaybackIndex + 1].t <= this.runDurationSeconds
    ) {
      this.currentPlaybackIndex++;
    }
    return pts[this.currentPlaybackIndex] || null;
  }

  private updateMenuIdle(dt: number) {
    this.idleTime += dt;
    this.nova.y = NOVA_START_Y + Math.sin(this.idleTime * 3) * 16;
    this.nova.rotation = Math.sin(this.idleTime * 3) * 0.12;
    this.nova.wingAngle = Math.sin(this.idleTime * 12) * 0.55;

    this.nova.blinkTimer -= dt;
    if (this.nova.blinkTimer <= 0) {
      this.nova.isBlinking = !this.nova.isBlinking;
      this.nova.blinkTimer = this.nova.isBlinking ? 0.14 : 2.5 + Math.random() * 2;
    }

    this.nova.trailTimer += dt;
    if (this.nova.trailTimer > 0.08) {
      this.nova.trailTimer = 0;
      this.particles.emitTrail(this.nova.x, this.nova.y, false);
    }
    this.particles.update(dt, 1.0);
  }

  private updateGameOver(dt: number) {
    if (this.nova.y < VIRTUAL_HEIGHT + 60) {
      this.nova.vy += GRAVITY * dt;
      this.nova.y += this.nova.vy * dt;
      this.nova.rotation += 4 * dt;
    }

    this.particles.update(dt, 1.0);
    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 3);
    }
  }

  private updateNovaPhysics(dt: number, timeScale: number) {
    let effectiveGravity = GRAVITY;
    if (this.slowMoBlend > 0) {
      effectiveGravity *= 1.0 - this.slowMoBlend * (1.0 - SLOW_MO_NOVA_SCALE);
    }
    if (this.gameMode === 'ZEN') effectiveGravity *= 0.85;

    this.nova.vy += effectiveGravity * dt * timeScale;
    if (this.nova.vy > MAX_FALL_SPEED) this.nova.vy = MAX_FALL_SPEED;
    if (this.nova.vy < MAX_RISE_SPEED) this.nova.vy = MAX_RISE_SPEED;

    this.nova.y += this.nova.vy * dt * timeScale;

    const targetRot = Math.max(-0.55, Math.min(1.0, this.nova.vy * 0.0018));
    this.nova.rotation += (targetRot - this.nova.rotation) * (14 * dt);

    this.nova.squashX += (1 - this.nova.squashX) * (12 * dt);
    this.nova.squashY += (1 - this.nova.squashY) * (12 * dt);

    this.nova.wingSpeed += (12 - this.nova.wingSpeed) * (8 * dt);
    this.nova.wingAngle = Math.sin(performance.now() * 0.001 * this.nova.wingSpeed) * 0.55;

    this.nova.blinkTimer -= dt;
    if (this.nova.blinkTimer <= 0) {
      this.nova.isBlinking = !this.nova.isBlinking;
      this.nova.blinkTimer = this.nova.isBlinking ? 0.12 : 2.8 + Math.random() * 2;
    }

    this.nova.trailTimer += dt;
    if (this.nova.trailTimer > 0.04) {
      this.nova.trailTimer = 0;
      this.particles.emitTrail(this.nova.x, this.nova.y, this.slowMoActive);
    }
  }

  private updateGates(dt: number, currentWorldSpeed: number) {
    const time = performance.now() * 0.001;

    for (let i = this.gates.length - 1; i >= 0; i--) {
      const gate = this.gates[i];
      gate.x -= currentWorldSpeed * dt;

      // Vertical oscillation
      if (gate.oscillationAmp > 0) {
        gate.gapY =
          gate.baseGapY +
          Math.sin(time * gate.oscillationFreq + gate.oscillationPhase) * gate.oscillationAmp;
      }

      // Vanishing gate opacity pulse
      if (gate.gateType === 'VANISHING') {
        gate.opacity = 0.5 + Math.sin(time * 3 + gate.id) * 0.45;
      }

      // Check Perfect Gate & Near Miss while Nova is passing through gate X span
      const gateLeft = gate.x;
      const gateRight = gate.x + gate.width;

      if (this.nova.x >= gateLeft && this.nova.x <= gateRight) {
        const topTipY = gate.gapY - gate.gapHeight / 2;
        const bottomTipY = gate.gapY + gate.gapHeight / 2;
        const distFromCenter = Math.abs(this.nova.y - gate.gapY);

        // 1. Perfect Gate check (within 18% of gap center)
        if (!gate.perfectChecked && distFromCenter <= gate.gapHeight * 0.18) {
          gate.perfectChecked = true;
          this.perfectGatesInRun++;
          const bonus = SCORE_PERFECT_GATE * this.combo;
          this.score += bonus;
          this.particles.emitPerfectPass(this.nova.x, this.nova.y, `x${this.combo}`);
          audioManager.playPerfectGate();

          saveDataManager.updateMissionProgress('PERFECT_GATES', 1);
          if (saveDataManager.getData().statistics.perfectGates + this.perfectGatesInRun >= 25) {
            const ach = saveDataManager.unlockAchievement('perfect_pilot');
            if (ach && this.onNotification) {
              this.onNotification('ACHIEVEMENT UNLOCKED!', ach.title);
              audioManager.playAchievement();
            }
          }
        }

        // 2. Near Miss check (within 16px of top/bottom pylon without colliding)
        if (!gate.nearMissChecked) {
          const distToTop = Math.abs(this.nova.y - this.nova.radius - topTipY);
          const distToBottom = Math.abs(bottomTipY - (this.nova.y + this.nova.radius));

          if (distToTop <= 16 || distToBottom <= 16) {
            gate.nearMissChecked = true;
            this.nearMissesInRun++;
            this.score += SCORE_NEAR_MISS;
            this.particles.emitNearMiss(this.nova.x, this.nova.y);
            audioManager.playNearMiss();

            saveDataManager.updateMissionProgress('NEAR_MISSES', 1);
            if (saveDataManager.getData().statistics.nearMisses + this.nearMissesInRun >= 15) {
              const ach = saveDataManager.unlockAchievement('close_call');
              if (ach && this.onNotification) {
                this.onNotification('ACHIEVEMENT UNLOCKED!', ach.title);
                audioManager.playAchievement();
              }
            }
          }
        }
      }

      // Passed Gate
      if (!gate.passed && gate.x + gate.width < this.nova.x) {
        gate.passed = true;
        this.score += SCORE_NORMAL_GATE * this.combo;

        // Increase combo multiplier up to x10
        if (this.combo < MAX_COMBO) {
          this.combo++;
          this.maxCombo = Math.max(this.maxCombo, this.combo);
          audioManager.playCombo(this.combo);
          if (this.combo >= 10) {
            const ach = saveDataManager.unlockAchievement('combo_master');
            if (ach && this.onNotification) {
              this.onNotification('ACHIEVEMENT UNLOCKED!', ach.title);
              audioManager.playAchievement();
            }
          }
        } else {
          audioManager.playGatePass();
        }

        // Void beast survival progress
        if (this.voidBeast.active) {
          this.voidBeast.gatesSurvived++;
        }

        // Missions & high score update
        saveDataManager.updateMissionProgress('MAX_COMBO', this.combo, true);
        saveDataManager.updateMissionProgress('REACH_SCORE', this.score, true);

        if (this.score > this.highScore && this.gameMode === 'CLASSIC') {
          if (!this.isNewHighScore) {
            this.isNewHighScore = true;
            this.particles.addFloatingText('NEW BEST!', this.nova.x + 20, this.nova.y - 32, '#fbbf24', true);
          }
          this.highScore = this.score;
        }

        this.notifyStats();
      }

      if (gate.x + gate.width < -80) {
        this.gates.splice(i, 1);
      }
    }

    const lastGate = this.gates[this.gates.length - 1];
    if (lastGate && lastGate.x <= VIRTUAL_WIDTH + GATE_SPACING) {
      this.spawnGateAt(lastGate.x + GATE_SPACING);
    }
  }

  private updateCollectibles(dt: number, currentWorldSpeed: number) {
    // 1. Stars
    for (let i = this.stars.length - 1; i >= 0; i--) {
      const star = this.stars[i];
      star.x -= currentWorldSpeed * dt;
      star.floatPhase += dt * 3.5;
      star.y = star.baseY + Math.sin(star.floatPhase) * 10;

      // Magnet attraction
      if (this.magnetActive && !star.collected) {
        const dx = this.nova.x - star.x;
        const dy = this.nova.y - star.y;
        const dist = Math.hypot(dx, dy);
        if (dist < MAGNET_RADIUS) {
          star.x += (dx / dist) * 280 * dt;
          star.y += (dy / dist) * 280 * dt;
        }
      }

      if (!star.collected) {
        const dist = Math.hypot(this.nova.x - star.x, this.nova.y - star.y);
        if (dist < this.nova.radius + star.radius + 6) {
          this.collectStar(star);
        }
      }

      if (star.x < -60 || star.collected) {
        this.stars.splice(i, 1);
      }
    }

    // 2. Coins
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const coin = this.coins[i];
      coin.x -= currentWorldSpeed * dt;
      coin.floatPhase += dt * 3.5;
      coin.y = coin.baseY + Math.sin(coin.floatPhase) * 8;
      coin.rotation += dt * 4.2;

      // Magnet attraction
      if (this.magnetActive && !coin.collected) {
        const dx = this.nova.x - coin.x;
        const dy = this.nova.y - coin.y;
        const dist = Math.hypot(dx, dy);
        if (dist < MAGNET_RADIUS) {
          coin.x += (dx / dist) * 300 * dt;
          coin.y += (dy / dist) * 300 * dt;
        }
      }

      if (!coin.collected) {
        const dist = Math.hypot(this.nova.x - coin.x, this.nova.y - coin.y);
        if (dist < this.nova.radius + coin.radius + 6) {
          this.collectCoin(coin);
        }
      }

      if (coin.x < -60 || coin.collected) {
        this.coins.splice(i, 1);
      }
    }

    // 3. Power-Up Orbs
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const pu = this.powerUps[i];
      pu.x -= currentWorldSpeed * dt;
      pu.floatPhase += dt * 3;
      pu.y = pu.baseY + Math.sin(pu.floatPhase) * 12;

      if (!pu.collected) {
        const dist = Math.hypot(this.nova.x - pu.x, this.nova.y - pu.y);
        if (dist < this.nova.radius + pu.radius + 6) {
          this.collectPowerUp(pu);
        }
      }

      if (pu.x < -60 || pu.collected) {
        this.powerUps.splice(i, 1);
      }
    }
  }

  private collectStar(star: CollectibleStar) {
    star.collected = true;
    const starVal = this.multiplierActive ? 2 : 1;
    this.starsInRun += starVal;
    this.starsTowardsSlowMo += starVal;

    saveDataManager.addStars(starVal);
    saveDataManager.updateMissionProgress('COLLECT_STARS', starVal);

    if (this.gameMode === 'TIME_ATTACK') {
      this.timeAttackRemaining = Math.min(60, this.timeAttackRemaining + 3);
      this.particles.addFloatingText('+3s', star.x, star.y - 18, '#34d399');
    }

    this.score += SCORE_STAR * starVal;
    audioManager.playStarCollect();
    this.particles.emitStarCollection(star.x, star.y, this.multiplierActive);

    // 5 Stars rule activates Slow Motion
    if (this.starsTowardsSlowMo >= STARS_PER_SLOW_MO) {
      this.starsTowardsSlowMo = 0;
      this.activatePowerUp('SLOW_MO');
    }

    if (saveDataManager.getData().totalStars >= 100) {
      const ach = saveDataManager.unlockAchievement('star_collector');
      if (ach && this.onNotification) {
        this.onNotification('ACHIEVEMENT UNLOCKED!', ach.title);
        audioManager.playAchievement();
      }
    }

    this.notifyStats();
  }

  private collectCoin(coin: CollectibleCoin) {
    coin.collected = true;
    this.coinsInRun++;
    this.score += SCORE_COIN;

    saveDataManager.addCoins(1);
    saveDataManager.updateMissionProgress('COLLECT_COINS', 1);

    audioManager.playCoinCollect();
    this.particles.emitCoinCollection(coin.x, coin.y);

    if (saveDataManager.getData().totalCoins >= 500) {
      const ach = saveDataManager.unlockAchievement('coin_hunter');
      if (ach && this.onNotification) {
        this.onNotification('ACHIEVEMENT UNLOCKED!', ach.title);
        audioManager.playAchievement();
      }
    }

    this.notifyStats();
  }

  private collectPowerUp(pu: ActivePowerUpItem) {
    pu.collected = true;
    this.powerUpsInRun++;
    saveDataManager.updateMissionProgress('USE_POWERUPS', 1);
    this.activatePowerUp(pu.type);
    audioManager.playPowerUpCollect();
    this.notifyStats();
  }

  private activatePowerUp(type: PowerUpType, customDuration?: number) {
    if (type === 'SLOW_MO') {
      const requestedDuration = customDuration || SLOW_MO_DURATION;
      const isAlreadySlow = this.slowMoActive && this.slowMoBlend > 0.5;

      this.slowMoActive = true;
      this.slowMoRecovering = false;
      this.slowMoTimer = requestedDuration;

      // Activate 0.5-second smooth easing into slow motion (rather than an instant jump)
      this.slowMoEntering = true;
      this.slowMoEnterTimer = 0;
      this.slowMoEnterStartBlend = this.slowMoBlend; // smoothly starts easing from current blend level

      if (!isAlreadySlow) {
        audioManager.playSlowMoActivate();
      }
      this.particles.emitSlowMoActivation(this.nova.x, this.nova.y);
      this.notifyStats();
    } else if (type === 'SHIELD') {
      this.shieldActive = true;
      this.shieldTimer = SHIELD_DURATION;
      this.nova.hasShield = true;
      this.particles.emitPowerUpCollect(this.nova.x, this.nova.y, 'ENERGY SHIELD!', '#38bdf8');
    } else if (type === 'MAGNET') {
      this.magnetActive = true;
      this.magnetTimer = MAGNET_DURATION;
      this.nova.magnetActive = true;
      this.particles.emitPowerUpCollect(this.nova.x, this.nova.y, 'MAGNET ACTIVE!', '#ec4899');
    } else if (type === 'STAR_MULTIPLIER') {
      this.multiplierActive = true;
      this.multiplierTimer = MULTIPLIER_DURATION;
      this.nova.starMultiplierActive = true;
      this.particles.emitPowerUpCollect(this.nova.x, this.nova.y, '2X STARS!', '#fbbf24');
    } else if (type === 'GHOST') {
      this.ghostActive = true;
      this.ghostTimer = GHOST_DURATION;
      this.nova.isGhost = true;
      this.particles.emitPowerUpCollect(this.nova.x, this.nova.y, 'GHOST MODE!', '#a855f7');
    }
  }

  private checkCollisions() {
    // If ghost mode is active, Nova passes straight through obstacles!
    if (this.nova.isGhost) return;

    // Floor & ceiling
    if (this.nova.y - this.nova.radius <= 6) {
      this.nova.y = 6 + this.nova.radius;
      this.nova.vy = 0;
    }

    if (this.nova.y + this.nova.radius >= VIRTUAL_HEIGHT - 8) {
      this.handleDamageCollision();
      return;
    }

    // Energy Gate Pylons
    for (const gate of this.gates) {
      const gateLeft = gate.x;
      const gateRight = gate.x + gate.width;

      if (
        this.nova.x + this.nova.radius > gateLeft + 4 &&
        this.nova.x - this.nova.radius < gateRight - 4
      ) {
        const topTipY = gate.gapY - gate.gapHeight / 2;
        const bottomTipY = gate.gapY + gate.gapHeight / 2;

        if (
          this.nova.y - this.nova.radius < topTipY ||
          this.nova.y + this.nova.radius > bottomTipY
        ) {
          this.handleDamageCollision();
          return;
        }
      }
    }
  }

  private handleDamageCollision() {
    // Check if invulnerable
    if (this.nova.invulnerabilityTimer > 0) return;

    // Check if Shield absorbs the hit
    if (this.shieldActive || this.nova.hasShield) {
      this.shieldActive = false;
      this.nova.hasShield = false;
      this.nova.invulnerabilityTimer = 1.6;
      this.nova.vy = -180; // gentle bounce
      this.screenShake = 0.5;
      audioManager.playShieldBreak();
      this.particles.emitShieldBreak(this.nova.x, this.nova.y);
      return;
    }

    this.triggerGameOver();
  }

  private triggerGameOver() {
    if (this.state === 'GAMEOVER') return;

    this.setState('GAMEOVER');
    this.slowMoActive = false;
    this.slowMoEntering = false;
    this.slowMoRecovering = false;
    this.slowMoTimer = 0;
    this.slowMoEnterTimer = 0;
    this.slowMoExitTimer = 0;
    this.slowMoBlend = 0;
    this.screenShake = 1.0;
    audioManager.playCollision();
    audioManager.playGameOver();
    this.particles.emitCrash(this.nova.x, this.nova.y);

    // Save statistics & check high scores
    const isNew = saveDataManager.updateHighScore(this.score, this.gameMode);
    if (isNew) {
      this.isNewHighScore = true;
      this.highScore = this.score;
      if (this.currentRunGhostPoints.length > 5) {
        saveDataManager.saveGhostRun({
          score: this.score,
          points: [...this.currentRunGhostPoints],
        });
      }
    }

    // Record persistent run statistics
    const zoneNum =
      this.currentZone === 'AURORA_DIMENSION'
        ? 5
        : this.currentZone === 'COSMIC_VOID'
        ? 4
        : this.currentZone === 'STORM_REALM'
        ? 3
        : this.currentZone === 'CRYSTAL_SKIES'
        ? 2
        : 1;

    saveDataManager.recordRunStatistics({
      score: this.score,
      stars: this.starsInRun,
      coins: this.coinsInRun,
      combo: this.maxCombo,
      perfectGates: this.perfectGatesInRun,
      nearMisses: this.nearMissesInRun,
      durationSeconds: Math.round(this.runDurationSeconds),
      powerUps: this.powerUpsInRun,
      zoneReachedNumber: zoneNum,
      mode: this.gameMode,
    });

    // Check First Flight Achievement
    const firstAch = saveDataManager.unlockAchievement('first_flight');
    if (firstAch && this.onNotification) {
      this.onNotification('ACHIEVEMENT UNLOCKED!', firstAch.title);
      audioManager.playAchievement();
    }

    // Check Sky Legend (50+ score)
    if (this.score >= 50) {
      const legendAch = saveDataManager.unlockAchievement('sky_legend');
      if (legendAch && this.onNotification) {
        this.onNotification('ACHIEVEMENT UNLOCKED!', legendAch.title);
        audioManager.playAchievement();
      }
    }

    // Check Daily Challenge completion
    if (this.isDailyChallengeRun) {
      const dc = saveDataManager.getData().dailyChallenge;
      if (dc && !dc.completed && this.score >= dc.targetScore) {
        dc.completed = true;
        saveDataManager.addCoins(dc.rewardCoins);
        audioManager.playAchievement();
        if (this.onNotification) {
          this.onNotification('DAILY CHALLENGE COMPLETE!', `+${dc.rewardCoins} Coins Earned!`);
        }
      }
    }

    // Submit validated score to authoritative Global Leaderboard & Country Competition
    const scoreMetrics = {
      score: this.score,
      maxCombo: this.maxCombo,
      perfectGates: this.perfectGatesInRun,
      nearMisses: this.nearMissesInRun,
      stars: this.starsInRun,
      coins: this.coinsInRun,
      durationSeconds: Math.max(1, Math.round(this.runDurationSeconds)),
      zoneReached: this.currentZone,
      gameMode: this.gameMode,
    };

    leaderboardClient.submitScore(scoreMetrics).then((result) => {
      this.latestLeaderboardResult = result;
      if (this.onLeaderboardResult) {
        this.onLeaderboardResult(result);
      }
    });

    this.notifyStats();
  }

  private draw(dt: number) {
    const isPaused = this.state === 'PAUSED';
    const renderDt = isPaused ? 0 : dt;
    const currentSpeed =
      BASE_WORLD_SPEED + Math.min(this.score * SPEED_ACCEL_PER_SCORE, 100);
    const renderSpeed = this.state === 'PLAYING' ? currentSpeed : isPaused ? 0 : 40;
    const ghostPt = this.state === 'PLAYING' ? this.getCurrentGhostPoint() : null;

    this.renderer.render(
      renderDt,
      this.nova,
      this.equippedSkin,
      this.gates,
      this.stars,
      this.coins,
      this.powerUps,
      this.particles,
      isPaused ? 0 : this.screenShake,
      this.slowMoBlend,
      renderSpeed,
      this.currentZone,
      this.weather,
      this.voidBeast,
      ghostPt
    );
  }
}
