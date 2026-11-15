// src/systems/Upgrades.ts
import { huntSession } from './HuntSession';
import type { Rarity } from '../data/rarity';

// เก็บ Level ของ Charm และ Pet (Key = charmId หรือ petId)
class UpgradeStore {
  public charmLevels: Record<string, number> = {};
  public petLevels: Record<string, number> = {};

  getCharmLevel(id: string): number { return this.charmLevels[id] ?? 1; }
  getPetLevel(id: string): number { return this.petLevels[id] ?? 1; }

  setCharmLevel(id: string, lv: number) { this.charmLevels[id] = lv; }
  setPetLevel(id: string, lv: number) { this.petLevels[id] = lv; }

  export() { return { charmLevels: this.charmLevels, petLevels: this.petLevels }; }
  import(data: any) {
    if (data?.charmLevels) this.charmLevels = data.charmLevels;
    if (data?.petLevels) this.petLevels = data.petLevels;
  }
  reset() { this.charmLevels = {}; this.petLevels = {}; }
}
export const upgrades = new UpgradeStore();

// ---------------- ฟังก์ชันอัปเกรด ----------------

// ตารางราคาอัปเกรด (ดึง itemId จากประเภทที่ต้องการอัป)
export const UPGRADE_COSTS = [
  { lv: 1, reqRarity: 'common',    amount: 5 },
  { lv: 2, reqRarity: 'common',    amount: 10 },
  { lv: 3, reqRarity: 'common',    amount: 15 },
  { lv: 4, reqRarity: 'rare',      amount: 3 },
  { lv: 5, reqRarity: 'rare',      amount: 6 },
  { lv: 6, reqRarity: 'rare',      amount: 9 },
  { lv: 7, reqRarity: 'epic',      amount: 2 },
  { lv: 8, reqRarity: 'epic',      amount: 4 },
  { lv: 9, reqRarity: 'epic',      amount: 5 }, // สมมติว่าขั้นสุดท้ายใช้ epic 5
  { lv: 10, reqRarity: 'legendary', amount: 1, reqRarity2: 'epic', amount2: 3 }
] as const;

export type UpgradeType = 'charm' | 'pet';

// เช็คว่ามีของพอไหม
export function canUpgrade(type: UpgradeType, currentLv: number): boolean {
  if (currentLv >= 10) return false;
  const cost = UPGRADE_COSTS[currentLv - 1];
  const itemId = type === 'charm' ? 'ore' : 'wood';
  
  if (cost.reqRarity === 'legendary' && 'amount2' in cost) {
    // กรณีขั้นสุดท้าย (Lv 9->10)
    return huntSession.getCountByRarity(itemId, cost.reqRarity as Rarity) >= cost.amount &&
           huntSession.getCountByRarity(itemId, cost.reqRarity2 as Rarity) >= cost.amount2;
  }
  return huntSession.getCountByRarity(itemId, cost.reqRarity as Rarity) >= cost.amount;
}

// หักของและเพิ่ม level
export function performUpgrade(type: UpgradeType, id: string): boolean {
  const currentLv = type === 'charm' ? upgrades.getCharmLevel(id) : upgrades.getPetLevel(id);
  if (currentLv >= 10 || !canUpgrade(type, currentLv)) return false;

  const cost = UPGRADE_COSTS[currentLv - 1];
  const itemId = type === 'charm' ? 'ore' : 'wood';

  // หักของ
  huntSession.spend(itemId, cost.reqRarity as Rarity, cost.amount);
  if (cost.reqRarity === 'legendary' && 'amount2' in cost) {
    huntSession.spend(itemId, cost.reqRarity2 as Rarity, cost.amount2);
  }

  // เพิ่ม level
  if (type === 'charm') upgrades.setCharmLevel(id, currentLv + 1);
  else upgrades.setPetLevel(id, currentLv + 1);
  
  return true;
}

// ---------------- ฟังก์ชันหลอม (Burn) ----------------

export function getMeltInput(itemId: string, fromRarity: Rarity): number {
  return huntSession.getCountByRarity(itemId, fromRarity);
}

// หลอม 10 ชิ้น -> 1 ชิ้น (ระดับถัดไป)
export function meltItems(itemId: string, fromRarity: Rarity, toRarity: Rarity): boolean {
  const need = 10;
  if (!huntSession.spend(itemId, fromRarity, need)) return false;
  
  // เพิ่มของระดับใหม่ 1 ชิ้น
  huntSession.addItem({
    id: itemId,
    name: itemId === 'ore' ? 'แร่' : itemId === 'wood' ? 'ไม้' : itemId === 'bone' ? 'กระดูก' : 'ธาตุสกัด',
    icon: `item_${itemId}`,
    rarity: toRarity
  });
  
  return true;
}