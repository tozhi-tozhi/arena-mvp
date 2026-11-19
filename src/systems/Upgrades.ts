// ระบบอัปเกรดเครื่องราง/สัตว์เลี้ยง + ดาวตัวละคร — ตัวเลขสมดุลอยู่ที่นี่ที่เดียว
// UI เรียกใช้เฉพาะผลลัพธ์สำเร็จรูป ไม่คำนวณเอง
import { huntSession } from './HuntSession';
import { LOOT_TABLE } from '../data/loot';
import type { Rarity } from '../data/rarity';

export type UpgradeType = 'charm' | 'pet';
export const MAX_LEVEL = 10;
export const MELT_NEED = 10;
export const MAX_STARS = 3;

// ---------- เก็บเลเวล + ดาว ----------
class UpgradeStore {
  public charmLevels: Record<string, number> = {};
  public petLevels: Record<string, number> = {};
  public charStars: Record<string, number> = {};
  public pouchLevel: number = 0; // ถุงพกพา 0..POUCH_MAX_LEVEL (0 = 12 ช่องเริ่มต้น)

  getCharmLevel(id: string): number { return clampLevel(this.charmLevels[id] ?? 1); }
  getPetLevel(id: string): number { return clampLevel(this.petLevels[id] ?? 1); }
  setCharmLevel(id: string, lv: number) { this.charmLevels[id] = clampLevel(lv); }
  setPetLevel(id: string, lv: number) { this.petLevels[id] = clampLevel(lv); }

  getStars(id: string): number { return clampStars(this.charStars[id] ?? 0); }
  setStars(id: string, n: number) { this.charStars[id] = clampStars(n); }

  export() {
    return {
      charmLevels: this.charmLevels,
      petLevels: this.petLevels,
      charStars: this.charStars,
      pouchLevel: this.pouchLevel
    };
  }

  import(data: any) {
    this.charmLevels = sanitize(data?.charmLevels, clampLevel);
    this.petLevels = sanitize(data?.petLevels, clampLevel);
    this.charStars = sanitize(data?.charStars, clampStars);
    this.pouchLevel = clampPouch(data?.pouchLevel);
  }

  reset() { this.charmLevels = {}; this.petLevels = {}; this.charStars = {}; this.pouchLevel = 0; }
}

function clampLevel(lv: any): number {
  const n = Number(lv);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(MAX_LEVEL, Math.floor(n)));
}

function clampPouch(v: any): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(POUCH_MAX_LEVEL, Math.floor(n)));
}

function clampStars(v: any): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(MAX_STARS, Math.floor(n)));
}

// เซฟเก่าอาจพังมา — กรองให้เหลือแต่ตัวเลขที่ใช้ได้
function sanitize(raw: any, clamp: (v: any) => number): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const key of Object.keys(raw)) out[key] = clamp(raw[key]);
  return out;
}

export const upgrades = new UpgradeStore();

// ---------- ตารางราคาเลเวล (บังคับระดับ rarity) ----------
export interface UpgradeCost {
  reqRarity: Rarity;
  amount: number;
  reqRarity2?: Rarity;
  amount2?: number;
}

export const UPGRADE_COSTS: UpgradeCost[] = [
  { reqRarity: 'common',    amount: 5 },   // Lv.1 → 2
  { reqRarity: 'common',    amount: 10 },  // Lv.2 → 3
  { reqRarity: 'common',    amount: 15 },  // Lv.3 → 4
  { reqRarity: 'rare',      amount: 3 },   // Lv.4 → 5
  { reqRarity: 'rare',      amount: 6 },   // Lv.5 → 6
  { reqRarity: 'rare',      amount: 9 },   // Lv.6 → 7
  { reqRarity: 'epic',      amount: 2 },   // Lv.7 → 8
  { reqRarity: 'epic',      amount: 4 },   // Lv.8 → 9
  { reqRarity: 'legendary', amount: 1, reqRarity2: 'epic', amount2: 3 } // Lv.9 → 10
];

export function materialOf(type: UpgradeType): string {
  return type === 'charm' ? 'ore' : 'wood';
}

export function levelOf(type: UpgradeType, id: string): number {
  return type === 'charm' ? upgrades.getCharmLevel(id) : upgrades.getPetLevel(id);
}

export function costForNext(currentLv: number): UpgradeCost | null {
  if (currentLv >= MAX_LEVEL) return null;
  return UPGRADE_COSTS[currentLv - 1] ?? null;
}

export function canUpgrade(type: UpgradeType, currentLv: number): boolean {
  const cost = costForNext(currentLv);
  if (!cost) return false;
  const itemId = materialOf(type);
  if (huntSession.getCountByRarity(itemId, cost.reqRarity) < cost.amount) return false;
  if (cost.reqRarity2 && huntSession.getCountByRarity(itemId, cost.reqRarity2) < (cost.amount2 ?? 0)) return false;
  return true;
}

