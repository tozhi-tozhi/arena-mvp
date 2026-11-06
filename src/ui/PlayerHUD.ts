// UI เลือดผู้เล่น: ช่องสี่เหลี่ยมเรียงกัน ติดจอมุมซ้ายบน
import Phaser from 'phaser';
import { DEPTH } from '../config';

export class PlayerHUD {
  private maxHP: number;
  private bar: any;

  constructor(scene: Phaser.Scene, maxHP: number) {
    this.maxHP = maxHP;

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

    this.update(maxHP);
  }

  // เรียกทุกครั้งที่เลือดผู้เล่นเปลี่ยน
  update(hp: number) {
    const g = this.bar;
    g.clear();
    const startX = 74;
    const y = 8;
    const segW = 28;
    const segH = 16;
    const gap = 4;

    // กรอบดำหลังช่องทั้งหมด
    const totalW = this.maxHP * segW + (this.maxHP - 1) * gap;
    g.fillStyle(0x000000, 0.8);
    g.fillRect(startX - 3, y - 3, totalW + 6, segH + 6);

    for (let i = 0; i < this.maxHP; i++) {
      const x = startX + i * (segW + gap);
      if (i < hp) {
        g.fillStyle(0xe74c3c);           // ช่องเต็ม (แดง)
        g.fillRect(x, y, segW, segH);
        g.fillStyle(0xff8a80);           // แถบสว่างด้านบน ให้ดูมีมิติ
        g.fillRect(x, y, segW, 4);
      } else {
        g.fillStyle(0x3a1a1a);           // ช่องว่าง
        g.fillRect(x, y, segW, segH);
      }
    }
  }
}