// กระสุนที่มอนยิงออกมา — เคลื่อนที่เป็นเส้นตรง ชนผู้เล่นแล้วหาย
import Phaser from 'phaser';
import { DEPTH } from '../config';

export class Projectile {
  public sprite: Phaser.GameObjects.Arc;
  private scene: Phaser.Scene;
  private damage: number;
  private radius: number;
  private vx: number;
  private vy: number;
  private lifeMs: number;
  private elapsed: number = 0;
  private dead: boolean = false;
  private onHit: (target: any, damage: number, fromX: number, fromY: number) => void;
  private trailTimer: number = 0;
  private color: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    speed: number,
    damage: number,
    radius: number,
    color: number,
    lifeMs: number,
    onHit: (target: any, damage: number, fromX: number, fromY: number) => void
  ) {
    this.scene = scene;
    this.damage = damage;
    this.radius = radius;
    this.vx = dirX * speed;
    this.vy = dirY * speed;
    this.lifeMs = lifeMs;
    this.onHit = onHit;
    this.color = color;

    this.sprite = scene.add.circle(x, y, radius, color, 0.95);
    this.sprite.setStrokeStyle(2, 0xffffff);
    this.sprite.setDepth(DEPTH.ENEMY);
  }

  update(delta: number, targets: any[]) {
    if (this.dead) return;

    this.elapsed += delta;
    if (this.elapsed >= this.lifeMs) {
      this.destroy();
      return;
    }

    // เคลื่อนที่ (ไม่ใช้ physics — คุมเองง่ายกว่า)
    this.sprite.x += (this.vx * delta) / 1000;
    this.sprite.y += (this.vy * delta) / 1000;

    // ทิ้ง trail ทุก ๆ 60ms
    this.trailTimer += delta;
    if (this.trailTimer >= 60) {
      this.trailTimer = 0;
      const ghost = this.scene.add.circle(this.sprite.x, this.sprite.y, this.radius * 0.6, this.color, 0.45);
      ghost.setDepth(DEPTH.ENEMY - 1);
      this.scene.tweens.add({
        targets: ghost,
        alpha: 0,
        scale: 0.3,
        duration: 200,
        onComplete: () => ghost.destroy()
      });
    }

    // ตรวจชนผู้เล่น
    for (const t of targets) {
      const d = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, t.x, t.y);
      if (d <= this.radius + 16) {
        this.onHit(t, this.damage, this.sprite.x, this.sprite.y);
        this.destroy();
        return;
      }
    }
  }

  isAlive(): boolean {
    return !this.dead;
  }

  destroy() {
    if (this.dead) return;
    this.dead = true;
    this.sprite.destroy();
  }
}