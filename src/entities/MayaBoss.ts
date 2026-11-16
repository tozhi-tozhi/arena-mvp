// บอส 2: มายา — กระโดดแยกเงา / กรงสามเหลี่ยม / (คลั่ง) หายตัวแล้วตุ้ม
// ร่างปลอมหน้าตาเหมือนตัวจริงเป๊ะ แต่ "เงาทอดผิดทิศ" — สังเกตได้ถ้าตาไว
// ตีโดนร่างปลอม = แตกเป็นเศษกระดาษ + วางสามเหลี่ยมเล็กที่เท้าผู้เล่น (เลือดบอสไม่ลด)
import Phaser from 'phaser';
import { DEPTH, WORLD_WIDTH, WORLD_HEIGHT, WALL_THICKNESS } from '../config';
import { BossBase, type BossHooks, type DecoyRef } from './BossBase';
import { BOSS_DEFS, MAYA } from '../data/bosses';
import { burst, ringEffect, showDamage } from '../systems/effects';

type State = 'chase' | 'telegraph' | 'leap' | 'vanish' | 'fall' | 'cast' | 'recover';
type AttackId = 'jump' | 'triangles' | 'vanish';

interface TriZone {
cx: number;
cy: number;
rot: number;
age: number;
exploded: boolean;
flashLeft: number;
size: number;      // ขนาดเฉพาะอัน (สามเหลี่ยมลงโทษจะเล็กกว่า)
warnMs: number;
}

interface Clone {
img: any;
shadow: any;       // เงาร่างปลอม — ทอดผิดทิศ (เบาะแสหลัก)
ox: number;
oy: number;
alive: boolean;
}

interface Snap {
t: number;
x: number;
y: number;
flip: boolean;
}

const TEX = 'boss_maya';

// ---------- ค่าปรับภาพเงา (เบาะแสแยกร่างจริง/ปลอม) ----------
// แสงเกมมาจากซ้ายบน → เงาจริงต้องทอดไปขวาล่าง
const SHADOW_DX_REAL = 7;
const SHADOW_DY_REAL = 4;
const SHADOW_DX_FAKE = -7;   // ร่างปลอม: เงาเยื้องซ้ายบน (ผิดธรรมชาติ)
const SHADOW_DY_FAKE = -4;

// ขอบเขตโลกจริง (บั๊กเดิมใช้ GAME_WIDTH/HEIGHT ทำให้มายาโจมตีไม่ถึงผู้เล่น)
function clampX(x: number) {
return Phaser.Math.Clamp(x, WALL_THICKNESS + 24, WORLD_WIDTH - WALL_THICKNESS - 24);
}
function clampY(y: number) {
return Phaser.Math.Clamp(y, WALL_THICKNESS + 24, WORLD_HEIGHT - WALL_THICKNESS - 24);
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

private lockX: number = 0;
private lockY: number = 0;
private startX: number = 0;
private startY: number = 0;

private zones: TriZone[] = [];
private waveIndex: number = 0;
private wavesTotal: number = 0;
private waveGap: number = 0;

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
this.syncRealShadow();
}

// เงาตัวจริงยึดทิศแสงเสมอ (ต่างจากร่างปลอมที่ทอดกลับด้าน)
private syncRealShadow() {
if (!this.shadowVisible) return;
this.shadow.setPosition(
  this.sprite.x + SHADOW_DX_REAL,
  this.sprite.y + this.sprite.displayHeight / 2 - 4 + this.groundOffsetY + SHADOW_DY_REAL
);
}

