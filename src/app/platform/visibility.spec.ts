import { BrowserVisibility, type VisibilitySource } from './visibility';

class FakeDocument extends EventTarget implements VisibilitySource {
  visibilityState: DocumentVisibilityState = 'visible';

  override addEventListener(type: 'visibilitychange', listener: () => void): void {
    super.addEventListener(type, listener);
  }

  become(state: DocumentVisibilityState): void {
    this.visibilityState = state;
    this.dispatchEvent(new Event('visibilitychange'));
  }
}

describe('BrowserVisibility', () => {
  it('starts from the current visibility state', () => {
    const doc = new FakeDocument();
    doc.visibilityState = 'hidden';
    expect(new BrowserVisibility(doc).hidden()).toBe(true);
  });

  it('follows visibilitychange events', () => {
    const doc = new FakeDocument();
    const visibility = new BrowserVisibility(doc);
    expect(visibility.hidden()).toBe(false);
    doc.become('hidden');
    expect(visibility.hidden()).toBe(true);
    doc.become('visible');
    expect(visibility.hidden()).toBe(false);
  });
});
