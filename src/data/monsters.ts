// ตารางมอนสเตอร์ — แต่ละตัวต้อง "เล่นต่างกัน" ไม่ใช่แค่ตัวเลขต่างกัน

export interface PhaseDef {
  hpBelow: number;
  addAttacks?: string[];
  speedMult?: number;
}

export interface MonsterDef {
  id: string;
  name: string;
  sprite: string;
  scale: number;
  hp: number;
  speed: number;
  chaseMs: [number, number];
  color: number;
  baseTint?: number;
  attacks: string[];
  phases: PhaseDef[];
  /** ลูกเล่นภาพระบุตัวตน — pulse (ตัวเต้น) / flicker (ตัวจาง) / ไม่ใส่ = นิ่ง */
  visualStyle?: 'pulse' | 'flicker';
}

export const MONSTERS: Record<string, MonsterDef> = {
  // ---------- tutorial: อ่านง่าย ทำช้า ----------
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

  // ---------- mid: เร็วกว่า ผสมคลื่น ----------
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
  },

  // ---------- 🆕 pattern: ยิงกระสุน (หลบด้วยการขยับ ไม่ใช่วง) ----------
  fire_slime: {
    id: 'fire_slime',
    name: 'สไลม์เพลิง',
    sprite: 'slime',
    scale: 5,
    hp: 14,
    speed: 70,
    chaseMs: [1100, 1700],
    color: 0xff6622,
    baseTint: 0xff8844,
    visualStyle: 'pulse',
    // เด่น: ยืนไกล ยิงกระสุน
    attacks: ['projectile'],
    // 40%: เพิ่มการพุ่ง = ต้องระวังทั้งกระสุนและตัวพุ่ง
    phases: [{ hpBelow: 0.4, addAttacks: ['charge_fast'], speedMult: 1.2 }]
  },

  // ---------- 🆕 pattern: ลำแสงตรง (หลบตั้งฉาก) ----------
  frost_slime: {
    id: 'frost_slime',
    name: 'สไลม์น้ำแข็ง',
    sprite: 'slime',
    scale: 7,
    hp: 28,
    speed: 40,
    chaseMs: [1500, 2200],
    color: 0x66ccff,
    baseTint: 0x88ddff,
    // เด่น: ถึก + ยิงลำแสงไกล + AoE ประชิด = ต้องบริหารระยะ
    attacks: ['beam', 'slam'],
    // 50%: เพิ่มคลื่น = ปิดช่องว่างการหลบ
    phases: [{ hpBelow: 0.5, addAttacks: ['shockwave'], speedMult: 1.15 }]
  },

  // ---------- 🆕 pattern: 3 ลูกกระจาย (หาช่องว่าง) ----------
  shadow_slime: {
    id: 'shadow_slime',
    name: 'สไลม์เงามืด',
    sprite: 'slime',
    scale: 4,
    hp: 10,
    speed: 100,
    chaseMs: [700, 1300],
    color: 0x6633aa,
    baseTint: 0x8855cc,
    visualStyle: 'flicker',
    // เด่น: เล็ก เร็ว ยิงกระจาย = ต้องขยับตลอดเวลา
    attacks: ['triple_projectile', 'charge_fast'],
    phases: [{ hpBelow: 0.5, addAttacks: ['slam'], speedMult: 1.3 }]
  }
};

export function pickRandomMonsterId(): string {
  const ids = Object.keys(MONSTERS);
  return ids[Math.floor(Math.random() * ids.length)];
}