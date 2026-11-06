import {
  EQUIPMENT,
  EQUIPMENT_SLOTS,
  type EquipmentDef,
  type EquipmentSlot
} from '../data/equipment';

export interface EquipmentUpgradeResult {
  slot: EquipmentSlot;
  equipment: EquipmentDef;
  previousLevel: number;
  newLevel: number;
  effectValue: number;
}

/**
 * Owns the player's three equipped items and their upgrade levels.
 *
 * Round 3 rules:
 * - One fixed item per slot for this first implementation.
 * - Loot randomly upgrades one eligible slot.
 * - Upgrades strengthen the existing effect; they do not branch into new effects.
 * - Maximum level is defined per item.
 */
export class EquipmentSystem {
  private levels: Record<EquipmentSlot, number> = {
    weapon: 1,
    armor: 1,
    helmet: 1
  };

  getEquipment(slot: EquipmentSlot): EquipmentDef {
    return EQUIPMENT[slot];
  }

  getLevel(slot: EquipmentSlot): number {
    return this.levels[slot];
  }

  getEffectValue(slot: EquipmentSlot): number {
    const item = this.getEquipment(slot);
    const level = this.getLevel(slot);

    return item.effect.baseValue
      + (level - 1) * item.effect.upgradePerLevel;
  }

  getEquippedItems(): Array<{
    slot: EquipmentSlot;
    equipment: EquipmentDef;
    level: number;
    effectValue: number;
  }> {
    return EQUIPMENT_SLOTS.map((slot) => ({
      slot,
      equipment: this.getEquipment(slot),
      level: this.getLevel(slot),
      effectValue: this.getEffectValue(slot)
    }));
  }

  /**
   * Randomly upgrades one slot that has not reached its maximum level.
   * Returns null when all three items are already at max level.
   */
  upgradeRandomSlot(random: () => number = Math.random): EquipmentUpgradeResult | null {
    const eligibleSlots = EQUIPMENT_SLOTS.filter(
      (slot) => this.levels[slot] < EQUIPMENT[slot].maxLevel
    );

    if (eligibleSlots.length === 0) return null;

    const randomIndex = Math.min(
      eligibleSlots.length - 1,
      Math.floor(random() * eligibleSlots.length)
    );

    const slot = eligibleSlots[randomIndex];
    const previousLevel = this.levels[slot];
    this.levels[slot] += 1;

    return {
      slot,
      equipment: this.getEquipment(slot),
      previousLevel,
      newLevel: this.levels[slot],
      effectValue: this.getEffectValue(slot)
    };
  }
    // อัปเกรดช่องที่เลือก 1 เลเวล (คืน true ถ้าสำเร็จ)
  upgradeSlot(slot: EquipmentSlot): boolean {
    if (this.levels[slot] >= EQUIPMENT[slot].maxLevel) return false;
    this.levels[slot] += 1;
    return true;
  }

  // สำหรับเซฟ/โหลด
  exportLevels(): Record<EquipmentSlot, number> {
    return { ...this.levels };
  }

  importLevels(saved: Partial<Record<EquipmentSlot, number>>): void {
    for (const slot of EQUIPMENT_SLOTS) {
      const lv = Math.floor(Number(saved[slot]));
      if (lv >= 1) this.levels[slot] = Math.min(lv, EQUIPMENT[slot].maxLevel);
    }
  }
  isMaxLevel(slot: EquipmentSlot): boolean {
    return this.levels[slot] >= EQUIPMENT[slot].maxLevel;
  }

  // อุปกรณ์ของผู้เล่น — ตัวเดียวทั้งเกม (หน้า Base อัปเกรด, GameScene ใช้)
  export const playerEquipment = new EquipmentSystem();
  reset(): void {
    this.levels = {
      weapon: 1,
      armor: 1,
      helmet: 1
    };
  }
}
