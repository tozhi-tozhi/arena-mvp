// หน้าจอสรุปผลล่า (Loot Report)
// ไอเทมทุกรายการมีขอบ rarity — ไม่มีตัวเลขแต้มแล้ว มีแค่ชื่อระดับและจำนวนชิ้น
import Phaser from 'phaser';
import { DEPTH, GAME_WIDTH } from '../config';
import type { DroppedLoot } from '../data/loot';
import { RARITY } from '../data/rarity';
import { ensureItemIcons } from '../systems/itemIcons';
import type { BagEntry } from '../systems/HuntSession';

export interface HuntReportData {
  timeTakenMs: number;
  huntLoot: DroppedLoot[];
  bag: BagEntry[];
  /** ข้อความท้ายหน้าจอ (ไม่ใส่ = 'กด R เพื่อล่าอีกครั้ง') */
  footer?: string;
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function showHuntSummary(scene: Phaser.Scene, data: HuntReportData) {
  ensureItemIcons(scene);

  const cx = GAME_WIDTH / 2;
  const objects: Phaser.GameObjects.GameObject[] = [];

  const overlay = scene.add.rectangle(0, 0, GAME_WIDTH, 600, 0x000000, 0.72)
    .setOrigin(0).setDepth(DEPTH.OVERLAY).setScrollFactor(0);
  objects.push(overlay);

  const panel = scene.add.rectangle(cx, 300, 500, 460, 0x17130c, 0.96)
    .setStrokeStyle(3, 0xffd54a).setDepth(DEPTH.OVERLAY_TEXT).setScrollFactor(0);
  objects.push(panel);

  const txt = (x: number, y: number, str: string, size: number, color: string, originX: number = 0.5, bold: boolean = false) => {
    const t = scene.add.text(x, y, str, {
      fontFamily: '"Noto Sans Thai", monospace',
      fontSize: `${size}px`,
      fontStyle: bold ? 'bold' : 'normal',
      color,
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(originX, 0.5).setDepth(DEPTH.OVERLAY_TEXT).setScrollFactor(0);
    objects.push(t);
    return t;
  };

  const divider = (y: number) => {
    const d = scene.add.rectangle(cx, y, 440, 2, 0xffd54a, 0.45)
      .setDepth(DEPTH.OVERLAY_TEXT).setScrollFactor(0);
    objects.push(d);
  };

  txt(cx, 112, 'HUNT COMPLETE', 34, '#ffd54a', 0.5, true);
  txt(cx, 145, 'กลับถึงฐานแล้ว', 15, '#c9c9c9');
  divider(170);

  txt(210, 198, 'เวลาที่ใช้', 18, '#ffffff', 0);
  txt(590, 198, formatTime(data.timeTakenMs), 20, '#ffe9a3', 1, true);
  divider(226);

  txt(210, 252, 'ของที่ได้รอบนี้', 18, '#ffffff', 0);
  
  if (data.huntLoot.length === 0) {
    txt(cx, 300, '(ไม่ได้เก็บอะไรเลย)', 15, '#888888');
  } else {
    const counts: Record<string, { loot: DroppedLoot; count: number }> = {};
    for (const item of data.huntLoot) {
      const key = `${item.id}_${item.rarity}`;
      if (!counts[key]) counts[key] = { loot: item, count: 0 };
      counts[key].count += 1;
    }
    
    let rowY = 284;
    for (const key of Object.keys(counts)) {
      const { loot, count } = counts[key];
      const rd = RARITY[loot.rarity];

      if (scene.textures.exists(loot.icon)) {
        const border = scene.add.rectangle(230, rowY, 30, 30)
          .setStrokeStyle(2, rd.colorNum, 0.9)
          .setDepth(DEPTH.OVERLAY_TEXT).setScrollFactor(0);
        objects.push(border);

        const icon = scene.add.image(230, rowY, loot.icon)
          .setDisplaySize(24, 24)
          .setDepth(DEPTH.OVERLAY_TEXT).setScrollFactor(0);
        objects.push(icon);
      }

      txt(254, rowY, loot.name, 16, rd.color, 0);
      // โชว์แค่ระดับ rarity ตรงกลาง เป็น text สีจางๆ ไม่มีตัวเลขแล้ว
      txt(480, rowY, `[${rd.name}]`, 14, '#888888', 0);
      txt(590, rowY, `x${count}`, 16, '#ffffff', 1);
      rowY += 30;
    }
  }
  divider(382);

  const bagTotal = data.bag.reduce((sum, item) => sum + item.count, 0);
  txt(210, 410, 'ในกระเป๋าทั้งหมด', 17, '#ffffff', 0);
  txt(590, 410, `${bagTotal} ชิ้น`, 18, '#7dff9b', 1, true);

  txt(cx, 462, data.footer ?? 'กด R เพื่อล่าอีกครั้ง', 20, '#ffffff', 0.5);

  objects.forEach((o: any) => o.setAlpha(0));
  scene.tweens.add({ targets: objects, alpha: 1, duration: 400, delay: 150 });
}
