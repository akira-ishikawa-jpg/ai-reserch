// PixiRenderer - HD-2D風ポストプロセスエフェクト（PixiJS v7ベース）
// 既存のCanvas 2Dレンダラーの描画結果をテクスチャとして取り込み、
// ブルーム・被写界深度・ビネット・季節ティントを適用する

class PixiRenderer {
  constructor() {
    this.enabled = false;
    this.app = null;
    this.postProcessContainer = null;
    this.sourceTexture = null;
    this.sourceSprite = null;

    // エフェクト用レイヤー
    this.bloomLayer = null;
    this.dofTopSprite = null;
    this.dofBottomSprite = null;
    this.vignetteSprite = null;
    this.seasonTintSprite = null;

    // エフェクトON/OFFフラグ
    this.bloomEnabled = true;
    this.depthOfFieldEnabled = true;
    this.vignetteEnabled = true;
    this.seasonTintEnabled = true;

    // 季節ティントカラー設定
    this.seasonTints = {
      spring: { r: 255, g: 180, b: 200, a: 0.08 },
      summer: { r: 255, g: 200, b: 100, a: 0.08 },
      autumn: { r: 200, g: 100, b: 50, a: 0.08 },
      winter: { r: 100, g: 150, b: 255, a: 0.08 },
    };

    // 季節ごとのブルーム強度
    this.seasonBloomStrength = {
      spring: 5,
      summer: 3,
      autumn: 3,
      winter: 4,
    };

    // 内部状態
    this._currentSeason = null;
    this._vignetteTexture = null;
    this._dofTopTexture = null;
    this._dofBottomTexture = null;
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

      // PixiJS Application作成
      this.app = new PIXI.Application({
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        backgroundAlpha: 0, // 透明背景（下の既存Canvasが見えるように）
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

      // メインコンテナ
      this.postProcessContainer = new PIXI.Container();
      this.app.stage.addChild(this.postProcessContainer);

      // 既存Canvasをテクスチャとして取り込むためのスプライト
      this.sourceTexture = PIXI.Texture.from(gameCanvas);
      this.sourceSprite = new PIXI.Sprite(this.sourceTexture);
      this.postProcessContainer.addChild(this.sourceSprite);

      // エフェクトレイヤーを構築
      this._createBloomLayer();
      this._createDepthOfFieldLayers();
      this._createVignetteLayer();
      this._createSeasonTintLayer();

      // 自動レンダリングを無効化（手動で呼ぶ）
      this.app.ticker.autoStart = false;
      this.app.ticker.stop();

      this.enabled = true;
      console.log('[PixiRenderer] Initialized successfully with HD-2D post-process effects.');
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
   * ブルームレイヤー — 明るい部分がぼんやり光る
   * 元のCanvasをぼかしてadd合成で重ねることで簡易ブルームを実現
   */
  _createBloomLayer() {
    this.bloomLayer = new PIXI.Sprite(PIXI.Texture.from(this._gameCanvas));
    this.bloomLayer.blendMode = PIXI.BLEND_MODES.ADD;
    this.bloomLayer.alpha = 0.15;

    const blurFilter = new PIXI.BlurFilter();
    blurFilter.blur = 4;
    blurFilter.quality = 2;
    this.bloomLayer.filters = [blurFilter];
    this._bloomFilter = blurFilter;

    this.postProcessContainer.addChild(this.bloomLayer);
  }

  /**
   * 被写界深度レイヤー — 上部と下部にぼかしをかけ、ジオラマ感を演出
   * グラデーションマスクで中央はクリア、端はぼける
   */
  _createDepthOfFieldLayers() {
    // 上部ぼかし用のグラデーションを生成
    const dofCanvas = document.createElement('canvas');
    dofCanvas.width = GAME_WIDTH;
    dofCanvas.height = GAME_HEIGHT;
    const dofCtx = dofCanvas.getContext('2d');

    // 上部: 白→透明のグラデーション（白い部分がぼかし適用域）
    const gradTop = dofCtx.createLinearGradient(0, 0, 0, GAME_HEIGHT * 0.35);
    gradTop.addColorStop(0, 'rgba(0,0,0,0.25)');
    gradTop.addColorStop(1, 'rgba(0,0,0,0)');
    dofCtx.fillStyle = gradTop;
    dofCtx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT * 0.35);

    // 下部: 透明→白のグラデーション
    const gradBottom = dofCtx.createLinearGradient(0, GAME_HEIGHT * 0.7, 0, GAME_HEIGHT);
    gradBottom.addColorStop(0, 'rgba(0,0,0,0)');
    gradBottom.addColorStop(1, 'rgba(0,0,0,0.3)');
    dofCtx.fillStyle = gradBottom;
    dofCtx.fillRect(0, GAME_HEIGHT * 0.7, GAME_WIDTH, GAME_HEIGHT * 0.3);

    // ぼかしたソースを表示するスプライト
    this.dofSprite = new PIXI.Sprite(PIXI.Texture.from(this._gameCanvas));
    const dofBlur = new PIXI.BlurFilter();
    dofBlur.blur = 3;
    dofBlur.quality = 2;
    this.dofSprite.filters = [dofBlur];
    this._dofBlurFilter = dofBlur;

    // マスク用スプライト（上下のグラデーション部分のみ表示）
    this._dofMaskTexture = PIXI.Texture.from(dofCanvas);
    const maskSprite = new PIXI.Sprite(this._dofMaskTexture);
    this.dofSprite.mask = maskSprite;

    this.postProcessContainer.addChild(this.dofSprite);
    this.postProcessContainer.addChild(maskSprite);
  }

  /**
   * ビネットレイヤー — 画面端を暗くして没入感を高める
   */
  _createVignetteLayer() {
    const vigCanvas = document.createElement('canvas');
    vigCanvas.width = GAME_WIDTH;
    vigCanvas.height = GAME_HEIGHT;
    const vigCtx = vigCanvas.getContext('2d');

    // 放射グラデーション: 中央は透明、端は暗い
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const outerRadius = Math.sqrt(cx * cx + cy * cy);
    const grad = vigCtx.createRadialGradient(cx, cy, outerRadius * 0.35, cx, cy, outerRadius);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.5, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.45)');
    vigCtx.fillStyle = grad;
    vigCtx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this._vignetteTexture = PIXI.Texture.from(vigCanvas);
    this.vignetteSprite = new PIXI.Sprite(this._vignetteTexture);
    this.vignetteSprite.blendMode = PIXI.BLEND_MODES.MULTIPLY;
    this.postProcessContainer.addChild(this.vignetteSprite);
  }

  /**
   * 季節ティントレイヤー — 季節に応じた色を画面全体にうっすら乗せる
   */
  _createSeasonTintLayer() {
    this.seasonTintSprite = new PIXI.Graphics();
    this.seasonTintSprite.beginFill(0xFFB4C8, 0.08); // デフォルト: 春
    this.seasonTintSprite.drawRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.seasonTintSprite.endFill();
    this.seasonTintSprite.blendMode = PIXI.BLEND_MODES.ADD;
    this.postProcessContainer.addChild(this.seasonTintSprite);
  }

  // ==========================================
  // 季節ティント更新
  // ==========================================

  _updateSeasonTint(season) {
    if (!season || season === this._currentSeason) return;
    this._currentSeason = season;

    const tint = this.seasonTints[season];
    if (!tint) return;

    // Graphicsを作り直し
    this.seasonTintSprite.clear();
    const color = (tint.r << 16) | (tint.g << 8) | tint.b;
    this.seasonTintSprite.beginFill(color, tint.a);
    this.seasonTintSprite.drawRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.seasonTintSprite.endFill();

    // ブルーム強度も季節に応じて調整
    if (this._bloomFilter) {
      this._bloomFilter.blur = this.seasonBloomStrength[season] || 4;
    }
  }

  // ==========================================
  // メイン処理: ポストプロセス適用
  // ==========================================

  /**
   * 毎フレーム呼び出し — 既存Canvasの描画結果にエフェクトをかける
   * @param {HTMLCanvasElement} sourceCanvas 既存Canvas
   * @param {string} season 現在の季節 (spring/summer/autumn/winter)
   */
  applyPostProcess(sourceCanvas, season) {
    if (!this.enabled) return;

    try {
      // 1. ソーステクスチャを更新（既存Canvasの内容を反映）
      this.sourceTexture.update();
      if (this.bloomLayer.texture !== this.sourceTexture) {
        this.bloomLayer.texture = this.sourceTexture;
      }
      if (this.dofSprite.texture !== this.sourceTexture) {
        this.dofSprite.texture = this.sourceTexture;
      }

      // 2. エフェクトの有効/無効を反映
      this.bloomLayer.visible = this.bloomEnabled;
      this.dofSprite.visible = this.depthOfFieldEnabled;
      if (this.dofSprite.mask) {
        this.dofSprite.mask.visible = this.depthOfFieldEnabled;
      }
      this.vignetteSprite.visible = this.vignetteEnabled;
      this.seasonTintSprite.visible = this.seasonTintEnabled;

      // 3. 季節ティント更新
      if (this.seasonTintEnabled && season) {
        this._updateSeasonTint(season);
      }

      // 4. レンダリング実行
      this.app.render();

    } catch (e) {
      // エラー時は無効化してCanvas 2Dにフォールバック
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
   * @param {string} effect 'bloom' | 'dof' | 'vignette' | 'seasonTint'
   * @param {boolean} enabled
   */
  setEffectEnabled(effect, enabled) {
    switch (effect) {
      case 'bloom': this.bloomEnabled = enabled; break;
      case 'dof': this.depthOfFieldEnabled = enabled; break;
      case 'vignette': this.vignetteEnabled = enabled; break;
      case 'seasonTint': this.seasonTintEnabled = enabled; break;
    }
  }

  /**
   * 全エフェクトのON/OFF
   */
  setAllEffects(enabled) {
    this.bloomEnabled = enabled;
    this.depthOfFieldEnabled = enabled;
    this.vignetteEnabled = enabled;
    this.seasonTintEnabled = enabled;
  }

  /**
   * ブルーム強度を直接設定
   * @param {number} strength 0〜10程度
   */
  setBloomStrength(strength) {
    if (this._bloomFilter) {
      this._bloomFilter.blur = strength;
    }
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
    this.sourceTexture = null;
    this.sourceSprite = null;
    this.bloomLayer = null;
    this.dofSprite = null;
    this.vignetteSprite = null;
    this.seasonTintSprite = null;
  }
}

// ==========================================
// Game.draw() へのフック — 既存コードを変更せずにポストプロセスを適用
// ==========================================
(function () {
  // PixiRendererのグローバルインスタンス
  window.pixiRenderer = new PixiRenderer();

  // DOMContentLoaded後に初期化
  // main.jsでGameが初期化された後に実行されるよう、少し遅延させる
  const _origDOMContentLoaded = [];

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

            // ポストプロセスを適用
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

    // main.jsの実行後にチェック開始（同期scriptなので次のrAFで十分）
    requestAnimationFrame(checkGame);
  }

  // DOMContentLoadedがまだなら待つ、すでに発火済みなら即実行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hookPixiRenderer);
  } else {
    hookPixiRenderer();
  }
})();
