/** JSON key-value storage. Never throws: failures are logged and reads return `undefined`. */
export abstract class StoragePort {
  /** The parsed value, or `undefined` when the key is missing or unreadable. */
  abstract get(key: string): unknown;
  abstract set(key: string, value: unknown): void;
  abstract remove(key: string): void;
}

export type StorageBackend = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * `localStorage` adapter. The backend is resolved lazily because merely reading
 * `window.localStorage` throws a SecurityError when storage is blocked.
 */
export class BrowserStorage extends StoragePort {
  constructor(private readonly backend: () => StorageBackend) {
    super();
  }

  get(key: string): unknown {
    try {
      const raw = this.backend().getItem(key);
      return raw === null ? undefined : (JSON.parse(raw) as unknown);
    } catch (error) {
      console.warn(`Could not read "${key}" from storage`, error);
      return undefined;
    }
  }

  set(key: string, value: unknown): void {
    try {
      this.backend().setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Could not write "${key}" to storage`, error);
    }
  }

  remove(key: string): void {
    try {
      this.backend().removeItem(key);
    } catch (error) {
      console.warn(`Could not remove "${key}" from storage`, error);
    }
  }
}
