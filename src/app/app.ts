import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { STRINGS } from './strings';
import { BoardArea } from './ui/board/board-area';

@Component({
  selector: 'bb-root',
  imports: [RouterOutlet, BoardArea],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly strings = STRINGS;
}
