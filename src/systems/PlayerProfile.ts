// src/systems/PlayerProfile.ts — ข้อมูล "ต่อผู้เล่นหนึ่งคน" (Phase 5A ฉบับครบ)
// ของที่ผูกกับผู้เล่นอยู่ในนี้ทั้งหมด: ตัวละคร · สกิล 4 ช่อง · เครื่องราง · สัตว์เลี้ยง · บอสที่จะสู้
//   ถุงพกพาของทริปนี้ · กระเป๋าถาวร · สมุดบันทึก · เลือดข้ามแอเรีย · ที่ยืนในฐาน
// เครื่องผู้เล่นคนเดียวมีผู้เล่นท้องถิ่น 1 คน · ตอนเล่นร่วมเพิ่มผู้เล่นอื่นในเล่มเดียวกันได้โดยไม่ต้องรื้อใหม่
// กฎ: ห้ามสร้างค่ากลางใหม่ผูกผู้เล่นคนเดียว — ของใหม่ให้เป็นฟิลด์ของคลาสนี้
// หมายเหตุ: สกิลที่ปลดล็อกแล้วกับระดับสกิล จะเพิ่มตอนทำระบบสกิลบุค (ตอนนี้ยังไม่ต้องมี)
import { CHARACTER_IDS, type CharacterId } from '../data/characters';
import { CHARM_IDS, type CharmId } from '../data/charms';
import { PET_IDS, type PetId } from '../data/pets';
import { BOSS_IDS, type BossChoice } from '../data/bosses';
import { defaultSkillsAll, findSkill, isPlayable, SKILL_SLOTS, type SkillId, type SkillSlot } from '../data/skills';
import type { DroppedLoot } from '../data/loot';
import { DEATH_LOSS_RATIO } from '../data/world';
import { LOOT_TABLE } from '../data/loot';
import { migrateRarity, type Rarity } from '../data/rarity';
import { pouchCapacityNow } from './Upgrades';

// =====================================================
//  กระเป๋าถาวร + สมุดบันทึก (ของเก่าที่ย้ายมาจาก HuntSession)
// =====================================================
export interface BagEntry {
  key: string;      // คีย์เต็ม = 'ore_common'
  itemId: string;   // 'ore'
  name: string;
  icon: string;
  rarity: Rarity;
  count: number;
}

export interface TripLogEntry {
  at: number;
  outcome: 'return' | 'death';
  area: number;
  kept: number;
  lost: number;
  hp: number;
  maxHp: number;
  ms: number;
}

export interface TripStats {
  trips: number;
  returns: number;
  deaths: number;
  bestArea: number;
  bosses: number;
  loot: number;
}

const LOG_MAX = 8;

// ของเก่าในเซฟรุ่นก่อน → ชื่อปัจจุบัน
const LEGACY_ITEM_MAP: Record<string, string> = {
  herb: 'ore',
  essence: 'essence',
  dream_shard: 'bone',
  relic: 'essence'
};

function emptyStats(): TripStats {
  return { trips: 0, returns: 0, deaths: 0, bestArea: 0, bosses: 0, loot: 0 };
}

function num(v: any, min = 0): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.max(min, n) : min;
}

export class PlayerProfile {
  readonly id: string;

  // ---------- ของที่เซฟลงเครื่อง ----------
  characterId: CharacterId = 'akkhani';
  charmId: CharmId | null = null;
  petId: PetId | null = null;
  bossChoice: BossChoice = 'random';
  /** สกิลที่ใส่ไว้ แยกตามตัวละคร — เปลี่ยนตัวละครแล้วชุดที่จัดไว้ไม่หาย */
  skills: Record<CharacterId, Record<SkillSlot, SkillId>>;
  private bag = new Map<string, BagEntry>();
  private log: TripLogEntry[] = [];
  private stats: TripStats = emptyStats();

  // ---------- ของชั่วคราวระหว่างทริป (ไม่เซฟ — ปิดเกมกลางทริปคือจบทริป) ----------
  private pouchItems: DroppedLoot[] = [];
  pouchStartedAt: number = Date.now();
  private tripHP: number | null = null;
  private basePos: { x: number; y: number } | null = null;
  private fromDressing = false;

  constructor(id: string) {
    this.id = id;
    this.skills = defaultSkillsAll();
  }

  // =====================================================
  //  สกิลที่ใส่ไว้
  // =====================================================
  skillOf(slot: SkillSlot, char: CharacterId = this.characterId): SkillId {
    return this.skills[char]?.[slot] ?? skillFallback(char, slot);
  }

  /** ใส่สกิลลงช่อง — คืน false ถ้าไม่ใช่ของตัวละคร/ช่องนี้ หรือยังไม่มีท่าในเกม */
  setSkill(slot: SkillSlot, id: SkillId): boolean {
    const d = findSkill(id);
    if (!d) return false;
    if (d.char !== this.characterId || d.slot !== slot) return false;
    if (!isPlayable(id)) return false;
    this.skills[this.characterId][slot] = id;
    return true;
  }

