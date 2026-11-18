// จุดเริ่มต้นของเกม — แค่ตั้งค่าแล้วสร้างเกม (ตรรกะอยู่ใน scenes/)
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './config';
import { BaseScene } from './scenes/BaseScene';
import { BagScene } from './scenes/BagScene';
import { UpgradeScene } from './scenes/UpgradeScene';
import { LoadoutScene } from './scenes/LoadoutScene';
import { GameScene } from './scenes/GameScene';
import { WorldScene } from './scenes/WorldScene';
import { TouchControlsScene } from './ui/TouchControlsScene';
import { isTouchDevice } from './systems/Controls';

const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#1a1a1a',
  parent: 'app',
  pixelArt: true,
  // มือถือ/แท็บเล็ต: ย่อขยายให้พอดีจอ · เดสก์ท็อป: ขนาดเดิม 800x600 (ไม่เปลี่ยนหน้าตา)
  scale: isTouchDevice()
    ? { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }
    : { mode: Phaser.Scale.NONE },
  input: { keyboard: { target: window } },
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 } as any, debug: false }
  },
  // ลำดับสำคัญ: ตัวแรกใน array = ฉากที่ Phaser สตาร์ทอัตโนมัติ
  // TouchControlsScene อยู่ท้ายสุด = วาดทับทุกฉาก (ปุ่มสัมผัสโผล่เฉพาะโหมด "จอสัมผัส")
  scene: [BaseScene, BagScene, UpgradeScene, LoadoutScene, GameScene, WorldScene, TouchControlsScene]
};

const game = new Phaser.Game(config);
// เปิดฉากปุ่มสัมผัสคู่กับฉากแรก (ทำงานคู่ขนานตลอด ไม่ถูกฉากอื่นปิด)
game.events.once(Phaser.Core.Events.READY, () => {
  game.scene.start('TouchControlsScene');
});
document.addEventListener('contextmenu', (e) => e.preventDefault());
