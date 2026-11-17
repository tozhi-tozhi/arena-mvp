// โครงบอสร่วมกัน — บอสแต่ละตัวสืบทอดแล้วเขียนพฤติกรรมของตัวเอง
import Phaser from 'phaser';
import { DEPTH } from '../config';
import { burst, showDamage, ringEffect } from '../systems/effects';

export interface BossHooks {
  getTargets: () => any[];
  onHitTarget: (target: any, damage: number, fromX: number, fromY: number) => void;
  onBurn?: (target: any, deltaMs: number) => void;
  onDeath: (boss: BossBase) => void;
  onPhaseChange?: () => void;
}

export interface BossDef {
  id: string;
  name: string;
  hp: number;
  color: number;
  displayWidth: number;
}

// ร่างลวงที่ตีได้ (มายาใช้) — บอสอื่นคืนค่าว่าง
export interface DecoyRef {
  x: number;
  y: number;
  r: number;
  index: number;
}

export abstract class BossBase {
  readonly def: BossDef;
  readonly sprite: any;
  hp: number;
  protected scene: Phaser.Scene;
  protected hooks: BossHooks;
  protected shadow: any;
  protected gfx: any;
  protected dead: boolean = false;
  protected sleeping: boolean = false;
  protected rage: boolean = false;
  protected rageRatio: number = 0.5;
  protected targetable: boolean = true;
  protected damageMult: number = 1;
  protected groundOffsetY: number = 0;
  protected shadowVisible: boolean = true;

  constructor(scene: Phaser.Scene, def: BossDef, textureKey: string, x: number, y: number, hooks: BossHooks) {
    this.scene = scene;
    // สำเนาตัวเลขเฉพาะตัว — บัฟเลือดใน The World ต้องไม่ย้อนไปแก้ตารางกลาง (ห้องฝึก/บอสตัวถัดไป)
    this.def = { ...def };
    this.hooks = hooks;
    this.hp = this.def.hp;
    this.sprite = scene.physics.add.sprite(x, y, textureKey) as any;
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDepth(DEPTH.ENEMY);
    this.sprite.setScale(this.def.displayWidth / this.sprite.width);
    this.sprite.body.setImmovable(true);
    this.syncBodyShape();
    this.shadow = scene.add
      .ellipse(x, y, this.def.displayWidth * 0.85, this.def.displayWidth * 0.22, 0x000000, 0.35)
      .setDepth(DEPTH.ENEMY_SHADOW);
    this.gfx = scene.add.graphics();
    this.gfx.setDepth(DEPTH.TELEGRAPH);
  }

  get isAlive(): boolean {
    return !this.dead;
  }

  get isTargetable(): boolean {
    return !this.dead && this.targetable;
  }

  setSleeping(sleep: boolean) {
    this.sleeping = sleep;
    if (!sleep) this.resetTint();
  }

  get isSleeping(): boolean {
    return this.sleeping;
  }

  protected get radius(): number {
    return this.sprite.displayWidth * 0.4;
  }

  // ---------- ร่างลวง (ค่าเริ่มต้น: ไม่มี) ----------
  getDecoys(): DecoyRef[] {
    return [];
  }

  // ตีร่างปลอมแตก — คืน true ถ้าตีโดนจริง (เลือดบอสไม่ลด)
  hitDecoy(_index: number): boolean {
    return false;
  }

  protected fitTexture(key: string, widthFactor: number = 1) {
    this.sprite.setTexture(key);
    this.sprite.setScale((this.def.displayWidth * widthFactor) / this.sprite.width);
    this.syncBodyShape();
  }

  protected syncBodyShape() {
    const diameter = Math.min(this.sprite.width, this.sprite.height) * 0.68;
    const radius = diameter / 2;
    this.sprite.body.setCircle(
      radius,
      (this.sprite.width - diameter) / 2,
      (this.sprite.height - diameter) / 2
    );
  }

  update(delta: number) {
    if (this.dead) return;
    this.shadow.setPosition(
      this.sprite.x,
      this.sprite.y + this.sprite.displayHeight / 2 - 4 + this.groundOffsetY
    );
    this.shadow.setVisible(this.shadowVisible);
    if (this.sleeping) {
      this.sprite.setVelocity(0); // หยุดเดิน
      return;                     // ไม่ประมวลผล AI (ไม่โจมตี)
    }
    this.tick(delta);
  }

  protected abstract tick(delta: number): void;
  protected abstract onRage(): void;
  protected onDie(): void {}

takeDamage(amount: number) {
  if (this.dead || !this.targetable) return;
  const dmg = Math.round(amount * this.damageMult * 10) / 10;
  this.hp = Math.max(0, this.hp - dmg);
  this.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
  this.scene.time.delayedCall(100, () => {
    if (!this.dead) this.resetTint();
  });
  showDamage(this.scene, this.sprite.x, this.sprite.y - this.sprite.displayHeight / 2, String(dmg), '#ffe066');
  burst(this.scene, this.sprite.x, this.sprite.y, 0xffffff, 6, 40, 4);
  if (this.hp <= 0) {
    this.die();
    return;
  }
  this.checkPhase();
}

  protected checkPhase() {
    if (this.rage) return;
    if (this.hp / this.def.hp > this.rageRatio) return;
    this.rage = true;
    ringEffect(this.scene, this.sprite.x, this.sprite.y, 160, 0xff3333, 500);
    burst(this.scene, this.sprite.x, this.sprite.y, 0xff5555, 16, 90, 7);
    this.scene.cameras.main.shake(400, 0.02);
    showDamage(this.scene, this.sprite.x, this.sprite.y - this.sprite.displayHeight / 2 - 20, 'RAGE!', '#ff5555');
    this.onRage();
    this.hooks.onPhaseChange?.();
  }

  protected die() {
    this.dead = true;
    this.gfx.clear();
    this.onDie();
    const x = this.sprite.x;
    const y = this.sprite.y;
    burst(this.scene, x, y, this.def.color, 30, 140, 9);
    burst(this.scene, x, y, 0xffffff, 12, 100, 5);
    ringEffect(this.scene, x, y, 200, 0xffffff, 600);
    this.scene.cameras.main.shake(500, 0.02);
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.destroy();
    this.shadow.destroy();
    this.gfx.destroy();
    this.hooks.onDeath(this);
  }

  /** ลบทิ้งทันที (เปลี่ยนแอเรีย/ล้างฉาก) — ไม่ดรอปของ ไม่เรียก onDeath
      และให้บอสเก็บของส่วนตัวก่อน (เช่น ร่างปลอมของมายา) ผ่าน onDie() */
  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.onDie();
    this.scene.tweens.killTweensOf(this.sprite);
    if (this.sprite.active) this.sprite.destroy();
    if (this.shadow.active) this.shadow.destroy();
    if (this.gfx.active) this.gfx.destroy();
  }

  protected baseTint(): number | null {
    return this.rage ? 0xffb0a0 : null;
  }

  protected resetTint() {
    const t = this.baseTint();
    this.sprite.clearTint(); // ล้างโหมดแฟลชด้วยเสมอ
    if (t !== null) this.sprite.setTint(t);
  }

  protected nearestTarget(): any {
    let best: any = null;
    let bestD = Infinity;
    for (const t of this.hooks.getTargets()) {
      const d = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, t.x, t.y);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }
}