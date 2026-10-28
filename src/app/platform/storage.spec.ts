import type { MockInstance } from 'vitest';
import { BrowserStorage, type StorageBackend } from './storage';

function memoryBackend(): StorageBackend & { readonly items: Map<string, string> } {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, value),
    removeItem: (key) => items.delete(key),
  };
}

const failing: StorageBackend = {
  getItem: () => {
    throw new DOMException('blocked', 'SecurityError');
  },
  setItem: () => {
    throw new DOMException('full', 'QuotaExceededError');
  },
  removeItem: () => {
    throw new DOMException('blocked', 'SecurityError');
  },
};

describe('BrowserStorage', () => {
  let warn: MockInstance<typeof console.warn>;

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('round-trips JSON values', () => {
    const backend = memoryBackend();
    const storage = new BrowserStorage(() => backend);
    storage.set('bb:v1:test', { a: 1, b: [true, null] });
    expect(backend.items.get('bb:v1:test')).toBe('{"a":1,"b":[true,null]}');
    expect(storage.get('bb:v1:test')).toEqual({ a: 1, b: [true, null] });
  });

  it('returns undefined for a missing key', () => {
    expect(new BrowserStorage(memoryBackend).get('missing')).toBeUndefined();
  });

  it('removes keys', () => {
    const backend = memoryBackend();
    const storage = new BrowserStorage(() => backend);
    storage.set('k', 1);
    storage.remove('k');
    expect(storage.get('k')).toBeUndefined();
  });

  it('returns undefined and warns for corrupt JSON', () => {
    const backend = memoryBackend();
    backend.items.set('k', '{not json');
    expect(new BrowserStorage(() => backend).get('k')).toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
  });

  it('never throws when the backend throws (private mode, quota)', () => {
    const storage = new BrowserStorage(() => failing);
    expect(storage.get('k')).toBeUndefined();
    expect(() => {
      storage.set('k', 1);
    }).not.toThrow();
    expect(() => {
      storage.remove('k');
    }).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(3);
  });

  it('never throws when localStorage itself is inaccessible', () => {
    const storage = new BrowserStorage(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(storage.get('k')).toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
  });
});
