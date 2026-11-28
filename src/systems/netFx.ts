// src/systems/netFx.ts — ตัวห่อเอฟเฟกต์: เล่นบนเครื่องเราเหมือนเดิม + ส่งเหตุการณ์สั้น ๆ ให้เพื่อนเล่นภาพเดียวกัน
// ชื่อและ signature ตรงกับของเดิม (pixelFx / effects / combatFx) — Kit เปลี่ยนแค่บรรทัด import
// ฝั่งรับ (playRemoteFx) เป็นภาพล้วน ไม่มีดาเมจ ไม่มี hitbox
import Phaser from 'phaser';
import { DEPTH } from '../config';
import { spawnPixelFx as realPixelFx, PIXELFX, type PixelFxId, type PixelFxOpts } from './pixelFx';
import { burst as realBurst, ringEffect as realRing, spawnThrustDir as realThrustDir } from './effects';
import { spawnArcSlash as realArc } from './combatFx';
import { sfx as realSfx } from './sfx';
type Sink = (e: any) => void;
let sink: Sink | null = null;

/** NetGhosts ตั้งไว้ตอนสร้าง · ตั้ง null ตอนทำลาย — ไม่มีตัวรับ = ทำงานเหมือนของเดิมเป๊ะ */
export function setNetFxSink(s: Sink | null) {
  sink = s;
}

// ---------------------------------------------------------------
// ภาพวาดเอง (ภาพล้วน ไม่มีดาเมจ) — ใช้ทั้งฝั่งเราและฝั่งเพื่อน
// ---------------------------------------------------------------
/** ฝาแฝดภาพของคลื่นดาบ: บินตรงไปตามทิศแล้วจาง (ตัวชนจริงอยู่ใน AkkhaniKit ไม่เกี่ยวกับตัวนี้) */
function drawWave(scene: Phaser.Scene, x: number, y: number, dx: number, dy: number, halfWidth: number, range: number, speed: number) {
  const g = scene.add.graphics();
  g.setDepth(DEPTH.SLASH);
  g.setBlendMode(Phaser.BlendModes.ADD);
  const cx = -halfWidth * 0.4;
  g.lineStyle(12, 0xff6a3a, 0.28);
  g.beginPath();
  g.arc(cx, 0, halfWidth, -1.2, 1.2, false);
  g.strokePath();
  g.lineStyle(5, 0xffd9a0, 0.95);
  g.beginPath();
  g.arc(cx, 0, halfWidth, -1.2, 1.2, false);
  g.strokePath();
  g.setPosition(x, y);
  g.setRotation(Math.atan2(dy, dx));
  scene.tweens.add({
    targets: g,
    x: x + dx * range,
    y: y + dy * range,
    duration: Math.max(100, (range / Math.max(1, speed)) * 1000),
    onComplete: () => {
      scene.tweens.add({ targets: g, alpha: 0, duration: 140, onComplete: () => g.destroy() });
    }
  });
}

/** แผ่นแสงวาบ + รอยแตกพื้นของไม้ตาย B (fy = ระดับพื้นที่เท้า) */
function drawSlamGround(scene: Phaser.Scene, x: number, fy: number, R: number) {
  const disk = scene.add.circle(x, fy, R, 0xffd9a0, 0.35);
  disk.setBlendMode(Phaser.BlendModes.ADD);
  disk.setDepth(DEPTH.BURST);
  disk.setScale(0.2);
  scene.tweens.add({ targets: disk, scale: 1, alpha: 0, duration: 380, onComplete: () => disk.destroy() });

  const cracks = scene.add.graphics();
  cracks.setDepth(DEPTH.ENEMY_SHADOW);
  cracks.setBlendMode(Phaser.BlendModes.ADD);
  for (const [width, alpha, color] of [[8, 0.25, 0xff6a3a], [3, 0.95, 0xffe2b0]] as Array<[number, number, number]>) {
    cracks.lineStyle(width, color, alpha);
    for (let k = 0; k < 10; k++) {
      const a = (k * Math.PI * 2) / 10 + Phaser.Math.FloatBetween(-0.15, 0.15);
      const len = R * Phaser.Math.FloatBetween(0.7, 1.05);
      cracks.beginPath();
      cracks.moveTo(x, fy);
      for (let s = 1; s <= 3; s++) {
        const aa = a + Phaser.Math.FloatBetween(-0.25, 0.25);
        cracks.lineTo(x + (Math.cos(aa) * (len * s)) / 3, fy + (Math.sin(aa) * (len * s)) / 3);
      }
      cracks.strokePath();
    }
  }
  scene.tweens.add({ targets: cracks, alpha: 0, delay: 350, duration: 650, onComplete: () => cracks.destroy() });
}

