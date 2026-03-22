extends RefCounted
## パーティ・キャラクター管理
## Web版の Character クラスと PartyManager クラスを移植

class_name PartyManager

# ==========================================
# Character（内部クラス）
# ==========================================

class Character extends RefCounted:
	var id: String = ""
	var char_name: String = ""
	var level: int = 1
	var exp: int = 0

	# HP/MP
	var max_hp: int = 100
	var hp: int = 100
	var max_mp: int = 30
	var mp: int = 30

	# ステータス
	var atk: int = 10
	var def_stat: int = 5  # "def" はGDScript予約語回避
	var matk: int = 8
	var mdef: int = 5
	var spd: int = 10

	# 季節・ジョブ
	var current_season: String = "spring"
	var job: String = ""
	var available_jobs: Array[String] = []

	# 遺憶の痕（パッシブ）
	var ioku_slots: Array[String] = []
	var max_ioku_slots: int = 1

	# 留まるシステム
	var is_staying: bool = false
	var stay_bonus: bool = false

	# バフ・デバフ
	var buffs: Array[Dictionary] = []
	var debuffs: Array[Dictionary] = []

	# 状態異常
	var ailments: Array[Dictionary] = []

	# 描画用
	var sprite_data: Dictionary = {}

	# -------------------------------------------
	# コンストラクタ
	# -------------------------------------------

	func _init(data: Dictionary = {}) -> void:
		id = data.get("id", "")
		char_name = data.get("name", "")
		level = data.get("level", 1)
		exp = 0

		max_hp = data.get("maxHp", 100)
		hp = max_hp
		max_mp = data.get("maxMp", 30)
		mp = max_mp

		atk = data.get("atk", 10)
		def_stat = data.get("def", 5)
		matk = data.get("matk", 8)
		mdef = data.get("mdef", 5)
		spd = data.get("spd", 10)

		current_season = data.get("startingSeason", "spring")
		job = data.get("jobId", "")
		if job != "":
			available_jobs = [job]
		else:
			available_jobs = []

		ioku_slots = []
		max_ioku_slots = 1
		is_staying = false
		stay_bonus = false
		buffs = []
		debuffs = []
		ailments = []
		sprite_data = data.get("spriteData", {})

	# -------------------------------------------
	# スキル取得
	# -------------------------------------------

	## 現在のジョブでレベル条件を満たすスキルを返す
	func get_skills() -> Array[Dictionary]:
		var job_data: Dictionary = JobsData.get_job(job)
		if job_data.is_empty():
			return []
		var result: Array[Dictionary] = []
		var skill_ids: Array = job_data.get("skillIds", [])
		for skill_id in skill_ids:
			var skill: Dictionary = SkillsData.get_skill(skill_id)
			if not skill.is_empty() and skill.get("levelReq", 1) <= level:
				result.append(skill)
		return result

	## 指定スキルを使用可能か（MP＋レベル条件）
	func can_use_skill(skill_id: String) -> bool:
		var skill: Dictionary = SkillsData.get_skill(skill_id)
		if skill.is_empty():
			return false
		if skill.get("levelReq", 1) > level:
			return false
		if skill.get("mpCost", 0) > mp:
			return false
		return true

	# -------------------------------------------
	# 生死判定
	# -------------------------------------------

	func is_alive() -> bool:
		return hp > 0

	# -------------------------------------------
	# 季節操作
	# -------------------------------------------

	## 次の季節へ進む
	func advance_season() -> void:
		current_season = GameState.get_next_season(current_season)

	## 留まる（季節を変えない）
	func stay() -> void:
		is_staying = true
		stay_bonus = true

	## 留まり状態をリセット
	func reset_stay() -> void:
		is_staying = false
		stay_bonus = false

	# -------------------------------------------
	# ダメージ・回復
	# -------------------------------------------

	## ダメージを適用（0以下にならない）
	func take_damage(amount: float) -> int:
		var actual: int = maxi(0, int(amount))
		hp = maxi(0, hp - actual)

		# パッシブ: 生命の記憶チェック
		if hp > 0 and _has_passive("seimeiNoKioku"):
			var auto_heal: int = int(max_hp * 0.10)
			hp = mini(max_hp, hp + auto_heal)

		return actual

	## HPを回復
	func heal_hp(amount: float) -> int:
		var actual: int = int(amount)
		var before: int = hp
		hp = mini(max_hp, hp + actual)
		return hp - before

	## MPを消費
	func consume_mp(amount: int) -> void:
		mp = maxi(0, mp - amount)

	## MPを回復
	func heal_mp(amount: float) -> int:
		var before: int = mp
		mp = mini(max_mp, mp + int(amount))
		return mp - before

	## HP/MP全回復
	func full_restore() -> void:
		hp = max_hp
		mp = max_mp
		ailments = []
		buffs = []
		debuffs = []

	# -------------------------------------------
	# バフ・デバフ管理
	# -------------------------------------------

	## バフを追加
	func add_buff(buff: Dictionary) -> void:
		# 同種のバフがあれば上書き
		buffs = buffs.filter(func(b: Dictionary) -> bool: return b.get("type") != buff.get("type"))
		buffs.append(buff.duplicate())

	## デバフを追加
	func add_debuff(debuff: Dictionary) -> void:
		debuffs = debuffs.filter(func(d: Dictionary) -> bool: return d.get("type") != debuff.get("type"))
		debuffs.append(debuff.duplicate())

	## ターン経過処理（バフ・デバフのターン消費）
	func tick_buffs() -> void:
		var new_buffs: Array[Dictionary] = []
		for b in buffs:
			var nb: Dictionary = b.duplicate()
			nb["turns"] = nb.get("turns", 1) - 1
			if nb["turns"] > 0:
				new_buffs.append(nb)
		buffs = new_buffs

		var new_debuffs: Array[Dictionary] = []
		for d in debuffs:
			var nd: Dictionary = d.duplicate()
			nd["turns"] = nd.get("turns", 1) - 1
			if nd["turns"] > 0:
				new_debuffs.append(nd)
		debuffs = new_debuffs

	## 状態異常を追加
	func add_ailment(ailment: Dictionary) -> void:
		for a in ailments:
			if a.get("type") == ailment.get("type"):
				return
		ailments.append(ailment.duplicate())

	## 状態異常を解除
	func remove_ailment(ailment_type: String) -> void:
		ailments = ailments.filter(func(a: Dictionary) -> bool: return a.get("type") != ailment_type)

	## 全状態異常を解除
	func clear_all_ailments() -> void:
		ailments = []

	## 状態異常のターン経過（DoTダメージ等）
	func tick_ailments() -> int:
		var total_dot: int = 0
		var new_ailments: Array[Dictionary] = []
		for a in ailments:
			if a.has("damage"):
				total_dot += a.get("damage", 0)
			var na: Dictionary = a.duplicate()
			na["turns"] = na.get("turns", 1) - 1
			if na["turns"] > 0:
				new_ailments.append(na)
		ailments = new_ailments

		if total_dot > 0:
			take_damage(total_dot)
		return total_dot

	# -------------------------------------------
	# バフ込みステータス取得
	# -------------------------------------------

	func get_effective_atk() -> int:
		var value: int = atk
		for b in buffs:
			if b.get("type") == "atkUp":
				value = int(value * (1.0 + b.get("value", 0) / 100.0))
		for d in debuffs:
			if d.get("type") == "atkDown":
				value = int(value * (1.0 - d.get("value", 0) / 100.0))
		return value

	func get_effective_def() -> int:
		var value: int = def_stat
		for b in buffs:
			if b.get("type") == "defUp":
				value = int(value * (1.0 + b.get("value", 0) / 100.0))
		for d in debuffs:
			if d.get("type") == "defDown":
				value = int(value * (1.0 - d.get("value", 0) / 100.0))
		return value

	func get_effective_matk() -> int:
		var value: int = matk
		for b in buffs:
			if b.get("type") == "matkUp":
				value = int(value * (1.0 + b.get("value", 0) / 100.0))
		return value

	func get_effective_mdef() -> int:
		var value: int = mdef
		for b in buffs:
			if b.get("type") == "mdefUp":
				value = int(value * (1.0 + b.get("value", 0) / 100.0))
		return value

	func get_effective_spd() -> int:
		var value: int = spd
		# 留まりボーナス: 速度+10%
		if stay_bonus:
			value = int(value * 1.1)
		return value

	func get_crit_rate() -> int:
		var rate: int = 5  # 基本クリティカル率5%
		if _has_passive("rekkaNoTamashii"):
			rate += 15
		return rate

	# -------------------------------------------
	# ジョブ管理
	# -------------------------------------------

	## ジョブを変更
	func change_job(job_id: String) -> bool:
		if not available_jobs.has(job_id):
			return false
		job = job_id
		# ジョブ変更時にステータスを基本値に戻す
		var job_data: Dictionary = JobsData.get_job(job_id)
		if not job_data.is_empty():
			var stats: Dictionary = job_data.get("baseStats", {})
			max_hp = stats.get("hp", max_hp)
			max_mp = stats.get("mp", max_mp)
			atk = stats.get("atk", atk)
			def_stat = stats.get("def", def_stat)
			matk = stats.get("matk", matk)
			mdef = stats.get("mdef", mdef)
			spd = stats.get("spd", spd)
			hp = mini(hp, max_hp)
			mp = mini(mp, max_mp)
		return true

	## ジョブを解放
	func unlock_job(job_id: String) -> void:
		if not available_jobs.has(job_id):
			available_jobs.append(job_id)

	# -------------------------------------------
	# 遺憶の痕（パッシブ）管理
	# -------------------------------------------

	## パッシブをスロットにセット
	func equip_passive(passive_id: String) -> bool:
		if ioku_slots.size() >= max_ioku_slots:
			return false
		if ioku_slots.has(passive_id):
			return false
		ioku_slots.append(passive_id)
		return true

	## パッシブをスロットから外す
	func unequip_passive(passive_id: String) -> void:
		ioku_slots = ioku_slots.filter(func(pid: String) -> bool: return pid != passive_id)

	## 指定パッシブを持っているか（ジョブ固有 or スロット装備）
	func _has_passive(passive_id: String) -> bool:
		var job_data: Dictionary = JobsData.get_job(job)
		if not job_data.is_empty() and job_data.get("passiveId") == passive_id:
			return true
		return ioku_slots.has(passive_id)

	# -------------------------------------------
	# 経験値・レベルアップ
	# -------------------------------------------

	## 必要経験値テーブル
	static func exp_for_level(lv: int) -> int:
		return int(20.0 * pow(float(lv), 1.5))

	## 経験値を加算し、レベルアップを処理
	func gain_exp(amount: int) -> bool:
		exp += amount
		var leveled: bool = false
		while exp >= Character.exp_for_level(level + 1):
			exp -= Character.exp_for_level(level + 1)
			level += 1
			_apply_level_up()
			leveled = true
		return leveled

	## レベルアップ時のステータス上昇
	func _apply_level_up() -> void:
		var job_data: Dictionary = JobsData.get_job(job)
		if job_data.is_empty():
			return

		# ロール別の成長率
		var growth_rates: Dictionary = {
			"healer":   { "hp": 8,  "mp": 6, "atk": 1, "def": 2, "matk": 3, "mdef": 3, "spd": 1 },
			"attacker": { "hp": 12, "mp": 3, "atk": 4, "def": 2, "matk": 1, "mdef": 1, "spd": 2 },
			"hybrid":   { "hp": 10, "mp": 5, "atk": 2, "def": 2, "matk": 3, "mdef": 2, "spd": 2 },
		}
		var role: String = job_data.get("role", "hybrid")
		var growth: Dictionary = growth_rates.get(role, growth_rates["hybrid"])

		max_hp += growth.get("hp", 0)
		max_mp += growth.get("mp", 0)
		atk += growth.get("atk", 0)
		def_stat += growth.get("def", 0)
		matk += growth.get("matk", 0)
		mdef += growth.get("mdef", 0)
		spd += growth.get("spd", 0)

		# レベルアップ時HP/MP全回復
		hp = max_hp
		mp = max_mp