export function performUpgrade(type: UpgradeType, id: string): boolean {
  const currentLv = levelOf(type, id);
  const cost = costForNext(currentLv);
  if (!cost || !canUpgrade(type, currentLv)) return false;

  const itemId = materialOf(type);
  huntSession.spend(itemId, cost.reqRarity, cost.amount);
  if (cost.reqRarity2) huntSession.spend(itemId, cost.reqRarity2, cost.amount2 ?? 0);

  if (type === 'charm') upgrades.setCharmLevel(id, currentLv + 1);
  else upgrades.setPetLevel(id, currentLv + 1);

  void import('./SaveGame').then((m) => m.saveGame()).catch(() => {});
  return true;
}

// =====================================================
//  ผลของเลเวล — ที่เดียวที่ UI และเกมต่อสู้ใช้ร่วมกัน
// =====================================================
export interface CharmEffect {
  healChance: number;
  healAmount: number;
  healMaxPerHunt: number;
  streakHitsNeeded: number;
  streakMultiplier: number;
}

export interface PetEffect {
  swiftIntervalMs: number;
  swiftDurationMs: number;
  swiftBonusPct: number;
  mortarIntervalMs: number;
  mortarDamage: number;
}

export function charmEffectAt(id: string, lv: number): CharmEffect {
  const L = clampLevel(lv) - 1;
  return {
    healChance: Math.min(0.75, 0.30 + L * 0.05),
    healAmount: 100 + Math.floor(L / 5) * 100,
    healMaxPerHunt: 2 + Math.floor(L / 3),
    streakHitsNeeded: Math.max(2, 5 - Math.floor(L / 3)),
    streakMultiplier: 2 + Math.floor(L / 4)
  };
}

export function petEffectAt(id: string, lv: number): PetEffect {
  const L = clampLevel(lv) - 1;
  return {
    swiftIntervalMs: Math.max(6000, 15000 - L * 1000),
    swiftDurationMs: 3000 + L * 250,
    swiftBonusPct: 40 + L * 3,
    mortarIntervalMs: Math.max(3500, 8000 - L * 500),
    mortarDamage: 200 + Math.floor(L / 3) * 100
  };
}

export function charmEffectNow(id: string): CharmEffect { return charmEffectAt(id, upgrades.getCharmLevel(id)); }
export function petEffectNow(id: string): PetEffect { return petEffectAt(id, upgrades.getPetLevel(id)); }

