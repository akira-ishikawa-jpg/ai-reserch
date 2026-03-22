extends RefCounted
class_name MusicData
## 楽曲・SE データ定義
## 全曲のノートデータ、音色パラメータ、SE定義を格納する

# =============================================================================
# 定数
# =============================================================================

# 音名 → 周波数マッピング（A4 = 440Hz基準）
const NOTE_FREQ := {
	"C2": 65.41, "C#2": 69.30, "D2": 73.42, "Eb2": 77.78, "E2": 82.41, "F2": 87.31, "F#2": 92.50, "G2": 98.0, "Ab2": 103.83, "A2": 110.0, "Bb2": 116.54, "B2": 123.47,
	"C3": 130.81, "D3": 146.83, "Eb3": 155.56, "E3": 164.81, "F3": 174.61, "F#3": 185.0, "G3": 196.0, "Ab3": 207.65, "A3": 220.0, "Bb3": 233.08, "B3": 246.94,
	"C4": 261.63, "C#4": 277.18, "D4": 293.66, "Eb4": 311.13, "E4": 329.63, "F4": 349.23, "F#4": 369.99, "G4": 392.0, "Ab4": 415.30, "A4": 440.0, "Bb4": 466.16, "B4": 493.88,
	"C5": 523.25, "C#5": 554.37, "D5": 587.33, "Eb5": 622.25, "E5": 659.26, "F5": 698.46, "F#5": 739.99, "G5": 783.99, "Ab5": 830.61, "A5": 880.0, "Bb5": 932.33, "B5": 987.77,
	"C6": 1046.50, "D6": 1174.66, "E6": 1318.51,
	"R": 0.0,  # Rest（休符）
}

# 波形タイプ
enum WaveType { SINE, SQUARE, TRIANGLE, SAWTOOTH, NOISE, PULSE }

# エンベロープ
class Envelope:
	var attack: float   # 秒
	var decay: float    # 秒
	var sustain: float  # 0.0〜1.0
	var release: float  # 秒

	func _init(a: float = 0.01, d: float = 0.1, s: float = 0.7, r: float = 0.1):
		attack = a; decay = d; sustain = s; release = r

# 音色定義
class Timbre:
	var wave: int           # WaveType
	var harmonics: Array    # [{ wave: WaveType, ratio: float, amplitude: float }]
	var envelope: Envelope
	var vibrato_rate: float   # Hz（0でビブラートなし）
	var vibrato_depth: float  # セント
	var detune: float         # セント（コーラス用）
	var lpf_cutoff: float     # LPFカットオフ 0.0〜1.0（1.0=フィルタなし）
	var distortion: float     # 0.0〜1.0

	func _init():
		wave = WaveType.SINE
		harmonics = []
		envelope = Envelope.new()
		vibrato_rate = 0.0
		vibrato_depth = 0.0
		detune = 0.0
		lpf_cutoff = 1.0
		distortion = 0.0

# ノートイベント
class NoteEvent:
	var note: String    # "C4" or "R"
	var duration: float # 拍数（1.0 = 四分音符）
	var velocity: float # 0.0〜1.0

	func _init(n: String = "R", dur: float = 1.0, vel: float = 0.8):
		note = n; duration = dur; velocity = vel

# トラック
class Track:
	var name: String
	var timbre: Timbre
	var notes: Array  # Array[NoteEvent]
	var volume: float # 0.0〜1.0
	var pan: float    # -1.0(L)〜1.0(R)

	func _init():
		name = ""
		timbre = Timbre.new()
		notes = []
		volume = 0.8
		pan = 0.0

# 楽曲定義
class Song:
	var name: String
	var bpm: float
	var time_sig_num: int   # 拍子の分子
	var time_sig_den: int   # 拍子の分母
	var tracks: Array       # Array[Track]
	var loop: bool
	var reverb_amount: float   # 0.0〜1.0
	var delay_amount: float    # 0.0〜1.0

	func _init():
		name = ""
		bpm = 120.0
		time_sig_num = 4
		time_sig_den = 4
		tracks = []
		loop = true
		reverb_amount = 0.3
		delay_amount = 0.1

# SE定義
class SoundEffect:
	var name: String
	var duration: float    # 秒
	var layers: Array      # Array[SELayer]
	var reverb: float

	func _init():
		name = ""
		duration = 0.2
		layers = []
		reverb = 0.0

class SELayer:
	var wave: int          # WaveType
	var freq_start: float  # 開始周波数
	var freq_end: float    # 終了周波数（ピッチスライド）
	var amplitude: float   # 0.0〜1.0
	var envelope: Envelope
	var noise_mix: float   # ノイズ混合 0.0〜1.0

	func _init():
		wave = WaveType.SINE
		freq_start = 440.0
		freq_end = 440.0
		amplitude = 0.8
		envelope = Envelope.new()
		noise_mix = 0.0


# =============================================================================
# 音色プリセット
# =============================================================================

static func timbre_bell() -> Timbre:
	var t := Timbre.new()
	t.wave = WaveType.SINE
	t.harmonics = [
		{ "wave": WaveType.SINE, "ratio": 2.0, "amplitude": 0.4 },
		{ "wave": WaveType.SINE, "ratio": 3.0, "amplitude": 0.15 },
	]
	t.envelope = Envelope.new(0.005, 0.3, 0.2, 0.5)
	return t

static func timbre_strings_pad() -> Timbre:
	var t := Timbre.new()
	t.wave = WaveType.SAWTOOTH
	t.harmonics = [
		{ "wave": WaveType.SAWTOOTH, "ratio": 1.002, "amplitude": 0.7 },
		{ "wave": WaveType.SAWTOOTH, "ratio": 0.998, "amplitude": 0.7 },
	]
	t.envelope = Envelope.new(0.3, 0.2, 0.8, 0.5)
	t.lpf_cutoff = 0.3
	t.detune = 8.0
	return t

static func timbre_warm_bass() -> Timbre:
	var t := Timbre.new()
	t.wave = WaveType.TRIANGLE
	t.harmonics = [
		{ "wave": WaveType.SINE, "ratio": 2.0, "amplitude": 0.3 },
	]
	t.envelope = Envelope.new(0.01, 0.15, 0.6, 0.15)
	t.lpf_cutoff = 0.4
	return t

