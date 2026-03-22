extends Node
## BGM/SE統合管理システム（Autoload）
## クロスフェード付きBGM切り替え、複数同時再生SE、音量制御を提供する

# =============================================================================
# 設定
# =============================================================================

## SEプレイヤーのプールサイズ
@export var se_pool_size: int = 8

## BGMのデフォルトフェード時間（秒）
@export var default_bgm_fade_time: float = 1.0

## 起動時に全音声を事前生成するか
@export var pregenerate_on_ready: bool = true

# =============================================================================
# 内部状態
# =============================================================================

# BGMプレイヤー（A/Bでクロスフェード）
var _bgm_player_a: AudioStreamPlayer
var _bgm_player_b: AudioStreamPlayer
var _active_bgm_player: AudioStreamPlayer  # 現在再生中
var _inactive_bgm_player: AudioStreamPlayer  # 待機中

# SE プレイヤープール
var _se_players: Array[AudioStreamPlayer] = []

# 現在再生中のBGM名
var _current_bgm: String = ""

# 音量（0.0〜1.0）
var _bgm_volume: float = 0.8
var _se_volume: float = 0.8

# 音量のdB値
var _bgm_volume_db: float = -6.0
var _se_volume_db: float = -6.0

# フェード用Tween
var _fade_tween: Tween

# 事前生成された音声キャッシュ
var _bgm_cache: Dictionary = {}  # String → AudioStreamWAV
var _se_cache: Dictionary = {}   # String → AudioStreamWAV

# 生成完了フラグ
var _is_ready: bool = false

# =============================================================================
# シグナル
# =============================================================================

## 音声の事前生成が完了した
signal audio_ready
## BGMが切り替わった
signal bgm_changed(bgm_name: String)


# =============================================================================
# ライフサイクル
# =============================================================================

func _ready():
	_setup_players()
	if pregenerate_on_ready:
		_pregenerate_audio()


func _setup_players():
	# --- BGMプレイヤー ---
	_bgm_player_a = AudioStreamPlayer.new()
	_bgm_player_a.name = "BGM_A"
	_bgm_player_a.bus = "Master"
	_bgm_player_a.volume_db = _bgm_volume_db
	add_child(_bgm_player_a)

	_bgm_player_b = AudioStreamPlayer.new()
	_bgm_player_b.name = "BGM_B"
	_bgm_player_b.bus = "Master"
	_bgm_player_b.volume_db = -80.0  # 初期は無音
	add_child(_bgm_player_b)

	_active_bgm_player = _bgm_player_a
	_inactive_bgm_player = _bgm_player_b

	# --- SEプレイヤープール ---
	for i in range(se_pool_size):
		var player := AudioStreamPlayer.new()
		player.name = "SE_%d" % i
		player.bus = "Master"
		player.volume_db = _se_volume_db
		add_child(player)
		_se_players.append(player)


func _pregenerate_audio():
	# BGM全曲を生成
	print("[AudioManager] BGM生成開始...")
	var bgm_start := Time.get_ticks_msec()
	_bgm_cache = MusicGenerator.generate_all_bgm()
	var bgm_time := Time.get_ticks_msec() - bgm_start
	print("[AudioManager] BGM生成完了: %d曲 (%dms)" % [_bgm_cache.size(), bgm_time])

	# SE全種を生成
	print("[AudioManager] SE生成開始...")
	var se_start := Time.get_ticks_msec()
	_se_cache = MusicGenerator.generate_all_se()
	var se_time := Time.get_ticks_msec() - se_start
	print("[AudioManager] SE生成完了: %d種 (%dms)" % [_se_cache.size(), se_time])

	_is_ready = true
	audio_ready.emit()


# =============================================================================
# BGM制御
# =============================================================================

## BGMを再生（クロスフェード付き）
func play_bgm(bgm_name: String, fade_time: float = -1.0) -> void:
	if fade_time < 0.0:
		fade_time = default_bgm_fade_time

	# 同じBGMが既に再生中なら何もしない
	if bgm_name == _current_bgm and _active_bgm_player.playing:
		return

	# キャッシュから取得（なければオンデマンド生成）
	var stream := _get_bgm_stream(bgm_name)
	if stream == null:
		push_error("[AudioManager] BGM '%s' の生成に失敗" % bgm_name)
		return

	_current_bgm = bgm_name

	# 前のフェードTweenがあればキャンセル
	if _fade_tween and _fade_tween.is_valid():
		_fade_tween.kill()

	# A/Bを入れ替え
	var old_player := _active_bgm_player
	var new_player := _inactive_bgm_player
	_active_bgm_player = new_player
	_inactive_bgm_player = old_player

	# 新しいプレイヤーにストリームをセットして再生
	new_player.stream = stream
	new_player.volume_db = -80.0
	new_player.play()

	# クロスフェード
	_fade_tween = create_tween()
	_fade_tween.set_parallel(true)

	# 新BGMをフェードイン
	_fade_tween.tween_property(new_player, "volume_db", _bgm_volume_db, fade_time)\
		.set_ease(Tween.EASE_IN).set_trans(Tween.TRANS_CUBIC)

	# 旧BGMをフェードアウト
	if old_player.playing:
		_fade_tween.tween_property(old_player, "volume_db", -80.0, fade_time)\
			.set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_CUBIC)

	# フェード完了後に旧プレイヤーを停止
	_fade_tween.set_parallel(false)
	_fade_tween.tween_callback(func():
		if old_player.playing and old_player != _active_bgm_player:
			old_player.stop()
	)

	bgm_changed.emit(bgm_name)


