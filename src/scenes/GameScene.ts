// src/scenes/GameScene.ts — ห้องฝึก (Training Room): ผู้เล่น vs บอส 1 ตัว
// Phase 3A: ตรรกะผู้เล่น/ต่อสู้ย้ายไป src/actors/PlayerActor.ts แล้ว
// ไฟล์นี้เหลือเฉพาะเรื่องของฉาก: พื้น/กำแพง, บอส + HUD บอส, กล่องลูท, ไอเทม, ประตูออก, ลูกศรชี้บอส
import Phaser from 'phaser';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WALL_THICKNESS,
  SPRITE_SCALE,
  DEPTH
} from '../config';
import { showDamage, makeVignette, showRarityBanner } from '../systems/effects';
import { sfx } from '../systems/sfx';
import { BossHUD } from '../ui/BossHUD';
import { showEndScreen } from '../ui/GameOverScreen';
import { loadout } from '../systems/Loadout';
import { starsOf, starName } from '../systems/Upgrades';
import { saveGame } from '../systems/SaveGame';
import { LootBox } from '../entities/LootBox';
import { showHuntSummary } from '../ui/HuntSummaryScreen';
import { DroppedItem } from '../entities/DroppedItem';
import { ExitPortal } from '../entities/ExitPortal';
import { rollBossDrops, type DroppedLoot } from '../data/loot';
import type { BossId } from '../data/bosses';
import { RARITY } from '../data/rarity';
import { huntSession } from '../systems/HuntSession';
import { createBoss, type Boss } from '../entities/createBoss';
import { pickRandomBossId } from '../data/bosses';
import { ensureBossTextures } from '../systems/bossTextures';
import { loadMagmusFrames } from '../systems/magmusFrames';
import { loadPixelFx } from '../systems/pixelFx';
import { PlayerActor } from '../actors/PlayerActor';
import { bossAsTarget, type CombatTarget } from '../systems/CombatTarget';

export class GameScene extends Phaser.Scene {
  private actor!: PlayerActor;

  private keyRestart: any;
  private keyInteract: any;
  private keyMute: any;

  private monster!: Boss;
  private monsterTarget!: CombatTarget;
  private bossHud!: BossHUD;
  private bossCollider: any;
  private bossIndicator!: Phaser.GameObjects.Text;
  private bossIndicatorLabel!: Phaser.GameObjects.Text;

  private lootBox: LootBox | null = null;
  private droppedItems: DroppedItem[] = [];
  private exitPortal: ExitPortal | null = null;
  private huntLoot: DroppedLoot[] = [];
  private huntStartTime: number = 0;
  private currentBossId: BossId = 'phasama';
  private focusCanvas = () => this.sys.game.canvas.focus();

  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    PlayerActor.preloadAssets(this);

