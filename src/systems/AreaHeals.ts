// src/systems/AreaHeals.ts — วางจุดฟื้นเลือดสุ่ม 0–2 จุดต่อแอเรีย
// กฎ: ห่างจุดเข้า/ประตู/กันเอง · แถมตัวแทะเฝ้า 1 ตัวต่อจุด (การพักมีความเสี่ยง)
import Phaser from 'phaser';
import type { AreaLayout, Point } from './AreaGenerator';
import { HealShrine } from '../entities/HealShrine';
import { HEAL_SHRINE } from '../data/healing';

const MAX_ATTEMPTS = 200;

export function spawnHealShrines(
  scene: Phaser.Scene,
  layout: AreaLayout,
  random: () => number = Math.random
): HealShrine[] {
  const count = HEAL_SHRINE.count[0] + Math.floor(random() * (HEAL_SHRINE.count[1] - HEAL_SHRINE.count[0] + 1));
  const out: HealShrine[] = [];
  for (let i = 0; i < count; i++) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const m = HEAL_SHRINE.edgeMargin;
      const x = m + random() * (layout.width - m * 2);
      const y = m + random() * (layout.height - m * 2);
      if (Math.hypot(x - layout.spawn.x, y - layout.spawn.y) < HEAL_SHRINE.minFromSpawn) continue;
      if (Math.hypot(x - layout.exitGate.x, y - layout.exitGate.y) < HEAL_SHRINE.minFromGate) continue;
      if (Math.hypot(x - layout.returnGate.x, y - layout.returnGate.y) < HEAL_SHRINE.minFromGate) continue;
      if (out.some((s) => Math.hypot(x - s.x, y - s.y) < HEAL_SHRINE.minBetween)) continue;
      out.push(new HealShrine(scene, x, y));
      break;
    }
  }
  return out;
}

/** ตำแหน่งตัวแทะเฝ้าจุดฟื้น — ส่งให้ AreaMinions วางเพิ่มจากจุดสุ่มปกติ */
export function shrineGuardPoints(shrines: HealShrine[], random: () => number = Math.random): Point[] {
  const pts: Point[] = [];
  for (const s of shrines) {
    for (let i = 0; i < HEAL_SHRINE.minionGuardCount; i++) {
      const a = random() * Math.PI * 2;
      pts.push({
        x: s.x + Math.cos(a) * HEAL_SHRINE.minionGuardDist,
        y: s.y + Math.sin(a) * HEAL_SHRINE.minionGuardDist
      });
    }
  }
  return pts;
}

export function destroyHealShrines(list: HealShrine[]): void {
  for (const s of list) {
    try { s.destroy(); } catch { /* กันทำลายซ้ำ */ }
  }
  list.length = 0;
}