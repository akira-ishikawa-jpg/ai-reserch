extends Node
## ゲーム全体の状態管理（Autoloadシングルトン）
## GameState としてどこからでもアクセス可能

class_name GameState

# ==========================================
# 季節定数
# ==========================================

enum Season { SPRING, SUMMER, AUTUMN, WINTER }

const SEASON_ORDER: Array[String] = ["spring", "summer", "autumn", "winter"]

const SEASON_NAMES: Dictionary = {
	"spring": "春",
	"summer": "夏",
	"autumn": "秋",
	"winter": "冬",
}

const SEASON_COLORS: Dictionary = {
	"spring": { "primary": Color("#FFB7C5"), "secondary": Color("#E8F5E9"), "accent": Color("#FF69B4"), "bg": Color("#FFF0F5") },
	"summer": { "primary": Color("#FF8C00"), "secondary": Color("#228B22"), "accent": Color("#FFD700"), "bg": Color("#FFFDE7") },
	"autumn": { "primary": Color("#DC143C"), "secondary": Color("#DAA520"), "accent": Color("#8B4513"), "bg": Color("#FFF3E0") },
	"winter": { "primary": Color("#4169E1"), "secondary": Color("#B0C4DE"), "accent": Color("#E0E0E0"), "bg": Color("#E8EAF6") },
}

# ==========================================
# 季節ユーティリティ関数
# ==========================================

## 対立する季節を返す
static func get_opposite_season(season: String) -> String:
	var idx: int = SEASON_ORDER.find(season)
	if idx == -1:
		return season
	return SEASON_ORDER[(idx + 2) % 4]

## 次の季節を返す
static func get_next_season(season: String) -> String:
	var idx: int = SEASON_ORDER.find(season)
	if idx == -1:
		return season
	return SEASON_ORDER[(idx + 1) % 4]

## 季節間の距離を返す（0=同じ, 1=隣接, 2=対立）
static func get_season_distance(a: String, b: String) -> int:
	var idx_a: int = SEASON_ORDER.find(a)
	var idx_b: int = SEASON_ORDER.find(b)
	if idx_a == -1 or idx_b == -1:
		return 1
	var diff: int = absi(idx_a - idx_b)
	return mini(diff, 4 - diff)

## ダメージ倍率を返す（同じ季節=0.1、隣接=1.0、対立=1.8）
static func get_season_multiplier(attack_season: String, target_season: String) -> float:
	if attack_season == "" or attack_season == null:
		return 1.0
	var dist: int = get_season_distance(attack_season, target_season)
	if dist == 0:
		return 0.1  # 同じ: ほぼ無効化
	if dist == 1:
		return 1.0  # 隣接: 通常
	return 1.8      # 対立: 大ダメージ

# ==========================================
# ゲーム状態
# ==========================================

# パーティメンバー
var party: Array = []

# ストーリーフラグ管理
var flags: Dictionary = {}

# 所持金
var gold: int = 100

# 現在のマップ名
var current_map: String = ""

# 現在の季節（文字列）
var current_season: String = "spring"

# ゲーム内日数
var day_count: int = 1

# プレイ時間（秒）
var play_time: float = 0.0

# シーン名定数
const SCENES: Dictionary = {
	"TITLE": "title",
	"EXPLORATION": "exploration",
	"BATTLE": "battle",
	"DIALOGUE": "dialogue",
}

signal season_changed(new_season: String)
signal gold_changed(new_amount: int)

func _process(delta: float) -> void:
	play_time += delta

func set_flag(flag_name: String, value: bool = true) -> void:
	flags[flag_name] = value

func get_flag(flag_name: String) -> bool:
	return flags.get(flag_name, false)

func add_gold(amount: int) -> void:
	gold += amount
	gold_changed.emit(gold)

func spend_gold(amount: int) -> bool:
	if gold >= amount:
		gold -= amount
		gold_changed.emit(gold)
		return true
	return false

func advance_season() -> void:
	current_season = get_next_season(current_season)
	season_changed.emit(current_season)

func get_season_name() -> String:
	return SEASON_NAMES.get(current_season, "春")

func save_game(slot: int = 0) -> bool:
	var save_data: Dictionary = {
		"party": [],  # TODO: シリアライズ
		"flags": flags,
		"gold": gold,
		"current_map": current_map,
		"current_season": current_season,
		"day_count": day_count,
		"play_time": play_time,
	}
	var save_path: String = "user://save_%d.json" % slot
	var file := FileAccess.open(save_path, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(save_data, "\t"))
		return true
	return false

func load_game(slot: int = 0) -> bool:
	var save_path: String = "user://save_%d.json" % slot
	if not FileAccess.file_exists(save_path):
		return false
	var file := FileAccess.open(save_path, FileAccess.READ)
	if file:
		var json := JSON.new()
		var result: int = json.parse(file.get_as_text())
		if result == OK:
			var data: Dictionary = json.data
			flags = data.get("flags", {})
			gold = data.get("gold", 100)
			current_map = data.get("current_map", "")
			current_season = data.get("current_season", "spring")
			day_count = data.get("day_count", 1)
			play_time = data.get("play_time", 0.0)
			return true
	return false
