// แถบเลือดบอส: อยู่บนกำแพงด้านล่างของจอ (ติดจอ ไม่ขยับตามกล้อง)
import Phaser from 'phaser';
import { DEPTH } from '../config';

export class BossHUD {
  private maxHP: number;
  private bar: any;

  constructor(scene: Phaser.Scene, name: string, maxHP: number) {
    this.maxHP = maxHP;

    scene.add.text(44, 584, name, {
      fontFamily: '"Noto Sans Thai", sans-serif',
      fontSize: '16px',
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

  update(hp: number) {
    const g = this.bar;
    g.clear();
    const x = 200;
    const y = 577;
    const w = 550;
    const h = 14;

    g.fillStyle(0x000000, 0.85);
    g.fillRect(x - 3, y - 3, w + 6, h + 6);
    g.fillStyle(0x3a1a1a);
    g.fillRect(x, y, w, h);

    const ratio = Math.max(0, hp / this.maxHP);
    if (ratio > 0) {
      g.fillStyle(0xe67e22);
      g.fillRect(x, y, w * ratio, h);
      g.fillStyle(0xffb066);
      g.fillRect(x, y, w * ratio, 4);
    }
  }
}