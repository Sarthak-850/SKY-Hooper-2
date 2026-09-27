/**
 * Sky Hopper - Polished Futuristic Leaderboard & Country Competition Screen
 * Implements World rankings, Country rankings, Country vs Country Battle,
 * Top 3 Podium, Player Sticky Row, Nearby Competitors, Search, and Live Real-Time Radar.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Trophy,
  Globe,
  Flag,
  Swords,
  Search,
  RotateCcw,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Users,
  Award,
  Flame,
  Zap,
  X,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import {
  LeaderboardEntry,
  LeaderboardTimeframe,
  CountryCompetitionEntry,
  CountrySortMetric,
  LeaderboardLiveEvent,
} from '../types/leaderboard';
import { leaderboardClient, LocalPilotProfile } from '../services/leaderboardClient';

interface LeaderboardModalProps {
  onClose: () => void;
  onOpenCountrySelect?: () => void;
  initialTab?: 'world' | 'country' | 'countries';
}

type TabType = 'world' | 'country' | 'countries';

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  onClose,
  onOpenCountrySelect,
  initialTab = 'world',
}) => {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [timeframe, setTimeframe] = useState<LeaderboardTimeframe>('all');
  const [countrySort, setCountrySort] = useState<CountrySortMetric>('totalScore');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Data states
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [podium, setPodium] = useState<LeaderboardEntry[]>([]);
  const [playerEntry, setPlayerEntry] = useState<LeaderboardEntry | null>(null);
  const [nearbyEntries, setNearbyEntries] = useState<LeaderboardEntry[]>([]);
  const [countries, setCountries] = useState<CountryCompetitionEntry[]>([]);
  const [metricDescription, setMetricDescription] = useState('');
  const [totalEntries, setTotalEntries] = useState(0);

  // Search state
  const [searchResults, setSearchResults] = useState<
    (LeaderboardEntry & { countryRank: number; worldRank: number })[]
  >([]);
  const [isSearching, setIsSearching] = useState(false);

  // Status & live notification states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveToast, setLiveToast] = useState<LeaderboardLiveEvent | null>(null);

  const profile: LocalPilotProfile = useMemo(() => leaderboardClient.getProfile(), []);

  // Listen to SSE live leaderboard updates
  useEffect(() => {
    const unsubscribe = leaderboardClient.subscribeToLiveUpdates((event) => {
      setLiveToast(event);
      setTimeout(() => {
        setLiveToast((cur) => (cur?.id === event.id ? null : cur));
      }, 4000);
    });
    return () => unsubscribe();
  }, []);

  // Main fetch effect
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const offset = (page - 1) * limit;

    try {
      if (activeTab === 'world') {
        const data = await leaderboardClient.fetchWorldLeaderboard({
          timeframe,
          limit,
          offset,
        });
        setEntries(data.entries);
        setPodium(data.podium);
        setPlayerEntry(data.playerEntry || null);
        setNearbyEntries(data.nearbyEntries || []);
        setTotalEntries(data.total);
      } else if (activeTab === 'country') {
        const countryCode = profile.countryCode || 'IN';
        const data = await leaderboardClient.fetchCountryLeaderboard(countryCode, {
          timeframe,
          limit,
          offset,
        });
        setEntries(data.entries);
        setPodium(data.podium);
        setPlayerEntry(data.playerEntry || null);
        setNearbyEntries(data.nearbyEntries || []);
        setTotalEntries(data.total);
      } else if (activeTab === 'countries') {
        const data = await leaderboardClient.fetchCountryCompetition(countrySort);
        setCountries(data.countries);
        setMetricDescription(data.metricDescription);
        setTotalEntries(data.totalCountries);
      }
    } catch {
      setError('Leaderboard temporarily unavailable. Reconnecting...');
    } finally {
      setLoading(false);
    }
  }, [activeTab, timeframe, countrySort, page, limit, profile.countryCode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Debounced Search Handler
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await leaderboardClient.searchLeaderboard(searchQuery);
        setSearchResults(res);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Check if player is already visible on the current page
  const isPlayerVisibleInCurrentList = useMemo(() => {
    if (!playerEntry) return false;
    return entries.some((e) => e.playerId === profile.id);
  }, [entries, playerEntry, profile.id]);

  const maxPages = Math.ceil(totalEntries / limit) || 1;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-2 sm:p-4 pointer-events-auto animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-slate-900/95 border border-indigo-500/30 rounded-2xl shadow-2xl relative max-h-[92vh] flex flex-col overflow-hidden text-slate-100 font-sans">
        {/* Subtle Neon Glow Accents */}
        <div className="absolute -top-24 -left-24 w-60 h-60 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Live Notification Floating Toast */}
        {liveToast && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 bg-slate-950/90 border border-amber-400/50 rounded-full text-xs font-bold text-amber-300 shadow-lg shadow-amber-500/20 flex items-center gap-2 animate-in fade-in slide-in-from-top-3 duration-200">
            <span className="text-base">{liveToast.countryFlag}</span>
            <span>{liveToast.message}</span>
          </div>
        )}

        {/* ================= MODAL HEADER ================= */}
        <div className="p-4 sm:p-5 pb-3 border-b border-slate-800/80 shrink-0 relative">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-amber-500/20 to-yellow-500/20 border border-amber-500/30 rounded-xl text-amber-400 shadow-sm">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white font-['Outfit']">
                    GLOBAL ARENA
                  </h2>
                  <span className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-extrabold text-[10px] rounded-full uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Compete for global supremacy and national glory
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              aria-label="Close Leaderboard"
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative mt-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search player name or country..."
              className="w-full pl-9 pr-8 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Top Navigation Tabs */}
          {!searchQuery && (
            <div className="grid grid-cols-3 gap-1.5 mt-3">
              <button
                onClick={() => {
                  setActiveTab('world');
                  setPage(1);
                }}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'world'
                    ? 'bg-gradient-to-r from-sky-500/25 to-indigo-500/25 border border-sky-400/60 text-sky-200 shadow-md shadow-sky-500/10'
                    : 'bg-slate-950/60 border border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Globe className="w-4 h-4 text-sky-400" />
                <span>WORLD</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('country');
                  setPage(1);
                }}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'country'
                    ? 'bg-gradient-to-r from-amber-500/25 to-orange-500/25 border border-amber-400/60 text-amber-200 shadow-md shadow-amber-500/10'
                    : 'bg-slate-950/60 border border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <span className="text-base">{profile.countryFlag}</span>
                <span className="uppercase">{profile.countryName || 'INDIA'}</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('countries');
                  setPage(1);
                }}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'countries'
                    ? 'bg-gradient-to-r from-pink-500/25 to-rose-500/25 border border-pink-400/60 text-pink-200 shadow-md shadow-pink-500/10'
                    : 'bg-slate-950/60 border border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Swords className="w-4 h-4 text-pink-400" />
                <span>COUNTRIES</span>
              </button>
            </div>
          )}

          {/* Timeframe or Sort Metric Pills */}
          {!searchQuery && (
            <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-800/60 text-[11px]">
              {activeTab !== 'countries' ? (
                <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-0.5">
                  <span className="text-slate-500 font-semibold uppercase text-[10px] mr-1">
                    TIME:
                  </span>
                  {(['all', 'today', 'week', 'month'] as LeaderboardTimeframe[]).map((tf) => (
                    <button
                      key={tf}
                      onClick={() => {
                        setTimeframe(tf);
                        setPage(1);
                      }}
                      className={`px-2.5 py-0.5 rounded-lg font-semibold transition-colors cursor-pointer capitalize ${
                        timeframe === tf
                          ? 'bg-sky-500 text-slate-950 font-bold'
                          : 'bg-slate-800/60 text-slate-400 hover:text-white'
                      }`}
                    >
                      {tf === 'all'
                        ? 'All Time'
                        : tf === 'today'
                        ? 'Today'
                        : tf === 'week'
                        ? 'This Week'
                        : 'This Month'}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-0.5">
                  <span className="text-slate-500 font-semibold uppercase text-[10px] mr-1">
                    SORT:
                  </span>
                  {[
                    { id: 'totalScore', label: 'Total Score' },
                    { id: 'averageScore', label: 'Average Score' },
                    { id: 'bestScore', label: 'Best Pilot' },
                    { id: 'playerCount', label: 'Players' },
                  ].map((metric) => (
                    <button
                      key={metric.id}
                      onClick={() => setCountrySort(metric.id as CountrySortMetric)}
                      className={`px-2 py-0.5 rounded-lg font-semibold transition-colors cursor-pointer text-[10px] sm:text-[11px] ${
                        countrySort === metric.id
                          ? 'bg-pink-500 text-slate-950 font-bold'
                          : 'bg-slate-800/60 text-slate-400 hover:text-white'
                      }`}
                    >
                      {metric.label}
                    </button>
                  ))}
                </div>
              )}

              {activeTab === 'country' && onOpenCountrySelect && (
                <button
                  onClick={onOpenCountrySelect}
                  className="text-sky-400 hover:text-sky-300 font-bold flex items-center gap-1 shrink-0 ml-2"
                >
                  <Flag className="w-3 h-3" />
                  <span>Change Nation</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* ================= MODAL BODY ================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar">
          {/* SEARCH RESULTS VIEW */}
          {searchQuery ? (
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span>Search results for "{searchQuery}"</span>
                <span>{searchResults.length} pilots found</span>
              </div>
              {isSearching ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  Scanning global pilot records...
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-1.5">
                  {searchResults.map((p) => (
                    <div
                      key={p.playerId}
                      className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between hover:border-sky-500/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{p.countryFlag}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">{p.username}</span>
                            <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded">
                              {p.countryName}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                            <span>
                              World Rank: <strong className="text-sky-400">#{p.worldRank}</strong>
                            </span>
                            <span>
                              {p.countryName} Rank:{' '}
                              <strong className="text-amber-400">#{p.countryRank}</strong>
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase text-slate-500 block">
                          High Score
                        </span>
                        <span className="font-mono text-lg font-black text-sky-400">
                          {p.score.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-slate-500">
                  No pilots or countries found matching "{searchQuery}"
                </div>
              )}
            </div>
          ) : error ? (
            /* ERROR / OFFLINE VIEW */
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <AlertCircle className="w-8 h-8 text-amber-400 mb-2" />
              <h4 className="text-base font-bold text-white mb-1">
                Leaderboard Temporarily Unavailable
              </h4>
              <p className="text-xs text-slate-400 max-w-xs mb-4">
                We're having trouble connecting to the leaderboard radar. You can still play and
                your scores will sync automatically once reconnected.
              </p>
              <button
                onClick={fetchData}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry Connection</span>
              </button>
            </div>
          ) : loading && entries.length === 0 && countries.length === 0 ? (
            /* LOADING SKELETON */
            <div className="py-16 text-center text-xs text-slate-400 animate-pulse flex flex-col items-center">
              <Sparkles className="w-6 h-6 text-sky-400 mb-2 animate-spin" />
              <span>Calibrating Global Radar...</span>
            </div>
          ) : activeTab === 'countries' ? (
            /* ================= COUNTRY BATTLE VIEW ================= */
            <div className="space-y-3">
              {/* Metric Banner */}
              <div className="p-3 bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-indigo-500/10 border border-pink-500/20 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Swords className="w-4 h-4 text-pink-400 shrink-0" />
                  <div>
                    <span className="font-bold text-white block">
                      Active Metric:{' '}
                      <span className="text-pink-300 uppercase">
                        {countrySort.replace('Score', ' Score').replace('playerCount', 'Total Players')}
                      </span>
                    </span>
                    <span className="text-[11px] text-slate-400">{metricDescription}</span>
                  </div>
                </div>
              </div>

              {/* Country Cards */}
              <div className="space-y-2">
                {countries.map((c) => {
                  const isPlayerCountry = c.countryCode === profile.countryCode;
                  const highestTotal = countries[0]?.totalScore || 1;
                  const progressPct = Math.min(100, Math.round((c.totalScore / highestTotal) * 100));

                  return (
                    <div
                      key={c.countryCode}
                      className={`p-3.5 rounded-xl border transition-all ${
                        isPlayerCountry
                          ? 'bg-slate-900/90 border-amber-400/50 shadow-md shadow-amber-500/10'
                          : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          {/* Rank Badge */}
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${
                              c.rank === 1
                                ? 'bg-amber-400 text-slate-950'
                                : c.rank === 2
                                ? 'bg-slate-300 text-slate-950'
                                : c.rank === 3
                                ? 'bg-amber-700 text-white'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            #{c.rank}
                          </div>
                          <span className="text-2xl">{c.countryFlag}</span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-sm font-bold text-white">{c.countryName}</h4>
                              {isPlayerCountry && (
                                <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 font-extrabold text-[9px] rounded uppercase border border-amber-500/30">
                                  YOUR NATION
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400">
                              Top Pilot: <strong className="text-sky-300">{c.bestPlayerName}</strong> ({c.bestScore.toLocaleString()})
                            </span>
                          </div>
                        </div>

                        {/* Primary Stat depending on sort */}
                        <div className="text-right">
                          <span className="text-[10px] uppercase text-slate-500 block">
                            {countrySort === 'totalScore'
                              ? 'Total Score'
                              : countrySort === 'averageScore'
                              ? 'Avg Score'
                              : countrySort === 'bestScore'
                              ? 'Best Record'
                              : 'Pilots'}
                          </span>
                          <span className="font-mono text-base font-black text-pink-400">
                            {countrySort === 'totalScore'
                              ? c.totalScore.toLocaleString()
                              : countrySort === 'averageScore'
                              ? c.averageScore.toLocaleString()
                              : countrySort === 'bestScore'
                              ? c.bestScore.toLocaleString()
                              : c.playerCount.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Relative Progress Bar */}
                      <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden mb-2">
                        <div
                          className="h-full bg-gradient-to-r from-sky-400 to-pink-500 rounded-full transition-all duration-300"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>

                      {/* Secondary Stats Strip */}
                      <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] text-slate-400 border-t border-slate-800/40">
                        <div>
                          <span>Pilots: </span>
                          <strong className="text-white font-mono">{c.playerCount}</strong>
                        </div>
                        <div>
                          <span>Average: </span>
                          <strong className="text-white font-mono">
                            {c.averageScore.toLocaleString()}
                          </strong>
                        </div>
                        <div className="text-right">
                          <span>Total: </span>
                          <strong className="text-white font-mono">
                            {c.totalScore.toLocaleString()}
                          </strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ================= WORLD OR COUNTRY LEADERBOARD VIEW ================= */
            <div className="space-y-4">
              {/* TOP 3 PODIUM */}
              {page === 1 && podium.length >= 3 && (
                <div className="pt-2 pb-1">
                  <div className="grid grid-cols-3 gap-2 items-end max-w-md mx-auto">
                    {/* #2 Silver (Left) */}
                    {podium[1] && (
                      <div className="flex flex-col items-center text-center p-2.5 bg-slate-950/70 border border-slate-400/30 rounded-xl relative order-1 transform hover:-translate-y-1 transition-transform">
                        <div className="w-6 h-6 rounded-full bg-slate-300 text-slate-950 font-black text-xs flex items-center justify-center mb-1 shadow-sm">
                          2
                        </div>
                        <span className="text-xl mb-0.5">{podium[1].countryFlag}</span>
                        <span className="text-xs font-bold text-white truncate max-w-[90px]">
                          {podium[1].username}
                        </span>
                        <span className="font-mono text-sm font-black text-slate-200 mt-0.5">
                          {podium[1].score.toLocaleString()}
                        </span>
                        <div className="w-full h-12 mt-2 bg-gradient-to-t from-slate-400/20 to-transparent rounded-b-lg border-b-2 border-slate-300" />
                      </div>
                    )}

                    {/* #1 Gold (Center, elevated) */}
                    {podium[0] && (
                      <div className="flex flex-col items-center text-center p-3 bg-slate-950/80 border border-amber-400/60 rounded-xl relative order-2 shadow-lg shadow-amber-500/10 transform -translate-y-2 hover:-translate-y-3 transition-transform">
                        <div className="w-7 h-7 rounded-full bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-center mb-1 shadow-md shadow-amber-500/30">
                          👑
                        </div>
                        <span className="text-2xl mb-0.5">{podium[0].countryFlag}</span>
                        <span className="text-xs font-bold text-amber-200 truncate max-w-[100px]">
                          {podium[0].username}
                        </span>
                        <span className="font-mono text-base font-black text-amber-400 mt-0.5">
                          {podium[0].score.toLocaleString()}
                        </span>
                        <div className="w-full h-16 mt-2 bg-gradient-to-t from-amber-500/25 to-transparent rounded-b-lg border-b-2 border-amber-400" />
                      </div>
                    )}

                    {/* #3 Bronze (Right) */}
                    {podium[2] && (
                      <div className="flex flex-col items-center text-center p-2.5 bg-slate-950/70 border border-amber-700/40 rounded-xl relative order-3 transform hover:-translate-y-1 transition-transform">
                        <div className="w-6 h-6 rounded-full bg-amber-700 text-white font-black text-xs flex items-center justify-center mb-1 shadow-sm">
                          3
                        </div>
                        <span className="text-xl mb-0.5">{podium[2].countryFlag}</span>
                        <span className="text-xs font-bold text-white truncate max-w-[90px]">
                          {podium[2].username}
                        </span>
                        <span className="font-mono text-sm font-black text-amber-600 mt-0.5">
                          {podium[2].score.toLocaleString()}
                        </span>
                        <div className="w-full h-8 mt-2 bg-gradient-to-t from-amber-700/20 to-transparent rounded-b-lg border-b-2 border-amber-700" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* NEARBY COMPETITORS MINI CARD */}
              {playerEntry && nearbyEntries.length > 1 && (
                <div className="p-3 bg-slate-950/60 border border-sky-500/20 rounded-xl">
                  <div className="flex items-center justify-between text-[11px] text-sky-400 font-bold mb-2">
                    <span className="flex items-center gap-1.5 uppercase">
                      <TrendingUp className="w-3.5 h-3.5" />
                      Direct Competitors Radar
                    </span>
                    <span>Your Rank: #{playerEntry.rank}</span>
                  </div>
                  <div className="space-y-1">
                    {nearbyEntries.map((n) => {
                      const isMe = n.playerId === profile.id;
                      return (
                        <div
                          key={n.playerId}
                          className={`px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs ${
                            isMe
                              ? 'bg-sky-500/20 border border-sky-400/40 text-white font-bold'
                              : 'bg-slate-900/40 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-slate-400 text-[11px]">#{n.rank}</span>
                            <span className="text-sm">{n.countryFlag}</span>
                            <span className="truncate max-w-[120px]">{n.username}</span>
                            {isMe && (
                              <span className="px-1 py-0.2 bg-sky-500 text-slate-950 font-black text-[9px] rounded">
                                YOU
                              </span>
                            )}
                          </div>
                          <span className="font-mono font-bold text-sky-300">
                            {n.score.toLocaleString()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* MAIN RANKINGS LIST */}
              <div className="space-y-1.5">
                {entries.map((entry) => {
                  const isCurrent = entry.playerId === profile.id;
                  return (
                    <div
                      key={entry.playerId}
                      className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                        isCurrent
                          ? 'bg-sky-500/15 border-sky-400/50 shadow-md shadow-sky-500/10'
                          : 'bg-slate-950/50 border-slate-850 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Rank Badge */}
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${
                            entry.rank === 1
                              ? 'bg-amber-400 text-slate-950'
                              : entry.rank === 2
                              ? 'bg-slate-300 text-slate-950'
                              : entry.rank === 3
                              ? 'bg-amber-700 text-white'
                              : 'bg-slate-800/80 text-slate-300'
                          }`}
                        >
                          {entry.rank}
                        </div>

                        {/* Country Flag & Pilot Info */}
                        <span className="text-2xl">{entry.countryFlag}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-sm font-bold ${
                                isCurrent ? 'text-sky-300' : 'text-white'
                              }`}
                            >
                              {entry.username}
                            </span>
                            {isCurrent && (
                              <span className="px-1.5 py-0.2 bg-sky-500 text-slate-950 font-black text-[9px] rounded">
                                YOU
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            <span>{entry.countryName}</span>
                            {entry.maxCombo > 1 && (
                              <>
                                <span>•</span>
                                <span className="text-amber-400 font-mono">
                                  Combo x{entry.maxCombo}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Flight Score */}
                      <div className="text-right">
                        <span className="font-mono text-base sm:text-lg font-black text-sky-400">
                          {entry.score.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {entries.length === 0 && (
                  <div className="py-12 text-center text-xs text-slate-500">
                    No flight records found for this timeframe.
                  </div>
                )}
              </div>

              {/* PAGINATION CONTROLS */}
              {maxPages > 1 && (
                <div className="flex items-center justify-between pt-2 text-xs text-slate-400">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Prev</span>
                  </button>
                  <span>
                    Page <strong className="text-white">{page}</strong> of{' '}
                    <strong className="text-white">{maxPages}</strong>
                  </span>
                  <button
                    disabled={page >= maxPages}
                    onClick={() => setPage((p) => Math.min(maxPages, p + 1))}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ================= STICKY YOU ROW (FOOTER) ================= */}
        {!searchQuery && activeTab !== 'countries' && playerEntry && !isPlayerVisibleInCurrentList && (
          <div className="p-3 bg-gradient-to-r from-sky-950 via-slate-900 to-indigo-950 border-t border-sky-400/40 shadow-xl shrink-0 flex items-center justify-between animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center gap-3">
              <span className="px-2 py-1 bg-sky-500 text-slate-950 font-black text-[10px] rounded-lg tracking-wider">
                YOU
              </span>
              <span className="font-mono font-bold text-sm text-sky-300">
                #{playerEntry.rank.toLocaleString()}
              </span>
              <span className="text-xl">{playerEntry.countryFlag}</span>
              <span className="text-sm font-bold text-white truncate max-w-[120px]">
                {playerEntry.username}
              </span>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase block">Best Score</span>
              <span className="font-mono text-base font-black text-sky-400">
                {playerEntry.score.toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
