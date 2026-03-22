// ====================================
// title.js — タイトル画面
// 四季廻りの職人
// 読み込み順: constants.js → scene.js → title.js
// ====================================

class TitleScene extends Scene {
  constructor(game) {
    super();
    this.game = game;

    // メニュー
    this.menuItems = [
      { label: 'はじめから', enabled: true },
      { label: 'つづきから', enabled: false },
    ];
    this.selectedIndex = 0;

    // 演出用タイマー
    this.elapsed = 0;
    this.titleFadeIn = 0;        // タイトルのフェードイン進捗 0→1
    this.subFadeIn = 0;          // サブタイトル
    this.catchFadeIn = 0;        // キャッチコピー
    this.menuFadeIn = 0;         // メニュー
    this.seasonTimer = 0;        // 四季カラー循環タイマー
    this.particleTimer = 0;      // パーティクル生成間隔
    this.isStarting = false;     // 開始処理中フラグ
    this.seasonArcAngle = 0;     // 四季の円 回転角度
  }

  enter(data) {
    this.selectedIndex = 0;
    this.elapsed = 0;
    this.titleFadeIn = 0;
    this.subFadeIn = 0;
    this.catchFadeIn = 0;
    this.menuFadeIn = 0;
    this.seasonTimer = 0;
    this.particleTimer = 0;
    this.isStarting = false;
    this.seasonArcAngle = 0;
    this.game.renderer.fadeAlpha = 0;
    this.game.renderer.fadeTarget = 0;
  }

  exit() {}

  // -----------------------------------------------
  // 現在の演出用季節を取得（10秒周期で変化）
  // -----------------------------------------------
  _getCurrentDisplaySeason() {
    const cycle = 10; // 秒
    const totalCycle = cycle * 4;
    const t = this.seasonTimer % totalCycle;
    const idx = Math.floor(t / cycle);
    return SEASON_ORDER[idx];
  }

  // -----------------------------------------------
  // 2色を線形補間
  // -----------------------------------------------
  _lerpColor(c1, c2, t) {
    const parse = (c) => {
      if (c.startsWith('#')) {
        const hex = c.slice(1);
        return [
          parseInt(hex.substring(0, 2), 16),
          parseInt(hex.substring(2, 4), 16),
          parseInt(hex.substring(4, 6), 16),
        ];
      }
      return [0, 0, 0];
    };
    const a = parse(c1);
    const b = parse(c2);
    const r = Math.round(a[0] + (b[0] - a[0]) * t);
    const g = Math.round(a[1] + (b[1] - a[1]) * t);
    const bl = Math.round(a[2] + (b[2] - a[2]) * t);
    return `rgb(${r},${g},${bl})`;
  }

  // -----------------------------------------------
  // Update
  // -----------------------------------------------
  update(dt) {
    this.elapsed += dt;
    this.seasonTimer += dt;
    this.particleTimer += dt;
    this.seasonArcAngle += dt * 0.3; // Slow rotation

    // フェードイン進捗（段階的に表示）
    const fadeSpeed = 1.5; // 秒あたりの進捗
    if (this.elapsed > 0.3) {
      this.titleFadeIn = Math.min(1, this.titleFadeIn + dt * fadeSpeed);
    }
    if (this.elapsed > 0.8) {
      this.subFadeIn = Math.min(1, this.subFadeIn + dt * fadeSpeed);
    }
    if (this.elapsed > 1.3) {
      this.catchFadeIn = Math.min(1, this.catchFadeIn + dt * fadeSpeed);
    }
    if (this.elapsed > 1.8) {
      this.menuFadeIn = Math.min(1, this.menuFadeIn + dt * fadeSpeed);
    }

    // 開始処理中はフェード待ち
    if (this.isStarting) {
      if (!this.game.renderer.isFading()) {
        // フェード完了 → プロローグへ
        this.game.renderer.fadeAlpha = 1;
        this.game.scenes.switch(SCENES.DIALOGUE, { dialogueId: 'prologue' });
      }
      return;
    }

    // パーティクル生成（季節に応じたパーティクルを常時舞わせる）
    if (this.particleTimer > 0.06) {
      this.particleTimer = 0;
      const season = this._getCurrentDisplaySeason();
      const x = Math.random() * GAME_WIDTH;
      let y;
      if (season === SEASON.AUTUMN || season === SEASON.WINTER) {
        y = -10; // 上から降る
      } else if (season === SEASON.SUMMER) {
        y = GAME_HEIGHT + 10; // 下から上がる
      } else {
        y = Math.random() * GAME_HEIGHT; // 全域
      }
      this.game.renderer.addParticle(season, x, y);
    }

    // メニュー操作
    if (this.menuFadeIn >= 1) {
      if (this.game.input.isJustPressed('ArrowUp') || this.game.input.isJustPressed('w')) {
        this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      }
      if (this.game.input.isJustPressed('ArrowDown') || this.game.input.isJustPressed('s')) {
        this.selectedIndex = Math.min(this.menuItems.length - 1, this.selectedIndex + 1);
      }

      // 決定
      const enterPressed = this.game.input.isJustPressed('Enter') || this.game.input.isJustPressed(' ');
      const tap = this.game.input.consumeTap();

      let confirmed = enterPressed;

      // タップによるメニュー選択
      if (tap) {
        const menuBaseY = 370;
        for (let i = 0; i < this.menuItems.length; i++) {
          const itemY = menuBaseY + i * 50;
          if (tap.x > 330 && tap.x < 630 && tap.y > itemY - 5 && tap.y < itemY + 40) {
            this.selectedIndex = i;
            confirmed = true;
            break;
          }
        }
      }

      if (confirmed && this.menuItems[this.selectedIndex].enabled) {
        this._startGame();
      }
    }
  }

