extends CanvasLayer
## バトルUI
## OTスタイルのターン順表示・コマンドメニュー・ステータス・テキスト演出

class_name BattleUI

# ==========================================
# 季節カラー定義（UIテーマ）
# ==========================================

const SEASON_UI_COLORS: Dictionary = {
	"spring": {
		"primary": Color("F5A0B3"),     # 桜ピンク
		"secondary": Color("C8E6C9"),   # 淡緑
		"accent": Color("FFFFFF"),      # 白
		"bg": Color("2A1520"),          # 暗めピンク背景
	},
	"summer": {
		"primary": Color("FF8C00"),     # 鮮やかオレンジ
		"secondary": Color("FFD700"),   # 金色
		"accent": Color("4CAF50"),      # 緑
		"bg": Color("2A1F10"),          # 暗め橙背景
	},
	"autumn": {
		"primary": Color("D32F2F"),     # 深紅
		"secondary": Color("FFB74D"),   # 琥珀
		"accent": Color("8D6E63"),      # 茶
		"bg": Color("2A1510"),          # 暗め赤背景
	},
	"winter": {
		"primary": Color("64B5F6"),     # 氷青
		"secondary": Color("E0E0E0"),   # 銀
		"accent": Color("1A237E"),      # 群青
		"bg": Color("101828"),          # 暗め青背景
	},
}

# ==========================================
# シグナル
# ==========================================

signal command_selected(command: String)
signal skill_selected(skill_id: String)
signal target_selected(target_index: int)
signal back_pressed()

# ==========================================
# UI状態
# ==========================================

enum UIState { HIDDEN, TURN_ORDER, COMMAND_SELECT, SKILL_SELECT, TARGET_SELECT, STATUS_DISPLAY }

var _current_state: UIState = UIState.HIDDEN
var _current_season: String = "spring"
var _turn_order_data: Array = []

# ==========================================
# UIノード参照
# ==========================================

var _turn_bar: HBoxContainer = null
var _command_menu: VBoxContainer = null
var _skill_menu: VBoxContainer = null
var _status_panel: PanelContainer = null
var _party_status_container: HBoxContainer = null
var _enemy_status_container: VBoxContainer = null
var _text_popup_container: Control = null

# ==========================================
# 初期化
# ==========================================

func _ready():
	layer = 10
	_build_ui()

func _build_ui():
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)

	# ターン順バー（上部）
	_build_turn_bar(root)
	# パーティステータス（下部左）
	_build_party_status(root)
	# 敵ステータス（上部右）
	_build_enemy_status(root)
	# コマンドメニュー（下部右）
	_build_command_menu(root)
	# スキルメニュー（コマンドの上に重ねる）
	_build_skill_menu(root)
	# テキストポップアップ用コンテナ
	_build_text_popup_container(root)

	# 初期非表示
	_command_menu.visible = false
	_skill_menu.visible = false

# ==========================================
# ターン順表示バー
# ==========================================

func _build_turn_bar(parent: Control):
	var panel := PanelContainer.new()
	panel.set_anchors_preset(Control.PRESET_TOP_WIDE)
	panel.custom_minimum_size = Vector2(0, 50)

	var style := StyleBoxFlat.new()
	style.bg_color = Color(0, 0, 0, 0.6)
	style.content_margin_left = 10
	style.content_margin_right = 10
	style.content_margin_top = 5
	style.content_margin_bottom = 5
	panel.add_theme_stylebox_override("panel", style)
	parent.add_child(panel)

	_turn_bar = HBoxContainer.new()
	_turn_bar.alignment = BoxContainer.ALIGNMENT_CENTER
	_turn_bar.add_theme_constant_override("separation", 4)
	panel.add_child(_turn_bar)

## ターン順を更新
func update_turn_order(units: Array):
	_turn_order_data = units
	# 既存の子を削除
	for child in _turn_bar.get_children():
		child.queue_free()

	for i in range(units.size()):
		var unit_data: Dictionary = units[i]
		var icon := _create_turn_icon(unit_data, i == 0)
		_turn_bar.add_child(icon)

