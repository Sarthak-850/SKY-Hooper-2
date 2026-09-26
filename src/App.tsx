/**
 * Sky Hopper - Main Application Component
 */

import { useState, useCallback } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { UIOverlay } from './components/UIOverlay';
import { GameEngine } from './game/engine';
import { GameState, GameStats } from './game/types';

export default function App() {
  const [engine, setEngine] = useState<GameEngine | null>(null);
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [stats, setStats] = useState<GameStats>({
    score: 0,
    highScore: 0,
    starsInRun: 0,
    coinsInRun: 0,
    totalCoins: 0,
    totalStars: 0,
    combo: 1,
    maxCombo: 1,
    perfectGatesInRun: 0,
    nearMissesInRun: 0,
    zone: 'NEON_CLOUDS',
    zoneProgress: 0,
    gameMode: 'CLASSIC',
    slowMoActive: false,
    slowMoEntering: false,
    slowMoRecovering: false,
    slowMoBlend: 0,
    slowMoTimeRemaining: 0,
    slowMoMaxDuration: 6,
    starsTowardsSlowMo: 0,
    starsRequiredForSlowMo: 5,
    shieldActive: false,
    shieldTimeRemaining: 0,
    magnetActive: false,
    magnetTimeRemaining: 0,
    multiplierActive: false,
    multiplierTimeRemaining: 0,
    ghostActive: false,
    ghostTimeRemaining: 0,
    isNewHighScore: false,
    voidBeastActive: false,
    voidBeastProgress: 0,
  });

  const handleEngineReady = useCallback((inst: GameEngine) => {
    setEngine(inst);
  }, []);

  const handleStatsChange = useCallback((newStats: GameStats) => {
    setStats(newStats);
  }, []);

  const handleStateChange = useCallback((newState: GameState) => {
    setGameState(newState);
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-950 flex flex-col items-center justify-center">
      {/* Background radial ambient lights */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-950/30 rounded-full blur-3xl pointer-events-none" />

      {/* Main Game Frame Container */}
      <div className="relative w-full h-full max-w-[480px] max-h-[720px] aspect-[2/3] flex items-center justify-center overflow-hidden sm:rounded-2xl sm:border sm:border-slate-800/80 sm:shadow-2xl shadow-indigo-950/50">
        <GameCanvas
          onEngineReady={handleEngineReady}
          onStatsChange={handleStatsChange}
          onStateChange={handleStateChange}
        />

        <UIOverlay
          engine={engine}
          gameState={gameState}
          stats={stats}
        />
      </div>
    </main>
  );
}
