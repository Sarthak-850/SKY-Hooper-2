/**
 * Sky Hopper - Comprehensive User Interface Overlays
 * Includes:
 * - HUD (Score, Best, Stars, Coins, Combo Multiplier, Power-Up Timers, Zone Banner)
 * - Arcade Main Menu (Play, Modes, Nova Collection, Missions, Daily Challenge, Achievements, Stats, Settings)
 * - Modals for all secondary menus with 100% real functionality & persistent state
 * - Game Over Screen with run breakdown, exciting high score badge, and Share button
 * - Pause Dialog & in-game Toast Notifications
 */

import React, { useState, useEffect } from 'react';
import {
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Pause,
  HelpCircle,
  Trophy,
  Sparkles,
  X,
  Home,
  Hourglass,
  Shield,
  Zap,
  Flame,
  Coins,
  Star,
  Palette,
  Check,
  Share2,
  Sliders,
  BarChart2,
  Target,
  Award,
  Calendar,
  Lock,
  CheckCircle2,
  Heart,
  Clock,
  Compass,
  Gift,
} from 'lucide-react';
import { GameState, GameStats, GameMode, NovaSkinId, Mission, Achievement } from '../game/types';
import { GameEngine } from '../game/engine';
import { audioManager } from '../game/audio';
import { saveDataManager } from '../game/saveData';
import { NOVA_SKINS } from '../game/constants';

interface UIOverlayProps {
  engine: GameEngine | null;
  gameState: GameState;
  stats: GameStats;
}

type ModalType =
  | 'MODES'
  | 'COLLECTION'
  | 'MISSIONS'
  | 'DAILY'
  | 'ACHIEVEMENTS'
  | 'STATS'
  | 'SETTINGS'
  | 'HOW_TO_PLAY'
  | null;

