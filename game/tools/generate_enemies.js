// ============================================================
// generate_enemies.js — 敵 & ボス スプライトシート生成
// 四季廻りの職人 | node-canvas使用
// 出力:
//   ../assets/sprites/enemy_fairy.png   (128x64: 2フレーム横並び)
//   ../assets/sprites/enemy_bee.png     (128x64)
//   ../assets/sprites/enemy_fox.png     (128x64)
//   ../assets/sprites/boss_hanamori.png (256x128: 2フレーム横並び)
// ============================================================
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'sprites');

function setPixel(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

function drawEllipse(ctx, cx, cy, rx, ry, color) {
  ctx.fillStyle = color;
  for (let dy = -ry; dy <= ry; dy++) {
    for (let dx = -rx; dx <= rx; dx++) {
      if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1) {
        ctx.fillRect(cx + dx, cy + dy, 1, 1);
      }
    }
  }
}

function drawCircle(ctx, cx, cy, r, color) {
  drawEllipse(ctx, cx, cy, r, r, color);
}

// ==========================================
// 花精 (64x64, ピンクの羽根, 小さな妖精)
// ==========================================
function drawFairy(ctx, ox, oy, frame) {
  // 羽根 (フレームで羽ばたき)
  const wingSpread = frame === 0 ? 0 : 4;
  // 左羽
  ctx.fillStyle = 'rgba(255,200,220,0.7)';
  drawEllipse(ctx, ox + 16 - wingSpread, oy + 24, 10, 14 - wingSpread, 'rgba(255,200,220,0.7)');
  ctx.fillStyle = 'rgba(255,170,200,0.5)';
  drawEllipse(ctx, ox + 16 - wingSpread, oy + 24, 8, 12 - wingSpread, 'rgba(255,170,200,0.5)');
  // 右羽
  ctx.fillStyle = 'rgba(255,200,220,0.7)';
  drawEllipse(ctx, ox + 48 + wingSpread, oy + 24, 10, 14 - wingSpread, 'rgba(255,200,220,0.7)');
  ctx.fillStyle = 'rgba(255,170,200,0.5)';
  drawEllipse(ctx, ox + 48 + wingSpread, oy + 24, 8, 12 - wingSpread, 'rgba(255,170,200,0.5)');

  // 羽のスジ
  ctx.fillStyle = 'rgba(255,140,180,0.6)';
  for (let i = -6; i <= 6; i++) {
    setPixel(ctx, ox + 16 - wingSpread + i, oy + 24 + ((i * i) / 8 | 0), 'rgba(255,140,180,0.6)');
    setPixel(ctx, ox + 48 + wingSpread + i, oy + 24 + ((i * i) / 8 | 0), 'rgba(255,140,180,0.6)');
  }

  // 体 (小さな人型)
  const bx = ox + 27, by = oy + 18;

  // 胴体
  ctx.fillStyle = '#DDBBFF';
  ctx.fillRect(bx, by + 6, 10, 14);
  ctx.fillStyle = '#BB99DD';
  ctx.fillRect(bx, by + 6, 10, 2);
  ctx.fillRect(bx, by + 18, 10, 2);

  // 頭
  drawCircle(ctx, bx + 5, by + 3, 5, '#DDBBFF');
  drawCircle(ctx, bx + 5, by + 3, 4, '#EEDDFF');
  // 目
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(bx + 2, by + 2, 3, 2);
  ctx.fillRect(bx + 6, by + 2, 3, 2);
  ctx.fillStyle = '#6633AA';
  ctx.fillRect(bx + 3, by + 2, 2, 2);
  ctx.fillRect(bx + 7, by + 2, 2, 2);
  // ハイライト
  ctx.fillStyle = '#FFFFFF';
  setPixel(ctx, bx + 3, by + 2, '#FFFFFF');
  setPixel(ctx, bx + 7, by + 2, '#FFFFFF');
  // 口
  ctx.fillStyle = '#BB88CC';
  ctx.fillRect(bx + 4, by + 5, 3, 1);

  // 腕
  ctx.fillStyle = '#EEDDFF';
  ctx.fillRect(bx - 3, by + 8, 3, 8);
  ctx.fillRect(bx + 10, by + 8, 3, 8);

  // スカート (フワッとした形)
  ctx.fillStyle = '#CCAAEE';
  ctx.fillRect(bx - 2, by + 16, 14, 6);
  ctx.fillStyle = '#DDBBFF';
  ctx.fillRect(bx - 1, by + 16, 12, 5);

  // 足
  ctx.fillStyle = '#EEDDFF';
  ctx.fillRect(bx + 1, by + 22, 3, 4);
  ctx.fillRect(bx + 6, by + 22, 3, 4);

  // キラキラエフェクト
  const sparkle = frame === 0 ? [[ox+12,oy+12],[ox+50,oy+14],[ox+30,oy+8]] : [[ox+10,oy+16],[ox+52,oy+10],[ox+35,oy+6]];
  ctx.fillStyle = '#FFDD44';
  for (const [sx, sy] of sparkle) {
    setPixel(ctx, sx, sy, '#FFDD44');
    setPixel(ctx, sx+1, sy, '#FFEE88');
    setPixel(ctx, sx, sy+1, '#FFEE88');
  }

  // グロー
  ctx.fillStyle = 'rgba(255,180,210,0.15)';
  drawCircle(ctx, ox + 32, oy + 28, 18, 'rgba(255,180,210,0.15)');
}

