// src/systems/trainingState.ts — สถานะห้องฝึกที่ต้องอยู่รอดข้ามการเปลี่ยนฉาก
// (ไปเปิด Loadout แล้วกลับ / ตายแล้วเริ่มห้องใหม่) — ไม่เซฟลงเครื่อง รีเฟรชหน้าแล้วหาย

export interface TrainingRun {
  dps: number;
  total: number;
  hits: number;
  maxHit: number;
  label: string;
}

export const trainingState = {
  /** ฉากที่ LoadoutScene ต้องกลับไปเมื่อกดออก — ค่าว่าง = กลับฐานตามปกติ */
  loadoutReturn: '' as string,
  /** ตำแหน่งผู้เล่นที่ต้องไปยืนตอนเริ่มห้องใหม่ (อ่านแล้วล้างทันที) */
  pos: null as { x: number; y: number } | null,
  /** ผลทดสอบจับเวลา 30 วินาที (ใหม่สุดอยู่หน้า) เก็บไว้เทียบชุดสกิล */
  runs: [] as TrainingRun[],
  /** สวิตช์เครื่องมือ — จำไว้ข้ามการเริ่มห้องใหม่ */
  hitbox: false,
  ruler: false,
  collide: true,
  patrol: false
};