static func timbre_arpeggio_piano() -> Timbre:
	var t := Timbre.new()
	t.wave = WaveType.SINE
	t.harmonics = [
		{ "wave": WaveType.SINE, "ratio": 2.0, "amplitude": 0.5 },
		{ "wave": WaveType.SINE, "ratio": 4.0, "amplitude": 0.1 },
		{ "wave": WaveType.TRIANGLE, "ratio": 1.0, "amplitude": 0.2 },
	]
	t.envelope = Envelope.new(0.005, 0.2, 0.3, 0.4)
	return t

static func timbre_flute() -> Timbre:
	var t := Timbre.new()
	t.wave = WaveType.SINE
	t.harmonics = [
		{ "wave": WaveType.SQUARE, "ratio": 1.0, "amplitude": 0.08 },
	]
	t.envelope = Envelope.new(0.05, 0.1, 0.75, 0.2)
	t.vibrato_rate = 5.0
	t.vibrato_depth = 12.0
	t.lpf_cutoff = 0.7
	return t

static func timbre_pizzicato() -> Timbre:
	var t := Timbre.new()
	t.wave = WaveType.TRIANGLE
	t.harmonics = [
		{ "wave": WaveType.SINE, "ratio": 2.0, "amplitude": 0.3 },
		{ "wave": WaveType.SINE, "ratio": 3.0, "amplitude": 0.1 },
	]
	t.envelope = Envelope.new(0.005, 0.08, 0.1, 0.15)
	return t

static func timbre_acoustic_bass() -> Timbre:
	var t := Timbre.new()
	t.wave = WaveType.TRIANGLE
	t.harmonics = [
		{ "wave": WaveType.NOISE, "ratio": 1.0, "amplitude": 0.06 },
		{ "wave": WaveType.SINE, "ratio": 2.0, "amplitude": 0.2 },
	]
	t.envelope = Envelope.new(0.008, 0.12, 0.5, 0.2)
	t.lpf_cutoff = 0.45
	return t

static func timbre_clarinet() -> Timbre:
	var t := Timbre.new()
	t.wave = WaveType.SQUARE
	t.harmonics = []
	t.envelope = Envelope.new(0.04, 0.1, 0.7, 0.2)
	t.vibrato_rate = 4.5
	t.vibrato_depth = 8.0
	t.lpf_cutoff = 0.35
	return t

static func timbre_dark_pad() -> Timbre:
	var t := Timbre.new()
	t.wave = WaveType.SQUARE
	t.harmonics = [
		{ "wave": WaveType.SQUARE, "ratio": 1.005, "amplitude": 0.6 },
		{ "wave": WaveType.SQUARE, "ratio": 0.995, "amplitude": 0.6 },
	]
	t.envelope = Envelope.new(0.4, 0.3, 0.7, 0.6)
	t.lpf_cutoff = 0.25
	t.detune = 10.0
	return t

static func timbre_water_drop() -> Timbre:
	var t := Timbre.new()
	t.wave = WaveType.SINE
	t.harmonics = [
		{ "wave": WaveType.SINE, "ratio": 2.5, "amplitude": 0.2 },
	]
	t.envelope = Envelope.new(0.002, 0.04, 0.0, 0.08)
	return t

static func timbre_sub_bass() -> Timbre:
	var t := Timbre.new()
	t.wave = WaveType.SINE
	t.harmonics = [
		{ "wave": WaveType.SQUARE, "ratio": 2.0, "amplitude": 0.15 },
	]
	t.envelope = Envelope.new(0.01, 0.1, 0.7, 0.15)
	t.lpf_cutoff = 0.3
	return t

static func timbre_brass() -> Timbre:
	var t := Timbre.new()
	t.wave = WaveType.SAWTOOTH
	t.harmonics = [
		{ "wave": WaveType.SQUARE, "ratio": 1.0, "amplitude": 0.3 },
	]
	t.envelope = Envelope.new(0.02, 0.08, 0.75, 0.12)
	t.lpf_cutoff = 0.6
	return t

static func timbre_drive_bass() -> Timbre:
	var t := Timbre.new()
	t.wave = WaveType.SQUARE
	t.harmonics = [
		{ "wave": WaveType.SAWTOOTH, "ratio": 1.0, "amplitude": 0.3 },
	]
	t.envelope = Envelope.new(0.008, 0.08, 0.7, 0.1)
	t.distortion = 0.4
	t.lpf_cutoff = 0.5
	return t

static func timbre_power_chord() -> Timbre:
	var t := Timbre.new()
	t.wave = WaveType.SQUARE
	t.harmonics = [
		{ "wave": WaveType.SQUARE, "ratio": 1.5, "amplitude": 0.6 },  # 5度
		{ "wave": WaveType.SAWTOOTH, "ratio": 1.0, "amplitude": 0.2 },
	]
	t.envelope = Envelope.new(0.01, 0.05, 0.8, 0.08)
	t.distortion = 0.3
	t.lpf_cutoff = 0.55
	return t

static func timbre_organ() -> Timbre:
	var t := Timbre.new()
	t.wave = WaveType.SINE
	t.harmonics = [
		{ "wave": WaveType.SINE, "ratio": 2.0, "amplitude": 0.6 },
		{ "wave": WaveType.SINE, "ratio": 3.0, "amplitude": 0.3 },
		{ "wave": WaveType.SINE, "ratio": 4.0, "amplitude": 0.15 },
	]
	t.envelope = Envelope.new(0.02, 0.05, 0.9, 0.15)
	t.vibrato_rate = 6.0
	t.vibrato_depth = 6.0
	return t

static func timbre_hihat() -> Timbre:
	var t := Timbre.new()
	t.wave = WaveType.NOISE
	t.harmonics = []
	t.envelope = Envelope.new(0.002, 0.03, 0.0, 0.03)
	t.lpf_cutoff = 0.9
	return t

static func timbre_snare() -> Timbre:
	var t := Timbre.new()
	t.wave = WaveType.NOISE
	t.harmonics = [
		{ "wave": WaveType.SINE, "ratio": 1.0, "amplitude": 0.5 },
	]
	t.envelope = Envelope.new(0.002, 0.06, 0.05, 0.08)
	t.lpf_cutoff = 0.7
	return t

static func timbre_kick() -> Timbre:
	var t := Timbre.new()
	t.wave = WaveType.SINE
	t.harmonics = []
	t.envelope = Envelope.new(0.002, 0.1, 0.0, 0.05)
	return t

static func timbre_tambourine() -> Timbre:
	var t := Timbre.new()
	t.wave = WaveType.NOISE
	t.harmonics = [
		{ "wave": WaveType.SINE, "ratio": 1.0, "amplitude": 0.15 },
	]
	t.envelope = Envelope.new(0.002, 0.04, 0.02, 0.06)
	t.lpf_cutoff = 0.85
	return t

