// src/scenes/WorldScene.ts — The World (Phase 3B): เดินสำรวจแอเรียที่สุ่มประกอบจากแผ่นภูมิประเทศ
// ตอนนี้ยังไม่มีศัตรู — มี: สุ่มแอเรีย, เดินสำรวจ, เก็บของตกพื้นเข้าถุงพกพา (3C), ประตูกลับฐาน, ประตูไปต่อ (ล็อก)
// 3D เพิ่มบอสและปลดประตูไปต่อ
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, WALL_THICKNESS, SPRITE_SCALE, DEPTH, DEV_TOOLS } from '../config';
import { TILE_SIZE, GROUND_LOOT_PER_SPOT } from '../data/world';
import { generateArea, type AreaLayout } from '../systems/AreaGenerator';
import { bakeAreaTextures, tileKey, propKey } from '../systems/areaTextures';
import { UiCamera } from '../systems/UiCamera';
import { PlayerActor } from '../actors/PlayerActor';
import { AreaGate } from '../entities/AreaGate';
import { makeVignette, showDamage } from '../systems/effects';
import { showEndScreen } from '../ui/GameOverScreen';
import { loadPixelFx } from '../systems/pixelFx';
import { sfx } from '../systems/sfx';
import { saveGame } from '../systems/SaveGame';
import { DroppedItem } from '../entities/DroppedItem';
import { rollGroundLoot } from '../data/loot';
import { RARITY } from '../data/rarity';
import { pouch } from '../systems/Pouch';
import { huntSession } from '../systems/HuntSession';
import { showHuntSummary } from '../ui/HuntSummaryScreen';

export class WorldScene extends Phaser.Scene {
  private actor!: PlayerActor;
  private uiCam!: UiCamera;
  private layout!: AreaLayout;
  private returnGate!: AreaGate;
  private exitGate!: AreaGate;
  private tripEnded = false;
  private items: DroppedItem[] = [];
  private pouchText!: Phaser.GameObjects.Text;
  private lastPouchLabel = '';

  private keyRestart: any;
  private keyInteract: any;
  private keyMute: any;

  constructor() {
    super({ key: 'WorldScene' });
  }

  preload() {
    PlayerActor.preloadAssets(this);
    this.load.image('wall', 'assets/wall.png');
    loadPixelFx(this);
  }

  // continueTrip = true เมื่อเปลี่ยนแอเรียกลางทริป (ถุงพกพาต้องไม่ถูกล้าง)
  init(data?: { continueTrip?: boolean }) {
    this.tripEnded = false;
    this.items = [];
    this.lastPouchLabel = '';
    if (!data?.continueTrip) pouch.startTrip();
  }

