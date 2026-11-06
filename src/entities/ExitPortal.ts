// ประตูทางออก — ปรากฏหลังเก็บไอเทมครบ ผู้เล่นกด E เพื่อกลับฐาน (จบการล่า)
import Phaser from 'phaser';
import { DEPTH } from '../config';

// ---------- ตัวเลขที่ปรับแต่งได้ ----------
const PORTAL_RADIUS = 26; // รัศมีวงประตู
const PICKUP_RANGE = 55;  // ระยะที่กด E ได้

export class ExitPortal {
  public sprite: Phaser.GameObjects.Arc;
  private scene: Phaser.Scene;
  private promptText: Phaser.GameObjects.Text;
  private pulseTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;

    // วงประตูเรืองแสง
    this.sprite = scene.add.circle(x, y, PORTAL_RADIUS, 0x66ccff, 0.45);
    this.sprite.setStrokeStyle(3, 0x9de7ff);
    this.sprite.setDepth(DEPTH.ENEMY);

    // ตอนปรากฏ: ขยายจาก 0 แล้วค่อยเริ่ม "หายใจ"
    this.sprite.setScale(0);
    scene.tweens.add({
      targets: this.sprite,
      scale: 1,
      duration: 400,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.pulseTween = scene.tweens.add({
          targets: this.sprite,
          scale: 1.15,
          duration: 600,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      }
    });

    this.promptText = scene.add.text(x, y - 44, '[E] กลับฐาน', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#9de7ff',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(DEPTH.HUD).setVisible(false);
  }

  checkPlayerDistance(playerX: number, playerY: number) {
    const dist = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, playerX, playerY);
    this.promptText.setVisible(dist <= PICKUP_RANGE);
    this.promptText.setPosition(this.sprite.x, this.sprite.y - 44);
  }

  // เข้าประตู — เล่นอนิเมชัน แล้วเรียก onComplete (GameScene จะแสดงหน้าสรุป)
  enter(onComplete: () => void) {
    if (this.pulseTween) this.pulseTween.stop();
    this.promptText.destroy();
    this.scene.tweens.add({
      targets: this.sprite,
      scale: 1.5,
      alpha: 0,
      duration: 300,
      onComplete: () => this.sprite.destroy()
    });
    this.scene.time.delayedCall(150, () => onComplete());
  }
}