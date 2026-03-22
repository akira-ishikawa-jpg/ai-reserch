extends Node3D
## バトルシーンメイン
## ターン制バトルの全体管理

enum BattleState { INIT, PLAYER_TURN, ENEMY_TURN, VICTORY, DEFEAT }

var state: BattleState = BattleState.INIT
var party_units: Array = []
var enemy_units: Array = []
var turn_order: Array = []

signal battle_ended(result: String)

func _ready():
	_init_battle()

func _init_battle():
	state = BattleState.INIT
	# TODO: パーティと敵のユニットを配置
	# TODO: ターン順を速度で決定
	state = BattleState.PLAYER_TURN

func _next_turn():
	# 勝敗判定
	if _all_enemies_defeated():
		state = BattleState.VICTORY
		_on_victory()
		return
	if _all_party_defeated():
		state = BattleState.DEFEAT
		_on_defeat()
		return

	# ターン切り替え
	match state:
		BattleState.PLAYER_TURN:
			state = BattleState.ENEMY_TURN
			_enemy_turn()
		BattleState.ENEMY_TURN:
			state = BattleState.PLAYER_TURN

func _enemy_turn():
	# TODO: 敵AI行動
	_next_turn()

func _all_enemies_defeated() -> bool:
	for unit in enemy_units:
		if unit.get("hp", 0) > 0:
			return false
	return true

func _all_party_defeated() -> bool:
	for unit in party_units:
		if unit.get("hp", 0) > 0:
			return false
	return true

func _on_victory():
	battle_ended.emit("victory")

func _on_defeat():
	battle_ended.emit("defeat")
