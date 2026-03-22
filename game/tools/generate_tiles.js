// ============================================================
// generate_tiles.js — タイルセット生成
// 四季廻りの職人 | node-canvas使用
// 出力: ../assets/tiles/spring_tiles.png
// 10タイル (一部アニメ): 320x32 基本 + アニメフレーム
// 配置: 横に並べる。水は3フレーム、セーブポイントは2フレーム
// 合計: 14タイル分 = 448 x 32
// ============================================================
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const TILE = 32;
const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'tiles');

function setPixel(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

// ディザリング: 2色を交互に
function dither(ctx, x, y, w, h, c1, c2, density) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const use2 = ((dx + dy) % 2 === 0) && (Math.random() < density);
      ctx.fillStyle = use2 ? c2 : c1;
      ctx.fillRect(x + dx, y + dy, 1, 1);
    }
  }
}

// ノイズテクスチャ
function noiseRect(ctx, x, y, w, h, baseColor, variance) {
  const [r, g, b] = hexToRgb(baseColor);
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const v = (Math.random() - 0.5) * variance;
      const nr = clamp(r + v, 0, 255);
      const ng = clamp(g + v, 0, 255);
      const nb = clamp(b + v, 0, 255);
      ctx.fillStyle = `rgb(${nr|0},${ng|0},${nb|0})`;
      ctx.fillRect(x + dx, y + dy, 1, 1);
    }
  }
}

function hexToRgb(hex) {
  const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0];
}

function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }

// ==========================================
// タイル描画関数
// ==========================================

// 1. 床 (桜色がかった石畳)
function drawFloor(ctx, ox, oy) {
  // ベース
  noiseRect(ctx, ox, oy, TILE, TILE, '#C9A8A0', 12);
  // 石畳の目地
  ctx.fillStyle = '#A08878';
  // 横線
  ctx.fillRect(ox, oy + 8, TILE, 1);
  ctx.fillRect(ox, oy + 16, TILE, 1);
  ctx.fillRect(ox, oy + 24, TILE, 1);
  // 縦線 (互い違い)
  ctx.fillRect(ox + 16, oy, 1, 9);
  ctx.fillRect(ox + 8, oy + 8, 1, 9);
  ctx.fillRect(ox + 24, oy + 8, 1, 9);
  ctx.fillRect(ox + 16, oy + 16, 1, 9);
  ctx.fillRect(ox + 8, oy + 24, 1, 9);
  ctx.fillRect(ox + 24, oy + 24, 1, 9);
  // ハイライト
  ctx.fillStyle = 'rgba(255,200,200,0.3)';
  ctx.fillRect(ox + 1, oy + 1, 3, 1);
  ctx.fillRect(ox + 17, oy + 9, 3, 1);
  ctx.fillRect(ox + 1, oy + 17, 3, 1);
}

// 2. 壁 (苔むした石壁)
function drawWall(ctx, ox, oy) {
  // ベース
  noiseRect(ctx, ox, oy, TILE, TILE, '#7A7A6E', 15);
  // 石の区切り
  ctx.fillStyle = '#5A5A4E';
  ctx.fillRect(ox, oy + 10, TILE, 1);
  ctx.fillRect(ox, oy + 21, TILE, 1);
  ctx.fillRect(ox + 10, oy, 1, 11);
  ctx.fillRect(ox + 22, oy, 1, 11);
  ctx.fillRect(ox + 6, oy + 10, 1, 12);
  ctx.fillRect(ox + 18, oy + 10, 1, 12);
  ctx.fillRect(ox + 14, oy + 21, 1, 11);
  // 苔 (ランダムな緑ドット)
  const mossColors = ['#4A7A3A', '#5A8A4A', '#3A6A2A'];
  for (let i = 0; i < 20; i++) {
    const mx = ox + (Math.random() * 30) | 0;
    const my = oy + (Math.random() * 30) | 0 + 1;
    ctx.fillStyle = mossColors[(Math.random() * 3) | 0];
    ctx.fillRect(mx, my, 2, 1);
  }
  // 上端のハイライト
  ctx.fillStyle = '#9A9A8E';
  ctx.fillRect(ox, oy, TILE, 1);
  // 下端の影
  ctx.fillStyle = '#4A4A3E';
  ctx.fillRect(ox, oy + 31, TILE, 1);
}

