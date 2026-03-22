extends Node
## ストーリーデータ定義
## 四季廻りの職人 プロトタイプ版 — 全会話データ

class_name StoryData

# ==========================================
# ストーリーデータベース
# ==========================================

const STORY: Dictionary = {

	# =============================================
	# プロローグ — 世界観導入
	# =============================================
	"prologue": {
		"id": "prologue",
		"lines": [
			{ "speaker": "", "text": "この世界では、すべての人が「前世の記憶」を持って生まれる。" },
			{ "speaker": "", "text": "前世で磨いた技——それが今世の才能として宿る。" },
			{ "speaker": "", "text": "鍛冶師の魂は、何度生まれ変わっても鉄を打つ。\n薬師の魂は、何度生まれ変わっても薬を調合する。" },
			{ "speaker": "", "text": "「技は、魂が覚えている」——それがこの世界の理。" },
			{ "speaker": "", "text": "しかし、たった一人だけ——" },
			{ "speaker": "", "text": "前世の記憶を持たない子供がいた。" },
			{ "speaker": "", "text": "人々はその子を「呪われた子」と呼んだ。" },
			{ "speaker": "", "text": "記憶がない。技がない。何者にもなれない——" },
			{ "speaker": "", "text": "そんな自分が、ただひとつ持っていたもの。" },
			{ "speaker": "", "text": "それは——すべての季節の技を、見よう見まねで使える力だった。" },
		],
		"onComplete": "tsumugi_meeting",
	},

	# =============================================
	# 紬との出会い
	# =============================================
	"tsumugi_meeting": {
		"id": "tsumugi_meeting",
		"lines": [
			{ "speaker": "紬", "text": "あなた……大丈夫？\nこんなところで倒れていたら、花精に襲われてしまうわ。", "emotion": "worried" },
			{ "speaker": "", "text": "（目を覚ますと、満開の桜の下で\n　一人の女性が心配そうに覗き込んでいた）" },
			{ "speaker": "紬", "text": "私は紬。この霞花里で薬師をしているの。", "emotion": "smile" },
			{ "speaker": "紬", "text": "あなた、名前は……\n言えない？　それとも、覚えていないの？", "emotion": "worried" },
			{ "speaker": "", "text": "（自分の名前すら、思い出せない。\n　ただ、ここが初めての場所ではないような気がした）" },
			{ "speaker": "紬", "text": "あなた、前世の記憶が……ないの？", "emotion": "surprised" },
			{ "speaker": "紬", "text": "……そう。\nでも、それは「呪い」なんかじゃないと思う。", "emotion": "gentle" },
			{ "speaker": "紬", "text": "記憶がないのは、まだ思い出せていないだけ。\n私はそう信じたいな。", "emotion": "gentle" },
			{ "speaker": "紬", "text": "私、薬師だから。あなたの体のことが心配で。\nよかったら、一緒に旅をさせてくれない？", "emotion": "smile" },
			{ "speaker": "", "text": "紬が仲間になった！" },
		],
		"onComplete": "",
		"addPartyMember": "tsumugi",
	},

	# =============================================
	# 薬師ギルド長との会話
	# =============================================
	"yakushi_intro": {
		"id": "yakushi_intro",
		"lines": [
			{ "speaker": "薬師ギルド長", "text": "おお、紬。よう来たの。\nその方が例の……前世のない子か。" },
			{ "speaker": "薬師ギルド長", "text": "ふむ……確かに、前世の気配がまるでない。\n珍しいこともあるものじゃ。" },
			{ "speaker": "薬師ギルド長", "text": "じゃが、嘆くことはないぞ。\n前世に縛られぬということは、何にでもなれるということじゃ。" },
			{ "speaker": "紬", "text": "師匠、それよりも……\n最近、桜の様子がおかしくありませんか？", "emotion": "worried" },
			{ "speaker": "薬師ギルド長", "text": "うむ……実はの。\n花煙国にも異変が起きておる。" },
			{ "speaker": "薬師ギルド長", "text": "桜の色が……少しずつ褪せてきている。\nこのままでは、春の力そのものが弱まってしまう。" },
			{ "speaker": "薬師ギルド長", "text": "千年桜の洞に、何か原因があるかもしれん。\n調べてきてくれんか。" },
			{ "speaker": "紬", "text": "わかりました、師匠。\n必ず原因を突き止めてきます。", "emotion": "determined" },
			{ "speaker": "薬師ギルド長", "text": "無理はするなよ。\n紬、おまえさんの腕は信用しておるからの。" },
		],
		"onComplete": "",
		"setFlag": "quest_sennen_started",
	},

	# =============================================
	# 宿屋
	# =============================================
	"inn_rest": {
		"id": "inn_rest",
		"lines": [
			{ "speaker": "宿屋の主人", "text": "おや、旅のお方かい。\nだいぶお疲れのようだねぇ。" },
			{ "speaker": "宿屋の主人", "text": "うちは花煙国で一番の宿だよ。\n桜を見ながらぐっすり眠れるさ。" },
			{ "speaker": "宿屋の主人", "text": "さぁ、ゆっくり休んでいきなさい。\n明日の旅路に備えてね。" },
			{ "speaker": "", "text": "ぐっすりと眠った……\nHPとMPが全回復した！" },
		],
		"onComplete": "",
		"action": "heal",
	},

	# =============================================
	# 花市場
	# =============================================
	"shop_intro": {
		"id": "shop_intro",
		"lines": [
			{ "speaker": "花市場の商人", "text": "いらっしゃい、いらっしゃい！\n花煙国一の品揃えだよ！" },
			{ "speaker": "花市場の商人", "text": "……と言いたいところなんだけどねぇ。\n最近は花の元気がなくて、仕入れが大変なんだ。" },
			{ "speaker": "花市場の商人", "text": "千年桜の洞のあたりから、\n妙な気配が漂ってきてるって話だよ。" },
			{ "speaker": "花市場の商人", "text": "まぁ、それはそれとして！\n買えるものは買っていきなよ。旅の備えは大事だからね！" },
		],
		"onComplete": "",
	},

	# =============================================
	# 村人会話 — 世界観の補足
	# =============================================
	"villager_01": {
		"id": "villager_01",
		"lines": [
			{ "speaker": "花煙国の住民", "text": "花煙国は春の国。\n一年中桜が咲いている、美しい国だよ。" },
			{ "speaker": "花煙国の住民", "text": "でも最近、桜の色が薄くなってきてる気がするんだ。\n……気のせいだといいんだけど。" },
		],
		"onComplete": "",
	},

	"villager_02": {
		"id": "villager_02",
		"lines": [
			{ "speaker": "老いた薬師", "text": "前世の記憶がないだと？\nそんな者は、わしの長い人生でも聞いたことがない。" },
			{ "speaker": "老いた薬師", "text": "じゃが……古い言い伝えにはあるのう。\n「空白の魂には、すべてが宿る」とな。" },
		],
		"onComplete": "",
	},

	# =============================================
	# ボス前会話
	# =============================================
	"before_boss": {
		"id": "before_boss",
		"lines": [
			{ "speaker": "紬", "text": "……この奥から、すごく強い気配を感じる。", "emotion": "worried" },
			{ "speaker": "紬", "text": "きっと、千年桜を守る精霊——花守がいるわ。", "emotion": "serious" },
			{ "speaker": "紬", "text": "本来は桜を護るための存在のはずなのに、\n何かに狂わされているみたい。", "emotion": "worried" },
			{ "speaker": "紬", "text": "気をつけて。春の力が暴走しているから、\nこちらの春属性の技は効きにくいかもしれない。", "emotion": "serious" },
			{ "speaker": "紬", "text": "……でも、あなたなら大丈夫。\nそう信じてる。", "emotion": "smile" },
		],
		"onComplete": "",
	},

	# =============================================
	# ボス撃破後
	# =============================================
	"after_boss": {
		"id": "after_boss",
		"lines": [
			{ "speaker": "", "text": "花守が光に包まれ、静かに消えていった。" },
			{ "speaker": "", "text": "暴走していた春の力が鎮まり、\n千年桜が本来の淡い桜色を取り戻していく。" },
			{ "speaker": "", "text": "その瞬間——\n主人公の心に、かすかな記憶の欠片が宿った。" },
			{ "speaker": "", "text": "（遠い昔、この桜の下を歩いた記憶……\n　誰かの手を握っていた……？）" },
			{ "speaker": "紬", "text": "……今、何かを感じた？\nあなたの表情が、一瞬変わったわ。", "emotion": "surprised" },
			{ "speaker": "紬", "text": "あなたの中にも、前世の記憶が\n眠っているのかもしれない。", "emotion": "gentle" },
			{ "speaker": "紬", "text": "花守を倒したとき、\nあなたの中で何かが目覚めた気がした。", "emotion": "gentle" },
			{ "speaker": "紬", "text": "次は……炎陽国に行ってみない？\nもっと手がかりがあるかもしれないわ。", "emotion": "smile" },
			{ "speaker": "", "text": "第1章「花煙国・春」—— 完" },
			{ "speaker": "", "text": "プロトタイプ版はここまでです。\nお楽しみいただきありがとうございました！" },
		],
		"onComplete": "credits",
		"setFlag": "chapter1_complete",
	},

	# =============================================
	# エンディング（プロトタイプ用）
	# =============================================
	"credits": {
		"id": "credits",
		"lines": [
			{ "speaker": "", "text": "「四季廻りの職人」プロトタイプ版" },
			{ "speaker": "", "text": "企画・設計：石川晃 × Claude AI" },
			{ "speaker": "", "text": "「技は、魂が覚えている。」" },
			{ "speaker": "", "text": "続きをお楽しみに……" },
		],
		"onComplete": "return_to_title",
	},
}

# ==========================================
# ユーティリティ関数
# ==========================================

static func get_dialogue(dialogue_id: String) -> Dictionary:
	return STORY.get(dialogue_id, {})

static func get_lines(dialogue_id: String) -> Array:
	var dialogue: Dictionary = STORY.get(dialogue_id, {})
	return dialogue.get("lines", [])

static func get_on_complete(dialogue_id: String) -> String:
	var dialogue: Dictionary = STORY.get(dialogue_id, {})
	return dialogue.get("onComplete", "")

static func get_set_flag(dialogue_id: String) -> String:
	var dialogue: Dictionary = STORY.get(dialogue_id, {})
	return dialogue.get("setFlag", "")

static func get_action(dialogue_id: String) -> String:
	var dialogue: Dictionary = STORY.get(dialogue_id, {})
	return dialogue.get("action", "")

static func get_add_party_member(dialogue_id: String) -> String:
	var dialogue: Dictionary = STORY.get(dialogue_id, {})
	return dialogue.get("addPartyMember", "")
