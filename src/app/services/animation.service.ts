import { Injectable } from '@angular/core';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { Ball } from '../models/ball.model';

export interface AnimationConfig {
  duration: number;
  easing: string;
  delay?: number;
}

export interface ParticleEffect {
  x: number;
  y: number;
  color: string;
  velocity: { x: number; y: number };
  life: number;
  size: number;
}

@Injectable({
  providedIn: 'root'
})
export class AnimationService {
  private animationQueue$ = new Subject<() => Promise<void>>();
  private isAnimating$ = new BehaviorSubject<boolean>(false);
  private particles$ = new BehaviorSubject<ParticleEffect[]>([]);

  public isAnimating = this.isAnimating$.asObservable();
  public particles = this.particles$.asObservable();

  private readonly defaultAnimations = {
    ballExplode: { duration: 400, easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)' },
    ballFall: { duration: 300, easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' },
    ballSelection: { duration: 150, easing: 'ease-out' },
    scorePopup: { duration: 600, easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)' }
  };

  constructor() {
    this.processAnimationQueue();
  }

  animateBallExplode(balls: Ball[], onComplete?: () => void): Promise<void> {
    return new Promise((resolve) => {
      this.isAnimating$.next(true);

      // Create particle effects for each ball
      balls.forEach(ball => {
        this.createParticleExplosion(ball);
      });

      // Animate ball scaling and fading
      const animations = balls.map(ball => {
        const ballElement = document.querySelector(`[data-ball-id="${ball.row}-${ball.col}"]`) as HTMLElement;
        if (!ballElement) return Promise.resolve();

        return this.animateElement(ballElement, {
          transform: 'scale(1.5) rotate(180deg)',
          opacity: '0'
        }, this.defaultAnimations.ballExplode);
      });

      Promise.all(animations).then(() => {
        setTimeout(() => {
          this.isAnimating$.next(false);
          if (onComplete) onComplete();
          resolve();
        }, 100);
      });
    });
  }

  animateBallsFalling(grid: (Ball | null)[][]): Promise<void> {
    return new Promise((resolve) => {
      this.isAnimating$.next(true);

      const animations: Promise<void>[] = [];
      let maxDelay = 0;

      for (let col = 0; col < grid[0].length; col++) {
        let fallDistance = 0;

        for (let row = grid.length - 1; row >= 0; row--) {
          const ball = grid[row][col];
          if (ball) {
            const ballElement = document.querySelector(`[data-ball-id="${ball.row}-${ball.col}"]`) as HTMLElement;
            if (ballElement && fallDistance > 0) {
              const delay = col * 50; // Stagger columns
              maxDelay = Math.max(maxDelay, delay);

              animations.push(
                this.animateElement(
                  ballElement,
                  { transform: `translateY(${fallDistance * 60}px)` },
                  { ...this.defaultAnimations.ballFall, delay }
                )
              );
            }
          } else {
            fallDistance++;
          }
        }
      }

      Promise.all(animations).then(() => {
        setTimeout(() => {
          this.isAnimating$.next(false);
          resolve();
        }, maxDelay + this.defaultAnimations.ballFall.duration);
      });
    });
  }

  animateBallSelection(balls: Ball[]): Promise<void> {
    return new Promise((resolve) => {
      const animations = balls.map((ball, index) => {
        const ballElement = document.querySelector(`[data-ball-id="${ball.row}-${ball.col}"]`) as HTMLElement;
        if (!ballElement) return Promise.resolve();

        return this.animateElement(ballElement, {
          transform: 'scale(1.1)',
          boxShadow: '0 0 20px rgba(255, 255, 0, 0.8)',
          zIndex: '10'
        }, { ...this.defaultAnimations.ballSelection, delay: index * 30 });
      });

      Promise.all(animations).then(() => resolve());
    });
  }

  animateScorePopup(element: HTMLElement, score: number): Promise<void> {
    return new Promise((resolve) => {
      const scorePopup = document.createElement('div');
      scorePopup.textContent = `+${score}`;
      scorePopup.className = 'score-popup';
      scorePopup.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 24px;
        font-weight: bold;
        color: #00ff00;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
        pointer-events: none;
        z-index: 1000;
      `;

      element.appendChild(scorePopup);

      this.animateElement(scorePopup, {
        transform: 'translate(-50%, -150%) scale(1.5)',
        opacity: '0'
      }, this.defaultAnimations.scorePopup).then(() => {
        element.removeChild(scorePopup);
        resolve();
      });
    });
  }

  private animateElement(
    element: HTMLElement,
    properties: Partial<CSSStyleDeclaration>,
    config: AnimationConfig
  ): Promise<void> {
    return new Promise((resolve) => {
      const performAnimation = () => {
        element.style.transition = `all ${config.duration}ms ${config.easing}`;

        Object.entries(properties).forEach(([property, value]) => {
          (element.style as any)[property] = value;
        });

        setTimeout(() => {
          element.style.transition = '';
          resolve();
        }, config.duration);
      };

      if (config.delay) {
        setTimeout(() => performAnimation(), config.delay);
      } else {
        performAnimation();
      }
    });
  }

  private createParticleExplosion(ball: Ball): void {
    const particles: ParticleEffect[] = [];
    const particleCount = 8;
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57'];

    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const speed = 2 + Math.random() * 3;

      particles.push({
        x: ball.col * 60 + 30, // Assuming 60px ball size
        y: ball.row * 60 + 30,
        color: colors[Math.floor(Math.random() * colors.length)],
        velocity: {
          x: Math.cos(angle) * speed,
          y: Math.sin(angle) * speed
        },
        life: 1.0,
        size: 4 + Math.random() * 4
      });
    }

    this.particles$.next([...this.particles$.value, ...particles]);
    this.animateParticles();
  }

  private animateParticles(): void {
    const animate = () => {
      const currentParticles = this.particles$.value;
      const activeParticles = currentParticles
        .map(particle => ({
          ...particle,
          x: particle.x + particle.velocity.x,
          y: particle.y + particle.velocity.y,
          velocity: {
            x: particle.velocity.x * 0.98,
            y: particle.velocity.y * 0.98 + 0.1 // gravity
          },
          life: particle.life - 0.02,
          size: particle.size * 0.98
        }))
        .filter(particle => particle.life > 0);

      this.particles$.next(activeParticles);

      if (activeParticles.length > 0) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }

  clearAnimations(): void {
    this.isAnimating$.next(false);
    this.particles$.next([]);
  }

  private processAnimationQueue(): void {
    this.animationQueue$.subscribe(async (animation) => {
      await animation();
    });
  }

  queueAnimation(animation: () => Promise<void>): void {
    this.animationQueue$.next(animation);
  }
}