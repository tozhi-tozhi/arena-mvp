// กระสุนของผู้เล่น (ลูมิ) — บินตรง ระเบิดเมื่อชนบอส ชนร่างปลอม หรือสุดระยะ
import Phaser from 'phaser';
import { DEPTH } from '../config';

// ---------- ค่าปรับภาพกระสุน ----------
const HALO_SCALE = 2.2;
const HALO_ALPHA = 0.3;
const TRAIL_EVERY_MS = 40;

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
  // เป้าหมายตัวจริงทั้งหมดที่กระสุนชนได้ (เดิมมีบอสตัวเดียว — เฟส 3A รองรับหลายตัว)
  private getBodies: () => BossRef[];
  private getDecoys: () => BossRef[];
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
    getBodies: () => BossRef[],
    onDetonate: (x: number, y: number, ratio: number) => void,
    getDecoys?: () => BossRef[]
  ) {
    this.scene = scene;
    this.dirX = dirX;
    this.dirY = dirY;
    this.opts = opts;
    this.getBodies = getBodies;
    this.onDetonate = onDetonate;
    this.getDecoys = getDecoys ?? (() => []);

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

    this.trailTimer += delta;
    if (this.trailTimer >= TRAIL_EVERY_MS) {
      this.trailTimer = 0;
      const ghost = this.scene.add.circle(
        this.circle.x,
        this.circle.y,
        this.opts.radius * 0.7,
        this.opts.color,
        0.45
      );
      ghost.setDepth(DEPTH.PLAYER);
      this.scene.tweens.add({
        targets: ghost,
        alpha: 0,
        scale: 0.3,
        duration: 200,
        onComplete: () => ghost.destroy()
      });
    }

    // ชนร่างปลอมก่อน (มายา)
    for (const d of this.getDecoys()) {
      const dd = Phaser.Math.Distance.Between(this.circle.x, this.circle.y, d.x, d.y);
      if (dd <= d.r + this.opts.radius) {
        this.detonate();
        return;
      }
    }

    // ชนเป้าตัวจริง
    for (const boss of this.getBodies()) {
      const d = Phaser.Math.Distance.Between(this.circle.x, this.circle.y, boss.x, boss.y);
      if (d <= boss.r + this.opts.radius) {
        this.detonate();
        return;
      }
    }

    // ชนขอบสนาม — อ่านจากขอบโลกฟิสิกส์ของฉากตอนนี้ (แอเรียขนาดสุ่มใน Phase 3B ตั้งขอบเอง)
    // ในห้องฝึก ขอบนี้ = (WALL_THICKNESS ถึง WORLD - WALL_THICKNESS) เท่าเดิมเป๊ะ
    const x = this.circle.x;
    const y = this.circle.y;
    const wb = this.scene.physics.world.bounds;
    const outside = x < wb.x || x > wb.right || y < wb.y || y > wb.bottom;

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