// ==========================================
// 花蜂 (64x64, 黄黒の縞、半透明の羽)
// ==========================================
function drawBee(ctx, ox, oy, frame) {
  // 羽 (半透明、フレームで角度変化)
  const wingY = frame === 0 ? -6 : -2;
  // 左羽
  ctx.fillStyle = 'rgba(200,220,240,0.5)';
  drawEllipse(ctx, ox + 18, oy + 22 + wingY, 12, 6, 'rgba(200,220,240,0.5)');
  ctx.fillStyle = 'rgba(180,200,220,0.3)';
  drawEllipse(ctx, ox + 18, oy + 22 + wingY, 10, 4, 'rgba(180,200,220,0.3)');
  // 右羽
  ctx.fillStyle = 'rgba(200,220,240,0.5)';
  drawEllipse(ctx, ox + 46, oy + 22 + wingY, 12, 6, 'rgba(200,220,240,0.5)');
  ctx.fillStyle = 'rgba(180,200,220,0.3)';
  drawEllipse(ctx, ox + 46, oy + 22 + wingY, 10, 4, 'rgba(180,200,220,0.3)');

  // 胴体 (楕円)
  drawEllipse(ctx, ox + 32, oy + 32, 14, 10, '#222222');
  drawEllipse(ctx, ox + 32, oy + 32, 13, 9, '#FFD700');

  // 縞模様
  for (let stripe = 0; stripe < 5; stripe++) {
    const sy = oy + 26 + stripe * 4;
    if (stripe % 2 === 0) {
      ctx.fillStyle = '#222222';
      for (let dx = -12; dx <= 12; dx++) {
        const dy1 = sy - (oy + 32);
        const dy2 = dy1 + 2;
        if ((dx * dx) / (13 * 13) + (dy1 * dy1) / (9 * 9) <= 1) {
          ctx.fillRect(ox + 32 + dx, sy, 1, 2);
        }
      }
    }
  }

  // 頭部
  drawCircle(ctx, ox + 32, oy + 20, 7, '#222222');
  drawCircle(ctx, ox + 32, oy + 20, 6, '#333333');
  // 目 (赤い複眼)
  drawCircle(ctx, ox + 28, oy + 19, 3, '#FF0000');
  drawCircle(ctx, ox + 36, oy + 19, 3, '#FF0000');
  ctx.fillStyle = '#FF4444';
  setPixel(ctx, ox + 28, oy + 18, '#FF4444');
  setPixel(ctx, ox + 36, oy + 18, '#FF4444');
  // 触角
  ctx.fillStyle = '#222222';
  ctx.fillRect(ox + 29, oy + 12, 1, 4);
  ctx.fillRect(ox + 35, oy + 12, 1, 4);
  ctx.fillRect(ox + 28, oy + 11, 1, 2);
  ctx.fillRect(ox + 36, oy + 11, 1, 2);

  // 針
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(ox + 31, oy + 42, 2, 5);
  ctx.fillStyle = '#DDDDDD';
  ctx.fillRect(ox + 31, oy + 46, 2, 1);

  // 脚 (6本)
  ctx.fillStyle = '#333333';
  // 左
  ctx.fillRect(ox + 20, oy + 34, 3, 1);
  ctx.fillRect(ox + 19, oy + 35, 1, 4);
  ctx.fillRect(ox + 21, oy + 30, 3, 1);
  ctx.fillRect(ox + 20, oy + 31, 1, 3);
  ctx.fillRect(ox + 22, oy + 38, 3, 1);
  ctx.fillRect(ox + 21, oy + 39, 1, 3);
  // 右
  ctx.fillRect(ox + 41, oy + 34, 3, 1);
  ctx.fillRect(ox + 44, oy + 35, 1, 4);
  ctx.fillRect(ox + 40, oy + 30, 3, 1);
  ctx.fillRect(ox + 43, oy + 31, 1, 3);
  ctx.fillRect(ox + 39, oy + 38, 3, 1);
  ctx.fillRect(ox + 42, oy + 39, 1, 3);
}

