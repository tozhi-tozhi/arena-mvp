// src/entities/AreaGate.ts — ประตูวาป (กลับฐาน / ไปแอเรียถัดไป)
import Phaser from 'phaser';
import { DEPTH } from '../config';
import { makeGlow, destroyGlow } from '../systems/effects';

export class AreaGate {
  readonly x: number;
  readonly y: number;
  readonly isReturn: boolean;
  private scene: Phaser.Scene;
  private sprite: Phaser.GameObjects.Image;
  private promptText: Phaser.GameObjects.Text;
  private glow: Phaser.GameObjects.Container | any;
  private _isLocked: boolean;

  constructor(scene: Phaser.Scene, type: 'return' | 'next', x: number, y: number, locked: boolean) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.isReturn = type === 'return';
    this._isLocked = locked;

    // สร้าง Texture ประตูแบบ Procedural (ถ้าไม่มีภาพจริง)
    const texKey = this.isReturn ? 'gate_return' : 'gate_next';
    if (!scene.textures.exists(texKey)) {
      const g = scene.make.graphics({ x: 0, y: 0, add: false } as any);
      g.fillStyle(this.isReturn ? 0x7dff9b : 0xffd166, 1);
      g.fillCircle(32, 32, 28);
      g.fillStyle(0x000000, 0.8);
      g.fillCircle(32, 32, 20);
      g.generateTexture(texKey, 64, 64);
      g.destroy();
    }

    this.sprite = scene.add.image(x, y, texKey);
    this.sprite.setDepth(DEPTH.ENEMY);
    if (this.isReturn) {
      this.sprite.setScale(0.8);
    }

    this.promptText = scene.add.text(x, y - 50, '', {
      fontFamily: '"Noto Sans Thai", monospace',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(DEPTH.HUD).setVisible(false);

    // แสงอำพันสีทอง (P3b) — สำหรับประตู "ไปต่อ"
    if (!this.isReturn) {
      this.glow = makeGlow(scene, x, y, 45, 0xffd166, true);
      this.glow.setVisible(!this._isLocked);
    }
    
    this.updatePrompt();
  }

  get isLocked(): boolean {
    return this._isLocked;
  }

  setLocked(locked: boolean) {
    this._isLocked = locked;
    this.updatePrompt();
    if (this.glow) {
      this.glow.setVisible(!locked);
    }
  }

  isNear(px: number, py: number): boolean {
    return Phaser.Math.Distance.Between(this.x, this.y, px, py) <= 60;
  }

  checkPlayerDistance(px: number, py: number) {
    const near = this.isNear(px, py);
    this.promptText.setVisible(near);
    if (near) {
      this.promptText.setPosition(this.x, this.y - 50);
    }
  }

  private updatePrompt() {
    if (this.isReturn) {
      this.promptText.setText('[E] กลับฐาน').setColor('#7dff9b');
    } else {
      if (this._isLocked) {
        this.promptText.setText('ประตูล็อก').setColor('#bbbbbb');
      } else {
        this.promptText.setText('[E] ไปต่อ').setColor('#ffd166');
      }
    }
  }
  
  destroy() {
    if (this.sprite.active) this.sprite.destroy();
    if (this.promptText.active) this.promptText.destroy();
    if (this.glow) destroyGlow(this.glow);
  }
}