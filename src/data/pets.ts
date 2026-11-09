// สัตว์เลี้ยง — ทำงานด้วย "เวลา" เท่านั้น (ทุก X วินาที) ไม่มี HP ไม่ต้องสั่ง
export type PetId = 'swift' | 'mortar';

export interface PetDef {
  id: PetId;
  name: string;
  desc: string;
  color: number;
}

export const PET_IDS: PetId[] = ['swift', 'mortar'];

export const PETS: Record<PetId, PetDef> = {
  swift: {
    id: 'swift',
    name: 'ลมวูบ',
    desc: 'ทุก 15 วิ เร็วขึ้น +40% นาน 3 วิ',
    color: 0xfff27a
  },
  mortar: {
    id: 'mortar',
    name: 'ครกจิ๋ว',
    desc: 'ทุก 8 วิ ยิงกระสุนตกใส่ที่บอสยืน (ดาเมจ 2)',
    color: 0xff9a5a
  }
};

// ตัวเลขสมดุล
export const PET_SPEED = {
  intervalMs: 15000,
  multiplier: 1.4,
  durationMs: 3000
};

export const PET_MORTAR = {
  intervalMs: 8000,
  radius: 70,
  damage: 2,
  flightMs: 1200 // เวลาจากยิงถึงตก (วงเตือนที่พื้นเต็มพอดี)
};