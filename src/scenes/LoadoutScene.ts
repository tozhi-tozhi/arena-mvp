// src/scenes/LoadoutScene.ts — ห้องแต่งตัว: เลือกตัวละคร / เครื่องราง / สัตว์เลี้ยง
// เข้าจากฐานด้วย E ที่วงม่วง (หรือปุ่ม L) · ออกแล้วกลับไปยืน "จุดเดิม" ในฐาน
// ซ้าย = เวทีกระจกเห็นตัวละครที่เลือกจริง · ขวา = การ์ดเลือก (คลิกหรือปุ่มลัด)
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DEPTH } from '../config';
import { BASE_COLOR } from '../data/base';
import { CHARACTERS, CHARACTER_IDS, type CharacterId } from '../data/characters';
import { CHARMS, CHARM_IDS, type CharmId } from '../data/charms';
import { PETS, PET_IDS, type PetId } from '../data/pets';
import { loadout } from '../systems/Loadout';
import { huntSession } from '../systems/HuntSession';
import { saveGame } from '../systems/SaveGame';
import { levelOf, starsOf, MAX_STARS, charmEffectLines, petEffectLines } from '../systems/Upgrades';
import { makeGlow, makeVignette } from '../systems/effects';
import { bakeBaseTextures, BASE_TEX } from '../systems/baseTextures';
import { sfx } from '../systems/sfx';

// ---------- เลย์เอาต์ (ปรับที่นี่ที่เดียว) ----------
const L = {
  titleY: 32,
  hintY: 58,
  stageX: 172,
  stageTop: 86,
  stageW: 268,
  stageH: 400,
  previewY: 322,
  nameY: 424,
  tagY: 448,
  listX: 320,
  listW: 456,
  charHeadY: 96,
  charTop: 112,
  charH: 76,
  charmHeadY: 282,
  charmTop: 296,
  petHeadY: 396,
  petTop: 410,
  slotH: 84,
  toastY: 508,
  backY: 548
};

export class LoadoutScene extends Phaser.Scene {
  private objs: Phaser.GameObjects.GameObject[] = [];
  private toast: Phaser.GameObjects.Text | null = null;
  private leaving = false;

  constructor() { super({ key: 'LoadoutScene' }); }

  preload() {
    this.load.image('preview_akkhani', 'assets/characters/akkhani/char_akkhani_idle_01.png');
    this.load.image('preview_luma', 'assets/hero_clay_idle.png');
    this.load.image('hero', 'assets/hero.png');
  }