# ==========================================
# PartyManager
# ==========================================

var members: Array = []  # Array of Character
var active_slots: int = 3

## リーダー（先頭メンバー）を返す
func get_leader() -> Character:
	if members.size() > 0:
		return members[0]
	return null

## メンバーを追加
func add_member(character: Character) -> void:
	members.append(character)

## メンバーを除外
func remove_member(character_id: String) -> void:
	members = members.filter(func(m: Character) -> bool: return m.id != character_id)

## バトルに出すアクティブメンバー（先頭から最大active_slots人）
func get_active_members() -> Array:
	return members.slice(0, active_slots)

## 全メンバー
func get_all_members() -> Array:
	return members

## 生存メンバーのみ
func get_alive_members() -> Array:
	return get_active_members().filter(func(m: Character) -> bool: return m.is_alive())

## 全滅判定
func is_wiped() -> bool:
	for m in get_active_members():
		if m.is_alive():
			return false
	return true

## 宿屋：全員HP/MP全回復
func heal_all() -> void:
	for member in members:
		member.full_restore()

## 全員の季節を進める
func advance_all_seasons() -> void:
	for member in get_active_members():
		if not member.is_staying:
			member.advance_season()
		member.reset_stay()

## 全員のバフ・状態異常ターン経過
func tick_all() -> void:
	for member in get_active_members():
		member.tick_buffs()
		member.tick_ailments()

