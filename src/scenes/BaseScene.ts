// หน้า "ฐานนักล่า" — เลือกตัวละคร / เครื่องราง / สัตว์เลี้ยง / บอส แล้วออกไปล่า
// Phase 1: กระเป๋าแสดงเป็น row ไอคอน + จำนวน + ขอบ rarity (ไม่ใช่ text แล้ว)
import Phaser from 'phaser';
import { GAME_WIDTH, DEV_TOOLS } from '../config';
import { CHARACTERS, CHARACTER_IDS, type CharacterId } from '../data/characters';
import { CHARMS, CHARM_IDS, type CharmId } from '../data/charms';
import { PETS, PET_IDS, type PetId } from '../data/pets';
import { LOOT_TABLE } from '../data/loot';
import { RARITY } from '../data/rarity';
import { huntSession, type BagEntry } from '../systems/HuntSession';
import { loadout } from '../systems/Loadout';
import { loadGame, saveGame, resetSave } from '../systems/SaveGame';
import { ensureItemIcons } from '../systems/itemIcons';
import { BOSSES, BOSS_IDS, type BossId, type BossChoice } from '../data/bosses';

let saveLoaded = false; // โหลดเซฟแค่ครั้งแรกที่เปิดเกม

export class BaseScene extends Phaser.Scene {
  private objs: Phaser.GameObjects.GameObject[] = [];
  private starting: boolean = false;

  constructor() {
    super({ key: 'BaseScene' });
  }

  preload() {
    this.load.image('hero', 'assets/hero.png');
  }

