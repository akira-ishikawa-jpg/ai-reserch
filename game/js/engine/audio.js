// ============================================================
//  audio.js — 四季廻りの職人  Web Audio API BGM/SE エンジン
//  OscillatorNode + GainNode によるSFC風チップチューン再生
// ============================================================

class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.bgmGain = null;
    this.seGain = null;
    this.currentBgm = null;
    this.bgmNodes = [];
    this.bgmTimer = null;
    this.bgmVolume = 0.3;
    this.seVolume = 0.5;
    this.isPlaying = false;
    this._initialized = false;
    this._noiseBuffer = null;
  }

  // ----------------------------------------------------------
  //  初期化 — ユーザー操作後に呼ぶ（AudioContext制限回避）
  // ----------------------------------------------------------
  init() {
    if (this._initialized) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);

    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = this.bgmVolume;
    this.bgmGain.connect(this.masterGain);

    this.seGain = this.ctx.createGain();
    this.seGain.gain.value = this.seVolume;
    this.seGain.connect(this.masterGain);

    this._noiseBuffer = this._createNoiseBuffer();
    this._initialized = true;
  }

  // ----------------------------------------------------------
  //  ホワイトノイズバッファ生成（ドラム / SE 用）
  // ----------------------------------------------------------
  _createNoiseBuffer() {
    const size = this.ctx.sampleRate * 2; // 2秒分
    const buf = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < size; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  // ----------------------------------------------------------
  //  BGM 再生（ループ）
  // ----------------------------------------------------------
  playBgm(bgmId) {
    if (!this._initialized) this.init();
    if (this.currentBgm === bgmId && this.isPlaying) return;

    const data = MUSIC[bgmId];
    if (!data) {
      console.warn('[AudioManager] Unknown BGM:', bgmId);
      return;
    }

    // 現在のBGMを停止
    if (this.isPlaying) {
      this._stopBgmImmediate();
    }

    this.currentBgm = bgmId;
    this.isPlaying = true;

    this._scheduleBgm(data);
  }

  // ----------------------------------------------------------
  //  BGM スケジューラ — AudioContext.currentTime ベース
  // ----------------------------------------------------------
  _scheduleBgm(data) {
    const bpm = data.bpm;
    const beatDuration = 60 / bpm; // 1拍の秒数

    // 全トラックの総拍数を計算（最長トラック基準）
    let totalBeats = 0;
    for (const track of data.tracks) {
      if (track.type === 'drums') {
        // drums: patternLength はビート単位、曲全体の小節数は他トラックに合わせる
        continue;
      }
      let beats = 0;
      for (const n of track.notes) {
        beats += n[1] * 4; // duration は全音符=1 なので *4 で拍数
      }
      totalBeats = Math.max(totalBeats, beats);
    }

    const loopDuration = totalBeats * beatDuration;
    const scheduleAhead = 0.2; // 200ms先読み
    let loopStartTime = this.ctx.currentTime + 0.05;

    const scheduleLoop = () => {
      if (!this.isPlaying) return;

      const now = this.ctx.currentTime;

      // 次のループが必要か判定
      while (loopStartTime + loopDuration < now + scheduleAhead) {
        loopStartTime += loopDuration;
      }

      // ループ開始時間が近ければスケジュール
      if (loopStartTime <= now + scheduleAhead && loopStartTime >= now - 0.05) {
        this._scheduleAllTracks(data, loopStartTime, beatDuration, totalBeats);
        loopStartTime += loopDuration;
      }
    };

    // 初回即座にスケジュール
    this._scheduleAllTracks(data, loopStartTime, beatDuration, totalBeats);
    loopStartTime += loopDuration;

    // 定期的に次ループを先読みスケジュール
    this.bgmTimer = setInterval(() => {
      if (!this.isPlaying) {
        clearInterval(this.bgmTimer);
        return;
      }
      scheduleLoop();
    }, 100);
  }

  // ----------------------------------------------------------
  //  全トラックを指定開始時間にスケジュール
  // ----------------------------------------------------------
  _scheduleAllTracks(data, startTime, beatDuration, totalBeats) {
    for (const track of data.tracks) {
      if (track.type === 'drums') {
        this._scheduleDrumTrack(track, startTime, beatDuration, totalBeats);
      } else {
        this._scheduleNoteTrack(track, startTime, beatDuration);
      }
    }
  }

  // ----------------------------------------------------------
  //  音符トラックのスケジュール
  // ----------------------------------------------------------
  _scheduleNoteTrack(track, startTime, beatDuration) {
    let time = startTime;
    const waveform = track.waveform || 'square';
    const volume = track.volume || 0.15;

    for (const [note, duration, velocity] of track.notes) {
      const durationSec = duration * 4 * beatDuration; // 全音符=1 → 4拍

      if (note !== 'rest') {
        const freq = noteToFreq(note);
        if (freq > 0) {
          this._playNote(freq, waveform, time, durationSec, volume * velocity, this.bgmGain);
        }
      }
      time += durationSec;
    }
  }

  // ----------------------------------------------------------
  //  ドラムトラックのスケジュール（パターンを繰り返す）
  // ----------------------------------------------------------
  _scheduleDrumTrack(track, startTime, beatDuration, totalBeats) {
    const patternLength = track.patternLength || 4;
    const volume = track.volume || 0.15;
    const repeats = Math.ceil(totalBeats / patternLength);

    for (let rep = 0; rep < repeats; rep++) {
      const repStart = startTime + rep * patternLength * beatDuration;
      for (const [type, beatOffset] of track.pattern) {
        const t = repStart + beatOffset * beatDuration;
        this._playDrumHit(type, t, volume);
      }
    }
  }

  // ----------------------------------------------------------
  //  単音再生（Oscillator）
  // ----------------------------------------------------------
  _playNote(freq, waveform, time, duration, volume, destination) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = waveform;
    osc.frequency.value = freq;

    // エンベロープ: 短いアタック、サステイン、リリース
    const attackTime = 0.01;
    const releaseTime = Math.min(0.05, duration * 0.2);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + attackTime);
    gain.gain.setValueAtTime(volume, time + duration - releaseTime);
    gain.gain.linearRampToValueAtTime(0, time + duration);

    osc.connect(gain);
    gain.connect(destination);

    osc.start(time);
    osc.stop(time + duration + 0.01);

    // ノード参照を保存（停止時にクリーンアップ）
    this.bgmNodes.push({ osc, gain, stopTime: time + duration + 0.01 });
  }

  // ----------------------------------------------------------
  //  ドラムヒット再生
  // ----------------------------------------------------------
  _playDrumHit(type, time, volume) {
    switch (type) {
      case 'kick':
        this._playKick(time, volume);
        break;
      case 'snare':
        this._playSnare(time, volume);
        break;
      case 'hihat':
        this._playHihat(time, volume);
        break;
    }
  }

  _playKick(time, volume) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.1);
    gain.gain.setValueAtTime(volume * 1.2, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
    osc.connect(gain);
    gain.connect(this.bgmGain);
    osc.start(time);
    osc.stop(time + 0.15);
    this.bgmNodes.push({ osc, gain, stopTime: time + 0.15 });
  }

  _playSnare(time, volume) {
    // ノイズ成分
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = this._noiseBuffer;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.6, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

    // フィルター
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1000;

    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.bgmGain);
    noiseSource.start(time);
    noiseSource.stop(time + 0.1);

    // トーン成分
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, time);
    osc.frequency.exponentialRampToValueAtTime(100, time + 0.05);
    oscGain.gain.setValueAtTime(volume * 0.5, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    osc.connect(oscGain);
    oscGain.connect(this.bgmGain);
    osc.start(time);
    osc.stop(time + 0.08);

    this.bgmNodes.push({ osc, gain: oscGain, stopTime: time + 0.1 });
  }

  _playHihat(time, volume) {
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = this._noiseBuffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume * 0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 5000;

    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(this.bgmGain);
    noiseSource.start(time);
    noiseSource.stop(time + 0.05);
  }

  // ----------------------------------------------------------
  //  BGM 停止（フェードアウト付き）
  // ----------------------------------------------------------
  stopBgm(fadeDuration = 0.5) {
    if (!this.isPlaying) return;
    this.isPlaying = false;

    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }

    const now = this.ctx.currentTime;
    // BGM Gain をフェードアウト
    this.bgmGain.gain.setValueAtTime(this.bgmGain.gain.value, now);
    this.bgmGain.gain.linearRampToValueAtTime(0, now + fadeDuration);

    // フェード後にノードをクリーンアップ
    setTimeout(() => {
      this._cleanupBgmNodes();
      this.bgmGain.gain.setValueAtTime(this.bgmVolume, this.ctx.currentTime);
      this.currentBgm = null;
    }, fadeDuration * 1000 + 50);
  }

  // ----------------------------------------------------------
  //  BGM 即停止（内部用）
  // ----------------------------------------------------------
  _stopBgmImmediate() {
    this.isPlaying = false;
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
    this._cleanupBgmNodes();
    this.bgmGain.gain.setValueAtTime(this.bgmVolume, this.ctx.currentTime);
    this.currentBgm = null;
  }

  // ----------------------------------------------------------
  //  BGM ノード群クリーンアップ
  // ----------------------------------------------------------
  _cleanupBgmNodes() {
    for (const node of this.bgmNodes) {
      try {
        node.osc.stop();
      } catch (e) { /* 既停止ならスキップ */ }
      try {
        node.osc.disconnect();
      } catch (e) { /* */ }
      try {
        node.gain.disconnect();
      } catch (e) { /* */ }
    }
    this.bgmNodes = [];
  }

  // ----------------------------------------------------------
  //  SE 再生
  // ----------------------------------------------------------
  playSe(seId) {
    if (!this._initialized) this.init();

    const data = SE_DATA[seId];
    if (!data) {
      console.warn('[AudioManager] Unknown SE:', seId);
      return;
    }

    const now = this.ctx.currentTime;

    switch (data.type) {
      case 'noise_pitch':
        this._seNoisePitch(data, now);
        break;
      case 'arpeggio':
        this._seArpeggio(data, now);
        break;
      case 'tone':
        this._seTone(data, now);
        break;
    }
  }

  // ----------------------------------------------------------
  //  SE: ノイズ + ピッチダウン / アップ
  // ----------------------------------------------------------
  _seNoisePitch(data, time) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = data.waveform || 'square';
    osc.frequency.setValueAtTime(data.pitchStart, time);
    osc.frequency.exponentialRampToValueAtTime(Math.max(data.pitchEnd, 20), time + data.duration);
    gain.gain.setValueAtTime(this.seVolume * 0.5, time);
    gain.gain.linearRampToValueAtTime(0, time + data.duration);
    osc.connect(gain);
    gain.connect(this.seGain);
    osc.start(time);
    osc.stop(time + data.duration + 0.01);
  }

  // ----------------------------------------------------------
  //  SE: アルペジオ
  // ----------------------------------------------------------
  _seArpeggio(data, time) {
    const gap = data.noteGap || 0.08;
    const noteDur = data.duration / data.notes.length;
    data.notes.forEach((note, i) => {
      const freq = noteToFreq(note);
      if (freq > 0) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = data.waveform || 'sine';
        osc.frequency.value = freq;
        const t = time + i * gap;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(this.seVolume * 0.4, t + 0.01);
        gain.gain.setValueAtTime(this.seVolume * 0.4, t + noteDur - 0.02);
        gain.gain.linearRampToValueAtTime(0, t + noteDur);
        osc.connect(gain);
        gain.connect(this.seGain);
        osc.start(t);
        osc.stop(t + noteDur + 0.01);
      }
    });
  }

  // ----------------------------------------------------------
  //  SE: 単音トーン
  // ----------------------------------------------------------
  _seTone(data, time) {
    const freq = noteToFreq(data.note);
    if (freq <= 0) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = data.waveform || 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(this.seVolume * 0.4, time);
    gain.gain.linearRampToValueAtTime(0, time + data.duration);
    osc.connect(gain);
    gain.connect(this.seGain);
    osc.start(time);
    osc.stop(time + data.duration + 0.01);
  }

  // ----------------------------------------------------------
  //  マスターボリューム制御
  // ----------------------------------------------------------
  setMasterVolume(v) {
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(v, this.ctx.currentTime);
    }
  }

  setBgmVolume(v) {
    this.bgmVolume = v;
    if (this.bgmGain) {
      this.bgmGain.gain.setValueAtTime(v, this.ctx.currentTime);
    }
  }

  setSeVolume(v) {
    this.seVolume = v;
    if (this.seGain) {
      this.seGain.gain.setValueAtTime(v, this.ctx.currentTime);
    }
  }
}

// グローバルインスタンス
const audioManager = new AudioManager();