/** ดาว N แฉกเส้นตัดกัน (จุดยอด k เชื่อมจุด k+3) เรืองแสง ค้างสั้น ๆ แล้วจาง */
function drawStar(scene: Phaser.Scene, cx: number, cy: number, radius: number, points: number) {
  const g = scene.add.graphics();
  g.setDepth(DEPTH.ENEMY_SHADOW);
  g.setBlendMode(Phaser.BlendModes.ADD);
  const pts: { x: number; y: number }[] = [];
  for (let k = 0; k < points; k++) {
    const a = -Math.PI / 2 + (k * Math.PI * 2) / points;
    pts.push({ x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius });
  }
  for (const [width, alpha, color] of [[12, 0.22, 0xff3b2f], [4, 0.95, 0xffb08a]] as Array<[number, number, number]>) {
    g.lineStyle(width, color, alpha);
    for (let k = 0; k < points; k++) {
      const a = pts[k];
      const b = pts[(k + 3) % points];
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.strokePath();
    }
    g.beginPath();
    g.arc(cx, cy, radius, 0, Math.PI * 2, false);
    g.strokePath();
  }
  scene.tweens.add({ targets: g, alpha: 0, delay: 260, duration: 480, onComplete: () => g.destroy() });
}

/** เงาดาบ N เล่มล้อมตัว หมุนแล้วรวมเข้าหากลาง (ช่วงร่ายไม้ตาย C) */
function drawBlades(scene: Phaser.Scene, cx: number, cy: number, points: number, windupMs: number) {
  const blades = scene.add.graphics();
  blades.setDepth(DEPTH.SLASH);
  blades.setBlendMode(Phaser.BlendModes.ADD);
  blades.lineStyle(4, 0xffb15a, 0.9);
  for (let k = 0; k < points; k++) {
    const a = -Math.PI / 2 + (k * Math.PI * 2) / points;
    blades.beginPath();
    blades.moveTo(Math.cos(a) * 34, Math.sin(a) * 34);
    blades.lineTo(Math.cos(a) * 66, Math.sin(a) * 66);
    blades.strokePath();
  }
  blades.setPosition(cx, cy);
  blades.setAlpha(0);
  scene.tweens.add({
    targets: blades,
    alpha: 1,
    rotation: 1.2,
    duration: windupMs,
    onComplete: () => {
      scene.tweens.add({ targets: blades, alpha: 0, scale: 0.2, duration: 160, onComplete: () => blades.destroy() });
    }
  });
}

// ---------------------------------------------------------------
// ฝั่งส่ง — ใช้แทนฟังก์ชันเดิมได้ทันที
// ---------------------------------------------------------------
export function spawnPixelFx(scene: Phaser.Scene, id: PixelFxId, o: PixelFxOpts): Phaser.GameObjects.Sprite | null {
  const s = realPixelFx(scene, id, o);
  // ส่งเฉพาะเมื่อภาพเล่นได้จริง (ถ้าไม่มีไฟล์ ของเราใช้ fallback ซึ่งเป็นเอฟเฟกต์อื่นที่ส่งของมันเอง)
  if (s && sink) {
    sink({
      k: 'px', id, x: o.x, y: o.y, sc: o.scale, fl: o.flipX, an: o.angle, ti: o.tint,
      ad: o.add, dp: o.depth, al: o.alpha, fit: o.fitMs, dur: o.durationMs, fo: o.fadeOutMs,
      fol: !!o.follow
    });
  }
  return s;
}

export function burst(scene: Phaser.Scene, x: number, y: number, color: number, count: number, dist: number, size: number) {
  realBurst(scene, x, y, color, count, dist, size);
  if (sink) sink({ k: 'bu', x, y, c: color, n: count, d: dist, s: size });
}

export function ringEffect(scene: Phaser.Scene, x: number, y: number, radius: number, color: number, duration: number) {
  realRing(scene, x, y, radius, color, duration);
  if (sink) sink({ k: 'ri', x, y, r: radius, c: color, ms: duration });
}

