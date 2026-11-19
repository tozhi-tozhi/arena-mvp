// src/systems/ComboTracker.ts — ตัวนับคอมโบ 3 ฮิตของผู้เล่นหนึ่งคน
// กฎ: นับเฉพาะ "ตีปกติ" · ฮิต 3 คือผลของสกิลช่องคอมโบ · หยุดตีเกินหน้าต่างเวลาแล้วเริ่มนับใหม่
// ตัวนับนี้แยกจากตัวนับพาสซีฟและคริติคอลเสมอ ห้ามใช้ร่วมกัน
// ค่า 800 มิลลิวินาทีเป็นค่าชั่วคราวตามเอกสารออกแบบ ยังไม่จูน
export class ComboTracker {
  private hits = 0;
  private expireAt = 0;
  private windowMs: number;

  constructor(windowMs: number = 800) {
    this.windowMs = windowMs;
  }

  /** เรียกตอนจะออกตีปกติ — คืนเลขฮิตที่กำลังจะออก (1, 2 หรือ 3) */
  nextHit(now: number): number {
    if (now > this.expireAt || this.hits >= 3) this.hits = 0;
    this.hits++;
    this.expireAt = now + this.windowMs;
    return this.hits;
  }

  /** จำนวนฮิตที่ค้างอยู่ในชุดตอนนี้ (0 = หมดเวลาหรือยังไม่ตี) — ใช้วาดจุดบอกผู้เล่น */
  progress(now: number): number {
    return now > this.expireAt ? 0 : this.hits;
  }

  reset(): void {
    this.hits = 0;
    this.expireAt = 0;
  }
}