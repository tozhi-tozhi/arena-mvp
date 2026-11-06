// ตารางมอนสเตอร์ — เพิ่มมอนตัวใหม่ = เพิ่มอีกก้อนในตารางนี้
// ท่าโจมตีอ้างอิงด้วยชื่อจาก data/monsterAttacks.ts

export interface PhaseDef {
  hpBelow: number;        // เข้าเฟสนี้เมื่อเลือดเหลือไม่เกินสัดส่วนนี้ (0.5 = ครึ่งหนึ่ง)
  addAttacks?: string[];  // ท่าใหม่ที่ปลดล็อก
  speedMult?: number;     // คูณความเร็วเดิน
}

export interface MonsterDef {
  id: string;
  name: string;
  sprite: string;                // key ของรูปที่โหลดไว้ใน preload
  scale: number;
  hp: number;
  speed: number;
  chaseMs: [number, number];     // เดินไล่นานเท่าไรก่อนใช้ท่า (สุ่มระหว่างสองค่า)
  color: number;                 // สีเศษตอนตาย
  baseTint?: number;             // ย้อมสีตัวมอน (ใช้ทำมอนหลายสีจากรูปเดียว)
  attacks: string[];
  phases: PhaseDef[];
}

export const MONSTERS: Record<string, MonsterDef> = {
  big_slime: {
    id: 'big_slime',
    name: 'สไลม์ยักษ์',
    sprite: 'slime',
    scale: 6,
    hp: 20,
    speed: 50,
    chaseMs: [1200, 2200],
    color: 0x66dd66,
    attacks: ['slam', 'charge'],
    phases: [{ hpBelow: 0.5, addAttacks: ['shockwave'], speedMult: 1.3 }]
  },

  purple_slime: {
    id: 'purple_slime',
    name: 'สไลม์ม่วง',
    sprite: 'slime',
    scale: 5,
    hp: 16,
    speed: 75,
    chaseMs: [900, 1700],
    color: 0x9a7bff,
    baseTint: 0xb39cff,
    attacks: ['charge_fast', 'shockwave'],
    phases: [{ hpBelow: 0.5, addAttacks: ['slam'], speedMult: 1.3 }]
  }
};

// สุ่มมอนที่จะเจอ (ผู้เล่นไม่รู้ล่วงหน้า)
export function pickRandomMonsterId(): string {
  const ids = Object.keys(MONSTERS);
  return ids[Math.floor(Math.random() * ids.length)];
}