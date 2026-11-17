// src/systems/minionTextures.ts — ภาพตัวแทะกระดาษ (procedural ชั่วคราว แบบเดียวกับ bossTextures)
// ก้อนกระดาษขยำ มีตา + รอยฉีกเป็นปาก — แสงซ้ายบน เงาขวาล่าง (เงาแยกวาดใน Minion.ts)
import Phaser from 'phaser';

export const MINION_TEX = 'minion_gnawer';

export function ensureMinionTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(MINION_TEX)) return;
  const g: any = scene.make.graphics({ x: 0, y: 0, add: false } as any);

  // ร่างก้อนกระดาษขยำ (หันขวา)
  g.fillStyle(0xcfc4a6, 1);
  g.beginPath();
  g.moveTo(8, 26);
  g.lineTo(14, 10);
  g.lineTo(30, 5);
  g.lineTo(46, 12);
  g.lineTo(52, 26);
  g.lineTo(46, 40);
  g.lineTo(28, 44);
  g.lineTo(12, 38);
  g.closePath();
  g.fillPath();

  //Facet สว่างซ้ายบน (แสงเกม)
  g.fillStyle(0xe8e0c8, 1);
  g.beginPath();
  g.moveTo(14, 12);
  g.lineTo(30, 7);
  g.lineTo(34, 18);
  g.lineTo(20, 22);
  g.closePath();
  g.fillPath();

  // Facet มืดขวาล่าง
  g.fillStyle(0xa89a7c, 0.9);
  g.beginPath();
  g.moveTo(34, 26);
  g.lineTo(48, 22);
  g.lineTo(46, 38);
  g.lineTo(32, 40);
  g.closePath();
  g.fillPath();

  // รอยพับกระดาษ
  g.lineStyle(1.5, 0x8a7d60, 0.8);
  g.beginPath();
  g.moveTo(20, 22);
  g.lineTo(34, 18);
  g.lineTo(34, 26);
  g.moveTo(34, 26);
  g.lineTo(32, 40);
  g.strokePath();

  // ตา (มองขวา)
  g.fillStyle(0x2a2018, 1);
  g.fillCircle(38, 18, 3.4);
  g.fillCircle(47, 21, 3);
  g.fillStyle(0xffffff, 0.9);
  g.fillCircle(39, 17, 1.1);
  g.fillCircle(48, 20, 1);

  // ปากรอยฉีก (ซิกแซก)
  g.lineStyle(2, 0x4a3a28, 1);
  g.beginPath();
  g.moveTo(36, 30);
  g.lineTo(40, 33);
  g.lineTo(43, 29);
  g.lineTo(47, 33);
  g.lineTo(50, 29);
  g.strokePath();

  // ขอบกระดาษ
  g.lineStyle(1.5, 0x6a5f48, 0.9);
  g.beginPath();
  g.moveTo(8, 26);
  g.lineTo(14, 10);
  g.lineTo(30, 5);
  g.lineTo(46, 12);
  g.lineTo(52, 26);
  g.lineTo(46, 40);
  g.lineTo(28, 44);
  g.lineTo(12, 38);
  g.closePath();
  g.strokePath();

  g.generateTexture(MINION_TEX, 56, 48);
  g.destroy();
}