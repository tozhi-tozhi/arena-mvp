// src/characters/registry.ts — ทะเบียนชุดท่าตัวละคร: รหัสตัวละคร → ตัวสร้างชุดท่า
// เพิ่มตัวละครใหม่: เขียนไฟล์ชุดท่า แล้วเพิ่ม 1 บรรทัดในตารางนี้
import type { PlayerActor } from '../actors/PlayerActor';
import type { CharacterId } from '../data/characters';
import type { CharacterKit } from './CharacterKit';
import { AkkhaniKit } from './AkkhaniKit';
import { LumaKit } from './LumaKit';

const KITS: Record<CharacterId, (p: PlayerActor) => CharacterKit> = {
  akkhani: (p) => new AkkhaniKit(p),
  luma: (p) => new LumaKit(p)
};

/** สร้างชุดท่าให้ผู้เล่นหนึ่งคน — ไม่รู้จักรหัสนี้ก็ใช้ชุดแรกในทะเบียน (เกมไม่พัง) */
export function createKit(id: CharacterId, p: PlayerActor): CharacterKit {
  const make = KITS[id] ?? Object.values(KITS)[0];
  return make(p);
}
