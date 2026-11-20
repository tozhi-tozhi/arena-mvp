// src/characters/CharacterKit.ts — สัญญาของ "ชุดท่าตัวละคร"
// PlayerActor ดูแลของกลาง: เดิน / เล็ง / เลือด / รับดาเมจ / HUD / ภาพ / ตัวนับคอมโบ
// ส่วนท่าตี ท่าชาร์จ ไม้ตาย และพาสซีฟของแต่ละตัวอยู่ในชุดท่าของตัวนั้น
//
// เพิ่มตัวละครใหม่ = ① เพิ่มข้อมูลใน data/characters.ts · data/skills.ts · data/characterArt.ts
//                    ② เขียนคลาสชุดท่าใหม่ 1 ไฟล์ในโฟลเดอร์นี้ (implements CharacterKit)
//                    ③ ลงทะเบียน 1 บรรทัดใน registry.ts
// ไม่ต้องแตะ PlayerActor.ts
export interface CharacterKit {
  /** ตัวคูณความเร็วเดินจากสถานะของตัวละคร (เช่น บัฟ) — ไม่มีให้คืน 1 */
  speedMult(now: number): number;
  /** ทุกเฟรมที่ผู้เล่นยังมีชีวิต: สะสมพลัง / ขยับกระสุน / วาดภาพบอกสถานะ */
  update(now: number, delta: number): void;
  /** ต้องกดค้างปุ่มตีกี่ ms ถึงนับเป็นท่าชาร์จ */
  chargeNeeded(): number;
  /** ก่อนนับคอมโบ: ถ้าชุดท่าจัดการตีปกติครั้งนี้เองแล้ว (เช่น รัวพิเศษ) คืน true */
  lightOverride(): boolean;
  /** ตีปกติ (ฮิต 1–2 ของคอมโบ) */
  light(): void;
  /** ฮิต 3 ของคอมโบ — เลือกท่าตามสกิลช่องคอมโบที่ใส่ไว้ */
  comboFinisher(): void;
  /** ท่าชาร์จ (ปล่อยปุ่มหลังกดค้างพอ) */
  charged(): void;
  /** ไม้ตาย (ปุ่มสกิล) — ท่าตั้งคูลดาวน์เอง */
  ultimate(): void;
  /** แก้ดาเมจขาออกก่อนลงเป้า (คริติคอล / บัฟ) */
  modifyDamage(damage: number, actionId: number): number;
  /** ตีโดนจริง 1 ครั้งต่อแอ็กชัน — ไว้นับพาสซีฟ */
  onHitLanded(actionId: number): void;
  /** ผู้เล่นรับดาเมจแต่ยังไม่ตาย — ไว้ให้พาสซีฟทำงาน */
  onHurt(): void;
  /** อัปเดตข้อความ HUD ของพาสซีฟ/สถานะ */
  updateHud(now: number): void;
  /** จบการเผชิญหน้า — เก็บของที่ลอยค้าง */
  reset(): void;
  /** ผู้เล่นถูกทำลาย — คืนทรัพยากรทั้งหมด */
  destroy(): void;
}
