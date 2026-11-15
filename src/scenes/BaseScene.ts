// หน้า "ฐานนักล่า" — เลือกตัวละคร / เครื่องราง / สัตว์เลี้ยง / บอส แล้วออกไปล่า
// กระเป๋าแยกไปหน้า BagScene แล้ว หน้านี้จึงโปร่งขึ้นมาก
import Phaser from 'phaser';
import { GAME_WIDTH, DEV_TOOLS } from '../config';
import { CHARACTERS, CHARACTER_IDS, type CharacterId } from '../data/characters';
import { CHARMS, CHARM_IDS, type CharmId } from '../data/charms';
import { PETS, PET_IDS, type PetId } from '../data/pets';
import { BOSSES, BOSS_IDS, type BossId } from '../data/bosses';
import { LOOT_TABLE } from '../data/loot';
import type { Rarity } from '../data/rarity';
import { huntSession } from '../systems/HuntSession';
import { loadout } from '../systems/Loadout';
import { loadGame, saveGame, resetSave } from '../systems/SaveGame';
import { ensureItemIcons } from '../systems/itemIcons';
import { levelOf } from '../systems/Upgrades';

// ---------- ตำแหน่งบนจอ (แก้เลย์เอาต์ที่นี่ที่เดียว) ----------
const L = {
  titleY: 30,
  hintY: 56,
  cardY: 172,
  cardH: 200,
  rowCharmY: 316,
  rowPetY: 376,
  rowBossY: 436,
  buttonY: 540
};

let saveLoaded = false; // โหลดเซฟแค่ครั้งแรกที่เปิดเกม

export class BaseScene extends Phaser.Scene {
  private objs: Phaser.GameObjects.GameObject[] = [];
  private starting: boolean = false;

  constructor() { super({ key: 'BaseScene' }); }

  preload() { this.load.image('hero', 'assets/hero.png'); }

