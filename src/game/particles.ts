/**
 * Sky Hopper - Particle & Visual FX System
 */

import { Particle, FloatingText } from './types';

export class ParticleSystem {
  public particles: Particle[] = [];
  public floatingTexts: FloatingText[] = [];
  private nextTextId = 1;

  public update(dt: number, timeScale: number) {
    const effectiveDt = dt * timeScale;

    // Update standard particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      p.x += p.vx * effectiveDt;
      p.y += p.vy * effectiveDt;

      // Gravity or drag
      p.vy += 80 * effectiveDt;
      p.vx *= 0.98;

      const progress = p.life / p.maxLife;
      p.alpha = Math.max(0, 1 - progress);
    }

    // Update floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life += dt;
      if (ft.life >= ft.maxLife) {
        this.floatingTexts.splice(i, 1);
        continue;
      }

      ft.y -= (ft.isBig ? 48 : 36) * dt;
      const progress = ft.life / ft.maxLife;
      ft.alpha = Math.max(0, 1 - progress);
      ft.scale = (ft.isBig ? 1.25 : 1) + Math.sin(progress * Math.PI) * 0.25;
    }
  }

  public reset() {
    this.particles = [];
    this.floatingTexts = [];
  }

  public addFloatingText(
    text: string,
    x: number,
    y: number,
    color: string = '#ffffff',
    isBig: boolean = false
  ) {
    this.floatingTexts.push({
      id: this.nextTextId++,
      text,
      x,
      y,
      color,
      alpha: 1,
      scale: isBig ? 1.3 : 1,
      life: 0,
      maxLife: isBig ? 1.1 : 0.8,
      isBig,
    });
  }

  /**
   * Spawn stardust behind Nova with custom skin palette support
   */
  public emitTrail(x: number, y: number, isSlowMo: boolean, customColors?: string[]) {
    const defaultColors = isSlowMo
      ? ['#67e8f9', '#a5f3fc', '#fbcfe8', '#e0e7ff']
      : ['#c084fc', '#818cf8', '#38bdf8', '#f472b6'];

    const colors = customColors && customColors.length > 0 ? customColors : defaultColors;

    const p: Particle = {
      x: x - 12 + (Math.random() * 6 - 3),
      y: y + (Math.random() * 8 - 4),
      vx: -(40 + Math.random() * 40),
      vy: (Math.random() - 0.5) * 20,
      size: 2 + Math.random() * 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 0.8,
      life: 0,
      maxLife: 0.35 + Math.random() * 0.25,
      shape: 'circle',
    };
    this.particles.push(p);
  }

  /**
   * Wing flap puff ring
   */
  public emitFlapPuff(x: number, y: number, color: string = '#bae6fd') {
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI / 2 + (Math.random() - 0.5) * 1.2;
      const speed = 40 + Math.random() * 60;
      this.particles.push({
        x: x - 10,
        y: y + 8,
        vx: Math.cos(angle) * speed - 20,
        vy: Math.sin(angle) * speed,
        size: 2.5 + Math.random() * 3.5,
        color,
        alpha: 0.75,
        life: 0,
        maxLife: 0.3 + Math.random() * 0.15,
        shape: 'circle',
      });
    }
  }

  /**
   * Star collection sparkle explosion
   */
  public emitStarCollection(x: number, y: number, multiplier: boolean = false) {
    const starColors = ['#fde047', '#fef08a', '#67e8f9', '#ffffff', '#fbbf24'];
    const count = multiplier ? 30 : 20;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
      const speed = 70 + Math.random() * 140;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2.5 + Math.random() * 4,
        color: starColors[Math.floor(Math.random() * starColors.length)],
        alpha: 1,
        life: 0,
        maxLife: 0.45 + Math.random() * 0.3,
        shape: Math.random() > 0.4 ? 'star' : 'circle',
      });
    }

    this.addFloatingText(multiplier ? '+10 ★ (2X)' : '+5 ★', x, y - 10, '#fef08a');
  }

  /**
   * Coin collection sparkle explosion
   */
  public emitCoinCollection(x: number, y: number) {
    const coinColors = ['#fbbf24', '#f59e0b', '#fef08a', '#ffffff', '#d97706'];
    for (let i = 0; i < 18; i++) {
      const angle = (Math.PI * 2 * i) / 18 + (Math.random() - 0.5) * 0.3;
      const speed = 60 + Math.random() * 120;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20,
        size: 2.2 + Math.random() * 3.5,
        color: coinColors[Math.floor(Math.random() * coinColors.length)],
        alpha: 1,
        life: 0,
        maxLife: 0.45 + Math.random() * 0.25,
        shape: 'sparkle',
      });
    }

    this.addFloatingText('+10 🪙', x, y - 12, '#fbbf24');
  }

  /**
   * Perfect Gate celebration burst
   */
  public emitPerfectPass(x: number, y: number, comboText?: string) {
    const colors = ['#38bdf8', '#bae6fd', '#fef08a', '#c084fc', '#ffffff'];
    for (let i = 0; i < 32; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 160;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        life: 0,
        maxLife: 0.6 + Math.random() * 0.3,
        shape: Math.random() > 0.5 ? 'star' : 'ring',
      });
    }

    this.addFloatingText(comboText ? `PERFECT! ${comboText}` : 'PERFECT!', x + 15, y - 20, '#fef08a', true);
  }

  /**
   * Near miss wind blade effect
   */
  public emitNearMiss(x: number, y: number) {
    for (let i = 0; i < 12; i++) {
      const angle = Math.PI + (Math.random() - 0.5) * 0.8;
      const speed = 100 + Math.random() * 120;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: (Math.random() - 0.5) * 40,
        size: 2 + Math.random() * 3,
        color: '#e0f2fe',
        alpha: 0.9,
        life: 0,
        maxLife: 0.3 + Math.random() * 0.15,
        shape: 'line',
      });
    }

    this.addFloatingText('NEAR MISS! +2', x + 10, y - 16, '#38bdf8');
  }

  /**
   * Power-up pickup burst
   */
  public emitPowerUpCollect(x: number, y: number, label: string, color: string) {
    for (let i = 0; i < 28; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * 150;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3.5 + Math.random() * 4,
        color,
        alpha: 1,
        life: 0,
        maxLife: 0.55 + Math.random() * 0.25,
        shape: 'sparkle',
      });
    }

    this.addFloatingText(label, x, y - 24, color, true);
  }

  /**
   * Shield shattered shards
   */
  public emitShieldBreak(x: number, y: number) {
    const shardColors = ['#38bdf8', '#bae6fd', '#0284c7', '#ffffff'];
    for (let i = 0; i < 25; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 90 + Math.random() * 160;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 4,
        color: shardColors[Math.floor(Math.random() * shardColors.length)],
        alpha: 1,
        life: 0,
        maxLife: 0.5 + Math.random() * 0.25,
        shape: 'ring',
      });
    }

    this.addFloatingText('SHIELD BROKEN!', x, y - 20, '#ef4444', true);
  }

  /**
   * Slow motion activation burst
   */
  public emitSlowMoActivation(x: number, y: number) {
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 160;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 4,
        color: '#38bdf8',
        alpha: 1,
        life: 0,
        maxLife: 0.6 + Math.random() * 0.3,
        shape: 'circle',
      });
    }
    this.addFloatingText('SLOW MOTION!', x, y - 24, '#38bdf8', true);
  }

  /**
   * Collision crash explosion
   */
  public emitCrash(x: number, y: number) {
    const crashColors = ['#f43f5e', '#fb923c', '#fbbf24', '#f472b6', '#ffffff'];
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 240;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 5,
        color: crashColors[Math.floor(Math.random() * crashColors.length)],
        alpha: 1,
        life: 0,
        maxLife: 0.65 + Math.random() * 0.4,
        shape: 'circle',
      });
    }
  }
}
