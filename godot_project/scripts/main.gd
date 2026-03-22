extends Node
## メインシーン管理
## シーン遷移を一元管理する

var current_scene: Node = null

func _ready():
	# タイトルシーンをロード
	change_scene("res://scenes/title.tscn")

func change_scene(path: String):
	if current_scene:
		current_scene.queue_free()
		current_scene = null

	var packed_scene = load(path)
	if packed_scene:
		var scene = packed_scene.instantiate()
		add_child(scene)
		current_scene = scene
	else:
		push_error("Failed to load scene: " + path)

func change_scene_deferred(path: String):
	call_deferred("change_scene", path)
