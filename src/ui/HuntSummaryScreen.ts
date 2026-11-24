// หน้าจอสรุปผลล่า — จัดเลย์เอาต์ relatif กับแผงกึ่งกลางพื้นที่ออกแบบ 1200x600
// แตะที่ไหนก็ได้เพื่อกลับฐาน (มือถือ) · กด R ก็ได้ (คีย์บอร์ด)
import Phaser from 'phaser';
import { DEPTH, GAME_WIDTH, GAME_HEIGHT } from '../config';
import type { DroppedLoot } from '../data/loot';
import { RARITY } from '../data/rarity';
import { ensureItemIcons } from '../systems/itemIcons';
import type { BagEntry } from '../systems/HuntSession';

export interface HuntReportData {
  timeTakenMs: number;
  huntLoot: DroppedLoot[];
  bag: BagEntry[];
  footer?: string;
}

const PANEL_W = 520;
const PANEL_H = 468;

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  return `${String(Math.floor(totalSec / 60)).padStart(2, '0')}:${String(totalSec % 60).padStart(2, '0')}`;
}

export function showHuntSummary(scene: Phaser.Scene, data: HuntReportData) {
  ensureItemIcons(scene);

  const cx = GAME_WIDTH / 2;
  const cy = GAME_HEIGHT / 2;
  const left = cx - PANEL_W / 2;
  const right = cx + PANEL_W / 2;
  const padL = left + 30;
  const padR = right - 30;
  const objects: Phaser.GameObjects.GameObject[] = [];

  const ui = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
    (o as any).setScrollFactor(0);
    objects.push(o);
    return o;
  };

  const overlay = ui(scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.72)
    .setOrigin(0).setDepth(DEPTH.OVERLAY));
  overlay.setInteractive();

  ui(scene.add.rectangle(cx, cy, PANEL_W, PANEL_H, 0x17130c, 0.97)
    .setStrokeStyle(3, 0xffd54a).setDepth(DEPTH.OVERLAY_TEXT));

  const txt = (x: number, y: number, str: string, size: number, color: string, ox = 0.5, bold = false) =>
    ui(scene.add.text(x, y, str, {
      fontFamily: '"Noto Sans Thai", monospace',
      fontSize: `${size}px`,
      fontStyle: bold ? 'bold' : 'normal',
      color,
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(ox, 0.5).setDepth(DEPTH.OVERLAY_TEXT));

  const divider = (y: number) =>
    ui(scene.add.rectangle(cx, y, PANEL_W - 60, 2, 0xffd54a, 0.45).setDepth(DEPTH.OVERLAY_TEXT));

  const top = cy - PANEL_H / 2;
  txt(cx, top + 42, 'HUNT COMPLETE', 30, '#ffd54a', 0.5, true);
  txt(cx, top + 72, 'กลับถึงฐานแล้ว', 14, '#c9c9c9');
  divider(top + 94);

  txt(padL, top + 120, 'เวลาที่ใช้', 16, '#ffffff', 0);
  txt(padR, top + 120, formatTime(data.timeTakenMs), 19, '#ffe9a3', 1, true);
  divider(top + 144);

  txt(padL, top + 170, 'ของที่ได้รอบนี้', 16, '#ffffff', 0);

  const counts: Record<string, { loot: DroppedLoot; count: number }> = {};
  for (const item of data.huntLoot) {
    const key = `${item.id}_${item.rarity}`;
    if (!counts[key]) counts[key] = { loot: item, count: 0 };
    counts[key].count += 1;
  }
  const keys = Object.keys(counts).slice(0, 5);

  if (keys.length === 0) {
    txt(cx, top + 214, '(ไม่ได้เก็บอะไรเลย)', 14, '#888888');
  } else {
    let rowY = top + 202;
    for (const key of keys) {
      const { loot, count } = counts[key];
      const rd = RARITY[loot.rarity];
      if (scene.textures.exists(loot.icon)) {
        ui(scene.add.rectangle(padL + 14, rowY, 28, 28)
          .setStrokeStyle(2, rd.colorNum, 0.9).setDepth(DEPTH.OVERLAY_TEXT));
        ui(scene.add.image(padL + 14, rowY, loot.icon)
          .setDisplaySize(22, 22).setDepth(DEPTH.OVERLAY_TEXT));
      }
      txt(padL + 36, rowY, loot.name, 15, rd.color, 0);
      txt(padR - 62, rowY, `[${rd.name}]`, 12, '#8d8677', 1);
      txt(padR, rowY, `x${count}`, 15, '#ffffff', 1);
      rowY += 28;
    }
    if (Object.keys(counts).length > keys.length) {
      txt(cx, top + 202 + keys.length * 28, `+ อีก ${Object.keys(counts).length - keys.length} ชนิด`, 12, '#8d8677');
    }
  }

  divider(cy + PANEL_H / 2 - 96);
  const bagTotal = data.bag.reduce((sum, item) => sum + item.count, 0);
  txt(padL, cy + PANEL_H / 2 - 68, 'ในกระเป๋าทั้งหมด', 16, '#ffffff', 0);
  txt(padR, cy + PANEL_H / 2 - 68, `${bagTotal} ชิ้น`, 18, '#7dff9b', 1, true);

  const foot = txt(cx, cy + PANEL_H / 2 - 30, data.footer ?? 'แตะจอ หรือ กด R เพื่อกลับฐาน', 16, '#ffffff');
  scene.tweens.add({ targets: foot, alpha: 0.45, duration: 700, yoyo: true, repeat: -1 });

  objects.forEach((o: any) => o.setAlpha(0));
  scene.tweens.add({ targets: objects, alpha: 1, duration: 380, delay: 120 });

  // แตะเพื่อไปต่อ — ใช้ได้ทั้งมือถือและคอม
  let leaving = false;
  const go = () => {
    if (leaving) return;
    leaving = true;
    scene.time.delayedCall(0, () => scene.scene.start('BaseScene'));
  };
  overlay.on('pointerdown', go);
}