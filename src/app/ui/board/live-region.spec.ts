import { render, screen } from '@testing-library/angular';
import { LiveRegion } from './live-region';

describe('LiveRegion', () => {
  it('is a polite status region showing the message', async () => {
    const { rerender } = await render(LiveRegion, { inputs: { message: 'New game.' } });
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveTextContent('New game.');
    await rerender({ inputs: { message: 'Selection cleared.' } });
    expect(region).toHaveTextContent('Selection cleared.');
  });
});
