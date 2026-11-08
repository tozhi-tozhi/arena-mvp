// เอฟเฟกต์ภาพของท่าตัวละครใหม่
import Phaser from 'phaser';
import { DEPTH } from '../config';

// เส้นฟันโค้งเป็นพัด หมุนไปตามทิศ แล้วจางหาย
export function spawnArcSlash(
  scene: Phaser.Scene,
  x: number,
  y: number,
  angleRad: number,
  range: number,
  halfAngleDeg: number,
  color: number,
  lineWidth: number,
  ms: number
) {
  const g = scene.add.graphics();
  g.setPosition(x, y);
  g.setDepth(DEPTH.SLASH);
  const a0 = angleRad - Phaser.Math.DegToRad(halfAngleDeg);
  const a1 = angleRad + Phaser.Math.DegToRad(halfAngleDeg);

  g.lineStyle(lineWidth * 2.4, color, 0.25);
  g.beginPath();
  g.arc(0, 0, range * 0.85, a0, a1, false);
  g.strokePath();

  g.lineStyle(lineWidth, color, 0.95);
  g.beginPath();
  g.arc(0, 0, range * 0.85, a0, a1, false);
  g.strokePath();

  scene.tweens.add({
    targets: g,
    alpha: 0,
    scaleX: 1.12,
    scaleY: 1.12,
    duration: ms,
    onComplete: () => g.destroy()
  });
}