protected onRage() {
this.pool = ['vanish', 'triangles'];
this.clearClones(true);
this.zones = [];
this.gfx.clear();
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

// =====================================================
//  ร่างลวง — ให้ GameScene เรียกตรวจตอนผู้เล่นโจมตี
// =====================================================
getDecoys(): DecoyRef[] {
const out: DecoyRef[] = [];
this.clones.forEach((c, i) => {
  if (!c.alive || !c.img.active) return;
  out.push({ x: c.img.x, y: c.img.y, r: this.radius, index: i });
});
return out;
}

hitDecoy(index: number): boolean {
const c = this.clones[index];
if (!c || !c.alive || !c.img.active) return false;
c.alive = false;

const x = c.img.x;
const y = c.img.y;

// แตกเป็นเศษกระดาษ — เห็นชัดว่าตีผิด
this.scene.tweens.killTweensOf(c.img);
burst(this.scene, x, y, 0xd8c0ff, 16, 70, 6);
ringEffect(this.scene, x, y, 52, 0xb7a0ff, 260);
showDamage(this.scene, x, y - 30, 'ร่างปลอม!', '#c9b0ff', 800);
this.scene.tweens.add({
  targets: c.img, alpha: 0, scaleX: c.img.scaleX * 1.2, scaleY: c.img.scaleY * 0.7,
  duration: 180, onComplete: () => c.img.destroy()
});
this.scene.tweens.add({
  targets: c.shadow, alpha: 0, duration: 180, onComplete: () => c.shadow.destroy()
});

// ตีผิดมีราคา: สามเหลี่ยมเล็กโผล่ที่เท้าผู้เล่น
this.spawnPunishTri();
return true;
}

private spawnPunishTri() {
const t = this.nearestTarget();
if (!t) return;
const C = MAYA.clone;
this.zones.push({
  cx: clampX(t.x),
  cy: clampY(t.y),
  rot: Math.random() * Math.PI * 2,
  age: 0,
  exploded: false,
  flashLeft: 0,
  size: C.punishTriSize,
  warnMs: C.punishWarnMs
});
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

// ---------- กรงสามเหลี่ยม: ล้อมผู้เล่น เหลือช่องหนี 1 ทิศ ----------
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

// วาดทุกโซนที่มีอยู่ (รวมสามเหลี่ยมลงโทษจากการตีผิดร่าง)
for (const z of this.zones) {
  z.age += delta;
  if (!z.exploded) {
    const p = Phaser.Math.Clamp(z.age / z.warnMs, 0, 1);
    this.drawTri(z, p);
    if (z.age >= z.warnMs) {
      z.exploded = true;
      z.flashLeft = T.flashMs;
      this.explodeZone(z);
    }
  } else {
    z.flashLeft -= delta;
    const v = triVerts(z.cx, z.cy, z.rot, z.size);
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

if (this.state !== 'cast') return;

if (this.zones.length === 0) {
  this.waveGap -= delta;
  if (this.waveGap <= 0) {
    if (this.waveIndex >= this.wavesTotal) {
      this.enterRecover(T.recoverMs);
      return;
    }
    this.spawnCageWave();
    this.waveIndex++;
  }
} else {
  this.waveGap = T.gapMs;
}
}

// กรง: แบ่งวงรอบผู้เล่นเป็น 6 ช่อง วางสามเหลี่ยม 3 ช่อง เว้นทางหนี
private spawnCageWave() {
const T = MAYA.tri;
const t = this.nearestTarget();
if (!t) return;

const slots = T.cageGapSlots;
const count = Math.min(T.cageCount, slots - 1);
const baseAngle = Math.random() * Math.PI * 2;
const gapSlot = Phaser.Math.Between(0, slots - 1);

const usable: number[] = [];
for (let i = 0; i < slots; i++) {
  if (i === gapSlot) continue;
  usable.push(i);
}
// เรียงช่องตามระยะห่างจากช่องว่าง (ไกลสุดก่อน) — ทางหนีจะได้กว้างจริง
usable.sort((a, b) => {
  const da = Math.min(Math.abs(a - gapSlot), slots - Math.abs(a - gapSlot));
  const db = Math.min(Math.abs(b - gapSlot), slots - Math.abs(b - gapSlot));
  return db - da;
});

for (let i = 0; i < count; i++) {
  const slot = usable[i % usable.length];
  const a = baseAngle + (slot * Math.PI * 2) / slots;
  const cx = clampX(t.x + Math.cos(a) * T.cageRingDist);
  const cy = clampY(t.y + Math.sin(a) * T.cageRingDist);
  this.zones.push({
    cx, cy,
    rot: a + Math.PI,           // หันยอดเข้าหาผู้เล่น อ่านทิศง่าย
    age: 0, exploded: false, flashLeft: 0,
    size: T.size, warnMs: T.warnMs
  });
}
}

private drawTri(z: TriZone, p: number) {
const g = this.gfx;
const v = triVerts(z.cx, z.cy, z.rot, z.size);
g.fillStyle(0xb07aff, 0.1 + 0.2 * p);
g.beginPath();
g.moveTo(v[0][0], v[0][1]);
g.lineTo(v[1][0], v[1][1]);
g.lineTo(v[2][0], v[2][1]);
g.closePath();
g.fillPath();
g.lineStyle(3, 0xd8c0ff, 0.9);
g.strokePath();

const w = triVerts(z.cx, z.cy, z.rot, z.size * p);
g.fillStyle(0xb07aff, 0.35);
g.beginPath();
g.moveTo(w[0][0], w[0][1]);
g.lineTo(w[1][0], w[1][1]);
g.lineTo(w[2][0], w[2][1]);
g.closePath();
g.fillPath();
}

private explodeZone(z: TriZone) {
burst(this.scene, z.cx, z.cy, 0xd8c0ff, 12, z.size, 6);
ringEffect(this.scene, z.cx, z.cy, z.size * 0.9, 0xb07aff, 300);
this.scene.cameras.main.shake(100, 0.006);
const hitV = triVerts(z.cx, z.cy, z.rot, z.size + 12);
for (const t of this.hooks.getTargets()) {
  if (inTri(t.x, t.y, hitV)) this.hooks.onHitTarget(t, MAYA.tri.damage, z.cx, z.cy);
}
}

// ---------- ร่างปลอม: หน้าตาเหมือนตัวจริง เงาผิดทิศ ----------
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

  // เงาก่อน (อยู่ใต้ตัว) — ทอดซ้ายบน = ผิดกฎแสงของเกม
  const shadow = this.scene.add
    .ellipse(cx + SHADOW_DX_FAKE, cy + this.sprite.displayHeight / 2 - 4 + SHADOW_DY_FAKE,
      this.def.displayWidth * 0.85, this.def.displayWidth * 0.22, 0x000000, 0.35)
    .setDepth(DEPTH.ENEMY_SHADOW);

  const img: any = this.scene.add.image(cx, cy, TEX);
  img.setScale(this.sprite.scaleX, this.sprite.scaleY);
  img.setDepth(DEPTH.ENEMY);
  img.setFlipX(this.sprite.flipX);
  img.setAlpha(0);
  // ไม่ติดสีต่าง ไม่กระพริบ — เหมือนตัวจริงทุกประการ
  if (this.rage) img.setTint(0xffb0a0);

  this.scene.tweens.add({ targets: img, alpha: 1, duration: 220 });
  shadow.setAlpha(0);
  this.scene.tweens.add({ targets: shadow, alpha: 0.35, duration: 220 });

  burst(this.scene, cx, cy, 0xb7a0ff, 6, 30, 4);
  this.clones.push({ img, shadow, ox: cx - this.sprite.x, oy: cy - this.sprite.y, alive: true });
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
  if (!c.alive || !c.img.active) continue;
  const x = clampX(snap.x + c.ox);
  const y = clampY(snap.y + c.oy);
  c.img.setPosition(x, y);
  c.img.setFlipX(snap.flip);
  c.img.setScale(this.sprite.scaleX, this.sprite.scaleY);
  c.shadow.setPosition(
    x + SHADOW_DX_FAKE,
    y + this.sprite.displayHeight / 2 - 4 + SHADOW_DY_FAKE
  );
}
}

private clearClones(animate: boolean) {
const list = this.clones;
this.clones = [];
for (const c of list) {
  this.scene.tweens.killTweensOf(c.img);
  this.scene.tweens.killTweensOf(c.shadow);
  if (animate) {
    this.scene.tweens.add({ targets: c.img, alpha: 0, duration: 250, onComplete: () => c.img.destroy() });
    this.scene.tweens.add({ targets: c.shadow, alpha: 0, duration: 250, onComplete: () => c.shadow.destroy() });
  } else {
    c.img.destroy();
    c.shadow.destroy();
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