// src/systems/Loadout.ts — เปลือกเรียกข้อมูลผู้เล่นท้องถิ่น (Phase 5A)
// ของจริงอยู่ที่ PlayerProfile แล้ว — ไฟล์นี้คงชื่อเดิมไว้ให้ฉากเดิมทำงานต่อได้โดยไม่ต้องแก้
// ห้ามใส่ข้อมูลผู้เล่นใหม่ในไฟล์นี้ ให้ไปเพิ่มเป็นฟิลด์ใน PlayerProfile
import { profiles } from './PlayerProfile';
import type { CharacterId } from '../data/characters';
import type { CharmId } from '../data/charms';
import type { PetId } from '../data/pets';
import type { BossChoice } from '../data/bosses';
import type { SkillId, SkillSlot } from '../data/skills';

class LoadoutStore {
  private get p() {
    return profiles.local;
  }

  get characterId(): CharacterId { return this.p.characterId; }
  set characterId(v: CharacterId) { this.p.characterId = v; }

  get charmId(): CharmId | null { return this.p.charmId; }
  set charmId(v: CharmId | null) { this.p.charmId = v; }

  get petId(): PetId | null { return this.p.petId; }
  set petId(v: PetId | null) { this.p.petId = v; }

  get bossChoice(): BossChoice { return this.p.bossChoice; }
  set bossChoice(v: BossChoice) { this.p.bossChoice = v; }

  /** สกิลที่ใส่ในช่องของตัวละครที่เล่นอยู่ */
  skillOf(slot: SkillSlot): SkillId { return this.p.skillOf(slot); }

  setSkill(slot: SkillSlot, id: SkillId): boolean { return this.p.setSkill(slot, id); }

  export() { return this.p.export(); }
  import(saved: any): void { this.p.import(saved); }
  reset(): void { this.p.reset(); }
}

export const loadout = new LoadoutStore();