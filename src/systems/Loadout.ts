// ชุดที่ผู้เล่นเลือกไว้ (ตัวละคร / เครื่องราง / สัตว์เลี้ยง / บอสที่จะสู้) — จำข้ามฉาก และเซฟลงเครื่อง
import { CHARACTER_IDS, type CharacterId } from '../data/characters';
import { CHARM_IDS, type CharmId } from '../data/charms';
import { PET_IDS, type PetId } from '../data/pets';
import { BOSS_IDS, type BossChoice } from '../data/bosses';

class LoadoutStore {
  characterId: CharacterId = 'akkhani';
  charmId: CharmId | null = null;
  petId: PetId | null = null;
  bossChoice: BossChoice = 'random';

  export() {
    return {
      characterId: this.characterId,
      charmId: this.charmId,
      petId: this.petId,
      bossChoice: this.bossChoice
    };
  }

  import(saved: any): void {
    if (saved && CHARACTER_IDS.includes(saved.characterId)) {
      this.characterId = saved.characterId;
    }
    this.charmId = saved && CHARM_IDS.includes(saved.charmId) ? saved.charmId : null;
    this.petId = saved && PET_IDS.includes(saved.petId) ? saved.petId : null;
    this.bossChoice =
      saved && (saved.bossChoice === 'random' || BOSS_IDS.includes(saved.bossChoice))
        ? saved.bossChoice
        : 'random';
  }

  reset(): void {
    this.characterId = 'akkhani';
    this.charmId = null;
    this.petId = null;
    this.bossChoice = 'random';
  }
}

export const loadout = new LoadoutStore();