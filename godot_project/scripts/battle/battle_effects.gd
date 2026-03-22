extends Node3D
## バトルエフェクトシステム
## OTスタイルのスキルエフェクト・ダメージポップアップ・画面フラッシュ・パーティクル管理

class_name BattleEffects

# ==========================================
# 季節カラー定義
# ==========================================

const SEASON_COLORS: Dictionary = {
	"spring": Color(1.0, 0.75, 0.8),      # 桜ピンク
	"summer": Color(1.0, 0.55, 0.1),      # 炎オレンジ
	"autumn": Color(0.85, 0.2, 0.1),      # 深紅
	"winter": Color(0.6, 0.85, 1.0),      # 氷青
	"none":   Color(1.0, 1.0, 1.0),       # 無属性・白
}

const SEASON_SECONDARY_COLORS: Dictionary = {
	"spring": Color(0.8, 1.0, 0.8),       # 淡緑
	"summer": Color(1.0, 0.9, 0.2),       # 金色
	"autumn": Color(0.9, 0.7, 0.2),       # 琥珀
	"winter": Color(0.75, 0.75, 0.9),     # 銀色
	"none":   Color(0.9, 0.9, 0.9),
}

# ==========================================
# シグナル
# ==========================================

signal effect_started(effect_name: String)
signal effect_finished(effect_name: String)
signal damage_popup_finished()

# ==========================================
# ノード参照
# ==========================================

var _active_particles: Array[Node] = []
var _popup_pool: Array[Node] = []

# ==========================================
# 初期化
# ==========================================

func _ready():
	_create_popup_pool(8)

func _create_popup_pool(count: int):
	for i in range(count):
		var label := Label3D.new()
		label.visible = false
		label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		label.no_depth_test = true
		label.render_priority = 100
		label.font_size = 48
		label.outline_size = 8
		label.outline_modulate = Color.BLACK
		add_child(label)
		_popup_pool.append(label)

func _get_popup_label() -> Label3D:
	for label in _popup_pool:
		if not label.visible:
			return label
	# プールが足りない場合は新規作成
	var label := Label3D.new()
	label.visible = false
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.no_depth_test = true
	label.render_priority = 100
	label.font_size = 48
	label.outline_size = 8
	label.outline_modulate = Color.BLACK
	add_child(label)
	_popup_pool.append(label)
	return label

# ==========================================
# ダメージ数字ポップアップ
# ==========================================

## ダメージ数字を表示（OTスタイル：拡大→縮小→フェードアウト）
func show_damage_popup(target_pos: Vector3, amount: int, is_critical: bool = false, is_heal: bool = false, is_weak: bool = false):
	var label := _get_popup_label()
	label.text = str(amount)
	label.global_position = target_pos + Vector3(0, 1.5, 0)
	label.visible = true

	# 色の決定
	if is_heal:
		label.modulate = Color(0.3, 1.0, 0.3)  # 緑
		label.font_size = 48
	elif is_critical:
		label.modulate = Color(1.0, 0.9, 0.1)  # 金色
		label.font_size = 72
	else:
		label.modulate = Color.WHITE
		label.font_size = 48

	# アニメーション：拡大→縮小→上昇→フェードアウト
	label.scale = Vector3.ZERO
	var tween := create_tween()
	tween.set_parallel(false)

	# Phase 1: 拡大（ポップ感）
	var target_scale := Vector3(1.5, 1.5, 1.5) if is_critical else Vector3.ONE
	tween.tween_property(label, "scale", target_scale * 1.3, 0.08).set_ease(Tween.EASE_OUT)
	# Phase 2: 通常サイズに縮小
	tween.tween_property(label, "scale", target_scale, 0.1).set_ease(Tween.EASE_IN_OUT)
	# Phase 3: 上昇しながらフェードアウト
	tween.set_parallel(true)
	var end_pos := label.global_position + Vector3(randf_range(-0.3, 0.3), 1.2, 0)
	tween.tween_property(label, "global_position", end_pos, 0.6).set_ease(Tween.EASE_OUT)
	tween.tween_property(label, "modulate:a", 0.0, 0.4).set_delay(0.3)
	tween.set_parallel(false)
	tween.tween_callback(func():
		label.visible = false
		label.modulate.a = 1.0
		damage_popup_finished.emit()
	)

	# クリティカル時：画面フラッシュを同時に発生
	if is_critical:
		flash_screen(Color(1.0, 1.0, 0.8, 0.4), 0.15)

	# 弱点時：「WEAK」テキストを追加表示
	if is_weak:
		_show_status_text(target_pos, "WEAK", Color(0.2, 0.8, 1.0))

