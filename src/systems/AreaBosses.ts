// src/systems/AreaBosses.ts
// spawn บอสในแอเรียตาม depth tier + แคชเป้าต่อสู้ + นับบอสที่ยังมีชีวิต
import Phaser from 'phaser';
import { createBoss, type Boss } from '../entities/createBoss';
import { bossAsTarget, type CombatTarget } from './CombatTarget';
import type { BossHooks } from '../entities/BossBase';
import type { BossId } from '../data/bosses';
import type { AreaLayout } from './AreaGenerator';
import { SPAWNABLE_BOSSES } from '../data/bosses';
import { placementScale } from '../data/world';

const MIN_DIST_FROM_SPAWN = 1000;
const MIN_DIST_BETWEEN_BOSSES = 800;
const EDGE_MARGIN = 250;
const MAX_PLACEMENT_ATTEMPTS = 200;
const BOSS_TYPES = SPAWNABLE_BOSSES;

export interface SpawnedBoss {
  boss: Boss;
  type: BossId;
  x: number;
  y: number;
  /** เป้าต่อสู้ที่สร้าง "ครั้งเดียว" ต่อบอส — สร้างใหม่ทุกเฟรมไม่ได้ (บั๊กฟันทีเดียวเลือดลดหลายครั้ง) */
  target: CombatTarget;
  /** ตัวชนผู้เล่น-บอส — ทำลายตอนบอสตาย/เปลี่ยนแอเรีย */
  collider?: any;
}

/** วางบอส 0–N ตัวในแอเรีย */
export function spawnAreaBosses(
  scene: Phaser.Scene,
  layout: AreaLayout,
  bossCount: number,
  hooks: BossHooks,
  random: () => number = Math.random
): SpawnedBoss[] {
  const spawned: SpawnedBoss[] = [];

    // แมพเล็กผ่อนระยะวางลงตามสัดส่วน — กันวางบอสไม่ลงแล้วได้แอเรียว่าง
  const k = placementScale(layout.width, layout.height);
  const minFromSpawn = MIN_DIST_FROM_SPAWN * k;
  const minBetween = MIN_DIST_BETWEEN_BOSSES * k;
  const margin = EDGE_MARGIN * k;

  for (let i = 0; i < bossCount; i++) {
    let placed = false;
    for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS && !placed; attempt++) {
      const x = margin + random() * (layout.width - margin * 2);
      const y = margin + random() * (layout.height - margin * 2);

      // กฎ 1: ห่างจุดเกิด
      if (Math.hypot(x - layout.spawn.x, y - layout.spawn.y) < minFromSpawn) continue;

      // กฎ 2: ห่างบอสตัวอื่น
      let tooClose = false;
      for (const other of spawned) {
        if (Math.hypot(x - other.x, y - other.y) < minBetween) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;
      const type = BOSS_TYPES[Math.floor(random() * BOSS_TYPES.length)];
      const boss = createBoss(scene, type, x, y, hooks);
      spawned.push({ boss, type, x, y, target: bossAsTarget(boss) });
      placed = true;
    }
    if (!placed) console.warn(`[AreaBosses] วางบอสตัวที่ ${i} ไม่ได้ — ข้าม`);
  }
  return spawned;
}

export function countAliveBosses(spawned: SpawnedBoss[]): number {
  let n = 0;
  for (const s of spawned) {
    if (s.boss.isAlive) n++;
  }
  return n;
}

export function tickBossDeath(spawned: SpawnedBoss[], lastAlive: { value: number }): boolean {
  const nowAlive = countAliveBosses(spawned);
  const justCleared = lastAlive.value > 0 && nowAlive === 0;
  lastAlive.value = nowAlive;
  return justCleared;
}

export function destroyAreaBosses(spawned: SpawnedBoss[]): void {
  for (const s of spawned) {
    try { s.collider?.destroy(); } catch { /* กันทำลายซ้ำ */ }
    try { s.boss.destroy(); } catch { /* กันทำลายซ้ำ */ }
  }
  spawned.length = 0;
}