## 経験値を全生存メンバーに均等分配
func distribute_exp(total_exp: int) -> Array:
	var alive: Array = get_alive_members()
	if alive.size() == 0:
		return []
	var each: int = int(total_exp / alive.size())
	var leveled_up: Array = []
	for member in alive:
		if member.gain_exp(each):
			leveled_up.append(member)
	return leveled_up


# ==========================================
# 初期パーティ生成ヘルパー
# ==========================================

static func create_initial_party() -> PartyManager:
	var party := PartyManager.new()

	# 主人公
	var hero := Character.new({
		"id": "hero",
		"name": "（プレイヤー）",
		"level": 5,
		"maxHp": 350,
		"maxMp": 60,
		"atk": 35,
		"def": 25,
		"matk": 15,
		"mdef": 18,
		"spd": 22,
		"jobId": "rekkaNoKenshi",
		"startingSeason": "summer",
		"spriteData": { "bodyColor": "#4169E1", "headColor": "#FFD700" },
	})
	hero.level = 5  # コンストラクタ後に明示的にセット

	# 紬
	var tsumugi := Character.new({
		"id": "tsumugi",
		"name": "紬",
		"level": 4,
		"maxHp": 280,
		"maxMp": 120,
		"atk": 15,
		"def": 20,
		"matk": 35,
		"mdef": 30,
		"spd": 18,
		"jobId": "souShunYakushi",
		"startingSeason": "spring",
		"spriteData": { "bodyColor": "#FFB7C5", "headColor": "#FFF0F5" },
	})
	tsumugi.level = 4

	party.add_member(hero)
	party.add_member(tsumugi)

	return party


