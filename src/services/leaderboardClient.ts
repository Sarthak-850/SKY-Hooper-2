/**
 * Sky Hopper - Leaderboard & Country Competition Client Service
 * Handles API communication, country detection, session tokens, offline submission queuing,
 * real-time SSE updates, and local profile synchronization.
 */

import {
  PlayerProfile,
  LeaderboardResponse,
  CountryLeaderboardResponse,
  ScoreSubmissionPayload,
  ScoreSubmissionResult,
  LeaderboardTimeframe,
  CountrySortMetric,
  LeaderboardEntry,
  CountryInfo,
  LeaderboardLiveEvent,
  PlayerStatsResponse,
} from '../types/leaderboard';

const STORAGE_PROFILE_KEY = 'sky_hooper_pilot_profile_v2';
const STORAGE_OFFLINE_QUEUE_KEY = 'sky_hooper_offline_scores_v2';

export interface LocalPilotProfile {
  id: string;
  username: string;
  countryCode: string;
  countryName: string;
  countryFlag: string;
  countrySelected: boolean;
}

class LeaderboardClientService {
  private profile: LocalPilotProfile;
  private currentSession: { sessionId: string; token: string; startTime: number } | null = null;
  private sseSource: EventSource | null = null;
  private liveListeners: Set<(event: LeaderboardLiveEvent) => void> = new Set();
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;

  constructor() {
    this.profile = this.loadLocalProfile();
    this.setupNetworkListeners();
    this.initCountryDetection();
    this.initRealtimeStream();
    this.flushOfflineQueue();
  }

  // --- Local Profile Storage ---

  private loadLocalProfile(): LocalPilotProfile {
    try {
      const raw = localStorage.getItem(STORAGE_PROFILE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.id && parsed.countryCode) {
          return parsed;
        }
      }
    } catch {
      // storage unavailable or restricted
    }

