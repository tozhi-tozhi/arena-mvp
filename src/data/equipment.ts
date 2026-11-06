/**
 * Equipment definitions for Round 3.
 * Keep item data separate from gameplay logic.
 */

export type EquipmentSlot = 'weapon' | 'armor' | 'helmet';

export interface EquipmentEffect {
  /** Base value at level 1. */
  baseValue: number;
  /** Flat increase for each level above level 1. */
  upgradePerLevel: number;
}

export interface EquipmentDef {
  id: string;
  slot: EquipmentSlot;
  name: string;
  description: string;
  maxLevel: number;
  effect: EquipmentEffect;
}

export const EQUIPMENT: Record<EquipmentSlot, EquipmentDef> = {
  weapon: {
    id: 'starter_spear',
    slot: 'weapon',
    name: 'หอกเริ่มต้น',
    description: 'โจมตีพุ่งตรงในระยะที่ไกลกว่าอาวุธพื้นฐาน',
    maxLevel: 3,
    effect: {
      baseValue: 76, // ระยะโจมตี (หน่วยพิกเซล) สำหรับระบบ Weapon
      upgradePerLevel: 10
    }
  },
  armor: {
    id: 'thorn_armor',
    slot: 'armor',
    name: 'เกราะหนาม',
    description: 'สะท้อนความเสียหายกลับไปยังมอนสเตอร์เมื่อผู้เล่นถูกโจมตี',
    maxLevel: 3,
    effect: {
      baseValue: 1, // ความเสียหายสะท้อนต่อการถูกโจมตีหนึ่งครั้ง
      upgradePerLevel: 1
    }
  },
  helmet: {
    id: 'hunter_helmet',
    slot: 'helmet',
    name: 'หมวกนักล่า',
    description: 'ฟื้นฟู HP เมื่อกำจัดมอนสเตอร์',
    maxLevel: 3,
    effect: {
      baseValue: 1, // HP ที่ฟื้นฟูเมื่อกำจัดมอนสเตอร์
      upgradePerLevel: 1
    }
  }
};

export const EQUIPMENT_SLOTS: EquipmentSlot[] = [
  'weapon',
  'armor',
  'helmet'
];
