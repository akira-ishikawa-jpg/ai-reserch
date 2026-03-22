extends RefCounted
## バトルユニット
## バトル中のキャラ/敵の状態ラッパー（Web版 BattleUnit クラスの移植）

class_name BattleUnit

var unit_name: String = ""
var is_enemy: bool = false

# ステータス
var hp: int = 0
var max_hp: int = 0
var mp: int = 0
var max_mp: int = 0
var atk: int = 0
var def_stat: int = 0
var matk: int = 0
var mdef: int = 0
var spd: int = 0
var level: int = 1

var current_season: String = "spring"
var job: String = ""
var skills: Array[Dictionary] = []

# バトルローカル状態
var is_guarding: bool = false       # 「留まる」中
var guard_boosted: bool = false     # 次ターンのスキル威力2倍フラグ
var def_bonus: int = 0              # 防御ボーナス
var skill_seal_turns: int = 0       # スキル封印残りターン
var stun_turns: int = 0             # 行動停止残りターン
var alive: bool = true

# 敵AI用
var season_timer: int = 0           # 敵の季節巡りカウンタ
var season_interval: int = 3        # 季節変化間隔

# 描画用
var sprite_data: Dictionary = {}

# ソースキャラクターへの参照
var _src = null  # Character or enemy data

# ==========================================
# コンストラクタ
# ==========================================

func _init(src = null, p_is_enemy: bool = false) -> void:
	if src == null:
		return

	is_enemy = p_is_enemy

	if src is PartyManager.Character:
		# Characterオブジェクトから生成
		var ch: PartyManager.Character = src
		unit_name = ch.char_name
		hp = ch.hp
		max_hp = ch.max_hp
		mp = ch.mp
		max_mp = ch.max_mp
		atk = ch.atk
		def_stat = ch.def_stat
		matk = ch.matk
		mdef = ch.mdef
		spd = ch.spd
		level = ch.level
		current_season = ch.current_season
		job = ch.job
		sprite_data = ch.sprite_data

		# スキルを解決
		var char_skills: Array[Dictionary] = ch.get_skills()
		skills = []
		for s in char_skills:
			skills.append(s)

		# 敵の場合のメタデータ
		if p_is_enemy and ch.has_meta("season_change_rate"):
			season_interval = ch.get_meta("season_change_rate")
			var skill_ids: Array = ch.get_meta("skill_ids") if ch.has_meta("skill_ids") else []
			skills = []
			for sid in skill_ids:
				var skill_data: Dictionary = SkillsData.get_skill(sid)
				if not skill_data.is_empty():
					skills.append(skill_data)
				else:
					skills.append({
						"id": sid, "name": sid, "mpCost": 0, "power": 10,
						"type": "attack", "target": "enemy_single", "season": "spring"
					})
	elif src is Dictionary:
		# 辞書から生成（直接敵データなど）
		var d: Dictionary = src
		unit_name = d.get("name", "")
		hp = d.get("hp", 50)
		max_hp = d.get("maxHp", d.get("hp", 50))
		mp = d.get("mp", 0)
		max_mp = d.get("maxMp", d.get("mp", 0))
		atk = d.get("atk", 10)
		def_stat = d.get("def", 5)
		matk = d.get("matk", atk)
		mdef = d.get("mdef", def_stat)
		spd = d.get("spd", 10)
		level = d.get("level", 1)
		current_season = d.get("currentSeason", d.get("season", "spring"))
		job = d.get("job", "")
		sprite_data = d.get("spriteData", { "bodyColor": "#888", "headColor": "#AAA" })
		season_interval = d.get("seasonInterval", d.get("seasonChangeRate", 2 + randi() % 2))

		# スキルIDを解決
		var raw_skills: Array = d.get("skills", [])
		skills = []
		for s in raw_skills:
			if s is String:
				var skill_data: Dictionary = SkillsData.get_skill(s)
				if not skill_data.is_empty():
					skills.append(skill_data)
				else:
					skills.append({
						"id": s, "name": s, "mpCost": 0, "power": 10,
						"type": "attack", "target": "enemy_single", "season": "spring"
					})
			elif s is Dictionary:
				skills.append(s)

	_src = src

	# 初期状態リセット
	is_guarding = false
	guard_boosted = false
	def_bonus = 0
	skill_seal_turns = 0
	stun_turns = 0
	alive = hp > 0
	season_timer = 0

# ==========================================
# プロパティ
# ==========================================

var is_dead: bool:
	get:
		return hp <= 0

# ==========================================
# ダメージ・回復
# ==========================================

func take_damage(amount: float) -> int:
	var actual: int = maxi(0, int(amount))
	hp = maxi(0, hp - actual)
	if hp == 0:
		alive = false
	return actual

func heal(amount: float) -> int:
	var actual: int = mini(max_hp - hp, maxi(0, int(amount)))
	hp += actual
	return actual

func restore_mp(amount: float) -> int:
	var actual: int = mini(max_mp - mp, maxi(0, int(amount)))
	mp += actual
	return actual

# ==========================================
# 季節操作
# ==========================================

func advance_season() -> void:
	current_season = GameState.get_next_season(current_season)

# ==========================================
# ターン終了時の状態更新
# ==========================================

func tick_end_of_turn() -> void:
	if skill_seal_turns > 0:
		skill_seal_turns -= 1
	if stun_turns > 0:
		stun_turns -= 1
	# guard_boosted は使用後にリセットされるのでここでは触らない
	def_bonus = 0
	is_guarding = false
