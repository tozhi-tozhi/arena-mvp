// src/entities/AreaGate.ts — ประตูของแอเรีย: กลับฐาน (เปิดเสมอ) / ไปต่อ (ล็อกจนปลดเงื่อนไข)
import Phaser from 'phaser';
import { DEPTH } from '../config';
import { GATE_INTERACT_RANGE } from '../data/world';

export type GateKind = 'return' | 'next';

const RADIUS = 30;

export class AreaGate {
  readonly kind: GateKind;
  readonly x: number;
  readonly y: number;
  private circle: Phaser.GameObjects.Arc;
  private label: Phaser.GameObjects.Text;
  private locked: boolean;

  constructor(scene: Phaser.Scene, kind: GateKind, x: number, y: number, locked: boolean) {
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.locked = locked;

    this.circle = scene.add.circle(x, y, RADIUS, 0xffffff, 0.4).setDepth(DEPTH.ENEMY);
    this.label = scene.add
      .text(x, y - 52, '', {
        fontFamily: '"Noto Sans Thai", monospace',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.HUD)
      .setVisible(false);

    scene.tweens.add({
      targets: this.circle,
      scale: 1.12,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    this.refreshLook();
  }

  get isLocked(): boolean {
    return this.locked;
  }

  setLocked(v: boolean) {
    this.locked = v;
    this.refreshLook();
  }

  isNear(px: number, py: number): boolean {
    return Phaser.Math.Distance.Between(this.x, this.y, px, py) <= GATE_INTERACT_RANGE;
  }

  /** โชว์ข้อความเมื่อผู้เล่นเข้าใกล้ */
  checkPlayerDistance(px: number, py: number) {
    this.label.setVisible(this.isNear(px, py));
  }

  private refreshLook() {
    if (this.kind === 'return') {
      this.circle.setFillStyle(0x66ccff, 0.45).setStrokeStyle(3, 0x9de7ff);
      this.label.setText('[E] กลับฐาน').setColor('#9de7ff');
    } else if (this.locked) {
      this.circle.setFillStyle(0x777777, 0.4).setStrokeStyle(3, 0xaaaaaa);
      this.label.setText('ประตูล็อก').setColor('#bbbbbb');
    } else {
      this.circle.setFillStyle(0xffd166, 0.45).setStrokeStyle(3, 0xffe9a8);
      this.label.setText('[E] ไปแอเรียถัดไป').setColor('#ffd166');
    }
  }
}
