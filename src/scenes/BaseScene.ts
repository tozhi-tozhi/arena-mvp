// หน้า "ฐานนักล่า" — เลือกตัวละคร / เครื่องราง / สัตว์เลี้ยง แล้วออกไปล่า
import Phaser from 'phaser';
import { GAME_WIDTH, DEV_TOOLS } from '../config';
import { CHARACTERS, CHARACTER_IDS, type CharacterId } from '../data/characters';
import { CHARMS, CHARM_IDS, type CharmId } from '../data/charms';
import { PETS, PET_IDS, type PetId } from '../data/pets';
import { LOOT_TABLE } from '../data/loot';
import { huntSession } from '../systems/HuntSession';
import { loadout } from '../systems/Loadout';
import { loadGame, saveGame, resetSave } from '../systems/SaveGame';

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
    kb.on('keydown-ENTER', () => this.startHunt());

    if (DEV_TOOLS) {
      kb.on('keydown-F2', () => {
        LOOT_TABLE.forEach((loot) => {
          for (let i = 0; i < 5; i++) huntSession.addItem(loot);
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

  // ---------- วาดหน้าจอทั้งหมดใหม่ ----------
  private render() {
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
    const cx = GAME_WIDTH / 2;

    this.text(cx, 36, 'ฐานนักล่า', 30, '#ffd54a', 0.5, true);
    this.text(cx, 64, 'เลือกชุด แล้วกด ENTER  ·  1/2 = ตัวละคร  ·  C = เครื่องราง  ·  P = สัตว์เลี้ยง', 12, '#c9c9c9');

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
      372,
      'เครื่องราง',
      [null, ...CHARM_IDS],
      loadout.charmId,
      (id) => (id ? CHARMS[id].name : 'ไม่ใส่'),
      (id) => (id ? CHARMS[id].desc : 'ไม่ใส่เครื่องราง'),
      (id) => this.setCharm(id)
    );

    // แถวสัตว์เลี้ยง
    this.optionRow<PetId>(
      432,
      'สัตว์เลี้ยง',
      [null, ...PET_IDS],
      loadout.petId,
      (id) => (id ? PETS[id].name : 'ไม่ใส่'),
      (id) => (id ? PETS[id].desc : 'ไม่ใส่สัตว์เลี้ยง'),
      (id) => this.setPet(id)
    );

    const bag = huntSession.getBag();
    const bagText = bag.length > 0 ? bag.map((it) => `${it.name} x${it.count}`).join('  ·  ') : 'ว่างเปล่า';
    this.text(cx, 488, `กระเป๋า: ${bagText}`, 12, '#a8e6a3');

    const btn = this.rect(cx, 538, 280, 40, 0x3a2a08, 1, 0xffd54a);
    btn.setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => this.startHunt());
    this.text(cx, 538, 'กด ENTER เพื่อออกล่า', 18, '#ffd54a', 0.5, true);
  }
}