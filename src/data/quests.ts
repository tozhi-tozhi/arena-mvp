// src/data/quests.ts — เควสสุ่มประจำแอเรีย (Phase 3E)
// ทุกแมพสุ่ม 1 เควสจากกองนี้ — ทำสำเร็จ = ปลดประตูไปต่อ (หรือฆ่าบอสหมดก็ได้)
// ตัวเลขทั้งหมดอยู่ที่นี่ที่เดียว
export type QuestKind = 'collect' | 'hunt' | 'explore' | 'seal';

export interface QuestDef {
  kind: QuestKind;
  title: string;
  hint: string;
}

export const QUEST_POOL: QuestDef[] = [
  { kind: 'collect', title: 'เก็บของตกพื้น', hint: 'เศษของมีค่ากระจายอยู่ตามพื้น — ตามกลิ่นกระดาษเก่าไป' },
  { kind: 'hunt',    title: 'ล่าบอส',        hint: 'เงาใหญ่หลับอยู่ในแอเรียนี้ — เข้าไปปลุกแล้วจัดการมัน' },
  { kind: 'explore', title: 'สำรวจจุดต้องสงสัย', hint: 'มีร่องรอยประหลาดหลายจุดในแอเรีย — เดินตามเศษกระดาษให้ครบทุกจุด' },
  { kind: 'seal',    title: 'แกะกล่องผนึก',  hint: 'กล่องปิดตายซ่อนอยู่สักแห่ง — แสงอำพันจะวาบให้เห็นเมื่อเข้าใกล้' }
];

// ---------- เควสเก็บของ ----------
export const COLLECT_NEED = 4; // ชิ้นที่ต้องเก็บ (ต่ำกว่าถุงเริ่มต้น 12 เสมอ)

// ---------- เควสสำรวจ: ต้องเหยียบครบทุกจุด ----------
export const EXPLORE_POINTS: [number, number] = [2, 3]; // สุ่มจำนวนจุดต่อแมพ
export const EXPLORE_RADIUS = 90;          // เดินเข้าใกล้แค่ไหนถือว่าพบจุด
export const EXPLORE_MIN_BETWEEN = 700;    // จุดสำรวจห่างกันเอง — ต้องเดินจริง ไม่ใช่หมุน圈เดียว

// ---------- ร่องรอยนำทาง (hint ภาคสนาม) ----------
export const TRAIL = {
  crumbCount: 10,      // โปรยถี่ขึ้น — ร่องรอยอ่านออกชัดว่า "เป็นทาง" ไม่ใช่เศษมั่ว
  crumbStartDist: 520, // เริ่มไกลจากเป้าขึ้น = ชี้ทางยาวขึ้น
  crumbGap: 46,
  size: 6
};

// ---------- แสงวาบเตือนเป้า (เห็นเมื่อใกล้พอ — ไม่ใช่ลูกศร) ----------
export const GLINT = {
  range: 900,     // วาบให้เห็นตั้งแต่ไกลขึ้น
  everyMs: 1600,  // ถี่ขึ้น — สังเกตง่ายแม้เดินผ่านเร็ว
  color: 0xffd166
};

// ---------- กล่องผนึก + มินิเกมแถบจังหวะ ----------
export const SEAL = {
  attempts: 3,
  sweepMs: 1100,
  zoneWidth: 0.16,
  zoneShrink: 0.75,
  rewardCount: 2,
  rewardMinOrder: 2,
  pityCount: 1,
  trapDamage: 100
};