// src/systems/AmbientDust.ts — ฝุ่นกระดาษลอย (P3c)
// ใช้ Rectangle พื้นฐาน ไม่ใช้ Particle Emitter เพื่อความเสถียรและประหยัด CPU
import Phaser from 'phaser';
import { DEPTH } from '../config';

export class AmbientDust {
  private scene: Phaser.Scene;
  private particles: Phaser.GameObjects.Rectangle[] = [];
  
  constructor(scene: Phaser.Scene, count: number = 35) {
    this.scene = scene;
    this.createParticles(count);
  }

  private createParticles(count: number) {
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;

    for (let i = 0; i < count; i++) {
      // สุ่มขนาดเศษกระดาษ (2x2 ถึง 5x5)
      const sizeW = Phaser.Math.Between(2, 5);
      const sizeH = Phaser.Math.Between(2, 5);
      
      // สีกระดาษอ่อนๆ โปร่งแสง
      const p = this.scene.add.rectangle(
        Phaser.Math.Between(0, w),
        Phaser.Math.Between(0, h),
        sizeW, sizeH, 0xe8e0c8, 0.3
      );
      
      // ลอยเหนือพื้นนิดหน่อย
      p.setDepth(DEPTH.FLOOR + 2); 
      // ใส่ ScrollFactor นิดหน่อยให้เกิด Parallax (ลอยช้ากว่าฉาก)
      p.setScrollFactor(0.85); 
      p.setAngle(Phaser.Math.Between(0, 180));

      // กำหนดความเร็วลม (ลอยไปทางซ้ายล่าง ช้าๆ)
      const speedX = Phaser.Math.FloatBetween(-20, -5); 
      const speedY = Phaser.Math.FloatBetween(10, 25);   
      
      // เก็บค่าความเร็วและจุดเริ่มต้นการแกว่งไว้ในตัว Object
      (p as any).vx = speedX;
      (p as any).vy = speedY;
      (p as any).swayOffset = Math.random() * Math.PI * 2;
      (p as any).baseX = p.x;

      this.particles.push(p);
    }
  }

  update(delta: number) {
    const dt = delta / 1000;
    const time = this.scene.time.now / 1000;
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;

    for (const p of this.particles) {
      // แกว่งซ้ายขวาเบาๆ ด้วย Sine Wave
      const sway = Math.sin(time * 1.5 + (p as any).swayOffset) * 15;
      
      p.x += (p as any).vx * dt;
      p.y += (p as any).vy * dt;
      // หมุนตัวช้าๆ
      p.angle += 10 * dt;

      // ถ้าลอยตกขอบล่าง หรือออกซ้าย ให้วนกลับไปด้านบน/ขวา
      if (p.y > h + 10) {
        p.y = -10;
        p.x = Phaser.Math.Between(0, w);
      }
      if (p.x < -10) {
        p.x = w + 10;
        p.y = Phaser.Math.Between(0, h);
      }
    }
  }

  destroy() {
    for (const p of this.particles) {
      if (p.active) p.destroy();
    }
    this.particles = [];
  }
}