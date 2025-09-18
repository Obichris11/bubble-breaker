// Integration tests for Bubble Breaker game logic algorithms
// These tests validate the core game mechanics independent of Angular components

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

describe('Bubble Breaker Game Logic', () => {

  // Helper function to create a test grid
  function createTestGrid(rows: number = 10, cols: number = 16): (BallModel | null)[][] {
    return Array(rows).fill(null).map(() => Array(cols).fill(null));
  }

  // Helper function to find adjacent groups (extracted from component logic)
  function findAdjacentGroup(grid: (BallModel | null)[][], startRow: number, startCol: number): BallGroup | null {
    const startBall = grid[startRow]?.[startCol];
    if (!startBall) return null;

    const visited = new Set<string>();
    const group: BallModel[] = [];
    const stack = [{ row: startRow, col: startCol }];

    while (stack.length > 0) {
      const { row, col } = stack.pop()!;
      const key = `${row},${col}`;

      if (visited.has(key)) continue;
      visited.add(key);

      const ball = grid[row]?.[col];
      if (!ball || ball.color !== startBall.color) continue;

      group.push(ball);

      // Check adjacent cells
      const adjacent = [
        { row: row - 1, col },
        { row: row + 1, col },
        { row, col: col - 1 },
        { row, col: col + 1 }
      ];

      for (const adj of adjacent) {
        const adjKey = `${adj.row},${adj.col}`;
        if (!visited.has(adjKey) && grid[adj.row]?.[adj.col]?.color === startBall.color) {
          stack.push(adj);
        }
      }
    }

    return group.length > 0 ? { balls: group } : null;
  }

  // Helper function for scoring calculation
  function calculateScore(ballsRemoved: number): number {
    if (ballsRemoved < 2) return 0;
    return Math.pow(ballsRemoved - 2, 2);
  }

  describe('Scoring Algorithm', () => {
    it('should implement correct Bubble Breaker scoring formula', () => {
      // Test the exact scoring formula: (n-2)²
      const testCases = [
        { balls: 1, expectedScore: 0 },
        { balls: 2, expectedScore: 0 },
        { balls: 3, expectedScore: 1 },
        { balls: 4, expectedScore: 4 },
        { balls: 5, expectedScore: 9 },
        { balls: 6, expectedScore: 16 },
        { balls: 10, expectedScore: 64 },
        { balls: 20, expectedScore: 324 }
      ];

      testCases.forEach(({ balls, expectedScore }) => {
        expect(calculateScore(balls)).toBe(expectedScore);
      });
    });

    it('should handle edge cases', () => {
      expect(calculateScore(0)).toBe(0);
      expect(calculateScore(-1)).toBe(0);
      expect(calculateScore(1)).toBe(0);
    });

    it('should scale exponentially for large groups', () => {
      const scores = [
        calculateScore(10), // (10-2)² = 64
        calculateScore(15), // (15-2)² = 169
        calculateScore(20)  // (20-2)² = 324
      ];

      // Verify exponential growth
      expect(scores[1]).toBeGreaterThan(scores[0] * 2);
      expect(scores[2]).toBeGreaterThan(scores[1] * 1.5);
    });
  });

  describe('Group Detection Algorithm', () => {
    let grid: (BallModel | null)[][];

    beforeEach(() => {
      grid = createTestGrid();
    });

    it('should detect simple 2-ball horizontal group', () => {
      grid[5][5] = { row: 5, col: 5, color: 'red' };
      grid[5][6] = { row: 5, col: 6, color: 'red' };

      const group = findAdjacentGroup(grid, 5, 5);

      expect(group).toBeTruthy();
      expect(group!.balls.length).toBe(2);
      expect(group!.balls.every(ball => ball.color === 'red')).toBe(true);
    });

    it('should detect simple 2-ball vertical group', () => {
      grid[3][7] = { row: 3, col: 7, color: 'blue' };
      grid[4][7] = { row: 4, col: 7, color: 'blue' };

      const group = findAdjacentGroup(grid, 3, 7);

      expect(group).toBeTruthy();
      expect(group!.balls.length).toBe(2);
    });

    it('should detect complex shaped groups', () => {
      // Create a T-shaped group
      const positions = [
        [2, 5], [2, 6], [2, 7], // horizontal bar
        [3, 6], [4, 6]          // vertical stem
      ];

      positions.forEach(([row, col]) => {
        grid[row][col] = { row, col, color: 'green' };
      });

      const group = findAdjacentGroup(grid, 2, 5);

      expect(group!.balls.length).toBe(5);
      expect(group!.balls.every(ball => ball.color === 'green')).toBe(true);
    });

    it('should not include diagonal connections', () => {
      // Create a diagonal pattern that should NOT be connected
      grid[1][1] = { row: 1, col: 1, color: 'yellow' };
      grid[2][2] = { row: 2, col: 2, color: 'yellow' };
      grid[3][3] = { row: 3, col: 3, color: 'yellow' };

      const group = findAdjacentGroup(grid, 1, 1);

      expect(group!.balls.length).toBe(1); // Only the starting ball
    });

    it('should stop at different colors', () => {
      // Create a line with mixed colors
      grid[0][0] = { row: 0, col: 0, color: 'red' };
      grid[0][1] = { row: 0, col: 1, color: 'red' };
      grid[0][2] = { row: 0, col: 2, color: 'blue' }; // Different color
      grid[0][3] = { row: 0, col: 3, color: 'red' };

      const group = findAdjacentGroup(grid, 0, 0);

      expect(group!.balls.length).toBe(2); // Only the first two red balls
    });

    it('should handle large connected groups', () => {
      // Create a 5x5 square of same color
      for (let row = 2; row < 7; row++) {
        for (let col = 3; col < 8; col++) {
          grid[row][col] = { row, col, color: 'purple' };
        }
      }

      const group = findAdjacentGroup(grid, 2, 3);

      expect(group!.balls.length).toBe(25); // 5x5 = 25 balls
    });

    it('should handle irregular shapes correctly', () => {
      // Create an irregular connected shape
      const positions = [
        [1, 1], [1, 2],
        [2, 1],
        [3, 1], [3, 2], [3, 3],
        [4, 3]
      ];

      positions.forEach(([row, col]) => {
        grid[row][col] = { row, col, color: 'green' };
      });

      const group = findAdjacentGroup(grid, 1, 1);

      expect(group!.balls.length).toBe(7);
    });
  });

  describe('Grid Boundary Handling', () => {
    let grid: (BallModel | null)[][];

    beforeEach(() => {
      grid = createTestGrid();
    });

    it('should handle top edge correctly', () => {
      grid[0][5] = { row: 0, col: 5, color: 'red' };
      grid[0][6] = { row: 0, col: 6, color: 'red' };

      const group = findAdjacentGroup(grid, 0, 5);

      expect(group!.balls.length).toBe(2);
    });

    it('should handle bottom edge correctly', () => {
      grid[9][5] = { row: 9, col: 5, color: 'blue' };
      grid[9][6] = { row: 9, col: 6, color: 'blue' };

      const group = findAdjacentGroup(grid, 9, 5);

      expect(group!.balls.length).toBe(2);
    });

    it('should handle left edge correctly', () => {
      grid[5][0] = { row: 5, col: 0, color: 'green' };
      grid[6][0] = { row: 6, col: 0, color: 'green' };

      const group = findAdjacentGroup(grid, 5, 0);

      expect(group!.balls.length).toBe(2);
    });

    it('should handle right edge correctly', () => {
      grid[5][15] = { row: 5, col: 15, color: 'yellow' };
      grid[6][15] = { row: 6, col: 15, color: 'yellow' };

      const group = findAdjacentGroup(grid, 5, 15);

      expect(group!.balls.length).toBe(2);
    });

    it('should handle corner positions', () => {
      const corners = [
        { row: 0, col: 0 },    // top-left
        { row: 0, col: 15 },   // top-right
        { row: 9, col: 0 },    // bottom-left
        { row: 9, col: 15 }    // bottom-right
      ];

      corners.forEach(({ row, col }, index) => {
        const color = ['red', 'blue', 'green', 'yellow'][index];
        grid[row][col] = { row, col, color };

        const group = findAdjacentGroup(grid, row, col);

        expect(group!.balls.length).toBe(1);
        expect(group!.balls[0].color).toBe(color);
      });
    });
  });

  describe('Algorithm Performance', () => {
    it('should handle empty grid efficiently', () => {
      const grid = createTestGrid();

      const start = performance.now();
      for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 16; col++) {
          findAdjacentGroup(grid, row, col);
        }
      }
      const end = performance.now();

      // Should complete quickly even with many null checks
      expect(end - start).toBeLessThan(100); // 100ms threshold
    });

    it('should handle worst-case scenario (full same-color grid)', () => {
      const grid = createTestGrid();

      // Fill entire grid with same color
      for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 16; col++) {
          grid[row][col] = { row, col, color: 'red' };
        }
      }

      const start = performance.now();
      const group = findAdjacentGroup(grid, 0, 0);
      const end = performance.now();

      expect(group!.balls.length).toBe(160); // All balls
      expect(end - start).toBeLessThan(50); // Should still be fast
    });
  });

  describe('Algorithm Correctness', () => {
    it('should not modify original grid during group detection', () => {
      const grid = createTestGrid();
      grid[5][5] = { row: 5, col: 5, color: 'red' };
      grid[5][6] = { row: 5, col: 6, color: 'red' };

      const originalBall = { ...grid[5][5]! };

      findAdjacentGroup(grid, 5, 5);

      expect(grid[5][5]).toEqual(originalBall);
    });

    it('should detect all connected balls regardless of starting position', () => {
      const grid = createTestGrid();

      // Create a line of connected balls
      const positions = [[2, 3], [2, 4], [2, 5], [2, 6]];
      positions.forEach(([row, col]) => {
        grid[row][col] = { row, col, color: 'blue' };
      });

      // Test starting from different positions
      positions.forEach(([row, col]) => {
        const group = findAdjacentGroup(grid, row, col);
        expect(group!.balls.length).toBe(4);
      });
    });

    it('should handle circular/loop patterns correctly', () => {
      const grid = createTestGrid();

      // Create a square loop pattern
      const positions = [
        [2, 2], [2, 3], [2, 4],
        [3, 2],         [3, 4],
        [4, 2], [4, 3], [4, 4]
      ];

      positions.forEach(([row, col]) => {
        grid[row][col] = { row, col, color: 'purple' };
      });

      const group = findAdjacentGroup(grid, 2, 2);

      expect(group!.balls.length).toBe(8);
    });
  });
});