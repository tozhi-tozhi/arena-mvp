// src/systems/CombatTarget.ts — หน้าตากลางของ "สิ่งที่ผู้เล่นตีได้"
// PlayerActor คุยกับเป้าหมายผ่านหน้าตานี้เท่านั้น — บอสและตัวแทะกระดาษใช้ร่วมได้
import type { BossBase, DecoyRef } from '../entities/BossBase';
import type { Minion } from '../entities/Minion';

export interface CombatTarget {
  /** ชนิดเป้า — เล็งอัตโนมัติบนมือถือเลือกบอสก่อนตัวแทะ */
  readonly kind: 'boss' | 'minion';
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly height: number;
  isAlive(): boolean;
  isHittable(): boolean;
  takeHit(damage: number): void;
  getDecoys(): DecoyRef[];
  hitDecoy(index: number): boolean;
}

/** ห่อบอสให้เป็น CombatTarget — ไม่แตะโค้ดบอสเดิมเลย */
export function bossAsTarget(boss: BossBase): CombatTarget {
  return {
    kind: 'boss',
    get x() { return boss.sprite.x; },
    get y() { return boss.sprite.y; },
    get radius() { return boss.def.displayWidth * 0.4; },
    get height() { return boss.sprite.displayHeight; },
    isAlive: () => boss.isAlive,
    isHittable: () => boss.isAlive && boss.isTargetable,
    takeHit: (damage) => boss.takeDamage(damage),
    getDecoys: () => boss.getDecoys(),
    hitDecoy: (index) => boss.hitDecoy(index)
  };
}

/** ห่อตัวแทะกระดาษ — ไม่มีร่างปลอม ไม่มีสถานะอมตะ */
export function minionAsTarget(minion: Minion): CombatTarget {
  return {
    kind: 'minion',
    get x() { return minion.sprite.x; },
    get y() { return minion.sprite.y; },
    get radius() { return minion.radius; },
    get height() { return minion.sprite.displayHeight; },
    isAlive: () => minion.isAlive,
    isHittable: () => minion.isAlive,
    takeHit: (damage) => minion.takeHit(damage),
    getDecoys: () => [],
    hitDecoy: () => false
  };
}