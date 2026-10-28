/** Game sounds, synthesized like the legacy `sound.service.ts`. */
export type Sound = 'select' | 'pop' | 'gameOver';

/** Plays game sounds. Callers decide whether sound is on (SettingsStore). */
export abstract class AudioPort {
  abstract play(sound: Sound): void;
}

interface Synth {
  readonly seconds: number;
  /** Sample value at time `t` seconds, roughly within [-0.5, 0.5]. */
  readonly sample: (t: number) => number;
}

/** Envelopes and frequencies ported from the legacy click, pop and game-over sounds. */
const SYNTHS: Record<Sound, Synth> = {
  select: {
    seconds: 0.05,
    sample: (t) => Math.sin(2 * Math.PI * 1200 * t) * Math.exp(-t * 40) * 0.3,
  },
  pop: {
    seconds: 0.25,
    sample: (t) => {
      const frequency = 600 * Math.exp(-t * 12) + 100;
      const sine = Math.sin(2 * Math.PI * frequency * t);
      const square = Math.sign(sine) * 0.3;
      return (sine * 0.7 + square * 0.3) * Math.exp(-t * 8) * 0.5;
    },
  },
  gameOver: {
    seconds: 0.8,
    sample: (t) => {
      const frequency = 220 - 80 * Math.sin(t * 8);
      const sawtooth = 2 * ((frequency * t) % 1) - 1;
      return sawtooth * Math.max(0, 1 - t * 1.25) * 0.3;
    },
  },
};

/** Mono PCM samples for `sound` at `sampleRate` Hz. Pure, so it is testable without Web Audio. */
export function synthesize(sound: Sound, sampleRate: number): Float32Array {
  const synth = SYNTHS[sound];
  const samples = new Float32Array(Math.floor(synth.seconds * sampleRate));
  for (let i = 0; i < samples.length; i++) {
    samples[i] = synth.sample(i / sampleRate);
  }
  return samples;
}

/** The slice of the Web Audio API that BrowserAudio uses (lets tests pass a fake). */
export interface AudioNodeLike {
  connect(destination: AudioNodeLike): unknown;
}

export interface AudioBufferLike {
  copyToChannel(source: Float32Array, channelNumber: number): void;
}

export interface AudioContextLike {
  readonly state: AudioContextState;
  readonly sampleRate: number;
  readonly destination: AudioNodeLike;
  resume(): Promise<void>;
  createBuffer(channels: number, length: number, sampleRate: number): AudioBufferLike;
  createBufferSource(): AudioNodeLike & { buffer: AudioBufferLike | null; start(): void };
  createGain(): AudioNodeLike & { readonly gain: { value: number } };
}

export const MASTER_VOLUME = 0.25;

interface AudioGraph {
  readonly context: AudioContextLike;
  readonly output: AudioNodeLike;
}

/**
 * Creates the AudioContext lazily on the first `play()`, which always runs inside a
 * user gesture (tap or key press), and resumes it when the browser suspended it.
 */
export class BrowserAudio extends AudioPort {
  private graph: AudioGraph | null = null;
  private unavailable = false;
  private readonly buffers = new Map<Sound, AudioBufferLike>();

  constructor(private readonly createContext: () => AudioContextLike) {
    super();
  }

  play(sound: Sound): void {
    const graph = this.ensureGraph();
    if (graph === null) {
      return;
    }
    const { context, output } = graph;
    if (context.state === 'suspended') {
      context.resume().catch((error: unknown) => {
        console.warn('Could not resume audio', error);
      });
    }
    const source = context.createBufferSource();
    source.buffer = this.bufferFor(context, sound);
    source.connect(output);
    source.start();
  }

  private ensureGraph(): AudioGraph | null {
    if (this.graph === null && !this.unavailable) {
      try {
        const context = this.createContext();
        const output = context.createGain();
        output.gain.value = MASTER_VOLUME;
        output.connect(context.destination);
        this.graph = { context, output };
      } catch (error) {
        this.unavailable = true;
        console.warn('Web Audio is unavailable; sound is off', error);
      }
    }
    return this.graph;
  }

  private bufferFor(context: AudioContextLike, sound: Sound): AudioBufferLike {
    let buffer = this.buffers.get(sound);
    if (buffer === undefined) {
      const samples = synthesize(sound, context.sampleRate);
      buffer = context.createBuffer(1, samples.length, context.sampleRate);
      buffer.copyToChannel(samples, 0);
      this.buffers.set(sound, buffer);
    }
    return buffer;
  }
}
