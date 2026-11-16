// src/systems/areaTextures.ts — วาดแผ่นภูมิประเทศ + ของตกแต่งเป็น texture "ครั้งเดียว"
// แล้ว WorldScene วางเป็น image (ห้ามวาด Graphics ใหม่ทุกแผ่นทุกเฟรม) — แนวเดียวกับ itemIcons.ts
// เป็นภาพชั่วคราว (procedural) ไว้ทดสอบระบบ — ภาพ Paper Cutout จริงมาแทนทีหลังโดยใช้ชื่อ texture เดิม
import Phaser from 'phaser';
import { TILE_SIZE, TILE_KINDS, TILE_KIND_IDS, type TileKind } from '../data/world';
import { makeRng } from './AreaGenerator';

export const tileKey = (k: TileKind) => `tile_${k}`;
export const propKey = (k: 'rock' | 'bush' | 'tuft') => `prop_${k}`;

function shade(color: number, f: number): number {
  const r = Math.max(0, Math.min(255, Math.round(((color >> 16) & 255) * f)));
  const g = Math.max(0, Math.min(255, Math.round(((color >> 8) & 255) * f)));
  const b = Math.max(0, Math.min(255, Math.round((color & 255) * f)));
  return (r << 16) | (g << 8) | b;
}

function bakeTile(scene: Phaser.Scene, kind: TileKind, index: number) {
  const key = tileKey(kind);
  if (scene.textures.exists(key)) return;
  const rng = makeRng(777 + index * 31);
  const base = TILE_KINDS[kind].base;
  const g: any = scene.make.graphics({ x: 0, y: 0, add: false } as any);
  g.fillStyle(base, 1);
  g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

  // ปื้นสีเหลื่อม — อยู่ห่างขอบแผ่น เพื่อให้ตะเข็บระหว่างแผ่นไม่เด่น
  for (let i = 0; i < 26; i++) {
    const x = 50 + rng() * (TILE_SIZE - 100);
    const y = 50 + rng() * (TILE_SIZE - 100);
    g.fillStyle(shade(base, 0.85 + rng() * 0.3), 0.18 + rng() * 0.14);
    g.fillEllipse(x, y, 40 + rng() * 90, 24 + rng() * 55);
  }
  // กรวด
  for (let i = 0; i < 24; i++) {
    const x = 20 + rng() * (TILE_SIZE - 40);
    const y = 20 + rng() * (TILE_SIZE - 40);
    const r = 2 + rng() * 5;
    g.fillStyle(rng() > 0.5 ? 0xaaa18a : 0x403e38, 0.2 + rng() * 0.15);
    g.fillEllipse(x, y, r * 2, r);
  }
  // หญ้าสั้น (แผ่นพุ่มมีมากกว่า)
  const grass = kind === 'brush' ? 46 : kind === 'moss' ? 28 : 10;
  for (let i = 0; i < grass; i++) {
    const x = 24 + rng() * (TILE_SIZE - 48);
    const y = 24 + rng() * (TILE_SIZE - 48);
    g.lineStyle(2, 0x596d3d, 0.35);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x - 4 - rng() * 5, y - 5 - rng() * 7);
    g.moveTo(x, y);
    g.lineTo(x + 4 + rng() * 5, y - 4 - rng() * 6);
    g.strokePath();
  }
  g.generateTexture(key, TILE_SIZE, TILE_SIZE);
  g.destroy();
}

function bakeProps(scene: Phaser.Scene) {
  const S = 64;
  if (!scene.textures.exists(propKey('rock'))) {
    const g: any = scene.make.graphics({ x: 0, y: 0, add: false } as any);
    g.fillStyle(0x000000, 0.28);
    g.fillEllipse(34, 46, 40, 12);
    g.fillStyle(0x7d786a, 1);
    g.fillEllipse(30, 34, 38, 28);
    g.fillStyle(0x9a9482, 1);
    g.fillEllipse(26, 30, 24, 16);
    g.generateTexture(propKey('rock'), S, S);
    g.destroy();
  }
  if (!scene.textures.exists(propKey('bush'))) {
    const g: any = scene.make.graphics({ x: 0, y: 0, add: false } as any);
    g.fillStyle(0x000000, 0.28);
    g.fillEllipse(34, 50, 46, 12);
    g.fillStyle(0x3f5230, 1);
    g.fillCircle(24, 36, 14);
    g.fillCircle(40, 36, 15);
    g.fillStyle(0x56703f, 1);
    g.fillCircle(32, 28, 16);
    g.fillStyle(0x6f8a4e, 1);
    g.fillCircle(28, 24, 7);
    g.generateTexture(propKey('bush'), S, S);
    g.destroy();
  }
  if (!scene.textures.exists(propKey('tuft'))) {
    const g: any = scene.make.graphics({ x: 0, y: 0, add: false } as any);
    g.lineStyle(3, 0x6f8a4e, 1);
    for (let i = -2; i <= 2; i++) {
      g.beginPath();
      g.moveTo(32 + i * 4, 48);
      g.lineTo(32 + i * 9, 26 - Math.abs(i) * 2);
      g.strokePath();
    }
    g.generateTexture(propKey('tuft'), S, S);
    g.destroy();
  }
}

/** เรียกใน create() ของฉาก — ข้ามให้เองถ้าเคยวาดแล้ว */
export function bakeAreaTextures(scene: Phaser.Scene) {
  TILE_KIND_IDS.forEach((k, i) => bakeTile(scene, k, i));
  bakeProps(scene);
}