func _create_turn_icon(unit_data: Dictionary, is_current: bool) -> PanelContainer:
	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(60, 36)

	var style := StyleBoxFlat.new()
	var is_ally: bool = unit_data.get("is_ally", false)
	style.bg_color = Color(0.2, 0.35, 0.5, 0.8) if is_ally else Color(0.5, 0.15, 0.15, 0.8)
	if is_current:
		style.border_width_bottom = 3
		style.border_color = Color.WHITE
	style.corner_radius_top_left = 4
	style.corner_radius_top_right = 4
	style.corner_radius_bottom_left = 4
	style.corner_radius_bottom_right = 4
	panel.add_theme_stylebox_override("panel", style)

	var label := Label.new()
	label.text = unit_data.get("name", "???")
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.add_theme_font_size_override("font_size", 12)
	panel.add_child(label)

	# 現在行動中は拡大アニメーション
	if is_current:
		panel.scale = Vector2(1.15, 1.15)
		panel.pivot_offset = panel.custom_minimum_size / 2.0

	return panel

# ==========================================
# コマンドメニュー（季節カラー対応）
# ==========================================

func _build_command_menu(parent: Control):
	var panel := PanelContainer.new()
	panel.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	panel.position = Vector2(-220, -200)
	panel.custom_minimum_size = Vector2(200, 180)

	var style := StyleBoxFlat.new()
	style.bg_color = Color(0, 0, 0, 0.75)
	style.border_width_left = 3
	style.border_color = SEASON_UI_COLORS[_current_season]["primary"]
	style.corner_radius_top_left = 6
	style.corner_radius_top_right = 6
	style.corner_radius_bottom_left = 6
	style.corner_radius_bottom_right = 6
	style.content_margin_left = 12
	style.content_margin_right = 12
	style.content_margin_top = 8
	style.content_margin_bottom = 8
	panel.add_theme_stylebox_override("panel", style)
	parent.add_child(panel)

	_command_menu = VBoxContainer.new()
	_command_menu.add_theme_constant_override("separation", 4)
	panel.add_child(_command_menu)

	# コマンドボタン
	var commands := [
		{"id": "attack", "label": "こうげき"},
		{"id": "skill", "label": "わざ"},
		{"id": "guard", "label": "ぼうぎょ"},
		{"id": "item", "label": "どうぐ"},
		{"id": "escape", "label": "にげる"},
	]

	for cmd in commands:
		var btn := Button.new()
		btn.text = cmd["label"]
		btn.alignment = HORIZONTAL_ALIGNMENT_LEFT
		btn.add_theme_font_size_override("font_size", 16)

		# フラットスタイル
		var btn_style := StyleBoxFlat.new()
		btn_style.bg_color = Color(0, 0, 0, 0)
		btn.add_theme_stylebox_override("normal", btn_style)

		var hover_style := StyleBoxFlat.new()
		hover_style.bg_color = Color(SEASON_UI_COLORS[_current_season]["primary"], 0.3)
		hover_style.corner_radius_top_left = 3
		hover_style.corner_radius_top_right = 3
		hover_style.corner_radius_bottom_left = 3
		hover_style.corner_radius_bottom_right = 3
		btn.add_theme_stylebox_override("hover", hover_style)

		var cmd_id := cmd["id"] as String
		btn.pressed.connect(func(): command_selected.emit(cmd_id))
		_command_menu.add_child(btn)

## コマンドメニュー表示（スライドインアニメーション）
func show_command_menu():
	_current_state = UIState.COMMAND_SELECT
	_command_menu.visible = true
	_command_menu.modulate.a = 0.0

	var parent_panel := _command_menu.get_parent() as Control
	if parent_panel:
		var target_pos := parent_panel.position
		parent_panel.position.x += 50
		var tween := create_tween()
		tween.set_parallel(true)
		tween.tween_property(_command_menu, "modulate:a", 1.0, 0.2)
		tween.tween_property(parent_panel, "position:x", target_pos.x, 0.2).set_ease(Tween.EASE_OUT)

