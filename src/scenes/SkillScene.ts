// src/scenes/SkillScene.ts — หน้าเลือกสกิล 4 ช่อง × 3 ตัวเลือกของตัวละครที่เล่นอยู่
// เข้าจากห้องแต่งตัวด้วยปุ่ม K หรือปุ่ม "สกิล" · ชี้ (หรือแตะ) การ์ดเพื่อดูรายละเอียดด้านล่าง · คลิกเพื่อใส่
// ตัวเลขในรายละเอียดอ่านจาก data/skills.ts โดยตรง จึงตรงกับของจริงในเกมเสมอ
import Phaser from 'phaser';
import { GAME_WIDTH, DEPTH } from '../config';
import { CHARACTERS } from '../data/characters';
import { SKILL_SLOTS, SLOT_LABEL, skillsOf, skillDetail, type SkillDef, type SkillSlot } from '../data/skills';
import { loadout } from '../systems/Loadout';
import { saveGame } from '../systems/SaveGame';
import { makeVignette } from '../systems/effects';
import { bakeBaseTextures, BASE_TEX } from '../systems/baseTextures';
import { sfx } from '../systems/sfx';

// ---------- เลย์เอาต์ (ปรับที่นี่ที่เดียว) ----------
const L = {
  titleY: 30,
  hintY: 56,
  rowTop: 84,
  rowStep: 92,
  cardH: 80,
  labelX: 24,
  cardX: 150,
  cardW: 204,
  cardGap: 6,
  detailTop: 452,
  detailH: 90,
  backY: 566
};

// สีประจำช่อง (ไอคอนจริง 64×64 ยังไม่มี — ใช้ป้ายสีของช่องแทนไปก่อน)
const SLOT_COLOR: Record<SkillSlot, number> = {
  passive: 0xc084fc,
  combo: 0xffd166,
  charge: 0xff8a5a,
  ultimate: 0xff5a3a
};

const OPTION_LETTER: Record<string, string> = { a: 'A', b: 'B', c: 'C' };

export class SkillScene extends Phaser.Scene {
  private cardObjs: Phaser.GameObjects.GameObject[] = [];
  private detailObjs: Phaser.GameObjects.GameObject[] = [];
  private toast: Phaser.GameObjects.Text | null = null;
  private focusId: string | null = null;
  private leaving = false;

  constructor() { super({ key: 'SkillScene' }); }