export const UIOverlay: React.FC<UIOverlayProps> = ({
  engine,
  gameState,
  stats,
}) => {
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [isMuted, setIsMuted] = useState(audioManager.getMuted());
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [dailyRewardClaimed, setDailyRewardClaimed] = useState(!saveDataManager.checkDailyRewardAvailable());

  // Toast notification state
  const [toast, setToast] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    // Check daily reward state on mount
    setDailyRewardClaimed(!saveDataManager.checkDailyRewardAvailable());
  }, [gameState]);

  const showNotification = (title: string, message: string) => {
    setToast({ title, message });
    setTimeout(() => {
      setToast(null);
    }, 3200);
  };

  const handleToggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const muted = audioManager.toggleMute();
    setIsMuted(muted);
  };

  const handleStartPlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    audioManager.playClick();
    setActiveModal(null);
    engine?.start();
  };

  const handleResume = (e: React.MouseEvent) => {
    e.stopPropagation();
    audioManager.playClick();
    engine?.togglePause();
  };

  const handleRestart = (e: React.MouseEvent) => {
    e.stopPropagation();
    audioManager.playClick();
    setActiveModal(null);
    engine?.start();
  };

  const handleGoToMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    audioManager.playClick();
    setActiveModal(null);
    engine?.goToMenu();
  };

  const openModal = (modal: ModalType, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    audioManager.playClick();
    setActiveModal(modal);
  };

  const closeModal = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    audioManager.playClick();
    setActiveModal(null);
  };

  const handleClaimDailyReward = (e: React.MouseEvent) => {
    e.stopPropagation();
    audioManager.playAchievement();
    const reward = saveDataManager.claimDailyReward();
    if (reward > 0) {
      setDailyRewardClaimed(true);
      showNotification('DAILY REWARD CLAIMED!', `+${reward} Coins added to your treasury!`);
    }
  };

  const handleShareScore = (e: React.MouseEvent) => {
    e.stopPropagation();
    audioManager.playClick();
    const shareText = `I scored ${stats.score} in Sky Hopper! Can you beat my high score? 🚀✨`;

    if (navigator.share) {
      navigator.share({
        title: 'Sky Hopper High Score',
        text: shareText,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(shareText).then(() => {
        setShareFeedback('Copied to clipboard!');
        setTimeout(() => setShareFeedback(null), 2400);
      });
    }
  };

  const handleEquipSkin = (skinId: NovaSkinId, e: React.MouseEvent) => {
    e.stopPropagation();
    audioManager.playClick();
    saveDataManager.equipSkin(skinId);
    engine?.setEquippedSkin(skinId);
    showNotification('SKIN EQUIPPED', `${NOVA_SKINS.find((s) => s.id === skinId)?.name} ready!`);
  };

  const handleBuySkin = (skin: (typeof NOVA_SKINS)[0], e: React.MouseEvent) => {
    e.stopPropagation();
    if (saveDataManager.spendCoins(skin.cost)) {
      audioManager.playAchievement();
      saveDataManager.unlockSkin(skin.id);
      saveDataManager.equipSkin(skin.id);
      engine?.setEquippedSkin(skin.id);
      showNotification('SKIN UNLOCKED!', `${skin.name} purchased & equipped!`);
    } else {
      audioManager.playClick();
      showNotification('NEED MORE COINS', `You need ${skin.cost - saveDataManager.getData().totalCoins} more coins!`);
    }
  };

  const handleClaimMission = (missionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    audioManager.playAchievement();
    const coins = saveDataManager.claimMissionReward(missionId);
    if (coins > 0) {
      showNotification('MISSION REWARD!', `+${coins} Coins collected!`);
    }
  };

  const handleSelectGameMode = (mode: GameMode, e: React.MouseEvent) => {
    e.stopPropagation();
    audioManager.playClick();
    engine?.setGameMode(mode);
    closeModal();
    engine?.start();
  };

  const handleStartDailyChallenge = (e: React.MouseEvent) => {
    e.stopPropagation();
    audioManager.playClick();
    closeModal();
    engine?.startDailyChallenge();
  };

  const persistentData = saveDataManager.getData();

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3.5 sm:p-4 z-10 select-none">
      {/* ================= TOAST NOTIFICATION ================= */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-auto bg-slate-900/95 border border-sky-400/50 shadow-2xl shadow-sky-500/20 px-4 py-2.5 rounded-xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-4 duration-200">
          <Award className="w-4 h-4 text-sky-400 shrink-0 animate-bounce" />
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">{toast.title}</span>
            <span className="text-xs text-white font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      {/* ================= HUD (Playing or Paused) ================= */}
      {(gameState === 'PLAYING' || gameState === 'PAUSED') && (
        <div className="w-full max-w-lg mx-auto flex flex-col gap-2 pointer-events-auto">
          {/* Top Bar */}
          <div className="flex items-center justify-between px-3 py-2 bg-slate-900/85 backdrop-blur-md border border-slate-800 rounded-xl shadow-lg">
            {/* Score & Best */}
            <div className="flex items-center gap-3">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Score</span>
                <span className="font-mono tabular-nums text-2xl font-black text-sky-400">
                  {stats.score}
                </span>
              </div>

              <span className="text-slate-700">|</span>

              <div className="flex items-center gap-1 text-xs text-amber-300 font-medium">
                <Trophy className="w-3.5 h-3.5" />
                <span className="font-mono tabular-nums">{stats.highScore}</span>
              </div>
            </div>

            {/* Stars, Coins & Combo */}
            <div className="flex items-center gap-2 sm:gap-2.5">
              {/* Combo Multiplier */}
              {stats.combo > 1 && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 rounded-lg animate-pulse">
                  <Flame className="w-3.5 h-3.5 text-orange-400" />
                  <span className="font-mono tabular-nums text-xs font-black text-amber-300">
                    x{stats.combo}
                  </span>
                </div>
              )}

              {/* Coins In Run */}
              <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs font-semibold text-amber-300">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-mono tabular-nums">{stats.coinsInRun}</span>
              </div>

              {/* Stars towards Slow-Mo */}
              <div className="flex items-center gap-1 px-2 py-0.5 bg-sky-500/10 border border-sky-500/20 rounded-lg text-xs font-semibold text-sky-200">
                <Star className="w-3.5 h-3.5 text-sky-400" />
                <span className="font-mono tabular-nums">
                  {stats.starsTowardsSlowMo}/5
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-0.5">
                <button
                  onClick={handleToggleMute}
                  aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-sky-400" />}
                </button>

                <button
                  onClick={handleResume}
                  aria-label={gameState === 'PAUSED' ? 'Resume game' : 'Pause game'}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  {gameState === 'PAUSED' ? <Play className="w-4 h-4 text-emerald-400" /> : <Pause className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Time Attack Remaining Timer */}
          {stats.gameMode === 'TIME_ATTACK' && stats.timeRemaining !== undefined && (
            <div className="flex items-center justify-between px-3 py-1 bg-rose-950/80 border border-rose-500/30 rounded-lg text-xs font-bold text-rose-300">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-rose-400 animate-spin" />
                <span>TIME ATTACK</span>
              </span>
              <span className="font-mono text-sm">{stats.timeRemaining.toFixed(1)}s</span>
            </div>
          )}

          {/* Power-Up Timers Bar */}
          <div className="flex flex-wrap gap-1.5">
            {(stats.slowMoActive || stats.slowMoRecovering || stats.slowMoBlend > 0.05) && (
              <div className="flex-1 min-w-[130px] bg-sky-950/85 backdrop-blur-md border border-sky-400/40 rounded-lg p-1.5 flex flex-col gap-1 transition-opacity">
                <div className="flex items-center justify-between text-[11px] text-sky-300 font-bold px-1">
                  <span className="flex items-center gap-1">
                    <Hourglass className="w-3 h-3 text-sky-400 animate-spin" />
                    <span>
                      {stats.slowMoEntering
                        ? 'SLOWING DOWN'
                        : stats.slowMoRecovering
                        ? 'SMOOTH RECOVERY'
                        : 'SLOW MOTION'}
                    </span>
                  </span>
                  <span className="font-mono text-[10px]">
                    {stats.slowMoActive && !stats.slowMoEntering
                      ? `${stats.slowMoTimeRemaining.toFixed(1)}s`
                      : `${Math.round((1.0 - stats.slowMoBlend * (1.0 - 0.55)) * 100)}%`}
                  </span>
                </div>
                <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-75 ease-linear ${
                      stats.slowMoEntering
                        ? 'bg-gradient-to-r from-sky-400 to-indigo-400'
                        : stats.slowMoRecovering
                        ? 'bg-gradient-to-r from-emerald-400 to-sky-400'
                        : 'bg-sky-400'
                    }`}
                    style={{
                      width: stats.slowMoActive && !stats.slowMoEntering
                        ? `${(stats.slowMoTimeRemaining / stats.slowMoMaxDuration) * 100}%`
                        : `${stats.slowMoBlend * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {stats.shieldActive && (
              <div className="flex-1 min-w-[100px] bg-indigo-950/85 border border-indigo-400/40 rounded-lg px-2 py-1 flex items-center justify-between text-xs text-indigo-300 font-bold">
                <span className="flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-indigo-400" />
                  <span>SHIELD</span>
                </span>
                <span className="font-mono">{stats.shieldTimeRemaining.toFixed(1)}s</span>
              </div>
            )}

            {stats.magnetActive && (
              <div className="flex-1 min-w-[100px] bg-pink-950/85 border border-pink-400/40 rounded-lg px-2 py-1 flex items-center justify-between text-xs text-pink-300 font-bold">
                <span className="flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-pink-400" />
                  <span>MAGNET</span>
                </span>
                <span className="font-mono">{stats.magnetTimeRemaining.toFixed(1)}s</span>
              </div>
            )}

            {stats.multiplierActive && (
              <div className="flex-1 min-w-[100px] bg-amber-950/85 border border-amber-400/40 rounded-lg px-2 py-1 flex items-center justify-between text-xs text-amber-300 font-bold">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>2X STARS</span>
                </span>
                <span className="font-mono">{stats.multiplierTimeRemaining.toFixed(1)}s</span>
              </div>
            )}

            {stats.ghostActive && (
              <div className="flex-1 min-w-[100px] bg-purple-950/85 border border-purple-400/40 rounded-lg px-2 py-1 flex items-center justify-between text-xs text-purple-300 font-bold">
                <span className="flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5 text-purple-400" />
                  <span>GHOST MODE</span>
                </span>
                <span className="font-mono">{stats.ghostTimeRemaining.toFixed(1)}s</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Spacer to push overlays to center */}
      <div className="my-auto" />

      {/* ================= 1. START MENU SCREEN ================= */}
      {gameState === 'MENU' && !activeModal && (
        <div className="w-full max-w-sm mx-auto my-auto pointer-events-auto bg-slate-900/90 backdrop-blur-xl border border-indigo-500/25 rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
          {/* Header Title */}
          <div className="flex items-center gap-1.5 mb-1 text-[11px] font-bold uppercase tracking-widest text-indigo-400">
            <Sparkles className="w-3.5 h-3.5" />
            <span>NEON ARCADE</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-black tracking-tight bg-gradient-to-r from-sky-400 via-indigo-300 to-pink-400 bg-clip-text text-transparent drop-shadow-sm font-['Outfit']">
            SKY HOPPER
          </h1>

          <p className="mt-1 text-xs text-slate-300 max-w-xs leading-relaxed">
            Fly <span className="text-pink-300 font-bold">Nova</span> through Energy Gates. Build combos, dodge hazards, and beat your best!
          </p>

          {/* Daily Reward Claim Banner */}
          {!dailyRewardClaimed && (
            <button
              onClick={handleClaimDailyReward}
              className="w-full mt-3 px-3 py-2 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-400/40 rounded-xl flex items-center justify-between text-xs text-amber-200 hover:border-amber-300 transition-all cursor-pointer animate-pulse"
            >
              <div className="flex items-center gap-2 font-bold">
                <Gift className="w-4 h-4 text-amber-400" />
                <span>Daily Reward Available!</span>
              </div>
              <span className="px-2 py-0.5 bg-amber-500 text-slate-950 font-extrabold rounded-md text-[11px]">
                +100 🪙
              </span>
            </button>
          )}

          {/* Score & Coins Summary */}
          <div className="w-full grid grid-cols-3 gap-2 my-3 p-2.5 bg-slate-950/70 rounded-xl border border-slate-800">
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Best</span>
              <span className="font-mono tabular-nums text-lg font-bold text-sky-400">
                {stats.highScore}
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Coins</span>
              <span className="font-mono tabular-nums text-lg font-bold text-amber-400">
                {persistentData.totalCoins}
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Stars</span>
              <span className="font-mono tabular-nums text-lg font-bold text-sky-300">
                {persistentData.totalStars}
              </span>
            </div>
          </div>

          {/* Primary Action Button: START FLIGHT */}
          <button
            onClick={handleStartPlay}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-sky-500 via-indigo-600 to-pink-500 hover:from-sky-400 hover:to-pink-400 text-white font-extrabold text-base rounded-xl shadow-lg shadow-sky-500/25 transition-all transform active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 mb-2"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>PLAY</span>
          </button>

          {/* Secondary Navigation Grid */}
          <div className="w-full grid grid-cols-3 gap-1.5 mb-2">
            <button
              onClick={(e) => openModal('MODES', e)}
              className="py-2 px-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors flex flex-col items-center gap-1 cursor-pointer"
            >
              <Compass className="w-4 h-4 text-sky-400" />
              <span>Modes</span>
            </button>
            <button
              onClick={(e) => openModal('COLLECTION', e)}
              className="py-2 px-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors flex flex-col items-center gap-1 cursor-pointer"
            >
              <Palette className="w-4 h-4 text-pink-400" />
              <span>Nova Skins</span>
            </button>
            <button
              onClick={(e) => openModal('MISSIONS', e)}
              className="py-2 px-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors flex flex-col items-center gap-1 cursor-pointer"
            >
              <Target className="w-4 h-4 text-amber-400" />
              <span>Missions</span>
            </button>
          </div>

          <div className="w-full grid grid-cols-4 gap-1.5">
            <button
              onClick={(e) => openModal('DAILY', e)}
              className="py-1.5 bg-slate-800/60 hover:bg-slate-700 text-slate-300 text-[11px] font-medium rounded-lg transition-colors flex flex-col items-center gap-0.5 cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <span>Daily</span>
            </button>
            <button
              onClick={(e) => openModal('ACHIEVEMENTS', e)}
              className="py-1.5 bg-slate-800/60 hover:bg-slate-700 text-slate-300 text-[11px] font-medium rounded-lg transition-colors flex flex-col items-center gap-0.5 cursor-pointer"
            >
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>Badges</span>
            </button>
            <button
              onClick={(e) => openModal('STATS', e)}
              className="py-1.5 bg-slate-800/60 hover:bg-slate-700 text-slate-300 text-[11px] font-medium rounded-lg transition-colors flex flex-col items-center gap-0.5 cursor-pointer"
            >
              <BarChart2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Stats</span>
            </button>
            <button
              onClick={(e) => openModal('SETTINGS', e)}
              className="py-1.5 bg-slate-800/60 hover:bg-slate-700 text-slate-300 text-[11px] font-medium rounded-lg transition-colors flex flex-col items-center gap-0.5 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-slate-400" />
              <span>Config</span>
            </button>
          </div>

          {/* Footer Controls & Instructions */}
          <div className="mt-3.5 pt-2.5 border-t border-slate-800/80 w-full flex items-center justify-between text-[11px] text-slate-400">
            <button
              onClick={(e) => openModal('HOW_TO_PLAY', e)}
              className="hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>How To Play</span>
            </button>

            <button
              onClick={handleToggleMute}
              className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-sky-400" />}
              <span>{isMuted ? 'Muted' : 'Sound On'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ================= 2. PAUSE SCREEN ================= */}
      {gameState === 'PAUSED' && (
        <div className="w-full max-w-xs mx-auto my-auto pointer-events-auto bg-slate-900/90 backdrop-blur-xl border border-slate-700 rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-150">
          <h2 className="text-2xl font-bold text-white mb-1 font-['Outfit']">FLIGHT PAUSED</h2>
          <p className="text-xs text-slate-400 mb-5">Catch your breath</p>

          <div className="w-full flex flex-col gap-2.5">
            <button
              onClick={handleResume}
              className="w-full py-3 px-4 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Resume Flight</span>
            </button>

            <button
              onClick={handleRestart}
              className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4 text-slate-400" />
              <span>Restart</span>
            </button>

            <button
              onClick={handleGoToMenu}
              className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4 text-slate-400" />
              <span>Main Menu</span>
            </button>

            <button
              onClick={(e) => openModal('SETTINGS', e)}
              className="w-full py-2 px-4 bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-medium rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Settings</span>
            </button>
          </div>
        </div>
      )}

      {/* ================= 3. GAME OVER SCREEN ================= */}
      {gameState === 'GAMEOVER' && (
        <div className="w-full max-w-sm mx-auto my-auto pointer-events-auto bg-slate-900/95 backdrop-blur-xl border border-rose-500/25 rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
          {stats.isNewHighScore ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 border border-amber-500/40 rounded-full text-xs font-black text-amber-300 uppercase tracking-wider mb-2 animate-bounce">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>NEW HIGH SCORE!</span>
            </div>
          ) : (
            <span className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-1">
              Flight Terminated
            </span>
          )}

          <h2 className="text-3xl font-black text-white mb-3 font-['Outfit']">
            {stats.isNewHighScore ? 'SPECTACULAR RUN' : 'TRY AGAIN'}
          </h2>

          {/* Run Statistics Grid */}
          <div className="w-full p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl flex flex-col gap-2 mb-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Final Score</span>
              <span className="font-mono tabular-nums text-2xl font-black text-sky-400">
                {stats.score}
              </span>
            </div>

            <div className="h-px bg-slate-800/80" />

            <div className="grid grid-cols-2 gap-2 text-slate-300">
              <div className="flex items-center justify-between px-2 py-1 bg-slate-900/60 rounded">
                <span className="text-slate-400">Best Score</span>
                <span className="font-mono font-bold">{stats.highScore}</span>
              </div>
              <div className="flex items-center justify-between px-2 py-1 bg-slate-900/60 rounded">
                <span className="text-slate-400">Max Combo</span>
                <span className="font-mono font-bold text-amber-400">x{stats.maxCombo}</span>
              </div>
              <div className="flex items-center justify-between px-2 py-1 bg-slate-900/60 rounded">
                <span className="text-slate-400">Stars</span>
                <span className="font-mono font-bold text-sky-300">+{stats.starsInRun}</span>
              </div>
              <div className="flex items-center justify-between px-2 py-1 bg-slate-900/60 rounded">
                <span className="text-slate-400">Coins</span>
                <span className="font-mono font-bold text-amber-300">+{stats.coinsInRun}</span>
              </div>
              <div className="flex items-center justify-between px-2 py-1 bg-slate-900/60 rounded">
                <span className="text-slate-400">Perfect Gates</span>
                <span className="font-mono font-bold text-emerald-400">{stats.perfectGatesInRun}</span>
              </div>
              <div className="flex items-center justify-between px-2 py-1 bg-slate-900/60 rounded">
                <span className="text-slate-400">Near Misses</span>
                <span className="font-mono font-bold text-indigo-300">{stats.nearMissesInRun}</span>
              </div>
            </div>

            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
              <span>Sky Zone Reached:</span>
              <span className="font-bold text-sky-400">{stats.zone.replace('_', ' ')}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="w-full flex flex-col gap-2">
            <button
              onClick={handleRestart}
              className="w-full py-3 px-4 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-extrabold rounded-xl shadow-lg shadow-sky-500/25 transition-all transform active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>PLAY AGAIN</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleShareScore}
                className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5 text-sky-400" />
                <span>{shareFeedback || 'Share Score'}</span>
              </button>

              <button
                onClick={handleGoToMenu}
                className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Home className="w-3.5 h-3.5 text-slate-400" />
                <span>Main Menu</span>
              </button>
            </div>
          </div>

          <span className="mt-3 text-[10px] text-slate-500 font-mono">
            Press Space / Tap to quick restart
          </span>
        </div>
      )}

      {/* ================= MODALS SYSTEM ================= */}
      {activeModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 pointer-events-auto animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl relative max-h-[90vh] flex flex-col">
            {/* Modal Close Button */}
            <button
              onClick={closeModal}
              aria-label="Close modal"
              className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* --- MODAL 1: GAME MODES --- */}
            {activeModal === 'MODES' && (
              <div className="flex flex-col overflow-y-auto pr-1">
                <h3 className="text-xl font-bold text-white mb-1 font-['Outfit'] flex items-center gap-2">
                  <Compass className="w-5 h-5 text-sky-400" />
                  <span>Game Modes</span>
                </h3>
                <p className="text-xs text-slate-400 mb-4">Choose your flight challenge</p>

                <div className="flex flex-col gap-2.5">
                  {[
                    { id: 'CLASSIC', name: 'Classic Sky Hopper', desc: 'Endless gates, escalating speed, all power-ups.', icon: Play, color: 'text-sky-400' },
                    { id: 'TIME_ATTACK', name: 'Time Attack (60s)', desc: 'Race against the clock! Stars give +3s bonus time.', icon: Clock, color: 'text-rose-400' },
                    { id: 'STAR_RUSH', name: 'Star Rush', desc: 'Stars spawn at every gate. Focus on rhythm and collection.', icon: Star, color: 'text-amber-400' },
                    { id: 'HARDCORE', name: 'Hardcore Flight', desc: '1 Life, faster speed, tighter gaps. For true aces.', icon: Flame, color: 'text-orange-400' },
                    { id: 'ZEN', name: 'Zen Mode', desc: 'Gentle relaxed speed, forgiving gaps. Pure peaceful flying.', icon: Heart, color: 'text-emerald-400' },
                  ].map((m) => {
                    const Icon = m.icon;
                    const best = persistentData.statistics.modeBestScores[m.id as GameMode] || 0;
                    return (
                      <button
                        key={m.id}
                        onClick={(e) => handleSelectGameMode(m.id as GameMode, e)}
                        className="p-3 bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 hover:border-sky-500/40 rounded-xl text-left transition-all cursor-pointer flex items-center justify-between group"
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-slate-900 rounded-lg shrink-0">
                            <Icon className={`w-5 h-5 ${m.color}`} />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-white group-hover:text-sky-300 transition-colors">
                              {m.name}
                            </h4>
                            <p className="text-[11px] text-slate-400 mt-0.5">{m.desc}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[10px] text-slate-500 uppercase block font-semibold">Best</span>
                          <span className="font-mono text-xs font-bold text-sky-400">{best}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* --- MODAL 2: NOVA COLLECTION (SKINS) --- */}
            {activeModal === 'COLLECTION' && (
              <div className="flex flex-col overflow-y-auto pr-1">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-xl font-bold text-white font-['Outfit'] flex items-center gap-2">
                    <Palette className="w-5 h-5 text-pink-400" />
                    <span>Nova Collection</span>
                  </h3>
                  <div className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs font-bold text-amber-300">
                    <Coins className="w-3.5 h-3.5 text-amber-400" />
                    <span>{persistentData.totalCoins}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mb-4">Purely cosmetic skins to personalize your flyer</p>

                <div className="grid grid-cols-2 gap-2.5">
                  {NOVA_SKINS.map((skin) => {
                    const isUnlocked = persistentData.unlockedSkins.includes(skin.id);
                    const isEquipped = persistentData.equippedSkin === skin.id;

                    return (
                      <div
                        key={skin.id}
                        className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                          isEquipped
                            ? 'bg-sky-950/40 border-sky-400/50 shadow-md shadow-sky-500/10'
                            : 'bg-slate-950/60 border-slate-800'
                        }`}
                      >
                        <div>
                          {/* Skin color preview dots */}
                          <div className="flex items-center gap-1.5 mb-2">
                            <span
                              className="w-4 h-4 rounded-full border border-white/20 shadow-sm"
                              style={{ backgroundColor: skin.palette.primary }}
                            />
                            <span
                              className="w-3 h-3 rounded-full border border-white/20"
                              style={{ backgroundColor: skin.palette.secondary }}
                            />
                            <span
                              className="w-2.5 h-2.5 rounded-full border border-white/20"
                              style={{ backgroundColor: skin.palette.accent }}
                            />
                          </div>
                          <h4 className="text-xs font-bold text-white leading-tight">{skin.name}</h4>
                          <p className="text-[10px] text-slate-400 mt-1 leading-snug line-clamp-2">
                            {skin.description}
                          </p>
                        </div>

                        <div className="mt-3">
                          {isEquipped ? (
                            <span className="w-full py-1.5 bg-sky-500/20 border border-sky-400/40 text-sky-300 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1">
                              <Check className="w-3 h-3" /> Equipped
                            </span>
                          ) : isUnlocked ? (
                            <button
                              onClick={(e) => handleEquipSkin(skin.id, e)}
                              className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                            >
                              Equip
                            </button>
                          ) : (
                            <button
                              onClick={(e) => handleBuySkin(skin, e)}
                              className="w-full py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-extrabold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1"
                            >
                              <Lock className="w-3 h-3" />
                              <span>{skin.cost} 🪙</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* --- MODAL 3: MISSIONS --- */}
            {activeModal === 'MISSIONS' && (
              <div className="flex flex-col overflow-y-auto pr-1">
                <h3 className="text-xl font-bold text-white mb-1 font-['Outfit'] flex items-center gap-2">
                  <Target className="w-5 h-5 text-amber-400" />
                  <span>Flight Missions</span>
                </h3>
                <p className="text-xs text-slate-400 mb-4">Complete objectives to earn coins</p>

                <div className="flex flex-col gap-3">
                  {persistentData.activeMissions.map((m) => {
                    const percent = Math.min(100, Math.round((m.current / m.goal) * 100));

                    return (
                      <div
                        key={m.id}
                        className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex flex-col gap-2"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="text-sm font-bold text-white">{m.title}</h4>
                            <p className="text-xs text-slate-400 mt-0.5">{m.description}</p>
                          </div>
                          <span className="font-mono text-xs font-bold text-amber-400 shrink-0">
                            +{m.rewardCoins} 🪙
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-sky-400 to-indigo-400 rounded-full transition-all"
                            style={{ width: `${percent}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400 font-mono">
                            {m.current} / {m.goal}
                          </span>
                          {m.completed && !m.claimed ? (
                            <button
                              onClick={(e) => handleClaimMission(m.id, e)}
                              className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-lg transition-colors cursor-pointer animate-pulse"
                            >
                              Claim Reward
                            </button>
                          ) : m.completed ? (
                            <span className="text-emerald-400 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                            </span>
                          ) : (
                            <span className="text-slate-500 font-medium">In Progress</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* --- MODAL 4: DAILY CHALLENGE --- */}
            {activeModal === 'DAILY' && persistentData.dailyChallenge && (
              <div className="flex flex-col overflow-y-auto pr-1">
                <h3 className="text-xl font-bold text-white mb-1 font-['Outfit'] flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-400" />
                  <span>Daily Sky Challenge</span>
                </h3>
                <p className="text-xs text-slate-400 mb-4">A unique procedural modifier each day</p>

                <div className="p-4 bg-slate-950/70 border border-emerald-500/30 rounded-xl flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                      {persistentData.dailyChallenge.dateKey}
                    </span>
                    <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 font-black text-xs rounded-md">
                      +{persistentData.dailyChallenge.rewardCoins} 🪙
                    </span>
                  </div>

                  <div>
                    <h4 className="text-base font-extrabold text-white">
                      {persistentData.dailyChallenge.title}
                    </h4>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      {persistentData.dailyChallenge.description}
                    </p>
                  </div>

                  <div className="p-2.5 bg-slate-900/60 rounded-lg flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Target Score:</span>
                    <span className="text-sky-400 font-bold">
                      {persistentData.dailyChallenge.targetScore}
                    </span>
                  </div>

                  {persistentData.dailyChallenge.completed ? (
                    <div className="w-full py-2.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold rounded-xl flex items-center justify-center gap-1.5 text-xs">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Completed For Today!</span>
                    </div>
                  ) : (
                    <button
                      onClick={handleStartDailyChallenge}
                      className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-extrabold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 text-sm"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>Accept Today's Challenge</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* --- MODAL 5: ACHIEVEMENTS --- */}
            {activeModal === 'ACHIEVEMENTS' && (
              <div className="flex flex-col overflow-y-auto pr-1">
                <h3 className="text-xl font-bold text-white mb-1 font-['Outfit'] flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-400" />
                  <span>Badges & Honors</span>
                </h3>
                <p className="text-xs text-slate-400 mb-4">Milestones across your Sky Hopper career</p>

                <div className="grid grid-cols-1 gap-2">
                  {persistentData.achievements.map((ach) => (
                    <div
                      key={ach.id}
                      className={`p-3 rounded-xl border flex items-center justify-between ${
                        ach.unlocked
                          ? 'bg-slate-950/70 border-amber-500/40 shadow-sm'
                          : 'bg-slate-950/40 border-slate-850 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-lg ${
                            ach.unlocked ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-500'
                          }`}
                        >
                          <Trophy className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white">{ach.title}</h4>
                          <p className="text-[11px] text-slate-400">{ach.description}</p>
                        </div>
                      </div>
                      {ach.unlocked ? (
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                          Unlocked
                        </span>
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* --- MODAL 6: STATISTICS --- */}
            {activeModal === 'STATS' && (
              <div className="flex flex-col overflow-y-auto pr-1">
                <h3 className="text-xl font-bold text-white mb-1 font-['Outfit'] flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-indigo-400" />
                  <span>Lifetime Statistics</span>
                </h3>
                <p className="text-xs text-slate-400 mb-4">Complete flight records saved locally</p>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { label: 'Total Runs', val: persistentData.statistics.totalRuns },
                    { label: 'Highest Score', val: persistentData.statistics.highestScore },
                    { label: 'Max Combo', val: `x${persistentData.statistics.highestCombo}` },
                    { label: 'Total Gates Passed', val: persistentData.statistics.totalGates },
                    { label: 'Total Stars Gathered', val: persistentData.statistics.totalStars },
                    { label: 'Total Coins Earned', val: persistentData.statistics.totalCoins },
                    { label: 'Perfect Gates', val: persistentData.statistics.perfectGates },
                    { label: 'Near Misses', val: persistentData.statistics.nearMisses },
                    { label: 'Power-Ups Picked', val: persistentData.statistics.powerUpsCollected },
                    { label: 'Longest Run', val: `${persistentData.statistics.longestRunSeconds}s` },
                  ].map((s, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-lg flex flex-col">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">{s.label}</span>
                      <span className="font-mono text-base font-bold text-sky-400 mt-0.5">{s.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* --- MODAL 7: SETTINGS --- */}
            {activeModal === 'SETTINGS' && (
              <div className="flex flex-col overflow-y-auto pr-1">
                <h3 className="text-xl font-bold text-white mb-1 font-['Outfit'] flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-slate-300" />
                  <span>Settings</span>
                </h3>
                <p className="text-xs text-slate-400 mb-4">Configure audio, graphics & accessibility</p>

                <div className="flex flex-col gap-3 text-xs">
                  {/* Sound FX */}
                  <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-white">Sound Effects</h4>
                      <p className="text-[11px] text-slate-400">Pure Web Audio synthesized arcade chimes</p>
                    </div>
                    <button
                      onClick={handleToggleMute}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                        !isMuted ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {!isMuted ? 'ENABLED' : 'MUTED'}
                    </button>
                  </div>

                  {/* Screen Shake */}
                  <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-white">Screen Shake</h4>
                      <p className="text-[11px] text-slate-400">Impact recoil on crashes & shockwaves</p>
                    </div>
                    <button
                      onClick={() => {
                        const cur = persistentData.settings.screenShake;
                        saveDataManager.updateSettings({ screenShake: !cur });
                      }}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                        persistentData.settings.screenShake ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {persistentData.settings.screenShake ? 'ON' : 'OFF'}
                    </button>
                  </div>

                  {/* Reduced Motion */}
                  <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-white">Reduced Motion</h4>
                      <p className="text-[11px] text-slate-400">Smoother camera for sensitive vision</p>
                    </div>
                    <button
                      onClick={() => {
                        const cur = persistentData.settings.reducedMotion;
                        saveDataManager.updateSettings({ reducedMotion: !cur });
                      }}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                        persistentData.settings.reducedMotion ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {persistentData.settings.reducedMotion ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* --- MODAL 8: HOW TO PLAY --- */}
            {activeModal === 'HOW_TO_PLAY' && (
              <div className="flex flex-col overflow-y-auto pr-1">
                <h3 className="text-xl font-bold text-white mb-1 font-['Outfit'] flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-sky-400" />
                  <span>How To Play</span>
                </h3>
                <p className="text-xs text-slate-400 mb-4">Learn the secrets of the skies</p>

                <div className="flex flex-col gap-3 text-xs text-slate-300">
                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                    <h4 className="font-bold text-white mb-0.5">Controls</h4>
                    <p className="text-slate-400 leading-relaxed">
                      Tap screen, click mouse, or press <strong className="text-sky-300">Space / W / Up Arrow</strong> to flap upward. Press <strong className="text-sky-300">P / Esc</strong> to pause.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                    <h4 className="font-bold text-white mb-0.5">Combos & Perfect Gates</h4>
                    <p className="text-slate-400 leading-relaxed">
                      Pass through consecutive gates without crashing to climb your combo up to <strong className="text-amber-300">x10</strong>! Flying cleanly through the exact center triggers a <strong className="text-sky-300">PERFECT! (+3)</strong> bonus. Grazing edges triggers a <strong className="text-indigo-300">NEAR MISS! (+2)</strong>.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                    <h4 className="font-bold text-white mb-0.5">Power-Ups</h4>
                    <p className="text-slate-400 leading-relaxed">
                      Collect <strong className="text-sky-300">5 Stars</strong> to bend time with Slow Motion! Pick up glowing orbs for Shields, Coin Magnets, 2X Star Multipliers, and Ghost Mode.
                    </p>
                  </div>
                </div>

                <button
                  onClick={closeModal}
                  className="mt-4 w-full py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-xl transition-colors cursor-pointer text-xs"
                >
                  Got It!
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
