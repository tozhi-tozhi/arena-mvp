// src/scenes/BaseScene.ts — ฐานนักล่าแบบเดินได้ (Phase 4 ฉบับสมบูรณ์)
// เดิน WASD · ยืนในวงเรืองแสงแล้วกด E · ปุ่มลัดใช้ได้ทุกจุด
// จำที่ยืนตอนไปห้องแต่งตัว/โรงตีเหล็ก/หีบ · กลับจากทริปเกิดกลางฐาน (ตั้งใจ)
// ห้องฝึก = สนามทดสอบของผู้พัฒนาเท่านั้น ปิดไว้เมื่อปล่อยเกมจริง
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DEPTH, DEV_TOOLS } from '../config';
import { BASE, BASE_COLOR, BASE_SPOTS, type BaseSpotDef, type BaseSpotId } from '../data/base';
import { CHARACTERS, CHARACTER_IDS, type CharacterId } from '../data/characters';
import { CHARMS } from '../data/charms';
import { PETS } from '../data/pets';
import { LOOT_TABLE } from '../data/loot';
import type { Rarity } from '../data/rarity';
import { huntSession } from '../systems/HuntSession';
import { loadout } from '../systems/Loadout';
import { loadGame, saveGame, resetSave } from '../systems/SaveGame';
import { ensureItemIcons } from '../systems/itemIcons';
import { levelOf, starsOf, MAX_STARS } from '../systems/Upgrades';
import { PlayerActor } from '../actors/PlayerActor';
import { makeGlow, makeVignette, burst, ringEffect } from '../systems/effects';
import { AmbientDust } from '../systems/AmbientDust';
import { bakeBaseTextures, BASE_TEX } from '../systems/baseTextures';
import { LogbookPanel } from '../ui/LogbookPanel';
import { sfx } from '../systems/sfx';
import { trainingState } from '../systems/trainingState';
import { controls, pressed, CONTROL_LABEL } from '../systems/Controls';

let saveLoaded = false; // โหลดเซฟแค่ครั้งแรกที่เปิดเกม

