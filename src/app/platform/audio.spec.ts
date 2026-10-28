import type { MockInstance } from 'vitest';
import {
  BrowserAudio,
  MASTER_VOLUME,
  synthesize,
  type AudioBufferLike,
  type AudioContextLike,
  type AudioNodeLike,
  type Sound,
} from './audio';

class FakeNode implements AudioNodeLike {
  readonly connections: AudioNodeLike[] = [];

  connect(destination: AudioNodeLike): void {
    this.connections.push(destination);
  }
}

class FakeBuffer implements AudioBufferLike {
  samples: Float32Array | null = null;

  copyToChannel(source: Float32Array): void {
    this.samples = source;
  }
}

class FakeSource extends FakeNode {
  buffer: AudioBufferLike | null = null;
  started = false;

  start(): void {
    this.started = true;
  }
}

class FakeAudioContext implements AudioContextLike {
  state: AudioContextState = 'running';
  readonly sampleRate = 8000;
  readonly destination = new FakeNode();
  readonly gains: (FakeNode & { gain: { value: number } })[] = [];
  readonly sources: FakeSource[] = [];
  buffersCreated = 0;
  resumeCalls = 0;
  resumeError: Error | null = null;

  resume(): Promise<void> {
    this.resumeCalls++;
    return this.resumeError === null ? Promise.resolve() : Promise.reject(this.resumeError);
  }

  createBuffer(): FakeBuffer {
    this.buffersCreated++;
    return new FakeBuffer();
  }

  createBufferSource(): FakeSource {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }

  createGain(): FakeNode & { gain: { value: number } } {
    const gain = Object.assign(new FakeNode(), { gain: { value: 1 } });
    this.gains.push(gain);
    return gain;
  }
}

describe('synthesize', () => {
  it.each<[Sound, number]>([
    ['select', 400],
    ['pop', 2000],
    ['gameOver', 6400],
  ])('renders %s as %i samples at 8 kHz, within [-1, 1]', (sound, length) => {
    const samples = synthesize(sound, 8000);
    expect(samples).toHaveLength(length);
    expect(samples.every((value) => Math.abs(value) <= 1)).toBe(true);
    expect(samples.some((value) => value !== 0)).toBe(true);
  });

  it('is deterministic', () => {
    expect(synthesize('pop', 8000)).toEqual(synthesize('pop', 8000));
  });
});

describe('BrowserAudio', () => {
  let warn: MockInstance<typeof console.warn>;

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('does not create an AudioContext before the first play', () => {
    const create = vi.fn(() => new FakeAudioContext());
    new BrowserAudio(create);
    expect(create).not.toHaveBeenCalled();
  });

  it('creates the context once, routes through a master gain and plays', () => {
    const context = new FakeAudioContext();
    const create = vi.fn(() => context);
    const audio = new BrowserAudio(create);
    audio.play('select');
    audio.play('pop');
    expect(create).toHaveBeenCalledOnce();
    const [gain] = context.gains;
    expect(gain?.gain.value).toBe(MASTER_VOLUME);
    expect(gain?.connections).toEqual([context.destination]);
    expect(context.sources).toHaveLength(2);
    expect(context.sources.every((source) => source.started)).toBe(true);
    expect(context.sources[0]?.connections).toEqual([gain]);
  });

  it('synthesizes each sound once and reuses the buffer', () => {
    const context = new FakeAudioContext();
    const audio = new BrowserAudio(() => context);
    audio.play('pop');
    audio.play('pop');
    expect(context.buffersCreated).toBe(1);
    expect(context.sources[0]?.buffer).toBe(context.sources[1]?.buffer);
  });

  it('resumes a suspended context', async () => {
    const context = new FakeAudioContext();
    context.state = 'suspended';
    new BrowserAudio(() => context).play('select');
    expect(context.resumeCalls).toBe(1);
    await Promise.resolve();
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns when resuming fails', async () => {
    const context = new FakeAudioContext();
    context.state = 'suspended';
    context.resumeError = new Error('not allowed');
    new BrowserAudio(() => context).play('select');
    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledOnce();
    });
  });

  it('stays silent without throwing when Web Audio is unavailable', () => {
    const create = vi.fn((): AudioContextLike => {
      throw new ReferenceError('AudioContext is not defined');
    });
    const audio = new BrowserAudio(create);
    expect(() => {
      audio.play('select');
      audio.play('pop');
    }).not.toThrow();
    expect(create).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledOnce();
  });
});
