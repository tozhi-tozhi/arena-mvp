// src/data/characterArt.ts — รายการคลิปภาพของแต่ละตัวละคร (ข้อมูลล้วน ไม่มีตรรกะ)
// เพิ่มท่าใหม่ = เพิ่มบรรทัดใน clips ของตัวละครนั้น ที่เดียว ไม่ต้องแตะโค้ดผู้เล่น
// กติกา: ครบทุกเฟรมของคลิป → ใช้คลิปนั้น · ขาดแม้เฟรมเดียว → ถอยไปคลิปสำรอง (เกมไม่พัง)
//        ไม่มีคลิป idle หรือ walk = ยังไม่มีภาพจริง → ใช้ภาพดินน้ำมันชั่วคราว
import { CHARACTER_IDS, type CharacterId } from './characters';

export interface ClipDef {
  /** จำนวนเฟรมที่มีจริงในโฟลเดอร์ */
  frames: number;
  /** วนลูปไหม (ท่ายืน/เดิน = วน · ท่าโจมตี = เล่นครั้งเดียว) */
  loop?: boolean;
  /** มิลลิวินาทีต่อเฟรมตั้งต้น — ท่าโจมตีจะคำนวณจากเวลาท่าจริงทับค่านี้อยู่แล้ว */
  frameMs?: number;
  /** คลิปที่ใช้แทนตอนไฟล์ยังไม่ครบ — ต้องเป็นคลิปที่มีอยู่แล้วเท่านั้น */
  fallback?: string;
  /** true = ยังไม่มีไฟล์ภาพ ข้ามการโหลด (กัน 404 ซ้ำทุกฉาก) — พอมีไฟล์ครบให้ลบธงนี้ออก */
  planned?: boolean;
}

export interface CharacterArt {
  /** โฟลเดอร์ใต้ assets/ */
  folder: string;
  /** นำหน้าชื่อไฟล์และคีย์ภาพ */
  prefix: string;
  /** สเกลพื้นฐานของภาพชุดนี้ (คูณกับ scale ของตัวละครอีกที) */
  scale: number;
  clips: Record<string, ClipDef>;
}

export const CHARACTER_ART: Record<CharacterId, CharacterArt> = {
  akkhani: {
    folder: 'characters/akkhani',
    prefix: 'char_akkhani',
    scale: 0.43,
    clips: {
      idle:   { frames: 1, loop: true, frameMs: 1000 },
      walk:   { frames: 4, loop: true, frameMs: 120 },
      attack: { frames: 5, frameMs: 60 },
      charge: { frames: 7, frameMs: 40 },
      thrust: { frames: 8, frameMs: 30 },
      skill:  { frames: 8, frameMs: 60 },
      knock:  { frames: 8, frameMs: 130 },

      // ---------- ท่าใหม่ตามเอกสารออกแบบ (ยังไม่มีไฟล์ — ใส่ไว้ให้พร้อม) ----------
      // พอผลิตภาพครบตามจำนวนเฟรม: แก้เลข frames ให้ตรง + ลบ planned: true ออก เกมหยิบไปใช้เองทันที
      combo1:         { frames: 5, frameMs: 60, fallback: 'attack', planned: true },
      combo2:         { frames: 5, frameMs: 60, fallback: 'attack', planned: true },
      combo3_spin:    { frames: 6, frameMs: 70, fallback: 'skill', planned: true },
      combo3_wave:    { frames: 6, frameMs: 70, fallback: 'attack', planned: true },
      combo3_triangle:{ frames: 8, frameMs: 60, fallback: 'thrust', planned: true },
      barrage:        { frames: 8, frameMs: 50, fallback: 'attack', planned: true },
      charge_hold:    { frames: 4, loop: true, frameMs: 90, fallback: 'charge', planned: true },
      charge_spin:    { frames: 6, frameMs: 60, fallback: 'skill', planned: true },
      charge_rush:    { frames: 5, frameMs: 50, fallback: 'thrust', planned: true },
      charge_heal:    { frames: 6, frameMs: 60, fallback: 'thrust', planned: true },
      ulti_sweep:     { frames: 8, frameMs: 70, fallback: 'skill', planned: true },
      ulti_slam:      { frames: 8, frameMs: 70, fallback: 'skill', planned: true },
      ulti_star:      { frames: 9, frameMs: 80, fallback: 'skill', planned: true }
    }
  },

  luma: {
    folder: 'characters/luma',
    prefix: 'char_luma',
    scale: 0.68,
    // ยังไม่ผลิตภาพจริง — ปล่อยว่างไว้ ผู้เล่นจะใช้ภาพดินน้ำมันชั่วคราวเหมือนเดิม
    // พอมีภาพ: ใส่ idle/walk/attack ก่อน แล้วค่อยเติมท่าอื่นตามเอกสารของลูมิ
    clips: {}
  }
};

/** คีย์ภาพหนึ่งเฟรม — i นับจาก 1 */
export function clipTextureKey(char: CharacterId, clip: string, i: number): string {
  return `${CHARACTER_ART[char].prefix}_${clip}_${String(i).padStart(2, '0')}`;
}

/** พาธไฟล์หนึ่งเฟรม */
export function clipFilePath(char: CharacterId, clip: string, i: number): string {
  const art = CHARACTER_ART[char];
  return `assets/${art.folder}/${clipTextureKey(char, clip, i)}.png`;
}

/** ตัวละครนี้มีภาพจริงพอเล่นไหม (ต้องมีท่ายืนกับท่าเดินครบ) */
export function hasFrameArt(char: CharacterId): boolean {
  const c = CHARACTER_ART[char].clips;
  return !!c.idle && !!c.walk && c.idle.frames > 0 && c.walk.frames > 0;
}

/** ไม่รู้จักตัวละครนี้ = คืนค่าว่าง เกมตกไปใช้ภาพสำรองเอง */
export function artOf(char: CharacterId): CharacterArt {
  return CHARACTER_ART[char] ?? { folder: '', prefix: 'hero', scale: 0.68, clips: {} };
}

/** รายชื่อตัวละครทั้งหมดที่มีตารางภาพ — ตัวโหลดใช้วนรายการนี้ */
export const ART_CHARACTERS: CharacterId[] = CHARACTER_IDS;