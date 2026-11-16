// src/systems/AreaTransition.ts
// จัดการ fade เปลี่ยนแอเรีย — ใช้ time/tween ของ Scene โดยตรง
// ⚠️ เรียก cleanup() ก่อน restart เสมอ เพื่อกัน timer/tween ค้างยิงใส่ object ที่ destroy แล้ว

import Phaser from 'phaser';

const FADE_DURATION = 350;
const HOLD_DURATION = 400;

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

    const camW = scene.scale.width;
    const camH = scene.scale.height;
    const label = scene.add
      .text(camW / 2, camH / 2, `เข้าสู่พื้นที่ถัดไป...\n(${nextAreaIndex})`, {
        fontFamily: '"Noto Sans Thai", sans-serif',
        fontSize: '32px',
        color: '#f4e4c1',
        align: 'center',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(10_000);

    cam.fadeIn(FADE_DURATION, 0, 0, 0);

    // ⚠️ ใช้ timer ของ scene — จะตายไปพร้อมกับ scene.restart() ถ้า restart เกิดก่อน
    // แต่เราตั้งใจให้ restart เกิดหลัง HOLD_DURATION ผ่านไปแล้วเท่านั้น
    scene.time.delayedCall(HOLD_DURATION, () => {
      if (label.active) label.destroy();
      restart();
    });
  });
}