// ==========================================
// 霧狐 (64x64, オレンジの狐)
// ==========================================
function drawFox(ctx, ox, oy, frame) {
  // 尻尾 (大きい, フレームで揺れる)
  const tailSwing = frame === 0 ? 0 : 4;
  ctx.fillStyle = '#FF6622';
  drawEllipse(ctx, ox + 14 - tailSwing, oy + 30, 10, 14, '#FF6622');
  ctx.fillStyle = '#FF8844';
  drawEllipse(ctx, ox + 14 - tailSwing, oy + 28, 8, 12, '#FF8844');
  // 尻尾の先端 (白)
  ctx.fillStyle = '#FFFFFF';
  drawEllipse(ctx, ox + 10 - tailSwing, oy + 18, 4, 5, '#FFFFFF');

  // 体 (胴体)
  drawEllipse(ctx, ox + 34, oy + 38, 14, 10, '#CC6622');
  drawEllipse(ctx, ox + 34, oy + 37, 13, 9, '#FF8844');
  // お腹 (白)
  drawEllipse(ctx, ox + 34, oy + 40, 8, 6, '#FFCCAA');

  // 前足
  ctx.fillStyle = '#FF8844';
  ctx.fillRect(ox + 24, oy + 44, 5, 10);
  ctx.fillRect(ox + 38, oy + 44, 5, 10);
  // 足先 (暗い)
  ctx.fillStyle = '#CC6622';
  ctx.fillRect(ox + 24, oy + 52, 5, 2);
  ctx.fillRect(ox + 38, oy + 52, 5, 2);
  // 後ろ足
  ctx.fillStyle = '#FF8844';
  ctx.fillRect(ox + 18, oy + 42, 5, 12);
  ctx.fillRect(ox + 44, oy + 42, 5, 12);
  ctx.fillStyle = '#CC6622';
  ctx.fillRect(ox + 18, oy + 52, 5, 2);
  ctx.fillRect(ox + 44, oy + 52, 5, 2);

  // 頭
  drawEllipse(ctx, ox + 34, oy + 24, 10, 8, '#CC6622');
  drawEllipse(ctx, ox + 34, oy + 23, 9, 7, '#FF8844');
  // 頬 (白)
  drawEllipse(ctx, ox + 30, oy + 26, 4, 3, '#FFDDBB');
  drawEllipse(ctx, ox + 38, oy + 26, 4, 3, '#FFDDBB');
  // 鼻先 (白)
  drawEllipse(ctx, ox + 34, oy + 28, 4, 3, '#FFFFFF');

  // 耳 (三角)
  ctx.fillStyle = '#FF8844';
  // 左耳
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(ox + 26 - i/2, oy + 16 + i, 3 + i, 1);
  }
  // 右耳
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(ox + 38 - i/2, oy + 16 + i, 3 + i, 1);
  }
  // 内耳
  ctx.fillStyle = '#FFAA88';
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(ox + 27, oy + 18 + i, 2 + i, 1);
    ctx.fillRect(ox + 39, oy + 18 + i, 2 + i, 1);
  }

  // 目 (金色)
  ctx.fillStyle = '#FFDD00';
  ctx.fillRect(ox + 29, oy + 22, 3, 3);
  ctx.fillRect(ox + 36, oy + 22, 3, 3);
  ctx.fillStyle = '#222222';
  ctx.fillRect(ox + 30, oy + 23, 2, 2);
  ctx.fillRect(ox + 37, oy + 23, 2, 2);
  // ハイライト
  ctx.fillStyle = '#FFFFFF';
  setPixel(ctx, ox + 30, oy + 22, '#FFFFFF');
  setPixel(ctx, ox + 37, oy + 22, '#FFFFFF');

  // 鼻
  ctx.fillStyle = '#222222';
  ctx.fillRect(ox + 33, oy + 27, 2, 2);

  // 霧エフェクト
  ctx.fillStyle = 'rgba(200,200,220,0.2)';
  for (let i = 0; i < 8; i++) {
    const mx = ox + 10 + (i * 7 + frame * 3) % 44;
    const my = oy + 50 + (i * 3) % 10;
    drawEllipse(ctx, mx, my, 4 + (i % 3), 2, 'rgba(200,200,220,0.2)');
  }
}

