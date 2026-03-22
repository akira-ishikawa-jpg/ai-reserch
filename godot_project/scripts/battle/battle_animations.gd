extends Node
## キャラクターアニメーション制御
## OTスタイルのバトルアニメーション：待機・攻撃・被ダメ・回復・防御・戦闘不能

class_name BattleAnimations

# ==========================================
# シグナル
# ==========================================

signal animation_started(anim_name: String, unit: Node3D)
signal animation_finished(anim_name: String, unit: Node3D)
signal attack_hit_frame(unit: Node3D)  # 攻撃モーションのヒット判定タイミング

# ==========================================
# 定数
# ==========================================

## 待機アニメーション
const IDLE_BREATHE_AMOUNT := 0.03      # 呼吸の上下幅
const IDLE_BREATHE_SPEED := 2.0        # 呼吸の周期（秒）

## 攻撃モーション
const ATTACK_STEP_FORWARD := 1.2       # 前に踏み出す距離
const ATTACK_STEP_DURATION := 0.15     # 踏み出し時間
const ATTACK_SWING_DURATION := 0.1     # 攻撃振り時間
const ATTACK_RETURN_DURATION := 0.3    # 帰還時間

## 被ダメ
const DAMAGE_KNOCKBACK := 0.3          # 仰け反り距離
const DAMAGE_FLASH_DURATION := 0.08    # 赤フラッシュ1回の時間
const DAMAGE_FLASH_COUNT := 3          # フラッシュ回数

## 戦闘不能
const DEFEAT_FALL_DURATION := 0.5
const DEFEAT_FADE_DURATION := 0.8

# ==========================================
# 待機アニメーション（呼吸）
# ==========================================

## ユニットに呼吸アニメーションを開始
func start_idle_animation(unit: Node3D):
	var original_y: float = unit.position.y
	var tween := unit.create_tween()
	tween.set_loops()
	tween.set_ease(Tween.EASE_IN_OUT)
	tween.set_trans(Tween.TRANS_SINE)
	tween.tween_property(unit, "position:y", original_y + IDLE_BREATHE_AMOUNT, IDLE_BREATHE_SPEED / 2.0)
	tween.tween_property(unit, "position:y", original_y - IDLE_BREATHE_AMOUNT, IDLE_BREATHE_SPEED / 2.0)
	# Tweenを保存しておけるように、メタデータに格納
	unit.set_meta("idle_tween", tween)

## 呼吸アニメーションを停止
func stop_idle_animation(unit: Node3D):
	if unit.has_meta("idle_tween"):
		var tween: Tween = unit.get_meta("idle_tween")
		if tween and tween.is_valid():
			tween.kill()
		unit.remove_meta("idle_tween")

# ==========================================
# 攻撃モーション（前進→攻撃→帰還）
# ==========================================

## 物理攻撃アニメーション（3段階）
func play_attack_animation(unit: Node3D, target: Node3D, on_hit: Callable = Callable()):
	animation_started.emit("attack", unit)
	stop_idle_animation(unit)

	var original_pos: Vector3 = unit.position
	var direction: Vector3 = (target.position - unit.position).normalized()
	var step_pos: Vector3 = unit.position + direction * ATTACK_STEP_FORWARD

	var tween := unit.create_tween()

	# Phase 1: 前に踏み出す（溜め）
	tween.tween_property(unit, "position", step_pos, ATTACK_STEP_DURATION).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_BACK)

	# 踏み出し時に体を少し傾ける
	tween.set_parallel(true)
	tween.tween_property(unit, "rotation_degrees:z", -15.0, ATTACK_STEP_DURATION)
	tween.set_parallel(false)

	# Phase 2: 攻撃振り（スプライトの回転で表現）
	tween.tween_property(unit, "rotation_degrees:z", 20.0, ATTACK_SWING_DURATION).set_ease(Tween.EASE_OUT)

	# ヒット判定フレーム
	tween.tween_callback(func():
		attack_hit_frame.emit(unit)
		if on_hit.is_valid():
			on_hit.call()
	)

	# Phase 3: 攻撃後の硬直＋元に戻す
	tween.tween_interval(0.05)
	tween.set_parallel(true)
	tween.tween_property(unit, "position", original_pos, ATTACK_RETURN_DURATION).set_ease(Tween.EASE_IN_OUT).set_trans(Tween.TRANS_CUBIC)
	tween.tween_property(unit, "rotation_degrees:z", 0.0, ATTACK_RETURN_DURATION * 0.5)
	tween.set_parallel(false)

	tween.tween_callback(func():
		start_idle_animation(unit)
		animation_finished.emit("attack", unit)
	)