  // =====================================================
  //  เลือดข้ามแอเรีย
  // =====================================================
  getTripHP(): number | null { return this.tripHP; }
  setTripHP(hp: number): void { this.tripHP = Math.max(0, Math.floor(hp)); }
  clearTripHP(): void { this.tripHP = null; }

  // =====================================================
  //  ที่ยืนในฐาน + ธงกลับจากห้องแต่งตัว
  // =====================================================
  getBasePos(): { x: number; y: number } | null { return this.basePos; }
  setBasePos(x: number, y: number): void { this.basePos = { x, y }; }
  clearBasePos(): void { this.basePos = null; }
  markFromDressing(): void { this.fromDressing = true; }
  consumeFromDressing(): boolean {
    const v = this.fromDressing;
    this.fromDressing = false;
    return v;
  }

  // =====================================================
  //  ถุงพกพา (ของระหว่างทริป)
  // =====================================================
  startTrip(): void {
    this.pouchItems = [];
    this.pouchStartedAt = Date.now();
  }
  get pouchCount(): number { return this.pouchItems.length; }
  get pouchCapacity(): number { return pouchCapacityNow(); }
  get pouchFull(): boolean { return this.pouchItems.length >= this.pouchCapacity; }
  pouchList(): DroppedLoot[] { return this.pouchItems.slice(); }

  pouchAdd(loot: DroppedLoot): boolean {
    if (this.pouchFull) return false;
    this.pouchItems.push(loot);
    return true;
  }

  /** ถึงฐาน: โอนทุกชิ้นเข้ากระเป๋าถาวร */
  pouchDepositAll(): DroppedLoot[] {
    const moved = this.pouchItems;
    for (const it of moved) this.addItem(it);
    this.pouchItems = [];
    return moved;
  }

  /** ตาย: สุ่มเสียตามสัดส่วน (ปัดขึ้น) ที่เหลือโอนเข้ากระเป๋า */
  pouchResolveDeath(random: () => number = Math.random): { kept: DroppedLoot[]; lost: DroppedLoot[] } {
    const pool = this.pouchItems.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const loseN = Math.ceil(pool.length * DEATH_LOSS_RATIO);
    const lost = pool.slice(0, loseN);
    const kept = pool.slice(loseN);
    for (const it of kept) this.addItem(it);
    this.pouchItems = [];
    return { kept, lost };
  }

  // =====================================================
  //  กระเป๋าถาวร
  // =====================================================
  addItem(dropped: { id: string; name: string; icon: string; rarity: Rarity }): void {
    const key = `${dropped.id}_${dropped.rarity}`;
    const existing = this.bag.get(key);
    if (existing) {
      existing.count += 1;
      return;
    }
    this.bag.set(key, {
      key,
      itemId: dropped.id,
      name: dropped.name,
      icon: dropped.icon,
      rarity: dropped.rarity,
      count: 1
    });
  }

  getBag(): BagEntry[] { return Array.from(this.bag.values()); }

  getItemTotal(itemId: string): number {
    let total = 0;
    for (const e of this.bag.values()) if (e.itemId === itemId) total += e.count;
    return total;
  }

  getCountByRarity(itemId: string, rarity: Rarity): number {
    return this.bag.get(`${itemId}_${rarity}`)?.count ?? 0;
  }

  spend(itemId: string, rarity: Rarity, amount: number): boolean {
    const key = `${itemId}_${rarity}`;
    const e = this.bag.get(key);
    if (!e || e.count < amount) return false;
    e.count -= amount;
    if (e.count <= 0) this.bag.delete(key);
    return true;
  }

  getTotalCount(): number {
    let total = 0;
    for (const e of this.bag.values()) total += e.count;
    return total;
  }

  exportBag(): Array<{ itemId: string; rarity: Rarity; count: number }> {
    return Array.from(this.bag.values()).map((e) => ({ itemId: e.itemId, rarity: e.rarity, count: e.count }));
  }

  importBag(entries: any[]): void {
    this.bag.clear();
    if (!Array.isArray(entries)) return;
    for (const e of entries) {
      if (!e) continue;
      const rawId = String(e.itemId ?? e.id ?? '');
      const itemId = LEGACY_ITEM_MAP[rawId] ?? rawId;
      const d = LOOT_TABLE.find((l) => l.id === itemId);
      if (!d) continue;
      const count = Math.floor(Number(e.count));
      if (!(count > 0)) continue;
      const rarity = migrateRarity(e.rarity);
      const key = `${itemId}_${rarity}`;
      const existing = this.bag.get(key);
      if (existing) {
        existing.count += count;
        continue;
      }
      this.bag.set(key, { key, itemId: d.id, name: d.name, icon: d.icon, rarity, count });
    }
  }

