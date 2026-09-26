/**
 * Sky Hopper - Save Data & Persistence Manager
 * Handles local storage synchronization, validation, version migrations,
 * and memory fallbacks.
 */

import {
  STORAGE_SAVE_KEY,
  DEFAULT_SETTINGS,
  DEFAULT_STATISTICS,
  ACHIEVEMENTS_LIST,
  MISSIONS_POOL,
  NOVA_SKINS,
} from './constants';
import {
  NovaSkinId,
  GameSettings,
  GameStatistics,
  Achievement,
  Mission,
  DailyChallengeData,
  GhostRunData,
  GameMode,
} from './types';

export interface PersistentSaveData {
  version: number;
  highScore: number;
  totalCoins: number;
  totalStars: number;
  equippedSkin: NovaSkinId;
  unlockedSkins: NovaSkinId[];
  achievements: Achievement[];
  activeMissions: Mission[];
  dailyChallenge: DailyChallengeData | null;
  lastDailyRewardDate: string | null;
  ghostRun: GhostRunData | null;
  settings: GameSettings;
  statistics: GameStatistics;
}

class SaveDataManager {
  private cache: PersistentSaveData;
  private isStorageAvailable: boolean = true;

  constructor() {
    this.cache = this.createDefaultSave();
    this.load();
  }

  private createDefaultSave(): PersistentSaveData {
    return {
      version: 2,
      highScore: 0,
      totalCoins: 0,
      totalStars: 0,
      equippedSkin: 'default',
      unlockedSkins: ['default'],
      achievements: JSON.parse(JSON.stringify(ACHIEVEMENTS_LIST)),
      activeMissions: this.initializeActiveMissions(),
      dailyChallenge: this.generateDailyChallenge(),
      lastDailyRewardDate: null,
      ghostRun: null,
      settings: { ...DEFAULT_SETTINGS },
      statistics: { ...DEFAULT_STATISTICS },
    };
  }

  private initializeActiveMissions(): Mission[] {
    const active: Mission[] = [];
    const pool = [...MISSIONS_POOL];
    for (let i = 0; i < 3 && pool.length > 0; i++) {
      const item = pool.splice(i % pool.length, 1)[0];
      active.push({
        ...item,
        current: 0,
        completed: false,
        claimed: false,
      });
    }
    return active;
  }

  public getTodayKey(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  public generateDailyChallenge(targetDate?: string): DailyChallengeData {
    const dateKey = targetDate || this.getTodayKey();
    // Deterministic pseudo-random seed from dateKey
    let seed = 0;
    for (let i = 0; i < dateKey.length; i++) {
      seed = (seed * 31 + dateKey.charCodeAt(i)) >>> 0;
    }

    const modifiers: ('FASTER_GATES' | 'STAR_RUSH' | 'NARROW_PASSAGE' | 'WINDY_CONDITIONS')[] = [
      'FASTER_GATES',
      'STAR_RUSH',
      'NARROW_PASSAGE',
      'WINDY_CONDITIONS',
    ];
    const mod = modifiers[seed % modifiers.length];

    const targetScores = [25, 30, 35, 40];
    const targetScore = targetScores[(seed >> 2) % targetScores.length];

    let modTitle = 'Accelerated Skies';
    let modDesc = 'Energy gates drift 20% faster than usual.';
    if (mod === 'STAR_RUSH') {
      modTitle = 'Starstorm Surge';
      modDesc = 'Abundant stars spawn at every gate. Grab as many as you can!';
    } else if (mod === 'NARROW_PASSAGE') {
      modTitle = 'Narrow Aperture';
      modDesc = 'Tighter gate openings require pin-point flying control.';
    } else if (mod === 'WINDY_CONDITIONS') {
      modTitle = 'Turbulent Gusts';
      modDesc = 'Gentle wind drafts challenge your altitude holding.';
    }

    return {
      dateKey,
      title: modTitle,
      description: `${modDesc} Reach ${targetScore} score.`,
      targetScore,
      modifier: mod,
      rewardCoins: 200,
      completed: false,
    };
  }

  public load(): PersistentSaveData {
    try {
      const raw = localStorage.getItem(STORAGE_SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          // Merge with defaults to guarantee safety
          this.cache = {
            ...this.createDefaultSave(),
            ...parsed,
            settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
            statistics: { ...DEFAULT_STATISTICS, ...(parsed.statistics || {}) },
          };

          // Check if daily challenge is outdated
          const today = this.getTodayKey();
          if (!this.cache.dailyChallenge || this.cache.dailyChallenge.dateKey !== today) {
            this.cache.dailyChallenge = this.generateDailyChallenge(today);
          }

          // Ensure all achievements exist
          for (const ach of ACHIEVEMENTS_LIST) {
            if (!this.cache.achievements.some((a) => a.id === ach.id)) {
              this.cache.achievements.push({ ...ach });
            }
          }

          return this.cache;
        }
      }
    } catch {
      this.isStorageAvailable = false;
    }

    return this.cache;
  }

  public save() {
    try {
      if (this.isStorageAvailable) {
        localStorage.setItem(STORAGE_SAVE_KEY, JSON.stringify(this.cache));
      }
    } catch {
      // safe fallback in restricted sandboxes
    }
  }

  public getData(): PersistentSaveData {
    return this.cache;
  }

