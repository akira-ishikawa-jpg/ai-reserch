extends Control
## タイトル画面
## ゲーム開始・セーブデータロードの入口
## プロシージャルに桜の花びらアニメーションを表示

@onready var new_game_btn: Button = $VBoxContainer/NewGameButton
@onready var continue_btn: Button = $VBoxContainer/ContinueButton
@onready var title_label: Label = $VBoxContainer/TitleLabel
@onready var background: ColorRect = $Background

# 桜パーティクル用
var petals: Array = []
const PETAL_COUNT = 20

func _ready():
	new_game_btn.pressed.connect(_on_new_game)
	continue_btn.pressed.connect(_on_continue)

	# セーブデータがなければ「つづきから」を無効化
	if not FileAccess.file_exists("user://save_0.json"):
		continue_btn.disabled = true

	# タイトルの見た目を整える
	_style_title()

func _style_title():
	# 背景を和風の暗い藍色に
	background.color = Color(0.08, 0.06, 0.14, 1.0)

	# タイトルラベルのフォントサイズ
	title_label.add_theme_font_size_override("font_size", 42)
	title_label.add_theme_color_override("font_color", Color(1.0, 0.84, 0.88))

	# ボタンのスタイリング
	for btn in [new_game_btn, continue_btn]:
		btn.add_theme_font_size_override("font_size", 20)

	# 桜の花びらを初期化
	for i in range(PETAL_COUNT):
		petals.append({
			"x": randf() * 960.0,
			"y": randf() * 540.0,
			"speed": randf_range(20.0, 60.0),
			"drift": randf_range(-15.0, 15.0),
			"size": randf_range(3.0, 8.0),
			"alpha": randf_range(0.3, 0.7),
		})

func _process(delta):
	# 花びらアニメーション
	for petal in petals:
		petal["y"] += petal["speed"] * delta
		petal["x"] += petal["drift"] * delta
		if petal["y"] > 560:
			petal["y"] = -10.0
			petal["x"] = randf() * 960.0
	queue_redraw()

func _draw():
	# 桜の花びらを描画
	var petal_color = Color(1.0, 0.72, 0.77)
	for petal in petals:
		var c = Color(petal_color.r, petal_color.g, petal_color.b, petal["alpha"])
		var pos = Vector2(petal["x"], petal["y"])
		var s = petal["size"]
		draw_rect(Rect2(pos.x - s * 0.5, pos.y - s * 0.5, s, s), c)

func _on_new_game():
	# ゲーム状態を初期化
	GameState.party = []
	GameState.flags = {}
	GameState.gold = 100
	GameState.current_season = "spring"
	GameState.current_map = "kasumikari"
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
