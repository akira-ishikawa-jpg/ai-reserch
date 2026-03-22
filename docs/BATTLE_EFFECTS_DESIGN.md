# バトルエフェクト設計書 — 四季廻りの職人

> **基盤分析：** オクトパストラベラー（OT）のバトル演出体系
> **実装環境：** Godot 4 / GDScript / HD-2D スタイル

---

## 1. OT演出分析と本ゲームでの対応方針

### 1.1 カメラワーク

| OTの演出 | 本ゲームの対応 | 実装ファイル |
|---------|--------------|------------|
| バトル開始：ズームイン+カメラ揺れ | `play_battle_intro()` — 遠景→デフォルト位置へのズームイン+軽いシェイク | `battle_camera.gd` |
| スキル発動時：使用者にフォーカス | `focus_on_target()` — medium zoom でキャスターに寄る | `battle_camera.gd` |
| 必殺技：大ズーム+背景暗転+スポットライト | `play_ultimate_zoom()` + `darken_background()` — FOV狭化＋UI暗転で圧縮感 | `battle_camera.gd` + `battle_ui.gd` |
| 全体技：カメラが引いて全体を映す | `zoom_out_for_aoe()` — FOV拡大でフィールド全体を俯瞰 | `battle_camera.gd` |

**本ゲーム固有の追加：**
- 季節変更時にカメラが一瞬揺らぐ（世界が変質する感覚）
- 四季の合一（必殺技）ではスローモーション＋ヒットストップを組み合わせ

### 1.2 キャラクターアニメーション

| OTの演出 | 本ゲームの対応 | 備考 |
|---------|--------------|------|
| 待機：呼吸で上下揺れ | `start_idle_animation()` — Tweenループで±0.03上下 | Sprite3Dベース |
| 攻撃：前進→攻撃→帰還 | `play_attack_animation()` — 3段階Tween（踏出＋体傾斜→振り＋ヒット判定→帰還） | 最低3段階を保証 |
| 被ダメ：仰け反り+赤フラッシュ | `play_damage_animation()` — ノックバック＋modulate点滅（赤/白）3回 | クリティカル時は6回点滅 |
| 回復：緑の光が上昇 | `play_heal_animation()` + `play_heal_effect()` — 浮上＋緑modulate＋上昇パーティクル | |
| 防御：腕を前+シールド | `play_guard_animation()` — スケール縮小＋前傾＋青白modulate | |
| 戦闘不能：倒れて消える | `play_defeat_animation()` — 横回転＋落下＋フェードアウト | |

### 1.3 スキルエフェクト

| OTの演出 | 本ゲームの対応 | 季節対応 |
|---------|--------------|---------|
| 物理攻撃：光の筋（斬撃） | `play_slash_effect()` — QuadMeshの拡大＋バーストパーティクル | 季節色で斬撃の色が変化 |
| 魔法攻撃：詠唱→魔法陣→インパクト | `play_magic_effect()` — 収束パーティクル→TorusMesh回転→バースト | 魔法陣が季節色に発光 |
| 回復：光の粒子が集まって上昇 | `play_heal_effect()` — 上昇パーティクル（春は桜色、他は緑系） | 春属性回復は桜ピンク |
| バフ：オーラが纏わりつく | `play_buff_effect()` — 軌道パーティクル（対象の周囲を周回） | 季節オーラ色 |
| デバフ：暗い靄 | `play_debuff_effect()` — 滞留パーティクル（紫暗色、ゆっくり漂う） | — |

### 1.4 ダメージ表示

| OTの演出 | 本ゲームの対応 |
|---------|--------------|
| 数字が飛び出す（拡大→縮小→消える） | `show_damage_popup()` — Label3D / scale 0→1.3→1→上昇＋フェードアウト |
| クリティカル：特大数字+画面フラッシュ | font_size 72 + 金色 + `flash_screen()` |
| 弱点：「WEAK」表示 | `_show_status_text()` + `show_weak_text()` |
| 回復：緑色の数字 | modulate = 緑 |

