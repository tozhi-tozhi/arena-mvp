// จุดเริ่มต้นของเกม — แค่ตั้งค่าแล้วสร้างเกม (ตรรกะอยู่ใน scenes/)
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './config';
import { BaseScene } from './scenes/BaseScene';
import { GameScene } from './scenes/GameScene';

const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#1a1a1a',
  parent: 'app',
  pixelArt: true,
  input: {
    keyboard: {
      target: window
    }
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 } as any,
      debug: false
    }
  },
  // ลำดับสำคัญ: ตัวแรกใน array = ฉากที่ Phaser สตาร์ทอัตโนมัติ
  scene: [BaseScene, GameScene]
};

new Phaser.Game(config);