// 3. 水 (3フレームアニメ)
function drawWater(ctx, ox, oy, frameIndex) {
  // 水ベース
  const baseColors = ['#4488BB', '#3377AA', '#5599CC'];
  noiseRect(ctx, ox, oy, TILE, TILE, baseColors[frameIndex], 10);
  // 波紋
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  const offset = frameIndex * 4;
  for (let i = 0; i < 5; i++) {
    const wx = ox + ((i * 7 + offset) % 30);
    const wy = oy + ((i * 5 + offset * 2) % 28) + 2;
    ctx.fillRect(wx, wy, 3, 1);
  }
  // 深い部分
  ctx.fillStyle = 'rgba(0,0,80,0.2)';
  ctx.fillRect(ox + 4, oy + 12 + frameIndex, 8, 6);
  ctx.fillRect(ox + 18, oy + 4 + frameIndex, 10, 4);
  // きらめき
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(ox + 6 + frameIndex * 3, oy + 8, 2, 1);
  ctx.fillRect(ox + 20 - frameIndex * 2, oy + 18, 1, 1);
}

// 4. 扉 (木の扉)
function drawDoor(ctx, ox, oy) {
  // 枠 (石)
  noiseRect(ctx, ox, oy, TILE, TILE, '#8A7A6A', 8);
  // 扉本体
  noiseRect(ctx, ox + 4, oy + 2, 24, 28, '#8B5E3C', 10);
  // 扉の板目
  ctx.fillStyle = '#7A4E2C';
  ctx.fillRect(ox + 15, oy + 2, 2, 28);
  // 横桟
  ctx.fillStyle = '#6A3E1C';
  ctx.fillRect(ox + 4, oy + 10, 24, 2);
  ctx.fillRect(ox + 4, oy + 20, 24, 2);
  // 取っ手
  ctx.fillStyle = '#DAA520';
  ctx.fillRect(ox + 21, oy + 14, 3, 4);
  ctx.fillStyle = '#B8860B';
  ctx.fillRect(ox + 22, oy + 15, 1, 2);
  // 扉の影
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(ox + 4, oy + 28, 24, 2);
  // 枠ハイライト
  ctx.fillStyle = '#AA9A8A';
  ctx.fillRect(ox + 3, oy + 1, 1, 30);
}

// 5. 宝箱(閉)
function drawChestClosed(ctx, ox, oy) {
  // 地面
  noiseRect(ctx, ox, oy, TILE, TILE, '#8A7A6A', 6);
  // 箱本体
  const bx = ox + 4, by = oy + 10;
  ctx.fillStyle = '#6B3310';
  ctx.fillRect(bx, by, 24, 18);
  ctx.fillStyle = '#8B5330';
  ctx.fillRect(bx + 1, by + 1, 22, 16);
  // 蓋
  ctx.fillStyle = '#7B4320';
  ctx.fillRect(bx, by, 24, 8);
  ctx.fillStyle = '#9B6340';
  ctx.fillRect(bx + 1, by + 1, 22, 6);
  // ハイライト
  ctx.fillStyle = '#AB7350';
  ctx.fillRect(bx + 2, by + 1, 6, 2);
  // 金具 (留め金)
  ctx.fillStyle = '#DAA520';
  ctx.fillRect(bx + 9, by + 6, 6, 4);
  ctx.fillStyle = '#B8860B';
  ctx.fillRect(bx + 10, by + 7, 4, 2);
  // 鍵穴
  ctx.fillStyle = '#222222';
  ctx.fillRect(bx + 11, by + 8, 2, 1);
  // 帯金具
  ctx.fillStyle = '#B8860B';
  ctx.fillRect(bx, by + 4, 24, 1);
  ctx.fillRect(bx, by + 14, 24, 1);
  // 影
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(bx, by + 17, 24, 2);
}

// 6. 宝箱(開)
function drawChestOpen(ctx, ox, oy) {
  // 地面
  noiseRect(ctx, ox, oy, TILE, TILE, '#8A7A6A', 6);
  // 箱本体 (下半分)
  const bx = ox + 4, by = oy + 14;
  ctx.fillStyle = '#6B3310';
  ctx.fillRect(bx, by, 24, 14);
  ctx.fillStyle = '#8B5330';
  ctx.fillRect(bx + 1, by + 1, 22, 12);
  // 帯金具
  ctx.fillStyle = '#B8860B';
  ctx.fillRect(bx, by + 6, 24, 1);
  // 蓋 (開いた状態 - 奥に倒れている)
  ctx.fillStyle = '#7B4320';
  ctx.fillRect(bx + 1, oy + 4, 22, 10);
  ctx.fillStyle = '#9B6340';
  ctx.fillRect(bx + 2, oy + 5, 20, 8);
  // 蓋のハイライト
  ctx.fillStyle = '#AB7350';
  ctx.fillRect(bx + 3, oy + 5, 6, 2);
  // 蓋の金具
  ctx.fillStyle = '#B8860B';
  ctx.fillRect(bx + 1, oy + 12, 22, 1);
  // 箱の中 (光っている)
  ctx.fillStyle = '#FFD700';
  ctx.fillRect(bx + 3, by + 1, 18, 4);
  ctx.fillStyle = '#FFEC8B';
  ctx.fillRect(bx + 5, by + 2, 14, 2);
  // キラキラ
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(bx + 8, by + 1, 1, 1);
  ctx.fillRect(bx + 14, by + 2, 1, 1);
  // 影
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(bx, by + 13, 24, 2);
}

