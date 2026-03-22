extends RefCounted
class_name MusicGenerator
## プロシージャル楽曲生成エンジン
## MusicDataの楽曲/SE定義からAudioStreamWAVをリアルタイム生成する

const SAMPLE_RATE := 22050  # 22kHz（パフォーマンスと品質のバランス）
const MAX_AMPLITUDE := 0.85  # クリッピング防止

# =============================================================================
# 公開API
# =============================================================================

## 楽曲名からAudioStreamWAVを生成
static func generate_bgm(song_name: String) -> AudioStreamWAV:
	var song := MusicData.get_song(song_name)
	return _render_song(song)

## SE名からAudioStreamWAVを生成
static func generate_se(se_name: String) -> AudioStreamWAV:
	var se := MusicData.get_se(se_name)
	return _render_se(se)

## 全BGMを事前生成（Dictionary[String, AudioStreamWAV]）
static func generate_all_bgm() -> Dictionary:
	var result := {}
	for name in MusicData.get_all_song_names():
		result[name] = generate_bgm(name)
	return result

## 全SEを事前生成
static func generate_all_se() -> Dictionary:
	var result := {}
	for name in MusicData.get_all_se_names():
		result[name] = generate_se(name)
	return result


# =============================================================================
# 楽曲レンダリング
# =============================================================================

static func _render_song(song: MusicData.Song) -> AudioStreamWAV:
	var beat_duration := 60.0 / song.bpm  # 1拍の秒数

	# 各トラックの総拍数を計算して最長を取得
	var max_beats := 0.0
	for track in song.tracks:
		var total := 0.0
		for note in track.notes:
			total += note.duration
		max_beats = max(max_beats, total)

	var total_samples := int(max_beats * beat_duration * SAMPLE_RATE)
	if total_samples <= 0:
		return _create_empty_stream()

	# 各トラックをレンダリングしてミックス
	var mix_buffer := PackedFloat32Array()
	mix_buffer.resize(total_samples)
	mix_buffer.fill(0.0)

	for track in song.tracks:
		var track_buffer := _render_track(track, beat_duration, total_samples)
		for i in range(total_samples):
			mix_buffer[i] += track_buffer[i]

	# リバーブ適用
	if song.reverb_amount > 0.0:
		mix_buffer = _apply_reverb(mix_buffer, song.reverb_amount)

	# ディレイ適用
	if song.delay_amount > 0.0:
		mix_buffer = _apply_delay(mix_buffer, song.delay_amount, beat_duration)

	# ノーマライズ＆リミッター
	mix_buffer = _normalize_and_limit(mix_buffer)

	# AudioStreamWAV に変換
	return _float_to_wav(mix_buffer, true)  # loop = true


static func _render_track(track: MusicData.Track, beat_duration: float, total_samples: int) -> PackedFloat32Array:
	var buffer := PackedFloat32Array()
	buffer.resize(total_samples)
	buffer.fill(0.0)

	var sample_pos := 0
	var timbre: MusicData.Timbre = track.timbre

	for note_event in track.notes:
		var note_duration_sec := note_event.duration * beat_duration
		var note_samples := int(note_duration_sec * SAMPLE_RATE)

		if note_event.note == "R" or note_event.velocity <= 0.0:
			# 休符: スキップ
			sample_pos += note_samples
			continue

		var freq := _get_frequency(note_event.note)
		if freq <= 0.0:
			sample_pos += note_samples
			continue

		# このノートのサンプルを生成
		var note_buffer := _synthesize_note(
			freq, note_duration_sec, timbre, note_event.velocity
		)

		# バッファに加算
		var write_count := mini(note_buffer.size(), total_samples - sample_pos)
		for i in range(write_count):
			if sample_pos + i < total_samples:
				buffer[sample_pos + i] += note_buffer[i] * track.volume

		sample_pos += note_samples

	return buffer


