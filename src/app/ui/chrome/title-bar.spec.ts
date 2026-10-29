import { render, screen } from '@testing-library/angular';
import { TitleBar } from './title-bar';

describe('TitleBar', () => {
  it('is the banner with the app title', async () => {
    await render(TitleBar);
    expect(screen.getByRole('banner')).toHaveTextContent('Bubble Breaker');
  });
});
