// "กระเป๋า" ของการล่า — จำข้ามรอบการล่า (กด R เริ่มใหม่ ของก็ไม่หาย)
// ตอนนี้อยู่ในหน่วยความจำก่อน (ยังไม่ต้องบันทึกไฟล์)
// อนาคต: หน้า "ฐาน" จะอ่านค่าจากตรงนี้เพื่ออัปเกรดอุปกรณ์
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
      this.bag.set(item.id, { ...item, count: 1 });
    }
  }

  getBag(): BagItem[] {
    return Array.from(this.bag.values());
  }

  getTotalCount(): number {
    let total = 0;
    for (const item of this.bag.values()) total += item.count;
    return total;
  }

  clear(): void {
    this.bag.clear();
  }
}

// singleton — มีก้อนเดียวในเครื่อง ไม่หายตอน scene.restart()
export const huntSession = new HuntSessionStore();