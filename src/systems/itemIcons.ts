// ไอคอนไอเทม 4 ตัว — Paper Cutout style วาดด้วย Phaser Graphics
// ขนาด 64x64 (ใหญ่พอใส่กรอบ rarity รอบนอก)
// หลักการ: เงา (ขวาล่าง) → ร่างหลัก → ไฮไลท์ (ซ้ายบน) → ขอบกระดาษ
import Phaser from 'phaser';

const ICON_SIZE = 64;

export const ITEM_ICON_KEYS = ['item_ore', 'item_wood', 'item_bone', 'item_essence'] as const;
export type ItemIconKey = typeof ITEM_ICON_KEYS[number];

// idempotent — เรียกซ้ำได้ไม่พัง
export function ensureItemIcons(scene: Phaser.Scene) {
  if (scene.textures.exists('item_ore')) return;
  makeOre(scene);
  makeWood(scene);
  makeBone(scene);
  makeEssence(scene);
}

// ---------- Ore (แร่) — ก้อนหินสีน้ำตาล มีเส้นแร่ทองแดง ----------
function makeOre(scene: Phaser.Scene) {
  const g: any = scene.make.graphics({ x: 0, y: 0, add: false } as any);

  // เงา
  g.fillStyle(0x1a0f05, 0.4);
  g.fillEllipse(36, 50, 44, 12);

  // ร่างหลัก (polygon ไม่สม่ำเสมอ)
  g.fillStyle(0x6a4a2a);
  g.beginPath();
  g.moveTo(16, 28);
  g.lineTo(20, 16);
  g.lineTo(34, 10);
  g.lineTo(50, 16);
  g.lineTo(54, 32);
  g.lineTo(48, 48);
  g.lineTo(30, 54);
  g.lineTo(16, 44);
  g.closePath();
  g.fillPath();

  // facet สว่างซ้ายบน
  g.fillStyle(0x9a7a4a);
  g.beginPath();
  g.moveTo(20, 22);
  g.lineTo(34, 14);
  g.lineTo(38, 26);
  g.lineTo(26, 32);
  g.closePath();
  g.fillPath();

  // facet กลาง
  g.fillStyle(0x7a5a3a);
  g.beginPath();
  g.moveTo(38, 26);
  g.lineTo(48, 22);
  g.lineTo(50, 38);
  g.lineTo(42, 42);
  g.lineTo(36, 34);
  g.closePath();
  g.fillPath();

  // เส้นแร่ทองแดง
  g.lineStyle(2, 0xc87a3a, 0.9);
  g.beginPath();
  g.moveTo(24, 40);
  g.lineTo(30, 32);
  g.lineTo(38, 36);
  g.moveTo(38, 44);
  g.lineTo(44, 38);
  g.strokePath();

  // จุดประกายแร่
  g.fillStyle(0xffd070, 0.9);
  g.fillCircle(32, 34, 2);
  g.fillCircle(42, 40, 1.5);
  g.fillCircle(26, 42, 1.5);

  // ขอบกระดาษ
  g.lineStyle(1.5, 0x3a2010, 0.8);
  g.beginPath();
  g.moveTo(16, 28);
  g.lineTo(20, 16);
  g.lineTo(34, 10);
  g.lineTo(50, 16);
  g.lineTo(54, 32);
  g.lineTo(48, 48);
  g.lineTo(30, 54);
  g.lineTo(16, 44);
  g.closePath();
  g.strokePath();

  g.generateTexture('item_ore', ICON_SIZE, ICON_SIZE);
  g.destroy();
}

// ---------- Wood (ไม้) — ท่อนซุงนอน มีวงปี + มอสเขียว ----------
function makeWood(scene: Phaser.Scene) {
  const g: any = scene.make.graphics({ x: 0, y: 0, add: false } as any);

  // เงา
  g.fillStyle(0x1a0f05, 0.4);
  g.fillEllipse(34, 48, 46, 12);

  // เปลือกไม้ (ท่อนนอน)
  g.fillStyle(0x5a3a1a);
  g.fillRoundedRect(10, 22, 46, 24, 4);

  // เนื้อไม้ด้านข้าง (บน)
  g.fillStyle(0x8a5a2a);
  g.fillRoundedRect(10, 18, 46, 8, 4);

  // ไฮไลท์เนื้อไม้
  g.fillStyle(0xb07a3a);
  g.fillRoundedRect(12, 20, 42, 3, 2);

  // เส้นเปลือกไม้
  g.lineStyle(1, 0x3a2010, 0.7);
  g.beginPath();
  g.moveTo(14, 32); g.lineTo(50, 32);
  g.moveTo(14, 38); g.lineTo(50, 38);
  g.moveTo(18, 26); g.lineTo(18, 42);
  g.moveTo(28, 26); g.lineTo(28, 42);
  g.moveTo(40, 26); g.lineTo(40, 42);
  g.strokePath();

  // ปลายท่อน (เห็นวงปี)
  g.fillStyle(0xc8a87a);
  g.fillCircle(56, 30, 8);

  // วงปี
  g.lineStyle(1, 0x8a5a2a, 0.9);
  g.strokeCircle(56, 30, 6);
  g.strokeCircle(56, 30, 4);
  g.strokeCircle(56, 30, 2);

  // มอสเขียว (จุด)
  g.fillStyle(0x4a8a3a, 0.9);
  g.fillCircle(18, 20, 3);
  g.fillCircle(24, 22, 2);
  g.fillCircle(34, 20, 2.5);

  // ขอบ
  g.lineStyle(1.5, 0x2a1a08, 0.7);
  g.strokeRoundedRect(10, 18, 46, 28, 4);

  g.generateTexture('item_wood', ICON_SIZE, ICON_SIZE);
  g.destroy();
}