## 「BREAK」「WEAK」「CRITICAL」などのステータステキスト表示
func _show_status_text(target_pos: Vector3, text: String, color: Color):
	var label := _get_popup_label()
	label.text = text
	label.global_position = target_pos + Vector3(0, 2.2, 0)
	label.modulate = color
	label.font_size = 36
	label.visible = true
	label.scale = Vector3.ZERO

	var tween := create_tween()
	tween.tween_property(label, "scale", Vector3(1.2, 1.2, 1.2), 0.1).set_ease(Tween.EASE_OUT)
	tween.tween_property(label, "scale", Vector3.ONE, 0.08)
	tween.tween_interval(0.5)
	tween.tween_property(label, "modulate:a", 0.0, 0.3)
	tween.tween_callback(func():
		label.visible = false
		label.modulate.a = 1.0
	)

## ブレイク表示（OTスタイル：シールド破壊＋テキスト＋よろけ）
func show_break_effect(target_pos: Vector3):
	effect_started.emit("break")
	_show_status_text(target_pos, "BREAK", Color(1.0, 0.3, 0.1))

	# シールド破壊パーティクル（破片が飛び散る）
	_spawn_burst_particles(target_pos, Color(0.5, 0.6, 0.8), 12, 0.8)

	# 画面シェイク（BattleCameraに委譲）
	flash_screen(Color(1.0, 0.5, 0.0, 0.3), 0.2)

	var timer := get_tree().create_timer(1.0)
	timer.timeout.connect(func(): effect_finished.emit("break"))

# ==========================================
# 画面フラッシュ
# ==========================================

## 画面全体を一瞬光らせる
func flash_screen(color: Color = Color(1, 1, 1, 0.5), duration: float = 0.15):
	# ColorRectをCanvasLayer経由でオーバーレイ
	var canvas := CanvasLayer.new()
	canvas.layer = 100
	add_child(canvas)

	var rect := ColorRect.new()
	rect.color = color
	rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	canvas.add_child(rect)

	var tween := create_tween()
	tween.tween_property(rect, "color:a", 0.0, duration)
	tween.tween_callback(func(): canvas.queue_free())

# ==========================================
# スキルエフェクト
# ==========================================

## 斬撃エフェクト（物理攻撃）
## 光の筋が走る → インパクト
func play_slash_effect(target_pos: Vector3, season: String = "none"):
	effect_started.emit("slash")
	var color := SEASON_COLORS.get(season, SEASON_COLORS["none"])

	# 斬撃ライン（MeshInstance3Dを一時生成してTweenでアニメーション）
	var slash_mesh := MeshInstance3D.new()
	var quad := QuadMesh.new()
	quad.size = Vector2(0.05, 2.0)
	slash_mesh.mesh = quad
	slash_mesh.global_position = target_pos + Vector3(-0.5, 1.0, 0.1)
	slash_mesh.rotation_degrees.z = -45.0

	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.emission_enabled = true
	mat.emission = color
	mat.emission_energy_multiplier = 3.0
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.no_depth_test = true
	slash_mesh.material_override = mat
	add_child(slash_mesh)

	# アニメーション：スケール0から拡大→フェードアウト
	slash_mesh.scale = Vector3(0, 0, 1)
	var tween := create_tween()
	tween.tween_property(slash_mesh, "scale", Vector3(1, 1, 1), 0.08).set_ease(Tween.EASE_OUT)
	tween.tween_property(slash_mesh, "scale:x", 3.0, 0.15)
	tween.set_parallel(true)
	tween.tween_property(mat, "albedo_color:a", 0.0, 0.2)
	tween.tween_property(mat, "emission_energy_multiplier", 0.0, 0.2)
	tween.set_parallel(false)
	tween.tween_callback(func():
		slash_mesh.queue_free()
		effect_finished.emit("slash")
	)

	# インパクトパーティクル
	_spawn_burst_particles(target_pos + Vector3(0, 0.8, 0), color, 8, 0.5)