## スキル攻撃アニメーション（詠唱ポーズ→発動→帰還）
func play_skill_attack_animation(unit: Node3D, is_aoe: bool = false, on_cast: Callable = Callable()):
	animation_started.emit("skill_attack", unit)
	stop_idle_animation(unit)

	var original_pos: Vector3 = unit.position
	var tween := unit.create_tween()

	# Phase 1: 一歩前に出て構える
	var step_pos := original_pos + Vector3(0, 0, -0.3) if not is_aoe else original_pos
	tween.tween_property(unit, "position", step_pos, 0.2).set_ease(Tween.EASE_OUT)

	# Phase 2: 詠唱ポーズ（体を少し持ち上げて光る）
	tween.set_parallel(true)
	tween.tween_property(unit, "position:y", original_pos.y + 0.15, 0.3).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_SINE)
	tween.tween_property(unit, "scale", Vector3(1.05, 1.05, 1.05), 0.3)
	tween.set_parallel(false)

	# Phase 3: 発動（コールバック）
	tween.tween_callback(func():
		attack_hit_frame.emit(unit)
		if on_cast.is_valid():
			on_cast.call()
	)

	# 発動後の硬直
	tween.tween_interval(0.4)

	# Phase 4: 帰還
	tween.set_parallel(true)
	tween.tween_property(unit, "position", original_pos, ATTACK_RETURN_DURATION).set_ease(Tween.EASE_IN_OUT)
	tween.tween_property(unit, "scale", Vector3.ONE, 0.2)
	tween.set_parallel(false)

	tween.tween_callback(func():
		start_idle_animation(unit)
		animation_finished.emit("skill_attack", unit)
	)

# ==========================================
# 被ダメージ（仰け反り＋赤フラッシュ）
# ==========================================

## 被ダメージアニメーション
func play_damage_animation(unit: Node3D, damage_direction: Vector3 = Vector3.BACK, is_critical: bool = false):
	animation_started.emit("damage", unit)
	stop_idle_animation(unit)

	var original_pos: Vector3 = unit.position
	var knockback := DAMAGE_KNOCKBACK * (2.0 if is_critical else 1.0)
	var knockback_pos := original_pos + damage_direction.normalized() * knockback

	var tween := unit.create_tween()

	# 仰け反り
	tween.tween_property(unit, "position", knockback_pos, 0.06).set_ease(Tween.EASE_OUT)

	# 赤フラッシュ（シェーダーパラメータ経由 or modulate）
	tween.tween_callback(func(): _start_damage_flash(unit, is_critical))

	# 仰け反り中の硬直
	tween.tween_interval(0.1)

	# 元に戻る
	tween.tween_property(unit, "position", original_pos, 0.25).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_ELASTIC)

	tween.tween_callback(func():
		start_idle_animation(unit)
		animation_finished.emit("damage", unit)
	)

## 赤フラッシュ（modulateで白or赤に点滅）
func _start_damage_flash(unit: Node3D, is_critical: bool):
	var flash_color := Color(1.0, 0.2, 0.2) if not is_critical else Color(1.0, 1.0, 0.5)
	# スプライトノードを探す（子ノードの中から Sprite3D or MeshInstance3D）
	var sprite := _find_visual_child(unit)
	if not sprite:
		return

	var original_modulate: Color = sprite.modulate if sprite is Sprite3D else Color.WHITE
	var flash_count := DAMAGE_FLASH_COUNT * (2 if is_critical else 1)

	var tween := unit.create_tween()
	for i in range(flash_count):
		tween.tween_property(sprite, "modulate", flash_color, DAMAGE_FLASH_DURATION)
		tween.tween_property(sprite, "modulate", original_modulate, DAMAGE_FLASH_DURATION)

# ==========================================
# 回復演出
# ==========================================

## 回復アニメーション（体が少し光る + 上昇感）
func play_heal_animation(unit: Node3D):
	animation_started.emit("heal", unit)

	var original_pos: Vector3 = unit.position
	var tween := unit.create_tween()

	# 少し浮き上がる
	tween.tween_property(unit, "position:y", original_pos.y + 0.1, 0.4).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_SINE)

	# 緑色に光る
	var sprite := _find_visual_child(unit)
	if sprite and sprite is Sprite3D:
		tween.set_parallel(true)
		tween.tween_property(sprite, "modulate", Color(0.6, 1.0, 0.6), 0.3)
		tween.set_parallel(false)
		tween.tween_property(sprite, "modulate", Color.WHITE, 0.4)

	# 元に戻る
	tween.tween_property(unit, "position:y", original_pos.y, 0.3).set_ease(Tween.EASE_IN_OUT)
	tween.tween_callback(func(): animation_finished.emit("heal", unit))

