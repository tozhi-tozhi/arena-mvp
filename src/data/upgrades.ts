// ราคาอัปเกรดอุปกรณ์ — แก้ตัวเลขที่นี่ที่เดียว
// รูปแบบ: UPGRADE_COSTS[ช่อง][เลเวลปลายทาง] = รายการของที่ต้องใช้
import type { EquipmentSlot } from './equipment';

export interface UpgradeCost {
  itemId: string; // id ของไอเทมใน data/loot.ts (herb / essence / relic)
  amount: number;
}

export const UPGRADE_COSTS: Record<EquipmentSlot, Record<number, UpgradeCost[]>> = {
  weapon: {
    2: [{ itemId: 'herb', amount: 2 }],
    3: [{ itemId: 'herb', amount: 3 }, { itemId: 'essence', amount: 1 }]
  },
  armor: {
    2: [{ itemId: 'herb', amount: 2 }],
    3: [{ itemId: 'essence', amount: 2 }]
  },
  helmet: {
    2: [{ itemId: 'herb', amount: 2 }],
    3: [{ itemId: 'relic', amount: 1 }]
  }
};

// ราคาเพื่ออัปจากเลเวลปัจจุบันไปอีก 1 ขั้น (คืน null ถ้าไม่มีราคา = ถึงสูงสุดแล้ว)
export function getUpgradeCost(slot: EquipmentSlot, currentLevel: number): UpgradeCost[] | null {
  return UPGRADE_COSTS[slot][currentLevel + 1] ?? null;
}