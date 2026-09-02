import { describe, expect, it } from "vitest";
import { FIXED_STEP, WORLD } from "../src/constants";
import { SeededRandom } from "../src/random";
import { GameSimulation, geometry } from "../src/simulation";

describe("movement", () => {
  it("climbs while released and drops while held", () => {
    const game = new GameSimulation(1);
    game.start(1);
    const startY = game.spider.y;
    for (let step = 0; step < 120; step += 1) game.step(FIXED_STEP);
    expect(game.spider.y).toBeLessThan(startY);

    game.setDropHeld(true);
    const climbY = game.spider.y;
    for (let step = 0; step < 120; step += 1) game.step(FIXED_STEP);
    expect(game.spider.y).toBeGreaterThan(climbY);
  });

  it("targets the spider after camping at the top for three seconds", () => {
    const game = new GameSimulation(2);
    game.start(2);
    game.spider.invulnerableTimer = Number.POSITIVE_INFINITY;
    for (let step = 0; step < 1200 && game.spider.y > WORLD.topLimit + 24; step += 1) {
      game.step(FIXED_STEP);
    }
    const existingIds = new Set(game.entities.map((entity) => entity.id));
    for (let step = 0; step < 120 * 3.1; step += 1) game.step(FIXED_STEP);
    const hasCampingResponse = game.entities.some(
      (entity) =>
        !existingIds.has(entity.id) &&
        (entity.kind === "twig" ||
          (entity.kind === "predator" && entity.predatorKind === "bird")),
    );

    expect(game.phase).toBe("playing");
    expect(hasCampingResponse).toBe(true);
  });

  it("ends the run when a held drop reaches the forest floor", () => {
    const game = new GameSimulation(8);
    game.start(8);
    game.setDropHeld(true);
    for (let step = 0; step < 600 && game.phase === "playing"; step += 1) {
      game.step(FIXED_STEP);
    }
    expect(game.phase).toBe("gameOver");
    expect(game.event?.type).toBe("gameOver");
  });

  it("requires active play instead of allowing an endless idle climb", () => {
    const game = new GameSimulation(11);
    game.start(11);
    for (let step = 0; step < 120 * 60 && game.phase === "playing"; step += 1) {
      game.step(FIXED_STEP);
    }
    expect(game.phase).toBe("gameOver");
  });
});

describe("geometry", () => {
  it("detects circle and rectangle contact", () => {
    expect(geometry.circleIntersectsRect(20, 20, 10, 30, 10, 20, 20)).toBe(true);
    expect(geometry.circleIntersectsRect(5, 5, 4, 30, 10, 20, 20)).toBe(false);
  });

  it("detects overlapping circles", () => {
    expect(geometry.circlesOverlap(0, 0, 10, 19, 0, 10)).toBe(true);
    expect(geometry.circlesOverlap(0, 0, 10, 21, 0, 10)).toBe(false);
  });
});

describe("determinism and scoring", () => {
  it("produces repeatable random sequences", () => {
    const first = new SeededRandom(42);
    const second = new SeededRandom(42);
    expect([first.next(), first.next(), first.next()]).toEqual([
      second.next(),
      second.next(),
      second.next(),
    ]);
  });

  it("increases the combo multiplier every five insects", () => {
    const game = new GameSimulation(3);
    game.start(3);
    game.combo = 0;
    expect(game.multiplier).toBe(1);
    game.combo = 5;
    expect(game.multiplier).toBe(2);
    game.combo = 20;
    expect(game.multiplier).toBe(5);
    game.combo = 30;
    expect(game.multiplier).toBe(5);
  });

  it("guarantees a bird encounter after the late-game unlock", () => {
    const game = new GameSimulation(17);
    game.start(17);
    game.spider.x = -1000;
    game.spider.invulnerableTimer = Number.POSITIVE_INFINITY;

    for (let step = 0; step < 120 * 80; step += 1) {
      game.setDropHeld(game.spider.y < WORLD.height * 0.5);
      game.step(FIXED_STEP);
      if (
        game.entities.some(
          (entity) => entity.kind === "predator" && entity.predatorKind === "bird",
        )
      ) {
        break;
      }
    }

    expect(
      game.entities.some(
        (entity) => entity.kind === "predator" && entity.predatorKind === "bird",
      ),
    ).toBe(true);
  });

  it("steers an attacking bird toward the spider's live position", () => {
    const game = new GameSimulation(23);
    game.start(23);
    game.spider.y = 300;
    game.entities.push({
      id: 999,
      kind: "predator",
      predatorKind: "bird",
      x: 100,
      y: 600,
      previousX: 100,
      previousY: 600,
      radius: 48,
      velocityX: 410,
      velocityY: 0,
      state: "attack",
      timer: 5,
      targetY: 600,
      active: true,
    });

    game.step(FIXED_STEP);
    const bird = game.entities.find(
      (entity) => entity.kind === "predator" && entity.id === 999,
    );
    expect(bird?.kind === "predator" && bird.velocityY).toBeLessThan(0);

    game.spider.y = 900;
    for (let step = 0; step < 90; step += 1) game.step(FIXED_STEP);
    expect(bird?.kind === "predator" && bird.velocityY).toBeGreaterThan(0);
  });
});
