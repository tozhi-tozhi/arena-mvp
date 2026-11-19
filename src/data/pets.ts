// src/data/pets.ts — ข้อมูลสัตว์เลี้ยง (ทำงานด้วยเวลาเท่านั้น ไม่มีเลือด ไม่ต้องสั่ง)
// รูปร่าง/ขนาด/จังหวะลอย ย้ายมาเป็นข้อมูล — เพิ่มสัตว์ใหม่ไม่ต้องแก้โค้ดวาดตัว
// พฤติกรรมอยู่ที่ systems/petBehaviors.ts · ตัวเลขตามเลเวลอยู่ที่ systems/Upgrades.ts
export type PetId = 'swift' | 'mortar';

export interface PetDef {
  id: PetId;
  name: string;
  desc: string;
  color: number;
  /** รูปร่างตัวยืนพื้นจนกว่าจะมีภาพจริง */
  shape: 'circle' | 'box';
  /** circle = [รัศมี, รัศมี] · box = [กว้าง, สูง] */
  size: [number, number];
  /** คาบลอยขึ้นลง (มิลลิวินาที — เลขน้อยลอยเร็ว) */
  bobMs: number;
}

export const PET_IDS: PetId[] = ['swift', 'mortar'];

export const PETS: Record<PetId, PetDef> = {
  swift: {
    id: 'swift',
    name: 'ลมวูบ',
    desc: 'ทุก 15 วิ เร็วขึ้น +40% นาน 3 วิ',
    color: 0xfff27a,
    shape: 'circle',
    size: [8, 8],
    bobMs: 90
  },
  mortar: {
    id: 'mortar',
    name: 'ครกจิ๋ว',
    desc: 'ทุก 8 วิ ยิงกระสุนตกใส่ที่บอสยืน (ดาเมจ 200)',
    color: 0xff9a5a,
    shape: 'box',
    size: [16, 12],
    bobMs: 260
  }
};

// ค่าฐานอ้างอิง (ของจริงตามเลเวลอ่านจาก Upgrades.ts)
export const PET_SPEED = {
  intervalMs: 15000,
  multiplier: 1.4,
  durationMs: 3000
};

export const PET_MORTAR = {
  intervalMs: 8000,
  radius: 70,
  damage: 200,
  flightMs: 1200 // เวลาจากยิงถึงตก (วงเตือนที่พื้นเต็มพอดี)
};