  create() {
    ensureItemIcons(this);
    if (!saveLoaded) { loadGame(); saveLoaded = true; }
    this.starting = false;
    this.objs = [];
    this.cameras.main.setBackgroundColor('#120f09');

    const kb = this.input.keyboard as any;
    kb.on('keydown-ONE', () => this.chooseCharacter(CHARACTER_IDS[0]));
    kb.on('keydown-TWO', () => this.chooseCharacter(CHARACTER_IDS[1]));
    kb.on('keydown-C', () => this.cycleCharm());
    kb.on('keydown-P', () => this.cyclePet());
    kb.on('keydown-B', () => this.openBag());
    kb.on('keydown-F', () => this.openForge());
    kb.on('keydown-ENTER', () => this.startHunt());

    if (DEV_TOOLS) {
      // แจกของครบทุกระดับ เพื่อทดสอบหน้ากระเป๋า/หลอม/อัปเกรดได้ทันที
      kb.on('keydown-F2', () => {
        const grant: { rarity: Rarity; n: number }[] = [
          { rarity: 'common', n: 12 },
          { rarity: 'rare', n: 4 },
          { rarity: 'epic', n: 2 },
          { rarity: 'legendary', n: 1 }
        ];
        LOOT_TABLE.forEach((loot) => {
          grant.forEach((g) => {
            for (let i = 0; i < g.n; i++) huntSession.addItem({ ...loot, rarity: g.rarity });
          });
        });
        saveGame();
        this.render();
      });
      kb.on('keydown-F9', () => { resetSave(); this.render(); });
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => kb.removeAllListeners());
    this.render();
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
    }).setOrigin(originX, 0.5);
    this.objs.push(t);
    return t;
  }

  private rect(x: number, y: number, w: number, h: number, fill: number, alpha = 1, stroke?: number) {
    const r = this.add.rectangle(x, y, w, h, fill, alpha);
    if (stroke !== undefined) r.setStrokeStyle(2, stroke);
    this.objs.push(r);
    return r;
  }

  // ---------- การเลือก ----------
  private chooseCharacter(id: CharacterId) {
    if (loadout.characterId === id) return;
    loadout.characterId = id; saveGame(); this.render();
  }
  private setCharm(id: CharmId | null) { loadout.charmId = id; saveGame(); this.render(); }
  private setPet(id: PetId | null) { loadout.petId = id; saveGame(); this.render(); }
  private cycleCharm() {
    const list: (CharmId | null)[] = [null, ...CHARM_IDS];
    this.setCharm(list[(list.indexOf(loadout.charmId) + 1) % list.length]);
  }
  private cyclePet() {
    const list: (PetId | null)[] = [null, ...PET_IDS];
    this.setPet(list[(list.indexOf(loadout.petId) + 1) % list.length]);
  }
  private setBoss(id: BossId | null) { loadout.bossChoice = id ?? 'random'; saveGame(); this.render(); }
  private openBag() {
    if (this.starting) return;
    saveGame();
    if (!this.game.scene.getScene('BagScene')) return;
    this.scene.start('BagScene');
  }
  private openForge() {
    if (this.starting) return;
    saveGame();
    if (!this.game.scene.getScene('UpgradeScene')) return;
    this.scene.start('UpgradeScene');
  }
  private startHunt() {
    if (this.starting) return;
    this.starting = true;
    saveGame();
    this.scene.start('GameScene');
  }

  // ---------- แถวตัวเลือก ----------
  private optionRow<T extends string>(
    y: number, label: string, options: (T | null)[], current: T | null,
    nameOf: (id: T | null) => string, descOf: (id: T | null) => string,
    onPick: (id: T | null) => void
  ) {
    this.text(30, y, label, 14, '#ffd54a', 0, true);

    const btnW = 168, gap = 14;
    const totalW = options.length * btnW + (options.length - 1) * gap;
    const startX = 440 - totalW / 2 + btnW / 2;

    options.forEach((opt, i) => {
      const x = startX + i * (btnW + gap);
      const selected = opt === current;
      const btn = this.rect(x, y, btnW, 32, selected ? 0x2a2210 : 0x1b1810, 1, selected ? 0xffd54a : 0x4a4130);
      btn.setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => this.time.delayedCall(0, () => onPick(opt)));
      this.text(x, y, nameOf(opt), 13, selected ? '#ffd54a' : '#e8e8e8', 0.5, selected);
    });

    this.text(440, y + 24, descOf(current), 11, '#a89f8c');
  }

  // ---------- วาดหน้าจอ ----------
  private render() {
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
    const cx = GAME_WIDTH / 2;

    this.text(cx, L.titleY, 'ฐานนักล่า', 26, '#ffd54a', 0.5, true);
    this.text(cx, L.hintY, 'ENTER ออกล่า · F โรงตีเหล็ก · B กระเป๋า · 1/2 ตัวละคร · C เครื่องราง · P สัตว์เลี้ยง', 11, '#a89f8c');

    // การ์ดตัวละคร
    CHARACTER_IDS.forEach((id, i) => {
      const def = CHARACTERS[id];
      const x = cx + (i === 0 ? -172 : 172);
      const y = L.cardY;
      const selected = loadout.characterId === id;

      const card = this.rect(x, y, 330, L.cardH, selected ? 0x2a2210 : 0x1b1810, 1, selected ? 0xffd54a : 0x4a4130);
      card.setInteractive({ useHandCursor: true });
      card.on('pointerdown', () => this.time.delayedCall(0, () => this.chooseCharacter(id)));

      this.text(x, y - 78, `${i + 1}  ${def.name}`, 20, selected ? '#ffd54a' : '#ffffff', 0.5, true);
      this.text(x, y - 56, def.tagline, 11, '#a89f8c');

      if (this.textures.exists('hero')) {
        const img = this.add.image(x - 128, y + 16, 'hero').setScale(1.6).setTint(def.tint);
        this.objs.push(img);
      }

      def.lines.forEach((line, k) => {
        this.text(x - 92, y - 24 + k * 22, line, 11, '#e8e8e8', 0);
      });
      this.text(x, y + 80, `HP ${def.maxHP}`, 13, '#ff8a80', 0.5, true);
    });

    // แถวตัวเลือก — โชว์เลเวลที่อัปเกรดไว้ด้วย
    this.optionRow<CharmId>(L.rowCharmY, 'เครื่องราง', [null, ...CHARM_IDS], loadout.charmId,
      (id) => (id ? `${CHARMS[id].name} Lv.${levelOf('charm', id)}` : 'ไม่ใส่'),
      (id) => (id ? CHARMS[id].desc : 'ไม่ใส่เครื่องราง'),
      (id) => this.setCharm(id));

    this.optionRow<PetId>(L.rowPetY, 'สัตว์เลี้ยง', [null, ...PET_IDS], loadout.petId,
      (id) => (id ? `${PETS[id].name} Lv.${levelOf('pet', id)}` : 'ไม่ใส่'),
      (id) => (id ? PETS[id].desc : 'ไม่ใส่สัตว์เลี้ยง'),
      (id) => this.setPet(id));

    this.optionRow<BossId>(L.rowBossY, 'บอสที่จะล่า', [null, ...BOSS_IDS],
      loadout.bossChoice === 'random' ? null : loadout.bossChoice,
      (id) => (id ? BOSSES[id].name : 'สุ่ม'),
      (id) => (id ? BOSSES[id].desc : 'สุ่มบอสหนึ่งในสองตัว'),
      (id) => this.setBoss(id));

    // ปุ่มล่างสุด 3 ปุ่ม: กระเป๋า / โรงตีเหล็ก / ออกล่า
    const bagCount = huntSession.getTotalCount();
    const bag = this.rect(cx - 250, L.buttonY, 200, 40, 0x241d10, 1, 0x8d8677);
    bag.setInteractive({ useHandCursor: true });
    bag.on('pointerdown', () => this.time.delayedCall(0, () => this.openBag()));
    this.text(cx - 250, L.buttonY, `กระเป๋า (B) · ${bagCount} ชิ้น`, 14, '#e8e8e8', 0.5, true);

    const forge = this.rect(cx, L.buttonY, 200, 40, 0x3a2a08, 1, 0xffd54a);
    forge.setInteractive({ useHandCursor: true });
    forge.on('pointerdown', () => this.time.delayedCall(0, () => this.openForge()));
    this.text(cx, L.buttonY, 'โรงตีเหล็ก (F)', 15, '#ffd54a', 0.5, true);

    const hunt = this.rect(cx + 250, L.buttonY, 200, 40, 0x3a2a08, 1, 0xffd54a);
    hunt.setInteractive({ useHandCursor: true });
    hunt.on('pointerdown', () => this.time.delayedCall(0, () => this.startHunt()));
    this.text(cx + 250, L.buttonY, 'ออกล่า (ENTER)', 15, '#ffd54a', 0.5, true);

    if (DEV_TOOLS) {
      this.text(GAME_WIDTH - 18, 584, 'F2 แจกของทดสอบ · F9 ล้างเซฟ', 9, '#6f6858', 1);
    }
  }
}