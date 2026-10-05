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