## 魔法エフェクト（詠唱→魔法陣→インパクト）
func play_magic_effect(caster_pos: Vector3, target_pos: Vector3, season: String = "none"):
	effect_started.emit("magic")
	var color := SEASON_COLORS.get(season, SEASON_COLORS["none"])
	var secondary := SEASON_SECONDARY_COLORS.get(season, SEASON_SECONDARY_COLORS["none"])

	# Phase 1: 詠唱オーラ（キャスター周囲に光の粒子が集まる）
	_spawn_converge_particles(caster_pos + Vector3(0, 1.0, 0), color, 16)

	# Phase 2: 魔法陣（遅延してターゲット位置に出現）
	var timer1 := get_tree().create_timer(0.5)
	timer1.timeout.connect(func():
		_spawn_magic_circle(target_pos, color, secondary)
	)

	# Phase 3: インパクト（魔法陣出現後にさらに遅延）
	var timer2 := get_tree().create_timer(1.2)
	timer2.timeout.connect(func():
		_spawn_burst_particles(target_pos + Vector3(0, 0.5, 0), color, 20, 1.0)
		flash_screen(Color(color.r, color.g, color.b, 0.25), 0.1)
		effect_finished.emit("magic")
	)

## 回復エフェクト（対象を中心に光の粒子が上昇）
func play_heal_effect(target_pos: Vector3, season: String = "spring"):
	effect_started.emit("heal")
	var color := Color(0.3, 1.0, 0.5)  # 基本は緑
	if season == "spring":
		color = Color(1.0, 0.8, 0.9)  # 春は桜色

	# 光の粒子が下から上に上昇
	_spawn_rising_particles(target_pos, color, 24, 1.5)

	var timer := get_tree().create_timer(1.5)
	timer.timeout.connect(func(): effect_finished.emit("heal"))

## バフエフェクト（オーラが纏わりつく）
func play_buff_effect(target_pos: Vector3, season: String = "none"):
	effect_started.emit("buff")
	var color := SEASON_COLORS.get(season, SEASON_COLORS["none"])

	# キャラクターの周囲を回るオーラ粒子
	_spawn_orbit_particles(target_pos + Vector3(0, 0.8, 0), color, 12, 1.2)

	var timer := get_tree().create_timer(1.2)
	timer.timeout.connect(func(): effect_finished.emit("buff"))

## デバフエフェクト（暗い靄がかかる）
func play_debuff_effect(target_pos: Vector3):
	effect_started.emit("debuff")
	var dark_color := Color(0.3, 0.0, 0.4, 0.7)

	# 暗い靄のパーティクルが周囲に滞留
	_spawn_lingering_particles(target_pos + Vector3(0, 0.5, 0), dark_color, 16, 1.0)

	var timer := get_tree().create_timer(1.0)
	timer.timeout.connect(func(): effect_finished.emit("debuff"))

## 季節変更エフェクト（季節の巡りシステム固有）
## キャラの周囲のオーラが新しい季節色に変化
func play_season_change_effect(target_pos: Vector3, new_season: String):
	effect_started.emit("season_change")
	var new_color := SEASON_COLORS.get(new_season, SEASON_COLORS["none"])

	# 古いオーラが霧散 → 新しいオーラが集束
	_spawn_burst_particles(target_pos + Vector3(0, 1.0, 0), Color(0.8, 0.8, 0.8, 0.5), 8, 0.4)

	var timer := get_tree().create_timer(0.5)
	timer.timeout.connect(func():
		_spawn_converge_particles(target_pos + Vector3(0, 1.0, 0), new_color, 20)
		_spawn_orbit_particles(target_pos + Vector3(0, 0.8, 0), new_color, 16, 1.5)
	)

	var timer2 := get_tree().create_timer(2.0)
	timer2.timeout.connect(func(): effect_finished.emit("season_change"))

## 四季の合一（必殺技・4色の光が収束する壮大な演出）
func play_shiki_unity_effect(center_pos: Vector3):
	effect_started.emit("shiki_unity")

	# 四方向から季節の光が収束
	var seasons := ["spring", "summer", "autumn", "winter"]
	var offsets := [
		Vector3(-3, 2, 0),   # 春：左上
		Vector3(3, 2, 0),    # 夏：右上
		Vector3(3, -1, 0),   # 秋：右下
		Vector3(-3, -1, 0),  # 冬：左下
	]

	for i in range(4):
		var season := seasons[i]
		var color := SEASON_COLORS[season]
		var start_pos := center_pos + offsets[i]
		_spawn_beam_to_center(start_pos, center_pos + Vector3(0, 1.0, 0), color, 0.3 * i)

	# 収束後の大爆発
	var timer := get_tree().create_timer(1.8)
	timer.timeout.connect(func():
		flash_screen(Color(1.0, 1.0, 1.0, 0.7), 0.3)
		for season in seasons:
			var color := SEASON_COLORS[season]
			_spawn_burst_particles(center_pos + Vector3(0, 1.0, 0), color, 16, 1.5)
	)

	var timer2 := get_tree().create_timer(3.5)
	timer2.timeout.connect(func(): effect_finished.emit("shiki_unity"))

