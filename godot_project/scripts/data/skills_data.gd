extends Node
## スキルデータ定義
## 全スキル・パッシブのマスターデータ

class_name SkillsData

# ==========================================
# スキルタイプ定数
# ==========================================

const SKILL_TYPES: Dictionary = {
	"ATTACK": "attack",
	"HEAL": "heal",
	"BUFF": "buff",
	"DEBUFF": "debuff",
}

# ==========================================
# ターゲット定数
# ==========================================

const TARGETS: Dictionary = {
	"ENEMY_SINGLE": "enemy_single",
	"ENEMY_ALL": "enemy_all",
	"ALLY_SINGLE": "ally_single",
	"ALLY_ALL": "ally_all",
	"SELF": "self",
}

# ==========================================
# スキルデータベース
# ==========================================

const SKILLS: Dictionary = {

	# ==========================================
	# 双春の薬師スキル（春×春）
	# ==========================================

	"harukazeNoTeate": {
		"id": "harukazeNoTeate",
		"name": "春風の手当",
		"season": "spring",
		"type": "heal",
		"target": "ally_single",
		"mpCost": 8,
		"power": 40,
		"levelReq": 1,
		"description": "味方単体のHPを中程度回復する",
		"effects": [],
	},

	"kafunNoKekkai": {
		"id": "kafunNoKekkai",
		"name": "花粉の結界",
		"season": "spring",
		"type": "buff",
		"target": "ally_all",
		"mpCost": 12,
		"power": 0,
		"levelReq": 5,
		"description": "味方全体に状態異常耐性+50%を3ターン付与",
		"effects": [
			{ "type": "statusResist", "value": 50, "turns": 3 },
		],
	},

	"shinryokuNoIbuki": {
		"id": "shinryokuNoIbuki",
		"name": "新緑の息吹",
		"season": "spring",
		"type": "heal",
		"target": "ally_all",
		"mpCost": 18,
		"power": 25,
		"levelReq": 10,
		"description": "味方全体のHPを小回復し、毒と暗闇を解除する",
		"effects": [
			{ "type": "cleanse", "ailments": ["poison", "blind"] },
		],
	},

	"mankaiNoIyashi": {
		"id": "mankaiNoIyashi",
		"name": "満開の癒し",
		"season": "spring",
		"type": "heal",
		"target": "ally_all",
		"mpCost": 30,
		"power": 70,
		"levelReq": 15,
		"description": "味方全体のHPを大幅に回復する",
		"effects": [],
	},

	"harusame": {
		"id": "harusame",
		"name": "春雨",
		"season": "spring",
		"type": "heal",
		"target": "ally_all",
		"mpCost": 50,
		"power": 999,
		"levelReq": 20,
		"description": "味方全体のHPを全回復し、全状態異常を解除、リジェネを3ターン付与",
		"effects": [
			{ "type": "cleanse", "ailments": "all" },
			{ "type": "regen", "turns": 3, "value": 15 },
		],
	},

	# ==========================================
	# 焔薬師スキル（春×夏）
	# ==========================================

	"shakuSakuKou": {
		"id": "shakuSakuKou",
		"name": "焼灼膏",
		"season": "summer",
		"type": "heal",
		"target": "ally_single",
		"mpCost": 10,
		"power": 35,
		"levelReq": 1,
		"description": "味方単体のHPを回復し、攻撃力+15%を2ターン付与",
		"effects": [
			{ "type": "atkUp", "value": 15, "turns": 2 },
		],
	},

	"hakkaChougou": {
		"id": "hakkaChougou",
		"name": "発火調合",
		"season": "summer",
		"type": "attack",
		"target": "enemy_single",
		"mpCost": 14,
		"power": 45,
		"levelReq": 5,
		"description": "敵単体に夏属性中ダメージを与え、自身のHPを小回復",
		"effects": [
			{ "type": "selfHeal", "value": 15 },
		],
	},

	"shakunetsuNoYakutou": {
		"id": "shakunetsuNoYakutou",
		"name": "灼熱の薬湯",
		"season": "summer",
		"type": "heal",
		"target": "ally_all",
		"mpCost": 22,
		"power": 40,
		"levelReq": 10,
		"description": "味方全体のHPを中回復し、夏属性攻撃+20%を3ターン付与",
		"effects": [
			{ "type": "seasonAtkUp", "season": "summer", "value": 20, "turns": 3 },
		],
	},

	"shakuSou": {
		"id": "shakuSou",
		"name": "焼灼",
		"season": "summer",
		"type": "attack",
		"target": "enemy_all",
		"mpCost": 45,
		"power": 80,
		"levelReq": 20,
		"description": "敵全体に夏属性大ダメージを与え、味方全体のHPを中回復",
		"effects": [
			{ "type": "allyHealAll", "value": 35 },
		],
	},

	# ==========================================
	# 花剣士スキル（夏×春）
	# ==========================================

	"hanabiraGiri": {
		"id": "hanabiraGiri",
		"name": "花弁斬り",
		"season": "spring",
		"type": "attack",
		"target": "enemy_single",
		"mpCost": 8,
		"power": 40,
		"levelReq": 1,
		"description": "敵単体に物理中ダメージを与え、ダメージの10%をHP吸収",
		"effects": [
			{ "type": "drain", "value": 10 },
		],
	},

	"inochigariNoTachi": {
		"id": "inochigariNoTachi",
		"name": "命刈りの太刀",
		"season": "spring",
		"type": "attack",
		"target": "enemy_single",
		"mpCost": 16,
		"power": 70,
		"levelReq": 5,
		"description": "敵単体に物理大ダメージを与え、与ダメージの30%をHP回復",
		"effects": [
			{ "type": "drain", "value": 30 },
		],
	},

	"oukaRanbu": {
		"id": "oukaRanbu",
		"name": "桜花乱舞",
		"season": "spring",
		"type": "attack",
		"target": "enemy_all",
		"mpCost": 22,
		"power": 50,
		"levelReq": 10,
		"description": "敵全体に春属性物理中ダメージを与え、ダメージを吸収",
		"effects": [
			{ "type": "drain", "value": 15 },
		],
	},

	"inochigari": {
		"id": "inochigari",
		"name": "命刈り",
		"season": "spring",
		"type": "attack",
		"target": "enemy_single",
		"mpCost": 48,
		"power": 120,
		"levelReq": 20,
		"description": "敵単体に超威力ダメージ。全吸収し、仲間全員にHP分配",
		"effects": [
			{ "type": "drain", "value": 100 },
			{ "type": "distributeHeal" },
		],
	},

	# ==========================================
	# 烈火の剣士スキル（夏×夏）
	# ==========================================

	"kaenZan": {
		"id": "kaenZan",
		"name": "火炎斬",
		"season": "summer",
		"type": "attack",
		"target": "enemy_single",
		"mpCost": 6,
		"power": 40,
		"levelReq": 1,
		"description": "敵単体に夏属性物理中ダメージを与える",
		"effects": [],
	},

	"ikariNoIchigeki": {
		"id": "ikariNoIchigeki",
		"name": "怒りの一撃",
		"season": "summer",
		"type": "attack",
		"target": "enemy_single",
		"mpCost": 14,
		"power": 65,
		"levelReq": 5,
		"description": "敵単体に物理大ダメージ。自身のHP残量が低いほど威力上昇",
		"effects": [
			{ "type": "lowHpBonus", "maxMultiplier": 2.0 },
		],
	},

	"enJin": {
		"id": "enJin",
		"name": "炎陣",
		"season": "summer",
		"type": "attack",
		"target": "enemy_all",
		"mpCost": 20,
		"power": 50,
		"levelReq": 10,
		"description": "敵全体に夏属性物理中ダメージを与え、火傷DoTを3ターン付与",
		"effects": [
			{ "type": "dot", "ailment": "burn", "turns": 3, "value": 8 },
		],
	},

	"goukaZan": {
		"id": "goukaZan",
		"name": "業火斬",
		"season": "summer",
		"type": "attack",
		"target": "enemy_single",
		"mpCost": 50,
		"power": 150,
		"levelReq": 20,
		"description": "敵単体に夏属性物理超ダメージを与える",
		"effects": [],
	},

	# ==========================================
	# ボス：花守スキル
	# ==========================================

	"haruNoToiki": {
		"id": "haruNoToiki",
		"name": "春の吐息",
		"season": "spring",
		"type": "attack",
		"target": "enemy_all",
		"mpCost": 0,
		"power": 45,
		"levelReq": 1,
		"description": "全体に春属性中ダメージを与え、自身のHPを回復する",
		"effects": [
			{ "type": "selfHeal", "value": 20 },
		],
	},

	"hanaArashi": {
		"id": "hanaArashi",
		"name": "花嵐",
		"season": "spring",
		"type": "attack",
		"target": "enemy_all",
		"mpCost": 0,
		"power": 75,
		"levelReq": 1,
		"description": "全体に春属性大ダメージを与える",
		"effects": [],
	},

	"hanaNoKekkai": {
		"id": "hanaNoKekkai",
		"name": "花の結界",
		"season": "spring",
		"type": "buff",
		"target": "self",
		"mpCost": 0,
		"power": 0,
		"levelReq": 1,
		"description": "春属性ダメージ吸収バリアを展開する",
		"effects": [
			{ "type": "absorbBarrier", "season": "spring", "turns": 3, "value": 100 },
		],
	},

	# ==========================================
	# ザコ敵：妖精系スキル
	# ==========================================

	"hanabiraDan": {
		"id": "hanabiraDan",
		"name": "花びら弾",
		"season": "spring",
		"type": "attack",
		"target": "enemy_single",
		"mpCost": 0,
		"power": 20,
		"levelReq": 1,
		"description": "単体に春属性小ダメージを与える",
		"effects": [],
	},

	"taiatari": {
		"id": "taiatari",
		"name": "体当たり",
		"season": "",
		"type": "attack",
		"target": "enemy_single",
		"mpCost": 0,
		"power": 18,
		"levelReq": 1,
		"description": "単体に物理小ダメージを与える（無属性）",
		"effects": [],
	},

	# ==========================================
	# ザコ敵追加スキル（花蜂・霧狐用）
	# ==========================================

	"dokubari": {
		"id": "dokubari",
		"name": "毒針",
		"season": "summer",
		"type": "attack",
		"target": "enemy_single",
		"mpCost": 0,
		"power": 22,
		"levelReq": 1,
		"description": "単体に小ダメージ+毒付与（3ターン）",
		"effects": [
			{ "type": "dot", "ailment": "poison", "turns": 3, "value": 5 },
		],
	},

	"kitsuneBi": {
		"id": "kitsuneBi",
		"name": "狐火",
		"season": "autumn",
		"type": "attack",
		"target": "enemy_single",
		"mpCost": 0,
		"power": 25,
		"levelReq": 1,
		"description": "単体に秋属性小ダメージを与える",
		"effects": [],
	},

	"kagerou": {
		"id": "kagerou",
		"name": "陽炎",
		"season": "autumn",
		"type": "buff",
		"target": "self",
		"mpCost": 0,
		"power": 0,
		"levelReq": 1,
		"description": "回避率を上昇させる（2ターン）",
		"effects": [
			{ "type": "evasionUp", "value": 30, "turns": 2 },
		],
	},
}

