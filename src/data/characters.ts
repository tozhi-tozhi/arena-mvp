// ตัวละครผู้เล่น — แก้ตัวเลขสมดุลที่นี่ที่เดียว
export type CharacterId = 'akkhani' | 'luma';

export interface CharacterDef {
  id: CharacterId;
  name: string;
  tagline: string;
  lines: string[];
  maxHP: number;
  speed: number;
  scale: number;
  tint: number;
  skillName: string;
  skillCooldownMs: number;
}

export const CHARACTER_IDS: CharacterId[] = ['akkhani', 'luma'];

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  akkhani: {
    id: 'akkhani',
    name: 'อัคนี',
    tagline: 'นักดาบหญิงผมแดง · ประชิด · โมเมนตัม',
    lines: [
      'คลิกซ้าย — ฟันกวาด',
      'ค้างคลิกซ้าย — ฟันกวาด + พุ่งดาบ',
      'คลิกขวา — อมตะ แล้วฟันใหญ่ + ฟื้นเลือด',
      'พาสซีฟ — โดนตีแล้วได้โล่ 1 ฮิต'
    ],
    maxHP: 6,
    speed: 150,
    scale: 1.1,
    tint: 0xff8a7a,
    skillName: 'ฟันกวาดใหญ่',
    skillCooldownMs: 16000
  },
  luma: {
    id: 'luma',
    name: 'ลูมิ',
    tagline: 'ภูติน้อย · ระยะไกล · รักษาระยะ',
    lines: [
      'คลิกซ้าย — ยิงกระสุน ระเบิดปลายทาง',
      'ค้างคลิกซ้าย — ยิงกระสุนพัด (สั้น)',
      'คลิกขวา — แดช (ไม่อมตะ)',
      'พาสซีฟ — โจมตีโดนครบ 8 ครั้ง รีเซ็ตแดช'
    ],
    maxHP: 4,
    speed: 175,
    scale: 0.8,
    tint: 0xbfeaff,
    skillName: 'แดช',
    skillCooldownMs: 4500
  }
};

// ---------- ตัวเลขท่าของอัคนี ----------
export const AKKHANI = {
  light: {
    damage: 1,
    range: 95,
    halfAngle: 60,     // ครึ่งมุมของกรวยฟัน (องศา)
    activeMs: 140,     // ช่วงที่ดาบ "โดน" ได้
    durationMs: 300,   // ใช้เวลารวมก่อนตีครั้งต่อไปได้
    lungeSpeed: 220,   // ก้าวไปข้างหน้าตอนฟัน
    lungeMs: 100,
    assistRange: 190,
    assistAngle: 75
  },
  charged: {
    holdMs: 400,
    sweepDamage: 1,
    sweepRange: 105,
    sweepHalfAngle: 65,
    sweepActiveMs: 160,
    thrustDelayMs: 200,
    thrustMs: 240,
    thrustSpeed: 420,
    thrustDamage: 2,
    totalMs: 720,
    assistRange: 220,
    assistAngle: 75
  },
  skill: {
    windupMs: 600,     // ช่วงอมตะ
    range: 170,
    halfAngle: 100,
    damage: 3,
    heal: 1,           // ฟื้นเลือดเมื่อฟันโดนบอส
    activeMs: 220,
    recoverMs: 500,    // ช่วงเปิดหลังฟัน (ไม่อมตะแล้ว)
    assistRange: 260,
    assistAngle: 120
  },
  passive: {
    shieldCooldownMs: 9000
  }
};

// ---------- ตัวเลขท่าของลูมิ ----------
export const LUMA = {
  light: {
    cooldownMs: 450,
    speed: 380,
    range: 320,
    radius: 6,
    aoeRadius: 38,
    nearDamage: 1,     // ระเบิดใกล้
    farDamage: 2,      // ระเบิดไกล (ยิงจากระยะไกล = แรงกว่า)
    farRatio: 0.6,     // เดินทางเกินกี่ % ของระยะ ถึงนับว่า "ไกล"
    color: 0xbff7ff,
    assistRange: 420,
    assistAngle: 40
  },
  charged: {
    holdMs: 450,
    count: 7,
    spreadDeg: 8,
    speed: 420,
    range: 170,
    radius: 5,
    aoeRadius: 14,
    damage: 1,
    totalMs: 500,
    color: 0xffc8f5,
    assistRange: 240,
    assistAngle: 40
  },
  dash: {
    speed: 420,
    durationMs: 200
  },
  passive: {
    hitsNeeded: 8
  }
};