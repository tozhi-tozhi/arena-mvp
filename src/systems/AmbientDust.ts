// src/systems/AmbientDust.ts — ฝุ่นกระดาษลอย (P3c)
// ใช้ Rectangle พื้นฐาน ไม่ใช้ Particle Emitter เพื่อความเสถียรและประหยัด CPU
// S13: ฝุ่นอยู่ในพิกัดโลกและวนรอบ "ช่องมองของกล้อง" — เดิมวนรอบมุมซ้ายบนของโลก
// จึงมองไม่เห็นเมื่อกล้องไปไกลในแมพใหญ่ (ภาพล้วน ไม่แตะการต่อสู้)
import Phaser from 'phaser';
import { DEPTH } from '../config';

const MARGIN = 24; // เลยขอบจอเท่านี้ถึงวนกลับ

export class AmbientDust {
  private scene: Phaser.Scene;
  private particles: Phaser.GameObjects.Rectangle[] = [];
  private placed: boolean = false;

  constructor(scene: Phaser.Scene, count: number = 35) {
    this.scene = scene;
    this.createParticles(count);
  }

  private createParticles(count: number) {
    for (let i = 0; i < count; i++) {
      // สุ่มขนาดเศษกระดาษ (2x2 ถึง 5x5) สีกระดาษอ่อนโปร่งแสง
      const p = this.scene.add.rectangle(
        0, 0,
        Phaser.Math.Between(2, 5), Phaser.Math.Between(2, 5),
        0xe8e0c8, 0.3
      );
      p.setDepth(DEPTH.FLOOR + 2);
      p.setAngle(Phaser.Math.Between(0, 180));
      // ลมพัดไปทางซ้ายล่างช้า ๆ
      (p as any).vx = Phaser.Math.FloatBetween(-20, -5);
      (p as any).vy = Phaser.Math.FloatBetween(10, 25);
      (p as any).swayOffset = Math.random() * Math.PI * 2;
      this.particles.push(p);
    }
  }

  /** วางครั้งแรกกระจายทั่วช่องมอง (ตอนสร้าง กล้องยังไม่ตามผู้เล่น จึงรอเฟรมแรก) */
  private scatter(view: Phaser.Geom.Rectangle) {
    for (const p of this.particles) {
      p.x = Phaser.Math.Between(view.x, view.x + view.width);
      p.y = Phaser.Math.Between(view.y, view.y + view.height);
    }
    this.placed = true;
  }

  /** ฝุ่นหลุดกรอบ → เกิดใหม่ที่ขอบบนหรือขอบขวา (ทิศที่ลมพัดเข้ามา) */
  private respawn(p: Phaser.GameObjects.Rectangle, view: Phaser.Geom.Rectangle) {
    if (Math.random() < 0.5) {
      p.x = Phaser.Math.Between(view.x, view.x + view.width);
      p.y = view.y - MARGIN;
    } else {
      p.x = view.x + view.width + MARGIN;
      p.y = Phaser.Math.Between(view.y, view.y + view.height);
    }
  }

  update(delta: number) {
    const view = this.scene.cameras.main.worldView;
    if (!this.placed) this.scatter(view);

    const dt = delta / 1000;
    const time = this.scene.time.now / 1000;
    const left = view.x - MARGIN;
    const right = view.x + view.width + MARGIN;
    const top = view.y - MARGIN;
    const bottom = view.y + view.height + MARGIN;

    for (const p of this.particles) {
      // แกว่งซ้ายขวาเบา ๆ (อนุพันธ์ของคลื่นไซน์)
      const sway = Math.cos(time * 1.5 + (p as any).swayOffset) * 11;
      p.x += ((p as any).vx + sway) * dt;
      p.y += (p as any).vy * dt;
      p.angle += 10 * dt;

      if (p.x < left || p.x > right || p.y < top || p.y > bottom) this.respawn(p, view);
    }
  }

  destroy() {
    for (const p of this.particles) {
      if (p.active) p.destroy();
    }
    this.particles = [];
  }
}