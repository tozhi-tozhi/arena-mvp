// src/scenes/BaseScene.ts — ฐานนักล่าแบบเดินได้ (Phase 4 ฉบับสมบูรณ์)
// เดิน WASD / จอยสัมผัส · ยืนในวงเรืองแสงแล้วกดปุ่มแอ็กชันที่ขึ้นมา (คอมกด E ได้) · ปุ่ม ☰ เมนู รวมทุกฟังก์ชัน
// จำที่ยืนตอนไปห้องแต่งตัว/โรงตีเหล็ก/หีบ · กลับจากทริปเกิดกลางฐาน (ตั้งใจ)
// ห้องฝึก = สนามทดสอบของผู้พัฒนาเท่านั้น ปิดไว้เมื่อปล่อยเกมจริง
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DEPTH, DEV_TOOLS, VIEW_SCALE } from '../config';
import { BASE, BASE_COLOR, BASE_SPOTS, type BaseSpotDef, type BaseSpotId } from '../data/base';
import { CHARACTERS, CHARACTER_IDS, type CharacterId } from '../data/characters';
import { CHARMS } from '../data/charms';
import { PETS } from '../data/pets';
import { LOOT_TABLE } from '../data/loot';
import type { Rarity } from '../data/rarity';
import { huntSession } from '../systems/HuntSession';
import { loadout } from '../systems/Loadout';
import { profiles } from '../systems/PlayerProfile';
import { loadGame, saveGame, resetSave } from '../systems/SaveGame';
import { ensureItemIcons } from '../systems/itemIcons';
import { levelOf, starsOf, MAX_STARS } from '../systems/Upgrades';
import { PlayerActor } from '../actors/PlayerActor';
import { makeGlow, makeVignette, burst, ringEffect } from '../systems/effects';
import { AmbientDust } from '../systems/AmbientDust';
import { UiCamera } from '../systems/UiCamera';
import { bakeBaseTextures, BASE_TEX } from '../systems/baseTextures';
import { LogbookPanel } from '../ui/LogbookPanel';
import { BaseMenu, type MenuItem, type MenuToggle } from '../ui/BaseMenu';
import { sfx } from '../systems/sfx';
import { trainingState } from '../systems/trainingState';
import { controls, pressed, CONTROL_LABEL } from '../systems/Controls';
import { canFullscreen, toggleFullscreen } from '../systems/screenMode';

let saveLoaded = false; // โหลดเซฟแค่ครั้งแรกที่เปิดเกม

const CX = BASE.width / 2;
const CY = BASE.height / 2;

/** ห้องออนไลน์พร้อมใช้ไหม — รอบ 2 (ฉาก OnlineScene) เปลี่ยนเป็น true */
const ONLINE_READY = true;

/** ขอบบนของกรอบสถานะมุมขวา (ใต้ปุ่มเมนู) */
const STATUS_TOP = 66;

/** ตำแหน่งปุ่มแอ็กชัน (ขวาล่าง — อยู่นอกโซนจอยซ้าย) */
const ACTION_X = GAME_WIDTH - 130;
const ACTION_Y = GAME_HEIGHT - 70;

/** ชื่อการกระทำที่ขึ้นบนปุ่มเมื่อยืนในวง (แทนคำว่า "กด E") */
const ACTION_NAME: Record<BaseSpotId, string> = {
  wardrobe: 'แต่งตัวและสกิล',
  forge: 'ตีเหล็ก',
  chest: 'เปิดหีบ',
  desk: 'อ่านสมุดบันทึก',
  gate: 'ออกสำรวจ',
  dummy: 'เข้าห้องฝึก'
};

/** ชื่อโหมดควบคุมแบบสั้น สำหรับปุ่มในเมนู */
const CONTROL_SHORT: Record<string, string> = {
  mouse: 'เมาส์',
  keys: 'คีย์บอร์ด',
  touch: 'จอสัมผัส'
};

