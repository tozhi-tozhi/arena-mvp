// src/entities/SealedCache.ts — กล่องผนึกกระดาษ: เป้าเควส seal
//走近แล้วกด E → WorldScene เปิดมินิเกมแถบจังหวะ (เกมไม่หยุด)
// สำเร็จ = ฝาเปิด คายของดี / พัง = ผนึกสะท้อนใส่ผู้เล่น คายของปลอบใจ
import Phaser from 'phaser';
import { DEPTH } from '../config';
import { GLINT } from '../data/quests';
import { burst, ringEffect } from '../systems/effects';

const INTERACT_RANGE = 70;
const BOX_W = 40;
const BOX_H = 32;

export class SealedCache {
  readonly x: number;
  readonly y: number;
  private scene: Phaser.Scene;
  private body: Phaser.GameObjects.Rectangle;
  private band: Phaser.GameObjects.Rectangle;
  private prompt: Phaser.GameObjects.Text;
  private cracked = false;
  private broken = false;
  private lastGlint = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    // กล่องกระดาษด้าน + แถบผนึกอำพันคาดกลาง
    const shadow = scene.add.ellipse(x + 5, y + BOX_H / 2 + 3, BOX_W * 1.1, 10, 0x000000, 0.3);
    shadow.setDepth(DEPTH.ENEMY_SHADOW);
    this.body = scene.add.rectangle(x, y, BOX_W, BOX_H, 0xc9b891);
    this.body.setStrokeStyle(2, 0x6a5230);
    this.body.setDepth(DEPTH.ENEMY);
    this.band = scene.add.rectangle(x, y, BOX_W + 4, 8, 0xffd166, 0.9);
    this.band.setDepth(DEPTH.ENEMY + 0.1);
    scene.tweens.add({ targets: this.band, alpha: 0.55, duration: 900, yoyo: true, repeat: -1 });
    this.prompt = scene.add.text(x, y - 36, '[E] แกะผนึก', {
      fontFamily: '"Noto Sans Thai", monospace',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#ffd166',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(DEPTH.HUD).setVisible(false);
  }

  get isCracked(): boolean { return this.cracked; }
  get isBroken(): boolean { return this.broken; }
  get isResolved(): boolean { return this.cracked || this.broken; }

  isNear(px: number, py: number): boolean {
    return Phaser.Math.Distance.Between(this.x, this.y, px, py) <= INTERACT_RANGE;
  }

  /** เรียกทุกเฟรม: ป้าย E + แสงวาบเมื่อใกล้พอ (hint ไม่ใช่ลูกศร) */
  tick(px: number, py: number, now: number) {
    this.prompt.setVisible(!this.isResolved && this.isNear(px, py));
    if (this.isResolved) return;
    const d = Phaser.Math.Distance.Between(this.x, this.y, px, py);
    if (d <= GLINT.range && now - this.lastGlint >= GLINT.everyMs) {
      this.lastGlint = now;
      const glint = this.scene.add.circle(this.x, this.y - 18, 5, GLINT.color, 0.9);
      glint.setDepth(DEPTH.BURST);
      this.scene.tweens.add({
        targets: glint, scale: 2.6, alpha: 0, duration: 700,
        onComplete: () => glint.destroy()
      });
    }
  }

  /** มินิเกมชนะ — ฝาเปิด (ของจริงฉากเป็นคนคาย) */
  crackOpen() {
    if (this.isResolved) return;
    this.cracked = true;
    this.prompt.setVisible(false);
    this.scene.tweens.killTweensOf(this.band);
    this.scene.tweens.add({
      targets: this.band, alpha: 0, scaleX: 1.6, duration: 250,
      onComplete: () => this.band.destroy()
    });
    this.body.setFillStyle(0x8a7a58);
    burst(this.scene, this.x, this.y, 0xffd166, 16, 70, 5);
    ringEffect(this.scene, this.x, this.y, 70, 0xffd166, 400);
  }

  /** มินิเกมแพ้ครบครั้ง — ผนึกพัง สะท้อนใส่ผู้เล่น (ดาเมจฉากจัดการ) */
  breakSeal() {
    if (this.isResolved) return;
    this.broken = true;
    this.prompt.setVisible(false);
    this.scene.tweens.killTweensOf(this.band);
    this.scene.tweens.add({
      targets: this.band, alpha: 0, duration: 200,
      onComplete: () => this.band.destroy()
    });
    this.body.setFillStyle(0x5a5044);
    burst(this.scene, this.x, this.y, 0xff5a3a, 14, 60, 5);
    ringEffect(this.scene, this.x, this.y, 60, 0xff5a3a, 350);
    this.scene.cameras.main.shake(160, 0.008);
  }
}