import type { PredatorKind, SimulationEvent } from "./types";

export class GameAudio {
  enabled = true;
  private context: AudioContext | null = null;
  private ambience: OscillatorNode | null = null;

  toggle(): boolean {
    this.enabled = !this.enabled;
    if (!this.enabled) this.stopAmbience();
    return this.enabled;
  }

  start(): void {
    if (!this.enabled) return;
    const context = this.getContext();
    if (!context || this.ambience) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 58;
    gain.gain.value = 0.008;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    this.ambience = oscillator;
  }

  stopAmbience(): void {
    this.ambience?.stop();
    this.ambience?.disconnect();
    this.ambience = null;
  }

  setTension(difficulty: number): void {
    if (!this.ambience || !this.context) return;
    this.ambience.frequency.setTargetAtTime(
      58 + difficulty * 34,
      this.context.currentTime,
      0.2,
    );
  }

  pluck(): void {
    this.tone(210, 0.06, 0.026, "triangle", 105);
  }

  event(event: SimulationEvent): void {
    if (event.type === "collect") {
      this.tone(event.rare ? 980 : 720, 0.12, 0.035, "sine", event.rare ? 1320 : 920);
    } else if (event.type === "glob") {
      this.tone(145, 0.16, 0.035, "sawtooth", 88);
    } else if (event.type === "twigBreak") {
      this.tone(190, 0.09, 0.045, "square", 75);
    } else if (event.type === "warning") {
      this.warning(event.predator);
    } else if (event.type === "gameOver") {
      this.stopAmbience();
      this.tone(170, 0.28, 0.045, "triangle", 65);
    }
  }

  private warning(predator: PredatorKind): void {
    if (predator === "bird") {
      this.cardinalCall();
      return;
    }
    const frequency = predator === "lizard" ? 330 : 260;
    this.tone(frequency, 0.09, 0.03, "square", frequency * 0.7);
  }

  private cardinalCall(): void {
    if (!this.enabled) return;
    const context = this.getContext();
    if (!context) return;

    for (const [delay, from, to, duration] of [
      [0, 1750, 1180, 0.18],
      [0.22, 1680, 1100, 0.17],
      [0.43, 2050, 1420, 0.12],
    ] as const) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + delay;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(from, start);
      oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.035, start + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + duration);
    }
  }

  private tone(
    from: number,
    duration: number,
    volume: number,
    type: OscillatorType,
    to: number,
  ): void {
    if (!this.enabled) return;
    const context = this.getContext();
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(1, to),
      context.currentTime + duration,
    );
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  }

  private getContext(): AudioContext | null {
    try {
      this.context ??= new AudioContext();
      if (this.context.state === "suspended") void this.context.resume();
      return this.context;
    } catch {
      this.enabled = false;
      return null;
    }
  }
}