// 7. セーブポイント (光る魔法陣)
function drawSavePoint(ctx, ox, oy, frameIndex) {
  // 地面ベース
  noiseRect(ctx, ox, oy, TILE, TILE, '#9A8A7A', 6);
  // 魔法陣の光 (パルス)
  const pulse = frameIndex === 0 ? 0.6 : 0.9;
  // 円形の光
  const cx = ox + 16, cy = oy + 16;
  for (let dy = -12; dy <= 12; dy++) {
    for (let dx = -12; dx <= 12; dx++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= 12 && dist >= 10) {
        ctx.fillStyle = `rgba(100,200,255,${pulse * 0.7})`;
        ctx.fillRect(cx + dx, cy + dy, 1, 1);
      } else if (dist < 10 && dist >= 6) {
        const alpha = pulse * 0.3 * (1 - (dist - 6) / 4);
        ctx.fillStyle = `rgba(150,220,255,${alpha})`;
        ctx.fillRect(cx + dx, cy + dy, 1, 1);
      } else if (dist < 6) {
        ctx.fillStyle = `rgba(200,240,255,${pulse * 0.4})`;
        ctx.fillRect(cx + dx, cy + dy, 1, 1);
      }
    }
  }
  // 魔法陣の模様 (十字)
  ctx.fillStyle = `rgba(150,230,255,${pulse})`;
  ctx.fillRect(cx - 1, cy - 11, 2, 22);
  ctx.fillRect(cx - 11, cy - 1, 22, 2);
  // 対角線
  for (let i = -8; i <= 8; i++) {
    ctx.fillRect(cx + i, cy + i, 1, 1);
    ctx.fillRect(cx + i, cy - i, 1, 1);
  }
  // 中心の光
  ctx.fillStyle = `rgba(255,255,255,${pulse})`;
  ctx.fillRect(cx - 1, cy - 1, 2, 2);
}

// 8. 草 (春の草花)
function drawGrass(ctx, ox, oy) {
  // 地面
  noiseRect(ctx, ox, oy, TILE, TILE, '#6A9A4A', 12);
  // 草の束
  const grassColors = ['#5A8A3A', '#7AAA5A', '#4A7A2A', '#8ABA6A'];
  for (let i = 0; i < 15; i++) {
    const gx = ox + (Math.random() * 28) | 0 + 2;
    const gy = oy + (Math.random() * 20) | 0 + 10;
    const gc = grassColors[(Math.random() * 4) | 0];
    ctx.fillStyle = gc;
    ctx.fillRect(gx, gy, 1, -((Math.random() * 6) | 0 + 3));
    ctx.fillRect(gx + 1, gy, 1, -((Math.random() * 4) | 0 + 2));
  }
  // 花
  const flowerColors = ['#FFB7C5', '#FF69B4', '#FFC0CB', '#FFFFFF'];
  for (let i = 0; i < 4; i++) {
    const fx = ox + (Math.random() * 26) | 0 + 3;
    const fy = oy + (Math.random() * 14) | 0 + 6;
    ctx.fillStyle = flowerColors[(Math.random() * 4) | 0];
    ctx.fillRect(fx, fy, 2, 2);
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(fx, fy, 1, 1);
  }
}

