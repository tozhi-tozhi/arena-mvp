// ชุดที่ผู้เล่นเลือกไว้ (ตัวละคร / เครื่องราง / สัตว์เลี้ยง) — จำข้ามฉาก และเซฟลงเครื่อง
import { CHARACTER_IDS, type CharacterId } from '../data/characters';

class LoadoutStore {
  characterId: CharacterId = 'akkhani';
  charmId: string | null = null; // ไว้ใช้เฟส 2
  petId: string | null = null;   // ไว้ใช้เฟส 2

  export() {
    return { characterId: this.characterId, charmId: this.charmId, petId: this.petId };
  }

  import(saved: any): void {
    if (saved && CHARACTER_IDS.includes(saved.characterId)) {
      this.characterId = saved.characterId;
    }
    this.charmId = typeof saved?.charmId === 'string' ? saved.charmId : null;
    this.petId = typeof saved?.petId === 'string' ? saved.petId : null;
  }

  reset(): void {
    this.characterId = 'akkhani';
    this.charmId = null;
    this.petId = null;
  }
}

export const loadout = new LoadoutStore();