// หน้า "ฐานนักล่า" — ใช้ของที่เก็บได้อัปเกรดอุปกรณ์ แล้วค่อยออกไปล่า
import Phaser from 'phaser';
import { GAME_WIDTH, DEV_TOOLS } from '../config';
import { EQUIPMENT_SLOTS, type EquipmentSlot } from '../data/equipment';
import { LOOT_TABLE } from '../data/loot';
import { getUpgradeCost } from '../data/upgrades';
import { playerEquipment } from '../systems/EquipmentSystem';
import { huntSession } from '../systems/HuntSession';
import { loadGame, saveGame, resetSave } from '../systems/SaveGame';
import { sfx } from '../systems/sfx';

const SLOT_TITLE: Record<EquipmentSlot, string> = {
  weapon: 'อาวุธ',
  armor: 'เกราะ',
  helmet: 'หมวก'
};

const EFFECT_INFO: Record<EquipmentSlot, { label: string; unit: string }> = {
  weapon: { label: 'ระยะโจมตี', unit: ' px' },
  armor: { label: 'สะท้อนดาเมจ', unit: '' },
  helmet: { label: 'ฟื้น HP หลังชนะ', unit: '' }
};

let saveLoaded = false; // โหลดเซฟแค่ครั้งแรกที่เปิดเกม

export class BaseScene extends Phaser.Scene {
  private objs: Phaser.GameObjects.GameObject[] = [];
  private toast!: Phaser.GameObjects.Text;
  private starting: boolean = false;

  constructor() {
    super({ key: 'BaseScene' });
  }

  preload() {
    this.load.image('hero', 'assets/hero.png');
    this.load.image('green_potion', 'assets/green_potion.png');
  }

  create() {
    if (!saveLoaded) {
      loadGame();
      saveLoaded = true;
    }
    this.starting = false;
    this.objs = [];
    this.cameras.main.setBackgroundColor('#120f09');

    if (this.textures.exists('hero')) {
      this.add.image(70, 50, 'hero').setScale(3);
    }

    // ข้อความแจ้งเตือนลอย (อยู่ระหว่างกระเป๋ากับปุ่มเริ่มล่า)
    this.toast = this.add
      .text(GAME_WIDTH / 2, 503, '', {
        fontFamily: '"Noto Sans Thai", monospace',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(10);

    const kb = this.input.keyboard as any;
    kb.on('keydown-ONE', () => this.tryUpgrade(EQUIPMENT_SLOTS[0]));
    kb.on('keydown-TWO', () => this.tryUpgrade(EQUIPMENT_SLOTS[1]));
    kb.on('keydown-THREE', () => this.tryUpgrade(EQUIPMENT_SLOTS[2]));
    kb.on('keydown-ENTER', () => this.startHunt());

    if (DEV_TOOLS) {
      kb.on('keydown-F2', () => {
        LOOT_TABLE.forEach((loot) => {
          for (let i = 0; i < 5; i++) huntSession.addItem(loot);
        });
        saveGame();
        this.showToast('DEV: เพิ่มของ +5 ทุกชนิด', '#ffd54a');
        this.render();
      });
      kb.on('keydown-F9', () => {
        resetSave();
        this.showToast('DEV: ล้างเซฟแล้ว', '#ff7777');
        this.render();
      });
    }

    // กันปุ่มค้างซ้ำซ้อนเวลากลับมาหน้านี้อีกรอบ
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      kb.removeAllListeners();
    });

    this.render();
  }

  // ---------- ตัวช่วยสร้างของบนจอ ----------
  private text(x: number, y: number, str: string, size: number, color: string, originX: number = 0.5, bold: boolean = false) {
    const t = this.add
      .text(x, y, str, {
        fontFamily: '"Noto Sans Thai", monospace',
        fontSize: `${size}px`,
        fontStyle: bold ? 'bold' : 'normal',
        color,
        stroke: '#000000',
        strokeThickness: 3
      })
      .setOrigin(originX, 0.5);
    this.objs.push(t);
    return t;
  }

  private rect(x: number, y: number, w: number, h: number, fill: number, alpha: number = 1, stroke?: number) {
    const r = this.add.rectangle(x, y, w, h, fill, alpha);
    if (stroke !== undefined) r.setStrokeStyle(2, stroke);
    this.objs.push(r);
    return r;
  }

  private showToast(msg: string, color: string) {
    this.tweens.killTweensOf(this.toast);
    this.toast.setText(msg).setColor(color).setAlpha(1);
    this.tweens.add({ targets: this.toast, alpha: 0, delay: 1300, duration: 400 });
  }

