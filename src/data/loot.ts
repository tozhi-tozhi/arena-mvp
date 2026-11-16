// ตารางไอเทมและดรอป — ไอเทม 4 ตัว แต่ละตัวมีที่ไปชัดเจน
// ภัสมะ → ore + essence  |  มายา → wood + bone
// ทุกไอเทมดรอปได้ทั้ง 4 rarity — rarity กำหนดมูลค่าของชิ้นนั้น
import type { Rarity } from './rarity';
import type { BossId } from './bosses';

// ไอเทมฐาน — ไม่มี rarity (rarity มาจากการดรอป)
export interface LootDef {
  id: string;
  name: string;
  icon: string;
}

// ไอเทมที่ดรอปจริง — LootDef + rarity
export interface DroppedLoot extends LootDef {
  rarity: Rarity;
}

// ไอเทมทั้ง 4 ตัว
export const LOOT_TABLE: LootDef[] = [
  { id: 'ore',     name: 'แร่',      icon: 'item_ore' },
  { id: 'wood',    name: 'ไม้',      icon: 'item_wood' },
  { id: 'bone',    name: 'กระดูก',   icon: 'item_bone' },
  { id: 'essence', name: 'ธาตุสกัด', icon: 'item_essence' }
];

// Drop table ต่อบอส (น้ำหนักสัมพัทธ์)
export const BOSS_DROPS: Record<BossId, { itemId: string; weight: number }[]> = {
  phasama: [
    { itemId: 'ore',     weight: 60 },
    { itemId: 'essence', weight: 40 }
  ],
  maya: [
    { itemId: 'wood', weight: 50 },
    { itemId: 'bone', weight: 50 }
  ]
};

// น้ำหนัก rarity — รวม = 100
const RARITY_WEIGHTS: { rarity: Rarity; weight: number }[] = [
  { rarity: 'common',    weight: 55 },
  { rarity: 'rare',      weight: 30 },
  { rarity: 'epic',      weight: 12 },
  { rarity: 'legendary', weight: 3 }
];

function rollRarity(random: () => number = Math.random): Rarity {
  const total = RARITY_WEIGHTS.reduce((s, x) => s + x.weight, 0);
  let roll = random() * total;
  for (const r of RARITY_WEIGHTS) {
    roll -= r.weight;
    if (roll < 0) return r.rarity;
  }
  return 'common';
}

// สุ่มของตกพื้นใน The World: สุ่มไอเทมจากทั้ง 4 ชนิด แล้วสุ่ม rarity
// แต่ละชนิดมีโอกาสเท่ากัน ส่วน rarity ใช้น้ำหนักเดียวกับของที่ดรอปจากบอส
export function rollGroundLoot(random: () => number = Math.random): DroppedLoot {
  const index = Math.floor(random() * LOOT_TABLE.length);
  const base = LOOT_TABLE[index] ?? LOOT_TABLE[0];
  return { ...base, rarity: rollRarity(random) };
}

// ดรอปชิ้นเดียวจากบอส (เลือก item → เลือก rarity)
function rollSingleDrop(bossId: BossId, random: () => number = Math.random): DroppedLoot {
  const table = BOSS_DROPS[bossId];
  const totalWeight = table.reduce((s, x) => s + x.weight, 0);
  let roll = random() * totalWeight;
  let itemId = table[0].itemId;
  for (const opt of table) {
    roll -= opt.weight;
    if (roll < 0) { itemId = opt.itemId; break; }
  }
  const base = LOOT_TABLE.find((l) => l.id === itemId)!;
  return { ...base, rarity: rollRarity(random) };
}

// ดรอปจากบอส (default 4 ชิ้นต่อการสังหาร)
export function rollBossDrops(
  bossId: BossId,
  count: number = 4,
  random: () => number = Math.random
): DroppedLoot[] {
  const results: DroppedLoot[] = [];
  for (let i = 0; i < count; i++) {
    results.push(rollSingleDrop(bossId, random));
  }
  return results;
}
