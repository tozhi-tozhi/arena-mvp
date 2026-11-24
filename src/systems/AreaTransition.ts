// src/systems/AreaTransition.ts — フェดเปลี่ยนแอเรีย + แถบโหลด
// ป้ายเป็น UI อยู่ในพื้นที่ออกแบบ 1200x600 — ห้ามใช้ขนาดแคนวาส
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

const FADE_DURATION = 300;
const HOLD_DURATION = 520;

export function transitionToNextArea(
  scene: Phaser.Scene,
  cleanup: () => void,
  restart: () => void,
  nextAreaIndex: number
): void {
  const cam = scene.cameras.main;
  cam.fadeOut(FADE_DURATION, 0, 0, 0);
  cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    cleanup();

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const ui = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      (o as any).setScrollFactor(0);
      (o as any).setDepth(10000);
      return o;
    };

    const scrim = ui(scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0a0a0a, 1).setOrigin(0));
    const label = ui(scene.add.text(cx, cy - 26, 'เข้าสู่พื้นที่ถัดไป', {
      fontFamily: '"Noto Sans Thai", sans-serif',
      fontSize: '30px',
      color: '#f4e4c1',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5));
    const sub = ui(scene.add.text(cx, cy + 8, `แอเรีย ${nextAreaIndex}`, {
      fontFamily: '"Noto Sans Thai", monospace',
      fontSize: '17px',
      color: '#ffd166'
    }).setOrigin(0.5));

    const barW = 260;
    ui(scene.add.rectangle(cx, cy + 48, barW, 6, 0x2a2418, 1));
    const fill = ui(scene.add.rectangle(cx - barW / 2, cy + 48, 2, 6, 0xffd166, 1).setOrigin(0, 0.5));
    scene.tweens.add({ targets: fill, width: barW, duration: HOLD_DURATION, ease: 'Sine.easeOut' });

    cam.fadeIn(FADE_DURATION, 0, 0, 0);

    scene.time.delayedCall(HOLD_DURATION, () => {
      for (const o of [scrim, label, sub, fill]) if (o.active) o.destroy();
      restart();
    });
  });
}