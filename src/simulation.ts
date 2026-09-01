import { WORLD } from "./constants";
import { SeededRandom } from "./random";
import type {
  Entity,
  GamePhase,
  GameSnapshot,
  Insect,
  Predator,
  PredatorKind,
  SimulationEvent,
  Spider,
  StickyGlob,
  Twig,
  WindZone,
} from "./types";

const moveToward = (value: number, target: number, maxDelta: number): number => {
  if (Math.abs(target - value) <= maxDelta) return target;
  return value + Math.sign(target - value) * maxDelta;
};

const circlesOverlap = (
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number,
): boolean => {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy <= (ar + br) * (ar + br);
};

const circleIntersectsRect = (
  cx: number,
  cy: number,
  radius: number,
  x: number,
  y: number,
  width: number,
  height: number,
): boolean => {
  const nearestX = Math.max(x, Math.min(cx, x + width));
  const nearestY = Math.max(y, Math.min(cy, y + height));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy <= radius * radius;
};

export class GameSimulation {
  phase: GamePhase = "ready";
  spider: Spider = this.createSpider();
  entities: Entity[] = [];
  score = 0;
  combo = 0;
  distance = 0;
  difficulty = 0;
  worldOffset = 0;
  warning: PredatorKind | null = null;
  event: SimulationEvent | null = null;

  private random: SeededRandom;
  private spawnTimer = 0.65;
  private distanceScoreMark = 100;
  private nextId = 1;
  private elapsed = 0;

  constructor(seed = Date.now()) {
    this.random = new SeededRandom(seed);
  }

  start(seed = Date.now()): void {
    this.random = new SeededRandom(seed);
    this.phase = "playing";
    this.spider = this.createSpider();
    this.entities = [];
    this.score = 0;
    this.combo = 0;
    this.distance = 0;
    this.difficulty = 0;
    this.worldOffset = 0;
    this.warning = null;
    this.event = null;
    this.spawnTimer = 0.75;
    this.distanceScoreMark = 100;
    this.nextId = 1;
    this.elapsed = 0;
  }

  setDropHeld(held: boolean): void {
    this.spider.dropHeld = held;
  }

  pause(): void {
    if (this.phase === "playing") this.phase = "paused";
  }

  resume(): void {
    if (this.phase === "paused") this.phase = "playing";
  }

  step(dt: number): void {
    if (this.phase !== "playing") return;
    this.event = null;
    this.elapsed += dt;
    this.difficulty = Math.min(1, this.elapsed / 105);
    const worldSpeed =
      WORLD.worldSpeed + (WORLD.maxWorldSpeed - WORLD.worldSpeed) * this.difficulty;
    this.distance += worldSpeed * dt * WORLD.distanceScale;
    this.worldOffset = (this.worldOffset + worldSpeed * dt) % 160;

    if (this.distance >= this.distanceScoreMark) {
      this.score += 1;
      this.distanceScoreMark += 100;
    }

    this.updateSpider(dt);
    this.updateEntities(dt, worldSpeed);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnPattern();
      const interval =
        WORLD.spawnInterval -
        (WORLD.spawnInterval - WORLD.minSpawnInterval) * this.difficulty;
      this.spawnTimer = interval * this.random.range(0.86, 1.15);
    }

    this.resolveInteractions(dt);
    this.entities = this.entities.filter(
      (entity) => entity.active && entity.y < WORLD.height + 180,
    );