// ---------- ข้อความผลลัพธ์สำเร็จรูปสำหรับ UI (ไม่โชว์สูตร) ----------
export interface EffectLine {
  label: string;
  now: string;
  next: string | null;
  improved: boolean;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const sec = (ms: number) => `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)} วิ`;

export function charmEffectLines(id: string, lv: number): EffectLine[] {
  const a = charmEffectAt(id, lv);
  const maxed = lv >= MAX_LEVEL;
  const b = maxed ? a : charmEffectAt(id, lv + 1);
  const line = (label: string, now: string, next: string): EffectLine =>
    ({ label, now, next: maxed ? null : next, improved: !maxed && now !== next });

  if (id === 'heal') {
    return [
      line('โอกาสฟื้นเลือดตอนตีโดน', pct(a.healChance), pct(b.healChance)),
      line('ฟื้นครั้งละ', `${a.healAmount} หน่วย`, `${b.healAmount} หน่วย`),
      line('ฟื้นได้ต่อการล่า', `${a.healMaxPerHunt} ครั้ง`, `${b.healMaxPerHunt} ครั้ง`)
    ];
  }
  return [
    line('ตีติดครบแล้วดาเมจพุ่ง', `x${a.streakMultiplier}`, `x${b.streakMultiplier}`),
    line('ต้องตีติดต่อกัน', `${a.streakHitsNeeded} ครั้ง`, `${b.streakHitsNeeded} ครั้ง`)
  ];
}

export function petEffectLines(id: string, lv: number): EffectLine[] {
  const a = petEffectAt(id, lv);
  const maxed = lv >= MAX_LEVEL;
  const b = maxed ? a : petEffectAt(id, lv + 1);
  const line = (label: string, now: string, next: string): EffectLine =>
    ({ label, now, next: maxed ? null : next, improved: !maxed && now !== next });

  if (id === 'swift') {
    return [
      line('ความเร็วตอนบัฟทำงาน', `+${a.swiftBonusPct}%`, `+${b.swiftBonusPct}%`),
      line('บัฟออกทุก', sec(a.swiftIntervalMs), sec(b.swiftIntervalMs)),
      line('บัฟนาน', sec(a.swiftDurationMs), sec(b.swiftDurationMs))
    ];
  }
  return [
    line('ครกยิงทุก', sec(a.mortarIntervalMs), sec(b.mortarIntervalMs)),
    line('ดาเมจต่อลูก', `${a.mortarDamage}`, `${b.mortarDamage}`)
  ];
}

// =====================================================
//  ดาวตัวละคร (0-3) — ปลดล็อก "กลไก" ไม่แตะ Stat พื้นฐาน
//  ใช้กระดูกจากมายาเท่านั้น
// =====================================================
export interface StarCost { rarity: Rarity; amount: number; }

export const STAR_MATERIAL = 'bone';

export const STAR_COSTS: StarCost[] = [
  { rarity: 'rare',      amount: 5 },  // ★0 → ★1
  { rarity: 'epic',      amount: 3 },  // ★1 → ★2
  { rarity: 'legendary', amount: 1 }   // ★2 → ★3
];

export function starsOf(id: string): number { return upgrades.getStars(id); }

export function starCostForNext(stars: number): StarCost | null {
  if (stars >= MAX_STARS) return null;
  return STAR_COSTS[stars] ?? null;
}

export function canAddStar(id: string): boolean {
  const cost = starCostForNext(starsOf(id));
  if (!cost) return false;
  return huntSession.getCountByRarity(STAR_MATERIAL, cost.rarity) >= cost.amount;
}

export function performStarUp(id: string): boolean {
  const cur = starsOf(id);
  const cost = starCostForNext(cur);
  if (!cost || !canAddStar(id)) return false;
  huntSession.spend(STAR_MATERIAL, cost.rarity, cost.amount);
  upgrades.setStars(id, cur + 1);
  void import('./SaveGame').then((m) => m.saveGame()).catch(() => {});
  return true;
}

// ---------- ผลของดาว: อ่านได้ทุกที่ ทั้ง UI และ GameScene ----------
export interface CharStarEffect {
  // อัคนี
  thrustSpeedMult: number;   // ★1 พุ่งดาบไกลขึ้น
  shieldBlocksBurn: boolean; // ★2 โล่กันไฟไหม้ได้ด้วย
  skillHeal: number;         // ★3 สกิลฟื้นเลือด 2 แทน 1
  // ลูมิ
  chargedCountBonus: number; // ★1 กระสุนพัด +2 นัด
  dashDistMult: number;      // ★2 แดชไกลขึ้น
  passiveHitsNeeded: number; // ★3 รีเซ็ตแดชไวขึ้น
}

export function charStarEffectAt(id: string, stars: number): CharStarEffect {
  const s = clampStars(stars);
  return {
    thrustSpeedMult: s >= 1 ? 1.35 : 1,
    shieldBlocksBurn: s >= 2,
    skillHeal: s >= 3 ? 200 : 100,
    chargedCountBonus: s >= 1 ? 2 : 0,
    dashDistMult: s >= 2 ? 1.4 : 1,
    passiveHitsNeeded: s >= 3 ? 6 : 8
  };
}

export function charStarEffectNow(id: string): CharStarEffect {
  return charStarEffectAt(id, starsOf(id));
}

// ชื่อดาวแต่ละดวง (ใช้ทั้ง UI และข้อความปลดล็อกในเกม)
export function starName(id: string, starIndex: number): string {
  const akk = ['พุ่งทะลวง', 'โล่กันไฟ', 'ฟันดูดชีวิต'];
  const lum = ['พัดกว้าง', 'แดชยาว', 'แดชไวขึ้น'];
  const list = id === 'akkhani' ? akk : lum;
  return list[starIndex] ?? '';
}

export function starEffectLines(id: string, stars: number): EffectLine[] {
  const a = charStarEffectAt(id, stars);
  const maxed = stars >= MAX_STARS;
  const b = maxed ? a : charStarEffectAt(id, stars + 1);
  const line = (label: string, now: string, next: string): EffectLine =>
    ({ label, now, next: maxed ? null : next, improved: !maxed && now !== next });

  if (id === 'akkhani') {
    return [
      line('ระยะพุ่งดาบ', a.thrustSpeedMult > 1 ? 'ไกลขึ้น' : 'ปกติ', b.thrustSpeedMult > 1 ? 'ไกลขึ้น' : 'ปกติ'),
      line('โล่กันไฟไหม้', a.shieldBlocksBurn ? 'กันได้' : 'กันไม่ได้', b.shieldBlocksBurn ? 'กันได้' : 'กันไม่ได้'),
      line('สกิลฟื้นเลือด', `${a.skillHeal} หน่วย`, `${b.skillHeal} หน่วย`)
    ];
  }
  return [
    line('กระสุนพัดเพิ่ม', `${a.chargedCountBonus} นัด`, `${b.chargedCountBonus} นัด`),
    line('ระยะแดช', a.dashDistMult > 1 ? 'ไกลขึ้น' : 'ปกติ', b.dashDistMult > 1 ? 'ไกลขึ้น' : 'ปกติ'),
    line('ตีครบกี่ครั้งรีเซ็ตแดช', `${a.passiveHitsNeeded} ครั้ง`, `${b.passiveHitsNeeded} ครั้ง`)
  ];
}

// ---------- หลอมของ 10 → 1 ----------
const NEXT_RARITY: Partial<Record<Rarity, Rarity>> = {
  common: 'rare',
  rare: 'epic',
  epic: 'legendary'
};

export function nextRarity(from: Rarity): Rarity | null {
  return NEXT_RARITY[from] ?? null;
}

export function meltItems(itemId: string, fromRarity: Rarity): boolean {
  const to = nextRarity(fromRarity);
  if (!to) return false;
  if (!huntSession.spend(itemId, fromRarity, MELT_NEED)) return false;

  const def = LOOT_TABLE.find((l) => l.id === itemId);
  huntSession.addItem({
    id: itemId,
    name: def?.name ?? itemId,
    icon: def?.icon ?? `item_${itemId}`,
    rarity: to
  });

  void import('./SaveGame').then((m) => m.saveGame()).catch(() => {});
  return true;
}


// =====================================================
// ถุงพกพา (Pouch) — Phase 3C
// ความจุเริ่มต้น 12 ช่อง · +4 ช่องต่อขั้น · 12 ขั้น · สูงสุด 60 ช่อง · ใช้แร่ (ore) ไล่ระดับ rarity
// =====================================================
export const POUCH_BASE_SLOTS = 12;
export const POUCH_SLOTS_PER_LEVEL = 4;
export const POUCH_MAX_LEVEL = 12;
export const POUCH_MATERIAL = 'ore';

// ราคาขั้น 0→1, 1→2, ... 11→12 (ยังไม่ผ่านการเล่นจริง — ปรับได้ที่นี่ที่เดียว)
export const POUCH_COSTS: UpgradeCost[] = [
  { reqRarity: 'common',    amount: 6 },   // 12 → 16 ช่อง
  { reqRarity: 'common',    amount: 10 },
  { reqRarity: 'common',    amount: 14 },
  { reqRarity: 'common',    amount: 18 },
  { reqRarity: 'rare',      amount: 3 },
  { reqRarity: 'rare',      amount: 5 },
  { reqRarity: 'rare',      amount: 7 },
  { reqRarity: 'rare',      amount: 9 },
  { reqRarity: 'epic',      amount: 2 },
  { reqRarity: 'epic',      amount: 3 },
  { reqRarity: 'epic',      amount: 4 },
  { reqRarity: 'legendary', amount: 1, reqRarity2: 'epic', amount2: 3 } // 56 → 60 ช่อง
];

export function pouchLevelNow(): number { return upgrades.pouchLevel; }

export function pouchCapacityAt(level: number): number {
  const lv = Math.max(0, Math.min(POUCH_MAX_LEVEL, Math.floor(level)));
  return POUCH_BASE_SLOTS + lv * POUCH_SLOTS_PER_LEVEL;
}

export function pouchCapacityNow(): number { return pouchCapacityAt(upgrades.pouchLevel); }

export function pouchCostForNext(level: number): UpgradeCost | null {
  if (level >= POUCH_MAX_LEVEL) return null;
  return POUCH_COSTS[level] ?? null;
}

export function canUpgradePouch(): boolean {
  const cost = pouchCostForNext(upgrades.pouchLevel);
  if (!cost) return false;
  if (huntSession.getCountByRarity(POUCH_MATERIAL, cost.reqRarity) < cost.amount) return false;
  if (cost.reqRarity2 && huntSession.getCountByRarity(POUCH_MATERIAL, cost.reqRarity2) < (cost.amount2 ?? 0)) return false;
  return true;
}

export function performUpgradePouch(): boolean {
  const cost = pouchCostForNext(upgrades.pouchLevel);
  if (!cost || !canUpgradePouch()) return false;
  huntSession.spend(POUCH_MATERIAL, cost.reqRarity, cost.amount);
  if (cost.reqRarity2) huntSession.spend(POUCH_MATERIAL, cost.reqRarity2, cost.amount2 ?? 0);
  upgrades.pouchLevel = clampPouch(upgrades.pouchLevel + 1);
  void import('./SaveGame').then((m) => m.saveGame()).catch(() => {});
  return true;
}

/** แถว "ตอนนี้ → หลังอัป" สำหรับหน้าโรงตีเหล็ก */
export function pouchEffectLine(level: number): EffectLine {
  const maxed = level >= POUCH_MAX_LEVEL;
  return {
    label: 'ช่องถุงพกพา',
    now: `${pouchCapacityAt(level)} ช่อง`,
    next: maxed ? null : `${pouchCapacityAt(level + 1)} ช่อง`,
    improved: !maxed
  };
}
