// กระเป๋านักล่า — เก็บไอเทมแบบ {itemId}_{rarity} แยกกัน
// เช่น ore_common แยกจาก ore_legendary เพื่อให้อัปเกรดตาม rarity ได้
import { LOOT_TABLE } from '../data/loot';
import { migrateRarity, RARITY, type Rarity } from '../data/rarity';

export interface BagEntry {
  key: string;      // full key = 'ore_common'
  itemId: string;   // 'ore'
  name: string;     // 'แร่'
  icon: string;     // 'item_ore'
  rarity: Rarity;
  count: number;
}

// map ของไอเทมเก่า → ใหม่ (migrate v2 → v3)
const LEGACY_ITEM_MAP: Record<string, string> = {
  herb: 'ore',
  essence: 'essence',
  dream_shard: 'bone',
  relic: 'essence'
};

function migrateItemId(oldId: string): string {
  return LEGACY_ITEM_MAP[oldId] ?? oldId;
}

// ---------- สมุดบันทึกการล่า ----------
const LOG_MAX = 8; // เก็บย้อนหลัง 8 ทริป (สถิติรวมไม่หาย)

export interface TripLogEntry {
  at: number;                        // เวลาจบทริป (ms)
  outcome: 'return' | 'death';
  area: number;                      // แอเรียลึกสุดที่ไปถึง
  kept: number;                      // ของที่ฝากเข้ากระเป๋า
  lost: number;                      // ของที่เสีย (ตาย)
  hp: number;
  maxHp: number;
  ms: number;                        // เวลาที่ใช้ในทริป
}

export interface TripStats {
  trips: number;
  returns: number;
  deaths: number;
  bestArea: number;
  bosses: number;
  loot: number;
}

function emptyStats(): TripStats {
  return { trips: 0, returns: 0, deaths: 0, bestArea: 0, bosses: 0, loot: 0 };
}

function num(v: any, min = 0): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.max(min, n) : min;
}

class HuntSessionStore {
    // ---------- เลือดผู้เล่นข้ามแอเรีย (ความจำร่วมของทริป — ไม่เซฟลงเครื่อง) ----------
  // null = ยังไม่มีค่า (เข้า The World ครั้งแรกของทริป → ใช้เลือดเต็มจากตัวละคร)
  private tripHP: number | null = null;

  /** ฉากเรียกตอนสร้างผู้เล่น — ได้เลือดค้างจากแมพก่อน หรือ null ถ้าเป็นแมพแรก */
  getTripHP(): number | null {
    return this.tripHP;
  }

  /** ผู้เล่นเลือดเปลี่ยน/จะออกจากแมพ — ฝากค่าไว้ให้แมพถัดไป */
  setTripHP(hp: number): void {
    this.tripHP = Math.max(0, Math.floor(hp));
  }

  /** จบทริป (กลับฐาน/ตาย) — ล้าง เพื่อให้ทริปหน้าเริ่มเลือดเต็ม */
  clearTripHP(): void {
    this.tripHP = null;
  }
  
  // ---------- ตำแหน่งยืนในฐาน (ความจำชั่วคราว — ไม่เซฟลงเครื่อง) ----------
  // null = ยังไม่เคยยืนในฐาน → ใช้จุดกลางฐานตามเดิม
  private basePos: { x: number; y: number } | null = null;
  /** กลับจากห้องแต่งตัว/โรงตีเหล็ก/กระเป๋า → ยืนจุดเดิม */
  getBasePos(): { x: number; y: number } | null {
    return this.basePos;
  }
  setBasePos(x: number, y: number): void {
    this.basePos = { x, y };
  }
  clearBasePos(): void {
    this.basePos = null;
  }

  // ---------- ธงบอกว่ากลับมาจากห้องแต่งตัว (ฉากฐานใช้ข้ามการล้างตำแหน่ง) ----------
  private fromDressing = false;
  markFromDressing(): void {
    this.fromDressing = true;
  }
  /** อ่านแล้วล้างทันที — ใช้ได้ครั้งเดียว */
  consumeFromDressing(): boolean {
    const v = this.fromDressing;
    this.fromDressing = false;
    return v;
  }
  