# ==========================================
# 敵キャラクター生成ヘルパー
# ==========================================

static func create_enemy_character(enemy_id: String) -> Character:
	var data: Dictionary = EnemiesData.get_enemy(enemy_id)
	if data.is_empty():
		return null

	var enemy := Character.new({
		"id": data.get("id", "") + "_" + str(Time.get_ticks_msec()),
		"name": data.get("name", ""),
		"level": 1,
		"maxHp": data.get("hp", 50),
		"maxMp": 999,
		"atk": data.get("atk", 10),
		"def": data.get("def", 5),
		"matk": data.get("matk", 10),
		"mdef": data.get("mdef", 5),
		"spd": data.get("spd", 10),
		"jobId": "",
		"startingSeason": data.get("season", "spring"),
		"spriteData": data.get("spriteData", {}),
	})

	# 敵用の追加プロパティ（メタデータとして辞書に格納）
	enemy.set_meta("enemy_data", data)
	enemy.set_meta("exp_reward", data.get("exp", 0))
	enemy.set_meta("gold_reward", data.get("gold", 0))
	enemy.set_meta("ai", data.get("ai", "basic"))
	enemy.set_meta("absorb_season", data.get("absorbSeason", ""))
	enemy.set_meta("season_change_rate", data.get("seasonChangeRate", 3))
	enemy.set_meta("evasion", data.get("evasion", 0))
	enemy.set_meta("skill_ids", data.get("skills", []))

	return enemy
