// Harbor Lights — all sound is synthesized locally with WebAudio: no audio
// files, no network. The context starts on the first user gesture; every
// call before that is a silent no-op, so headless runs never crash.
// Music: a slow procedural synthwave loop (bass + pad + hats) on a timer.
let ctx = null;
let master = null;
let muted = false;
let musicTimer = null;
let musicStep = 0;

function ensure() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext ?? window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.4;
    master.connect(ctx.destination);
  } catch { return null; }
  return ctx;
}

export function unlockAudio() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}
export function setMuted(v) { muted = v; if (master) master.gain.value = v ? 0 : 0.4; }
export function isMuted() { return muted; }

function tone(freq, dur, type, vol, slideTo) {
  if (muted) return;
  const c = ensure();
  if (!c || !master) return;
  try {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), c.currentTime + dur);
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g); g.connect(master);
    o.start(); o.stop(c.currentTime + dur + 0.02);
  } catch { /* a failed blip never stops the game */ }
}

function noiseBurst(dur, vol, freq) {
  if (muted) return;
  const c = ensure();
  if (!c || !master) return;
  try {
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = c.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master); src.start();
  } catch { /* ignore */ }
}

export const sfx = {
  shoot() { tone(880, 0.09, 'square', 0.16, 180); noiseBurst(0.06, 0.12, 3000); },
  enemyShoot() { tone(420, 0.08, 'square', 0.08, 140); },
  hit() { noiseBurst(0.12, 0.2, 900); },
  crash() { noiseBurst(0.25, 0.3, 500); tone(90, 0.2, 'sine', 0.25, 40); },
  explosion() { noiseBurst(0.6, 0.4, 350); tone(60, 0.5, 'sine', 0.35, 28); },
  pickup() { tone(660, 0.1, 'sine', 0.18); tone(990, 0.14, 'sine', 0.18); },
  cash() { tone(880, 0.08, 'triangle', 0.2); tone(1320, 0.16, 'triangle', 0.2); },
  siren() { tone(700, 0.35, 'sine', 0.07, 1100); },
  steal() { tone(300, 0.12, 'square', 0.14, 600); },
  mission() { tone(523, 0.12, 'triangle', 0.2); tone(659, 0.12, 'triangle', 0.2); tone(784, 0.22, 'triangle', 0.2); },
  fail() { tone(220, 0.3, 'sawtooth', 0.15, 110); },
  busted() { tone(196, 0.4, 'sawtooth', 0.18, 98); },
  engine() { tone(70, 0.1, 'sawtooth', 0.05, 90); },
};

// Am — F — C — G bass line with a soft pad and a ticking hat.
const BASS = [55, 43.65, 65.41, 49];
const PAD = [[220, 261.6, 329.6], [174.6, 220, 261.6], [261.6, 329.6, 392], [196, 246.9, 293.7]];
export function startMusic() {
  if (musicTimer || !ensure()) return;
  musicTimer = setInterval(() => {
    if (muted || !ctx) return;
    const bar = Math.floor(musicStep / 8) % 4;
    const beat = musicStep % 8;
    if (beat === 0 || beat === 4) tone(BASS[bar], 0.5, 'triangle', 0.16);
    if (beat === 0) for (const f of PAD[bar]) tone(f, 1.8, 'sine', 0.035);
    if (beat % 2 === 1) noiseBurst(0.03, 0.04, 6000);
    musicStep += 1;
  }, 240);
}
export function stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } }
