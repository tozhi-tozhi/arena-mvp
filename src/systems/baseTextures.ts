// src/systems/baseTextures.ts — ภาพของตกแต่งในฐาน (Paper Cutout)
// วาดครั้งเดียวแล้วเก็บเป็น texture เหมือน areaTextures/itemIcons — ห้ามวาดใหม่ทุกเฟรม
// แสงเข้าซ้ายบน → ด้านสว่างซ้ายบน เงาทอดขวาล่าง (ใช้ LIGHT จาก config)
import Phaser from 'phaser';
import { LIGHT } from '../config';
import { BASE_COLOR as C } from '../data/base';
import { makeRng } from './AreaGenerator';

export const BASE_TEX = {
  floorA: 'base_floor_a', floorB: 'base_floor_b',
  wallH: 'base_wall_h', wallV: 'base_wall_v',
  rug: 'base_rug', ring: 'base_ring',
  forge: 'base_forge', anvil: 'base_anvil',
  mirror: 'base_mirror', rack: 'base_rack',
  chest: 'base_chest', sack: 'base_sack', shelf: 'base_shelf',
  arch: 'base_arch', desk: 'base_desk', book: 'base_book', candle: 'base_candle',
  dummy: 'base_dummy', banner: 'base_banner', lamp: 'base_lamp', pot: 'base_pot'
} as const;

// ---------- ตัวช่วยวาด ----------
function shade(color: number, f: number): number {
  const r = Math.max(0, Math.min(255, Math.round(((color >> 16) & 255) * f)));
  const g = Math.max(0, Math.min(255, Math.round(((color >> 8) & 255) * f)));
  const b = Math.max(0, Math.min(255, Math.round((color & 255) * f)));
  return (r << 16) | (g << 8) | b;
}

function poly(g: any, pts: number[][], color: number, alpha = 1) {
  g.fillStyle(color, alpha);
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
  g.fillPath();
}

function edge(g: any, pts: number[][], color: number, w = 1.5, alpha = 0.8) {
  g.lineStyle(w, color, alpha);
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
  g.strokePath();
}

function drop(g: any, cx: number, cy: number, w: number, h: number, alpha = 0.3) {
  g.fillStyle(0x000000, alpha);
  g.fillEllipse(cx + LIGHT.OFFSET_X, cy + LIGHT.OFFSET_Y, w, h);
}

function fibers(g: any, rng: () => number, w: number, h: number, n: number) {
  for (let i = 0; i < n; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const len = 3 + rng() * 12;
    const a = rng() * Math.PI;
    g.lineStyle(1, rng() > 0.5 ? 0xffffff : 0x000000, 0.04 + rng() * 0.05);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.strokePath();
  }
}

// ผ้าแขวนมีรอยพับ + ชายไม่เรียบ
function cloth(g: any, x: number, y: number, w: number, h: number, color: number) {
  poly(g, [[x, y], [x + w, y], [x + w - 2, y + h], [x + w * 0.6, y + h - 6], [x + w * 0.3, y + h], [x + 2, y + h - 4]], color);
  poly(g, [[x, y], [x + w * 0.34, y], [x + w * 0.28, y + h - 6], [x + 2, y + h - 4]], shade(color, 1.18), 0.85);
  poly(g, [[x + w * 0.7, y], [x + w, y], [x + w - 2, y + h], [x + w * 0.72, y + h - 8]], shade(color, 0.78), 0.85);
  g.lineStyle(1.2, shade(color, 0.55), 0.7);
  g.strokeRect(x, y, w, h - 4);
}

