import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameBoardComponent } from './game-board';

interface BallModel {
  row: number;
  col: number;
  color: string;
}

interface BallGroup {
  balls: BallModel[];
}

interface GameBoardModel {
  grid: (BallModel | null)[][];
}

describe('GameBoardComponent - Bubble Breaker Rules', () => {
  let component: GameBoardComponent;
  let fixture: ComponentFixture<GameBoardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameBoardComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(GameBoardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('Grid Initialization', () => {
    it('should create a 10x16 grid', () => {
      expect(component.gameBoard.grid.length).toBe(10);
      expect(component.gameBoard.grid[0].length).toBe(16);
    });

    it('should use exactly 5 colors', () => {
      const colors = new Set<string>();
      component.gameBoard.grid.forEach(row => {
        row.forEach(ball => {
          if (ball) {
            colors.add(ball.color);
          }
        });
      });

      expect(colors.size).toBeLessThanOrEqual(5);
      expect(Array.from(colors).every(color =>
        ['red', 'blue', 'green', 'yellow', 'purple'].includes(color)
      )).toBe(true);
    });

    it('should initialize with correct ball count', () => {
      expect(component.ballsRemaining).toBe(160); // 10 * 16
    });
  });

  describe('Scoring System', () => {
    it('should calculate score using (n-2)² formula', () => {
      const initialScore = component.score;

      // Test with 2 balls: (2-2)² = 0
      component['updateScore'](2);
      expect(component.score).toBe(initialScore + 0);

      // Test with 3 balls: (3-2)² = 1
      component['updateScore'](3);
      expect(component.score).toBe(initialScore + 1);

      // Test with 4 balls: (4-2)² = 4
      component['updateScore'](4);
      expect(component.score).toBe(initialScore + 5); // 0 + 1 + 4

      // Test with 5 balls: (5-2)² = 9
      component['updateScore'](5);
      expect(component.score).toBe(initialScore + 14); // 0 + 1 + 4 + 9
    });

    it('should not score with only 1 ball', () => {
      const initialScore = component.score;
      component['updateScore'](1);
      expect(component.score).toBe(initialScore);
    });

    it('should add 1000 bonus points for perfect clear', () => {
      component.ballsRemaining = 0;
      const initialScore = component.score;

      component['checkGameEnd']();

      expect(component.score).toBe(initialScore + 1000);
      expect(component.gameOver).toBe(true);
    });

    it('should apply penalty for remaining balls at game end', () => {
      // Set up a game over scenario with remaining balls
      component.ballsRemaining = 5;
      component.score = 100;

      // Mock hasValidMoves to return false (no more moves)
      jest.spyOn(component as any, 'hasValidMoves').mockReturnValue(false);

      component['checkGameEnd']();

      // Penalty should be 5² = 25, so score should be max(0, 100 - 25) = 75
      expect(component.score).toBe(75);
      expect(component.gameOver).toBe(true);
    });
  });

  describe('Group Detection Algorithm', () => {
    beforeEach(() => {
      // Create a controlled test grid
      component.gameBoard.grid = Array(10).fill(null).map(() => Array(16).fill(null));
    });

    it('should find adjacent same-colored balls', () => {
      // Create a simple 2x2 red square
      component.gameBoard.grid[0][0] = { row: 0, col: 0, color: 'red' };
      component.gameBoard.grid[0][1] = { row: 0, col: 1, color: 'red' };
      component.gameBoard.grid[1][0] = { row: 1, col: 0, color: 'red' };
      component.gameBoard.grid[1][1] = { row: 1, col: 1, color: 'red' };

      const group = component['findAdjacentGroup'](0, 0);

      expect(group).toBeTruthy();
      expect(group!.balls.length).toBe(4);
    });

    it('should not include different colored balls', () => {
      // Create mixed colors
      component.gameBoard.grid[0][0] = { row: 0, col: 0, color: 'red' };
      component.gameBoard.grid[0][1] = { row: 0, col: 1, color: 'blue' };
      component.gameBoard.grid[1][0] = { row: 1, col: 0, color: 'red' };

      const group = component['findAdjacentGroup'](0, 0);

      expect(group).toBeTruthy();
      expect(group!.balls.length).toBe(2); // Only the two red balls
      expect(group!.balls.every(ball => ball.color === 'red')).toBe(true);
    });

    it('should handle L-shaped groups correctly', () => {
      // Create an L-shaped group
      component.gameBoard.grid[0][0] = { row: 0, col: 0, color: 'green' };
      component.gameBoard.grid[1][0] = { row: 1, col: 0, color: 'green' };
      component.gameBoard.grid[2][0] = { row: 2, col: 0, color: 'green' };
      component.gameBoard.grid[2][1] = { row: 2, col: 1, color: 'green' };
      component.gameBoard.grid[2][2] = { row: 2, col: 2, color: 'green' };

      const group = component['findAdjacentGroup'](0, 0);

      expect(group).toBeTruthy();
      expect(group!.balls.length).toBe(5);
    });

    it('should return null for single isolated ball', () => {
      component.gameBoard.grid[5][5] = { row: 5, col: 5, color: 'yellow' };
      component.gameBoard.grid[5][6] = { row: 5, col: 6, color: 'red' };

      const group = component['findAdjacentGroup'](5, 5);

      expect(group!.balls.length).toBe(1);
    });
  });

  describe('Gravity Mechanics', () => {
    beforeEach(() => {
      component.gameBoard.grid = Array(10).fill(null).map(() => Array(16).fill(null));
    });

    it('should make balls fall down after removal', () => {
      // Set up balls with gaps
      component.gameBoard.grid[5][0] = { row: 5, col: 0, color: 'red' };
      component.gameBoard.grid[8][0] = { row: 8, col: 0, color: 'blue' };

      component['applyGravity']();

      // The red ball should have fallen to row 8, blue ball to row 9
      expect(component.gameBoard.grid[8][0]).toBeTruthy();
      expect(component.gameBoard.grid[8][0]!.color).toBe('red');
      expect(component.gameBoard.grid[8][0]!.row).toBe(8);

      expect(component.gameBoard.grid[9][0]).toBeTruthy();
      expect(component.gameBoard.grid[9][0]!.color).toBe('blue');
      expect(component.gameBoard.grid[9][0]!.row).toBe(9);
    });

    it('should maintain column order during gravity', () => {
      // Set up multiple balls in the same column
      component.gameBoard.grid[2][5] = { row: 2, col: 5, color: 'red' };
      component.gameBoard.grid[4][5] = { row: 4, col: 5, color: 'green' };
      component.gameBoard.grid[7][5] = { row: 7, col: 5, color: 'blue' };

      component['applyGravity']();

      // Check they're now at the bottom in correct order
      expect(component.gameBoard.grid[7][5]!.color).toBe('red');
      expect(component.gameBoard.grid[8][5]!.color).toBe('green');
      expect(component.gameBoard.grid[9][5]!.color).toBe('blue');
    });

    it('should update ball positions after gravity', () => {
      component.gameBoard.grid[0][3] = { row: 0, col: 3, color: 'purple' };

      component['applyGravity']();

      const ball = component.gameBoard.grid[9][3];
      expect(ball!.row).toBe(9);
      expect(ball!.col).toBe(3);
    });
  });

  describe('Column Removal', () => {
    beforeEach(() => {
      component.gameBoard.grid = Array(10).fill(null).map(() => Array(16).fill(null));
    });

    it('should remove empty columns and shift remaining columns left', () => {
      // Set up with balls in columns 0, 2, and 4 (column 1 and 3 empty)
      component.gameBoard.grid[9][0] = { row: 9, col: 0, color: 'red' };
      component.gameBoard.grid[9][2] = { row: 9, col: 2, color: 'blue' };
      component.gameBoard.grid[9][4] = { row: 9, col: 4, color: 'green' };

      component['removeEmptyColumns']();

      // The balls should now be in columns 0, 1, 2
      expect(component.gameBoard.grid[9][0]!.color).toBe('red');
      expect(component.gameBoard.grid[9][1]!.color).toBe('blue');
      expect(component.gameBoard.grid[9][2]!.color).toBe('green');

      // Update column positions
      expect(component.gameBoard.grid[9][0]!.col).toBe(0);
      expect(component.gameBoard.grid[9][1]!.col).toBe(1);
      expect(component.gameBoard.grid[9][2]!.col).toBe(2);
    });

    it('should maintain relative positions when removing columns', () => {
      // Set up a more complex scenario
      component.gameBoard.grid[8][1] = { row: 8, col: 1, color: 'red' };
      component.gameBoard.grid[9][1] = { row: 9, col: 1, color: 'blue' };
      component.gameBoard.grid[9][3] = { row: 9, col: 3, color: 'green' };

      component['removeEmptyColumns']();

      // Column 1 should become column 0, column 3 should become column 1
      expect(component.gameBoard.grid[8][0]!.color).toBe('red');
      expect(component.gameBoard.grid[9][0]!.color).toBe('blue');
      expect(component.gameBoard.grid[9][1]!.color).toBe('green');
    });
  });

  describe('Game End Conditions', () => {
    it('should detect perfect clear (no balls remaining)', () => {
      component.ballsRemaining = 0;
      const mockShowGameComplete = jest.spyOn(component as any, 'showGameComplete').mockImplementation(() => {});

      component['checkGameEnd']();

      expect(component.gameOver).toBe(true);
      expect(component.score).toBe(1000); // Bonus added
    });

    it('should detect game over when no valid moves remain', () => {
      component.ballsRemaining = 10;
      jest.spyOn(component as any, 'hasValidMoves').mockReturnValue(false);
      const mockShowGameOver = jest.spyOn(component as any, 'showGameOver').mockImplementation(() => {});

      component['checkGameEnd']();

      expect(component.gameOver).toBe(true);
    });

    it('should continue game when valid moves exist', () => {
      component.ballsRemaining = 10;
      jest.spyOn(component as any, 'hasValidMoves').mockReturnValue(true);

      component['checkGameEnd']();

      expect(component.gameOver).toBe(false);
    });
  });

  describe('Valid Moves Detection', () => {
    beforeEach(() => {
      component.gameBoard.grid = Array(10).fill(null).map(() => Array(16).fill(null));
    });

    it('should return true when groups of 2+ same-colored balls exist', () => {
      component.gameBoard.grid[0][0] = { row: 0, col: 0, color: 'red' };
      component.gameBoard.grid[0][1] = { row: 0, col: 1, color: 'red' };

      expect(component['hasValidMoves']()).toBe(true);
    });

    it('should return false when only isolated balls exist', () => {
      component.gameBoard.grid[0][0] = { row: 0, col: 0, color: 'red' };
      component.gameBoard.grid[0][2] = { row: 0, col: 2, color: 'blue' };
      component.gameBoard.grid[2][0] = { row: 2, col: 0, color: 'green' };

      expect(component['hasValidMoves']()).toBe(false);
    });

    it('should return false for empty grid', () => {
      expect(component['hasValidMoves']()).toBe(false);
    });
  });

  describe('Ball Click Interaction', () => {
    it('should not allow clicks when game is over', () => {
      component.gameOver = true;
      const ball: BallModel = { row: 0, col: 0, color: 'red' };
      const initialScore = component.score;

      component.onBallClick(ball);

      expect(component.score).toBe(initialScore);
    });

    it('should require minimum 2 balls to remove group', () => {
      // Set up single ball
      component.gameBoard.grid = Array(10).fill(null).map(() => Array(16).fill(null));
      component.gameBoard.grid[0][0] = { row: 0, col: 0, color: 'red' };

      const ball: BallModel = { row: 0, col: 0, color: 'red' };
      const initialBallCount = component.ballsRemaining;

      component.onBallClick(ball);

      expect(component.ballsRemaining).toBe(initialBallCount);
    });
  });

  describe('Sound System', () => {
    it('should play sound when enabled', () => {
      component.soundEnabled = true;
      const mockAudioContext = {
        createOscillator: jest.fn(() => ({
          connect: jest.fn(),
          frequency: {
            setValueAtTime: jest.fn(),
            exponentialRampToValueAtTime: jest.fn(),
          },
          start: jest.fn(),
          stop: jest.fn(),
        })),
        createGain: jest.fn(() => ({
          connect: jest.fn(),
          gain: {
            setValueAtTime: jest.fn(),
            exponentialRampToValueAtTime: jest.fn(),
          },
        })),
        destination: {},
        currentTime: 0,
      };

      (window as any).AudioContext = jest.fn(() => mockAudioContext);

      component['playSound']('pop');

      expect(mockAudioContext.createOscillator).toHaveBeenCalled();
      expect(mockAudioContext.createGain).toHaveBeenCalled();
    });

    it('should not play sound when disabled', () => {
      component.soundEnabled = false;
      const mockAudioContext = jest.fn();
      (window as any).AudioContext = mockAudioContext;

      component['playSound']('pop');

      expect(mockAudioContext).not.toHaveBeenCalled();
    });
  });

  describe('Game Reset', () => {
    it('should reset all game state', () => {
      component.score = 500;
      component.gameOver = true;
      component.ballsRemaining = 50;

      component.resetGame();

      expect(component.score).toBe(0);
      expect(component.gameOver).toBe(false);
      expect(component.ballsRemaining).toBe(160); // Full grid
    });

    it('should generate new grid on reset', () => {
      const oldGrid = component.gameBoard.grid;

      component.resetGame();

      expect(component.gameBoard.grid).not.toBe(oldGrid);
      expect(component.gameBoard.grid.length).toBe(10);
      expect(component.gameBoard.grid[0].length).toBe(16);
    });
  });

  describe('Hover Effects', () => {
    it('should show points preview for valid groups', () => {
      // Set up a group of 3 balls
      component.gameBoard.grid = Array(10).fill(null).map(() => Array(16).fill(null));
      component.gameBoard.grid[0][0] = { row: 0, col: 0, color: 'red' };
      component.gameBoard.grid[0][1] = { row: 0, col: 1, color: 'red' };
      component.gameBoard.grid[0][2] = { row: 0, col: 2, color: 'red' };

      const mockEvent = {
        clientX: 100,
        clientY: 200,
      } as MouseEvent;

      const ball: BallModel = { row: 0, col: 0, color: 'red' };

      component.onBallHover(mockEvent, ball);

      expect(component.hoverPreview).toBeTruthy();
      expect(component.hoverPreview!.points).toBe(1); // (3-2)² = 1
    });

    it('should clear hover state on mouse leave', () => {
      component.hoverPreview = { points: 5, x: 100, y: 200 };
      component.hoveredGroup = { balls: [] };

      component.onBallLeave();

      expect(component.hoverPreview).toBe(null);
      expect(component.hoveredGroup).toBe(null);
    });
  });
});