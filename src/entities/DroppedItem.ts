// ไอเทมตกพื้น — เปลี่ยน type จาก LootDef → DroppedLoot (มี rarity)
// เพื่อดึงสีกรอบ rarity ที่ถูกต้อง
import Phaser from 'phaser';
import { DEPTH } from '../config';
import type { DroppedLoot } from '../data/loot';
import { RARITY } from '../data/rarity';
import { ensureItemIcons } from '../systems/itemIcons';

const ITEM_SIZE = 32;
const BORDER_SIZE = 42;
const FLOAT_RANGE = 5;
const PICKUP_RANGE = 50;

export class DroppedItem {
  public sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  public isCollected: boolean = false;
  public loot: DroppedLoot;
  private scene: Phaser.Scene;
  private border: Phaser.GameObjects.Rectangle;
  private promptText: Phaser.GameObjects.Text;
  private floatTween: Phaser.Tweens.Tween | null = null;
  private baseScaleX: number;
  private baseScaleY: number;

  constructor(scene: Phaser.Scene, x: number, y: number, loot: DroppedLoot) {
    this.scene = scene;
    this.loot = loot;
    ensureItemIcons(scene);

    const rd = RARITY[loot.rarity];

    this.border = scene.add.rectangle(x, y, BORDER_SIZE, BORDER_SIZE);
    this.border.setStrokeStyle(2, rd.colorNum, 1);
    this.border.setDepth(DEPTH.ENEMY - 0.1);

    if (scene.textures.exists(loot.icon)) {
      const img = scene.add.image(x, y, loot.icon);
      img.setDisplaySize(ITEM_SIZE, ITEM_SIZE);
      img.setDepth(DEPTH.ENEMY);
      this.sprite = img;
    } else {
      const rect = scene.add.rectangle(x, y, 20, 20, rd.colorNum);
      rect.setStrokeStyle(2, 0xffffff);
      rect.setDepth(DEPTH.ENEMY);
      this.sprite = rect;
    }

    this.baseScaleX = this.sprite.scaleX;
    this.baseScaleY = this.sprite.scaleY;

    this.sprite.setAlpha(0);
    this.sprite.setScale(this.baseScaleX * 0.3, this.baseScaleY * 0.3);
    this.border.setAlpha(0);
    this.border.setScale(0.3);

    scene.tweens.add({
      targets: this.sprite,
      alpha: 1,
      scaleX: this.baseScaleX,
      scaleY: this.baseScaleY,
      duration: 300,
      ease: 'Back.easeOut'
    });
    scene.tweens.add({
      targets: this.border,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 300,
      ease: 'Back.easeOut'
    });

    this.floatTween = scene.tweens.add({
      targets: [this.sprite, this.border],
      y: y - FLOAT_RANGE,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: 300
    });

    if (rd.glow) {
      scene.tweens.add({
        targets: this.border,
        scaleX: { from: 1, to: 1.15 },
        scaleY: { from: 1, to: 1.15 },
        duration: 700,
        yoyo: true,
        repeat: -1,
        delay: 400
      });
    }

    this.promptText = scene.add.text(x, y - 32, '[E] เก็บ', {
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
    this.promptText.setPosition(this.sprite.x, this.sprite.y - 32);
  }

  collect(onComplete: () => void) {
    if (this.isCollected) return;
    this.isCollected = true;
    if (this.floatTween) this.floatTween.stop();
    if (this.promptText.active) this.promptText.destroy();

    this.scene.tweens.killTweensOf(this.border);

    this.scene.tweens.add({
      targets: [this.sprite, this.border],
      y: this.sprite.y - 40,
      alpha: 0,
      duration: 350,
      ease: 'Sine.easeIn',
      onComplete: () => {
        if (this.sprite.active) this.sprite.destroy();
        if (this.border.active) this.border.destroy();
      }
    });
    this.scene.time.delayedCall(200, () => onComplete());
  }

  destroy() {
    if (this.floatTween) this.floatTween.stop();
    if (this.promptText.active) this.promptText.destroy();
    if (this.sprite.active) this.sprite.destroy();
    if (this.border.active) this.border.destroy();
  }
}