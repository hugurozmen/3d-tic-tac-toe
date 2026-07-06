import { Player } from './rules';

let context: AudioContext | null = null;
let muted = false;

const ensureContext = () => {
  if (typeof AudioContext === 'undefined') {
    return null;
  }

  if (!context) {
    context = new AudioContext();
  }

  if (context.state === 'suspended') {
    void context.resume();
  }

  return context;
};

// audio can only start from a user gesture; unlock on the first one anywhere
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', () => ensureContext(), { once: true });
}

type ToneOptions = {
  delay?: number;
  gain?: number;
  type?: OscillatorType;
};

const tone = (frequency: number, duration: number, options: ToneOptions = {}) => {
  if (muted) {
    return;
  }

  const ctx = ensureContext();

  if (!ctx || ctx.state !== 'running') {
    return;
  }

  const start = ctx.currentTime + (options.delay ?? 0);
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = options.type ?? 'sine';
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(options.gain ?? 0.12, start + 0.014);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.05);
};

const vibrate = (pattern: number | number[]) => {
  if (muted) {
    return;
  }

  try {
    navigator.vibrate?.(pattern);
  } catch {
    // vibration unsupported (e.g. iOS) — sounds carry the feedback
  }
};

export const setFeedbackMuted = (value: boolean) => {
  muted = value;
};

export const feedback = {
  place(player: Player) {
    tone(player === 'X' ? 300 : 380, 0.09, { gain: 0.13, type: 'triangle' });
    tone(player === 'X' ? 600 : 760, 0.06, { delay: 0.008, gain: 0.045 });
    vibrate(12);
  },
  arm() {
    tone(520, 0.045, { gain: 0.05, type: 'triangle' });
  },
  win() {
    [392, 494, 587, 784].forEach((frequency, step) =>
      tone(frequency, 0.17, { delay: step * 0.09, gain: 0.11, type: 'triangle' }),
    );
    vibrate([30, 50, 30, 50, 90]);
  },
  draw() {
    tone(330, 0.13, { gain: 0.09, type: 'sine' });
    tone(262, 0.2, { delay: 0.12, gain: 0.09, type: 'sine' });
    vibrate(25);
  },
};
