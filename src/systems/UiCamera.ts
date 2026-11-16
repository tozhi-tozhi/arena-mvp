// src/systems/UiCamera.ts — กล้องแยกสำหรับ UI (Phase 3B)
// ปัญหา: setScrollFactor(0) กันการเลื่อน แต่ไม่กันการซูม — พอ 3F ซูมกล้องตอนสู้บอส HUD จะโตตาม
// ทางแก้: กล้องโลกวาดเฉพาะของในโลก กล้อง UI วาดเฉพาะของที่ scrollFactor = 0 (HUD, vignette, หน้าจอจบ)
// ตัวแยกทำเองอัตโนมัติทุกเฟรม — ฉากไม่ต้องจำว่าอะไรเป็น UI
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

export class UiCamera {
  readonly cam: Phaser.Cameras.Scene2D.Camera;
  private scene: Phaser.Scene;
  private seen = new WeakSet<object>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.cam = scene.cameras.add(0, 0, GAME_WIDTH, GAME_HEIGHT, false, 'ui');
    // จัดประเภทหลังอัปเดตทุกเฟรม (ของที่เพิ่งสร้างจะถูกแยกก่อนวาดเฟรมถัดไป)
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.classify, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.classify, this);
    });
    this.classify();
  }

  private classify() {
    const main = this.scene.cameras.main;
    for (const go of this.scene.children.list as any[]) {
      if (this.seen.has(go)) continue;
      this.seen.add(go);
      if (typeof go.scrollFactorX !== 'number') continue;
      const isUi = go.scrollFactorX === 0 && go.scrollFactorY === 0;
      if (isUi) main.ignore(go);
      else this.cam.ignore(go);
    }
  }
}
