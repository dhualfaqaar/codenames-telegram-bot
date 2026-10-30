/**
 * Shared game sound engine (Web Audio, no audio files).
 *
 * Every effect is synthesised on the device: oscillators, filtered noise and
 * envelopes. Nothing is downloaded, so the mini apps stay offline friendly and
 * no third-party audio is bundled. The script is inlined into each mini app
 * because they are separate documents served by the bot.
 *
 * Usage inside a mini app:
 *   GameSfx.play('move');             // one shot
 *   GameSfx.buttonSounds('click');    // tap sound for every button
 *   GameSfx.music.start();            // light background loop
 *   GameSfx.mountToggle({ ... });     // speaker button, remembers the choice
 */
export const GAME_SFX_SCRIPT = String.raw`
(function(){
  if (window.GameSfx) return;
  var KEY_ON = 'cg-sfx-on';
  var KEY_MUSIC = 'cg-sfx-music';
  var stored = function(key, fallback){
    try { var value = localStorage.getItem(key); return value === null ? fallback : value; } catch (e) { return fallback; }
  };
  var save = function(key, value){ try { localStorage.setItem(key, value); } catch (e) {} };
  var state = {
    on: stored(KEY_ON, '1') !== '0',
    musicOn: stored(KEY_MUSIC, '1') !== '0',
    ctx: null,
    master: null,
    musicBus: null,
    noiseBuffer: null,
    musicTimer: 0,
    wantMusic: false,
    next: 0,
    step: 0,
    buttonMode: ''
  };
  var BAR = 2.857;
  var CHORDS = [
    [45, 57, 60, 64],
    [41, 53, 57, 60],
    [48, 55, 60, 64],
    [43, 55, 59, 62]
  ];
  var PENTA = [57, 60, 62, 64, 67, 69, 72];
  function hz(midi){ return 440 * Math.pow(2, (midi - 69) / 12); }
  function ensure(){
    if (state.ctx) {
      if (state.ctx.state === 'suspended') { try { state.ctx.resume(); } catch (e) {} }
      return state.ctx;
    }
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    try { state.ctx = new Ctx(); } catch (e) { return null; }
    state.master = state.ctx.createGain();
    state.master.gain.value = 0.6;
    state.master.connect(state.ctx.destination);
    state.musicBus = state.ctx.createGain();
    state.musicBus.gain.value = 0.34;
    state.musicBus.connect(state.master);
    return state.ctx;
  }
  function at(){ return state.ctx ? state.ctx.currentTime : 0; }
  function bus(name){ return name === 'music' ? state.musicBus : state.master; }
  function tone(o){
    var c = state.ctx;
    if (!c) return;
    var start = o.at == null ? c.currentTime : o.at;
    var dur = o.dur || 0.12;
    var gain = o.gain == null ? 0.1 : o.gain;
    var attack = o.attack == null ? 0.005 : o.attack;
    var node = c.createOscillator();
    var amp = c.createGain();
    node.type = o.type || 'sine';
    node.frequency.setValueAtTime(Math.max(20, o.from), start);
    if (o.to && o.to !== o.from) {
      node.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), start + dur);
    }
    if (o.detune) node.detune.value = o.detune;
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.linearRampToValueAtTime(gain, start + attack);
    amp.gain.exponentialRampToValueAtTime(0.0008, start + dur);
    var tail = amp;
    if (o.filter) {
      var filter = c.createBiquadFilter();
      filter.type = o.filter.type || 'lowpass';
      filter.frequency.setValueAtTime(o.filter.freq || 1600, start);
      if (o.filter.to) filter.frequency.exponentialRampToValueAtTime(o.filter.to, start + dur);
      if (o.filter.q) filter.Q.value = o.filter.q;
      amp.connect(filter);
      tail = filter;
    }
    node.connect(amp);
    tail.connect(bus(o.bus));
    node.start(start);
    node.stop(start + dur + 0.04);
  }
  function noiseBuffer(){
    var c = state.ctx;
    if (state.noiseBuffer) return state.noiseBuffer;
    var length = Math.floor(c.sampleRate * 0.7);
    var buffer = c.createBuffer(1, length, c.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    state.noiseBuffer = buffer;
    return buffer;
  }
  function noise(o){
    var c = state.ctx;
    if (!c) return;
    var start = o.at == null ? c.currentTime : o.at;
    var dur = o.dur || 0.06;
    var gain = o.gain == null ? 0.08 : o.gain;
    var source = c.createBufferSource();
    source.buffer = noiseBuffer();
    source.playbackRate.value = o.rate || 1;
    var filter = c.createBiquadFilter();
    filter.type = o.type || 'bandpass';
    filter.frequency.setValueAtTime(o.freq || 1200, start);
    if (o.to && o.to !== o.freq) filter.frequency.exponentialRampToValueAtTime(Math.max(60, o.to), start + dur);
    filter.Q.value = o.q == null ? 1 : o.q;
    var amp = c.createGain();
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.linearRampToValueAtTime(gain, start + (o.attack == null ? 0.004 : o.attack));
    amp.gain.exponentialRampToValueAtTime(0.0008, start + dur);
    source.connect(filter);
    filter.connect(amp);
    amp.connect(bus(o.bus));
    source.start(start);
    source.stop(start + dur + 0.03);
  }
  function arp(t, notes, gap, gain, type, busName){
    for (var i = 0; i < notes.length; i += 1) {
      tone({ at: t + i * gap, type: type || 'triangle', from: hz(notes[i]), dur: gap * 1.9, gain: gain == null ? 0.08 : gain, bus: busName });
    }
  }
  var voices = {
    tap: function(){
      var t = at();
      tone({ at: t, type: 'triangle', from: 720, to: 520, dur: 0.05, gain: 0.035, filter: { type: 'lowpass', freq: 2600 } });
    },
    click: function(){
      var t = at();
      noise({ at: t, dur: 0.016, gain: 0.05, type: 'highpass', freq: 2600 });
      tone({ at: t, type: 'square', from: 860, to: 560, dur: 0.045, gain: 0.04 });
    },
    move: function(){
      var t = at();
      noise({ at: t, dur: 0.035, gain: 0.16, type: 'bandpass', freq: 1900, q: 0.9 });
      tone({ at: t, type: 'triangle', from: 260, to: 130, dur: 0.085, gain: 0.16 });
      tone({ at: t + 0.004, type: 'sine', from: 96, to: 62, dur: 0.09, gain: 0.09 });
    },
    capture: function(){
      var t = at();
      noise({ at: t, dur: 0.055, gain: 0.2, type: 'bandpass', freq: 1250, q: 0.7 });
      tone({ at: t, type: 'triangle', from: 190, to: 84, dur: 0.15, gain: 0.19 });
      noise({ at: t + 0.055, dur: 0.05, gain: 0.13, type: 'bandpass', freq: 900, q: 0.8 });
      tone({ at: t + 0.055, type: 'sine', from: 130, to: 58, dur: 0.16, gain: 0.14 });
    },
    castle: function(){
      var t = at();
      noise({ at: t, dur: 0.03, gain: 0.14, type: 'bandpass', freq: 1900, q: 0.9 });
      tone({ at: t, type: 'triangle', from: 250, to: 128, dur: 0.08, gain: 0.14 });
      noise({ at: t + 0.11, dur: 0.03, gain: 0.12, type: 'bandpass', freq: 1500, q: 0.9 });
      tone({ at: t + 0.11, type: 'triangle', from: 210, to: 110, dur: 0.1, gain: 0.12 });
    },
    check: function(){
      var t = at();
      tone({ at: t, type: 'square', from: 1180, to: 1180, dur: 0.07, gain: 0.05, filter: { type: 'lowpass', freq: 3200 } });
      tone({ at: t + 0.1, type: 'square', from: 1560, to: 1560, dur: 0.09, gain: 0.05, filter: { type: 'lowpass', freq: 3600 } });
    },
    promote: function(){
      arp(at(), [76, 79, 83, 88], 0.075, 0.075, 'triangle');
    },
    illegal: function(){
      var t = at();
      tone({ at: t, type: 'sawtooth', from: 190, to: 132, dur: 0.16, gain: 0.06, filter: { type: 'lowpass', freq: 900 } });
      tone({ at: t, type: 'square', from: 96, to: 88, dur: 0.18, gain: 0.05, filter: { type: 'lowpass', freq: 520 } });
    },
    good: function(){
      var t = at();
      tone({ at: t, type: 'sine', from: 1180, to: 1180, dur: 0.16, gain: 0.1 });
      tone({ at: t + 0.02, type: 'sine', from: 1770, to: 1760, dur: 0.2, gain: 0.05 });
      tone({ at: t + 0.005, type: 'triangle', from: 590, to: 590, dur: 0.12, gain: 0.04 });
    },
    bad: function(){
      var t = at();
      tone({ at: t, type: 'sawtooth', from: 260, to: 148, dur: 0.2, gain: 0.085, filter: { type: 'lowpass', freq: 1100 } });
      tone({ at: t + 0.12, type: 'square', from: 150, to: 118, dur: 0.16, gain: 0.05, filter: { type: 'lowpass', freq: 780 } });
      noise({ at: t, dur: 0.12, gain: 0.05, type: 'bandpass', freq: 320, q: 0.6 });
    },
    erase: function(){
      var t = at();
      noise({ at: t, dur: 0.09, gain: 0.06, type: 'bandpass', freq: 2400, to: 900, q: 0.8 });
    },
    hint: function(){
      var t = at();
      arp(t, [88, 91, 95], 0.055, 0.045, 'sine');
      tone({ at: t, type: 'sine', from: 2093, to: 2093, dur: 0.28, gain: 0.02 });
    },
    solved: function(){
      arp(at(), [72, 76, 79, 84, 88], 0.1, 0.085, 'triangle');
      tone({ at: at() + 0.4, type: 'sine', from: hz(96), dur: 0.5, gain: 0.05 });
    },
    win: function(){
      arp(at(), [67, 72, 76, 79], 0.13, 0.09, 'triangle');
      tone({ at: at() + 0.5, type: 'sine', from: hz(84), dur: 0.7, gain: 0.06 });
    },
    lose: function(){
      var t = at();
      arp(t, [67, 63, 60, 55], 0.15, 0.08, 'sine');
      tone({ at: t + 0.6, type: 'triangle', from: hz(43), dur: 0.8, gain: 0.06 });
    },
    kill: function(){
      var t = at();
      noise({ at: t, dur: 0.28, gain: 0.24, type: 'bandpass', freq: 3200, to: 420, q: 0.8 });
      tone({ at: t, type: 'sawtooth', from: 920, to: 190, dur: 0.26, gain: 0.1, filter: { type: 'lowpass', freq: 2100 } });
      tone({ at: t + 0.02, type: 'sine', from: 120, to: 44, dur: 0.34, gain: 0.22 });
      noise({ at: t + 0.01, dur: 0.1, gain: 0.1, type: 'highpass', freq: 4800 });
    },
    vent: function(){
      var t = at();
      noise({ at: t, dur: 0.34, gain: 0.14, type: 'bandpass', freq: 300, to: 1800, q: 0.7 });
      tone({ at: t, type: 'sine', from: 180, to: 520, dur: 0.3, gain: 0.04 });
      noise({ at: t + 0.3, dur: 0.16, gain: 0.08, type: 'bandpass', freq: 1400, to: 420, q: 0.9 });
    },
    task: function(){
      var t = at();
      tone({ at: t, type: 'sine', from: hz(88), dur: 0.14, gain: 0.1 });
      tone({ at: t + 0.09, type: 'sine', from: hz(93), dur: 0.22, gain: 0.09 });
    },
    report: function(){
      var t = at();
      arp(t, [60, 67, 72], 0.09, 0.1, 'square');
      tone({ at: t + 0.3, type: 'triangle', from: 190, to: 100, dur: 0.3, gain: 0.08 });
    },
    alarm: function(){
      var t = at();
      for (var i = 0; i < 3; i += 1) {
        tone({ at: t + i * 0.34, type: 'sawtooth', from: 660, to: 520, dur: 0.17, gain: 0.09, filter: { type: 'lowpass', freq: 1600 } });
        tone({ at: t + i * 0.34 + 0.17, type: 'sawtooth', from: 520, to: 660, dur: 0.17, gain: 0.08, filter: { type: 'lowpass', freq: 1600 } });
      }
    },
    sabotage: function(){
      var t = at();
      tone({ at: t, type: 'sawtooth', from: 150, to: 220, dur: 0.5, gain: 0.09, filter: { type: 'lowpass', freq: 700 } });
      tone({ at: t + 0.55, type: 'sawtooth', from: 220, to: 150, dur: 0.5, gain: 0.08, filter: { type: 'lowpass', freq: 700 } });
      noise({ at: t, dur: 0.9, gain: 0.04, type: 'lowpass', freq: 460 });
    },
    eject: function(){
      var t = at();
      noise({ at: t, dur: 0.55, gain: 0.16, type: 'bandpass', freq: 260, to: 2200, q: 0.7 });
      tone({ at: t + 0.35, type: 'sine', from: 260, to: 60, dur: 0.6, gain: 0.12 });
    },
    death: function(){
      var t = at();
      tone({ at: t, type: 'sine', from: 420, to: 70, dur: 0.45, gain: 0.13, filter: { type: 'lowpass', freq: 1400 } });
      tone({ at: t + 0.06, type: 'triangle', from: 210, to: 52, dur: 0.5, gain: 0.07 });
      noise({ at: t, dur: 0.3, gain: 0.05, type: 'lowpass', freq: 800, to: 200 });
    },
    vote: function(){
      var t = at();
      tone({ at: t, type: 'triangle', from: 900, to: 700, dur: 0.06, gain: 0.06 });
      tone({ at: t + 0.07, type: 'triangle', from: 700, to: 520, dur: 0.08, gain: 0.05 });
    },
    step: function(){
      noise({ dur: 0.05, gain: 0.03, type: 'bandpass', freq: 700, q: 1.4, rate: 0.8 });
    },
    padNote: function(t, midi, dur, gain){
      tone({ at: t, type: 'triangle', from: hz(midi), dur: dur, gain: gain, attack: 0.9, bus: 'music' });
      tone({ at: t + 0.012, type: 'sine', from: hz(midi) * 1.004, dur: dur, gain: gain * 0.7, attack: 0.9, bus: 'music' });
    },
    playBar: function(t, index){
      var chord = CHORDS[index % CHORDS.length];
      for (var i = 1; i < chord.length; i += 1) voices.padNote(t, chord[i], 2.9, 0.03);
      voices.padNote(t, chord[i % chord.length] + 12, 2.6, 0.012);
      tone({ at: t, type: 'sine', from: hz(chord[0]) / 2, dur: 0.8, gain: 0.09, attack: 0.03, filter: { type: 'lowpass', freq: 620 }, bus: 'music' });
      tone({ at: t + 1.43, type: 'sine', from: hz(chord[0]) / 2, dur: 0.7, gain: 0.06, attack: 0.03, filter: { type: 'lowpass', freq: 560 }, bus: 'music' });
      noise({ at: t + 0.71, dur: 0.07, gain: 0.014, type: 'bandpass', freq: 3200, q: 0.9, bus: 'music' });
      noise({ at: t + 2.14, dur: 0.07, gain: 0.011, type: 'bandpass', freq: 2800, q: 0.9, bus: 'music' });
      tone({ at: t + 1.07, type: 'sine', from: hz(PENTA[(index * 3 + 1) % PENTA.length] + 12), dur: 0.5, gain: 0.03, attack: 0.02, bus: 'music' });
      tone({ at: t + 1.28, type: 'sine', from: hz(PENTA[(index * 3 + 1) % PENTA.length] + 12), dur: 0.4, gain: 0.012, attack: 0.02, bus: 'music' });
      tone({ at: t + 2.5, type: 'sine', from: hz(PENTA[(index * 2 + 4) % PENTA.length] + 12), dur: 0.6, gain: 0.022, attack: 0.03, bus: 'music' });
    }
  };
  function play(name){
    if (!state.on || !name) return false;
    var voice = voices[name];
    if (!voice) return false;
    if (!ensure()) return false;
    try { voice(); return true; } catch (e) { return false; }
  }
  function startMusic(){
    state.wantMusic = true;
    if (!state.on || !state.musicOn) return;
    if (!ensure()) return;
    if (state.musicTimer) return;
    state.next = state.ctx.currentTime + 0.2;
    state.step = 0;
    state.musicTimer = setInterval(function(){
      if (!state.ctx || document.hidden || !state.on || !state.musicOn || !state.wantMusic) return;
      var now = state.ctx.currentTime;
      if (state.next < now) state.next = now + 0.05;
      var guard = 0;
      while (state.next < now + 1 && guard < 6) {
        voices.playBar(state.next, state.step);
        state.next += BAR;
        state.step = (state.step + 1) % CHORDS.length;
        guard += 1;
      }
    }, 250);
  }
  function stopMusic(){
    state.wantMusic = false;
    if (state.musicTimer) {
      clearInterval(state.musicTimer);
      state.musicTimer = 0;
    }
  }
  function refresh(){
    if (!state.on) stopMusicTimerOnly();
    else if (state.wantMusic) startMusic();
  }
  function stopMusicTimerOnly(){
    if (state.musicTimer) {
      clearInterval(state.musicTimer);
      state.musicTimer = 0;
    }
  }
  var TOGGLE_STYLE = 'display:grid;place-items:center;width:42px;height:42px;padding:0;border-radius:50%;border:1px solid rgba(255,255,255,.22);background:rgba(7,20,38,.72);color:#e8f4ff;backdrop-filter:blur(8px);box-shadow:0 6px 18px rgba(2,10,26,.45);cursor:pointer;z-index:60;transition:transform .12s,border-color .12s';
  function icon(on, size){
    var pixels = Math.round((size || 42) * 0.5);
    if (on) {
      return '<svg viewBox="0 0 24 24" width="' + pixels + '" height="' + pixels + '" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.2L12 5.6v12.8L7.2 14.5H4z"/><path d="M15.4 8.6c1.5 1 2.4 2.2 2.4 3.4s-.9 2.4-2.4 3.4"/><path d="M18.3 5.9c2.4 1.7 3.7 3.9 3.7 6.1s-1.3 4.4-3.7 6.1"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" width="' + pixels + '" height="' + pixels + '" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.2L12 5.6v12.8L7.2 14.5H4z"/><path d="M15.6 9.4l5 5.2"/><path d="M20.6 9.4l-5 5.2"/></svg>';
  }
  function paint(button){
    var on = state.on;
    button.innerHTML = icon(on, button.getAttribute('data-size') ? Number(button.getAttribute('data-size')) : 42);
    button.setAttribute('aria-pressed', on ? 'false' : 'true');
    button.setAttribute('aria-label', on ? 'الأصوات شغّالة — اضغط لتسكتها' : 'الأصوات مسكّتة — اضغط لتشغّلها');
    button.style.color = on ? '#e8f4ff' : '#8fa4bb';
  }
  function mountToggle(options){
    var opts = options || {};
    var button = document.createElement('button');
    var size = Number(opts.size) || 42;
    button.type = 'button';
    button.className = 'cg-sfx-btn';
    button.setAttribute('data-size', String(size));
    button.setAttribute('style', TOGGLE_STYLE.replace('width:42px;height:42px', 'width:' + size + 'px;height:' + size + 'px') + ';position:' + (opts.inline ? 'static' : 'fixed') + ';' + (opts.top ? 'top:' + opts.top + ';' : '') + (opts.bottom ? 'bottom:' + opts.bottom + ';' : '') + (opts.left ? 'left:' + opts.left + ';' : '') + (opts.inline ? '' : 'right:' + (opts.right || '12px') + ';') + (opts.inline ? 'flex:none;' : ''));
    paint(button);
    button.addEventListener('click', function(event){
      event.preventDefault();
      event.stopPropagation();
      var next = !state.on;
      setEnabled(next);
      paint(button);
      if (next) window.GameSfx.play(opts.sound || 'click');
    });
    var host = (opts.container && document.querySelector(opts.container)) || document.body;
    host.appendChild(button);
    return button;
  }
  function setEnabled(value){
    state.on = Boolean(value);
    save(KEY_ON, state.on ? '1' : '0');
    if (!state.on) stopMusicTimerOnly();
    else if (state.wantMusic) startMusic();
    try { document.dispatchEvent(new CustomEvent('gametone-change', { detail: { on: state.on } })); } catch (e) {}
    return state.on;
  }
  function setMusicEnabled(value){
    state.musicOn = Boolean(value);
    save(KEY_MUSIC, state.musicOn ? '1' : '0');
    if (state.musicOn && state.wantMusic && state.on) startMusic();
    else stopMusicTimerOnly();
    return state.musicOn;
  }
  function buttonSounds(mode){
    state.buttonMode = mode || '';
    if (!state.buttonMode || state.buttonBound) return;
    state.buttonBound = true;
    document.addEventListener('click', function(event){
      if (!state.on || !state.buttonMode) return;
      var target = event.target;
      if (!target || !target.closest) return;
      var node = target.closest('button, .sp-card, [data-sfx]');
      if (!node || node.disabled || node.classList.contains('cg-sfx-btn')) return;
      var clip = node.getAttribute('data-sfx') || state.buttonMode;
      window.GameSfx.play(clip);
    }, true);
  }
  function unlock(){
    ensure();
    if (state.wantMusic && state.on && state.musicOn) startMusic();
  }
  ['pointerdown', 'touchstart', 'keydown'].forEach(function(name){
    document.addEventListener(name, unlock, { passive: true });
  });
  document.addEventListener('visibilitychange', function(){
    if (document.hidden) stopMusicTimerOnly();
    else if (state.wantMusic && state.on && state.musicOn) startMusic();
  });
  window.GameSfx = {
    play: play,
    stop: stopMusic,
    music: {
      start: startMusic,
      stop: stopMusic,
      enabled: function(){ return state.musicOn; },
      setEnabled: setMusicEnabled
    },
    musicEnabled: function(){ return state.musicOn; },
    setMusicEnabled: setMusicEnabled,
    enabled: function(){ return state.on; },
    setEnabled: setEnabled,
    mountToggle: mountToggle,
    buttonSounds: buttonSounds,
    unlock: unlock,
    names: function(){ return Object.keys(voices).filter(function(name){ return ['padNote', 'playBar'].indexOf(name) === -1; }); }
  };
})();
`;

/** Voices that exist in GAME_SFX_SCRIPT — used by the checks and the apps. */
export const GAME_SFX_VOICES = [
  'tap', 'click', 'move', 'capture', 'castle', 'check', 'promote', 'illegal',
  'good', 'bad', 'erase', 'hint', 'solved', 'win', 'lose',
  'kill', 'vent', 'task', 'report', 'alarm', 'sabotage', 'eject', 'death', 'vote', 'step'
] as const;

export type GameSfxVoice = (typeof GAME_SFX_VOICES)[number];