static func timbre_brush_snare() -> Timbre:
	var t := Timbre.new()
	t.wave = WaveType.NOISE
	t.harmonics = []
	t.envelope = Envelope.new(0.005, 0.08, 0.03, 0.1)
	t.lpf_cutoff = 0.5
	return t

static func timbre_crash() -> Timbre:
	var t := Timbre.new()
	t.wave = WaveType.NOISE
	t.harmonics = [
		{ "wave": WaveType.SINE, "ratio": 1.0, "amplitude": 0.1 },
	]
	t.envelope = Envelope.new(0.002, 0.3, 0.1, 0.5)
	t.lpf_cutoff = 0.8
	return t


# =============================================================================
# ヘルパー: ノート配列を簡易記法から生成
# =============================================================================

static func _n(note: String, dur: float = 1.0, vel: float = 0.8) -> NoteEvent:
	return NoteEvent.new(note, dur, vel)

# ドラムノート（周波数を直接指定するダミーノート名を使う）
# キック=C2, スネア=D2, ハイハット=F#3, クラッシュ=C#5, タンバリン=E5
# ブラシスネア=Eb3
const KICK := "C2"
const SNARE := "D2"
const HIHAT := "F#3"
const CRASH := "C#5"
const TAMB := "E5"
const BRUSH := "Eb3"


# =============================================================================
# 楽曲: title — タイトル画面 (BPM 80)
# =============================================================================

static func get_title() -> Song:
	var song := Song.new()
	song.name = "title"
	song.bpm = 80.0
	song.reverb_amount = 0.45
	song.delay_amount = 0.2

	# --- トラック1: ベルトーンメロディ ---
	var melody := Track.new()
	melody.name = "melody_bell"
	melody.timbre = timbre_bell()
	melody.volume = 0.65
	melody.pan = 0.1
	melody.notes = [
		_n("E5", 2.0), _n("D5", 1.0), _n("C5", 1.0),
		_n("D5", 2.0), _n("G4", 2.0),
		_n("A4", 1.5), _n("B4", 0.5), _n("C5", 1.0), _n("E5", 1.0),
		_n("D5", 3.0), _n("R", 1.0),

		_n("E5", 2.0), _n("F5", 1.0), _n("E5", 1.0),
		_n("D5", 2.0), _n("C5", 2.0),
		_n("A4", 1.0), _n("B4", 1.0), _n("C5", 2.0),
		_n("G4", 3.0), _n("R", 1.0),
	]

	# --- トラック2: ストリングスパッド ---
	var pad := Track.new()
	pad.name = "strings_pad"
	pad.timbre = timbre_strings_pad()
	pad.volume = 0.35
	pad.pan = -0.2
	pad.notes = [
		_n("C4", 4.0, 0.5), _n("G3", 4.0, 0.5),
		_n("A3", 4.0, 0.5), _n("E4", 4.0, 0.5),
		_n("F3", 4.0, 0.5), _n("C4", 4.0, 0.5),
		_n("G3", 4.0, 0.5), _n("D4", 4.0, 0.5),
	]

	# --- トラック3: ウォームサブベース ---
	var bass := Track.new()
	bass.name = "warm_bass"
	bass.timbre = timbre_warm_bass()
	bass.volume = 0.5
	bass.pan = 0.0
	bass.notes = [
		_n("C3", 2.0), _n("R", 0.5), _n("C3", 1.0), _n("R", 0.5),
		_n("G2", 2.0), _n("R", 0.5), _n("G2", 1.0), _n("R", 0.5),
		_n("A2", 2.0), _n("R", 0.5), _n("A2", 1.0), _n("R", 0.5),
		_n("E2", 2.0), _n("R", 0.5), _n("E2", 1.0), _n("R", 0.5),
		_n("F2", 2.0), _n("R", 0.5), _n("F2", 1.0), _n("R", 0.5),
		_n("C3", 2.0), _n("R", 0.5), _n("C3", 1.0), _n("R", 0.5),
		_n("G2", 2.0), _n("R", 0.5), _n("G2", 1.0), _n("R", 0.5),
		_n("G2", 2.0), _n("R", 0.5), _n("D3", 1.0), _n("R", 0.5),
	]

	# --- トラック4: ピアノ風アルペジオ ---
	var arp := Track.new()
	arp.name = "arpeggio"
	arp.timbre = timbre_arpeggio_piano()
	arp.volume = 0.4
	arp.pan = 0.3
	arp.notes = [
		_n("C4", 0.5, 0.6), _n("E4", 0.5, 0.5), _n("G4", 0.5, 0.5), _n("E4", 0.5, 0.4),
		_n("C4", 0.5, 0.6), _n("E4", 0.5, 0.5), _n("G4", 0.5, 0.5), _n("E4", 0.5, 0.4),
		_n("G3", 0.5, 0.6), _n("B3", 0.5, 0.5), _n("D4", 0.5, 0.5), _n("B3", 0.5, 0.4),
		_n("G3", 0.5, 0.6), _n("B3", 0.5, 0.5), _n("D4", 0.5, 0.5), _n("B3", 0.5, 0.4),
		_n("A3", 0.5, 0.6), _n("C4", 0.5, 0.5), _n("E4", 0.5, 0.5), _n("C4", 0.5, 0.4),
		_n("A3", 0.5, 0.6), _n("C4", 0.5, 0.5), _n("E4", 0.5, 0.5), _n("C4", 0.5, 0.4),
		_n("F3", 0.5, 0.6), _n("A3", 0.5, 0.5), _n("C4", 0.5, 0.5), _n("A3", 0.5, 0.4),
		_n("G3", 0.5, 0.6), _n("B3", 0.5, 0.5), _n("D4", 0.5, 0.5), _n("B3", 0.5, 0.4),
	]

	song.tracks = [melody, pad, bass, arp]
	return song


# =============================================================================
# 楽曲: town_spring — 春の町 (BPM 100)
# =============================================================================