interface Spot {
  def: BaseSpotDef;
  x: number;
  y: number;
  ring: Phaser.GameObjects.Image;
  onUse: () => void;
}

export class BaseScene extends Phaser.Scene {
  private actor!: PlayerActor;
  private spots: Spot[] = [];
  private nearSpot: Spot | null = null;
  private actionBtn!: Phaser.GameObjects.Rectangle;
  private actionLabel!: Phaser.GameObjects.Text;
  private menu!: BaseMenu;
  private uiTexts: Phaser.GameObjects.Text[] = [];
  private dust: AmbientDust | null = null;
  private logbook: LogbookPanel | null = null;
  private starting = false;
  private nearId: string = '';
  private keyE!: Phaser.Input.Keyboard.Key;
  private keyM!: Phaser.Input.Keyboard.Key;
  private keyEsc!: Phaser.Input.Keyboard.Key;
  private uiCam!: UiCamera;

  constructor() { super({ key: 'BaseScene' }); }

  preload() {
    PlayerActor.preloadAssets(this);
  }

  create() {
    ensureItemIcons(this);
    bakeBaseTextures(this);
    if (!saveLoaded) { loadGame(); saveLoaded = true; }

    this.starting = false;
    trainingState.loadoutReturn = ''; // เข้าฐานแล้ว Loadout ต้องกลับฐานตามปกติ ไม่ใช่ห้องฝึก
    this.nearId = '';
    this.nearSpot = null;
    this.uiTexts = [];
    this.spots = [];
    this.logbook = null;
    this.uiCam = new UiCamera(this);
    this.cameras.main.setBackgroundColor('#0f0c07');
    this.cameras.main.setZoom(VIEW_SCALE);

    const inset = BASE.wall;
    this.physics.world.setBounds(inset, inset, BASE.width - inset * 2, BASE.height - inset * 2);

    this.buildRoom();
    this.buildProps();
    this.buildSpots();

    // ---------- ผู้เล่น: กลับจากห้องแต่งตัว/โรงตีเหล็ก/หีบ = ยืนจุดเดิม ----------
    const back = huntSession.consumeFromDressing();
    const saved = huntSession.getBasePos();
    const lo = inset + 30;
    const px = back && saved ? Phaser.Math.Clamp(saved.x, lo, BASE.width - lo) : CX;
    const py = back && saved ? Phaser.Math.Clamp(saved.y, lo, BASE.height - lo) : CY;
    if (!back) huntSession.clearBasePos(); // จบทริป/เปิดเกมใหม่ = เริ่มกลางฐาน

    this.actor = new PlayerActor(this, px, py, {
      getTargets: () => [],
      onDeathShown: () => {},
      suppressKeyCombat: true
    }, profiles.local);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, BASE.width, BASE.height);
    cam.startFollow(this.actor.sprite, true, 0.08, 0.08);
    cam.setDeadzone(440 / VIEW_SCALE, 340 / VIEW_SCALE);
    cam.fadeIn(320, 0, 0, 0);

    makeVignette(this);
    this.buildMenu();
    this.buildHudFrame();
    this.bindKeys();

