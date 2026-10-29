import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
  viewChildren,
} from '@angular/core';

export interface MenuItem {
  readonly id: string;
  readonly label: string;
  /** Draw a separator line above this item. */
  readonly separatorBefore?: boolean;
}

/**
 * Popup menu above the Menu softkey (02-ux "Accessibility"): focus starts on the first item,
 * arrows move it (wrapping), Home/End jump, Enter/Space choose, Esc or Tab closes. The host is a
 * transparent layer over everything above the softkeys; a press on it closes the menu.
 */
@Component({
  selector: 'bb-popup-menu',
  templateUrl: './popup-menu.html',
  styleUrl: './popup-menu.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(click)': 'onClick($event)', '(keydown)': 'onKeydown($event)' },
})
export class PopupMenu {
  readonly items = input.required<readonly MenuItem[]>();
  /** Accessible name of the menu. */
  readonly label = input.required<string>();
  readonly choose = output<string>();
  readonly dismiss = output();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly rows = viewChildren<ElementRef<HTMLButtonElement>>('row');

  constructor() {
    afterNextRender(() => {
      this.focusAt(0);
    });
  }

  protected onClick(event: MouseEvent): void {
    if (event.target === this.host.nativeElement) {
      this.dismiss.emit();
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    const rows = this.rows().map((row) => row.nativeElement);
    const current = rows.findIndex((row) => row === document.activeElement);
    switch (event.key) {
      case 'ArrowDown':
        this.focusAt((current + 1) % rows.length);
        break;
      case 'ArrowUp':
        this.focusAt((current - 1 + rows.length) % rows.length);
        break;
      case 'Home':
        this.focusAt(0);
        break;
      case 'End':
        this.focusAt(rows.length - 1);
        break;
      case 'Escape':
      case 'Tab':
        this.dismiss.emit();
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  protected focusAt(index: number): void {
    this.rows()[index]?.nativeElement.focus();
  }
}
