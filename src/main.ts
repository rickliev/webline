import { FIXED_STEP } from "./constants";
import { GameAudio } from "./audio";
import { InputController } from "./input";
import { GameRenderer } from "./renderer";
import { GameSimulation } from "./simulation";
import { storage } from "./storage";
import type { SimulationEvent } from "./types";
import "./styles.css";

const requireElement = <T extends Element>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
};

const canvas = requireElement<HTMLCanvasElement>("#game-canvas");
const startScreen = requireElement<HTMLElement>("#start-screen");
const gameOverScreen = requireElement<HTMLElement>("#game-over-screen");
const pauseScreen = requireElement<HTMLElement>("#pause-screen");
const startButton = requireElement<HTMLButtonElement>("#start-button");
const restartButton = requireElement<HTMLButtonElement>("#restart-button");
const soundToggle = requireElement<HTMLButtonElement>("#sound-toggle");
const hud = requireElement<HTMLElement>("#hud");
const scoreElement = requireElement<HTMLElement>("#score");
const comboElement = requireElement<HTMLElement>("#combo");
const distanceElement = requireElement<HTMLElement>("#distance");
const bestElement = requireElement<HTMLElement>("#best-score");
const finalScore = requireElement<HTMLElement>("#final-score");
const finalDistance = requireElement<HTMLElement>("#final-distance");
const finalBest = requireElement<HTMLElement>("#final-best");
const resultEyebrow = requireElement<HTMLElement>("#result-eyebrow");
const resultTitle = requireElement<HTMLElement>("#result-title");
const effectChip = requireElement<HTMLElement>("#effect-chip");
const predatorWarning = requireElement<HTMLElement>("#predator-warning");
const warningText = requireElement<HTMLElement>("#warning-text");
const announcer = requireElement<HTMLElement>("#announcer");

const simulation = new GameSimulation();
const renderer = new GameRenderer(canvas);
const audio = new GameAudio();
audio.enabled = storage.getSound();
let bestScore = storage.getBest();
let previousEvent: SimulationEvent | null = null;
let accumulator = 0;
let lastTime = performance.now();
let elapsed = 0;
let effectTimer = 0;
let pausedByVisibility = false;

bestElement.textContent = String(bestScore);
updateSoundButton();

const input = new InputController(
  canvas,
  (held) => {
    simulation.setDropHeld(held);
    if (held && simulation.phase === "playing") audio.pluck();
  },
  () => {
    if (simulation.phase === "ready" || simulation.phase === "gameOver") startGame();
  },
);

function startGame(): void {
  simulation.start();
  input.release();
  startScreen.classList.remove("is-visible");
  gameOverScreen.classList.remove("is-visible");
  pauseScreen.hidden = true;
  hud.hidden = false;
  effectChip.hidden = true;
  predatorWarning.hidden = true;
  previousEvent = null;
  accumulator = 0;
  lastTime = performance.now();
  audio.start();
  canvas.focus({ preventScroll: true });
  announcer.textContent = "Ascent started. Release to climb and hold to drop.";
}

function finishGame(event: Extract<SimulationEvent, { type: "gameOver" }>): void {
  const snapshot = simulation.snapshot();
  const previousBest = bestScore;
  bestScore = Math.max(bestScore, snapshot.score);
  storage.setBest(bestScore);
  bestElement.textContent = String(bestScore);
  finalScore.textContent = String(snapshot.score);
  finalDistance.textContent = `${Math.floor(snapshot.distance)}m`;
  finalBest.textContent = String(bestScore);
  const record = snapshot.score > previousBest;
  resultEyebrow.textContent = record ? "NEW CANOPY RECORD" : "THREAD BROKEN";
  resultTitle.innerHTML = record
    ? "A royal<br />ascent."
    : "The forest wins<br />this round.";
  hud.hidden = true;
  window.setTimeout(() => {
    gameOverScreen.classList.add("is-visible");
    restartButton.focus({ preventScroll: true });
  }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 320);
  announcer.textContent = `Run ended by ${event.cause}. Score ${snapshot.score}, height ${Math.floor(snapshot.distance)} meters.`;
}

