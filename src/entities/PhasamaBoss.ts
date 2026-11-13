// บอส 1: ภัสมะ (แมกมัส) — พ่นไฟค้าง / แดช / (คลั่ง) ม้วนตัวเป็นลูกข่าง
import Phaser from 'phaser';
import { DEPTH } from '../config';
import { BossBase, type BossHooks } from './BossBase';
import { BOSS_DEFS, PHASAMA } from '../data/bosses';
import { showDamage } from '../systems/effects';
import { MAG_FRAMES, magKey, magmusReady, measureAlpha, type MagClip } from '../systems/magmusFrames';

type State = 'chase' | 'telegraph' | 'flame' | 'dash' | 'spin' | 'dizzy' | 'recover';
type AttackId = 'flame' | 'dash' | 'spin';
type Then = 'hold' | 'loop' | 'ping' | 'idle';
interface Step {
  clip: MagClip;
  from: number; // เฟรมเริ่ม (นับจาก 0)
  to: number; // เฟรมจบ
  ms: number; // มิลลิวินาทีต่อเฟรม
  then: Then; // จบแล้วทำอะไร
  lo?: number; // ช่วงวนไป-กลับ (ใช้กับ ping)
  hi?: number;
}

// ---------- ค่าปรับอนิเมชัน ----------
const WALK_MS = 110; // ms ต่อเฟรมท่าเดิน
const FLAME_HOLD_MS = 130; // แกว่งสองเฟรมท้ายตอนพ่นไฟ
const UNCURL_MS = 90; // ms ต่อเฟรมตอนคลายจากลูกกลมกลับเป็นยืน
const DIZZY_IN_MS = 800; // เวลาเล่นท่ามึนจากยืนจนสุดท่า
const DIZZY_LOOP_FROM = 3; // วนไป-กลับตั้งแต่เฟรมที่ 4 (นับจาก 0 = 3) ถึงเฟรมสุดท้าย
const RETURN_MAX_MS = 700; // เวลาสูงสุดที่ใช้เล่นย้อนกลับเป็นยืน
const KNOCK_FRAME_MS = 130; // ms ต่อเฟรมท่าล้ม
const KNOCK_HOLD_MS = 700; // ค้างท่านอนก่อนระเบิด

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

  // ---------- ระบบเฟรม ----------
  private useFrames: boolean = false;
  private frameScale: number = 1.6; // วัดจากรูป idle ตอนสร้าง
  private feetRatio: number = 0.94; // ตำแหน่งเท้าในรูป (0-1)
  private ballCY: number = 0.5; // ตำแหน่งกลางลูกกลมในรูป (0-1)
  private pivotOn: boolean = false;
  private curKey: string = '';

  private step: Step | null = null;
  private queue: Step[] = [];
  private aIdx: number = 0;
  private aT: number = 0;
  private aDir: number = 1;
  private aMode: 'run' | 'hold' | 'loop' | 'ping' = 'hold';

  private dying: boolean = false;
  private dyingT: number = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, hooks: BossHooks) {
    super(scene, BOSS_DEFS.phasama, magmusReady(scene) ? magKey('idle', 0) : 'boss_phasama', x, y, hooks);
    this.useFrames = magmusReady(scene);
    if (this.useFrames) this.setupFrames();
    this.enterChase();
  }

  // รัศมีอิงความกว้างที่กำหนด ไม่ใช่ขนาดผืนผ้าใบของรูป
  protected get radius(): number {
    return this.def.displayWidth * 0.4;
  }

  protected tick(delta: number) {
    this.elapsed += delta;

    if (this.dying) {
      this.stepAnim(delta);
      this.dyingT += delta;
      if (this.dyingT >= MAG_FRAMES.knock * KNOCK_FRAME_MS + KNOCK_HOLD_MS) super.die();
      return;
    }

    switch (this.state) {
      case 'chase': this.updateChase(delta); break;
      case 'telegraph': this.updateTelegraph(delta); break;
      case 'flame': this.updateFlame(delta); break;
      case 'dash': this.updateDash(delta); break;
      case 'spin': this.updateSpin(delta); break;
      case 'dizzy': this.updateDizzy(delta); break;
      case 'recover': this.updateRecover(delta); break;
    }
    this.stepAnim(delta);
  }

  protected onRage() {
    if (!this.pool.includes('spin')) this.pool.push('spin');
    this.gfx.clear();
    this.sprite.setVelocity(0);
    this.setPivot(false);
    this.sprite.setAngle(0);
    if (!this.useFrames) this.setBall(false);
    this.damageMult = 1;
    this.enterRecover(1200, true);
  }

  // ตาย: เล่นท่า knock ให้เห็นก่อน แล้วค่อยระเบิด
  protected die() {
    if (!this.useFrames) {
      super.die();
      return;
    }
    if (this.dying) return;
    this.dying = true;
    this.dyingT = 0;
    this.targetable = false; // ตีไม่ได้แล้ว
    this.gfx.clear();
    this.sprite.setVelocity(0);
    this.setPivot(false);
    this.sprite.setAngle(0);
    this.sprite.clearTint();
    this.play({ clip: 'knock', from: 0, to: MAG_FRAMES.knock - 1, ms: KNOCK_FRAME_MS, then: 'hold' });
  }

  // ======================================================
  //  ระบบอนิเมชันเฟรม
  // ======================================================
  private setupFrames() {
    const idle = measureAlpha(this.scene, magKey('idle', 0));
    const ball = measureAlpha(this.scene, magKey('curl', MAG_FRAMES.curl - 1));
    if (idle) {
      this.frameScale = 1 / Math.max(0.2, idle.x1 - idle.x0);
      this.feetRatio = idle.y1;
    }
    if (ball) this.ballCY = (ball.y0 + ball.y1) / 2;
    this.curKey = '';
    this.showFrame(magKey('idle', 0));
    this.play(this.idleStep());
  }

  private showFrame(key: string) {
    if (this.curKey === key) return;
    this.curKey = key;
    this.sprite.setTexture(key);
    this.sprite.setScale((this.def.displayWidth * this.frameScale) / this.sprite.width);
    // วงชนยึดขนาดจากกรอบตัวบอสจริง ไม่รวมพื้นที่โปร่งใส และไม่เกี่ยวมุม
    const bodyWidth = this.sprite.width / this.frameScale;
    const bodyHeight = this.sprite.height / this.frameScale;
    const diameter = Math.min(bodyWidth, bodyHeight) * 0.68;
    this.sprite.body.setCircle(
      diameter / 2,
      (this.sprite.width - diameter) / 2,
      (this.sprite.height - diameter) / 2
    );
    this.updateGround();
  }

  // วางเงาให้อยู่ที่เท้า
  private updateGround() {
    const dh = this.sprite.displayHeight;
    this.groundOffsetY = (this.feetRatio - this.sprite.originY) * dh - dh / 2 + 4;
  }

  // ย้ายจุดหมุนไปกลางลูกกลม (ตอนหมุนลูกข่าง) โดยภาพไม่ขยับ
  private setPivot(on: boolean) {
    if (!this.useFrames || this.pivotOn === on) return;
    this.pivotOn = on;
    const oy = on ? this.ballCY : 0.5;
    this.sprite.y += (oy - this.sprite.originY) * this.sprite.displayHeight;
    this.sprite.setOrigin(0.5, oy);
    this.updateGround();
  }

  private idleStep(): Step {
    return { clip: 'idle', from: 0, to: 0, ms: 1000, then: 'hold' };
  }

  // เล่นไปข้างหน้าให้จบในเวลา totalMs
  private fwd(clip: MagClip, totalMs: number, then: Then = 'hold', lo?: number, hi?: number): Step {
    const last = MAG_FRAMES[clip] - 1;
    return { clip, from: 0, to: last, ms: Math.max(30, totalMs / Math.max(1, last)), then, lo, hi };
  }

  // เล่นย้อนจากเฟรมปัจจุบันกลับไปเฟรมแรก แล้วเปลี่ยนเป็นท่ายืน
  private rev(clip: MagClip, fromIdx: number, totalMs: number): Step {
    return { clip, from: fromIdx, to: 0, ms: Math.max(30, totalMs / Math.max(1, fromIdx)), then: 'idle' };
  }

  private play(...steps: Step[]) {
    if (!this.useFrames || !steps.length) return;
    this.queue = steps.slice(1);
    this.startStep(steps[0]);
  }

  private startStep(s: Step) {
    this.step = s;
    this.aIdx = s.from;
    this.aT = 0;
    this.aDir = s.to >= s.from ? 1 : -1;
    this.aMode = 'run';
    if (s.from === s.to) this.endRun();
  }

  private endRun() {
    const s = this.step!;
    if (this.queue.length) {
      this.startStep(this.queue.shift()!);
      return;
    }
    if (s.then === 'idle') {
      this.startStep(this.idleStep());
    } else if (s.then === 'loop') {
      this.aMode = 'loop';
    } else if (s.then === 'ping') {
      this.aMode = 'ping';
      const hi = s.hi ?? MAG_FRAMES[s.clip] - 1;
      this.aDir = this.aIdx >= hi ? -1 : 1;
    } else {
      this.aMode = 'hold';
    }
  }

  private advance() {
    const s = this.step!;
    const last = MAG_FRAMES[s.clip] - 1;
    if (this.aMode === 'run') {
      this.aIdx += this.aDir;
      if (this.aIdx === s.to) this.endRun();
    } else if (this.aMode === 'loop') {
      this.aIdx = (this.aIdx + 1) % (last + 1);
    } else if (this.aMode === 'ping') {
      const lo = s.lo ?? 0;
      const hi = s.hi ?? last;
      if (hi <= lo) return;
      if (this.aIdx + this.aDir > hi || this.aIdx + this.aDir < lo) this.aDir *= -1;
      this.aIdx = Phaser.Math.Clamp(this.aIdx + this.aDir, lo, hi);
    }
  }

  private stepAnim(delta: number) {
    if (!this.useFrames || !this.step) return;
    if (this.aMode === 'hold') this.aT = 0;
    else this.aT += delta;
    let guard = 0;
    while (this.step && this.aMode !== 'hold' && this.aT >= this.step.ms && guard++ < 12) {
      this.aT -= this.step.ms;
      this.advance();
    }
    if (this.step) this.showFrame(magKey(this.step.clip, this.aIdx));
  }

  // สลับเดิน/ยืน (รอถ้ากำลังเล่นท่าย้อนกลับอยู่)
  private locomote(moving: boolean) {
    if (!this.useFrames) return;
    if (this.aMode === 'run' || this.queue.length) return;
    const want: MagClip = moving ? 'walk' : 'idle';
    if (this.step && this.step.clip === want) return;
    this.play(moving ? { clip: 'walk', from: 0, to: 0, ms: WALK_MS, then: 'loop' } : this.idleStep());
  }

  // ======================================================
  //  ตัวช่วยเดิม
  // ======================================================
  private mouth(angle: number) {
    const r = this.radius * 0.7;
    return { x: this.sprite.x + Math.cos(angle) * r, y: this.sprite.y + Math.sin(angle) * r };
  }

  // ใช้เฉพาะตอนไม่มีรูปบอสใหม่ (ภาพเดิม)
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
      this.locomote(false);
      return;
    }
    const mult = this.rage ? PHASAMA.rageSpeedMult : 1;
    const d = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, t.x, t.y);
    const moving = d > this.radius + 24;
    if (moving) this.scene.physics.moveToObject(this.sprite, t, PHASAMA.walkSpeed * mult);
    else this.sprite.setVelocity(0);
    this.locomote(moving);
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

    if (this.useFrames) {
      const clip: MagClip = id === 'flame' ? 'flame' : id === 'dash' ? 'dash' : 'curl';
      this.play(this.fwd(clip, this.timer)); // เล่นให้ถึงเฟรมสุดท้ายพอดีตอนเริ่มโจมตี
    } else if (id === 'spin') {
      this.setBall(true);
    }
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
      const last = MAG_FRAMES.flame - 1;
      // ตอนพ่นไฟ แกว่งไป-กลับระหว่างสองเฟรมท้าย
      this.play({ clip: 'flame', from: last, to: last, ms: FLAME_HOLD_MS, then: 'ping', lo: last - 1, hi: last });
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
      this.setPivot(true); // หมุนรอบกลางลูกกลม
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
      this.enterRecover(F.recoverMs, true);
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
      this.enterRecover(D.recoverMs, true);
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
    this.sprite.setAngle(0);
    if (this.useFrames) {
      this.setPivot(false);
      const last = MAG_FRAMES.curl - 1;
      // คลายจากลูกกลมกลับเป็นยืน แล้วเข้าท่ามึน (ไป-กลับท้ายท่า)
      this.play(
        { clip: 'curl', from: last, to: 0, ms: UNCURL_MS, then: 'hold' },
        this.fwd('dizzy', DIZZY_IN_MS, 'ping', DIZZY_LOOP_FROM, MAG_FRAMES.dizzy - 1)
      );
    } else {
      this.setBall(false);
    }
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
      this.enterRecover(600, true); // เล่นย้อนกลับเป็นยืนก่อนกลับไปเดิน
    }
  }

  // ---------- recover ----------
  private enterRecover(ms: number, reverse: boolean = false) {
    this.state = 'recover';
    this.elapsed = 0;
    this.timer = ms;
    this.sprite.setVelocity(0);
    this.resetTint();
    if (reverse && this.useFrames && this.step) {
      const c = this.step.clip;
      if (c !== 'idle' && c !== 'walk') {
        this.play(this.rev(c, this.aIdx, Math.min(ms * 0.8, RETURN_MAX_MS)));
      }
    }
  }

  private updateRecover(delta: number) {
    this.timer -= delta;
    if (this.timer <= 0) this.enterChase();
  }
}