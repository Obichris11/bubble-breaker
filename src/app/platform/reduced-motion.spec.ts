import { BrowserReducedMotion, type MediaQuerySource } from './reduced-motion';

class FakeMediaQuery extends EventTarget implements MediaQuerySource {
  constructor(public matches: boolean) {
    super();
  }

  override addEventListener(type: 'change', listener: () => void): void {
    super.addEventListener(type, listener);
  }

  change(matches: boolean): void {
    this.matches = matches;
    this.dispatchEvent(new Event('change'));
  }
}

describe('BrowserReducedMotion', () => {
  it('reads the media query and follows changes', () => {
    const query = new FakeMediaQuery(true);
    const motion = new BrowserReducedMotion(query);
    expect(motion.reduced()).toBe(true);
    query.change(false);
    expect(motion.reduced()).toBe(false);
  });

  it('is false where matchMedia is unavailable', () => {
    expect(new BrowserReducedMotion(null).reduced()).toBe(false);
  });
});
