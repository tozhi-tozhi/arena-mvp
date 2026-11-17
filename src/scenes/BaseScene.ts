// src/scenes/BaseScene.ts — ฐานนักล่าแบบเดินได้ (Walkable Hub MVP)
// ใช้ PlayerActor ตัวเดียวกับใน WorldScene เพื่อความสม่ำเสมอ
// เดินด้วย WASD · กด E ที่จุด Interactive เพื่อใช้งาน · T = The World · ENTER = ห้องฝึก
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DEPTH, DEV_TOOLS } from '../config';
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
import { levelOf, starsOf, MAX_STARS } from '../systems/Upgrades';
import { PlayerActor } from '../actors/PlayerActor';
import { makeGlow } from '../systems/effects';
import { sfx } from '../systems/sfx';

let saveLoaded = false; // โหลดเซฟแค่ครั้งแรกที่เปิดเกม

interface Interactable {
  x: number;
  y: number;
  radius: number;
  label: string;
  color: number;
  onInteract: () => void;
}

export class BaseScene extends Phaser.Scene {
  private actor!: PlayerActor;
  private interactables: Interactable[] = [];
  private promptText!: Phaser.GameObjects.Text;
  private activeInteractable: Interactable | null = null;
  private uiTexts: Phaser.GameObjects.Text[] = [];
  private starting: boolean = false;

  constructor() { super({ key: 'BaseScene' }); }

  preload() {
    PlayerActor.preloadAssets(this);
  }

  create() {
    ensureItemIcons(this);
    if (!saveLoaded) { loadGame(); saveLoaded = true; }
    this.starting = false;
    this.uiTexts = [];
    this.interactables = [];
    this.activeInteractable = null;
    this.cameras.main.setBackgroundColor('#120f09');

    const W = 1600;
    const H = 1200;
    this.physics.world.setBounds(0, 0, W, H);

    // ---------- วาดพื้นหลัง ----------
    for (let x = 0; x < W; x += 64) {
      for (let y = 0; y < H; y += 64) {
        const color = (x / 64 + y / 64) % 2 === 0 ? 0x2a2210 : 0x1b1810;
        this.add.rectangle(x + 32, y + 32, 64, 64, color).setDepth(DEPTH.FLOOR);
      }
    }

    // ---------- สร้างจุด Interactive ----------
    this.createInteractable(W / 2 - 400, H / 2 - 250, 'โรงตีเหล็ก (F)', 0xffd166, () => this.openForge());
    this.createInteractable(W / 2 + 400, H / 2 - 250, 'กระเป๋า (B)', 0x9de7ff, () => this.openBag());
    this.createInteractable(W / 2 - 400, H / 2 + 250, 'ห้องฝึกซ้อม (ENTER)', 0xff5a3a, () => this.startHunt());
    this.createInteractable(W / 2 + 400, H / 2 + 250, 'ประตูสู่โลกกว้าง (T)', 0x7dff9b, () => this.startWorld());

    // ---------- สร้างผู้เล่น ----------
    this.actor = new PlayerActor(this, W / 2, H / 2, {
      getTargets: () => [], // ไม่มีศัตรูในฐาน
      onDeathShown: () => {} // ไม่มีทางตายในฐาน
    });

    // ---------- กล้อง ----------
    const cam = this.cameras.main;
    cam.setBounds(0, 0, W, H);
    cam.startFollow(this.actor.sprite, true, 0.08, 0.08);
    cam.setDeadzone(440, 340);

    // ---------- ตั้งค่าปุ่มลัด ----------
    const kb = this.input.keyboard as any;
    // เปลี่ยน W เป็น T เพื่อไม่ให้ชนกับ WASD
    kb.on('keydown-T', () => this.startWorld());
    kb.on('keydown-ENTER', () => this.startHunt());
    kb.on('keydown-F', () => this.openForge());
    kb.on('keydown-B', () => this.openBag());
    kb.on('keydown-C', () => this.cycleCharm());
    kb.on('keydown-P', () => this.cyclePet());
    kb.on('keydown-ONE', () => this.chooseCharacter(CHARACTER_IDS[0]));
    kb.on('keydown-TWO', () => this.chooseCharacter(CHARACTER_IDS[1]));

    if (DEV_TOOLS) {
      kb.on('keydown-F2', () => {
        const grant: { rarity: Rarity; n: number }[] = [
          { rarity: 'common', n: 12 },
          { rarity: 'rare', n: 6 },
          { rarity: 'epic', n: 3 },
          { rarity: 'legendary', n: 1 }
        ];
        LOOT_TABLE.forEach((loot) => {
          grant.forEach((g) => {
            for (let i = 0; i < g.n; i++) huntSession.addItem({ ...loot, rarity: g.rarity });
          });
        });
        saveGame();
        this.showToast('แจกของทดสอบเรียบร้อย');
        this.renderHUD(); // อัปเดตตัวเลขกระเป๋า
      });
      kb.on('keydown-F9', () => { resetSave(); this.renderHUD(); });
    }

    // ปุ่มโต้ตอบ E (ใช้เปิดจุด Interactive)
    this.keyE = kb.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => kb.removeAllListeners());

