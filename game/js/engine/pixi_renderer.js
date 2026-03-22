// PixiRenderer - HD-2D風ポストプロセスエフェクト（PixiJS v7ベース）
// 方針B: エフェクトのみ方式
// PixiJSのcanvasにはエフェクトオーバーレイのみ描画（ソーステクスチャのコピーはしない）
// 既存Canvas 2Dの上に透明背景のPixiJSキャンバスを重ね、
// ビネット・季節ティント・ソフトグローのみを描画する

class PixiRenderer {
  constructor() {
    this.enabled = false;
    this.app = null;
    this.effectContainer = null;

    // エフェクト用グラフィックス
    this._vignetteGraphics = null;
    this._seasonTintGraphics = null;
    this._edgeGlowGraphics = null;

    // DOF（被写界深度）用
    this._dofTexture = null;
    this._dofTopSprite = null;
    this._dofBottomSprite = null;
    this._dofTopMaskSprite = null;
    this._dofBottomMaskSprite = null;
    this._dofContainer = null;

    // カラーグレーディング用
    this._colorGradingFilter = null;
    this.colorGradingEnabled = true;

    // エフェクトON/OFFフラグ
    this.vignetteEnabled = true;
    this.seasonTintEnabled = true;
    this.edgeGlowEnabled = true;
    this.dofEnabled = true;

    // 季節ティントカラー設定（alpha控えめ）
    this.seasonTints = {
      spring: { color: 0xFFB4C8, alpha: 0.05 },
      summer: { color: 0xFFC864, alpha: 0.04 },
      autumn: { color: 0xC86432, alpha: 0.05 },
      winter: { color: 0x6496FF, alpha: 0.04 },
    };

    // 季節ごとのエッジグロー色
    this.seasonGlow = {
      spring: { color: 0xFFB7C5, alpha: 0.08 },
      summer: { color: 0xFFD700, alpha: 0.06 },
      autumn: { color: 0xDC143C, alpha: 0.07 },
      winter: { color: 0x4169E1, alpha: 0.06 },
    };

    // 内部状態
    this._currentSeason = null;
  }

  /**
   * 初期化 — PixiJS Applicationを作成し、既存Canvasの上にオーバーレイ
   * @param {HTMLCanvasElement} gameCanvas 既存のCanvas 2D
   * @returns {boolean} 初期化成功ならtrue
   */
  init(gameCanvas) {
    // PixiJSが読み込まれているか確認
    if (typeof PIXI === 'undefined') {
      console.warn('[PixiRenderer] PixiJS not loaded. Falling back to Canvas 2D only.');
      return false;
    }

    // WebGLサポートチェック
    if (!this._checkWebGLSupport()) {
      console.warn('[PixiRenderer] WebGL not supported. Falling back to Canvas 2D only.');
      return false;
    }

    try {
      this._gameCanvas = gameCanvas;

      // PixiJS Application作成（背景は完全透明）
      this.app = new PIXI.Application({
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        backgroundAlpha: 0,
        antialias: false,
        resolution: 1,
        autoDensity: false,
      });

      // PixiJSのCanvas（view）を既存Canvasの上に重ねる
      const pixiCanvas = this.app.view;
      pixiCanvas.id = 'pixi-canvas';
      pixiCanvas.style.position = 'absolute';
      pixiCanvas.style.top = '0';
      pixiCanvas.style.left = '0';
      pixiCanvas.style.width = '100%';
      pixiCanvas.style.height = '100%';
      pixiCanvas.style.pointerEvents = 'none';
      pixiCanvas.style.imageRendering = 'pixelated';

      const container = gameCanvas.parentElement;
      container.appendChild(pixiCanvas);

      // エフェクト用コンテナ
      this.effectContainer = new PIXI.Container();
      this.app.stage.addChild(this.effectContainer);

      // エフェクトレイヤーを構築（ソーステクスチャは使わない）
      this._createVignetteLayer();
      this._createSeasonTintLayer();
      this._createEdgeGlowLayer();

      // カラーグレーディングレイヤー（暖色寄せ）
      try {
        this._createColorGradingLayer();
        console.log('[PixiRenderer] Color grading layer created.');
      } catch (cgErr) {
        console.warn('[PixiRenderer] Color grading initialization failed:', cgErr.message);
        this.colorGradingEnabled = false;
      }

      // DOF（被写界深度）レイヤーを構築
      try {
        this._createDofLayers();
        console.log('[PixiRenderer] DOF layers created.');
      } catch (dofErr) {
        console.warn('[PixiRenderer] DOF initialization failed, disabling DOF:', dofErr.message);
        this.dofEnabled = false;
      }

      // tickerで自動レンダリング（手動renderは不要）
      this.app.ticker.add(() => {
        // 特に毎フレーム更新が必要な処理があればここで
      });

      this.enabled = true;
      console.log('[PixiRenderer] Initialized (effects-only overlay mode).');
      return true;

    } catch (e) {
      console.warn('[PixiRenderer] Initialization failed:', e.message);
      this._cleanup();
      return false;
    }
  }