## コマンドメニュー非表示
func hide_command_menu():
	var tween := create_tween()
	tween.tween_property(_command_menu, "modulate:a", 0.0, 0.15)
	tween.tween_callback(func(): _command_menu.visible = false)

# ==========================================
# スキル選択メニュー
# ==========================================

func _build_skill_menu(parent: Control):
	var panel := PanelContainer.new()
	panel.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	panel.position = Vector2(-400, -280)
	panel.custom_minimum_size = Vector2(350, 250)

	var style := StyleBoxFlat.new()
	style.bg_color = Color(0, 0, 0, 0.8)
	style.border_width_left = 2
	style.border_width_top = 2
	style.border_color = SEASON_UI_COLORS[_current_season]["secondary"]
	style.corner_radius_top_left = 6
	style.corner_radius_top_right = 6
	style.corner_radius_bottom_left = 6
	style.corner_radius_bottom_right = 6
	style.content_margin_left = 10
	style.content_margin_right = 10
	style.content_margin_top = 8
	style.content_margin_bottom = 8
	panel.add_theme_stylebox_override("panel", style)
	parent.add_child(panel)

	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(330, 230)
	panel.add_child(scroll)

	_skill_menu = VBoxContainer.new()
	_skill_menu.add_theme_constant_override("separation", 2)
	scroll.add_child(_skill_menu)

	_skill_menu.visible = false

## スキルリストを表示
func show_skill_menu(skills: Array, current_mp: int):
	_current_state = UIState.SKILL_SELECT

	# 既存のスキルボタンをクリア
	for child in _skill_menu.get_children():
		child.queue_free()

	for skill_data in skills:
		var btn := _create_skill_button(skill_data, current_mp)
		_skill_menu.add_child(btn)

	# 戻るボタン
	var back_btn := Button.new()
	back_btn.text = "← もどる"
	back_btn.add_theme_font_size_override("font_size", 14)
	back_btn.pressed.connect(func(): back_pressed.emit())
	_skill_menu.add_child(back_btn)

	_skill_menu.visible = true
	_skill_menu.modulate.a = 0.0
	var tween := create_tween()
	tween.tween_property(_skill_menu, "modulate:a", 1.0, 0.2)

func _create_skill_button(skill_data: Dictionary, current_mp: int) -> HBoxContainer:
	var hbox := HBoxContainer.new()
	hbox.add_theme_constant_override("separation", 8)

	# 季節属性アイコン（色付き丸）
	var season_icon := ColorRect.new()
	season_icon.custom_minimum_size = Vector2(12, 12)
	var season_str: String = skill_data.get("season", "none")
	var season_color: Color = SEASON_UI_COLORS.get(season_str, SEASON_UI_COLORS["spring"])["primary"]
	season_icon.color = season_color
	hbox.add_child(season_icon)

	# スキル名ボタン
	var btn := Button.new()
	btn.text = skill_data.get("name", "???")
	btn.add_theme_font_size_override("font_size", 14)
	var mp_cost: int = skill_data.get("mpCost", 0)
	btn.disabled = current_mp < mp_cost
	var skill_id: String = skill_data.get("id", "")
	btn.pressed.connect(func(): skill_selected.emit(skill_id))
	hbox.add_child(btn)

	# MPコスト
	var mp_label := Label.new()
	mp_label.text = "MP " + str(mp_cost)
	mp_label.add_theme_font_size_override("font_size", 12)
	mp_label.add_theme_color_override("font_color", Color(0.5, 0.7, 1.0) if current_mp >= mp_cost else Color(0.5, 0.3, 0.3))
	hbox.add_child(mp_label)

	return hbox

## スキルメニュー非表示
func hide_skill_menu():
	var tween := create_tween()
	tween.tween_property(_skill_menu, "modulate:a", 0.0, 0.15)
	tween.tween_callback(func(): _skill_menu.visible = false)

# ==========================================
# パーティステータス表示（下部左）
# ==========================================