  // ---------- วาดหน้าจอทั้งหมดใหม่ (เรียกทุกครั้งที่ข้อมูลเปลี่ยน) ----------
  private render() {
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
    const cx = GAME_WIDTH / 2;

    this.text(cx, 40, 'ฐานนักล่า', 32, '#ffd54a', 0.5, true);
    this.text(cx, 74, 'อัปเกรดอุปกรณ์ด้วยของที่ล่ามาได้', 14, '#c9c9c9');

    // การ์ดอุปกรณ์ 3 ใบ
    const cardW = 230;
    const cardH = 310;
    const gap = 20;
    const firstX = cx - (cardW * 3 + gap * 2) / 2 + cardW / 2;
    EQUIPMENT_SLOTS.forEach((slot, i) => {
      this.drawCard(slot, i, firstX + i * (cardW + gap), 255, cardW, cardH);
    });

    // กระเป๋า
    this.rect(cx, 455, 700, 70, 0x17130c, 1, 0x5c4f33);
    this.text(cx, 432, 'กระเป๋า', 14, '#9a8f73');
    LOOT_TABLE.forEach((loot, i) => {
      const colX = cx - 230 + i * 230;
      const count = huntSession.getCount(loot.id);
      if (this.textures.exists(loot.icon)) {
        const icon = this.add.image(colX - 100, 464, loot.icon).setDisplaySize(20, 20);
        this.objs.push(icon);
      }
      this.text(colX - 84, 464, loot.name, 15, loot.color, 0);
      this.text(colX + 95, 464, `x${count}`, 16, count > 0 ? '#ffffff' : '#777777', 1, true);
    });

    // ปุ่มเริ่มล่า
    const startBtn = this.rect(cx, 545, 340, 48, 0x2f5d2f, 1, 0x7dff9b);
    startBtn.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.startHunt());
    this.text(cx, 545, 'เริ่มล่า  —  กด Enter', 20, '#ffffff', 0.5, true);

    if (DEV_TOOLS) {
      this.text(12, 588, 'DEV: F2 = แจกของ +5   F9 = ล้างเซฟ', 11, '#666666', 0);
    }
  }

  private drawCard(slot: EquipmentSlot, index: number, x: number, y: number, w: number, h: number) {
    const eq = playerEquipment.getEquipment(slot);
    const level = playerEquipment.getLevel(slot);
    const maxed = playerEquipment.isMaxLevel(slot);
    const info = EFFECT_INFO[slot];
    const cur = playerEquipment.getEffectValue(slot);
    const next = cur + eq.effect.upgradePerLevel;
    const top = y - h / 2;

    this.rect(x, y, w, h, 0x1d1810, 1, maxed ? 0xffd54a : 0x5c4f33);

    this.text(x, top + 20, `${SLOT_TITLE[slot]}   [${index + 1}]`, 13, '#9a8f73');
    this.text(x, top + 48, eq.name, 20, '#ffffff', 0.5, true);
    this.text(x, top + 80, `Lv ${level} / ${eq.maxLevel}`, 16, '#ffd54a', 0.5, true);

    this.text(x, top + 114, info.label, 13, '#c9c9c9');
    const effectLine = maxed
      ? `${cur}${info.unit}`
      : `${cur}${info.unit}  →  ${next}${info.unit}`;
    this.text(x, top + 142, effectLine, 20, maxed ? '#ffd54a' : '#ffffff', 0.5, true);

    // ของที่ต้องใช้
    const cost = maxed ? null : getUpgradeCost(slot, level);
    let canAfford = false;
    if (cost) {
      this.text(x, top + 192, 'ต้องใช้', 13, '#9a8f73');
      canAfford = true;
      cost.forEach((c, i) => {
        const def = LOOT_TABLE.find((l) => l.id === c.itemId);
        const have = huntSession.getCount(c.itemId);
        const enough = have >= c.amount;
        if (!enough) canAfford = false;
        const rowY = top + 218 + i * 26;
        this.text(x - w / 2 + 20, rowY, def ? def.name : c.itemId, 15, def ? def.color : '#ffffff', 0);
        this.text(x + w / 2 - 20, rowY, `${have}/${c.amount}`, 15, enough ? '#7dff9b' : '#ff7777', 1, true);
      });
    }

    // ปุ่มอัปเกรด
    const btnY = top + h - 28;
    const label = maxed ? 'MAX' : canAfford ? 'อัปเกรด' : 'ของไม่พอ';
    const fill = maxed ? 0x3a3a3a : canAfford ? 0x2f7d3a : 0x4a2a2a;
    const btn = this.rect(x, btnY, w - 40, 36, fill, 1, canAfford ? 0x7dff9b : 0x666666);
    this.text(x, btnY, label, 16, maxed ? '#aaaaaa' : '#ffffff', 0.5, true);
    if (!maxed) {
      btn.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.tryUpgrade(slot));
    }
  }

  // ---------- การกระทำ ----------
  private tryUpgrade(slot: EquipmentSlot) {
    if (this.starting) return;
    if (playerEquipment.isMaxLevel(slot)) {
      this.showToast('อุปกรณ์นี้เลเวลสูงสุดแล้ว', '#c9c9c9');
      return;
    }
    const level = playerEquipment.getLevel(slot);
    const cost = getUpgradeCost(slot, level);
    if (!cost) return;

    const enough = cost.every((c) => huntSession.getCount(c.itemId) >= c.amount);
    if (!enough) {
      sfx.warn();
      this.showToast('ของไม่พอ — ไปล่าเพิ่มก่อน', '#ff7777');
      return;
    }

    cost.forEach((c) => huntSession.spend(c.itemId, c.amount));
    playerEquipment.upgradeSlot(slot);
    saveGame();
    sfx.pickup();
    this.showToast(
      `${playerEquipment.getEquipment(slot).name} อัปเป็น Lv ${playerEquipment.getLevel(slot)}!`,
      '#7dff9b'
    );
    this.render();
  }

  private startHunt() {
    if (this.starting) return;
    this.starting = true;
    this.scene.start('GameScene');
  }
}