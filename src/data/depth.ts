// src/data/depth.ts
// ระดับความลึกของแอเรีย — ยิ่งลึก บอสยิ่งอึด ตีแรง ไฟสะสมไว ของดรอปดีขึ้น
// เขตตื้นจูนสำหรับผู้เล่นล่าคนเดียว: สู้สั้น โดนเบา ติดไฟช้า
// ตัวเลขทั้งหมดอยู่ที่นี่ที่เดียว ห้ามฝังใน Scene
export interface DepthTier {
  minArea: number;
  bossMin: number;
  bossMax: number;
  /** ตัวคูณน้ำหนักของหายากตอนสุ่มดรอป (1 = เรทพื้นฐาน) */
  rareBonus: number;
  /** ตัวคูณเลือดบอส (1 = เลือดฐานใน bosses.ts) */
  hpMult: number;
  /** ตัวคูณดาเมจที่บอสตีผู้เล่น (ปัดเศษnearest ขั้นต่ำ 1) */
  dmgMult: number;
  /** ตัวคูณความเร็วสะสมไฟไหม้ (ต่ำกว่า 1 = ติดไฟช้าลง — ใช้เฉพาะ The World) */
  burnMult: number;
  /** จำนวนชิ้นที่บอสดรอปต่อตัว */
  dropCount: number;
  label: string;
}

export const DEPTH_TIERS: DepthTier[] = [
  // เขตตื้น: ภัสมะ 120 / มายา 105 · ทุกท่าตี 1 · ไฟสะสมครึ่ง速 → Solo เอาชนะได้จริง
  { minArea: 1, bossMin: 0, bossMax: 1, rareBonus: 1.0, hpMult: 1.5, dmgMult: 0.6, burnMult: 0.5, dropCount: 4, label: 'เขตตื้น' },
  { minArea: 3, bossMin: 0, bossMax: 2, rareBonus: 1.5, hpMult: 2.5, dmgMult: 1.0, burnMult: 0.8, dropCount: 5, label: 'เขตกลาง' },
  { minArea: 6, bossMin: 1, bossMax: 2, rareBonus: 2.5, hpMult: 4.0, dmgMult: 1.6, burnMult: 1.0, dropCount: 6, label: 'เขตลึก' }
];

// หลังเขตลึก: ทุก 3 แอเรีย เลือด/ดาเมจ/เรท ไต่ต่อ แต่มีเพดานกันหลุดสมดุล
export const ENDLESS = {
  areasPerStep: 3,
  hpPerStep: 0.75,
  hpCap: 9,
  dmgPerStep: 0.25,
  dmgCap: 3,
  rarePerStep: 0.5,
  rareCap: 5,
  dropEverySteps: 2,
  dropCap: 8
};

export function getDepthTier(areaIndex: number): DepthTier {
  let tier = DEPTH_TIERS[0];
  for (const t of DEPTH_TIERS) {
    if (areaIndex >= t.minArea) tier = t;
  }
  return tier;
}

/** ค่าที่ใช้จริงของแอเรียนี้ — รวมการไต่หลังเขตลึกแล้ว (ฉาก/ดรอปเรียกอันนี้เท่านั้น) */
export function getAreaScaling(areaIndex: number): DepthTier {
  const base = getDepthTier(areaIndex);
  const last = DEPTH_TIERS[DEPTH_TIERS.length - 1];
  const steps = Math.max(0, Math.floor((areaIndex - last.minArea) / ENDLESS.areasPerStep));
  return {
    ...base,
    hpMult: Math.min(ENDLESS.hpCap, base.hpMult + steps * ENDLESS.hpPerStep),
    dmgMult: Math.min(ENDLESS.dmgCap, base.dmgMult + steps * ENDLESS.dmgPerStep),
    rareBonus: Math.min(ENDLESS.rareCap, base.rareBonus + steps * ENDLESS.rarePerStep),
    dropCount: Math.min(ENDLESS.dropCap, base.dropCount + Math.floor(steps / ENDLESS.dropEverySteps))
  };
}

export function rollBossCount(areaIndex: number, random = Math.random): number {
  const tier = getDepthTier(areaIndex);
  const span = tier.bossMax - tier.bossMin + 1;
  return tier.bossMin + Math.floor(random() * span);
}