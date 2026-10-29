import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { createFakePlatform } from '../../platform/testing/fakes';
import { GameStore } from '../../state/game.store';
import { KEYS } from '../../state/persistence';
import { recordFrom } from '../../state/testing/records';
import { StatusStrip } from './status-strip';

describe('StatusStrip', () => {
  const setup = async () => {
    const platform = createFakePlatform();
    platform.storage.set(KEYS.game, recordFrom(['........b..', '........brr']));
    const view = await render(StatusStrip, { providers: platform.providers });
    return { ...view, platform, store: TestBed.inject(GameStore) };
  };

  /** The value next to a field label. */
  const value = (label: string) => screen.getByText(label).nextElementSibling;

  it('shows the score, the selected points and the time', async () => {
    const { store, platform, fixture } = await setup();
    expect(value('Score')).toHaveTextContent('100');
    expect(value('Selected')).toHaveTextContent('–');
    expect(value('Time')).toHaveTextContent('‖ 1:05');
    store.resume();
    store.tap({ row: 11, col: 9 });
    platform.clock.advance(2000);
    fixture.detectChanges();
    expect(value('Selected')).toHaveTextContent('2');
    expect(value('Time')).toHaveTextContent('1:07');
    expect(value('Time')?.textContent).not.toContain('‖');
  });

  it('keeps label and value pairs in a description list', async () => {
    await setup();
    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual([
      'Score',
      'Selected',
      'Time',
    ]);
    expect(screen.getAllByRole('definition')).toHaveLength(3);
  });
});
