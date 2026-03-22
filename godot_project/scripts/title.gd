extends Control
## タイトル画面
## ゲーム開始・セーブデータロードの入口

@onready var new_game_btn: Button = $VBoxContainer/NewGameButton
@onready var continue_btn: Button = $VBoxContainer/ContinueButton

func _ready():
	new_game_btn.pressed.connect(_on_new_game)
	continue_btn.pressed.connect(_on_continue)

	# セーブデータがなければ「つづきから」を無効化
	if not FileAccess.file_exists("user://save_0.json"):
		continue_btn.disabled = true

func _on_new_game():
	# ゲーム状態を初期化
	GameState.party = []
	GameState.flags = {}
	GameState.gold = 100
	GameState.current_season = 0
	GameState.day_count = 1
	GameState.play_time = 0.0

	# 探索シーンへ遷移
	var main = get_parent()
	if main.has_method("change_scene"):
		main.change_scene("res://scenes/exploration.tscn")

func _on_continue():
	if GameState.load_game(0):
		var main = get_parent()
		if main.has_method("change_scene"):
			main.change_scene("res://scenes/exploration.tscn")
