// Sons synthétisés avec Web Audio (aucun fichier, fonctionne hors ligne).
let ctx: AudioContext | null = null;
let enabled = true;
export function setSoundEnabled(v: boolean) { enabled = v; }
function ac() {
  if (!ctx) { const C = (window as any).AudioContext || (window as any).webkitAudioContext; if (!C) return null; ctx = new C(); }
  if (ctx!.state === 'suspended') ctx!.resume()?.catch?.(() => {});
  return ctx;
}
export function unlockAudio() { const c = ac(); if (!c) return; const b = c.createBuffer(1, 1, 22050); const s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); }
function knock(c: AudioContext, t: number, freq: number, gain: number, dur = 0.07) {
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.2;
  const g = c.createGain(); g.gain.value = gain;
  src.connect(f); f.connect(g); g.connect(c.destination); src.start(t);
}
function tone(c: AudioContext, t: number, freq: number, dur: number, gain = 0.12, type: OscillatorType = 'sine') {
  const o = c.createOscillator(); const g = c.createGain(); o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
}
export type SoundName = 'move' | 'capture' | 'check' | 'castle' | 'success' | 'error' | 'win' | 'lose' | 'notify' | 'tick' | 'promote';
const HAPTIC: Partial<Record<SoundName, number | number[]>> = { error: 35, success: [10, 50, 14], win: [16, 60, 16, 60, 24], lose: 60 };
export function play(name: SoundName) {
  const h = HAPTIC[name]; if (h) haptic(h);
  if (!enabled) return; const c = ac(); if (!c) return; const t = c.currentTime + 0.005;
  switch (name) {
    case 'move': knock(c, t, 1800, 0.9); break;
    case 'capture': knock(c, t, 1200, 1.2, 0.09); knock(c, t + 0.05, 2200, 0.6); break;
    case 'castle': knock(c, t, 1700, 0.8); knock(c, t + 0.09, 1900, 0.8); break;
    case 'check': knock(c, t, 1500, 0.9); tone(c, t, 880, 0.15, 0.06, 'triangle'); break;
    case 'promote': knock(c, t, 1800, 0.8); tone(c, t + 0.03, 1046, 0.2, 0.06); break;
    case 'success': [523, 659, 784].forEach((f, i) => tone(c, t + i * 0.07, f, 0.22, 0.09)); break;
    case 'error': tone(c, t, 196, 0.25, 0.08, 'square'); break;
    case 'win': [523, 659, 784, 1046].forEach((f, i) => tone(c, t + i * 0.1, f, 0.35, 0.1)); break;
    case 'lose': [392, 330, 262].forEach((f, i) => tone(c, t + i * 0.14, f, 0.35, 0.08, 'triangle')); break;
    case 'notify': tone(c, t, 988, 0.12, 0.07); tone(c, t + 0.1, 1318, 0.18, 0.07); break;
    case 'tick': tone(c, t, 1400, 0.04, 0.04); break;
  }
}
export function playForMove(m: { san: string; captured?: string; flags?: string }) {
  if (m.san.includes('#') || m.san.includes('+')) play('check');
  else if (m.san.startsWith('O-O')) play('castle');
  else if (m.san.includes('=')) play('promote');
  else if (m.captured) play('capture');
  else play('move');
}
export function haptic(ms: number | number[] = 10) { try { navigator.vibrate?.(ms); } catch {} }
