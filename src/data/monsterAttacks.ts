// ตารางท่าโจมตีของมอนสเตอร์ — เพิ่มท่าใหม่ = เพิ่มอีกก้อนในตารางนี้
// (ถ้าเป็นท่าชนิดใหม่ ต้องเพิ่มพฤติกรรมใน entities/Monster.ts ด้วย)

export type AttackKind = 'slam' | 'charge' | 'shockwave';

export interface AttackDef {
  kind: AttackKind;
  damage: number;      // ดาเมจต่อผู้เล่น
  telegraphMs: number; // เวลาเตือนก่อนโจมตี (ยิ่งนานยิ่งหลบง่าย)
  recoverMs: number;   // เวลาพักหลังโจมตี (ช่วงที่ผู้เล่นสวนได้)
  radius?: number;     // รัศมีความเสียหาย (slam / shockwave)
  speed?: number;      // ความเร็วพุ่ง (charge)
  durationMs?: number; // ระยะเวลาที่ท่าทำงาน (charge / shockwave)
}

export const ATTACKS: Record<string, AttackDef> = {
  // กระแทกพื้น: วงกลมรอบตัวบอส ต้องหนีออกหรือ dash หลบตอนมันลง
  slam: { kind: 'slam', damage: 2, telegraphMs: 800, recoverMs: 900, radius: 110 },

  // พุ่งชน: แถบแดงบอกทิศ ต้องหลบออกข้าง
  charge: { kind: 'charge', damage: 1, telegraphMs: 700, recoverMs: 1000, speed: 420, durationMs: 550 },

  // พุ่งชนเวอร์ชันเร็ว (ใช้กับสไลม์ม่วง)
  charge_fast: { kind: 'charge', damage: 1, telegraphMs: 550, recoverMs: 800, speed: 520, durationMs: 500 },

  // คลื่นกระแทก: วงแหวนขยายออก ต้อง dash ทะลุวงตอนมันมาถึง
  shockwave: { kind: 'shockwave', damage: 1, telegraphMs: 600, recoverMs: 900, radius: 280, durationMs: 700 }
};