export function spawnThrustDir(scene: Phaser.Scene, x: number, y: number, dx: number, dy: number, length: number, level: number = 1) {
  realThrustDir(scene, x, y, dx, dy, length, level);
  if (sink) sink({ k: 'th', x, y, dx, dy, len: length, lv: level });
}

export function spawnArcSlash(
  scene: Phaser.Scene, x: number, y: number, angleRad: number, range: number,
  halfAngleDeg: number, color: number, lineWidth: number, ms: number
) {
  realArc(scene, x, y, angleRad, range, halfAngleDeg, color, lineWidth, ms);
  if (sink) sink({ k: 'ar', x, y, a: angleRad, r: range, h: halfAngleDeg, c: color, w: lineWidth, ms });
}

/** คลื่นดาบ: ตัวของเรามีอยู่แล้วใน AkkhaniKit (เป็นตัวชนจริง) — ฟังก์ชันนี้แค่ส่งให้เพื่อนสร้างฝาแฝดภาพ */
export function emitWaveFx(x: number, y: number, dx: number, dy: number, halfWidth: number, range: number, speed: number) {
  if (sink) sink({ k: 'wv', x, y, dx, dy, hw: halfWidth, rg: range, sp: speed });
}

/** แผ่นแสง + รอยแตกพื้น (ไม้ตาย B) */
export function slamGroundFx(scene: Phaser.Scene, x: number, fy: number, R: number) {
  drawSlamGround(scene, x, fy, R);
  if (sink) sink({ k: 'sg', x, y: fy, r: R });
}

/** ดาว N แฉก (ไม้ตาย C) */
export function starFx(scene: Phaser.Scene, cx: number, cy: number, radius: number, points: number) {
  drawStar(scene, cx, cy, radius, points);
  if (sink) sink({ k: 'st', x: cx, y: cy, r: radius, n: points });
}

/** ดาบรอบตัว (ไม้ตาย C ช่วงร่าย) */
export function bladesFx(scene: Phaser.Scene, cx: number, cy: number, points: number, windupMs: number) {
  drawBlades(scene, cx, cy, points, windupMs);
  if (sink) sink({ k: 'bl', x: cx, y: cy, n: points, ms: windupMs });
}
// ---------------------------------------------------------------
// ลูมิ + เงาตามหลัง + แฟลชปากกระบอก
// ---------------------------------------------------------------
interface RShot {
  circle: any;
  halo: any;
  timer: any;
  tween: any;
}
const rshots = new Map<number, RShot>();
let shotBase = Math.floor(Math.random() * 1000000000);
let shotN = 0;

function killShot(sid: number) {
  const s = rshots.get(sid);
  if (!s) return;
  rshots.delete(sid);
  s.timer.remove(false);
  s.tween.stop();
  s.circle.destroy();
  s.halo.destroy();
}

/** กระสุนภาพล้วนฝั่งเพื่อน — ไม่ชนอะไร บินตามระยะ หยุดเมื่อได้รับสัญญาณระเบิดของเจ้าของ */
function drawShot(
  scene: Phaser.Scene, x: number, y: number, dx: number, dy: number,
  speed: number, range: number, radius: number, color: number, sid: number
) {
  if (sid < 0 || rshots.has(sid)) return;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const halo = scene.add.circle(x, y, radius * 2.2, color, 0.3);
  halo.setDepth(DEPTH.PLAYER);
  const circle = scene.add.circle(x, y, radius, color, 0.95);
  circle.setStrokeStyle(2, 0xffffff);
  circle.setDepth(DEPTH.PLAYER + 1);
  const timer = scene.time.addEvent({
    delay: 40,
    loop: true,
    callback: () => {
      if (!circle.active) return;
      const g = scene.add.circle(circle.x, circle.y, radius * 0.7, color, 0.45);
      g.setDepth(DEPTH.PLAYER);
      scene.tweens.add({ targets: g, alpha: 0, scale: 0.3, duration: 200, onComplete: () => g.destroy() });
    }
  });
  const tween = scene.tweens.add({
    targets: circle,
    x: x + ux * range,
    y: y + uy * range,
    duration: Math.max(50, (range / Math.max(1, speed)) * 1000),
    onUpdate: () => halo.setPosition(circle.x, circle.y),
    onComplete: () => killShot(sid)
  });
  rshots.set(sid, { circle, halo, timer, tween });
}

