// src/entities/Pet.ts — ตัวสัตว์เลี้ยงที่ลอยตามผู้เล่น + วงนับถอยหลัง
// ไม่รู้จักชนิดสัตว์อีกแล้ว — รูปร่าง/ขนาด/จังหวะอ่านจาก PetDef ทั้งหมด
import Phaser from 'phaser';
import { DEPTH } from '../config';
import type { PetDef } from '../data/pets';

export class Pet {
  private scene: Phaser.Scene;
  private color: number;
  private bobMs: number;
  private body: Phaser.GameObjects.Shape;
  private eye: Phaser.GameObjects.Arc;
  private ring: Phaser.GameObjects.Graphics;
  private t: number = 0;
  x: number;
  y: number;

  constructor(scene: Phaser.Scene, def: PetDef, x: number, y: number) {
    this.scene = scene;
    this.color = def.color;
    this.bobMs = def.bobMs;
    this.x = x;
    this.y = y;

    this.body =
      def.shape === 'circle'
        ? scene.add.circle(x, y, def.size[0], def.color)
        : scene.add.rectangle(x, y, def.size[0], def.size[1], def.color);
    this.body.setStrokeStyle(2, 0xffffff);
    this.body.setDepth(DEPTH.PLAYER + 2);

    this.eye = scene.add.circle(x + 3, y - 2, 2, 0x000000);
    this.eye.setDepth(DEPTH.PLAYER + 3);

    this.ring = scene.add.graphics();
    this.ring.setDepth(DEPTH.PLAYER + 2);
  }

  update(delta: number, px: number, py: number, progress: number) {
    this.t += delta;
    const tx = px - 30;
    const ty = py - 30 + Math.sin(this.t / this.bobMs) * 5;
    const k = 1 - Math.exp(-delta / 90);
    this.x += (tx - this.x) * k;
    this.y += (ty - this.y) * k;
    this.body.setPosition(this.x, this.y);
    this.eye.setPosition(this.x + 3, this.y - 2);

    this.ring.clear();
    const ready = progress >= 0.85;
    this.ring.lineStyle(2, this.color, ready ? 1 : 0.7);
    this.ring.beginPath();
    this.ring.arc(
      this.x,
      this.y,
      ready ? 15 : 14,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * Math.min(1, progress),
      false
    );
    this.ring.strokePath();
  }

  /** เด้งเล็กน้อยตอนออกฤทธิ์ */
  pulse() {
    this.body.setScale(1.7);
    this.scene.tweens.add({ targets: this.body, scale: 1, duration: 250 });
  }

  pos() {
    return { x: this.x, y: this.y };
  }
}