  /**
   * WebGLサポートチェック
   */
  _checkWebGLSupport() {
    try {
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
      return !!gl;
    } catch (e) {
      return false;
    }
  }

  // ==========================================
  // エフェクトレイヤー構築
  // ==========================================

  /**
   * ビネットレイヤー — 放射グラデーション風の暗いオーバーレイ
   * PIXI.Graphicsで楕円の同心円リングを重ねて放射グラデーションを近似する
   */
  _createVignetteLayer() {
    // オフスクリーンCanvasで放射グラデーションを描画し、テクスチャ化する
    const vigCanvas = document.createElement('canvas');
    vigCanvas.width = GAME_WIDTH;
    vigCanvas.height = GAME_HEIGHT;
    const vigCtx = vigCanvas.getContext('2d');

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const outerRadius = Math.sqrt(cx * cx + cy * cy);
    const grad = vigCtx.createRadialGradient(cx, cy, outerRadius * 0.35, cx, cy, outerRadius);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.5, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.4)');
    vigCtx.fillStyle = grad;
    vigCtx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const vigTexture = PIXI.Texture.from(vigCanvas);
    this._vignetteSprite = new PIXI.Sprite(vigTexture);
    // NORMALブレンド — 半透明の黒がそのまま重なる
    this._vignetteSprite.blendMode = PIXI.BLEND_MODES.NORMAL;
    this.effectContainer.addChild(this._vignetteSprite);
  }

  /**
   * 季節ティントレイヤー — 薄い色のrect（ADDブレンド）
   */
  _createSeasonTintLayer() {
    this._seasonTintGraphics = new PIXI.Graphics();
    // デフォルト: 春
    this._drawSeasonTint('spring');
    this._seasonTintGraphics.blendMode = PIXI.BLEND_MODES.ADD;
    this.effectContainer.addChild(this._seasonTintGraphics);
  }

  /**
   * エッジグローレイヤー — 画面の四隅・端に季節の色で柔らかい光を加える
   * ソースcanvasをぼかすのではなく、独立した光のオーバーレイ
   */
  _createEdgeGlowLayer() {
    // オフスクリーンCanvasで四隅にソフトなグローを描画
    this._edgeGlowCanvas = document.createElement('canvas');
    this._edgeGlowCanvas.width = GAME_WIDTH;
    this._edgeGlowCanvas.height = GAME_HEIGHT;
    this._edgeGlowCtx = this._edgeGlowCanvas.getContext('2d');

    this._drawEdgeGlow('spring');

    this._edgeGlowTexture = PIXI.Texture.from(this._edgeGlowCanvas);
    this._edgeGlowSprite = new PIXI.Sprite(this._edgeGlowTexture);
    this._edgeGlowSprite.blendMode = PIXI.BLEND_MODES.ADD;
    this.effectContainer.addChild(this._edgeGlowSprite);
  }

  /**
   * カラーグレーディングレイヤー — 暖かい色温度のオーバーレイ
   * Canvas 2Dで暖色のソフトオーバーレイを描画し、PIXI.Spriteとして配置
   * ColorMatrixFilterが利用可能ならそちらを使用
   */
  _createColorGradingLayer() {
    // オフスクリーンCanvasで暖色グラデーションを作成
    const cgCanvas = document.createElement('canvas');
    cgCanvas.width = GAME_WIDTH;
    cgCanvas.height = GAME_HEIGHT;
    const cgCtx = cgCanvas.getContext('2d');

    // 画面中央から放射する暖色グロー
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const outerR = Math.sqrt(cx * cx + cy * cy);

    // 暖色の放射グラデーション（中央は目立たず、全体にうっすら）
    const grad = cgCtx.createRadialGradient(cx, cy, 0, cx, cy, outerR);
    grad.addColorStop(0, 'rgba(255,240,220,0.03)');
    grad.addColorStop(0.5, 'rgba(255,230,200,0.02)');
    grad.addColorStop(1, 'rgba(255,220,180,0.04)');
    cgCtx.fillStyle = grad;
    cgCtx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const cgTexture = PIXI.Texture.from(cgCanvas);
    this._colorGradingSprite = new PIXI.Sprite(cgTexture);
    this._colorGradingSprite.blendMode = PIXI.BLEND_MODES.ADD;
    this.effectContainer.addChild(this._colorGradingSprite);

    // ColorMatrixFilterが存在する場合、エフェクトコンテナに適用
    if (typeof PIXI.ColorMatrixFilter !== 'undefined') {
      this._colorGradingFilter = new PIXI.ColorMatrixFilter();
      // わずかに暖色に寄せる（赤/緑チャネルを微増、青を微減）
      // matrix: [R_r, R_g, R_b, R_a, R_offset,
      //          G_r, G_g, G_b, G_a, G_offset,
      //          B_r, B_g, B_b, B_a, B_offset,
      //          A_r, A_g, A_b, A_a, A_offset]
      this._colorGradingFilter.matrix = [
        1.04, 0.02, 0,    0, 0.01,  // Red: slightly boosted
        0.01, 1.02, 0,    0, 0.005, // Green: very slightly boosted
        0,    0,    0.96, 0, -0.01, // Blue: slightly reduced
        0,    0,    0,    1, 0,
      ];
      this.effectContainer.filters = [this._colorGradingFilter];
    }
  }

  /**
   * DOF（被写界深度）レイヤー — チルトシフト風ぼかし
   * 既存ゲームCanvasの内容をテクスチャとして取り込み、
   * 画面上部と下部にBlurFilterをかけたスプライトをオーバーレイする。
   * 中央部分はマスクによって透明になるため、元のCanvasがシャープなまま見える。
   */
  _createDofLayers() {
    const w = GAME_WIDTH;
    const h = GAME_HEIGHT;

    // DOF用コンテナ（他エフェクトの前面＝最後に追加）
    this._dofContainer = new PIXI.Container();
    // エフェクトコンテナではなくstageに直接追加（effectContainerの前面）
    this.app.stage.addChildAt(this._dofContainer, 0);

    // 既存ゲームCanvasからテクスチャを生成
    this._dofTexture = PIXI.Texture.from(this._gameCanvas);

    // ぼかし強度（控えめに開始）
    const blurStrength = 3;

    // --- 上部DOFゾーン ---
    // 上部20%をカバーするが、グラデーションマスクで中央に向かって透明にする
    const topZoneHeight = Math.floor(h * 0.30); // マスクの範囲は30%（グラデーション含む）

    this._dofTopSprite = new PIXI.Sprite(this._dofTexture);
    this._dofTopSprite.width = w;
    this._dofTopSprite.height = h;
    this._dofTopSprite.filters = [new PIXI.BlurFilter(blurStrength, 2)];

    // 上部グラデーションマスク: 上端が不透明、中央に向かって透明
    const topMaskCanvas = document.createElement('canvas');
    topMaskCanvas.width = w;
    topMaskCanvas.height = h;
    const topMaskCtx = topMaskCanvas.getContext('2d');
    const topGrad = topMaskCtx.createLinearGradient(0, 0, 0, topZoneHeight);
    topGrad.addColorStop(0, 'rgba(255,255,255,1)');
    topGrad.addColorStop(0.5, 'rgba(255,255,255,0.6)');
    topGrad.addColorStop(1, 'rgba(255,255,255,0)');
    topMaskCtx.fillStyle = topGrad;
    topMaskCtx.fillRect(0, 0, w, topZoneHeight);
    // 残りは透明のまま（何も描かない）

    const topMaskTexture = PIXI.Texture.from(topMaskCanvas);
    this._dofTopMaskSprite = new PIXI.Sprite(topMaskTexture);
    this._dofTopSprite.mask = this._dofTopMaskSprite;

    this._dofContainer.addChild(this._dofTopSprite);
    this._dofContainer.addChild(this._dofTopMaskSprite);

    // --- 下部DOFゾーン ---
    const bottomZoneHeight = Math.floor(h * 0.30);
    const bottomStart = h - bottomZoneHeight;

    this._dofBottomSprite = new PIXI.Sprite(this._dofTexture);
    this._dofBottomSprite.width = w;
    this._dofBottomSprite.height = h;
    this._dofBottomSprite.filters = [new PIXI.BlurFilter(blurStrength, 2)];

    // 下部グラデーションマスク: 下端が不透明、中央に向かって透明
    const bottomMaskCanvas = document.createElement('canvas');
    bottomMaskCanvas.width = w;
    bottomMaskCanvas.height = h;
    const bottomMaskCtx = bottomMaskCanvas.getContext('2d');
    const bottomGrad = bottomMaskCtx.createLinearGradient(0, bottomStart, 0, h);
    bottomGrad.addColorStop(0, 'rgba(255,255,255,0)');
    bottomGrad.addColorStop(0.5, 'rgba(255,255,255,0.6)');
    bottomGrad.addColorStop(1, 'rgba(255,255,255,1)');
    bottomMaskCtx.fillStyle = bottomGrad;
    bottomMaskCtx.fillRect(0, bottomStart, w, bottomZoneHeight);

    const bottomMaskTexture = PIXI.Texture.from(bottomMaskCanvas);
    this._dofBottomMaskSprite = new PIXI.Sprite(bottomMaskTexture);
    this._dofBottomSprite.mask = this._dofBottomMaskSprite;

    this._dofContainer.addChild(this._dofBottomSprite);
    this._dofContainer.addChild(this._dofBottomMaskSprite);
  }

  // ==========================================
  // 描画ヘルパー
  // ==========================================

  _drawSeasonTint(season) {
    const tint = this.seasonTints[season] || this.seasonTints.spring;
    this._seasonTintGraphics.clear();
    this._seasonTintGraphics.beginFill(tint.color, tint.alpha);
    this._seasonTintGraphics.drawRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this._seasonTintGraphics.endFill();
  }

  _drawEdgeGlow(season) {
    const glow = this.seasonGlow[season] || this.seasonGlow.spring;
    const ctx = this._edgeGlowCtx;
    const w = GAME_WIDTH;
    const h = GAME_HEIGHT;

    ctx.clearRect(0, 0, w, h);

    // CSSカラー文字列に変換
    const r = (glow.color >> 16) & 0xFF;
    const g = (glow.color >> 8) & 0xFF;
    const b = glow.color & 0xFF;
    const a = glow.alpha;

    // 四隅に放射グラデーションのグローを配置
    const corners = [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: 0, y: h },
      { x: w, y: h },
    ];

    const radius = Math.min(w, h) * 0.45;

    for (const corner of corners) {
      const grad = ctx.createRadialGradient(corner.x, corner.y, 0, corner.x, corner.y, radius);
      grad.addColorStop(0, `rgba(${r},${g},${b},${a})`);
      grad.addColorStop(0.4, `rgba(${r},${g},${b},${a * 0.4})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }
  }

  // ==========================================
  // メイン処理: ポストプロセス適用
  // ==========================================

  /**
   * 毎フレーム呼び出し — 季節に応じてティント・グローを更新
   * @param {HTMLCanvasElement} sourceCanvas 既存Canvas（未使用だがAPI互換のため残す）
   * @param {string} season 現在の季節 (spring/summer/autumn/winter)
   */
  applyPostProcess(sourceCanvas, season) {
    if (!this.enabled) return;

    try {
      // エフェクトの有効/無効を反映
      this._vignetteSprite.visible = this.vignetteEnabled;
      this._seasonTintGraphics.visible = this.seasonTintEnabled;
      this._edgeGlowSprite.visible = this.edgeGlowEnabled;
      if (this._colorGradingSprite) {
        this._colorGradingSprite.visible = this.colorGradingEnabled;
      }
      if (this._colorGradingFilter) {
        this._colorGradingFilter.enabled = this.colorGradingEnabled;
      }

      // DOF テクスチャ更新（毎フレーム、ゲームCanvasの最新内容を反映）
      if (this.dofEnabled && this._dofContainer) {
        try {
          this._dofTexture.update();
          this._dofContainer.visible = true;
        } catch (dofErr) {
          // DOFのテクスチャ更新に失敗した場合、DOFのみ無効化
          console.warn('[PixiRenderer] DOF texture update failed, disabling DOF:', dofErr.message);
          this.dofEnabled = false;
          if (this._dofContainer) this._dofContainer.visible = false;
        }
      } else if (this._dofContainer) {
        this._dofContainer.visible = false;
      }

      // 季節が変わった場合のみティント・グローを再描画
      if (season && season !== this._currentSeason) {
        this._currentSeason = season;

        if (this.seasonTintEnabled) {
          this._drawSeasonTint(season);
        }

        if (this.edgeGlowEnabled) {
          this._drawEdgeGlow(season);
          // テクスチャを更新
          this._edgeGlowTexture.update();
        }
      }

      // tickerが自動レンダリングするので、手動renderは不要

    } catch (e) {
      console.warn('[PixiRenderer] Post-process error, disabling:', e.message);
      this.enabled = false;
      this._hidePixiCanvas();
    }
  }

  // ==========================================
  // 公開API
  // ==========================================

  /**
   * エフェクトの有効/無効を切り替え
   * @param {string} effect 'vignette' | 'seasonTint' | 'edgeGlow'
   * @param {boolean} enabled
   */
  setEffectEnabled(effect, enabled) {
    switch (effect) {
      case 'vignette': this.vignetteEnabled = enabled; break;
      case 'seasonTint': this.seasonTintEnabled = enabled; break;
      case 'edgeGlow': this.edgeGlowEnabled = enabled; break;
      // レガシー互換
      case 'bloom': this.edgeGlowEnabled = enabled; break;
      case 'dof': this.dofEnabled = enabled; break;
      case 'colorGrading': this.colorGradingEnabled = enabled; break;
    }
  }

  /**
   * 全エフェクトのON/OFF
   */
  setAllEffects(enabled) {
    this.vignetteEnabled = enabled;
    this.seasonTintEnabled = enabled;
    this.edgeGlowEnabled = enabled;
    this.dofEnabled = enabled;
    this.colorGradingEnabled = enabled;
  }

  /**
   * PixiRendererが有効かどうか
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * PixiCanvasを非表示にする（フォールバック時）
   */
  _hidePixiCanvas() {
    const pixiCanvas = document.getElementById('pixi-canvas');
    if (pixiCanvas) {
      pixiCanvas.style.display = 'none';
    }
  }

  /**
   * クリーンアップ
   */
  _cleanup() {
    if (this.app) {
      try {
        const pixiCanvas = document.getElementById('pixi-canvas');
        if (pixiCanvas && pixiCanvas.parentElement) {
          pixiCanvas.parentElement.removeChild(pixiCanvas);
        }
        this.app.destroy(true);
      } catch (e) {
        // ignore cleanup errors
      }
      this.app = null;
    }
    this.enabled = false;
  }

  /**
   * 完全破棄
   */
  destroy() {
    this._cleanup();
    this._vignetteSprite = null;
    this._seasonTintGraphics = null;
    this._edgeGlowSprite = null;
    this._edgeGlowTexture = null;
    this._edgeGlowCanvas = null;
    this._edgeGlowCtx = null;
    this._colorGradingSprite = null;
    this._colorGradingFilter = null;
    this._dofTexture = null;
    this._dofTopSprite = null;
    this._dofBottomSprite = null;
    this._dofTopMaskSprite = null;
    this._dofBottomMaskSprite = null;
    this._dofContainer = null;
    this.effectContainer = null;
  }
}

// ==========================================
// Game.draw() へのフック — 既存コードを変更せずにポストプロセスを適用
// ==========================================
(function () {
  // PixiRendererのグローバルインスタンス
  window.pixiRenderer = new PixiRenderer();

  function hookPixiRenderer() {
    // gameインスタンスが存在するまで待つ
    const checkGame = () => {
      if (window.game && window.game.canvas) {
        const success = window.pixiRenderer.init(window.game.canvas);
        if (success) {
          // Game.prototype.drawをラップ
          const originalDraw = Game.prototype.draw;
          Game.prototype.draw = function () {
            // 元のdrawを実行（Canvas 2Dに描画）
            originalDraw.call(this);

            // ポストプロセスを適用（季節に応じたティント更新のみ）
            const season = this.state.party
              ? this.state.party.getLeader()?.currentSeason || SEASON.SPRING
              : SEASON.SPRING;
            window.pixiRenderer.applyPostProcess(this.canvas, season);
          };
          console.log('[PixiRenderer] Game.draw() hooked for post-processing.');
        }
      } else {
        // gameがまだ初期化されていなければリトライ
        requestAnimationFrame(checkGame);
      }
    };

    // main.jsの実行後にチェック開始
    requestAnimationFrame(checkGame);
  }

  // DOMContentLoadedがまだなら待つ、すでに発火済みなら即実行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hookPixiRenderer);
  } else {
    hookPixiRenderer();
  }
})();
