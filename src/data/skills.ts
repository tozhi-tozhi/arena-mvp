// src/data/skills.ts — ตารางสกิล 4 ช่อง × 3 ตัวเลือก ต่อตัวละคร
// ที่มาการออกแบบ: docs/design/char/char_akkhani.md และ docs/design/char/char_luma.md
// playable = เลือกแล้วเล่นได้จริงในโค้ดตอนนี้ · ที่เหลือคือแบบที่ออกแบบแล้วแต่ยังไม่มีท่าในเกม
// ตัวเลขทุกค่าเป็นค่าชั่วคราวสำหรับต้นแบบ ปรับหลังเล่นจริง ยังไม่ใช่ค่าสมดุลสุดท้าย
// กฎ: ห้ามเขียนชื่อตัวละครฝังในไฟล์นี้ — เพิ่มตัวละครใหม่ต้องไม่ต้องกลับมาแก้ที่นี่
import { AKKHANI, CHARACTER_IDS, type CharacterId } from './characters';

export type SkillSlot = 'passive' | 'combo' | 'charge' | 'ultimate';
export type SkillOption = 'a' | 'b' | 'c';
export type SkillId = string;

export const SKILL_SLOTS: SkillSlot[] = ['passive', 'combo', 'charge', 'ultimate'];

/** ชื่อช่องที่แสดงให้ผู้เล่นอ่าน */
export const SLOT_LABEL: Record<SkillSlot, string> = {
  passive: 'พาสซีฟ',
  combo: 'คอมโบฮิต 3',
  charge: 'ชาร์จ',
  ultimate: 'ไม้ตาย'
};

export interface SkillDef {
  id: SkillId;
  char: CharacterId;
  slot: SkillSlot;
  option: SkillOption;
  name: string;
  desc: string;
  playable: boolean;
}

/** รหัสสกิลหนึ่งตัว = ตัวละคร_ช่อง_ตัวเลือก */
export function skillId(char: CharacterId, slot: SkillSlot, option: SkillOption): SkillId {
  return `${char}_${slot}_${option}`;
}

function def(
  char: CharacterId,
  slot: SkillSlot,
  option: SkillOption,
  name: string,
  desc: string,
  playable: boolean = false
): SkillDef {
  return { id: skillId(char, slot, option), char, slot, option, name, desc, playable };
}