### 1.5 ターン演出

| OTの演出 | 本ゲームの対応 |
|---------|--------------|
| 行動順ゲージ（上部） | `_turn_bar` — HBoxContainerにユニットアイコンを速度順に並べる |
| 選択中キャラが光る | `start_selection_highlight()` — modulate 1.0↔1.3 のTweenループ |
| 敵の行動：タメ→攻撃 | `play_enemy_charge_animation()` — スケール収縮→突進→帰還 |

### 1.6 ブレイク/弱点システム

| OTの演出 | 本ゲームの対応 |
|---------|--------------|
| シールドアイコン＋弱点属性 | `update_enemy_status()` — シールド数値＋季節属性ColorRect |
| ブレイク時：破壊エフェクト＋テキスト＋よろけ | `show_break_effect()` + `show_break_text()` + `play_break_stagger()` |
| 弱点判明：アイコンが開示 | `revealed_weaknesses` 配列で管理。未判明は灰色 |

---

## 2. 「季節の巡り」システム固有の演出

本ゲーム独自の3つの演出カテゴリ。OTには存在しない「四季廻りの職人」ならではの表現。

### 2.1 季節変更エフェクト

**トリガー：** バトル中の季節巡りゲージが閾値を超えた時

**演出フロー：**
1. カメラが微震（世界が変質する予兆）
2. 現在の季節オーラが霧散（灰色パーティクルのバースト）
3. 新季節のオーラが集束（季節色の収束パーティクル）
4. キャラ周囲に新季節色の軌道パーティクル
5. UIに「— 春の気配 —」等のテキスト演出
6. コマンドメニューのボーダーカラーが新季節に変化

**実装：**
- `battle_effects.gd` → `play_season_change_effect()`
- `battle_ui.gd` → `show_season_change_text()` + `set_season_theme()`
- `battle_flash.gdshader` → `season_morph` uniform でキャラのティント遷移

### 2.2 四季の合一（究極必殺技）

**トリガー：** 4人全員の季節ゲージが満タン＋専用コマンド選択

**演出フロー：**
1. 背景暗転（`darken_background()`）
2. カメラがフィールド中心に必殺ズーム（`play_ultimate_zoom()`）
3. スローモーション開始（`start_slow_motion()`）
4. 4方向から春・夏・秋・冬の光線が中央に収束（0.3秒間隔で順に発射）
5. 収束完了時に画面全体が白くフラッシュ
6. 4色のバーストパーティクルが同時爆発
7. ヒットストップ → ダメージ表示
8. カメラ帰還＋暗転解除

**実装：** `battle_effects.gd` → `play_shiki_unity_effect()`

**演出時間：** 約3.5秒

### 2.3 季節属性の大ダメージ

**トリガー：** 季節が一致する高威力スキル使用時

**演出フロー（季節別）：**

| 季節 | 画面全体エフェクト |
|------|------------------|
| 春 | 桜の花びらが画面全体に舞い散る（斜め落下＋揺らぎ） |
| 夏 | 炎の柱が3本立ち昇る（画面下から上へ、中央＋左右） |
| 秋 | 紅葉が渦巻きながら舞う（軌道パーティクル＋落下） |
| 冬 | 吹雪が画面を覆い、青白いフラッシュ（落下パーティクル＋冷色オーバーレイ） |

**実装：** `battle_effects.gd` → `play_season_ultimate_effect()`

---

## 3. シェーダー設計

### 3.1 battle_flash.gdshader

**5つの機能を1シェーダーに統合：**

