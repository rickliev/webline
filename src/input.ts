export class InputController {
  private held = false;
  private readonly onChange: (held: boolean) => void;
  private readonly onStart: () => void;
  private readonly target: HTMLElement;

  constructor(
    target: HTMLElement,
    onChange: (held: boolean) => void,
    onStart: () => void,
  ) {
    this.target = target;
    this.onChange = onChange;
    this.onStart = onStart;
    this.bind();
  }

  release(): void {
    this.setHeld(false);
  }

  private bind(): void {
    window.addEventListener("keydown", (event) => {
      if (event.code !== "Space" && event.code !== "ArrowDown") return;
      event.preventDefault();
      if (event.repeat) return;
      this.onStart();
      this.setHeld(true);
    });

    window.addEventListener("keyup", (event) => {
      if (event.code !== "Space" && event.code !== "ArrowDown") return;
      event.preventDefault();
      this.setHeld(false);
    });

    this.target.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 && event.pointerType === "mouse") return;
      event.preventDefault();
      this.target.setPointerCapture(event.pointerId);
      this.onStart();
      this.setHeld(true);
    });
    this.target.addEventListener("pointerup", (event) => {
      event.preventDefault();
      this.setHeld(false);
    });
    this.target.addEventListener("pointercancel", () => this.setHeld(false));
    this.target.addEventListener("lostpointercapture", () => this.setHeld(false));
    window.addEventListener("blur", () => this.setHeld(false));
  }

  private setHeld(held: boolean): void {
    if (this.held === held) return;
    this.held = held;
    this.onChange(held);
  }
}