export const SKILLS: SkillDef[] = [
  // ---------- อัคนี ----------
  def('akkhani', 'passive', 'a', 'โล่กันหนึ่งฮิต', 'โดนโจมตีแล้วได้โล่กัน 1 ฮิต มีคูลดาวน์', true),
  def('akkhani', 'passive', 'b', 'ครบสี่ติดคริ', 'โจมตีโดนครบ 4 ครั้ง ฮิตถัดไปเป็นคริติคอล', true),
  def('akkhani', 'passive', 'c', 'สะสมพลังรัวห้า', 'สะสมพลังตามเวลา เมื่อเต็ม ตีปกติครั้งถัดไปรัว 5 ฮิต', true),
  def('akkhani', 'combo', 'a', 'หมุนฟันรอบตัว', 'ฮิต 3 หมุนฟันโดนทุกทิศรอบตัว', true),
  def('akkhani', 'combo', 'b', 'คลื่นดาบพุ่งหน้า', 'ฮิต 3 ส่งคลื่นดาบไปข้างหน้า ทะลุศัตรู', true),
  def('akkhani', 'combo', 'c', 'ระบำดาบสามเหลี่ยม', 'ฮิต 3 พุ่งสลับ 3 จุดยอด ฟัน 3 ครั้งในแอ็กชันเดียว', true),
  def('akkhani', 'charge', 'a', 'หมุนแล้วพุ่ง', 'ค้างแล้วปล่อย ฟันกวาดหนึ่งรอบแล้วพุ่งดาบ', true),
  def('akkhani', 'charge', 'b', 'พุ่งทันทีกระตุ้นพาสซีฟ', 'ชาร์จสั้น พุ่งทันทีและกระตุ้นพาสซีฟที่ใส่ไว้', true),
  def('akkhani', 'charge', 'c', 'พุ่งฟื้นเลือด', 'พุ่งฟัน ถ้าโดนได้เลือดคืน ถ้าพลาดไม่ได้อะไร', true),
  def('akkhani', 'ultimate', 'a', 'อมตะฟันกวาด', 'อมตะช่วงเตรียม แล้วฟันกวาดกว้าง ฟื้นเลือดเมื่อโดน', true),
  def('akkhani', 'ultimate', 'b', 'ฟาดพื้นคลื่นกระแทก', 'ฟาดพื้นเกิดคลื่นรอบตัว พร้อมบัฟความเร็วและดาเมจชั่วคราว', true),
  def('akkhani', 'ultimate', 'c', 'ดาบเจ็ดเล่มดาวเจ็ดแฉก', 'ปลดดาบ 7 เล่ม หายตัว แล้วฟันเป็นดาว 7 แฉกพร้อมกัน', true),

  // ---------- ลูมิ ----------
  // หมายเหตุ: พาสซีฟตัวเลือก A ตอนนี้รีเซ็ตคูลดาวน์ช่องไม้ตาย (เดิมคือแดช)
  def('luma', 'passive', 'a', 'จังหวะภูต', 'โจมตีโดนครบ 8 ครั้ง รีเซ็ตคูลดาวน์ไม้ตายทันที'),
  def('luma', 'passive', 'b', 'ม่านแสง', 'แดชแล้วได้เกราะแสงกัน 1 ฮิต มีคูลดาวน์ภายใน'),
  def('luma', 'passive', 'c', 'สะสมพลังเมื่อไม่โจมตี', 'เว้นจังหวะโจมตีเพื่อสะสมพลัง แล้วปล่อยเมื่อโจมตีอีกครั้ง'),
  def('luma', 'combo', 'a', 'กระสุนสามลูกกระจายพัด', 'ฮิต 3 ยิงกระสุน 3 ลูกกระจายเป็นพัด', true),
  def('luma', 'combo', 'b', 'หอกแสงทะลุ', 'ฮิต 3 ยิงหอกแสงเส้นตรง ทะลุเป้าหมายในแนวเดียวกัน'),
  def('luma', 'combo', 'c', 'ฮิตสามแล้วแดช', 'ฮิต 3 จบแล้วแดชต่อทันทีเพื่อเปลี่ยนตำแหน่ง'),
  def('luma', 'charge', 'a', 'แดชแล้วยิงพัดเจ็ด', 'แดชเปลี่ยนตำแหน่ง แล้วยิงกระสุน 7 ลูกเป็นพัด'),
  def('luma', 'charge', 'b', 'หอกแสงรวมศูนย์', 'แดชแล้วปล่อยหอกแสงขนาดใหญ่ ระยะไกลและทะลุ'),
  def('luma', 'charge', 'c', 'ลำแสงเชื่อมโยง', 'ยิงลำแสงเชื่อมกับเป้าหมาย ทำให้เป้าหมายเคลื่อนที่ช้าลง'),
  def('luma', 'ultimate', 'a', 'ฝนดาวตก', 'ระดมดาวตกถล่มพื้นที่เป้าหมายหลายระลอก'),
  def('luma', 'ultimate', 'b', 'ม่านออโรรา', 'กางม่านแสงฟื้นเลือดให้เพื่อนร่วมทีมในพื้นที่'),
  def('luma', 'ultimate', 'c', 'ภูติแสงยักษ์', 'แปลงร่างเป็นภูติแสงยักษ์ แล้วพุ่งผ่านศัตรูสร้างความเสียหาย')
];

export function findSkill(id: SkillId | null | undefined): SkillDef | null {
  if (!id) return null;
  return SKILLS.find((s) => s.id === id) ?? null;
}

export function isPlayable(id: SkillId | null | undefined): boolean {
  const d = findSkill(id);
  return !!d && d.playable;
}

/** สกิลทั้งหมดของช่องหนึ่งในตัวละครหนึ่ง — หน้าเลือกสกิลใช้รายการนี้ */
export function skillsOf(char: CharacterId, slot: SkillSlot): SkillDef[] {
  return SKILLS.filter((s) => s.char === char && s.slot === slot);
}

