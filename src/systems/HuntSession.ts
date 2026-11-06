// "กระเป๋า" ของนักล่า — จำข้ามรอบการล่า และถูกเซฟลงเครื่องผ่าน SaveGame.ts
// หน้า Base อ่านค่าจากตรงนี้เพื่ออัปเกรดอุปกรณ์
import { LOOT_TABLE } from '../data/loot';

export interface BagItem {
  id: string;
  name: string;
  icon: string;
  rarity: string;
  color: string;
  count: number;
}

class HuntSessionStore {
  private bag: Map<string, BagItem> = new Map();

  // เพิ่มไอเทมเข้ากระเป๋า (ถ้ามีอยู่แล้วให้นับจำนวนเพิ่ม)
  addItem(item: { id: string; name: string; icon: string; rarity: string; color: string }): void {
    const existing = this.bag.get(item.id);
    if (existing) {
      existing.count += 1;
    } else {
      this.bag.set(item.id, {
        id: item.id,
        name: item.name,
        icon: item.icon,
        rarity: item.rarity,
        color: item.color,
        count: 1
      });
    }
  }

  getBag(): BagItem[] {
    return Array.from(this.bag.values());
  }

  getCount(id: string): number {
    const item = this.bag.get(id);
    return item ? item.count : 0;
  }

  // ใช้ของ (คืน true ถ้าของพอและหักแล้ว)
  spend(id: string, amount: number): boolean {
    const item = this.bag.get(id);
    if (!item || item.count < amount) return false;
    item.count -= amount;
    if (item.count <= 0) this.bag.delete(id);
    return true;
  }

  getTotalCount(): number {
    let total = 0;
    for (const item of this.bag.values()) total += item.count;
    return total;
  }

  // แปลงเป็นข้อมูลเรียบ ๆ สำหรับเซฟ
  exportBag(): Array<{ id: string; count: number }> {
    return Array.from(this.bag.values()).map((i) => ({ id: i.id, count: i.count }));
  }

  // โหลดจากเซฟ (ข้ามไอเทมที่ไม่มีในตารางแล้ว)
  importBag(entries: Array<{ id: string; count: number }>): void {
    this.bag.clear();
    for (const e of entries) {
      const def = LOOT_TABLE.find((l) => l.id === e.id);
      const count = Math.floor(Number(e.count));
      if (!def || !(count > 0)) continue;
      this.bag.set(def.id, {
        id: def.id,
        name: def.name,
        icon: def.icon,
        rarity: def.rarity,
        color: def.color,
        count
      });
    }
  }

  clear(): void {
    this.bag.clear();
  }
}

// singleton — มีก้อนเดียวในเครื่อง ไม่หายตอนเปลี่ยน scene
export const huntSession = new HuntSessionStore();