  // =====================================================
  //  สมุดบันทึกการล่า
  // =====================================================
  logTrip(e: Omit<TripLogEntry, 'at'>): void {
    const entry: TripLogEntry = {
      at: Date.now(),
      outcome: e.outcome === 'death' ? 'death' : 'return',
      area: num(e.area, 1),
      kept: num(e.kept),
      lost: num(e.lost),
      hp: num(e.hp),
      maxHp: num(e.maxHp, 1),
      ms: num(e.ms)
    };
    this.log.unshift(entry);
    if (this.log.length > LOG_MAX) this.log.length = LOG_MAX;
    this.stats.trips++;
    if (entry.outcome === 'death') this.stats.deaths++;
    else this.stats.returns++;
    this.stats.bestArea = Math.max(this.stats.bestArea, entry.area);
    this.stats.loot += entry.kept;
  }

  addBossKill(): void { this.stats.bosses++; }
  getLog(): TripLogEntry[] { return this.log.map((e) => ({ ...e })); }
  getStats(): TripStats { return { ...this.stats }; }
  exportLog(): { entries: TripLogEntry[]; stats: TripStats } {
    return { entries: this.getLog(), stats: this.getStats() };
  }

  importLog(raw: any): void {
    this.clearLog();
    if (!raw || typeof raw !== 'object') return;
    if (Array.isArray(raw.entries)) {
      for (const e of raw.entries) {
        if (!e || typeof e !== 'object') continue;
        this.log.push({
          at: num(e.at),
          outcome: e.outcome === 'death' ? 'death' : 'return',
          area: num(e.area, 1),
          kept: num(e.kept),
          lost: num(e.lost),
          hp: num(e.hp),
          maxHp: num(e.maxHp, 1),
          ms: num(e.ms)
        });
      }
      if (this.log.length > LOG_MAX) this.log.length = LOG_MAX;
    }
    const s = raw.stats;
    if (s && typeof s === 'object') {
      this.stats = {
        trips: num(s.trips),
        returns: num(s.returns),
        deaths: num(s.deaths),
        bestArea: num(s.bestArea),
        bosses: num(s.bosses),
        loot: num(s.loot)
      };
    }
  }

  clearLog(): void {
    this.log = [];
    this.stats = emptyStats();
  }

  // =====================================================
  //  เซฟ / โหลด / ล้าง
  // =====================================================
  export() {
    return {
      characterId: this.characterId,
      charmId: this.charmId,
      petId: this.petId,
      bossChoice: this.bossChoice,
      skills: this.skills
    };
  }

  /** โหลดเซฟ — เซฟเก่าไม่มีช่องสกิลก็ได้ค่าเริ่มต้น A ครบ ไม่พัง */
  import(raw: any): void {
    if (raw && CHARACTER_IDS.includes(raw.characterId)) this.characterId = raw.characterId;
    this.charmId = raw && CHARM_IDS.includes(raw.charmId) ? raw.charmId : null;
    this.petId = raw && PET_IDS.includes(raw.petId) ? raw.petId : null;
    this.bossChoice =
      raw && (raw.bossChoice === 'random' || BOSS_IDS.includes(raw.bossChoice)) ? raw.bossChoice : 'random';

    this.skills = defaultSkillsAll();
    const saved = raw?.skills;
    if (!saved || typeof saved !== 'object') return;
    for (const char of CHARACTER_IDS) {
      for (const slot of SKILL_SLOTS) {
        const id = saved[char]?.[slot];
        const d = findSkill(id);
        if (d && d.char === char && d.slot === slot && isPlayable(id)) this.skills[char][slot] = id;
      }
    }
  }

  /** ล้างเซฟ — ของชั่วคราวระหว่างทริปหายด้วย */
  reset(): void {
    this.characterId = 'akkhani';
    this.charmId = null;
    this.petId = null;
    this.bossChoice = 'random';
    this.skills = defaultSkillsAll();
    this.bag.clear();
    this.clearLog();
    this.pouchItems = [];
    this.tripHP = null;
    this.basePos = null;
    this.fromDressing = false;
  }
}

/** ตัวละครใหม่ที่ตารางสกิลยังไม่มี → ใช้รหัสตัวเลือก A ไปก่อน (เกมไม่พัง) */
function skillFallback(char: CharacterId, slot: SkillSlot): SkillId {
  return `${char}_${slot}_a`;
}

/** เล่มเก็บผู้เล่นทุกคนที่เครื่องนี้รู้จัก — ตอนนี้ใช้คนเดียว ตอนเล่นร่วมเพิ่มช่องได้ */
class ProfileBook {
  private book = new Map<string, PlayerProfile>();
  localId = 'local';

  get(id: string): PlayerProfile {
    let p = this.book.get(id);
    if (!p) {
      p = new PlayerProfile(id);
      this.book.set(id, p);
    }
    return p;
  }

  get local(): PlayerProfile { return this.get(this.localId); }
  ids(): string[] { return Array.from(this.book.keys()); }
}

export const profiles = new ProfileBook();