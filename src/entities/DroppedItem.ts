// ไอเทมที่ตกอยู่บนพื้น — ผู้เล่นเดินเข้าใกล้แล้วกด E เพื่อเก็บเข้ากระเป๋า
import Phaser from 'phaser';
import { DEPTH } from '../config';
import type { LootDef } from '../data/loot';

// ---------- ตัวเลขที่ปรับแต่งได้ ----------
const ITEM_SIZE = 24;     // ขนาดไอเทมที่แสดง (px)
const FLOAT_RANGE = 5;    // ระยะลอยขึ้นลงเบา ๆ
const PICKUP_RANGE = 50;  // ระยะที่กด E เก็บได้

export class DroppedItem {
  public sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  public isCollected: boolean = false;
  public loot: LootDef;
  private scene: Phaser.Scene;
  private promptText: Phaser.GameObjects.Text;
  private floatTween: Phaser.Tweens.Tween;
  private baseScaleX: number; // scale ปกติ (รูปกับสี่เหลี่ยมมี scale ต่างกัน)
  private baseScaleY: number;

  constructor(scene: Phaser.Scene, x: number, y: number, loot: LootDef) {
    this.scene = scene;
    this.loot = loot;

    // ใช้รูปไอเทมถ้ามี ถ้าไม่มีใช้สี่เหลี่ยมสีทองแทน (เกมไม่พัง)
    if (scene.textures.exists(loot.icon)) {
      const img = scene.add.image(x, y, loot.icon);
      img.setDisplaySize(ITEM_SIZE, ITEM_SIZE);
      img.setDepth(DEPTH.ENEMY);
      this.sprite = img;
    } else {
      const rect = scene.add.rectangle(x, y, 18, 18, 0xffd700);
      rect.setStrokeStyle(2, 0xffffff);
      rect.setDepth(DEPTH.ENEMY);
      this.sprite = rect;
    }

    // จำ scale ปกติไว้ก่อน แล้วค่อยทำอนิเมชันเด้งออกจากกล่อง
    this.baseScaleX = this.sprite.scaleX;
    this.baseScaleY = this.sprite.scaleY;
    this.sprite.setAlpha(0);
    this.sprite.setScale(this.baseScaleX * 0.3, this.baseScaleY * 0.3);
    scene.tweens.add({
      targets: this.sprite,
      alpha: 1,
      scaleX: this.baseScaleX,
      scaleY: this.baseScaleY,
      duration: 300,
      ease: 'Back.easeOut'
    });

    // ลอยขึ้นลงเบา ๆ (เริ่มหลังอนิเมชันเด้งเสร็จ)
    this.floatTween = scene.tweens.add({
      targets: this.sprite,
      y: y - FLOAT_RANGE,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: 300
    });

    this.promptText = scene.add.text(x, y - 28, '[E] เก็บ', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#7dff9b',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(DEPTH.HUD).setVisible(false);
  }

  checkPlayerDistance(playerX: number, playerY: number) {
    if (this.isCollected) return;
    const dist = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, playerX, playerY);
    this.promptText.setVisible(dist <= PICKUP_RANGE);
    this.promptText.setPosition(this.sprite.x, this.sprite.y - 28);
  }

  // เก็บไอเทม — เล่นอนิเมชัน "ฟิ้ว" เข้ากระเป๋า แล้วเรียก onComplete
  collect(onComplete: () => void) {
    if (this.isCollected) return;
    this.isCollected = true;
    this.floatTween.stop();
    this.promptText.destroy();

    this.scene.tweens.add({
      targets: this.sprite,
      y: this.sprite.y - 40,
      alpha: 0,
      scaleX: this.baseScaleX * 1.4,
      scaleY: this.baseScaleY * 1.4,
      duration: 350,
      ease: 'Sine.easeIn',
      onComplete: () => this.sprite.destroy()
    });
    this.scene.time.delayedCall(200, () => onComplete());
  }

  destroy() {
    this.floatTween.stop();
    this.promptText.destroy();
    this.sprite.destroy();
  }
}