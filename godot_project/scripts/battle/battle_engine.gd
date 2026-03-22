extends RefCounted
## バトルエンジン
## ターン管理・ダメージ計算・敵AI・四季の合一（Web版 BattleEngine の移植）

class_name BattleEngine

# ==========================================
# メンバー変数
# ==========================================

var allies: Array = []       # Array of BattleUnit
var enemies: Array = []      # Array of BattleUnit
var all_units: Array = []    # Array of BattleUnit

var turn_order: Array = []   # Array of BattleUnit
var current_index: int = 0
var turn_count: int = 0

# start | input | execute | turnEnd | victory | defeat
var phase: String = "start"
var pending_action: Dictionary = {}
var log: Array[Dictionary] = []  # {text: String, type: String}

# ==========================================
# コンストラクタ
# ==========================================

func _init(p_allies: Array = [], p_enemies: Array = []) -> void:
	allies = p_allies
	enemies = p_enemies
	all_units = []
	for a in allies:
		all_units.append(a)
	for e in enemies:
		all_units.append(e)

	turn_order = []
	current_index = 0
	turn_count = 0
	phase = "start"
	pending_action = {}
	log = []

# ==========================================
# ターン管理
# ==========================================

## 新ターンを開始し行動順を決定
func start_turn() -> void:
	turn_count += 1

	# 敵の季節タイマー進行
	for e in enemies:
		if not e.alive:
			continue
		e.season_timer += 1
		if e.season_timer >= e.season_interval:
			e.season_timer = 0
			var old_season: String = e.current_season
			e.advance_season()
			log.append({
				"text": "%sの内なる季節が%sから%sに巡った" % [
					e.unit_name,
					GameState.SEASON_NAMES.get(old_season, old_season),
					GameState.SEASON_NAMES.get(e.current_season, e.current_season)
				],
				"type": "info"
			})

	# 速度順にソート（同速はランダム）
	var living: Array = all_units.filter(func(u: BattleUnit) -> bool: return u.alive)
	living.sort_custom(func(a: BattleUnit, b: BattleUnit) -> bool:
		if a.spd != b.spd:
			return a.spd > b.spd
		return randf() > 0.5
	)
	turn_order = living
	current_index = 0
	phase = "input"
	_advance_to_next_alive()

## 現在の行動者
func get_current_unit() -> BattleUnit:
	if current_index >= turn_order.size():
		return null
	return turn_order[current_index]

## 次の生存者まで index を進める
func _advance_to_next_alive() -> void:
	while current_index < turn_order.size():
		var unit: BattleUnit = turn_order[current_index]
		if unit.alive and unit.stun_turns <= 0:
			return
		if unit.alive and unit.stun_turns > 0:
			log.append({ "text": "%sは行動できない!" % unit.unit_name, "type": "info" })
		current_index += 1
	# 全員行動終了
	phase = "turnEnd"

# ==========================================
# 行動実行
# ==========================================