/** ชุดเริ่มต้น = ตัวเลือก A ทุกช่อง (มีให้ตั้งแต่เริ่มเล่น) — วนจากรายชื่อตัวละคร ไม่ฝังชื่อ */
export function defaultSkills(char: CharacterId): Record<SkillSlot, SkillId> {
  const out = {} as Record<SkillSlot, SkillId>;
  for (const slot of SKILL_SLOTS) out[slot] = skillId(char, slot, 'a');
  return out;
}

/** ชุดเริ่มต้นของทุกตัวละคร — ข้อมูลผู้เล่นใช้ก้อนนี้ตอนสร้าง/ล้าง */
export function defaultSkillsAll(): Record<CharacterId, Record<SkillSlot, SkillId>> {
  const out = {} as Record<CharacterId, Record<SkillSlot, SkillId>>;
  for (const char of CHARACTER_IDS) out[char] = defaultSkills(char);
  return out;
}

// ---------- ค่าชั่วคราวของท่าที่เล่นได้ตอนนี้ ----------
// อัคนี ฮิต 3 หมุนฟันรอบตัว — halfAngle 180 = โดนทุกทิศ
export const COMBO3_SPIN = {
  damage: 200,
  range: 110,
  halfAngle: 180,
  activeMs: 200,     // ช่วงที่ดาบโดนได้
  durationMs: 420    // เวลารวมก่อนตีครั้งต่อไปได้
};

// ลูมิ ฮิต 3 กระสุนพัด 3 ลูก — นัดละ 70 (รวม 210 ถ้าโดนครบ)
export const COMBO3_FAN = {
  count: 3,
  spreadDeg: 14,
  damage: 70,
  speed: 380,
  range: 300,
  radius: 5,
  aoeRadius: 26,
  color: 0xbff7ff,
  totalMs: 480
};

// ---------- อัคนี: ตัวเลือก B/C (ค่าชั่วคราว ปรับหลังเล่นจริง) ----------
// พาสซีฟ B — ตีโดนครบ hitsNeeded ครั้ง (นับต่อการโจมตี 1 ครั้ง) ฮิตถัดไปติดคริติคอล
export const AKK_PASSIVE_CRIT = {
  hitsNeeded: 4,
  multiplier: 2
};

// พาสซีฟ C — พลังสะสมตามเวลา เต็มแล้วตีปกติครั้งถัดไปกลายเป็นรัว 5 ฮิตในแอ็กชันเดียว
// ข้อสันนิษฐานชั่วคราว (เอกสารออกแบบข้อ 12.3 ยังเปิดอยู่): รัวแทนที่ตีปกติครั้งถัดไปทันที และรีเซ็ตตัวนับคอมโบ
export const AKK_PASSIVE_RUSH = {
  chargeMs: 12000,
  hits: [55, 55, 55, 55, 90],
  windupMs: 120,
  strikeGapMs: 85,
  activeMs: 70,
  range: 100,
  halfAngle: 70,
  totalMs: 760
};

// คอมโบ B — คลื่นดาบพุ่งหน้า ทะลุศัตรู
export const COMBO3_WAVE = {
  damage: 150,
  speed: 420,
  range: 260,
  halfWidth: 34,   // ครึ่งความกว้างคลื่น (ใช้ตรวจโดน)
  releaseMs: 220,  // ท่าสะสมแรงก่อนปล่อยคลื่น
  totalMs: 480
};

// คอมโบ C — ระบำดาบสามเหลี่ยม ฟัน 3 ครั้งที่จุดยอด 3 จุด
// ข้อสันนิษฐานชั่วคราว: อมตะตลอดท่า (เอกสารเขียนว่า "ไม่ถูกขัดจังหวะ")
export const COMBO3_TRIANGLE = {
  damages: [60, 60, 90],  // รวม 210
  forward: 44,            // จุดยอดหน้า-ข้าง เทียบจุดเริ่ม
  side: 34,
  windupMs: 60,
  moveMs: 110,
  pauseMs: 60,
  range: 95,
  halfAngle: 100,
  activeMs: 90,
  totalMs: 640
};

// ชาร์จ B — พุ่งทันทีและกระตุ้นพาสซีฟ
export const CHARGE_RUSH = {
  holdMs: 200,
  damage: 150,
  speed: 460,
  durationMs: 240,
  totalMs: 520
};