    // Default unconfigured profile
    const newId = `pilot_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
    const def: LocalPilotProfile = {
      id: newId,
      username: 'Nova Pilot',
      countryCode: 'IN',
      countryName: 'India',
      countryFlag: '🇮🇳',
      countrySelected: false,
    };
    this.saveLocalProfile(def);
    return def;
  }

  private saveLocalProfile(profile: LocalPilotProfile) {
    this.profile = profile;
    try {
      localStorage.setItem(STORAGE_PROFILE_KEY, JSON.stringify(profile));
    } catch {
      // safe fallback
    }
  }

  public getProfile(): LocalPilotProfile {
    return { ...this.profile };
  }

  // --- Automatic Country Detection & Registration ---

  public async initCountryDetection(): Promise<LocalPilotProfile> {
    try {
      // If player already manually selected their country, don't override
      if (this.profile.countrySelected) {
        await this.syncProfileWithServer();
        return this.profile;
      }

      // Detect country via backend / CDN IP detection
      const res = await fetch('/api/detect-country');
      if (res.ok) {
        const data = await res.json();
        if (data.countryCode && !this.profile.countrySelected) {
          this.profile.countryCode = data.countryCode;
          this.profile.countryName = data.countryName;
          this.profile.countryFlag = data.countryFlag;
          this.saveLocalProfile(this.profile);
        }
      }
    } catch {
      // Offline fallback
    }

    await this.syncProfileWithServer();
    return this.profile;
  }

  public async updateProfile(username: string, countryCode: string, countryName: string, countryFlag: string): Promise<LocalPilotProfile> {
    const updated: LocalPilotProfile = {
      ...this.profile,
      username: username.trim().slice(0, 24) || 'Nova Pilot',
      countryCode: countryCode.toUpperCase(),
      countryName,
      countryFlag,
      countrySelected: true,
    };

    this.saveLocalProfile(updated);

    try {
      const res = await fetch('/api/player/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: updated.id,
          username: updated.username,
          countryCode: updated.countryCode,
          countryName: updated.countryName,
          countryFlag: updated.countryFlag,
        }),
      });
      if (res.ok) {
        const serverProfile: PlayerProfile = await res.json();
        this.profile = {
          id: serverProfile.id,
          username: serverProfile.username,
          countryCode: serverProfile.countryCode,
          countryName: serverProfile.countryName,
          countryFlag: serverProfile.countryFlag,
          countrySelected: true,
        };
        this.saveLocalProfile(this.profile);
      }
    } catch {
      // Offline: profile will sync on next online event
    }

    return this.profile;
  }

  private async syncProfileWithServer(): Promise<void> {
    try {
      await fetch('/api/player/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: this.profile.id,
          username: this.profile.username,
          countryCode: this.profile.countryCode,
          countryName: this.profile.countryName,
          countryFlag: this.profile.countryFlag,
        }),
      });
    } catch {
      // Ignore if offline
    }
  }

  public async getPlayerStats(): Promise<PlayerStatsResponse | null> {
    try {
      const res = await fetch(`/api/player/${this.profile.id}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // offline
    }
    return null;
  }

  // --- Session Management ---

  public async startSession(gameMode: string = 'CLASSIC'): Promise<string | null> {
    try {
      const res = await fetch('/api/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: this.profile.id,
          gameMode,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        this.currentSession = {
          sessionId: data.sessionId,
          token: data.token,
          startTime: data.startTime,
        };
        return data.sessionId;
      }
    } catch {
      // offline session will use local fallback
    }

    // Fallback offline session
    const offlineSessId = `offline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.currentSession = {
      sessionId: offlineSessId,
      token: 'offline_token',
      startTime: Date.now(),
    };
    return offlineSessId;
  }

  // --- Score Submission with Anti-Cheat & Offline Queue ---

  public async submitScore(metrics: {
    score: number;
    maxCombo: number;
    perfectGates: number;
    nearMisses: number;
    stars: number;
    coins: number;
    durationSeconds: number;
    zoneReached: string;
    gameMode: string;
  }): Promise<ScoreSubmissionResult> {
    const session = this.currentSession || {
      sessionId: `sess_${Date.now()}`,
      token: 'fallback_token',
      startTime: Date.now() - Math.round(metrics.durationSeconds * 1000),
    };

    const payload: ScoreSubmissionPayload = {
      playerId: this.profile.id,
      sessionId: session.sessionId,
      sessionToken: session.token,
      score: metrics.score,
      maxCombo: metrics.maxCombo,
      perfectGates: metrics.perfectGates,
      nearMisses: metrics.nearMisses,
      stars: metrics.stars,
      coins: metrics.coins,
      durationSeconds: metrics.durationSeconds,
      zoneReached: metrics.zoneReached,
      gameMode: metrics.gameMode,
      timestamp: Date.now(),
    };

    // Reset current active session
    this.currentSession = null;

    try {
      const res = await fetch('/api/scores/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const result: ScoreSubmissionResult = await res.json();
        return result;
      } else {
        const err = await res.json().catch(() => ({}));
        console.warn('Score submission validation error:', err);
      }
    } catch (e) {
      console.warn('Network error submitting score, saving to offline queue', e);
      this.queueOfflineScore(payload);
    }

    // Offline / fallback response
    return {
      success: true,
      score: metrics.score,
      isNewBest: false,
      previousBest: metrics.score,
      worldRank: 0,
      previousWorldRank: null,
      worldRankImprovement: 0,
      countryRank: 0,
      previousCountryRank: null,
      countryRankImprovement: 0,
      totalWorldPlayers: 0,
      totalCountryPlayers: 0,
      message: 'Score queued for synchronization once network reconnects.',
    };
  }

  private queueOfflineScore(payload: ScoreSubmissionPayload) {
    try {
      const raw = localStorage.getItem(STORAGE_OFFLINE_QUEUE_KEY);
      const queue: ScoreSubmissionPayload[] = raw ? JSON.parse(raw) : [];
      queue.push(payload);
      localStorage.setItem(STORAGE_OFFLINE_QUEUE_KEY, JSON.stringify(queue.slice(-20))); // Keep last 20
    } catch {
      // storage unavailable
    }
  }

  public async flushOfflineQueue() {
    try {
      const raw = localStorage.getItem(STORAGE_OFFLINE_QUEUE_KEY);
      if (!raw) return;
      const queue: ScoreSubmissionPayload[] = JSON.parse(raw);
      if (!Array.isArray(queue) || queue.length === 0) return;

      const remaining: ScoreSubmissionPayload[] = [];
      for (const item of queue) {
        try {
          const res = await fetch('/api/scores/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item),
          });
          if (!res.ok && res.status >= 500) {
            remaining.push(item);
          }
        } catch {
          remaining.push(item);
          break; // still offline
        }
      }

      if (remaining.length > 0) {
        localStorage.setItem(STORAGE_OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
      } else {
        localStorage.removeItem(STORAGE_OFFLINE_QUEUE_KEY);
      }
    } catch {
      // ignore
    }
  }

  // --- Leaderboard Queries ---

  public async fetchWorldLeaderboard(options: {
    timeframe?: LeaderboardTimeframe;
    limit?: number;
    offset?: number;
  } = {}): Promise<LeaderboardResponse> {
    const params = new URLSearchParams({
      timeframe: options.timeframe || 'all',
      limit: String(options.limit || 50),
      offset: String(options.offset || 0),
      playerId: this.profile.id,
    });

    const res = await fetch(`/api/leaderboard/world?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Failed to load world leaderboard (${res.status})`);
    }
    return res.json();
  }

  public async fetchCountryLeaderboard(countryCode: string, options: {
    timeframe?: LeaderboardTimeframe;
    limit?: number;
    offset?: number;
  } = {}): Promise<LeaderboardResponse> {
    const params = new URLSearchParams({
      timeframe: options.timeframe || 'all',
      limit: String(options.limit || 50),
      offset: String(options.offset || 0),
      playerId: this.profile.id,
    });

    const res = await fetch(`/api/leaderboard/country/${countryCode}?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Failed to load country leaderboard for ${countryCode} (${res.status})`);
    }
    return res.json();
  }

  public async fetchCountryCompetition(sortBy: CountrySortMetric = 'totalScore'): Promise<CountryLeaderboardResponse> {
    const params = new URLSearchParams({
      sortBy,
      countryCode: this.profile.countryCode,
    });

    const res = await fetch(`/api/leaderboard/countries?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Failed to load country battle rankings (${res.status})`);
    }
    return res.json();
  }

  public async searchLeaderboard(query: string): Promise<(LeaderboardEntry & { countryRank: number; worldRank: number })[]> {
    if (!query.trim()) return [];
    const params = new URLSearchParams({ q: query.trim() });
    const res = await fetch(`/api/leaderboard/search?${params.toString()}`);
    if (!res.ok) return [];
    return res.json();
  }

  public async fetchCountries(): Promise<CountryInfo[]> {
    try {
      const res = await fetch('/api/countries');
      if (res.ok) return await res.json();
    } catch {
      // offline
    }
    return [];
  }

  // --- Real-Time SSE Updates ---

  private initRealtimeStream() {
    if (typeof EventSource === 'undefined') return;

    try {
      this.sseSource = new EventSource('/api/leaderboard/live');

      this.sseSource.onmessage = (e) => {
        try {
          const event: LeaderboardLiveEvent = JSON.parse(e.data);
          if (event && event.type) {
            for (const listener of this.liveListeners) {
              listener(event);
            }
          }
        } catch {
          // ignore non-json ping
        }
      };

      this.sseSource.onerror = () => {
        // EventSource will automatically retry connecting
      };
    } catch {
      // ignore
    }
  }

  public subscribeToLiveUpdates(listener: (event: LeaderboardLiveEvent) => void): () => void {
    this.liveListeners.add(listener);
    return () => {
      this.liveListeners.delete(listener);
    };
  }

  // --- Network State ---

  private setupNetworkListeners() {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.flushOfflineQueue();
      if (!this.sseSource || this.sseSource.readyState === EventSource.CLOSED) {
        this.initRealtimeStream();
      }
    });
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  public checkOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }
}

export const leaderboardClient = new LeaderboardClientService();