function bake(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: any) => void) {
  if (scene.textures.exists(key)) return;
  const g: any = scene.make.graphics({ x: 0, y: 0, add: false } as any);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

// ---------- พื้นกระดาษปูแผ่น ----------
function bakeFloor(scene: Phaser.Scene, key: string, base: number, seed: number) {
  bake(scene, key, 400, 400, (g) => {
    const rng = makeRng(seed);
    g.fillStyle(base, 1);
    g.fillRect(0, 0, 400, 400);
    for (let i = 0; i < 4; i++) {
      const x = i * 100;
      g.fillStyle(shade(base, 0.92 + rng() * 0.18), 1);
      g.fillRect(x + 2, 0, 96, 400);
      g.fillStyle(0x000000, 0.2);
      g.fillRect(x, 0, 2, 400);
      g.fillStyle(0xffffff, 0.05);
      g.fillRect(x + 2, 0, 2, 400);
    }
    for (let i = 0; i < 10; i++) {
      g.fillStyle(shade(base, 0.78), 0.1 + rng() * 0.08);
      g.fillEllipse(rng() * 400, rng() * 400, 40 + rng() * 90, 24 + rng() * 50);
    }
    fibers(g, rng, 400, 400, 150);
    for (let i = 0; i < 4; i++) {
      for (let k = 0; k < 4; k++) {
        g.fillStyle(0x000000, 0.22);
        g.fillCircle(i * 100 + 11, 22 + k * 118, 2.2);
        g.fillStyle(0xffffff, 0.08);
        g.fillCircle(i * 100 + 10, 21 + k * 118, 1.1);
      }
    }
  });
}

// ---------- ขอบกระดาษรอบฐาน ----------
function bakeWalls(scene: Phaser.Scene) {
  bake(scene, BASE_TEX.wallH, 128, 56, (g) => {
    const rng = makeRng(41);
    g.fillStyle(C.wall, 1);
    g.fillRect(0, 0, 128, 56);
    for (let i = 0; i < 4; i++) {
      const x = i * 32;
      g.fillStyle(0x000000, 0.26);
      g.fillRect(x, 0, 2, 56);
      g.fillStyle(0xffffff, 0.05);
      g.fillRect(x + 2, 0, 2, 56);
    }
    g.fillStyle(C.wallEdge, 1);
    g.fillRect(0, 0, 128, 6);
    g.fillStyle(0xffffff, 0.07);
    g.fillRect(0, 0, 128, 2);
    g.fillStyle(0x000000, 0.36);
    g.fillRect(0, 50, 128, 6);
    fibers(g, rng, 128, 56, 40);
  });
  bake(scene, BASE_TEX.wallV, 56, 128, (g) => {
    const rng = makeRng(57);
    g.fillStyle(C.wall, 1);
    g.fillRect(0, 0, 56, 128);
    for (let i = 0; i < 4; i++) {
      const y = i * 32;
      g.fillStyle(0x000000, 0.26);
      g.fillRect(0, y, 56, 2);
      g.fillStyle(0xffffff, 0.05);
      g.fillRect(0, y + 2, 56, 2);
    }
    g.fillStyle(C.wallEdge, 1);
    g.fillRect(0, 0, 6, 128);
    g.fillStyle(0xffffff, 0.07);
    g.fillRect(0, 0, 2, 128);
    g.fillStyle(0x000000, 0.36);
    g.fillRect(50, 0, 6, 128);
    fibers(g, rng, 56, 128, 40);
  });
}

// ---------- พรมกลางฐาน ----------
function bakeRug(scene: Phaser.Scene) {
  bake(scene, BASE_TEX.rug, 560, 392, (g) => {
    const rng = makeRng(88);
    drop(g, 276, 366, 520, 34, 0.26);
    g.fillStyle(C.rug, 1);
    g.fillRoundedRect(4, 4, 548, 364, 16);
    g.fillStyle(shade(C.rug, 1.14), 1);
    g.fillRoundedRect(4, 4, 548, 12, 10);
    g.lineStyle(7, C.rugInk, 0.75);
    g.strokeRoundedRect(16, 16, 524, 340, 12);
    g.lineStyle(3, C.gold, 0.5);
    g.strokeRoundedRect(32, 32, 492, 308, 10);
    // ลายข้าวหลามตัดซ้อนกลางพรม
    for (let i = 0; i < 3; i++) {
      const r = 96 - i * 30;
      poly(g, [[278, 186 - r], [278 + r * 1.5, 186], [278, 186 + r], [278 - r * 1.5, 186]],
        i % 2 === 0 ? C.gold : C.paper, i === 2 ? 0.22 : 0.1);
    }
    g.lineStyle(2, C.paperDim, 0.28);
    g.strokeCircle(278, 186, 40);
    fibers(g, rng, 552, 368, 200);
    // ชายพู่
    for (let x = 16; x < 544; x += 18) {
      g.fillStyle(C.paperDim, 0.45);
      g.fillRect(x, 368, 6, 12);
      g.fillStyle(0x000000, 0.2);
      g.fillRect(x + 4, 368, 2, 12);
    }
  });
}

// ---------- วงจุดยืนใช้งาน (ฉากย้อมสีด้วย setTint) ----------
function bakeRing(scene: Phaser.Scene) {
  bake(scene, BASE_TEX.ring, 132, 132, (g) => {
    g.fillStyle(0xffffff, 0.06);
    g.fillCircle(66, 66, 46);
    g.lineStyle(1.5, 0xffffff, 0.3);
    g.strokeCircle(66, 66, 44);
    g.lineStyle(3.5, 0xffffff, 0.9);
    for (let i = 0; i < 24; i++) {
      const a = i * (Math.PI * 2 / 24);
      g.beginPath();
      g.arc(66, 66, 58, a, a + 0.16, false);
      g.strokePath();
    }
    g.fillStyle(0xffffff, 0.75);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      g.fillCircle(66 + Math.cos(a) * 58, 66 + Math.sin(a) * 58, 3);
    }
  });
}

// ---------- เตาตีเหล็ก +ทั่ง ----------
function bakeForge(scene: Phaser.Scene) {
  bake(scene, BASE_TEX.forge, 200, 172, (g) => {
    const rng = makeRng(12);
    drop(g, 100, 152, 180, 26);
    const body = [[16, 62], [184, 62], [176, 154], [24, 154]];
    poly(g, body, C.stone);
    poly(g, [[16, 62], [96, 62], [90, 108], [22, 108]], shade(C.stone, 1.16));
    poly(g, [[120, 100], [178, 96], [176, 154], [122, 152]], shade(C.stone, 0.82));
    // ก้อนหินก่อ
    g.lineStyle(1.4, shade(C.stone, 0.6), 0.6);
    g.beginPath();
    g.moveTo(20, 96); g.lineTo(180, 92);
    g.moveTo(22, 126); g.lineTo(178, 124);
    g.moveTo(70, 62); g.lineTo(66, 96);
    g.moveTo(128, 92); g.lineTo(126, 126);
    g.strokePath();
    // ปล่อง
    const chim = [[62, 8], [138, 8], [152, 62], [48, 62]];
    poly(g, chim, shade(C.stone, 0.9));
    poly(g, [[62, 8], [92, 8], [86, 62], [48, 62]], shade(C.stone, 1.12));
    edge(g, chim, C.ink, 1.5, 0.6);
    // ปากเตา + ถ่านไฟ
    g.fillStyle(0x1a1008, 1);
    g.fillEllipse(100, 118, 112, 60);
    g.fillStyle(C.ember, 0.95);
    g.fillEllipse(100, 122, 88, 38);
    g.fillStyle(0xffd070, 0.95);
    g.fillEllipse(100, 124, 52, 20);
    g.fillStyle(0xfff2cc, 0.9);
    g.fillEllipse(96, 124, 22, 9);
    edge(g, body, C.ink, 1.6, 0.7);
    fibers(g, rng, 200, 172, 50);
  });
  bake(scene, BASE_TEX.anvil, 104, 74, (g) => {
    drop(g, 52, 64, 84, 14);
    poly(g, [[28, 52], [76, 52], [72, 64], [32, 64]], shade(C.steel, 0.85));
    poly(g, [[42, 34], [62, 34], [66, 52], [38, 52]], C.steel);
    const top = [[14, 20], [86, 20], [94, 28], [82, 36], [22, 36], [10, 28]];
    poly(g, top, shade(C.steel, 1.3));
    poly(g, [[14, 20], [60, 20], [56, 27], [12, 27]], shade(C.steel, 1.7));
    poly(g, [[86, 22], [102, 27], [86, 33]], shade(C.steel, 1.1));
    edge(g, top, 0x1a1a20, 1.4, 0.8);
  });
}

// ---------- กระจก + ราวแขวนผ้า ----------
function bakeWardrobe(scene: Phaser.Scene) {
  bake(scene, BASE_TEX.mirror, 124, 180, (g) => {
    drop(g, 62, 168, 100, 18);
    g.fillStyle(C.wood, 1);
    g.fillRoundedRect(8, 6, 108, 162, 12);
    g.fillStyle(C.woodLight, 1);
    g.fillRoundedRect(8, 6, 108, 12, 10);
    g.fillStyle(0x28313d, 1);
    g.fillRoundedRect(22, 22, 80, 132, 6);
    poly(g, [[26, 126], [62, 24], [78, 24], [38, 144]], C.blue, 0.16);
    poly(g, [[56, 146], [92, 44], [100, 44], [68, 150]], 0xffffff, 0.09);
    g.fillStyle(C.violet, 0.13);
    g.fillEllipse(62, 112, 42, 62);
    g.fillStyle(C.paper, 0.1);
    g.fillEllipse(62, 78, 22, 24);
    g.lineStyle(2, 0x2a1a0c, 0.85);
    g.strokeRoundedRect(22, 22, 80, 132, 6);
    g.fillStyle(C.gold, 0.8);
    g.fillCircle(62, 14, 3.4);
  });
  bake(scene, BASE_TEX.rack, 172, 132, (g) => {
    drop(g, 86, 122, 146, 16);
    g.fillStyle(C.wood, 1);
    g.fillRect(16, 20, 10, 102);
    g.fillRect(146, 20, 10, 102);
    g.fillStyle(C.woodLight, 1);
    g.fillRect(16, 20, 4, 102);
    g.fillRect(146, 20, 4, 102);
    g.fillStyle(C.woodLight, 1);
    g.fillRect(12, 16, 148, 9);
    g.fillStyle(0xffffff, 0.1);
    g.fillRect(12, 16, 148, 3);
    cloth(g, 30, 25, 40, 86, C.violet);
    cloth(g, 76, 25, 38, 74, C.paperDim);
    cloth(g, 118, 25, 32, 90, C.blue);
    g.fillStyle(C.gold, 0.7);
    g.fillCircle(50, 22, 2.6);
    g.fillCircle(95, 22, 2.6);
    g.fillCircle(134, 22, 2.6);
  });
}

// ---------- หีบ + ชั้นขวด + กระสอบ ----------
function bakeStorage(scene: Phaser.Scene) {
  bake(scene, BASE_TEX.chest, 144, 108, (g) => {
    drop(g, 72, 96, 124, 18);
    g.fillStyle(C.wood, 1);
    g.fillRoundedRect(12, 46, 120, 52, 6);
    g.fillStyle(C.woodLight, 1);
    g.fillRoundedRect(12, 18, 120, 34, 12);
    g.fillStyle(0xffffff, 0.09);
    g.fillRoundedRect(14, 20, 116, 6, 4);
    g.fillStyle(C.steel, 1);
    g.fillRect(36, 18, 11, 80);
    g.fillRect(97, 18, 11, 80);
    g.fillStyle(0xffffff, 0.12);
    g.fillRect(36, 18, 3, 80);
    g.fillRect(97, 18, 3, 80);
    g.fillStyle(C.gold, 1);
    g.fillRoundedRect(64, 44, 16, 22, 3);
    g.fillStyle(C.ink, 1);
    g.fillCircle(72, 54, 3);
    g.fillRect(70, 54, 4, 7);
    g.lineStyle(1.6, 0x2a1a08, 0.8);
    g.strokeRoundedRect(12, 18, 120, 80, 8);
  });
  bake(scene, BASE_TEX.shelf, 164, 104, (g) => {
    drop(g, 82, 94, 140, 14);
    g.fillStyle(C.wood, 1);
    g.fillRect(10, 44, 144, 9);
    g.fillRect(10, 86, 144, 9);
    g.fillStyle(C.woodLight, 1);
    g.fillRect(10, 44, 144, 3);
    g.fillRect(10, 86, 144, 3);
    const jars: [number, number, number][] = [[30, 44, C.blue], [64, 44, C.green], [104, 44, C.gold], [136, 44, C.violet]];
    for (const [x, y, col] of jars) {
      g.fillStyle(0x2a2a26, 0.9);
      g.fillRoundedRect(x - 11, y - 30, 22, 30, 4);
      g.fillStyle(col, 0.75);
      g.fillRoundedRect(x - 8, y - 22, 16, 22, 3);
      g.fillStyle(0xffffff, 0.18);
      g.fillRect(x - 7, y - 26, 3, 22);
      g.fillStyle(C.paperDim, 1);
      g.fillRect(x - 8, y - 33, 16, 5);
    }
    g.fillStyle(C.paperDim, 0.9);
    g.fillRoundedRect(24, 62, 40, 24, 3);
    g.fillRoundedRect(72, 66, 34, 20, 3);
    g.lineStyle(1.2, C.ink, 0.5);
    g.strokeRoundedRect(24, 62, 40, 24, 3);
  });
  bake(scene, BASE_TEX.sack, 74, 88, (g) => {
    drop(g, 37, 78, 60, 14);
    poly(g, [[16, 34], [58, 34], [66, 78], [8, 78]], C.paperDim);
    poly(g, [[16, 34], [34, 34], [30, 78], [8, 78]], shade(C.paperDim, 1.12));
    poly(g, [[46, 34], [58, 34], [66, 78], [48, 78]], shade(C.paperDim, 0.84));
    g.fillStyle(C.paperDim, 1);
    g.fillEllipse(37, 30, 34, 20);
    g.lineStyle(3, C.wood, 0.9);
    g.beginPath();
    g.moveTo(20, 32); g.lineTo(54, 30);
    g.strokePath();
    g.lineStyle(1.4, C.ink, 0.55);
    g.beginPath();
    g.moveTo(16, 34); g.lineTo(8, 78); g.lineTo(66, 78); g.lineTo(58, 34);
    g.strokePath();
  });
}

// ---------- โค้งประตูสู่โลก ----------
function bakeArch(scene: Phaser.Scene) {
  bake(scene, BASE_TEX.arch, 232, 194, (g) => {
    drop(g, 116, 180, 206, 20);
    g.fillStyle(0x0d1410, 1);
    g.fillRect(54, 44, 124, 136);
    g.fillStyle(C.green, 0.1);
    g.fillEllipse(116, 152, 118, 72);
    g.fillStyle(C.green, 0.07);
    g.fillEllipse(116, 120, 84, 60);
    g.fillStyle(C.wood, 1);
    g.fillRect(34, 30, 22, 152);
    g.fillRect(176, 30, 22, 152);
    g.fillStyle(C.woodLight, 1);
    g.fillRect(34, 30, 7, 152);
    g.fillRect(176, 30, 7, 152);
    g.fillStyle(C.wood, 1);
    g.fillRect(20, 16, 192, 22);
    g.fillStyle(C.woodLight, 1);
    g.fillRect(20, 16, 192, 7);
    g.fillStyle(C.paper, 1);
    g.fillRect(86, 20, 60, 16);
    g.lineStyle(1.4, C.ink, 0.7);
    g.strokeRect(86, 20, 60, 16);
    g.lineStyle(2.4, C.green, 0.9);
    g.beginPath();
    g.moveTo(96, 28); g.lineTo(120, 28);
    g.moveTo(126, 24); g.lineTo(136, 28); g.lineTo(126, 32);
    g.strokePath();
    g.lineStyle(1.5, 0x2a1a08, 0.75);
    g.strokeRect(34, 30, 22, 152);
    g.strokeRect(176, 30, 22, 152);
    g.strokeRect(20, 16, 192, 22);
  });
}

