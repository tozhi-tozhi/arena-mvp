// src/ui/LogbookPanel.ts — สมุดบันทึกการล่า เปิดที่โต๊ะบันทึกในฐาน (กด E หรือ J)
// อ่านข้อมูลจริงจาก huntSession — ยังไม่มีทริปก็แสดงสถานะว่างตามจริง
// เปิดอยู่ = ผู้เล่นหยุดเดิน (ฉากฐานเป็นคนหยุดให้) · คลิกนอกกรอบ/ปุ่ม ✕/E/ESC ปิด
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DEPTH } from '../config';
import { huntSession, type TripLogEntry } from '../systems/HuntSession';
import { sfx } from '../systems/sfx';

// ---------- เลย์เอาต์ (ปรับที่นี่ที่เดียว) ----------
const L = {
  panelW: 664,
  panelH: 492,
  cx: GAME_WIDTH / 2,
  cy: GAME_HEIGHT / 2,
  titleY: 86,
  subY: 110,
  chipY: 144,
  headY: 196,
  rowY: 222,
  rowGap: 32,
  footY: 478
};

// คอลัมน์อิงขอบซ้ายของแผง (แผงกว้าง 664 จัดกึ่งกลางพื้นที่ 1200)
const PANEL_LEFT = GAME_WIDTH / 2 - 664 / 2;
const COL = {
  outcome: PANEL_LEFT + 26,
  area: PANEL_LEFT + 140,
  kept: PANEL_LEFT + 244,
  lost: PANEL_LEFT + 314,
  hp: PANEL_LEFT + 394,
  time: PANEL_LEFT + 482,
  when: PANEL_LEFT + 638
};

