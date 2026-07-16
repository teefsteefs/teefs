import { VoiceIO } from '/voice.js';

/* ================= State & settings ================= */

const els = {
  reactor: document.getElementById('reactor'),
  activity: document.getElementById('activity'),
  caption: document.getElementById('caption'),
  chat: document.getElementById('chat'),
  composer: document.getElementById('composer'),
  input: document.getElementById('input'),
  micBtn: document.getElementById('micBtn'),
  banner: document.getElementById('banner'),
  modePill: document.getElementById('modePill'),
  settingsBtn: document.getElementById('settingsBtn'),
  settings: document.getElementById('settings'),
  setLang: document.getElementById('setLang'),
  setWake: document.getElementById('setWake'),
  setWakeWord: document.getElementById('setWakeWord'),
  setSpeak: document.getElementById('setSpeak'),
  setVoice: document.getElementById('setVoice'),
  setRate: document.getElementById('setRate'),
  rateOut: document.getElementById('rateOut'),
  serverInfo: document.getElementById('serverInfo'),
};

const DEFAULT_SETTINGS = {
  lang: 'vi-VN',
  wakeEnabled: false,
  wakeWord: 'jarvis',
  speakEnabled: true,
  voiceURI: '',
  rate: 1,
};

const settings = { ...DEFAULT_SETTINGS, ...load('jarvis.settings') };
const sessionId = load('jarvis.session') || (save('jarvis.session', crypto.randomUUID()), load('jarvis.session'));

function load(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  return value;
}

const voice = new VoiceIO();
voice.configure({ lang: settings.lang, rate: settings.rate, voiceURI: settings.voiceURI, wakeWord: settings.wakeWord });

let busy = false;

/* ================= Reactor & activity ================= */

const STATES = ['idle', 'listening', 'thinking', 'speaking', 'error'];
function setReactor(state) {
  for (const s of STATES) els.reactor.classList.toggle(`state-${s}`, s === state);
}

function setActivity(text, active = false) {
  els.activity.textContent = text || ' ';
  els.activity.classList.toggle('active', active);
}

const STAGE_TEXT = {
  routing: () => 'đang xử lý…',
  thinking: () => 'đang suy nghĩ…',
  search: (d) => `🔎 đang tìm: ${d}`,
  read: (d) => `📄 đang đọc ${d}`,
  weather: (d) => `⛅ thời tiết: ${d}`,
  fallback: () => 'chuyển sang tìm kiếm trực tiếp…',
};

/* ================= Chat rendering ================= */

function addMessage(role, text = '') {
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  const span = document.createElement('span');
  span.className = 'text';
  span.textContent = text;
  div.appendChild(span);
  els.chat.appendChild(div);
  els.chat.scrollTop = els.chat.scrollHeight;
  return div;
}

function setBubbleText(bubble, text) {
  bubble.querySelector('.text').textContent = text;
}

function renderSources(bubble, sources) {
  if (!sources?.length) return;
  let wrap = bubble.querySelector('.sources');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'sources';
    bubble.appendChild(wrap);
  }
  wrap.innerHTML = '';
  for (const s of sources.slice(0, 5)) {
    const a = document.createElement('a');
    a.href = s.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = s.title || new URL(s.url).hostname;
    a.title = s.url;
    wrap.appendChild(a);
  }
}

function renderMeta(bubble, mode) {
  const label = { agent: 'jarvis · claude', direct: 'tìm kiếm trực tiếp', local: 'xử lý cục bộ' }[mode];
  if (!label) return;
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = label;
  bubble.appendChild(meta);
}

/* ================= TTS sentence streaming ================= */

function detectLang(text) {
  return /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(text) ? 'vi-VN' : settings.lang;
}

class SentenceStreamer {
  constructor(lang) {
    this.buffer = '';
    this.lang = lang;
  }
  push(text) {
    if (!settings.speakEnabled) return;
    this.buffer += text;
    // Flush complete sentences to the TTS queue.
    let m;
    while ((m = this.buffer.match(/[\s\S]*?[.!?…](?=\s|$)|[\s\S]*?\n/))) {
      const sentence = m[0];
      this.buffer = this.buffer.slice(sentence.length);
      this._speak(sentence);
    }
  }
  flush() {
    if (this.buffer.trim()) this._speak(this.buffer);
    this.buffer = '';
  }
  _speak(text) {
    voice.configure({ lang: this.lang });
    voice.speak(text);
  }
}

