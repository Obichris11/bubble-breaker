import { render, screen } from '@testing-library/angular';
import { PointsBubble } from './points-bubble';

describe('PointsBubble', () => {
  it('shows the points at the given spot, hidden from screen readers', async () => {
    await render(PointsBubble, { inputs: { text: '30 points', x: 176, y: 158 } });
    const bubble = screen.getByText('30 points');
    expect(bubble).toHaveAttribute('aria-hidden', 'true');
    expect(bubble).toHaveStyle({ left: '176px', top: '158px' });
    expect(bubble).not.toHaveClass('below');
  });

  it('flips below the ball for the top row', async () => {
    await render(PointsBubble, { inputs: { text: '2 points', x: 34, y: 34, below: true } });
    expect(screen.getByText('2 points')).toHaveClass('below');
  });
});
