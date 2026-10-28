/** Ball colours by index: 0 red, 1 blue, 2 green, 3 yellow, 4 purple (rule R3). */
export type Color = 0 | 1 | 2 | 3 | 4;

export interface Rules {
  readonly columns: number;
  readonly rows: number;
  /** Number of colours dealt; must not exceed the 5 values of `Color`. */
  readonly colors: number;
  readonly minGroup: number;
}

/** Standard style (rules R2, R3, R7). */
export const STANDARD_RULES: Rules = { columns: 11, rows: 12, colors: 5, minGroup: 2 };

/** Points for bursting a group of `size` balls: Y = X(X − 1) (rule R10). */
export function scoreFor(size: number): number {
  return size * (size - 1);
}
