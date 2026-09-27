/**
 * Sky Hopper - Global Leaderboard & Country Competition Types
 */

export interface CountryInfo {
  code: string; // ISO 2-letter code (e.g. 'IN', 'US', 'JP')
  name: string; // e.g. 'India'
  flag: string; // e.g. '🇮🇳'
}

export interface PlayerProfile {
  id: string;
  username: string;
  countryCode: string;
  countryName: string;
  countryFlag: string;
  createdAt: number;
  updatedAt?: number;
}

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  username: string;
  countryCode: string;
  countryName: string;
  countryFlag: string;
  score: number;
  maxCombo: number;
  zone: string;
  gameMode: string;
  createdAt: number;
  isCurrentPlayer?: boolean;
}

export type LeaderboardTimeframe = 'all' | 'today' | 'week' | 'month';

export type CountrySortMetric = 'totalScore' | 'averageScore' | 'bestScore' | 'playerCount';

export interface CountryCompetitionEntry {
  rank: number;
  countryCode: string;
  countryName: string;
  countryFlag: string;
  playerCount: number;
  totalScore: number;
  averageScore: number;
  bestScore: number;
  bestPlayerName?: string;
}

export interface LeaderboardResponse {
  category: 'world' | 'country';
  countryCode?: string;
  timeframe?: LeaderboardTimeframe;
  total: number;
  totalEntries?: number;
  page: number;
  limit: number;
  totalPages?: number;
  country?: CountryInfo;
  entries: LeaderboardEntry[];
  podium: LeaderboardEntry[];
  playerEntry?: LeaderboardEntry | null;
  nearbyEntries?: LeaderboardEntry[];
}

export interface CountryLeaderboardResponse {
  metric: CountrySortMetric;
  metricDescription: string;
  totalCountries: number;
  countries: CountryCompetitionEntry[];
  sortedBy?: string;
  rankings?: CountryCompetitionEntry[];
  playerCountryEntry?: CountryCompetitionEntry | null;
}

export interface ScoreSubmissionPayload {
  playerId: string;
  sessionId: string;
  sessionToken: string;
  score: number;
  maxCombo: number;
  perfectGates: number;
  nearMisses: number;
  stars: number;
  coins: number;
  durationSeconds: number;
  zoneReached: string;
  gameMode: string;
  timestamp: number;
}

export interface ScoreSubmissionResult {
  success: boolean;
  score: number;
  isNewBest: boolean;
  previousBest: number;
  worldRank: number;
  previousWorldRank: number | null;
  worldRankImprovement: number; // positive number if improved
  countryRank: number;
  previousCountryRank: number | null;
  countryRankImprovement: number; // positive number if improved
  totalWorldPlayers: number;
  totalCountryPlayers: number;
  message?: string;
}

export interface LeaderboardLiveEvent {
  id: string;
  type: 'NEW_HIGH_SCORE' | 'RANK_UP' | 'NEW_TOP_100' | 'COUNTRY_RANK_LEAD';
  message: string;
  playerName: string;
  countryFlag: string;
  countryCode: string;
  score: number;
  rank?: number;
  timestamp: number;
}

export interface PlayerStatsResponse {
  player?: PlayerProfile;
  bestScore: number;
  worldRank: number | null;
  countryRank: number | null;
  totalWorldPlayers?: number;
  totalCountryPlayers?: number;
  totalRuns?: number;
  totalGames?: number;
  totalScore?: number;
  averageScore?: number;
  gamesThisWeek?: number;
  gamesThisMonth?: number;
}
