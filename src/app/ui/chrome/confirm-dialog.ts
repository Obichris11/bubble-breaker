import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { Shell } from './shell';

let nextId = 0;

/**
 * Modal confirmation (02-ux "Accessibility"): a native `<dialog>` opened with `showModal()`, so
 * the browser traps focus and Esc cancels. Focus starts on Cancel, the default button, and goes
 * back to the element that had it when the dialog closes. Open while the component exists.
 */
@Component({
  selector: 'bb-confirm-dialog',
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialog {
  readonly heading = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmLabel = input.required<string>();
  readonly cancelLabel = input.required<string>();
  readonly confirm = output();
  readonly dismiss = output();

  protected readonly titleId = `bb-dialog-${String(nextId)}-title`;
  protected readonly messageId = `bb-dialog-${String(nextId++)}-message`;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly cancelButton = viewChild.required<ElementRef<HTMLButtonElement>>('cancelButton');
  private readonly opener = document.activeElement;
  private closing = false;

  constructor() {
    const release = inject(Shell).openDialog();
    afterNextRender(() => {
      this.dialog().nativeElement.showModal();
      this.cancelButton().nativeElement.focus();
    });
    inject(DestroyRef).onDestroy(() => {
      this.closing = true;
      this.dialog().nativeElement.close();
      release();
      if (this.opener instanceof HTMLElement) {
        this.opener.focus();
      }
    });
  }

  /** Esc: the parent decides, so the dialog stays until it is removed. */
  protected onCancel(event: Event): void {
    event.preventDefault();
    this.dismiss.emit();
  }

  /** The browser closed the dialog on its own (a repeated Esc skips `cancel`). */
  protected onClose(): void {
    if (!this.closing) {
      this.dismiss.emit();
    }
  }
}