## 行動決定を受け取って実行結果を返す
func execute_action(action: Dictionary) -> Array[Dictionary]:
	var results: Array[Dictionary] = []
	var actor: BattleUnit = action.get("actor")
	var action_type: String = action.get("type", "")

	match action_type:

		"advance":
			# 巡る: 季節を進める + 通常攻撃
			var old_season: String = actor.current_season
			actor.advance_season()
			results.append({
				"type": "seasonChange",
				"unit": actor,
				"from": old_season,
				"to": actor.current_season,
				"text": "%sの季節が%sから%sに巡った" % [
					actor.unit_name,
					GameState.SEASON_NAMES.get(old_season, old_season),
					GameState.SEASON_NAMES.get(actor.current_season, actor.current_season)
				],
			})

			# 通常攻撃（攻撃者の現在の季節属性）
			var target: BattleUnit = action.get("target")
			if target == null:
				target = _pick_default_target(actor)
			if target != null and target.alive:
				var dmg_result: Dictionary = _calc_physical_damage(actor, target, 1.0, actor.current_season)
				var dealt: int = target.take_damage(dmg_result.get("damage", 0))
				results.append({
					"type": "damage",
					"actor": actor,
					"target": target,
					"damage": dealt,
					"season": actor.current_season,
					"multiplier": dmg_result.get("multiplier", 1.0),
					"critical": false,
					"text": "%sの攻撃! %sに%dダメージ" % [actor.unit_name, target.unit_name, dealt],
				})

		"guard":
			# 留まる: 防御+30% & 次ターン同季節スキル威力2倍
			actor.is_guarding = true
			actor.def_bonus = int(actor.def_stat * 0.3)
			actor.guard_boosted = true
			results.append({
				"type": "guard",
				"unit": actor,
				"text": "%sは季節に留まり身構えた (防御+30%%, 次スキル威力2倍)" % actor.unit_name,
			})

		"skill":
			var skill: Dictionary = action.get("skill", {})
			if skill.is_empty():
				pass
			else:
				# MP消費チェック
				if actor.mp < skill.get("mpCost", 0):
					results.append({ "type": "fail", "text": "MPが足りない!", "actor": actor })
				# スキル封印チェック
				elif actor.skill_seal_turns > 0:
					results.append({ "type": "fail", "text": "%sはスキルが封印されている!" % actor.unit_name, "actor": actor })
				else:
					actor.mp -= skill.get("mpCost", 0)

					var skill_target_type: String = skill.get("target", "enemy_single")
					if skill_target_type == "enemy_all" or skill_target_type == "ally_all":
						# 全体スキル
						var targets: Array = []
						if skill_target_type == "enemy_all":
							if actor.is_enemy:
								targets = allies.filter(func(u: BattleUnit) -> bool: return u.alive)
							else:
								targets = enemies.filter(func(u: BattleUnit) -> bool: return u.alive)
						else:
							if actor.is_enemy:
								targets = enemies.filter(func(u: BattleUnit) -> bool: return u.alive)
							else:
								targets = allies.filter(func(u: BattleUnit) -> bool: return u.alive)

						for t in targets:
							var r: Dictionary = _apply_skill(actor, t, skill)
							results.append(r)
					else:
						# 単体スキル / selfスキル
						var target2: BattleUnit = action.get("target")
						if skill_target_type == "self":
							target2 = actor
						elif target2 == null:
							target2 = _pick_default_target(actor)
						if target2 != null and target2.alive:
							var r: Dictionary = _apply_skill(actor, target2, skill)
							results.append(r)

					# 留まるブーストを消費
					if actor.guard_boosted:
						actor.guard_boosted = false

		"item":
			var item: Dictionary = action.get("item", {})
			if not item.is_empty():
				var target3: BattleUnit = action.get("target", actor)
				if target3 == null:
					target3 = actor

				if item.get("effect") == "healHp":
					var healed: int = target3.heal(item.get("value", 50))
					results.append({
						"type": "heal",
						"actor": actor,
						"target": target3,
						"amount": healed,
						"text": "%sは%sを使った! %sのHPが%d回復" % [actor.unit_name, item.get("name", "アイテム"), target3.unit_name, healed],
					})
				elif item.get("effect") == "healMp":
					var restored: int = target3.restore_mp(item.get("value", 20))
					results.append({
						"type": "mpHeal",
						"actor": actor,
						"target": target3,
						"amount": restored,
						"text": "%sは%sを使った! %sのMPが%d回復" % [actor.unit_name, item.get("name", "アイテム"), target3.unit_name, restored],
					})

		"unity":
			# 四季の合一
			var unity_result: Dictionary = _execute_unity(actor)
			results.append(unity_result)

	# ログ追加
	for r in results:
		if r.has("text"):
			log.append({ "text": r.get("text", ""), "type": r.get("type", "info") })

	# 次のユニットへ
	current_index += 1
	_advance_to_next_alive()

	# 勝敗判定
	var all_enemies_dead: bool = true
	for e in enemies:
		if e.alive:
			all_enemies_dead = false
			break

	var all_allies_dead: bool = true
	for a in allies:
		if a.alive:
			all_allies_dead = false
			break

	if all_enemies_dead:
		phase = "victory"
	elif all_allies_dead:
		phase = "defeat"

	return results

## ターン終了処理
func end_turn() -> void:
	for u in all_units:
		if u.alive:
			u.tick_end_of_turn()

# ==========================================
# ダメージ計算
# ==========================================

