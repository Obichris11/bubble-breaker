import { render, screen } from '@testing-library/angular';
import { App } from './app';
import { createFakePlatform } from './platform/testing/fakes';
import { STRINGS } from './strings';

describe('App shell', () => {
  const setup = () => render(App, { providers: createFakePlatform().providers });

  it('shows the app title in the title bar', async () => {
    await setup();
    expect(screen.getByRole('banner')).toHaveTextContent(STRINGS.appTitle);
  });

  it('uses "Bubble Breaker" as the app title', () => {
    expect(STRINGS.appTitle).toBe('Bubble Breaker');
  });

  it('shows the board in the main area', async () => {
    await setup();
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('application'));
  });
});
