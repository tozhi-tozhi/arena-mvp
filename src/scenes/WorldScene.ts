// src/scenes/WorldScene.ts — The World (Phase 3B)
// อัปเดต: ระบบ Combat State, กล้องซูมออก, บอส Idle จนกว่าจะเข้า Combat
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
import { rollGroundLoot, rollBossDrops } from '../data/loot';
import { RARITY } from '../data/rarity';
import { pouch } from '../systems/Pouch';
import { huntSession } from '../systems/HuntSession';
import { showHuntSummary } from '../ui/HuntSummaryScreen';
import { BossHUD } from '../ui/BossHUD';

// === Phase 3D imports ===
import { rollBossCount } from '../data/depth';
import { transitionToNextArea } from '../systems/AreaTransition';
import { spawnAreaBosses, countAliveBosses, tickBossDeath, destroyAreaBosses, type SpawnedBoss } from '../systems/AreaBosses';
import { bossAsTarget } from '../systems/CombatTarget';
import type { BossHooks, BossBase } from '../entities/BossBase';
import { loadBossAssets, initBossTextures } from '../systems/BossLoader';

// ระยะที่บอสจะเริ่มตรวจจับผู้เล่น (ถ้าเข้าใกล้กว่านี้จะเริ่มคอมแบท)
const DETECT_RADIUS = 500;

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

  // === Phase 3D state ===
  private areaBosses: SpawnedBoss[] = [];
  private bossAliveTracker = { value: 0 };
  private areaIndex = 1;
  private nextGateUnlocked = false;
  private isTransitioning = false;
  private activeBossHud: BossHUD | null = null;
  
  // 👇 State สำหรับระบบ Combat
  private inCombat = false;
  private currentCombatBoss: SpawnedBoss | null = null;
  private gateNavigator!: Phaser.GameObjects.Text;

  private keyRestart: any;
  private keyInteract: any;
  private keyMute: any;

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

    if (!data?.continueTrip) {
      pouch.startTrip();
      this.areaIndex = 1;
    } else {
      this.areaIndex = data.areaIndex ?? this.areaIndex + 1;
    }
  }

  create() {
    this.uiCam = new UiCamera(this);
    bakeAreaTextures(this);
    initBossTextures(this);

    const seed = Math.floor(Math.random() * 1_000_000_000);
    this.layout = generateArea(seed);
    const L = this.layout;
    const t = WALL_THICKNESS;

    // พื้น
    for (let r = 0; r < L.rows; r++) {
      for (let c = 0; c < L.cols; c++) {
        this.add.image(c * TILE_SIZE, r * TILE_SIZE, tileKey(L.tiles[r * L.cols + c])).setOrigin(0).setDepth(DEPTH.FLOOR);
      }
    }
    for (const p of L.props) {
      this.add.image(p.x, p.y, propKey(p.kind)).setScale(p.scale).setFlipX(p.flip).setDepth(DEPTH.FLOOR + 1);
    }

    // กำแพง
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

    // ประตู
    this.returnGate = new AreaGate(this, 'return', L.returnGate.x, L.returnGate.y, false);
    this.exitGate = new AreaGate(this, 'next', L.exitGate.x, L.exitGate.y, true);

    // ของตกพื้น
    for (const spot of L.lootSpots) {
      for (let i = 0; i < GROUND_LOOT_PER_SPOT; i++) {
        const a = (i / GROUND_LOOT_PER_SPOT) * Math.PI * 2 + Math.random() * 0.6;
        const ix = spot.x + Math.cos(a) * 32;
        const iy = spot.y + Math.sin(a) * 32;
        this.items.push(new DroppedItem(this, ix, iy, rollGroundLoot()));
      }
    }

    // ---------- Hooks สำหรับบอส ----------
    const bossHooks: BossHooks = {
      getTargets: () => (this.actor.isDead ? [] : [this.actor.sprite]),
      onHitTarget: (_target, damage, fx, fy) => {
        this.actor.takeDamage(damage, fx, fy);
      },
      onBurn: (_target, delta) => {
        this.actor.applyBurn(delta);
      },
      onDeath: (boss: BossBase) => {
        this.onBossDeath(boss);
      },
      onPhaseChange: () => {
        sfx.pickup();
      }
    };

    // ผู้เล่น
    this.actor = new PlayerActor(this, L.spawn.x, L.spawn.y, {
      getTargets: () => {
        if (!this.inCombat) return [];
        return this.areaBosses.filter(s => s.boss.isAlive).map(s => bossAsTarget(s.boss));
      },
      onDeathShown: () => this.onPlayerDied()
    });

    // ---------- Spawn บอส ----------
    this.bossAliveTracker.value = 0;
    const bossCount = rollBossCount(this.areaIndex);
    this.areaBosses = spawnAreaBosses(this, L, bossCount, bossHooks, Math.random);
    this.bossAliveTracker.value = countAliveBosses(this.areaBosses);

    // 👇 ตั้งค่าให้บอสทุกตัว Sleep (Idle) ตอนเกิด
    for (const s of this.areaBosses) {
      s.boss.setSleeping(true);
      this.physics.add.collider(this.actor.sprite, s.boss.sprite);
    }

    if (bossCount === 0) {
      this.unlockNextGate();
    }

    // Input
    const kb = this.input.keyboard as any;
    this.keyRestart = kb.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.keyInteract = kb.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.keyMute = kb.addKey(Phaser.Input.Keyboard.KeyCodes.M);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, W, H);
    cam.startFollow(this.actor.sprite, true, 0.08, 0.08);
    cam.setDeadzone(440, 340);

    // UI Text
    this.pouchText = this.add.text(GAME_WIDTH - 12, 12, '', {
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

    this.gateNavigator = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '▲', {
        fontFamily: 'Arial',
        fontSize: '32px',
        fontStyle: 'bold',
        color: '#ffd166',
        stroke: '#4a2600',
        strokeThickness: 4
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.HUD)
      .setScrollFactor(0)
      .setVisible(false);

    const info = DEV_TOOLS
      ? `แอเรีย ${L.cols}×${L.rows} = ${L.cols * L.rows} แผ่น · seed ${L.seed} · บอส ${bossCount} · N แอเรียใหม่ · G ของ · K ตาย`
      : `แอเรีย ${L.cols * L.rows} แผ่น`;
    this.add.text(GAME_WIDTH - 12, GAME_HEIGHT - 10, info, {
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
      kb.on('keydown-N', () => {
        if (!this.tripEnded) this.beginAreaTransition();
      });
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

    for (const s of this.areaBosses) {
      if (s.boss.isAlive) {
        s.boss.update(delta);
      }
    }

    // 👇 ระบบตรวจจับการเข้า Combat
    if (!this.inCombat) {
      for (const s of this.areaBosses) {
        if (!s.boss.isAlive) continue;
        const dist = Phaser.Math.Distance.Between(this.actor.x, this.actor.y, s.boss.sprite.x, s.boss.sprite.y);
        if (dist <= DETECT_RADIUS) {
          this.startCombat(s);
          break;
        }
      }
    } else {
      if (this.currentCombatBoss && this.currentCombatBoss.boss.isAlive && this.activeBossHud) {
        this.activeBossHud.update(this.currentCombatBoss.boss.hp);
      } else {
        const remaining = this.areaBosses.find(s => s.boss.isAlive);
        if (remaining) {
          this.startCombat(remaining);
        } else {
          this.endCombat();
        }
      }
    }

    if (tickBossDeath(this.areaBosses, this.bossAliveTracker)) {
      this.unlockNextGate();
    }

    this.updatePouchHud();
    this.updateGateNavigator();

    if (this.actor.isDead || this.actor.isVictory) {
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
      } else if (this.exitGate.isNear(px, py)) {
        if (this.exitGate.isLocked) {
          showDamage(this, px, py - 50, 'ประตูล็อก', '#bbbbbb', 900);
        } else if (!this.isTransitioning) {
          this.beginAreaTransition();
        }
      }
    }
  }

  private startCombat(boss: SpawnedBoss) {
    this.inCombat = true;
    this.currentCombatBoss = boss;
    
    // 👇 ปลุกบอสให้ตื่น
    boss.boss.setSleeping(false);

    if (!this.activeBossHud) {
      this.activeBossHud = new BossHUD(this, boss.boss.def.name, boss.boss.def.hp);
    }
    this.activeBossHud.update(boss.boss.hp);
    
    // 👇 ซูมออก (เลขน้อยกว่า 1 = เห็นภาพกว้างขึ้น) แล้วค้างไว้
    this.cameras.main.zoomTo(0.75, 800, 'Sine.easeInOut');
    
    showDamage(this, boss.boss.sprite.x, boss.boss.sprite.y - 80, 'ต่อสู้!', '#ff5555', 1500);
    sfx.open();
  }

  private endCombat() {
    this.inCombat = false;
    this.currentCombatBoss = null;
    if (this.activeBossHud) {
      this.activeBossHud.update(0); // ล้างเลือดบอส
    }
    // 👇 ซูมกลับปกติ
    this.cameras.main.zoomTo(1.0, 800, 'Sine.easeInOut');
  }

  private onBossDeath(boss: BossBase) {
    showDamage(this, this.actor.x, this.actor.y - 80, 'บอสตายแล้ว!', '#ffd166', 2000);
    
    const spawned = this.areaBosses.find(s => s.boss === boss);
    if (spawned) {
      const drops = rollBossDrops(spawned.type, 4);
      for (let i = 0; i < drops.length; i++) {
        const angle = (i * Math.PI) / 2 + (Math.random() - 0.5) * 0.4;
        const dist = 40 + Math.random() * 20;
        const ix = boss.sprite.x + Math.cos(angle) * dist;
        const iy = boss.sprite.y + Math.sin(angle) * dist;
        this.items.push(new DroppedItem(this, ix, iy, drops[i]));
      }
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
        const edgeX = cam.width / 2 - 42;
        const edgeY = cam.height / 2 - 48;
        const scaleX = edgeX / Math.max(Math.abs(dx), 0.001);
        const scaleY = edgeY / Math.max(Math.abs(dy), 0.001);
        const edgeScale = Math.min(scaleX, scaleY);
        
        this.gateNavigator
          .setPosition(cam.width / 2 + dx * edgeScale, cam.height / 2 + dy * edgeScale)
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

  private onPlayerDied() {
    if (this.tripEnded) return;
    this.tripEnded = true;
    const { kept, lost } = pouch.resolveDeath();
    saveGame();
    showEndScreen(this, 'GAME OVER', '#ff4444', `เสียของ ${lost.length} ชิ้น · เก็บได้ ${kept.length} ชิ้น · กด R กลับฐาน`);
  }

  private beginAreaTransition(): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    transitionToNextArea(
      this,
      () => this.cleanupForRestart(),
      () => this.scene.restart({ continueTrip: true, areaIndex: this.areaIndex + 1 }),
      this.areaIndex + 1
    );
  }

  private cleanupForRestart(): void {
    try { this.time.removeAllEvents(); } catch { /* noop */ }
    try { this.tweens.killAll(); } catch { /* noop */ }
    destroyAreaBosses(this.areaBosses);
    this.items = [];
  }

  private unlockNextGate(): void {
    if (this.nextGateUnlocked) return;
    this.nextGateUnlocked = true;
    this.exitGate.setLocked(false);
    showDamage(this, this.exitGate.x, this.exitGate.y - 60, 'ประตูเปิดแล้ว!', '#ffd166', 2000);
  }
}