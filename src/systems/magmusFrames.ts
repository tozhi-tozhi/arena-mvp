// เฟรมภาพบอสแมกมัส (boss_magmus_*) + ตัวช่วยวัดขนาดรูป
import Phaser from 'phaser';

export type MagClip = 'idle' | 'walk' | 'flame' | 'dash' | 'curl' | 'dizzy' | 'knock';

export const MAG_FRAMES: Record<MagClip, number> = {
  idle: 1,
  walk: 6,
  flame: 7,
  dash: 7,
  curl: 7,
  dizzy: 8,
  knock: 7
};

// i นับจาก 0 -> boss_magmus_walk_01
export const magKey = (clip: MagClip, i: number) =>
  `boss_magmus_${clip}_${String(i + 1).padStart(2, '0')}`;

const CLIPS = Object.keys(MAG_FRAMES) as MagClip[];

export function loadMagmusFrames(scene: Phaser.Scene) {
  for (const clip of CLIPS) {
    for (let i = 0; i < MAG_FRAMES[clip]; i++) {
      scene.load.image(magKey(clip, i), `assets/bosses/magmus/${magKey(clip, i)}.png`);
    }
  }
}

export function magmusReady(scene: Phaser.Scene): boolean {
  return CLIPS.every((clip) =>
    Array.from({ length: MAG_FRAMES[clip] }, (_, i) => scene.textures.exists(magKey(clip, i))).every(Boolean)
  );
}

export interface AlphaBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

// วัดกรอบส่วนที่ไม่โปร่งใสของรูป (ค่า 0-1 เทียบกับขนาดรูป)
export function measureAlpha(scene: Phaser.Scene, key: string): AlphaBox | null {
  try {
    const img = scene.textures.get(key).getSourceImage() as CanvasImageSource;
    const S = 128;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, S, S);
    const d = ctx.getImageData(0, 0, S, S).data;
    let x0 = S, y0 = S, x1 = -1, y1 = -1;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        if (d[(y * S + x) * 4 + 3] > 16) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return null;
    return { x0: x0 / S, y0: y0 / S, x1: (x1 + 1) / S, y1: (y1 + 1) / S };
  } catch (e) {
    return null;
  }
}