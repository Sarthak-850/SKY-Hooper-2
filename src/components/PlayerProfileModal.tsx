/**
 * Sky Hopper - Player Profile Modal
 * Shows Pilot Identity, Country Flag, Lifetime Best Score, World Rank, Country Rank,
 * and allows editing Pilot Name and changing Country.
 */

import React, { useState, useEffect } from 'react';
import {
  User,
  Flag,
  Trophy,
  Globe,
  Edit2,
  Check,
  X,
  Sparkles,
  ExternalLink,
  Flame,
} from 'lucide-react';
import { leaderboardClient, LocalPilotProfile } from '../services/leaderboardClient';
import { PlayerStatsResponse } from '../types/leaderboard';

interface PlayerProfileModalProps {
  onClose: () => void;
  onOpenLeaderboard: () => void;
  onOpenCountrySelect: () => void;
}

export const PlayerProfileModal: React.FC<PlayerProfileModalProps> = ({
  onClose,
  onOpenLeaderboard,
  onOpenCountrySelect,
}) => {
  const [profile, setProfile] = useState<LocalPilotProfile>(leaderboardClient.getProfile());
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(profile.username);
  const [stats, setStats] = useState<PlayerStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    leaderboardClient.getPlayerStats().then((res) => {
      setStats(res);
      setLoading(false);
    });
  }, []);

  const handleSaveName = async () => {
    if (!nameInput.trim()) return;
    const updated = await leaderboardClient.updateProfile(
      nameInput.trim(),
      profile.countryCode,
      profile.countryName,
      profile.countryFlag
    );
    setProfile(updated);
    setIsEditingName(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 pointer-events-auto animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-slate-900/95 border border-indigo-500/30 rounded-2xl p-5 shadow-2xl relative flex flex-col text-slate-100">
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close Profile"
          className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Badge */}
        <div className="flex items-center gap-1.5 mb-1 text-xs font-bold text-sky-400 uppercase tracking-wider">
          <User className="w-4 h-4" />
          <span>PILOT DOSSIER</span>
        </div>

        <h3 className="text-2xl font-black text-white font-['Outfit'] mb-3">
          Player Profile
        </h3>

        {/* Profile Card */}
        <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl mb-4 space-y-3">
          {/* Pilot Name */}
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">
              Callsign / Pilot Name
            </span>
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={nameInput}
                  maxLength={24}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-sky-400 rounded-lg text-sm text-white font-bold focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  className="p-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-lg cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setNameInput(profile.username);
                    setIsEditingName(false);
                  }}
                  className="p-1.5 bg-slate-800 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-lg font-black text-white tracking-wide">
                  {profile.username}
                </span>
                <button
                  onClick={() => setIsEditingName(true)}
                  className="p-1 text-slate-400 hover:text-sky-400 transition-colors cursor-pointer"
                  title="Edit Name"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Pilot Country */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">
                Representing Nation
              </span>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{profile.countryFlag}</span>
                <span className="text-sm font-bold text-slate-200">
                  {profile.countryName || 'India'}
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                onClose();
                onOpenCountrySelect();
              }}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-sky-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
            >
              <Flag className="w-3 h-3" />
              <span>Change</span>
            </button>
          </div>
        </div>

        {/* Dynamic Leaderboard Statistics */}
        <div className="space-y-2 mb-4">
          <span className="text-[10px] text-slate-400 uppercase font-semibold block">
            Competitive Standing
          </span>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* World Rank */}
            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                <Globe className="w-3 h-3 text-sky-400" />
                World Rank
              </span>
              <span className="font-mono text-xl font-black text-sky-400 mt-1">
                {loading
                  ? '...'
                  : stats?.worldRank
                  ? `#${stats.worldRank.toLocaleString()}`
                  : 'Unranked'}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5">
                of {stats?.totalWorldPlayers || 0} pilots
              </span>
            </div>

            {/* Country Rank */}
            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                <span className="text-xs">{profile.countryFlag}</span>
                {profile.countryName || 'India'} Rank
              </span>
              <span className="font-mono text-xl font-black text-amber-400 mt-1">
                {loading
                  ? '...'
                  : stats?.countryRank
                  ? `#${stats.countryRank.toLocaleString()}`
                  : 'Unranked'}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5">
                of {stats?.totalCountryPlayers || 0} pilots
              </span>
            </div>

            {/* Best Score */}
            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex flex-col col-span-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                  <Trophy className="w-3 h-3 text-amber-400" />
                  Personal Best Flight
                </span>
                <span className="font-mono text-lg font-black text-amber-300">
                  {stats?.bestScore?.toLocaleString() || '0'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* View on Leaderboard Button */}
        <button
          onClick={() => {
            onClose();
            onOpenLeaderboard();
          }}
          className="w-full py-3 bg-gradient-to-r from-sky-500 via-indigo-600 to-pink-500 hover:from-sky-400 hover:to-pink-400 text-white font-extrabold rounded-xl transition-all shadow-md shadow-sky-500/20 cursor-pointer flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
        >
          <Trophy className="w-4 h-4" />
          <span>View Global Standings</span>
        </button>
      </div>
    </div>
  );
};
