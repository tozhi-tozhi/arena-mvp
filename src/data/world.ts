// src/data/world.ts — ตัวเลขของ The World (Phase 3) แก้ที่นี่ที่เดียว
// สเปกเต็มอยู่ใน Master Prompt หัวข้อ 6.1

/** ขนาดแผ่นภูมิประเทศ (px) */
export const TILE_SIZE = 400;

/** ขนาดแอเรียที่สุ่มได้ (จำนวนแผ่น) — 8x6=48 · 10x8=80 · 9x9=81 */
// ขนาดแอเรียที่สุ่มได้ — weight มาก = เจอบ่อย (แมพเล็กเจอบ่อย แมพใหญ่นาน ๆ ครั้ง)
export const AREA_SIZES: { cols: number; rows: number; weight: number }[] = [
  { cols: 5, rows: 4, weight: 3 },   // 20 แผ่น · 2000x1600 (เล็ก)
  { cols: 6, rows: 5, weight: 3 },   // 30 แผ่น · 2400x2000
  { cols: 7, rows: 6, weight: 2 },   // 42 แผ่น · 2800x2400
  { cols: 9, rows: 7, weight: 1 }    // 63 แผ่น · 3600x2800 (ใหญ่)
];

/** สุ่มขนาดตามน้ำหนัก */
export function pickAreaSize(rng: () => number): { cols: number; rows: number } {
  const total = AREA_SIZES.reduce((s, a) => s + a.weight, 0);
  let roll = rng() * total;
  for (const a of AREA_SIZES) {
    roll -= a.weight;
    if (roll < 0) return { cols: a.cols, rows: a.rows };
  }
  const last = AREA_SIZES[AREA_SIZES.length - 1];
  return { cols: last.cols, rows: last.rows };
}

/** ตัวคูณระยะการวางของ — แมพเล็กต้องผ่อนระยะ ไม่งั้นวางบอส/เสาไม่ลง (0.55-1) */
export function placementScale(width: number, height: number): number {
  const k = Math.min(width / 3200, height / 2400);
  return Math.max(0.55, Math.min(1, k));
}

export type TileKind = 'dirt' | 'moss' | 'gravel' | 'sand' | 'brush';

/** แม่แบบแผ่น: สีพื้น + น้ำหนักสุ่ม + จำนวนของตกแต่งต่อแผ่น */
export const TILE_KINDS: Record<TileKind, { base: number; weight: number; props: [number, number] }> = {
  dirt: { base: 0x6f5c40, weight: 3, props: [1, 3] },
  moss: { base: 0x5b6740, weight: 3, props: [2, 4] },
  gravel: { base: 0x706a5a, weight: 2, props: [2, 4] },
  sand: { base: 0x8f7d55, weight: 2, props: [0, 2] },
  brush: { base: 0x525c38, weight: 2, props: [3, 6] }
};
export const TILE_KIND_IDS = Object.keys(TILE_KINDS) as TileKind[];

/** โอกาสที่แผ่นจะซ้ำชนิดกับแผ่นข้างเคียง (ให้เป็นผืนเดียวกัน ไม่กระจายเป็นกระดานหมากรุก) */
export const TILE_CLUSTER_CHANCE = 0.45;

/** ระยะจากขอบแอเรีย (px) */
export const SPAWN_INSET = 260;
export const GATE_INSET = 110;
/** ระยะห่างของตกแต่งจากจุดเกิด/ประตู และรัศมี Negative Space กลางแอเรีย */
export const PROP_CLEAR_RADIUS = 170;
export const CENTER_CLEAR_RADIUS = 380;
/** ระยะที่กด E ที่ประตูได้ (px) */
export const GATE_INTERACT_RANGE = 70;

// ---------- ของตกพื้นในแอเรีย (Phase 3C) ----------
/** จำนวนจุดของตกพื้นต่อแอเรีย (สเปก: 2–4 จุด) */
export const GROUND_LOOT_SPOTS: [number, number] = [2, 4];
/** ไอเทมต่อ 1 จุด — ตั้งใจให้ 2 ชิ้น เพื่อให้ถุงเต็มภายใน 2–3 แอเรีย (ปรับได้) */
export const GROUND_LOOT_PER_SPOT = 2;
/** จุดของตกพื้นต้องห่างจุดเกิดอย่างน้อย (px) เพื่อให้ต้องเดินสำรวจ */
export const LOOT_MIN_FROM_SPAWN = 700;
export const LOOT_MIN_BETWEEN = 600;

// ---------- ถุงพกพา: ตอนตาย ----------
/** สัดส่วนของในถุงที่เสียตอนตาย (ปัดขึ้น — เหลือ 1 ชิ้นก็เสีย) ที่เหลือโอนเข้ากระเป๋าถาวร */
export const DEATH_LOSS_RATIO = 0.5;