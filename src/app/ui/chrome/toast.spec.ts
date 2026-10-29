import { fireEvent, render, screen } from '@testing-library/angular';
import { Toast } from './toast';

describe('Toast', () => {
  it('is a status notice with a bold title and its detail', async () => {
    await render(Toast, {
      inputs: { heading: 'Ready to play offline.', detail: 'No connection needed.' },
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      'Ready to play offline. No connection needed.',
    );
    expect(screen.getByText('Ready to play offline.').tagName).toBe('STRONG');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('offers an action and a dismiss button when asked', async () => {
    const act = vi.fn<() => void>();
    const dismiss = vi.fn<() => void>();
    await render(Toast, {
      inputs: { heading: 'New version available.', actionLabel: 'Reload', dismissible: true },
      on: { act, dismiss },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(act).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(dismiss).toHaveBeenCalledTimes(1);
  });
});