// ---------- โต๊ะบันทึก + สมุด + เทียน ----------
function bakeDesk(scene: Phaser.Scene) {
  bake(scene, BASE_TEX.desk, 194, 132, (g) => {
    const rng = makeRng(31);
    drop(g, 96, 116, 170, 22);
    g.fillStyle(shade(C.wood, 0.7), 1);
    g.fillRect(26, 84, 14, 34);
    g.fillRect(154, 84, 14, 34);
    const top = [[14, 30], [180, 30], [172, 92], [22, 92]];
    poly(g, top, C.woodLight);
    poly(g, [[14, 30], [180, 30], [176, 44], [18, 44]], shade(C.woodLight, 1.16));
    g.lineStyle(1.4, shade(C.wood, 0.7), 0.6);
    g.beginPath();
    g.moveTo(18, 58); g.lineTo(176, 56);
    g.moveTo(20, 74); g.lineTo(174, 72);
    g.strokePath();
    edge(g, top, 0x2a1a08, 1.6, 0.8);
    // กองกระดาษมุมโต๊ะ
    for (let i = 0; i < 3; i++) {
      g.fillStyle(i === 2 ? C.paper : C.paperDim, 1);
      g.fillRect(126 + i * 2, 52 - i * 3, 42, 26);
      g.lineStyle(1, C.ink, 0.35);
      g.strokeRect(126 + i * 2, 52 - i * 3, 42, 26);
    }
    g.lineStyle(1, C.ink, 0.4);
    g.beginPath();
    g.moveTo(134, 52); g.lineTo(160, 52);
    g.moveTo(134, 58); g.lineTo(154, 58);
    g.strokePath();
    fibers(g, rng, 194, 132, 40);
  });
  bake(scene, BASE_TEX.book, 104, 76, (g) => {
    drop(g, 52, 66, 88, 12);
    poly(g, [[6, 16], [50, 10], [50, 62], [6, 66]], C.paper);
    poly(g, [[54, 10], [98, 16], [98, 66], [54, 62]], shade(C.paper, 0.94));
    g.fillStyle(C.wood, 1);
    g.fillRect(48, 10, 8, 54);
    g.lineStyle(1.2, C.ink, 0.45);
    for (let i = 0; i < 5; i++) {
      const y = 24 + i * 8;
      g.beginPath();
      g.moveTo(14, y + 1); g.lineTo(42, y - 1);
      g.moveTo(62, y - 1); g.lineTo(90, y + 1);
      g.strokePath();
    }
    g.fillStyle(C.danger, 0.85);
    g.fillRect(70, 12, 6, 30);
    g.lineStyle(1.5, C.ink, 0.6);
    g.beginPath();
    g.moveTo(6, 16); g.lineTo(50, 10); g.lineTo(98, 16); g.lineTo(98, 66); g.lineTo(54, 62);
    g.lineTo(50, 62); g.lineTo(6, 66);
    g.closePath();
    g.strokePath();
  });
  bake(scene, BASE_TEX.candle, 36, 68, (g) => {
    drop(g, 18, 60, 30, 10);
    g.fillStyle(C.steel, 1);
    g.fillEllipse(18, 58, 30, 12);
    g.fillStyle(shade(C.steel, 1.4), 1);
    g.fillEllipse(16, 56, 20, 7);
    g.fillStyle(C.paper, 1);
    g.fillRect(11, 22, 14, 34);
    g.fillStyle(shade(C.paper, 1.1), 1);
    g.fillRect(11, 22, 5, 34);
    g.fillStyle(shade(C.paper, 0.82), 1);
    g.fillRect(22, 22, 3, 34);
    g.fillStyle(C.paperDim, 1);
    g.fillEllipse(18, 22, 14, 6);
    g.lineStyle(2, C.ink, 0.9);
    g.beginPath();
    g.moveTo(18, 20); g.lineTo(18, 14);
    g.strokePath();
  });
}

// ---------- หุ่นซ้อม (เฉพาะโหมดทดสอบ) ----------
function bakeDummy(scene: Phaser.Scene) {
  bake(scene, BASE_TEX.dummy, 98, 144, (g) => {
    drop(g, 49, 132, 78, 16);
    g.fillStyle(C.wood, 1);
    g.fillRect(42, 60, 14, 74);
    g.fillStyle(C.woodLight, 1);
    g.fillRect(42, 60, 5, 74);
    g.fillStyle(C.wood, 1);
    g.fillRect(14, 66, 70, 10);
    poly(g, [[26, 24], [72, 24], [78, 62], [20, 62]], C.paperDim);
    poly(g, [[26, 24], [46, 24], [42, 62], [20, 62]], shade(C.paperDim, 1.14));
    g.fillStyle(C.paperDim, 1);
    g.fillCircle(49, 20, 16);
    g.lineStyle(2, C.danger, 0.9);
    g.strokeCircle(49, 44, 15);
    g.strokeCircle(49, 44, 7);
    g.fillStyle(C.danger, 0.85);
    g.fillCircle(49, 44, 3);
    g.lineStyle(1.4, C.ink, 0.6);
    g.beginPath();
    g.moveTo(26, 24); g.lineTo(72, 24); g.lineTo(78, 62); g.lineTo(20, 62);
    g.closePath();
    g.strokePath();
    g.lineStyle(1.2, C.ink, 0.5);
    g.beginPath();
    g.moveTo(38, 16); g.lineTo(44, 20);
    g.moveTo(56, 16); g.lineTo(52, 20);
    g.strokePath();
  });
}