  create() {
    // สร้างไอคอนไอเทม (idempotent — เรียกซ้ำได้ไม่พัง)
    ensureItemIcons(this);

    if (!saveLoaded) {
      loadGame();
      saveLoaded = true;
    }
    this.starting = false;
    this.objs = [];
    this.cameras.main.setBackgroundColor('#120f09');

    const kb = this.input.keyboard as any;
    kb.on('keydown-ONE', () => this.chooseCharacter(CHARACTER_IDS[0]));
    kb.on('keydown-TWO', () => this.chooseCharacter(CHARACTER_IDS[1]));
    kb.on('keydown-C', () => this.cycleCharm());
    kb.on('keydown-P', () => this.cyclePet());
    kb.on('keydown-B', () => this.cycleBoss());
    kb.on('keydown-ENTER', () => this.startHunt());

    if (DEV_TOOLS) {
      kb.on('keydown-F2', () => {
        LOOT_TABLE.forEach((loot) => {
          // ต้องส่ง rarity ไปด้วย เพื่อให้ตรงกับ type ใหม่ใน HuntSession
          for (let i = 0; i < 5; i++) huntSession.addItem({ ...loot, rarity: 'common' });
        });
        saveGame();
        this.render();
      });
      kb.on('keydown-F9', () => {
        resetSave();
        this.render();
      });
    }

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

  // ---------- การเลือก ----------
  private chooseCharacter(id: CharacterId) {
    if (loadout.characterId === id) return;
    loadout.characterId = id;
    saveGame();
    this.render();
  }

  private setCharm(id: CharmId | null) {
    loadout.charmId = id;
    saveGame();
    this.render();
  }

  private setPet(id: PetId | null) {
    loadout.petId = id;
    saveGame();
    this.render();
  }

  private cycleCharm() {
    const list: (CharmId | null)[] = [null, ...CHARM_IDS];
    const next = (list.indexOf(loadout.charmId) + 1) % list.length;
    this.setCharm(list[next]);
  }

  private cyclePet() {
    const list: (PetId | null)[] = [null, ...PET_IDS];
    const next = (list.indexOf(loadout.petId) + 1) % list.length;
    this.setPet(list[next]);
  }

  private setBoss(id: BossId | null) {
    loadout.bossChoice = id ?? 'random';
    saveGame();
    this.render();
  }

  private cycleBoss() {
    const list: BossChoice[] = ['random', ...BOSS_IDS];
    const next = (list.indexOf(loadout.bossChoice) + 1) % list.length;
    loadout.bossChoice = list[next];
    saveGame();
    this.render();
  }

  private startHunt() {
    if (this.starting) return;
    this.starting = true;
    saveGame();
    this.scene.start('GameScene');
  }

  // แถวตัวเลือก: ป้ายชื่อ + ปุ่ม 3 อัน + คำอธิบายของอันที่เลือก
  private optionRow<T extends string>(
    y: number,
    label: string,
    options: (T | null)[],
    current: T | null,
    nameOf: (id: T | null) => string,
    descOf: (id: T | null) => string,
    onPick: (id: T | null) => void
  ) {
    this.text(20, y, label, 14, '#ffd54a', 0, true);

    options.forEach((opt, i) => {
      const x = 290 + i * 200;
      const selected = opt === current;
      const btn = this.rect(x, y, 188, 34, selected ? 0x2a2210 : 0x1b1810, 1, selected ? 0xffd54a : 0x4a4130);
      btn.setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => {
        this.time.delayedCall(0, () => onPick(opt));
      });
      this.text(x, y, nameOf(opt), 14, selected ? '#ffd54a' : '#e8e8e8', 0.5, selected);
    });

    this.text(GAME_WIDTH / 2 + 60, y + 27, descOf(current), 12, '#c9c9c9');
  }

// แถวกระเป๋า: aggregate ตาม itemId, แสดง total count
// ขอบไอคอนใช้สีของ rarity สูงสุดที่มีอยู่ (โชว์ให้เห็นว่าเคยได้ของดี)
private drawBagRow(bag: BagEntry[]) {
  // aggregate — total count + highest rarity ต่อ itemId
  const summary = new Map<string, { total: number; highestRarity: any | null }>();
  for (const entry of bag) {
    const existing = summary.get(entry.itemId);
    if (existing) {
      existing.total += entry.count;
      if (!existing.highestRarity || RARITY[entry.rarity].order > RARITY[existing.highestRarity].order) {
        existing.highestRarity = entry.rarity;
      }
    } else {
      summary.set(entry.itemId, { total: entry.count, highestRarity: entry.rarity });
    }
  }

  const SLOT_W = 88;
  const totalW = LOOT_TABLE.length * SLOT_W;
  const startX = GAME_WIDTH / 2 - totalW / 2;
  const y = 528;

  LOOT_TABLE.forEach((def, i) => {
    const data = summary.get(def.id);
    const total = data?.total ?? 0;
    const highestRarity = data?.highestRarity ?? 'common';
    const rd = RARITY[highestRarity];
    const slotX = startX + i * SLOT_W;

    const border = this.add.rectangle(slotX + 20, y, 34, 34);
    border.setStrokeStyle(2, rd.colorNum, total > 0 ? 0.9 : 0.2);
    this.objs.push(border);

    if (this.textures.exists(def.icon)) {
      const icon = this.add.image(slotX + 20, y, def.icon);
      icon.setDisplaySize(28, 28);
      icon.setAlpha(total > 0 ? 1 : 0.25);
      this.objs.push(icon);
    }

    const countText = this.add.text(slotX + 40, y, `x${total}`, {
      fontFamily: 'monospace',
      fontSize: '14px',
      fontStyle: 'bold',
      color: total > 0 ? '#ffffff' : '#555555',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0, 0.5);
    this.objs.push(countText);
  });
}

  // ---------- วาดหน้าจอทั้งหมดใหม่ ----------
  private render() {
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
    const cx = GAME_WIDTH / 2;

    this.text(cx, 36, 'ฐานนักล่า', 30, '#ffd54a', 0.5, true);
    this.text(cx, 64, 'ENTER = ออกล่า  ·  1/2 ตัวละคร  ·  C เครื่องราง  ·  P สัตว์เลี้ยง  ·  B บอส', 12, '#c9c9c9');

    // การ์ดตัวละคร
    CHARACTER_IDS.forEach((id, i) => {
      const def = CHARACTERS[id];
      const x = cx + (i === 0 ? -170 : 170);
      const y = 205;
      const selected = loadout.characterId === id;

      const card = this.rect(x, y, 320, 250, selected ? 0x2a2210 : 0x1b1810, 1, selected ? 0xffd54a : 0x4a4130);
      card.setInteractive({ useHandCursor: true });
      card.on('pointerdown', () => {
        this.time.delayedCall(0, () => this.chooseCharacter(id));
      });

      this.text(x, y - 100, `${i + 1}  ${def.name}`, 22, selected ? '#ffd54a' : '#ffffff', 0.5, true);
      this.text(x, y - 76, def.tagline, 12, '#c9c9c9');

      if (this.textures.exists('hero')) {
        const img = this.add.image(x, y - 34, 'hero').setScale(2).setTint(def.tint);
        this.objs.push(img);
      }

      def.lines.forEach((line, k) => {
        this.text(x, y + 22 + k * 24, line, 12, '#e8e8e8');
      });

      this.text(x, y + 112, `HP ${def.maxHP}`, 13, '#ff8a80', 0.5, true);
    });

    // แถวเครื่องราง
    this.optionRow<CharmId>(
      352,
      'เครื่องราง',
      [null, ...CHARM_IDS],
      loadout.charmId,
      (id) => (id ? CHARMS[id].name : 'ไม่ใส่'),
      (id) => (id ? CHARMS[id].desc : 'ไม่ใส่เครื่องราง'),
      (id) => this.setCharm(id)
    );

    // แถวสัตว์เลี้ยง
    this.optionRow<PetId>(
      410,
      'สัตว์เลี้ยง',
      [null, ...PET_IDS],
      loadout.petId,
      (id) => (id ? PETS[id].name : 'ไม่ใส่'),
      (id) => (id ? PETS[id].desc : 'ไม่ใส่สัตว์เลี้ยง'),
      (id) => this.setPet(id)
    );

    // แถวบอส (null = สุ่ม) — เลื่อนขึ้นเพื่อให้กระเป๋ามีที่
    this.optionRow<BossId>(
      455,
      'บอส',
      [null, ...BOSS_IDS],
      loadout.bossChoice === 'random' ? null : loadout.bossChoice,
      (id) => (id ? BOSSES[id].name : 'สุ่ม'),
      (id) => (id ? BOSSES[id].desc : 'สุ่มบอสหนึ่งในสองตัว'),
      (id) => this.setBoss(id)
    );

    // ---------- กระเป๋า (row แสดงไอคอน + จำนวน + ขอบ rarity) ----------
    this.text(cx, 500, 'กระเป๋า', 12, '#ffd54a', 0.5, true);
    this.drawBagRow(huntSession.getBag());

    // ---------- ปุ่มออกล่า ----------
    const btn = this.rect(cx, 572, 240, 34, 0x3a2a08, 1, 0xffd54a);
    btn.setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => this.startHunt());
    this.text(cx, 572, 'กด ENTER เพื่อออกล่า', 16, '#ffd54a', 0.5, true);
  }
}