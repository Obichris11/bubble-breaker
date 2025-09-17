import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { AnimationService, ParticleEffect } from '../../services/animation.service';

@Component({
  selector: 'app-particles',
  imports: [CommonModule],
  templateUrl: './particles.html',
  styleUrl: './particles.scss'
})
export class ParticlesComponent implements OnInit, OnDestroy {
  particles: ParticleEffect[] = [];
  private destroy$ = new Subject<void>();

  constructor(private animationService: AnimationService) {}

  ngOnInit(): void {
    this.animationService.particles
      .pipe(takeUntil(this.destroy$))
      .subscribe(particles => {
        this.particles = particles;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getParticleStyle(particle: ParticleEffect) {
    return {
      left: `${particle.x}px`,
      top: `${particle.y}px`,
      backgroundColor: particle.color,
      width: `${particle.size}px`,
      height: `${particle.size}px`,
      opacity: particle.life.toString()
    };
  }
}
