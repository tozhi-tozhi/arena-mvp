// กระเป๋านักล่า — เก็บไอเทมแบบ {itemId}_{rarity} แยกกัน
// เช่น ore_common แยกจาก ore_legendary เพื่อให้อัปเกรดตาม rarity ได้
import { LOOT_TABLE } from '../data/loot';
import { migrateRarity, RARITY, type Rarity } from '../data/rarity';

export interface BagEntry {
  key: string;      // full key = 'ore_common'
  itemId: string;   // 'ore'
  name: string;     // 'แร่'
  icon: string;     // 'item_ore'
  rarity: Rarity;
  count: number;
}

// map ของไอเทมเก่า → ใหม่ (migrate v2 → v3)
const LEGACY_ITEM_MAP: Record<string, string> = {
  herb: 'ore',
  essence: 'essence',
  dream_shard: 'bone',
  relic: 'essence'
};

function migrateItemId(oldId: string): string {
  return LEGACY_ITEM_MAP[oldId] ?? oldId;
}

class HuntSessionStore {
  private bag: Map<string, BagEntry> = new Map();

  // เพิ่มไอเทม — แยกตาม rarity
  addItem(dropped: { id: string; name: string; icon: string; rarity: Rarity }): void {
    const key = `${dropped.id}_${dropped.rarity}`;
    const existing = this.bag.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      this.bag.set(key, {
        key,
        itemId: dropped.id,
        name: dropped.name,
        icon: dropped.icon,
        rarity: dropped.rarity,
        count: 1
      });
    }
  }

  getBag(): BagEntry[] {
    return Array.from(this.bag.values());
  }

  // ยอดรวมของ itemId หนึ่ง (ทุกระดับ rarity) — ใช้แสดงใน Base
  getItemTotal(itemId: string): number {
    let total = 0;
    for (const entry of this.bag.values()) {
      if (entry.itemId === itemId) total += entry.count;
    }
    return total;
  }

  // จำนวนของ rarity ที่ระบุ — ใช้ตอนอัปเกรด
  getCountByRarity(itemId: string, rarity: Rarity): number {
    return this.bag.get(`${itemId}_${rarity}`)?.count ?? 0;
  }



  // ใช้ของ (ตาม rarity) — คืน true ถ้าพอ
  spend(itemId: string, rarity: Rarity, amount: number): boolean {
    const key = `${itemId}_${rarity}`;
    const entry = this.bag.get(key);
    if (!entry || entry.count < amount) return false;
    entry.count -= amount;
    if (entry.count <= 0) this.bag.delete(key);
    return true;
  }

  getTotalCount(): number {
    let total = 0;
    for (const entry of this.bag.values()) total += entry.count;
    return total;
  }

  // เซฟ: แค่ id + rarity + count
  exportBag(): Array<{ itemId: string; rarity: Rarity; count: number }> {
    return Array.from(this.bag.values()).map((e) => ({
      itemId: e.itemId,
      rarity: e.rarity,
      count: e.count
    }));
  }

  // โหลด: รองรับทั้ง v2 (id) และ v3 (itemId) + migrate item เก่า
  importBag(entries: any[]): void {
    this.bag.clear();
    if (!Array.isArray(entries)) return;
    for (const e of entries) {
      if (!e) continue;
      const rawId = String(e.itemId ?? e.id ?? '');
      const itemId = migrateItemId(rawId);
      const def = LOOT_TABLE.find((l) => l.id === itemId);
      if (!def) continue;
      const count = Math.floor(Number(e.count));
      if (!(count > 0)) continue;

      const rarity = migrateRarity(e.rarity);
      const key = `${itemId}_${rarity}`;
      const existing = this.bag.get(key);
      if (existing) {
        existing.count += count;
      } else {
        this.bag.set(key, {
          key,
          itemId: def.id,
          name: def.name,
          icon: def.icon,
          rarity,
          count
        });
      }
    }
  }

  clear(): void {
    this.bag.clear();
  }
}

export const huntSession = new HuntSessionStore();