function drawMuzzle(scene: Phaser.Scene, x: number, y: number, color: number) {
  const flash = scene.add.circle(x, y, 10, color, 0.9);
  flash.setBlendMode(Phaser.BlendModes.ADD);
  flash.setDepth(DEPTH.SLASH + 1);
  scene.tweens.add({ targets: flash, scale: 2, alpha: 0, duration: 120, onComplete: () => flash.destroy() });
  realBurst(scene, x, y, color, 4, 22, 3);
}

function drawAfterimage(
  scene: Phaser.Scene, x: number, y: number, tex: string,
  sx: number, sy: number, flip: boolean, color: number
) {
  if (!tex || !scene.textures.exists(tex)) return;
  const ghost = scene.add.sprite(x, y, tex);
  ghost.setScale(sx, sy);
  ghost.setFlipX(flip);
  ghost.setTint(color);
  ghost.setAlpha(0.5);
  ghost.setDepth(DEPTH.AFTERIMAGE);
  scene.tweens.add({ targets: ghost, alpha: 0, duration: 250, onComplete: () => ghost.destroy() });
}

/** ยิงกระสุน: ส่งให้เพื่อนยิงภาพล้วน · คืน sid ไว้ใช้บอกว่าของเราระเบิดแล้ว */
export function shotFx(x: number, y: number, dx: number, dy: number, speed: number, range: number, radius: number, color: number): number {
  const sid = shotBase + ++shotN;
  if (sink) sink({ k: 'sh', x, y, dx, dy, sp: speed, rg: range, r: radius, c: color, sid });
  return sid;
}

/** กระสุนของเราระเบิดที่จุดนี้ — บอกเพื่อนให้ลบกระสุนภาพของ sid นั้น */
export function shotEndFx(sid: number, x: number, y: number) {
  if (sink) sink({ k: 'se', x, y, sid });
}

export function muzzleFlashFx(scene: Phaser.Scene, x: number, y: number, color: number) {
  drawMuzzle(scene, x, y, color);
  if (sink) sink({ k: 'mz', x, y, c: color });
}

export function afterimageFx(
  scene: Phaser.Scene, x: number, y: number, tex: string,
  sx: number, sy: number, flip: boolean, color: number
) {
  drawAfterimage(scene, x, y, tex, sx, sy, flip, color);
  if (sink) sink({ k: 'ai', x, y, tx: tex, sx, sy, fl: flip, c: color });
}
// ---------------------------------------------------------------
// เสียง — Kit เปลี่ยนแค่บรรทัด import จาก sfx เป็นตัวนี้
// ---------------------------------------------------------------
const SFX_GAP_MS = 60;
const lastRemoteSfx: Record<string, number> = {};

function playRemoteSfx(name: 'swing' | 'dash' | 'hit') {
  const t = performance.now();
  if (t - (lastRemoteSfx[name] ?? -1000) < SFX_GAP_MS) return;
  lastRemoteSfx[name] = t;
  realSfx.remote(name);
}

function emitSfx(name: string) {
  if (sink) sink({ k: 'sn', n: name, x: 0, y: 0 });
}

/** ใช้แทน sfx ใน Kit: เล่นของเราเหมือนเดิม + ส่งให้เพื่อนเล่นแบบเบา */
export const sfx = {
  swing: () => { realSfx.swing(); emitSfx('swing'); },
  dash: () => { realSfx.dash(); emitSfx('dash'); },
  hit: () => { realSfx.hit(); emitSfx('hit'); }
};
// ---------------------------------------------------------------
// ฝั่งรับ — เล่นภาพจากเหตุการณ์ที่เพื่อนส่งมา (ตรวจค่าก่อนใช้ กันข้อมูลเพี้ยนทำเกมค้าง)
// ---------------------------------------------------------------
const num = (v: any, d: number): number => (typeof v === 'number' && isFinite(v) ? v : d);
const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