func _build_party_status(parent: Control):
	_status_panel = PanelContainer.new()
	_status_panel.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	_status_panel.position = Vector2(10, -120)
	_status_panel.custom_minimum_size = Vector2(420, 100)

	var style := StyleBoxFlat.new()
	style.bg_color = Color(0, 0, 0, 0.6)
	style.corner_radius_top_left = 6
	style.corner_radius_top_right = 6
	style.corner_radius_bottom_left = 6
	style.corner_radius_bottom_right = 6
	style.content_margin_left = 8
	style.content_margin_right = 8
	style.content_margin_top = 6
	style.content_margin_bottom = 6
	_status_panel.add_theme_stylebox_override("panel", style)
	parent.add_child(_status_panel)

	_party_status_container = HBoxContainer.new()
	_party_status_container.add_theme_constant_override("separation", 12)
	_status_panel.add_child(_party_status_container)

## パーティステータス更新
func update_party_status(party: Array):
	for child in _party_status_container.get_children():
		child.queue_free()

	for unit_data in party:
		var status := _create_unit_status(unit_data)
		_party_status_container.add_child(status)

func _create_unit_status(data: Dictionary) -> VBoxContainer:
	var vbox := VBoxContainer.new()
	vbox.custom_minimum_size = Vector2(90, 80)
	vbox.add_theme_constant_override("separation", 2)

	# 名前
	var name_label := Label.new()
	name_label.text = data.get("name", "???")
	name_label.add_theme_font_size_override("font_size", 12)
	name_label.add_theme_color_override("font_color", Color.WHITE)
	vbox.add_child(name_label)

	# HPバー
	var hp_bar := _create_status_bar(
		data.get("hp", 0), data.get("max_hp", 1),
		Color(0.2, 0.8, 0.2), Color(0.8, 0.2, 0.2)
	)
	vbox.add_child(hp_bar)

	# HP数値
	var hp_label := Label.new()
	hp_label.text = "%d/%d" % [data.get("hp", 0), data.get("max_hp", 1)]
	hp_label.add_theme_font_size_override("font_size", 10)
	hp_label.add_theme_color_override("font_color", Color(0.8, 0.8, 0.8))
	vbox.add_child(hp_label)

	# MPバー
	var mp_bar := _create_status_bar(
		data.get("mp", 0), data.get("max_mp", 1),
		Color(0.3, 0.5, 1.0), Color(0.15, 0.15, 0.4)
	)
	vbox.add_child(mp_bar)

	# MP数値
	var mp_label := Label.new()
	mp_label.text = "%d/%d" % [data.get("mp", 0), data.get("max_mp", 1)]
	mp_label.add_theme_font_size_override("font_size", 10)
	mp_label.add_theme_color_override("font_color", Color(0.7, 0.8, 1.0))
	vbox.add_child(mp_label)

	return vbox

func _create_status_bar(current: int, maximum: int, full_color: Color, empty_color: Color) -> ProgressBar:
	var bar := ProgressBar.new()
	bar.custom_minimum_size = Vector2(85, 8)
	bar.max_value = maximum
	bar.value = current
	bar.show_percentage = false

	# スタイル
	var bg_style := StyleBoxFlat.new()
	bg_style.bg_color = Color(0.1, 0.1, 0.1, 0.8)
	bg_style.corner_radius_top_left = 2
	bg_style.corner_radius_top_right = 2
	bg_style.corner_radius_bottom_left = 2
	bg_style.corner_radius_bottom_right = 2
	bar.add_theme_stylebox_override("background", bg_style)

	var fill_style := StyleBoxFlat.new()
	var ratio := float(current) / float(maxi(maximum, 1))
	fill_style.bg_color = full_color.lerp(empty_color, 1.0 - ratio)
	fill_style.corner_radius_top_left = 2
	fill_style.corner_radius_top_right = 2
	fill_style.corner_radius_bottom_left = 2
	fill_style.corner_radius_bottom_right = 2
	bar.add_theme_stylebox_override("fill", fill_style)

	return bar

# ==========================================
# 敵ステータス表示（弱点アイコン・シールド値）
# ==========================================

