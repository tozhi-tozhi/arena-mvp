// กระสุนของผู้เล่น (ลูมิ) — บินตรง ระเบิดเมื่อชนบอสหรือสุดระยะ
import Phaser from 'phaser';
import { DEPTH, WORLD_WIDTH, WORLD_HEIGHT, WALL_THICKNESS } from '../config';

// ---------- ค่าปรับภาพกระสุน ----------
const HALO_SCALE = 2.2;      // แสงรอบกระสุน (เท่าของรัศมีกระสุน)
const HALO_ALPHA = 0.3;
const TRAIL_EVERY_MS = 40;   // วาดเงาตามหลังถี่แค่ไหน

export interface ShotOpts {
  speed: number;
  range: number;
  radius: number;
  color: number;
}

export interface BossRef {
  x: number;
  y: number;
  r: number;
}

export class PlayerShot {
  private scene: Phaser.Scene;
  private circle: Phaser.GameObjects.Arc;
  private halo: Phaser.GameObjects.Arc;
  private dirX: number;
  private dirY: number;
  private opts: ShotOpts;
  private getBoss: () => BossRef | null;
  private onDetonate: (x: number, y: number, ratio: number) => void;
  private traveled: number = 0;
  private trailTimer: number = 0;
  private dead: boolean = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    opts: ShotOpts,
    getBoss: () => BossRef | null,
    onDetonate: (x: number, y: number, ratio: number) => void
  ) {
    this.scene = scene;
    this.dirX = dirX;
    this.dirY = dirY;
    this.opts = opts;
    this.getBoss = getBoss;
    this.onDetonate = onDetonate;

    // แสงเรืองรอบกระสุน (อยู่หลังตัวกระสุน)
    this.halo = scene.add.circle(x, y, opts.radius * HALO_SCALE, opts.color, HALO_ALPHA);
    this.halo.setDepth(DEPTH.PLAYER);

    this.circle = scene.add.circle(x, y, opts.radius, opts.color, 0.95);
    this.circle.setStrokeStyle(2, 0xffffff);
    this.circle.setDepth(DEPTH.PLAYER + 1);
  }

  update(delta: number) {
    if (this.dead) return;

    const step = (this.opts.speed * delta) / 1000;
    this.circle.x += this.dirX * step;
    this.circle.y += this.dirY * step;
    this.halo.setPosition(this.circle.x, this.circle.y);
    this.traveled += step;

    // เงาตามหลัง
    this.trailTimer += delta;
    if (this.trailTimer >= TRAIL_EVERY_MS) {
      this.trailTimer = 0;
      const ghost = this.scene.add.circle(this.circle.x, this.circle.y, this.opts.radius * 0.7, this.opts.color, 0.45);
      ghost.setDepth(DEPTH.PLAYER);
      this.scene.tweens.add({
        targets: ghost,
        alpha: 0,
        scale: 0.3,
        duration: 200,
        onComplete: () => ghost.destroy()
      });
    }

    // ชนบอส
    const boss = this.getBoss();
    if (boss) {
      const d = Phaser.Math.Distance.Between(this.circle.x, this.circle.y, boss.x, boss.y);
      if (d <= boss.r + this.opts.radius) {
        this.detonate();
        return;
      }
    }

    // ชนกำแพง — ต้องเทียบ "ขนาดโลก" ไม่ใช่ "ขนาดจอ" (นี่คือบั๊กเดิม)
    const x = this.circle.x;
    const y = this.circle.y;
    const outside =
      x < WALL_THICKNESS || x > WORLD_WIDTH - WALL_THICKNESS ||
      y < WALL_THICKNESS || y > WORLD_HEIGHT - WALL_THICKNESS;

    if (outside || this.traveled >= this.opts.range) this.detonate();
  }

  private detonate() {
    if (this.dead) return;
    this.dead = true;
    const x = this.circle.x;
    const y = this.circle.y;
    const ratio = Math.min(1, this.traveled / this.opts.range);
    this.circle.destroy();
    this.halo.destroy();
    this.onDetonate(x, y, ratio);
  }

  isAlive(): boolean {
    return !this.dead;
  }

  destroy() {
    if (this.dead) return;
    this.dead = true;
    this.circle.destroy();
    this.halo.destroy();
  }
}