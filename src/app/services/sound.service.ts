import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface SoundConfig {
  volume: number;
  enabled: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SoundService {
  private audioContext: AudioContext | null = null;
  private masterGainNode: GainNode | null = null;

  private soundConfig$ = new BehaviorSubject<SoundConfig>({
    volume: 0.25,
    enabled: true
  });

  public config = this.soundConfig$.asObservable();

  private sounds = {
    ballClick: null as AudioBuffer | null,
    ballPop: null as AudioBuffer | null,
    ballFall: null as AudioBuffer | null,
    scoreBonus: null as AudioBuffer | null,
    gameOver: null as AudioBuffer | null,
    newGame: null as AudioBuffer | null
  };

  constructor() {
    this.initializeAudio();
    this.generateSounds();
  }

  private async initializeAudio(): Promise<void> {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGainNode = this.audioContext.createGain();
      this.masterGainNode.connect(this.audioContext.destination);
      this.updateVolume();
    } catch (error) {
      console.warn('Audio initialization failed:', error);
    }
  }

  private generateSounds(): void {
    if (!this.audioContext) return;

    // Generate classic ball click sound (higher pitched click)
    this.sounds.ballClick = this.createClickSound();

    // Generate classic ball pop sound (satisfying pop)
    this.sounds.ballPop = this.createClassicPopSound();

    // Generate ball fall sound (soft bounce)
    this.sounds.ballFall = this.createBounceSound();

    // Generate score bonus sound (classic arcade chime)
    this.sounds.scoreBonus = this.createClassicBonusSound();

    // Generate game over sound (classic failure sound)
    this.sounds.gameOver = this.createClassicGameOverSound();

    // Generate new game sound (classic start sound)
    this.sounds.newGame = this.createClassicStartSound();
  }

  private createToneBuffer(frequency: number, duration: number, type: OscillatorType = 'sine'): AudioBuffer {
    if (!this.audioContext) throw new Error('Audio context not initialized');

    const sampleRate = this.audioContext.sampleRate;
    const buffer = this.audioContext.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 3); // Exponential decay

      let sample = 0;
      switch (type) {
        case 'sine':
          sample = Math.sin(2 * Math.PI * frequency * t);
          break;
        case 'square':
          sample = Math.sign(Math.sin(2 * Math.PI * frequency * t));
          break;
        case 'sawtooth':
          sample = 2 * (t * frequency - Math.floor(t * frequency + 0.5));
          break;
      }

      data[i] = sample * envelope * 0.3;
    }

    return buffer;
  }

  private createClickSound(): AudioBuffer {
    if (!this.audioContext) throw new Error('Audio context not initialized');

    const sampleRate = this.audioContext.sampleRate;
    const duration = 0.05;
    const buffer = this.audioContext.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const frequency = 1200; // Higher pitched click
      const envelope = Math.exp(-t * 40); // Quick decay

      data[i] = Math.sin(2 * Math.PI * frequency * t) * envelope * 0.3;
    }

    return buffer;
  }

  private createClassicPopSound(): AudioBuffer {
    if (!this.audioContext) throw new Error('Audio context not initialized');

    const sampleRate = this.audioContext.sampleRate;
    const duration = 0.25;
    const buffer = this.audioContext.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      // Classic "pop" with quick pitch drop
      const frequency = 600 * Math.exp(-t * 12) + 100;
      const envelope = Math.exp(-t * 8);

      // Add some square wave harmonics for classic feel
      const sine = Math.sin(2 * Math.PI * frequency * t);
      const square = Math.sign(sine) * 0.3;

      data[i] = (sine * 0.7 + square * 0.3) * envelope * 0.5;
    }

    return buffer;
  }

  private createBounceSound(): AudioBuffer {
    if (!this.audioContext) throw new Error('Audio context not initialized');

    const sampleRate = this.audioContext.sampleRate;
    const duration = 0.15;
    const buffer = this.audioContext.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const frequency = 150 + 50 * Math.sin(t * 40); // Slight wobble
      const envelope = Math.exp(-t * 6);

      data[i] = Math.sin(2 * Math.PI * frequency * t) * envelope * 0.3;
    }

    return buffer;
  }

  private createClassicBonusSound(): AudioBuffer {
    if (!this.audioContext) throw new Error('Audio context not initialized');

    const sampleRate = this.audioContext.sampleRate;
    const duration = 0.4;
    const buffer = this.audioContext.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);

    // Classic arcade chime - quick ascending notes
    const notes = [523, 698, 880]; // C, F#, A

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const noteIndex = Math.min(Math.floor(t * 8), notes.length - 1);
      const frequency = notes[noteIndex];
      const envelope = Math.exp(-t * 4);

      // Add some triangle wave for classic arcade feel
      const triangle = (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * frequency * t));

      data[i] = triangle * envelope * 0.4;
    }

    return buffer;
  }

  private createClassicGameOverSound(): AudioBuffer {
    if (!this.audioContext) throw new Error('Audio context not initialized');

    const sampleRate = this.audioContext.sampleRate;
    const duration = 0.8;
    const buffer = this.audioContext.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);

    // Classic "wah wah wah" game over sound
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const frequency = 220 - 80 * Math.sin(t * 8); // Wobbling frequency
      const envelope = Math.max(0, 1 - t * 1.25);

      // Sawtooth wave for classic retro feel
      const sawtooth = 2 * ((frequency * t) % 1) - 1;

      data[i] = sawtooth * envelope * 0.3;
    }

    return buffer;
  }

  private createClassicStartSound(): AudioBuffer {
    if (!this.audioContext) throw new Error('Audio context not initialized');

    const sampleRate = this.audioContext.sampleRate;
    const duration = 0.5;
    const buffer = this.audioContext.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);

    // Classic "power up" start sound
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const frequency = 330 + 200 * t; // Rising pitch
      const envelope = Math.exp(-t * 3);

      // Mix of sine and square for classic feel
      const sine = Math.sin(2 * Math.PI * frequency * t);
      const square = Math.sign(sine) * 0.4;

      data[i] = (sine * 0.6 + square * 0.4) * envelope * 0.4;
    }

    return buffer;
  }

  playSound(soundName: keyof typeof this.sounds): void {
    const config = this.soundConfig$.value;
    if (!config.enabled || !this.audioContext || !this.masterGainNode) return;

    const buffer = this.sounds[soundName];
    if (!buffer) return;

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.masterGainNode);
    source.start();
  }

  playBallClick(): void {
    this.playSound('ballClick');
  }

  playBallPop(): void {
    this.playSound('ballPop');
  }

  playBallFall(): void {
    this.playSound('ballFall');
  }

  playScoreBonus(): void {
    this.playSound('scoreBonus');
  }

  playGameOver(): void {
    this.playSound('gameOver');
  }

  playNewGame(): void {
    this.playSound('newGame');
  }

  updateConfig(config: Partial<SoundConfig>): void {
    const currentConfig = this.soundConfig$.value;
    const newConfig = { ...currentConfig, ...config };
    this.soundConfig$.next(newConfig);
    this.updateVolume();
  }

  private updateVolume(): void {
    const config = this.soundConfig$.value;

    if (this.masterGainNode) {
      this.masterGainNode.gain.setValueAtTime(
        config.enabled ? config.volume : 0,
        this.audioContext?.currentTime || 0
      );
    }
  }

  getConfig(): SoundConfig {
    return this.soundConfig$.value;
  }
}