## 季節属性の大ダメージ（画面全体にその季節のエフェクト）
func play_season_ultimate_effect(season: String):
	effect_started.emit("season_ultimate")
	var color := SEASON_COLORS.get(season, SEASON_COLORS["none"])

	# 画面全体を季節色でフラッシュ
	flash_screen(Color(color.r, color.g, color.b, 0.5), 0.4)

	# 季節ごとの固有パーティクル
	match season:
		"spring":
			# 桜の花びらが舞い散る
			_spawn_falling_particles(Vector3(0, 5, 0), Color(1.0, 0.8, 0.85), 30, 2.0, true)
		"summer":
			# 炎の柱が立ち昇る
			_spawn_rising_particles(Vector3(0, -1, 0), Color(1.0, 0.4, 0.0), 40, 2.0)
			_spawn_rising_particles(Vector3(-1.5, -1, 0), Color(1.0, 0.6, 0.1), 20, 2.0)
			_spawn_rising_particles(Vector3(1.5, -1, 0), Color(1.0, 0.6, 0.1), 20, 2.0)
		"autumn":
			# 紅葉が渦巻く
			_spawn_orbit_particles(Vector3(0, 1.5, 0), Color(0.9, 0.2, 0.05), 30, 2.0)
			_spawn_falling_particles(Vector3(0, 5, 0), Color(0.9, 0.6, 0.1), 20, 2.0, true)
		"winter":
			# 吹雪が画面を覆う
			_spawn_falling_particles(Vector3(0, 5, 0), Color(0.9, 0.95, 1.0), 40, 2.0, false)
			flash_screen(Color(0.7, 0.85, 1.0, 0.2), 0.8)

	var timer := get_tree().create_timer(2.5)
	timer.timeout.connect(func(): effect_finished.emit("season_ultimate"))

# ==========================================
# パーティクル生成ヘルパー（コードベース簡易パーティクル）
# ==========================================

## 弾けるパーティクル（ダメージインパクト・シールド破壊など）
func _spawn_burst_particles(pos: Vector3, color: Color, count: int, lifetime: float):
	for i in range(count):
		var p := _create_particle_mesh(color)
		p.global_position = pos
		add_child(p)
		_active_particles.append(p)

		var angle := randf() * TAU
		var speed := randf_range(1.0, 3.0)
		var end_pos := pos + Vector3(cos(angle) * speed, sin(angle) * speed * 0.6 + randf_range(0.5, 1.5), randf_range(-0.3, 0.3))

		var tween := create_tween()
		tween.set_parallel(true)
		tween.tween_property(p, "global_position", end_pos, lifetime).set_ease(Tween.EASE_OUT)
		tween.tween_property(p, "scale", Vector3.ZERO, lifetime * 0.8).set_delay(lifetime * 0.2)
		tween.set_parallel(false)
		tween.tween_callback(func():
			_active_particles.erase(p)
			p.queue_free()
		)

## 収束パーティクル（詠唱・季節変更の集束）
func _spawn_converge_particles(center: Vector3, color: Color, count: int):
	for i in range(count):
		var p := _create_particle_mesh(color)
		var angle := randf() * TAU
		var dist := randf_range(1.5, 3.0)
		var start_pos := center + Vector3(cos(angle) * dist, sin(angle) * dist * 0.5, randf_range(-0.2, 0.2))
		p.global_position = start_pos
		add_child(p)
		_active_particles.append(p)

		var delay := randf_range(0.0, 0.3)
		var tween := create_tween()
		tween.tween_interval(delay)
		tween.tween_property(p, "global_position", center, 0.5).set_ease(Tween.EASE_IN)
		tween.tween_callback(func():
			_active_particles.erase(p)
			p.queue_free()
		)

