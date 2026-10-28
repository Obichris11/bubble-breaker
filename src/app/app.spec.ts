import { render, screen } from '@testing-library/angular';
import { App } from './app';
import { STRINGS } from './strings';

describe('App shell', () => {
  it('shows the app title in the title bar', async () => {
    await render(App);
    expect(screen.getByRole('banner')).toHaveTextContent(STRINGS.appTitle);
  });

  it('uses "Bubble Breaker" as the app title', () => {
    expect(STRINGS.appTitle).toBe('Bubble Breaker');
  });
});
