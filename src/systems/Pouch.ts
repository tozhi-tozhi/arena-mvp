// src/systems/Pouch.ts — เปลือกเรียกถุงพกพาของผู้เล่นท้องถิ่น (Phase 5A)
// ของจริงอยู่ที่ PlayerProfile แล้ว — กติกาเดิมทุกข้อ (1 ชิ้น = 1 ช่อง · เต็มเก็บไม่ได้ · ตายเสียครึ่ง · ไม่เซฟ)
import { profiles } from './PlayerProfile';
import type { DroppedLoot } from '../data/loot';

class PouchStore {
  private get p() { return profiles.local; }

  get startedAt(): number { return this.p.pouchStartedAt; }
  set startedAt(v: number) { this.p.pouchStartedAt = v; }

  startTrip(): void { this.p.startTrip(); }

  get count(): number { return this.p.pouchCount; }
  get capacity(): number { return this.p.pouchCapacity; }
  get isFull(): boolean { return this.p.pouchFull; }
  getItems(): DroppedLoot[] { return this.p.pouchList(); }

  add(loot: DroppedLoot): boolean { return this.p.pouchAdd(loot); }
  depositAll(): DroppedLoot[] { return this.p.pouchDepositAll(); }
  resolveDeath(random: () => number = Math.random): { kept: DroppedLoot[]; lost: DroppedLoot[] } {
    return this.p.pouchResolveDeath(random);
  }
}

export const pouch = new PouchStore();