# ==========================================
# 防御姿勢
# ==========================================

## 防御アニメーション（体を縮める + シールドオーラ）
func play_guard_animation(unit: Node3D):
	animation_started.emit("guard", unit)

	var tween := unit.create_tween()

	# 体を前に傾けて縮める（腕を前に出すイメージ）
	tween.set_parallel(true)
	tween.tween_property(unit, "scale", Vector3(0.9, 0.85, 0.9), 0.15).set_ease(Tween.EASE_OUT)
	tween.tween_property(unit, "rotation_degrees:x", 10.0, 0.15)
	tween.set_parallel(false)

	# シールドオーラ（青白く光る）
	var sprite := _find_visual_child(unit)
	if sprite and sprite is Sprite3D:
		tween.tween_property(sprite, "modulate", Color(0.7, 0.8, 1.0), 0.1)

	tween.tween_callback(func(): animation_finished.emit("guard", unit))

## 防御解除
func release_guard_animation(unit: Node3D):
	var tween := unit.create_tween()
	tween.set_parallel(true)
	tween.tween_property(unit, "scale", Vector3.ONE, 0.2)
	tween.tween_property(unit, "rotation_degrees:x", 0.0, 0.2)
	tween.set_parallel(false)

	var sprite := _find_visual_child(unit)
	if sprite and sprite is Sprite3D:
		tween.tween_property(sprite, "modulate", Color.WHITE, 0.15)

	tween.tween_callback(func(): start_idle_animation(unit))

# ==========================================
# 戦闘不能
# ==========================================

## 戦闘不能アニメーション（倒れる＋フェードアウト）
func play_defeat_animation(unit: Node3D):
	animation_started.emit("defeat", unit)
	stop_idle_animation(unit)

	var tween := unit.create_tween()

	# 一瞬の硬直
	tween.tween_interval(0.15)

	# 倒れる（横に回転 + 落下）
	tween.set_parallel(true)
	tween.tween_property(unit, "rotation_degrees:z", 90.0, DEFEAT_FALL_DURATION).set_ease(Tween.EASE_IN).set_trans(Tween.TRANS_BACK)
	tween.tween_property(unit, "position:y", unit.position.y - 0.3, DEFEAT_FALL_DURATION).set_ease(Tween.EASE_IN)
	tween.set_parallel(false)

	# 倒れた地面に当たるインパクト
	tween.tween_interval(0.1)

	# フェードアウト（透明になって消える）
	var sprite := _find_visual_child(unit)
	if sprite and sprite is Sprite3D:
		tween.tween_property(sprite, "modulate:a", 0.0, DEFEAT_FADE_DURATION)
	else:
		tween.tween_interval(DEFEAT_FADE_DURATION)

	tween.tween_callback(func():
		unit.visible = false
		animation_finished.emit("defeat", unit)
	)

## 戦闘不能からの復活
func play_revive_animation(unit: Node3D):
	animation_started.emit("revive", unit)
	unit.visible = true

	# 初期状態を倒れた状態にセット
	unit.rotation_degrees.z = 90.0
	var sprite := _find_visual_child(unit)
	if sprite and sprite is Sprite3D:
		sprite.modulate.a = 0.0

	var tween := unit.create_tween()

	# フェードイン
	if sprite and sprite is Sprite3D:
		tween.tween_property(sprite, "modulate:a", 1.0, 0.4)

	# 起き上がる
	tween.tween_property(unit, "rotation_degrees:z", 0.0, 0.5).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_BACK)

	tween.tween_callback(func():
		start_idle_animation(unit)
		animation_finished.emit("revive", unit)
	)

# ==========================================
# 行動選択中のハイライト
# ==========================================

## 選択中のキャラが微妙に光る
func start_selection_highlight(unit: Node3D):
	var sprite := _find_visual_child(unit)
	if not sprite or not (sprite is Sprite3D):
		return

	var tween := unit.create_tween()
	tween.set_loops()
	tween.tween_property(sprite, "modulate", Color(1.2, 1.2, 1.3), 0.6).set_ease(Tween.EASE_IN_OUT).set_trans(Tween.TRANS_SINE)
	tween.tween_property(sprite, "modulate", Color.WHITE, 0.6).set_ease(Tween.EASE_IN_OUT).set_trans(Tween.TRANS_SINE)
	unit.set_meta("highlight_tween", tween)

