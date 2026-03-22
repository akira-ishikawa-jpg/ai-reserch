extends Node3D
## プレイヤー移動制御
## 3D空間上でWASD/矢印キーにより移動
## 壁との衝突判定は親（exploration.gd）が行う

@export var move_speed: float = 4.0

var velocity: Vector3 = Vector3.ZERO
var facing_direction: Vector2 = Vector2(0, 1)  # 現在の向き（デフォルト: 下）

func _process(delta):
	var input_dir = Vector3.ZERO

	if Input.is_action_pressed("move_up"):
		input_dir.z -= 1
	if Input.is_action_pressed("move_down"):
		input_dir.z += 1
	if Input.is_action_pressed("move_left"):
		input_dir.x -= 1
	if Input.is_action_pressed("move_right"):
		input_dir.x += 1

	if input_dir.length() > 0:
		input_dir = input_dir.normalized()
		facing_direction = Vector2(input_dir.x, input_dir.z)

	velocity = input_dir * move_speed

	# 移動前の位置を記録
	var prev_pos = global_position

	# 仮移動
	var next_pos = global_position + velocity * delta

	# マップの当たり判定
	var exploration = get_parent().get_parent()  # Characters -> Exploration
	if exploration and exploration.has_method("_is_tile_passable"):
		# X軸とZ軸を個別にチェック（壁に沿ったスライド移動）
		var test_x = Vector3(next_pos.x, prev_pos.y, prev_pos.z)
		var test_z = Vector3(prev_pos.x, prev_pos.y, next_pos.z)

		var can_x = exploration._is_tile_passable(test_x)
		var can_z = exploration._is_tile_passable(test_z)

		if can_x:
			global_position.x = next_pos.x
		if can_z:
			global_position.z = next_pos.z
	else:
		global_position = next_pos