function processEvent(event: SimulationEvent): void {
  audio.event(event);
  const snapshot = simulation.snapshot();
  if (event.type === "collect") {
    const insect = snapshot.entities.find(
      (entity) => entity.kind === "insect" && !entity.active,
    );
    renderer.burst(insect?.x ?? snapshot.spider.x, insect?.y ?? snapshot.spider.y, event.rare);
    showEffect(event.rare ? `RARE +${event.points}` : `INSECT +${event.points}`);
    announcer.textContent = `${event.rare ? "Rare insect" : "Insect"} collected. Score ${snapshot.score}.`;
  } else if (event.type === "glob") {
    showEffect("STICKY · CLIMB SLOWED");
    announcer.textContent = "Sticky glob. Climb slowed.";
  } else if (event.type === "twigBreak") {
    renderer.burst(snapshot.spider.x, snapshot.spider.y);
    showEffect("TWIG SNAPPED");
  } else if (event.type === "warning") {
    announcer.textContent = `${event.predator} approaching.`;
  } else {
    renderer.burst(snapshot.spider.x, snapshot.spider.y, true);
    finishGame(event);
  }
}

function showEffect(text: string): void {
  effectChip.textContent = text;
  effectChip.hidden = false;
  effectTimer = 1.4;
}

function updateHud(): void {
  const snapshot = simulation.snapshot();
  scoreElement.textContent = String(snapshot.score);
  comboElement.textContent = `×${snapshot.multiplier}`;
  distanceElement.textContent = `${Math.floor(snapshot.distance)}m`;
  audio.setTension(snapshot.difficulty);

  if (snapshot.warning) {
    warningText.textContent = `${snapshot.warning.toUpperCase()} INBOUND`;
    predatorWarning.hidden = false;
  } else {
    predatorWarning.hidden = true;
  }
}

function frame(now: number): void {
  const frameTime = Math.min(0.1, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  elapsed += frameTime;
  accumulator += frameTime;

  while (accumulator >= FIXED_STEP) {
    simulation.step(FIXED_STEP);
    renderer.updateEffects(FIXED_STEP);
    accumulator -= FIXED_STEP;
    const event = simulation.event;
    if (event && event !== previousEvent) processEvent(event);
    previousEvent = event;
  }

  effectTimer -= frameTime;
  if (effectTimer <= 0) effectChip.hidden = true;
  updateHud();
  renderer.render(simulation.snapshot(), accumulator / FIXED_STEP, elapsed);
  requestAnimationFrame(frame);
}

function updateSoundButton(): void {
  soundToggle.textContent = audio.enabled ? "♪" : "×";
  soundToggle.setAttribute("aria-label", audio.enabled ? "Mute sound" : "Enable sound");
  soundToggle.setAttribute("aria-pressed", String(!audio.enabled));
}

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);
soundToggle.addEventListener("click", () => {
  const enabled = audio.toggle();
  storage.setSound(enabled);
  updateSoundButton();
  if (enabled && simulation.phase === "playing") audio.start();
});

window.addEventListener("resize", () => renderer.resize());
document.addEventListener("visibilitychange", () => {
  if (document.hidden && simulation.phase === "playing") {
    simulation.pause();
    input.release();
    pausedByVisibility = true;
    pauseScreen.hidden = false;
    announcer.textContent = "Game paused.";
  } else if (pausedByVisibility && simulation.phase === "paused") {
    simulation.resume();
    pausedByVisibility = false;
    pauseScreen.hidden = true;
    lastTime = performance.now();
    accumulator = 0;
    announcer.textContent = "Game resumed.";
  }
});

new MutationObserver(() => renderer.refreshPalette()).observe(
  document.documentElement,
  { attributes: true, attributeFilter: ["data-theme"] },
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("./service-worker.js");
  });
}

requestAnimationFrame(frame);
