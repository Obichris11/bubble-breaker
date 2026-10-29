import { render, screen } from '@testing-library/angular';
import { VERSION } from '../../version';
import { AboutScreen } from './about-screen';

describe('AboutScreen', () => {
  it('shows the name, version, tribute note and privacy note', async () => {
    await render(AboutScreen);
    expect(screen.getByRole('heading', { name: 'About' })).toBeInTheDocument();
    expect(screen.getByText('Bubble Breaker')).toBeInTheDocument();
    expect(screen.getByText(`Version ${VERSION}`)).toBeInTheDocument();
    expect(screen.getByText(/Not affiliated with any original publisher\.$/)).toBeInTheDocument();
    expect(screen.getByText(/No accounts, no tracking\./)).toBeInTheDocument();
  });
});
