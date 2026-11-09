// ชุดที่ผู้เล่นเลือกไว้ (ตัวละคร / เครื่องราง / สัตว์เลี้ยง) — จำข้ามฉาก และเซฟลงเครื่อง
import { CHARACTER_IDS, type CharacterId } from '../data/characters';
import { CHARM_IDS, type CharmId } from '../data/charms';
import { PET_IDS, type PetId } from '../data/pets';

class LoadoutStore {
  characterId: CharacterId = 'akkhani';
  charmId: CharmId | null = null;
  petId: PetId | null = null;

  export() {
    return { characterId: this.characterId, charmId: this.charmId, petId: this.petId };
  }

  import(saved: any): void {
    if (saved && CHARACTER_IDS.includes(saved.characterId)) {
      this.characterId = saved.characterId;
    }
    this.charmId = saved && CHARM_IDS.includes(saved.charmId) ? saved.charmId : null;
    this.petId = saved && PET_IDS.includes(saved.petId) ? saved.petId : null;
  }

  reset(): void {
    this.characterId = 'akkhani';
    this.charmId = null;
    this.petId = null;
  }
}

export const loadout = new LoadoutStore();