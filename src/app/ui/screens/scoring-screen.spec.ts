import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { fireEvent, screen } from '@testing-library/angular';
import { createFakePlatform, type FakePlatform } from '../../platform/testing/fakes';
import { GameStore } from '../../state/game.store';
import { KEYS, type StatsRecord } from '../../state/persistence';
import { StatsStore } from '../../state/stats.store';
import { recordFrom } from '../../state/testing/records';
import { scoringGuard } from './scoring-guard';
import { ScoringScreen } from './scoring-screen';

const PLAYED: StatsRecord = {
  high: 1318,
  total: 12_914,
  played: 22,
  last: { score: 642, timeMs: 252_000 },
  lastRecordedGameId: 'game-22',
};

describe('ScoringScreen', () => {
  let platform: FakePlatform;

  const setup = async () => {
    platform = createFakePlatform();
    platform.storage.set(KEYS.stats, PLAYED);
    TestBed.configureTestingModule({
      providers: [
        ...platform.providers,
        provideRouter([
          { path: '', children: [] },
          { path: 'scoring', component: ScoringScreen },
        ]),
      ],
    });
    const harness = await RouterTestingHarness.create('/scoring');
    return {
      harness,
      router: TestBed.inject(Router),
      game: TestBed.inject(GameStore),
      stats: TestBed.inject(StatsStore),
    };
  };

  /** The value next to a row label. */
  const value = (label: string) => screen.getByText(label).nextElementSibling;
  const score = () => screen.getByText('No groups left. Your score').nextElementSibling;

  it('shows the final score, the time (not scored) and the totals', async () => {
    await setup();
    expect(screen.getByRole('heading', { name: 'Game over' })).toBeInTheDocument();
    expect(screen.getByText('No groups left. Your score')).toBeInTheDocument();
    expect(score()).toHaveTextContent('642');
    expect(screen.getByText('Time 4:12 (not scored)')).toBeInTheDocument();
    expect(screen.queryByText('New high score')).toBeNull();
    expect(value('High Score')).toHaveTextContent('1,318');
    expect(value('Average Score')).toHaveTextContent('587');
    expect(value('Total Score')).toHaveTextContent('12,914');
    expect(value('Games Played')).toHaveTextContent('22');
  });

  it('shows the badge after a game that beat the high score', async () => {
    const { stats, harness } = await setup();
    stats.recordFinished('game-23', 1402, 301_000);
    harness.detectChanges();
    expect(screen.getByText('New high score')).toBeInTheDocument();
    expect(score()).toHaveTextContent('1,402');
    expect(screen.getByText('Time 5:01 (not scored)')).toBeInTheDocument();
    expect(value('Games Played')).toHaveTextContent('23');
  });

  it('starts a new game and goes back to the board', async () => {
    const { game, router, harness } = await setup();
    const finished = game.gameId();
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    await harness.fixture.whenStable();
    expect(game.gameId()).not.toBe(finished);
    expect(router.url).toBe('/');
  });
});

describe('scoringGuard', () => {
  const setup = () => {
    const platform = createFakePlatform();
    platform.storage.set(KEYS.game, recordFrom(['.........rr'], { elapsedMs: 0 }));
    TestBed.configureTestingModule({
      providers: [
        ...platform.providers,
        provideRouter([
          { path: '', children: [] },
          { path: 'scoring', canActivate: [scoringGuard], children: [] },
        ]),
      ],
    });
    return { platform, router: TestBed.inject(Router), game: TestBed.inject(GameStore) };
  };

  it('sends a direct visit to the game screen', async () => {
    const { router } = setup();
    await router.navigateByUrl('/scoring');
    expect(router.url).toBe('/');
  });

  it('lets the game-over navigation through', async () => {
    const { router, game, platform } = setup();
    game.tap({ row: 11, col: 9 });
    game.tap({ row: 11, col: 9 });
    platform.clock.advance(1000);
    expect(game.showScoring()).toBe(true);
    await router.navigateByUrl('/scoring');
    expect(router.url).toBe('/scoring');
  });
});
