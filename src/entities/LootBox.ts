import Phaser from 'phaser';
import { DEPTH } from '../config';

export class LootBox {
  public sprite: Phaser.GameObjects.Rectangle;
  public isOpened: boolean = false;
  private scene: Phaser.Scene;
  private promptText: Phaser.GameObjects.Text;
  private floatTween: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;

    // 🌟 ใช้ Rectangle แทนรูปภาพไปก่อน (สีน้ำตาล = กล่องไม้)
    this.sprite = scene.add.rectangle(x, y, 24, 24, 0x8b4513);
    this.sprite.setStrokeStyle(2, 0xffd700); // ขอบสีทอง
    this.sprite.setDepth(DEPTH.ENEMY);

    // อนิเมชันลอยขึ้นลงเบาๆ
    this.floatTween = scene.tweens.add({
      targets: this.sprite,
      y: y - 6,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // ข้อความบอกให้กด E (ซ่อนไว้ก่อน)
    this.promptText = scene.add.text(x, y - 30, '[E] เก็บของ', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ffff00',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(DEPTH.HUD).setVisible(false);
  }

  // อัปเดตระยะห่างระหว่างผู้เล่นกับกล่อง (เรียกใน GameScene.update)
  checkPlayerDistance(playerX: number, playerY: number) {
    if (this.isOpened) return;
    
    const dist = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, playerX, playerY);
    // ถ้าอยู่ในระยะ 60px ให้โชว์ข้อความกด E
    this.promptText.setVisible(dist <= 60);
    this.promptText.setPosition(this.sprite.x, this.sprite.y - 30); // ให้ข้อความตามกล่อง
  }

  // ฟังก์ชันตอนผู้เล่นกด E
  open(onComplete: () => void) {
    if (this.isOpened) return;
    this.isOpened = true;

    // 1. หยุดลอย และซ่อนข้อความ E
    this.floatTween.stop();
    this.promptText.destroy();

    // 2. เปลี่ยนเป็นกล่องเปิด (🌟 อนาคตคุณเปลี่ยนเป็น this.sprite.setTexture('box_open') ตรงนี้)
    this.sprite.setFillStyle(0x555555); // เปลี่ยนสีเป็นเทาเข้ม (แทนกล่องเปิด)

    // 3. เอฟเฟกต์ "ฟิ้ว" ไอเทมลอยขึ้นมา
    const itemEffect = this.scene.add.rectangle(this.sprite.x, this.sprite.y, 16, 16, 0xffd700);
    this.scene.tweens.add({
      targets: itemEffect,
      y: this.sprite.y - 50, // ลอยขึ้น
      scale: 1.5,
      alpha: 0,
      duration: 400,
      ease: 'Back.easeOut',
      onComplete: () => itemEffect.destroy()
    });

    // 4. เรียกฟังก์ชันอัปเกรด (ที่เราพักไว้)
    onComplete();

    // 5. กล่องจางหายไป
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      duration: 500,
      delay: 300,
      onComplete: () => this.sprite.destroy()
    });
  }
}