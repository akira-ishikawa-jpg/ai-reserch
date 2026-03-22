extends PanelContainer
## 会話エンジン
## テキスト表示・選択肢・演出を管理

@onready var speaker_label: Label = $MarginContainer/VBoxContainer/SpeakerLabel
@onready var text_label: RichTextLabel = $MarginContainer/VBoxContainer/TextLabel

var dialogue_queue: Array = []
var current_index: int = 0
var is_active: bool = false
var text_speed: float = 0.03  # 1文字あたりの表示時間
var is_text_complete: bool = false

signal dialogue_started()
signal dialogue_ended()
signal choice_selected(choice_index: int)

func _ready():
	visible = false

func start_dialogue(dialogue_data: Array):
	if dialogue_data.is_empty():
		return
	dialogue_queue = dialogue_data
	current_index = 0
	is_active = true
	visible = true
	dialogue_started.emit()
	_show_current_line()

func _show_current_line():
	if current_index >= dialogue_queue.size():
		end_dialogue()
		return

	var line = dialogue_queue[current_index]
	speaker_label.text = line.get("speaker", "")
	text_label.text = ""
	is_text_complete = false

	var full_text = line.get("text", "")
	text_label.text = full_text
	text_label.visible_ratio = 0.0

	# テキストを1文字ずつ表示
	var tween = create_tween()
	tween.tween_property(text_label, "visible_ratio", 1.0, full_text.length() * text_speed)
	tween.tween_callback(func(): is_text_complete = true)

func _input(event):
	if not is_active:
		return

	if event.is_action_pressed("interact"):
		if is_text_complete:
			current_index += 1
			_show_current_line()
		else:
			# テキスト即時表示
			text_label.visible_ratio = 1.0
			is_text_complete = true

func end_dialogue():
	is_active = false
	visible = false
	dialogue_queue = []
	current_index = 0
	dialogue_ended.emit()
