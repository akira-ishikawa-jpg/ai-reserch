# HD-2D 統一ビジュアル設計書 — 四季廻りの職人

> **ビジュアルコンセプト（一文定義）:**
> 「やわらかな陽光が桜の花弁を透かし、石畳に揺れる影が呼吸するように動く——ピクセルの職人たちが"本物の空気"の中に立つミニチュアジオラマ」

---

## 目次

1. [カメラ設計](#1-カメラ設計)
2. [レイヤー構造](#2-レイヤー構造)
3. [ライティングシステム](#3-ライティングシステム)
4. [カラーパレット](#4-カラーパレット)
5. [素材表現ガイド](#5-素材表現ガイド)
6. [大気効果](#6-大気効果)
7. [実装ロードマップ](#7-実装ロードマップ)

---

## 1. カメラ設計

### 1.1 視点角度

| パラメータ | 値 | 根拠 |
|-----------|-----|------|
| 俯瞰角度 | 30° (地面から測定) | 3/4ビューの標準。タイル上面が見え、壁の正面も見える |
| 水平回転 | 0° (固定・真正面) | 2Dタイルマップとの整合性 |
| 画角 (FOV相当) | 狭い（望遠レンズ的圧縮） | 奥行きが圧縮され、ジオラマ感が出る |

**カメラから見た世界の見え方:**
- 地面のタイルは「少し上から見下ろした菱形」ではなく、現行の正方形グリッドを維持する（Canvas 2D制約）
- 代わりに **壁の上面描画（3px）** と **影の方向統一** で3/4ビューの錯覚を生成する
- キャラクターは常にカメラ正面を向いた2Dスプライト（ビルボード方式）

### 1.2 被写界深度 (DOF)

カメラのピントは**画面縦方向の中央40%** に合っている。上下に向かって徐々にボケる。

| ゾーン | 画面Y範囲 | ぼかし量 (BlurFilter strength) | 不透明度マスク |
|--------|----------|-------------------------------|---------------|
| 上部DOF | 0% ～ 20% | 4.0 | 上端 alpha=1.0 → 20%地点 alpha=0.0 |
| フォーカスゾーン | 20% ～ 70% | 0 (シャープ) | — |
| 下部DOF | 70% ～ 100% | 3.5 | 70%地点 alpha=0.0 → 下端 alpha=0.9 |

```
実装値:
  topZoneHeight    = GAME_HEIGHT * 0.30  // 162px
  bottomZoneStart  = GAME_HEIGHT * 0.70  // 378px
  topBlurStrength  = 4
  bottomBlurStrength = 3.5
  topGradientStops   = [0: alpha=1.0, 0.33: alpha=0.7, 0.67: alpha=0.3, 1.0: alpha=0.0]
  bottomGradientStops = [0: alpha=0.0, 0.4: alpha=0.3, 0.8: alpha=0.7, 1.0: alpha=0.9]
```

**なぜ下部のボケが弱いか:** カメラは少し上から覗いている。下部（手前の地面）はカメラに近いが、チルトシフトでは「近すぎてボケる」のは上端ほど強くない。

### 1.3 画面構成比

```
960 x 540 (16:9) @ 1x resolution

┌──────────────────────────────────────────────┐
│  DOF上部ゾーン (0-108px, 20%)                │  ← 遠景・空がボケる
│  ── ── ── ── ── ── ── ── ── ── ── ── ── ──  │
│                                              │
│  フォーカスゾーン (108-378px, 50%)            │  ← キャラ・タイル・NPC
│  プレイヤーキャラはY=250付近を基準に配置      │
│                                              │
│  ── ── ── ── ── ── ── ── ── ── ── ── ── ──  │
│  DOF下部ゾーン (378-540px, 30%)              │  ← 近景の地面がボケる
│  UIオーバーレイ領域 (440-540px)               │  ← 操作ヒント・メッセージ
└──────────────────────────────────────────────┘

ミニマップ: 右上 (x=855, y=10, 95x95px)
マップ名:  上部中央 (y=28-72)
```

---

## 2. レイヤー構造

画面の全要素を**最奥→最前面**の順にリスト化する。各レイヤーはCanvas 2Dで順番に描画し、PixiJSオーバーレイで後処理を重ねる。

### 2.1 探索シーン レイヤー構成

| Z順 | レイヤー名 | 内容 | パララックス係数 | ぼかし量 |
|-----|-----------|------|-----------------|---------|
| 0 | 空グラデーション | 季節に応じた空の色。上から下へ2色グラデーション | 0.0 (固定) | DOFで上部がボケる |
| 1 | 遠景山脈 | 2段の山シルエット。大気遠近法で色が薄い | 0.1 | DOF上部でボケる |
| 2 | 遠景樹木 | 山の手前の木のシルエット | 0.15 | DOF上部でボケる |
| 3 | 霧レイヤー (遠) | 遠景と中景の間に薄い霧 | 0.2 | — |
| 4 | 中景タイル | 地面・壁・水・ドア・入口。プレイヤーと同じ平面 | 1.0 (カメラ追従) | なし (フォーカス) |
| 5 | タイル装飾 | 草の束・ひび割れ・苔。タイル上に重ねる | 1.0 | なし |
| 6 | セーブポイント | 光柱 + 軌道パーティクル | 1.0 | なし |
| 7 | 宝箱 | 宝箱スプライト + グロー | 1.0 | なし |
| 8 | NPCスプライト | ピクセルキャラ + 名前ラベル | 1.0 | なし |
| 9 | 敵シンボル | ピクセルキャラ + 赤オーラ | 1.0 | なし |
| 10 | プレイヤー | ピクセルキャラ + 季節オーラ | 1.0 | なし |
| 11 | 季節パーティクル | 桜花弁・蛍・紅葉・雪 | 0.8-1.2 (大きさで変動) | なし |
| 12 | 近景装飾 | 画面手前に被る木の枝・草 (将来) | 1.5 | DOF下部でボケる |
| 13 | 霧レイヤー (近) | 近景の薄い靄 | 1.3 | — |
| 14 | UI | ミニマップ・マップ名・メッセージ・操作ヒント | 0.0 (固定) | なし |
| 15 | PixiJSオーバーレイ: DOF | 上下のチルトシフトぼかし | — | 前述 |
| 16 | PixiJSオーバーレイ: ビネット | 四隅が暗くなる放射グラデーション | — | — |
| 17 | PixiJSオーバーレイ: 季節ティント | 画面全体に薄い季節色 (ADD) | — | — |
| 18 | PixiJSオーバーレイ: エッジグロー | 四隅から季節色の柔らかい光 (ADD) | — | — |

### 2.2 バトルシーン レイヤー構成

| Z順 | レイヤー名 | 内容 | パララックス係数 | ぼかし量 |
|-----|-----------|------|-----------------|---------|
| 0 | 空グラデーション | 季節の空 | 0.0 | DOF上部 |
| 1 | 遠景山脈2段 | シルエット山 | 0.0 (固定カメラ) | DOF上部 |
| 2 | 遠景樹木 | 木のシルエット列 | 0.0 | DOF上部 |
| 3 | 霧レイヤー (遠) | 山と野原の間の霧 | 0.0 | — |
| 4 | 中景フィールド | 野原グラデーション | 0.0 | なし |
| 5 | 季節装飾 | 桜の木 / ススキ / 雪原ディテール | 0.0 | なし |
| 6 | バトルグラウンド | 戦闘フィールドの地面 | 0.0 | なし |
| 7 | 敵スプライト | ピクセルキャラ (スケール4) | 0.0 | なし |
| 8 | 味方スプライト | ピクセルキャラ (スケール4) | 0.0 | なし |
| 9 | バトルエフェクト | ダメージ数値・スキルエフェクト | 0.0 | なし |
| 10 | 季節パーティクル | 花弁・蛍・紅葉・雪 | — | なし |
| 11 | UIパネル | ステータス・コマンドメニュー・メッセージ | 0.0 | なし |
| 12-18 | PixiJSオーバーレイ | 探索シーンと同一 | — | — |

### 2.3 パララックス実装 (Canvas 2D)

```javascript
// 探索シーン: カメラ座標に係数を掛けて各レイヤーのオフセットを計算
function getLayerOffset(cameraX, cameraY, parallaxFactor) {
  return {
    x: Math.floor(cameraX * parallaxFactor),
    y: Math.floor(cameraY * parallaxFactor),
  };
}

// 例: 遠景山脈 (parallax=0.1)
// カメラが100px右に動くと、山は10pxしか動かない → 遠くに見える
```

---

## 3. ライティングシステム

### 3.1 グローバルライト

全てのシーンで共通する「太陽/月」の方向。全ての影・ハイライトがこの方向に従う。

| パラメータ | 値 | 説明 |
|-----------|-----|------|
| 光源方向 | **左上 (315°)** → 右下へ影が落ちる | 画面左上に太陽がある想定 |
| 仰角 | 45° | 影の長さ = オブジェクトの高さ × 1.0 |
| 昼光色 | `#FFF8F0` (暖白) | 春の柔らかい日光 |
| 光の強度 | 0.85 (0-1) | 直射光はやや控えめ、アンビエントが効く |
| アンビエント色 | `#E8E0F0` (薄紫) | 空からの散乱光。影が真っ黒にならない |
| アンビエント強度 | 0.35 | 影の中でも形が見える |

**影のルール (全オブジェクト共通):**

```
影の方向: 右下 (+x, +y)
影のオフセット:
  - 壁の影: dx=+3px, dy=+3px (壁の厚み分)
  - キャラクターの影: 楕円、足元に dx=+2px
  - 小物の影: dx=+1px, dy=+1px
影の色: rgba(20, 10, 30, 0.25) — 純黒ではなく暗い紫（空のアンビエントが混ざる）
影のぼかし: なし（ピクセルアートなのでシャープ）
```

### 3.2 エリア別ライティング

#### 花煙国・霞花里（町）

```
光源タイプ: グローバルライト（太陽）のみ + 建物内の暖色ポイントライト
太陽色: #FFF8F0
太陽強度: 0.85

ポイントライト一覧:
  - 薬師ギルド内部: (x=2, y=8), color=#FFE4B5, radius=96px, intensity=0.3
  - 宿屋内部: (x=23, y=10), color=#FFDAB9, radius=96px, intensity=0.35
  - 花市場: (x=2, y=16), color=#FFB7C5, radius=64px, intensity=0.2
  - セーブポイント: (x=13, y=12), color=#7FFFD4, radius=80px, intensity=0.4

アンビエントオクルージョン (AO):
  - 壁の根元: 壁タイルに隣接する床タイルの壁側2pxを暗くする
    → rgba(20, 10, 30, 0.15) のグラデーション (2px幅)
  - 建物の角: L字/T字の壁交差点の床タイルに暗い三角を追加
    → rgba(20, 10, 30, 0.12)
  - 水面際: 水タイルに隣接する床の1pxを暗く
    → rgba(10, 20, 40, 0.10)
```

#### 千年桜の洞（ダンジョン）

```
光源タイプ: 自然光なし。天井から差し込む光 + 発光する桜 + セーブポイント

天井光 (疑似ゴッドレイ):
  - 入口エリア (y=18付近): 上から斜め30°の光筋
    color=#FFE8D0, width=48px, alpha=0.15
  - 中央広間 (y=8-9): 天井の穴から真下に光
    color=#FFF0E0, radius=64px, alpha=0.2

発光する桜の根 (壁タイル装飾):
  - 壁タイル20%にランダムで付与
  - color=#FFB7C5, radius=24px, alpha=0.08
  - 脈動: sin(time/2000) * 0.03 を alpha に加算

水面の反射光 (コースティクス):
  - 水タイル (y=12-13) からの反射が天井（壁タイル上部）に揺れる模様
  - color=#6495ED, alpha=0.06, 波紋パターン

セーブポイント:
  - color=#7FFFD4, radius=80px, intensity=0.5
  - 光柱: 縦方向のグロー (幅16px, 高さ96px, alpha=0.3)

アンビエントオクルージョン:
  - 全ての壁-床境界: rgba(10, 5, 20, 0.25) (町より強い)
  - 通路の狭い部分: 壁が近いほどAOが強い
  - 計算: AO強度 = min(0.3, 壁との距離が2タイル以内なら 0.15/距離)
```

#### バトル（春フィールド）

```
光源タイプ: グローバルライト（空からの拡散光） + 季節グロー

空光色: #FFE0EC (春の暖かいピンクがかった白)
空光方向: 真上やや左 (影は短め、仰角60°)
空光強度: 0.9

季節グロー:
  - 画面中央 (y=180), radius=400px
  - color=#FFB7C5 (spring primary)
  - alpha: 0.08 + sin(time/2000) * 0.04 — ゆっくり明滅

ユニットの影:
  - 味方キャラ: 楕円 (rx=幅*0.35, ry=3), color=rgba(0,0,0,0.2)
  - 敵キャラ: 同上
  - 影の方向: 若干右下 (dx=+1px) — グローバルライトに従う

スキルエフェクト時の臨時光源:
  - 春スキル発動時: 発動者の位置に color=#FFB7C5, radius=120px, alpha=0.3 を 0.5秒間点灯
  - 画面シェイク時: 全体の明度を一瞬 +10% してから戻す (2フレーム)
```

### 3.3 影の描画仕様

全てのオブジェクトに適用する統一ルール:

```javascript
// 影の基本パラメータ
const SHADOW = {
  color: 'rgba(20, 10, 30, 0.25)',   // 暗紫色の半透明
  offsetX: 3,                          // 右方向
  offsetY: 3,                          // 下方向
  wallThickness: 3,                    // 壁の上面厚み (px)
};

// 壁タイルの影 (右辺と下辺に落ちる)
function drawWallShadow(ctx, sx, sy, tileSize) {
  ctx.fillStyle = SHADOW.color;
  // 右辺の影 (次のタイルが床なら)
  ctx.fillRect(sx + tileSize, sy + SHADOW.offsetY, SHADOW.offsetX, tileSize);
  // 下辺の影 (次のタイルが床なら)
  ctx.fillRect(sx + SHADOW.offsetX, sy + tileSize, tileSize, SHADOW.offsetY);
}

// キャラクターの足元影
function drawCharShadow(ctx, cx, cy, width) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.beginPath();
  ctx.ellipse(cx + width/2 + 2, cy + height, width * 0.35, 3, 0, 0, Math.PI * 2);
  ctx.fill();
}
```

---

## 4. カラーパレット

各エリアのパレットは**主要3色 + アクセント2色**で構成する。全ての描画はこのパレットから派生させる。

### 4.1 花煙国・霞花里（春の町）

| 役割 | 色名 | Hex | 用途 |
|------|------|-----|------|
| **主要1** | 霞桜 (Kasumi-zakura) | `#E8D5B7` | 石畳・建物の壁面。温かみのある砂色 |
| **主要2** | 花白 (Hana-shiro) | `#FFF0F5` | 空の色・UIの背景。桜が溶け込んだ白 |
| **主要3** | 深苔 (Fuka-koke) | `#8B7355` | 壁・柱・屋根。土壁の落ち着いた茶 |
| **アクセント1** | 桜霞 (Sakura-gasumi) | `#FFB7C5` | 桜パーティクル・季節オーラ・セーブポイント光 |
| **アクセント2** | 春水 (Haru-mizu) | `#6495ED` | 水路・泉。澄んだ春の水色 |

**派生色ルール:**
```
ハイライト: 主要色 + RGB各 +30 (最大255)
シャドウ:   主要色 + RGB各 -20
AO影色:    rgba(20, 10, 30, 0.15) — 全タイル共通
壁の上面:  主要3 + lighten(30) = #A5936F
壁の右面:  主要3 + darken(20) = #6B5335
```

### 4.2 千年桜の洞（春のダンジョン）

| 役割 | 色名 | Hex | 用途 |
|------|------|-----|------|
| **主要1** | 洞苔 (Hora-koke) | `#A0926B` | 洞窟の床。苔むした石の色 |
| **主要2** | 深洞 (Shin-hora) | `#5C4033` | 壁。暗い岩肌 |
| **主要3** | 闇底 (Yami-soko) | `#3C2415` | 深部の壁。より暗い岩 |
| **アクセント1** | 桜根 (Sakura-ne) | `#FFB7C5` | 壁に這う発光する桜の根 |
| **アクセント2** | 洞水 (Hora-mizu) | `#4682B4` | 地下水脈。深い青 |

**派生色ルール:**
```
床ハイライト:  #B0A27B (主要1 + lighten 16)
床シャドウ:    #908262 (主要1 + darken 16)
壁ハイライト:  #7C5A43 (主要2 + lighten 32)
壁AO:         rgba(10, 5, 20, 0.25) — ダンジョンは暗いのでAOが強い
桜根の脈動:   #FFB7C5 alpha 0.08-0.11 (sin波)
```

### 4.3 バトル（春フィールド）

| 役割 | 色名 | Hex | 用途 |
|------|------|-----|------|
| **主要1** | 春空 (Haru-zora) | `#FFE0EC` | 空のグラデーション上部 |
| **主要2** | 若草 (Waka-kusa) | `#C8E6B0` | 野原。明るい春の緑 |
| **主要3** | 深草 (Fuka-kusa) | `#8BB870` | バトルグラウンド。濃い緑 |
| **アクセント1** | 桜霞 (Sakura-gasumi) | `#FFB7C5` | 桜の木・パーティクル・スキルエフェクト |
| **アクセント2** | 山霞 (Yama-gasumi) | `rgba(180,200,160,0.5)` | 遠景山脈。大気遠近法で薄い |

**バトル背景のグラデーション構成:**
```
Y=0   → Y=200:   #FFE0EC → #FFDAE8  (空)
Y=200 → Y=230:   山のシルエット (rgba(180,200,160,0.5) / rgba(120,160,100,0.5))
Y=230 → Y=235:   木のシルエット (rgba(100,160,80,0.55))
Y=230 → Y=380:   #C8E6B0 → #A8D490  (野原)
Y=350 → Y=410:   #8BB870 → #2A2A3A  (戦闘地面)
Y=410 → Y=540:   #1A1A2A (暗闘: UIパネル領域)
```

---

## 5. 素材表現ガイド

各素材の描画手順を**Canvas 2Dのコードレベル**で定義する。全ての素材はグローバルライト（左上315°）に従う。

### 5.1 石畳（床タイル）

**見た目の目標:** 使い込まれた石畳。目地がわずかに暗く、表面に日光のハイライトが当たる。

```javascript
function drawFloorTile(ctx, sx, sy, tileSize, baseColor, seed) {
  // 1. ベース色で塗りつぶし
  ctx.fillStyle = baseColor; // #E8D5B7 (霞花里)
  ctx.fillRect(sx, sy, tileSize, tileSize);

  // 2. 石のグリッド模様（目地）
  //    4x4の小石に分割。目地はベース色 -20の暗色で1px線
  const gridSize = tileSize / 4; // = 8px
  ctx.strokeStyle = darkenColor(baseColor, 20); // #D4C1A3
  ctx.lineWidth = 1;
  for (let gx = 1; gx < 4; gx++) {
    // 縦線（わずかにずらしてランダム感を出す）
    const offset = (seededRandom(seed + gx) - 0.5) * 1;
    ctx.beginPath();
    ctx.moveTo(sx + gx * gridSize + offset, sy);
    ctx.lineTo(sx + gx * gridSize + offset, sy + tileSize);
    ctx.stroke();
  }
  for (let gy = 1; gy < 4; gy++) {
    const offset = (seededRandom(seed + gy + 100) - 0.5) * 1;
    ctx.beginPath();
    ctx.moveTo(sx, sy + gy * gridSize + offset);
    ctx.lineTo(sx + tileSize, sy + gy * gridSize + offset);
    ctx.stroke();
  }

  // 3. 左上ハイライト（グローバルライトが左上から当たる）
  //    各小石の左上2pxにハイライト
  ctx.fillStyle = lightenColor(baseColor, 25); // #FFF0D0 付近
  for (let gx = 0; gx < 4; gx++) {
    for (let gy = 0; gy < 4; gy++) {
      if (seededRandom(seed + gx * 10 + gy) > 0.4) {
        ctx.fillRect(sx + gx * gridSize + 1, sy + gy * gridSize + 1, 2, 1);
        ctx.fillRect(sx + gx * gridSize + 1, sy + gy * gridSize + 2, 1, 1);
      }
    }
  }

  // 4. 右下シャドウ（各小石の右下1px）
  ctx.fillStyle = darkenColor(baseColor, 15);
  for (let gx = 0; gx < 4; gx++) {
    for (let gy = 0; gy < 4; gy++) {
      if (seededRandom(seed + gx * 10 + gy + 50) > 0.5) {
        ctx.fillRect(sx + (gx + 1) * gridSize - 2, sy + (gy + 1) * gridSize - 1, 2, 1);
      }
    }
  }

  // 5. 色ムラ（石ごとにわずかに色が違う）
  for (let gx = 0; gx < 4; gx++) {
    for (let gy = 0; gy < 4; gy++) {
      const variation = (seededRandom(seed + gx * 7 + gy * 13) - 0.5) * 10;
      if (Math.abs(variation) > 3) {
        ctx.fillStyle = variation > 0
          ? lightenColor(baseColor, Math.abs(variation))
          : darkenColor(baseColor, Math.abs(variation));
        ctx.globalAlpha = 0.3;
        ctx.fillRect(sx + gx * gridSize + 1, sy + gy * gridSize + 1, gridSize - 2, gridSize - 2);
        ctx.globalAlpha = 1.0;
      }
    }
  }
}
```

### 5.2 壁（建物・洞窟壁）

**見た目の目標:** 上から見ると壁の上面が3px見え、正面は影が落ちている。3D感を錯覚させる。

```javascript
function drawWallTile(ctx, sx, sy, tileSize, baseColor, seed, neighbors) {
  const wallLight = lightenColor(baseColor, 30); // 壁の上面（光が当たる）
  const wallDark = darkenColor(baseColor, 20);   // 壁の右面・下面
  const wallBase = baseColor;                     // 壁の正面

  // 1. 正面をベース色で塗り
  ctx.fillStyle = wallBase;
  ctx.fillRect(sx, sy, tileSize, tileSize);

  // 2. 上面（3px厚）— 光が直接当たるのでハイライト
  //    ただし上のタイルも壁なら描画しない
  if (!neighbors.top) {
    // 上面グラデーション (明→暗)
    const topGrad = ctx.createLinearGradient(sx, sy, sx, sy + 3);
    topGrad.addColorStop(0, wallLight);
    topGrad.addColorStop(1, wallBase);
    ctx.fillStyle = topGrad;
    ctx.fillRect(sx, sy, tileSize, 3);
  }

  // 3. 左端ハイライト (1px) — 光は左上から
  if (!neighbors.left) {
    ctx.fillStyle = lightenColor(baseColor, 15);
    ctx.fillRect(sx, sy, 1, tileSize);
  }

  // 4. 右端シャドウ (2px) — 光の反対側
  if (!neighbors.right) {
    ctx.fillStyle = wallDark;
    ctx.fillRect(sx + tileSize - 2, sy, 2, tileSize);
  }

  // 5. 下端シャドウ (2px)
  if (!neighbors.bottom) {
    ctx.fillStyle = wallDark;
    ctx.fillRect(sx, sy + tileSize - 2, tileSize, 2);
  }

  // 6. テクスチャ: 石のひび割れ（ランダム1-2本の斜め線）
  if (seededRandom(seed) > 0.6) {
    ctx.strokeStyle = darkenColor(baseColor, 12);
    ctx.lineWidth = 1;
    ctx.beginPath();
    const startX = sx + seededRandom(seed + 1) * tileSize * 0.6 + tileSize * 0.2;
    const startY = sy + seededRandom(seed + 2) * tileSize * 0.4;
    ctx.moveTo(startX, startY);
    ctx.lineTo(startX + seededRandom(seed + 3) * 8 - 4, startY + 8 + seededRandom(seed + 4) * 6);
    ctx.stroke();
  }

  // 7. ダンジョン壁の場合: 桜の根の発光（20%の確率）
  // → 「桜根」セクションで別途描画
}
```

### 5.3 水（水路・泉・地下水脈）

**見た目の目標:** 水面が呼吸するように揺れ、光が反射してスペキュラハイライトがちらつく。周囲の色を薄く映す。

```javascript
function drawWaterTile(ctx, sx, sy, tileSize, baseColor, time) {
  // 1. ベース色（深い水色）
  ctx.fillStyle = baseColor; // #6495ED (霞花里) / #4682B4 (ダンジョン)
  ctx.fillRect(sx, sy, tileSize, tileSize);

  // 2. 暗い部分（深さの表現）— ベース色を暗くしたグラデーション
  const deepGrad = ctx.createLinearGradient(sx, sy, sx, sy + tileSize);
  deepGrad.addColorStop(0, lightenColor(baseColor, 15));
  deepGrad.addColorStop(0.6, baseColor);
  deepGrad.addColorStop(1, darkenColor(baseColor, 20));
  ctx.fillStyle = deepGrad;
  ctx.fillRect(sx, sy, tileSize, tileSize);

  // 3. 波紋（水平の波線を3本、sin波で揺らす）
  ctx.strokeStyle = lightenColor(baseColor, 40); // 波の山は明るい
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.4;
  for (let waveIdx = 0; waveIdx < 3; waveIdx++) {
    const waveY = sy + 6 + waveIdx * 10;
    const phase = time / 800 + waveIdx * 2.1;
    ctx.beginPath();
    for (let wx = 0; wx < tileSize; wx += 2) {
      const wy = waveY + Math.sin((sx + wx) * 0.15 + phase) * 2;
      if (wx === 0) ctx.moveTo(sx + wx, wy);
      else ctx.lineTo(sx + wx, wy);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1.0;

  // 4. スペキュラハイライト（小さな白い点が移動する）
  //    グローバルライトが左上から → 反射点は右下寄りに集中
  ctx.fillStyle = '#FFFFFF';
  for (let si = 0; si < 3; si++) {
    const specX = sx + 16 + Math.sin(time / 600 + si * 3.7) * 10;
    const specY = sy + 10 + Math.cos(time / 500 + si * 2.3) * 8;
    const specAlpha = 0.15 + 0.15 * Math.sin(time / 300 + si * 5);
    ctx.globalAlpha = specAlpha;
    ctx.fillRect(Math.floor(specX), Math.floor(specY), 2, 1);
    ctx.fillRect(Math.floor(specX) + 1, Math.floor(specY) + 1, 1, 1);
  }
  ctx.globalAlpha = 1.0;

  // 5. 岸辺の反射（隣接タイルの色が水面に薄く映る）
  //    → 上のタイルが石畳なら #E8D5B7 を alpha 0.08 で上部6pxに重ねる
  // （neighbors情報が必要。実装時にdrawTiles内で処理）

  // 6. 水面の端（暗い線で区切る）
  ctx.strokeStyle = darkenColor(baseColor, 30);
  ctx.lineWidth = 1;
  ctx.strokeRect(sx + 0.5, sy + 0.5, tileSize - 1, tileSize - 1);
}
```

### 5.4 木材（ドア・宝箱）

**見た目の目標:** 木目の温かみ。光が当たる面は明るい茶、影は深い焦げ茶。金属パーツは鋭いハイライト。

```javascript
// 宝箱の描画パラメータ
const CHEST_STYLE = {
  body: {
    base:      '#8B6914',  // 木の本体
    highlight: '#A07B1E',  // 左上面ハイライト
    shadow:    '#6B4E0A',  // 右下面シャドウ
    grain: [               // 木目線 (横方向)
      { y: 0.3, color: '#7A5C0F', alpha: 0.3 },
      { y: 0.6, color: '#7A5C0F', alpha: 0.25 },
      { y: 0.8, color: '#6B4E0A', alpha: 0.2 },
    ],
  },
  lid: {
    base:      '#9A7818',  // 蓋（本体より少し明るい）
    topEdge:   '#B8921F',  // 蓋の上端ハイライト
    thickness: 5,           // 蓋の厚み (px)
  },
  metal: {
    clasp:     '#DAA520',  // 金属パーツ
    highlight: '#FFD700',  // スペキュラハイライト（1px白点）
    shadow:    '#8B7500',  // 金属の影
  },
  glow: {
    closed:    { color: '#FFD700', radius: 20, alpha: 0.15 },
    open:      null,       // 開封済みはグローなし
  },
};

// ドアの描画パラメータ
const DOOR_STYLE = {
  base:     '#CD853F',  // ドア本体
  frame:    '#8B6914',  // 枠
  plank:    [            // 板の分割線 (縦方向)
    { x: 0.33, color: '#A0692A', alpha: 0.4 },
    { x: 0.66, color: '#A0692A', alpha: 0.4 },
  ],
  handle:   '#DAA520',  // 取っ手
  handleHighlight: '#FFD700',
  shadow:   '#8B5A2B',  // ドア下の影
};
```

### 5.5 草花

**見た目の目標:** 地面から生える小さな草の束が風に揺れ、日光が葉を透過して明るく見える。花はアクセントカラー。

```javascript
function drawGrassDecoration(ctx, sx, sy, tileSize, season, time, seed) {
  // 草は床タイルの上に30%の確率で配置
  if (seededRandom(seed) > 0.3) return;

  const grassColors = {
    spring: { blade: '#6B8E23', tip: '#90B030', flower: '#FFB7C5' },
    summer: { blade: '#228B22', tip: '#32CD32', flower: '#FFD700' },
    autumn: { blade: '#8B6914', tip: '#DAA520', flower: '#DC143C' },
    winter: { blade: '#708090', tip: '#B0C4DE', flower: null },
  };
  const gc = grassColors[season];

  // 草の揺れ（風に応じたsin波）
  const windPhase = time / 1200;
  const windStrength = 1.5; // px

  // 2-4本の草の葉を描画
  const bladeCount = 2 + Math.floor(seededRandom(seed + 10) * 3);
  for (let i = 0; i < bladeCount; i++) {
    const baseX = sx + 4 + seededRandom(seed + i * 7) * (tileSize - 8);
    const baseY = sy + tileSize - 2; // 地面から生える
    const height = 5 + seededRandom(seed + i * 3) * 6; // 5-11px
    const sway = Math.sin(windPhase + baseX * 0.1 + i) * windStrength;

    // 葉の根元（暗い）→ 先端（明るい: 光透過表現）
    ctx.strokeStyle = gc.blade;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.quadraticCurveTo(
      baseX + sway * 0.5, baseY - height * 0.5,
      baseX + sway, baseY - height
    );
    ctx.stroke();

    // 先端のハイライト（光透過）
    ctx.fillStyle = gc.tip;
    ctx.globalAlpha = 0.7;
    ctx.fillRect(Math.floor(baseX + sway), Math.floor(baseY - height), 1, 2);
    ctx.globalAlpha = 1.0;
  }

  // 花（10%の確率で配置、冬は無し）
  if (gc.flower && seededRandom(seed + 99) > 0.9) {
    const flowerX = sx + 8 + seededRandom(seed + 77) * (tileSize - 16);
    const flowerY = sy + tileSize - 8 - seededRandom(seed + 88) * 4;
    const sway = Math.sin(windPhase + flowerX * 0.08) * 1;

    // 花びら（3px の十字）
    ctx.fillStyle = gc.flower;
    ctx.fillRect(Math.floor(flowerX + sway) - 1, Math.floor(flowerY) - 1, 3, 1); // 横
    ctx.fillRect(Math.floor(flowerX + sway), Math.floor(flowerY) - 2, 1, 3);     // 縦

    // 花芯
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(Math.floor(flowerX + sway), Math.floor(flowerY) - 1, 1, 1);
  }
}
```

---

## 6. 大気効果

### 6.1 霧・靄

| エリア | 霧の種類 | 色 | 密度 (alpha) | Y範囲 | 動き |
|--------|---------|-----|-------------|-------|------|
| 霞花里（町） | 薄霧 | `rgba(255, 240, 245, α)` | 0.03-0.06 | 全画面 | sin(time/4000)*0.015 で明滅 |
| 千年桜の洞・入口 | 地面の靄 | `rgba(180, 170, 200, α)` | 0.08-0.15 | Y > 60% | sin(time/3000)*0.03 + 横移動 0.3px/f |
| 千年桜の洞・深部 | 濃霧 | `rgba(60, 40, 80, α)` | 0.12-0.20 | 全画面 | sin(time/2500)*0.04 |
| バトル（春） | 花霞 | `rgba(255, 183, 197, α)` | 0.04-0.08 | Y < 50% | sin(time/5000)*0.02 |

**実装:**
```javascript
function drawFog(ctx, type, time) {
  const configs = {
    town_spring: {
      color: [255, 240, 245],
      baseAlpha: 0.045,
      variation: 0.015,
      speed: 4000,
      yStart: 0,
      yEnd: GAME_HEIGHT,
      layers: 2,  // 2層重ねてリアルに
    },
    dungeon_entrance: {
      color: [180, 170, 200],
      baseAlpha: 0.11,
      variation: 0.03,
      speed: 3000,
      yStart: GAME_HEIGHT * 0.6,
      yEnd: GAME_HEIGHT,
      layers: 3,
      horizontalDrift: 0.3, // px per frame
    },
    dungeon_depths: {
      color: [60, 40, 80],
      baseAlpha: 0.16,
      variation: 0.04,
      speed: 2500,
      yStart: 0,
      yEnd: GAME_HEIGHT,
      layers: 3,
    },
    battle_spring: {
      color: [255, 183, 197],
      baseAlpha: 0.06,
      variation: 0.02,
      speed: 5000,
      yStart: 0,
      yEnd: GAME_HEIGHT * 0.5,
      layers: 1,
    },
  };

  const cfg = configs[type];
  if (!cfg) return;

  for (let layer = 0; layer < cfg.layers; layer++) {
    const alpha = cfg.baseAlpha + Math.sin(time / cfg.speed + layer * 1.5) * cfg.variation;
    const [r, g, b] = cfg.color;

    // 横ドリフト（あれば）
    const drift = cfg.horizontalDrift
      ? Math.sin(time / 2000 + layer * 2) * 20
      : 0;

    // グラデーションで上下にフェード
    const grad = ctx.createLinearGradient(0, cfg.yStart, 0, cfg.yEnd);
    grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
    grad.addColorStop(0.3, `rgba(${r},${g},${b},${alpha})`);
    grad.addColorStop(0.7, `rgba(${r},${g},${b},${alpha})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);

    ctx.fillStyle = grad;
    ctx.fillRect(drift, cfg.yStart, GAME_WIDTH, cfg.yEnd - cfg.yStart);
  }
}
```

### 6.2 ゴッドレイ（光芒）

ダンジョンの天井の隙間から差し込む光の筋。

| パラメータ | 値 |
|-----------|-----|
| 光源方向 | 左上 (315°) — グローバルライトと同一 |
| 角度 | 画面上から約 25° 傾いて右下へ |
| 幅 | 32-64px (rayごとに異なる) |
| 色 | `rgba(255, 240, 220, α)` — 暖白 |
| α (最大) | 0.12 |
| 断面形状 | 両端がフェードするグラデーション |
| 明滅 | sin(time/3000) * 0.04 |
| パーティクル | 光の筋の中にホコリ粒子を配置 |

```javascript
function drawGodRay(ctx, x, y, width, height, time) {
  // x, y: 光の筋の画面上端の中心座標
  // 光の筋は左上から右下に25°傾いている

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(25 * Math.PI / 180); // 25度右に傾ける

  const alpha = 0.08 + Math.sin(time / 3000) * 0.04;

  // 横方向のグラデーション（両端が透明）
  const grad = ctx.createLinearGradient(-width / 2, 0, width / 2, 0);
  grad.addColorStop(0, `rgba(255, 240, 220, 0)`);
  grad.addColorStop(0.3, `rgba(255, 240, 220, ${alpha})`);
  grad.addColorStop(0.5, `rgba(255, 240, 220, ${alpha * 1.2})`);
  grad.addColorStop(0.7, `rgba(255, 240, 220, ${alpha})`);
  grad.addColorStop(1, `rgba(255, 240, 220, 0)`);

  ctx.fillStyle = grad;
  ctx.fillRect(-width / 2, 0, width, height);

  ctx.restore();
}

// 千年桜の洞 — ゴッドレイ配置
const DUNGEON_GOD_RAYS = [
  // 入口付近: 大きな光の筋
  { x: 380, y: -20, width: 64, height: 300 },
  // 中央広間: 天井の穴から
  { x: 260, y: -10, width: 48, height: 250 },
  // 水場付近: 弱い光
  { x: 500, y: -10, width: 32, height: 200 },
];
```

### 6.3 パーティクル

現行の季節パーティクルシステムを拡張する。

| パーティクル種類 | エリア | 密度 (個/秒) | サイズ (px) | 特徴 |
|----------------|--------|-------------|-----------|------|
| 桜花弁 | 町・バトル・ダンジョン | 3-5/秒 | 3-6 | 花弁形状、風でsin波揺れ、ゆっくり落下 |
| 光の粒子 (ホコリ) | ダンジョン | 2/秒 | 1-2 | ゴッドレイ内のみ。ランダム浮遊、ちらつき |
| 水蒸気 | 水タイル付近 | 1/秒 | 2-4 | 半透明白。上昇→消滅。alpha 0.1-0.3 |
| 桜根の光粉 | ダンジョン壁付近 | 1/秒 | 1-2 | #FFB7C5。壁タイルから離散。alpha 0.2-0.4 |
| セーブ光球 | セーブポイント | 常時3個軌道 | 3-4 | 白。セーブポイント中心を公転 |

**ホコリパーティクル (ゴッドレイ内):**
```javascript
// 既存 addParticle を拡張
addDustParticle(godRayX, godRayY, godRayWidth, godRayHeight) {
  this.particles.push({
    x: godRayX + (Math.random() - 0.5) * godRayWidth,
    y: godRayY + Math.random() * godRayHeight,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.2,
    life: 120 + Math.random() * 120,
    maxLife: 240,
    size: 1 + Math.random(),
    color: '#FFF8E0',
    type: 'dust',
    flickerPhase: Math.random() * Math.PI * 2,
  });
}

// drawParticles内の分岐
if (p.type === 'dust') {
  const flicker = 0.3 + 0.7 * Math.abs(Math.sin(Date.now() / 200 + p.flickerPhase));
  ctx.globalAlpha = alpha * flicker;
  ctx.fillStyle = p.color;
  ctx.fillRect(Math.floor(p.x), Math.floor(p.y), Math.ceil(p.size), Math.ceil(p.size));
}
```

---

## 7. 実装ロードマップ

全要素を依存関係に基づいて順序付ける。各フェーズの品質基準を明確にする。

### Phase 1: 基盤（ライティング統一）

**目標:** 全ての影とハイライトが同一方向（左上315°→右下）を向く。

| # | タスク | 依存 | ファイル | 品質基準 |
|---|--------|------|---------|---------|
| 1.1 | グローバルライト定数を `constants.js` に追加 | なし | constants.js | `GLOBAL_LIGHT` オブジェクトが定義済み |
| 1.2 | `seededRandom()` ユーティリティ関数追加 | なし | renderer.js | タイル座標から再現可能なランダム値を返す |
| 1.3 | 壁タイル描画の3D化 (上面3px + 左ハイライト + 右下シャドウ) | 1.1 | exploration.js | 壁が「ブロック」に見える。隣接壁との繋がりが自然 |
| 1.4 | 床タイルの石畳テクスチャ (目地 + ハイライト + シャドウ) | 1.1, 1.2 | exploration.js | 石のグリッドが見え、左上が明るく右下が暗い |
| 1.5 | 壁→床へのAO影 (壁隣接の床2pxを暗く) | 1.3 | exploration.js | 壁の根元が暗くなり、「壁が地面に接している」感が出る |

**Phase 1 完了基準:** スクリーンショットで壁・床・影の方向が統一され、フラットな塗りではなくなっている。

### Phase 2: 水と素材

**目標:** 水が「液体」に見え、宝箱が「木と金属」に見える。

| # | タスク | 依存 | ファイル | 品質基準 |
|---|--------|------|---------|---------|
| 2.1 | 水タイル波紋アニメーション (sin波3本 + 深度グラデーション) | 1.1 | exploration.js | 水面が時間とともに揺れる |
| 2.2 | 水タイルのスペキュラハイライト (移動する白点) | 2.1 | exploration.js | 光が水面で反射してちらつく |
| 2.3 | 宝箱描画の刷新 (木目 + 金属パーツ + グロー) | 1.1 | exploration.js | 木の質感と金属の鋭いハイライトの対比 |
| 2.4 | ドアタイルの木材表現 | 1.1 | exploration.js | 板の分割線と取っ手が見える |
| 2.5 | 草花デコレーション (風揺れ + 光透過) | 1.2 | exploration.js | 床タイル上で草が揺れ、先端が光っている |

**Phase 2 完了基準:** 水が動き、宝箱に質感があり、地面に草が生えている。

### Phase 3: 大気と深度

**目標:** 空気が見え、奥行きが感じられる。

| # | タスク | 依存 | ファイル | 品質基準 |
|---|--------|------|---------|---------|
| 3.1 | 探索シーン: パララックスレイヤー分離 | なし | exploration.js | 遠景が遅くスクロールする |
| 3.2 | 霧レイヤー追加 (エリア別設定) | なし | exploration.js | 霞花里は薄霧、ダンジョン深部は濃霧 |
| 3.3 | ゴッドレイ描画 (ダンジョン) | なし | exploration.js | 天井から斜めの光筋が見える |
| 3.4 | ゴッドレイ内ホコリパーティクル | 3.3 | renderer.js | 光の筋の中で粒子がちらつく |
| 3.5 | 大気遠近法 (遠景の彩度・コントラスト低下) | 3.1 | exploration.js | 山が「遠くにある」ように見える |
| 3.6 | DOFパラメータ調整 (上部blur=4, 下部blur=3.5) | なし | pixi_renderer.js | ボケの強度が距離に比例し、自然に見える |

**Phase 3 完了基準:** 画面に「空気」を感じる。遠くが霞み、ダンジョンに光の筋が差し込む。

### Phase 4: ポイントライト

**目標:** 松明・ランタン・セーブポイントなどの局所光源が周囲を照らす。

| # | タスク | 依存 | ファイル | 品質基準 |
|---|--------|------|---------|---------|
| 4.1 | PointLightシステム構築 (radialGradient描画) | なし | renderer.js | 任意の座標に色付きの光を配置できる |
| 4.2 | 町のポイントライト配置 (薬師ギルド・宿屋) | 4.1 | exploration.js | 建物内部が暖色に照らされる |
| 4.3 | ダンジョンの桜根ライト (壁タイルの20%に発光) | 4.1, 1.2 | exploration.js | 壁がほんのりピンクに光る |
| 4.4 | セーブポイント光柱の刷新 | 4.1 | exploration.js | 既存の光柱が統一ライティングに合う |
| 4.5 | 光の色が周囲のタイルに影響 (カラーバウンス簡易版) | 4.1 | exploration.js | ポイントライト周囲のタイルが薄く色付く |

**Phase 4 完了基準:** 暗いダンジョンの中に光源があり、周囲を照らしている。町の建物内も暖かく光っている。

### Phase 5: バトル背景の品質向上

**目標:** バトル背景が「ジオラマの風景画」レベルになる。

| # | タスク | 依存 | ファイル | 品質基準 |
|---|--------|------|---------|---------|
| 5.1 | バトル背景の山脈に大気遠近法適用 | 3.5 | battle_scene.js | 2段の山が距離感を持つ |
| 5.2 | バトル背景の森シルエット改良 (木の形状バリエーション) | なし | battle_scene.js | 同じ丸の繰り返しではなく、自然な樹冠に見える |
| 5.3 | バトル地面にフロアテクスチャ (草 + 石) | 2.5 | battle_scene.js | 地面がフラットでなくなる |
| 5.4 | バトル背景の霧レイヤー | 3.2 | battle_scene.js | 遠景に花霞がかかる |
| 5.5 | スキルエフェクト時の臨時ライティング | 4.1 | battle_scene.js | スキル発動で画面が一瞬明るくなる |

**Phase 5 完了基準:** バトル中に背景をじっと見ても美しいと感じるレベル。

### Phase 6: 近景レイヤーとポリッシュ

**目標:** 画面全体がHD-2Dジオラマとして完成する。

| # | タスク | 依存 | ファイル | 品質基準 |
|---|--------|------|---------|---------|
| 6.1 | 近景レイヤー (手前の木の枝・草) | 3.1 | exploration.js | 画面下部に被る要素があり、DOFでボケる |
| 6.2 | 水蒸気パーティクル (水タイル付近) | 2.1 | renderer.js | 水面から湯気が立つ |
| 6.3 | 桜根光粉パーティクル (ダンジョン壁) | 4.3 | renderer.js | 壁から光の粉が離散する |
| 6.4 | ビネットの微調整 (中心のクリア範囲拡大) | なし | pixi_renderer.js | 中心35%→50%を完全クリアに |
| 6.5 | 季節ティント/エッジグローの微調整 | なし | pixi_renderer.js | 現行の値を本設計書の値に合わせる |
| 6.6 | 全エリアの最終カラーチューニング | 4.全 | constants.js, maps.js | パレット表の色コードと実装値が完全一致 |

**Phase 6 完了基準:** スクリーンショットをオクトパストラベラーと並べて、「ミニチュアジオラマの中にピクセルキャラがいる」感覚が伝わるレベル。

---

## 付録A: PixiJSオーバーレイ推奨パラメータ（現行値からの変更点）

```javascript
// pixi_renderer.js の推奨更新値

// 季節ティント — 現行維持（十分控えめ）
seasonTints: {
  spring: { color: 0xFFB4C8, alpha: 0.05 },
  summer: { color: 0xFFC864, alpha: 0.04 },
  autumn: { color: 0xC86432, alpha: 0.05 },
  winter: { color: 0x6496FF, alpha: 0.04 },
},

// エッジグロー — 現行維持
seasonGlow: {
  spring: { color: 0xFFB7C5, alpha: 0.08 },
  summer: { color: 0xFFD700, alpha: 0.06 },
  autumn: { color: 0xDC143C, alpha: 0.07 },
  winter: { color: 0x4169E1, alpha: 0.06 },
},

// DOF — 変更推奨
// topBlurStrength:    3 → 4     (上部ボケを少し強化)
// bottomBlurStrength: 3 → 3.5   (下部は控えめ強化)
// topZoneHeight:      30% → 30% (維持)
// bottomZoneHeight:   30% → 30% (維持)
// topGradient:        [0:1.0, 0.5:0.6, 1:0] → [0:1.0, 0.33:0.7, 0.67:0.3, 1:0] (より自然なフェード)
// bottomGradient:     [0:0, 0.5:0.6, 1:1.0] → [0:0, 0.4:0.3, 0.8:0.7, 1:0.9] (下端完全不透明を避ける)

// ビネット — 変更推奨
// 中心クリア範囲:  0.35 → 0.45  (もう少し中心を広く見せる)
// 最外部alpha:     0.4 → 0.35   (やや控えめに)
```

## 付録B: ユーティリティ関数

```javascript
// constants.js に追加

// グローバルライト設定
const GLOBAL_LIGHT = {
  direction: 315,           // 度数 (0=上, 90=右, 180=下, 270=左)
  elevation: 45,            // 仰角
  color: '#FFF8F0',         // 暖白
  intensity: 0.85,
  ambient: {
    color: '#E8E0F0',       // 薄紫
    intensity: 0.35,
  },
  shadow: {
    color: 'rgba(20, 10, 30, 0.25)',
    offsetX: 3,
    offsetY: 3,
  },
};

// 色操作ユーティリティ
function lightenColor(hex, amount) {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

function darkenColor(hex, amount) {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

// シード付き擬似乱数（タイル装飾用）
function seededRandom(seed) {
  const x = Math.sin(seed * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}
```

---

> **この設計書は実装の「真北」として機能する。迷ったときは「カメラから見た世界がどう見えるか」に立ち返ること。**
