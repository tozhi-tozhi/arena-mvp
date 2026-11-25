// src/scenes/WorldScene.ts — The World (Phase 3D + 3E + 3F)
// รอบนี้: เลือดไม่ฟื้นข้ามแมพ (ฝากใน huntSession) · จุดฟื้นเลือดสุ่ม 0–2 จุด (กด E ยืนฟื้น) ·
//         ตัวแทะเฝ้าจุดฟื้น · hint คมขึ้น (ทิศ+เมตร+จำนวนจุด)
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, WALL_THICKNESS, SPRITE_SCALE, DEPTH, DEV_TOOLS, VIEW_SCALE } from '../config';
import { TILE_SIZE, GROUND_LOOT_PER_SPOT } from '../data/world';
import { generateArea, type AreaLayout } from '../systems/AreaGenerator';
import { bakeAreaTextures, tileKey, propKey } from '../systems/areaTextures';
import { UiCamera } from '../systems/UiCamera';
import { PlayerActor } from '../actors/PlayerActor';
import { controls, pressed } from '../systems/Controls';
import { AreaGate } from '../entities/AreaGate';
import { makeVignette, showDamage, showRarityBanner } from '../systems/effects';
import { showEndScreen } from '../ui/GameOverScreen';
import { loadPixelFx } from '../systems/pixelFx';
import { sfx } from '../systems/sfx';
import { saveGame } from '../systems/SaveGame';
import { DroppedItem } from '../entities/DroppedItem';
import { rollGroundLoot, rollBossDrops, LOOT_TABLE } from '../data/loot';
import { RARITY, RARITY_IDS } from '../data/rarity';
import { pouch } from '../systems/Pouch';
import { huntSession } from '../systems/HuntSession';
import { showHuntSummary } from '../ui/HuntSummaryScreen';
import { BossHUD } from '../ui/BossHUD';
import { PouchPanel } from '../ui/PouchPanel';
import { rollBossCount, getAreaScaling, type DepthTier } from '../data/depth';
import { scaleBossDamage } from '../data/bosses';
import { SEAL } from '../data/quests';
import { MINION } from '../data/minions';
import {
  setupAreaQuest, tickQuest, questProgressText, questDirectionHint, tickQuestGlint,
  type ActiveQuest, type QuestContext
} from '../systems/AreaQuests';
import { SealMinigame } from '../ui/SealMinigame';
import { transitionToNextArea } from '../systems/AreaTransition';
import { spawnAreaBosses, countAliveBosses, tickBossDeath, destroyAreaBosses, type SpawnedBoss } from '../systems/AreaBosses';
import { spawnAreaMinions, destroyAreaMinions, type SpawnedMinion } from '../systems/AreaMinions';
import { spawnHealShrines, shrineGuardPoints, destroyHealShrines } from '../systems/AreaHeals';
import type { HealShrine } from '../entities/HealShrine';
import type { MinionHooks, Minion } from '../entities/Minion';
import type { BossHooks, BossBase } from '../entities/BossBase';
import { loadBossAssets, initBossTextures } from '../systems/BossLoader';
import { AmbientDust } from '../systems/AmbientDust';
import { profiles } from '../systems/PlayerProfile';
import { HuntMinimap, type MinimapSources } from '../systems/HuntMinimap';

