class SoundEngine {
  constructor() {
    this.audioCtx = null;
    this.isMuted = this.loadMutePreference();
    this.listeners = new Set();

    this.currentPreset = 'off';
    this.ambientVolume = 0.25;
    this.ambientNodes = [];
    this.ambientMasterGain = null;
    this.analyser = null;
    this.fadeTimer = null;
  }

  loadMutePreference() {
    try {
      return localStorage.getItem('kala_sound_muted') === 'true';
    } catch {
      return false;
    }
  }

  saveMutePreference(muted) {
    try {
      localStorage.setItem('kala_sound_muted', String(muted));
    } catch {}
  }

  getAudioContext() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) return null;
      this.audioCtx = new AudioCtxClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyListeners() {
    this.listeners.forEach((fn) => {
      try {
        fn({
          isMuted: this.isMuted,
          currentPreset: this.currentPreset,
          volume: this.ambientVolume,
        });
      } catch {}
    });
  }

  getIsMuted() {
    return this.isMuted;
  }

  setMuted(muted) {
    this.isMuted = Boolean(muted);
    this.saveMutePreference(this.isMuted);

    if (this.ambientMasterGain && this.audioCtx) {
      const targetGain = this.isMuted ? 0.0001 : this.ambientVolume;
      const now = this.audioCtx.currentTime;
      this.ambientMasterGain.gain.cancelScheduledValues(now);
      this.ambientMasterGain.gain.linearRampToValueAtTime(targetGain, now + 0.1);
    }

    this.notifyListeners();
  }

  toggleMute() {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  // ==========================================
  // Micro-SFX Synthesizers
  // ==========================================

  /**
   * Subtle tick sound played when dragging or snapping schedule blocks
   */
  playTick() {
    if (this.isMuted) return;

    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      // Sharp, gentle click pulse
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(450, now + 0.015);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(850, now);
      filter.Q.setValueAtTime(3, now);

      gain.gain.setValueAtTime(0.045, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.02);
    } catch {}
  }

  playChime() {
    if (this.isMuted) return;

    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const chords = [587.33, 880.0, 1174.66]; // D5, A5, D6 harmonic shimmer

      chords.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const delay = idx * 0.065;
        const startTime = now + delay;
        const duration = 1.1;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.linearRampToValueAtTime(0.065 / (idx + 1), startTime + 0.035);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration + 0.05);
      });
    } catch {}
  }

  // ==========================================
  // Ambient Sound Generators (3 Synthetic Options)
  // ==========================================

  ensureMasterAudioChain() {
    const ctx = this.getAudioContext();
    if (!ctx) return null;

    if (!this.ambientMasterGain) {
      this.ambientMasterGain = ctx.createGain();
      this.ambientMasterGain.gain.setValueAtTime(
        this.isMuted ? 0.0001 : this.ambientVolume,
        ctx.currentTime
      );

      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 64;
      this.analyser.smoothingTimeConstant = 0.8;

      this.ambientMasterGain.connect(this.analyser);
      this.analyser.connect(ctx.destination);
    }

    return ctx;
  }

  setAmbientVolume(vol) {
    this.ambientVolume = Math.max(0, Math.min(1, vol));
    if (this.ambientMasterGain && this.audioCtx && !this.isMuted) {
      const now = this.audioCtx.currentTime;
      this.ambientMasterGain.gain.cancelScheduledValues(now);
      this.ambientMasterGain.gain.linearRampToValueAtTime(this.ambientVolume, now + 0.08);
    }
    this.notifyListeners();
  }

  getAmbientVolume() {
    return this.ambientVolume;
  }

  getCurrentPreset() {
    return this.currentPreset;
  }

  /**
   * Start or switch ambient sound: 'brown' | 'rain' | 'hum' | 'off'
   */
  setAmbientPreset(preset) {
    if (this.fadeTimer) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }

    if (preset === this.currentPreset && preset !== 'off') {
      return;
    }

    const ctx = this.ensureMasterAudioChain();
    if (!ctx) return;

    if (preset === 'off') {
      this.stopAmbient();
      return;
    }

    const now = ctx.currentTime;
    const fadeOutDuration = 0.35;

    // Smooth fade-out of previous sound
    this.ambientMasterGain.gain.cancelScheduledValues(now);
    this.ambientMasterGain.gain.linearRampToValueAtTime(0.0001, now + fadeOutDuration);

    this.fadeTimer = setTimeout(() => {
      this.clearAmbientNodes();
      this.buildAmbientGraph(preset);

      const fadeInTime = this.audioCtx.currentTime;
      const targetGain = this.isMuted ? 0.0001 : this.ambientVolume;
      this.ambientMasterGain.gain.cancelScheduledValues(fadeInTime);
      this.ambientMasterGain.gain.setValueAtTime(0.0001, fadeInTime);
      this.ambientMasterGain.gain.linearRampToValueAtTime(targetGain, fadeInTime + 0.45);

      this.currentPreset = preset;
      this.notifyListeners();
    }, fadeOutDuration * 1000);
  }

  stopAmbient() {
    const ctx = this.audioCtx;
    if (!ctx || !this.ambientMasterGain || this.currentPreset === 'off') {
      this.currentPreset = 'off';
      this.notifyListeners();
      return;
    }

    const now = ctx.currentTime;
    this.ambientMasterGain.gain.cancelScheduledValues(now);
    this.ambientMasterGain.gain.linearRampToValueAtTime(0.0001, now + 0.35);

    setTimeout(() => {
      this.clearAmbientNodes();
      this.currentPreset = 'off';
      this.notifyListeners();
    }, 380);
  }

  clearAmbientNodes() {
    this.ambientNodes.forEach((node) => {
      try {
        if (typeof node.stop === 'function') node.stop();
        if (typeof node.disconnect === 'function') node.disconnect();
      } catch {}
    });
    this.ambientNodes = [];
  }

  buildAmbientGraph(preset) {
    const ctx = this.audioCtx;
    if (!ctx) return;

    if (preset === 'brown') {
      this.createBrownNoiseGraph(ctx);
    } else if (preset === 'rain') {
      this.createSoftRainGraph(ctx);
    } else if (preset === 'hum') {
      this.createDeepHumGraph(ctx);
    }
  }

  // 1. Brown Noise: Leaky integrator random walk + 360Hz lowpass filter
  createBrownNoiseGraph(ctx) {
    const sampleRate = ctx.sampleRate;
    const bufferSize = sampleRate * 5;
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 3.4;
    }

    // Smooth boundary crossover
    const fadeSamples = Math.floor(sampleRate * 0.06);
    for (let i = 0; i < fadeSamples; i++) {
      const ratio = i / fadeSamples;
      data[i] = data[i] * ratio + data[bufferSize - fadeSamples + i] * (1 - ratio);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(360, ctx.currentTime);
    filter.Q.setValueAtTime(0.7, ctx.currentTime);

    source.connect(filter);
    filter.connect(this.ambientMasterGain);
    source.start(0);

    this.ambientNodes.push(source, filter);
  }

  // 2. Soft Rain: Filtered noise with bandpass resonance & gentle amplitude modulation
  createSoftRainGraph(ctx) {
    const sampleRate = ctx.sampleRate;
    const bufferSize = sampleRate * 5;
    const buffer = ctx.createBuffer(2, bufferSize, sampleRate);
    const leftData = buffer.getChannelData(0);
    const rightData = buffer.getChannelData(1);

    // Pink/rain noise synthesis
    let b0L = 0, b1L = 0, b2L = 0;
    let b0R = 0, b1R = 0, b2R = 0;

    for (let i = 0; i < bufferSize; i++) {
      const whiteL = Math.random() * 2 - 1;
      b0L = 0.99886 * b0L + whiteL * 0.0555179;
      b1L = 0.99332 * b1L + whiteL * 0.0750759;
      b2L = 0.96900 * b2L + whiteL * 0.1538520;
      leftData[i] = (b0L + b1L + b2L + whiteL * 0.5362) * 0.12;

      const whiteR = Math.random() * 2 - 1;
      b0R = 0.99886 * b0R + whiteR * 0.0555179;
      b1R = 0.99332 * b1R + whiteR * 0.0750759;
      b2R = 0.96900 * b2R + whiteR * 0.1538520;
      rightData[i] = (b0R + b1R + b2R + whiteR * 0.5362) * 0.12;
    }

    // Boundary cross-fade
    const fadeSamples = Math.floor(sampleRate * 0.06);
    for (let i = 0; i < fadeSamples; i++) {
      const ratio = i / fadeSamples;
      leftData[i] = leftData[i] * ratio + leftData[bufferSize - fadeSamples + i] * (1 - ratio);
      rightData[i] = rightData[i] * ratio + rightData[bufferSize - fadeSamples + i] * (1 - ratio);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    // Filter chain: highpass to clear muddy bottom + bandpass around 1100Hz
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(250, ctx.currentTime);

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'lowpass';
    bandpass.frequency.setValueAtTime(2400, ctx.currentTime);
    bandpass.Q.setValueAtTime(0.8, ctx.currentTime);

    // Subtle gentle swell modulator
    const rainGain = ctx.createGain();
    rainGain.gain.setValueAtTime(1.1, ctx.currentTime);

    source.connect(highpass);
    highpass.connect(bandpass);
    bandpass.connect(rainGain);
    rainGain.connect(this.ambientMasterGain);

    source.start(0);
    this.ambientNodes.push(source, highpass, bandpass, rainGain);
  }

  // 3. Deep Hum: Harmonic drone with binaural 0.35Hz beat and warm lowpass filter
  createDeepHumGraph(ctx) {
    const baseFreq = 55.0; // A1 warm root
    const detuneOffset = 0.35; // 0.35Hz slow binaural pulse

    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(baseFreq, ctx.currentTime);

    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(baseFreq + detuneOffset, ctx.currentTime);

    const osc3 = ctx.createOscillator();
    osc3.type = 'triangle';
    osc3.frequency.setValueAtTime(baseFreq * 2, ctx.currentTime); // A2 subtle octave

    const humFilter = ctx.createBiquadFilter();
    humFilter.type = 'lowpass';
    humFilter.frequency.setValueAtTime(180, ctx.currentTime);
    humFilter.Q.setValueAtTime(1.2, ctx.currentTime);

    const g1 = ctx.createGain();
    g1.gain.setValueAtTime(0.45, ctx.currentTime);

    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.45, ctx.currentTime);

    const g3 = ctx.createGain();
    g3.gain.setValueAtTime(0.12, ctx.currentTime);

    osc1.connect(g1);
    osc2.connect(g2);
    osc3.connect(g3);

    g1.connect(humFilter);
    g2.connect(humFilter);
    g3.connect(humFilter);

    humFilter.connect(this.ambientMasterGain);

    osc1.start(0);
    osc2.start(0);
    osc3.start(0);

    this.ambientNodes.push(osc1, osc2, osc3, g1, g2, g3, humFilter);
  }

  /**
   * Returns array of normalized frequency values [0..1] for audio bar visualization
   */
  getVisualizerData(barCount = 16) {
    if (!this.analyser || this.currentPreset === 'off' || this.isMuted) {
      return new Array(barCount).fill(0.04);
    }

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);

    const result = [];
    const step = Math.max(1, Math.floor(bufferLength / barCount));

    for (let i = 0; i < barCount; i++) {
      const val = dataArray[i * step] || 0;
      result.push(Math.max(0.08, val / 255));
    }

    return result;
  }
}

export const soundEngine = new SoundEngine();