export function playRemoteFx(scene: Phaser.Scene, e: any, ghost?: { sprite: { x: number; y: number } }) {
  if (!e || typeof e.k !== 'string') return;
  const x = num(e.x, NaN);
  const y = num(e.y, NaN);
  if (isNaN(x) || isNaN(y)) return;

  switch (e.k) {
    case 'px': {
      if (typeof e.id !== 'string' || !Object.prototype.hasOwnProperty.call(PIXELFX, e.id)) return;
      const opts: PixelFxOpts = { x, y };
      if (typeof e.sc === 'number') opts.scale = clamp(e.sc, 0.1, 8);
      if (e.fl === true) opts.flipX = true;
      if (typeof e.an === 'number') opts.angle = e.an;
      if (typeof e.ti === 'number') opts.tint = e.ti;
      if (e.ad === true) opts.add = true;
      if (typeof e.dp === 'number') opts.depth = e.dp;
      if (typeof e.al === 'number') opts.alpha = clamp(e.al, 0, 1);
      if (typeof e.fit === 'number') opts.fitMs = clamp(e.fit, 50, 5000);
      if (typeof e.dur === 'number') opts.durationMs = clamp(e.dur, 50, 5000);
      if (typeof e.fo === 'number') opts.fadeOutMs = clamp(e.fo, 0, 2000);
      if (e.fol === true) {
        // เอฟเฟกต์เกาะตัว: ต้องเกาะตัวผี (ไม่ใช่ตัวเรา) ด้วยระยะเยื้องที่เจ้าของส่งมา
        if (!ghost) return;
        const ox = num(e.ox, 0);
        const oy = num(e.oy, 0);
        opts.x = ghost.sprite.x + ox;
        opts.y = ghost.sprite.y + oy;
        opts.follow = () => ({ x: ghost.sprite.x + ox, y: ghost.sprite.y + oy });
      }
      realPixelFx(scene, e.id as PixelFxId, opts);
      break;
    }
    case 'bu':
      realBurst(scene, x, y, num(e.c, 0xffffff), clamp(num(e.n, 6), 1, 40), clamp(num(e.d, 40), 4, 300), clamp(num(e.s, 4), 1, 12));
      break;
    case 'ri':
      realRing(scene, x, y, clamp(num(e.r, 40), 4, 500), num(e.c, 0xffffff), clamp(num(e.ms, 300), 50, 2000));
      break;
    case 'th':
      realThrustDir(scene, x, y, num(e.dx, 1), num(e.dy, 0), clamp(num(e.len, 100), 10, 400), clamp(num(e.lv, 1), 1, 3));
      break;
    case 'ar':
      realArc(
        scene, x, y, num(e.a, 0), clamp(num(e.r, 90), 10, 400), clamp(num(e.h, 60), 5, 180),
        num(e.c, 0xffffff), clamp(num(e.w, 4), 1, 16), clamp(num(e.ms, 180), 50, 1500)
      );
      break;
    case 'wv': {
      const len = Math.hypot(num(e.dx, 1), num(e.dy, 0)) || 1;
      drawWave(
        scene, x, y, num(e.dx, 1) / len, num(e.dy, 0) / len,
        clamp(num(e.hw, 60), 10, 200), clamp(num(e.rg, 400), 50, 1500), clamp(num(e.sp, 600), 100, 2000)
      );
      break;
    }
    case 'sg':
      drawSlamGround(scene, x, y, clamp(num(e.r, 160), 20, 500));
      break;
    case 'st':
      drawStar(scene, x, y, clamp(num(e.r, 200), 20, 600), Math.round(clamp(num(e.n, 7), 5, 12)));
      break;
    case 'bl':
      drawBlades(scene, x, y, Math.round(clamp(num(e.n, 7), 3, 12)), clamp(num(e.ms, 600), 100, 3000));
      break;
    case 'sh':
      drawShot(
        scene, x, y, num(e.dx, 1), num(e.dy, 0), clamp(num(e.sp, 600), 50, 3000),
        clamp(num(e.rg, 400), 20, 1500), clamp(num(e.r, 8), 2, 40), num(e.c, 0xffffff), num(e.sid, -1)
      );
      break;
    case 'se':
      killShot(num(e.sid, -1));
      break;
    case 'mz':
      drawMuzzle(scene, x, y, num(e.c, 0xffffff));
      break;
    case 'ai':
      drawAfterimage(
        scene, x, y, typeof e.tx === 'string' ? e.tx : '',
        clamp(num(e.sx, 1), 0.1, 6), clamp(num(e.sy, 1), 0.1, 6), e.fl === true, num(e.c, 0x66ccff)
      );
      break;
          case 'sn':
      if (e.n === 'swing' || e.n === 'dash' || e.n === 'hit') playRemoteSfx(e.n);
      break;
  }
}