    if (this.spider.y + this.spider.radius >= WORLD.bottomLimit) {
      this.finish("the forest floor");
    }
  }

  snapshot(): GameSnapshot {
    return {
      phase: this.phase,
      spider: { ...this.spider },
      entities: this.entities.map((entity) => ({ ...entity })),
      score: this.score,
      combo: this.combo,
      multiplier: this.multiplier,
      distance: this.distance,
      difficulty: this.difficulty,
      worldOffset: this.worldOffset,
      warning: this.warning,
      event: this.event,
    };
  }

  get multiplier(): number {
    return Math.min(5, 1 + Math.floor(this.combo / 5));
  }

  private createSpider(): Spider {
    return {
      x: WORLD.webX,
      y: WORLD.height * 0.58,
      previousY: WORLD.height * 0.58,
      velocityY: 0,
      radius: WORLD.spiderRadius,
      dropHeld: false,
      slowTimer: 0,
      invulnerableTimer: 0,
    };
  }

  private updateSpider(dt: number): void {
    const spider = this.spider;
    spider.previousY = spider.y;
    spider.slowTimer = Math.max(0, spider.slowTimer - dt);
    spider.invulnerableTimer = Math.max(0, spider.invulnerableTimer - dt);
    const target = spider.dropHeld
      ? WORLD.dropSpeed
      : spider.slowTimer > 0
        ? WORLD.slowedClimbSpeed
        : WORLD.climbSpeed;
    const acceleration = spider.dropHeld
      ? WORLD.dropAcceleration
      : WORLD.climbAcceleration;
    spider.velocityY = moveToward(spider.velocityY, target, acceleration * dt);
    spider.y += spider.velocityY * dt;

    if (spider.y - spider.radius < WORLD.topLimit) {
      spider.y = WORLD.topLimit + spider.radius;
      spider.velocityY = Math.max(28, spider.velocityY * -0.2);
    }
  }

  private updateEntities(dt: number, worldSpeed: number): void {
    this.warning = null;
    for (const entity of this.entities) {
      entity.previousX = entity.x;
      entity.previousY = entity.y;

      if (entity.kind === "predator") {
        this.updatePredator(entity, dt);
      } else {
        entity.y += worldSpeed * dt;
      }

      if (entity.kind === "glob" || entity.kind === "twig") {
        entity.x += entity.velocityX * dt;
      } else if (entity.kind === "insect") {
        entity.x =
          entity.originX +
          Math.sin(this.elapsed * 3.2 + entity.phase) * entity.amplitude;
      }
    }
  }

  private updatePredator(predator: Predator, dt: number): void {
    predator.timer -= dt;
    if (predator.state === "warning") {
      this.warning = predator.predatorKind;
      if (predator.timer <= 0) {
        predator.state = "attack";
        predator.timer = 5;
        this.event = { type: "warning", predator: predator.predatorKind };
      }
      return;
    }

    if (predator.predatorKind === "frog") {
      predator.x += predator.velocityX * dt;
      predator.y =
        predator.targetY - Math.abs(Math.sin(predator.timer * 3.2)) * 75;
    } else if (predator.predatorKind === "lizard") {
      predator.x += predator.velocityX * dt;
      if (predator.y < WORLD.height * 0.56) {
        predator.y += Math.sign(predator.targetY - predator.y) * 72 * dt;
      }
    } else {
      predator.x += predator.velocityX * dt;
      predator.y += Math.sign(predator.targetY - predator.y) * 155 * dt;
    }

    if (predator.timer <= 0 || predator.x < -140 || predator.x > WORLD.width + 140) {
      predator.active = false;
    }
  }

  private spawnPattern(): void {
    const roll = this.random.next();
    if (this.difficulty > 0.2 && roll < 0.11 + this.difficulty * 0.08) {
      this.spawnPredator();
      return;
    }

    if (roll < 0.37) this.spawnTwigPattern();
    else if (roll < 0.61) this.spawnGlobPattern();
    else if (roll < 0.77) this.spawnWindPattern();
    else this.spawnInsectTrail();
  }

  private spawnTwigPattern(): void {
    const fromLeft = this.random.next() > 0.5;
    const width = this.random.range(180, 315);
    const twig: Twig = {
      id: this.nextId++,
      kind: "twig",
      x: fromLeft ? -width : WORLD.width,
      y: -70,
      previousX: fromLeft ? -width : WORLD.width,
      previousY: -70,
      width,
      height: this.random.range(22, 34),
      velocityX: (fromLeft ? 1 : -1) * this.random.range(255, 350),
      breakable: this.random.next() < 0.3,
      broken: false,
      active: true,
    };
    this.entities.push(twig);
    this.spawnInsect(
      fromLeft ? Math.min(WORLD.width - 80, width + 100) : Math.max(80, WORLD.width - width - 100),
      -128,
      false,
    );
  }

  private spawnGlobPattern(): void {
    const fromLeft = this.random.next() > 0.5;
    const glob: StickyGlob = {
      id: this.nextId++,
      kind: "glob",
      x: fromLeft ? -35 : WORLD.width + 35,
      y: -55,
      previousX: fromLeft ? -35 : WORLD.width + 35,
      previousY: -55,
      radius: this.random.range(28, 40),
      velocityX: (fromLeft ? 1 : -1) * this.random.range(270, 365),
      touched: false,
      active: true,
    };
    this.entities.push(glob);
    this.spawnInsect(WORLD.webX + this.random.range(-95, 95), -145, false);
  }

  private spawnWindPattern(): void {
    const wind: WindZone = {
      id: this.nextId++,
      kind: "wind",
      x: WORLD.webX - 150,
      y: -180,
      previousX: WORLD.webX - 150,
      previousY: -180,
      width: 300,
      height: 150,
      force: this.random.next() > 0.5 ? -465 : 495,
      active: true,
    };
    this.entities.push(wind);
    this.spawnInsect(WORLD.webX, -105, this.random.next() < 0.12);
  }

  private spawnInsectTrail(): void {
    const count = this.random.next() < 0.3 ? 3 : 2;
    const rareIndex = this.random.next() < 0.15 ? count - 1 : -1;
    for (let index = 0; index < count; index += 1) {
      this.spawnInsect(
        WORLD.webX + Math.sin(index * 1.8) * 85,
        -60 - index * 92,
        index === rareIndex,
      );
    }
  }

  private spawnInsect(x: number, y: number, rare: boolean): void {
    const phase = this.random.range(0, Math.PI * 2);
    const amplitude = this.random.range(72, rare ? 145 : 122);
    const initialX = x + Math.sin(this.elapsed * 3.2 + phase) * amplitude;
    const insect: Insect = {
      id: this.nextId++,
      kind: "insect",
      x: initialX,
      y,
      previousX: initialX,
      previousY: y,
      radius: rare ? 18 : 14,
      rare,
      phase,
      originX: x,
      amplitude,
      active: true,
    };
    this.entities.push(insect);
  }

  private spawnPredator(): void {
    const options: PredatorKind[] =
      this.difficulty < 0.45
        ? ["frog"]
        : this.difficulty < 0.72
          ? ["frog", "lizard"]
          : ["frog", "lizard", "bird"];
    const predatorKind = this.random.pick(options);
    const fromLeft = this.random.next() > 0.5;
    const targetY =
      predatorKind === "frog"
        ? this.random.range(WORLD.height * 0.61, WORLD.height * 0.74)
        : predatorKind === "lizard"
          ? this.random.range(WORLD.height * 0.25, WORLD.height * 0.55)
          : this.random.range(WORLD.topLimit + 80, WORLD.bottomLimit - 120);
    const initialY = predatorKind === "frog" ? targetY : targetY - 120;
    const predator: Predator = {
      id: this.nextId++,
      kind: "predator",
      predatorKind,
      x: fromLeft ? -110 : WORLD.width + 110,
      y: initialY,
      previousX: fromLeft ? -110 : WORLD.width + 110,
      previousY: initialY,
      radius: predatorKind === "bird" ? 48 : predatorKind === "lizard" ? 42 : 38,
      velocityX:
        (fromLeft ? 1 : -1) *
        (predatorKind === "bird" ? 410 : predatorKind === "lizard" ? 270 : 225),
      state: "warning",
      timer: predatorKind === "bird" ? 0.8 : 1.1,
      targetY,
      active: true,
    };
    this.entities.push(predator);
    this.warning = predatorKind;
    this.event = { type: "warning", predator: predatorKind };
  }

  private resolveInteractions(dt: number): void {
    const spider = this.spider;
    for (const entity of this.entities) {
      if (!entity.active) continue;

      if (entity.kind === "insect") {
        if (
          circlesOverlap(
            spider.x,
            spider.y,
            spider.radius,
            entity.x,
            entity.y,
            entity.radius,
          )
        ) {
          entity.active = false;
          const points = (entity.rare ? 5 : 1) * this.multiplier;
          this.score += points;
          this.combo += 1;
          this.event = { type: "collect", rare: entity.rare, points };
        }
      } else if (entity.kind === "glob") {
        if (
          !entity.touched &&
          circlesOverlap(
            spider.x,
            spider.y,
            spider.radius,
            entity.x,
            entity.y,
            entity.radius,
          )
        ) {
          entity.touched = true;
          spider.slowTimer = 1.8;
          spider.velocityY = Math.max(spider.velocityY, 80);
          this.combo = 0;
          this.event = { type: "glob" };
        }
      } else if (entity.kind === "wind") {
        if (
          circleIntersectsRect(
            spider.x,
            spider.y,
            spider.radius,
            entity.x,
            entity.y,
            entity.width,
            entity.height,
          )
        ) {
          spider.velocityY += entity.force * dt;
        }
      } else if (entity.kind === "twig" && !entity.broken) {
        if (
          circleIntersectsRect(
            spider.x,
            spider.y,
            spider.radius * 0.8,
            entity.x,
            entity.y,
            entity.width,
            entity.height,
          )
        ) {
          if (entity.breakable && spider.invulnerableTimer <= 0) {
            entity.broken = true;
            spider.invulnerableTimer = 0.45;
            spider.velocityY *= -0.35;
            this.combo = 0;
            this.event = { type: "twigBreak" };
          } else if (spider.invulnerableTimer <= 0) {
            this.finish("a hard twig");
          }
        }
      } else if (entity.kind === "predator" && entity.state === "attack") {
        if (
          circlesOverlap(
            spider.x,
            spider.y,
            spider.radius * 0.82,
            entity.x,
            entity.y,
            entity.radius * 0.78,
          )
        ) {
          this.finish(`a ${entity.predatorKind}`);
        }
      }
    }
  }

  private finish(cause: string): void {
    if (this.phase !== "playing") return;
    this.phase = "gameOver";
    this.spider.dropHeld = false;
    this.event = { type: "gameOver", cause };
  }
}

export const geometry = {
  circlesOverlap,
  circleIntersectsRect,
  moveToward,
};
