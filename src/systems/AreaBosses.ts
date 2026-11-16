// src/systems/AreaBosses.ts
// spawn บอสในแอเรียตาม depth tier + นับบอสที่ยังมีชีวิต + จัดการ hooks
import Phaser from 'phaser';
import { createBoss, type Boss } from '../entities/createBoss';
import { bossAsTarget } from './CombatTarget';
import type { BossHooks } from '../entities/BossBase';
import type { BossId } from '../data/bosses';
import type { AreaLayout } from './AreaGenerator';

const MIN_DIST_FROM_SPAWN = 1000;
const MIN_DIST_BETWEEN_BOSSES = 800;
const EDGE_MARGIN = 250;
const MAX_PLACEMENT_ATTEMPTS = 200;

import { SPAWNABLE_BOSSES } from '../data/bosses';
const BOSS_TYPES = SPAWNABLE_BOSSES;

export interface SpawnedBoss {
  boss: Boss;
  type: BossId;
  x: number;
  y: number;
}

/**
 * วางบอส 0–N ตัวในแอเรีย
 */
export function spawnAreaBosses(
  scene: Phaser.Scene,
  layout: AreaLayout,
  bossCount: number,
  hooks: BossHooks, // ส่ง hooks จาก WorldScene เข้าไปเพื่อให้บอสรู้ว่าจะตีใคร
  random: () => number = Math.random
): SpawnedBoss[] {
  const spawned: SpawnedBoss[] = [];

  for (let i = 0; i < bossCount; i++) {
    let placed = false;

    for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS && !placed; attempt++) {
      const x = EDGE_MARGIN + random() * (layout.width - EDGE_MARGIN * 2);
      const y = EDGE_MARGIN + random() * (layout.height - EDGE_MARGIN * 2);

      // กฎ 1: ห่างจุดเกิด
      const dxSpawn = x - layout.spawn.x;
      const dySpawn = y - layout.spawn.y;
      if (Math.hypot(dxSpawn, dySpawn) < MIN_DIST_FROM_SPAWN) continue;

      // กฎ 2: ห่างบอสตัวอื่น
      let tooClose = false;
      for (const other of spawned) {
        if (Math.hypot(x - other.x, y - other.y) < MIN_DIST_BETWEEN_BOSSES) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      const type = BOSS_TYPES[Math.floor(random() * BOSS_TYPES.length)];
      const boss = createBoss(scene, type, x, y, hooks);
      
      spawned.push({ boss, type, x, y });
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
    try {
      // BossBase ไม่มี destroy() ให้ใช้ ต้องแยกทำลาย object ข้างใน
      (s.boss as any).sprite?.destroy();
      (s.boss as any).shadow?.destroy();
      (s.boss as any).gfx?.destroy();
    } catch { /* ป้องกัน destroy ซ้ำ */ }
  }
  spawned.length = 0;
}