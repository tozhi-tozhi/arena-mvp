// src/systems/Pouch.ts — ถุงพกพา (Phase 3C): ที่เก็บของ "ระหว่างทริป" ก่อนเข้ากระเป๋าถาวร
// กฎ: 1 ชิ้น = 1 ช่อง (ไม่ซ้อน) · เต็มแล้วเก็บเพิ่มไม่ได้ · กลับฐานผ่านประตู = โอนเข้ากระเป๋าทั้งหมด
//     ตาย = เสียครึ่งหนึ่ง ที่เหลือโอนเข้ากระเป๋า · ถุงอยู่ในหน่วยความจำเท่านั้น (ไม่เซฟ — ปิดเกมกลางทริป = จบทริป)
// ตัวเลขความจุอยู่ที่ Upgrades.ts · สัดส่วนที่เสียตอนตายอยู่ที่ data/world.ts
import type { DroppedLoot } from '../data/loot';
import { DEATH_LOSS_RATIO } from '../data/world';
import { huntSession } from './HuntSession';
import { pouchCapacityNow } from './Upgrades';

class PouchStore {
  private items: DroppedLoot[] = [];
  /** เวลาเริ่มทริป (ms) ไว้โชว์ในหน้าสรุป */
  startedAt: number = Date.now();

  /** เริ่มทริปใหม่ — ล้างถุง (เรียกตอนออกจากฐาน ไม่เรียกตอนเปลี่ยนแอเรีย) */
  startTrip() {
    this.items = [];
    this.startedAt = Date.now();
  }

  get count(): number {
    return this.items.length;
  }
  get capacity(): number {
    return pouchCapacityNow();
  }
  get isFull(): boolean {
    return this.items.length >= this.capacity;
  }
  getItems(): DroppedLoot[] {
    return this.items.slice();
  }

  /** ใส่ของ — คืน false ถ้าถุงเต็ม */
  add(loot: DroppedLoot): boolean {
    if (this.isFull) return false;
    this.items.push(loot);
    return true;
  }

  /** กลับฐานผ่านประตู: โอนทุกชิ้นเข้ากระเป๋าถาวร คืนรายการที่โอน */
  depositAll(): DroppedLoot[] {
    const moved = this.items;
    for (const it of moved) huntSession.addItem(it);
    this.items = [];
    return moved;
  }

  /** ตาย: สุ่มเสียตามสัดส่วน (ปัดขึ้น) ที่เหลือโอนเข้ากระเป๋าถาวร */
  resolveDeath(random: () => number = Math.random): { kept: DroppedLoot[]; lost: DroppedLoot[] } {
    const pool = this.items.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const loseN = Math.ceil(pool.length * DEATH_LOSS_RATIO);
    const lost = pool.slice(0, loseN);
    const kept = pool.slice(loseN);
    for (const it of kept) huntSession.addItem(it);
    this.items = [];
    return { kept, lost };
  }
}

export const pouch = new PouchStore();