func _build_enemy_status(parent: Control):
	_enemy_status_container = VBoxContainer.new()
	_enemy_status_container.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	_enemy_status_container.position = Vector2(-200, 60)
	_enemy_status_container.add_theme_constant_override("separation", 6)
	parent.add_child(_enemy_status_container)

## 敵ステータス更新（弱点アイコン・シールド値を表示）
func update_enemy_status(enemies: Array):
	for child in _enemy_status_container.get_children():
		child.queue_free()

	for enemy_data in enemies:
		var entry := _create_enemy_status_entry(enemy_data)
		_enemy_status_container.add_child(entry)

func _create_enemy_status_entry(data: Dictionary) -> HBoxContainer:
	var hbox := HBoxContainer.new()
	hbox.add_theme_constant_override("separation", 6)

	# 敵名
	var name_label := Label.new()
	name_label.text = data.get("name", "???")
	name_label.add_theme_font_size_override("font_size", 12)
	hbox.add_child(name_label)

	# シールド値（OTのブレイクシステム）
	var shield_value: int = data.get("shield", 0)
	var shield_label := Label.new()
	shield_label.text = "🛡 " + str(shield_value)
	shield_label.add_theme_font_size_override("font_size", 12)
	shield_label.add_theme_color_override("font_color", Color(0.4, 0.6, 0.9) if shield_value > 0 else Color(0.8, 0.2, 0.2))
	hbox.add_child(shield_label)

	# 弱点属性アイコン
	var weaknesses: Array = data.get("weaknesses", [])
	for weakness in weaknesses:
		var icon := _create_weakness_icon(weakness as String, data.get("revealed_weaknesses", []))
		hbox.add_child(icon)

	return hbox

func _create_weakness_icon(season: String, revealed: Array) -> ColorRect:
	var icon := ColorRect.new()
	icon.custom_minimum_size = Vector2(16, 16)

	if season in revealed:
		# 判明済み：季節色で表示
		var colors := SEASON_UI_COLORS.get(season, SEASON_UI_COLORS["spring"])
		icon.color = colors["primary"]
	else:
		# 未判明：灰色の？マーク
		icon.color = Color(0.3, 0.3, 0.3)

	return icon

# ==========================================
# テキスト演出（BREAK / WEAK / CRITICAL）
# ==========================================

func _build_text_popup_container(parent: Control):
	_text_popup_container = Control.new()
	_text_popup_container.set_anchors_preset(Control.PRESET_FULL_RECT)
	_text_popup_container.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(_text_popup_container)

## 画面中央にテキスト演出（OTスタイル：拡大→縮小→スライドアウト）
func show_battle_text(text: String, color: Color = Color.WHITE, font_size: int = 64):
	var label := Label.new()
	label.text = text
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	label.add_theme_constant_override("outline_size", 6)
	label.add_theme_color_override("font_outline_color", Color.BLACK)
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.set_anchors_preset(Control.PRESET_CENTER)
	label.pivot_offset = label.size / 2.0
	_text_popup_container.add_child(label)

	# アニメーション
	label.scale = Vector2.ZERO
	label.modulate.a = 1.0

	var tween := create_tween()
	# 拡大
	tween.tween_property(label, "scale", Vector2(1.3, 1.3), 0.1).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_BACK)
	# 縮小
	tween.tween_property(label, "scale", Vector2.ONE, 0.1).set_ease(Tween.EASE_IN_OUT)
	# 維持
	tween.tween_interval(0.6)
	# スライドアウト + フェード
	tween.set_parallel(true)
	tween.tween_property(label, "position:y", label.position.y - 40, 0.3).set_ease(Tween.EASE_IN)
	tween.tween_property(label, "modulate:a", 0.0, 0.3)
	tween.set_parallel(false)
	tween.tween_callback(func(): label.queue_free())

## 「BREAK」テキスト演出
func show_break_text():
	show_battle_text("BREAK", Color(1.0, 0.3, 0.1), 72)

## 「WEAK」テキスト演出
func show_weak_text():
	show_battle_text("WEAK", Color(0.2, 0.8, 1.0), 48)

