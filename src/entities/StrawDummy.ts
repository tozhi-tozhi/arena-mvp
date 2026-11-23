// src/entities/StrawDummy.ts — หุ่นฟางห้องฝึก: ตีไม่ตาย ไม่ตีกลับ รายงานดาเมจที่รับให้ฉาก
// เป้าต่อสู้ผ่าน dummyAsTarget (แบบเดียวกับ minionAsTarget) — PlayerActor/CombatTarget ไม่ต้องแก้
// ภาพวาดเองด้วย Graphics แล้ว bake เป็น texture ครั้งเดียว ไม่พึ่งไฟล์ภาพ
import Phaser from 'phaser';
import { DEPTH } from '../config';
import { burst, showDamage, makeShadow, syncShadow } from '../systems/effects';
import type { CombatTarget } from '../systems/CombatTarget';

export const DUMMY = {
  texKey: 'straw_dummy',
  texW: 80,
  texH: 120,
  /** รัศมีเป้า (ใช้คำนวณกรวยฟัน/พุ่ง) */
  radius: 32,
  patrolSpeed: 90,
  patrolRange: 220
};

function ensureDummyTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(DUMMY.texKey)) return;
  const g = scene.add.graphics();

  // ฐานไม้ + เสา
  g.fillStyle(0x5e4526, 1);
  g.fillRoundedRect(18, 106, 44, 10, 4);
  g.fillStyle(0x7a5a32, 1);
  g.fillRect(35, 60, 10, 50);
  // แขนไม้
  g.fillStyle(0x8a6a3a, 1);
  g.fillRoundedRect(6, 48, 68, 9, 4);
  // ลำตัวฟาง + เส้นฟาง
  g.fillStyle(0xd9b86a, 1);
  g.fillRoundedRect(20, 38, 40, 56, 12);
  g.lineStyle(2, 0xa98a45, 0.9);
  for (let i = 0; i < 4; i++) {
    const x = 27 + i * 9;
    g.beginPath();
    g.moveTo(x, 44);
    g.lineTo(x + 2, 88);
    g.strokePath();
  }
  // เชือกรัดเอว
  g.fillStyle(0xb5473a, 1);
  g.fillRect(20, 62, 40, 6);
  // หัวกระสอบ
  g.fillStyle(0xe8e0c8, 1);
  g.fillCircle(40, 22, 17);
  g.lineStyle(2, 0x6b5a3a, 1);
  g.strokeCircle(40, 22, 17);
  // หน้า: ตากากบาท + ปาก
  g.lineStyle(3, 0x3a2e1a, 1);
  g.beginPath();
  g.moveTo(32, 16);
  g.lineTo(38, 22);
  g.moveTo(38, 16);
  g.lineTo(32, 22);
  g.strokePath();
  g.beginPath();
  g.moveTo(42, 16);
  g.lineTo(48, 22);
  g.moveTo(48, 16);
  g.lineTo(42, 22);
  g.strokePath();
  g.beginPath();
  g.moveTo(33, 29);
  g.lineTo(47, 29);
  g.strokePath();

  g.generateTexture(DUMMY.texKey, DUMMY.texW, DUMMY.texH);
  g.destroy();
}

export class StrawDummy {
  readonly sprite: any;
  private scene: Phaser.Scene;
  private shadow: Phaser.GameObjects.Ellipse;
  private onHit: (damage: number) => void;
  private home: { x: number; y: number };
  private patrolOn: boolean = false;
  private patrolDir: number = 1;

  constructor(scene: Phaser.Scene, x: number, y: number, onHit: (damage: number) => void) {
    this.scene = scene;
    this.onHit = onHit;
    this.home = { x, y };
    ensureDummyTexture(scene);

    this.sprite = scene.physics.add.sprite(x, y, DUMMY.texKey);
    this.sprite.setDepth(DEPTH.ENEMY);
    this.sprite.setCollideWorldBounds(true);
    const d = 48;
    this.sprite.body.setCircle(d / 2, (DUMMY.texW - d) / 2, DUMMY.texH - d - 22);
    this.sprite.body.setImmovable(true);

    this.shadow = makeShadow(scene, 60, 18, DEPTH.ENEMY_SHADOW, 0.3);
    syncShadow(this.shadow, this.sprite);
  }

  update() {
    syncShadow(this.shadow, this.sprite);
    if (!this.patrolOn) return;
    const top = this.home.y - DUMMY.patrolRange;
    const bottom = this.home.y + DUMMY.patrolRange;
    if (this.sprite.y <= top) this.patrolDir = 1;
    else if (this.sprite.y >= bottom) this.patrolDir = -1;
    this.sprite.setVelocityY(DUMMY.patrolSpeed * this.patrolDir);
  }

  /** เดินวนขึ้นลง — ปิดแล้วกลับไปยืนที่เดิม */
  setPatrol(on: boolean) {
    this.patrolOn = on;
    if (!on) {
      this.sprite.setVelocity(0);
      this.sprite.setPosition(this.home.x, this.home.y);
    }
  }

  takeHit(damage: number) {
    this.onHit(damage);
    const s = this.sprite;
    // แฟลชทึบตามกฎ Phaser 4 (setTint + FILL แล้วคืนด้วย clearTint)
    s.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(70, () => {
      if (s.active) s.clearTint();
    });
    showDamage(this.scene, s.x, s.y - s.displayHeight / 2, String(damage), '#ffe066', 450);
    burst(this.scene, s.x, s.y - 10, 0xd9b86a, 4, 34, 3);
    // ส่ายตามแรงตี
    this.scene.tweens.killTweensOf(s);
    s.setAngle(0);
    const dir = Math.random() < 0.5 ? -1 : 1;
    this.scene.tweens.add({
      targets: s,
      angle: 7 * dir,
      duration: 60,
      yoyo: true,
      onComplete: () => {
        if (s.active) s.setAngle(0);
      }
    });
  }

  destroy() {
    this.scene.tweens.killTweensOf(this.sprite);
    if (this.sprite.active) this.sprite.destroy();
    if (this.shadow.active) this.shadow.destroy();
  }
}

/** ห่อหุ่นให้เป็น CombatTarget — ตีไม่ตาย ไม่มีร่างปลอม (kind = minion เพื่อให้เล็งอัตโนมัติบนมือถือเห็น) */
export function dummyAsTarget(d: StrawDummy): CombatTarget {
  return {
    kind: 'minion',
    get x() { return d.sprite.x; },
    get y() { return d.sprite.y; },
    get radius() { return DUMMY.radius; },
    get height() { return d.sprite.displayHeight; },
    isAlive: () => true,
    isHittable: () => true,
    takeHit: (damage) => d.takeHit(damage),
    getDecoys: () => [],
    hitDecoy: () => false
  };
}
