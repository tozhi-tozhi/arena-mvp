// ตารางไอเทมและดรอป — ไอเทม 4 ตัว แต่ละตัวมีที่ไปชัดเจน
// ภัสมะ → ore + essence  |  มายา → wood + bone
// เรทของดีถ่วงด้วย rareBonus ของเขต (data/depth.ts) — ยิ่งลึก ของดียิ่งออกบ่อย
import type { Rarity } from './rarity';
import type { BossId } from './bosses';

export interface LootDef {
  id: string;
  name: string;
  icon: string;
}

export interface DroppedLoot extends LootDef {
  rarity: Rarity;
}

export const LOOT_TABLE: LootDef[] = [
  { id: 'ore',     name: 'แร่',      icon: 'item_ore' },
  { id: 'wood',    name: 'ไม้',      icon: 'item_wood' },
  { id: 'bone',    name: 'กระดูก',   icon: 'item_bone' },
  { id: 'essence', name: 'ธาตุสกัด', icon: 'item_essence' }
];

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

// น้ำหนัก rarity พื้นฐาน (เขตตื้น rareBonus = 1 ได้เรทเดิมเป๊ะ)
const RARITY_WEIGHTS: { rarity: Rarity; weight: number }[] = [
  { rarity: 'common',    weight: 55 },
  { rarity: 'rare',      weight: 30 },
  { rarity: 'epic',      weight: 12 },
  { rarity: 'legendary', weight: 3 }
];

// คูณเฉพาะของดี — common คงเดิม ทำให้สัดส่วนของดีโตขึ้นตามเขต
function rollRarity(rareMult: number = 1, random: () => number = Math.random): Rarity {
  const weighted = RARITY_WEIGHTS.map((r) => ({
    rarity: r.rarity,
    weight: r.rarity === 'common' ? r.weight : r.weight * rareMult
  }));
  const total = weighted.reduce((s, x) => s + x.weight, 0);
  let roll = random() * total;
  for (const r of weighted) {
    roll -= r.weight;
    if (roll < 0) return r.rarity;
  }
  return 'common';
}

export function rollGroundLoot(random: () => number = Math.random, rareMult: number = 1): DroppedLoot {
  const index = Math.floor(random() * LOOT_TABLE.length);
  const base = LOOT_TABLE[index] ?? LOOT_TABLE[0];
  return { ...base, rarity: rollRarity(rareMult, random) };
}

function rollSingleDrop(bossId: BossId, rareMult: number, random: () => number): DroppedLoot {
  const table = BOSS_DROPS[bossId];
  const totalWeight = table.reduce((s, x) => s + x.weight, 0);
  let roll = random() * totalWeight;
  let itemId = table[0].itemId;
  for (const opt of table) {
    roll -= opt.weight;
    if (roll < 0) { itemId = opt.itemId; break; }
  }
  const base = LOOT_TABLE.find((l) => l.id === itemId)!;
  return { ...base, rarity: rollRarity(rareMult, random) };
}

export function rollBossDrops(
  bossId: BossId,
  count: number = 4,
  random: () => number = Math.random,
  rareMult: number = 1
): DroppedLoot[] {
  const results: DroppedLoot[] = [];
  for (let i = 0; i < count; i++) {
    results.push(rollSingleDrop(bossId, rareMult, random));
  }
  return results;
}