## 「CRITICAL」テキスト演出
func show_critical_text():
	show_battle_text("CRITICAL", Color(1.0, 0.9, 0.1), 56)

## 「MISS」テキスト演出
func show_miss_text():
	show_battle_text("MISS", Color(0.5, 0.5, 0.5), 40)

## 季節変更テキスト演出
func show_season_change_text(season: String):
	var season_names := {
		"spring": "春",
		"summer": "夏",
		"autumn": "秋",
		"winter": "冬",
	}
	var name: String = season_names.get(season, "???")
	var color: Color = SEASON_UI_COLORS.get(season, SEASON_UI_COLORS["spring"])["primary"]
	show_battle_text("— %s の気配 —" % name, color, 48)

# ==========================================
# 季節テーマの切り替え
# ==========================================

## 季節変更時にUIカラーを更新
func set_season_theme(season: String):
	_current_season = season
	# コマンドメニューのボーダーカラーを更新
	var panel := _command_menu.get_parent() as PanelContainer
	if panel:
		var style := panel.get_theme_stylebox("panel") as StyleBoxFlat
		if style:
			style.border_color = SEASON_UI_COLORS[season]["primary"]

# ==========================================
# バトル開始・終了演出
# ==========================================

## バトル開始時のUI表示
func show_battle_start():
	# 暗幕からフェードイン
	var overlay := ColorRect.new()
	overlay.color = Color(0, 0, 0, 1)
	overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(overlay)

	var tween := create_tween()
	tween.tween_property(overlay, "color:a", 0.0, 0.8)
	tween.tween_callback(func(): overlay.queue_free())

## 勝利演出
func show_victory():
	show_battle_text("VICTORY", Color(1.0, 0.85, 0.2), 80)
	hide_command_menu()

## 敗北演出
func show_defeat():
	show_battle_text("DEFEAT", Color(0.6, 0.1, 0.1), 80)
	hide_command_menu()

# ==========================================
# 必殺技演出用の背景暗転
# ==========================================

## 背景を暗転してスポットライト風にする
func darken_background(duration: float = 0.3) -> ColorRect:
	var overlay := ColorRect.new()
	overlay.color = Color(0, 0, 0, 0)
	overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(overlay)

	var tween := create_tween()
	tween.tween_property(overlay, "color:a", 0.7, duration)
	return overlay

## 暗転を解除
func lighten_background(overlay: ColorRect, duration: float = 0.3):
	if not is_instance_valid(overlay):
		return
	var tween := create_tween()
	tween.tween_property(overlay, "color:a", 0.0, duration)
	tween.tween_callback(func(): overlay.queue_free())

# ==========================================
# HPバーアニメーション
# ==========================================

## HPが変動した際にバーをアニメーションで更新
func animate_hp_change(unit_index: int, new_hp: int, max_hp: int):
	if unit_index >= _party_status_container.get_child_count():
		return

	var status_vbox := _party_status_container.get_child(unit_index) as VBoxContainer
	if not status_vbox or status_vbox.get_child_count() < 3:
		return

	# HPバーは2番目の子（index 1）
	var hp_bar := status_vbox.get_child(1) as ProgressBar
	if not hp_bar:
		return

	var tween := create_tween()
	tween.tween_property(hp_bar, "value", float(new_hp), 0.4).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_CUBIC)

	# HP数値ラベルも更新（index 2）
	var hp_label := status_vbox.get_child(2) as Label
	if hp_label:
		tween.tween_callback(func():
			hp_label.text = "%d/%d" % [new_hp, max_hp]
		)

	# HPが低い場合はバーを赤くフラッシュ
	var ratio := float(new_hp) / float(maxi(max_hp, 1))
	if ratio < 0.25:
		var fill_style := hp_bar.get_theme_stylebox("fill") as StyleBoxFlat
		if fill_style:
			var flash_tween := create_tween()
			flash_tween.set_loops(3)
			flash_tween.tween_property(fill_style, "bg_color", Color(1.0, 0.1, 0.1), 0.15)
			flash_tween.tween_property(fill_style, "bg_color", Color(0.8, 0.2, 0.2), 0.15)