| 機能 | uniform | 用途 |
|------|---------|------|
| ダメージフラッシュ | `flash_intensity`, `flash_color` | 被ダメ時に0→1→0で点滅。白=通常、赤=大ダメ、金=クリティカル |
| オーラ | `aura_intensity`, `aura_color`, `aura_speed` | バフ/季節変更時のキャラ発光。UV端ほど強い輪郭発光＋ノイズ波紋 |
| 季節カラーモーフ | `season_color_from`, `season_color_to`, `season_morph` | 季節切替時にキャラのティントを滑らかに遷移 |
| アウトライン | `outline_width`, `outline_color` | 選択中/ターゲット中のキャラにアウトライン表示 |
| 頂点膨張 | （aura系と連動） | オーラ時に頂点が法線方向に波打ちながら膨張 |

### 3.2 シェーダーの使い方（GDScriptから）

```gdscript
# ダメージフラッシュ
var mat = sprite.material_override as ShaderMaterial
mat.set_shader_parameter("flash_intensity", 1.0)
mat.set_shader_parameter("flash_color", Color(1.0, 0.3, 0.3, 1.0))
# Tweenで flash_intensity を 0.0 に戻す

# オーラ
mat.set_shader_parameter("aura_intensity", 0.8)
mat.set_shader_parameter("aura_color", Color(1.0, 0.75, 0.8, 1.0))  # 春色

# 季節モーフ
mat.set_shader_parameter("season_color_from", spring_color)
mat.set_shader_parameter("season_color_to", summer_color)
# Tweenで season_morph を 0.0 → 1.0
```

---

## 4. 演出タイミングチャート

### 通常攻撃（約1.2秒）

```
0.00s  攻撃者：前進開始 + カメラがフォーカス
0.15s  攻撃者：攻撃振り
0.25s  ヒット判定 → 斬撃エフェクト + ダメージ表示 + カメラシェイク
0.30s  攻撃者：帰還開始
0.55s  対象：仰け反り＋赤フラッシュ
0.90s  全完了 → 待機アニメーション復帰
1.20s  カメラがデフォルトに復帰
```

### スキル攻撃（約2.0秒）

```
0.00s  キャスター：一歩前進 + 詠唱ポーズ
0.20s  詠唱オーラ（収束パーティクル）+ カメラがキャスターにフォーカス
0.50s  対象位置に魔法陣出現 + カメラがターゲットに移動
1.00s  魔法陣回転完了
1.20s  インパクト（バーストパーティクル）+ ダメージ表示 + 画面フラッシュ + シェイク
1.60s  キャスター帰還
2.00s  全完了 → カメラ復帰
```

### 四季の合一（約4.5秒）

```
0.00s  背景暗転 + カメラ：必殺ズーム
0.30s  スローモーション開始
0.40s  春の光線が中央へ発射
0.70s  夏の光線が中央へ発射
1.00s  秋の光線が中央へ発射
1.30s  冬の光線が中央へ発射
1.80s  4色収束 → 白フラッシュ → 4色バーストパーティクル同時爆発
2.00s  ヒットストップ
2.10s  ダメージ表示（全体）
2.50s  スローモーション解除
3.00s  カメラ帰還 + 暗転解除
3.50s  全完了
```

---

## 5. パーティクルシステム設計

### コードベース簡易パーティクル方式を採用

GPUParticles3Dではなく、SphereMeshベースのコードパーティクルを使用。

**理由：**
- モバイル対応で軽量
- Tweenでの精密な制御が可能
- 季節色の動的変更が容易

**パーティクルタイプ一覧：**

| タイプ | 関数名 | 用途 |
|--------|--------|------|
| バースト | `_spawn_burst_particles()` | ダメージインパクト・シールド破壊 |
| 収束 | `_spawn_converge_particles()` | 詠唱・季節変更の集束 |
| 上昇 | `_spawn_rising_particles()` | 回復・炎柱 |
| 軌道 | `_spawn_orbit_particles()` | バフオーラ・渦巻き |
| 滞留 | `_spawn_lingering_particles()` | デバフの靄 |
| 落下 | `_spawn_falling_particles()` | 花びら・吹雪・紅葉 |
| ビーム | `_spawn_beam_to_center()` | 四季の合一 |

