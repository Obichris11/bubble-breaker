import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { SoundService, SoundConfig } from '../../services/sound.service';

@Component({
  selector: 'app-sound-controls',
  imports: [CommonModule, FormsModule],
  templateUrl: './sound-controls.html',
  styleUrl: './sound-controls.scss'
})
export class SoundControlsComponent implements OnInit, OnDestroy {
  soundConfig: SoundConfig = {
    volume: 0.25,
    enabled: true
  };

  private destroy$ = new Subject<void>();

  constructor(private soundService: SoundService) {}

  ngOnInit(): void {
    this.soundService.config
      .pipe(takeUntil(this.destroy$))
      .subscribe(config => {
        this.soundConfig = config;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onVolumeChange(volume: number): void {
    this.soundService.updateConfig({ volume: volume / 100 });
  }

  toggleSoundEnabled(): void {
    this.soundService.updateConfig({ enabled: !this.soundConfig.enabled });
  }

  testSound(): void {
    this.soundService.playBallPop();
  }
}
