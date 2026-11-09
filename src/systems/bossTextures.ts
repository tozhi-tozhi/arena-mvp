// สร้างภาพชั่วคราวของบอส — ถ้ามีไฟล์รูปจริงโหลดอยู่แล้ว จะข้ามไป
import Phaser from 'phaser';

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: any) => void) {
  if (scene.textures.exists(key)) return;
  const g: any = scene.make.graphics({ x: 0, y: 0, add: false } as any);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

export function ensureBossTextures(scene: Phaser.Scene) {
  // ภัสมะ: ตัวนิ่มลาวา ท่าปกติ (หันขวา)
  make(scene, 'boss_phasama', 128, 96, (g) => {
    g.fillStyle(0x5a2a1a);
    g.fillEllipse(58, 58, 104, 66);
    g.fillStyle(0xff6a2a);
    for (let i = 0; i < 5; i++) g.fillEllipse(24 + i * 17, 38, 16, 14);
    g.fillStyle(0x7a3a22);
    g.fillEllipse(108, 56, 34, 28);
    g.fillStyle(0xffd070);
    g.fillCircle(114, 50, 4);
    g.fillStyle(0x000000);
    g.fillCircle(115, 50, 2);
    g.fillStyle(0xff9a3a);
    g.fillEllipse(124, 62, 8, 6);
    g.fillStyle(0x3a1a10);
    g.fillRect(34, 82, 14, 12);
    g.fillRect(78, 82, 14, 12);
  });

  // ภัสมะ: ม้วนตัวเป็นลูกกลม (ตอนหมุนลูกข่าง)
  make(scene, 'boss_phasama_ball', 96, 96, (g) => {
    g.fillStyle(0x5a2a1a);
    g.fillCircle(48, 48, 44);
    g.lineStyle(4, 0xff9a3a);
    g.strokeCircle(48, 48, 30);
    g.strokeCircle(48, 48, 16);
    g.lineBetween(48, 4, 48, 92);
    g.lineBetween(4, 48, 92, 48);
  });

  // มายา: กระต่ายฝันร้าย
  make(scene, 'boss_maya', 100, 120, (g) => {
    g.fillStyle(0x6a4aa0);
    g.fillEllipse(50, 80, 64, 70);
    g.fillEllipse(50, 46, 54, 46);
    g.fillEllipse(34, 14, 14, 40);
    g.fillEllipse(66, 14, 14, 40);
    g.fillStyle(0xffffff);
    g.fillCircle(40, 46, 8);
    g.fillCircle(60, 46, 8);
    g.fillStyle(0x000000);
    g.fillCircle(41, 47, 3);
    g.fillCircle(59, 47, 3);
    g.lineStyle(3, 0x000000);
    g.beginPath();
    g.arc(50, 56, 12, 0.2, Math.PI - 0.2, false);
    g.strokePath();
  });
}