    // ---------- HUD ----------
    this.promptText = this.add.text(0, 0, '', {
      fontFamily: '"Noto Sans Thai", monospace', fontSize: '16px', fontStyle: 'bold',
      color: '#ffffff', stroke: '#000000', strokeThickness: 4, backgroundColor: 'rgba(0,0,0,0.6)', padding: { x: 8, y: 4 }
    }).setOrigin(0.5).setDepth(DEPTH.HUD).setScrollFactor(0).setVisible(false);

    this.renderHUD();
  }

  private keyE!: Phaser.Input.Keyboard.Key;

  update(_time: number, delta: number) {
    if (!this.actor) return;
    this.actor.update(delta);

    // หา Interactable ที่ใกล้ที่สุด
    let bestDist = Infinity;
    let best: Interactable | null = null;
    const px = this.actor.x;
    const py = this.actor.y;

    for (const i of this.interactables) {
      const d = Phaser.Math.Distance.Between(px, py, i.x, i.y);
      if (d <= i.radius && d < bestDist) {
        bestDist = d;
        best = i;
      }
    }

    this.activeInteractable = best;

    if (best) {
      this.promptText.setPosition(GAME_WIDTH / 2, GAME_HEIGHT - 80).setVisible(true).setText(`[E] ${best.label}`);
      
      if (Phaser.Input.Keyboard.JustDown(this.keyE) && !this.starting) {
        sfx.pickup();
        best.onInteract();
      }
    } else {
      this.promptText.setVisible(false);
    }
  }

  // ---------- ตัวช่วยสร้างจุด Interactive ----------
  private createInteractable(x: number, y: number, label: string, color: number, onInteract: () => void) {
    this.interactables.push({ x, y, radius: 100, label, color, onInteract });

    // วาดฐาน (Pedestal)
    const base = this.add.circle(x, y, 30, 0x333333);
    base.setStrokeStyle(3, color);
    base.setDepth(DEPTH.FLOOR + 1);

    // แสงอำพัน (P3b)
    makeGlow(this, x, y, 60, color, true);

    // ป้ายชื่อ
    this.add.text(x, y - 50, label, {
      fontFamily: '"Noto Sans Thai", monospace', fontSize: '14px', fontStyle: 'bold',
      color: '#ffffff', stroke: '#000000', strokeThickness: 3, align: 'center'
    }).setOrigin(0.5).setDepth(DEPTH.HUD);
  }

  // ---------- การทำงานของปุ่ม ----------
  private chooseCharacter(id: CharacterId) {
    if (loadout.characterId === id) return;
    loadout.characterId = id; saveGame();
    this.scene.restart(); // รีสตาร์ทเพื่อโหลดโมเดลใหม่
  }
  private setCharm(id: CharmId | null) { loadout.charmId = id; saveGame(); this.renderHUD(); }
  private setPet(id: PetId | null) { loadout.petId = id; saveGame(); this.renderHUD(); }
  private cycleCharm() {
    const list: (CharmId | null)[] = [null, ...CHARM_IDS];
    this.setCharm(list[(list.indexOf(loadout.charmId) + 1) % list.length]);
    this.showToast(`เครื่องราง: ${loadout.charmId ? CHARMS[loadout.charmId].name : 'ไม่ใส่'}`);
  }
  private cyclePet() {
    const list: (PetId | null)[] = [null, ...PET_IDS];
    this.setPet(list[(list.indexOf(loadout.petId) + 1) % list.length]);
    this.showToast(`สัตว์เลี้ยง: ${loadout.petId ? PETS[loadout.petId].name : 'ไม่ใส่'}`);
  }
  private setBoss(id: BossId | null) { loadout.bossChoice = id ?? 'random'; saveGame(); this.showToast(`บอสเป้าหมาย: ${id ? BOSSES[id].name : 'สุ่ม'}`); }

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
  private startWorld() {
    if (this.starting) return;
    this.starting = true;
    saveGame();
    this.scene.start('WorldScene');
  }
  private startHunt() {
    if (this.starting) return;
    this.starting = true;
    saveGame();
    this.scene.start('GameScene');
  }

  // ---------- HUD (มุมจอ) ----------
  private renderHUD() {
    this.uiTexts.forEach(t => t.destroy());
    this.uiTexts = [];

    const bagCount = huntSession.getTotalCount();
    const st = starsOf(loadout.characterId);
    const starStr = '★'.repeat(st) + '☆'.repeat(MAX_STARS - st);

    const textStyle = {
      fontFamily: '"Noto Sans Thai", monospace', fontSize: '14px',
      color: '#ffffff', stroke: '#000000', strokeThickness: 3
    };

    // ข้อมูลด้านซ้ายบน
    this.uiTexts.push(this.add.text(20, 20, 
      `นักล่า: ${CHARACTERS[loadout.characterId].name} ${starStr}\n` +
      `เครื่องราง: ${loadout.charmId ? CHARMS[loadout.charmId].name + ` Lv.${levelOf('charm', loadout.charmId)}` : 'ไม่ใส่'}\n` +
      `สัตว์เลี้ยง: ${loadout.petId ? PETS[loadout.petId].name + ` Lv.${levelOf('pet', loadout.petId)}` : 'ไม่ใส่'}\n` +
      `กระเป๋า: ${bagCount} ชิ้น`,
      textStyle
    ).setDepth(DEPTH.HUD).setScrollFactor(0));

    // คำใบ้ปุ่มลัดด้านล่าง
    this.uiTexts.push(this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 20, 
      'WASD เดิน · 1/2 เปลี่ยนตัวละคร · C/P เปลี่ยนเครื่องราง/สัตว์เลี้ยง · F/B โรงตีเหล็ก/กระเป๋า', 
      { fontFamily: '"Noto Sans Thai", monospace', fontSize: '11px', color: '#a89f8c', stroke: '#000000', strokeThickness: 2 }
    ).setOrigin(0.5, 1).setDepth(DEPTH.HUD).setScrollFactor(0));
  }

  // ---------- Toast ข้อความแจ้งเตือน ----------
  private showToast(msg: string) {
    const toast = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 140, msg, {
      fontFamily: '"Noto Sans Thai", monospace', fontSize: '16px', fontStyle: 'bold',
      color: '#7dff9b', stroke: '#000000', strokeThickness: 4,
      backgroundColor: 'rgba(0,0,0,0.7)', padding: { x: 12, y: 6 }
    }).setOrigin(0.5).setDepth(DEPTH.OVERLAY).setScrollFactor(0);

    this.tweens.add({
      targets: toast, alpha: 0, y: toast.y - 20, delay: 1500, duration: 500,
      onComplete: () => toast.destroy()
    });
  }
}