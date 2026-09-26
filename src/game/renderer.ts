/**
 * Sky Hopper - Comprehensive Canvas Renderer
 * Handles rendering for:
 * - 5 Sky Zones (Neon Clouds, Crystal Skies, Storm Realm, Cosmic Void, Aurora Dimension)
 * - Nova with full customization skin palettes (Classic, Galaxy, Solar, Ice, Shadow, Gold)
 * - Power-up auras (Shield, Magnet, Multiplier, Ghost Mode)
 * - Energy Gates with 8 special types (Moving, Narrow, Rotating, Pulsing, etc.)
 * - Collectibles: Glowing Stars, 3D Rotating Coins, Power-Up Orbs
 * - Weather events (Lightning flashes, meteors, aurora ribbons, wind streaks)
 * - Void Beast chase creature silhouette
 * - Personal Ghost Run playback
 * - Particle system and floating text animations
 */

import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT, GATE_WIDTH, NOVA_SKINS } from './constants';
import {
  Nova,
  EnergyGate,
  CollectibleStar,
  CollectibleCoin,
  ActivePowerUpItem,
  ParallaxStar,
  DistantIsland,
  SkyZone,
  NovaSkinId,
  GhostPoint,
  WeatherEventState,
  VoidBeastState,
} from './types';
import { ParticleSystem } from './particles';

