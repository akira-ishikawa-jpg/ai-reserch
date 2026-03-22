// Renderer - HD-2D-inspired canvas rendering
class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.canvas.width = GAME_WIDTH;
    this.canvas.height = GAME_HEIGHT;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.screenShake = 0;
    this.fadeAlpha = 0;
    this.fadeTarget = 0;
    this.fadeSpeed = 0;
  }

  clear(color = '#000') {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }

  // Draw pixel-art style rectangle
  drawRect(x, y, w, h, color, alpha = 1) {
    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
    this.ctx.globalAlpha = 1;
  }

  // Draw outlined rectangle
  drawRectOutline(x, y, w, h, color, lineWidth = 1) {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.strokeRect(Math.floor(x) + 0.5, Math.floor(y) + 0.5, w - 1, h - 1);
  }

  // Draw rounded rect (for UI panels)
  drawRoundedRect(x, y, w, h, radius, fillColor, strokeColor = null) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fillColor) {
      ctx.fillStyle = fillColor;
      ctx.fill();
    }
    if (strokeColor) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // Draw text with shadow (pixel-art style)
  drawText(text, x, y, options = {}) {
    const {
      size = 16,
      color = '#FFF',
      align = 'left',
      shadow = true,
      shadowColor = '#000',
      font = null,
      maxWidth = null,
    } = options;
    const ctx = this.ctx;
    ctx.font = `${size}px ${font || "'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif"}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    if (shadow) {
      ctx.fillStyle = shadowColor;
      ctx.fillText(text, x + 1, y + 1, maxWidth || undefined);
    }
    ctx.fillStyle = color;
    ctx.fillText(text, x, y, maxWidth || undefined);
  }

  // Draw a simple sprite (colored rectangle with features)
  drawSprite(x, y, w, h, spriteData) {
    const ctx = this.ctx;
    // Body
    ctx.fillStyle = spriteData.bodyColor || '#888';
    ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
    // Head
    if (spriteData.headColor) {
      ctx.fillStyle = spriteData.headColor;
      ctx.fillRect(Math.floor(x + w * 0.2), Math.floor(y), Math.floor(w * 0.6), Math.floor(h * 0.35));
    }
    // Season aura
    if (spriteData.season) {
      const color = SEASON_COLORS[spriteData.season].primary;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(Date.now() / 500);
      ctx.strokeRect(Math.floor(x) - 2, Math.floor(y) - 2, w + 4, h + 4);
      ctx.globalAlpha = 1;
    }
  }

  // Seasonal particle system
  addParticle(season, x, y) {
    const colors = SEASON_COLORS[season];
    this.particles.push({
      x, y,
      vx: (Math.random() - 0.5) * (season === SEASON.AUTUMN ? 2 : 0.5),
      vy: Math.random() * -0.5 - 0.3,
      life: 60 + Math.random() * 60,
      maxLife: 120,
      size: 2 + Math.random() * 3,
      color: Math.random() > 0.5 ? colors.primary : colors.accent,
      season,
    });
  }

  updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;

      // Season-specific behavior
      if (p.season === SEASON.SPRING) {
        p.vx += Math.sin(Date.now() / 1000 + p.x) * 0.02;
        p.vy *= 0.99;
      } else if (p.season === SEASON.SUMMER) {
        p.vy -= 0.01; // rise like heat
      } else if (p.season === SEASON.AUTUMN) {
        p.vy += 0.02; // fall like leaves
        p.vx += Math.sin(Date.now() / 800 + p.y) * 0.03;
      } else if (p.season === SEASON.WINTER) {
        p.vx += Math.sin(Date.now() / 1200 + p.x) * 0.01;
        p.vy += 0.01; // fall like snow
      }

      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  drawParticles() {
    for (const p of this.particles) {
      const alpha = Math.min(1, p.life / 30);
      this.ctx.globalAlpha = alpha;
      this.ctx.fillStyle = p.color;
      if (p.season === SEASON.SPRING) {
        // Cherry blossom petal shape
        this.ctx.beginPath();
        this.ctx.ellipse(p.x, p.y, p.size, p.size * 0.6, Date.now() / 500 + p.x, 0, Math.PI * 2);
        this.ctx.fill();
      } else if (p.season === SEASON.AUTUMN) {
        // Leaf shape
        this.ctx.fillRect(p.x, p.y, p.size * 1.2, p.size * 0.8);
      } else {
        // Circle (snow, heat shimmer)
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
    this.ctx.globalAlpha = 1;
  }

  // HP / MP / Season gauge bar
  drawBar(x, y, w, h, value, max, fgColor, bgColor = '#333') {
    this.drawRect(x, y, w, h, bgColor);
    const fillW = Math.max(0, (value / max) * w);
    this.drawRect(x, y, fillW, h, fgColor);
    this.drawRectOutline(x, y, w, h, '#555');
  }

  // Season gauge (circular or linear)
  drawSeasonGauge(x, y, currentSeason) {
    const size = 28;
    const gap = 4;
    for (let i = 0; i < 4; i++) {
      const s = SEASON_ORDER[i];
      const gx = x + i * (size + gap);
      const isCurrent = s === currentSeason;
      const color = SEASON_COLORS[s].primary;
      this.drawRect(gx, y, size, size, isCurrent ? color : '#444');
      if (isCurrent) {
        this.drawRectOutline(gx - 1, y - 1, size + 2, size + 2, '#FFF', 2);
      }
      this.drawText(SEASON_NAMES[s], gx + size / 2, y + 6, {
        size: 12, align: 'center', color: isCurrent ? '#FFF' : '#888',
      });
    }
  }

  // Fade effect
  startFade(targetAlpha, speed = 0.02) {
    this.fadeTarget = targetAlpha;
    this.fadeSpeed = speed;
  }

  updateFade() {
    if (this.fadeAlpha < this.fadeTarget) {
      this.fadeAlpha = Math.min(this.fadeTarget, this.fadeAlpha + this.fadeSpeed);
    } else if (this.fadeAlpha > this.fadeTarget) {
      this.fadeAlpha = Math.max(this.fadeTarget, this.fadeAlpha - this.fadeSpeed);
    }
    if (this.fadeAlpha > 0) {
      this.drawRect(0, 0, GAME_WIDTH, GAME_HEIGHT, '#000', this.fadeAlpha);
    }
  }

  isFading() {
    return Math.abs(this.fadeAlpha - this.fadeTarget) > 0.01;
  }

  // Screen shake
  applyShake() {
    if (this.screenShake > 0) {
      const dx = (Math.random() - 0.5) * this.screenShake;
      const dy = (Math.random() - 0.5) * this.screenShake;
      this.ctx.translate(dx, dy);
      this.screenShake *= 0.9;
      if (this.screenShake < 0.5) this.screenShake = 0;
    }
  }

  resetTransform() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}
