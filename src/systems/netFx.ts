// src/systems/netFx.ts — ตัวห่อเอฟเฟกต์: เล่นบนเครื่องเราเหมือนเดิม + ส่งเหตุการณ์สั้น ๆ ให้เพื่อนเล่นภาพเดียวกัน
// ชื่อและ signature ตรงกับของเดิม (pixelFx / effects / combatFx) — Kit เปลี่ยนแค่บรรทัด import
// ฝั่งรับ (playRemoteFx) เป็นภาพล้วน ไม่มีดาเมจ ไม่มี hitbox
import Phaser from 'phaser';
import { spawnPixelFx as realPixelFx, PIXELFX, type PixelFxId, type PixelFxOpts } from './pixelFx';
import { burst as realBurst, ringEffect as realRing, spawnThrustDir as realThrustDir } from './effects';
import { spawnArcSlash as realArc } from './combatFx';

type Sink = (e: any) => void;
let sink: Sink | null = null;

/** NetGhosts ตั้งไว้ตอนสร้าง · ตั้ง null ตอนทำลาย — ไม่มีตัวรับ = ทำงานเหมือนของเดิมเป๊ะ */
export function setNetFxSink(s: Sink | null) {
  sink = s;
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
  }
}