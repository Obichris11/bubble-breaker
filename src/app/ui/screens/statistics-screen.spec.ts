import { TestBed } from '@angular/core/testing';
import { fireEvent, render, screen } from '@testing-library/angular';
import { createFakePlatform, type FakePlatform } from '../../platform/testing/fakes';
import { KEYS, type StatsRecord } from '../../state/persistence';
import { StatsStore } from '../../state/stats.store';
import { StatisticsScreen } from './statistics-screen';

const PLAYED: StatsRecord = {
  high: 1318,
  total: 12_914,
  played: 22,
  last: { score: 642, timeMs: 252_000 },
  lastRecordedGameId: 'game-22',
};

describe('StatisticsScreen', () => {
  let platform: FakePlatform;

  const setup = async (stats?: StatsRecord) => {
    platform = createFakePlatform();
    if (stats !== undefined) {
      platform.storage.set(KEYS.stats, stats);
    }
    const view = await render(StatisticsScreen, { providers: platform.providers });
    return { ...view, stats: TestBed.inject(StatsStore) };
  };

  /** The value next to a row label. */
  const value = (label: string) => screen.getByText(label).nextElementSibling;
  const resetButton = () => screen.getByRole('button', { name: 'Reset statistics…' });

  it('lists the last game, high, average, total and games played', async () => {
    await setup(PLAYED);
    expect(screen.getByRole('heading', { name: 'Statistics' })).toBeInTheDocument();
    expect(value('Last Game')).toHaveTextContent('642 in 4:12');
    expect(value('High Score')).toHaveTextContent('1,318');
    expect(value('Average Score')).toHaveTextContent('587');
    expect(value('Total Score')).toHaveTextContent('12,914');
    expect(value('Games Played')).toHaveTextContent('22');
    expect(screen.getByText('Statistics are stored on this device only.')).toBeInTheDocument();
  });

  it('shows a dash for the last game until a game is finished', async () => {
    await setup();
    expect(value('Last Game')).toHaveTextContent('–');
    expect(value('High Score')).toHaveTextContent('0');
  });

  it('asks before resetting; Cancel keeps everything and gives focus back', async () => {
    const { stats, fixture } = await setup(PLAYED);
    resetButton().focus();
    fireEvent.click(resetButton());
    fixture.detectChanges();
    await fixture.whenStable();
    const dialog = screen.getByRole('alertdialog', { name: 'Reset statistics' });
    expect(dialog).toHaveAccessibleDescription(
      'Clear high score, average score, total score and games played? This cannot be undone.',
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fixture.detectChanges();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(stats.played()).toBe(22);
    expect(resetButton()).toHaveFocus();
  });

  it('resets after confirmation and keeps the last recorded game id', async () => {
    const { stats, fixture } = await setup(PLAYED);
    fireEvent.click(resetButton());
    fixture.detectChanges();
    await fixture.whenStable();
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    fixture.detectChanges();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(stats.played()).toBe(0);
    expect(value('Last Game')).toHaveTextContent('–');
    expect(platform.storage.get(KEYS.stats)).toMatchObject({
      played: 0,
      lastRecordedGameId: 'game-22',
    });
  });

  it('closes the dialog on Escape', async () => {
    const { stats, fixture } = await setup(PLAYED);
    fireEvent.click(resetButton());
    fixture.detectChanges();
    await fixture.whenStable();
    fireEvent(screen.getByRole('alertdialog'), new Event('cancel', { cancelable: true }));
    fixture.detectChanges();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(stats.played()).toBe(22);
  });
});