  create() {
    // ต้องสร้างก่อนของอื่นทั้งหมด เพื่อให้แยกกล้องโลก/กล้อง UI ได้ครบ
    this.uiCam = new UiCamera(this);
    bakeAreaTextures(this);

    const seed = Math.floor(Math.random() * 1_000_000_000);
    this.layout = generateArea(seed);
    const L = this.layout;
    const t = WALL_THICKNESS;

    // ---------- พื้น: วางภาพแผ่นที่วาดไว้แล้ว ----------
    for (let r = 0; r < L.rows; r++) {
      for (let c = 0; c < L.cols; c++) {
        this.add
          .image(c * TILE_SIZE, r * TILE_SIZE, tileKey(L.tiles[r * L.cols + c]))
          .setOrigin(0)
          .setDepth(DEPTH.FLOOR);
      }
    }
    for (const p of L.props) {
      this.add
        .image(p.x, p.y, propKey(p.kind))
        .setScale(p.scale)
        .setFlipX(p.flip)
        .setDepth(DEPTH.FLOOR + 1);
    }

    // ---------- กำแพงขอบแอเรีย ----------
    const W = L.width;
    const H = L.height;
    const wall = (x: number, y: number, w: number, h: number) =>
      this.add.tileSprite(x, y, w, h, 'wall').setOrigin(0).setTileScale(SPRITE_SCALE).setDepth(DEPTH.WALL);
    wall(0, 0, W, t);
    wall(0, H - t, W, t);
    wall(0, 0, t, H);
    wall(W - t, 0, t, H);

    // ขอบโลกฟิสิกส์/กล้อง "ของแอเรียนี้" — ไม่ใช้ WORLD_WIDTH/HEIGHT
    this.physics.world.setBounds(t, t, W - t * 2, H - t * 2);
    makeVignette(this);

    // ---------- ประตู ----------
    this.returnGate = new AreaGate(this, 'return', L.returnGate.x, L.returnGate.y, false);
    this.exitGate = new AreaGate(this, 'next', L.exitGate.x, L.exitGate.y, true);

    // ---------- ของตกพื้น (จุดละ GROUND_LOOT_PER_SPOT ชิ้นรอบ ๆ จุด) ----------
    for (const spot of L.lootSpots) {
      for (let i = 0; i < GROUND_LOOT_PER_SPOT; i++) {
        const a = (i / GROUND_LOOT_PER_SPOT) * Math.PI * 2 + Math.random() * 0.6;
        const ix = spot.x + Math.cos(a) * 32;
        const iy = spot.y + Math.sin(a) * 32;
        this.items.push(new DroppedItem(this, ix, iy, rollGroundLoot()));
      }
    }

    // ---------- ผู้เล่น (ยังไม่มีศัตรู) ----------
    this.actor = new PlayerActor(this, L.spawn.x, L.spawn.y, {
      getTargets: () => [],
      onDeathShown: () => this.onPlayerDied()
    });

    const kb = this.input.keyboard as any;
    this.keyRestart = kb.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.keyInteract = kb.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.keyMute = kb.addKey(Phaser.Input.Keyboard.KeyCodes.M);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, W, H);
    cam.startFollow(this.actor.sprite, true, 0.08, 0.08);
    cam.setDeadzone(440, 340);

    // ตัวนับถุงพกพา (มุมขวาบน)
    this.pouchText = this.add
      .text(GAME_WIDTH - 12, 12, '', {
        fontFamily: '"Noto Sans Thai", monospace',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4
      })
      .setOrigin(1, 0)
      .setDepth(DEPTH.HUD)
      .setScrollFactor(0);

    // ป้ายบอกขนาดแอเรีย (ไว้ทดสอบ)
    const info = DEV_TOOLS
      ? `แอเรีย ${L.cols}×${L.rows} = ${L.cols * L.rows} แผ่น · seed ${L.seed} · N แอเรียใหม่ · G ของทดสอบ · K ตาย`
      : `แอเรีย ${L.cols * L.rows} แผ่น`;
    this.add
      .text(GAME_WIDTH - 12, GAME_HEIGHT - 10, info, {
        fontFamily: '"Noto Sans Thai", monospace',
        fontSize: '11px',
        color: '#d8cfb8',
        stroke: '#000000',
        strokeThickness: 3
      })
      .setOrigin(1, 1)
      .setDepth(DEPTH.HUD)
      .setScrollFactor(0);

