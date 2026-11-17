// src/systems/AreaMinions.ts — วางตัวแทะกระดาษ 4–5 ตัวต่อแอเรีย
// กฎ: ไม่เกิดทับผู้เล่น · ไม่เกาะกลุ่มบอส · กระจายตัว — แคชเป้าต่อสู้ครั้งเดียว (บทเรียน multi-hit)
import Phaser from 'phaser';
import { Minion, type MinionHooks } from '../entities/Minion';
import { minionAsTarget, type CombatTarget } from './CombatTarget';
import type { AreaLayout } from './AreaGenerator';
import type { SpawnedBoss } from './AreaBosses';
import { MINION } from '../data/minions';

const MAX_ATTEMPTS = 120;
const EDGE = 220;

export interface SpawnedMinion {
  minion: Minion;
  /** เป้าต่อสู้แคชครั้งเดียว — ห้ามสร้างใหม่ทุกเฟรม */
  target: CombatTarget;
  collider?: any;
}

export function spawnAreaMinions(
  scene: Phaser.Scene,
  layout: AreaLayout,
  bosses: SpawnedBoss[],
  hooks: MinionHooks,
  random: () => number = Math.random,
  extraPoints: { x: number; y: number }[] = []
): SpawnedMinion[] {
  const count = MINION.count[0] + Math.floor(random() * (MINION.count[1] - MINION.count[0] + 1));
  const out: SpawnedMinion[] = [];

  // จุดบังคับเกิดก่อน (ตัวเฝ้าจุดฟื้น) — ไม่ตรวจระยะ เพราะตั้งใจให้อยู่ใกล้เสา
  for (const p of extraPoints) {
    const x = Phaser.Math.Clamp(p.x, EDGE, layout.width - EDGE);
    const y = Phaser.Math.Clamp(p.y, EDGE, layout.height - EDGE);
    const minion = new Minion(scene, x, y, hooks);
    out.push({ minion, target: minionAsTarget(minion) });
  }

  for (let i = 0; i < count; i++) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const x = EDGE + random() * (layout.width - EDGE * 2);
      const y = EDGE + random() * (layout.height - EDGE * 2);
      if (Math.hypot(x - layout.spawn.x, y - layout.spawn.y) < MINION.minFromSpawn) continue;
      if (bosses.some((b) => Math.hypot(x - b.x, y - b.y) < MINION.minFromBoss)) continue;
      if (out.some((m) => Math.hypot(x - m.minion.sprite.x, y - m.minion.sprite.y) < MINION.minBetween)) continue;
      const minion = new Minion(scene, x, y, hooks);
      out.push({ minion, target: minionAsTarget(minion) });
      break;
    }
  }
  return out;
}

export function destroyAreaMinions(list: SpawnedMinion[]): void {
  for (const m of list) {
    try { m.collider?.destroy(); } catch { /* กันทำลายซ้ำ */ }
    try { m.minion.destroy(); } catch { /* กันทำลายซ้ำ */ }
  }
  list.length = 0;
}