  // -----------------------------------------------
  // ゲーム開始
  // -----------------------------------------------
  _startGame() {
    this.isStarting = true;
    this.game.renderer.startFade(1, 0.03); // フェードアウト
  }

  // -----------------------------------------------
  // Draw
  // -----------------------------------------------
  draw(renderer) {
    const ctx = renderer.ctx;
    const season = this._getCurrentDisplaySeason();
    const cycle = 10;
    const totalCycle = cycle * 4;
    const t = this.seasonTimer % totalCycle;
    const phaseT = (t % cycle) / cycle; // 0→1 within current season
    const nextSeason = getNextSeason(season);

    // === 背景グラデーション ===
    const bgColorTop = this._lerpColor(
      SEASON_COLORS[season].bg,
      SEASON_COLORS[nextSeason].bg,
      phaseT
    );
    const bgColorBottom = this._lerpColor(
      SEASON_COLORS[season].secondary,
      SEASON_COLORS[nextSeason].secondary,
      phaseT
    );
    renderer.drawGradientRect(0, 0, GAME_WIDTH, GAME_HEIGHT, bgColorTop, bgColorBottom);

    // === パーティクル（背景として描画） ===
    renderer.updateParticles();
    renderer.drawParticles();

    // === 四季の円（中央装飾）===
    if (this.subFadeIn > 0) {
      this._drawSeasonCircle(ctx, renderer, GAME_WIDTH / 2, 230, this.subFadeIn);
    }

    // === 装飾ライン（上下）with glow ===
    const accentColor = this._lerpColor(
      SEASON_COLORS[season].primary,
      SEASON_COLORS[nextSeason].primary,
      phaseT
    );
    renderer.drawRect(0, 0, GAME_WIDTH, 3, accentColor, 0.7);
    renderer.drawRect(0, GAME_HEIGHT - 3, GAME_WIDTH, 3, accentColor, 0.7);
    // Glow on lines
    renderer.drawGlow(GAME_WIDTH / 2, 0, GAME_WIDTH * 0.4, accentColor, 0.15);
    renderer.drawGlow(GAME_WIDTH / 2, GAME_HEIGHT, GAME_WIDTH * 0.4, accentColor, 0.15);

    // === タイトルロゴ ===
    if (this.titleFadeIn > 0) {
      const titleY = 130 + Math.sin(this.elapsed * 0.8) * 3; // Gentle float
      // Outline (stroke)
      renderer.drawText('四季廻りの職人', GAME_WIDTH / 2, titleY, {
        size: 48,
        color: `rgba(50, 30, 20, ${this.titleFadeIn})`,
        align: 'center',
        shadow: false,
        outline: true,
        outlineColor: `rgba(255, 255, 255, ${this.titleFadeIn * 0.6})`,
        outlineWidth: 4,
      });
    }

    // === サブタイトル ===
    if (this.subFadeIn > 0) {
      renderer.drawText('Shiki-Meguri no Shokunin', GAME_WIDTH / 2, 195, {
        size: 16,
        color: `rgba(100, 70, 50, ${this.subFadeIn})`,
        align: 'center',
        shadow: false,
      });
    }

    // === キャッチコピー ===
    if (this.catchFadeIn > 0) {
      const catchY = 290 + Math.sin(this.elapsed * 0.6 + 1) * 2;
      renderer.drawText('「技は、魂が覚えている。」', GAME_WIDTH / 2, catchY, {
        size: 20,
        color: `rgba(80, 50, 30, ${this.catchFadeIn})`,
        align: 'center',
        outline: true,
        outlineColor: `rgba(255, 255, 255, ${this.catchFadeIn * 0.3})`,
        outlineWidth: 2,
      });
    }

    // === メニュー ===
    if (this.menuFadeIn > 0) {
      const menuBaseY = 370;
      for (let i = 0; i < this.menuItems.length; i++) {
        const item = this.menuItems[i];
        const itemY = menuBaseY + i * 50;
        const isSelected = i === this.selectedIndex;

        // 選択中の背景
        if (isSelected && item.enabled) {
          renderer.drawRoundedRect(
            340, itemY - 5, 280, 40, 8,
            `rgba(0, 0, 0, ${0.18 * this.menuFadeIn})`,
            `rgba(255, 255, 255, ${0.1 * this.menuFadeIn})`
          );
          // Glow behind selected item
          renderer.drawGlow(GAME_WIDTH / 2, itemY + 15, 100, accentColor, 0.1 * this.menuFadeIn);
          // 選択カーソル ▶ with pulse
          const cursorPulse = 0.7 + 0.3 * Math.sin(this.elapsed * 4);
          renderer.drawText('▶', 350, itemY + 3, {
            size: 20,
            color: `rgba(80, 50, 30, ${this.menuFadeIn * cursorPulse})`,
            align: 'left',
            shadow: false,
          });
        }

        // メニューテキスト
        let textColor;
        if (!item.enabled) {
          textColor = `rgba(160, 160, 160, ${this.menuFadeIn * 0.5})`;
        } else if (isSelected) {
          textColor = `rgba(50, 30, 20, ${this.menuFadeIn})`;
        } else {
          textColor = `rgba(80, 60, 40, ${this.menuFadeIn * 0.7})`;
        }

        renderer.drawText(item.label, GAME_WIDTH / 2, itemY + 3, {
          size: 22,
          color: textColor,
          align: 'center',
          shadow: false,
        });
      }
    }

    // === 四季アイコン（下部）===
    if (this.menuFadeIn > 0) {
      const iconSize = 14;
      const iconGap = 22;
      const totalW = 4 * iconSize + 3 * iconGap;
      const startX = (GAME_WIDTH - totalW) / 2;
      const iconY = GAME_HEIGHT - 42;
      for (let i = 0; i < 4; i++) {
        const s = SEASON_ORDER[i];
        const ix = startX + i * (iconSize + iconGap);
        const isCurrent = s === season;
        const alpha = isCurrent ? this.menuFadeIn : this.menuFadeIn * 0.3;

        // Draw as circle instead of square
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = SEASON_COLORS[s].primary;
        ctx.beginPath();
        ctx.arc(ix + iconSize / 2, iconY + iconSize / 2, iconSize / 2, 0, Math.PI * 2);
        ctx.fill();

        if (isCurrent) {
          // Glow around current season icon
          renderer.drawGlow(ix + iconSize / 2, iconY + iconSize / 2, iconSize, SEASON_COLORS[s].primary, 0.4);
          ctx.globalAlpha = this.menuFadeIn;
          ctx.strokeStyle = '#FFF';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(ix + iconSize / 2, iconY + iconSize / 2, iconSize / 2 + 2, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }

  // -----------------------------------------------
  // 四季の円（4色の円弧が回転するアニメーション）
  // -----------------------------------------------
  _drawSeasonCircle(ctx, renderer, cx, cy, alpha) {
    const radius = 50;
    ctx.save();
    ctx.globalAlpha = alpha * 0.25;
    ctx.translate(cx, cy);
    ctx.rotate(this.seasonArcAngle);

    for (let i = 0; i < 4; i++) {
      const s = SEASON_ORDER[i];
      const startAngle = (Math.PI / 2) * i;
      const endAngle = startAngle + Math.PI / 2;

      // Draw arc
      ctx.strokeStyle = SEASON_COLORS[s].primary;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, radius, startAngle, endAngle);
      ctx.stroke();

      // Inner glow on arc
      ctx.strokeStyle = SEASON_COLORS[s].accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, radius - 4, startAngle + 0.1, endAngle - 0.1);
      ctx.stroke();
    }

    // Center dot
    ctx.fillStyle = `rgba(255,255,255,${alpha * 0.4})`;
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
