extends Node3D
## 探索シーンメイン
## HD-2D空間でのフィールド探索を管理

@onready var camera: Camera3D = $Camera3D
@onready var player: Node3D = $Characters/Player

func _ready():
	# カメラのターゲットをプレイヤーに設定
	if camera.has_method("_ready"):
		camera.target = player
	else:
		camera.set("target", player)

	GameState.current_map = name
	_setup_season_lighting()

func _setup_season_lighting():
	var dir_light = $DirectionalLight3D
	var omni_light = $OmniLight3D

	match GameState.current_season:
		"spring":
			dir_light.light_color = Color(1.0, 0.98, 0.92)
			dir_light.light_energy = 1.2
			omni_light.light_color = Color(1.0, 0.85, 0.6)
		"summer":
			dir_light.light_color = Color(1.0, 1.0, 0.95)
			dir_light.light_energy = 1.5
			omni_light.light_color = Color(1.0, 0.9, 0.7)
		"autumn":
			dir_light.light_color = Color(1.0, 0.9, 0.75)
			dir_light.light_energy = 1.0
			omni_light.light_color = Color(1.0, 0.7, 0.4)
		"winter":
			dir_light.light_color = Color(0.85, 0.9, 1.0)
			dir_light.light_energy = 0.8
			omni_light.light_color = Color(0.8, 0.85, 1.0)

func _input(event):
	if event.is_action_pressed("cancel"):
		# メニューを開く（将来実装）
		pass
