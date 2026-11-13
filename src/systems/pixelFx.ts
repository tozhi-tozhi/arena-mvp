// ตัวกลางเล่นเอฟเฟกต์ PixelFX (Sprite Sheet) — งานภาพเท่านั้น ไม่แตะ gameplay
import Phaser from 'phaser';
import { DEPTH } from '../config';

export type PixelFxId = 'divine-shield' | 'spin-slash' | 'sword-slash';

interface FxDef {
  path: string;
  fw: number; // ความกว้างต่อเฟรม
  fh: number; // ความสูงต่อเฟรม
  frames: number;
  fps: number;
  loop: boolean;
  pivot: [number, number]; // จุดยึด (อ่านจาก JSON ที่ export จริง) = ตำแหน่งเท้าของตัวละครสต็อก
}

const BASE = 'assets/effects/pixelfx';

export const PIXELFX: Record<PixelFxId, FxDef> = {
  'divine-shield': { path: `${BASE}/holy/divine-shield.png`, fw: 88, fh: 84, frames: 72, fps: 30, loop: true, pivot: [44, 68] },
  'spin-slash': { path: `${BASE}/melee/spin-slash.png`, fw: 208, fh: 104, frames: 25, fps: 30, loop: false, pivot: [104, 84] },
  'sword-slash': { path: `${BASE}/melee/sword-slash.png`, fw: 136, fh: 104, frames: 24, fps: 30, loop: false, pivot: [44, 92] }
};

const texKey = (id: PixelFxId) => `pixelfx_${id}`;
const IDS = Object.keys(PIXELFX) as PixelFxId[];

export function loadPixelFx(scene: Phaser.Scene) {
  for (const id of IDS) {
    const d = PIXELFX[id];
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

export interface PixelFxOpts {
  x: number; // จุดที่ให้ "เท้า" (pivot) ของเอฟเฟกต์ไปอยู่
  y: number;
  scale?: number; // แนะนำเลขจำนวนเต็ม (2, 3) ให้พิกเซลคม
  flipX?: boolean;
  depth?: number;
  alpha?: number;
  durationMs?: number; // ใช้กับเอฟเฟกต์วนลูป: ครบเวลาแล้วหายไป
  fadeOutMs?: number; // จางหายตอนท้าย
  follow?: () => { x: number; y: number }; // ให้เกาะตามวัตถุที่เคลื่อนที่
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
  s.setDepth(o.depth ?? DEPTH.SLASH + 1);
  if (o.alpha !== undefined) s.setAlpha(o.alpha);
  s.play(key);

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