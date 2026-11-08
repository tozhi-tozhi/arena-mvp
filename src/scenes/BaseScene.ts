// หน้า "ฐานนักล่า" — เลือกตัวละคร แล้วออกไปล่า
import Phaser from 'phaser';
import { GAME_WIDTH, DEV_TOOLS } from '../config';
import { CHARACTERS, CHARACTER_IDS, type CharacterId } from '../data/characters';
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
    kb.on('keydown-ONE', () => this.choose(CHARACTER_IDS[0]));
    kb.on('keydown-TWO', () => this.choose(CHARACTER_IDS[1]));
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

  private choose(id: CharacterId) {
    if (loadout.characterId === id) return;
    loadout.characterId = id;
    saveGame();
    this.render();
  }

  private startHunt() {
    if (this.starting) return;
    this.starting = true;
    saveGame();
    this.scene.start('GameScene');
  }

  // ---------- วาดหน้าจอทั้งหมดใหม่ ----------
  private render() {
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
    const cx = GAME_WIDTH / 2;

    this.text(cx, 40, 'ฐานนักล่า', 32, '#ffd54a', 0.5, true);
    this.text(cx, 74, 'เลือกตัวละคร (กด 1 / 2 หรือคลิกการ์ด)', 14, '#c9c9c9');

    CHARACTER_IDS.forEach((id, i) => {
      const def = CHARACTERS[id];
      const x = cx + (i === 0 ? -170 : 170);
      const y = 270;
      const selected = loadout.characterId === id;

      const card = this.rect(x, y, 320, 340, selected ? 0x2a2210 : 0x1b1810, 1, selected ? 0xffd54a : 0x4a4130);
      card.setInteractive({ useHandCursor: true });
      card.on('pointerdown', () => {
        this.time.delayedCall(0, () => this.choose(id));
      });

      this.text(x, y - 140, `${i + 1}  ${def.name}`, 24, selected ? '#ffd54a' : '#ffffff', 0.5, true);
      this.text(x, y - 112, def.tagline, 13, '#c9c9c9');

      if (this.textures.exists('hero')) {
        const img = this.add.image(x, y - 55, 'hero').setScale(3).setTint(def.tint);
        this.objs.push(img);
      }

      def.lines.forEach((line, k) => {
        this.text(x, y + 15 + k * 28, line, 13, '#e8e8e8');
      });

      this.text(x, y + 140, `HP ${def.maxHP}`, 14, '#ff8a80', 0.5, true);
    });

    const bag = huntSession.getBag();
    const bagText = bag.length > 0 ? bag.map((it) => `${it.name} x${it.count}`).join('  ·  ') : 'ว่างเปล่า';
    this.text(cx, 482, `กระเป๋า: ${bagText}`, 13, '#a8e6a3');

    const btn = this.rect(cx, 535, 280, 44, 0x3a2a08, 1, 0xffd54a);
    btn.setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => this.startHunt());
    this.text(cx, 535, 'กด ENTER เพื่อออกล่า', 18, '#ffd54a', 0.5, true);
  }
}