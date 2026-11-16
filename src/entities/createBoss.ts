import Phaser from 'phaser';
import { BossBase, type BossHooks } from './BossBase';
import { PhasamaBoss } from './PhasamaBoss';
import { MayaBoss } from './MayaBoss';
import type { BossId } from '../data/bosses';

export type Boss = BossBase;

// Registry ของบอสทั้งหมด
const BOSS_REGISTRY: Record<string, new (scene: Phaser.Scene, x: number, y: number, hooks: BossHooks) => BossBase> = {
  phasama: PhasamaBoss,
  maya: MayaBoss,
  // 🚀 อนาคตเพิ่มบอสใหม่: 
  // dragon: DragonBoss,
};

export function createBoss(scene: Phaser.Scene, id: BossId, x: number, y: number, hooks: BossHooks): Boss {
  const BossClass = BOSS_REGISTRY[id];
  if (!BossClass) {
    console.warn(`[createBoss] ไม่รู้จักบอส id: ${id} — ใช้ Phasama แทน`);
    return new PhasamaBoss(scene, x, y, hooks);
  }
  return new BossClass(scene, x, y, hooks);
}