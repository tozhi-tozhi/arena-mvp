// src/systems/HuntSession.ts — เปลือกเรียกข้อมูลทริป/กระเป๋าของผู้เล่นท้องถิ่น (Phase 5A)
// ของจริงย้ายไป PlayerProfile แล้ว — ไฟล์นี้คงชื่อและหน้าตาเดิมไว้ ให้ฉากเดิมทำงานต่อได้โดยไม่ต้องแก้
// ห้ามใส่ข้อมูลผู้เล่นใหม่ในไฟล์นี้ ให้ไปเพิ่มเป็นฟิลด์ใน PlayerProfile
import { profiles } from './PlayerProfile';
import type { BagEntry, TripLogEntry, TripStats } from './PlayerProfile';

// ฉากเดิมอ้างชนิดข้อมูลจากไฟล์นี้ — ส่งต่อให้ เพื่อไม่ต้องแก้ทุกที่
export type { BagEntry, TripLogEntry, TripStats };

class HuntSessionStore {
  private get p() { return profiles.local; }

  // ---------- เลือดข้ามแอเรีย ----------
  getTripHP(): number | null { return this.p.getTripHP(); }
  setTripHP(hp: number): void { this.p.setTripHP(hp); }
  clearTripHP(): void { this.p.clearTripHP(); }

  // ---------- ที่ยืนในฐาน ----------
  getBasePos(): { x: number; y: number } | null { return this.p.getBasePos(); }
  setBasePos(x: number, y: number): void { this.p.setBasePos(x, y); }
  clearBasePos(): void { this.p.clearBasePos(); }
  markFromDressing(): void { this.p.markFromDressing(); }
  consumeFromDressing(): boolean { return this.p.consumeFromDressing(); }

  // ---------- สมุดบันทึก ----------
  logTrip(e: Omit<TripLogEntry, 'at'>): void { this.p.logTrip(e); }
  addBossKill(): void { this.p.addBossKill(); }
  getLog(): TripLogEntry[] { return this.p.getLog(); }
  getStats(): TripStats { return this.p.getStats(); }
  exportLog(): { entries: TripLogEntry[]; stats: TripStats } { return this.p.exportLog(); }
  importLog(raw: any): void { this.p.importLog(raw); }
  clearLog(): void { this.p.clearLog(); }

  // ---------- กระเป๋าถาวร ----------
  addItem(d: { id: string; name: string; icon: string; rarity: any }): void { this.p.addItem(d); }
  getBag(): BagEntry[] { return this.p.getBag(); }
  getItemTotal(itemId: string): number { return this.p.getItemTotal(itemId); }
  getCountByRarity(itemId: string, rarity: any): number { return this.p.getCountByRarity(itemId, rarity); }
  spend(itemId: string, rarity: any, amount: number): boolean { return this.p.spend(itemId, rarity, amount); }
  getTotalCount(): number { return this.p.getTotalCount(); }
  exportBag(): Array<{ itemId: string; rarity: any; count: number }> { return this.p.exportBag(); }
  importBag(entries: any[]): void { this.p.importBag(entries); }

  clear(): void {
    this.p.reset();
  }
}

export const huntSession = new HuntSessionStore();