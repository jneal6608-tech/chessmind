// Small synthesized board sounds (no audio files needed).
let ctx: AudioContext | null = null;
let enabled = true;
export function setSound(on: boolean) { enabled = on; }
function tone(freq: number, dur: number, gain: number, type: OscillatorType = 'triangle', delay = 0) {
  try {
    ctx ??= new AudioContext();
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + dur);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
  } catch { /* audio unavailable */ }
}
export function playSound(kind: 'move' | 'capture' | 'check' | 'end' | 'good' | 'bad') {
  if (!enabled) return;
  if (kind === 'move') tone(420, 0.07, 0.18);
  else if (kind === 'capture') { tone(300, 0.09, 0.25, 'square'); tone(180, 0.08, 0.12, 'triangle', 0.02); }
  else if (kind === 'check') { tone(660, 0.1, 0.18); tone(880, 0.12, 0.12, 'triangle', 0.08); }
  else if (kind === 'end') { tone(520, 0.2, 0.15); tone(390, 0.3, 0.15, 'triangle', 0.18); }
  else if (kind === 'good') { tone(660, 0.1, 0.14); tone(990, 0.16, 0.12, 'triangle', 0.09); }
  else if (kind === 'bad') tone(200, 0.22, 0.16, 'sawtooth');
}
