// หน้าจอสรุปผลล่า (Loot Report) — แสดงหลังกลับฐาน
// บอกผู้เล่น: ใช้เวลาเท่าไร / รอบนี้เก็บอะไรได้ / ในกระเป๋าทั้งหมดมีอะไร
import Phaser from 'phaser';
import { DEPTH, GAME_WIDTH } from '../config';
import type { LootDef } from '../data/loot';
import type { BagItem } from '../systems/HuntSession';

export interface HuntReportData {
  timeTakenMs: number; // เวลาที่ใช้ล่า (มิลลิวินาที)
  huntLoot: LootDef[]; // ไอเทมที่เก็บได้ในรอบนี้
  bag: BagItem[];      // ไอเทมทั้งหมดในกระเป๋า (สะสมทุกรอบ)
}

// แปลงมิลลิวินาที -> "นาที:วินาที" เช่น 83000 -> "01:23"
function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function showHuntSummary(scene: Phaser.Scene, data: HuntReportData) {
  const cx = GAME_WIDTH / 2;
  const objects: Phaser.GameObjects.GameObject[] = []; // เก็บทุกชิ้นเพื่อเฟดอินพร้อมกัน

  // พื้นหลังมืดคลุมทั้งจอ
  const overlay = scene.add.rectangle(0, 0, GAME_WIDTH, 600, 0x000000, 0.72)
    .setOrigin(0).setDepth(DEPTH.OVERLAY).setScrollFactor(0);
  objects.push(overlay);

  // กล่องแผงกลาง
  const panel = scene.add.rectangle(cx, 300, 500, 460, 0x17130c, 0.96)
    .setStrokeStyle(3, 0xffd54a).setDepth(DEPTH.OVERLAY_TEXT).setScrollFactor(0);
  objects.push(panel);

  // ตัวช่วยสร้างข้อความ
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

  // ตัวช่วยสร้างเส้นคั่น
  const divider = (y: number) => {
    const d = scene.add.rectangle(cx, y, 440, 2, 0xffd54a, 0.45)
      .setDepth(DEPTH.OVERLAY_TEXT).setScrollFactor(0);
    objects.push(d);
  };

  // ---------- หัวข้อ ----------
  txt(cx, 112, 'HUNT COMPLETE', 34, '#ffd54a', 0.5, true);
  txt(cx, 145, 'กลับถึงฐานแล้ว', 15, '#c9c9c9');
  divider(170);

  // ---------- เวลาที่ใช้ ----------
  txt(210, 198, 'เวลาที่ใช้', 18, '#ffffff', 0);
  txt(590, 198, formatTime(data.timeTakenMs), 20, '#ffe9a3', 1, true);
  divider(226);

  // ---------- ของที่ได้รอบนี้ ----------
  txt(210, 252, 'ของที่ได้รอบนี้', 18, '#ffffff', 0);
  if (data.huntLoot.length === 0) {
    txt(cx, 300, '(ไม่ได้เก็บอะไรเลย)', 15, '#888888');
  } else {
    // นับจำนวนไอเทมแต่ละชนิดในรอบนี้
    const counts: Record<string, { loot: LootDef; count: number }> = {};
    for (const item of data.huntLoot) {
      if (!counts[item.id]) counts[item.id] = { loot: item, count: 0 };
      counts[item.id].count += 1;
    }
    let rowY = 284;
    for (const key of Object.keys(counts)) {
      const { loot, count } = counts[key];
      if (scene.textures.exists(loot.icon)) {
        const icon = scene.add.image(230, rowY, loot.icon)
          .setDisplaySize(20, 20).setDepth(DEPTH.OVERLAY_TEXT).setScrollFactor(0);
        objects.push(icon);
      }
      txt(250, rowY, loot.name, 16, loot.color, 0);
      txt(590, rowY, `x${count}`, 16, '#ffffff', 1);
      rowY += 30;
    }
  }
  divider(382);

  // ---------- กระเป๋าทั้งหมด ----------
  const bagTotal = data.bag.reduce((sum, item) => sum + item.count, 0);
  txt(210, 410, 'ในกระเป๋าทั้งหมด', 17, '#ffffff', 0);
  txt(590, 410, `${bagTotal} ชิ้น`, 18, '#7dff9b', 1, true);

  // ---------- คำแนะนำ ----------
  txt(cx, 462, 'กด R เพื่อล่าอีกครั้ง', 20, '#ffffff', 0.5);

  // เฟดอินทั้งแผง
  objects.forEach((o: any) => o.setAlpha(0));
  scene.tweens.add({ targets: objects, alpha: 1, duration: 400, delay: 150 });
}