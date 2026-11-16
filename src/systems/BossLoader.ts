import Phaser from 'phaser';
import { loadMagmusFrames } from './magmusFrames';
import { ensureBossTextures } from './bossTextures';

export function loadBossAssets(scene: Phaser.Scene) {
  // 1. โหลดภาพพื้นฐาน (Fallback)
  scene.load.image('boss_phasama', 'assets/boss_phasama.png');
  scene.load.image('boss_phasama_ball', 'assets/boss_phasama_ball.png');
  scene.load.image('boss_maya', 'assets/boss_maya.png');
  
  // 2. โหลดภาพอนิเมชันของบอสแต่ละตัว
  loadMagmusFrames(scene);
  
  // 🚀 อนาคตเพิ่มบอสใหม่: 
  // loadDragonFrames(scene);
  // scene.load.image('boss_new', 'assets/boss_new.png');
}

export function initBossTextures(scene: Phaser.Scene) {
  // สร้าง Texture แบบ Procedural (ถ้าจำเป็น)
  ensureBossTextures(scene);
}