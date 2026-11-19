// src/systems/PlayerProfile.ts — ข้อมูล "ต่อผู้เล่นหนึ่งคน" (Phase 5A)
// ของที่ผูกกับผู้เล่นย้ายมาอยู่ที่นี่: ตัวละครที่เลือก · สกิลที่ใส่ 4 ช่อง · เครื่องราง · สัตว์เลี้ยง · บอสที่จะสู้
// เครื่องผู้เล่นคนเดียวมีผู้เล่นท้องถิ่น 1 คน · ตอนเล่นร่วมเพิ่มผู้เล่นอื่นในเล่มเดียวกันได้โดยไม่ต้องรื้อใหม่
// กฎ: ห้ามสร้างค่ากลางใหม่ผูกผู้เล่นคนเดียว — ของใหม่ให้เป็นฟิลด์ของคลาสนี้
// หมายเหตุ: สกิลที่ปลดล็อกแล้วกับระดับสกิล จะเพิ่มตอนทำระบบสกิลบุค (ตอนนี้ยังไม่ต้องมี)
import { CHARACTER_IDS, type CharacterId } from '../data/characters';
import { CHARM_IDS, type CharmId } from '../data/charms';
import { PET_IDS, type PetId } from '../data/pets';
import { BOSS_IDS, type BossChoice } from '../data/bosses';
import {
  SKILL_SLOTS, defaultSkills, findSkill, isPlayable,
  type SkillId, type SkillSlot
} from '../data/skills';

export class PlayerProfile {
  readonly id: string;
  characterId: CharacterId = 'akkhani';
  charmId: CharmId | null = null;
  petId: PetId | null = null;
  bossChoice: BossChoice = 'random';
  /** สกิลที่ใส่ไว้ แยกตามตัวละคร — เปลี่ยนตัวละครแล้วชุดที่จัดไว้ไม่หาย */
  skills: Record<CharacterId, Record<SkillSlot, SkillId>>;

  constructor(id: string) {
    this.id = id;
    this.skills = {
      akkhani: defaultSkills('akkhani'),
      luma: defaultSkills('luma')
    };
  }

  skillOf(slot: SkillSlot, char: CharacterId = this.characterId): SkillId {
    return this.skills[char]?.[slot] ?? defaultSkills(char)[slot];
  }

  /** ใส่สกิลลงช่อง — คืน false ถ้าไม่ใช่สกิลของตัวละคร/ช่องนี้ หรือยังไม่มีท่าในเกม */
  setSkill(slot: SkillSlot, id: SkillId): boolean {
    const d = findSkill(id);
    if (!d) return false;
    if (d.char !== this.characterId || d.slot !== slot) return false;
    if (!isPlayable(id)) return false;
    this.skills[this.characterId][slot] = id;
    return true;
  }

  export() {
    return {
      characterId: this.characterId,
      charmId: this.charmId,
      petId: this.petId,
      bossChoice: this.bossChoice,
      skills: this.skills
    };
  }

  /** โหลดเซฟ — เซฟเก่าไม่มีช่องสกิลก็ได้ค่าเริ่มต้น A ครบ ไม่พัง */
  import(raw: any): void {
    if (raw && CHARACTER_IDS.includes(raw.characterId)) this.characterId = raw.characterId;
    this.charmId = raw && CHARM_IDS.includes(raw.charmId) ? raw.charmId : null;
    this.petId = raw && PET_IDS.includes(raw.petId) ? raw.petId : null;
    this.bossChoice =
      raw && (raw.bossChoice === 'random' || BOSS_IDS.includes(raw.bossChoice))
        ? raw.bossChoice
        : 'random';

    this.skills = { akkhani: defaultSkills('akkhani'), luma: defaultSkills('luma') };
    const saved = raw?.skills;
    if (!saved || typeof saved !== 'object') return;
    for (const char of CHARACTER_IDS) {
      for (const slot of SKILL_SLOTS) {
        const id = saved[char]?.[slot];
        const d = findSkill(id);
        if (d && d.char === char && d.slot === slot && isPlayable(id)) {
          this.skills[char][slot] = id;
        }
      }
    }
  }

  reset(): void {
    this.characterId = 'akkhani';
    this.charmId = null;
    this.petId = null;
    this.bossChoice = 'random';
    this.skills = { akkhani: defaultSkills('akkhani'), luma: defaultSkills('luma') };
  }
}

/** เล่มเก็บผู้เล่นทุกคนที่เครื่องนี้รู้จัก — ตอนนี้ใช้คนเดียว ตอนเล่นร่วมเพิ่มช่องได้ */
class ProfileBook {
  private book = new Map<string, PlayerProfile>();
  localId = 'local';

  get(id: string): PlayerProfile {
    let p = this.book.get(id);
    if (!p) {
      p = new PlayerProfile(id);
      this.book.set(id, p);
    }
    return p;
  }

  get local(): PlayerProfile {
    return this.get(this.localId);
  }

  ids(): string[] {
    return Array.from(this.book.keys());
  }
}

export const profiles = new ProfileBook();