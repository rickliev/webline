const BEST_KEY = "webline.best-score";
const SOUND_KEY = "webline.sound-enabled";

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
};
