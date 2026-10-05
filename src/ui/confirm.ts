/**
 * Two-press confirm for a destructive button, in the page itself. The browser's `confirm()` dialog
 * returns false for good once its "don't show this again" box is ticked, which made Reset do nothing.
 * The first press changes the label; a second press within `windowMs` runs `action`.
 */
export function confirmPress(button: HTMLElement, prompt: string, action: () => void, windowMs = 4000): void {
  const label = button.textContent ?? '';
  let timer: number | undefined;
  const disarm = (): void => {
    window.clearTimeout(timer);
    timer = undefined;
    button.textContent = label;
  };
  button.addEventListener('click', () => {
    if (timer === undefined) {
      button.textContent = prompt;
      timer = window.setTimeout(disarm, windowMs);
      return;
    }
    disarm();
    action();
  });
}