// ชาร์จ C — พุ่งฟัน ถ้าโดนฟื้นเลือดครั้งเดียวไม่ว่าโดนกี่ตัว
export const CHARGE_HEAL = {
  holdMs: 200,
  damage: 150,
  speed: 600,
  durationMs: 300,
  healPercent: 10,
  totalMs: 620
};

// ไม้ตาย B — ฟาดพื้น คลื่นกระแทกรอบตัว + บัฟ
// หมายเหตุ: ยังไม่มีระบบผลักศัตรู (CombatTarget ไม่มีช่องผลัก) จึงมีเฉพาะดาเมจ + บัฟ
export const ULT_SLAM = {
  windupMs: 500,
  recoverMs: 450,
  radius: 150,
  damage: 200,
  buffMs: 6000,
  speedMult: 1.3,
  damageMult: 1.3
};

// ไม้ตาย C — ดาบ 7 เล่ม หายตัว ฟันเป็นดาว 7 แฉก
// ข้อสันนิษฐานชั่วคราว (ข้อ 12.5): อมตะเต็มที่ตอนหายตัว · ปรากฏตัวที่จุดเดิมกลางดาว
export const ULT_STAR = {
  windupMs: 500,
  vanishMs: 800,
  starDelayMs: 300,   // นับจากเริ่มหายตัว ถึงรอยดาวปรากฏ
  recoverMs: 450,
  radius: 180,
  damage: 250,
  points: 7
};

