// จุดเริ่มต้นของเกม — แคนวาสวาดละเอียดตามจอ แต่พื้นที่ตรรกะคงที่ 1200x600
import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H } from './config';
import { BaseScene } from './scenes/BaseScene';
import { BagScene } from './scenes/BagScene';
import { UpgradeScene } from './scenes/UpgradeScene';
import { LoadoutScene } from './scenes/LoadoutScene';
import { SkillScene } from './scenes/SkillScene';
import { GameScene } from './scenes/GameScene';
import { WorldScene } from './scenes/WorldScene';
import { OnlineScene } from './scenes/OnlineScene';
import { TouchControlsScene } from './ui/TouchControlsScene';

const config = {
  type: Phaser.AUTO,
  width: CANVAS_W,
  height: CANVAS_H,
  backgroundColor: '#0a0a0a',
  parent: 'app',
  pixelArt: false,
  // FIT ย่อแคนวาสลงให้พอดีจอเมื่อจอเล็กกว่าความละเอียดวาด (รักษาสัดส่วน 2:1)
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { keyboard: { target: window } },
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 } as any, debug: false }
  },
  // ลำดับสำคัญ: ตัวแรกใน array = ฉากที่ Phaser สตาร์ทอัตโนมัติ
  // TouchControlsScene อยู่ท้ายสุด = วาดทับทุกฉาก (ปุ่มสัมผัสโผล่เฉพาะโหมด "จอสัมผัส")
  scene: [BaseScene, BagScene, UpgradeScene, LoadoutScene, SkillScene, GameScene, WorldScene, OnlineScene, TouchControlsScene]
};

const game = new Phaser.Game(config);
// เปิดฉากปุ่มสัมผัสคู่กับฉากแรก (ทำงานคู่ขนานตลอด ไม่ถูกฉากอื่นปิด)
game.events.once(Phaser.Core.Events.READY, () => {
  game.scene.start('TouchControlsScene');
});
document.addEventListener('contextmenu', (e) => e.preventDefault());