## 単一ノートの波形合成
static func _synthesize_note(freq: float, duration: float, timbre: MusicData.Timbre, velocity: float) -> PackedFloat32Array:
	var num_samples := int(duration * SAMPLE_RATE)
	var buffer := PackedFloat32Array()
	buffer.resize(num_samples)

	var env := timbre.envelope

	for i in range(num_samples):
		var t := float(i) / SAMPLE_RATE
		var phase := t * freq

		# ビブラート
		var vib_offset := 0.0
		if timbre.vibrato_rate > 0.0 and timbre.vibrato_depth > 0.0:
			var vib_cents := timbre.vibrato_depth * sin(TAU * timbre.vibrato_rate * t)
			vib_offset = freq * (pow(2.0, vib_cents / 1200.0) - 1.0)
		var effective_freq := freq + vib_offset

		# 基本波形
		var sample := _generate_wave(timbre.wave, t, effective_freq)

		# 倍音加算
		for h in timbre.harmonics:
			var h_freq := effective_freq * h["ratio"]
			# デチューンを倍音にも適用
			if timbre.detune > 0.0:
				h_freq *= pow(2.0, timbre.detune / 1200.0)
			sample += _generate_wave(h["wave"], t, h_freq) * h["amplitude"]

		# エンベロープ適用
		var env_val := _calculate_envelope(t, duration, env)

		# LPF（簡易1次ローパス）
		if timbre.lpf_cutoff < 1.0:
			# サンプル単位では重いので、エンベロープで疑似的にLPF効果
			# 倍音成分を減衰させることでLPF的な効果
			pass  # 倍音振幅がすでにtimbreで制御されている

		# ディストーション
		if timbre.distortion > 0.0:
			sample = _apply_distortion(sample, timbre.distortion)

		buffer[i] = sample * env_val * velocity

	# LPF（バッファ全体に簡易ローパス適用）
	if timbre.lpf_cutoff < 0.95:
		buffer = _apply_simple_lpf(buffer, timbre.lpf_cutoff)

	return buffer


# =============================================================================
# 波形生成
# =============================================================================

static func _generate_wave(wave_type: int, t: float, freq: float) -> float:
	var phase := fmod(t * freq, 1.0)
	if phase < 0.0:
		phase += 1.0

	match wave_type:
		MusicData.WaveType.SINE:
			return sin(TAU * phase)
		MusicData.WaveType.SQUARE:
			return 1.0 if phase < 0.5 else -1.0
		MusicData.WaveType.TRIANGLE:
			if phase < 0.25:
				return phase * 4.0
			elif phase < 0.75:
				return 2.0 - phase * 4.0
			else:
				return phase * 4.0 - 4.0
		MusicData.WaveType.SAWTOOTH:
			return 2.0 * phase - 1.0
		MusicData.WaveType.NOISE:
			# 疑似ノイズ（決定論的にするためハッシュベース）
			var seed_val := int(t * freq * 1000.0) % 65536
			return (fmod(float(seed_val * 1103515245 + 12345) / 65536.0, 2.0) - 1.0)
		MusicData.WaveType.PULSE:
			return 1.0 if phase < 0.25 else -1.0
		_:
			return 0.0


# =============================================================================
# エンベロープ（ADSR）
# =============================================================================

static func _calculate_envelope(t: float, duration: float, env: MusicData.Envelope) -> float:
	var a := env.attack
	var d := env.decay
	var s := env.sustain
	var r := env.release

	# リリース開始時間
	var release_start := max(duration - r, a + d)

	if t < a:
		# Attack
		return t / maxf(a, 0.001)
	elif t < a + d:
		# Decay
		var decay_progress := (t - a) / maxf(d, 0.001)
		return 1.0 - (1.0 - s) * decay_progress
	elif t < release_start:
		# Sustain
		return s
	else:
		# Release
		var release_progress := (t - release_start) / maxf(r, 0.001)
		release_progress = clampf(release_progress, 0.0, 1.0)
		return s * (1.0 - release_progress)


# =============================================================================
# エフェクト
# =============================================================================

## 簡易リバーブ（複数ディレイラインのコムフィルタ）
static func _apply_reverb(buffer: PackedFloat32Array, amount: float) -> PackedFloat32Array:
	var result := buffer.duplicate()
	var size := buffer.size()

	# 複数のディレイタップでリバーブを近似
	var delays := [
		int(0.0297 * SAMPLE_RATE),  # 29.7ms
		int(0.0371 * SAMPLE_RATE),  # 37.1ms
		int(0.0411 * SAMPLE_RATE),  # 41.1ms
		int(0.0437 * SAMPLE_RATE),  # 43.7ms
	]
	var decay_factors := [0.35, 0.28, 0.22, 0.18]

	for d_idx in range(delays.size()):
		var delay := delays[d_idx]
		var decay := decay_factors[d_idx] * amount

		for i in range(delay, size):
			result[i] += buffer[i - delay] * decay

	# 2パス目（より長いディレイで残響感）
	var long_delay := int(0.08 * SAMPLE_RATE)
	var long_decay := 0.15 * amount
	for i in range(long_delay, size):
		result[i] += result[i - long_delay] * long_decay

	return result


## テンポ同期ディレイ
static func _apply_delay(buffer: PackedFloat32Array, amount: float, beat_duration: float) -> PackedFloat32Array:
	var result := buffer.duplicate()
	var size := buffer.size()

	# 8分音符のディレイ
	var delay_samples := int(beat_duration * 0.5 * SAMPLE_RATE)
	var feedback := amount * 0.4

	for i in range(delay_samples, size):
		result[i] += result[i - delay_samples] * feedback

	return result


