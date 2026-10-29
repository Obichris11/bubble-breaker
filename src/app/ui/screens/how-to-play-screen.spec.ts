import { render, screen } from '@testing-library/angular';
import { HowToPlayScreen } from './how-to-play-screen';

describe('HowToPlayScreen', () => {
  beforeEach(async () => {
    await render(HowToPlayScreen);
  });

  it('explains selecting, bursting and the end of the game', () => {
    expect(screen.getByRole('heading', { name: 'How to Play' })).toBeInTheDocument();
    expect(screen.getByText(/^Tap a group of two or more touching balls/)).toBeInTheDocument();
    expect(screen.getByText(/empty columns close up to the right/)).toBeInTheDocument();
    expect(screen.getByText(/There is no undo\.$/)).toBeInTheDocument();
  });

  it('shows the points table (02-ux: 2→2, 5→20, 10→90, 20→380)', () => {
    expect(screen.getByText('Points = n × (n − 1)')).toBeInTheDocument();
    const pairs = screen
      .getAllByRole('term')
      .map((term) => `${term.textContent}=${term.nextElementSibling?.textContent ?? ''}`);
    expect(pairs).toEqual(['2 balls=2', '5 balls=20', '10 balls=90', '20 balls=380']);
  });

  it('lists the keyboard keys, N and M included', () => {
    expect(screen.getByText(/^Keyboard: arrow keys move/)).toHaveTextContent(
      'N starts a new game and M opens the menu.',
    );
  });
});