func _calc_physical_damage(attacker: BattleUnit, defender: BattleUnit, skill_multiplier: float, skill_season: String) -> Dictionary:
	var base_dmg: float = maxf(1.0, (attacker.atk * skill_multiplier) - ((defender.def_stat + defender.def_bonus) * 0.5))
	var season_mul: float = GameState.get_season_multiplier(skill_season, defender.current_season)

	# 留まるブースト
	var guard_boost: float = 1.0
	if attacker.guard_boosted and skill_multiplier > 1.0:
		guard_boost = 2.0

	# 小さなランダム幅 (0.9 ~ 1.1)
	var rand_val: float = 0.9 + randf() * 0.2

	var damage: int = int(base_dmg * season_mul * guard_boost * rand_val)
	return { "damage": maxi(1, damage), "multiplier": season_mul, "guardBoosted": guard_boost > 1.0 }

func _calc_magical_damage(attacker: BattleUnit, defender: BattleUnit, skill_multiplier: float, skill_season: String) -> Dictionary:
	var base_dmg: float = maxf(1.0, (attacker.matk * skill_multiplier) - ((defender.mdef + defender.def_bonus) * 0.5))
	var season_mul: float = GameState.get_season_multiplier(skill_season, defender.current_season)

	var guard_boost: float = 1.0
	if attacker.guard_boosted:
		guard_boost = 2.0

	var rand_val: float = 0.9 + randf() * 0.2
	var damage: int = int(base_dmg * season_mul * guard_boost * rand_val)
	return { "damage": maxi(1, damage), "multiplier": season_mul, "guardBoosted": guard_boost > 1.0 }

func _apply_skill(actor: BattleUnit, target: BattleUnit, skill: Dictionary) -> Dictionary:
	var season: String = skill.get("season", actor.current_season)
	if season == "" or season == null:
		season = actor.current_season
	var skill_type: String = skill.get("type", "attack")
	var is_heal: bool = skill_type == "heal"
	var is_buff: bool = skill_type == "buff"
	var is_debuff: bool = skill_type == "debuff"

	if is_heal:
		var base_stat: int = actor.matk if actor.matk > 0 else actor.atk
		var amount: float = base_stat * skill.get("power", 1.0) * (0.9 + randf() * 0.2)
		var healed: int = target.heal(amount)
		return {
			"type": "heal",
			"actor": actor,
			"target": target,
			"amount": healed,
			"season": season,
			"text": "%sの%s! %sのHPが%d回復" % [actor.unit_name, skill.get("name", ""), target.unit_name, healed],
		}

	if is_buff or is_debuff:
		var text: String = "%sの%s!" % [actor.unit_name, skill.get("name", "")]
		var effects: Array = skill.get("effects", [])
		for eff in effects:
			var eff_type: String = eff.get("type", "")
			if eff_type in ["statusResist", "atkUp", "defUp", "matkUp", "mdefUp", "seasonAtkUp", "evasionUp"]:
				text += " %sに%s" % [target.unit_name, skill.get("description", "バフ")]
			elif eff_type == "absorbBarrier":
				text += " %sにバリアを展開" % target.unit_name
		return {
			"type": "buff",
			"actor": actor,
			"target": target,
			"season": season,
			"text": text,
		}

	# 攻撃スキル
	var is_magic: bool = skill_type == "magic"
	var dmg_result: Dictionary
	if is_magic:
		dmg_result = _calc_magical_damage(actor, target, skill.get("power", 1.5), season)
	else:
		dmg_result = _calc_physical_damage(actor, target, skill.get("power", 1.5), season)
	var dealt: int = target.take_damage(dmg_result.get("damage", 0))

	var multiplier: float = dmg_result.get("multiplier", 1.0)
	var big_hit: bool = multiplier >= 1.5
	var weak: bool = multiplier <= 0.5

	var text: String = "%sの%s! %sに%dダメージ" % [actor.unit_name, skill.get("name", ""), target.unit_name, dealt]
	if big_hit:
		text += " 【効果抜群!】"
	if weak:
		text += " 【いまひとつ...】"
	if dmg_result.get("guardBoosted", false):
		text += " 【留まりの力!】"

	return {
		"type": "damage",
		"actor": actor,
		"target": target,
		"damage": dealt,
		"season": season,
		"multiplier": multiplier,
		"critical": big_hit,
		"weak": weak,
		"text": text,
	}

# ==========================================
# ターゲット選択
# ==========================================

func _pick_default_target(actor: BattleUnit) -> BattleUnit:
	var candidates: Array = []
	if actor.is_enemy:
		candidates = allies.filter(func(u: BattleUnit) -> bool: return u.alive)
	else:
		candidates = enemies.filter(func(u: BattleUnit) -> bool: return u.alive)
	if candidates.size() == 0:
		return null
	return candidates[randi() % candidates.size()]

