extends Camera3D
## バトル用カメラ制御
## OTスタイルのカメラワーク：ズーム・フォーカス・シェイク・スローモーション

class_name BattleCamera

# ==========================================
# 定数
# ==========================================

## カメラのデフォルト位置・角度（HD-2D俯瞰30°基準）
const DEFAULT_POSITION := Vector3(0.0, 6.0, 8.0)
const DEFAULT_ROTATION_DEG := Vector3(-30.0, 0.0, 0.0)
const DEFAULT_FOV := 35.0

## ズーム段階
const ZOOM_CLOSE_OFFSET := Vector3(0.0, 2.0, 3.0)     # 必殺技・ブレイク時
const ZOOM_MEDIUM_OFFSET := Vector3(0.0, 4.0, 5.5)    # スキル発動時
const ZOOM_WIDE_OFFSET := Vector3(0.0, 7.5, 10.0)     # 全体技

## シェイク強度
const SHAKE_LIGHT := 0.05
const SHAKE_MEDIUM := 0.15
const SHAKE_HEAVY := 0.35
const SHAKE_CRITICAL := 0.5

# ==========================================
# シグナル
# ==========================================

signal camera_move_started()
signal camera_move_finished()
signal slowmo_started()
signal slowmo_finished()

# ==========================================
# 状態
# ==========================================

var _base_position: Vector3 = DEFAULT_POSITION
var _base_rotation_deg: Vector3 = DEFAULT_ROTATION_DEG
var _shake_offset: Vector3 = Vector3.ZERO
var _is_shaking: bool = false
var _shake_intensity: float = 0.0
var _shake_decay: float = 0.0
var _current_tween: Tween = null
var _focus_target: Node3D = null

# ==========================================
# 初期化
# ==========================================

func _ready():
	position = DEFAULT_POSITION
	rotation_degrees = DEFAULT_ROTATION_DEG
	fov = DEFAULT_FOV

func _process(delta: float):
	# シェイク処理
	if _is_shaking:
		_shake_intensity *= (1.0 - _shake_decay * delta * 10.0)
		_shake_offset = Vector3(
			randf_range(-_shake_intensity, _shake_intensity),
			randf_range(-_shake_intensity, _shake_intensity),
			0
		)
		position = _base_position + _shake_offset

		if _shake_intensity < 0.001:
			_is_shaking = false
			_shake_offset = Vector3.ZERO
			position = _base_position

# ==========================================
# カメラ移動
# ==========================================

## ターゲット位置にカメラをフォーカス（スキル発動時など）
func focus_on_target(target_pos: Vector3, zoom_level: String = "medium", duration: float = 0.4):
	camera_move_started.emit()
	_kill_current_tween()

	var offset: Vector3
	match zoom_level:
		"close":
			offset = ZOOM_CLOSE_OFFSET
		"wide":
			offset = ZOOM_WIDE_OFFSET
		_:
			offset = ZOOM_MEDIUM_OFFSET

	var target_camera_pos := target_pos + offset
	_base_position = target_camera_pos

	_current_tween = create_tween()
	_current_tween.set_ease(Tween.EASE_OUT)
	_current_tween.set_trans(Tween.TRANS_CUBIC)
	_current_tween.tween_property(self, "position", target_camera_pos, duration)
	_current_tween.tween_callback(func(): camera_move_finished.emit())

## デフォルト位置に戻る
func reset_to_default(duration: float = 0.5):
	camera_move_started.emit()
	_kill_current_tween()

	_base_position = DEFAULT_POSITION

	_current_tween = create_tween()
	_current_tween.set_ease(Tween.EASE_IN_OUT)
	_current_tween.set_trans(Tween.TRANS_CUBIC)
	_current_tween.tween_property(self, "position", DEFAULT_POSITION, duration)
	_current_tween.tween_property(self, "rotation_degrees", DEFAULT_ROTATION_DEG, duration)
	_current_tween.tween_callback(func(): camera_move_finished.emit())

## バトル開始演出（ズームイン＋カメラ揺れ）
func play_battle_intro(center_pos: Vector3, duration: float = 1.2):
	camera_move_started.emit()
	_kill_current_tween()

	# 遠くからスタート
	position = center_pos + ZOOM_WIDE_OFFSET * 1.5
	_base_position = center_pos + DEFAULT_POSITION - Vector3(0, 0, 0)

	_current_tween = create_tween()
	_current_tween.set_ease(Tween.EASE_OUT)
	_current_tween.set_trans(Tween.TRANS_CUBIC)
	_current_tween.tween_property(self, "position", DEFAULT_POSITION, duration)
	_current_tween.tween_callback(func():
		_base_position = DEFAULT_POSITION
		shake(SHAKE_LIGHT, 0.3)
		camera_move_finished.emit()
	)

## 必殺技演出（大きくズームイン＋背景暗転用にシグナル発信）
func play_ultimate_zoom(target_pos: Vector3, duration: float = 0.6):
	camera_move_started.emit()
	_kill_current_tween()

	var close_pos := target_pos + ZOOM_CLOSE_OFFSET * 0.7
	_base_position = close_pos

	_current_tween = create_tween()
	_current_tween.set_ease(Tween.EASE_OUT)
	_current_tween.set_trans(Tween.TRANS_BACK)

	# FOVも狭めて圧縮感を出す
	_current_tween.set_parallel(true)
	_current_tween.tween_property(self, "position", close_pos, duration)
	_current_tween.tween_property(self, "fov", 25.0, duration)
	_current_tween.set_parallel(false)
	_current_tween.tween_callback(func(): camera_move_finished.emit())