**パーティクル仕様：**
- メッシュ：SphereMesh (radius=0.04, 8 segments)
- マテリアル：StandardMaterial3D (emission + transparency)
- ライフタイム管理：Tween + `queue_free()`
- オブジェクトプーリング：ダメージポップアップのみプール（`_popup_pool`）

---

## 6. 環境エフェクト

バトルフィールドの雰囲気を季節で変える常時エフェクト。

| 季節 | 環境パーティクル | 間隔 |
|------|----------------|------|
| 春 | 桜ピンクの花びらがゆっくり落下（揺らぎあり） | 2.0秒ごとに5個 |
| 夏 | 金色の光の粒が下から上に上昇（陽炎） | 3.0秒ごとに3個 |
| 秋 | 琥珀色の落ち葉が斜めに落下（揺らぎあり） | 2.5秒ごとに5個 |
| 冬 | 白い雪粒がまっすぐ落下（揺らぎ少） | 3.0秒ごとに5個 |

**実装：** `start_ambient_particles()` / `stop_ambient_particles()`

---

## 7. ファイル構成

```
godot_project/
├── scripts/battle/
│   ├── battle.gd              # （既存）バトルシーンメイン
│   ├── battle_engine.gd       # （既存）ダメージ計算ロジック
│   ├── battle_unit.gd         # （既存）ユニットデータ
│   ├── battle_effects.gd      # 【新規】エフェクトシステム
│   ├── battle_camera.gd       # 【新規】カメラ制御
│   ├── battle_animations.gd   # 【新規】キャラアニメーション
│   └── battle_ui.gd           # 【新規】バトルUI
├── shaders/
│   ├── outline.gdshader       # （既存）
│   ├── pixel_perfect.gdshader # （既存）
│   └── battle_flash.gdshader  # 【新規】ダメージフラッシュ＋オーラ
└── ...
```

---

## 8. 統合ガイド（battle.gd への組み込み）

```gdscript
# battle.gd に追加するノード参照例
@onready var effects: BattleEffects = $BattleEffects
@onready var camera: BattleCamera = $BattleCamera
@onready var animations: BattleAnimations = $BattleAnimations
@onready var ui: BattleUI = $BattleUI

func _init_battle():
    camera.play_battle_intro(Vector3.ZERO)
    ui.show_battle_start()
    effects.start_ambient_particles(current_season)
    for unit in party_units + enemy_units:
        animations.start_idle_animation(unit)

func _execute_attack(attacker: BattleUnit, target: BattleUnit, skill: Dictionary):
    # 1. カメラフォーカス
    camera.focus_on_target(attacker.global_position)

    # 2. アニメーション再生
    animations.play_attack_animation(attacker, target, func():
        # 3. ヒット時のエフェクト
        var damage = BattleEngine.calculate_damage(attacker.get_stats(), target.get_stats(), skill)
        effects.play_slash_effect(target.global_position, skill.get("season", "none"))
        effects.show_damage_popup(target.global_position, damage)
        camera.shake_for_damage(damage, target.max_hp)
        target.take_damage(damage)
    )
```

---

## 9. 品質チェックリスト

- [x] 通常攻撃で最低3段階のアニメーション（踏み出し→攻撃→帰還）
- [x] スキルエフェクトが季節属性で色が変わる（`SEASON_COLORS`定数参照）
- [x] ダメージ数字にポップ感がある（scale 0→1.3→1.0→上昇フェードアウト）
- [x] カメラが適切に動く（大技で寄る：`play_ultimate_zoom()`、全体技で引く：`zoom_out_for_aoe()`）
- [x] ブレイク時の演出が多段階（破壊パーティクル＋テキスト＋よろけ＋シェイク）
- [x] 四季の合一が壮大（4色収束＋白フラッシュ＋スローモーション）
- [x] 環境パーティクルが季節で変わる
- [x] シェーダーがダメージフラッシュとオーラの両方に対応
