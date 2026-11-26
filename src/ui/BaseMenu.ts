// src/ui/BaseMenu.ts — เมนูรวมของฐาน: แผงปุ่มใหญ่ชื่อเต็ม กดหรือแตะได้เหมือนกันทุกอุปกรณ์
// ไม่ใช้ Container (UiCamera ดูวัตถุชั้นเดียว + scrollFactor 0) · วัตถุทุกชิ้นตั้ง scrollFactor(0)
// เปิดอยู่ = ซ่อนจอยสัมผัสและไม่รับนิ้วใหม่ผ่าน touch.blockJoy
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DEPTH } from '../config';
import { touch } from '../systems/Controls';

export interface MenuItem {
  label: string;
  /** บรรทัดเล็กใต้ชื่อ เช่น "เร็ว ๆ นี้" */
  sub?: string;
  color: number;
  /** false = ปุ่มสีเทา กดแล้วไม่ทำอะไร */
  enabled?: boolean;
  onUse: () => void;
}

export interface MenuToggle {
  /** ข้อความปุ่ม (อ่านใหม่ทุกครั้งที่ refresh) */
  label: () => string;
  onUse: () => void;
}

const PANEL_W = 580;
const PAD = 20;
const BTN_W = 262;
const BTN_H = 54;
const GAP_X = 16;
const GAP_Y = 12;
const TITLE_H = 30;
const TOG_H = 46;
const TOG_GAP = 12;

export class BaseMenu {
  private scene: Phaser.Scene;
  private items: MenuItem[];
  private toggles: MenuToggle[];
  private onClose: (() => void) | null;
  private objs: Phaser.GameObjects.GameObject[] = [];
  private toggleTexts: Phaser.GameObjects.Text[] = [];
  private opened: boolean = false;

  constructor(scene: Phaser.Scene, items: MenuItem[], toggles: MenuToggle[], onClose?: () => void) {
    this.scene = scene;
    this.items = items;
    this.toggles = toggles;
    this.onClose = onClose ?? null;
  }

  get isOpen(): boolean {
    return this.opened;
  }

  /** ให้ปุ่มเปลี่ยนค่า (เช่น โหมดควบคุม) อัปเดตข้อความ */
  refresh() {
    this.toggles.forEach((t, i) => {
      const tx = this.toggleTexts[i];
      if (tx && tx.active) tx.setText(t.label());
    });
  }

  open() {
    if (this.opened) return;
    this.opened = true;
    touch.blockJoy = true;
    touch.reset(); // ปล่อยทิศเดินที่ค้างอยู่

    const s = this.scene;
    const z: number = DEPTH.OVERLAY;
    const cx = GAME_WIDTH / 2;
    const n = this.items.length;
    const rows = Math.ceil(n / 2);
    const gridH = rows * BTN_H + (rows - 1) * GAP_Y;
    const panelH = PAD + TITLE_H + 14 + gridH + 18 + TOG_H + PAD;
    const top = (GAME_HEIGHT - panelH) / 2;

    // พื้นมืดเต็มจอ — แตะนอกแผง = ปิดเมนู (และกันคลิกทะลุไปออกดาบ)
    const dim = s.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.62)
      .setDepth(z).setScrollFactor(0).setInteractive();
    dim.on('pointerdown', () => this.later(() => this.close()));
    this.objs.push(dim);

    // แผง (กลืนการแตะ ไม่ให้ตกไปที่พื้นมืด)
    const panel = s.add.rectangle(cx, top + panelH / 2, PANEL_W, panelH, 0x1b1810, 0.97)
      .setStrokeStyle(3, 0xffd166).setDepth(z + 1).setScrollFactor(0).setInteractive();
    this.objs.push(panel);

    const titleY = top + PAD + TITLE_H / 2;
    this.objs.push(
      s.add.text(cx, titleY, 'เมนู', {
        fontFamily: '"Noto Sans Thai", monospace',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#ffd54a',
        stroke: '#000000',
        strokeThickness: 4
      }).setOrigin(0.5).setDepth(z + 3).setScrollFactor(0)
    );

