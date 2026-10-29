import type { UnrecoverableStateEvent, VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import {
  appShellCached,
  BrowserPwa,
  browserPwaHost,
  type InstallPromptEvent,
  type PwaHost,
  type ServiceWorkerSource,
} from './pwa';
import { FakeClock } from './testing/fakes';

/** Lets pending promise callbacks run. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

class FakeServiceWorker implements ServiceWorkerSource {
  readonly versionUpdates = new Subject<VersionEvent>();
  readonly unrecoverable = new Subject<UnrecoverableStateEvent>();
  checkForUpdate = vi.fn(() => Promise.resolve(false));

  constructor(readonly isEnabled = true) {}
}

class FakeHost extends EventTarget implements PwaHost {
  /** What each `appShellCached()` call resolves to, in order (then false). */
  cached: boolean[] = [];
  cacheChecks = 0;
  reloads = 0;

  constructor(readonly controlled = false) {
    super();
  }

  appShellCached(): Promise<boolean> {
    this.cacheChecks++;
    return Promise.resolve(this.cached.shift() ?? false);
  }

  reload(): void {
    this.reloads++;
  }
}

function installPrompt(
  outcome: 'accepted' | 'dismissed',
  prompt = vi.fn(() => Promise.resolve()),
): InstallPromptEvent {
  return Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt,
    userChoice: Promise.resolve({ outcome }),
  });
}

describe('BrowserPwa', () => {
  let sw: FakeServiceWorker;
  let host: FakeHost;
  let clock: FakeClock;

  const create = () => new BrowserPwa(sw, host, clock);

  beforeEach(() => {
    sw = new FakeServiceWorker();
    host = new FakeHost(true);
    clock = new FakeClock();
  });

  it('reports a new version once it is downloaded', () => {
    const pwa = create();
    sw.versionUpdates.next({ type: 'VERSION_DETECTED', version: { hash: 'b' } });
    expect(pwa.updateAvailable()).toBe(false);
    sw.versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'a' },
      latestVersion: { hash: 'b' },
    });
    expect(pwa.updateAvailable()).toBe(true);
  });

  it('reports an unrecoverable service-worker state', () => {
    const pwa = create();
    sw.unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'cache gone' });
    expect(pwa.unrecoverable()).toBe(true);
  });

  it('asks the service worker for updates and only warns when that fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    sw.checkForUpdate.mockRejectedValueOnce(new Error('offline'));
    const pwa = create();
    pwa.checkForUpdate();
    await flush();
    expect(sw.checkForUpdate).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('Update check failed', expect.any(Error));
    warn.mockRestore();
  });

  it('does nothing with a disabled service worker', () => {
    sw = new FakeServiceWorker(false);
    host = new FakeHost(false);
    const pwa = create();
    pwa.checkForUpdate();
    expect(sw.checkForUpdate).not.toHaveBeenCalled();
    expect(sw.versionUpdates.observed).toBe(false);
    expect(host.cacheChecks).toBe(0);
    expect(pwa.offlineReady()).toBe(false);
  });

  it('reports offline ready on a first visit once the app shell is cached', async () => {
    host = new FakeHost(false);
    host.cached = [false, false, true];
    const pwa = create();
    await flush();
    expect(pwa.offlineReady()).toBe(false);
    clock.advance(2_000);
    await flush();
    expect(pwa.offlineReady()).toBe(false);
    clock.advance(2_000);
    await flush();
    expect(pwa.offlineReady()).toBe(true);
    expect(host.cacheChecks).toBe(3);
    expect(clock.pending).toBe(0);
  });

  it('stops looking after two minutes without a full cache', async () => {
    host = new FakeHost(false);
    const pwa = create();
    for (let i = 0; i < 70; i++) {
      await flush();
      clock.advance(2_000);
    }
    expect(host.cacheChecks).toBe(60);
    expect(clock.pending).toBe(0);
    expect(pwa.offlineReady()).toBe(false);
  });

  it('does not report offline ready when a service worker already controlled the page', async () => {
    const pwa = create();
    await flush();
    expect(host.cacheChecks).toBe(0);
    expect(pwa.offlineReady()).toBe(false);
  });

  it('keeps the install prompt for later and shows it on request', async () => {
    const pwa = create();
    const prompt = vi.fn(() => Promise.resolve());
    const event = installPrompt('accepted', prompt);
    host.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(pwa.installAvailable()).toBe(true);
    await expect(pwa.install()).resolves.toBe(true);
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(pwa.installAvailable()).toBe(false);
    await expect(pwa.install()).resolves.toBe(false);
  });

  it('reports a declined prompt', async () => {
    const pwa = create();
    host.dispatchEvent(installPrompt('dismissed'));
    await expect(pwa.install()).resolves.toBe(false);
  });

  it('forgets the prompt once the app is installed', () => {
    const pwa = create();
    host.dispatchEvent(installPrompt('accepted'));
    host.dispatchEvent(new Event('appinstalled'));
    expect(pwa.installAvailable()).toBe(false);
  });

  it('reloads the page', () => {
    create().reload();
    expect(host.reloads).toBe(1);
  });
});

describe('appShellCached', () => {
  const NGSW = {
    assetGroups: [
      { name: 'app', installMode: 'prefetch', urls: ['/index.html', '/main-ABC.js'] },
      { name: 'icons', installMode: 'lazy', urls: ['/icons/icon-192.png'] },
    ],
  };
  const fetchJson = (body: unknown, ok = true) =>
    vi.fn<typeof fetch>(() => Promise.resolve(Response.json(body, { status: ok ? 200 : 404 })));
  const cacheWith = (...urls: string[]) => ({
    match: vi.fn((url: string) =>
      Promise.resolve(urls.includes(url) ? new Response('') : undefined),
    ),
  });

  it('is true when every prefetched file is in Cache Storage', async () => {
    const fetchFn = fetchJson(NGSW);
    const caches = cacheWith('/index.html', '/main-ABC.js');
    await expect(appShellCached(fetchFn, caches)).resolves.toBe(true);
    expect(fetchFn).toHaveBeenCalledWith('ngsw.json', { cache: 'no-store' });
    expect(caches.match).toHaveBeenCalledWith('/main-ABC.js', { ignoreVary: true });
  });

  it('is false while a prefetched file is missing', async () => {
    await expect(appShellCached(fetchJson(NGSW), cacheWith('/index.html'))).resolves.toBe(false);
  });

  it.each([
    ['ngsw.json is missing', fetchJson({}, false)],
    ['ngsw.json has no prefetch group', fetchJson({ assetGroups: [NGSW.assetGroups[1]] })],
    ['ngsw.json is not a manifest', fetchJson(['index.html'])],
    ['the network fails', vi.fn<typeof fetch>(() => Promise.reject(new TypeError('offline')))],
  ])('is false when %s', async (_, fetchFn) => {
    await expect(appShellCached(fetchFn, cacheWith('/index.html'))).resolves.toBe(false);
  });
});

describe('browserPwaHost', () => {
  it('reads the page state from window', async () => {
    const host = browserPwaHost(window);
    expect(host.controlled).toBe(false);
    await expect(host.appShellCached()).resolves.toBe(false);
    const listener = vi.fn();
    host.addEventListener('appinstalled', listener);
    window.dispatchEvent(new Event('appinstalled'));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