function clock(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function stamp(at: number): string {
  if (!at) return '—';
  const d = new Date(at);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export class LogbookPanel {
  private scene: Phaser.Scene;
  private objs: Phaser.GameObjects.GameObject[] = [];
  private onClose: () => void;
  private closed = false;

  constructor(scene: Phaser.Scene, onClose: () => void) {
    this.scene = scene;
    this.onClose = onClose;
    this.render();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.destroy();
    sfx.pickup();
    this.onClose();
  }

  destroy() {
    for (const o of this.objs) {
      this.scene.tweens.killTweensOf(o);
      if (o.active) o.destroy();
    }
    this.objs = [];
  }

  // ---------- ตัวช่วยวาด (ทุกชิ้นติดจอ ไม่เลื่อนตามกล้อง) ----------
  private ui<T extends Phaser.GameObjects.GameObject>(o: T, depth: number = DEPTH.OVERLAY_TEXT): T {
    (o as any).setScrollFactor(0);
    (o as any).setDepth(depth);
    this.objs.push(o);
    return o;
  }

  private text(x: number, y: number, str: string, size: number, color: string, originX = 0.5, bold = false) {
    return this.ui(this.scene.add.text(x, y, str, {
      fontFamily: '"Noto Sans Thai", monospace',
      fontSize: `${size}px`,
      fontStyle: bold ? 'bold' : 'normal',
      color,
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(originX, 0.5));
  }

  private rect(x: number, y: number, w: number, h: number, fill: number, alpha = 1, stroke?: number, depth: number = DEPTH.OVERLAY_TEXT) {
    const r = this.ui(this.scene.add.rectangle(x, y, w, h, fill, alpha), depth);
    if (stroke !== undefined) r.setStrokeStyle(2, stroke);
    return r;
  }

  // ---------- วาดทั้งแผง ----------
  private render() {
    const stats = huntSession.getStats();
    const log = huntSession.getLog();

    // ม่านหลัง — รับคลิกไว้กันดาบออกทะลุ และคลิกเพื่อปิด
    const scrim = this.rect(L.cx, L.cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.66, undefined, DEPTH.OVERLAY);
    scrim.setInteractive({ useHandCursor: true });
    scrim.on('pointerdown', () => this.scene.time.delayedCall(0, () => this.close()));

    const panel = this.rect(L.cx, L.cy, L.panelW, L.panelH, 0x17130c, 0.98, 0xffd54a);
    panel.setInteractive(); // กันคลิกทะลุเช่นกัน (คลิกในกรอบไม่ปิด)
    this.rect(L.cx, L.cy, L.panelW - 24, L.panelH - 24, 0x000000, 0.001, 0x4a4130);

    this.text(L.cx, L.titleY, 'สมุดบันทึกการล่า', 24, '#ffd54a', 0.5, true);
    this.text(L.cx, L.subY, 'บันทึกอัตโนมัติทุกครั้งที่จบทริป — เก็บไว้ในเครื่องนี้', 11, '#a89f8c');

    const close = this.text(PANEL_LEFT + 664 - 26, L.titleY, '✕', 18, '#c9c2b2', 0.5, true);
    close.setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => this.scene.time.delayedCall(0, () => this.close()));

    // ---------- สถิติรวม 6 ช่อง ----------
    const chips: { label: string; value: string; color: string }[] = [
      { label: 'ทริปทั้งหมด', value: `${stats.trips}`, color: '#ffffff' },
      { label: 'กลับรอด', value: `${stats.returns}`, color: '#7dff9b' },
      { label: 'ตาย', value: `${stats.deaths}`, color: '#ff8a7a' },
      { label: 'ลึกสุด', value: stats.bestArea ? `${stats.bestArea}` : '—', color: '#ffd54a' },
      { label: 'บอสที่ล้ม', value: `${stats.bosses}`, color: '#c084fc' },
      { label: 'ของสะสม', value: `${stats.loot}`, color: '#9de7ff' }
    ];
    chips.forEach((c, i) => {
      const x = PANEL_LEFT + 62 + i * 108;
      this.rect(x, L.chipY, 98, 46, 0x241f14, 1, 0x4a4130);
      this.text(x, L.chipY - 8, c.value, 17, c.color, 0.5, true);
      this.text(x, L.chipY + 13, c.label, 9, '#8d8677');
    });

    this.rect(L.cx, 176, L.panelW - 40, 1, 0xffd54a, 0.35);

    if (log.length === 0) {
      this.text(L.cx, 292, 'ยังไม่มีบันทึก', 20, '#8d8677', 0.5, true);
      this.text(L.cx, 322, 'ออกประตูเขียวไปสำรวจ แล้วกลับฐานสักครั้ง', 13, '#a89f8c');
      this.text(L.cx, 346, 'ตายกลางทางก็ถูกบันทึกเช่นกัน — ความโลภมีราคา', 12, '#6f6858');
    } else {
      // หัวตาราง
      this.text(COL.outcome, L.headY, 'ผล', 11, '#8d8677', 0, true);
      this.text(COL.area, L.headY, 'แอเรีย', 11, '#8d8677', 0, true);
      this.text(COL.kept, L.headY, 'ฝาก', 11, '#8d8677', 0.5, true);
      this.text(COL.lost, L.headY, 'เสีย', 11, '#8d8677', 0.5, true);
      this.text(COL.hp, L.headY, 'เลือด', 11, '#8d8677', 0.5, true);
      this.text(COL.time, L.headY, 'เวลา', 11, '#8d8677', 0.5, true);
      this.text(COL.when, L.headY, 'เมื่อ', 11, '#8d8677', 1, true);

      log.forEach((e: TripLogEntry, i) => {
        const y = L.rowY + i * L.rowGap;
        const back = e.outcome === 'return';
        this.rect(L.cx, y, L.panelW - 44, 28, i % 2 === 0 ? 0x1f1a11 : 0x191510, 1);
        this.rect(PANEL_LEFT + 16, y, 3, 22, back ? 0x7dff9b : 0xff5a3a, 0.9);
        this.text(COL.outcome, y, back ? 'กลับฐาน' : 'ตาย', 13, back ? '#7dff9b' : '#ff8a7a', 0, true);
        this.text(COL.area, y, `แอเรีย ${e.area}`, 13, '#e8e0c8', 0);
        this.text(COL.kept, y, `${e.kept}`, 13, e.kept > 0 ? '#9de7ff' : '#5f5a50', 0.5);
        this.text(COL.lost, y, `${e.lost}`, 13, e.lost > 0 ? '#ff8a7a' : '#5f5a50', 0.5);
        this.text(COL.hp, y, `${e.hp}/${e.maxHp}`, 13, e.hp > 0 ? '#c9c2b2' : '#8d8677', 0.5);
        this.text(COL.time, y, clock(e.ms), 13, '#c9c2b2', 0.5);
        this.text(COL.when, y, stamp(e.at), 11, '#8d8677', 1);
      });
    }

    this.rect(L.cx, 462, L.panelW - 40, 1, 0xffd54a, 0.25);
    this.text(L.cx, L.footY, '[E] หรือ [ESC] ปิด · คลิกนอกกรอบก็ปิดได้', 11, '#a89f8c');

    // เด้งเข้าเบา ๆ ให้รู้ว่าเปิดแล้ว
    panel.setScale(0.96);
    this.scene.tweens.add({ targets: panel, scale: 1, duration: 160, ease: 'Back.easeOut' });
  }
}