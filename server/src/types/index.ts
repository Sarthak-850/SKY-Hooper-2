/**
 * Backend Data Models & API Types
 */

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  countryCode: string;
  countryName: string;
  avatar: string;
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt: Date;
}

export interface UserPublic {
  id: string;
  username: string;
  email: string;
  countryCode: string;
  countryName: string;
  avatar: string;
  createdAt: Date;
  lastActiveAt: Date;
}

export interface PlayerProfile {
  id: string;
  userId: string;
  displayName: string;
  countryCode: string;
  countryName: string;
  avatar: string;
  bestScore: number;
  totalGames: number;
  totalScore: number;
  lastCountryChangeAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlayerProfileWithRanks extends PlayerProfile {
  username: string;
  worldRank: number;
  countryRank: number;
  countryFlag: string;
}

export interface GameSession {
  id: string;
  userId: string;
  startedAt: Date;
  endedAt?: Date | null;
  finalScore?: number | null;
  duration?: number | null;
  status: 'ACTIVE' | 'COMPLETED' | 'ABANDONED';
  validationStatus: 'PENDING' | 'VALID' | 'SUSPICIOUS' | 'REJECTED';
  antiCheatFlags?: string | null;
  createdAt: Date;
}

export interface Score {
  id: string;
  userId: string;
  gameSessionId?: string | null;
  score: number;
  countryCode: string;
  createdAt: Date;
}

export interface Country {
  code: string;
  name: string;
  flag: string;
  playerCount: number;
  totalScore: number;
  averageScore: number;
  bestScore: number;
  updatedAt: Date;
}

export interface AuthTokenPayload {
  userId: string;
  username: string;
  countryCode: string;
}

// --- Leaderboard responses ---

export interface WorldLeaderboardEntry {
  rank: number;
  playerId: string;
  username: string;
  displayName: string;
  countryCode: string;
  countryName: string;
  countryFlag: string;
  avatar: string;
  score: number;
  updatedAt: string;
}

export interface CountryLeaderboardEntry {
  countryRank: number;
  worldRank: number;
  playerId: string;
  username: string;
  displayName: string;
  countryCode: string;
  countryName: string;
  countryFlag: string;
  avatar: string;
  score: number;
}

export interface CountryCompetitionEntry {
  rank: number;
  code: string;
  name: string;
  flag: string;
  playerCount: number;
  totalScore: number;
  averageScore: number;
  bestScore: number;
}

export interface PlayerRankResponse {
  worldRank: number;
  countryRank: number;
  bestScore: number;
  totalScore: number;
  totalGames: number;
  countryCode: string;
  countryName: string;
  countryFlag: string;
  nearbyPlayers: {
    rank: number;
    displayName: string;
    score: number;
    countryFlag: string;
    isCurrentPlayer: boolean;
  }[];
}

export interface PlayerStatsResponse {
  bestScore: number;
  totalGames: number;
  averageScore: number;
  totalScore: number;
  worldRank: number;
  countryRank: number;
  gamesThisWeek: number;
  gamesThisMonth: number;
}

export interface GameHistoryItem {
  id: string;
  score: number;
  duration: number;
  validationStatus: string;
  date: string;
}

// --- API Format ---

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}
