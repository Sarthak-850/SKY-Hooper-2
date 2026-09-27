/**
 * Sky Hopper - Production Full-Stack Leaderboard & Auth Client Service
 * 
 * Authoritative connection to Node.js + PostgreSQL backend.
 * Supports:
 * - Real user accounts (Register, Login, Logout, Session check)
 * - Authoritative Game Sessions & Server-Side Score Validation
 * - World, Country, and Country-vs-Country Competition queries
 * - Player rank & nearby bracket
 * - Real-Time WebSocket stream (/ws) with SSE fallback
 * - Resilient offline queuing so gameplay is NEVER broken by network disconnects
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
const STORAGE_TOKEN_KEY = 'sky_hooper_auth_token_v2';
const STORAGE_OFFLINE_QUEUE_KEY = 'sky_hooper_offline_scores_v2';

export interface LocalPilotProfile {
  id: string;
  username: string;
  email?: string;
  countryCode: string;
  countryName: string;
  countryFlag: string;
  countrySelected: boolean;
  isLoggedIn?: boolean;
}

export interface NearbyCompetitor {
  rank: number;
  displayName: string;
  score: number;
  countryFlag: string;
  isCurrentPlayer: boolean;
}

export interface PlayerRankData {
  worldRank: number;
  countryRank: number;
  bestScore: number;
  totalScore: number;
  totalGames: number;
  countryCode: string;
  countryName: string;
  countryFlag: string;
  nearbyPlayers: NearbyCompetitor[];
}

class LeaderboardClientService {
  private profile: LocalPilotProfile;
  private token: string | null = null;
  private currentSession: { sessionId: string; token: string; startTime: number } | null = null;
  private socket: WebSocket | null = null;
  private sseSource: EventSource | null = null;
  private liveListeners: Set<(event: LeaderboardLiveEvent) => void> = new Set();
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private reconnectTimer: any = null;

  constructor() {
    this.token = this.loadToken();
    this.profile = this.loadLocalProfile();
    this.setupNetworkListeners();
    this.initCountryDetection();
    this.initRealtimeStream();
    this.flushOfflineQueue();

    // Verify token with backend
    if (this.token) {
      this.fetchCurrentUser().catch(() => {
        // token expired or invalid
      });
    }
  }

  // --- Auth Token & Profile Persistence ---

  private loadToken(): string | null {
    try {
      return localStorage.getItem(STORAGE_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  private saveToken(token: string | null) {
    this.token = token;
    try {
      if (token) {
        localStorage.setItem(STORAGE_TOKEN_KEY, token);
      } else {
        localStorage.removeItem(STORAGE_TOKEN_KEY);
      }
    } catch {
      // storage unavailable
    }
  }

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
      // storage unavailable
    }

    const newId = `pilot_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
    const def: LocalPilotProfile = {
      id: newId,
      username: 'Nova Pilot',
      countryCode: 'IN',
      countryName: 'India',
      countryFlag: '🇮🇳',
      countrySelected: false,
      isLoggedIn: false,
    };
    this.saveLocalProfile(def);
    return def;
  }

  private saveLocalProfile(profile: LocalPilotProfile) {
    this.profile = profile;
    try {
      localStorage.setItem(STORAGE_PROFILE_KEY, JSON.stringify(profile));
    } catch {
      // storage unavailable
    }
  }

  public getProfile(): LocalPilotProfile {
    return { ...this.profile };
  }

  public getToken(): string | null {
    return this.token;
  }

  public isAuthenticated(): boolean {
    return !!this.token && !!this.profile.isLoggedIn;
  }

  // --- Auth API ---

  public async register(params: {
    username: string;
    email: string;
    password: string;
    countryCode: string;
  }): Promise<{ user: any; profile: any }> {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error?.message || 'Registration failed.');
    }

    this.saveToken(data.data.token);
    this.profile = {
      id: data.data.user.id,
      username: data.data.user.username,
      email: data.data.user.email,
      countryCode: data.data.user.countryCode,
      countryName: data.data.user.countryName,
      countryFlag: data.data.profile.countryFlag || '🌐',
      countrySelected: true,
      isLoggedIn: true,
    };
    this.saveLocalProfile(this.profile);
    return data.data;
  }

  public async login(params: {
    loginIdentifier: string;
    password: string;
  }): Promise<{ user: any; profile: any }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error?.message || 'Invalid username or password.');
    }

    this.saveToken(data.data.token);
    this.profile = {
      id: data.data.user.id,
      username: data.data.user.username,
      email: data.data.user.email,
      countryCode: data.data.user.countryCode,
      countryName: data.data.user.countryName,
      countryFlag: data.data.profile.countryFlag || '🌐',
      countrySelected: true,
      isLoggedIn: true,
    };
    this.saveLocalProfile(this.profile);
    return data.data;
  }

  public async logout(): Promise<void> {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // offline logout
    }
    this.saveToken(null);
    this.profile.isLoggedIn = false;
    this.saveLocalProfile(this.profile);
  }

  public async fetchCurrentUser(): Promise<any> {
    if (!this.token) return null;
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          this.profile.username = data.data.displayName || data.data.username;
          this.profile.countryCode = data.data.countryCode;
          this.profile.countryName = data.data.countryName;
          this.profile.countryFlag = data.data.countryFlag;
          this.profile.isLoggedIn = true;
          this.saveLocalProfile(this.profile);
          return data.data;
        }
      } else if (res.status === 401) {
        this.saveToken(null);
        this.profile.isLoggedIn = false;
        this.saveLocalProfile(this.profile);
      }
    } catch {
      // offline
    }
    return null;
  }

  // --- Automatic Country Detection & Registration ---

  public async initCountryDetection(): Promise<LocalPilotProfile> {
    try {
      if (this.profile.countrySelected) {
        await this.syncProfileWithServer();
        return this.profile;
      }

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

  public async updateProfile(
    username: string,
    countryCode: string,
    countryName: string,
    countryFlag: string
  ): Promise<LocalPilotProfile> {
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
      // If logged in, update via authenticated PATCH /api/users/me
      if (this.token) {
        const res = await fetch('/api/users/me', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.token}`,
          },
          body: JSON.stringify({
            displayName: updated.username,
            countryCode: updated.countryCode,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data) {
            this.profile.username = data.data.displayName;
            this.profile.countryCode = data.data.countryCode;
            this.profile.countryName = data.data.countryName;
            this.profile.countryFlag = data.data.countryFlag;
            this.saveLocalProfile(this.profile);
            return this.profile;
          }
        }
      }

      // Fallback to legacy sync
      await fetch('/api/player/register', {
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
    } catch {
      // Offline
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
      // If authenticated, use /api/users/me/stats
      if (this.token) {
        const res = await fetch('/api/users/me/stats', {
          headers: { Authorization: `Bearer ${this.token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) return data.data;
        }
      }

      // Fallback to legacy endpoint
      const res = await fetch(`/api/player/${this.profile.id}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // offline
    }
    return null;
  }

  // --- Session Management & Authoritative Game Scoring ---

  public async startSession(gameMode: string = 'CLASSIC'): Promise<string | null> {
    try {
      // 1. Try authenticated /api/games/start if token exists
      if (this.token) {
        const res = await fetch('/api/games/start', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.token}`,
          },
          body: JSON.stringify({ gameMode }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data?.sessionId) {
            this.currentSession = {
              sessionId: data.data.sessionId,
              token: this.token,
              startTime: data.data.serverTimestamp || Date.now(),
            };
            return data.data.sessionId;
          }
        }
      }

      // 2. Fallback to guest session
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

    const offlineSessId = `offline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.currentSession = {
      sessionId: offlineSessId,
      token: 'offline_token',
      startTime: Date.now(),
    };
    return offlineSessId;
  }

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

    this.currentSession = null;

    try {
      // 1. If authenticated, call /api/games/finish
      if (this.token) {
        const res = await fetch('/api/games/finish', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.token}`,
          },
          body: JSON.stringify({
            sessionId: session.sessionId,
            score: metrics.score,
            duration: metrics.durationSeconds,
            metrics: {
              maxCombo: metrics.maxCombo,
              perfectGates: metrics.perfectGates,
              nearMisses: metrics.nearMisses,
              stars: metrics.stars,
            },
          }),
        });

        if (res.ok) {
          const result = await res.json();
          if (result.success && result.data) {
            return {
              success: true,
              score: result.data.score,
              isNewBest: result.data.isNewBest,
              previousBest: result.data.previousBest,
              worldRank: result.data.worldRank,
              previousWorldRank: null,
              worldRankImprovement: 0,
              countryRank: result.data.countryRank,
              previousCountryRank: null,
              countryRankImprovement: 0,
              totalWorldPlayers: 0,
              totalCountryPlayers: 0,
              message: result.data.message,
            };
          }
        }
      }

      // 2. Legacy / Guest fallback endpoint
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

      const res = await fetch('/api/scores/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Network error submitting score, saving to offline queue', e);
      this.queueOfflineScore({
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
      });
    }

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
      localStorage.setItem(STORAGE_OFFLINE_QUEUE_KEY, JSON.stringify(queue.slice(-20)));
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
          break;
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
    page?: number;
    limit?: number;
    offset?: number;
    search?: string;
  } = {}): Promise<LeaderboardResponse> {
    const pageNum = options.page || (options.offset ? Math.floor(options.offset / (options.limit || 50)) + 1 : 1);
    const params = new URLSearchParams({
      page: String(pageNum),
      limit: String(options.limit || 50),
      search: options.search || '',
    });

    const res = await fetch(`/api/leaderboards/world?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Failed to load world leaderboard (${res.status})`);
    }
    const data = await res.json();
    const total = data.data?.total || 0;
    const entries = data.data?.entries || [];
    return {
      category: 'world',
      timeframe: options.timeframe || 'all',
      total,
      totalEntries: total,
      entries,
      podium: entries.slice(0, 3),
      page: data.data?.page || pageNum,
      limit: options.limit || 50,
      totalPages: data.data?.totalPages || 1,
    };
  }

  public async fetchCountryLeaderboard(
    countryCode: string,
    options: {
      timeframe?: LeaderboardTimeframe;
      page?: number;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<LeaderboardResponse> {
    const pageNum = options.page || (options.offset ? Math.floor(options.offset / (options.limit || 50)) + 1 : 1);
    const params = new URLSearchParams({
      page: String(pageNum),
      limit: String(options.limit || 50),
    });

    const res = await fetch(`/api/leaderboards/country/${countryCode.toUpperCase()}?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Failed to load country leaderboard for ${countryCode} (${res.status})`);
    }
    const data = await res.json();
    const total = data.data?.total || 0;
    const entries = data.data?.entries || [];
    return {
      category: 'country',
      country: data.data?.country,
      timeframe: options.timeframe || 'all',
      total,
      totalEntries: total,
      entries,
      podium: entries.slice(0, 3),
      page: data.data?.page || pageNum,
      limit: options.limit || 50,
      totalPages: data.data?.totalPages || 1,
    };
  }

  public async fetchCountryCompetition(sortBy: CountrySortMetric = 'totalScore'): Promise<CountryLeaderboardResponse> {
    const params = new URLSearchParams({ sortBy });
    const res = await fetch(`/api/leaderboards/countries?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Failed to load country battle rankings (${res.status})`);
    }
    const data = await res.json();
    const rankings = data.data?.rankings || [];
    return {
      metric: sortBy,
      metricDescription: sortBy,
      totalCountries: rankings.length,
      countries: rankings,
      sortedBy: data.data?.metricUsed || sortBy,
      rankings,
    };
  }

  public async fetchPlayerRank(): Promise<PlayerRankData | null> {
    if (!this.token) return null;
    try {
      const res = await fetch('/api/leaderboards/me', {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          return data.data;
        }
      }
    } catch {
      // offline
    }
    return null;
  }

  public async searchLeaderboard(query: string): Promise<(LeaderboardEntry & { countryRank: number; worldRank: number })[]> {
    if (!query.trim()) return [];
    const params = new URLSearchParams({ q: query.trim() });
    const res = await fetch(`/api/leaderboards/search?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || [];
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

  // --- Real-Time WebSocket with Auto-Reconnect & SSE Fallback ---

  private initRealtimeStream() {
    if (typeof window === 'undefined') return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        // Connected to WebSocket
      };

      this.socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.event === 'leaderboard:update' && parsed.data) {
            for (const listener of this.liveListeners) {
              listener(parsed.data);
            }
          }
        } catch {
          // ignore non-json ping
        }
      };

      this.socket.onerror = () => {
        this.fallbackToSSE();
      };

      this.socket.onclose = () => {
        // Retry connection in 10 seconds if online
        if (this.isOnline && !this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.initRealtimeStream();
          }, 10000);
        }
      };
    } catch {
      this.fallbackToSSE();
    }
  }

  private fallbackToSSE() {
    if (typeof EventSource === 'undefined' || this.sseSource) return;

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
          // ignore ping
        }
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
      if (!this.socket || this.socket.readyState === WebSocket.CLOSED) {
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
