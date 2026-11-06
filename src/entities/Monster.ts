// มอนสเตอร์/บอส — ขับด้วย "ท่า" และสถานะ:
//   เดินไล่ -> เตือน(telegraph) -> โจมตี -> พัก(recover) -> เดินไล่ ...
// ไม่ผูกกับผู้เล่นคนเดียว: ถามเป้าหมายจาก hooks.getTargets() (รองรับหลายผู้เล่นในอนาคต)
import Phaser from 'phaser';
import { DEPTH } from '../config';
import type { MonsterDef } from '../data/monsters';
import { ATTACKS } from '../data/monsterAttacks';
import type { AttackDef } from '../data/monsterAttacks';
import { burst, showDamage, ringEffect } from '../systems/effects';

type MonsterState = 'chase' | 'telegraph' | 'attack' | 'recover' | 'dead';

export interface MonsterHooks {
  getTargets: () => any[];
  onHitTarget: (target: any, damage: number, fromX: number, fromY: number) => void;
  onDeath: () => void;
}

export class Monster {
  readonly def: MonsterDef;
  readonly sprite: any;
  hp: number;

  private scene: Phaser.Scene;
  private hooks: MonsterHooks;
  private shadow: any;
  private gfx: any; // วาดเครื่องหมายเตือน

  private state: MonsterState = 'chase';
  private timer: number = 0;   // เวลาที่เหลือของสถานะนี้ (ms)
  private elapsed: number = 0; // เวลาที่ผ่านไปในสถานะนี้ (ms)

  private pool: string[];      // ท่าที่ใช้ได้ตอนนี้
  private lastAttackId: string = '';
  private current: AttackDef | null = null;
  private dir = { x: 1, y: 0 }; // ทิศพุ่ง (ล็อกตอนเริ่มเตือน)
  private hitTargets: any[] = [];

  private phaseIndex: number = 0;
  private speedMult: number = 1;
  private baseScale: number;

  constructor(scene: Phaser.Scene, def: MonsterDef, x: number, y: number, hooks: MonsterHooks) {
    this.scene = scene;
    this.def = def;
    this.hooks = hooks;
    this.hp = def.hp;
    this.baseScale = def.scale;
    this.pool = [...def.attacks];

    this.sprite = scene.physics.add.sprite(x, y, def.sprite) as any;
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDepth(DEPTH.ENEMY);
    this.sprite.setScale(def.scale);
    this.sprite.body.setImmovable(true); // ผู้เล่นดันบอสไม่ได้

    this.shadow = scene.add
      .ellipse(x, y, this.sprite.displayWidth * 0.85, this.sprite.displayHeight * 0.25, 0x000000, 0.35)
      .setDepth(DEPTH.ENEMY_SHADOW);

    this.gfx = scene.add.graphics();
    this.gfx.setDepth(DEPTH.TELEGRAPH);

    this.resetTint();
    this.enterChase();
  }

  get isAlive(): boolean {
    return this.state !== 'dead';
  }

  // รัศมีลำตัว (ใช้ตรวจการชนตอนพุ่ง)
  private get radius(): number {
    return this.sprite.width * this.baseScale * 0.4;
  }

  update(delta: number) {
    if (this.state === 'dead') return;

    this.shadow.setPosition(this.sprite.x, this.sprite.y + this.sprite.displayHeight / 2 - 4);
    this.elapsed += delta;

    switch (this.state) {
      case 'chase': this.updateChase(delta); break;
      case 'telegraph': this.updateTelegraph(delta); break;
      case 'attack': this.updateAttack(delta); break;
      case 'recover': this.updateRecover(delta); break;
    }
  }