// ---------- Bone (กระดูก) — ชิ้นกระดูกปลายมน 2 ข้าง ----------
function makeBone(scene: Phaser.Scene) {
  const g: any = scene.make.graphics({ x: 0, y: 0, add: false } as any);

  // เงา
  g.fillStyle(0x2a2010, 0.35);
  g.fillEllipse(34, 50, 44, 10);

  // ร่างกระดูกหลัก (ก้าน)
  g.fillStyle(0xe8e0c8);
  g.fillRoundedRect(20, 26, 24, 12, 4);

  // ปลายบน (knob)
  g.fillCircle(20, 24, 8);
  g.fillCircle(20, 40, 8);

  // ปลายล่าง (knob)
  g.fillCircle(44, 24, 8);
  g.fillCircle(44, 40, 8);

  // ไฮไลท์ซ้ายบน
  g.fillStyle(0xfaf4e0, 0.9);
  g.fillCircle(18, 22, 4);
  g.fillCircle(42, 22, 4);
  g.fillRect(22, 28, 20, 3);

  // เงาด้านล่าง
  g.fillStyle(0xa89a80, 0.5);
  g.fillCircle(22, 42, 5);
  g.fillCircle(46, 42, 5);
  g.fillRect(24, 36, 16, 2);

  // รอยแตก
  g.lineStyle(1.5, 0x8a8070, 0.7);
  g.beginPath();
  g.moveTo(30, 28);
  g.lineTo(32, 34);
  g.lineTo(30, 40);
  g.strokePath();

  // ขอบกระดาษ
  g.lineStyle(1.5, 0x6a6048, 0.6);
  g.strokeRoundedRect(20, 26, 24, 12, 4);
  g.strokeCircle(20, 24, 8);
  g.strokeCircle(20, 40, 8);
  g.strokeCircle(44, 24, 8);
  g.strokeCircle(44, 40, 8);

  g.generateTexture('item_bone', ICON_SIZE, ICON_SIZE);
  g.destroy();
}

// ---------- Essence (ธาตุ) — ผลึกน้ำเงิน-ม่วง มีออร่า ----------
function makeEssence(scene: Phaser.Scene) {
  const g: any = scene.make.graphics({ x: 0, y: 0, add: false } as any);

  // เงา
  g.fillStyle(0x1a0a2a, 0.4);
  g.fillEllipse(32, 52, 30, 10);

  // ออร่าเรือง
  g.fillStyle(0x7db8ff, 0.18);
  g.fillCircle(32, 32, 26);
  g.fillStyle(0xc084fc, 0.12);
  g.fillCircle(32, 32, 20);

  // ร่างผลึก (แหลมบน แหลมล่าง)
  g.fillStyle(0x5a3adf);
  g.beginPath();
  g.moveTo(32, 8);
  g.lineTo(46, 26);
  g.lineTo(42, 44);
  g.lineTo(32, 54);
  g.lineTo(22, 44);
  g.lineTo(18, 26);
  g.closePath();
  g.fillPath();

  // facet สว่างซ้ายบน
  g.fillStyle(0x9a6aff);
  g.beginPath();
  g.moveTo(32, 8);
  g.lineTo(22, 22);
  g.lineTo(30, 28);
  g.lineTo(32, 16);
  g.closePath();
  g.fillPath();

  // facet กลาง
  g.fillStyle(0x7a4aff);
  g.beginPath();
  g.moveTo(32, 16);
  g.lineTo(30, 28);
  g.lineTo(38, 34);
  g.lineTo(42, 26);
  g.closePath();
  g.fillPath();

  // ไฮไลท์จุด
  g.fillStyle(0xffffff, 0.9);
  g.fillCircle(28, 18, 2.5);
  g.fillCircle(24, 30, 1.5);

  // ประกายลอย
  g.fillStyle(0xc084fc, 0.7);
  g.fillCircle(46, 16, 1.5);
  g.fillCircle(18, 42, 1.5);
  g.fillCircle(48, 46, 1);

  // ขอบผลึก
  g.lineStyle(1.5, 0x3a1a8a, 0.8);
  g.beginPath();
  g.moveTo(32, 8);
  g.lineTo(46, 26);
  g.lineTo(42, 44);
  g.lineTo(32, 54);
  g.lineTo(22, 44);
  g.lineTo(18, 26);
  g.closePath();
  g.strokePath();

  g.generateTexture('item_essence', ICON_SIZE, ICON_SIZE);
  g.destroy();
}