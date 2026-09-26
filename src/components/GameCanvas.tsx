/**
 * Sky Hopper - Interactive Game Canvas Component
 * Manages responsive canvas scaling, HiDPI rendering, and unified input handlers
 * (Desktop Keyboard/Mouse + Mobile Touch without scrolling).
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT } from '../game/constants';
import { GameEngine } from '../game/engine';
import { GameState, GameStats } from '../game/types';
import { audioManager } from '../game/audio';

interface GameCanvasProps {
  onEngineReady: (engine: GameEngine) => void;
  onStatsChange: (stats: GameStats) => void;
  onStateChange: (state: GameState) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  onEngineReady,
  onStatsChange,
  onStateChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [scale, setScale] = useState(1);

  // Resize canvas according to device pixel ratio and container aspect ratio
  const handleResize = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const contWidth = container.clientWidth;
    const contHeight = container.clientHeight;

    // Fit virtual resolution (480x720) inside container while preserving aspect ratio
    const targetAspect = VIRTUAL_WIDTH / VIRTUAL_HEIGHT;
    const containerAspect = contWidth / contHeight;

    let displayWidth = contWidth;
    let displayHeight = contHeight;

    if (containerAspect > targetAspect) {
      // Container is wider than 2:3 -> fit to height
      displayHeight = contHeight;
      displayWidth = contHeight * targetAspect;
    } else {
      // Container is taller than 2:3 -> fit to width
      displayWidth = contWidth;
      displayHeight = contWidth / targetAspect;
    }

    const currentScale = displayWidth / VIRTUAL_WIDTH;
    setScale(currentScale);

    const dpr = Math.min(window.devicePixelRatio || 1, 2); // clamp to 2 for battery & smooth perf
    canvas.width = Math.round(VIRTUAL_WIDTH * dpr);
    canvas.height = Math.round(VIRTUAL_HEIGHT * dpr);

    canvas.style.width = `${Math.round(displayWidth)}px`;
    canvas.style.height = `${Math.round(displayHeight)}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0); // reset transform
      ctx.scale(dpr, dpr);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    }
  }, []);

  // Initialize engine & listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    handleResize();

    const engine = new GameEngine(canvas, onStatsChange, onStateChange);
    engineRef.current = engine;
    onEngineReady(engine);
    engine.startLoop();

    window.addEventListener('resize', handleResize);

    // Keyboard controls
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        engine.flap();
      } else if (e.code === 'KeyP' || e.code === 'Escape') {
        e.preventDefault();
        engine.togglePause();
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        audioManager.toggleMute();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      engine.stopLoop();
    };
  }, [handleResize, onEngineReady, onStatsChange, onStateChange]);

  // Pointer & Touch handler on the canvas
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Left mouse click or touch tap
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    if (engineRef.current) {
      engineRef.current.flap();
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex items-center justify-center overflow-hidden bg-slate-950 select-none touch-none"
      style={{ touchAction: 'none' }}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        className="block cursor-pointer shadow-2xl rounded-lg outline-none"
        tabIndex={0}
        aria-label="Sky Hopper Game Area"
      />
    </div>
  );
};