export class GameRenderer {
  private ctx: CanvasRenderingContext2D;
  private bgStars: ParallaxStar[] = [];
  private distantIslands: DistantIsland[] = [];
  private meteors: { x: number; y: number; vx: number; vy: number; life: number; maxLife: number }[] = [];
  private globalTime: number = 0;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.initBackgroundLayers();
  }

  private initBackgroundLayers() {
    this.bgStars = [];
    for (let i = 0; i < 75; i++) {
      this.bgStars.push({
        x: Math.random() * VIRTUAL_WIDTH,
        y: Math.random() * VIRTUAL_HEIGHT,
        size: 0.8 + Math.random() * 2.4,
        alpha: 0.3 + Math.random() * 0.7,
        speed: 8 + Math.random() * 24,
        twinkleSpeed: 2 + Math.random() * 4,
        twinklePhase: Math.random() * Math.PI * 2,
        color: Math.random() > 0.7 ? '#67e8f9' : '#e0e7ff',
      });
    }

    this.distantIslands = [
      { x: 40, y: 520, width: 130, height: 75, speed: 18, variant: 0 },
      { x: 230, y: 560, width: 170, height: 90, speed: 22, variant: 1 },
      { x: 440, y: 500, width: 120, height: 65, speed: 15, variant: 2 },
    ];
  }

  /**
   * Main render pipeline
   */
  public render(
    dt: number,
    nova: Nova,
    skinId: NovaSkinId,
    gates: EnergyGate[],
    stars: CollectibleStar[],
    coins: CollectibleCoin[],
    powerUps: ActivePowerUpItem[],
    particles: ParticleSystem,
    screenShake: number,
    slowMoBlend: number,
    worldSpeed: number,
    zone: SkyZone,
    weather: WeatherEventState,
    voidBeast: VoidBeastState,
    ghostPoint: GhostPoint | null
  ) {
    this.globalTime += dt;
    const ctx = this.ctx;

    ctx.save();

    // 1. Screen Shake
    if (screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * screenShake * 12;
      const shakeY = (Math.random() - 0.5) * screenShake * 12;
      ctx.translate(shakeX, shakeY);
    }

    // 2. Sky Gradient based on Sky Zone with smooth Slow-Mo overlay blend
    this.renderSky(zone, slowMoBlend, weather);

    // 3. Weather Atmosphere (Aurora curtains, Lightning flashes, Meteors)
    this.renderWeather(weather, dt);

    // 4. Parallax Background Stars & Celestial Bodies
    this.renderBackgroundStars(dt, worldSpeed, zone);

    // 5. Parallax Floating Islands & Giant Crystals
    this.renderDistantIslands(dt, worldSpeed, zone);

    // 6. Void Beast Chase Silhouette (if active)
    if (voidBeast.active) {
      this.renderVoidBeast(voidBeast);
    }

    // 7. Energy Gates (Special gates & pylons)
    this.renderEnergyGates(gates, zone);

    // 8. Collectible Coins
    this.renderCoins(coins);

    // 9. Collectible Stars
    this.renderStars(stars, nova.starMultiplierActive);

    // 10. Floating Power-Up Pickups
    this.renderPowerUpPickups(powerUps);

    // 11. Magnet Attraction Streams
    if (nova.magnetActive) {
      this.renderMagnetWaves(nova, stars, coins, powerUps);
    }

    // 12. Personal Ghost Silhouette (Previous best run)
    if (ghostPoint) {
      this.renderGhostNova(ghostPoint);
    }

    // 13. Particles & Stardust
    this.renderParticles(particles);

    // 14. Nova Player Character (With equipped skin & power-up auras)
    this.renderNova(nova, skinId, slowMoBlend);

    // 15. Floating Score & Feedback Texts
    this.renderFloatingTexts(particles);

    // 16. Fullscreen Slow-Mo / Power-Up Vignette (Smoothly blended)
    if (slowMoBlend > 0.01) {
      this.renderSlowMoOverlay(slowMoBlend);
    }

    ctx.restore();
  }

  /**
   * Sky gradient matching the active Sky Zone
   */
  private renderSky(zone: SkyZone, slowMoBlend: number, weather: WeatherEventState) {
    const ctx = this.ctx;
    const grad = ctx.createLinearGradient(0, 0, 0, VIRTUAL_HEIGHT);

    switch (zone) {
      case 'NEON_CLOUDS':
        grad.addColorStop(0, '#060719');
        grad.addColorStop(0.35, '#120d2d');
        grad.addColorStop(0.7, '#1f1345');
        grad.addColorStop(1, '#2f155c');
        break;
      case 'CRYSTAL_SKIES':
        grad.addColorStop(0, '#021820');
        grad.addColorStop(0.35, '#06283d');
        grad.addColorStop(0.7, '#0d4a68');
        grad.addColorStop(1, '#0e6789');
        break;
      case 'STORM_REALM':
        grad.addColorStop(0, '#090914');
        grad.addColorStop(0.4, '#121226');
        grad.addColorStop(0.75, '#1c1b3a');
        grad.addColorStop(1, '#2c224d');
        break;
      case 'COSMIC_VOID':
        grad.addColorStop(0, '#020208');
        grad.addColorStop(0.35, '#070617');
        grad.addColorStop(0.7, '#140c2e');
        grad.addColorStop(1, '#24103a');
        break;
      case 'AURORA_DIMENSION':
        grad.addColorStop(0, '#021516');
        grad.addColorStop(0.35, '#052b27');
        grad.addColorStop(0.7, '#0b423c');
        grad.addColorStop(1, '#1b2d42');
        break;
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    // Smoothly overlay celestial indigo/cyan time-dilation sky based on slowMoBlend
    if (slowMoBlend > 0.01) {
      ctx.save();
      ctx.globalAlpha = slowMoBlend * 0.75;
      const slowMoGrad = ctx.createLinearGradient(0, 0, 0, VIRTUAL_HEIGHT);
      slowMoGrad.addColorStop(0, '#040b18');
      slowMoGrad.addColorStop(0.4, '#091b33');
      slowMoGrad.addColorStop(0.75, '#0e2b4d');
      slowMoGrad.addColorStop(1, '#173f6b');
      ctx.fillStyle = slowMoGrad;
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      ctx.restore();
    }

    // Weather lightning flash overlay
    if (weather.lightningFlash > 0) {
      ctx.fillStyle = `rgba(224, 231, 255, ${weather.lightningFlash * 0.4})`;
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }
  }

  /**
   * Render dynamic weather effects
   */
  private renderWeather(weather: WeatherEventState, dt: number) {
    const ctx = this.ctx;

    // Aurora ribbons in Aurora Dimension or Aurora weather
    if (weather.type === 'AURORA') {
      ctx.save();
      const waveCount = 3;
      for (let w = 0; w < waveCount; w++) {
        ctx.beginPath();
        const baseOffset = w * 70 + 60;
        ctx.moveTo(0, baseOffset);
        for (let x = 0; x <= VIRTUAL_WIDTH; x += 30) {
          const y =
            baseOffset +
            Math.sin(this.globalTime * 1.5 + x * 0.015 + w * 2) * 28 +
            Math.cos(this.globalTime * 0.8 + x * 0.008) * 16;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(VIRTUAL_WIDTH, 0);
        ctx.lineTo(0, 0);
        ctx.closePath();

        const auroraGrad = ctx.createLinearGradient(0, 0, 0, baseOffset + 60);
        auroraGrad.addColorStop(0, 'rgba(52, 211, 153, 0.16)');
        auroraGrad.addColorStop(0.6, 'rgba(56, 189, 248, 0.12)');
        auroraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = auroraGrad;
        ctx.fill();
      }
      ctx.restore();
    }

    // Meteors
    if (weather.type === 'METEORS') {
      if (Math.random() < 0.06 && this.meteors.length < 5) {
        this.meteors.push({
          x: Math.random() * VIRTUAL_WIDTH + 100,
          y: -20,
          vx: -(180 + Math.random() * 120),
          vy: 220 + Math.random() * 160,
          life: 0,
          maxLife: 1.2,
        });
      }

      ctx.save();
      for (let i = this.meteors.length - 1; i >= 0; i--) {
        const m = this.meteors[i];
        m.life += dt;
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        if (m.life >= m.maxLife || m.y > VIRTUAL_HEIGHT + 30) {
          this.meteors.splice(i, 1);
          continue;
        }

        const alpha = Math.max(0, 1 - m.life / m.maxLife);
        ctx.strokeStyle = `rgba(254, 240, 138, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(m.x - m.vx * 0.1, m.y - m.vy * 0.1);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /**
   * Background twinkling stars
   */
  private renderBackgroundStars(dt: number, worldSpeed: number, zone: SkyZone) {
    const ctx = this.ctx;

    for (const star of this.bgStars) {
      star.x -= (star.speed + worldSpeed * 0.08) * dt;
      if (star.x < -10) {
        star.x = VIRTUAL_WIDTH + 10;
        star.y = Math.random() * VIRTUAL_HEIGHT;
      }

      const twinkle = Math.sin(this.globalTime * star.twinkleSpeed + star.twinklePhase);
      const alpha = Math.max(0.2, star.alpha + twinkle * 0.35);

      ctx.fillStyle = star.color || `rgba(224, 231, 255, ${alpha.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Parallax distant floating islands & crystals
   */
  private renderDistantIslands(dt: number, worldSpeed: number, zone: SkyZone) {
    const ctx = this.ctx;

    for (const island of this.distantIslands) {
      island.x -= (island.speed + worldSpeed * 0.06) * dt;
      if (island.x + island.width < -40) {
        island.x = VIRTUAL_WIDTH + 60;
        island.y = 480 + Math.random() * 120;
      }

      ctx.save();
      ctx.fillStyle = zone === 'CRYSTAL_SKIES' ? 'rgba(8, 47, 73, 0.7)' : 'rgba(23, 15, 54, 0.65)';
      ctx.strokeStyle = zone === 'CRYSTAL_SKIES' ? 'rgba(56, 189, 248, 0.35)' : 'rgba(139, 92, 246, 0.3)';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      const { x, y, width: w, height: h } = island;
      ctx.moveTo(x, y);
      ctx.lineTo(x + w * 0.25, y - 6);
      ctx.lineTo(x + w * 0.7, y - 4);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w * 0.85, y + h * 0.4);
      ctx.lineTo(x + w * 0.5, y + h);
      ctx.lineTo(x + w * 0.15, y + h * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Glowing crystal spire
      const spireX = x + w * 0.45;
      const spireY = y - 6;
      ctx.fillStyle = zone === 'CRYSTAL_SKIES' ? 'rgba(56, 189, 248, 0.55)' : 'rgba(167, 139, 250, 0.45)';
      ctx.beginPath();
      ctx.moveTo(spireX - 4, spireY);
      ctx.lineTo(spireX, spireY - 20);
      ctx.lineTo(spireX + 4, spireY);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
  }

  /**
   * Void Beast chase silhouette in deep background
   */
  private renderVoidBeast(beast: VoidBeastState) {
    const ctx = this.ctx;
    ctx.save();

    const beastX = beast.x;
    const beastY = beast.y + Math.sin(this.globalTime * 2) * 20;

    // Glowing menacing celestial eyes
    ctx.fillStyle = '#ef4444';
    ctx.shadowColor = '#dc2626';
    ctx.shadowBlur = 18;

    // Eye 1
    ctx.beginPath();
    ctx.ellipse(beastX + 50, beastY - 15, 8, 14, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Eye 2
    ctx.beginPath();
    ctx.ellipse(beastX + 50, beastY + 15, 8, 14, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Dark colossal silhouette
    ctx.fillStyle = 'rgba(10, 8, 20, 0.85)';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(beastX, beastY, 90, 0, Math.PI * 2);
    ctx.fill();

    // Beast horns/fins
    ctx.beginPath();
    ctx.moveTo(beastX - 30, beastY - 70);
    ctx.lineTo(beastX + 40, beastY - 130);
    ctx.lineTo(beastX + 10, beastY - 50);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(beastX - 30, beastY + 70);
    ctx.lineTo(beastX + 40, beastY + 130);
    ctx.lineTo(beastX + 10, beastY + 50);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  /**
   * Render Energy Gates with special variations
   */
  private renderEnergyGates(gates: EnergyGate[], zone: SkyZone) {
    const ctx = this.ctx;

    for (const gate of gates) {
      if (gate.x < -GATE_WIDTH - 30 || gate.x > VIRTUAL_WIDTH + 30) continue;

      const topPylonHeight = gate.gapY - gate.gapHeight / 2;
      const bottomPylonY = gate.gapY + gate.gapHeight / 2;
      const bottomPylonHeight = VIRTUAL_HEIGHT - bottomPylonY;

      // Theme colors
      let primaryColor = '#38bdf8';
      let glowColor = 'rgba(56, 189, 248, 0.45)';
      let coreColor = '#bae6fd';

      if (gate.colorTheme === 'violet') {
        primaryColor = '#c084fc';
        glowColor = 'rgba(192, 132, 252, 0.45)';
        coreColor = '#f3e8ff';
      } else if (gate.colorTheme === 'amber') {
        primaryColor = '#fbbf24';
        glowColor = 'rgba(251, 191, 36, 0.45)';
        coreColor = '#fef3c7';
      } else if (gate.colorTheme === 'emerald') {
        primaryColor = '#34d399';
        glowColor = 'rgba(52, 211, 153, 0.45)';
        coreColor = '#d1fae5';
      } else if (gate.colorTheme === 'crimson') {
        primaryColor = '#f43f5e';
        glowColor = 'rgba(244, 63, 94, 0.45)';
        coreColor = '#ffe4e6';
      }

      ctx.save();
      if (gate.gateType === 'VANISHING' && gate.opacity !== undefined) {
        ctx.globalAlpha = Math.max(0.35, gate.opacity);
      }

      // Upper Pylon
      this.drawPylon(
        gate.x,
        0,
        gate.width,
        topPylonHeight,
        true,
        primaryColor,
        glowColor,
        coreColor,
        gate.gateType
      );

      // Lower Pylon
      this.drawPylon(
        gate.x,
        bottomPylonY,
        gate.width,
        bottomPylonHeight,
        false,
        primaryColor,
        glowColor,
        coreColor,
        gate.gateType
      );

      // Energy Field
      this.drawEnergyField(
        gate.x + gate.width / 2,
        topPylonHeight,
        bottomPylonY,
        primaryColor,
        glowColor,
        gate.gateType
      );

      ctx.restore();
    }
  }

  private drawPylon(
    x: number,
    y: number,
    w: number,
    h: number,
    isTop: boolean,
    primaryColor: string,
    glowColor: string,
    coreColor: string,
    gateType: string
  ) {
    if (h <= 0) return;
    const ctx = this.ctx;
    ctx.save();

    const tipY = isTop ? y + h : y;
    const baseMargin = 6;

    const bodyGrad = ctx.createLinearGradient(x, 0, x + w, 0);
    bodyGrad.addColorStop(0, '#12142e');
    bodyGrad.addColorStop(0.45, '#1e204a');
    bodyGrad.addColorStop(0.55, '#2b2a61');
    bodyGrad.addColorStop(1, '#11122a');

    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 2;

    ctx.beginPath();
    if (isTop) {
      ctx.moveTo(x + baseMargin, 0);
      ctx.lineTo(x + w - baseMargin, 0);
      ctx.lineTo(x + w - baseMargin, tipY - 24);
      ctx.lineTo(x + w * 0.72, tipY - 8);
      ctx.lineTo(x + w * 0.5, tipY);
      ctx.lineTo(x + w * 0.28, tipY - 8);
      ctx.lineTo(x + baseMargin, tipY - 24);
      ctx.closePath();
    } else {
      ctx.moveTo(x + w * 0.5, tipY);
      ctx.lineTo(x + w * 0.72, tipY + 8);
      ctx.lineTo(x + w - baseMargin, tipY + 24);
      ctx.lineTo(x + w - baseMargin, VIRTUAL_HEIGHT);
      ctx.lineTo(x + baseMargin, VIRTUAL_HEIGHT);
      ctx.lineTo(x + baseMargin, tipY + 24);
      ctx.lineTo(x + w * 0.28, tipY + 8);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();

    // High-tech glowing conduit
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    if (isTop) {
      ctx.moveTo(x + w / 2, 8);
      ctx.lineTo(x + w / 2, tipY - 12);
    } else {
      ctx.moveTo(x + w / 2, tipY + 12);
      ctx.lineTo(x + w / 2, VIRTUAL_HEIGHT - 8);
    }
    ctx.stroke();

    // Tip Emitter Node
    ctx.fillStyle = coreColor;
    ctx.shadowColor = primaryColor;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(x + w / 2, isTop ? tipY - 7 : tipY + 7, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawEnergyField(
    centerX: number,
    topTipY: number,
    bottomTipY: number,
    color: string,
    glowColor: string,
    gateType: string
  ) {
    const ctx = this.ctx;
    ctx.save();

    const pulse = (Math.sin(this.globalTime * 6) + 1) * 0.5;
    ctx.strokeStyle = color;
    ctx.lineWidth = gateType === 'PULSING' ? 2 + pulse * 2 : 1.2;
    ctx.globalAlpha = 0.25 + pulse * 0.35;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 8;

    const sparkY =
      topTipY + (bottomTipY - topTipY) * ((Math.sin(this.globalTime * 3 + centerX) + 1) * 0.5);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(centerX + Math.sin(this.globalTime * 8) * 8, sparkY, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Render 3D Rotating Golden Coins
   */
  private renderCoins(coins: CollectibleCoin[]) {
    const ctx = this.ctx;

    for (const coin of coins) {
      if (coin.collected || coin.x < -30 || coin.x > VIRTUAL_WIDTH + 30) continue;

      ctx.save();
      ctx.translate(coin.x, coin.y);

      // 3D spinning effect along horizontal axis (scaleX)
      const spinScale = Math.cos(coin.rotation);
      ctx.scale(spinScale, 1);

      // Outer coin rim
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(0, 0, coin.radius, 0, Math.PI * 2);
      ctx.fill();

      // Inner coin body
      const coinGrad = ctx.createLinearGradient(-coin.radius, -coin.radius, coin.radius, coin.radius);
      coinGrad.addColorStop(0, '#fef08a');
      coinGrad.addColorStop(0.5, '#fbbf24');
      coinGrad.addColorStop(1, '#d97706');
      ctx.fillStyle = coinGrad;
      ctx.beginPath();
      ctx.arc(0, 0, coin.radius - 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Coin center star emblem
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  /**
   * Render Collectible Stars
   */
  private renderStars(stars: CollectibleStar[], multiplierActive: boolean) {
    const ctx = this.ctx;

    for (const star of stars) {
      if (star.collected || star.x < -30 || star.x > VIRTUAL_WIDTH + 30) continue;

      ctx.save();
      ctx.translate(star.x, star.y);

      const rot = this.globalTime * 1.8;
      const pulse = 1 + Math.sin(this.globalTime * 5 + star.floatPhase) * 0.15;

      // Outer star aura glow
      const aura = ctx.createRadialGradient(0, 0, 4, 0, 0, star.radius * 2);
      aura.addColorStop(0, multiplierActive ? 'rgba(251, 191, 36, 0.7)' : 'rgba(253, 224, 71, 0.6)');
      aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(0, 0, star.radius * 2, 0, Math.PI * 2);
      ctx.fill();

      // Draw 5-pointed crystal star
      ctx.rotate(rot);
      ctx.scale(pulse, pulse);

      ctx.fillStyle = multiplierActive ? '#fef08a' : '#fde047';
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 10;

      ctx.beginPath();
      const points = 5;
      const outerR = star.radius;
      const innerR = star.radius * 0.45;

      for (let p = 0; p < points * 2; p++) {
        const r = p % 2 === 0 ? outerR : innerR;
        const angle = (p * Math.PI) / points;
        const sx = Math.cos(angle) * r;
        const sy = Math.sin(angle) * r;
        if (p === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.fill();

      // Core white shine
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  /**
   * Render Floating Power-Up Item Pickups
   */
  private renderPowerUpPickups(powerUps: ActivePowerUpItem[]) {
    const ctx = this.ctx;

    for (const pu of powerUps) {
      if (pu.collected || pu.x < -30 || pu.x > VIRTUAL_WIDTH + 30) continue;

      ctx.save();
      ctx.translate(pu.x, pu.y);

      let color = '#38bdf8';
      let symbol = '🛡️';
      if (pu.type === 'SHIELD') {
        color = '#38bdf8';
        symbol = '🛡️';
      } else if (pu.type === 'MAGNET') {
        color = '#ec4899';
        symbol = '🧲';
      } else if (pu.type === 'STAR_MULTIPLIER') {
        color = '#fbbf24';
        symbol = '2X';
      } else if (pu.type === 'GHOST') {
        color = '#a855f7';
        symbol = '👻';
      } else if (pu.type === 'SLOW_MO') {
        color = '#67e8f9';
        symbol = '⏳';
      }

      // Outer pulsing orb glow
      const pulse = 1 + Math.sin(this.globalTime * 6 + pu.floatPhase) * 0.15;
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;

      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, pu.radius * pulse, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.arc(0, 0, pu.radius, 0, Math.PI * 2);
      ctx.fill();

      // Icon text
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(symbol, 0, 1);

      ctx.restore();
    }
  }

  /**
   * Magnetic energy stream waves drawn towards Nova
   */
  private renderMagnetWaves(
    nova: Nova,
    stars: CollectibleStar[],
    coins: CollectibleCoin[],
    powerUps: ActivePowerUpItem[]
  ) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(236, 72, 153, 0.45)';
    ctx.lineWidth = 1.2;

    const items = [...stars.filter((s) => !s.collected), ...coins.filter((c) => !c.collected)];
    for (const it of items) {
      const dist = Math.hypot(it.x - nova.x, it.y - nova.y);
      if (dist < 180) {
        ctx.beginPath();
        ctx.moveTo(it.x, it.y);
        ctx.quadraticCurveTo(
          (it.x + nova.x) / 2 + Math.sin(this.globalTime * 8) * 10,
          (it.y + nova.y) / 2,
          nova.x,
          nova.y
        );
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /**
   * Personal Ghost Nova Silhouette (Previous personal best)
   */
  private renderGhostNova(ghostPoint: GhostPoint) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(120, ghostPoint.y);
    ctx.globalAlpha = 0.35;

    // Ghost body
    ctx.fillStyle = '#93c5fd';
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Small "BEST" indicator tag above ghost
    ctx.font = '8px monospace';
    ctx.fillStyle = '#bfdbfe';
    ctx.textAlign = 'center';
    ctx.fillText('BEST', 0, -18);

    ctx.restore();
  }

  /**
   * Nova Hero Character rendering with equipped skin & powerup shields/auras
   */
  private renderNova(nova: Nova, skinId: NovaSkinId, slowMoBlend: number) {
    const ctx = this.ctx;
    const skin = NOVA_SKINS.find((s) => s.id === skinId) || NOVA_SKINS[0];

    ctx.save();
    ctx.translate(nova.x, nova.y);

    // Ghost mode alpha
    if (nova.isGhost) {
      ctx.globalAlpha = 0.42;
    }

    ctx.rotate(nova.rotation);
    ctx.scale(nova.squashX, nova.squashY);

    // 1. Outer Ethereal Glow
    const aura = ctx.createRadialGradient(0, 0, 8, 0, 0, 28);
    aura.addColorStop(0, skin.palette.aura);
    aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.fill();

    // Time-dilation celestial shimmer when slow-mo is active/recovering
    if (slowMoBlend > 0.05) {
      const slowMoAura = ctx.createRadialGradient(0, 0, 10, 0, 0, 32);
      slowMoAura.addColorStop(0, `rgba(56, 189, 248, ${(slowMoBlend * 0.45).toFixed(3)})`);
      slowMoAura.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = slowMoAura;
      ctx.beginPath();
      ctx.arc(0, 0, 32, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Wings
    this.drawNovaWings(nova, skin);

    // 3. Main Round Teardrop Body
    const bodyGrad = ctx.createLinearGradient(-14, -14, 14, 14);
    bodyGrad.addColorStop(0, skin.palette.accent);
    bodyGrad.addColorStop(0.45, skin.palette.primary);
    bodyGrad.addColorStop(1, skin.palette.secondary);

    ctx.fillStyle = bodyGrad;
    ctx.shadowColor = skin.palette.primary;
    ctx.shadowBlur = 10;

    ctx.beginPath();
    ctx.ellipse(0, 0, nova.radius + 2, nova.radius, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Belly Highlight
    const bellyGrad = ctx.createRadialGradient(2, 4, 1, 2, 4, 10);
    bellyGrad.addColorStop(0, 'rgba(255, 255, 255, 0.75)');
    bellyGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = bellyGrad;
    ctx.beginPath();
    ctx.ellipse(2, 4, 8, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // 4. Stardust Antenna
    ctx.strokeStyle = skin.palette.accent;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(2, -12);
    const antWave = Math.sin(this.globalTime * 8) * 3;
    ctx.quadraticCurveTo(8 + antWave, -20, 12 + antWave, -19);
    ctx.stroke();

    ctx.fillStyle = skin.palette.accent;
    ctx.beginPath();
    ctx.arc(12 + antWave, -19, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // 5. Expressive Eyes & Cheeks
    this.drawNovaFace(nova);

    // 6. Shield Energy Bubble
    if (nova.hasShield) {
      this.drawShieldBubble(nova);
    }

    ctx.restore();
  }

  private drawNovaFace(nova: Nova) {
    const ctx = this.ctx;

    // Cheek blush
    ctx.fillStyle = 'rgba(244, 63, 94, 0.45)';
    ctx.beginPath();
    ctx.arc(8, 5, 3.2, 0, Math.PI * 2);
    ctx.fill();

    const eyeX = 6;
    const eyeY = -2;

    if (nova.isBlinking) {
      ctx.strokeStyle = '#1e1b4b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(eyeX, eyeY + 1, 4, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
    } else {
      // Big expressive eyes
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.ellipse(eyeX, eyeY, 4.8, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Iris
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.ellipse(eyeX + 0.5, eyeY + 1.2, 3.2, 3.6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pupil
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(eyeX + 0.5, eyeY + 1.2, 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Specular shines
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(eyeX - 1.2, eyeY - 2, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(eyeX + 1.8, eyeY + 2.2, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawNovaWings(nova: Nova, skin: any) {
    const ctx = this.ctx;
    ctx.save();

    ctx.translate(-4, -4);
    ctx.rotate(nova.wingAngle);

    const wingGrad = ctx.createLinearGradient(0, 0, -22, -18);
    wingGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    wingGrad.addColorStop(0.5, skin.palette.wing);
    wingGrad.addColorStop(1, 'rgba(56, 189, 248, 0.15)');

    ctx.fillStyle = wingGrad;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-14, -18, -26, -16);
    ctx.quadraticCurveTo(-22, -8, -16, -2);
    ctx.quadraticCurveTo(-10, 2, 0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  private drawShieldBubble(nova: Nova) {
    const ctx = this.ctx;
    ctx.save();
    const pulse = 1 + Math.sin(this.globalTime * 8) * 0.08;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.2;
    ctx.shadowColor = '#0284c7';
    ctx.shadowBlur = 12;

    ctx.beginPath();
    ctx.arc(0, 0, (nova.radius + 12) * pulse, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.beginPath();
    ctx.arc(0, 0, (nova.radius + 12) * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private renderFloatingTexts(particles: ParticleSystem) {
    const ctx = this.ctx;
    ctx.save();

    for (const ft of particles.floatingTexts) {
      ctx.save();
      ctx.translate(ft.x, ft.y);
      ctx.scale(ft.scale, ft.scale);
      ctx.globalAlpha = ft.alpha;

      ctx.font = ft.isBig ? '800 18px Outfit, sans-serif' : '700 13px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Text stroke outline for high readability
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 3.5;
      ctx.strokeText(ft.text, 0, 0);

      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, 0, 0);
      ctx.restore();
    }

    ctx.restore();
  }

  private renderParticles(particles: ParticleSystem) {
    const ctx = this.ctx;

    for (const p of particles.particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;

      if (p.shape === 'star') {
        ctx.translate(p.x, p.y);
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          const a = (i * Math.PI) / 2;
          ctx.lineTo(Math.cos(a) * p.size, Math.sin(a) * p.size);
          ctx.lineTo(Math.cos(a + Math.PI / 4) * (p.size * 0.35), Math.sin(a + Math.PI / 4) * (p.size * 0.35));
        }
        ctx.closePath();
        ctx.fill();
      } else if (p.shape === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.shape === 'line') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  private renderSlowMoOverlay(slowMoBlend: number) {
    const ctx = this.ctx;
    ctx.save();
    const vigGrad = ctx.createRadialGradient(
      VIRTUAL_WIDTH / 2,
      VIRTUAL_HEIGHT / 2,
      VIRTUAL_WIDTH * 0.3,
      VIRTUAL_WIDTH / 2,
      VIRTUAL_HEIGHT / 2,
      VIRTUAL_WIDTH * 0.75
    );
    vigGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
    vigGrad.addColorStop(1, `rgba(2, 132, 199, ${(slowMoBlend * 0.32).toFixed(3)})`);
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    ctx.restore();
  }
}
