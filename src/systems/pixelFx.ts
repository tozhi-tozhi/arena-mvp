// ตัวกลางเล่นเอฟเฟกต์ PixelFX (Sprite Sheet) — งานภาพเท่านั้น ไม่แตะ gameplay
// ค่า fw/fh/frames/pivot ทั้งหมดอ่านจาก meta.pixelfx ในไฟล์ JSON ที่เรนเดอร์มา ห้ามเดา
import Phaser from 'phaser';
import { DEPTH } from '../config';

export type PixelFxId =
  | 'divine-shield' | 'spin-slash' | 'sword-slash'
  | 'hit-spark' | 'crit-hit' | 'ground-slam' | 'heal' | 'thrust'
  | 'dagger-flurry' | 'blink-out';

interface FxDef {
  path: string;
  fw: number; // ความกว้างต่อเฟรม
  fh: number; // ความสูงต่อเฟรม
  frames: number;
  fps: number;
  loop: boolean;
  pivot: [number, number]; // จุดยึด = ตำแหน่งเท้าของตัวละครต้นแบบ
  planned?: boolean; // true = ยังไม่มีไฟล์ ข้ามการโหลด
}

const BASE = 'assets/effects/pixelfx';

export const PIXELFX: Record<PixelFxId, FxDef> = {
  'divine-shield': { path: `${BASE}/holy/divine-shield.png`, fw: 88, fh: 84, frames: 72, fps: 30, loop: true, pivot: [44, 68] },
  'spin-slash':    { path: `${BASE}/melee/spin-slash.png`, fw: 208, fh: 104, frames: 25, fps: 30, loop: false, pivot: [104, 84] },
  'sword-slash':   { path: `${BASE}/melee/sword-slash.png`, fw: 136, fh: 104, frames: 24, fps: 30, loop: false, pivot: [44, 92] },
  'hit-spark':     { path: `${BASE}/impacts/hit-spark.png`, fw: 136, fh: 80, frames: 16, fps: 30, loop: false, pivot: [44, 64] },
  'crit-hit':      { path: `${BASE}/impacts/crit-hit.png`, fw: 216, fh: 136, frames: 28, fps: 30, loop: false, pivot: [84, 106] },
  'ground-slam':   { path: `${BASE}/impacts/ground-slam.png`, fw: 288, fh: 208, frames: 97, fps: 30, loop: false, pivot: [144, 164] },
  'heal':          { path: `${BASE}/holy/heal.png`, fw: 80, fh: 104, frames: 58, fps: 30, loop: false, pivot: [40, 92] },
  'thrust':        { path: `${BASE}/melee/thrust.png`, fw: 196, fh: 76, frames: 24, fps: 30, loop: false, pivot: [34, 62] },
  'dagger-flurry': { path: `${BASE}/melee/dagger-flurry.png`, fw: 148, fh: 104, frames: 30, fps: 30, loop: false, pivot: [36, 86] },
  'blink-out':     { path: `${BASE}/arcane/blink-out.png`, fw: 136, fh: 96, frames: 49, fps: 30, loop: false, pivot: [68, 80] }
};

const texKey = (id: PixelFxId) => `pixelfx_${id}`;
const IDS = Object.keys(PIXELFX) as PixelFxId[];

export function loadPixelFx(scene: Phaser.Scene) {
  for (const id of IDS) {
    const d = PIXELFX[id];
    if (d.planned) continue; // ยังไม่มีไฟล์ — ไม่ต้องขอโหลด
    scene.load.spritesheet(texKey(id), d.path, { frameWidth: d.fw, frameHeight: d.fh });
  }
}

function ensureAnim(scene: Phaser.Scene, id: PixelFxId): boolean {
  const key = texKey(id);
  if (!scene.textures.exists(key)) return false; // ไฟล์ไม่มี/โหลดไม่ได้ -> ข้าม เกมเล่นต่อได้
  if (!scene.anims.exists(key)) {
    const d = PIXELFX[id];
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers(key, { start: 0, end: d.frames - 1 }),
      frameRate: d.fps,
      repeat: d.loop ? -1 : 0
    });
  }
  return true;
}

