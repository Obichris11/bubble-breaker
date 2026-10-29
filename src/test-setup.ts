import '@testing-library/jest-dom/vitest';

// jsdom 30 has no HTMLDialogElement.showModal() or close(). This stand-in only opens the dialog
// and fires `close`; the real focus trap, Esc and top layer are checked in the browser.
if (!('showModal' in HTMLDialogElement.prototype)) {
  Object.assign(HTMLDialogElement.prototype, {
    showModal(this: HTMLDialogElement): void {
      this.open = true;
    },
    close(this: HTMLDialogElement): void {
      if (this.open) {
        this.open = false;
        this.dispatchEvent(new Event('close'));
      }
    },
  });
}
