// บอส 1: ภัสมะ — พ่นไฟค้าง / แดช / (คลั่ง) ม้วนตัวเป็นลูกข่าง
import Phaser from 'phaser';
import { DEPTH } from '../config';
import { BossBase, type BossHooks } from './BossBase';
import { BOSS_DEFS, PHASAMA } from '../data/bosses';
import { showDamage } from '../systems/effects';

type State = 'chase' | 'telegraph' | 'flame' | 'dash' | 'spin' | 'dizzy' | 'recover';
type AttackId = 'flame' | 'dash' | 'spin';

export class PhasamaBoss extends BossBase {
  private state: State = 'chase';
  private timer: number = 0;
  private elapsed: number = 0;
  private pool: AttackId[] = ['flame', 'dash'];
  private lastAttack: AttackId | '' = '';
  private current: AttackId = 'flame';
  private dir = new Phaser.Math.Vector2(1, 0);
  private flameAngle: number = 0;
  private particleTimer: number = 0;
  private hitDone: boolean = false;

  // ลูกข่าง
  private spinT: number = 0;
  private spinSub: 'move' | 'aim' | 'dash' = 'move';
  private spinSubT: number = 0;
  private nextSpinDashAt: number = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, hooks: BossHooks) {
    super(scene, BOSS_DEFS.phasama, 'boss_phasama', x, y, hooks);
    this.enterChase();
  }

  protected tick(delta: number) {
    this.elapsed += delta;
    switch (this.state) {
      case 'chase': this.updateChase(delta); break;
      case 'telegraph': this.updateTelegraph(delta); break;
      case 'flame': this.updateFlame(delta); break;
      case 'dash': this.updateDash(delta); break;
      case 'spin': this.updateSpin(delta); break;
      case 'dizzy': this.updateDizzy(delta); break;
      case 'recover': this.updateRecover(delta); break;
    }
  }

  protected onRage() {
    if (!this.pool.includes('spin')) this.pool.push('spin');
    this.gfx.clear();
    this.sprite.setVelocity(0);
    this.setBall(false);
    this.damageMult = 1;
    this.enterRecover(1200);
  }

  // ---------- ตัวช่วย ----------
  private mouth(angle: number) {
    const r = this.radius * 0.7;
    return { x: this.sprite.x + Math.cos(angle) * r, y: this.sprite.y + Math.sin(angle) * r };
  }

  private setBall(on: boolean) {
    this.fitTexture(on ? 'boss_phasama_ball' : 'boss_phasama', on ? 0.85 : 1);
    if (!on) this.sprite.setAngle(0);
  }

  private sector(g: any, x: number, y: number, r: number, a0: number, a1: number) {
    g.beginPath();
    g.moveTo(x, y);
    g.arc(x, y, r, a0, a1, false);
    g.closePath();
    g.fillPath();
  }

  private pickAttack(): AttackId {
    const options = this.pool.length > 1 ? this.pool.filter((id) => id !== this.lastAttack) : this.pool;
    return options[Phaser.Math.Between(0, options.length - 1)];
  }

  private telegraphMs(id: AttackId): number {
    if (id === 'flame') return PHASAMA.flame.telegraphMs;
    if (id === 'dash') return PHASAMA.dash.telegraphMs;
    return PHASAMA.spin.telegraphMs;
  }

  // ---------- chase ----------
  private enterChase() {
    this.state = 'chase';
    this.elapsed = 0;
    this.timer = Phaser.Math.Between(PHASAMA.chaseMs[0], PHASAMA.chaseMs[1]);
    this.resetTint();
  }

  private updateChase(delta: number) {
    const t = this.nearestTarget();
    if (!t) {
      this.sprite.setVelocity(0);
      return;
    }
    const mult = this.rage ? PHASAMA.rageSpeedMult : 1;
    const d = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, t.x, t.y);
    if (d > this.radius + 24) this.scene.physics.moveToObject(this.sprite, t, PHASAMA.walkSpeed * mult);
    else this.sprite.setVelocity(0);
    this.sprite.setFlipX(this.sprite.x >= t.x);

    this.timer -= delta;
    if (this.timer <= 0) this.startTelegraph(this.pickAttack(), t);
  }

  // ---------- telegraph ----------
  private startTelegraph(id: AttackId, t: any) {
    this.current = id;
    this.lastAttack = id;
    this.state = 'telegraph';
    this.elapsed = 0;
    this.hitDone = false;
    this.sprite.setVelocity(0);

    const dx = t.x - this.sprite.x;
    const dy = t.y - this.sprite.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    this.dir.set(dx / len, dy / len);
    this.flameAngle = Math.atan2(dy, dx);
    this.sprite.setFlipX(dx < 0);
    this.timer = this.telegraphMs(id);

    if (id === 'spin') this.setBall(true);
  }

  private updateTelegraph(delta: number) {
    this.timer -= delta;
    const total = this.telegraphMs(this.current);
    const p = Phaser.Math.Clamp(1 - this.timer / total, 0, 1);
    this.drawTelegraph(p);

    if (Math.floor(this.elapsed / 100) % 2 === 0) this.sprite.setTint(0xff5555);
    else this.resetTint();
    if (this.current === 'spin') this.sprite.setAngle(Math.sin(this.elapsed / 30) * 6);

    if (this.timer <= 0) this.startAttack();
  }

  private drawTelegraph(p: number) {
    const g = this.gfx;
    const x = this.sprite.x;
    const y = this.sprite.y;
    g.clear();

    if (this.current === 'flame') {
      const F = PHASAMA.flame;
      const m = this.mouth(this.flameAngle);
      const a0 = this.flameAngle - Phaser.Math.DegToRad(F.halfAngle);
      const a1 = this.flameAngle + Phaser.Math.DegToRad(F.halfAngle);
      g.fillStyle(0xff3333, 0.1 + 0.2 * p);
      this.sector(g, m.x, m.y, F.length, a0, a1);
      g.fillStyle(0xff3333, 0.25);
      this.sector(g, m.x, m.y, F.length * p, a0, a1);
    } else if (this.current === 'dash') {
      const D = PHASAMA.dash;
      const len = (D.speed * D.durationMs) / 1000;
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
    } else {
      const R = PHASAMA.spin.ringRadius;
      g.lineStyle(3, 0xff5555, 0.6);
      g.strokeCircle(x, y, R);
      g.lineStyle(4, 0xff5555, 0.9);
      g.strokeCircle(x, y, R * p);
    }
  }

  // ---------- attack ----------
  private startAttack() {
    this.gfx.clear();
    this.resetTint();
    this.elapsed = 0;
    this.hitDone = false;

    if (this.current === 'flame') {
      this.state = 'flame';
      this.timer = PHASAMA.flame.durationMs;
      this.particleTimer = 0;
      this.scene.cameras.main.shake(120, 0.004);
    } else if (this.current === 'dash') {
      const D = PHASAMA.dash;
      this.state = 'dash';
      this.timer = D.durationMs;
      this.particleTimer = 0;
      this.sprite.setVelocity(this.dir.x * D.speed, this.dir.y * D.speed);
      this.scene.cameras.main.shake(120, 0.004);
    } else {
      this.state = 'spin';
      this.spinT = 0;
      this.spinSub = 'move';
      this.spinSubT = 0;
      this.nextSpinDashAt = PHASAMA.spin.dashEveryMs;
      this.sprite.setAngle(0);
      this.scene.cameras.main.shake(150, 0.006);
    }
  }

  // ---------- flame: พ่นไฟค้าง เดินได้ กรวยหมุนตามช้าๆ ----------
  private updateFlame(delta: number) {
    const F = PHASAMA.flame;
    this.timer -= delta;

    const t = this.nearestTarget();
    if (t) {
      const want = Math.atan2(t.y - this.sprite.y, t.x - this.sprite.x);
      const diff = Phaser.Math.Angle.Wrap(want - this.flameAngle);
      const maxStep = (Phaser.Math.DegToRad(F.turnDegPerSec) * delta) / 1000;
      this.flameAngle += Phaser.Math.Clamp(diff, -maxStep, maxStep);

      const d = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, t.x, t.y);
      if (d > this.radius + 30) this.scene.physics.moveToObject(this.sprite, t, F.moveSpeed);
      else this.sprite.setVelocity(0);
      this.sprite.setFlipX(Math.cos(this.flameAngle) < 0);
    }

    this.coneBurn(this.flameAngle, F.length, F.halfAngle, delta);
    this.drawFlame(this.flameAngle, F.length, F.halfAngle);
    this.emitFlame(this.flameAngle, F.length, F.halfAngle, delta);

    if (this.timer <= 0) {
      this.gfx.clear();
      this.sprite.setVelocity(0);
      this.enterRecover(F.recoverMs);
    }
  }

  private coneBurn(angle: number, length: number, halfDeg: number, delta: number) {
    const m = this.mouth(angle);
    for (const t of this.hooks.getTargets()) {
      const dx = t.x - m.x;
      const dy = t.y - m.y;
      const dist = Math.hypot(dx, dy);
      if (dist > length + 12) continue;
      const diff = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - angle));
      const widen = dist > 1 ? Math.asin(Math.min(1, 14 / dist)) : Math.PI;
      if (diff <= Phaser.Math.DegToRad(halfDeg) + widen) this.hooks.onBurn?.(t, delta);
    }
  }

  private drawFlame(angle: number, length: number, halfDeg: number) {
    const g = this.gfx;
    g.clear();
    const m = this.mouth(angle);
    const a0 = angle - Phaser.Math.DegToRad(halfDeg);
    const a1 = angle + Phaser.Math.DegToRad(halfDeg);
    const flick = 0.88 + Math.random() * 0.12;
    g.fillStyle(0xff5a1a, 0.28);
    this.sector(g, m.x, m.y, length * flick, a0, a1);
    g.fillStyle(0xffb030, 0.35);
    this.sector(g, m.x, m.y, length * 0.7 * flick, a0, a1);
    g.fillStyle(0xfff0a0, 0.4);
    this.sector(g, m.x, m.y, length * 0.4 * flick, a0, a1);
  }

  private emitFlame(angle: number, length: number, halfDeg: number, delta: number) {
    this.particleTimer += delta;
    if (this.particleTimer < 50) return;
    this.particleTimer = 0;
    const m = this.mouth(angle);
    for (let i = 0; i < 3; i++) {
      const a = angle + (Math.random() * 2 - 1) * Phaser.Math.DegToRad(halfDeg * 0.8);
      const dist = length * (0.4 + Math.random() * 0.6);
      const p: any = this.scene.add.circle(
        m.x,
        m.y,
        Phaser.Math.Between(3, 6),
        Math.random() < 0.5 ? 0xffb030 : 0xff5a1a,
        0.9
      );
      p.setDepth(DEPTH.TELEGRAPH + 1);
      this.scene.tweens.add({
        targets: p,
        x: m.x + Math.cos(a) * dist,
        y: m.y + Math.sin(a) * dist,
        alpha: 0,
        scale: 0.3,
        duration: 350,
        onComplete: () => p.destroy()
      });
    }
  }

  // ---------- dash: พุ่งตรง พ่นไฟไปด้วย ----------
  private updateDash(delta: number) {
    const D = PHASAMA.dash;
    this.timer -= delta;
    const angle = Math.atan2(this.dir.y, this.dir.x);

    this.coneBurn(angle, D.flameLength, D.flameHalfAngle, delta);
    this.drawFlame(angle, D.flameLength, D.flameHalfAngle);
    this.emitFlame(angle, D.flameLength, D.flameHalfAngle, delta);

    if (!this.hitDone) {
      for (const t of this.hooks.getTargets()) {
        const d = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, t.x, t.y);
        if (d <= this.radius + 14) {
          this.hitDone = true;
          this.hooks.onHitTarget(t, D.bodyDamage, this.sprite.x, this.sprite.y);
          break;
        }
      }
    }

    if (this.timer <= 0) {
      this.gfx.clear();
      this.sprite.setVelocity(0);
      this.enterRecover(D.recoverMs);
    }
  }

  // ---------- spin: ลูกข่าง (ตอนคลั่ง) หมุน + ไฟรอบตัว + แดชได้ ----------
  private updateSpin(delta: number) {
    const S = PHASAMA.spin;
    this.spinT += delta;
    this.sprite.angle += (S.spinDegPerSec * delta) / 1000;

    const g = this.gfx;
    g.clear();
    const x = this.sprite.x;
    const y = this.sprite.y;
    const flick = 0.95 + Math.random() * 0.05;
    g.fillStyle(0xff5a1a, 0.22);
    g.fillCircle(x, y, S.ringRadius * flick);
    g.lineStyle(4, 0xffb030, 0.8);
    g.strokeCircle(x, y, S.ringRadius * flick);
    this.emitRing(delta, S.ringRadius);

    // ไฟรอบตัว
    for (const t of this.hooks.getTargets()) {
      const d = Phaser.Math.Distance.Between(x, y, t.x, t.y);
      if (d <= S.ringRadius + 12) this.hooks.onBurn?.(t, delta);
    }

    this.spinSubT += delta;
    if (this.spinSub === 'move') {
      const t = this.nearestTarget();
      if (t) this.scene.physics.moveToObject(this.sprite, t, S.moveSpeed);
      else this.sprite.setVelocity(0);

      if (this.spinT >= this.nextSpinDashAt && t) {
        const dx = t.x - x;
        const dy = t.y - y;
        const len = Math.max(1, Math.hypot(dx, dy));
        this.dir.set(dx / len, dy / len);
        this.spinSub = 'aim';
        this.spinSubT = 0;
        this.sprite.setVelocity(0);
      }
    } else if (this.spinSub === 'aim') {
      const p = Phaser.Math.Clamp(this.spinSubT / S.dashAimMs, 0, 1);
      const len = (S.dashSpeed * S.dashDurationMs) / 1000;
      g.lineStyle(10, 0xff3333, 0.3 + 0.5 * p);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + this.dir.x * len, y + this.dir.y * len);
      g.strokePath();
      if (this.spinSubT >= S.dashAimMs) {
        this.spinSub = 'dash';
        this.spinSubT = 0;
        this.hitDone = false;
        this.sprite.setVelocity(this.dir.x * S.dashSpeed, this.dir.y * S.dashSpeed);
      }
    } else {
      if (!this.hitDone) {
        for (const t of this.hooks.getTargets()) {
          const d = Phaser.Math.Distance.Between(x, y, t.x, t.y);
          if (d <= this.radius + 14) {
            this.hitDone = true;
            this.hooks.onHitTarget(t, 1, x, y);
            break;
          }
        }
      }
      if (this.spinSubT >= S.dashDurationMs) {
        this.spinSub = 'move';
        this.sprite.setVelocity(0);
        this.nextSpinDashAt = this.spinT + S.dashEveryMs;
      }
    }

    if (this.spinT >= S.durationMs) this.endSpin();
  }

  private emitRing(delta: number, radius: number) {
    this.particleTimer += delta;
    if (this.particleTimer < 60) return;
    this.particleTimer = 0;
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      const sx = this.sprite.x + Math.cos(a) * radius * 0.85;
      const sy = this.sprite.y + Math.sin(a) * radius * 0.85;
      const p: any = this.scene.add.circle(sx, sy, Phaser.Math.Between(3, 5), Math.random() < 0.5 ? 0xffb030 : 0xff5a1a, 0.9);
      p.setDepth(DEPTH.TELEGRAPH + 1);
      this.scene.tweens.add({
        targets: p,
        x: sx + Math.cos(a) * 24,
        y: sy + Math.sin(a) * 24,
        alpha: 0,
        duration: 320,
        onComplete: () => p.destroy()
      });
    }
  }

  private endSpin() {
    this.gfx.clear();
    this.sprite.setVelocity(0);
    this.setBall(false);
    this.state = 'dizzy';
    this.elapsed = 0;
    this.timer = PHASAMA.spin.dizzyMs;
    this.damageMult = PHASAMA.spin.dizzyDamageMult;
    this.sprite.setTint(0xffff99);
    showDamage(this.scene, this.sprite.x, this.sprite.y - this.sprite.displayHeight / 2 - 10, 'มึน! ตีเต็มที่', '#ffe066', 900);
  }

  private updateDizzy(delta: number) {
    this.timer -= delta;
    const g = this.gfx;
    g.clear();
    g.fillStyle(0xffe066, 0.95);
    for (let i = 0; i < 3; i++) {
      const a = this.elapsed / 200 + (i * Math.PI * 2) / 3;
      g.fillCircle(
        this.sprite.x + Math.cos(a) * 20,
        this.sprite.y - this.sprite.displayHeight / 2 - 8 + Math.sin(a) * 6,
        4
      );
    }
    if (this.timer <= 0) {
      this.damageMult = 1;
      this.gfx.clear();
      this.enterChase();
    }
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
}