const DETECT_RADIUS = 500;
// ความรู้สึกซูมกล้อง (ภาพล้วน — ไม่แตะการต่อสู้)
const ZOOM_COMBAT = 0.75 * VIEW_SCALE;
const ZOOM_NORMAL = 1 * VIEW_SCALE;
const ZOOM_DAMP_MS = 260;
const STEP_DIST = 46;      // เดินกี่ px ต่อ 1 ก้าว (เสียงเท้า)
const LOW_HP_RATIO = 0.34; // เลือดต่ำกว่าสัดส่วนนี้ = หัวใจเต้น
const HINT_REFRESH_MS = 1000; // ใบ้อัปเดตทุก 1 วิ (เดิม 2 — ตัวเลขเมตรต้องทันตา)

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
  private pouchPanel!: PouchPanel;

  // === สถานะแอเรีย ===
  private areaBosses: SpawnedBoss[] = [];
  private areaMinions: SpawnedMinion[] = [];
  private bossAliveTracker = { value: 0 };
  private areaIndex = 1;
  private scaling!: DepthTier;
  private nextGateUnlocked = false;
  private isTransitioning = false;
  private activeBossHud: BossHUD | null = null;
  private inCombat = false;
  private currentCombatBoss: SpawnedBoss | null = null;

  // === จุดฟื้นเลือด ===
  private healShrines: HealShrine[] = [];
  private activeShrine: HealShrine | null = null;
  private lastHpForChannel = 0;

  // === เควส ===
  private quest!: ActiveQuest;
  private questTitleText!: Phaser.GameObjects.Text;
  private questHintText!: Phaser.GameObjects.Text;
  private lastHintAt = 0;
  private lastHintLabel = '';
  private lastGlintAt = { value: 0 };
  private stepAcc = 0;
  private heartTimer = 0;
  private minigame: SealMinigame | null = null;
  private dust!: AmbientDust;

  private gateNavigator!: Phaser.GameObjects.Text;
  private minimap: HuntMinimap | null = null;
  private targetZoom = ZOOM_NORMAL;
  private keyRestart: any;
  private keyInteract: any;
  private keyMute: any;
  private focusCanvas = () => this.sys.game.canvas.focus();

  constructor() {
    super({ key: 'WorldScene' });
  }

  preload() {
    PlayerActor.preloadAssets(this);
    this.load.image('wall', 'assets/wall.png');
    loadBossAssets(this);
    loadPixelFx(this);
  }

  init(data?: { continueTrip?: boolean; areaIndex?: number }) {
    this.tripEnded = false;
    this.items = [];
    this.lastPouchLabel = '';
    this.isTransitioning = false;
    this.nextGateUnlocked = false;
    this.activeBossHud = null;
    this.inCombat = false;
    this.currentCombatBoss = null;
    this.minigame = null;
    this.areaMinions = [];
    this.healShrines = [];
    this.activeShrine = null;
    this.lastHintAt = 0;
    this.lastHintLabel = '';
    this.lastGlintAt = { value: 0 };
    this.stepAcc = 0;
    this.heartTimer = 0;
    if (!data?.continueTrip) {
      pouch.startTrip();
      huntSession.clearTripHP(); // ทริปใหม่ = เลือดเต็ม
      this.areaIndex = 1;
    } else {
      this.areaIndex = data.areaIndex ?? this.areaIndex + 1;
    }
    this.scaling = getAreaScaling(this.areaIndex);
  }

  create() {
    this.uiCam = new UiCamera(this);

// P3d: โทนสีตามเขต (Depth Tint) — ใช้ Camera ColorMatrix (Phaser 4)
const cam = this.cameras.main;
    if (this.areaIndex <= 10) {
  // เขตตื้น: อบอุ่น (เพิ่มแดง/เขียว ลดน้ำเงินเล็กน้อย)
  const cm = cam.filters.internal.addColorMatrix();
  cm.colorMatrix.set([
    1.04, 0, 0, 0, 0,
    0, 1.02, 0, 0, 0,
    0, 0, 0.96, 0, 0,
    0, 0, 0, 1, 0
  ]);
    } else if (this.areaIndex >= 21) {
  // เขตลึก: เย็น (ลดแดง เพิ่มน้ำเงิน)
  const cm = cam.filters.internal.addColorMatrix();
  cm.colorMatrix.set([
    0.94, 0, 0, 0, 0,
    0, 0.98, 0, 0, 0,
    0, 0, 1.06, 0, 0,
    0, 0, 0, 1, 0
  ]);
}
// เขตกลาง (3–5): ปล่อยปกติ ไม่ต้องทำอะไร

    bakeAreaTextures(this);
    initBossTextures(this);

    const seed = Math.floor(Math.random() * 1_000_000_000);
    this.layout = generateArea(seed);
    const L = this.layout;
    const t = WALL_THICKNESS;

    for (let r = 0; r < L.rows; r++) {
      for (let c = 0; c < L.cols; c++) {
        this.add.image(c * TILE_SIZE, r * TILE_SIZE, tileKey(L.tiles[r * L.cols + c])).setOrigin(0).setDepth(DEPTH.FLOOR);
      }
    }
    for (const p of L.props) {
      this.add.image(p.x, p.y, propKey(p.kind)).setScale(p.scale).setFlipX(p.flip).setDepth(DEPTH.FLOOR + 1);
    }

    const W = L.width;
    const H = L.height;
    const wall = (x: number, y: number, w: number, h: number) =>
      this.add.tileSprite(x, y, w, h, 'wall').setOrigin(0).setTileScale(SPRITE_SCALE).setDepth(DEPTH.WALL);
    wall(0, 0, W, t);
    wall(0, H - t, W, t);
    wall(0, 0, t, H);
    wall(W - t, 0, t, H);
    this.physics.world.setBounds(t, t, W - t * 2, H - t * 2);
    makeVignette(this);

    this.returnGate = new AreaGate(this, 'return', L.returnGate.x, L.returnGate.y, false);
    this.exitGate = new AreaGate(this, 'next', L.exitGate.x, L.exitGate.y, true);

    for (const spot of L.lootSpots) {
      for (let i = 0; i < GROUND_LOOT_PER_SPOT; i++) {
        const a = (i / GROUND_LOOT_PER_SPOT) * Math.PI * 2 + Math.random() * 0.6;
        const ix = spot.x + Math.cos(a) * 32;
        const iy = spot.y + Math.sin(a) * 32;
        this.items.push(new DroppedItem(this, ix, iy, rollGroundLoot(Math.random, this.scaling.rareBonus), 'ground'));
      }
    }

    const bossHooks: BossHooks = {
      getTargets: () => (this.actor.isDead ? [] : [this.actor.sprite]),
      onHitTarget: (_target, damage, fx, fy) => {
        this.actor.takeDamage(scaleBossDamage(damage, this.scaling.dmgMult), fx, fy);
      },
      onBurn: (_target, delta) => {
        this.actor.applyBurn(delta * this.scaling.burnMult);
      },
      onDeath: (boss: BossBase) => {
        this.onBossDeath(boss);
      },
      onPhaseChange: () => {
        sfx.pickup();
      }
    };

    // ผู้เล่น — เลือดมาจาก huntSession (ข้ามแมพไม่ฟื้น) ดู PlayerActor constructor
    this.actor = new PlayerActor(this, L.spawn.x, L.spawn.y, {
      getTargets: () => [
        ...this.areaMinions.filter((m) => m.minion.isAlive).map((m) => m.target),
        ...this.areaBosses
          .filter((s) => s.boss.isAlive && !s.boss.isSleeping)
          .map((s) => s.target)
      ],
      onDeathShown: () => this.onPlayerDied()
    }, profiles.local);
    this.lastHpForChannel = this.actor.hp;

    this.bossAliveTracker.value = 0;
    const bossCount = rollBossCount(this.areaIndex);
    this.areaBosses = spawnAreaBosses(this, L, bossCount, bossHooks, Math.random);
    this.bossAliveTracker.value = countAliveBosses(this.areaBosses);
    for (const s of this.areaBosses) {
      s.boss.def.hp = Math.round(s.boss.def.hp * this.scaling.hpMult);
      s.boss.hp = s.boss.def.hp;
      s.boss.setSleeping(true);
      s.collider = this.physics.add.collider(this.actor.sprite, s.boss.sprite);
    }

    // ---------- จุดฟื้นเลือดสุ่ม + ตัวแทะเฝ้า ----------
    this.healShrines = spawnHealShrines(this, L, Math.random);
    const guardPoints = shrineGuardPoints(this.healShrines, Math.random);

    const minionHooks: MinionHooks = {
      onHitPlayer: (damage, fx, fy) => {
        this.actor.takeDamage(damage, fx, fy);
      },
      onDeath: (m: Minion) => this.onMinionDeath(m),
      playerAlive: () => !this.actor.isDead && !this.actor.isVictory,
      playerPos: () => ({ x: this.actor.x, y: this.actor.y })
    };
    this.areaMinions = spawnAreaMinions(this, L, this.areaBosses, minionHooks, Math.random, guardPoints);
    for (const m of this.areaMinions) {
      m.collider = this.physics.add.collider(this.actor.sprite, m.minion.sprite);
    }

    this.quest = setupAreaQuest(this, L, seed, bossCount);

    const kb = this.input.keyboard as any;
    this.keyRestart = kb.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.keyInteract = kb.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.keyMute = kb.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    kb.on('keydown-B', () => {
      if (!this.tripEnded && !this.minigame) this.pouchPanel.toggle();
    });

    cam.setBounds(0, 0, W, H);
    cam.startFollow(this.actor.sprite, true, 0.08, 0.08);
    cam.setDeadzone(440 / VIEW_SCALE, 340 / VIEW_SCALE);

    this.pouchText = this.add.text(GAME_WIDTH - 12, 12, '', {
      fontFamily: '"Noto Sans Thai", monospace', fontSize: '16px', fontStyle: 'bold',
      color: '#ffffff', stroke: '#000000', strokeThickness: 4
    }).setOrigin(1, 0).setDepth(DEPTH.HUD).setScrollFactor(0);
    this.pouchText.setInteractive({ useHandCursor: true });
    this.pouchText.on('pointerdown', () => {
      if (!this.tripEnded && !this.minigame) this.pouchPanel.toggle();
    });
    this.pouchPanel = new PouchPanel(this);

    this.questTitleText = this.add.text(44, 124, '', {
      fontFamily: '"Noto Sans Thai", monospace', fontSize: '14px', fontStyle: 'bold',
      color: '#ffd166', stroke: '#000000', strokeThickness: 3
    }).setDepth(DEPTH.HUD).setScrollFactor(0);
    this.questHintText = this.add.text(44, 144, '', {
      fontFamily: '"Noto Sans Thai", monospace', fontSize: '11px',
      color: '#c9c2b2', stroke: '#000000', strokeThickness: 2
    }).setDepth(DEPTH.HUD).setScrollFactor(0);

    this.gateNavigator = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '▲', {
      fontFamily: 'Arial', fontSize: '32px', fontStyle: 'bold',
      color: '#ffd166', stroke: '#4a2600', strokeThickness: 4
    }).setOrigin(0.5).setDepth(DEPTH.HUD).setScrollFactor(0).setVisible(false);

    const info = DEV_TOOLS
      ? `${this.scaling.label} · แอเรีย ${this.areaIndex} · บอส ${bossCount} · แทะ ${this.areaMinions.length} · จุดฟื้น ${this.healShrines.length} · HP ${this.actor.hp}/${this.actor.character.maxHP} · B ถุง · N ใหม่ · G ของ · K ตาย`
      : `${this.scaling.label} · แอเรีย ${L.cols * L.rows} แผ่น · B เปิดถุง`;
    this.add.text(GAME_WIDTH - 12, GAME_HEIGHT - 10, info, {
      fontFamily: '"Noto Sans Thai", monospace', fontSize: '11px',
      color: '#d8cfb8', stroke: '#000000', strokeThickness: 3
    }).setOrigin(1, 1).setDepth(DEPTH.HUD).setScrollFactor(0);

    if (DEV_TOOLS) {
      kb.on('keydown-N', () => {
        if (!this.tripEnded) this.beginAreaTransition();
      });
      kb.on('keydown-G', () => {
        if (!this.tripEnded && !pouch.add(rollGroundLoot())) {
          showDamage(this, this.actor.x, this.actor.y - 50, 'ถุงเต็ม!', '#ff6666', 900);
        }
      });
      kb.on('keydown-K', () => {
        if (controls.mode === 'keys') return; // K = สกิลในโหมดคีย์บอร์ด
        if (!this.tripEnded && !this.actor.isDead) this.actor.takeDamage(999, this.actor.x - 10, this.actor.y);
      });
    }

    // ---------- แผนที่กระดาษ (3F): หมอกสำรวจ + ร่องรอยรัง ----------
    this.cameras.main.setZoom(ZOOM_NORMAL);
    this.targetZoom = ZOOM_NORMAL;
    const mapSources: MinimapSources = {
      player: () => {
        const b: any = this.actor.sprite.body;
        return {
          x: this.actor.x, y: this.actor.y,
          vx: b ? b.velocity.x : 0, vy: b ? b.velocity.y : 0
        };
      },
      items: () => this.items,
      bosses: () => this.areaBosses,
      shrines: () => this.healShrines,
      quest: () => this.quest,
      exitUnlocked: () => this.nextGateUnlocked
    };
    this.minimap = new HuntMinimap(this, this.layout, mapSources);
    kb.on('keydown-Q', () => this.minimap?.cycleMode());

    this.sys.game.canvas.addEventListener('click', this.focusCanvas);
    // P3c: ฝุ่นกระดาษลอย
    this.dust = new AmbientDust(this, 35);
    sfx.startAmbient();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.sys.game.canvas.removeEventListener('click', this.focusCanvas);
      sfx.stopAmbient();
      if (this.minimap) { this.minimap.destroy(); this.minimap = null; }
    });
  }

  update(_time: number, delta: number) {
    if (!this.actor) return;
    if (pressed(this.keyMute, 'M')) {
      const nowMuted = sfx.toggleMute();
      showDamage(this, this.actor.x, this.actor.y - 40, nowMuted ? 'ปิดเสียง' : 'เปิดเสียง', '#ffffff', 900);
    }

    this.actor.update(delta);
    this.dust.update(delta);
    this.updateAudio(delta);
    for (const s of this.areaBosses) {
      if (s.boss.isAlive) s.boss.update(delta);
    }
    for (const m of this.areaMinions) {
      if (m.minion.isAlive) m.minion.update(delta);
    }
    this.updateCombatState();
    this.updateHealChannel(delta);

    const ctx = this.questContext();

    if (tickBossDeath(this.areaBosses, this.bossAliveTracker)) {
      this.unlockNextGate();
    }
    if (tickQuest(this, this.quest, ctx)) {
      showDamage(this, this.actor.x, this.actor.y - 60, 'เควสสำเร็จ!', '#7dff9b', 1800);
      sfx.questDone();
      this.unlockNextGate();
    }

    const now = this.time.now;
    tickQuestGlint(this, this.quest, this.actor.x, this.actor.y, now, this.lastGlintAt);
    this.quest.cache?.tick(this.actor.x, this.actor.y, now);
    const hpFull = this.actor.hp >= this.actor.character.maxHP;
    for (const s of this.healShrines) s.tick(this.actor.x, this.actor.y, hpFull);
    if (now - this.lastHintAt >= HINT_REFRESH_MS) {
      this.lastHintAt = now;
      this.refreshQuestHud(ctx);
    }

    // ไม่เคลียร์ตรงนี้ — callback ตอนมินิเกมจบเป็นคนตั้ง null (กันเปิดซ้อนในช่วง 450ms)
    if (this.minigame) this.minigame.update(delta);

    this.updatePouchHud();
    this.pouchPanel.refresh();
    this.updateGateNavigator();
    this.updateCameraZoom(delta);
    if (this.minimap) this.minimap.update(delta, this.time.now);

    if (this.actor.isDead || this.actor.isVictory) {
      if (pressed(this.keyRestart, 'R')) this.scene.start('BaseScene');
      return;
    }

    const px = this.actor.x;
    const py = this.actor.y;
    for (const it of this.items) it.checkPlayerDistance(px, py);
    this.returnGate.checkPlayerDistance(px, py);
    this.exitGate.checkPlayerDistance(px, py);

    if (pressed(this.keyInteract, 'E') && !this.tripEnded && !this.isTransitioning) {
      if (this.minigame) {
        this.minigame.press();
        return;
      }
      
      // 1. กล่องผนึก (สำคัญสุด - ต้องมาก่อนเก็บของ เพื่อไม่ให้ของบอสบัง)
      if (this.quest.cache && !this.quest.cache.isResolved && this.quest.cache.isNear(px, py)) {
        this.openSealMinigame();
        return;
      }

      // 2. เก็บของตกพื้น
      if (this.tryPickup(px, py)) return;

      // 3. จุดฟื้นเลือด
      const shrine = this.healShrines.find((s) => s.isNear(px, py));
      if (shrine && !shrine.isChanneling) {
        if (shrine.startChannel(hpFull)) {
          this.activeShrine = shrine;
          this.lastHpForChannel = this.actor.hp;
        } else {
          showDamage(this, px, py - 50, 'เลือดเต็มแล้ว', '#7dff9b', 800);
        }
        return;
      }
      if (this.returnGate.isNear(px, py)) {
        this.finishTrip();
      } else if (this.exitGate.isNear(px, py)) {
        if (this.exitGate.isLocked) {
          showDamage(this, px, py - 50, 'ประตูล็อก — ทำเควสหรือล่าบอสก่อน', '#bbbbbb', 1100);
        } else if (!this.isTransitioning) {
          this.beginAreaTransition();
        }
      }
    }
  }

  // =====================================================
  // จุดฟื้นเลือด — ยืนฟื้นทีละหน่วย · โดนตี/เลือดลด = หยุด
  // =====================================================
  private updateHealChannel(delta: number) {
    const shrine = this.activeShrine;
    if (!shrine) return;
    // โดนตีระหว่างฟื้น (เลือดลดจากภายนอก) = การพักพัง
    if (this.actor.hp < this.lastHpForChannel) {
      shrine.stopChannel();
      this.activeShrine = null;
      showDamage(this, this.actor.x, this.actor.y - 50, 'การพักถูกขัด!', '#ff8a7a', 900);
      sfx.shrineBreak();
      return;
    }
    const gained = shrine.updateChannel(delta, this.actor.x, this.actor.y);
    if (gained > 0) {
      this.actor.heal(gained);
      this.lastHpForChannel = this.actor.hp;
    }
    if (!shrine.isChanneling || this.actor.hp >= this.actor.character.maxHP) {
      shrine.stopChannel();
      this.activeShrine = null;
    }
  }

  // =====================================================
  // เควส
  // =====================================================
  private questContext(): QuestContext {
    return {
      playerX: this.actor.x,
      playerY: this.actor.y,
      aliveBosses: countAliveBosses(this.areaBosses),
      totalBosses: this.areaBosses.length
    };
  }

  private refreshQuestHud(ctx: QuestContext) {
    const title = `เควส: ${this.quest.def.title} · ${questProgressText(this.quest, ctx)}`;
    this.questTitleText.setText(title).setColor(this.quest.done ? '#7dff9b' : '#ffd166');
    const hint = this.quest.done
      ? 'ประตูไปต่อเปิดแล้ว — ตามลูกศรทอง'
      : questDirectionHint(this.quest, this.actor.x, this.actor.y, this.layout, this.groundItemSpots());
    if (hint !== this.lastHintLabel) {
      this.lastHintLabel = hint;
      this.questHintText.setText(hint);
    }
  }

  /** ตำแหน่งของพื้นที่ยังไม่ถูกเก็บ — ใบ้เควสเก็บของชี้เฉพาะจุดที่ยังมีของ */
  private groundItemSpots(): { x: number; y: number }[] {
    return this.items
      .filter((it) => !it.isCollected && it.source === 'ground')
      .map((it) => ({ x: it.sprite.x, y: it.sprite.y }));
  }

  private openSealMinigame() {
    const cache = this.quest.cache!;
    this.pouchPanel.close();
    this.minigame = new SealMinigame(this, (success) => {
      this.minigame = null;
      if (this.tripEnded || this.actor.isDead) return;
      if (success) {
        cache.crackOpen();
        sfx.sealBreak();
        for (let i = 0; i < SEAL.rewardCount; i++) {
          const base = LOOT_TABLE[Math.floor(Math.random() * LOOT_TABLE.length)];
          const highPool = RARITY_IDS.filter((r) => RARITY[r].order >= SEAL.rewardMinOrder);
          const rarity = Math.random() < 0.12 * this.scaling.rareBonus ? 'legendary' : highPool[0];
          const a = (i / SEAL.rewardCount) * Math.PI * 2 + Math.random() * 0.5;
          this.items.push(new DroppedItem(this, cache.x + Math.cos(a) * 44, cache.y + Math.sin(a) * 44, { ...base, rarity }, 'seal'));
        }
        showRarityBanner(this, cache.x, cache.y - 70, 'epic', 'ผนึกแตก — ของมีค่าคายออกมา');
      } else {
        cache.breakSeal();
        this.actor.takeDamage(SEAL.trapDamage, cache.x, cache.y);
        const a = Math.random() * Math.PI * 2;
        this.items.push(new DroppedItem(this, cache.x + Math.cos(a) * 40, cache.y + Math.sin(a) * 40, rollGroundLoot(Math.random, this.scaling.rareBonus), 'seal'));
        showDamage(this, cache.x, cache.y - 50, 'ผนึกสะท้อน!', '#ff8a7a', 1200);
        sfx.sealBackfire();
      }
    });
  }

  // =====================================================
  // Combat State
  // =====================================================
  private updateCombatState() {
    if (!this.actor.isDead && !this.actor.isVictory) {
      for (const s of this.areaBosses) {
        if (!s.boss.isAlive || !s.boss.isSleeping) continue;
        const d = Phaser.Math.Distance.Between(this.actor.x, this.actor.y, s.boss.sprite.x, s.boss.sprite.y);
        if (d <= DETECT_RADIUS) {
          s.boss.setSleeping(false);
          showDamage(this, s.boss.sprite.x, s.boss.sprite.y - 80, 'ต่อสู้!', '#ff5555', 1500);
          sfx.bossWake();
        }
      }
    }
    const awake = this.areaBosses.filter((s) => s.boss.isAlive && !s.boss.isSleeping);
    if (awake.length === 0) {
      if (this.inCombat) this.endCombat();
      return;
    }
    if (!this.inCombat) {
      this.inCombat = true;
      sfx.setTension(true);
      this.targetZoom = ZOOM_COMBAT;
    }
    if (!this.currentCombatBoss || !this.currentCombatBoss.boss.isAlive || this.currentCombatBoss.boss.isSleeping) {
      this.currentCombatBoss = awake[0];
      this.activeBossHud?.destroy();
      this.activeBossHud = new BossHUD(this, awake[0].boss.def.name, awake[0].boss.def.hp);
    }
    this.activeBossHud?.update(this.currentCombatBoss.boss.hp);
  }

  private endCombat() {
    this.inCombat = false;
    sfx.setTension(false);
    this.currentCombatBoss = null;
    this.activeBossHud?.destroy();
    this.activeBossHud = null;
    this.targetZoom = ZOOM_NORMAL;
  }

  /** ซูมต่อเนื่องแบบหน่วง — ไม่มี tween ชนกันเวลาสลับบอส หรือตายกลางซูม */
  private updateCameraZoom(delta: number) {
    if (this.tripEnded || this.actor.isDead) this.targetZoom = ZOOM_NORMAL;
    const cam = this.cameras.main;
    const diff = this.targetZoom - cam.zoom;
    if (Math.abs(diff) < 0.0006) {
      if (cam.zoom !== this.targetZoom) cam.setZoom(this.targetZoom);
      return;
    }
    cam.setZoom(cam.zoom + diff * (1 - Math.exp(-delta / ZOOM_DAMP_MS)));
  }

  private onBossDeath(boss: BossBase) {
    showDamage(this, this.actor.x, this.actor.y - 80, 'บอสตายแล้ว!', '#ffd166', 2000);
    huntSession.addBossKill(); // สถิติในสมุดบันทึกที่ฐาน
    const spawned = this.areaBosses.find((s) => s.boss === boss);
    if (spawned) {
      try { spawned.collider?.destroy(); } catch { /* กันทำลายซ้ำ */ }
      spawned.collider = undefined;
      const drops = rollBossDrops(spawned.type, this.scaling.dropCount, Math.random, this.scaling.rareBonus);
      for (let i = 0; i < drops.length; i++) {
        const angle = (i * Math.PI * 2) / drops.length + (Math.random() - 0.5) * 0.4;
        const dist = 40 + Math.random() * 20;
        const ix = boss.sprite.x + Math.cos(angle) * dist;
        const iy = boss.sprite.y + Math.sin(angle) * dist;
        this.items.push(new DroppedItem(this, ix, iy, drops[i], 'boss'));
      }
    }
  }

  private onMinionDeath(minion: Minion) {
    const spawned = this.areaMinions.find((m) => m.minion === minion);
    if (spawned) {
      try { spawned.collider?.destroy(); } catch { /* กันทำลายซ้ำ */ }
      spawned.collider = undefined;
    }
    if (Math.random() < MINION.dropChance) {
      const loot = rollGroundLoot(Math.random, this.scaling.rareBonus);
      this.items.push(new DroppedItem(this, minion.sprite.x, minion.sprite.y, loot, 'minion'));
    }
  }

  /** เสียงเท้าตามชนิดพื้น + หัวใจเต้นตอนเลือดต่ำ */
  private updateAudio(delta: number) {
    if (this.tripEnded || this.actor.isDead || this.actor.isVictory) return;
    const body: any = this.actor.sprite.body;
    if (!body) return;
    const speed = Math.hypot(body.velocity.x, body.velocity.y);
    if (speed > 25 && speed < 260) {
      this.stepAcc += (speed * delta) / 1000;
      if (this.stepAcc >= STEP_DIST) {
        this.stepAcc = 0;
        const L = this.layout;
        const col = Phaser.Math.Clamp(Math.floor(this.actor.x / TILE_SIZE), 0, L.cols - 1);
        const row = Phaser.Math.Clamp(Math.floor(this.actor.y / TILE_SIZE), 0, L.rows - 1);
        sfx.step(L.tiles[row * L.cols + col]);
      }
    } else if (speed <= 25) {
      this.stepAcc = STEP_DIST * 0.6; // หยุดแล้วเดินใหม่ ก้าวแรกมาไว
    }

    const ratio = this.actor.hp / this.actor.character.maxHP;
    if (ratio <= LOW_HP_RATIO) {
      this.heartTimer -= delta;
      if (this.heartTimer <= 0) {
        const danger = 1 - ratio / LOW_HP_RATIO; // 0..1 ยิ่งเลือดน้อยยิ่งถี่/ดัง
        sfx.heartbeat(0.45 + danger * 0.55);
        this.heartTimer = 1150 - danger * 600;
      }
    } else {
      this.heartTimer = 0;
    }
  }

  private updateGateNavigator() {
    if (this.nextGateUnlocked && !this.tripEnded && this.exitGate) {
      const cam = this.cameras.main;
      const view = cam.worldView;
      const gate = this.exitGate;
      const isVisible = gate.x >= view.x && gate.x <= view.x + view.width && gate.y >= view.y && gate.y <= view.y + view.height;
      if (isVisible) {
        this.gateNavigator.setVisible(false);
      } else {
        const dx = gate.x - (view.x + view.width / 2);
        const dy = gate.y - (view.y + view.height / 2);
        const angle = Math.atan2(dy, dx);
        // ขอบจอคิดในพื้นที่ออกแบบ ไม่ใช่ขนาดแคนวาส
        const edgeX = GAME_WIDTH / 2 - 46;
        const edgeY = GAME_HEIGHT / 2 - 52;
        const edgeScale = Math.min(edgeX / Math.max(Math.abs(dx), 0.001), edgeY / Math.max(Math.abs(dy), 0.001));
        this.gateNavigator
          .setPosition(GAME_WIDTH / 2 + dx * edgeScale, GAME_HEIGHT / 2 + dy * edgeScale)
          .setRotation(angle + Math.PI / 2)
          .setVisible(true);
      }
    } else {
      this.gateNavigator.setVisible(false);
    }
  }

  private tryPickup(px: number, py: number): boolean {
    const near = this.items
      .filter((it) => !it.isCollected && Phaser.Math.Distance.Between(it.sprite.x, it.sprite.y, px, py) <= 50)
      .sort((a, b) => Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, px, py) - Phaser.Math.Distance.Between(b.sprite.x, b.sprite.y, px, py));
    if (near.length === 0) return false;
    for (const it of near) {
      const loot = it.loot;
      if (!pouch.add(loot)) {
        showDamage(this, px, py - 50, 'ถุงเต็ม!', '#ff6666', 1100);
        break;
      }
      this.items = this.items.filter((d) => d !== it);
      if (it.source === 'ground' && this.quest.def.kind === 'collect') {
        this.quest.collected++;
        this.lastHintAt = 0; // ให้ HUD เควสอัปเดตทันที ไม่รอรอบ 1 วิ
      }
      it.collect(() => {
        sfx.pickupRarity(loot.rarity);
        showDamage(this, this.actor.x, this.actor.y - 40, `+ ${loot.name}`, RARITY[loot.rarity].color, 1300);
      });
    }
    return true;
  }

  private updatePouchHud() {
    const label = `ถุง ${pouch.count}/${pouch.capacity}${pouch.isFull ? ' (เต็ม)' : ''} [B]`;
    if (label === this.lastPouchLabel) return;
    this.lastPouchLabel = label;
    const ratio = pouch.count / pouch.capacity;
    this.pouchText.setText(label).setColor(pouch.isFull ? '#ff6666' : ratio >= 0.75 ? '#ffd166' : '#ffffff');
  }

  private finishTrip() {
    if (this.tripEnded) return;
    this.tripEnded = true;
    this.stopAllChannels();
    this.pouchPanel.close();
    this.minigame?.destroy();
    this.minigame = null;
    sfx.stopAmbient();
    sfx.homeward();
    this.actor.setVictory();
    huntSession.clearTripHP(); // ถึงฐานแล้ว = ทริปหน้าเลือดเต็ม
    const moved = pouch.depositAll();
    const took = Date.now() - pouch.startedAt;
    huntSession.logTrip({
      outcome: 'return',
      area: this.areaIndex,
      kept: moved.length,
      lost: 0,
      hp: this.actor.hp,
      maxHp: this.actor.character.maxHP,
      ms: took
    });
    saveGame();
    this.time.delayedCall(300, () => {
      showHuntSummary(this, {
        timeTakenMs: took,
        huntLoot: moved,
        bag: huntSession.getBag(),
        footer: 'กด R เพื่อกลับฐาน'
      });
    });
  }

  private onPlayerDied() {
    if (this.tripEnded) return;
    this.tripEnded = true;
    this.stopAllChannels();
    this.pouchPanel.close();
    this.minigame?.destroy();
    this.minigame = null;
    sfx.stopAmbient();
    sfx.death();
    huntSession.clearTripHP(); // ตาย = ทริปหน้าเลือดเต็ม
    const { kept, lost } = pouch.resolveDeath();
    huntSession.logTrip({
      outcome: 'death',
      area: this.areaIndex,
      kept: kept.length,
      lost: lost.length,
      hp: 0,
      maxHp: this.actor.character.maxHP,
      ms: Date.now() - pouch.startedAt
    });
    saveGame();
    showEndScreen(this, 'GAME OVER', '#ff4444', `เสียของ ${lost.length} ชิ้น · เก็บได้ ${kept.length} ชิ้น · กด R กลับฐาน`);
  }

  private stopAllChannels() {
    this.activeShrine?.stopChannel();
    this.activeShrine = null;
  }

  private beginAreaTransition(): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    // ฝากเลือดไว้ให้แมพถัดไป — ข้ามแมพไม่ฟื้นตามกติกาใหม่
    huntSession.setTripHP(this.actor.hp);
    sfx.whoosh();
    transitionToNextArea(
      this,
      () => { if (!this.tripEnded) this.cleanupForRestart(); },
      () => { if (!this.tripEnded) this.scene.restart({ continueTrip: true, areaIndex: this.areaIndex + 1 }); },
      this.areaIndex + 1
    );
  }

  private cleanupForRestart(): void {
    if (this.dust) this.dust.destroy();
    try { this.time.removeAllEvents(); } catch { /* noop */ }
    try { this.tweens.killAll(); } catch { /* noop */ }
    this.stopAllChannels();
    this.pouchPanel.close();
    this.minigame?.destroy();
    this.minigame = null;
    destroyHealShrines(this.healShrines);
    destroyAreaMinions(this.areaMinions);
    destroyAreaBosses(this.areaBosses);
    this.items = [];
  }

  private unlockNextGate(): void {
    if (this.nextGateUnlocked) return;
    this.nextGateUnlocked = true;
    this.exitGate.setLocked(false);
    sfx.gateUnlock();
    showDamage(this, this.exitGate.x, this.exitGate.y - 60, 'ประตูเปิดแล้ว!', '#ffd166', 2000);
  }
}