  create() {
    this.leaving = false;
    this.focusId = null;
    bakeBaseTextures(this);
    this.cameras.main.setBackgroundColor('#14100a');

    this.add.image(0, 0, BASE_TEX.floorA).setOrigin(0).setDepth(DEPTH.FLOOR);
    this.add.image(400, 0, BASE_TEX.floorB).setOrigin(0).setDepth(DEPTH.FLOOR);
    this.add.image(0, 400, BASE_TEX.floorB).setOrigin(0).setDepth(DEPTH.FLOOR);
    this.add.image(400, 400, BASE_TEX.floorA).setOrigin(0).setDepth(DEPTH.FLOOR);
    makeVignette(this);

    const kb = this.input.keyboard as any;
    kb.on('keydown-ESC', () => this.back());
    kb.on('keydown-E', () => this.back());
    kb.on('keydown-K', () => this.back());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      kb.removeAllListeners();
      this.cardObjs.forEach((o) => this.tweens.killTweensOf(o));
    });

    this.render();
  }

  private back() {
    if (this.leaving) return;
    this.leaving = true;
    saveGame();
    sfx.open();
    this.scene.start('LoadoutScene');
  }

  // ---------- ตัวช่วยวาด ----------
  private text(list: Phaser.GameObjects.GameObject[], x: number, y: number, str: string, size: number, color: string, originX = 0.5, bold = false) {
    const t = this.add.text(x, y, str, {
      fontFamily: '"Noto Sans Thai", monospace',
      fontSize: `${size}px`,
      fontStyle: bold ? 'bold' : 'normal',
      color,
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(originX, 0.5).setDepth(DEPTH.HUD);
    list.push(t);
    return t;
  }

  private rect(list: Phaser.GameObjects.GameObject[], x: number, y: number, w: number, h: number, fill: number, alpha = 1, stroke?: number) {
    const r = this.add.rectangle(x, y, w, h, fill, alpha).setDepth(DEPTH.HUD);
    if (stroke !== undefined) r.setStrokeStyle(2, stroke);
    list.push(r);
    return r;
  }

  private flash(msg: string, color = '#7dff9b') {
    if (this.toast?.active) this.toast.destroy();
    this.toast = this.add.text(GAME_WIDTH / 2, L.detailTop - 12, msg, {
      fontFamily: '"Noto Sans Thai", monospace',
      fontSize: '13px', fontStyle: 'bold', color,
      backgroundColor: 'rgba(0,0,0,0.82)', padding: { x: 10, y: 3 },
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5).setDepth(DEPTH.OVERLAY_TEXT);
    this.tweens.add({
      targets: this.toast, alpha: 0, delay: 1100, duration: 400,
      onComplete: () => this.toast?.destroy()
    });
  }

  // ---------- เลือกสกิล ----------
  private pick(slot: SkillSlot, def: SkillDef) {
    if (!def.playable) {
      sfx.hurt();
      this.flash('สกิลนี้ยังไม่มีท่าในเกม', '#ff9a8a');
      this.showDetail(def.id);
      return;
    }
    if (loadout.skillOf(slot) === def.id) {
      this.showDetail(def.id);
      return;
    }
    if (!loadout.setSkill(slot, def.id)) {
      this.flash('ใส่สกิลนี้ไม่ได้', '#ff9a8a');
      return;
    }
    saveGame();
    sfx.pickup();
    this.flash(`ใส่ ${def.name} แล้ว`);
    this.focusId = def.id;
    this.render();
  }

  // ---------- วาดทั้งหน้า ----------
  private render() {
    this.cardObjs.forEach((o) => { this.tweens.killTweensOf(o); o.destroy(); });
    this.cardObjs = [];
    const o = this.cardObjs;
    const char = loadout.characterId;
    const def = CHARACTERS[char];

    this.text(o, GAME_WIDTH / 2, L.titleY, `สกิลของ ${def.name}`, 24, '#ffd54a', 0.5, true);
    this.text(o, GAME_WIDTH / 2, L.hintY, 'ชี้หรือแตะการ์ดเพื่อดูรายละเอียด · คลิกเพื่อใส่ · K / E / ESC กลับห้องแต่งตัว', 11, '#a89f8c');

    SKILL_SLOTS.forEach((slot, r) => {
      const top = L.rowTop + r * L.rowStep;
      const cy = top + L.cardH / 2;
      const color = SLOT_COLOR[slot];
      this.text(o, L.labelX, cy - 8, SLOT_LABEL[slot], 15, '#' + color.toString(16).padStart(6, '0'), 0, true);
      this.text(o, L.labelX, cy + 12, `ใส่ได้ 1 ตัว`, 10, '#8d8677', 0);

      skillsOf(char, slot).forEach((s, i) => {
        const cx = L.cardX + L.cardW / 2 + i * (L.cardW + L.cardGap);
        this.drawCard(cx, cy, slot, s, color);
      });
    });

    this.showDetail(this.focusId ?? loadout.skillOf(SKILL_SLOTS[0]));

    const back = this.rect(o, GAME_WIDTH / 2, L.backY, 220, 32, 0x2a2210, 1, 0x7dff9b);
    back.setInteractive({ useHandCursor: true });
    back.on('pointerover', () => back.setFillStyle(0x3d3016));
    back.on('pointerout', () => back.setFillStyle(0x2a2210));
    back.on('pointerdown', () => this.time.delayedCall(0, () => this.back()));
    this.text(o, GAME_WIDTH / 2, L.backY, 'กลับห้องแต่งตัว (K)', 13, '#ffe9a3', 0.5, true);
  }

  private drawCard(cx: number, cy: number, slot: SkillSlot, s: SkillDef, color: number) {
    const o = this.cardObjs;
    const equipped = loadout.skillOf(slot) === s.id;
    const locked = !s.playable;
    const baseFill = equipped ? 0x3a2f12 : 0x221d10;
    const stroke = equipped ? 0x7dff9b : locked ? 0x4a4130 : color;

    const box = this.rect(o, cx, cy, L.cardW, L.cardH, baseFill, locked ? 0.7 : 1, stroke);
    box.setInteractive({ useHandCursor: !locked });
    box.on('pointerover', () => {
      box.setFillStyle(0x3d3016);
      this.showDetail(s.id);
    });
    box.on('pointerout', () => box.setFillStyle(baseFill));
    box.on('pointerdown', () => this.time.delayedCall(0, () => this.pick(slot, s)));

    // ป้ายไอคอนแทนที่ (ไอคอนจริงมาทีหลัง): สี่เหลี่ยมสีช่อง + ตัวอักษรตัวเลือก
    const ix = cx - L.cardW / 2 + 32;
    this.rect(o, ix, cy, 44, 44, locked ? 0x3a3426 : color, locked ? 0.6 : 0.9, 0xffffff);
    this.text(o, ix, cy, OPTION_LETTER[s.option] ?? '?', 24, locked ? '#8d8677' : '#1a1408', 0.5, true);

    const tx = cx - L.cardW / 2 + 62;
    this.text(o, tx, cy - 16, s.name, 13, locked ? '#8d8677' : '#ffffff', 0, true);
    if (equipped) this.text(o, tx, cy + 6, '✔ ใช้อยู่', 11, '#7dff9b', 0, true);
    else if (locked) this.text(o, tx, cy + 6, 'ยังไม่มีท่า', 11, '#ff9a8a', 0);
    else this.text(o, tx, cy + 6, 'คลิกเพื่อใส่', 11, '#a89f8c', 0);
  }

  /** แผงรายละเอียดด้านล่าง — วาดแยกจากการ์ด เพื่อไม่ทำลายการ์ดที่กำลังชี้อยู่ */
  private showDetail(id: string) {
    this.detailObjs.forEach((o) => o.destroy());
    this.detailObjs = [];
    const o = this.detailObjs;
    const char = loadout.characterId;
    let found: SkillDef | undefined;
    let foundSlot: SkillSlot | undefined;
    for (const slot of SKILL_SLOTS) {
      const hit = skillsOf(char, slot).find((s) => s.id === id);
      if (hit) { found = hit; foundSlot = slot; break; }
    }
    const cx = GAME_WIDTH / 2;
    const cy = L.detailTop + L.detailH / 2;
    this.rect(o, cx, cy, GAME_WIDTH - 40, L.detailH, 0x1b1810, 0.95, 0x4a4130);
    if (!found || !foundSlot) {
      this.text(o, cx, cy, 'ชี้ที่สกิลเพื่อดูรายละเอียด', 13, '#a89f8c');
      return;
    }
    const color = '#' + SLOT_COLOR[foundSlot].toString(16).padStart(6, '0');
    const state = !found.playable ? ' · ยังไม่มีท่า' : loadout.skillOf(foundSlot) === found.id ? ' · ใช้อยู่' : '';
    this.text(o, 36, L.detailTop + 14, `${SLOT_LABEL[foundSlot]} ${OPTION_LETTER[found.option]} — ${found.name}${state}`, 14, color, 0, true);
    skillDetail(found.id).slice(0, 4).forEach((line, i) => {
      this.text(o, 36, L.detailTop + 34 + i * 17, line, 11, '#e8e0c8', 0);
    });
  }
}
