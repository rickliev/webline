const BEST_KEY = "webline.best-score";
const SOUND_KEY = "webline.sound-enabled";
const SPIDER_COLOR_KEY = "webline.spider-color";

export type SpiderColor = "emerald" | "sapphire" | "amethyst" | "ruby";

export const isSpiderColor = (value: string | null): value is SpiderColor =>
  value === "emerald" ||
  value === "sapphire" ||
  value === "amethyst" ||
  value === "ruby";

export const storage = {
  getBest(): number {
    try {
      return Number.parseInt(localStorage.getItem(BEST_KEY) ?? "0", 10) || 0;
    } catch {
      return 0;
    }
  },
  setBest(score: number): void {
    try {
      localStorage.setItem(BEST_KEY, String(score));
    } catch {
      // Private browsing policies may disable persistent storage.
    }
  },
  getSound(): boolean {
    try {
      return localStorage.getItem(SOUND_KEY) !== "false";
    } catch {
      return true;
    }
  },
  setSound(enabled: boolean): void {
    try {
      localStorage.setItem(SOUND_KEY, String(enabled));
    } catch {
      // Sound still works for the current session without storage.
    }
  },
  getSpiderColor(): SpiderColor {
    try {
      const value = localStorage.getItem(SPIDER_COLOR_KEY);
      if (value === "tanzanite") return "ruby";
      return isSpiderColor(value) ? value : "emerald";
    } catch {
      return "emerald";
    }
  },
  setSpiderColor(color: SpiderColor): void {
    try {
      localStorage.setItem(SPIDER_COLOR_KEY, color);
    } catch {
      // The selected color still applies for the current session.
    }
  },
};