  create() {
    this.leaving = false;
    bakeBaseTextures(this);
    this.cameras.main.setBackgroundColor('#14100a');

    // พื้นเดียวกับฐาน = รู้สึกว่าเป็นห้องในบ้านเดียวกัน
    this.add.image(0, 0, BASE_TEX.floorA).setOrigin(0).setDepth(DEPTH.FLOOR);
    this.add.image(400, 0, BASE_TEX.floorB).setOrigin(0).setDepth(DEPTH.FLOOR);
    this.add.image(0, 400, BASE_TEX.floorB).setOrigin(0).setDepth(DEPTH.FLOOR);
    this.add.image(400, 400, BASE_TEX.floorA).setOrigin(0).setDepth(DEPTH.FLOOR);
    this.add.tileSprite(0, 0, GAME_WIDTH, 26, BASE_TEX.wallH).setOrigin(0).setDepth(DEPTH.WALL);
    makeVignette(this);

    const kb = this.input.keyboard as any;
    kb.on('keydown-ESC', () => this.backToBase());
    kb.on('keydown-E', () => this.backToBase());
    kb.on('keydown-ONE', () => this.pickCharacter(CHARACTER_IDS[0]));
    kb.on('keydown-TWO', () => this.pickCharacter(CHARACTER_IDS[1]));
    kb.on('keydown-C', () => this.cycleCharm());
    kb.on('keydown-P', () => this.cyclePet());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      kb.removeAllListeners();
      this.objs.forEach((o) => this.tweens.killTweensOf(o));
    });

    this.render();
  }

  // ---------- ออกจากห้อง → กลับฐานจุดเดิม ----------
  private backToBase() {
    if (this.leaving) return;
    this.leaving = true;
    saveGame();
    huntSession.markFromDressing();
    sfx.open();
    this.scene.start('BaseScene');
  }

  // ---------- ตัวเลือก ----------
  private pickCharacter(id: CharacterId) {
    if (loadout.characterId === id) return;
    loadout.characterId = id;
    saveGame();
    sfx.pickup();
    this.flash(`เลือก ${CHARACTERS[id].name} แล้ว`);
    this.render();
  }

  private pickCharm(id: CharmId | null) {
    loadout.charmId = id;
    saveGame();
    sfx.pickup();
    this.flash(id ? `ใส่ ${CHARMS[id].name}` : 'ถอดเครื่องรางแล้ว');
    this.render();
  }

  private pickPet(id: PetId | null) {
    loadout.petId = id;
    saveGame();
    sfx.pickup();
    this.flash(id ? `เรียก ${PETS[id].name} มาติดตาม` : 'ส่งสัตว์เลี้ยงกลับแล้ว');
    this.render();
  }

  private cycleCharm() {
    const list: (CharmId | null)[] = [null, ...CHARM_IDS];
    this.pickCharm(list[(list.indexOf(loadout.charmId) + 1) % list.length]);
  }

  private cyclePet() {
    const list: (PetId | null)[] = [null, ...PET_IDS];
    this.pickPet(list[(list.indexOf(loadout.petId) + 1) % list.length]);
  }

  // ---------- ตัวช่วยวาด ----------
  private text(x: number, y: number, str: string, size: number, color: string, originX = 0.5, bold = false) {
    const t = this.add.text(x, y, str, {
      fontFamily: '"Noto Sans Thai", monospace',
      fontSize: `${size}px`,
      fontStyle: bold ? 'bold' : 'normal',
      color,
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(originX, 0.5).setDepth(DEPTH.HUD);
    this.objs.push(t);
    return t;
  }

  private rect(x: number, y: number, w: number, h: number, fill: number, alpha = 1, stroke?: number) {
    const r = this.add.rectangle(x, y, w, h, fill, alpha).setDepth(DEPTH.HUD);
    if (stroke !== undefined) r.setStrokeStyle(2, stroke);
    this.objs.push(r);
    return r;
  }

  private button(x: number, y: number, w: number, h: number, label: string, onPick: () => void, accent = 0xffd54a) {
    const box = this.rect(x, y, w, h, 0x2a2210, 1, accent);
    box.setInteractive({ useHandCursor: true });
    box.on('pointerover', () => box.setFillStyle(0x3d3016));
    box.on('pointerout', () => box.setFillStyle(0x2a2210));
    box.on('pointerdown', () => this.time.delayedCall(0, onPick));
    this.text(x, y, label, 13, '#ffe9a3', 0.5, true);
    return box;
  }

  private flash(msg: string) {
    if (this.toast?.active) this.toast.destroy();
    this.toast = this.add.text(GAME_WIDTH / 2, L.toastY, msg, {
      fontFamily: '"Noto Sans Thai", monospace',
      fontSize: '14px', fontStyle: 'bold', color: '#7dff9b',
      backgroundColor: 'rgba(0,0,0,0.82)', padding: { x: 12, y: 4 },
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5).setDepth(DEPTH.OVERLAY_TEXT);
    this.tweens.add({
      targets: this.toast, alpha: 0, delay: 1200, duration: 400,
      onComplete: () => this.toast?.destroy()
    });
  }

  // ---------- วาดทั้งหน้า ----------
  private render() {
    this.objs.forEach((o) => { this.tweens.killTweensOf(o); o.destroy(); });
    this.objs = [];

    this.text(GAME_WIDTH / 2, L.titleY, 'ห้องแต่งตัว', 26, '#ffd54a', 0.5, true);
    this.text(GAME_WIDTH / 2, L.hintY, 'คลิกเลือกได้เลย · 1/2 ตัวละคร · C เครื่องราง · P สัตว์เลี้ยง · E หรือ ESC กลับฐาน', 11, '#a89f8c');

    this.renderStage();
    this.renderCharacters();
    this.renderCharm();
    this.renderPet();

    this.button(GAME_WIDTH / 2, L.backY, 220, 36, 'กลับฐาน (E)', () => this.backToBase(), 0x7dff9b);
  }

  // ---------- เวทีกระจก: เห็นตัวละคร + ของที่ใส่จริง ----------
  private renderStage() {
    const id = loadout.characterId;
    const def = CHARACTERS[id];
    const cx = L.stageX;

    this.rect(cx, L.stageTop + L.stageH / 2, L.stageW, L.stageH, 0x1b1810, 0.9, 0x4a4130);

    const mirror = this.add.image(cx, L.stageTop + 118, BASE_TEX.mirror).setDepth(DEPTH.ENEMY);
    mirror.setScale(1.15);
    this.objs.push(mirror);
    const rack = this.add.image(cx - 96, L.stageTop + 150, BASE_TEX.rack).setDepth(DEPTH.ENEMY).setScale(0.6);
    this.objs.push(rack);

    makeGlow(this, cx, L.previewY + 20, 96, BASE_COLOR.violet, true);

    // แท่นยืน + เงา
    const pad = this.add.ellipse(cx, L.previewY + 86, 150, 34, 0x2a2210, 1).setDepth(DEPTH.FLOOR + 2);
    pad.setStrokeStyle(2, BASE_COLOR.gold, 0.6);
    this.objs.push(pad);
    const shadow = this.add.ellipse(cx + 6, L.previewY + 84, 108, 24, 0x000000, 0.38).setDepth(DEPTH.PLAYER_SHADOW);
    this.objs.push(shadow);

    const key = this.textures.exists(`preview_${id}`) ? `preview_${id}` : 'hero';
    if (this.textures.exists(key)) {
      const img = this.add.image(cx, L.previewY, key).setDepth(DEPTH.PLAYER);
      img.setScale(Math.min(196 / img.width, 176 / img.height));
      this.objs.push(img);
      this.tweens.add({
        targets: img, y: L.previewY - 6, duration: 1700,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });
    }

    // เครื่องรางที่ใส่ = ตราเล็กซ้าย · สัตว์เลี้ยงที่พา = ลอยขวา
    if (loadout.charmId) {
      const am = this.add.rectangle(cx - 92, L.previewY - 10, 20, 20, BASE_COLOR.gold, 0.9).setDepth(DEPTH.PLAYER + 1);
      am.setAngle(45).setStrokeStyle(2, 0xffffff, 0.7);
      this.objs.push(am);
      this.text(cx - 92, L.previewY + 16, 'เครื่องราง', 9, '#ffd54a');
    }
    if (loadout.petId) {
      const col = PETS[loadout.petId].color;
      const pet = this.add.circle(cx + 92, L.previewY - 26, 10, col).setDepth(DEPTH.PLAYER + 1);
      pet.setStrokeStyle(2, 0xffffff, 0.8);
      this.objs.push(pet);
      const eye = this.add.circle(cx + 95, L.previewY - 29, 2.4, 0x000000).setDepth(DEPTH.PLAYER + 2);
      this.objs.push(eye);
      this.tweens.add({
        targets: [pet, eye], y: '-=7', duration: 900,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });
      this.text(cx + 92, L.previewY + 4, PETS[loadout.petId].name, 9, '#fff27a');
    }

    const st = starsOf(id);
    this.text(cx, L.nameY, def.name, 21, '#ffffff', 0.5, true);
    this.text(cx, L.nameY + 22, '★'.repeat(st) + '☆'.repeat(MAX_STARS - st), 16, '#ffd54a');
    this.text(cx, L.tagY + 22, def.tagline, 10, '#a89f8c');
  }

  // ---------- การ์ดตัวละคร 2 ใบ ----------
  private renderCharacters() {
    const left = L.listX;
    this.text(left, L.charHeadY, 'ตัวละคร', 15, '#ffd54a', 0, true);
    this.text(left + L.listW, L.charHeadY, 'ปุ่ม 1 / 2', 10, '#8d8677', 1);

    CHARACTER_IDS.forEach((id, i) => {
      const def = CHARACTERS[id];
      const top = L.charTop + i * (L.charH + 6);
      const cy = top + L.charH / 2;
      const on = loadout.characterId === id;
      const card = this.rect(left + L.listW / 2, cy, L.listW, L.charH, on ? 0x241c0c : 0x1b1810, 1, on ? 0xffd54a : 0x3d3524);
      card.setInteractive({ useHandCursor: true });
      card.on('pointerdown', () => this.time.delayedCall(0, () => this.pickCharacter(id)));
      if (on) this.rect(left + 3, cy, 4, L.charH - 10, BASE_COLOR.gold, 0.9);

      const key = this.textures.exists(`preview_${id}`) ? `preview_${id}` : 'hero';
      if (this.textures.exists(key)) {
        const thumb = this.add.image(left + 36, cy, key).setDepth(DEPTH.HUD + 1).setAlpha(on ? 1 : 0.5);
        thumb.setScale(Math.min(52 / thumb.width, 62 / thumb.height));
        this.objs.push(thumb);
      }

      const st = starsOf(id);
      this.text(left + 72, top + 18, `${def.name}  ${'★'.repeat(st)}${'☆'.repeat(MAX_STARS - st)}`, 16, on ? '#ffffff' : '#8d8677', 0, true);
      this.text(left + 72, top + 40, `เลือด ${def.maxHP} · เร็ว ${def.speed} · สกิล ${def.skillName}`, 11, '#c9c2b2', 0);
      this.text(left + 72, top + 58, def.lines[2], 10, '#9de7ff', 0);
      this.text(left + L.listW - 14, cy, on ? '● ใช้อยู่' : `เลือก (${i + 1})`, 12, on ? '#7dff9b' : '#8d8677', 1, on);
    });
  }

  // ---------- ช่องเครื่องราง ----------
  private renderCharm() {
    const left = L.listX;
    const top = L.charmTop;
    const cy = top + L.slotH / 2;
    const id = loadout.charmId;
    this.text(left, L.charmHeadY, 'เครื่องราง', 15, '#ffd54a', 0, true);
    this.text(left + L.listW, L.charmHeadY, 'ปุ่ม C', 10, '#8d8677', 1);
    this.rect(left + L.listW / 2, cy, L.listW, L.slotH, 0x1b1810, 1, id ? 0x5a4a20 : 0x3d3524);

    if (!id) {
      this.text(left + 16, top + 26, 'ไม่ได้ใส่เครื่องราง', 14, '#8d8677', 0);
      this.text(left + 16, top + 50, 'เครื่องรางทำงานตอนโจมตีโดนศัตรู', 11, '#6f6858', 0);
    } else {
      const lv = levelOf('charm', id);
      this.text(left + 16, top + 20, `${CHARMS[id].name}  Lv.${lv}`, 15, '#ffffff', 0, true);
      charmEffectLines(id, lv).forEach((ln, k) => {
        this.text(left + 16, top + 42 + k * 18, `${ln.label}: ${ln.now}`, 11, '#c9c2b2', 0);
      });
    }

    const list: (CharmId | null)[] = [null, ...CHARM_IDS];
    const next = list[(list.indexOf(id) + 1) % list.length];
    this.button(left + L.listW - 104, cy + 20, 190, 28,
      next ? `เปลี่ยนเป็น ${CHARMS[next].name}` : 'ถอดเครื่องราง',
      () => this.pickCharm(next), 0x9de7ff);
  }

  // ---------- ช่องสัตว์เลี้ยง ----------
  private renderPet() {
    const left = L.listX;
    const top = L.petTop;
    const cy = top + L.slotH / 2;
    const id = loadout.petId;
    this.text(left, L.petHeadY, 'สัตว์เลี้ยง', 15, '#ffd54a', 0, true);
    this.text(left + L.listW, L.petHeadY, 'ปุ่ม P', 10, '#8d8677', 1);
    this.rect(left + L.listW / 2, cy, L.listW, L.slotH, 0x1b1810, 1, id ? 0x5a4a20 : 0x3d3524);

    if (!id) {
      this.text(left + 16, top + 26, 'ไม่มีสัตว์เลี้ยงติดตาม', 14, '#8d8677', 0);
      this.text(left + 16, top + 50, 'สัตว์เลี้ยงทำงานเองตามเวลา ไม่ต้องสั่ง', 11, '#6f6858', 0);
    } else {
      const lv = levelOf('pet', id);
      this.text(left + 16, top + 20, `${PETS[id].name}  Lv.${lv}`, 15, '#ffffff', 0, true);
      petEffectLines(id, lv).forEach((ln, k) => {
        this.text(left + 16, top + 42 + k * 18, `${ln.label}: ${ln.now}`, 11, '#c9c2b2', 0);
      });
    }

    const list: (PetId | null)[] = [null, ...PET_IDS];
    const next = list[(list.indexOf(id) + 1) % list.length];
    this.button(left + L.listW - 104, cy + 20, 190, 28,
      next ? `เปลี่ยนเป็น ${PETS[next].name}` : 'ส่งกลับ (ไม่พาไป)',
      () => this.pickPet(next), 0xfff27a);
  }
}