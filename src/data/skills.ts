// src/data/skills.ts — ตารางสกิล 4 ช่อง × 3 ตัวเลือก ต่อตัวละคร (รวม 24 สกิล)
// ที่มาการออกแบบ: docs/design/char/char_akkhani.md และ docs/design/char/char_luma.md
// playable = เลือกแล้วเล่นได้จริงในโค้ดตอนนี้ · ที่เหลือคือแบบที่ออกแบบแล้วแต่ยังไม่มีท่าในเกม
// ตัวเลขทุกค่าเป็นค่าชั่วคราวสำหรับต้นแบบ ปรับหลังเล่นจริง ยังไม่ใช่ค่าสมดุลสุดท้าย
import type { CharacterId } from './characters';

export type SkillSlot = 'passive' | 'combo' | 'charge' | 'ultimate';
export type SkillOption = 'a' | 'b' | 'c';
export type SkillId = string;

export const SKILL_SLOTS: SkillSlot[] = ['passive', 'combo', 'charge', 'ultimate'];

export interface SkillDef {
  id: SkillId;
  char: CharacterId;
  slot: SkillSlot;
  option: SkillOption;
  name: string;
  desc: string;
  playable: boolean;
}

/** ชื่อสกิลหนึ่งตัว = ตัวละคร_ช่อง_ตัวเลือก */
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
  def('akkhani', 'passive', 'a', 'โล่กันหนึ่งฮิต', 'โดนโจมตีแล้วได้โล่กัน 1 ฮิต มีคูลดาวน์'),
  def('akkhani', 'passive', 'b', 'ครบสี่ติดคริ', 'โจมตีโดนครบ 4 ครั้ง ฮิตถัดไปเป็นคริติคอล'),
  def('akkhani', 'passive', 'c', 'สะสมพลังรัวห้า', 'สะสมพลังตามเวลา เมื่อเต็ม ตีปกติครั้งถัดไปรัว 5 ฮิต'),
  def('akkhani', 'combo', 'a', 'หมุนฟันรอบตัว', 'ฮิต 3 หมุนฟันโดนทุกทิศรอบตัว', true),
  def('akkhani', 'combo', 'b', 'คลื่นดาบพุ่งหน้า', 'ฮิต 3 ส่งคลื่นดาบไปข้างหน้า ทะลุศัตรู'),
  def('akkhani', 'combo', 'c', 'ระบำดาบสามเหลี่ยม', 'ฮิต 3 พุ่งสลับ 3 จุดยอด ฟัน 3 ครั้งในแอ็กชันเดียว'),
  def('akkhani', 'charge', 'a', 'หมุนแล้วพุ่ง', 'ค้างแล้วปล่อย ฟันกวาดหนึ่งรอบแล้วพุ่งดาบ'),
  def('akkhani', 'charge', 'b', 'พุ่งทันทีกระตุ้นพาสซีฟ', 'ชาร์จสั้น พุ่งทันทีและกระตุ้นพาสซีฟที่ใส่ไว้'),
  def('akkhani', 'charge', 'c', 'พุ่งฟื้นเลือด', 'พุ่งฟัน ถ้าโดนได้เลือดคืน ถ้าพลาดไม่ได้อะไร'),
  def('akkhani', 'ultimate', 'a', 'อมตะฟันกวาด', 'อมตะช่วงเตรียม แล้วฟันกวาดกว้าง ฟื้นเลือดเมื่อโดน'),
  def('akkhani', 'ultimate', 'b', 'ฟาดพื้นคลื่นกระแทก', 'ฟาดพื้นเกิดคลื่นรอบตัว พร้อมบัฟความเร็วและดาเมจชั่วคราว'),
  def('akkhani', 'ultimate', 'c', 'ดาบเจ็ดเล่มดาวเจ็ดแฉก', 'ปลดดาบ 7 เล่ม หายตัว แล้วฟันเป็นดาว 7 แฉกพร้อมกัน'),

  // ---------- ลูมิ ----------
  // หมายเหตุ: พาสซีฟตัวเลือก A ตอนนี้รีเซ็ตคูลดาวน์สกิลเดิม (แดช)
  // เมื่อทำช่องไม้ตายเสร็จ จะย้ายไปลดคูลดาวน์ไม้ตายตามที่ออกแบบไว้
  def('luma', 'passive', 'a', 'จังหวะภูต', 'โจมตีโดนครบ 8 ครั้ง รีเซ็ตคูลดาวน์สกิลทันที'),
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

/** ชุดเริ่มต้น = ตัวเลือก A ทุกช่อง (มีให้ตั้งแต่เริ่มเล่น) */
export function defaultSkills(char: CharacterId): Record<SkillSlot, SkillId> {
  return {
    passive: skillId(char, 'passive', 'a'),
    combo: skillId(char, 'combo', 'a'),
    charge: skillId(char, 'charge', 'a'),
    ultimate: skillId(char, 'ultimate', 'a')
  };
}

// ---------- ค่าชั่วคราวของท่าที่เล่นได้ตอนนี้ ----------
// อัคนี ฮิต 3 หมุนฟันรอบตัว — halfAngle 180 = โดนทุกทิศ (โค้ดตรวจกรวยเดิมรองรับได้เลย)
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