// บอส 2: มายา — กระโดดแยกร่าง / ระเบิดสามเหลี่ยม / (คลั่ง) หายตัวแล้วตุ้ม
import Phaser from 'phaser';
import { DEPTH, GAME_WIDTH, GAME_HEIGHT, WALL_THICKNESS } from '../config';
import { BossBase, type BossHooks } from './BossBase';
import { BOSS_DEFS, MAYA } from '../data/bosses';
import { burst, ringEffect } from '../systems/effects';

type State = 'chase' | 'telegraph' | 'leap' | 'vanish' | 'fall' | 'cast' | 'recover';
type AttackId = 'jump' | 'triangles' | 'vanish';

interface TriZone {
  cx: number;
  cy: number;
  rot: number;
  age: number;
  exploded: boolean;
  flashLeft: number;
}
interface Clone {
  img: any;
  ox: number;
  oy: number;
}
interface Snap {
  t: number;
  x: number;
  y: number;
  flip: boolean;
}

const TEX = 'boss_maya';

function clampX(x: number) {
  return Phaser.Math.Clamp(x, WALL_THICKNESS + 24, GAME_WIDTH - WALL_THICKNESS - 24);
}
function clampY(y: number) {
  return Phaser.Math.Clamp(y, WALL_THICKNESS + 24, GAME_HEIGHT - WALL_THICKNESS - 24);
}