static func get_town_spring() -> Song:
	var song := Song.new()
	song.name = "town_spring"
	song.bpm = 100.0
	song.reverb_amount = 0.3
	song.delay_amount = 0.15

	# --- フルート風メロディ ---
	var melody := Track.new()
	melody.name = "melody_flute"
	melody.timbre = timbre_flute()
	melody.volume = 0.6
	melody.pan = 0.15
	melody.notes = [
		_n("G5", 1.0), _n("A5", 0.5), _n("G5", 0.5), _n("E5", 1.0), _n("D5", 1.0),
		_n("C5", 1.5), _n("D5", 0.5), _n("E5", 1.0), _n("G5", 1.0),
		_n("A5", 1.0), _n("G5", 0.5), _n("E5", 0.5), _n("D5", 1.0), _n("C5", 1.0),
		_n("D5", 2.0), _n("R", 1.0), _n("G4", 1.0),

		_n("C5", 1.0), _n("E5", 1.0), _n("G5", 1.0), _n("A5", 1.0),
		_n("G5", 1.5), _n("E5", 0.5), _n("D5", 1.0), _n("C5", 1.0),
		_n("A4", 1.0), _n("C5", 1.0), _n("D5", 1.0), _n("E5", 1.0),
		_n("C5", 3.0), _n("R", 1.0),
	]

	# --- ピチカート風ハーモニー ---
	var harmony := Track.new()
	harmony.name = "pizzicato_harmony"
	harmony.timbre = timbre_pizzicato()
	harmony.volume = 0.4
	harmony.pan = -0.25
	harmony.notes = [
		_n("C4", 1.0, 0.6), _n("E4", 1.0, 0.5), _n("G4", 1.0, 0.5), _n("E4", 1.0, 0.5),
		_n("F4", 1.0, 0.6), _n("A4", 1.0, 0.5), _n("C5", 1.0, 0.5), _n("A4", 1.0, 0.5),
		_n("G3", 1.0, 0.6), _n("B3", 1.0, 0.5), _n("D4", 1.0, 0.5), _n("B3", 1.0, 0.5),
		_n("A3", 1.0, 0.6), _n("C4", 1.0, 0.5), _n("E4", 1.0, 0.5), _n("C4", 1.0, 0.5),

		_n("C4", 1.0, 0.6), _n("E4", 1.0, 0.5), _n("G4", 1.0, 0.5), _n("E4", 1.0, 0.5),
		_n("F4", 1.0, 0.6), _n("A4", 1.0, 0.5), _n("C5", 1.0, 0.5), _n("A4", 1.0, 0.5),
		_n("D4", 1.0, 0.6), _n("F4", 1.0, 0.5), _n("A4", 1.0, 0.5), _n("F4", 1.0, 0.5),
		_n("G3", 1.0, 0.6), _n("B3", 1.0, 0.5), _n("D4", 1.0, 0.5), _n("G4", 1.0, 0.5),
	]

	# --- アコースティックベース ---
	var bass := Track.new()
	bass.name = "acoustic_bass"
	bass.timbre = timbre_acoustic_bass()
	bass.volume = 0.55
	bass.pan = -0.05
	bass.notes = [
		_n("C3", 1.5), _n("R", 0.5), _n("G2", 1.0), _n("C3", 1.0),
		_n("F2", 1.5), _n("R", 0.5), _n("C3", 1.0), _n("F2", 1.0),
		_n("G2", 1.5), _n("R", 0.5), _n("D3", 1.0), _n("G2", 1.0),
		_n("A2", 1.5), _n("R", 0.5), _n("E2", 1.0), _n("A2", 1.0),

		_n("C3", 1.5), _n("R", 0.5), _n("E2", 1.0), _n("G2", 1.0),
		_n("F2", 1.5), _n("R", 0.5), _n("A2", 1.0), _n("C3", 1.0),
		_n("D3", 1.5), _n("R", 0.5), _n("A2", 1.0), _n("D3", 1.0),
		_n("G2", 2.0), _n("R", 1.0), _n("G2", 1.0),
	]

	# --- タンバリン＋ブラシスネア（パーカッション） ---
	var perc := Track.new()
	perc.name = "percussion"
	perc.timbre = timbre_tambourine()
	perc.volume = 0.3
	perc.pan = 0.2
	# パーカッションはダミーノートで打点を表す
	perc.notes = [
		_n("E5", 0.5, 0.4), _n("R", 0.5), _n("E5", 0.5, 0.3), _n("E5", 0.5, 0.5),
		_n("E5", 0.5, 0.4), _n("R", 0.5), _n("E5", 0.5, 0.3), _n("E5", 0.5, 0.5),
		_n("E5", 0.5, 0.4), _n("R", 0.5), _n("E5", 0.5, 0.3), _n("E5", 0.5, 0.5),
		_n("E5", 0.5, 0.4), _n("R", 0.5), _n("E5", 0.5, 0.3), _n("E5", 0.5, 0.5),

		_n("E5", 0.5, 0.4), _n("R", 0.5), _n("E5", 0.5, 0.3), _n("E5", 0.5, 0.5),
		_n("E5", 0.5, 0.4), _n("R", 0.5), _n("E5", 0.5, 0.3), _n("E5", 0.5, 0.5),
		_n("E5", 0.5, 0.4), _n("R", 0.5), _n("E5", 0.5, 0.3), _n("E5", 0.5, 0.5),
		_n("E5", 0.5, 0.4), _n("R", 0.5), _n("E5", 0.5, 0.3), _n("E5", 0.5, 0.5),
	]

	song.tracks = [melody, harmony, bass, perc]
	return song


# =============================================================================
# 楽曲: dungeon_spring — 春のダンジョン (BPM 110)
# =============================================================================

