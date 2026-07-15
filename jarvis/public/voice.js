/**
 * VoiceIO — browser speech layer for JARVIS.
 *
 * Responsibilities:
 *  - Wake-word listening ("Jarvis") via continuous SpeechRecognition
 *  - One-shot command capture (also used for push-to-talk)
 *  - Text-to-speech with a sentence queue and barge-in cancel
 *  - Suspends the microphone while speaking so JARVIS never wakes itself
 *
 * Requires Chrome/Edge (Web Speech API). Firefox has no SpeechRecognition;
 * the app degrades to typing + TTS there.
 */

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

function stripDiacritics(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

const BUILTIN_WAKE_VARIANTS = ['jarvis', 'javis', 'jervis', 'ja vis', 'gia vis', 'gia vit', 'za vis'];

export class VoiceIO extends EventTarget {
  constructor() {
    super();
    this.supported = Boolean(SR);
    this.synthSupported = 'speechSynthesis' in window;

    this.lang = 'vi-VN';
    this.rate = 1;
    this.voiceURI = '';
    this.wakeWord = 'jarvis';
    this.wakeEnabled = false;

    this._wakeRec = null;
    this._captureRec = null;
    this._capturing = false;
    this._speaking = false;
    this._queue = [];
    this._currentUtterance = null;
    this._wakeRestartTimer = null;
    this._audioCtx = null;

    if (this.synthSupported) {
      // Voice list loads asynchronously in Chrome.
      speechSynthesis.addEventListener?.('voiceschanged', () => {
        this.dispatchEvent(new CustomEvent('voices', { detail: this.voices() }));
      });
    }
  }

  configure({ lang, rate, voiceURI, wakeWord } = {}) {
    if (lang) this.lang = lang;
    if (rate) this.rate = rate;
    if (voiceURI !== undefined) this.voiceURI = voiceURI;
    if (wakeWord !== undefined) this.wakeWord = String(wakeWord || 'jarvis').toLowerCase();
  }

  voices() {
    return this.synthSupported ? speechSynthesis.getVoices() : [];
  }

  // ---------------- Wake word ----------------

  startWake() {
    if (!this.supported) return;
    this.wakeEnabled = true;
    this._spinWakeRecognition();
  }

  stopWake() {
    this.wakeEnabled = false;
    clearTimeout(this._wakeRestartTimer);
    if (this._wakeRec) {
      try { this._wakeRec.onend = null; this._wakeRec.stop(); } catch { /* already stopped */ }
      this._wakeRec = null;
    }
  }

  _spinWakeRecognition() {
    if (!this.wakeEnabled || this._capturing || this._speaking || this._wakeRec) return;
    const rec = new SR();
    rec.lang = this.lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    const wakeSet = [...new Set([this.wakeWord, ...BUILTIN_WAKE_VARIANTS])]
      .map((w) => stripDiacritics(w).toLowerCase().replace(/\s+/g, ''));

    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const heard = stripDiacritics(e.results[i][0].transcript).toLowerCase().replace(/\s+/g, '');
        if (wakeSet.some((w) => heard.includes(w))) {
          this._teardownWake();
          this.dispatchEvent(new CustomEvent('wake'));
          return;
        }
      }
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        this.wakeEnabled = false;
        this._teardownWake();
        this.dispatchEvent(new CustomEvent('mic-denied'));
      }
      // other errors (no-speech / network / aborted) fall through to onend
    };
    rec.onend = () => {
      this._wakeRec = null;
      // Chrome stops continuous recognition periodically — restart quietly.
      this._scheduleWakeRestart(400);
    };

    try {
      rec.start();
      this._wakeRec = rec;
    } catch {
      this._scheduleWakeRestart(1500);
    }
  }

  _teardownWake() {
    clearTimeout(this._wakeRestartTimer);
    if (this._wakeRec) {
      try { this._wakeRec.onend = null; this._wakeRec.onresult = null; this._wakeRec.stop(); } catch { /* noop */ }
      this._wakeRec = null;
    }
  }

  _scheduleWakeRestart(delay) {
    clearTimeout(this._wakeRestartTimer);
    if (!this.wakeEnabled) return;
    this._wakeRestartTimer = setTimeout(() => this._spinWakeRecognition(), delay);
  }

  // ---------------- Command capture ----------------

  /**
   * Capture one spoken command. Emits 'interim' events with live text.
   * @returns {Promise<string>} final transcript ('' when nothing was heard)
   */
  captureCommand({ timeoutMs = 12000 } = {}) {
    if (!this.supported) return Promise.reject(new Error('SpeechRecognition not supported'));
    if (this._capturing) return Promise.reject(new Error('already capturing'));

    this.cancelSpeech(); // barge-in: user talks → JARVIS shuts up
    this._teardownWake();
    this._capturing = true;
    this.dispatchEvent(new CustomEvent('capture-start'));

    return new Promise((resolve) => {
      const rec = new SR();
      this._captureRec = rec;
      rec.lang = this.lang;
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      let finalText = '';
      let settled = false;

      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this._capturing = false;
        this._captureRec = null;
        this.dispatchEvent(new CustomEvent('capture-end'));
        this._scheduleWakeRestart(600);
        resolve(finalText.trim());
      };

      const timer = setTimeout(() => {
        try { rec.stop(); } catch { /* noop */ }
      }, timeoutMs);

      rec.onresult = (e) => {
        let interim = '';
        for (let i = 0; i < e.results.length; i++) {
          if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
          else interim += e.results[i][0].transcript;
        }
        this.dispatchEvent(new CustomEvent('interim', { detail: (finalText + interim).trim() }));
      };
      rec.onerror = (e) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          this.dispatchEvent(new CustomEvent('mic-denied'));
        }
        finish();
      };
      rec.onend = finish;

      try {
        rec.start();
      } catch {
        finish();
      }
    });
  }

  /** Force-stop an in-progress capture (push-to-talk key released). */
  stopCapture() {
    if (this._captureRec) {
      try { this._captureRec.stop(); } catch { /* noop */ }
    }
  }

  get capturing() {
    return this._capturing;
  }

  // ---------------- Speech synthesis ----------------

  /** Queue a chunk of text (a sentence) to be spoken. */
  speak(text) {
    if (!this.synthSupported) return;
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean) return;
    this._queue.push(clean);
    this._pump();
  }

  _pump() {
    if (this._currentUtterance || this._queue.length === 0) return;

    if (!this._speaking) {
      this._speaking = true;
      this._teardownWake(); // never listen to our own voice
      this.dispatchEvent(new CustomEvent('speak-start'));
    }

    const text = this._queue.shift();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = this.lang;
    u.rate = this.rate;
    const voice = this._pickVoice();
    if (voice) u.voice = voice;

    u.onend = u.onerror = () => {
      this._currentUtterance = null;
      if (this._queue.length > 0) {
        this._pump();
      } else {
        this._speaking = false;
        this.dispatchEvent(new CustomEvent('speak-end'));
        this._scheduleWakeRestart(500);
      }
    };

    this._currentUtterance = u;
    speechSynthesis.speak(u);
  }

  _pickVoice() {
    const voices = this.voices();
    if (this.voiceURI) {
      const chosen = voices.find((v) => v.voiceURI === this.voiceURI);
      if (chosen) return chosen;
    }
    const prefix = this.lang.slice(0, 2).toLowerCase();
    return (
      voices.find((v) => v.lang?.toLowerCase().startsWith(this.lang.toLowerCase())) ||
      voices.find((v) => v.lang?.toLowerCase().startsWith(prefix)) ||
      null
    );
  }

  cancelSpeech() {
    if (!this.synthSupported) return;
    this._queue = [];
    this._currentUtterance = null;
    speechSynthesis.cancel();
    if (this._speaking) {
      this._speaking = false;
      this.dispatchEvent(new CustomEvent('speak-end'));
    }
  }

  get speaking() {
    return this._speaking;
  }

  // ---------------- Feedback beep ----------------

  beep(freq = 880, durationMs = 120) {
    try {
      this._audioCtx = this._audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const ctx = this._audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + durationMs / 1000);
    } catch { /* audio feedback is optional */ }
  }
}
