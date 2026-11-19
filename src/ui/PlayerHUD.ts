// UI เลือดผู้เล่น: แถบยาวต่อเนื่อง + ตัวเลข (สเกลเลือดหลักร้อย วาดเป็นช่องไม่ได้อีก)
// ขีดแบ่งทุก 10% ยังให้นับเลือดได้ด้วยตาเหมือนช่องเดิม
import Phaser from 'phaser';
import { DEPTH } from '../config';

const BAR_X = 74;
const BAR_Y = 8;
const BAR_W = 200;
const BAR_H = 16;
const TICKS = 10;

export class PlayerHUD {
  private maxHP: number;
  private bar: Phaser.GameObjects.Graphics;
  private numText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, maxHP: number) {
    this.maxHP = Math.max(1, Math.floor(maxHP));

    scene.add.text(44, 16, 'HP', {
      fontFamily: 'monospace',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0, 0.5).setDepth(DEPTH.HUD).setScrollFactor(0);

    this.bar = scene.add.graphics();
    this.bar.setDepth(DEPTH.HUD);
    this.bar.setScrollFactor(0);

    this.numText = scene.add.text(BAR_X + BAR_W + 8, BAR_Y + BAR_H / 2, '', {
      fontFamily: 'monospace',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0, 0.5).setDepth(DEPTH.HUD).setScrollFactor(0);

    this.update(this.maxHP);
  }

  // เรียกทุกครั้งที่เลือดผู้เล่นเปลี่ยน
  update(hp: number) {
    const g = this.bar;
    g.clear();

    const cur = Math.max(0, Math.min(this.maxHP, Math.floor(hp)));
    const ratio = cur / this.maxHP;

    g.fillStyle(0x000000, 0.8);
    g.fillRect(BAR_X - 3, BAR_Y - 3, BAR_W + 6, BAR_H + 6);
    g.fillStyle(0x3a1a1a, 1);
    g.fillRect(BAR_X, BAR_Y, BAR_W, BAR_H);

    if (ratio > 0) {
      const w = Math.max(1, BAR_W * ratio);
      g.fillStyle(0xe74c3c, 1);
      g.fillRect(BAR_X, BAR_Y, w, BAR_H);
      g.fillStyle(0xff8a80, 1);
      g.fillRect(BAR_X, BAR_Y, w, 4);
    }

    g.lineStyle(1, 0x000000, 0.45);
    for (let i = 1; i < TICKS; i++) {
      const x = BAR_X + (BAR_W * i) / TICKS;
      g.beginPath();
      g.moveTo(x, BAR_Y);
      g.lineTo(x, BAR_Y + BAR_H);
      g.strokePath();
    }

    this.numText.setText(`${cur}/${this.maxHP}`);
  }
}