// 9. 桜の木 (満開)
function drawSakuraTree(ctx, ox, oy) {
  // 地面
  noiseRect(ctx, ox, oy + 24, TILE, 8, '#6A9A4A', 10);
  // 幹
  ctx.fillStyle = '#6B3A1F';
  ctx.fillRect(ox + 13, oy + 14, 6, 16);
  ctx.fillStyle = '#8B5A3F';
  ctx.fillRect(ox + 14, oy + 14, 4, 16);
  // 幹のハイライト
  ctx.fillStyle = '#9B6A4F';
  ctx.fillRect(ox + 14, oy + 16, 1, 10);
  // 根元
  ctx.fillStyle = '#5B2A0F';
  ctx.fillRect(ox + 11, oy + 28, 10, 3);

  // 桜の花冠 (楕円形のピンク)
  const crownColors = ['#FFB7C5', '#FFC0CB', '#FF99B4', '#FFAABB'];
  const ccx = ox + 16, ccy = oy + 8;
  for (let dy = -8; dy <= 6; dy++) {
    for (let dx = -13; dx <= 13; dx++) {
      const dist = (dx * dx) / (13 * 13) + (dy * dy) / (7 * 7);
      if (dist <= 1) {
        const ci = ((dx + dy + 30) % 4);
        ctx.fillStyle = crownColors[ci];
        if (Math.random() > 0.15) {
          ctx.fillRect(ccx + dx, ccy + dy, 1, 1);
        }
      }
    }
  }
  // 花冠の輪郭 (少し暗い)
  ctx.fillStyle = '#DD8899';
  for (let dy = -8; dy <= 6; dy++) {
    for (let dx = -13; dx <= 13; dx++) {
      const dist = (dx * dx) / (13 * 13) + (dy * dy) / (7 * 7);
      if (dist > 0.85 && dist <= 1) {
        ctx.fillRect(ccx + dx, ccy + dy, 1, 1);
      }
    }
  }
  // ハイライト (左上)
  ctx.fillStyle = '#FFD5DD';
  for (let dy = -6; dy <= -2; dy++) {
    for (let dx = -10; dx <= -4; dx++) {
      const dist = (dx * dx) / (13 * 13) + (dy * dy) / (7 * 7);
      if (dist <= 0.5 && Math.random() > 0.4) {
        ctx.fillRect(ccx + dx, ccy + dy, 1, 1);
      }
    }
  }
}

// 10. 柵 (木の柵)
function drawFence(ctx, ox, oy) {
  // 地面
  noiseRect(ctx, ox, oy + 24, TILE, 8, '#6A9A4A', 10);
  // 横桟
  ctx.fillStyle = '#9B7A5A';
  ctx.fillRect(ox, oy + 10, TILE, 3);
  ctx.fillRect(ox, oy + 20, TILE, 3);
  // 横桟ハイライト
  ctx.fillStyle = '#AB8A6A';
  ctx.fillRect(ox, oy + 10, TILE, 1);
  ctx.fillRect(ox, oy + 20, TILE, 1);
  // 縦の支柱
  for (let i = 0; i < 4; i++) {
    const px = ox + 2 + i * 8;
    ctx.fillStyle = '#7B5A3A';
    ctx.fillRect(px, oy + 4, 4, 22);
    ctx.fillStyle = '#8B6A4A';
    ctx.fillRect(px + 1, oy + 4, 2, 22);
    // 上端の飾り
    ctx.fillStyle = '#9B7A5A';
    ctx.fillRect(px, oy + 3, 4, 2);
    ctx.fillRect(px + 1, oy + 2, 2, 2);
  }
}

// ==========================================
// メイン
// ==========================================
function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // タイル配置:
  // 0: 床  1: 壁  2: 水f0  3: 水f1  4: 水f2
  // 5: 扉  6: 宝箱(閉)  7: 宝箱(開)
  // 8: セーブf0  9: セーブf1  10: 草  11: 桜の木  12: 柵
  // 合計13タイル = 416 x 32

  const TOTAL_TILES = 13;
  const canvas = createCanvas(TILE * TOTAL_TILES, TILE);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // シードを固定して再現性を確保
  let idx = 0;
  drawFloor(ctx, idx * TILE, 0); idx++;        // 0
  drawWall(ctx, idx * TILE, 0); idx++;          // 1
  drawWater(ctx, idx * TILE, 0, 0); idx++;      // 2
  drawWater(ctx, idx * TILE, 0, 1); idx++;      // 3
  drawWater(ctx, idx * TILE, 0, 2); idx++;      // 4
  drawDoor(ctx, idx * TILE, 0); idx++;           // 5
  drawChestClosed(ctx, idx * TILE, 0); idx++;    // 6
  drawChestOpen(ctx, idx * TILE, 0); idx++;      // 7
  drawSavePoint(ctx, idx * TILE, 0, 0); idx++;   // 8
  drawSavePoint(ctx, idx * TILE, 0, 1); idx++;   // 9
  drawGrass(ctx, idx * TILE, 0); idx++;          // 10
  drawSakuraTree(ctx, idx * TILE, 0); idx++;     // 11
  drawFence(ctx, idx * TILE, 0); idx++;          // 12

  const outPath = path.join(OUTPUT_DIR, 'spring_tiles.png');
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outPath, buffer);
  console.log(`  生成: ${outPath}`);
  console.log('タイルセット生成完了!');
  console.log(`  タイルインデックス:`);
  console.log(`    0: 床  1: 壁  2-4: 水(3フレーム)  5: 扉`);
  console.log(`    6: 宝箱(閉)  7: 宝箱(開)  8-9: セーブ(2フレーム)`);
  console.log(`    10: 草  11: 桜の木  12: 柵`);
}

main();
