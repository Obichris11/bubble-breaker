import { TestBed } from '@angular/core/testing';
import { fireEvent, render, screen } from '@testing-library/angular';
import { createFakePlatform } from '../../platform/testing/fakes';
import { GameStore } from '../../state/game.store';
import { ConfirmDialog } from './confirm-dialog';

describe('ConfirmDialog', () => {
  const setup = async () => {
    const confirm = vi.fn<() => void>();
    const dismiss = vi.fn<() => void>();
    const view = await render(ConfirmDialog, {
      inputs: {
        heading: 'Reset statistics',
        message: 'Clear everything?',
        confirmLabel: 'Reset',
        cancelLabel: 'Cancel',
      },
      on: { confirm, dismiss },
      providers: createFakePlatform().providers,
    });
    return { ...view, confirm, dismiss, dialog: screen.getByRole('alertdialog') };
  };

  afterEach(() => {
    document.body.replaceChildren();
  });

  it('opens as a modal alert dialog with its title and message', async () => {
    const { dialog } = await setup();
    expect(dialog).toHaveAttribute('open');
    expect(dialog).toHaveAccessibleName('Reset statistics');
    expect(dialog).toHaveAccessibleDescription('Clear everything?');
  });

  it('starts on Cancel, the default button, and reports the choice', async () => {
    const { confirm, dismiss } = await setup();
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    expect(cancelButton).toHaveFocus();
    expect(cancelButton).toHaveClass('bb-button--default');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(confirm).toHaveBeenCalledTimes(1);
    fireEvent.click(cancelButton);
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('cancels on Escape and when the browser closes it', async () => {
    const { dialog, dismiss } = await setup();
    const escape = new Event('cancel', { cancelable: true });
    fireEvent(dialog, escape);
    expect(escape.defaultPrevented).toBe(true);
    expect(dismiss).toHaveBeenCalledTimes(1);
    (dialog as HTMLDialogElement).close();
    expect(dismiss).toHaveBeenCalledTimes(2);
  });

  it('covers the board while open, then gives focus back without cancelling', async () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const { fixture, dismiss } = await setup();
    const store = TestBed.inject(GameStore);
    TestBed.tick();
    expect(store.covered()).toBe(true);
    fixture.destroy();
    TestBed.tick();
    expect(store.covered()).toBe(false);
    expect(opener).toHaveFocus();
    expect(dismiss).not.toHaveBeenCalled();
  });
});