static func get_dungeon_spring() -> Song:
	var song := Song.new()
	song.name = "dungeon_spring"
	song.bpm = 110.0
	song.reverb_amount = 0.55
	song.delay_amount = 0.25

	# --- クラリネット風メロディ ---
	var melody := Track.new()
	melody.name = "melody_clarinet"
	melody.timbre = timbre_clarinet()
	melody.volume = 0.55
	melody.pan = 0.1
	melody.notes = [
		_n("Eb4", 2.0), _n("D4", 1.0), _n("C4", 1.0),
		_n("Bb3", 2.0), _n("Ab3", 2.0),
		_n("G3", 1.0), _n("Ab3", 1.0), _n("Bb3", 1.0), _n("C4", 1.0),
		_n("Eb4", 3.0), _n("R", 1.0),

		_n("F4", 1.5), _n("Eb4", 0.5), _n("D4", 1.0), _n("C4", 1.0),
		_n("Bb3", 1.5), _n("C4", 0.5), _n("Eb4", 2.0),
		_n("D4", 1.0), _n("C4", 1.0), _n("Bb3", 1.0), _n("Ab3", 1.0),
		_n("G3", 3.0), _n("R", 1.0),
	]

	# --- 不安なパッド（短三和音） ---
	var pad := Track.new()
	pad.name = "dark_pad"
	pad.timbre = timbre_dark_pad()
	pad.volume = 0.3
	pad.pan = -0.3
	pad.notes = [
		_n("C4", 4.0, 0.4), _n("Ab3", 4.0, 0.4),
		_n("Eb4", 4.0, 0.4), _n("Bb3", 4.0, 0.4),
		_n("Ab3", 4.0, 0.4), _n("Eb4", 4.0, 0.4),
		_n("G3", 4.0, 0.4), _n("D4", 4.0, 0.4),
	]

	# --- 暗いサブベース ---
	var bass := Track.new()
	bass.name = "sub_bass"
	bass.timbre = timbre_sub_bass()
	bass.volume = 0.5
	bass.pan = 0.0
	bass.notes = [
		_n("C3", 2.0), _n("R", 1.0), _n("C2", 1.0),
		_n("Ab2", 2.0), _n("R", 1.0), _n("Ab2", 1.0),
		_n("Eb3", 2.0), _n("R", 1.0), _n("Eb2", 1.0),
		_n("Bb2", 2.0), _n("R", 1.0), _n("Bb2", 1.0),
		_n("Ab2", 2.0), _n("R", 1.0), _n("Ab2", 1.0),
		_n("Eb3", 2.0), _n("R", 1.0), _n("Eb2", 1.0),
		_n("G2", 2.0), _n("R", 1.0), _n("G2", 1.0),
		_n("D3", 2.0), _n("R", 1.0), _n("D2", 1.0),
	]

	# --- 水滴の環境音（ランダム風の高音） ---
	var drops := Track.new()
	drops.name = "water_drops"
	drops.timbre = timbre_water_drop()
	drops.volume = 0.25
	drops.pan = 0.4
	drops.notes = [
		_n("R", 1.5), _n("C6", 0.25, 0.5), _n("R", 2.25),
		_n("R", 0.75), _n("E6", 0.25, 0.4), _n("R", 1.0), _n("D6", 0.25, 0.3), _n("R", 1.75),
		_n("R", 2.0), _n("B5", 0.25, 0.45), _n("R", 1.75),
		_n("R", 1.25), _n("A5", 0.25, 0.35), _n("R", 2.5),
		_n("R", 0.5), _n("E6", 0.25, 0.4), _n("R", 1.5), _n("C6", 0.25, 0.5), _n("R", 1.5),
		_n("R", 2.5), _n("D6", 0.25, 0.3), _n("R", 1.25),
		_n("R", 1.0), _n("B5", 0.25, 0.45), _n("R", 2.75),
		_n("R", 3.0), _n("A5", 0.25, 0.4), _n("R", 0.75),
	]

	song.tracks = [melody, pad, bass, drops]
	return song


# =============================================================================
# 楽曲: battle — 通常バトル (BPM 140)
# =============================================================================

static func get_battle() -> Song:
	var song := Song.new()
	song.name = "battle"
	song.bpm = 140.0
	song.reverb_amount = 0.2
	song.delay_amount = 0.1

	# --- ブラス風メロディ ---
	var melody := Track.new()
	melody.name = "melody_brass"
	melody.timbre = timbre_brass()
	melody.volume = 0.6
	melody.pan = 0.1
	melody.notes = [
		_n("E5", 0.5), _n("E5", 0.5), _n("R", 0.25), _n("E5", 0.75), _n("G5", 1.0), _n("A5", 1.0),
		_n("G5", 0.5), _n("E5", 0.5), _n("D5", 1.0), _n("C5", 1.0), _n("R", 0.5),
		_n("C5", 0.5), _n("D5", 0.5), _n("E5", 1.0), _n("G5", 1.0), _n("A5", 0.5), _n("G5", 0.5),
		_n("E5", 1.5), _n("D5", 0.5), _n("C5", 1.0), _n("R", 0.5),

		_n("A5", 0.75), _n("G5", 0.25), _n("A5", 0.5), _n("B5", 0.5), _n("A5", 1.0), _n("G5", 1.0),
		_n("E5", 1.0), _n("D5", 0.5), _n("E5", 0.5), _n("G5", 1.0), _n("R", 0.5),
		_n("A4", 0.5), _n("C5", 0.5), _n("E5", 0.5), _n("G5", 0.5), _n("A5", 1.0), _n("G5", 1.0),
		_n("E5", 2.0), _n("R", 1.0),
	]

	# --- パワーコード風リズムギター ---
	var rhythm := Track.new()
	rhythm.name = "rhythm_guitar"
	rhythm.timbre = timbre_power_chord()
	rhythm.volume = 0.4
	rhythm.pan = -0.3
	rhythm.notes = [
		_n("C4", 0.5, 0.7), _n("C4", 0.5, 0.5), _n("R", 0.25), _n("C4", 0.75, 0.7),
		_n("C4", 0.5, 0.7), _n("C4", 0.5, 0.5), _n("R", 0.25), _n("C4", 0.75, 0.7),
		_n("F3", 0.5, 0.7), _n("F3", 0.5, 0.5), _n("R", 0.25), _n("F3", 0.75, 0.7),
		_n("G3", 0.5, 0.7), _n("G3", 0.5, 0.5), _n("R", 0.25), _n("G3", 0.75, 0.7),

		_n("A3", 0.5, 0.7), _n("A3", 0.5, 0.5), _n("R", 0.25), _n("A3", 0.75, 0.7),
		_n("G3", 0.5, 0.7), _n("G3", 0.5, 0.5), _n("R", 0.25), _n("G3", 0.75, 0.7),
		_n("F3", 0.5, 0.7), _n("F3", 0.5, 0.5), _n("R", 0.25), _n("F3", 0.75, 0.7),
		_n("G3", 0.5, 0.7), _n("G3", 0.5, 0.5), _n("R", 0.25), _n("G3", 0.75, 0.7),
	]

	# --- ドライブベース ---
	var bass := Track.new()
	bass.name = "drive_bass"
	bass.timbre = timbre_drive_bass()
	bass.volume = 0.55
	bass.pan = 0.0
	bass.notes = [
		_n("C3", 0.5), _n("C3", 0.25), _n("R", 0.25), _n("C3", 0.5), _n("E3", 0.5),
		_n("C3", 0.5), _n("C3", 0.25), _n("R", 0.25), _n("G2", 0.5), _n("C3", 0.5),
		_n("F2", 0.5), _n("F2", 0.25), _n("R", 0.25), _n("F2", 0.5), _n("A2", 0.5),
		_n("G2", 0.5), _n("G2", 0.25), _n("R", 0.25), _n("G2", 0.5), _n("B2", 0.5),

		_n("A2", 0.5), _n("A2", 0.25), _n("R", 0.25), _n("A2", 0.5), _n("C3", 0.5),
		_n("G2", 0.5), _n("G2", 0.25), _n("R", 0.25), _n("G2", 0.5), _n("B2", 0.5),
		_n("F2", 0.5), _n("F2", 0.25), _n("R", 0.25), _n("A2", 0.5), _n("C3", 0.5),
		_n("G2", 1.0), _n("R", 0.25), _n("G2", 0.5), _n("G2", 0.25),
	]

	# --- ドラム ---
	var drums := Track.new()
	drums.name = "drums"
	drums.timbre = timbre_kick()  # 基本音色（実際はノートで使い分け）
	drums.volume = 0.5
	drums.pan = 0.0
	# キック=低音(C2)、スネア的=中音(D2)、ハイハット的=高音(F#3)
	drums.notes = [
		# 1小節: キック-ハイハット-スネア-ハイハット 繰り返し
		_n("C2", 0.5, 0.9), _n("F#3", 0.5, 0.4), _n("D2", 0.5, 0.7), _n("F#3", 0.5, 0.4),
		_n("C2", 0.5, 0.9), _n("F#3", 0.5, 0.4), _n("D2", 0.5, 0.7), _n("F#3", 0.5, 0.4),
		_n("C2", 0.5, 0.9), _n("F#3", 0.5, 0.4), _n("D2", 0.5, 0.7), _n("F#3", 0.5, 0.4),
		_n("C2", 0.5, 0.9), _n("C2", 0.25, 0.6), _n("D2", 0.5, 0.8), _n("D2", 0.25, 0.5), _n("F#3", 0.5, 0.5),

		_n("C2", 0.5, 0.9), _n("F#3", 0.5, 0.4), _n("D2", 0.5, 0.7), _n("F#3", 0.5, 0.4),
		_n("C2", 0.5, 0.9), _n("F#3", 0.5, 0.4), _n("D2", 0.5, 0.7), _n("F#3", 0.5, 0.4),
		_n("C2", 0.5, 0.9), _n("F#3", 0.5, 0.4), _n("D2", 0.5, 0.7), _n("F#3", 0.5, 0.4),
		_n("C2", 0.5, 0.9), _n("D2", 0.25, 0.6), _n("D2", 0.25, 0.5), _n("C#5", 1.0, 0.7),  # クラッシュ
	]

	song.tracks = [melody, rhythm, bass, drums]
	return song


