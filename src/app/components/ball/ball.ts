import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Ball as BallModel } from '../../models/ball.model';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ball',
  imports: [CommonModule],
  templateUrl: './ball.html',
  styleUrl: './ball.scss'
})
export class BallComponent {
  @Input() ball!: BallModel;
  @Input() colorblindMode = false;
  @Output() ballClick = new EventEmitter<BallModel>();
  @Output() ballDoubleClick = new EventEmitter<BallModel>();

  onBallClick(): void {
    this.ballClick.emit(this.ball);
  }

  onBallDoubleClick(): void {
    this.ballDoubleClick.emit(this.ball);
  }

  getBallClasses(): string {
    const classes = [`ball`, `ball--${this.ball.color}`];

    if (this.ball.isSelected) {
      classes.push('ball--selected');
    }

    if (this.ball.isMarkedForRemoval) {
      classes.push('ball--marked');
    }

    if (this.ball.isExploding) {
      classes.push('ball--exploding');
    }

    if (this.ball.isHovered) {
      classes.push('ball--hovered');
    }

    if (this.colorblindMode) {
      classes.push('ball--colorblind');
    }

    return classes.join(' ');
  }

  getBallPattern(): string {
    if (!this.colorblindMode) return '';

    const patterns: { [key: string]: string } = {
      red: '●',
      blue: '■',
      green: '▲',
      yellow: '★',
      purple: '◆'
    };

    return patterns[this.ball.color] || '';
  }
}
