// ============================================================
// sprite_loader.js — スプライトシートPNGローダー
// 四季廻りの職人 | グローバル名前空間定義
// 生成されたPNG画像を読み込み、フレーム切り出し描画を行う
// 画像が未生成の場合は drawPixelChar へフォールバック
// ============================================================

class SpriteLoader {
  constructor() {
    this.images = {};       // { id: HTMLImageElement }
    this.loaded = false;
    this.loadCount = 0;
    this.totalCount = 0;
    this._registered = {};  // { id: path }
    this._failedIds = {};   // 読み込み失敗した画像ID
  }

  // ==========================================
  // 画像を登録（まだ読み込まない）
  // ==========================================
  register(id, path) {
    this._registered[id] = path;
    this.totalCount++;
  }

  // ==========================================
  // 全画像を読み込み（Promise）
  // 読み込み失敗した画像はスキップ（フォールバック対象に）
  // ==========================================
  loadAll() {
    return new Promise((resolve) => {
      if (this.totalCount === 0) {
        this.loaded = true;
        resolve();
        return;
      }

      let completed = 0;
      const checkDone = () => {
        completed++;
        if (completed >= this.totalCount) {
          this.loaded = true;
          resolve();
        }
      };

      for (const [id, path] of Object.entries(this._registered)) {
        const img = new Image();
        img.onload = () => {
          this.images[id] = img;
          this.loadCount++;
          checkDone();
        };
        img.onerror = () => {
          console.warn(`[SpriteLoader] 画像読み込み失敗 (フォールバック使用): ${path}`);
          this._failedIds[id] = true;
          checkDone();
        };
        img.src = path;
      }
    });
  }

  // ==========================================
  // 画像が利用可能か
  // ==========================================
  hasImage(id) {
    return !!this.images[id];
  }

  // ==========================================
  // 読み込み進捗 (0.0 ~ 1.0)
  // ==========================================
  getProgress() {
    if (this.totalCount === 0) return 1;
    return this.loadCount / this.totalCount;
  }

  // ==========================================
  // スプライトシートから切り出して描画
  // frameX, frameY: フレームのインデックス (ピクセルではなくフレーム番号)
  // ==========================================
  drawSprite(ctx, id, frameX, frameY, destX, destY, frameW, frameH, scale) {
    const img = this.images[id];
    if (!img) return false;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      img,
      frameX * frameW, frameY * frameH, frameW, frameH,
      Math.floor(destX), Math.floor(destY),
      Math.floor(frameW * scale), Math.floor(frameH * scale)
    );
    return true;
  }

  // ==========================================
  // キャラクター描画ヘルパー
  // direction: 0=down, 1=left, 2=right, 3=up
  // frame: 0=static, 1=walk1, 2=walk2
  // スプライトシート構成: 3列(frame) x 4行(direction)
  //   各フレーム: 32x48
  // ==========================================
  drawCharSprite(ctx, id, direction, frame, destX, destY, scale) {
    if (scale === undefined) scale = 1;
    return this.drawSprite(ctx, id, frame, direction, destX, destY, 32, 48, scale);
  }

  // ==========================================
  // 敵描画ヘルパー
  // 敵スプライトシート: 2列(frame) x 1行、各フレーム 64x64
  // ==========================================
  drawEnemySprite(ctx, id, frame, destX, destY, scale) {
    if (scale === undefined) scale = 1;
    return this.drawSprite(ctx, id, frame, 0, destX, destY, 64, 64, scale);
  }

  // ==========================================
  // ボス描画ヘルパー
  // ボススプライトシート: 2列(frame) x 1行、各フレーム 128x128
  // ==========================================
  drawBossSprite(ctx, id, frame, destX, destY, scale) {
    if (scale === undefined) scale = 1;
    return this.drawSprite(ctx, id, frame, 0, destX, destY, 128, 128, scale);
  }

  // ==========================================
  // タイル描画ヘルパー
  // タイルセット: N列 x 1行、各タイル 32x32
  // tileIndex: タイルの横インデックス
  // ==========================================
  drawTile(ctx, id, tileIndex, destX, destY, scale) {
    if (scale === undefined) scale = 1;
    return this.drawSprite(ctx, id, tileIndex, 0, destX, destY, 32, 32, scale);
  }
}

// ==========================================
// グローバルインスタンス
// ==========================================
const SPRITE_LOADER = new SpriteLoader();

// ==========================================
// 標準アセット登録
// ==========================================
(function registerDefaultAssets() {
  // キャラクター
  SPRITE_LOADER.register('hero', 'assets/sprites/hero.png');
  SPRITE_LOADER.register('tsumugi', 'assets/sprites/tsumugi.png');
  SPRITE_LOADER.register('npc_guild', 'assets/sprites/npc_guild.png');
  SPRITE_LOADER.register('npc_inn', 'assets/sprites/npc_inn.png');
  SPRITE_LOADER.register('npc_merchant', 'assets/sprites/npc_merchant.png');

  // 敵
  SPRITE_LOADER.register('enemy_fairy', 'assets/sprites/enemy_fairy.png');
  SPRITE_LOADER.register('enemy_bee', 'assets/sprites/enemy_bee.png');
  SPRITE_LOADER.register('enemy_fox', 'assets/sprites/enemy_fox.png');

  // ボス
  SPRITE_LOADER.register('boss_hanamori', 'assets/sprites/boss_hanamori.png');

  // タイル
  SPRITE_LOADER.register('spring_tiles', 'assets/tiles/spring_tiles.png');
})();

// ==========================================
// 方向変換ヘルパー (文字列 → 数値)
// ==========================================
const SPRITE_DIR_MAP = {
  'down': 0,
  'left': 1,
  'right': 2,
  'up': 3,
};

// ==========================================
// キャラタイプ → スプライトID マッピング
// ==========================================
const CHAR_SPRITE_MAP = {
  'hero': 'hero',
  'healer': 'tsumugi',
  'npc_brown': 'npc_guild',
  'npc_innkeeper': 'npc_inn',
  'npc_green': 'npc_merchant',
};

// ==========================================
// 敵ID → スプライトID マッピング
// ==========================================
const ENEMY_SPRITE_MAP = {
  'springFairy': 'enemy_fairy',
  'springBee': 'enemy_bee',
  'kiriGitsune': 'enemy_fox',
  'hanamori': 'boss_hanamori',
};

// ==========================================
// タイルインデックス定数
// ==========================================
const TILE_SPRITE_INDEX = {
  FLOOR: 0,
  WALL: 1,
  WATER_0: 2,
  WATER_1: 3,
  WATER_2: 4,
  DOOR: 5,
  CHEST_CLOSED: 6,
  CHEST_OPEN: 7,
  SAVE_0: 8,
  SAVE_1: 9,
  GRASS: 10,
  SAKURA_TREE: 11,
  FENCE: 12,
};
