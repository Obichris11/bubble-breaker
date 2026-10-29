import { fireEvent, render, screen } from '@testing-library/angular';
import { PausedDialog } from './paused-dialog';

describe('PausedDialog', () => {
  const setup = async () => {
    const resumeGame = vi.fn<() => void>();
    await render(PausedDialog, { on: { resumeGame } });
    return { resumeGame, dialog: screen.getByRole('dialog', { name: 'Paused' }) };
  };

  it('says the timer is stopped and starts on Resume', async () => {
    const { dialog } = await setup();
    expect(dialog).toHaveAccessibleDescription('The timer is stopped. Your board is saved.');
    expect(screen.getByRole('button', { name: 'Resume' })).toHaveFocus();
  });

  it('resumes on the button and on Escape', async () => {
    const { resumeGame, dialog } = await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(resumeGame).toHaveBeenCalledTimes(2);
  });
});