/** เอฟเฟกต์มีไฟล์จริงและเล่นได้ไหม — ใช้ตัดสินใจก่อนวาดของเก่า */
export function hasPixelFx(scene: Phaser.Scene, id: PixelFxId): boolean {
  return ensureAnim(scene, id);
}

export interface PixelFxOpts {
  x: number; // จุดที่ให้ "เท้า" (pivot) ของเอฟเฟกต์ไปอยู่
  y: number;
  scale?: number;
  flipX?: boolean; // กลับซ้ายขวา — ห้ามใช้ผสมกับ angle
  angle?: number; // หมุนรอบจุดยึด (เรเดียน)
  tint?: number; // ย้อมสีทับภาพเดิม (โหมดคูณ)
  add?: boolean; // โหมดบวกแสง — เรือง เหมาะกับประกาย/แสง
  depth?: number;
  alpha?: number;
  fitMs?: number; // บีบให้เล่นจบทุกเฟรมในเวลานี้ (ท่าสั้นกว่าความยาวคลิป)
  durationMs?: number; // ใช้กับเอฟเฟกต์วนลูป: ครบเวลาแล้วหายไป
  fadeOutMs?: number;
  follow?: () => { x: number; y: number }; // เกาะตามวัตถุที่เคลื่อนที่
}

export function spawnPixelFx(scene: Phaser.Scene, id: PixelFxId, o: PixelFxOpts): Phaser.GameObjects.Sprite | null {
  if (!ensureAnim(scene, id)) return null;
  const d = PIXELFX[id];
  const key = texKey(id);

  const s = scene.add.sprite(o.x, o.y, key, 0);
  s.setScale(o.scale ?? 2);
  const px = d.pivot[0] / d.fw;
  s.setOrigin(o.flipX ? 1 - px : px, d.pivot[1] / d.fh);
  s.setFlipX(!!o.flipX);
  if (o.angle !== undefined) s.setRotation(o.angle);
  if (o.tint !== undefined) s.setTint(o.tint);
  if (o.add) s.setBlendMode(Phaser.BlendModes.ADD);
  s.setDepth(o.depth ?? DEPTH.SLASH + 1);
  if (o.alpha !== undefined) s.setAlpha(o.alpha);

  // เล่นให้จบในเวลาที่กำหนด: สร้างแอนิเมชันเฉพาะความเร็วนี้ครั้งเดียวแล้วใช้ซ้ำ
  let playKey = key;
  if (o.fitMs && o.fitMs > 0 && !d.loop) {
    const rate = Math.max(4, Math.round((d.frames * 1000) / o.fitMs));
    const fastKey = `${key}_${rate}`;
    if (!scene.anims.exists(fastKey)) {
      scene.anims.create({
        key: fastKey,
        frames: scene.anims.generateFrameNumbers(key, { start: 0, end: d.frames - 1 }),
        frameRate: rate,
        repeat: 0
      });
    }
    playKey = fastKey;
  }
  s.play(playKey);

  if (!d.loop) s.once('animationcomplete', () => s.destroy());

  if (o.durationMs) {
    const fade = o.fadeOutMs ?? 0;
    scene.time.delayedCall(Math.max(0, o.durationMs - fade), () => {
      if (!s.active) return;
      if (fade > 0) scene.tweens.add({ targets: s, alpha: 0, duration: fade, onComplete: () => s.destroy() });
      else s.destroy();
    });
  }

  if (o.follow) {
    const f = o.follow;
    const upd = () => {
      if (s.active) {
        const p = f();
        s.setPosition(p.x, p.y);
      }
    };
    scene.events.on('update', upd);
    s.once('destroy', () => scene.events.off('update', upd));
  }
  return s;
}