function triVerts(cx: number, cy: number, rot: number, r: number): number[][] {
  return [0, 1, 2].map((k) => {
    const a = rot + (k * Math.PI * 2) / 3;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
}

function inTri(px: number, py: number, v: number[][]): boolean {
  const s = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) =>
    (ax - cx) * (by - cy) - (bx - cx) * (ay - cy);
  const d1 = s(px, py, v[0][0], v[0][1], v[1][0], v[1][1]);
  const d2 = s(px, py, v[1][0], v[1][1], v[2][0], v[2][1]);
  const d3 = s(px, py, v[2][0], v[2][1], v[0][0], v[0][1]);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

export class MayaBoss extends BossBase {
  private state: State = 'chase';
  private timer: number = 0;
  private elapsed: number = 0;
  private pool: AttackId[] = ['jump', 'triangles'];
  private lastAttack: AttackId | '' = '';
  private current: AttackId = 'jump';
  private baseScale: number;

  // จุดที่จะลง (วงเตือนบนพื้น)
  private lockX: number = 0;
  private lockY: number = 0;
  private startX: number = 0;
  private startY: number = 0;

  // ระเบิดสามเหลี่ยม
  private zones: TriZone[] = [];
  private waveIndex: number = 0;
  private wavesTotal: number = 0;
  private waveGap: number = 0;

  // ร่างปลอม
  private clones: Clone[] = [];
  private history: Snap[] = [];
  private splitAt: number = 0;
  private cloneUntil: number = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, hooks: BossHooks) {
    super(scene, BOSS_DEFS.maya, TEX, x, y, hooks);
    this.baseScale = this.sprite.scaleX;
    this.enterChase();
  }

  protected tick(delta: number) {
    this.elapsed += delta;
    const now = this.scene.time.now;

    // บันทึกตำแหน่งตัวจริง ไว้ให้ร่างปลอมเลียนแบบช้ากว่า
    this.history.push({ t: now, x: this.sprite.x, y: this.sprite.y, flip: this.sprite.flipX });
    while (this.history.length > 2 && now - this.history[0].t > 1500) this.history.shift();

    switch (this.state) {
      case 'chase': this.updateChase(delta); break;
      case 'telegraph': this.updateTelegraph(delta); break;
      case 'leap': this.updateLeap(); break;
      case 'vanish': this.updateVanish(delta); break;
      case 'fall': this.updateFall(); break;
      case 'cast': this.updateCast(delta); break;
      case 'recover': this.updateRecover(delta); break;
    }

    this.updateClones(now);
  }

  protected onRage() {
    this.pool = ['vanish', 'triangles'];
    this.clearClones(true);
    this.zones = [];
    this.gfx.clear();

    // ถ้าถูกขัดกลางอากาศ ให้ลงพื้น
    this.sprite.y += this.groundOffsetY;
    this.groundOffsetY = 0;
    this.sprite.setAlpha(1);
    this.sprite.body.enable = true;
    this.targetable = true;
    this.shadowVisible = true;
    this.resetScale();
    this.enterRecover(1200);
  }

  protected onDie() {
    this.clearClones(false);
    this.zones = [];
  }

  // ---------- ตัวช่วย ----------
  private resetScale() {
    this.sprite.setScale(this.baseScale);
  }

  private pickAttack(): AttackId {
    const options = this.pool.length > 1 ? this.pool.filter((id) => id !== this.lastAttack) : this.pool;
    return options[Phaser.Math.Between(0, options.length - 1)];
  }

  private drawMarker(radius: number, p: number, color: number) {
    const g = this.gfx;
    g.clear();
    g.fillStyle(color, 0.12 + 0.18 * p);
    g.fillCircle(this.lockX, this.lockY, radius);
    g.lineStyle(3, color, 0.9);
    g.strokeCircle(this.lockX, this.lockY, radius);
    g.fillStyle(color, 0.3);
    g.fillCircle(this.lockX, this.lockY, radius * p);
  }

  // ---------- chase ----------
  private enterChase() {
    this.state = 'chase';
    this.elapsed = 0;
    this.timer = Phaser.Math.Between(MAYA.chaseMs[0], MAYA.chaseMs[1]);
    this.resetTint();
  }

  private updateChase(delta: number) {
    const t = this.nearestTarget();
    if (!t) {
      this.sprite.setVelocity(0);
      return;
    }
    const mult = this.rage ? MAYA.rageSpeedMult : 1;
    const d = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, t.x, t.y);
    if (d > this.radius + 40) this.scene.physics.moveToObject(this.sprite, t, MAYA.walkSpeed * mult);
    else this.sprite.setVelocity(0);
    this.sprite.setFlipX(this.sprite.x >= t.x);

    this.timer -= delta;
    if (this.timer <= 0) this.startTelegraph(this.pickAttack(), t);
  }

  // ---------- telegraph ----------
  private startTelegraph(id: AttackId, t: any) {
    this.current = id;
    this.lastAttack = id;
    this.elapsed = 0;
    this.sprite.setVelocity(0);
    this.lockX = clampX(t.x);
    this.lockY = clampY(t.y);

    if (id === 'vanish') {
      this.state = 'vanish';
      this.timer = MAYA.vanish.telegraphMs;
      this.targetable = false;
      this.shadowVisible = false;
      this.sprite.body.enable = false;
      this.sprite.setVelocity(0);
      this.scene.tweens.add({ targets: this.sprite, alpha: 0, duration: 120 });
      return;
    }

    this.state = 'telegraph';
    this.timer = id === 'jump' ? MAYA.jump.telegraphMs : MAYA.tri.windupMs;
  }

  private updateTelegraph(delta: number) {
    this.timer -= delta;
    const total = this.current === 'jump' ? MAYA.jump.telegraphMs : MAYA.tri.windupMs;
    const p = Phaser.Math.Clamp(1 - this.timer / total, 0, 1);

    if (this.current === 'jump') this.drawMarker(MAYA.jump.radius, p, 0xb07aff);

    // ย่อตัวเตรียมโดด
    this.sprite.setScale(this.baseScale * (1 + 0.08 * p), this.baseScale * (1 - 0.15 * p));
    if (Math.floor(this.elapsed / 100) % 2 === 0) this.sprite.setTint(0xcaa8ff);
    else this.resetTint();

    if (this.timer <= 0) {
      this.resetTint();
      if (this.current === 'jump') this.startLeap();
      else this.startCast();
    }
  }

  // ---------- jump ----------
  private startLeap() {
    this.state = 'leap';
    this.elapsed = 0;
    this.startX = this.sprite.x;
    this.startY = this.sprite.y;
    this.sprite.setFlipX(this.lockX < this.sprite.x);
  }

  private updateLeap() {
    const J = MAYA.jump;
    const k = Phaser.Math.Clamp(this.elapsed / J.flightMs, 0, 1);
    const e = 0.5 - 0.5 * Math.cos(Math.PI * k);
    const gx = Phaser.Math.Linear(this.startX, this.lockX, e);
    const gy = Phaser.Math.Linear(this.startY, this.lockY, e);
    const arc = Math.sin(Math.PI * k) * 90;

    this.sprite.setPosition(gx, gy - arc);
    this.groundOffsetY = arc;
    this.sprite.setScale(this.baseScale * (1 + 0.2 * Math.sin(Math.PI * k)));
    this.drawMarker(J.radius, k, 0xb07aff);

    if (k >= 1) this.land(J.radius, J.damage, MAYA.clone.count, J.recoverMs);
  }

  private land(radius: number, damage: number, cloneCount: number, recoverMs: number) {
    this.sprite.body.reset(this.lockX, this.lockY);
    this.groundOffsetY = 0;
    this.resetScale();
    this.gfx.clear();

    ringEffect(this.scene, this.lockX, this.lockY, radius, 0xb07aff, 350);
    burst(this.scene, this.lockX, this.lockY, 0xd8c0ff, 14, radius * 0.8, 6);
    this.scene.cameras.main.shake(220, 0.015);

    for (const t of this.hooks.getTargets()) {
      const d = Phaser.Math.Distance.Between(this.lockX, this.lockY, t.x, t.y);
      if (d <= radius) this.hooks.onHitTarget(t, damage, this.lockX, this.lockY);
    }

    this.split(cloneCount);
    this.enterRecover(recoverMs);
  }

  // ---------- vanish -> fall (ตอนคลั่ง) ----------
  private updateVanish(delta: number) {
    const V = MAYA.vanish;
    this.timer -= delta;

    // วงเตือนตามผู้เล่นช่วงแรก แล้วล็อกไว้ช่วงท้าย (ให้หลบทัน)
    const t = this.nearestTarget();
    if (t && this.elapsed < V.trackMs) {
      this.lockX = clampX(t.x);
      this.lockY = clampY(t.y);
    }
    this.drawMarker(V.radius, Phaser.Math.Clamp(this.elapsed / V.telegraphMs, 0, 1), 0xff5a8a);

    if (this.timer <= 0) this.startFall();
  }

  private startFall() {
    this.state = 'fall';
    this.elapsed = 0;
    this.sprite.setPosition(this.lockX, this.lockY - 260);
    this.sprite.setAlpha(1);
    this.sprite.setScale(this.baseScale * 1.25);
    this.shadowVisible = true;
    this.groundOffsetY = 260;
  }

  private updateFall() {
    const V = MAYA.vanish;
    const k = Phaser.Math.Clamp(this.elapsed / V.fallMs, 0, 1);
    const h = 260 * (1 - k * k);
    this.sprite.setPosition(this.lockX, this.lockY - h);
    this.groundOffsetY = h;
    this.drawMarker(V.radius, 1, 0xff5a8a);

    if (k >= 1) {
      this.sprite.body.enable = true;
      this.targetable = true;
      this.land(V.radius, V.damage, MAYA.clone.countRage, V.recoverMs);
    }
  }

  // ---------- triangles: ระเบิดสามเหลี่ยม ทีละระลอก ----------
  private startCast() {
    this.state = 'cast';
    this.elapsed = 0;
    this.zones = [];
    this.waveIndex = 0;
    this.wavesTotal = this.rage ? MAYA.tri.wavesRage : MAYA.tri.waves;
    this.waveGap = MAYA.tri.gapMs;
    this.resetScale();
    this.sprite.setVelocity(0);
    this.gfx.clear();
  }

  private updateCast(delta: number) {
    const T = MAYA.tri;
    const g = this.gfx;
    g.clear();

    if (this.zones.length === 0) {
      this.waveGap -= delta;
      if (this.waveGap <= 0) {
        if (this.waveIndex >= this.wavesTotal) {
          this.enterRecover(T.recoverMs);
          return;
        }
        this.spawnWave();
        this.waveIndex++;
      }
      return;
    }

    for (const z of this.zones) {
      z.age += delta;
      if (!z.exploded) {
        const p = Phaser.Math.Clamp(z.age / T.warnMs, 0, 1);
        this.drawTri(z, p);
        if (z.age >= T.warnMs) {
          z.exploded = true;
          z.flashLeft = T.flashMs;
          this.explodeZone(z);
        }
      } else {
        z.flashLeft -= delta;
        const v = triVerts(z.cx, z.cy, z.rot, T.size);
        g.fillStyle(0xffffff, 0.6 * Phaser.Math.Clamp(z.flashLeft / T.flashMs, 0, 1));
        g.beginPath();
        g.moveTo(v[0][0], v[0][1]);
        g.lineTo(v[1][0], v[1][1]);
        g.lineTo(v[2][0], v[2][1]);
        g.closePath();
        g.fillPath();
      }
    }

    this.zones = this.zones.filter((z) => !(z.exploded && z.flashLeft <= 0));
    if (this.zones.length === 0) this.waveGap = T.gapMs;
  }

  private spawnWave() {
    const T = MAYA.tri;
    const count = this.rage ? T.perWaveRage : T.perWave;
    const t = this.nearestTarget();

    for (let i = 0; i < count; i++) {
      let cx = 0;
      let cy = 0;
      for (let attempt = 0; attempt < 12; attempt++) {
        if (t && Math.random() < T.nearPlayerChance) {
          cx = t.x + Phaser.Math.Between(-T.nearRadius, T.nearRadius);
          cy = t.y + Phaser.Math.Between(-T.nearRadius, T.nearRadius);
        } else {
          cx = Phaser.Math.Between(70, GAME_WIDTH - 70);
          cy = Phaser.Math.Between(70, GAME_HEIGHT - 70);
        }
        cx = clampX(cx);
        cy = clampY(cy);
        if (Phaser.Math.Distance.Between(cx, cy, this.sprite.x, this.sprite.y) >= T.minDistFromBoss) break;
      }
      this.zones.push({ cx, cy, rot: Math.random() * Math.PI * 2, age: 0, exploded: false, flashLeft: 0 });
    }
  }

  private drawTri(z: TriZone, p: number) {
    const T = MAYA.tri;
    const g = this.gfx;
    const v = triVerts(z.cx, z.cy, z.rot, T.size);

    g.fillStyle(0xb07aff, 0.1 + 0.2 * p);
    g.beginPath();
    g.moveTo(v[0][0], v[0][1]);
    g.lineTo(v[1][0], v[1][1]);
    g.lineTo(v[2][0], v[2][1]);
    g.closePath();
    g.fillPath();
    g.lineStyle(3, 0xd8c0ff, 0.9);
    g.strokePath();

    // สามเหลี่ยมในขยายจนเต็ม = ระเบิด
    const w = triVerts(z.cx, z.cy, z.rot, T.size * p);
    g.fillStyle(0xb07aff, 0.35);
    g.beginPath();
    g.moveTo(w[0][0], w[0][1]);
    g.lineTo(w[1][0], w[1][1]);
    g.lineTo(w[2][0], w[2][1]);
    g.closePath();
    g.fillPath();
  }

  private explodeZone(z: TriZone) {
    const T = MAYA.tri;
    burst(this.scene, z.cx, z.cy, 0xd8c0ff, 12, T.size, 6);
    ringEffect(this.scene, z.cx, z.cy, T.size * 0.9, 0xb07aff, 300);
    this.scene.cameras.main.shake(100, 0.006);

    const hitV = triVerts(z.cx, z.cy, z.rot, T.size + 12);
    for (const t of this.hooks.getTargets()) {
      if (inTri(t.x, t.y, hitV)) this.hooks.onHitTarget(t, T.damage, z.cx, z.cy);
    }
  }

  // ---------- ร่างปลอม (ภาพติดตา) ----------
  private split(count: number) {
    this.clearClones(false);
    const C = MAYA.clone;
    const now = this.scene.time.now;
    this.splitAt = now;
    this.cloneUntil = now + C.durationMs;

    const baseAngle = Math.random() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const a = baseAngle + (i * Math.PI * 2) / count;
      const dist = Phaser.Math.Between(C.distMin, C.distMax);
      const cx = clampX(this.sprite.x + Math.cos(a) * dist);
      const cy = clampY(this.sprite.y + Math.sin(a) * dist);

      const img: any = this.scene.add.image(cx, cy, TEX);
      img.setScale(this.sprite.scaleX, this.sprite.scaleY);
      img.setTint(0xb7a0ff);
      img.setAlpha(0);
      img.setDepth(DEPTH.ENEMY);
      img.setFlipX(this.sprite.flipX);

      this.scene.tweens.add({
        targets: img,
        alpha: C.alpha,
        duration: 250,
        onComplete: () => {
          if (img.active) {
            this.scene.tweens.add({ targets: img, alpha: C.alpha * 0.6, duration: 260, yoyo: true, repeat: -1 });
          }
        }
      });
      burst(this.scene, cx, cy, 0xb7a0ff, 6, 30, 4);

      this.clones.push({ img, ox: cx - this.sprite.x, oy: cy - this.sprite.y });
    }
  }

  private snapAt(time: number): Snap {
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i].t <= time) return this.history[i];
    }
    return this.history[0];
  }

  private updateClones(now: number) {
    if (this.clones.length === 0 || this.history.length === 0) return;
    if (now >= this.cloneUntil) {
      this.clearClones(true);
      return;
    }
    const snap = this.snapAt(Math.max(this.splitAt, now - MAYA.clone.delayMs));
    for (const c of this.clones) {
      c.img.setPosition(clampX(snap.x + c.ox), clampY(snap.y + c.oy));
      c.img.setFlipX(snap.flip);
      c.img.setScale(this.sprite.scaleX, this.sprite.scaleY);
    }
  }

  private clearClones(animate: boolean) {
    const list = this.clones;
    this.clones = [];
    for (const c of list) {
      this.scene.tweens.killTweensOf(c.img);
      if (animate) {
        this.scene.tweens.add({ targets: c.img, alpha: 0, duration: 250, onComplete: () => c.img.destroy() });
      } else {
        c.img.destroy();
      }
    }
  }

  // ---------- recover ----------
  private enterRecover(ms: number) {
    this.state = 'recover';
    this.elapsed = 0;
    this.timer = ms;
    this.sprite.setVelocity(0);
    this.resetScale();
    this.resetTint();
  }

  private updateRecover(delta: number) {
    this.timer -= delta;
    if (this.timer <= 0) this.enterChase();
  }
}