/* ================= SSE chat call ================= */

async function send(message) {
  const text = message.trim();
  if (!text || busy) return;
  busy = true;
  els.input.value = '';
  els.caption.textContent = '';
  voice.cancelSpeech();

  addMessage('user', text);
  const bubble = addMessage('assistant', '');
  bubble.classList.add('streaming');
  setReactor('thinking');
  setActivity(STAGE_TEXT.routing(), true);

  const tts = new SentenceStreamer(detectLang(text));
  let answerText = '';
  let gotError = false;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        message: text,
        context: {
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          locale: navigator.language,
        },
      }),
    });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

    for await (const { event, data } of readSse(res.body)) {
      if (event === 'status') {
        const fn = STAGE_TEXT[data.stage];
        setActivity(fn ? fn(data.detail || '') : data.stage, true);
      } else if (event === 'delta') {
        answerText += data.text;
        setBubbleText(bubble, answerText);
        els.chat.scrollTop = els.chat.scrollHeight;
        tts.push(data.text);
      } else if (event === 'sources') {
        renderSources(bubble, data);
      } else if (event === 'done') {
        renderSources(bubble, data.sources);
        renderMeta(bubble, data.mode);
        if (!answerText && data.answer) {
          setBubbleText(bubble, data.answer);
          tts.push(data.answer);
        }
      } else if (event === 'error') {
        gotError = true;
        setBubbleText(bubble, data.message || 'Có lỗi xảy ra.');
        tts.push(data.message || 'Có lỗi xảy ra.');
      }
    }
  } catch (err) {
    gotError = true;
    setBubbleText(bubble, 'Không kết nối được máy chủ JARVIS. Kiểm tra server rồi thử lại nhé.');
    console.error(err);
  }

  bubble.classList.remove('streaming');
  tts.flush();
  setActivity('');
  setReactor(gotError ? 'error' : voice.speaking ? 'speaking' : 'idle');
  if (gotError) setTimeout(() => setReactor('idle'), 1600);
  busy = false;
}

/** Parse text/event-stream frames from a fetch body. */
async function* readSse(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      let event = 'message';
      let data = '';
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (!data) continue;
      try {
        yield { event, data: JSON.parse(data) };
      } catch { /* skip malformed frame */ }
    }
  }
}

/* ================= Voice wiring ================= */

async function captureAndSend() {
  if (busy || voice.capturing || !voice.supported) return;
  voice.beep(990, 110);
  setReactor('listening');
  setActivity('đang nghe…', true);
  els.micBtn.classList.add('live');
  try {
    const transcript = await voice.captureCommand();
    els.caption.textContent = '';
    if (transcript) {
      send(transcript);
    } else {
      setActivity('');
      setReactor('idle');
    }
  } finally {
    els.micBtn.classList.remove('live');
    if (!busy) setActivity('');
  }
}

voice.addEventListener('wake', () => captureAndSend());
voice.addEventListener('interim', (e) => {
  els.caption.textContent = `“${e.detail}”`;
});
voice.addEventListener('speak-start', () => setReactor('speaking'));
voice.addEventListener('speak-end', () => { if (!busy) setReactor('idle'); });
voice.addEventListener('mic-denied', () => {
  settings.wakeEnabled = false;
  els.setWake.checked = false;
  save('jarvis.settings', settings);
  showBanner('Trình duyệt đang chặn micro. Hãy cấp quyền micro cho trang này (biểu tượng 🔒 cạnh thanh địa chỉ).');
});

els.micBtn.addEventListener('click', () => {
  if (voice.capturing) voice.stopCapture();
  else captureAndSend();
});

// Push-to-talk: hold Space (outside the text input).
let spaceHeld = false;
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !spaceHeld && document.activeElement !== els.input) {
    e.preventDefault();
    spaceHeld = true;
    captureAndSend();
  }
  if (e.code === 'Escape') {
    voice.cancelSpeech();
    voice.stopCapture();
    setReactor('idle');
  }
});
document.addEventListener('keyup', (e) => {
  if (e.code === 'Space' && spaceHeld) {
    spaceHeld = false;
    voice.stopCapture();
  }
});

els.reactor.addEventListener('click', () => {
  if (voice.speaking) voice.cancelSpeech();
  else if (voice.capturing) voice.stopCapture();
  else captureAndSend();
});

/* ================= Composer ================= */

