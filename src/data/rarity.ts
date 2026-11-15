// ระบบ Rarity — ใช้ร่วมทุก pillar (loot/charm/pet)
// 4 ระดับ: common → rare → epic → legendary
// points = คะแนนมูลค่าของไอเทมแต่ละชิ้น (ใช้ใน upgrade ภายหลัง)
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

// ลบ field points ออกให้หมด
export interface RarityDef {
  id: Rarity;
  name: string;
  color: string;
  colorNum: number;
  glow: boolean;
  order: number;
}

export const RARITY: Record<Rarity, RarityDef> = {
  common:    { id: 'common',    name: 'ทั่วไป',   color: '#b8b8b8', colorNum: 0xb8b8b8, glow: false, order: 0 },
  rare:      { id: 'rare',      name: 'หายาก',    color: '#7db8ff', colorNum: 0x7db8ff, glow: false, order: 1 },
  epic:      { id: 'epic',      name: 'มหากาพย์', color: '#c084fc', colorNum: 0xc084fc, glow: true,  order: 2 },
  legendary: { id: 'legendary', name: 'ตำนาน',    color: '#ffd54a', colorNum: 0xffd54a, glow: true,  order: 3 }
};

export const RARITY_IDS: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

// ใช้ตอนโหลดเซฟเก่า (v2) ที่ rarity เป็น string ไทย หรือไม่มีเลย
export function migrateRarity(old: any): Rarity {
  if (old === 'common' || old === 'rare' || old === 'epic' || old === 'legendary') return old;
  const map: Record<string, Rarity> = {
    'ทั่วไป': 'common',
    'หายาก': 'rare',
    'มหากาพย์': 'epic',
    'ตำนาน': 'legendary'
  };
  return map[old] ?? 'common';
}