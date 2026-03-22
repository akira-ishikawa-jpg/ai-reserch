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

  // Draw gradient rectangle (top to bottom)
  drawGradientRect(x, y, w, h, colorTop, colorBottom) {
    const ctx = this.ctx;
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, colorTop);
    grad.addColorStop(1, colorBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
  }

  // Draw glow effect (radial gradient)
  drawGlow(x, y, radius, color, alpha = 0.5) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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
      outline = false,
      outlineColor = '#000',
      outlineWidth = 3,
    } = options;
    const ctx = this.ctx;
    ctx.font = `${size}px ${font || "'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif"}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    if (outline) {
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = outlineWidth;
      ctx.lineJoin = 'round';
      ctx.strokeText(text, x, y, maxWidth || undefined);
    }
    if (shadow && !outline) {
      ctx.fillStyle = shadowColor;
      ctx.fillText(text, x + 1, y + 1, maxWidth || undefined);
    }
    ctx.fillStyle = color;
    ctx.fillText(text, x, y, maxWidth || undefined);
  }

  // Draw a simple sprite (colored rectangle with features) - kept for backward compat
  drawSprite(x, y, w, h, spriteData) {
    const ctx = this.ctx;
    const cx = Math.floor(x);
    const cy = Math.floor(y);

    // Shadow under character
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(cx + w / 2, cy + h, w * 0.4, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body (trapezoid)
    const bodyColor = spriteData.bodyColor || '#888';
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.moveTo(cx + w * 0.15, cy + h * 0.35);
    ctx.lineTo(cx + w * 0.85, cy + h * 0.35);
    ctx.lineTo(cx + w * 0.9, cy + h * 0.75);
    ctx.lineTo(cx + w * 0.1, cy + h * 0.75);
    ctx.closePath();
    ctx.fill();

    // Legs (two small rectangles)
    ctx.fillStyle = bodyColor;
    const legW = w * 0.18;
    const legH = h * 0.25;
    const frame = Math.floor(Date.now() / 200) % 2;
    const legOffsetL = 0;
    const legOffsetR = 0;
    ctx.fillRect(cx + w * 0.25 + legOffsetL, cy + h * 0.72, legW, legH);
    ctx.fillRect(cx + w * 0.57 + legOffsetR, cy + h * 0.72, legW, legH);

    // Head (circle)
    if (spriteData.headColor) {
      ctx.fillStyle = spriteData.headColor;
      ctx.beginPath();
      ctx.arc(cx + w / 2, cy + h * 0.22, w * 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Eyes (two white dots)
      ctx.fillStyle = '#FFF';
      ctx.fillRect(cx + w * 0.33, cy + h * 0.18, 2, 2);
      ctx.fillRect(cx + w * 0.55, cy + h * 0.18, 2, 2);
      // Pupils
      ctx.fillStyle = '#222';
      ctx.fillRect(cx + w * 0.35, cy + h * 0.19, 1, 1);
      ctx.fillRect(cx + w * 0.57, cy + h * 0.19, 1, 1);
    }

    // Season aura with glow effect
    if (spriteData.season) {
      const color = SEASON_COLORS[spriteData.season].primary;
      const pulse = 0.4 + 0.3 * Math.sin(Date.now() / 500);
      this.drawGlow(cx + w / 2, cy + h / 2, w * 0.9, color, pulse);
    }
  }

  // ==========================================
  // Pixel Character Drawing System
  // ==========================================

  drawPixelChar(x, y, scale, type, options = {}) {
    const { direction = 'down', frame = 0, season = null } = options;
    const ctx = this.ctx;
    const pixels = PIXEL_CHARS[type];
    if (!pixels) return;

    const pattern = pixels.patterns ? pixels.patterns[direction] || pixels.patterns['down'] : pixels.default;
    const frameData = pattern[frame % pattern.length];
    const palette = pixels.palette;

    const px = Math.floor(x);
    const py = Math.floor(y);

    // Draw shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(px + (frameData[0].length * scale) / 2, py + frameData.length * scale, frameData[0].length * scale * 0.35, 2 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Draw each pixel
    for (let row = 0; row < frameData.length; row++) {
      const line = frameData[row];
      for (let col = 0; col < line.length; col++) {
        const ch = line[col];
        if (ch === '.' || ch === ' ') continue;
        const color = palette[ch];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(px + col * scale, py + row * scale, scale, scale);
      }
    }

    // Season glow overlay
    if (season) {
      const glowColor = SEASON_COLORS[season].primary;
      const pulse = 0.2 + 0.15 * Math.sin(Date.now() / 500);
      this.drawGlow(
        px + (frameData[0].length * scale) / 2,
        py + (frameData.length * scale) / 2,
        frameData[0].length * scale * 0.7,
        glowColor,
        pulse
      );
    }
  }

  // Seasonal particle system
  addParticle(season, x, y) {
    if (this.particles.length >= 100) return; // cap at 100
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
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.1,
      flickerPhase: Math.random() * Math.PI * 2,
    });
  }

  updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      p.rotation += p.rotSpeed;

      // Season-specific behavior
      if (p.season === SEASON.SPRING) {
        p.vx += Math.sin(Date.now() / 1000 + p.x) * 0.02;
        p.vy += 0.015; // drift down gently
        p.vy *= 0.99;
      } else if (p.season === SEASON.SUMMER) {
        p.vy -= 0.01; // rise like heat
      } else if (p.season === SEASON.AUTUMN) {
        p.vy += 0.02; // fall like leaves
        p.vx += Math.sin(Date.now() / 800 + p.y) * 0.04;
      } else if (p.season === SEASON.WINTER) {
        p.vx += Math.sin(Date.now() / 1200 + p.x) * 0.01;
        p.vy += 0.008; // fall like snow, gentle
        p.vy = Math.min(p.vy, 0.5); // max fall speed
      }

      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  drawParticles() {
    const ctx = this.ctx;
    for (const p of this.particles) {
      const alpha = Math.min(1, p.life / 30);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;

      if (p.season === SEASON.SPRING) {
        // Cherry blossom petal — rotated ellipse with 5-petal hint
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.beginPath();
        // Draw a petal shape
        ctx.moveTo(0, -p.size * 0.5);
        ctx.quadraticCurveTo(p.size * 0.6, -p.size * 0.3, p.size * 0.3, p.size * 0.4);
        ctx.quadraticCurveTo(0, p.size * 0.2, -p.size * 0.3, p.size * 0.4);
        ctx.quadraticCurveTo(-p.size * 0.6, -p.size * 0.3, 0, -p.size * 0.5);
        ctx.fill();
        ctx.restore();
      } else if (p.season === SEASON.SUMMER) {
        // Firefly — flickering glowing dot
        const flicker = 0.4 + 0.6 * Math.abs(Math.sin(Date.now() / 150 + p.flickerPhase));
        ctx.globalAlpha = alpha * flicker;
        // Outer glow
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
        grad.addColorStop(0, p.color);
        grad.addColorStop(0.4, p.color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
        ctx.fill();
        // Core bright point
        ctx.fillStyle = '#FFFFCC';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.3, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.season === SEASON.AUTUMN) {
        // Leaf shape — swaying maple-like
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.beginPath();
        // Simple leaf shape
        ctx.moveTo(0, -p.size * 0.6);
        ctx.lineTo(p.size * 0.5, 0);
        ctx.lineTo(p.size * 0.2, p.size * 0.2);
        ctx.lineTo(0, p.size * 0.6);
        ctx.lineTo(-p.size * 0.2, p.size * 0.2);
        ctx.lineTo(-p.size * 0.5, 0);
        ctx.closePath();
        ctx.fill();
        // Leaf vein
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, -p.size * 0.5);
        ctx.lineTo(0, p.size * 0.5);
        ctx.stroke();
        ctx.restore();
      } else if (p.season === SEASON.WINTER) {
        // Snowflake — soft, fluffy with glow
        ctx.globalAlpha = alpha * 0.8;
        // Outer soft glow
        const snowGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        snowGrad.addColorStop(0, '#FFFFFF');
        snowGrad.addColorStop(0.5, 'rgba(200,220,255,0.5)');
        snowGrad.addColorStop(1, 'rgba(200,220,255,0)');
        ctx.fillStyle = snowGrad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        // Core
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
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

// ==========================================
// Pixel Character Data
// ==========================================
const PIXEL_CHARS = {
  hero: {
    palette: {
      'B': '#3355AA', // hair (blue)
      'b': '#224488', // hair dark
      'F': '#FFD699', // skin
      'f': '#EEBB77', // skin shadow
      'E': '#FFFFFF', // eye white
      'e': '#222222', // pupil
      'A': '#4488CC', // armor
      'a': '#336699', // armor dark
      'C': '#CC8844', // cape / accent
      'L': '#554433', // legs / boots
    },
    patterns: {
      down: [
        [
          '..bBBb..',
          '.BBBBBb.',
          '.FFEEFF.',
          '.FFFFFF.',
          '..FFFF..',
          '.aAAAAa.',
          '.AAAAAA.',
          '..A..A..',
          '..L..L..',
        ],
        [
          '..bBBb..',
          '.BBBBBb.',
          '.FFEEFF.',
          '.FFFFFF.',
          '..FFFF..',
          '.aAAAAa.',
          '.AAAAAA.',
          '.A....A.',
          '.L....L.',
        ],
      ],
      up: [
        [
          '..bBBb..',
          '.BBBBBb.',
          '.BBBBBB.',
          '..BBBB..',
          '..FFFF..',
          '.aAAAAa.',
          '.AAAAAA.',
          '..A..A..',
          '..L..L..',
        ],
        [
          '..bBBb..',
          '.BBBBBb.',
          '.BBBBBB.',
          '..BBBB..',
          '..FFFF..',
          '.aAAAAa.',
          '.AAAAAA.',
          '.A....A.',
          '.L....L.',
        ],
      ],
      left: [
        [
          '..bBBb..',
          '.BBBBBb.',
          '.eEFFF..',
          '.FFFFF..',
          '..FFFF..',
          '.aAAAA..',
          '.AAAAA..',
          '..A.A...',
          '..L.L...',
        ],
        [
          '..bBBb..',
          '.BBBBBb.',
          '.eEFFF..',
          '.FFFFF..',
          '..FFFF..',
          '.aAAAA..',
          '.AAAAA..',
          '.A...A..',
          '.L...L..',
        ],
      ],
      right: [
        [
          '..bBBb..',
          '.bBBBBB.',
          '..FFFEe.',
          '..FFFFF.',
          '..FFFF..',
          '..AAAAa.',
          '..AAAAA.',
          '...A.A..',
          '...L.L..',
        ],
        [
          '..bBBb..',
          '.bBBBBB.',
          '..FFFEe.',
          '..FFFFF.',
          '..FFFF..',
          '..AAAAa.',
          '..AAAAA.',
          '..A...A.',
          '..L...L.',
        ],
      ],
    },
  },

  healer: {
    palette: {
      'H': '#88CC88', // hair (green)
      'h': '#669966', // hair dark
      'F': '#FFE0BD', // skin
      'E': '#FFFFFF', // eye white
      'e': '#336633', // pupil (green)
      'R': '#EEEEEE', // robe white
      'r': '#CCCCCC', // robe shadow
      'G': '#66BB66', // green accent
      'L': '#998877', // boots
    },
    patterns: {
      down: [
        [
          '..hHHh..',
          '.HHHHHH.',
          '.FFEEFF.',
          '.FFFFFF.',
          '..FFFF..',
          '.rRGGRr.',
          '.RRGGRR.',
          '..RRRR..',
          '..L..L..',
        ],
        [
          '..hHHh..',
          '.HHHHHH.',
          '.FFEEFF.',
          '.FFFFFF.',
          '..FFFF..',
          '.rRGGRr.',
          '.RRGGRR.',
          '.RR..RR.',
          '.L....L.',
        ],
      ],
    },
  },

  npc_brown: {
    palette: {
      'H': '#8B4513', // hair
      'h': '#6B3310', // hair dark
      'F': '#DEB887', // skin
      'E': '#FFFFFF', // eye
      'e': '#333333', // pupil
      'C': '#8B4513', // clothes
      'c': '#6B3310', // clothes dark
      'L': '#554433', // legs
    },
    patterns: {
      down: [
        [
          '..hHHh..',
          '.HHHHHH.',
          '.FFEEFF.',
          '.FFFFFF.',
          '..FFFF..',
          '.cCCCCc.',
          '.CCCCCC.',
          '..C..C..',
          '..L..L..',
        ],
      ],
    },
  },

  npc_green: {
    palette: {
      'H': '#2E8B57', // hair
      'h': '#1E6B37', // hair dark
      'F': '#98FB98', // skin (pale green)
      'E': '#FFFFFF',
      'e': '#333333',
      'C': '#2E8B57',
      'c': '#1E6B37',
      'L': '#445544',
    },
    patterns: {
      down: [
        [
          '..hHHh..',
          '.HHHHHH.',
          '.FFEEFF.',
          '.FFFFFF.',
          '..FFFF..',
          '.cCCCCc.',
          '.CCCCCC.',
          '..C..C..',
          '..L..L..',
        ],
      ],
    },
  },

  npc_innkeeper: {
    palette: {
      'H': '#654321', // hair
      'h': '#453111', // hair dark
      'F': '#F5DEB3', // skin
      'E': '#FFFFFF',
      'e': '#333333',
      'C': '#654321',
      'c': '#453111',
      'P': '#FFFFFF', // apron
      'L': '#443322',
    },
    patterns: {
      down: [
        [
          '..hHHh..',
          '.HHHHHH.',
          '.FFEEFF.',
          '.FFFFFF.',
          '..FFFF..',
          '.cCPPCc.',
          '.CCPPCC.',
          '..C..C..',
          '..L..L..',
        ],
      ],
    },
  },

  // --- Enemy types ---
  fairy: {
    palette: {
      'W': '#EEDDFF', // wing
      'w': '#CCAAEE', // wing dark
      'B': '#DDBBFF', // body
      'b': '#BB99DD', // body shadow
      'E': '#FFFFFF',
      'e': '#6633AA',
      'G': '#FFDD44', // glow
      'S': '#FFAACC', // sparkle
    },
    patterns: {
      down: [
        [
          'W..BB..W',
          'WW.BB.WW',
          'wWBBBBWw',
          '.WBEEBW.',
          '..BBBB..',
          '.wBBBBw.',
          '..bBBb..',
          '...bb...',
        ],
        [
          'w..BB..w',
          'wW.BB.Ww',
          '.WBBBBW.',
          'WWBEEBWW',
          '..BBBB..',
          '.wBBBBw.',
          '..bBBb..',
          '...bb...',
        ],
      ],
    },
  },

  bee: {
    palette: {
      'Y': '#FFD700', // yellow stripe
      'K': '#222222', // black stripe
      'W': '#CCDDEE', // wing (translucent)
      'w': '#AABBCC', // wing shadow
      'E': '#FF0000', // eye
      'S': '#FFFFFF', // stinger highlight
    },
    patterns: {
      down: [
        [
          'W..KK..W',
          'WW.YY.WW',
          '.WKKKKW.',
          '.WYYYYW.',
          '..KKKK..',
          '..YYYY..',
          '..KKKK..',
          '...SS...',
        ],
        [
          'w..KK..w',
          'wW.YY.Ww',
          '.WKKKKW.',
          '.WYYYYW.',
          '..KKKK..',
          '..YYYY..',
          '..KKKK..',
          '...SS...',
        ],
      ],
    },
  },

  fox: {
    palette: {
      'O': '#FF8844', // orange fur
      'o': '#CC6622', // dark fur
      'W': '#FFFFFF', // white
      'E': '#FFDD00', // eyes (golden)
      'e': '#222222', // pupils
      'N': '#222222', // nose
      'T': '#FF6622', // tail
      't': '#CC4400', // tail dark
    },
    patterns: {
      down: [
        [
          't......t',
          'OO.OO.OO',
          'OOOOOOOO',
          'OOeWWeOO',
          '.OONNOO.',
          '.OWWWWO.',
          '..OOOO..',
          '.OO..OO.',
          '.oo..oo.',
        ],
      ],
    },
  },

  boss_flower: {
    palette: {
      'P': '#FFB7C5', // petal pink
      'p': '#FF88AA', // petal dark
      'G': '#228B22', // green stem
      'g': '#115511', // green dark
      'Y': '#FFD700', // center (yellow)
      'y': '#CCAA00', // center dark
      'E': '#FF0000', // evil eyes
      'V': '#664488', // vine/thorn
      'T': '#884466', // thorn
    },
    patterns: {
      down: [
        [
          '..pPPPp....',
          '.PPpPpPP...',
          'PPPPYPPPP..',
          'pPPYYYPPp..',
          '.PPEYEPP...',
          '..PPPPP.V..',
          '...GGG..V..',
          '..gGGGg.V..',
          '.gGGGGGgV..',
          '..gGGGgVV..',
          '...GGG.....',
          'VVVgggVVVVV',
        ],
        [
          '..pPPPp....',
          '.PpPPpPP...',
          'PPPPYPPPP..',
          'pPPYYYPPp..',
          '.PPEYEPP...',
          '..PPPPP..V.',
          '...GGG...V.',
          '..gGGGg..V.',
          '.gGGGGGg.V.',
          '..gGGGg.VV.',
          '...GGG.....',
          'VVVgggVVVVV',
        ],
      ],
    },
  },
};

// Deterministic random for tile decoration (integer-only, fast)
function seededRandom(x, y, seed = 0) {
  let h = seed + x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return (h & 0x7fffffff) / 0x7fffffff;
}