const CX = BASE.width / 2;
const CY = BASE.height / 2;

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
  private prompt!: Phaser.GameObjects.Text;
  private uiTexts: Phaser.GameObjects.Text[] = [];
  private dust: AmbientDust | null = null;
  private logbook: LogbookPanel | null = null;
  private starting = false;
  private nearId: string = '';
  private keyE!: Phaser.Input.Keyboard.Key;
  private keyM!: Phaser.Input.Keyboard.Key;
  private keyEsc!: Phaser.Input.Keyboard.Key;
  private controlLabel!: Phaser.GameObjects.Text;

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
    this.uiTexts = [];
    this.spots = [];
    this.logbook = null;
    this.cameras.main.setBackgroundColor('#0f0c07');

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
      getTargets: () => [],   // ไม่มีศัตรูในฐาน
      onDeathShown: () => {}, // ไม่มีทางตายในฐาน
      suppressKeyCombat: true // ฐานไม่มีการต่อสู้ — ปุ่ม J/K ของโหมดคีย์บอร์ดจะได้ไม่ชนปุ่มลัด (J = สมุดบันทึก)
    });

    const cam = this.cameras.main;
    cam.setBounds(0, 0, BASE.width, BASE.height);
    cam.startFollow(this.actor.sprite, true, 0.08, 0.08);
    cam.setDeadzone(440, 340);
    cam.fadeIn(320, 0, 0, 0);

    makeVignette(this);
    this.buildHudFrame();
    this.bindKeys();
    this.buildControlLabel();

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
      this.add.text(x, y + 62, `ปุ่มลัด ${def.key}`, {
        fontFamily: '"Noto Sans Thai", monospace', fontSize: '10px',
        color: '#c9c2b2', stroke: '#000000', strokeThickness: 3
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
  //  ปุ่ม
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

    this.actor.update(delta);
    if (this.starting) return;

    let best: Spot | null = null;
    let bestD = Infinity;
    for (const s of this.spots) {
      const d = Phaser.Math.Distance.Between(this.actor.x, this.actor.y, s.x, s.y);
      if (d <= s.def.radius && d < bestD) { bestD = d; best = s; }
    }

    // วงที่ใกล้ที่สุดสว่างขึ้น = รู้ทันทีว่ากด E ได้
    const id = best ? best.def.id : '';
    if (id !== this.nearId) {
      this.nearId = id;
      for (const s of this.spots) {
        const on = s === best;
        s.ring.setAlpha(on ? 1 : 0.7);
        s.ring.setScale(on ? 1.08 : 1);
      }
    }

    if (best) {
      this.prompt.setPosition(GAME_WIDTH / 2, GAME_HEIGHT - 80).setVisible(true)
        .setText(`[E] ${best.def.name}`)
        .setColor(Phaser.Display.Color.IntegerToColor(best.def.color).rgba);
      if (pressed(this.keyE, 'E')) {
        burst(this, best.x, best.y, best.def.color, 10, 52, 4);
        ringEffect(this, best.x, best.y, 70, best.def.color, 300);
        sfx.pickup();
        best.onUse();
      }
    } else {
      this.prompt.setVisible(false);
    }
  }

  // =====================================================
  //  การกระทำ
  // =====================================================
  /** จำที่ยืนก่อนออกจากฐาน — กลับมายืนจุดเดิม */
  private rememberSpot() {
    huntSession.setBasePos(this.actor.x, this.actor.y);
  }

  private openScene(key: string) {
    if (this.starting || this.logbook) return;
    this.starting = true;
    saveGame();
    this.rememberSpot();
    huntSession.markFromDressing();
    sfx.open();
    this.scene.start(key);
  }

  private openLogbook() {
    if (this.starting || this.logbook) return;
    sfx.open();
    this.actor.sprite.setVelocity(0);
    this.logbook = new LogbookPanel(this, () => { this.logbook = null; });
  }

  private chooseCharacter(id: CharacterId) {
    if (this.starting || this.logbook || loadout.characterId === id) return;
    this.starting = true;
    loadout.characterId = id;
    saveGame();
    this.rememberSpot();
    huntSession.markFromDressing();
    this.scene.restart();
  }

  private startWorld() {
    if (this.starting || this.logbook) return;
    this.starting = true;
    saveGame();
    huntSession.clearBasePos(); // ทริปใหม่ = กลับมาเกิดกลางฐาน
    sfx.whoosh();
    this.scene.start('WorldScene');
  }

  private startHunt() {
    if (this.starting || this.logbook || !DEV_TOOLS) return;
    this.starting = true;
    saveGame();
    huntSession.clearBasePos();
    this.scene.start('GameScene');
  }

  // =====================================================
  //  UI มุมจอ (ชิดขวา — ไม่ทับหลอดเลือดผู้เล่นมุมซ้ายบน)
  // =====================================================
  private buildHudFrame() {
    this.add.rectangle(GAME_WIDTH - 14, 14, 268, 126, 0x14100a, 0.88)
      .setOrigin(1, 0).setStrokeStyle(2, BASE_COLOR.gold)
      .setDepth(DEPTH.HUD).setScrollFactor(0);

    this.prompt = this.add.text(0, 0, '', {
      fontFamily: '"Noto Sans Thai", monospace', fontSize: '17px', fontStyle: 'bold',
      color: '#ffffff', stroke: '#000000', strokeThickness: 4,
      backgroundColor: 'rgba(0,0,0,0.62)', padding: { x: 10, y: 5 }
    }).setOrigin(0.5).setDepth(DEPTH.HUD).setScrollFactor(0).setVisible(false);

    const keys = DEV_TOOLS
      ? 'WASD เดิน · E ใช้งาน · L แต่งตัว · F ตีเหล็ก · B หีบ · J บันทึก · T ออกสำรวจ · M เสียง · ENTER ห้องฝึก'
      : 'WASD เดิน · E ใช้งาน · L แต่งตัว · F ตีเหล็ก · B หีบ · J บันทึก · T ออกสำรวจ · M เสียง';
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 18, keys, {
      fontFamily: '"Noto Sans Thai", monospace', fontSize: '10px',
      color: '#a89f8c', stroke: '#000000', strokeThickness: 2
    }).setOrigin(0.5, 1).setDepth(DEPTH.HUD).setScrollFactor(0);
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
      this.uiTexts.push(this.add.text(GAME_WIDTH - 268, 28 + i * 21, s, {
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
    const sub = this.add.text(GAME_WIDTH / 2, 202, 'ยืนในวงเรืองแสงแล้วกด E', {
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

  /** ป้ายมุมซ้ายล่าง: โหมดควบคุมปัจจุบัน — กด V หรือแตะเพื่อสลับ */
  private buildControlLabel() {
    this.controlLabel = this.add.text(12, GAME_HEIGHT - 10, '', {
      fontFamily: '"Noto Sans Thai", monospace', fontSize: '12px', fontStyle: 'bold',
      color: '#a89f8c', stroke: '#000000', strokeThickness: 3
    }).setOrigin(0, 1).setDepth(DEPTH.HUD).setScrollFactor(0);
    this.controlLabel.setInteractive({ useHandCursor: true });
    this.controlLabel.on('pointerdown', () => this.cycleControls());
    this.refreshControlLabel();
  }

  private refreshControlLabel() {
    this.controlLabel.setText(`ควบคุม: ${CONTROL_LABEL[controls.mode]}  ([V] หรือแตะเพื่อสลับ)`);
  }

  private cycleControls() {
    if (this.starting || this.logbook) return;
    controls.cycle();
    this.refreshControlLabel();
    sfx.open();
    this.showToast('ควบคุม: ' + CONTROL_LABEL[controls.mode]);
  }

  private showToast(msg: string) {

    const toast = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 140, msg, {
      fontFamily: '"Noto Sans Thai", monospace', fontSize: '16px', fontStyle: 'bold',
      color: '#7dff9b', stroke: '#000000', strokeThickness: 4,
      backgroundColor: 'rgba(0,0,0,0.72)', padding: { x: 12, y: 6 }
    }).setOrigin(0.5).setDepth(DEPTH.OVERLAY).setScrollFactor(0);
    this.tweens.add({
      targets: toast, alpha: 0, y: toast.y - 20, delay: 1400, duration: 480,
      onComplete: () => toast.destroy()
    });
  }
}