## 必殺技演出から復帰
func return_from_ultimate(duration: float = 0.8):
	camera_move_started.emit()
	_kill_current_tween()
	_base_position = DEFAULT_POSITION

	_current_tween = create_tween()
	_current_tween.set_ease(Tween.EASE_IN_OUT)
	_current_tween.set_trans(Tween.TRANS_CUBIC)
	_current_tween.set_parallel(true)
	_current_tween.tween_property(self, "position", DEFAULT_POSITION, duration)
	_current_tween.tween_property(self, "fov", DEFAULT_FOV, duration)
	_current_tween.set_parallel(false)
	_current_tween.tween_callback(func(): camera_move_finished.emit())

## 全体技演出（カメラを引いて全体を映す）
func zoom_out_for_aoe(center_pos: Vector3, duration: float = 0.5):
	camera_move_started.emit()
	_kill_current_tween()

	var wide_pos := center_pos + ZOOM_WIDE_OFFSET
	_base_position = wide_pos

	_current_tween = create_tween()
	_current_tween.set_ease(Tween.EASE_OUT)
	_current_tween.set_trans(Tween.TRANS_CUBIC)
	_current_tween.set_parallel(true)
	_current_tween.tween_property(self, "position", wide_pos, duration)
	_current_tween.tween_property(self, "fov", 45.0, duration)
	_current_tween.set_parallel(false)
	_current_tween.tween_callback(func(): camera_move_finished.emit())

# ==========================================
# スクリーンシェイク
# ==========================================

## カメラを振動させる
func shake(intensity: float = SHAKE_MEDIUM, decay: float = 0.5):
	_is_shaking = true
	# 既にシェイク中ならより強い方を優先
	_shake_intensity = maxf(_shake_intensity, intensity)
	_shake_decay = decay

## ダメージに応じたシェイク
func shake_for_damage(damage: int, max_hp: int):
	var ratio := float(damage) / float(maxi(max_hp, 1))
	if ratio > 0.4:
		shake(SHAKE_HEAVY, 0.4)
	elif ratio > 0.15:
		shake(SHAKE_MEDIUM, 0.5)
	else:
		shake(SHAKE_LIGHT, 0.6)

## クリティカルヒットシェイク
func shake_critical():
	shake(SHAKE_CRITICAL, 0.3)

## ブレイク時シェイク
func shake_break():
	shake(SHAKE_HEAVY, 0.35)

# ==========================================
# スローモーション演出
# ==========================================

## スローモーション開始
func start_slow_motion(time_scale: float = 0.3, duration: float = 1.0):
	slowmo_started.emit()
	Engine.time_scale = time_scale

	# durationは実時間ベースで計算
	var real_duration := duration * time_scale
	var timer := get_tree().create_timer(real_duration, true, false, true)
	timer.timeout.connect(func():
		_restore_time_scale()
	)

## スローモーション終了
func _restore_time_scale():
	var tween := create_tween()
	tween.set_process_mode(Tween.TWEEN_PROCESS_PHYSICS)
	tween.tween_method(func(val: float):
		Engine.time_scale = val
	, Engine.time_scale, 1.0, 0.3)
	tween.tween_callback(func(): slowmo_finished.emit())

## ヒットストップ（攻撃がヒットした瞬間の一瞬停止）
func hit_stop(duration: float = 0.08):
	Engine.time_scale = 0.05
	# 実時間ベースのタイマー
	var timer := get_tree().create_timer(duration, true, false, true)
	timer.timeout.connect(func():
		Engine.time_scale = 1.0
	)

## 必殺技用のスローモーション演出
## ヒットストップ → スロー → 通常速度に戻る
func play_ultimate_timing(hit_stop_dur: float = 0.1, slow_dur: float = 0.5, slow_scale: float = 0.2):
	hit_stop(hit_stop_dur)

	var timer := get_tree().create_timer(hit_stop_dur, true, false, true)
	timer.timeout.connect(func():
		start_slow_motion(slow_scale, slow_dur)
	)

# ==========================================
# ユーティリティ
# ==========================================

func _kill_current_tween():
	if _current_tween and _current_tween.is_valid():
		_current_tween.kill()
	_current_tween = null

## 指定ユニットにスムーズにフォーカスを移す（ターン切り替え時）
func smooth_pan_to(target_pos: Vector3, duration: float = 0.3):
	_kill_current_tween()
	var target_camera_pos := target_pos + ZOOM_MEDIUM_OFFSET
	_base_position = target_camera_pos

	_current_tween = create_tween()
	_current_tween.set_ease(Tween.EASE_IN_OUT)
	_current_tween.set_trans(Tween.TRANS_SINE)
	_current_tween.tween_property(self, "position", target_camera_pos, duration)

## 行動選択中のゆるやかなカメラ揺らぎ（待機中の微動）
func start_idle_sway():
	var tween := create_tween()
	tween.set_loops()
	tween.tween_property(self, "position:y", _base_position.y + 0.05, 2.0).set_ease(Tween.EASE_IN_OUT).set_trans(Tween.TRANS_SINE)
	tween.tween_property(self, "position:y", _base_position.y - 0.05, 2.0).set_ease(Tween.EASE_IN_OUT).set_trans(Tween.TRANS_SINE)