# =============================================================================
# 楽曲: boss — ボスバトル (BPM 150)
# =============================================================================

static func get_boss() -> Song:
	var song := Song.new()
	song.name = "boss"
	song.bpm = 150.0
	song.reverb_amount = 0.25
	song.delay_amount = 0.12

	# --- ブラス風メロディ（より激しく） ---
	var melody := Track.new()
	melody.name = "melody_brass"
	melody.timbre = timbre_brass()
	melody.volume = 0.65
	melody.pan = 0.1
	# 4/4 → 途中 6/8（3拍子2つ分）→ 4/4 に戻る
	melody.notes = [
		# 4/4 セクション（8拍）
		_n("E5", 0.5), _n("F5", 0.5), _n("E5", 0.5), _n("C5", 0.5), _n("D5", 1.0), _n("R", 0.5), _n("E5", 0.5),
		_n("G5", 0.75), _n("F5", 0.25), _n("E5", 0.5), _n("D5", 0.5), _n("C5", 1.0), _n("R", 0.5), _n("B4", 0.5),
		# 6/8 セクション（6拍 = 2小節分の3/4）
		_n("C5", 0.5), _n("Eb5", 0.5), _n("G5", 0.5), _n("Ab5", 0.5), _n("G5", 0.5), _n("Eb5", 0.5),
		_n("F5", 0.5), _n("Ab5", 0.5), _n("C6", 0.5), _n("B5", 0.5), _n("Ab5", 0.5), _n("F5", 0.5),
		# 4/4 に戻る（8拍）
		_n("E5", 1.0), _n("G5", 0.5), _n("A5", 0.5), _n("B5", 1.0), _n("A5", 1.0),
		_n("G5", 0.5), _n("E5", 0.5), _n("C5", 1.0), _n("D5", 1.0), _n("E5", 1.0),
	]

	# --- オルガン風持続音 ---
	var organ := Track.new()
	organ.name = "organ_sustain"
	organ.timbre = timbre_organ()
	organ.volume = 0.35
	organ.pan = -0.2
	organ.notes = [
		# 4/4
		_n("C4", 4.0, 0.5), _n("B3", 4.0, 0.5),
		# 6/8 — dim/augコード
		_n("C4", 3.0, 0.55), _n("Eb4", 3.0, 0.55),  # Cdim系
		# 4/4
		_n("E4", 4.0, 0.5), _n("D4", 4.0, 0.5),
	]

	# --- ドライブベース（激しめ） ---
	var bass := Track.new()
	bass.name = "drive_bass"
	bass.timbre = timbre_drive_bass()
	bass.volume = 0.6
	bass.pan = 0.0
	bass.notes = [
		# 4/4
		_n("C3", 0.5), _n("C3", 0.25), _n("R", 0.25), _n("E3", 0.5), _n("G3", 0.5),
		_n("C3", 0.5), _n("R", 0.25), _n("C3", 0.25), _n("G2", 0.5), _n("B2", 0.5),
		_n("B2", 0.5), _n("B2", 0.25), _n("R", 0.25), _n("D3", 0.5), _n("F3", 0.5),
		_n("B2", 0.5), _n("R", 0.25), _n("B2", 0.25), _n("G2", 0.5), _n("A2", 0.5),
		# 6/8
		_n("C3", 0.5), _n("Eb3", 0.5), _n("G3", 0.5), _n("C3", 0.5), _n("Eb3", 0.5), _n("G3", 0.5),
		_n("F3", 0.5), _n("Ab3", 0.5), _n("C3", 0.5), _n("F3", 0.5), _n("Ab3", 0.5), _n("C3", 0.5),
		# 4/4
		_n("E3", 0.5), _n("E3", 0.25), _n("R", 0.25), _n("G3", 0.5), _n("B3", 0.5),
		_n("E3", 0.5), _n("R", 0.25), _n("E3", 0.25), _n("C3", 0.5), _n("E3", 0.5),
		_n("D3", 0.5), _n("D3", 0.25), _n("R", 0.25), _n("F3", 0.5), _n("A3", 0.5),
		_n("G3", 0.5), _n("G3", 0.25), _n("R", 0.25), _n("E3", 0.5), _n("G3", 0.5),
	]

	# --- ドラム（激しいパターン） ---
	var drums := Track.new()
	drums.name = "drums"
	drums.timbre = timbre_kick()
	drums.volume = 0.55
	drums.pan = 0.0
	drums.notes = [
		# 4/4（ダブルキック風）
		_n("C2", 0.25, 0.9), _n("C2", 0.25, 0.6), _n("F#3", 0.25, 0.4), _n("F#3", 0.25, 0.3),
		_n("D2", 0.5, 0.8), _n("F#3", 0.25, 0.4), _n("F#3", 0.25, 0.3),
		_n("C2", 0.25, 0.9), _n("C2", 0.25, 0.6), _n("F#3", 0.25, 0.4), _n("F#3", 0.25, 0.3),
		_n("D2", 0.5, 0.8), _n("C2", 0.25, 0.5), _n("C2", 0.25, 0.5),

		_n("C2", 0.25, 0.9), _n("C2", 0.25, 0.6), _n("F#3", 0.25, 0.4), _n("F#3", 0.25, 0.3),
		_n("D2", 0.5, 0.8), _n("F#3", 0.25, 0.4), _n("F#3", 0.25, 0.3),
		_n("D2", 0.25, 0.7), _n("D2", 0.25, 0.6), _n("D2", 0.25, 0.6), _n("D2", 0.25, 0.7),  # フィルイン
		_n("C#5", 1.0, 0.8),  # クラッシュ

		# 6/8（3連系）
		_n("C2", 0.5, 0.9), _n("F#3", 0.5, 0.4), _n("F#3", 0.5, 0.3),
		_n("D2", 0.5, 0.7), _n("F#3", 0.5, 0.4), _n("F#3", 0.5, 0.3),
		_n("C2", 0.5, 0.9), _n("F#3", 0.5, 0.4), _n("F#3", 0.5, 0.3),
		_n("D2", 0.5, 0.7), _n("D2", 0.5, 0.6), _n("C#5", 0.5, 0.7),

		# 4/4 に戻る
		_n("C2", 0.25, 0.9), _n("C2", 0.25, 0.6), _n("F#3", 0.25, 0.4), _n("F#3", 0.25, 0.3),
		_n("D2", 0.5, 0.8), _n("F#3", 0.25, 0.4), _n("F#3", 0.25, 0.3),
		_n("C2", 0.25, 0.9), _n("C2", 0.25, 0.6), _n("F#3", 0.25, 0.4), _n("F#3", 0.25, 0.3),
		_n("D2", 0.5, 0.8), _n("C2", 0.25, 0.5), _n("C2", 0.25, 0.5),

		_n("C2", 0.25, 0.9), _n("C2", 0.25, 0.6), _n("F#3", 0.25, 0.4), _n("F#3", 0.25, 0.3),
		_n("D2", 0.5, 0.8), _n("F#3", 0.25, 0.4), _n("F#3", 0.25, 0.3),
		_n("C2", 0.5, 0.9), _n("F#3", 0.5, 0.4), _n("D2", 0.5, 0.7), _n("F#3", 0.5, 0.4),
	]

	song.tracks = [melody, organ, bass, drums]
	return song