    // ปุ่มปิดมุมขวาบนของแผง
    const closeX = cx + PANEL_W / 2 - PAD - 20;
    this.makeButton(closeX, titleY, 40, 40, '✕', undefined, 0xe8e0c8, true, 16, () => this.close(), false);

    // ปุ่มฟังก์ชันหลัก 2 คอลัมน์ (ถ้าเหลือปุ่มเดียวท้ายสุดจัดกลาง)
    const startY = top + PAD + TITLE_H + 14;
    const half = (BTN_W + GAP_X) / 2;
    this.items.forEach((it, i) => {
      const row = Math.floor(i / 2);
      const col = i % 2;
      const alone = i === n - 1 && n % 2 === 1;
      const x = alone ? cx : cx + (col === 0 ? -half : half);
      const y = startY + row * (BTN_H + GAP_Y) + BTN_H / 2;
      const enabled = it.enabled !== false;
      this.makeButton(x, y, BTN_W, BTN_H, it.label, it.sub, it.color, enabled, 18, () => it.onUse(), true);
    });

    // แถวล่าง: เสียง / ควบคุม / เต็มจอ (ไม่ปิดเมนู กดแล้วข้อความอัปเดตเอง)
    const tn = this.toggles.length;
    const inner = PANEL_W - PAD * 2;
    const tw = (inner - (tn - 1) * TOG_GAP) / Math.max(1, tn);
    const ty = startY + gridH + 18 + TOG_H / 2;
    this.toggleTexts = [];
    this.toggles.forEach((t, i) => {
      const x = cx - inner / 2 + tw / 2 + i * (tw + TOG_GAP);
      const tx = this.makeButton(x, ty, tw, TOG_H, t.label(), undefined, 0xe8e0c8, true, 15, () => {
        t.onUse();
        this.refresh();
      }, false);
      this.toggleTexts.push(tx);
    });
  }

  close() {
    if (!this.opened) return;
    this.teardown();
    if (this.onClose) this.onClose();
  }

  /** ฉากปิด — เก็บกวาดโดยไม่เรียก onClose */
  destroy() {
    this.teardown();
  }

  private teardown() {
    this.opened = false;
    touch.blockJoy = false;
    for (const o of this.objs) o.destroy();
    this.objs = [];
    this.toggleTexts = [];
  }

  /** เลื่อนไปทำหลังจบเหตุการณ์แตะ — กันทำลายวัตถุที่กำลังรับเหตุการณ์อยู่ */
  private later(fn: () => void) {
    this.scene.time.delayedCall(0, fn);
  }

  private makeButton(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    sub: string | undefined,
    color: number,
    enabled: boolean,
    fontSize: number,
    onPress: () => void,
    closesMenu: boolean
  ): Phaser.GameObjects.Text {
    const s = this.scene;
    const z: number = DEPTH.OVERLAY;
    const fill = enabled ? 0x221d10 : 0x191611;
    const box = s.add.rectangle(x, y, w, h, fill, 1)
      .setStrokeStyle(3, enabled ? color : 0x4a4130)
      .setDepth(z + 2).setScrollFactor(0);
    box.setInteractive({ useHandCursor: enabled });
    if (enabled) {
      box.on('pointerover', () => box.setFillStyle(0x3d3016));
      box.on('pointerout', () => box.setFillStyle(fill));
      box.on('pointerdown', () =>
        this.later(() => {
          if (closesMenu) this.close();
          onPress();
        })
      );
    }
    this.objs.push(box);

    const text = s.add.text(x, sub ? y - 8 : y, label, {
      fontFamily: '"Noto Sans Thai", monospace',
      fontSize: `${fontSize}px`,
      fontStyle: 'bold',
      color: enabled ? '#ffffff' : '#8d8677',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(z + 3).setScrollFactor(0);
    this.objs.push(text);

    if (sub) {
      this.objs.push(
        s.add.text(x, y + 14, sub, {
          fontFamily: '"Noto Sans Thai", monospace',
          fontSize: '11px',
          color: enabled ? '#c9c2b2' : '#ff9a8a',
          stroke: '#000000',
          strokeThickness: 2
        }).setOrigin(0.5).setDepth(z + 3).setScrollFactor(0)
      );
    }
    return text;
  }
}