## 上昇パーティクル（回復・炎柱）
func _spawn_rising_particles(base_pos: Vector3, color: Color, count: int, duration: float):
	for i in range(count):
		var p := _create_particle_mesh(color)
		var offset_x := randf_range(-0.8, 0.8)
		var start := base_pos + Vector3(offset_x, randf_range(-0.3, 0.3), randf_range(-0.2, 0.2))
		p.global_position = start
		add_child(p)
		_active_particles.append(p)

		var delay := randf_range(0.0, duration * 0.5)
		var rise_height := randf_range(1.5, 3.0)
		var end_pos := start + Vector3(randf_range(-0.3, 0.3), rise_height, 0)

		var tween := create_tween()
		tween.tween_interval(delay)
		tween.set_parallel(true)
		tween.tween_property(p, "global_position", end_pos, duration * 0.6).set_ease(Tween.EASE_OUT)
		tween.tween_property(p, "scale", Vector3.ZERO, duration * 0.4).set_delay(duration * 0.3)
		tween.set_parallel(false)
		tween.tween_callback(func():
			_active_particles.erase(p)
			p.queue_free()
		)

## 軌道パーティクル（バフオーラ・渦巻き）
func _spawn_orbit_particles(center: Vector3, color: Color, count: int, duration: float):
	for i in range(count):
		var p := _create_particle_mesh(color)
		p.global_position = center
		add_child(p)
		_active_particles.append(p)

		var angle_start := (float(i) / count) * TAU
		var radius := randf_range(0.5, 1.2)

		var tween := create_tween()
		tween.set_loops(int(duration / 0.05))
		var step := 0
		tween.tween_method(func(t: float):
			var a := angle_start + t * TAU * 2.0
			p.global_position = center + Vector3(cos(a) * radius, sin(t * PI) * 0.5, sin(a) * radius * 0.3)
			p.scale = Vector3.ONE * (1.0 - t * 0.5)
		, 0.0, 1.0, duration)
		tween.tween_callback(func():
			_active_particles.erase(p)
			p.queue_free()
		)

## 滞留パーティクル（デバフの靄）
func _spawn_lingering_particles(center: Vector3, color: Color, count: int, duration: float):
	for i in range(count):
		var p := _create_particle_mesh(color)
		var offset := Vector3(randf_range(-0.6, 0.6), randf_range(-0.3, 0.3), randf_range(-0.3, 0.3))
		p.global_position = center + offset
		add_child(p)
		_active_particles.append(p)

		var drift := Vector3(randf_range(-0.3, 0.3), randf_range(-0.1, 0.2), randf_range(-0.1, 0.1))
		var tween := create_tween()
		tween.set_parallel(true)
		tween.tween_property(p, "global_position", center + offset + drift, duration)
		tween.tween_property(p, "scale", Vector3.ZERO, duration * 0.3).set_delay(duration * 0.7)
		tween.set_parallel(false)
		tween.tween_callback(func():
			_active_particles.erase(p)
			p.queue_free()
		)

## 落下パーティクル（桜の花びら・吹雪）
func _spawn_falling_particles(start_pos: Vector3, color: Color, count: int, duration: float, sway: bool = true):
	for i in range(count):
		var p := _create_particle_mesh(color)
		var x_offset := randf_range(-4.0, 4.0)
		var start := start_pos + Vector3(x_offset, randf_range(-0.5, 0.5), randf_range(-0.5, 0.5))
		p.global_position = start
		add_child(p)
		_active_particles.append(p)

		var delay := randf_range(0.0, duration * 0.5)
		var fall_dist := randf_range(4.0, 7.0)
		var sway_amount := randf_range(-1.5, 1.5) if sway else randf_range(-0.3, 0.3)

		var tween := create_tween()
		tween.tween_interval(delay)
		tween.tween_method(func(t: float):
			var sway_x := sin(t * PI * 3) * sway_amount * 0.3 if sway else 0.0
			p.global_position = start + Vector3(sway_x + t * sway_amount * 0.5, -t * fall_dist, 0)
			p.scale = Vector3.ONE * maxf(1.0 - t * 0.5, 0.1)
		, 0.0, 1.0, duration - delay)
		tween.tween_callback(func():
			_active_particles.erase(p)
			p.queue_free()
		)

