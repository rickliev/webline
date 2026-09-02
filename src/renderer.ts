import { WORLD } from "./constants";
import type {
  Entity,
  GameSnapshot,
  Insect,
  Predator,
  StickyGlob,
  Twig,
  WindZone,
} from "./types";

interface Palette {
  background: string;
  elevated: string;
  surface: string;
  soft: string;
  border: string;
  borderStrong: string;
  text: string;
  muted: string;
  accent: string;
  accentSoft: string;
  success: string;
  spider: string;
  danger: string;
  warning: string;
  sheen: string;
}

export class GameRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private palette: Palette = {} as Palette;
  private width = WORLD.width;
  private height = WORLD.height;
  private scaleX = 1;
  private scaleY = 1;
  private particles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
  }> = [];
  private reducedMotion = false;

  constructor(canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D is unavailable.");
    this.canvas = canvas;
    this.context = context;
    this.reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.refreshPalette();
    this.resize();
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const ratio = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(rect.width * ratio));
    this.canvas.height = Math.max(1, Math.round(rect.height * ratio));
    this.width = WORLD.width;
    this.height = WORLD.height;
    this.scaleX = this.canvas.width / this.width;
    this.scaleY = this.canvas.height / this.height;
    this.context.setTransform(this.scaleX, 0, 0, this.scaleY, 0, 0);
  }

  refreshPalette(): void {
    const style = getComputedStyle(document.documentElement);
    const color = (name: string): string => style.getPropertyValue(name).trim();
    this.palette = {
      background: color("--cp-bg"),
      elevated: color("--cp-bg-elevated"),
      surface: color("--cp-surface"),
      soft: color("--cp-surface-soft"),
      border: color("--cp-border"),
      borderStrong: color("--cp-border-strong"),
      text: color("--cp-text"),
      muted: color("--cp-text-muted"),
      accent: color("--cp-accent"),
      accentSoft: color("--cp-accent-soft"),
      success: color("--cp-success"),
      spider: color("--spider-jewel") || color("--cp-success"),
      danger: color("--cp-danger"),
      warning: color("--cp-warning"),
      sheen: color("--cp-sheen"),
    };
  }

  burst(x: number, y: number, rare = false): void {
    if (this.reducedMotion) return;
    for (let index = 0; index < (rare ? 24 : 12); index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 45 + Math.random() * 125;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.35 + Math.random() * 0.35,
        color: rare ? this.palette.warning : this.palette.success,
      });
    }
  }

  updateEffects(dt: number): void {
    for (const particle of this.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 120 * dt;
      particle.life -= dt;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);
  }

  render(snapshot: GameSnapshot, alpha: number, elapsed: number): void {
    const context = this.context;
    context.setTransform(this.scaleX, 0, 0, this.scaleY, 0, 0);
    context.clearRect(0, 0, this.width, this.height);
    this.drawForest(snapshot.worldOffset, elapsed);
    this.drawWeb(snapshot.worldOffset, elapsed);
    for (const entity of snapshot.entities) {
      this.drawEntity(entity, alpha, elapsed);
    }
    this.drawForestFloor(snapshot, elapsed);
    this.drawParticles();
    this.drawSpider(snapshot, alpha, elapsed);
    this.drawVignette();
  }

  private drawForest(offset: number, elapsed: number): void {
    const context = this.context;
    context.fillStyle = this.palette.elevated;
    context.fillRect(0, 0, this.width, this.height);

    context.strokeStyle = this.palette.border;
    context.lineWidth = 2;
    context.globalAlpha = 0.38;
    for (let y = -160 + offset; y < this.height + 160; y += 160) {
      context.beginPath();
      context.moveTo(0, y + 30);
      context.bezierCurveTo(160, y - 35, 255, y + 90, 420, y + 20);
      context.bezierCurveTo(535, y - 30, 620, y + 70, 720, y + 5);
      context.stroke();
    }

    context.fillStyle = this.palette.soft;
    for (let y = -210 + offset * 0.55; y < this.height + 220; y += 240) {
      this.drawLeafCluster(50, y, 1.1);
      this.drawLeafCluster(670, y + 105, -1);
    }
    context.globalAlpha = 1;

    context.fillStyle = this.palette.accentSoft;
    const glowY = (elapsed * 12) % (this.height + 220) - 110;
    context.beginPath();
    context.arc(105, glowY, 75, 0, Math.PI * 2);
    context.fill();
  }

  private drawLeafCluster(x: number, y: number, direction: number): void {
    const context = this.context;
    context.save();
    context.translate(x, y);
    context.scale(direction, 1);
    for (let index = 0; index < 5; index += 1) {
      context.save();
      context.rotate(-0.9 + index * 0.38);
      context.beginPath();
      context.ellipse(55 + index * 7, 0, 54, 22, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
    context.restore();
  }

  private drawWeb(offset: number, elapsed: number): void {
    const context = this.context;
    context.strokeStyle = this.palette.borderStrong;
    context.lineWidth = 3;
    context.globalAlpha = 0.86;
    context.beginPath();
    for (let y = -20; y <= this.height + 20; y += 18) {
      const sway = this.reducedMotion ? 0 : Math.sin(y * 0.018 + elapsed * 1.4) * 3;
      if (y === -20) context.moveTo(WORLD.webX + sway, y);
      else context.lineTo(WORLD.webX + sway, y);
    }
    context.stroke();

    context.lineWidth = 1;
    context.globalAlpha = 0.28;
    for (let y = -120 + (offset % 120); y < this.height; y += 120) {
      context.beginPath();
      context.arc(WORLD.webX, y, 50, 0, Math.PI * 2);
      context.stroke();
      for (let spoke = 0; spoke < 8; spoke += 1) {
        const angle = (spoke / 8) * Math.PI * 2;
        context.beginPath();
        context.moveTo(WORLD.webX, y);
        context.lineTo(
          WORLD.webX + Math.cos(angle) * 50,
          y + Math.sin(angle) * 50,
        );
        context.stroke();
      }
    }
    context.globalAlpha = 1;
  }

  private drawEntity(entity: Entity, alpha: number, elapsed: number): void {
    const x = entity.previousX + (entity.x - entity.previousX) * alpha;
    const y = entity.previousY + (entity.y - entity.previousY) * alpha;
    if (entity.kind === "insect") this.drawInsect(entity, x, y, elapsed);
    else if (entity.kind === "glob") this.drawGlob(entity, x, y);
    else if (entity.kind === "twig") this.drawTwig(entity, x, y);
    else if (entity.kind === "wind") this.drawWind(entity, x, y, elapsed);
    else this.drawPredator(entity, x, y, elapsed);
  }

  private drawInsect(insect: Insect, x: number, y: number, elapsed: number): void {
    const context = this.context;
    const flutter = Math.sin(elapsed * 13 + insect.phase) * 8;
    context.save();
    context.translate(x, y);
    context.fillStyle = insect.rare ? this.palette.warning : this.palette.success;
    context.strokeStyle = this.palette.text;
    context.lineWidth = 3;
    context.beginPath();
    context.ellipse(-10, -4, 11 + flutter * 0.15, 7, -0.35, 0, Math.PI * 2);
    context.ellipse(10, -4, 11 - flutter * 0.15, 7, 0.35, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = this.palette.text;
    context.beginPath();
    context.ellipse(0, 2, 7, 12, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  private drawGlob(glob: StickyGlob, x: number, y: number): void {
    const context = this.context;
    context.save();
    context.translate(x, y);
    context.fillStyle = this.palette.warning;
    context.strokeStyle = this.palette.text;
    context.lineWidth = 3;
    context.globalAlpha = glob.touched ? 0.35 : 0.92;
    context.beginPath();
    for (let index = 0; index < 12; index += 1) {
      const angle = (index / 12) * Math.PI * 2;
      const radius = glob.radius * (index % 2 === 0 ? 1 : 0.78);
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      if (index === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.closePath();
    context.fill();
    context.stroke();
    context.globalAlpha = 1;
    context.restore();
  }

  private drawTwig(twig: Twig, x: number, y: number): void {
    const context = this.context;
    context.save();
    context.translate(x, y);
    if (twig.broken) context.rotate(0.28);
    context.fillStyle = twig.breakable ? this.palette.warning : this.palette.text;
    context.strokeStyle = this.palette.borderStrong;
    context.lineWidth = 4;
    context.beginPath();
    context.roundRect(0, 0, twig.width, twig.height, twig.height / 2);
    context.fill();
    context.stroke();
    context.strokeStyle = this.palette.surface;
    context.lineWidth = 2;
    for (let mark = 26; mark < twig.width - 12; mark += 42) {
      context.beginPath();
      context.moveTo(mark, 3);
      context.lineTo(mark + 14, twig.height - 3);
      context.stroke();
    }
    context.restore();
  }

  private drawWind(wind: WindZone, x: number, y: number, elapsed: number): void {
    const context = this.context;
    context.save();
    context.translate(x, y);
    context.strokeStyle = this.palette.accent;
    context.lineWidth = 3;
    context.globalAlpha = 0.5;
    const direction = wind.force < 0 ? -1 : 1;
    context.setLineDash([18, 14]);
    context.lineDashOffset = this.reducedMotion ? 0 : elapsed * 90 * direction;

    for (let line = 0; line < 5; line += 1) {
      const lineX = 28 + line * 61;
      const sway = this.reducedMotion ? 0 : Math.sin(elapsed * 3 + line) * 10;
      context.beginPath();
      context.moveTo(lineX, 8);
      context.bezierCurveTo(
        lineX + 24 + sway,
        48,
        lineX - 24 - sway,
        102,
        lineX,
        wind.height - 8,
      );
      context.stroke();
    }

    context.setLineDash([]);
    context.lineWidth = 4;
    context.globalAlpha = 0.82;
    for (let marker = 0; marker < 5; marker += 1) {
      const progress = this.reducedMotion
        ? 0.5
        : (elapsed * 0.72 + marker * 0.2) % 1;
      const markerX = 28 + marker * 61;
      const markerY =
        direction < 0
          ? wind.height - progress * wind.height
          : progress * wind.height;
      const baseY = markerY - direction * 8;
      const tipY = markerY + direction * 6;
      context.beginPath();
      context.moveTo(markerX - 7, baseY);
      context.lineTo(markerX, tipY);
      context.lineTo(markerX + 7, baseY);
      context.stroke();
    }

    context.globalAlpha = 1;
    context.restore();
  }

  private drawPredator(
    predator: Predator,
    x: number,
    y: number,
    elapsed: number,
  ): void {
    if (predator.state === "warning") return;
    const context = this.context;
    context.save();
    context.translate(x, y);
    if (predator.velocityX < 0) context.scale(-1, 1);
    context.fillStyle = this.palette.danger;
    context.strokeStyle = this.palette.text;
    context.lineWidth = 5;

    if (predator.predatorKind === "frog") {
      context.fillStyle = this.palette.success;
      const hopExtension = Math.abs(Math.sin(predator.timer * 3.2));
      const hindKneeX = -57 - hopExtension * 16;
      const hindKneeY = 42 + hopExtension * 9;
      const hindFootX = -72 - hopExtension * 22;
      const hindFootY = 47 + hopExtension * 7;
      const frontKneeX = 42 + hopExtension * 13;
      const frontKneeY = 34 + hopExtension * 7;
      const frontFootX = 61 + hopExtension * 18;
      const frontFootY = 31 + hopExtension * 10;

      context.beginPath();
      context.moveTo(-24, 13);
      context.quadraticCurveTo(
        -52 - hopExtension * 15,
        17 + hopExtension * 8,
        hindKneeX,
        hindKneeY,
      );
      context.quadraticCurveTo(
        -39 - hopExtension * 5,
        52 + hopExtension * 3,
        -10,
        28,
      );
      context.closePath();
      context.globalAlpha = 0.68;
      context.fill();
      context.globalAlpha = 1;
      context.stroke();

      context.beginPath();
      context.ellipse(-4, 5, 47, 31, -0.08, 0, Math.PI * 2);
      context.globalAlpha = 0.68;
      context.fill();
      context.globalAlpha = 1;
      context.stroke();

      context.beginPath();
      context.moveTo(20, -18);
      context.quadraticCurveTo(39, -34, 62, -19);
      context.quadraticCurveTo(78, -8, 67, 10);
      context.quadraticCurveTo(48, 20, 22, 12);
      context.quadraticCurveTo(30, -2, 20, -18);
      context.closePath();
      context.globalAlpha = 0.68;
      context.fill();
      context.globalAlpha = 1;
      context.stroke();

      context.beginPath();
      context.arc(43, -27, 14, 0, Math.PI * 2);
      context.globalAlpha = 0.68;
      context.fill();
      context.globalAlpha = 1;
      context.stroke();

      context.strokeStyle = this.palette.success;
      context.lineWidth = 8;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.beginPath();
      context.moveTo(25, 12);
      context.lineTo(frontKneeX, frontKneeY);
      context.lineTo(frontFootX, frontFootY);
      context.stroke();

      context.beginPath();
      context.moveTo(-36, 34);
      context.lineTo(hindKneeX, hindKneeY);
      context.lineTo(hindFootX, hindFootY);
      context.moveTo(hindKneeX, hindKneeY);
      context.lineTo(hindFootX + 3, hindFootY + 11);
      context.stroke();

      context.fillStyle = this.palette.surface;
      context.strokeStyle = this.palette.text;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(47, -29, 7, 0, Math.PI * 2);
      context.fill();
      context.stroke();

      context.fillStyle = this.palette.text;
      context.beginPath();
      context.arc(49, -29, 3, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.arc(66, -8, 2.5, 0, Math.PI * 2);
      context.fill();

      context.strokeStyle = this.palette.text;
      context.lineWidth = 2.5;
      context.beginPath();
      context.moveTo(45, 4);
      context.quadraticCurveTo(56, 10, 68, 4);
      context.stroke();
    } else if (predator.predatorKind === "lizard") {
      const tailWave = Math.sin(elapsed * 7) * 15;

      context.fillStyle = this.palette.danger;
      context.beginPath();
      context.moveTo(-43, -9);
      context.bezierCurveTo(-72, -18, -91, -34, -119, tailWave);
      context.bezierCurveTo(-90, -18, -66, 12, -38, 11);
      context.closePath();
      context.fill();
      context.stroke();

      context.beginPath();
      context.ellipse(0, 0, 53, 23, 0, 0, Math.PI * 2);
      context.fill();
      context.stroke();

      context.beginPath();
      context.moveTo(36, -17);
      context.quadraticCurveTo(61, -23, 78, -10);
      context.lineTo(86, 1);
      context.quadraticCurveTo(69, 17, 38, 15);
      context.quadraticCurveTo(48, 0, 36, -17);
      context.closePath();
      context.fill();
      context.stroke();

      context.lineWidth = 7;
      context.lineCap = "round";
      context.lineJoin = "round";
      for (const leg of [
        [-27, -11, -43, -28, -58, -24],
        [24, -11, 40, -29, 56, -25],
        [-28, 12, -44, 31, -60, 28],
        [23, 12, 40, 31, 57, 27],
      ] as const) {
        context.beginPath();
        context.moveTo(leg[0], leg[1]);
        context.lineTo(leg[2], leg[3]);
        context.lineTo(leg[4], leg[5]);
        context.stroke();
      }

      context.strokeStyle = this.palette.success;
      context.lineWidth = 5;
      context.beginPath();
      context.moveTo(-28, -17);
      context.quadraticCurveTo(0, -29, 31, -16);
      context.stroke();

      context.fillStyle = this.palette.spider;
      for (const spotX of [-25, -5, 15, 34]) {
        context.beginPath();
        context.arc(spotX, 1, 4, 0, Math.PI * 2);
        context.fill();
      }

      context.fillStyle = this.palette.surface;
      context.strokeStyle = this.palette.text;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(63, -7, 7, 0, Math.PI * 2);
      context.fill();
      context.stroke();

      context.fillStyle = this.palette.text;
      context.beginPath();
      context.arc(65, -7, 3, 0, Math.PI * 2);
      context.fill();

      context.strokeStyle = this.palette.text;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(69, 7);
      context.lineTo(82, 5);
      context.stroke();
    } else {
      const wing = Math.sin(elapsed * 12) * 24;

      context.beginPath();
      context.moveTo(-38, -8);
      context.lineTo(-78, -30);
      context.lineTo(-65, -4);
      context.lineTo(-82, 18);
      context.lineTo(-34, 9);
      context.closePath();
      context.fill();
      context.stroke();

      context.beginPath();
      context.ellipse(0, 0, 48, 23, -0.08, 0, Math.PI * 2);
      context.fill();
      context.stroke();

      context.beginPath();
      context.moveTo(-16, -9);
      context.quadraticCurveTo(-2, -64 - wing, 35, -45 - wing * 0.35);
      context.quadraticCurveTo(24, -17, 13, -1);
      context.closePath();
      context.fill();
      context.stroke();

      context.beginPath();
      context.moveTo(-12, 8);
      context.quadraticCurveTo(8, 49 + wing * 0.45, 35, 34 + wing * 0.2);
      context.quadraticCurveTo(24, 14, 12, 2);
      context.closePath();
      context.fill();
      context.stroke();

      context.beginPath();
      context.arc(42, -10, 21, 0, Math.PI * 2);
      context.fill();
      context.stroke();

      context.fillStyle = this.palette.warning;
      context.beginPath();
      context.moveTo(59, -14);
      context.lineTo(84, -7);
      context.lineTo(59, 1);
      context.closePath();
      context.fill();
      context.stroke();

      context.fillStyle = this.palette.surface;
      context.beginPath();
      context.arc(47, -15, 6, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = this.palette.text;
      context.beginPath();
      context.arc(49, -15, 2.5, 0, Math.PI * 2);
      context.fill();
    }

    context.restore();
  }

  private drawSpider(snapshot: GameSnapshot, alpha: number, elapsed: number): void {
    const spider = snapshot.spider;
    const y = spider.previousY + (spider.y - spider.previousY) * alpha;
    const stretch = Math.min(0.16, Math.abs(spider.velocityY) / 2800);
    const bob = this.reducedMotion ? 0 : Math.sin(elapsed * 8) * 2;
    const context = this.context;

    context.save();
    context.translate(spider.x, y + bob);
    context.scale(1 - stretch * 0.45, 1 + stretch);
    context.strokeStyle = this.palette.text;
    context.lineWidth = 6;
    context.lineCap = "round";
    const legMotion = this.reducedMotion
      ? 0
      : Math.min(1, Math.abs(spider.velocityY) / 550);

    for (let side = -1; side <= 1; side += 2) {
      for (let leg = 0; leg < 4; leg += 1) {
        const legY = -19 + leg * 13;
        const legFlex =
          Math.sin(elapsed * 10 + leg * 1.35 + (side > 0 ? 0.65 : 0)) *
          legMotion;
        context.beginPath();
        context.moveTo(side * 16, legY);
        context.quadraticCurveTo(
          side * (34 + leg * 2 + legFlex * 2.5),
          legY + (leg < 2 ? -15 : 15) + legFlex * 5,
          side * (48 + leg * 3 + legFlex * 3.5),
          legY + (leg < 2 ? -5 : 22) + legFlex * 4,
        );
        context.stroke();
      }
    }

    context.fillStyle = this.palette.text;
    context.beginPath();
    context.ellipse(0, 10, 27, 35, 0, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.ellipse(0, -21, 23, 20, 0, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = this.palette.spider;
    context.beginPath();
    context.ellipse(0, 16, 12, 17, 0, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.ellipse(-7, -4, 7, 5, -0.4, 0, Math.PI * 2);
    context.ellipse(7, -4, 7, 5, 0.4, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = this.palette.surface;
    for (const eye of [
      [-10, -25, 7],
      [10, -25, 7],
      [-18, -20, 4],
      [18, -20, 4],
    ] as const) {
      context.beginPath();
      context.arc(eye[0], eye[1], eye[2], 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  private drawParticles(): void {
    const context = this.context;
    for (const particle of this.particles) {
      context.globalAlpha = Math.min(1, particle.life * 2.4);
      context.fillStyle = particle.color;
      context.fillRect(particle.x - 3, particle.y - 3, 6, 6);
    }
    context.globalAlpha = 1;
  }

  private drawForestFloor(snapshot: GameSnapshot, elapsed: number): void {
    const dangerTop = WORLD.bottomLimit - 280;
    const dangerProgress = Math.max(
      0,
      Math.min(1, (snapshot.spider.y - dangerTop) / (WORLD.bottomLimit - dangerTop)),
    );
    const context = this.context;
    const pulse = this.reducedMotion ? 1 : 0.82 + Math.sin(elapsed * 9) * 0.18;
    const gradient = context.createLinearGradient(0, dangerTop, 0, this.height);
    gradient.addColorStop(0, "transparent");
    gradient.addColorStop(0.72, this.palette.accentSoft);
    gradient.addColorStop(1, this.palette.danger);

    context.save();
    context.globalAlpha = 0.16 + dangerProgress * 0.3 * pulse;
    context.fillStyle = gradient;
    context.fillRect(0, dangerTop, this.width, this.height - dangerTop);

    context.globalAlpha = 0.7 + dangerProgress * 0.3;
    context.fillStyle = this.palette.text;
    context.beginPath();
    context.moveTo(0, this.height);
    context.lineTo(0, WORLD.bottomLimit + 15);
    for (let x = 0; x <= this.width; x += 45) {
      const height = 28 + ((x / 45) % 3) * 12;
      context.lineTo(x + 16, WORLD.bottomLimit - height);
      context.lineTo(x + 25, WORLD.bottomLimit + 12);
      context.lineTo(x + 38, WORLD.bottomLimit - height * 0.65);
      context.lineTo(x + 45, WORLD.bottomLimit + 15);
    }
    context.lineTo(this.width, this.height);
    context.closePath();
    context.fill();

    context.setLineDash([14, 12]);
    context.strokeStyle = this.palette.danger;
    context.lineWidth = 4 + dangerProgress * 3;
    context.globalAlpha = 0.5 + dangerProgress * 0.5 * pulse;
    context.beginPath();
    context.moveTo(0, WORLD.bottomLimit);
    context.lineTo(this.width, WORLD.bottomLimit);
    context.stroke();
    context.restore();
  }

  private drawVignette(): void {
    const context = this.context;
    context.strokeStyle = this.palette.borderStrong;
    context.lineWidth = 14;
    context.globalAlpha = 0.18;
    context.strokeRect(0, 0, this.width, this.height);
    context.globalAlpha = 1;
  }
}