els.composer.addEventListener('submit', (e) => {
  e.preventDefault();
  send(els.input.value);
});

/* ================= Banner ================= */

let bannerTimer;
function showBanner(text, ms = 8000) {
  els.banner.textContent = text;
  els.banner.classList.remove('hidden');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => els.banner.classList.add('hidden'), ms);
}

/* ================= Settings ================= */

function fillVoices() {
  const voices = voice.voices();
  const current = settings.voiceURI;
  els.setVoice.innerHTML = '<option value="">Tự động theo ngôn ngữ</option>';
  for (const v of voices) {
    const opt = document.createElement('option');
    opt.value = v.voiceURI;
    opt.textContent = `${v.name} (${v.lang})`;
    if (v.voiceURI === current) opt.selected = true;
    els.setVoice.appendChild(opt);
  }
}

function applySettingsToForm() {
  els.setLang.value = settings.lang;
  els.setWake.checked = settings.wakeEnabled;
  els.setWakeWord.value = settings.wakeWord;
  els.setSpeak.checked = settings.speakEnabled;
  els.setRate.value = settings.rate;
  els.rateOut.textContent = Number(settings.rate).toFixed(1);
  fillVoices();
}

function persistSettings() {
  settings.lang = els.setLang.value;
  settings.wakeEnabled = els.setWake.checked;
  settings.wakeWord = els.setWakeWord.value.trim().toLowerCase() || 'jarvis';
  settings.speakEnabled = els.setSpeak.checked;
  settings.voiceURI = els.setVoice.value;
  settings.rate = Number(els.setRate.value);
  save('jarvis.settings', settings);

  voice.configure({ lang: settings.lang, rate: settings.rate, voiceURI: settings.voiceURI, wakeWord: settings.wakeWord });
  if (settings.wakeEnabled && voice.supported) voice.startWake();
  else voice.stopWake();
}

els.settingsBtn.addEventListener('click', () => {
  applySettingsToForm();
  els.settings.showModal();
});
els.settings.addEventListener('close', persistSettings);
els.setRate.addEventListener('input', () => (els.rateOut.textContent = Number(els.setRate.value).toFixed(1)));
voice.addEventListener('voices', fillVoices);

/* ================= Boot ================= */

async function boot() {
  if (!voice.supported) {
    els.micBtn.classList.add('disabled');
    els.micBtn.title = 'Trình duyệt không hỗ trợ nhận giọng nói (dùng Chrome/Edge)';
    showBanner('Trình duyệt này không hỗ trợ nhận giọng nói — bạn vẫn gõ được. Để dùng giọng nói hãy mở bằng Chrome hoặc Edge.', 12000);
  } else if (!window.isSecureContext) {
    showBanner('Micro chỉ hoạt động trên HTTPS hoặc localhost.', 12000);
  }

  try {
    const health = await (await fetch('/api/health')).json();
    const agent = health.llm?.enabled;
    const backend = health.llm?.provider ? `${health.llm.provider} · ${health.llm.model}` : health.llm?.model;
    els.modePill.textContent = agent ? `agent · ${backend}` : 'chế độ tìm kiếm trực tiếp';
    els.modePill.classList.add(agent ? 'agent' : 'direct');
    els.modePill.title = agent
      ? 'AI quyết định khi nào cần tìm web'
      : `Không có LLM — tự tìm web qua: ${health.search.providers.join(', ')}`;
    els.serverInfo.textContent = agent
      ? `agent mode · ${backend} · search: ${health.search.providers.join(', ')} · nhớ ${health.memory?.facts ?? 0} điều`
      : `direct mode · search: ${health.search.providers.join(', ')}${health.llm.reason ? ` · lý do: ${health.llm.reason}` : ''}`;
  } catch {
    els.modePill.textContent = 'mất kết nối máy chủ';
    setReactor('error');
  }

  if (settings.wakeEnabled && voice.supported && window.isSecureContext) {
    voice.startWake();
  }

  const greeted = sessionStorage.getItem('jarvis.greeted');
  if (!greeted) {
    sessionStorage.setItem('jarvis.greeted', '1');
    addMessage(
      'assistant',
      'Xin chào, tôi là JARVIS. Hỏi tôi bất cứ điều gì — nếu câu hỏi cần thông tin mới, tôi sẽ tự tìm trên web. Bật "luôn lắng nghe" trong Cài đặt ⚙ để gọi tôi bằng từ khóa "Jarvis".',
    );
  }
}

boot();
