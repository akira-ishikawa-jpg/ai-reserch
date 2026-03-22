extends Node3D
## プレイヤー移動制御
## 3D空間上でWASD/矢印キーにより移動

@export var move_speed: float = 4.0

var velocity: Vector3 = Vector3.ZERO
var facing_direction: Vector2 = Vector2.DOWN  # 現在の向き

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
	global_position += velocity * delta

func _input(event):
	if event.is_action_pressed("interact"):
		_try_interact()

func _try_interact():
	# インタラクション対象を検索（将来的にArea3Dで検知）
	pass