# ==========================================
# 四季の合一 (Unity)
# ==========================================

## パーティ全員の季節が揃っているかチェック
func check_unity_available() -> String:
	var living_allies: Array = allies.filter(func(a: BattleUnit) -> bool: return a.alive)
	if living_allies.size() < 2:
		return ""
	var season: String = living_allies[0].current_season
	for a in living_allies:
		if a.current_season != season:
			return ""
	return season

func _execute_unity(actor: BattleUnit) -> Dictionary:
	var season: String = check_unity_available()
	if season == "":
		return { "type": "fail", "text": "四季の合一は発動できない!", "actor": actor }

	match season:
		"spring":
			# 全体HP全回復
			for a in allies:
				if a.alive:
					a.heal(a.max_hp)
			return { "type": "unity", "season": season, "text": "【四季の合一 - 春】全員のHPが全回復した!" }

		"summer":
			# 敵全体に大ダメージ
			var total_dmg: int = 0
			for e in enemies:
				if e.alive:
					var dmg: int = int(actor.atk * 3.0)
					total_dmg += e.take_damage(dmg)
			return { "type": "unity", "season": season, "text": "【四季の合一 - 夏】灼熱の力で敵全体に%dダメージ!" % total_dmg }

		"autumn":
			# 敵全体スキル封印3ターン
			for e in enemies:
				if e.alive:
					e.skill_seal_turns = 3
			return { "type": "unity", "season": season, "text": "【四季の合一 - 秋】敵全体のスキルを3ターン封印した!" }

		"winter":
			# 敵全体3ターン行動停止
			for e in enemies:
				if e.alive:
					e.stun_turns = 3
			return { "type": "unity", "season": season, "text": "【四季の合一 - 冬】敵全体を3ターン凍結させた!" }

	return { "type": "fail", "text": "四季の合一は発動できない!", "actor": actor }

# ==========================================
# 敵AI
# ==========================================

## 敵ユニットの行動を決定
func decide_enemy_action(enemy: BattleUnit) -> Dictionary:
	var hp_ratio: float = float(enemy.hp) / float(enemy.max_hp)
	var available_skills: Array = []
	if enemy.skill_seal_turns <= 0:
		for s in enemy.skills:
			if s.get("mpCost", 0) <= enemy.mp:
				available_skills.append(s)

	# HPが30%以下 → 強スキルを優先
	if hp_ratio <= 0.3 and available_skills.size() > 0:
		var strongest: Dictionary = available_skills[0]
		for s in available_skills:
			if s.get("power", 0) > strongest.get("power", 0):
				strongest = s
		var target: BattleUnit = _pick_best_target(enemy, strongest)
		return { "type": "skill", "actor": enemy, "target": target, "skill": strongest }

	# 通常: 40%の確率でスキル使用（使えるスキルがある場合）
	if available_skills.size() > 0 and randf() < 0.4:
		var skill: Dictionary = available_skills[randi() % available_skills.size()]
		var target: BattleUnit = _pick_best_target(enemy, skill)
		return { "type": "skill", "actor": enemy, "target": target, "skill": skill }

	# 通常攻撃（巡るとして扱う — 季節も進む）
	var target: BattleUnit = _pick_default_target(enemy)
	return { "type": "advance", "actor": enemy, "target": target }

## 季節相性が最も有利なターゲットを選ぶ
func _pick_best_target(enemy: BattleUnit, skill: Dictionary) -> BattleUnit:
	var candidates: Array = allies.filter(func(u: BattleUnit) -> bool: return u.alive)
	if candidates.size() == 0:
		return null

	var skill_season: String = skill.get("season", enemy.current_season)
	if skill_season == "" or skill_season == null:
		skill_season = enemy.current_season
	var best: BattleUnit = candidates[0]
	var best_mul: float = GameState.get_season_multiplier(skill_season, best.current_season)

	for i in range(1, candidates.size()):
		var mul: float = GameState.get_season_multiplier(skill_season, candidates[i].current_season)
		if mul > best_mul:
			best_mul = mul
			best = candidates[i]
	return best

# ==========================================
# EXP計算
# ==========================================

func calc_exp_reward() -> int:
	var total: int = 0
	for e in enemies:
		total += (e.level if e.level > 0 else 1) * 10 + e.max_hp
	return total
