import { fireEvent, render, screen } from '@testing-library/angular';
import { PopupMenu, type MenuItem } from './popup-menu';

const ITEMS: readonly MenuItem[] = [
  { id: 'new-game', label: 'New Game' },
  { id: 'statistics', label: 'Statistics', separatorBefore: true },
  { id: 'about', label: 'About' },
];

describe('PopupMenu', () => {
  const setup = async () => {
    const choose = vi.fn<(id: string) => void>();
    const dismiss = vi.fn<() => void>();
    const view = await render(PopupMenu, {
      inputs: { items: ITEMS, label: 'Menu' },
      on: { choose, dismiss },
    });
    return {
      ...view,
      choose,
      dismiss,
      item: (name: string) => screen.getByRole('menuitem', { name }),
    };
  };

  it('lists the items with a separator and focuses the first one', async () => {
    const { item } = await setup();
    expect(screen.getByRole('menu', { name: 'Menu' })).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem').map((row) => row.textContent.trim())).toEqual([
      'New Game',
      'Statistics',
      'About',
    ]);
    expect(screen.getByRole('separator')).toBeInTheDocument();
    expect(item('New Game')).toHaveFocus();
  });

  it('moves focus with the arrow keys (wrapping), Home and End', async () => {
    const { item } = await setup();
    const press = (key: string) => fireEvent.keyDown(document.activeElement!, { key });
    expect(press('ArrowDown')).toBe(false);
    expect(item('Statistics')).toHaveFocus();
    press('ArrowDown');
    press('ArrowDown');
    expect(item('New Game')).toHaveFocus();
    press('ArrowUp');
    expect(item('About')).toHaveFocus();
    press('Home');
    expect(item('New Game')).toHaveFocus();
    press('End');
    expect(item('About')).toHaveFocus();
    expect(press('a')).toBe(true);
  });

  it('follows the pointer and chooses the clicked item', async () => {
    const { item, choose } = await setup();
    fireEvent.pointerEnter(item('About'));
    expect(item('About')).toHaveFocus();
    fireEvent.click(item('Statistics'));
    expect(choose).toHaveBeenCalledWith('statistics');
  });

  it('closes on Escape, on Tab and on a press outside the menu', async () => {
    const { dismiss, fixture } = await setup();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(fireEvent.keyDown(document.activeElement!, { key: 'Tab' })).toBe(false);
    expect(dismiss).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('menu'));
    expect(dismiss).toHaveBeenCalledTimes(2);
    fireEvent.click(fixture.nativeElement as HTMLElement);
    expect(dismiss).toHaveBeenCalledTimes(3);
  });
});
