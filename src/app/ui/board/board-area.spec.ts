import { TestBed } from '@angular/core/testing';
import { fireEvent, render, screen } from '@testing-library/angular';
import { createFakePlatform } from '../../platform/testing/fakes';
import { GameStore } from '../../state/game.store';
import { KEYS } from '../../state/persistence';
import { recordFrom } from '../../state/testing/records';
import { BoardArea } from './board-area';

/** Stands in for the browser's ResizeObserver, which jsdom lacks. */
class FakeResizeObserver {
  static last: FakeResizeObserver | undefined;
  observed: Element | undefined;
  disconnected = false;

  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.last = this;
  }

  observe(target: Element): void {
    this.observed = target;
  }

  disconnect(): void {
    this.disconnected = true;
  }

  /** Reports a new content-box size for the observed element. */
  resize(width: number, height: number): void {
    const entry = { contentRect: { width, height } } as ResizeObserverEntry;
    this.callback([entry], this as unknown as ResizeObserver);
  }
}

describe('BoardArea', () => {
  const setup = async () => {
    const platform = createFakePlatform();
    platform.storage.set(KEYS.game, recordFrom(['........b..', '........brr'], { elapsedMs: 0 }));
    const view = await render(BoardArea, { providers: platform.providers });
    return { ...view, observer: FakeResizeObserver.last!, store: TestBed.inject(GameStore) };
  };

  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sizes the board from the measured area (handoff §1)', async () => {
    const { observer, fixture } = await setup();
    expect(observer.observed).toBe(fixture.nativeElement);
    observer.resize(352, 536);
    fixture.detectChanges();
    expect(screen.getByRole('application')).toHaveStyle({ width: '352px', height: '384px' });
    observer.resize(760, 920);
    fixture.detectChanges();
    expect(screen.getByRole('application')).toHaveStyle({ width: '759px', height: '828px' });
  });

  it('clears the selection on a tap beside the board', async () => {
    const { store, fixture, observer } = await setup();
    observer.resize(352, 536);
    fixture.detectChanges();
    const board = screen.getByRole('application');
    board.getBoundingClientRect = () => new DOMRect(0, 0, 352, 384);
    fireEvent.click(board, { clientX: 9 * 32 + 5, clientY: 11 * 32 + 5 });
    expect(store.selection()?.anchor).toEqual({ row: 11, col: 9 });
    fireEvent.click(fixture.nativeElement as HTMLElement);
    expect(store.selection()).toBeNull();
  });

  it('stops observing when destroyed', async () => {
    const { observer, fixture } = await setup();
    fixture.destroy();
    expect(observer.disconnected).toBe(true);
  });

  it('renders an unsized board where ResizeObserver is missing', async () => {
    vi.stubGlobal('ResizeObserver', undefined);
    FakeResizeObserver.last = undefined;
    await setup();
    expect(screen.getByRole('application')).toHaveStyle({ width: '0px' });
  });
});