# ==========================================
# パッシブスキル（遺憶の痕）
# ==========================================

const PASSIVES: Dictionary = {
	"seimeiNoKioku": {
		"id": "seimeiNoKioku",
		"name": "生命の記憶",
		"description": "被ダメージ時にHP10%を自動回復する",
		"trigger": "onDamaged",
		"effect": { "type": "autoHeal", "value": 10 },
	},

	"nekketsuNoKioku": {
		"id": "nekketsuNoKioku",
		"name": "熱血の記憶",
		"description": "回復スキル使用後、次の攻撃威力が+25%",
		"trigger": "afterHeal",
		"effect": { "type": "nextAtkUp", "value": 25 },
	},

	"hanaNoKenki": {
		"id": "hanaNoKenki",
		"name": "花の剣気",
		"description": "攻撃時10%の確率でHP吸収が発動",
		"trigger": "onAttack",
		"effect": { "type": "drainChance", "chance": 10, "value": 20 },
	},

	"rekkaNoTamashii": {
		"id": "rekkaNoTamashii",
		"name": "烈火の魂",
		"description": "クリティカル率が+15%上昇する",
		"trigger": "passive",
		"effect": { "type": "critUp", "value": 15 },
	},
}

# ==========================================
# ユーティリティ関数
# ==========================================

static func get_skill(skill_id: String) -> Dictionary:
	return SKILLS.get(skill_id, {})

static func get_passive(passive_id: String) -> Dictionary:
	return PASSIVES.get(passive_id, {})

static func get_skills_by_season(season: String) -> Array:
	var result: Array = []
	for skill_id in SKILLS:
		if SKILLS[skill_id].get("season") == season:
			result.append({"id": skill_id, "data": SKILLS[skill_id]})
	return result

static func get_skills_by_type(skill_type: String) -> Array:
	var result: Array = []
	for skill_id in SKILLS:
		if SKILLS[skill_id].get("type") == skill_type:
			result.append({"id": skill_id, "data": SKILLS[skill_id]})
	return result
