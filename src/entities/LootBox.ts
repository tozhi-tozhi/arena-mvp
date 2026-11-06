// กล่องสมบัติที่ดรอปจากมอนสเตอร์ — ผู้เล่นเดินเข้าใกล้แล้วกด E เพื่อเปิด
// เมื่อเปิดแล้วจะ "คายไอเทม" ออกมา (ยังไม่ได้ให้ของทันที) — การเก็บทำต่อใน DroppedItem
import Phaser from 'phaser';
import { DEPTH } from '../config';

// ---------- ตัวเลขที่ปรับแต่งได้ ----------
const BOX_SIZE = 32;      // ขนาดกล่องที่แสดงบนจอ (px)
const FLOAT_RANGE = 6;    // ระยะลอยขึ้นลงเบา ๆ
const PICKUP_RANGE = 60;  // ระยะที่กด E ได้

export class LootBox {
  public sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  public isOpened: boolean = false;
  private scene: Phaser.Scene;
  private promptText: Phaser.GameObjects.Text;
  private floatTween: Phaser.Tweens.Tween;
  private useImage: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.useImage = scene.textures.exists('loot_box_closed');

    if (this.useImage) {
      const img = scene.add.image(x, y, 'loot_box_closed');
      img.setDisplaySize(BOX_SIZE, BOX_SIZE);
      img.setDepth(DEPTH.ENEMY);
      this.sprite = img;
    } else {
      // ไม่มีรูป: ใช้สี่เหลี่ยมสีน้ำตาลแทน (เกมไม่พัง)
      const rect = scene.add.rectangle(x, y, 24, 24, 0x8b4513);
      rect.setStrokeStyle(2, 0xffd700);
      rect.setDepth(DEPTH.ENEMY);
      this.sprite = rect;
    }

    this.floatTween = scene.tweens.add({
      targets: this.sprite,
      y: y - FLOAT_RANGE,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.promptText = scene.add.text(x, y - 30, '[E] เปิดกล่อง', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ffff00',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(DEPTH.HUD).setVisible(false);
  }

  checkPlayerDistance(playerX: number, playerY: number) {
    if (this.isOpened) return;
    const dist = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, playerX, playerY);
    this.promptText.setVisible(dist <= PICKUP_RANGE);
    this.promptText.setPosition(this.sprite.x, this.sprite.y - 30);
  }

  // เปิดกล่อง — เล่นอนิเมชัน แล้วเรียก onComplete (GameScene จะคายไอเทมต่อ)
  open(onComplete: () => void) {
    if (this.isOpened) return;
    this.isOpened = true;
    this.floatTween.stop();
    this.promptText.destroy();

    // เปลี่ยนเป็นสถานะ "กล่องเปิด"
    if (this.useImage && this.scene.textures.exists('loot_box_open')) {
      const img = this.sprite as Phaser.GameObjects.Image;
      img.setTexture('loot_box_open');
      this.scene.tweens.add({
        targets: img,
        scaleX: img.scaleX * 1.25,
        scaleY: img.scaleY * 1.25,
        duration: 120,
        yoyo: true
      });
    } else {
      (this.sprite as Phaser.GameObjects.Rectangle).setFillStyle(0x555555);
    }

    // หน่วงนิดนึงให้เห็นกล่องเปิดก่อน แล้วให้ GameScene คายไอเทม
    this.scene.time.delayedCall(250, () => onComplete());

    // กล่องจางหายไป
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      duration: 400,
      delay: 400,
      onComplete: () => this.sprite.destroy()
    });
  }

  destroy() {
    this.floatTween.stop();
    this.promptText.destroy();
    this.sprite.destroy();
  }
}