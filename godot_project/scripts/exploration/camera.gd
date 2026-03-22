extends Camera3D
## HD-2Dカメラ制御
## 30度俯瞰の正射影カメラ。ターゲットを追従する。

@export var target: Node3D
@export var offset: Vector3 = Vector3(0, 10, 8)
@export var smooth_speed: float = 5.0
@export var ortho_size: float = 8.0

func _ready():
	# 正射影モードを設定
	projection = Camera3D.PROJECTION_ORTHOGONAL
	size = ortho_size
	# 初期位置はoffsetのまま（tscn側で rotation_degrees を -30度に設定）

func _process(delta):
	if target:
		var target_pos = target.global_position + offset
		global_position = global_position.lerp(target_pos, smooth_speed * delta)

func shake(intensity: float = 0.3, duration: float = 0.2):
	var tween = create_tween()
	var original_offset = offset
	tween.tween_method(
		func(t: float):
			var shake_offset = Vector3(
				randf_range(-intensity, intensity),
				randf_range(-intensity, intensity) * 0.5,
				0
			) * (1.0 - t)
			h_offset = shake_offset.x
			v_offset = shake_offset.y,
		0.0, 1.0, duration
	)
	tween.tween_callback(func():
		h_offset = 0
		v_offset = 0
	)
