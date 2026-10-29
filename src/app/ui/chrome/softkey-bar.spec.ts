import { fireEvent, render, screen } from '@testing-library/angular';
import { SoftkeyBar } from './softkey-bar';

describe('SoftkeyBar', () => {
  const setup = async (menuOpen = false) => {
    const left = vi.fn<() => void>();
    const menu = vi.fn<(key: HTMLElement) => void>();
    const view = await render(SoftkeyBar, {
      inputs: { leftLabel: 'New Game', menuOpen },
      on: { left, menu },
    });
    return { ...view, left, menu };
  };

  it('shows the left softkey and the Menu softkey', async () => {
    await setup();
    expect(screen.getAllByRole('button').map((key) => key.textContent.trim())).toEqual([
      'New Game',
      'Menu',
    ]);
  });

  it('reports presses; Menu sends its own button for the focus return', async () => {
    const { left, menu } = await setup();
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    expect(left).toHaveBeenCalledTimes(1);
    const menuKey = screen.getByRole('button', { name: 'Menu' });
    fireEvent.click(menuKey);
    expect(menu).toHaveBeenCalledWith(menuKey);
  });

  it('marks the Menu softkey as a popup button and shows it pressed while open', async () => {
    const { rerender } = await setup();
    const menuKey = screen.getByRole('button', { name: 'Menu' });
    expect(menuKey).toHaveAttribute('aria-haspopup', 'menu');
    expect(menuKey).toHaveAttribute('aria-expanded', 'false');
    await rerender({ inputs: { leftLabel: 'Done', menuOpen: true }, partialUpdate: true });
    expect(menuKey).toHaveAttribute('aria-expanded', 'true');
    expect(menuKey).toHaveClass('key--open');
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });
});