    // ---------- บรรยากาศ ----------
    this.dust = new AmbientDust(this, BASE.dust);
    sfx.startAmbient();
    sfx.setTension(false);
    if (!back) this.showTitleCard();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      const kb = this.input.keyboard as any;
      kb.removeAllListeners();
      sfx.stopAmbient();
      if (this.dust) { this.dust.destroy(); this.dust = null; }
      if (this.logbook) { this.logbook.destroy(); this.logbook = null; }
      if (this.menu) this.menu.destroy(); // ปล่อยธงบล็อกจอยสัมผัส
    });

    this.renderHUD();
  }

  // =====================================================
  //  ห้อง: พื้น · ขอบ · ทางเดิน · พรม · โคม · ธง
  // =====================================================
  private buildRoom() {
    for (let x = 0; x < BASE.width; x += 400) {
      for (let y = 0; y < BASE.height; y += 400) {
        const key = ((x / 400 + y / 400) % 2 === 0) ? BASE_TEX.floorA : BASE_TEX.floorB;
        this.add.image(x, y, key).setOrigin(0).setDepth(DEPTH.FLOOR);
      }
    }

    const w = BASE.wall;
    this.add.tileSprite(0, 0, BASE.width, w, BASE_TEX.wallH).setOrigin(0).setDepth(DEPTH.WALL);
    this.add.tileSprite(0, BASE.height - w, BASE.width, w, BASE_TEX.wallH).setOrigin(0).setDepth(DEPTH.WALL);
    this.add.tileSprite(0, 0, w, BASE.height, BASE_TEX.wallV).setOrigin(0).setDepth(DEPTH.WALL);
    this.add.tileSprite(BASE.width - w, 0, w, BASE.height, BASE_TEX.wallV).setOrigin(0).setDepth(DEPTH.WALL);

    // ทางเดินกระดาษจาง ๆ จากพรมไปแต่ละจุด — ชวนเดินโดยไม่ต้องมีลูกศร
    for (const def of BASE_SPOTS) {
      if (def.devOnly && !DEV_TOOLS) continue;
      const tx = CX + def.dx;
      const ty = CY + def.dy;
      const dist = Phaser.Math.Distance.Between(CX, CY + 20, tx, ty);
      const ang = Math.atan2(ty - (CY + 20), tx - CX);
      this.add.rectangle((CX + tx) / 2, (CY + 20 + ty) / 2, dist, 52, BASE_COLOR.paper, 0.045)
        .setRotation(ang).setDepth(DEPTH.FLOOR + 1);
    }

    this.add.image(CX, CY + 20, BASE_TEX.rug).setDepth(DEPTH.FLOOR + 1);

    // โคมกระดาษ 4 มุมพรม + แสงอุ่นที่พื้น
    const lamps: [number, number][] = [[CX - 300, CY - 170], [CX + 300, CY - 170], [CX - 300, CY + 210], [CX + 300, CY + 210]];
    for (const [x, y] of lamps) {
      makeGlow(this, x, y + 34, 118, BASE_COLOR.lamp, true);
      this.add.image(x, y, BASE_TEX.lamp).setDepth(DEPTH.ENEMY);
    }

    // ธงแขวนผนังเหนือ — ไหวเบา ๆ ไม่พร้อมกัน
    [300, 520, 1080, 1300].forEach((x, i) => {
      const b = this.add.image(x, BASE.wall - 6, BASE_TEX.banner).setOrigin(0.5, 0).setDepth(DEPTH.ENEMY);
      b.setAngle(-2.5);
      this.tweens.add({
        targets: b, angle: 2.5, duration: 1700 + i * 260,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });
    });

    // กระถางเฟิร์นมุมห้อง
    for (const [x, y] of [[150, 150], [BASE.width - 150, 150], [150, BASE.height - 160], [BASE.width - 150, BASE.height - 160]] as [number, number][]) {
      this.add.image(x, y, BASE_TEX.pot).setDepth(DEPTH.ENEMY);
    }
  }

  private spotPos(id: BaseSpotId): { x: number; y: number } {
    const def = BASE_SPOTS.find((s) => s.id === id)!;
    return { x: CX + def.dx, y: CY + def.dy };
  }

  private prop(key: string, x: number, y: number, scale = 1) {
    if (!this.textures.exists(key)) return;
    this.add.image(x, y, key).setScale(scale).setDepth(DEPTH.ENEMY);
  }

  // =====================================================
  //  ของตกแต่งแต่ละมุม (วงใช้งานอยู่ทางใต้ของของเสมอ)
  // =====================================================
  private buildProps() {
    // ห้องแต่งตัว: กระจก + ราวผ้า
    const wd = this.spotPos('wardrobe');
    makeGlow(this, wd.x, wd.y - 90, 96, BASE_COLOR.violet, true);
    this.prop(BASE_TEX.mirror, wd.x, wd.y - 100);
    this.prop(BASE_TEX.rack, wd.x - 150, wd.y - 76, 0.95);
    this.prop(BASE_TEX.pot, wd.x + 150, wd.y - 70, 0.9);

    // โรงตีเหล็ก: เตา + ทั่ง + กระสอบ + แสงถ่าน
    const fg = this.spotPos('forge');
    makeGlow(this, fg.x - 6, fg.y - 66, 128, BASE_COLOR.ember, true);
    this.prop(BASE_TEX.forge, fg.x - 6, fg.y - 100);
    this.prop(BASE_TEX.anvil, fg.x + 104, fg.y - 44, 0.95);
    this.prop(BASE_TEX.sack, fg.x - 122, fg.y - 52, 0.9);
    this.time.addEvent({
      delay: BASE.emberMs, loop: true,
      callback: () => this.spawnEmber(fg.x - 6, fg.y - 78)
    });

    // หีบเก็บของ: หีบ + ชั้นขวด + กระสอบ
    const ch = this.spotPos('chest');
    makeGlow(this, ch.x, ch.y - 84, 104, BASE_COLOR.blue, true);
    this.prop(BASE_TEX.chest, ch.x, ch.y - 92);
    this.prop(BASE_TEX.shelf, ch.x + 148, ch.y - 104, 0.95);
    this.prop(BASE_TEX.sack, ch.x - 116, ch.y - 56, 0.95);

    // ประตูสู่โลก: โค้งกระดาษ + เศษกระดาษไหว
    const gt = this.spotPos('gate');
    makeGlow(this, gt.x, gt.y - 60, 132, BASE_COLOR.green, true);
    this.prop(BASE_TEX.arch, gt.x, gt.y - 120);
    for (let i = 0; i < 3; i++) {
      const sx = gt.x - 46 + i * 46;
      const strip = this.add.rectangle(sx, gt.y - 190, 12, 44, BASE_COLOR.paper, 0.8)
        .setOrigin(0.5, 0).setDepth(DEPTH.ENEMY + 1);
      strip.setStrokeStyle(1, BASE_COLOR.green, 0.5);
      strip.setAngle(-4);
      this.tweens.add({
        targets: strip, angle: 5, duration: 1300 + i * 220,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });
    }

    // โต๊ะบันทึก: โต๊ะ + สมุดเปิด + เทียนไหว
    const dk = this.spotPos('desk');
    makeGlow(this, dk.x + 62, dk.y - 92, 108, BASE_COLOR.lamp, true);
    this.prop(BASE_TEX.desk, dk.x, dk.y - 82);
    this.prop(BASE_TEX.book, dk.x - 26, dk.y - 92, 0.95);
    this.prop(BASE_TEX.candle, dk.x + 66, dk.y - 104, 0.9);
    const flame = this.add.ellipse(dk.x + 66, dk.y - 128, 10, 18, 0xffd070, 0.95).setDepth(DEPTH.ENEMY + 1);
    this.add.ellipse(dk.x + 66, dk.y - 126, 5, 9, 0xfff6d8, 0.95).setDepth(DEPTH.ENEMY + 2);
    this.tweens.add({
      targets: flame, scaleY: 1.35, scaleX: 0.85, alpha: 0.75,
      duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });

    // หุ่นซ้อม — เฉพาะโหมดทดสอบ
    if (DEV_TOOLS) {
      const dm = this.spotPos('dummy');
      this.prop(BASE_TEX.dummy, dm.x, dm.y - 82);
    }
  }

  private spawnEmber(x: number, y: number) {
    const p = this.add.circle(
      x + Phaser.Math.Between(-26, 26), y + Phaser.Math.Between(-6, 6),
      Phaser.Math.Between(2, 4), Math.random() < 0.5 ? 0xffb030 : BASE_COLOR.ember, 0.9
    ).setDepth(DEPTH.BURST);
    this.tweens.add({
      targets: p,
      x: p.x + Phaser.Math.Between(-18, 26),
      y: p.y - Phaser.Math.Between(40, 86),
      alpha: 0, scale: 0.3,
      duration: Phaser.Math.Between(700, 1200),
      onComplete: () => p.destroy()
    });
  }

  // =====================================================
  //  วงจุดใช้งาน
  // =====================================================
  private buildSpots() {
    for (const def of BASE_SPOTS) {
      if (def.devOnly && !DEV_TOOLS) continue;
      const x = CX + def.dx;
      const y = CY + def.dy;
      makeGlow(this, x, y, 72, def.color, true);
      const ring = this.add.image(x, y, BASE_TEX.ring).setDepth(DEPTH.FLOOR + 2);
      ring.setTint(def.color);
      ring.setAlpha(0.7);
      this.add.text(x, y - 74, def.name, {
        fontFamily: '"Noto Sans Thai", monospace', fontSize: '15px', fontStyle: 'bold',
        color: '#ffffff', stroke: '#000000', strokeThickness: 4, align: 'center'
      }).setOrigin(0.5).setDepth(DEPTH.ENEMY_HP_BAR);
      this.spots.push({ def, x, y, ring, onUse: this.handlerFor(def.id) });
    }
  }

  private handlerFor(id: BaseSpotId): () => void {
    switch (id) {
      case 'wardrobe': return () => this.openScene('LoadoutScene');
      case 'forge': return () => this.openScene('UpgradeScene');
      case 'chest': return () => this.openScene('BagScene');
      case 'desk': return () => this.openLogbook();
      case 'gate': return () => this.startWorld();
      case 'dummy': return () => this.startHunt();
    }
  }

  // =====================================================
  //  ปุ่ม (คีย์ลัดของคนเล่นคอม — ไม่โชว์บนจอ)
  // =====================================================
  private bindKeys() {
    const kb = this.input.keyboard as any;
    kb.on('keydown-T', () => this.startWorld());
    kb.on('keydown-F', () => this.openScene('UpgradeScene'));
    kb.on('keydown-B', () => this.openScene('BagScene'));
    kb.on('keydown-L', () => this.openScene('LoadoutScene'));
    kb.on('keydown-J', () => this.openLogbook());
    kb.on('keydown-ONE', () => this.chooseCharacter(CHARACTER_IDS[0]));
    kb.on('keydown-TWO', () => this.chooseCharacter(CHARACTER_IDS[1]));
    kb.on('keydown-V', () => this.cycleControls());
    kb.on('keydown-ESC', () => this.toggleMenu());
    if (DEV_TOOLS) {
      kb.on('keydown-ENTER', () => this.startHunt());
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
        this.renderHUD();
      });
      kb.on('keydown-F9', () => {
        resetSave();
        huntSession.clearBasePos();
        this.showToast('ล้างเซฟแล้ว');
        this.scene.restart();
      });
    }
    this.keyE = kb.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.keyM = kb.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    this.keyEsc = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
  }

  // =====================================================
  //  ลูปหลัก
  // =====================================================
  update(_time: number, delta: number) {
    if (!this.actor) return;
    if (this.dust) this.dust.update(delta);

    if (pressed(this.keyM, 'M')) {
      const off = sfx.toggleMute();
      this.showToast(off ? 'ปิดเสียง' : 'เปิดเสียง');
    }

    // เปิดสมุดบันทึกอยู่ = หยุดเดิน อ่านได้สบายใจ
    if (this.logbook) {
      if (pressed(this.keyE, 'E') || Phaser.Input.Keyboard.JustDown(this.keyEsc)) {
        this.logbook.close();
      }
      return;
    }

    // เปิดเมนูอยู่ = หยุดเดิน (ปิดด้วย ESC หรือปุ่ม ✕ ในเมนู)
    if (this.menu.isOpen) return;

    this.actor.update(delta);
    if (this.starting) return;

    let best: Spot | null = null;
    let bestD = Infinity;
    for (const s of this.spots) {
      const d = Phaser.Math.Distance.Between(this.actor.x, this.actor.y, s.x, s.y);
      if (d <= s.def.radius && d < bestD) { bestD = d; best = s; }
    }

    // วงที่ใกล้ที่สุดสว่างขึ้น + ปุ่มแอ็กชันขึ้นชื่อการกระทำ
    const id = best ? best.def.id : '';
    if (id !== this.nearId) {
      this.nearId = id;
      this.nearSpot = best;
      for (const s of this.spots) {
        const on = s === best;
        s.ring.setAlpha(on ? 1 : 0.7);
        s.ring.setScale(on ? 1.08 : 1);
      }
      if (best) {
        this.actionBtn.setStrokeStyle(3, best.def.color).setVisible(true);
        this.actionLabel.setText(ACTION_NAME[best.def.id]).setVisible(true);
      } else {
        this.actionBtn.setVisible(false);
        this.actionLabel.setVisible(false);
      }
    }

    // คอมกด E ได้เหมือนปุ่มแอ็กชัน
    if (best && pressed(this.keyE, 'E')) this.useSpot(best);
  }

  // =====================================================
  //  การกระทำ
  // =====================================================
  /** ใช้งานจุด — ทั้งปุ่มแอ็กชันบนจอและปุ่ม E เรียกที่นี่ที่เดียว */
  private useSpot(s: Spot) {
    if (this.starting || this.logbook || this.menu.isOpen) return;
    burst(this, s.x, s.y, s.def.color, 10, 52, 4);
    ringEffect(this, s.x, s.y, 70, s.def.color, 300);
    sfx.pickup();
    s.onUse();
  }

  /** จำที่ยืนก่อนออกจากฐาน — กลับมายืนจุดเดิม */
  private rememberSpot() {
    huntSession.setBasePos(this.actor.x, this.actor.y);
  }

  private openScene(key: string) {
    if (this.starting || this.logbook || this.menu.isOpen) return;
    this.starting = true;
    saveGame();
    this.rememberSpot();
    huntSession.markFromDressing();
    sfx.open();
    this.scene.start(key);
  }

  private openLogbook() {
    if (this.starting || this.logbook || this.menu.isOpen) return;
    sfx.open();
    this.actor.sprite.setVelocity(0);
    this.logbook = new LogbookPanel(this, () => { this.logbook = null; });
  }

  private chooseCharacter(id: CharacterId) {
    if (this.starting || this.logbook || this.menu.isOpen || loadout.characterId === id) return;
    this.starting = true;
    loadout.characterId = id;
    saveGame();
    this.rememberSpot();
    huntSession.markFromDressing();
    this.scene.restart();
  }

  private startWorld() {
    if (this.starting || this.logbook || this.menu.isOpen) return;
    this.starting = true;
    saveGame();
    huntSession.clearBasePos(); // ทริปใหม่ = กลับมาเกิดกลางฐาน
    sfx.whoosh();
    this.scene.start('WorldScene');
  }

  private startHunt() {
    if (this.starting || this.logbook || this.menu.isOpen || !DEV_TOOLS) return;
    this.starting = true;
    saveGame();
    huntSession.clearBasePos();
    this.scene.start('GameScene');
  }

  // =====================================================
  //  เมนูรวม
  // =====================================================
  private buildMenu() {
    const items: MenuItem[] = [
      { label: 'ออกสำรวจ', color: BASE_COLOR.green, onUse: () => this.startWorld() },
      {
        label: 'ห้องออนไลน์',
        sub: ONLINE_READY ? undefined : 'เร็ว ๆ นี้',
        color: BASE_COLOR.violet,
        enabled: ONLINE_READY,
        onUse: () => this.openScene('OnlineScene')
      },
      { label: 'แต่งตัวและสกิล', color: BASE_COLOR.violet, onUse: () => this.openScene('LoadoutScene') },
      { label: 'ตีเหล็ก', color: BASE_COLOR.gold, onUse: () => this.openScene('UpgradeScene') },
      { label: 'หีบเก็บของ', color: BASE_COLOR.blue, onUse: () => this.openScene('BagScene') },
      { label: 'สมุดบันทึก', color: BASE_COLOR.paper, onUse: () => this.openLogbook() }
    ];
    if (DEV_TOOLS) {
      items.push({ label: 'ห้องฝึก (ทดสอบ)', color: BASE_COLOR.danger, onUse: () => this.startHunt() });
    }

    const toggles: MenuToggle[] = [
      {
        label: () => 'เสียง',
        onUse: () => {
          const off = sfx.toggleMute();
          this.showToast(off ? 'ปิดเสียง' : 'เปิดเสียง');
        }
      },
      {
        label: () => 'ควบคุม: ' + (CONTROL_SHORT[controls.mode] ?? controls.mode),
        onUse: () => this.cycleControls()
      }
    ];
    if (canFullscreen()) {
      toggles.push({ label: () => 'เต็มจอ', onUse: () => toggleFullscreen() });
    }

    this.menu = new BaseMenu(this, items, toggles);
  }

  private toggleMenu() {
    if (this.starting || this.logbook) return;
    if (this.menu.isOpen) {
      this.menu.close();
    } else {
      this.actor.sprite.setVelocity(0);
      this.menu.open();
    }
    sfx.open();
  }

  // =====================================================
  //  UI มุมจอ (ชิดขวา — ไม่ทับหลอดเลือดผู้เล่นมุมซ้ายบน)
  // =====================================================
  private buildHudFrame() {
    // กรอบสถานะ: ชิดขวา ใต้ปุ่มเมนู
    this.add.rectangle(GAME_WIDTH - 14, STATUS_TOP, 268, 126, 0x14100a, 0.88)
      .setOrigin(1, 0).setStrokeStyle(2, BASE_COLOR.gold)
      .setDepth(DEPTH.HUD).setScrollFactor(0);

    // ปุ่ม ☰ เมนู มุมขวาบน
    const mb = this.add.rectangle(GAME_WIDTH - 74, 36, 120, 44, 0x221d10, 0.95)
      .setStrokeStyle(3, BASE_COLOR.gold).setDepth(DEPTH.HUD).setScrollFactor(0);
    mb.setInteractive({ useHandCursor: true });
    mb.on('pointerover', () => mb.setFillStyle(0x3d3016, 0.97));
    mb.on('pointerout', () => mb.setFillStyle(0x221d10, 0.95));
    mb.on('pointerdown', () => this.time.delayedCall(0, () => this.toggleMenu()));
    this.add.text(GAME_WIDTH - 74, 36, '☰ เมนู', {
      fontFamily: '"Noto Sans Thai", monospace', fontSize: '18px', fontStyle: 'bold',
      color: '#ffe9a3', stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5).setDepth(DEPTH.HUD + 1).setScrollFactor(0);

    // ปุ่มแอ็กชัน (ขึ้นเมื่อยืนในวง) — แตะหรือคลิกได้ ไม่ต้องมีปุ่มอักษร
    this.actionBtn = this.add.rectangle(ACTION_X, ACTION_Y, 220, 58, 0x1b1810, 0.94)
      .setStrokeStyle(3, BASE_COLOR.gold).setDepth(DEPTH.HUD).setScrollFactor(0).setVisible(false);
    this.actionBtn.setInteractive({ useHandCursor: true });
    this.actionBtn.on('pointerover', () => this.actionBtn.setFillStyle(0x34290f, 0.97));
    this.actionBtn.on('pointerout', () => this.actionBtn.setFillStyle(0x1b1810, 0.94));
    this.actionBtn.on('pointerdown', () =>
      this.time.delayedCall(0, () => {
        if (this.nearSpot) this.useSpot(this.nearSpot);
      })
    );
    this.actionLabel = this.add.text(ACTION_X, ACTION_Y, '', {
      fontFamily: '"Noto Sans Thai", monospace', fontSize: '20px', fontStyle: 'bold',
      color: '#ffffff', stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5).setDepth(DEPTH.HUD + 1).setScrollFactor(0).setVisible(false);
  }

  private renderHUD() {
    this.uiTexts.forEach((t) => t.destroy());
    this.uiTexts = [];
    const st = starsOf(loadout.characterId);
    const stats = huntSession.getStats();
    const lines = [
      `นักล่า: ${CHARACTERS[loadout.characterId].name} ${'★'.repeat(st)}${'☆'.repeat(MAX_STARS - st)}`,
      `เครื่องราง: ${loadout.charmId ? CHARMS[loadout.charmId].name + ` Lv.${levelOf('charm', loadout.charmId)}` : 'ไม่ใส่'}`,
      `สัตว์เลี้ยง: ${loadout.petId ? PETS[loadout.petId].name + ` Lv.${levelOf('pet', loadout.petId)}` : 'ไม่พา'}`,
      `กระเป๋า: ${huntSession.getTotalCount()} ชิ้น`,
      `ทริป ${stats.trips} · ลึกสุด ${stats.bestArea || '—'} · บอส ${stats.bosses}`
    ];
    lines.forEach((s, i) => {
      this.uiTexts.push(this.add.text(GAME_WIDTH - 268, STATUS_TOP + 14 + i * 21, s, {
        fontFamily: '"Noto Sans Thai", monospace', fontSize: '13px',
        color: i === 4 ? '#9de7ff' : '#ffffff', stroke: '#000000', strokeThickness: 3
      }).setOrigin(0, 0).setDepth(DEPTH.HUD + 1).setScrollFactor(0));
    });
  }

  private showTitleCard() {
    const title = this.add.text(GAME_WIDTH / 2, 168, 'ฐานนักล่า', {
      fontFamily: '"Noto Sans Thai", monospace', fontSize: '34px', fontStyle: 'bold',
      color: '#ffd54a', stroke: '#000000', strokeThickness: 6
    }).setOrigin(0.5).setDepth(DEPTH.OVERLAY_TEXT).setScrollFactor(0).setAlpha(0);
    const sub = this.add.text(GAME_WIDTH / 2, 202, 'ยืนในวงเรืองแสง แล้วกดปุ่มที่ขึ้นมา · ปุ่ม ☰ เมนู อยู่มุมขวาบน', {
      fontFamily: '"Noto Sans Thai", monospace', fontSize: '13px',
      color: '#e8e0c8', stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5).setDepth(DEPTH.OVERLAY_TEXT).setScrollFactor(0).setAlpha(0);
    this.tweens.add({ targets: [title, sub], alpha: 1, duration: 420 });
    this.tweens.add({
      targets: [title, sub], alpha: 0, y: '-=14',
      delay: BASE.titleMs, duration: 600,
      onComplete: () => { title.destroy(); sub.destroy(); }
    });
  }

  private cycleControls() {
    if (this.starting || this.logbook) return;
    controls.cycle();
    this.menu.refresh();
    sfx.open();
    this.showToast('ควบคุม: ' + CONTROL_LABEL[controls.mode]);
  }

  private showToast(msg: string) {
    // ชั้นสูงกว่าเมนู เพื่อให้เห็นตอนกดปุ่มในเมนู
    const toast = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 140, msg, {
      fontFamily: '"Noto Sans Thai", monospace', fontSize: '16px', fontStyle: 'bold',
      color: '#7dff9b', stroke: '#000000', strokeThickness: 4,
      backgroundColor: 'rgba(0,0,0,0.72)', padding: { x: 12, y: 6 }
    }).setOrigin(0.5).setDepth(DEPTH.OVERLAY_TEXT + 5).setScrollFactor(0);
    this.tweens.add({
      targets: toast, alpha: 0, y: toast.y - 20, delay: 1400, duration: 480,
      onComplete: () => toast.destroy()
    });
  }
}