## ハイライト解除
func stop_selection_highlight(unit: Node3D):
	if unit.has_meta("highlight_tween"):
		var tween: Tween = unit.get_meta("highlight_tween")
		if tween and tween.is_valid():
			tween.kill()
		unit.remove_meta("highlight_tween")

	var sprite := _find_visual_child(unit)
	if sprite and sprite is Sprite3D:
		sprite.modulate = Color.WHITE

# ==========================================
# 敵の行動演出（タメ → 攻撃）
# ==========================================

## 敵の攻撃前のタメ演出
func play_enemy_charge_animation(unit: Node3D, on_complete: Callable = Callable()):
	animation_started.emit("enemy_charge", unit)
	stop_idle_animation(unit)

	var original_pos := unit.position
	var tween := unit.create_tween()

	# タメ：体を縮めてエネルギーを溜める
	tween.tween_property(unit, "scale", Vector3(0.9, 1.1, 0.9), 0.25).set_ease(Tween.EASE_IN)

	# 一瞬の硬直
	tween.tween_interval(0.1)

	# 放出（元のサイズに戻りつつ前に突進）
	tween.set_parallel(true)
	tween.tween_property(unit, "scale", Vector3(1.1, 0.95, 1.1), 0.08)
	tween.tween_property(unit, "position", original_pos + Vector3(0, 0, 0.5), 0.08)
	tween.set_parallel(false)

	tween.tween_callback(func():
		if on_complete.is_valid():
			on_complete.call()
	)

	# 帰還
	tween.tween_interval(0.1)
	tween.set_parallel(true)
	tween.tween_property(unit, "position", original_pos, 0.3).set_ease(Tween.EASE_IN_OUT)
	tween.tween_property(unit, "scale", Vector3.ONE, 0.2)
	tween.set_parallel(false)

	tween.tween_callback(func():
		start_idle_animation(unit)
		animation_finished.emit("enemy_charge", unit)
	)

# ==========================================
# ブレイク時のよろけ
# ==========================================

func play_break_stagger(unit: Node3D):
	animation_started.emit("break_stagger", unit)
	stop_idle_animation(unit)

	var original_pos := unit.position
	var tween := unit.create_tween()

	# 大きく仰け反る
	tween.tween_property(unit, "position", original_pos + Vector3(0, 0, 0.5), 0.1).set_ease(Tween.EASE_OUT)
	tween.tween_property(unit, "rotation_degrees:z", -20.0, 0.1)

	# よろよろ（左右に揺れる）
	for i in range(3):
		var sway := 10.0 * (1.0 - float(i) * 0.3)
		tween.tween_property(unit, "rotation_degrees:z", sway, 0.15)
		tween.tween_property(unit, "rotation_degrees:z", -sway, 0.15)

	# 体勢を戻す（完全には戻らない＝ブレイク状態）
	tween.tween_property(unit, "rotation_degrees:z", -5.0, 0.2)
	tween.tween_property(unit, "position", original_pos + Vector3(0, -0.05, 0.1), 0.2)

	tween.tween_callback(func(): animation_finished.emit("break_stagger", unit))

## ブレイク状態からの復帰
func play_break_recover(unit: Node3D):
	var tween := unit.create_tween()
	tween.set_parallel(true)
	tween.tween_property(unit, "rotation_degrees:z", 0.0, 0.3).set_ease(Tween.EASE_OUT)
	tween.tween_property(unit, "position:z", unit.position.z - 0.1, 0.3)
	tween.set_parallel(false)
	tween.tween_callback(func(): start_idle_animation(unit))

# ==========================================
# ユーティリティ
# ==========================================

## ユニットの子ノードからビジュアルノード（Sprite3D）を探す
func _find_visual_child(unit: Node3D) -> Node:
	# まずSprite3Dを探す
	for child in unit.get_children():
		if child is Sprite3D:
			return child
	# MeshInstance3Dを探す
	for child in unit.get_children():
		if child is MeshInstance3D:
			return child
	# 見つからなければユニット自体を返す（modulateがない場合は無視される）
	return null

## 全ユニットの待機アニメーション開始
func start_all_idle(units: Array):
	for unit in units:
		if unit is Node3D and unit.visible:
			start_idle_animation(unit)

## 全ユニットのアニメーション停止
func stop_all_animations(units: Array):
	for unit in units:
		if unit is Node3D:
			stop_idle_animation(unit)
			stop_selection_highlight(unit)