## BGMを停止
func stop_bgm(fade_time: float = 0.5) -> void:
	if not _active_bgm_player.playing:
		return

	_current_bgm = ""

	if _fade_tween and _fade_tween.is_valid():
		_fade_tween.kill()

	_fade_tween = create_tween()
	_fade_tween.tween_property(_active_bgm_player, "volume_db", -80.0, fade_time)\
		.set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_CUBIC)
	_fade_tween.tween_callback(func():
		_active_bgm_player.stop()
	)


## BGMを一時停止
func pause_bgm() -> void:
	_active_bgm_player.stream_paused = true


## BGMを再開
func resume_bgm() -> void:
	_active_bgm_player.stream_paused = false


## 現在のBGM名を取得
func get_current_bgm() -> String:
	return _current_bgm


## BGMが再生中か
func is_bgm_playing() -> bool:
	return _active_bgm_player.playing and not _active_bgm_player.stream_paused


# =============================================================================
# SE制御
# =============================================================================

## SEを再生（空きプレイヤーを自動選択）
func play_se(se_name: String, pitch_variation: float = 0.0) -> void:
	var stream := _get_se_stream(se_name)
	if stream == null:
		push_error("[AudioManager] SE '%s' の生成に失敗" % se_name)
		return

	# 空いているプレイヤーを探す
	var player := _find_available_se_player()
	if player == null:
		# 全て使用中 → 最も古いものを奪う
		player = _se_players[0]
		player.stop()

	player.stream = stream
	player.volume_db = _se_volume_db

	# ピッチバリエーション
	if pitch_variation > 0.0:
		player.pitch_scale = 1.0 + randf_range(-pitch_variation, pitch_variation)
	else:
		player.pitch_scale = 1.0

	player.play()


## SEを停止（全て）
func stop_all_se() -> void:
	for player in _se_players:
		if player.playing:
			player.stop()


# =============================================================================
# 音量制御
# =============================================================================

## BGM音量を設定（0.0〜1.0）
func set_bgm_volume(volume: float) -> void:
	_bgm_volume = clampf(volume, 0.0, 1.0)
	_bgm_volume_db = _linear_to_db(_bgm_volume)

	if _active_bgm_player.playing:
		_active_bgm_player.volume_db = _bgm_volume_db


## SE音量を設定（0.0〜1.0）
func set_se_volume(volume: float) -> void:
	_se_volume = clampf(volume, 0.0, 1.0)
	_se_volume_db = _linear_to_db(_se_volume)

	for player in _se_players:
		player.volume_db = _se_volume_db


## BGM音量を取得（0.0〜1.0）
func get_bgm_volume() -> float:
	return _bgm_volume


## SE音量を取得（0.0〜1.0）
func get_se_volume() -> float:
	return _se_volume


## マスター音量を設定（BGM/SE両方）
func set_master_volume(volume: float) -> void:
	set_bgm_volume(volume)
	set_se_volume(volume)


# =============================================================================
# ユーティリティ
# =============================================================================

## 音声の事前生成が完了しているか
func is_audio_ready() -> bool:
	return _is_ready


## キャッシュをクリア（メモリ解放）
func clear_cache() -> void:
	_bgm_cache.clear()
	_se_cache.clear()


## 特定のBGMだけを事前生成
func pregenerate_bgm(bgm_name: String) -> void:
	if not _bgm_cache.has(bgm_name):
		_bgm_cache[bgm_name] = MusicGenerator.generate_bgm(bgm_name)


## 特定のSEだけを事前生成
func pregenerate_se(se_name: String) -> void:
	if not _se_cache.has(se_name):
		_se_cache[se_name] = MusicGenerator.generate_se(se_name)


# =============================================================================
# 内部ヘルパー
# =============================================================================

func _get_bgm_stream(bgm_name: String) -> AudioStreamWAV:
	if _bgm_cache.has(bgm_name):
		return _bgm_cache[bgm_name]
	# オンデマンド生成
	var stream := MusicGenerator.generate_bgm(bgm_name)
	_bgm_cache[bgm_name] = stream
	return stream


func _get_se_stream(se_name: String) -> AudioStreamWAV:
	if _se_cache.has(se_name):
		return _se_cache[se_name]
	# オンデマンド生成
	var stream := MusicGenerator.generate_se(se_name)
	_se_cache[se_name] = stream
	return stream


func _find_available_se_player() -> AudioStreamPlayer:
	for player in _se_players:
		if not player.playing:
			return player
	return null


## リニア（0.0〜1.0）→ dB変換
static func _linear_to_db(linear: float) -> float:
	if linear <= 0.0:
		return -80.0
	return 20.0 * log(linear) / log(10.0)