  // ---------- ผู้เล่นทำดาเมจใส่มอน ----------
  takeDamage(amount: number) {
    if (this.state === 'dead') return;
    this.hp = Math.max(0, this.hp - amount);

    // กะพริบขาว + บีบตัว
    this.sprite.setTint(0xffffff);
    this.scene.time.delayedCall(100, () => {
      if (this.state !== 'dead') this.resetTint();
    });
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: this.baseScale * 1.1,
      scaleY: this.baseScale * 0.92,
      duration: 60,
      yoyo: true
    });

    showDamage(this.scene, this.sprite.x, this.sprite.y - this.sprite.displayHeight / 2, String(amount), '#ffe066');
    burst(this.scene, this.sprite.x, this.sprite.y, 0xffffff, 6, 40, 4);

    if (this.hp <= 0) {
      this.die();
      return;
    }
    this.checkPhase();
  }

  // ---------- สถานะ: เดินไล่ ----------
  private enterChase() {
    this.state = 'chase';
    this.elapsed = 0;
    this.timer = Phaser.Math.Between(this.def.chaseMs[0], this.def.chaseMs[1]);
    this.resetTint();
  }

  private updateChase(delta: number) {
    const target = this.nearestTarget();
    if (!target) {
      this.sprite.setVelocity(0);
      return;
    }

    const d = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, target.x, target.y);
    if (d > this.radius + 24) {
      this.scene.physics.moveToObject(this.sprite, target, this.def.speed * this.speedMult);
    } else {
      this.sprite.setVelocity(0);
    }
    this.sprite.setFlipX(this.sprite.x >= target.x);

    this.timer -= delta;
    if (this.timer <= 0) {
      this.startTelegraph(this.pickAttack(), target);
    }
  }

  // ---------- สถานะ: เตือน ----------
  private startTelegraph(id: string, target: any) {
    this.current = ATTACKS[id];
    this.lastAttackId = id;
    this.state = 'telegraph';
    this.elapsed = 0;
    this.timer = this.current.telegraphMs;
    this.sprite.setVelocity(0);

    if (this.current.kind === 'charge') {
      const dx = target.x - this.sprite.x;
      const dy = target.y - this.sprite.y;
      const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      this.dir = { x: dx / len, y: dy / len };
      this.sprite.setFlipX(dx < 0);
    }
  }

  private updateTelegraph(delta: number) {
    const a = this.current;
    if (!a) return;

    this.timer -= delta;
    const progress = Phaser.Math.Clamp(1 - this.timer / a.telegraphMs, 0, 1);
    this.drawTelegraph(a, progress);

    // ตัวมอนกะพริบแดง
    if (Math.floor(this.elapsed / 100) % 2 === 0) this.sprite.setTint(0xff5555);
    else this.resetTint();

    if (this.timer <= 0) this.startAttack(a);
  }

  private drawTelegraph(a: AttackDef, p: number) {
    const g = this.gfx;
    const x = this.sprite.x;
    const y = this.sprite.y;
    g.clear();

    if (a.kind === 'slam') {
      const r = a.radius ?? 100;
      g.fillStyle(0xff3333, 0.12 + 0.2 * p);
      g.fillCircle(x, y, r);
      g.lineStyle(3, 0xff5555, 0.9);
      g.strokeCircle(x, y, r);
      g.fillStyle(0xff3333, 0.3);
      g.fillCircle(x, y, r * p); // วงในค่อย ๆ โตเต็ม = ใกล้โจมตี
    } else if (a.kind === 'charge') {
      const len = ((a.speed ?? 0) * (a.durationMs ?? 0)) / 1000;
      const hw = this.radius * 0.9;
      const nx = -this.dir.y;
      const ny = this.dir.x;
      const x2 = x + this.dir.x * len;
      const y2 = y + this.dir.y * len;
      g.fillStyle(0xff3333, 0.12 + 0.25 * p);
      g.beginPath();
      g.moveTo(x + nx * hw, y + ny * hw);
      g.lineTo(x2 + nx * hw, y2 + ny * hw);
      g.lineTo(x2 - nx * hw, y2 - ny * hw);
      g.lineTo(x - nx * hw, y - ny * hw);
      g.closePath();
      g.fillPath();
      g.lineStyle(3, 0xff5555, 0.9);
      g.strokePath();
    } else if (a.kind === 'shockwave') {
      const r = a.radius ?? 250;
      g.lineStyle(3, 0xff5555, 0.6);
      g.strokeCircle(x, y, r);          // ขอบเขตที่คลื่นจะไปถึง
      g.lineStyle(4, 0xff5555, 0.9);
      g.strokeCircle(x, y, r * p);      // วงที่กำลังโตขึ้น
    }
  }

  // ---------- สถานะ: โจมตี ----------
  private startAttack(a: AttackDef) {
    this.gfx.clear();
    this.resetTint();
    this.state = 'attack';
    this.elapsed = 0;
    this.timer = a.durationMs ?? 0;
    this.hitTargets = [];

    if (a.kind === 'slam') {
      this.doSlam(a);
    } else if (a.kind === 'charge') {
      this.scene.cameras.main.shake(120, 0.004);
      const speed = a.speed ?? 0;
      this.sprite.setVelocity(this.dir.x * speed, this.dir.y * speed);
    } else if (a.kind === 'shockwave') {
      this.scene.cameras.main.shake(150, 0.008);
    }
  }

  private doSlam(a: AttackDef) {
    const r = a.radius ?? 100;
    ringEffect(this.scene, this.sprite.x, this.sprite.y, r, 0xff5555, 350);
    burst(this.scene, this.sprite.x, this.sprite.y, 0xffffff, 14, r * 0.8, 6);
    this.scene.cameras.main.shake(250, 0.02);

    for (const t of this.hooks.getTargets()) {
      const d = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, t.x, t.y);
      if (d <= r) this.hit(t, a);
    }
    this.enterRecover(a.recoverMs); // กระแทกครั้งเดียว แล้วพักเลย
  }

  private updateAttack(delta: number) {
    const a = this.current;
    if (!a) return;
    this.timer -= delta;

    if (a.kind === 'charge') {
      const hitR = this.radius + 14;
      for (const t of this.hooks.getTargets()) {
        if (this.hitTargets.includes(t)) continue;
        const d = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, t.x, t.y);
        if (d <= hitR) this.hit(t, a);
      }
    } else if (a.kind === 'shockwave') {
      const dur = a.durationMs ?? 700;
      const maxR = a.radius ?? 250;
      const k = Phaser.Math.Clamp(this.elapsed / dur, 0, 1);
      const r = maxR * k;

      this.gfx.clear();
      this.gfx.lineStyle(8, 0xff5555, 1 - k * 0.7);
      this.gfx.strokeCircle(this.sprite.x, this.sprite.y, r);

      for (const t of this.hooks.getTargets()) {
        if (this.hitTargets.includes(t)) continue;
        const d = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, t.x, t.y);
        if (Math.abs(d - r) <= 20) this.hit(t, a);
      }
    }

    if (this.timer <= 0) {
      this.gfx.clear();
      this.sprite.setVelocity(0);
      this.enterRecover(a.recoverMs);
    }
  }

  private hit(target: any, a: AttackDef) {
    this.hitTargets.push(target);
    this.hooks.onHitTarget(target, a.damage, this.sprite.x, this.sprite.y);
  }

  // ---------- สถานะ: พัก (ช่วงที่ผู้เล่นสวนได้) ----------
  private enterRecover(ms: number) {
    this.state = 'recover';
    this.elapsed = 0;
    this.timer = ms;
    this.sprite.setVelocity(0);
    this.resetTint();
  }

  private updateRecover(delta: number) {
    this.timer -= delta;
    if (this.timer <= 0) this.enterChase();
  }

  // ---------- เฟส ----------
  private checkPhase() {
    const phases = this.def.phases;
    if (this.phaseIndex >= phases.length) return;
    const ph = phases[this.phaseIndex];
    if (this.hp / this.def.hp <= ph.hpBelow) {
      this.phaseIndex++;
      for (const id of ph.addAttacks ?? []) {
        if (!this.pool.includes(id)) this.pool.push(id);
      }
      this.speedMult *= ph.speedMult ?? 1;

      // หยุดท่าที่ทำอยู่ แล้วคำราม (เปิดช่องให้ผู้เล่นสวน)
      this.gfx.clear();
      this.enterRecover(1200);
      ringEffect(this.scene, this.sprite.x, this.sprite.y, 160, 0xff3333, 500);
      burst(this.scene, this.sprite.x, this.sprite.y, 0xff5555, 16, 90, 7);
      this.scene.cameras.main.shake(400, 0.02);
      showDamage(this.scene, this.sprite.x, this.sprite.y - this.sprite.displayHeight / 2 - 20, 'RAGE!', '#ff5555');
    }
  }

  // ---------- ตาย ----------
  private die() {
    this.state = 'dead';
    this.gfx.clear();
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
    this.hooks.onDeath();
  }

  // ---------- ตัวช่วย ----------
  private pickAttack(): string {
    const options = this.pool.length > 1 ? this.pool.filter((id) => id !== this.lastAttackId) : this.pool;
    return options[Phaser.Math.Between(0, options.length - 1)];
  }

  private nearestTarget(): any {
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

  // สีตัวมอน: เฟสโกรธ = อมชมพู, มีสีประจำตัว = ย้อมตามนั้น, ไม่งั้นสีปกติ
  private resetTint() {
    if (this.phaseIndex > 0) this.sprite.setTint(0xff9999);
    else if (this.def.baseTint !== undefined) this.sprite.setTint(this.def.baseTint);
    else this.sprite.clearTint();
  }
}