// src/ui/PouchPanel.ts — แผง "ถุงพกพา" ระหว่างล่า (เปิดด้วย B)
// เกมไม่หยุดเวลา: แผงชิดขวา ไม่บังลานกลางจอ · คลิกบนแผงไม่ออกดาบ (PlayerActor กันให้)
// ของในถุงอัปเดตสดขณะเปิด — เก็บของเพิ่มแล้วช่องเติมทันที
import Phaser from 'phaser';
import { GAME_WIDTH, DEPTH } from '../config';
import { pouch } from '../systems/Pouch';
import { RARITY } from '../data/rarity';
import { ensureItemIcons } from '../systems/itemIcons';
import { sfx } from '../systems/sfx';

// ---------- ตัวเลขเลย์เอาต์ (แก้ที่นี่ที่เดียว) ----------
const PANEL_W = 252;                 // ความกว้างแผง
const SLOT = 34;                     // ขนาดช่องของ
const COLS = 6;                      // ช่องต่อแถว
const PAD = 14;                      // ขอบใน
const TOP = 64;                      // ตำแหน่งบนจอ (ใต้ข้อความถุง)
const DEPTH_PANEL = DEPTH.HUD + 5;   // เหนือ HUD แต่ใต้หน้าจอสรุป/ตาย

export class PouchPanel {
  private scene: Phaser.Scene;
  private objs: Phaser.GameObjects.GameObject[] = [];
  private opened = false;
  private lastSig = '';

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    ensureItemIcons(scene);
    // ฉากปิด/เปลี่ยนแอเรีย → เก็บของในแผงทิ้งเอง
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.clear());
  }

  get isOpen(): boolean {
    return this.opened;
  }

  toggle(): void {
    if (this.opened) this.close();
    else this.open();
  }

  open(): void {
    if (this.opened) return;
    this.opened = true;
    sfx.open();
    this.render();
  }

  close(): void {
    if (!this.opened) return;
    this.opened = false;
    this.clear();
  }

  /** เรียกทุกเฟรมได้ — วาดใหม่เฉพาะตอนของในถุงเปลี่ยน */
  refresh(): void {
    if (!this.opened) return;
    const sig = `${pouch.count}/${pouch.capacity}`;
    if (sig === this.lastSig) return;
    this.render();
  }

  private clear(): void {
    for (const o of this.objs) if (o.active) o.destroy();
    this.objs = [];
    this.lastSig = '';
  }

  // ทุกชิ้นเป็น UI ติดจอ — UiCamera แยกไปกล้อง UI ให้อัตโนมัติ
  private ui<T extends Phaser.GameObjects.GameObject>(o: T): T {
    (o as any).setScrollFactor(0);
    (o as any).setDepth(DEPTH_PANEL);
    this.objs.push(o);
    return o;
  }

  private render(): void {
    this.clear();
    const items = pouch.getItems();
    const cap = pouch.capacity;
    this.lastSig = `${items.length}/${cap}`;
    const rows = Math.max(1, Math.ceil(cap / COLS));
    const gridH = rows * SLOT;
    const panelH = 56 + gridH + 46;
    const left = GAME_WIDTH - 10 - PANEL_W;
    const right = GAME_WIDTH - 10;

    // พื้นแผง — interactive ไว้กันคลิกทะลุไปออกดาบ
    const bg = this.ui(
      this.scene.add.rectangle(left, TOP, PANEL_W, panelH, 0x14100a, 0.92).setOrigin(0)
    );
    bg.setStrokeStyle(2, 0x8a6a2a);
    bg.setInteractive();

    // หัวแผง: ชื่อ + จำนวน + ปุ่มปิด
    this.ui(this.scene.add.text(left + PAD, TOP + 22, `ถุงพกพา ${items.length}/${cap}`, {
      fontFamily: '"Noto Sans Thai", monospace',
      fontSize: '15px',
      fontStyle: 'bold',
      color: pouch.isFull ? '#ff6666' : '#ffd54a',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0, 0.5));

    const close = this.ui(this.scene.add.text(right - PAD, TOP + 22, '✕', {
      fontFamily: 'monospace',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#c9c2b2',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(1, 0.5));
    close.setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => this.scene.time.delayedCall(0, () => this.close()));

    this.ui(this.scene.add.text(left + PAD, TOP + 42, '1 ชิ้น = 1 ช่อง · กด B ปิด', {
      fontFamily: '"Noto Sans Thai", monospace',
      fontSize: '10px',
      color: '#a89f8c',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0, 0.5));

    // ช่องของ — เรียงตามลำดับที่เก็บ (ชิ้นใหม่ต่อท้าย)
    const gridLeft = left + (PANEL_W - COLS * SLOT) / 2;
    const gridTop = TOP + 56;
    for (let i = 0; i < cap; i++) {
      const gx = gridLeft + (i % COLS) * SLOT + SLOT / 2;
      const gy = gridTop + Math.floor(i / COLS) * SLOT + SLOT / 2;
      const loot = items[i];
      if (!loot) {
        this.ui(this.scene.add.rectangle(gx, gy, SLOT - 4, SLOT - 4, 0x241f14, 0.6).setStrokeStyle(1, 0x3d3524));
        continue;
      }
      const rd = RARITY[loot.rarity];
      this.ui(this.scene.add.rectangle(gx, gy, SLOT - 4, SLOT - 4, 0x1b1810, 1).setStrokeStyle(2, rd.colorNum));
      if (this.scene.textures.exists(loot.icon)) {
        const icon = this.ui(this.scene.add.image(gx, gy, loot.icon).setDisplaySize(22, 22));
        icon.setDepth(DEPTH_PANEL + 1);
      } else {
        this.ui(this.scene.add.rectangle(gx, gy, 16, 16, rd.colorNum));
      }
    }

    // คำเตือนท้ายแผง — ความเสี่ยงของการเปิดถุงกลางสนาม
    const wy = gridTop + gridH + 14;
    this.ui(this.scene.add.text(left + PANEL_W / 2, wy, 'เกมไม่หยุด — ระวังหลัง!', {
      fontFamily: '"Noto Sans Thai", monospace',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#ff9a6a',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5));
    this.ui(this.scene.add.text(left + PANEL_W / 2, wy + 16, 'ตายเสียครึ่ง · กลับฐานฝากหมด', {
      fontFamily: '"Noto Sans Thai", monospace',
      fontSize: '10px',
      color: '#a89f8c',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5));
  }
}