// ==========================================
// 花守 ボス (128x128, 巨大な桜の精霊)
// ==========================================
function drawBossHanamori(ctx, ox, oy, frame) {
  // つる (背景に絡みつく)
  const vineColor = '#2A6A2A';
  const vineDark = '#1A4A1A';
  // 左のつる
  ctx.fillStyle = vineColor;
  for (let i = 0; i < 120; i++) {
    const vx = ox + 10 + Math.sin(i * 0.08 + frame * 0.5) * 12;
    const vy = oy + 5 + i;
    ctx.fillRect(vx, vy, 3, 1);
    ctx.fillStyle = vineDark;
    ctx.fillRect(vx, vy, 1, 1);
    ctx.fillStyle = vineColor;
    // 棘
    if (i % 12 === 0) {
      ctx.fillStyle = '#3A5A2A';
      ctx.fillRect(vx - 2, vy, 2, 2);
      ctx.fillRect(vx + 3, vy, 2, 2);
      ctx.fillStyle = vineColor;
    }
  }
  // 右のつる
  for (let i = 0; i < 110; i++) {
    const vx = ox + 105 + Math.sin(i * 0.07 + frame * 0.3 + 2) * 10;
    const vy = oy + 15 + i;
    ctx.fillRect(vx, vy, 3, 1);
  }

  // 幹/茎 (中央)
  ctx.fillStyle = '#4A2A1A';
  ctx.fillRect(ox + 54, oy + 60, 20, 60);
  ctx.fillStyle = '#6A4A3A';
  ctx.fillRect(ox + 56, oy + 60, 16, 58);
  ctx.fillStyle = '#7A5A4A';
  ctx.fillRect(ox + 58, oy + 62, 4, 50);
  // 根
  ctx.fillStyle = '#4A2A1A';
  ctx.fillRect(ox + 44, oy + 115, 40, 8);
  ctx.fillRect(ox + 38, oy + 118, 52, 6);
  ctx.fillStyle = '#3A1A0A';
  ctx.fillRect(ox + 40, oy + 122, 48, 4);

  // 花びらの体 (巨大な桜の花冠)
  const petalColors = ['#FFB7C5', '#FFC0CB', '#FF99B4', '#FFAABB', '#FF88AA'];
  const petalDark = '#DD7799';
  const ccx = ox + 64, ccy = oy + 36;
  const rx = 40, ry = 28;

  // 外側の花びら
  for (let dy = -ry; dy <= ry; dy++) {
    for (let dx = -rx; dx <= rx; dx++) {
      const dist = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
      if (dist <= 1) {
        const ci = ((Math.abs(dx) + Math.abs(dy)) % 5);
        // 花びら模様 (放射状)
        const angle = Math.atan2(dy, dx);
        const petalPattern = Math.sin(angle * 5 + frame * 0.3) * 0.5 + 0.5;
        if (petalPattern > 0.3 || dist < 0.6) {
          ctx.fillStyle = petalColors[ci];
        } else {
          ctx.fillStyle = petalDark;
        }
        if (Math.random() > 0.05) {
          ctx.fillRect(ccx + dx, ccy + dy, 1, 1);
        }
      }
    }
  }

  // 輪郭 (暗いピンク)
  ctx.fillStyle = '#CC6688';
  for (let dy = -ry; dy <= ry; dy++) {
    for (let dx = -rx; dx <= rx; dx++) {
      const dist = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
      if (dist > 0.88 && dist <= 1) {
        ctx.fillRect(ccx + dx, ccy + dy, 1, 1);
      }
    }
  }

  // 花の中心 (黄色い部分)
  drawCircle(ctx, ccx, ccy + 2, 12, '#CCAA00');
  drawCircle(ctx, ccx, ccy + 2, 10, '#FFD700');
  drawCircle(ctx, ccx, ccy + 2, 8, '#FFEC8B');

  // 赤い目
  ctx.fillStyle = '#880000';
  ctx.fillRect(ccx - 8, ccy - 1, 6, 5);
  ctx.fillRect(ccx + 3, ccy - 1, 6, 5);
  ctx.fillStyle = '#FF0000';
  ctx.fillRect(ccx - 7, ccy, 4, 3);
  ctx.fillRect(ccx + 4, ccy, 4, 3);
  // 瞳
  ctx.fillStyle = '#FF4444';
  ctx.fillRect(ccx - 6, ccy + 1, 2, 2);
  ctx.fillRect(ccx + 5, ccy + 1, 2, 2);
  // 目のグロー
  ctx.fillStyle = 'rgba(255,0,0,0.3)';
  drawCircle(ctx, ccx - 5, ccy + 1, 5, 'rgba(255,0,0,0.3)');
  drawCircle(ctx, ccx + 6, ccy + 1, 5, 'rgba(255,0,0,0.3)');

  // 散る花びら (フレームで位置変化)
  const petalParticles = frame === 0
    ? [[ox+15,oy+20],[ox+100,oy+15],[ox+45,oy+10],[ox+90,oy+50],[ox+20,oy+70],[ox+110,oy+40]]
    : [[ox+20,oy+25],[ox+95,oy+20],[ox+50,oy+8],[ox+85,oy+55],[ox+25,oy+65],[ox+105,oy+45]];
  for (const [px, py] of petalParticles) {
    ctx.fillStyle = '#FFB7C5';
    ctx.fillRect(px, py, 3, 2);
    ctx.fillRect(px + 1, py - 1, 1, 1);
    ctx.fillRect(px + 1, py + 2, 1, 1);
  }

  // 花びらの腕 (つる状)
  ctx.fillStyle = '#FF99AA';
  // 左腕
  for (let i = 0; i < 20; i++) {
    const ax = ox + 24 + i * 0.5 - Math.sin(i * 0.3 + frame) * 3;
    const ay = oy + 50 + i * 1.5;
    ctx.fillRect(ax, ay, 4, 2);
  }
  // 右腕
  for (let i = 0; i < 20; i++) {
    const ax = ox + 96 - i * 0.5 + Math.sin(i * 0.3 + frame) * 3;
    const ay = oy + 50 + i * 1.5;
    ctx.fillRect(ax, ay, 4, 2);
  }
  // 腕先の花
  drawCircle(ctx, ox + 18, oy + 82, 5, '#FFB7C5');
  drawCircle(ctx, ox + 18, oy + 82, 3, '#FFD5DD');
  drawCircle(ctx, ox + 108, oy + 82, 5, '#FFB7C5');
  drawCircle(ctx, ox + 108, oy + 82, 3, '#FFD5DD');
}

// ==========================================
// 生成メイン
// ==========================================
function generateEnemySheet(drawFunc, w, h, frames, filename) {
  const canvas = createCanvas(w * frames, h);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let f = 0; f < frames; f++) {
    drawFunc(ctx, f * w, 0, f);
  }

  const outPath = path.join(OUTPUT_DIR, filename);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outPath, buffer);
  console.log(`  生成: ${outPath}`);
}

function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('敵スプライト生成中...');
  generateEnemySheet(drawFairy, 64, 64, 2, 'enemy_fairy.png');
  generateEnemySheet(drawBee, 64, 64, 2, 'enemy_bee.png');
  generateEnemySheet(drawFox, 64, 64, 2, 'enemy_fox.png');

  console.log('ボススプライト生成中...');
  generateEnemySheet(drawBossHanamori, 128, 128, 2, 'boss_hanamori.png');

  console.log('敵スプライト生成完了!');
}

main();
