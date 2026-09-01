export type GamePhase = "ready" | "playing" | "paused" | "gameOver";
export type PredatorKind = "frog" | "lizard" | "bird";

export interface Spider {
  x: number;
  y: number;
  previousY: number;
  velocityY: number;
  radius: number;
  dropHeld: boolean;
  slowTimer: number;
  invulnerableTimer: number;
}

interface EntityBase {
  id: number;
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  active: boolean;
}

export interface Insect extends EntityBase {
  kind: "insect";
  radius: number;
  rare: boolean;
  phase: number;
  originX: number;
  amplitude: number;
}

export interface StickyGlob extends EntityBase {
  kind: "glob";
  radius: number;
  velocityX: number;
  touched: boolean;
}

export interface Twig extends EntityBase {
  kind: "twig";
  width: number;
  height: number;
  velocityX: number;
  breakable: boolean;
  broken: boolean;
}

export interface WindZone extends EntityBase {
  kind: "wind";
  width: number;
  height: number;
  force: number;
}

export interface Predator extends EntityBase {
  kind: "predator";
  predatorKind: PredatorKind;
  radius: number;
  velocityX: number;
  state: "warning" | "attack";
  timer: number;
  targetY: number;
}

export type Entity = Insect | StickyGlob | Twig | WindZone | Predator;

export interface GameSnapshot {
  phase: GamePhase;
  spider: Spider;
  entities: Entity[];
  score: number;
  combo: number;
  multiplier: number;
  distance: number;
  difficulty: number;
  worldOffset: number;
  warning: PredatorKind | null;
  event: SimulationEvent | null;
}

export type SimulationEvent =
  | { type: "collect"; rare: boolean; points: number }
  | { type: "glob" }
  | { type: "twigBreak" }
  | { type: "gameOver"; cause: string }
  | { type: "warning"; predator: PredatorKind };