// ---------- ธง · โคม · กระถาง ----------
function bakeDecor(scene: Phaser.Scene) {
  bake(scene, BASE_TEX.banner, 66, 112, (g) => {
    g.fillStyle(C.wood, 1);
    g.fillRect(4, 2, 58, 7);
    g.fillStyle(C.woodLight, 1);
    g.fillRect(4, 2, 58, 3);
    poly(g, [[8, 9], [58, 9], [58, 96], [33, 84], [8, 96]], C.rug);
    poly(g, [[8, 9], [26, 9], [24, 90], [8, 96]], shade(C.rug, 1.2));
    poly(g, [[44, 9], [58, 9], [58, 96], [44, 88]], shade(C.rug, 0.78));
    g.lineStyle(2.4, C.gold, 0.75);
    g.strokeCircle(33, 44, 15);
    g.fillStyle(C.gold, 0.8);
    g.fillCircle(33, 44, 5);
    g.lineStyle(1.6, C.gold, 0.5);
    g.beginPath();
    g.moveTo(16, 70); g.lineTo(50, 70);
    g.strokePath();
  });
  bake(scene, BASE_TEX.lamp, 54, 78, (g) => {
    drop(g, 27, 70, 40, 12);
    g.lineStyle(2.4, C.steel, 0.9);
    g.beginPath();
    g.moveTo(27, 4); g.lineTo(27, 16);
    g.strokePath();
    g.fillStyle(C.steel, 1);
    g.fillRect(14, 14, 28, 6);
    g.fillStyle(C.paper, 0.95);
    g.fillEllipse(27, 44, 42, 48);
    g.fillStyle(C.lamp, 0.85);
    g.fillEllipse(27, 46, 32, 36);
    g.fillStyle(0xfff2cc, 0.9);
    g.fillEllipse(24, 44, 14, 16);
    g.lineStyle(1.2, shade(C.paper, 0.7), 0.6);
    for (let i = -2; i <= 2; i++) {
      g.beginPath();
      g.moveTo(27 + i * 8, 22);
      g.lineTo(27 + i * 10, 66);
      g.strokePath();
    }
    g.fillStyle(C.steel, 1);
    g.fillRect(18, 64, 18, 5);
  });
  bake(scene, BASE_TEX.pot, 80, 100, (g) => {
    drop(g, 40, 90, 62, 14);
    // ใบเฟิร์นกระดาษ
    const leaves: [number, number, number][] = [[-26, -46, 0.9], [-10, -62, 1], [12, -56, 1], [28, -40, 0.9], [0, -70, 0.8]];
    for (const [dx, dy, s] of leaves) {
      poly(g, [[40, 62], [40 + dx * s, 62 + dy * s], [40 + dx * s * 0.5 + 8, 62 + dy * s * 0.6]], 0x4f6b38);
      poly(g, [[40, 62], [40 + dx * s, 62 + dy * s], [40 + dx * s * 0.5 - 4, 62 + dy * s * 0.6]], 0x63844a);
    }
    poly(g, [[20, 60], [60, 60], [54, 92], [26, 92]], C.rug);
    poly(g, [[20, 60], [34, 60], [30, 92], [26, 92]], shade(C.rug, 1.2));
    g.fillStyle(shade(C.rug, 1.1), 1);
    g.fillRect(18, 56, 44, 8);
    g.lineStyle(1.5, C.ink, 0.6);
    g.beginPath();
    g.moveTo(20, 60); g.lineTo(60, 60); g.lineTo(54, 92); g.lineTo(26, 92);
    g.closePath();
    g.strokePath();
  });
}

/** เรียกใน create() ของฉากฐาน/ห้องแต่งตัว — ข้ามให้เองถ้าเคยวาดแล้ว */
export function bakeBaseTextures(scene: Phaser.Scene) {
  if (scene.textures.exists(BASE_TEX.rug)) return;
  bakeFloor(scene, BASE_TEX.floorA, C.floorA, 101);
  bakeFloor(scene, BASE_TEX.floorB, C.floorB, 202);
  bakeWalls(scene);
  bakeRug(scene);
  bakeRing(scene);
  bakeForge(scene);
  bakeWardrobe(scene);
  bakeStorage(scene);
  bakeArch(scene);
  bakeDesk(scene);
  bakeDummy(scene);
  bakeDecor(scene);
}