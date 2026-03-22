// ============================================================
// sprite_assets.js — PIXEL_CHARS から Canvas API でスプライトシートを事前生成
// 四季廻りの職人 | 外部画像ファイル不要 — コードだけで完結
// renderer.js の後、game.js の前に読み込むこと
// ============================================================

const SPRITE_ASSETS = {};

/**
 * PIXEL_CHARS の全キャラクターについて、全方向・全フレームのスプライトシートを
 * オフスクリーン Canvas に描画し、Image 要素に変換して SPRITE_ASSETS に格納する。
 * 呼び出しタイミング: ゲーム起動時（DOMContentLoaded 後）
 */
function generateSpriteAssets() {
  if (typeof PIXEL_CHARS === 'undefined') {
    console.warn('[sprite_assets] PIXEL_CHARS が未定義です。renderer.js より後に読み込んでください。');
    return;
  }

  const DIR_ORDER = ['down', 'left', 'right', 'up'];

  for (const [type, charData] of Object.entries(PIXEL_CHARS)) {
    const palette = charData.palette;
    const patterns = charData.patterns || {};

    // 利用可能な方向を取得（patterns がない場合は default を down として扱う）
    const hasPatterns = Object.keys(patterns).length > 0;
    const directions = hasPatterns ? DIR_ORDER : ['down'];

    // 各方向のフレーム数を計算（最大値を採用）
    let maxFrames = 1;
    for (const dir of directions) {
      const dirPattern = hasPatterns ? (patterns[dir] || patterns['down']) : (charData.default ? [charData.default] : []);
      if (dirPattern && dirPattern.length > maxFrames) {
        maxFrames = dirPattern.length;
      }
    }

    if (maxFrames === 0) continue;

    // フレームサイズを最初のフレームから取得
    const firstDir = hasPatterns ? (patterns[directions[0]] || patterns['down']) : [charData.default];
    if (!firstDir || firstDir.length === 0) continue;
    const firstFrame = firstDir[0];
    if (!firstFrame || firstFrame.length === 0) continue;

    const frameH = firstFrame.length;       // 行数
    const frameW = firstFrame[0].length;     // 列数

    // Canvas サイズ: 横 = フレーム数 x フレーム幅、縦 = 方向数 x フレーム高さ
    const canvas = document.createElement('canvas');
    canvas.width = maxFrames * frameW;
    canvas.height = directions.length * frameH;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // 各方向・各フレームを描画
    for (let dirIdx = 0; dirIdx < directions.length; dirIdx++) {
      const dir = directions[dirIdx];
      const dirPattern = hasPatterns ? (patterns[dir] || patterns['down']) : [charData.default];
      if (!dirPattern) continue;

      for (let frame = 0; frame < maxFrames; frame++) {
        const frameData = dirPattern[frame % dirPattern.length];
        if (!frameData) continue;

        const ox = frame * frameW;
        const oy = dirIdx * frameH;

        for (let row = 0; row < frameData.length; row++) {
          const line = frameData[row];
          for (let col = 0; col < line.length; col++) {
            const ch = line[col];
            if (ch === '.' || ch === ' ') continue;
            const color = palette[ch];
            if (!color) continue;
            ctx.fillStyle = color;
            ctx.fillRect(ox + col, oy + row, 1, 1);
          }
        }
      }
    }

    // Image オブジェクトに変換
    const img = new Image();
    img.src = canvas.toDataURL('image/png');

    SPRITE_ASSETS[type] = {
      image: img,
      frameWidth: frameW,
      frameHeight: frameH,
      directions: directions,
      framesPerDirection: maxFrames,
      directionMap: {},
    };

    // 方向 → 行インデックスのマップ
    for (let i = 0; i < directions.length; i++) {
      SPRITE_ASSETS[type].directionMap[directions[i]] = i;
    }
  }

  console.log(`[sprite_assets] ${Object.keys(SPRITE_ASSETS).length} 種類のスプライトアセットを生成しました`);
}

// ============================================================
// Renderer.prototype 拡張 — 事前生成画像による高速描画
// ============================================================

/**
 * drawCachedPixelChar — SPRITE_ASSETS に事前生成された画像を使って drawImage で高速描画する。
 * 画像が未生成・未ロードの場合は元の drawPixelChar にフォールバック。
 *
 * @param {number} x       描画先X座標
 * @param {number} y       描画先Y座標
 * @param {number} scale   拡大率（1ピクセル = scale px）
 * @param {string} type    PIXEL_CHARS のキー名
 * @param {object} options { direction, frame, season }
 */
if (typeof Renderer !== 'undefined') {
  Renderer.prototype.drawCachedPixelChar = function(x, y, scale, type, options = {}) {
    const asset = SPRITE_ASSETS[type];
    if (!asset || !asset.image.complete) {
      // フォールバック: 元の drawPixelChar を使用
      this.drawPixelChar(x, y, scale, type, options);
      return;
    }

    const { direction = 'down', frame = 0, season = null } = options;
    const dirIndex = asset.directionMap[direction] !== undefined
      ? asset.directionMap[direction]
      : (asset.directionMap['down'] || 0);
    const actualFrame = frame % asset.framesPerDirection;

    const srcX = actualFrame * asset.frameWidth;
    const srcY = dirIndex * asset.frameHeight;
    const destW = asset.frameWidth * scale;
    const destH = asset.frameHeight * scale;

    const px = Math.floor(x);
    const py = Math.floor(y);

    // 影を描画
    this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
    this.ctx.beginPath();
    this.ctx.ellipse(
      px + destW / 2,
      py + destH,
      destW * 0.35,
      2 * scale,
      0, 0, Math.PI * 2
    );
    this.ctx.fill();

    // スプライト描画（ピクセルアートなのでスムージング無効）
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(
      asset.image,
      srcX, srcY, asset.frameWidth, asset.frameHeight,
      px, py, Math.floor(destW), Math.floor(destH)
    );

    // 季節グロー（オプション）
    if (season && typeof SEASON_COLORS !== 'undefined') {
      const glowColor = SEASON_COLORS[season].primary;
      const pulse = 0.2 + 0.15 * Math.sin(Date.now() / 500);
      this.drawGlow(
        px + destW / 2,
        py + destH / 2,
        destW * 0.7,
        glowColor,
        pulse
      );
    }
  };
} else {
  console.warn('[sprite_assets] Renderer クラスが未定義です。renderer.js より後に読み込んでください。');
}

// ============================================================
// 自動初期化 — DOM 準備後に生成
// ============================================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', generateSpriteAssets);
} else {
  // DOMContentLoaded 済み
  generateSpriteAssets();
}
