// มอนสเตอร์/บอส — ขับด้วย "ท่า" และสถานะ:
//   เดินไล่ -> เตือน(telegraph) -> โจมตี -> พัก(recover) -> เดินไล่ ...
import Phaser from 'phaser';
import { DEPTH } from '../config';
import type { MonsterDef } from '../data/monsters';
import { ATTACKS } from '../data/monsterAttacks';
import type { AttackDef } from '../data/monsterAttacks';
import { burst, showDamage, ringEffect } from '../systems/effects';
import { Projectile } from './Projectile';

type MonsterState = 'chase' | 'telegraph' | 'attack' | 'recover' | 'dead';

export interface MonsterHooks {
  getTargets: () => any[];
  onHitTarget: (target: any, damage: number, fromX: number, fromY: number) => void;
  onDeath: () => void;
  onPhaseChange?: () => void;
}

export class Monster {
  readonly def: MonsterDef;
  readonly sprite: any;
  hp: number;

  private scene: Phaser.Scene;
  private hooks: MonsterHooks;
  private shadow: any;
  private gfx: any;

  private state: MonsterState = 'chase';
  private timer: number = 0;
  private elapsed: number = 0;

  private pool: string[];
  private lastAttackId: string = '';
  private current: AttackDef | null = null;
  private dir = { x: 1, y: 0 };
  private hitTargets: any[] = [];

  private phaseIndex: number = 0;
  private speedMult: number = 1;
  private baseScale: number;

  // กระสุนที่มอนยิงออกมา — เก็บไว้เพื่ออัปเดตทุกเฟรม
  private projectiles: Projectile[] = [];

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
    this.sprite.body.setImmovable(true);

    this.shadow = scene.add
      .ellipse(x, y, this.sprite.displayWidth * 0.85, this.sprite.displayHeight * 0.25, 0x000000, 0.35)
      .setDepth(DEPTH.ENEMY_SHADOW);

    this.gfx = scene.add.graphics();
    this.gfx.setDepth(DEPTH.TELEGRAPH);