/** บรรทัดรายละเอียดตอนชี้ดูสกิล (อ่านจากตัวเลขจริงด้านบน — ตัวเลขเปลี่ยนแล้วข้อความตามเอง) */
export function skillDetail(id: SkillId): string[] {
  const sec = (ms: number) => `${Math.round(ms / 100) / 10} วิ`;
  switch (id) {
    case 'akkhani_passive_a':
      return ['ใช้งาน: ไม่ต้องกดอะไร ทำงานเองหลังถูกโจมตี',
        `ตัวเลข: โล่กัน 1 ฮิต · คูลดาวน์ ${sec(AKKHANI.passive.shieldCooldownMs)}`];
    case 'akkhani_passive_b':
      return [`ใช้งาน: ตีโดนครบ ${AKK_PASSIVE_CRIT.hitsNeeded} ครั้ง (นับต่อการโจมตี 1 ครั้ง) ครั้งถัดไปติดคริ`,
        `ตัวเลข: คริติคอลดาเมจ ×${AKK_PASSIVE_CRIT.multiplier} · มีประกายรอบตัวบอกจำนวนที่สะสม`];
    case 'akkhani_passive_c':
      return [`ใช้งาน: รอพลังสะสมเต็ม ${sec(AKK_PASSIVE_RUSH.chargeMs)} แล้วกดตีปกติ — รัวอยู่กับที่`,
        `ตัวเลข: ${AKK_PASSIVE_RUSH.hits.length} ฮิต รวม ${AKK_PASSIVE_RUSH.hits.reduce((a, b) => a + b, 0)} ดาเมจ · ระยะ ${AKK_PASSIVE_RUSH.range}`];
    case 'akkhani_combo_a':
      return ['ใช้งาน: ตีปกติติดกัน 3 ครั้ง ฮิตที่ 3 หมุนฟันโดนทุกทิศ',
        `ตัวเลข: ดาเมจ ${COMBO3_SPIN.damage} · ระยะ ${COMBO3_SPIN.range} · รอบตัว`];
    case 'akkhani_combo_b':
      return ['ใช้งาน: ตีปกติติดกัน 3 ครั้ง ฮิตที่ 3 ปล่อยคลื่นดาบไปข้างหน้า ทะลุศัตรู',
        `ตัวเลข: ดาเมจ ${COMBO3_WAVE.damage} · ไกล ${COMBO3_WAVE.range} · ทะลุได้`];
    case 'akkhani_combo_c':
      return ['ใช้งาน: ตีปกติติดกัน 3 ครั้ง ฮิตที่ 3 พุ่งฟัน 3 จุดยอดในครั้งเดียว',
        `ตัวเลข: ${COMBO3_TRIANGLE.damages.join(' + ')} ดาเมจ · อมตะระหว่างท่า`];
    case 'akkhani_charge_a':
      return ['ใช้งาน: กดค้างแล้วปล่อย ฟันกวาดหนึ่งรอบแล้วพุ่งดาบ',
        `ตัวเลข: ค้าง ${sec(AKKHANI.charged.holdMs)} · ฟัน ${AKKHANI.charged.sweepDamage} + พุ่ง ${AKKHANI.charged.thrustDamage}`];
    case 'akkhani_charge_b':
      return ['ใช้งาน: กดค้างสั้นมากแล้วปล่อย พุ่งทันที และกระตุ้นพาสซีฟที่ใส่ไว้',
        'ผล: พาสซีฟโล่ = ได้โล่ · คริ = พุ่งครั้งนี้ติดคริ · สะสมพลัง = พลังเต็มทันที',
        `ตัวเลข: ค้าง ${sec(CHARGE_RUSH.holdMs)} · ดาเมจ ${CHARGE_RUSH.damage}`];
    case 'akkhani_charge_c':
      return ['ใช้งาน: กดค้างสั้นมากแล้วปล่อย พุ่งฟัน ถ้าโดนได้เลือดคืน ถ้าพลาดไม่ได้อะไร',
        `ตัวเลข: ค้าง ${sec(CHARGE_HEAL.holdMs)} · ดาเมจ ${CHARGE_HEAL.damage} · ฟื้น ${CHARGE_HEAL.healPercent}% ของเลือดสูงสุด (ครั้งเดียว)`];
    case 'akkhani_ultimate_a':
      return [`ใช้งาน: กดปุ่มสกิล อมตะ ${sec(AKKHANI.skill.windupMs)} แล้วฟันกวาดกว้าง ฟื้นเลือดเมื่อโดน`,
        `ตัวเลข: ดาเมจ ${AKKHANI.skill.damage} · ระยะ ${AKKHANI.skill.range} · คูลดาวน์ ${sec(ULTIMATE_COOLDOWN_MS.akkhani)}`];
    case 'akkhani_ultimate_b':
      return [`ใช้งาน: กดปุ่มสกิล ยกดาบแล้วฟาดพื้น คลื่นกระแทกรอบตัว แล้วเข้าโหมดบุก ${sec(ULT_SLAM.buffMs)}`,
        `ตัวเลข: ดาเมจ ${ULT_SLAM.damage} · รัศมี ${ULT_SLAM.radius} · บัฟเร็ว +${Math.round((ULT_SLAM.speedMult - 1) * 100)}% ดาเมจ +${Math.round((ULT_SLAM.damageMult - 1) * 100)}% และโล่ 1 ฮิต`,
        'หมายเหตุ: ยังไม่มีผลผลักศัตรู'];
    case 'akkhani_ultimate_c':
      return [`ใช้งาน: กดปุ่มสกิล ปลดดาบ 7 เล่ม หายตัว ${sec(ULT_STAR.vanishMs)} แล้วโผล่กลางรอยดาว 7 แฉก`,
        `ตัวเลข: ดาเมจ ${ULT_STAR.damage} · รัศมีดาว ${ULT_STAR.radius} · อมตะตอนหายตัว`];
    default: {
      const d = findSkill(id);
      return d ? [d.desc, 'ยังไม่มีท่านี้ในเกม — เลือกใช้ไม่ได้'] : [];
    }
  }
}

// คูลดาวน์ช่องไม้ตาย (วินาทีเป็น ms) — ย้ายมาจาก characters.ts เพื่อให้ตัวเลขสกิลอยู่กองเดียวกัน
// ค่าเท่าของเดิมทุกประการ ยังไม่ได้จูนใหม่
export const ULTIMATE_COOLDOWN_MS: Record<CharacterId, number> = {
  akkhani: 16000,
  luma: 4500
};

/** คูลดาวน์ไม้ตายของตัวละคร — ไม่รู้จักตัวละครใหม่ = ใช้ค่ากลาง 12 วินาที (เกมไม่พัง) */
export function ultimateCooldownOf(char: CharacterId): number {
  return ULTIMATE_COOLDOWN_MS[char] ?? 12000;
}