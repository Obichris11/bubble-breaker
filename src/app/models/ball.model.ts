export enum BallColor {
  RED = 'red',
  BLUE = 'blue',
  GREEN = 'green',
  YELLOW = 'yellow',
  PURPLE = 'purple'
}

export interface Ball {
  id: string;
  color: BallColor;
  row: number;
  col: number;
  isSelected: boolean;
  isMarkedForRemoval: boolean;
  isExploding?: boolean;
  isHovered?: boolean;
}

export interface Position {
  row: number;
  col: number;
}

export interface BallGroup {
  balls: Ball[];
  color: BallColor;
  size: number;
}