    this.applyVisualStyle(def);
    this.resetTint();
    this.enterChase();
  }

  // ลูกเล่นภาพระบุตัวตน — pulse (ตัวเต้น) / flicker (ตัวจาง)
  private applyVisualStyle(def: MonsterDef) {
    if (def.visualStyle === 'pulse') {
      this.scene.tweens.add({
        targets: this.sprite,
        scaleX: this.baseScale * 1.08,
        scaleY: this.baseScale * 1.08,
        duration: 350,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    } else if (def.visualStyle === 'flicker') {
      this.scene.tweens.add({
        targets: this.sprite,
        alpha: 0.55,
        duration: 280,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }
  }

  get isAlive(): boolean {
    return this.state !== 'dead';
  }

  private get radius(): number {
    return this.sprite.width * this.baseScale * 0.4;
  }

  update(delta: number) {
    if (this.state === 'dead') return;

    this.shadow.setPosition(this.sprite.x, this.sprite.y + this.sprite.displayHeight / 2 - 4);
    this.elapsed += delta;

    // อัปเดตกระสุนทุกเฟรม (ยกเว้นตอนตาย)
    this.updateProjectiles(delta);

    switch (this.state) {
      case 'chase': this.updateChase(delta); break;
      case 'telegraph': this.updateTelegraph(delta); break;
      case 'attack': this.updateAttack(delta); break;
      case 'recover': this.updateRecover(delta); break;
    }
  }

  private updateProjectiles(delta: number) {
    const targets = this.hooks.getTargets();
    for (const p of this.projectiles) {
      p.update(delta, targets);
    }
    this.projectiles = this.projectiles.filter((p) => p.isAlive());
  }

  takeDamage(amount: number) {
    if (this.state === 'dead') return;
    this.hp = Math.max(0, this.hp - amount);

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

  // ---------- chase ----------
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

  // ---------- telegraph ----------
  private startTelegraph(id: string, target: any) {
    this.current = ATTACKS[id];
    this.lastAttackId = id;
    this.state = 'telegraph';
    this.elapsed = 0;
    this.timer = this.current.telegraphMs;
    this.sprite.setVelocity(0);

    // beam / charge ต้องล็อกทิศตอนเริ่มเตือน
    if (this.current.kind === 'charge' || this.current.kind === 'beam') {
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
      g.fillCircle(x, y, r * p);
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
      g.strokeCircle(x, y, r);
      g.lineStyle(4, 0xff5555, 0.9);
      g.strokeCircle(x, y, r * p);
    } else if (a.kind === 'beam') {
      const len = a.length ?? 350;
      const w = a.width ?? 40;
      const nx = -this.dir.y;
      const ny = this.dir.x;
      const x2 = x + this.dir.x * len;
      const y2 = y + this.dir.y * len;
      g.fillStyle(0xff3333, 0.15 + 0.3 * p);
      g.beginPath();
      g.moveTo(x + nx * (w / 2), y + ny * (w / 2));
      g.lineTo(x2 + nx * (w / 2), y2 + ny * (w / 2));
      g.lineTo(x2 - nx * (w / 2), y2 - ny * (w / 2));
      g.lineTo(x - nx * (w / 2), y - ny * (w / 2));
      g.closePath();
      g.fillPath();
      g.lineStyle(3, 0xff5555, 0.9);
      g.strokePath();
    } else if (a.kind === 'projectile') {
      // วาดจุดยิง + เส้นเล็งสั้น ๆ
      const t = this.nearestTarget();
      if (!t) return;
      const dx = t.x - x;
      const dy = t.y - y;
      const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const nx = dx / len;
      const ny = dy / len;
      const muzzleX = x + nx * (this.radius + 6);
      const muzzleY = y + ny * (this.radius + 6);
      g.lineStyle(2, 0xff5555, 0.4 + 0.4 * p);
      g.beginPath();
      g.moveTo(muzzleX, muzzleY);
      g.lineTo(muzzleX + nx * 70, muzzleY + ny * 70);
      g.strokePath();
      g.fillStyle(0xff5555, 0.6 + 0.4 * p);
      g.fillCircle(muzzleX, muzzleY, 6 + 3 * p);
    }
  }

  // ---------- attack ----------
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
    } else if (a.kind === 'beam') {
      this.doBeam(a);
    } else if (a.kind === 'projectile') {
      this.doProjectile(a);
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
    this.enterRecover(a.recoverMs);
  }

  // ---------- beam: ยิงลำแสงตรงทันที ----------
  private doBeam(a: AttackDef) {
    const len = a.length ?? 350;
    const w = a.width ?? 40;
    const x = this.sprite.x;
    const y = this.sprite.y;
    const dirX = this.dir.x;
    const dirY = this.dir.y;

    // วาด flash ลำแสง
    const g = this.scene.add.graphics();
    g.setDepth(DEPTH.SLASH);
    const nx = -dirY;
    const ny = dirX;
    const x2 = x + dirX * len;
    const y2 = y + dirY * len;
    g.fillStyle(0xff5555, 0.75);
    g.beginPath();
    g.moveTo(x + nx * (w / 2), y + ny * (w / 2));
    g.lineTo(x2 + nx * (w / 2), y2 + ny * (w / 2));
    g.lineTo(x2 - nx * (w / 2), y2 - ny * (w / 2));
    g.lineTo(x - nx * (w / 2), y - ny * (w / 2));
    g.closePath();
    g.fillPath();
    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: 280,
      onComplete: () => g.destroy()
    });
    this.scene.cameras.main.shake(200, 0.012);

    // ตรวจ hit: target ที่อยู่ในกรอบยาวและแคบ
    for (const t of this.hooks.getTargets()) {
      const dx = t.x - x;
      const dy = t.y - y;
      const along = dx * dirX + dy * dirY;
      if (along < 0 || along > len) continue;
      const perpX = dx - dirX * along;
      const perpY = dy - dirY * along;
      const perp = Math.sqrt(perpX * perpX + perpY * perpY);
      if (perp <= w / 2 + 16) this.hit(t, a);
    }

    this.enterRecover(a.recoverMs);
  }

  // ---------- projectile: ยิงกระสุน (1 ลูก หรือกระจาย 3 ลูก) ----------
  private doProjectile(a: AttackDef) {
    const count = a.projectileCount ?? 1;
    const spreadDeg = a.projectileSpread ?? 0;
    const speed = a.projectileSpeed ?? 180;
    const radius = a.projectileRadius ?? 10;
    const life = a.projectileLife ?? 3000;
    const color = this.def.color;

    const target = this.nearestTarget();
    if (!target) {
      this.enterRecover(a.recoverMs);
      return;
    }

    const baseAngle = Math.atan2(target.y - this.sprite.y, target.x - this.sprite.x);

    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * spreadDeg * (Math.PI / 180);
      const angle = baseAngle + offset;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      const p = new Projectile(
        this.scene,
        this.sprite.x,
        this.sprite.y,
        dx,
        dy,
        speed,
        a.damage,
        radius,
        color,
        life,
        (t, dmg, px, py) => this.hooks.onHitTarget(t, dmg, px, py)
      );
      this.projectiles.push(p);
    }

    burst(this.scene, this.sprite.x, this.sprite.y, color, 8, 50, 4);
    this.scene.cameras.main.shake(100, 0.005);

    this.enterRecover(a.recoverMs);
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

  // ---------- recover ----------
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

  // ---------- phase ----------
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

      this.gfx.clear();
      this.enterRecover(1200);
      ringEffect(this.scene, this.sprite.x, this.sprite.y, 160, 0xff3333, 500);
      burst(this.scene, this.sprite.x, this.sprite.y, 0xff5555, 16, 90, 7);
      this.scene.cameras.main.shake(400, 0.02);
      showDamage(
        this.scene,
        this.sprite.x,
        this.sprite.y - this.sprite.displayHeight / 2 - 20,
        'RAGE!',
        '#ff5555'
      );
      this.hooks.onPhaseChange?.();
    }
  }

  // ---------- die ----------
  private die() {
    this.state = 'dead';
    this.gfx.clear();

    // เคลียร์กระสุนที่ยังลอยอยู่
    for (const p of this.projectiles) p.destroy();
    this.projectiles = [];

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

  // ---------- helpers ----------
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

  private resetTint() {
    if (this.phaseIndex > 0) this.sprite.setTint(0xff9999);
    else if (this.def.baseTint !== undefined) this.sprite.setTint(this.def.baseTint);
    else this.sprite.clearTint();
  }
}