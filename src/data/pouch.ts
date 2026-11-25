// src/data/pouch.ts — ตัวเลขความจุถุงพกพา (จุดเดียว)
// แยกจาก Upgrades เพื่อให้ PlayerProfile อ่านความจุได้โดยไม่ต้อง import ระบบอัปเกรด (ตัด dependency วน)
// ราคาอัปเกรดถุงยังอยู่ที่ Upgrades.ts (POUCH_COSTS) ตามเดิม — ตัวเลขสมดุลไม่กระจาย
// Upgrades.ts re-export ค่าคงที่ชุดนี้กลับชื่อเดิม คนที่ import จาก Upgrades จึงไม่ต้องแก้

export const POUCH_BASE_SLOTS = 12;
export const POUCH_SLOTS_PER_LEVEL = 4;
export const POUCH_MAX_LEVEL = 12;

/** จำนวนช่องที่ขั้นใดขั้นหนึ่ง — สูตรเดิมไม่เปลี่ยน */
export function pouchCapacityAt(level: number): number {
  const lv = Math.max(0, Math.min(POUCH_MAX_LEVEL, Math.floor(level)));
  return POUCH_BASE_SLOTS + lv * POUCH_SLOTS_PER_LEVEL;
}

/** กรองค่าขั้นถุงจากเซฟ/ตัวป้อนให้อยู่ในช่วง 0..POUCH_MAX_LEVEL (ค่าพัง = 0) */
export function clampPouchLevel(v: any): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(POUCH_MAX_LEVEL, Math.floor(n)));
}