// ============================================================
// generate_sprites.js — キャラクタースプライトシート生成
// 四季廻りの職人 | node-canvas使用
// 出力: ../assets/sprites/hero.png, tsumugi.png, npc_guild.png, npc_inn.png, npc_merchant.png
// 各キャラ: 96x192 (32x48 * 3cols * 4rows)
// ============================================================
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const FRAME_W = 32;
const FRAME_H = 48;
const COLS = 3; // static, walk1, walk2
const ROWS = 4; // down, left, right, up
const SHEET_W = FRAME_W * COLS; // 96
const SHEET_H = FRAME_H * ROWS; // 192

const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'sprites');

// ==========================================
// ピクセルアート描画ヘルパー
// ==========================================
function setPixel(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

function drawOutlinedRect(ctx, x, y, w, h, fill, outline) {
  ctx.fillStyle = outline;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
}

function drawEllipseShadow(ctx, cx, cy, rx, ry) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let dx = -rx; dx <= rx; dx++) {
    for (let dy = -ry; dy <= ry; dy++) {
      if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1) {
        ctx.fillRect(cx + dx, cy + dy, 1, 1);
      }
    }
  }
}

// ==========================================
// キャラクター描画関数
// ==========================================

// 共通: 頭部を描画 (丸い頭)
function drawHead(ctx, ox, oy, hairColor, hairDark, skinColor, skinShadow, eyeWhite, pupilColor, dir) {
  // 髪の毛 (上部)
  const hx = ox + 8, hy = oy + 2;
  // 髪アウトライン
  ctx.fillStyle = hairDark;
  for (let dx = -1; dx <= 16; dx++) {
    for (let dy = -1; dy <= 10; dy++) {
      const nx = hx + dx, ny = hy + dy;
      if (dx >= 0 && dx < 16 && dy >= 0 && dy < 10) continue;
    }
  }

  // 髪の毛本体
  ctx.fillStyle = hairColor;
  ctx.fillRect(hx + 2, hy, 12, 3);
  ctx.fillRect(hx + 1, hy + 1, 14, 4);
  ctx.fillRect(hx, hy + 2, 16, 3);

  // 髪暗部 (上端, 左右端)
  ctx.fillStyle = hairDark;
  ctx.fillRect(hx + 3, hy, 10, 1);
  ctx.fillRect(hx, hy + 3, 2, 2);
  ctx.fillRect(hx + 14, hy + 3, 2, 2);

  // 顔 (肌色)
  const fx = hx + 1, fy = hy + 5;
  ctx.fillStyle = skinColor;
  ctx.fillRect(fx, fy, 14, 8);
  ctx.fillRect(fx + 1, fy + 8, 12, 2);

  // 肌影 (顎周り)
  ctx.fillStyle = skinShadow;
  ctx.fillRect(fx, fy + 6, 2, 2);
  ctx.fillRect(fx + 12, fy + 6, 2, 2);
  ctx.fillRect(fx + 2, fy + 8, 10, 1);

  // 目
  if (dir === 'down' || dir === 'left' || dir === 'right') {
    const eyeY = fy + 2;
    if (dir === 'down') {
      // 両目
      ctx.fillStyle = eyeWhite;
      ctx.fillRect(fx + 3, eyeY, 3, 3);
      ctx.fillRect(fx + 8, eyeY, 3, 3);
      ctx.fillStyle = pupilColor;
      ctx.fillRect(fx + 4, eyeY + 1, 2, 2);
      ctx.fillRect(fx + 9, eyeY + 1, 2, 2);
      // ハイライト
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(fx + 5, eyeY, 1, 1);
      ctx.fillRect(fx + 10, eyeY, 1, 1);
    } else if (dir === 'left') {
      ctx.fillStyle = eyeWhite;
      ctx.fillRect(fx + 2, eyeY, 3, 3);
      ctx.fillRect(fx + 7, eyeY, 3, 3);
      ctx.fillStyle = pupilColor;
      ctx.fillRect(fx + 2, eyeY + 1, 2, 2);
      ctx.fillRect(fx + 7, eyeY + 1, 2, 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(fx + 4, eyeY, 1, 1);
      ctx.fillRect(fx + 9, eyeY, 1, 1);
    } else { // right
      ctx.fillStyle = eyeWhite;
      ctx.fillRect(fx + 4, eyeY, 3, 3);
      ctx.fillRect(fx + 9, eyeY, 3, 3);
      ctx.fillStyle = pupilColor;
      ctx.fillRect(fx + 5, eyeY + 1, 2, 2);
      ctx.fillRect(fx + 10, eyeY + 1, 2, 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(fx + 4, eyeY, 1, 1);
      ctx.fillRect(fx + 9, eyeY, 1, 1);
    }
    // 口
    ctx.fillStyle = skinShadow;
    ctx.fillRect(fx + 5, fy + 6, 4, 1);
  }
  // 上向き = 後頭部のみ
}

// ==========================================
// 主人公 (青い鎧、金髪、剣)
// ==========================================
function drawHero(ctx, ox, oy, dir, frame) {
  const colors = {
    hair: '#E8C840',      // 金髪
    hairDark: '#B89828',
    skin: '#FFD699',
    skinShadow: '#EEBB77',
    eyeWhite: '#FFFFFF',
    pupil: '#2244AA',
    armor: '#4488CC',
    armorDark: '#336699',
    armorLight: '#66AADD',
    belt: '#8B6914',
    pants: '#334466',
    boots: '#443322',
    bootsDark: '#332211',
    sword: '#AABBCC',
    swordDark: '#889999',
    swordHandle: '#8B4513',
  };

  // 影
  drawEllipseShadow(ctx, ox + 16, oy + 46, 7, 2);

  // --- 体 (鎧) ---
  const bodyY = oy + 17;
  // 鎧アウトライン
  ctx.fillStyle = colors.armorDark;
  ctx.fillRect(ox + 6, bodyY, 20, 16);
  // 鎧本体
  ctx.fillStyle = colors.armor;
  ctx.fillRect(ox + 7, bodyY + 1, 18, 14);
  // ハイライト (左上から光)
  ctx.fillStyle = colors.armorLight;
  ctx.fillRect(ox + 8, bodyY + 1, 4, 3);
  ctx.fillRect(ox + 7, bodyY + 1, 2, 6);
  // ベルト
  ctx.fillStyle = colors.belt;
  ctx.fillRect(ox + 7, bodyY + 12, 18, 2);

  // 肩甲
  ctx.fillStyle = colors.armorDark;
  ctx.fillRect(ox + 4, bodyY + 1, 4, 5);
  ctx.fillRect(ox + 24, bodyY + 1, 4, 5);
  ctx.fillStyle = colors.armor;
  ctx.fillRect(ox + 5, bodyY + 2, 3, 3);
  ctx.fillRect(ox + 24, bodyY + 2, 3, 3);

  // --- 剣 (背中、右上に見える) ---
  if (dir === 'down' || dir === 'left') {
    ctx.fillStyle = colors.swordHandle;
    ctx.fillRect(ox + 24, oy + 6, 2, 5);
    ctx.fillStyle = colors.sword;
    ctx.fillRect(ox + 24, oy + 1, 2, 6);
    ctx.fillStyle = colors.swordDark;
    ctx.fillRect(ox + 25, oy + 2, 1, 4);
    // 鍔
    ctx.fillStyle = '#B8860B';
    ctx.fillRect(ox + 23, oy + 6, 4, 1);
  }

  // --- パンツ ---
  ctx.fillStyle = colors.pants;
  ctx.fillRect(ox + 9, bodyY + 14, 14, 6);

  // --- 脚と足 (フレームで動き変化) ---
  const legBaseY = bodyY + 18;
  if (frame === 0) {
    // 静止
    ctx.fillStyle = colors.boots;
    ctx.fillRect(ox + 10, legBaseY, 5, 8);
    ctx.fillRect(ox + 17, legBaseY, 5, 8);
    ctx.fillStyle = colors.bootsDark;
    ctx.fillRect(ox + 10, legBaseY + 6, 5, 2);
    ctx.fillRect(ox + 17, legBaseY + 6, 5, 2);
  } else if (frame === 1) {
    // 歩き1: 左足前、右足後ろ
    ctx.fillStyle = colors.boots;
    ctx.fillRect(ox + 8, legBaseY - 1, 5, 8);
    ctx.fillRect(ox + 19, legBaseY + 1, 5, 7);
    ctx.fillStyle = colors.bootsDark;
    ctx.fillRect(ox + 8, legBaseY + 5, 5, 2);
    ctx.fillRect(ox + 19, legBaseY + 6, 5, 2);
  } else {
    // 歩き2: 右足前、左足後ろ
    ctx.fillStyle = colors.boots;
    ctx.fillRect(ox + 19, legBaseY - 1, 5, 8);
    ctx.fillRect(ox + 8, legBaseY + 1, 5, 7);
    ctx.fillStyle = colors.bootsDark;
    ctx.fillRect(ox + 19, legBaseY + 5, 5, 2);
    ctx.fillRect(ox + 8, legBaseY + 6, 5, 2);
  }

  // --- 頭 ---
  drawHead(ctx, ox, oy, colors.hair, colors.hairDark, colors.skin, colors.skinShadow, colors.eyeWhite, colors.pupil, dir);
}

// ==========================================
// 紬 (薬師: 白緑の衣、緑髪、薬瓶)
// ==========================================
function drawTsumugi(ctx, ox, oy, dir, frame) {
  const colors = {
    hair: '#66BB66',
    hairDark: '#448844',
    skin: '#FFE0BD',
    skinShadow: '#EECCAA',
    eyeWhite: '#FFFFFF',
    pupil: '#336633',
    robe: '#EEEEDD',
    robeDark: '#CCCCBB',
    robeLight: '#FFFFFF',
    accent: '#88CC88',
    accentDark: '#669966',
    skirt: '#DDDDCC',
    boots: '#998877',
    bootsDark: '#776655',
    potion: '#44DDAA',
    potionDark: '#339977',
    potionCork: '#CC9966',
  };

  drawEllipseShadow(ctx, ox + 16, oy + 46, 7, 2);

  // 衣 (ローブ/ワンピース形状)
  const bodyY = oy + 17;
  ctx.fillStyle = colors.robeDark;
  ctx.fillRect(ox + 7, bodyY, 18, 20);
  ctx.fillStyle = colors.robe;
  ctx.fillRect(ox + 8, bodyY + 1, 16, 18);
  ctx.fillStyle = colors.robeLight;
  ctx.fillRect(ox + 9, bodyY + 1, 4, 4);

  // 緑のアクセント (帯)
  ctx.fillStyle = colors.accent;
  ctx.fillRect(ox + 8, bodyY + 8, 16, 3);
  ctx.fillStyle = colors.accentDark;
  ctx.fillRect(ox + 8, bodyY + 10, 16, 1);

  // スカート部分 (広がり)
  ctx.fillStyle = colors.skirt;
  ctx.fillRect(ox + 6, bodyY + 12, 20, 8);
  ctx.fillStyle = colors.robeDark;
  ctx.fillRect(ox + 6, bodyY + 18, 20, 2);
  // 裾の装飾
  ctx.fillStyle = colors.accent;
  ctx.fillRect(ox + 7, bodyY + 17, 18, 1);

  // 袖
  ctx.fillStyle = colors.robe;
  ctx.fillRect(ox + 4, bodyY + 1, 4, 8);
  ctx.fillRect(ox + 24, bodyY + 1, 4, 8);
  ctx.fillStyle = colors.accent;
  ctx.fillRect(ox + 4, bodyY + 7, 4, 2);
  ctx.fillRect(ox + 24, bodyY + 7, 4, 2);

  // 薬瓶 (右手に持つ)
  if (dir === 'down' || dir === 'right') {
    ctx.fillStyle = colors.potionCork;
    ctx.fillRect(ox + 26, bodyY + 5, 3, 2);
    ctx.fillStyle = colors.potion;
    ctx.fillRect(ox + 25, bodyY + 7, 5, 6);
    ctx.fillStyle = colors.potionDark;
    ctx.fillRect(ox + 27, bodyY + 9, 2, 3);
    // ハイライト
    ctx.fillStyle = '#AAFFDD';
    ctx.fillRect(ox + 26, bodyY + 7, 1, 2);
  }

  // 足
  const legBaseY = bodyY + 19;
  if (frame === 0) {
    ctx.fillStyle = colors.boots;
    ctx.fillRect(ox + 11, legBaseY, 4, 7);
    ctx.fillRect(ox + 17, legBaseY, 4, 7);
    ctx.fillStyle = colors.bootsDark;
    ctx.fillRect(ox + 11, legBaseY + 5, 4, 2);
    ctx.fillRect(ox + 17, legBaseY + 5, 4, 2);
  } else if (frame === 1) {
    ctx.fillStyle = colors.boots;
    ctx.fillRect(ox + 9, legBaseY, 4, 6);
    ctx.fillRect(ox + 19, legBaseY + 1, 4, 6);
    ctx.fillStyle = colors.bootsDark;
    ctx.fillRect(ox + 9, legBaseY + 4, 4, 2);
    ctx.fillRect(ox + 19, legBaseY + 5, 4, 2);
  } else {
    ctx.fillStyle = colors.boots;
    ctx.fillRect(ox + 19, legBaseY, 4, 6);
    ctx.fillRect(ox + 9, legBaseY + 1, 4, 6);
    ctx.fillStyle = colors.bootsDark;
    ctx.fillRect(ox + 19, legBaseY + 4, 4, 2);
    ctx.fillRect(ox + 9, legBaseY + 5, 4, 2);
  }

  drawHead(ctx, ox, oy, colors.hair, colors.hairDark, colors.skin, colors.skinShadow, colors.eyeWhite, colors.pupil, dir);
}

// ==========================================
// NPC: 薬師ギルド長 (茶色ローブ、白髭)
// ==========================================
function drawNpcGuild(ctx, ox, oy, dir, frame) {
  const colors = {
    hair: '#CCCCCC',
    hairDark: '#999999',
    skin: '#F5DEB3',
    skinShadow: '#DDCC99',
    eyeWhite: '#FFFFFF',
    pupil: '#555555',
    robe: '#8B6914',
    robeDark: '#6B4904',
    robeLight: '#AA8834',
    belt: '#554433',
    boots: '#443322',
    bootsDark: '#332211',
    beard: '#DDDDDD',
    beardDark: '#BBBBBB',
  };

  drawEllipseShadow(ctx, ox + 16, oy + 46, 7, 2);

  const bodyY = oy + 17;
  // ローブ
  ctx.fillStyle = colors.robeDark;
  ctx.fillRect(ox + 6, bodyY, 20, 22);
  ctx.fillStyle = colors.robe;
  ctx.fillRect(ox + 7, bodyY + 1, 18, 20);
  ctx.fillStyle = colors.robeLight;
  ctx.fillRect(ox + 8, bodyY + 1, 5, 4);
  // ベルト
  ctx.fillStyle = colors.belt;
  ctx.fillRect(ox + 7, bodyY + 10, 18, 2);
  // ローブ裾
  ctx.fillStyle = colors.robeDark;
  ctx.fillRect(ox + 5, bodyY + 16, 22, 6);
  ctx.fillStyle = colors.robe;
  ctx.fillRect(ox + 6, bodyY + 16, 20, 5);

  // 袖 (幅広)
  ctx.fillStyle = colors.robe;
  ctx.fillRect(ox + 3, bodyY + 2, 5, 10);
  ctx.fillRect(ox + 24, bodyY + 2, 5, 10);
  ctx.fillStyle = colors.robeDark;
  ctx.fillRect(ox + 3, bodyY + 10, 5, 2);
  ctx.fillRect(ox + 24, bodyY + 10, 5, 2);

  // 足
  const legBaseY = bodyY + 21;
  ctx.fillStyle = colors.boots;
  ctx.fillRect(ox + 11, legBaseY, 4, 5);
  ctx.fillRect(ox + 17, legBaseY, 4, 5);
  ctx.fillStyle = colors.bootsDark;
  ctx.fillRect(ox + 11, legBaseY + 3, 4, 2);
  ctx.fillRect(ox + 17, legBaseY + 3, 4, 2);

  // 頭 (白髪)
  drawHead(ctx, ox, oy, colors.hair, colors.hairDark, colors.skin, colors.skinShadow, colors.eyeWhite, colors.pupil, dir);

  // 白髭
  if (dir === 'down') {
    ctx.fillStyle = colors.beard;
    ctx.fillRect(ox + 11, oy + 14, 10, 4);
    ctx.fillRect(ox + 13, oy + 18, 6, 2);
    ctx.fillStyle = colors.beardDark;
    ctx.fillRect(ox + 12, oy + 16, 8, 1);
  }
}

// ==========================================
// NPC: 宿屋の主人 (エプロン、茶髪)
// ==========================================
function drawNpcInn(ctx, ox, oy, dir, frame) {
  const colors = {
    hair: '#8B4513',
    hairDark: '#6B3310',
    skin: '#F5DEB3',
    skinShadow: '#DDCC99',
    eyeWhite: '#FFFFFF',
    pupil: '#333333',
    shirt: '#7B3F00',
    shirtDark: '#5B2F00',
    apron: '#FFFFFF',
    apronDark: '#DDDDDD',
    pants: '#554433',
    boots: '#443322',
    bootsDark: '#332211',
  };

  drawEllipseShadow(ctx, ox + 16, oy + 46, 7, 2);

  const bodyY = oy + 17;
  // シャツ
  ctx.fillStyle = colors.shirtDark;
  ctx.fillRect(ox + 7, bodyY, 18, 14);
  ctx.fillStyle = colors.shirt;
  ctx.fillRect(ox + 8, bodyY + 1, 16, 12);

  // エプロン
  ctx.fillStyle = colors.apron;
  ctx.fillRect(ox + 10, bodyY + 3, 12, 12);
  ctx.fillStyle = colors.apronDark;
  ctx.fillRect(ox + 10, bodyY + 3, 12, 1);
  ctx.fillRect(ox + 10, bodyY + 13, 12, 2);
  // エプロン紐
  ctx.fillStyle = colors.apron;
  ctx.fillRect(ox + 8, bodyY + 3, 2, 1);
  ctx.fillRect(ox + 22, bodyY + 3, 2, 1);

  // 袖
  ctx.fillStyle = colors.shirt;
  ctx.fillRect(ox + 4, bodyY + 1, 4, 7);
  ctx.fillRect(ox + 24, bodyY + 1, 4, 7);

  // パンツ
  ctx.fillStyle = colors.pants;
  ctx.fillRect(ox + 9, bodyY + 14, 14, 6);

  // 足
  const legBaseY = bodyY + 19;
  if (frame === 0) {
    ctx.fillStyle = colors.boots;
    ctx.fillRect(ox + 10, legBaseY, 5, 7);
    ctx.fillRect(ox + 17, legBaseY, 5, 7);
    ctx.fillStyle = colors.bootsDark;
    ctx.fillRect(ox + 10, legBaseY + 5, 5, 2);
    ctx.fillRect(ox + 17, legBaseY + 5, 5, 2);
  } else if (frame === 1) {
    ctx.fillStyle = colors.boots;
    ctx.fillRect(ox + 8, legBaseY, 5, 6);
    ctx.fillRect(ox + 19, legBaseY + 1, 5, 6);
    ctx.fillStyle = colors.bootsDark;
    ctx.fillRect(ox + 8, legBaseY + 4, 5, 2);
    ctx.fillRect(ox + 19, legBaseY + 5, 5, 2);
  } else {
    ctx.fillStyle = colors.boots;
    ctx.fillRect(ox + 19, legBaseY, 5, 6);
    ctx.fillRect(ox + 8, legBaseY + 1, 5, 6);
    ctx.fillStyle = colors.bootsDark;
    ctx.fillRect(ox + 19, legBaseY + 4, 5, 2);
    ctx.fillRect(ox + 8, legBaseY + 5, 5, 2);
  }

  drawHead(ctx, ox, oy, colors.hair, colors.hairDark, colors.skin, colors.skinShadow, colors.eyeWhite, colors.pupil, dir);
}

// ==========================================
// NPC: 商人 (緑の服、帽子)
// ==========================================
function drawNpcMerchant(ctx, ox, oy, dir, frame) {
  const colors = {
    hair: '#6B4226',
    hairDark: '#4B2216',
    skin: '#FFDAB9',
    skinShadow: '#EEBB99',
    eyeWhite: '#FFFFFF',
    pupil: '#333333',
    hat: '#2E8B57',
    hatDark: '#1E6B37',
    hatBrim: '#3EAB67',
    shirt: '#3CB371',
    shirtDark: '#2E8B57',
    shirtLight: '#66D9A0',
    belt: '#8B6914',
    pants: '#6B5940',
    boots: '#554433',
    bootsDark: '#332211',
    pouch: '#AA7722',
    pouchDark: '#885511',
  };

  drawEllipseShadow(ctx, ox + 16, oy + 46, 7, 2);

  const bodyY = oy + 17;
  // シャツ
  ctx.fillStyle = colors.shirtDark;
  ctx.fillRect(ox + 7, bodyY, 18, 14);
  ctx.fillStyle = colors.shirt;
  ctx.fillRect(ox + 8, bodyY + 1, 16, 12);
  ctx.fillStyle = colors.shirtLight;
  ctx.fillRect(ox + 9, bodyY + 1, 3, 4);
  // ベルト
  ctx.fillStyle = colors.belt;
  ctx.fillRect(ox + 7, bodyY + 11, 18, 2);
  // 腰ポーチ
  ctx.fillStyle = colors.pouch;
  ctx.fillRect(ox + 20, bodyY + 8, 5, 5);
  ctx.fillStyle = colors.pouchDark;
  ctx.fillRect(ox + 20, bodyY + 8, 5, 1);
  ctx.fillRect(ox + 21, bodyY + 10, 3, 1);

  // 袖
  ctx.fillStyle = colors.shirt;
  ctx.fillRect(ox + 4, bodyY + 1, 4, 7);
  ctx.fillRect(ox + 24, bodyY + 1, 4, 7);

  // パンツ
  ctx.fillStyle = colors.pants;
  ctx.fillRect(ox + 9, bodyY + 13, 14, 7);

  // 足
  const legBaseY = bodyY + 19;
  if (frame === 0) {
    ctx.fillStyle = colors.boots;
    ctx.fillRect(ox + 10, legBaseY, 5, 7);
    ctx.fillRect(ox + 17, legBaseY, 5, 7);
    ctx.fillStyle = colors.bootsDark;
    ctx.fillRect(ox + 10, legBaseY + 5, 5, 2);
    ctx.fillRect(ox + 17, legBaseY + 5, 5, 2);
  } else if (frame === 1) {
    ctx.fillStyle = colors.boots;
    ctx.fillRect(ox + 8, legBaseY, 5, 6);
    ctx.fillRect(ox + 19, legBaseY + 1, 5, 6);
    ctx.fillStyle = colors.bootsDark;
    ctx.fillRect(ox + 8, legBaseY + 4, 5, 2);
    ctx.fillRect(ox + 19, legBaseY + 5, 5, 2);
  } else {
    ctx.fillStyle = colors.boots;
    ctx.fillRect(ox + 19, legBaseY, 5, 6);
    ctx.fillRect(ox + 8, legBaseY + 1, 5, 6);
    ctx.fillStyle = colors.bootsDark;
    ctx.fillRect(ox + 19, legBaseY + 4, 5, 2);
    ctx.fillRect(ox + 8, legBaseY + 5, 5, 2);
  }

  // 頭 (帽子の下に髪が見える)
  drawHead(ctx, ox, oy, colors.hair, colors.hairDark, colors.skin, colors.skinShadow, colors.eyeWhite, colors.pupil, dir);

  // 帽子 (頭の上に重ねて描画)
  ctx.fillStyle = colors.hat;
  ctx.fillRect(ox + 7, oy + 1, 18, 5);
  ctx.fillStyle = colors.hatDark;
  ctx.fillRect(ox + 7, oy + 1, 18, 1);
  ctx.fillRect(ox + 7, oy + 5, 18, 1);
  // つば
  ctx.fillStyle = colors.hatBrim;
  ctx.fillRect(ox + 5, oy + 5, 22, 2);
  // ハイライト
  ctx.fillStyle = colors.shirtLight;
  ctx.fillRect(ox + 9, oy + 2, 4, 2);
}

// ==========================================
// スプライトシート生成
// ==========================================
const DIRECTIONS = ['down', 'left', 'right', 'up'];

function generateSpriteSheet(drawFunc, filename) {
  const canvas = createCanvas(SHEET_W, SHEET_H);
  const ctx = canvas.getContext('2d');

  // 透明背景
  ctx.clearRect(0, 0, SHEET_W, SHEET_H);

  // imageSmoothing 無効 (ピクセルアート)
  ctx.imageSmoothingEnabled = false;

  for (let row = 0; row < ROWS; row++) {
    const dir = DIRECTIONS[row];
    for (let col = 0; col < COLS; col++) {
      const ox = col * FRAME_W;
      const oy = row * FRAME_H;
      drawFunc(ctx, ox, oy, dir, col);
    }
  }

  const outPath = path.join(OUTPUT_DIR, filename);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outPath, buffer);
  console.log(`  生成: ${outPath}`);
}

// ==========================================
// メイン
// ==========================================
function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('キャラクタースプライト生成中...');
  generateSpriteSheet(drawHero, 'hero.png');
  generateSpriteSheet(drawTsumugi, 'tsumugi.png');
  generateSpriteSheet(drawNpcGuild, 'npc_guild.png');
  generateSpriteSheet(drawNpcInn, 'npc_inn.png');
  generateSpriteSheet(drawNpcMerchant, 'npc_merchant.png');
  console.log('キャラクタースプライト生成完了!');
}

main();
