// src/data/depth.ts
// ระดับความลึกของแอเรีย — ยิ่งลึก ยิ่งได้ของดี + บอสเยอะขึ้น
// ตัวเลขทั้งหมดอยู่ที่นี่ที่เดียว ห้ามฝังใน Scene

export interface DepthTier {
  minArea: number;
  bossMin: number;
  bossMax: number;
  rareBonus: number;
  label: string;
}

export const DEPTH_TIERS: DepthTier[] = [
  { minArea: 1, bossMin: 0, bossMax: 1, rareBonus: 1.0, label: 'เขตตื้น' },
  { minArea: 3, bossMin: 0, bossMax: 2, rareBonus: 1.5, label: 'เขตกลาง' },
  { minArea: 6, bossMin: 1, bossMax: 2, rareBonus: 2.5, label: 'เขตลึก' },
];

export function getDepthTier(areaIndex: number): DepthTier {
  let tier = DEPTH_TIERS[0];
  for (const t of DEPTH_TIERS) {
    if (areaIndex >= t.minArea) tier = t;
  }
  return tier;
}

export function rollBossCount(areaIndex: number, random = Math.random): number {
  const tier = getDepthTier(areaIndex);
  const span = tier.bossMax - tier.bossMin + 1;
  return tier.bossMin + Math.floor(random() * span);
}