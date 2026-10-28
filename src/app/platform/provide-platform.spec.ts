import { TestBed } from '@angular/core/testing';
import { AudioPort, BrowserAudio } from './audio';
import { BrowserClock, ClockPort } from './clock';
import { providePlatform } from './provide-platform';
import { BrowserReducedMotion, ReducedMotionPort } from './reduced-motion';
import { BrowserStorage, StoragePort } from './storage';
import { BrowserVisibility, VisibilityPort } from './visibility';

describe('providePlatform', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: providePlatform() });
  });

  it('binds every port to its browser implementation', () => {
    expect(TestBed.inject(ClockPort)).toBeInstanceOf(BrowserClock);
    expect(TestBed.inject(StoragePort)).toBeInstanceOf(BrowserStorage);
    expect(TestBed.inject(VisibilityPort)).toBeInstanceOf(BrowserVisibility);
    expect(TestBed.inject(ReducedMotionPort)).toBeInstanceOf(BrowserReducedMotion);
    expect(TestBed.inject(AudioPort)).toBeInstanceOf(BrowserAudio);
  });

  it('uses localStorage', () => {
    TestBed.inject(StoragePort).set('bb:test', 1);
    expect(localStorage.getItem('bb:test')).toBe('1');
    localStorage.removeItem('bb:test');
  });

  it('reads the document visibility and motion preference', () => {
    expect(TestBed.inject(VisibilityPort).hidden()).toBe(document.visibilityState === 'hidden');
    expect(TestBed.inject(ReducedMotionPort).reduced()).toBe(false);
  });
});