  public updateHighScore(score: number, mode: GameMode = 'CLASSIC'): boolean {
    let isNew = false;
    if (score > this.cache.highScore && mode === 'CLASSIC') {
      this.cache.highScore = score;
      isNew = true;
    }

    if (score > (this.cache.statistics.modeBestScores[mode] || 0)) {
      this.cache.statistics.modeBestScores[mode] = score;
    }

    if (score > this.cache.statistics.highestScore) {
      this.cache.statistics.highestScore = score;
    }

    this.save();
    return isNew;
  }

  public addCoins(amount: number) {
    if (amount <= 0) return;
    this.cache.totalCoins += amount;
    this.cache.statistics.totalCoins += amount;
    this.save();
  }

  public spendCoins(amount: number): boolean {
    if (this.cache.totalCoins >= amount) {
      this.cache.totalCoins -= amount;
      this.save();
      return true;
    }
    return false;
  }

  public addStars(amount: number) {
    if (amount <= 0) return;
    this.cache.totalStars += amount;
    this.cache.statistics.totalStars += amount;
    this.save();
  }

  public unlockSkin(skinId: NovaSkinId): boolean {
    if (!this.cache.unlockedSkins.includes(skinId)) {
      this.cache.unlockedSkins.push(skinId);
      this.save();
      return true;
    }
    return false;
  }

  public equipSkin(skinId: NovaSkinId) {
    if (this.cache.unlockedSkins.includes(skinId)) {
      this.cache.equippedSkin = skinId;
      this.save();
    }
  }

  public unlockAchievement(achievementId: string): Achievement | null {
    const ach = this.cache.achievements.find((a) => a.id === achievementId);
    if (ach && !ach.unlocked) {
      ach.unlocked = true;
      ach.unlockedAt = Date.now();

      // Check if this unlocks a skin like Golden Nova
      const rewardSkin = NOVA_SKINS.find((s) => s.requiredAchievementId === achievementId);
      if (rewardSkin) {
        this.unlockSkin(rewardSkin.id);
      }

      this.save();
      return ach;
    }
    return null;
  }

  public updateMissionProgress(
    type: Mission['type'],
    amount: number,
    isAbsoluteScore: boolean = false
  ): Mission[] {
    const completedMissions: Mission[] = [];

    for (const mission of this.cache.activeMissions) {
      if (mission.type === type && !mission.completed) {
        if (isAbsoluteScore) {
          mission.current = Math.max(mission.current, amount);
        } else {
          mission.current += amount;
        }

        if (mission.current >= mission.goal) {
          mission.current = mission.goal;
          mission.completed = true;
          completedMissions.push(mission);
        }
      }
    }

    if (completedMissions.length > 0) {
      this.save();
    }
    return completedMissions;
  }

  public claimMissionReward(missionId: string): number {
    const idx = this.cache.activeMissions.findIndex((m) => m.id === missionId);
    if (idx !== -1) {
      const mission = this.cache.activeMissions[idx];
      if (mission.completed && !mission.claimed) {
        mission.claimed = true;
        const reward = mission.rewardCoins;
        this.addCoins(reward);

        // Replace claimed mission with a fresh one from pool
        const unusedPool = MISSIONS_POOL.filter(
          (poolItem) => !this.cache.activeMissions.some((m) => m.id === poolItem.id)
        );
        if (unusedPool.length > 0) {
          const next = unusedPool[Math.floor(Math.random() * unusedPool.length)];
          this.cache.activeMissions[idx] = {
            ...next,
            current: 0,
            completed: false,
            claimed: false,
          };
        }

        this.save();
        return reward;
      }
    }
    return 0;
  }

  public checkDailyRewardAvailable(): boolean {
    const today = this.getTodayKey();
    return this.cache.lastDailyRewardDate !== today;
  }

  public claimDailyReward(): number {
    if (this.checkDailyRewardAvailable()) {
      this.cache.lastDailyRewardDate = this.getTodayKey();
      const reward = 100;
      this.addCoins(reward);
      this.save();
      return reward;
    }
    return 0;
  }

  public updateSettings(settings: Partial<GameSettings>) {
    this.cache.settings = { ...this.cache.settings, ...settings };
    this.save();
  }

  public recordRunStatistics(stats: {
    score: number;
    stars: number;
    coins: number;
    combo: number;
    perfectGates: number;
    nearMisses: number;
    durationSeconds: number;
    powerUps: number;
    zoneReachedNumber: number;
    mode: GameMode;
  }) {
    const s = this.cache.statistics;
    s.totalRuns++;
    s.totalGates += stats.score;
    s.totalStars += stats.stars;
    s.totalCoins += stats.coins;
    s.highestCombo = Math.max(s.highestCombo, stats.combo);
    s.perfectGates += stats.perfectGates;
    s.nearMisses += stats.nearMisses;
    s.longestRunSeconds = Math.max(s.longestRunSeconds, stats.durationSeconds);
    s.zonesReached = Math.max(s.zonesReached, stats.zoneReachedNumber);
    s.powerUpsCollected += stats.powerUps;
    s.highestScore = Math.max(s.highestScore, stats.score);
    s.modeBestScores[stats.mode] = Math.max(s.modeBestScores[stats.mode] || 0, stats.score);

    this.save();
  }

  public saveGhostRun(ghostData: GhostRunData) {
    if (!this.cache.ghostRun || ghostData.score > this.cache.ghostRun.score) {
      this.cache.ghostRun = ghostData;
      this.save();
    }
  }

  public getGhostRun(): GhostRunData | null {
    return this.cache.ghostRun;
  }
}

export const saveDataManager = new SaveDataManager();
