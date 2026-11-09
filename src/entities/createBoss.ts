// โรงงานสร้างบอสตาม id
import Phaser from 'phaser';
import { BossBase, type BossHooks } from './BossBase';
import { PhasamaBoss } from './PhasamaBoss';
import { MayaBoss } from './MayaBoss';
import type { BossId } from '../data/bosses';

export type Boss = BossBase;

export function createBoss(scene: Phaser.Scene, id: BossId, x: number, y: number, hooks: BossHooks): Boss {
  if (id === 'maya') return new MayaBoss(scene, x, y, hooks);
  return new PhasamaBoss(scene, x, y, hooks);
}