// ระบบอัปเกรดเครื่องราง/สัตว์เลี้ยง — ตัวเลขสมดุลอยู่ที่นี่ที่เดียว
// UI เรียกใช้เฉพาะผลลัพธ์สำเร็จรูป ไม่คำนวณเอง
import { huntSession } from './HuntSession';
import { LOOT_TABLE } from '../data/loot';
import type { Rarity } from '../data/rarity';

export type UpgradeType = 'charm' | 'pet';
export const MAX_LEVEL = 10;
export const MELT_NEED = 10;

// ---------- เก็บเลเวล ----------
class UpgradeStore {
  public charmLevels: Record<string, number> = {};
  public petLevels: Record<string, number> = {};

  getCharmLevel(id: string): number { return clampLevel(this.charmLevels[id] ?? 1); }
  getPetLevel(id: string): number { return clampLevel(this.petLevels[id] ?? 1); }
  setCharmLevel(id: string, lv: number) { this.charmLevels[id] = clampLevel(lv); }
  setPetLevel(id: string, lv: number) { this.petLevels[id] = clampLevel(lv); }

  export() { return { charmLevels: this.charmLevels, petLevels: this.petLevels }; }

  import(data: any) {
    this.charmLevels = sanitize(data?.charmLevels);
    this.petLevels = sanitize(data?.petLevels);
  }

  reset() { this.charmLevels = {}; this.petLevels = {}; }
}

function clampLevel(lv: any): number {
  const n = Number(lv);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(MAX_LEVEL, Math.floor(n)));
}

// เซฟเก่าอาจพังมา — กรองให้เหลือแต่ตัวเลขที่ใช้ได้
function sanitize(raw: any): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const key of Object.keys(raw)) out[key] = clampLevel(raw[key]);
  return out;
}

export const upgrades = new UpgradeStore();

// ---------- ตารางราคา (บังคับระดับ rarity) ----------
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

// ไอเทมที่ใช้: เครื่องราง = แร่, สัตว์เลี้ยง = ไม้
export function materialOf(type: UpgradeType): string {
  return type === 'charm' ? 'ore' : 'wood';
}

export function levelOf(type: UpgradeType, id: string): number {
  return type === 'charm' ? upgrades.getCharmLevel(id) : upgrades.getPetLevel(id);
}

// ราคาของ "ขั้นถัดไป" — คืน null ถ้าตันแล้ว
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

// หักของแล้วเพิ่มเลเวล — เซฟให้ทันที กันลืมเรียกจากฝั่ง UI
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
  healChance: number;      // โอกาสฟื้นเลือดต่อการโจมตีโดน (0-1)
  healAmount: number;      // ฟื้นครั้งละกี่หน่วย
  healMaxPerHunt: number;  // ฟื้นได้กี่ครั้งต่อการล่า
  streakHitsNeeded: number;// ต้องตีติดกี่ครั้งเพื่อชาร์จ
  streakMultiplier: number;// ดาเมจตอนชาร์จเต็ม
}

export interface PetEffect {
  swiftIntervalMs: number; // บัฟความเร็วออกทุกกี่ ms
  swiftDurationMs: number; // บัฟนานกี่ ms
  swiftBonusPct: number;   // เร็วขึ้นกี่ %
  mortarIntervalMs: number;// ครกยิงทุกกี่ ms
  mortarDamage: number;    // ดาเมจครกต่อลูก
}

// เครื่องราง: เลเวลเพิ่มโอกาส/จำนวนครั้ง/ชาร์จไว
export function charmEffectAt(id: string, lv: number): CharmEffect {
  const L = clampLevel(lv) - 1; // 0..9
  return {
    healChance: Math.min(0.75, 0.30 + L * 0.05),
    healAmount: 1 + Math.floor(L / 5),
    healMaxPerHunt: 2 + Math.floor(L / 3),
    streakHitsNeeded: Math.max(2, 5 - Math.floor(L / 3)),
    streakMultiplier: 2 + Math.floor(L / 4)
  };
}

// สัตว์เลี้ยง: เลเวลลดคูลดาวน์ + เพิ่มความแรง/ระยะเวลา
export function petEffectAt(id: string, lv: number): PetEffect {
  const L = clampLevel(lv) - 1;
  return {
    swiftIntervalMs: Math.max(6000, 15000 - L * 1000),
    swiftDurationMs: 3000 + L * 250,
    swiftBonusPct: 40 + L * 3,
    mortarIntervalMs: Math.max(3500, 8000 - L * 500),
    mortarDamage: 2 + Math.floor(L / 3)
  };
}

export function charmEffectNow(id: string): CharmEffect { return charmEffectAt(id, upgrades.getCharmLevel(id)); }
export function petEffectNow(id: string): PetEffect { return petEffectAt(id, upgrades.getPetLevel(id)); }

// ---------- ข้อความผลลัพธ์สำเร็จรูปสำหรับ UI (ไม่โชว์สูตร) ----------
export interface EffectLine {
  label: string;
  now: string;
  next: string | null; // null = ตันแล้ว
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