## 簡易1次ローパスフィルタ
static func _apply_simple_lpf(buffer: PackedFloat32Array, cutoff: float) -> PackedFloat32Array:
	var result := buffer.duplicate()
	# cutoff 0.0〜1.0 → フィルタ係数
	var alpha := clampf(cutoff, 0.01, 1.0)

	for i in range(1, result.size()):
		result[i] = result[i] * alpha + result[i - 1] * (1.0 - alpha)

	return result


## ソフトクリップ ディストーション
static func _apply_distortion(sample: float, amount: float) -> float:
	var drive := 1.0 + amount * 5.0
	var driven := sample * drive
	# tanh系ソフトクリップ
	return driven / (1.0 + absf(driven))


## ノーマライズ＆リミッター
static func _normalize_and_limit(buffer: PackedFloat32Array) -> PackedFloat32Array:
	var peak := 0.0
	for i in range(buffer.size()):
		peak = maxf(peak, absf(buffer[i]))

	if peak <= 0.0:
		return buffer

	var result := buffer.duplicate()
	var gain := MAX_AMPLITUDE / peak

	for i in range(result.size()):
		result[i] = clampf(result[i] * gain, -1.0, 1.0)

	return result


# =============================================================================
# SE レンダリング
# =============================================================================

static func _render_se(se: MusicData.SoundEffect) -> AudioStreamWAV:
	var total_samples := int(se.duration * SAMPLE_RATE)
	if total_samples <= 0:
		return _create_empty_stream()

	var mix_buffer := PackedFloat32Array()
	mix_buffer.resize(total_samples)
	mix_buffer.fill(0.0)

	for layer in se.layers:
		var layer_buffer := _render_se_layer(layer, se.duration, total_samples)
		for i in range(total_samples):
			mix_buffer[i] += layer_buffer[i]

	# リバーブ
	if se.reverb > 0.0:
		mix_buffer = _apply_reverb(mix_buffer, se.reverb)

	# ノーマライズ
	mix_buffer = _normalize_and_limit(mix_buffer)

	return _float_to_wav(mix_buffer, false)  # loop = false


static func _render_se_layer(layer: MusicData.SELayer, duration: float, total_samples: int) -> PackedFloat32Array:
	var buffer := PackedFloat32Array()
	buffer.resize(total_samples)

	for i in range(total_samples):
		var t := float(i) / SAMPLE_RATE
		var progress := t / maxf(duration, 0.001)

		# ピッチスライド（線形補間）
		var freq := lerpf(layer.freq_start, layer.freq_end, progress)

		# 波形生成
		var sample := 0.0
		if layer.noise_mix >= 1.0:
			sample = _generate_wave(MusicData.WaveType.NOISE, t, freq)
		elif layer.noise_mix > 0.0:
			var wave := _generate_wave(layer.wave, t, freq)
			var noise := _generate_wave(MusicData.WaveType.NOISE, t, freq)
			sample = wave * (1.0 - layer.noise_mix) + noise * layer.noise_mix
		else:
			sample = _generate_wave(layer.wave, t, freq)

		# エンベロープ
		var env_val := _calculate_envelope(t, duration, layer.envelope)

		buffer[i] = sample * env_val * layer.amplitude

	return buffer


# =============================================================================
# AudioStreamWAV変換
# =============================================================================

static func _float_to_wav(buffer: PackedFloat32Array, loop: bool) -> AudioStreamWAV:
	var stream := AudioStreamWAV.new()
	stream.format = AudioStreamWAV.FORMAT_16_BITS
	stream.mix_rate = SAMPLE_RATE
	stream.stereo = false

	if loop:
		stream.loop_mode = AudioStreamWAV.LOOP_FORWARD
		stream.loop_begin = 0
		stream.loop_end = buffer.size()

	# Float32 → 16bit PCM
	var byte_data := PackedByteArray()
	byte_data.resize(buffer.size() * 2)

	for i in range(buffer.size()):
		var clamped := clampf(buffer[i], -1.0, 1.0)
		var int16_val := int(clamped * 32767.0)
		# リトルエンディアン
		byte_data[i * 2] = int16_val & 0xFF
		byte_data[i * 2 + 1] = (int16_val >> 8) & 0xFF

	stream.data = byte_data
	return stream


static func _create_empty_stream() -> AudioStreamWAV:
	var stream := AudioStreamWAV.new()
	stream.format = AudioStreamWAV.FORMAT_16_BITS
	stream.mix_rate = SAMPLE_RATE
	stream.stereo = false
	stream.data = PackedByteArray([0, 0, 0, 0])
	return stream


# =============================================================================
# ヘルパー
# =============================================================================

static func _get_frequency(note_name: String) -> float:
	if MusicData.NOTE_FREQ.has(note_name):
		return MusicData.NOTE_FREQ[note_name]
	push_warning("Unknown note: " + note_name)
	return 0.0