    if (DEV_TOOLS) {
      // N = สุ่มแอเรียใหม่แต่ "ต่อทริปเดิม" (ถุงพกพาไม่ล้าง) — จำลองการเปลี่ยนแอเรียของ 3D
      kb.on('keydown-N', () => {
        if (!this.tripEnded) this.scene.restart({ continueTrip: true });
      });
      // G = ใส่ของทดสอบเข้าถุง · K = ตายทันที (ไว้ทดสอบถุงเต็ม/ตายเสียครึ่ง)
      kb.on('keydown-G', () => {
        if (!this.tripEnded && !pouch.add(rollGroundLoot())) {
          showDamage(this, this.actor.x, this.actor.y - 50, 'ถุงเต็ม!', '#ff6666', 900);
        }
      });
      kb.on('keydown-K', () => {
        if (!this.tripEnded && !this.actor.isDead) this.actor.takeDamage(999, this.actor.x - 10, this.actor.y);
      });
    }
    this.sys.game.canvas.addEventListener('click', () => this.sys.game.canvas.focus());
  }

  update(_time: number, delta: number) {
    if (!this.actor) return;

    if (Phaser.Input.Keyboard.JustDown(this.keyMute)) {
      const nowMuted = sfx.toggleMute();
      showDamage(this, this.actor.x, this.actor.y - 40, nowMuted ? 'ปิดเสียง' : 'เปิดเสียง', '#ffffff', 900);
    }

    this.actor.update(delta);
    this.updatePouchHud();

    if (this.actor.isDead || this.actor.isVictory) {
      // จบทริปแล้ว (ตาย / กลับฐานผ่านประตู) — กด R กลับฐาน
      if (Phaser.Input.Keyboard.JustDown(this.keyRestart)) this.scene.start('BaseScene');
      return;
    }

    const px = this.actor.x;
    const py = this.actor.y;
    for (const it of this.items) it.checkPlayerDistance(px, py);
    this.returnGate.checkPlayerDistance(px, py);
    this.exitGate.checkPlayerDistance(px, py);

    if (Phaser.Input.Keyboard.JustDown(this.keyInteract) && !this.tripEnded) {
      if (this.tryPickup(px, py)) return;
      if (this.returnGate.isNear(px, py)) {
        this.finishTrip();
      } else if (this.exitGate.isNear(px, py) && this.exitGate.isLocked) {
        showDamage(this, px, py - 50, 'ประตูล็อก', '#bbbbbb', 900);
      }
    }
  }

  // กด E เก็บของตกพื้นใกล้ ๆ เข้าถุง — คืน true ถ้ามีของอยู่ในระยะ (กันไม่ให้กดประตูพร้อมกัน)
  private tryPickup(px: number, py: number): boolean {
    const near = this.items
      .filter((it) => !it.isCollected && Phaser.Math.Distance.Between(it.sprite.x, it.sprite.y, px, py) <= 50)
      .sort(
        (a, b) =>
          Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, px, py) -
          Phaser.Math.Distance.Between(b.sprite.x, b.sprite.y, px, py)
      );
    if (near.length === 0) return false;

    for (const it of near) {
      const loot = it.loot;
      if (!pouch.add(loot)) {
        showDamage(this, px, py - 50, 'ถุงเต็ม!', '#ff6666', 1100);
        break;
      }
      this.items = this.items.filter((d) => d !== it);
      it.collect(() => {
        sfx.pickup();
        showDamage(this, this.actor.x, this.actor.y - 40, `+ ${loot.name}`, RARITY[loot.rarity].color, 1300);
      });
    }
    return true;
  }

  private updatePouchHud() {
    const label = `ถุง ${pouch.count}/${pouch.capacity}${pouch.isFull ? ' (เต็ม)' : ''}`;
    if (label === this.lastPouchLabel) return;
    this.lastPouchLabel = label;
    const ratio = pouch.count / pouch.capacity;
    this.pouchText.setText(label).setColor(pouch.isFull ? '#ff6666' : ratio >= 0.75 ? '#ffd166' : '#ffffff');
  }

  // กลับฐานผ่านประตู: โอนของทั้งหมดเข้ากระเป๋าถาวร + จบทริป
  private finishTrip() {
    if (this.tripEnded) return;
    this.tripEnded = true;
    sfx.pickup();
    this.actor.setVictory();
    const moved = pouch.depositAll();
    saveGame();
    const took = Date.now() - pouch.startedAt;
    this.time.delayedCall(300, () => {
      showHuntSummary(this, {
        timeTakenMs: took,
        huntLoot: moved,
        bag: huntSession.getBag(),
        footer: 'กด R เพื่อกลับฐาน'
      });
    });
  }

  // ตาย: เสียของในถุงครึ่งหนึ่ง ที่เหลือโอนเข้ากระเป๋าถาวร แล้วจบทริป
  private onPlayerDied() {
    if (this.tripEnded) return;
    this.tripEnded = true;
    const { kept, lost } = pouch.resolveDeath();
    saveGame();
    showEndScreen(this, 'GAME OVER', '#ff4444', `เสียของ ${lost.length} ชิ้น · เก็บได้ ${kept.length} ชิ้น · กด R กลับฐาน`);
  }
}