    this.load.image('floor', 'assets/floor.png');
    this.load.image('wall', 'assets/wall.png');
    this.load.image('slime', 'assets/slime.png');
    this.load.image('loot_box_closed', 'assets/loot_box_closed.png');
    this.load.image('loot_box_open', 'assets/loot_box_open.png');
    this.load.image('green_potion', 'assets/green_potion.png');
    this.load.image('boss_phasama', 'assets/boss_phasama.png');
    this.load.image('boss_phasama_ball', 'assets/boss_phasama_ball.png');
    this.load.image('boss_maya', 'assets/boss_maya.png');
    loadMagmusFrames(this);
    loadPixelFx(this);
  }

  create() {
    this.lootBox = null;
    this.droppedItems = [];
    this.exitPortal = null;
    this.huntLoot = [];
    this.huntStartTime = this.time.now;

    const W = WORLD_WIDTH;
    const H = WORLD_HEIGHT;
    const t = WALL_THICKNESS;
    this.add.tileSprite(0, 0, W, H, 'floor').setOrigin(0).setTileScale(SPRITE_SCALE).setDepth(DEPTH.FLOOR);
    this.createFloorDetails();
    this.add.tileSprite(0, 0, W, t, 'wall').setOrigin(0).setTileScale(SPRITE_SCALE).setDepth(DEPTH.WALL);
    this.add
      .tileSprite(0, H - t, W, t, 'wall')
      .setOrigin(0)
      .setTileScale(SPRITE_SCALE)
      .setDepth(DEPTH.WALL);
    this.add.tileSprite(0, 0, t, H, 'wall').setOrigin(0).setTileScale(SPRITE_SCALE).setDepth(DEPTH.WALL);
    this.add
      .tileSprite(W - t, 0, t, H, 'wall')
      .setOrigin(0)
      .setTileScale(SPRITE_SCALE)
      .setDepth(DEPTH.WALL);

    this.physics.world.setBounds(t, t, W - t * 2, H - t * 2);
    makeVignette(this);

    // ---------- ผู้เล่น (ตรรกะทั้งหมดอยู่ใน PlayerActor) ----------
    this.actor = new PlayerActor(this, W / 2, H / 2, {
      // ห้องฝึกมีเป้าหมายเดียวคือบอส
      getTargets: () => (this.monsterTarget ? [this.monsterTarget] : []),
      onTargetDamaged: () => this.bossHud.update(this.monster.hp),
      onDeathShown: () => showEndScreen(this, 'GAME OVER', '#ff4444', 'กด R เพื่อกลับฐาน')
    });

    this.keyRestart = (this.input.keyboard as any).addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.keyInteract = (this.input.keyboard as any).addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.keyMute = (this.input.keyboard as any).addKey(Phaser.Input.Keyboard.KeyCodes.M);

    // ---------- บอส ----------
    ensureBossTextures(this);
    const bossId = loadout.bossChoice === 'random' ? pickRandomBossId() : loadout.bossChoice;
    this.currentBossId = bossId;
    this.monster = createBoss(this, bossId, WORLD_WIDTH * 0.78, WORLD_HEIGHT / 2, {
      getTargets: () => (this.actor.isDead ? [] : [this.actor.sprite]),
      onHitTarget: (_target, damage, fromX, fromY) => this.actor.takeDamage(damage, fromX, fromY),
      onBurn: (_target, delta) => this.actor.applyBurn(delta),
      onDeath: () => this.onMonsterDeath()
    });
    this.monsterTarget = bossAsTarget(this.monster);
    this.bossHud = new BossHUD(this, this.monster.def.name, this.monster.def.hp);
    this.bossCollider = this.physics.add.collider(this.actor.sprite, this.monster.sprite);

    this.bossIndicator = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '▲', {
        fontFamily: 'Arial',
        fontSize: '28px',
        fontStyle: 'bold',
        color: '#ffd166',
        stroke: '#4a2600',
        strokeThickness: 4
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.HUD)
      .setScrollFactor(0)
      .setVisible(false);
    this.bossIndicatorLabel = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 24, 'บอส', {
        fontFamily: '"Noto Sans Thai", monospace',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#ffffff',
        backgroundColor: 'rgba(25, 15, 5, 0.78)',
        padding: { x: 5, y: 2 },
        stroke: '#000000',
        strokeThickness: 2
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.HUD)
      .setScrollFactor(0)
      .setVisible(false);

    this.showControlsNotice();

    const camera = this.cameras.main;
    camera.setBounds(0, 0, W, H);
    camera.startFollow(this.actor.sprite, true, 0.08, 0.08);
    camera.setDeadzone(440, 340);

    this.sys.game.canvas.addEventListener('click', this.focusCanvas);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.sys.game.canvas.removeEventListener('click', this.focusCanvas);
    });
  }

  update(_time: number, delta: number) {
    if (!this.actor) return;

    if (Phaser.Input.Keyboard.JustDown(this.keyMute)) {
      const nowMuted = sfx.toggleMute();
      showDamage(this, this.actor.x, this.actor.y - 40, nowMuted ? 'ปิดเสียง' : 'เปิดเสียง', '#ffffff', 900);
    }

    // ผู้เล่น: ควบคุม + ต่อสู้ + เครื่องราง/สัตว์เลี้ยง + ไฟไหม้ + HUD ของผู้เล่น
    this.actor.update(delta);

    if (this.actor.isDead || this.actor.isVictory) {
      if (this.keyRestart && Phaser.Input.Keyboard.JustDown(this.keyRestart)) {
        this.scene.start('BaseScene');
      }
      return;
    }

    this.monster.update(delta);

    const px = this.actor.x;
    const py = this.actor.y;
    const justPressedE = Phaser.Input.Keyboard.JustDown(this.keyInteract);

    if (this.lootBox) {
      this.lootBox.checkPlayerDistance(px, py);
      if (justPressedE && !this.lootBox.isOpened) {
        const dist = Phaser.Math.Distance.Between(this.lootBox.sprite.x, this.lootBox.sprite.y, px, py);
        if (dist <= 60) {
          sfx.open();
          this.lootBox.open(() => {
            const boxX = this.lootBox!.sprite.x;
            const boxY = this.lootBox!.sprite.y;
            this.lootBox = null;

            // ดรอป 4 ชิ้นจากบอสนี้
            const rolledDrops = rollBossDrops(this.currentBossId, 4);
            const margin = WALL_THICKNESS + 30;
            for (let i = 0; i < rolledDrops.length; i++) {
              const angle = (i * Math.PI) / 2 + (Math.random() - 0.5) * 0.4;
              const dist = 40 + Math.random() * 20;
              const ix = Phaser.Math.Clamp(boxX + Math.cos(angle) * dist, margin, WORLD_WIDTH - margin);
              const iy = Phaser.Math.Clamp(boxY + Math.sin(angle) * dist, margin, WORLD_HEIGHT - margin);
              const item = new DroppedItem(this, ix, iy, rolledDrops[i]);
              this.droppedItems.push(item);
            }

            // แบนเนอร์เฉพาะ rarity สูงสุด
            const highest = rolledDrops.reduce((max, d) =>
              RARITY[d.rarity].order > RARITY[max.rarity].order ? d : max
            );
            if (RARITY[highest.rarity].glow) {
              showRarityBanner(this, boxX, boxY - 70, highest.rarity, highest.name);
            }

            // ประตูออกเกิดตรงจุดที่บอสตาย (ใต้กล่องลงมานิดนึง) เพื่อให้ผู้เล่นหาเจอทันที
            this.exitPortal = new ExitPortal(this, boxX, boxY + 80);
          });
        }
      }
    }

    // เก็บได้ทีละหลายชิ้น — E ครั้งเดียวเก็บทุกไอเทมในระยะ
    if (this.droppedItems.length > 0) {
      for (const item of this.droppedItems) {
        item.checkPlayerDistance(px, py);
      }
      if (justPressedE) {
        const toCollect = this.droppedItems.filter((item) => {
          if (item.isCollected) return false;
          const dist = Phaser.Math.Distance.Between(item.sprite.x, item.sprite.y, px, py);
          return dist <= 50;
        });
        for (const item of toCollect) {
          const loot = item.loot;
          this.droppedItems = this.droppedItems.filter((d) => d !== item);
          item.collect(() => {
            sfx.pickup();
            huntSession.addItem(loot);
            saveGame();
            this.huntLoot.push(loot);
            showDamage(
              this,
              this.actor.x,
              this.actor.y - 40,
              `+ ${loot.name}`,
              RARITY[loot.rarity].color,
              1500
            );
          });
        }
      }
    }

    if (this.exitPortal) {
      this.exitPortal.checkPlayerDistance(px, py);
      if (justPressedE) {
        const dist = Phaser.Math.Distance.Between(this.exitPortal.sprite.x, this.exitPortal.sprite.y, px, py);
        if (dist <= 55) {
          this.exitPortal.enter(() => {
            sfx.pickup();
            this.exitPortal = null;
            this.actor.setVictory();
            this.time.delayedCall(400, () => {
              showHuntSummary(this, {
                timeTakenMs: this.time.now - this.huntStartTime,
                huntLoot: this.huntLoot,
                bag: huntSession.getBag()
              });
            });
          });
        }
      }
    }

    this.updateBossIndicator();
  }

  // =====================================================
  // ตัวช่วยของฉาก
  // =====================================================
  private createFloorDetails() {
    const g = this.add.graphics();
    g.setDepth(DEPTH.FLOOR + 0.5);

    let seed = 20261113;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    const dirtColors = [0x66543d, 0x85704d, 0x9b8158, 0x596044, 0x77705a];

    for (let i = 0; i < 650; i++) {
      const x = rand() * WORLD_WIDTH;
      const y = rand() * WORLD_HEIGHT;
      const w = 12 + rand() * 45;
      const h = 8 + rand() * 25;
      const color = dirtColors[Math.floor(rand() * dirtColors.length)];
      g.fillStyle(color, 0.08 + rand() * 0.09);
      g.fillEllipse(x, y, w, h);
    }

    for (let i = 0; i < 320; i++) {
      const x = rand() * WORLD_WIDTH;
      const y = rand() * WORLD_HEIGHT;
      const r = 2 + rand() * 5;
      g.fillStyle(rand() > 0.5 ? 0xaaa18a : 0x403e38, 0.18 + rand() * 0.12);
      g.fillEllipse(x, y, r * 2, r);
    }

    for (let i = 0; i < 180; i++) {
      const x = rand() * WORLD_WIDTH;
      const y = rand() * WORLD_HEIGHT;
      g.lineStyle(2, 0x596d3d, 0.25);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - 4 - rand() * 5, y - 5 - rand() * 7);
      g.moveTo(x, y);
      g.lineTo(x + 4 + rand() * 5, y - 4 - rand() * 6);
      g.strokePath();
    }
  }

  private onMonsterDeath() {
    this.actor.endEncounter();
    this.bossHud.update(0);
    sfx.bossDie();
    this.actor.hitStop(180);
    this.cameras.main.shake(300, 0.02);

    this.lootBox = new LootBox(this, this.monster.sprite.x, this.monster.sprite.y);
    if (this.bossCollider) this.bossCollider.destroy();
  }

  private updateBossIndicator() {
    if (!this.bossIndicator || !this.bossIndicatorLabel || !this.monster?.isAlive) {
      this.bossIndicator?.setVisible(false);
      this.bossIndicatorLabel?.setVisible(false);
      return;
    }

    const camera = this.cameras.main;
    const boss = this.monster.sprite;
    const view = camera.worldView;
    const isVisible =
      boss.x >= view.x && boss.x <= view.x + view.width && boss.y >= view.y && boss.y <= view.y + view.height;

    if (isVisible) {
      this.bossIndicator.setVisible(false);
      this.bossIndicatorLabel.setVisible(false);
      return;
    }

    const dx = boss.x - (view.x + view.width / 2);
    const dy = boss.y - (view.y + view.height / 2);
    const angle = Math.atan2(dy, dx);
    const edgeX = camera.width / 2 - 42;
    const edgeY = camera.height / 2 - 48;
    const scaleX = edgeX / Math.max(Math.abs(dx), 0.001);
    const scaleY = edgeY / Math.max(Math.abs(dy), 0.001);
    const edgeScale = Math.min(scaleX, scaleY);
    const screenX = camera.width / 2 + dx * edgeScale;
    const screenY = camera.height / 2 + dy * edgeScale;

    this.bossIndicator
      .setPosition(screenX, screenY)
      .setRotation(angle + Math.PI / 2)
      .setVisible(true);
    const labelY = screenY > GAME_HEIGHT * 0.72 ? screenY - 27 : screenY + 25;
    this.bossIndicatorLabel.setPosition(screenX, labelY).setVisible(true);
  }

  private showControlsNotice() {
    const label =
      this.actor.character.id === 'akkhani'
        ? 'อัคนี · คลิกซ้าย ฟัน (ค้าง = ฟัน+พุ่ง) · คลิกขวา สกิล'
        : 'ลูมิ · คลิกซ้าย ยิง (ค้าง = กระสุนพัด) · คลิกขวา แดช';

    const notice = this.add
      .text(GAME_WIDTH / 2, 60, label, {
        fontFamily: '"Noto Sans Thai", monospace',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#9de7ff',
        backgroundColor: 'rgba(0,0,0,0.55)',
        padding: { x: 12, y: 6 },
        stroke: '#000000',
        strokeThickness: 3
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.HUD)
      .setScrollFactor(0)
      .setAlpha(0);

    this.tweens.add({ targets: notice, alpha: 1, duration: 250 });
    this.tweens.add({
      targets: notice,
      alpha: 0,
      delay: 2600,
      duration: 500,
      onComplete: () => notice.destroy()
    });

    // โชว์ดาวที่ปลดล็อกแล้ว ให้ผู้เล่นรู้ว่าของใหม่ทำงาน
    const st = starsOf(this.actor.character.id);
    if (st > 0) {
      const names = Array.from({ length: st }, (_, i) => starName(this.actor.character.id, i)).join(' · ');
      const starNotice = this.add
        .text(GAME_WIDTH / 2, 92, `${'★'.repeat(st)} ${names}`, {
          fontFamily: '"Noto Sans Thai", monospace',
          fontSize: '14px',
          fontStyle: 'bold',
          color: '#ffd54a',
          backgroundColor: 'rgba(0,0,0,0.55)',
          padding: { x: 10, y: 4 },
          stroke: '#000000',
          strokeThickness: 3
        })
        .setOrigin(0.5)
        .setDepth(DEPTH.HUD)
        .setScrollFactor(0)
        .setAlpha(0);
      this.tweens.add({ targets: starNotice, alpha: 1, duration: 250, delay: 200 });
      this.tweens.add({
        targets: starNotice,
        alpha: 0,
        delay: 3000,
        duration: 500,
        onComplete: () => starNotice.destroy()
      });
    }
  }
}