  // ---------- สมุดบันทึกการล่า (เซฟลงเครื่องผ่าน SaveGame) ----------
  private log: TripLogEntry[] = [];
  private stats: TripStats = emptyStats();

  /** จบทริป 1 ครั้ง — ฉากโลกเรียกทั้งตอนกลับฐานและตอนตาย */
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

  /** บอสตาย 1 ตัวใน The World (ห้องฝึกไม่นับ) */
  addBossKill(): void {
    this.stats.bosses++;
  }

  getLog(): TripLogEntry[] {
    return this.log.map((e) => ({ ...e }));
  }

  getStats(): TripStats {
    return { ...this.stats };
  }

  exportLog(): { entries: TripLogEntry[]; stats: TripStats } {
    return { entries: this.getLog(), stats: this.getStats() };
  }

  /** เซฟเก่าไม่มีบล็อกนี้ → เริ่มว่าง เกมไม่พัง */
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
  private bag: Map<string, BagEntry> = new Map();

  // เพิ่มไอเทม — แยกตาม rarity
  addItem(dropped: { id: string; name: string; icon: string; rarity: Rarity }): void {
    const key = `${dropped.id}_${dropped.rarity}`;
    const existing = this.bag.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      this.bag.set(key, {
        key,
        itemId: dropped.id,
        name: dropped.name,
        icon: dropped.icon,
        rarity: dropped.rarity,
        count: 1
      });
    }
  }

  getBag(): BagEntry[] {
    return Array.from(this.bag.values());
  }

  // ยอดรวมของ itemId หนึ่ง (ทุกระดับ rarity) — ใช้แสดงใน Base
  getItemTotal(itemId: string): number {
    let total = 0;
    for (const entry of this.bag.values()) {
      if (entry.itemId === itemId) total += entry.count;
    }
    return total;
  }

  // จำนวนของ rarity ที่ระบุ — ใช้ตอนอัปเกรด
  getCountByRarity(itemId: string, rarity: Rarity): number {
    return this.bag.get(`${itemId}_${rarity}`)?.count ?? 0;
  }



  // ใช้ของ (ตาม rarity) — คืน true ถ้าพอ
  spend(itemId: string, rarity: Rarity, amount: number): boolean {
    const key = `${itemId}_${rarity}`;
    const entry = this.bag.get(key);
    if (!entry || entry.count < amount) return false;
    entry.count -= amount;
    if (entry.count <= 0) this.bag.delete(key);
    return true;
  }

  getTotalCount(): number {
    let total = 0;
    for (const entry of this.bag.values()) total += entry.count;
    return total;
  }

  // เซฟ: แค่ id + rarity + count
  exportBag(): Array<{ itemId: string; rarity: Rarity; count: number }> {
    return Array.from(this.bag.values()).map((e) => ({
      itemId: e.itemId,
      rarity: e.rarity,
      count: e.count
    }));
  }

  // โหลด: รองรับทั้ง v2 (id) และ v3 (itemId) + migrate item เก่า
  importBag(entries: any[]): void {
    this.bag.clear();
    if (!Array.isArray(entries)) return;
    for (const e of entries) {
      if (!e) continue;
      const rawId = String(e.itemId ?? e.id ?? '');
      const itemId = migrateItemId(rawId);
      const def = LOOT_TABLE.find((l) => l.id === itemId);
      if (!def) continue;
      const count = Math.floor(Number(e.count));
      if (!(count > 0)) continue;

      const rarity = migrateRarity(e.rarity);
      const key = `${itemId}_${rarity}`;
      const existing = this.bag.get(key);
      if (existing) {
        existing.count += count;
      } else {
        this.bag.set(key, {
          key,
          itemId: def.id,
          name: def.name,
          icon: def.icon,
          rarity,
          count
        });
      }
    }
  }

  clear(): void {
    this.bag.clear();
    this.clearLog(); // ล้างเซฟ = ล้างสมุดบันทึกด้วย
  }
}

export const huntSession = new HuntSessionStore();