# =============================================================================
# SE定義
# =============================================================================

static func get_se_attack() -> SoundEffect:
	var se := SoundEffect.new()
	se.name = "se_attack"
	se.duration = 0.15
	se.reverb = 0.15
	var l1 := SELayer.new()
	l1.wave = WaveType.NOISE
	l1.freq_start = 800.0; l1.freq_end = 200.0
	l1.amplitude = 0.7
	l1.envelope = Envelope.new(0.002, 0.05, 0.1, 0.05)
	l1.noise_mix = 0.8
	var l2 := SELayer.new()
	l2.wave = WaveType.SINE
	l2.freq_start = 600.0; l2.freq_end = 150.0
	l2.amplitude = 0.4
	l2.envelope = Envelope.new(0.002, 0.04, 0.0, 0.06)
	se.layers = [l1, l2]
	return se

static func get_se_heal() -> SoundEffect:
	var se := SoundEffect.new()
	se.name = "se_heal"
	se.duration = 0.5
	se.reverb = 0.35
	# 上昇アルペジオ C-E-G-C
	var l1 := SELayer.new()
	l1.wave = WaveType.SINE
	l1.freq_start = 523.25; l1.freq_end = 1046.50
	l1.amplitude = 0.6
	l1.envelope = Envelope.new(0.01, 0.1, 0.4, 0.3)
	var l2 := SELayer.new()
	l2.wave = WaveType.TRIANGLE
	l2.freq_start = 659.26; l2.freq_end = 1318.51
	l2.amplitude = 0.3
	l2.envelope = Envelope.new(0.02, 0.1, 0.3, 0.25)
	se.layers = [l1, l2]
	return se

static func get_se_damage() -> SoundEffect:
	var se := SoundEffect.new()
	se.name = "se_damage"
	se.duration = 0.1
	se.reverb = 0.05
	var l1 := SELayer.new()
	l1.wave = WaveType.SINE
	l1.freq_start = 80.0; l1.freq_end = 40.0
	l1.amplitude = 0.9
	l1.envelope = Envelope.new(0.002, 0.04, 0.0, 0.03)
	var l2 := SELayer.new()
	l2.wave = WaveType.NOISE
	l2.freq_start = 400.0; l2.freq_end = 100.0
	l2.amplitude = 0.5
	l2.envelope = Envelope.new(0.002, 0.03, 0.0, 0.03)
	l2.noise_mix = 1.0
	se.layers = [l1, l2]
	return se

static func get_se_critical() -> SoundEffect:
	var se := SoundEffect.new()
	se.name = "se_critical"
	se.duration = 0.2
	se.reverb = 0.2
	var l1 := SELayer.new()
	l1.wave = WaveType.NOISE
	l1.freq_start = 1000.0; l1.freq_end = 200.0
	l1.amplitude = 0.7
	l1.envelope = Envelope.new(0.002, 0.04, 0.1, 0.04)
	l1.noise_mix = 0.7
	var l2 := SELayer.new()
	l2.wave = WaveType.SINE
	l2.freq_start = 1200.0; l2.freq_end = 2400.0
	l2.amplitude = 0.4
	l2.envelope = Envelope.new(0.01, 0.06, 0.2, 0.08)
	se.layers = [l1, l2]
	return se

