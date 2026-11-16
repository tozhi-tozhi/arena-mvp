// src/systems/CombatTarget.ts — หน้าตากลางของ "สิ่งที่ผู้เล่นตีได้"
// Phase 3A: PlayerActor คุยกับเป้าหมายผ่านหน้าตานี้เท่านั้น ไม่รู้จักบอสโดยตรง
// ตอนนี้มีแค่บอส (ผ่าน bossAsTarget) — Phase 3F จะเพิ่มมอนสเตอร์เดินสุ่มโดยไม่ต้องแก้ PlayerActor
import type { BossBase, DecoyRef } from '../entities/BossBase';

export interface CombatTarget {
  readonly x: number;
  readonly y: number;
  /** รัศมีตัวจริงที่ใช้ตรวจโดน (px) */
  readonly radius: number;
  /** ความสูงภาพที่แสดง (px) ใช้วางข้อความลอยเหนือหัว */
  readonly height: number;
  /** ยังมีชีวิตอยู่ (ใช้ตรวจร่างปลอม/ตัวผู้ถูกลบไปแล้ว) */
  isAlive(): boolean;
  /** ตีโดนได้ตอนนี้ไหม (มีชีวิต + ไม่อยู่ในสถานะอมตะ/หายตัว) */
  isHittable(): boolean;
  /** ลดเลือดเป้าหมาย */
  takeHit(damage: number): void;
  /** ร่างลวงที่ตีได้ (มายาเท่านั้น) — เป้าอื่นคืน [] */
  getDecoys(): DecoyRef[];
  /** ตีร่างลวงแตก — คืน true ถ้าตีโดนจริง */
  hitDecoy(index: number): boolean;
}

/** ห่อบอสให้เป็น CombatTarget — ไม่แตะโค้ดบอสเดิมเลย */
export function bossAsTarget(boss: BossBase): CombatTarget {
  return {
    get x() {
      return boss.sprite.x;
    },
    get y() {
      return boss.sprite.y;
    },
    // ค่าเดิมจาก GameScene.bossRadius()
    get radius() {
      return boss.def.displayWidth * 0.4;
    },
    get height() {
      return boss.sprite.displayHeight;
    },
    isAlive: () => boss.isAlive,
    isHittable: () => boss.isAlive && boss.isTargetable,
    takeHit: (damage) => boss.takeDamage(damage),
    getDecoys: () => boss.getDecoys(),
    hitDecoy: (index) => boss.hitDecoy(index)
  };
}
