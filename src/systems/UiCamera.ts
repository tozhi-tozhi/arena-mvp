// src/systems/UiCamera.ts — กล้องแยกสำหรับ UI
// วัตถุ UI ตั้ง scrollFactor(0) = ไม่รับ scroll ของกล้อง ดังนั้นการชดเชยด้วย scroll ใช้ไม่ได้
// วิธีที่ถูก: ตั้งจุดกำเนิดกล้องเป็น (0,0) แล้วซูมด้วย VIEW_SCALE
// ผลคือ แคนวาส = พิกัดออกแบบ x VIEW_SCALE ตรงตัว → HUD วางที่ 0..1200 / 0..600 ได้เหมือนเดิมทุกจอ
import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H, VIEW_SCALE } from '../config';

export class UiCamera {
  readonly cam: Phaser.Cameras.Scene2D.Camera;
  private scene: Phaser.Scene;
  private seen = new WeakSet<object>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.cam = scene.cameras.add(0, 0, CANVAS_W, CANVAS_H, false, 'ui');
    this.applyRig();

    // ย้ำค่าทุกเฟรม — กันการเปลี่ยนขนาดจอหรือกล้องถูกรีเซ็ตแล้วค่าเพี้ยน
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.tick, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.tick, this);
    });
    this.classify();
  }

  /** ตั้งกล้องให้วาดพื้นที่ออกแบบ 1200x600 ลงเต็มแคนวาสจริง */
  private applyRig() {
    const c = this.cam;
    if (c.width !== CANVAS_W || c.height !== CANVAS_H) c.setSize(CANVAS_W, CANVAS_H);
    c.setPosition(0, 0);
    c.setScroll(0, 0);
    c.setZoom(VIEW_SCALE);
    // จุดกำเนิด (0,0) = ขยายจากมุมซ้ายบน ไม่ใช่กลางจอ
    c.originX = 0;
    c.originY = 0;
  }

  private tick() {
    this.applyRig();
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