## ビーム（四季の合一用 — 光線が中心に向かう）
func _spawn_beam_to_center(from: Vector3, to: Vector3, color: Color, delay: float):
	var beam := _create_particle_mesh(color)
	beam.global_position = from
	beam.scale = Vector3(0.1, 0.1, 0.1)
	beam.visible = false
	add_child(beam)
	_active_particles.append(beam)

	var tween := create_tween()
	tween.tween_interval(delay)
	tween.tween_callback(func(): beam.visible = true)
	tween.tween_property(beam, "global_position", to, 0.6).set_ease(Tween.EASE_IN)
	tween.set_parallel(true)
	tween.tween_property(beam, "scale", Vector3(0.3, 0.3, 0.3), 0.6)
	tween.set_parallel(false)
	tween.tween_callback(func():
		# 到達時に小さな爆発
		_spawn_burst_particles(to, color, 6, 0.5)
		_active_particles.erase(beam)
		beam.queue_free()
	)

## 魔法陣（地面に展開）
func _spawn_magic_circle(pos: Vector3, color: Color, secondary_color: Color):
	var circle := MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = 0.8
	torus.outer_radius = 1.0
	circle.mesh = torus
	circle.global_position = pos + Vector3(0, 0.05, 0)
	circle.rotation_degrees.x = 90  # 水平に配置

	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(color.r, color.g, color.b, 0.0)
	mat.emission_enabled = true
	mat.emission = color
	mat.emission_energy_multiplier = 2.0
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.no_depth_test = true
	circle.material_override = mat
	add_child(circle)
	_active_particles.append(circle)

	# 出現アニメーション
	circle.scale = Vector3.ZERO
	var tween := create_tween()
	tween.tween_property(circle, "scale", Vector3.ONE, 0.3).set_ease(Tween.EASE_OUT)
	tween.set_parallel(true)
	tween.tween_property(mat, "albedo_color:a", 0.6, 0.3)
	# 回転
	tween.tween_property(circle, "rotation_degrees:y", 360.0, 0.7)
	tween.set_parallel(false)
	# 消える
	tween.tween_property(mat, "albedo_color:a", 0.0, 0.3)
	tween.tween_callback(func():
		_active_particles.erase(circle)
		circle.queue_free()
	)

# ==========================================
# パーティクルメッシュ生成
# ==========================================

func _create_particle_mesh(color: Color) -> MeshInstance3D:
	var mesh_inst := MeshInstance3D.new()
	var sphere := SphereMesh.new()
	sphere.radius = 0.04
	sphere.height = 0.08
	sphere.radial_segments = 8
	sphere.rings = 4
	mesh_inst.mesh = sphere

	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.emission_enabled = true
	mat.emission = color
	mat.emission_energy_multiplier = 2.0
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.no_depth_test = true
	mesh_inst.material_override = mat

	return mesh_inst

# ==========================================
# 環境エフェクト（背景パーティクル）
# ==========================================

## 背景に季節の雰囲気パーティクルを常時発生させる
func start_ambient_particles(season: String):
	stop_ambient_particles()
	match season:
		"spring":
			_start_ambient_loop(Color(1.0, 0.85, 0.9, 0.6), "falling", 2.0)
		"summer":
			_start_ambient_loop(Color(1.0, 0.95, 0.7, 0.4), "rising", 3.0)
		"autumn":
			_start_ambient_loop(Color(0.9, 0.5, 0.1, 0.5), "falling", 2.5)
		"winter":
			_start_ambient_loop(Color(0.95, 0.97, 1.0, 0.5), "falling", 3.0)

var _ambient_timer: Timer = null

func _start_ambient_loop(color: Color, direction: String, interval: float):
	_ambient_timer = Timer.new()
	_ambient_timer.wait_time = interval
	_ambient_timer.autostart = true
	add_child(_ambient_timer)
	_ambient_timer.timeout.connect(func():
		match direction:
			"falling":
				_spawn_falling_particles(Vector3(0, 4, 0), color, 5, 4.0, true)
			"rising":
				_spawn_rising_particles(Vector3(0, -1, 0), color, 3, 4.0)
	)

func stop_ambient_particles():
	if _ambient_timer:
		_ambient_timer.queue_free()
		_ambient_timer = null

# ==========================================
# クリーンアップ
# ==========================================

func cleanup_all():
	stop_ambient_particles()
	for p in _active_particles:
		if is_instance_valid(p):
			p.queue_free()
	_active_particles.clear()
