import { Injectable } from '@angular/core';
import { Ball, BallColor, Position, BallGroup } from '../models/ball.model';
import { GameBoard, GameConfig } from '../models/game.model';

@Injectable({
  providedIn: 'root'
})
export class GridService {

  generateRandomGrid(config: GameConfig): GameBoard {
    const grid: (Ball | null)[][] = [];

    for (let row = 0; row < config.rows; row++) {
      grid[row] = [];
      for (let col = 0; col < config.cols; col++) {
        const randomColor = config.colors[Math.floor(Math.random() * config.colors.length)];
        grid[row][col] = {
          id: `${row}-${col}`,
          color: randomColor,
          row,
          col,
          isSelected: false,
          isMarkedForRemoval: false
        };
      }
    }

    return {
      grid,
      rows: config.rows,
      cols: config.cols
    };
  }

  findAdjacentGroup(grid: (Ball | null)[][], startRow: number, startCol: number): BallGroup | null {
    const ball = grid[startRow]?.[startCol];
    if (!ball) return null;

    const visited = new Set<string>();
    const group: Ball[] = [];
    const color = ball.color;

    this.floodFill(grid, startRow, startCol, color, visited, group);

    return group.length >= 2 ? { balls: group, color, size: group.length } : null;
  }

  private floodFill(
    grid: (Ball | null)[][],
    row: number,
    col: number,
    targetColor: BallColor,
    visited: Set<string>,
    group: Ball[]
  ): void {
    const key = `${row}-${col}`;

    if (visited.has(key) ||
        row < 0 || row >= grid.length ||
        col < 0 || col >= grid[0].length) {
      return;
    }

    const ball = grid[row][col];
    if (!ball || ball.color !== targetColor) return;

    visited.add(key);
    group.push(ball);

    // Check all 4 directions (up, down, left, right)
    this.floodFill(grid, row - 1, col, targetColor, visited, group);
    this.floodFill(grid, row + 1, col, targetColor, visited, group);
    this.floodFill(grid, row, col - 1, targetColor, visited, group);
    this.floodFill(grid, row, col + 1, targetColor, visited, group);
  }

  removeBalls(grid: (Ball | null)[][], ballsToRemove: Ball[]): void {
    ballsToRemove.forEach(ball => {
      grid[ball.row][ball.col] = null;
    });
  }

  applyGravity(grid: (Ball | null)[][]): void {
    const rows = grid.length;
    const cols = grid[0].length;

    for (let col = 0; col < cols; col++) {
      let writeIndex = rows - 1;

      for (let row = rows - 1; row >= 0; row--) {
        if (grid[row][col] !== null) {
          const ball = grid[row][col]!;
          ball.row = writeIndex;
          grid[writeIndex][col] = ball;
          if (writeIndex !== row) {
            grid[row][col] = null;
          }
          writeIndex--;
        }
      }
    }
  }

  removeEmptyColumns(grid: (Ball | null)[][]): void {
    const rows = grid.length;
    const cols = grid[0].length;
    let writeCol = 0;

    for (let col = 0; col < cols; col++) {
      let hasAnyBall = false;

      for (let row = 0; row < rows; row++) {
        if (grid[row][col] !== null) {
          hasAnyBall = true;
          break;
        }
      }

      if (hasAnyBall) {
        if (writeCol !== col) {
          for (let row = 0; row < rows; row++) {
            const ball = grid[row][col];
            if (ball) {
              ball.col = writeCol;
            }
            grid[row][writeCol] = ball;
            grid[row][col] = null;
          }
        }
        writeCol++;
      }
    }
  }

  hasValidMoves(grid: (Ball | null)[][]): boolean {
    const rows = grid.length;
    const cols = grid[0].length;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (grid[row][col] && this.findAdjacentGroup(grid, row, col)) {
          return true;
        }
      }
    }
    return false;
  }

  clearSelection(grid: (Ball | null)[][]): void {
    grid.forEach(row => {
      row.forEach(ball => {
        if (ball) {
          ball.isSelected = false;
          ball.isMarkedForRemoval = false;
        }
      });
    });
  }

  markGroupForSelection(group: BallGroup): void {
    group.balls.forEach(ball => {
      ball.isSelected = true;
    });
  }
}