static func get_se_menu() -> SoundEffect:
	var se := SoundEffect.new()
	se.name = "se_menu"
	se.duration = 0.05
	se.reverb = 0.0
	var l1 := SELayer.new()
	l1.wave = WaveType.SINE
	l1.freq_start = 1200.0; l1.freq_end = 1200.0
	l1.amplitude = 0.4
	l1.envelope = Envelope.new(0.002, 0.02, 0.0, 0.015)
	se.layers = [l1]
	return se

static func get_se_confirm() -> SoundEffect:
	var se := SoundEffect.new()
	se.name = "se_confirm"
	se.duration = 0.15
	se.reverb = 0.1
	# E5 → G5
	var l1 := SELayer.new()
	l1.wave = WaveType.SINE
	l1.freq_start = 659.26; l1.freq_end = 659.26
	l1.amplitude = 0.5
	l1.envelope = Envelope.new(0.002, 0.03, 0.3, 0.04)
	var l2 := SELayer.new()
	l2.wave = WaveType.SINE
	l2.freq_start = 783.99; l2.freq_end = 783.99
	l2.amplitude = 0.5
	l2.envelope = Envelope.new(0.04, 0.03, 0.3, 0.04)
	se.layers = [l1, l2]
	return se

static func get_se_cancel() -> SoundEffect:
	var se := SoundEffect.new()
	se.name = "se_cancel"
	se.duration = 0.08
	se.reverb = 0.0
	var l1 := SELayer.new()
	l1.wave = WaveType.SQUARE
	l1.freq_start = 150.0; l1.freq_end = 80.0
	l1.amplitude = 0.5
	l1.envelope = Envelope.new(0.002, 0.03, 0.0, 0.02)
	se.layers = [l1]
	return se

static func get_se_level_up() -> SoundEffect:
	var se := SoundEffect.new()
	se.name = "se_level_up"
	se.duration = 0.8
	se.reverb = 0.25
	# C-E-G-C-E 上昇ファンファーレ
	var l1 := SELayer.new()
	l1.wave = WaveType.SINE
	l1.freq_start = 523.25; l1.freq_end = 1318.51
	l1.amplitude = 0.5
	l1.envelope = Envelope.new(0.005, 0.05, 0.5, 0.3)
	var l2 := SELayer.new()
	l2.wave = WaveType.TRIANGLE
	l2.freq_start = 523.25; l2.freq_end = 1318.51
	l2.amplitude = 0.3
	l2.envelope = Envelope.new(0.01, 0.05, 0.4, 0.3)
	var l3 := SELayer.new()
	l3.wave = WaveType.SINE
	l3.freq_start = 261.63; l3.freq_end = 523.25
	l3.amplitude = 0.25
	l3.envelope = Envelope.new(0.01, 0.1, 0.3, 0.4)
	se.layers = [l1, l2, l3]
	return se

static func get_se_victory() -> SoundEffect:
	var se := SoundEffect.new()
	se.name = "se_victory"
	se.duration = 1.5
	se.reverb = 0.3
	# 勝利ジングル 4音メロディ
	var l1 := SELayer.new()
	l1.wave = WaveType.SINE
	l1.freq_start = 523.25; l1.freq_end = 1046.50
	l1.amplitude = 0.5
	l1.envelope = Envelope.new(0.005, 0.1, 0.5, 0.6)
	var l2 := SELayer.new()
	l2.wave = WaveType.TRIANGLE
	l2.freq_start = 659.26; l2.freq_end = 1318.51
	l2.amplitude = 0.3
	l2.envelope = Envelope.new(0.01, 0.1, 0.4, 0.5)
	var l3 := SELayer.new()
	l3.wave = WaveType.SAWTOOTH
	l3.freq_start = 261.63; l3.freq_end = 261.63
	l3.amplitude = 0.15
	l3.envelope = Envelope.new(0.02, 0.2, 0.3, 0.8)
	se.layers = [l1, l2, l3]
	return se

static func get_se_encounter() -> SoundEffect:
	var se := SoundEffect.new()
	se.name = "se_encounter"
	se.duration = 0.5
	se.reverb = 0.15
	# 不協和音 → ドラムフィル
	var l1 := SELayer.new()
	l1.wave = WaveType.SQUARE
	l1.freq_start = 100.0; l1.freq_end = 80.0
	l1.amplitude = 0.5
	l1.envelope = Envelope.new(0.01, 0.15, 0.2, 0.1)
	var l2 := SELayer.new()
	l2.wave = WaveType.SQUARE
	l2.freq_start = 103.0; l2.freq_end = 85.0  # わずかにデチューン
	l2.amplitude = 0.4
	l2.envelope = Envelope.new(0.01, 0.15, 0.2, 0.1)
	var l3 := SELayer.new()
	l3.wave = WaveType.NOISE
	l3.freq_start = 500.0; l3.freq_end = 200.0
	l3.amplitude = 0.6
	l3.envelope = Envelope.new(0.15, 0.1, 0.3, 0.1)
	l3.noise_mix = 1.0
	se.layers = [l1, l2, l3]
	return se


# =============================================================================
# 全楽曲・SE取得用ユーティリティ
# =============================================================================

static func get_song(song_name: String) -> Song:
	match song_name:
		"title": return get_title()
		"town_spring": return get_town_spring()
		"dungeon_spring": return get_dungeon_spring()
		"battle": return get_battle()
		"boss": return get_boss()
		_:
			push_error("Unknown song: " + song_name)
			return Song.new()

static func get_se(se_name: String) -> SoundEffect:
	match se_name:
		"se_attack": return get_se_attack()
		"se_heal": return get_se_heal()
		"se_damage": return get_se_damage()
		"se_critical": return get_se_critical()
		"se_menu": return get_se_menu()
		"se_confirm": return get_se_confirm()
		"se_cancel": return get_se_cancel()
		"se_level_up": return get_se_level_up()
		"se_victory": return get_se_victory()
		"se_encounter": return get_se_encounter()
		_:
			push_error("Unknown SE: " + se_name)
			return SoundEffect.new()

static func get_all_song_names() -> PackedStringArray:
	return PackedStringArray(["title", "town_spring", "dungeon_spring", "battle", "boss"])

static func get_all_se_names() -> PackedStringArray:
	return PackedStringArray([
		"se_attack", "se_heal", "se_damage", "se_critical",
		"se_menu", "se_confirm", "se_cancel",
		"se_level_up", "se_victory", "se_encounter"
	])
