// src/systems/DpsMeter.ts — ตัววัดดาเมจของห้องฝึก (ไม่รู้จักฉาก ไม่รู้จักผู้เล่น)
// รับตัวเลขดาเมจ "หลังคำนวณแล้ว" (รวมคริ/บัฟ) จากหุ่น — ตรงกับที่บอสจะเจอจริง

/** หยุดตีเกินเวลานี้ = ฮิตถัดไปเริ่มรอบใหม่ (ตัวเลขรอบเก่าค้างให้อ่านจนกว่าจะเริ่มรอบใหม่) */
export const DPS_IDLE_MS = 3000;
const RECENT_KEEP = 6;

export class DpsMeter {
  total: number = 0;
  count: number = 0;
  maxHit: number = 0;
  lastHit: number = 0;
  firstAt: number = 0;
  lastAt: number = 0;
  /** โหมดจับเวลาตั้งเป็น Infinity เพื่อไม่ให้รอบแตกกลางทาง */
  idleResetMs: number = DPS_IDLE_MS;
  /** ล็อกหลังจบจับเวลา — ฮิตใหม่ไม่นับจนกว่าจะรีเซ็ต */
  locked: boolean = false;
  private recent: number[] = [];

  record(now: number, damage: number) {
    if (this.locked) return;
    if (this.count > 0 && now - this.lastAt > this.idleResetMs) this.clear();
    if (this.count === 0) this.firstAt = now;
    this.total += damage;
    this.count++;
    this.lastHit = damage;
    this.lastAt = now;
    if (damage > this.maxHit) this.maxHit = damage;
    this.recent.push(damage);
    if (this.recent.length > RECENT_KEEP) this.recent.shift();
  }

  /** กำลังตีอยู่ (ฮิตล่าสุดไม่เกิน 3 วินาที) */
  isActive(now: number): boolean {
    return this.count > 0 && now - this.lastAt <= DPS_IDLE_MS;
  }

  /** DPS = ดาเมจรวม / เวลาตั้งแต่ฮิตแรก (ขั้นต่ำ 1 วินาที กันตัวเลขพุ่งตอนฮิตแรก) · หยุดตีแล้วตัวเลขค้างไว้ */
  dps(now: number): number {
    if (this.count === 0) return 0;
    const end = this.isActive(now) ? now : this.lastAt;
    return this.total / Math.max(1, (end - this.firstAt) / 1000);
  }

  recentList(): number[] {
    return this.recent.slice();
  }

  reset() {
    this.clear();
    this.locked = false;
    this.idleResetMs = DPS_IDLE_MS;
  }

  private clear() {
    this.total = 0;
    this.count = 0;
    this.maxHit = 0;
    this.lastHit = 0;
    this.firstAt = 0;
    this.lastAt = 0;
    this.recent = [];
  }
}