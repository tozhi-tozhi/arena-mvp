// src/scenes/GameScene.ts — เฟส 1: ตัวละครใหม่ (อัคนี / ลูมิ)
import Phaser from 'phaser';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  WALL_THICKNESS,
  SPRITE_SCALE,
  DEPTH
} from '../config';
import { showDamage, burst, spawnThrustDir, makeVignette, ringEffect } from '../systems/effects';
import { spawnArcSlash } from '../systems/combatFx';
import { sfx } from '../systems/sfx';
import { PlayerHUD } from '../ui/PlayerHUD';
import { BossHUD } from '../ui/BossHUD';
import { showEndScreen } from '../ui/GameOverScreen';
import { PlayerShot } from '../entities/PlayerShot';
import { CHARACTERS, AKKHANI, LUMA, type CharacterDef } from '../data/characters';
import { loadout } from '../systems/Loadout';
import { Perks } from '../systems/Perks';
import { saveGame } from '../systems/SaveGame';
import { LootBox } from '../entities/LootBox';
import { showHuntSummary } from '../ui/HuntSummaryScreen';
import { DroppedItem } from '../entities/DroppedItem';
import { ExitPortal } from '../entities/ExitPortal';
import { rollLoot, type LootDef } from '../data/loot';
import { huntSession } from '../systems/HuntSession';
import { createBoss, type Boss } from '../entities/createBoss';
import { pickRandomBossId, BURN } from '../data/bosses';
import { ensureBossTextures } from '../systems/bossTextures';

const CLAY_SCALE = 0.8;
const WALK_FRAME_MS = 150;

// พื้นที่ฟันที่กำลัง "ออกฤทธิ์" อยู่ (ตรวจชนบอสทุกเฟรมจนกว่าจะโดนหรือหมดเวลา)
interface Sweep {
  dir: Phaser.Math.Vector2;
  range: number;
  halfAngle: number;
  damage: number;
  until: number;
  hit: boolean;
  actionId: number;
  onHit?: () => void;
}

// ช่วงพุ่งดาบของอัคนี
interface Thrust {
  until: number;
  damage: number;
  hit: boolean;
  actionId: number;
}

export class GameScene extends Phaser.Scene {
  private player: any;
  private character!: CharacterDef;
  private baseScale: number = CLAY_SCALE;

  private keyW: any;
  private keyA: any;
  private keyS: any;
  private keyD: any;
  // เมาส์: คลิกซ้าย = โจมตี (ค้าง = ชาร์จ), คลิกขวา = สกิล
  private attackHeld: boolean = false;
  private attackPressed: boolean = false;
  private attackReleased: boolean = false;
  private skillPressed: boolean = false;
  private attackBufferUntil: number = 0;
  private keyRestart: any;
  private keyInteract: any;
  private keyMute: any;

  // สถานะการต่อสู้
  private isAttacking: boolean = false;
  private isActionLocked: boolean = false; // ล็อกการเดิน (ท่าชาร์จ / สกิลอัคนี)
  private isLunging: boolean = false;
  private isDashing: boolean = false;
  private isCharging: boolean = false;
  private chargeStartAt: number = 0;
  private skillInvincible: boolean = false;
  private actionToken: number = 0; // เพิ่มค่าเมื่อท่าถูกขัดจังหวะ — callback เก่าจะไม่ทำงาน
  private actionSeq: number = 0;   // เลขประจำ "การโจมตี 1 ครั้ง" (ใช้นับพาสซีฟ)
  private actionStartedAt: number = 0;
  private sweep: Sweep | null = null;
  private thrust: Thrust | null = null;
  private skillReadyAt: number = 0;
  private shots: PlayerShot[] = [];

  // พาสซีฟ
  private shield: boolean = false;
  private passiveReadyAt: number = 0;
  private hitCounter: number = 0;
  private lastCountedAction: number = -1;

  private facing = new Phaser.Math.Vector2(1, 0);
  private hitStopUntil: number = 0;

  private playerHP: number = 5;
  private maxPlayerHP: number = 5;
  private isInvincible: boolean = false;
  private isStunned: boolean = false;
  private isDead: boolean = false;
  private isVictory: boolean = false;
  private hud!: PlayerHUD;
  private playerShadow: any;
  private useClay: boolean = false;

  private chargeGfx: any;
  private shieldRing: any;
  private skillText: any;
  private passiveText: any;
  private charmText: any;
  private perks!: Perks;
    // ไฟไหม้ (จากภัสมะ)
  private burnLevel: number = 0;
  private burnExposure: number = 0;
  private burnTick: number = 0;
  private burnDecay: number = 0;
  private burnLastInFire: number = 0;
  private burnImmuneUntil: number = 0;
  private burnFxAt: number = 0;
  private burnText: any;

  private walkFrameTimer: number = 0;
  private walkFrameIndex: number = 0;
  private currentTexture: string = 'hero';

  private monster!: Boss;
  private bossHud!: BossHUD;
  private bossCollider: any;

  private lootBox: LootBox | null = null;
  private droppedItem: DroppedItem | null = null;
  private exitPortal: ExitPortal | null = null;
  private huntLoot: LootDef[] = [];
  private huntStartTime: number = 0;

  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    this.load.image('hero_clay_idle', 'assets/hero_clay_idle.png');
    this.load.image('hero_clay_walk1', 'assets/hero_clay_walk1.png');
    this.load.image('hero_clay_walk2', 'assets/hero_clay_walk2.png');
    this.load.image('hero_clay_attack', 'assets/hero_clay_attack.png');

    this.load.image('floor', 'assets/floor.png');
    this.load.image('wall', 'assets/wall.png');
    this.load.image('hero', 'assets/hero.png');
    this.load.image('slime', 'assets/slime.png');
    this.load.image('loot_box_closed', 'assets/loot_box_closed.png');
    this.load.image('loot_box_open', 'assets/loot_box_open.png');
    this.load.image('green_potion', 'assets/green_potion.png');
    this.load.image('boss_phasama', 'assets/boss_phasama.png');
    this.load.image('boss_phasama_ball', 'assets/boss_phasama_ball.png');
    this.load.image('boss_maya', 'assets/boss_maya.png');
  }

  create() {
    this.useClay =
      this.textures.exists('hero_clay_idle') &&
      this.textures.exists('hero_clay_walk1') &&
      this.textures.exists('hero_clay_walk2') &&
      this.textures.exists('hero_clay_attack');

    this.character = CHARACTERS[loadout.characterId];
    this.baseScale = this.useClay ? CLAY_SCALE : SPRITE_SCALE;

    // รีเซ็ตสถานะ
    this.maxPlayerHP = this.character.maxHP;
    this.playerHP = this.maxPlayerHP;
    this.isAttacking = false;
    this.isActionLocked = false;
    this.isLunging = false;
    this.isDashing = false;
    this.isCharging = false;
    this.skillInvincible = false;
    this.isInvincible = false;
    this.isStunned = false;
    this.isDead = false;
    this.isVictory = false;
    this.actionToken = 0;
    this.actionSeq = 0;
    this.sweep = null;
    this.thrust = null;
    this.skillReadyAt = 0;
    this.shots = [];
    this.shield = false;
    this.passiveReadyAt = 0;
    this.hitCounter = 0;
    this.lastCountedAction = -1;
    this.facing.set(1, 0);
    this.hitStopUntil = 0;
    this.walkFrameTimer = 0;
    this.walkFrameIndex = 0;

    this.lootBox = null;
    this.droppedItem = null;
    this.exitPortal = null;
    this.huntLoot = [];
    this.huntStartTime = this.time.now;

    const W = GAME_WIDTH;
    const H = GAME_HEIGHT;
    const t = WALL_THICKNESS;
    this.add.tileSprite(0, 0, W, H, 'floor').setOrigin(0).setTileScale(SPRITE_SCALE).setDepth(DEPTH.FLOOR);
    this.add.tileSprite(0, 0, W, t, 'wall').setOrigin(0).setTileScale(SPRITE_SCALE).setDepth(DEPTH.WALL);
    this.add.tileSprite(0, H - t, W, t, 'wall').setOrigin(0).setTileScale(SPRITE_SCALE).setDepth(DEPTH.WALL);
    this.add.tileSprite(0, 0, t, H, 'wall').setOrigin(0).setTileScale(SPRITE_SCALE).setDepth(DEPTH.WALL);
    this.add.tileSprite(W - t, 0, t, H, 'wall').setOrigin(0).setTileScale(SPRITE_SCALE).setDepth(DEPTH.WALL);

    this.physics.world.setBounds(t, t, W - t * 2, H - t * 2);
    makeVignette(this);

    // สร้างผู้เล่น
    const startTexture = this.useClay ? 'hero_clay_idle' : 'hero';
    this.player = this.physics.add.sprite(400, 300, startTexture) as any;
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(DEPTH.PLAYER);
    this.player.setScale(this.baseScale * this.character.scale);
    this.currentTexture = startTexture;
    this.applyBaseTint();

    const shadowOffset = this.useClay ? this.player.displayHeight / 2 - 6 : 14;
    this.playerShadow = this.add
      .ellipse(400, 300 + shadowOffset, 26, 10, 0x000000, 0.35)
      .setDepth(DEPTH.PLAYER_SHADOW);

    // วงชาร์จ + โล่
    this.chargeGfx = this.add.graphics();
    this.chargeGfx.setDepth(DEPTH.PLAYER + 1);
    this.shieldRing = this.add.circle(400, 300, 28);
    this.shieldRing.setStrokeStyle(3, 0x66e0ff);
    this.shieldRing.setDepth(DEPTH.PLAYER + 1);
    this.shieldRing.setVisible(false);

    // Input
    const keyboard = this.input.keyboard as any;
    this.keyW = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    // เมาส์: ซ้าย = ตี, ขวา = สกิล (เก็บเป็นแฟล็ก แล้ว update() ค่อยหยิบไปใช้)
    this.attackHeld = false;
    this.attackPressed = false;
    this.attackReleased = false;
    this.skillPressed = false;
    this.attackBufferUntil = 0;

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.button === 2) {
        this.skillPressed = true;
      } else if (p.button === 0) {
        this.attackHeld = true;
        this.attackPressed = true;
      }
    });
    const onPointerUp = (p: Phaser.Input.Pointer) => {
      if (p.button === 0 && this.attackHeld) {
        this.attackHeld = false;
        this.attackReleased = true;
      }
    };
    this.input.on('pointerup', onPointerUp);
    this.input.on('pointerupoutside', onPointerUp);
    this.keyRestart = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.keyInteract = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.keyMute = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);

    // สร้างบอส
    ensureBossTextures(this);
    const bossId = loadout.bossChoice === 'random' ? pickRandomBossId() : loadout.bossChoice;
    this.burnLevel = 0;
    this.burnExposure = 0;
    this.burnTick = 0;
    this.burnDecay = 0;
    this.burnLastInFire = 0;
    this.burnImmuneUntil = 0;
    this.burnFxAt = 0;
    this.monster = createBoss(this, bossId, 600, 300, {
      getTargets: () => (this.isDead ? [] : [this.player]),
      onHitTarget: (target, damage, fromX, fromY) => this.damagePlayer(target, damage, fromX, fromY),
      onBurn: (_target, delta) => this.applyBurn(delta),
      onDeath: () => this.onMonsterDeath()
    });
    this.bossHud = new BossHUD(this, this.monster.def.name, this.monster.def.hp);
    this.bossCollider = this.physics.add.collider(this.player, this.monster.sprite);

    this.hud = new PlayerHUD(this, this.maxPlayerHP);

    const textStyle = {
      fontFamily: '"Noto Sans Thai", monospace',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    };
    this.skillText = this.add.text(44, 42, '', textStyle).setDepth(DEPTH.HUD).setScrollFactor(0);
    this.passiveText = this.add.text(44, 62, '', textStyle).setDepth(DEPTH.HUD).setScrollFactor(0);
    this.charmText = this.add.text(44, 82, '', textStyle).setDepth(DEPTH.HUD).setScrollFactor(0);
    this.burnText = this.add.text(44, 102, '', textStyle).setDepth(DEPTH.HUD).setScrollFactor(0);

    this.perks = new Perks({
      scene: this,
      getPlayer: () => this.player,
      getBoss: () => {
        if (!this.monster || !this.monster.isAlive || !this.monster.isTargetable) return null;
        const m = this.monster.sprite;
        return { x: m.x, y: m.y, r: this.bossRadius() };
      },
      getHP: () => this.playerHP,
      getMaxHP: () => this.maxPlayerHP,
      heal: (n) => this.healPlayer(n),
      damageBoss: (damage, actionId) => this.hitBoss(damage, actionId),
      spawnAfterimage: (color) => this.spawnAfterimage(color)
    });

    this.showControlsNotice();

    this.cameras.main.setBounds(0, 0, W, H);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    this.sys.game.canvas.addEventListener('click', () => {
      this.sys.game.canvas.focus();
    });
  }

  update(_time: number, delta: number) {
    if (!this.player) return;

    // เก็บสถานะเมาส์ของเฟรมนี้ แล้วเคลียร์ทันที (กันค้างข้ามเฟรม)
    const attackPressed = this.attackPressed;
    const attackReleased = this.attackReleased;
    const skillPressed = this.skillPressed;
    this.attackPressed = false;
    this.attackReleased = false;
    this.skillPressed = false;

    if (Phaser.Input.Keyboard.JustDown(this.keyMute)) {
      const nowMuted = sfx.toggleMute();
      showDamage(this, this.player.x, this.player.y - 40, nowMuted ? 'ปิดเสียง' : 'เปิดเสียง', '#ffffff', 900);
    }

    if (this.isDead || this.isVictory) {
      if (this.keyRestart && Phaser.Input.Keyboard.JustDown(this.keyRestart)) {
        this.scene.start('BaseScene');
      }
      return;
    }

    const now = this.time.now;
    const isHitStopped = now < this.hitStopUntil;

    // ---------- เดิน ----------
    const speed = this.character.speed * (this.isCharging ? 0.5 : 1) * this.perks.speedMultiplier(now);
    const canMove =
      !isHitStopped && !this.isDashing && !this.isLunging && !this.isStunned && !this.isActionLocked;
    let vx = 0;
    let vy = 0;

    if (canMove) {
      if (this.keyA.isDown) vx -= 1;
      if (this.keyD.isDown) vx += 1;
      if (this.keyW.isDown) vy -= 1;
      if (this.keyS.isDown) vy += 1;

      if (vx !== 0 || vy !== 0) {
        const len = Math.hypot(vx, vy);
        vx /= len;
        vy /= len;

      }
      this.player.setVelocity(vx * speed, vy * speed);
    } else if (isHitStopped) {
      this.player.setVelocity(0);
    } else if (this.isActionLocked && !this.isLunging && !this.isDashing && !this.isStunned) {
      this.player.setVelocity(0);
    }
        // ---------- หันหน้า/ทิศโจมตีตามเมาส์ ----------
    if (!this.isActionLocked && !this.isLunging && !this.isDashing && !this.isStunned) {
      const aim = this.getAimDir();
      this.facing.copy(aim);
      if (Math.abs(aim.x) > 0.15) this.player.setFlipX(aim.x < 0);
    }

    // ---------- สลับ texture ----------
    if (!this.isAttacking) {
      if (vx !== 0 || vy !== 0 || this.isDashing) {
        this.walkFrameTimer += delta;
        if (this.walkFrameTimer >= WALK_FRAME_MS) {
          this.walkFrameTimer = 0;
          this.walkFrameIndex = 1 - this.walkFrameIndex;
          this.setPlayerTexture(this.walkFrameIndex === 0 ? 'hero_clay_walk1' : 'hero_clay_walk2');
        }
      } else {
        this.walkFrameTimer = 0;
        this.setPlayerTexture('hero_clay_idle');
      }
    }

    // ---------- สกิล (Shift) ----------
    if (
      skillPressed &&
      now >= this.skillReadyAt &&
      !this.isActionLocked &&
      !this.isStunned &&
      !this.isDashing &&
      !isHitStopped
    ) {
      this.cancelCharge();
      if (this.character.id === 'akkhani') this.akkhaniSkill();
      else this.lumaDash();
    }

    // ---------- โจมตี (Space: กดแล้วปล่อย = ตีเบา / ค้างจนวงเต็ม = ตีชาร์จ) ----------
    const canAct =
      !this.isAttacking && !this.isActionLocked && !this.isStunned && !this.isDashing && !isHitStopped;

    if (attackPressed) {
      if (canAct) {
        this.attackBufferUntil = 0;
        this.isCharging = true;
        this.chargeStartAt = now;
      } else {
        this.attackBufferUntil = now + 180; // กดเร็วไปนิด — จำไว้แป๊บนึง
      }
    } else if (canAct && !this.isCharging && now <= this.attackBufferUntil) {
      this.attackBufferUntil = 0;
      if (this.attackHeld) {
        this.isCharging = true;
        this.chargeStartAt = now;
      } else {
        this.performLight();
      }
    }

    if (this.isCharging) {
      if (this.isStunned || this.isActionLocked || this.isDashing) {
        this.cancelCharge();
      } else {
        const held = now - this.chargeStartAt;
        this.drawCharge(held, now);
        if (attackReleased) {
          this.cancelCharge();
          if (held >= this.chargeNeeded()) this.performCharged();
          else this.performLight();
        }
      }
    }

    // ---------- บอส + การตรวจโดน ----------
    this.monster.update(delta);
    this.perks.update(now, delta);
    this.updateBurn(delta, now);
    this.updateSweep(now);
    this.updateThrust(now);

    for (const s of this.shots) s.update(delta);
    this.shots = this.shots.filter((s) => s.isAlive());

    // ---------- ระบบเก็บของ ----------
    const justPressedE = Phaser.Input.Keyboard.JustDown(this.keyInteract);

    if (this.lootBox) {
      this.lootBox.checkPlayerDistance(this.player.x, this.player.y);
      if (justPressedE && !this.lootBox.isOpened) {
        const dist = Phaser.Math.Distance.Between(
          this.lootBox.sprite.x,
          this.lootBox.sprite.y,
          this.player.x,
          this.player.y
        );
        if (dist <= 60) {
          sfx.open();
          this.lootBox.open(() => {
            const boxX = this.lootBox!.sprite.x;
            const boxY = this.lootBox!.sprite.y;
            const rolledLoot = rollLoot();
            this.droppedItem = new DroppedItem(this, boxX, boxY, rolledLoot);
            this.lootBox = null;
          });
        }
      }
    }

    if (this.droppedItem) {
      this.droppedItem.checkPlayerDistance(this.player.x, this.player.y);
      if (justPressedE && !this.droppedItem.isCollected) {
        const dist = Phaser.Math.Distance.Between(
          this.droppedItem.sprite.x,
          this.droppedItem.sprite.y,
          this.player.x,
          this.player.y
        );
        if (dist <= 50) {
          const loot = this.droppedItem.loot;
          this.droppedItem.collect(() => {
            sfx.pickup();
            huntSession.addItem(loot);
            saveGame();
            this.huntLoot.push(loot);
            this.droppedItem = null;
            showDamage(this, this.player.x, this.player.y - 40, `+ ${loot.name}`, loot.color, 1500);
            this.exitPortal = new ExitPortal(this, GAME_WIDTH / 2, GAME_HEIGHT / 2);
          });
        }
      }
    }

    if (this.exitPortal) {
      this.exitPortal.checkPlayerDistance(this.player.x, this.player.y);
      if (justPressedE) {
        const dist = Phaser.Math.Distance.Between(
          this.exitPortal.sprite.x,
          this.exitPortal.sprite.y,
          this.player.x,
          this.player.y
        );
        if (dist <= 55) {
          this.exitPortal.enter(() => {
            sfx.pickup();
            this.exitPortal = null;
            this.isVictory = true;
            this.player.setVelocity(0);
            this.player.setAlpha(1);
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

    // ---------- เงา / โล่ / HUD ----------
    const shadowOffset = this.useClay ? this.player.displayHeight / 2 - 6 : 14;
    this.playerShadow.setPosition(this.player.x, this.player.y + shadowOffset);
    this.shieldRing.setPosition(this.player.x, this.player.y);
    this.shieldRing.setVisible(this.shield);
    this.updateHudTexts(now);
  }

  // =====================================================
  // ตัวช่วยทั่วไป
  // =====================================================
  private applyBaseTint() {
    this.player.clearTint();
    this.player.setTint(this.character.tint);
  }

  private setPlayerTexture(key: string) {
    if (!this.useClay) return;
    if (this.currentTexture === key) return;
    if (!this.textures.exists(key)) return;
    this.player.setTexture(key);
    this.currentTexture = key;
    this.player.setScale(this.baseScale * this.character.scale);
  }

  private bossRadius(): number {
    return this.monster.sprite.displayWidth * 0.4;
  }

    // ทิศจากตัวผู้เล่นไปยังเคอร์เซอร์เมาส์
  private getAimDir(): Phaser.Math.Vector2 {
    const p = this.input.activePointer;
    const cam = this.cameras.main;
    const dx = p.x + cam.scrollX - this.player.x;
    const dy = p.y + cam.scrollY - this.player.y;
    const len = Math.hypot(dx, dy);
    if (len < 6) return this.facing.clone(); // เคอร์เซอร์ทับตัวพอดี: ใช้ทิศเดิม
    return new Phaser.Math.Vector2(dx / len, dy / len);
  }

  // ท่าทั้งหมดเรียกฟังก์ชันนี้ — ตอนนี้ใช้ทิศเมาส์ล้วนๆ
  // (พารามิเตอร์เล็งอัตโนมัติเลิกใช้แล้ว เพราะเมาส์เล็งแม่นกว่า ไม่ต้องให้เกมช่วยดึง)
  private getAttackDir(_assistRange: number, _assistAngle: number): Phaser.Math.Vector2 {
    return this.getAimDir();
  }

  private chargeNeeded(): number {
    return this.character.id === 'akkhani' ? AKKHANI.charged.holdMs : LUMA.charged.holdMs;
  }

  private cancelCharge() {
    this.isCharging = false;
    this.chargeGfx.clear();
  }

  private drawCharge(held: number, now: number) {
    const g = this.chargeGfx;
    g.clear();
    if (held < 120) return;
    const need = this.chargeNeeded();
    const k = Math.min(1, held / need);
    const ready = held >= need;
    const px = this.player.x;
    const py = this.player.y;

    g.lineStyle(3, ready ? 0xffd54a : 0xffffff, ready ? 1 : 0.7);
    g.beginPath();
    g.arc(px, py, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k, false);
    g.strokePath();

    if (ready) {
      g.lineStyle(2, 0xffd54a, 0.5);
      g.strokeCircle(px, py, 33 + Math.sin(now / 60) * 3);
    }
  }

  // เริ่มท่าใหม่: ล้างสถานะค้างจากท่าก่อนหน้า (กัน callback เก่าถูกยกเลิกแล้วสถานะไม่ถูกปลด)
  private beginAction(): number {
    this.actionToken++;
    this.actionStartedAt = this.time.now;
    this.isAttacking = false;
    this.isLunging = false;
    this.isActionLocked = false;
    this.sweep = null;
    this.thrust = null;
    return this.actionToken;
  }
  // ขัดจังหวะทุกท่า (ตอนโดนตี)
  private interruptActions() {
    this.actionToken++;
    this.isAttacking = false;
    this.isActionLocked = false;
    this.isLunging = false;
    this.isDashing = false;
    this.skillInvincible = false;
    this.sweep = null;
    this.thrust = null;
    this.cancelCharge();
    this.setPlayerTexture('hero_clay_idle');
  }

  private updateHudTexts(now: number) {
    const remain = Math.max(0, this.skillReadyAt - now);
    if (remain <= 0) {
      this.skillText.setText(`คลิกขวา · ${this.character.skillName} · พร้อม`).setColor('#7dff9a');
    } else {
      this.skillText.setText(`คลิกขวา · ${this.character.skillName} · ${(remain / 1000).toFixed(1)}s`).setColor('#bbbbbb');
    }

    if (this.character.id === 'akkhani') {
      if (this.shield) {
        this.passiveText.setText('โล่: กันได้ 1 ฮิต').setColor('#66e0ff');
      } else if (now < this.passiveReadyAt) {
        this.passiveText.setText(`โล่: คูลดาวน์ ${((this.passiveReadyAt - now) / 1000).toFixed(1)}s`).setColor('#bbbbbb');
      } else {
        this.passiveText.setText('โล่: รอตอนถูกตี').setColor('#bbbbbb');
      }
    } else {
      this.passiveText.setText(`นับโจมตี ${this.hitCounter}/${LUMA.passive.hitsNeeded}`).setColor('#ffc8f5');
    }
    const ch = this.perks.charmHud();
     this.charmText.setText(ch ? ch.text : '').setColor(ch ? ch.color : '#bbbbbb');
      this.burnText
      .setText(this.burnLevel > 0 ? `ไหม้ Lv ${this.burnLevel}/${BURN.maxLevel}` : '')
      .setColor('#ff9a3a');
  }

  // =====================================================
  // การตรวจโดนบอส
  // =====================================================
  private sweepHits(s: Sweep): boolean {
    const m = this.monster.sprite;
    const r = this.bossRadius();
    const dx = m.x - this.player.x;
    const dy = m.y - this.player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > s.range + r) return false;
    if (dist <= r + 14) return true;

    const dot = Phaser.Math.Clamp((dx * s.dir.x + dy * s.dir.y) / dist, -1, 1);
    const angle = Math.acos(dot);
    const widen = Math.asin(Math.min(1, r / dist)); // บอสตัวใหญ่ = กรวยกว้างขึ้นนิดหน่อย
    return angle <= Phaser.Math.DegToRad(s.halfAngle) + widen;
  }

  private updateSweep(now: number) {
    const s = this.sweep;
    if (!s) return;
    if (now > s.until || !this.monster.isAlive) {
      this.sweep = null;
      return;
    }
    if (s.hit) return;
    if (!this.sweepHits(s)) return;
    s.hit = true;
    this.hitBoss(s.damage, s.actionId);
    s.onHit?.();
  }

  private updateThrust(now: number) {
    const t = this.thrust;
    if (!t) return;
    if (now > t.until || !this.monster.isAlive) {
      this.thrust = null;
      return;
    }
    if (t.hit) return;
    const m = this.monster.sprite;
    const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, m.x, m.y);
    if (d <= this.bossRadius() + 30) {
      t.hit = true;
      this.hitBoss(t.damage, t.actionId);
    }
  }

  // ทุกการสร้างดาเมจให้บอสผ่านที่นี่ที่เดียว (actionId -1 = ดาเมจจากสัตว์เลี้ยง)
  private hitBoss(damage: number, actionId: number) {
    if (!this.monster.isAlive || !this.monster.isTargetable) return;
    damage = this.perks.onPlayerHit(damage, actionId);
    sfx.hit();
    this.monster.takeDamage(damage);
    this.bossHud.update(this.monster.hp);
    this.cameras.main.shake(120, 0.006 + damage * 0.002);
    this.hitStop(40 + damage * 12);
    if (actionId >= 0) this.countAttackHit(actionId);
  }

  private hitStop(ms: number) {
    this.hitStopUntil = Math.max(this.hitStopUntil, this.time.now + ms);
  }

  private healPlayer(n: number) {
    const before = this.playerHP;
    this.playerHP = Math.min(this.maxPlayerHP, this.playerHP + n);
    const gained = this.playerHP - before;
    if (gained > 0) {
      this.hud.update(this.playerHP);
      showDamage(this, this.player.x, this.player.y - 20, '+' + gained, '#66ff88');
    }
  }

  // พาสซีฟลูมิ: นับ "การโจมตี 1 ครั้งที่โดน" (กระสุนพัดหลายนัดนับเป็น 1)
  private countAttackHit(actionId: number) {
    if (this.character.id !== 'luma') return;
    if (actionId === this.lastCountedAction) return;
    this.lastCountedAction = actionId;
    this.hitCounter++;
    if (this.hitCounter >= LUMA.passive.hitsNeeded) {
      this.hitCounter = 0;
      this.skillReadyAt = 0;
      showDamage(this, this.player.x, this.player.y - 40, 'แดชพร้อม!', '#9de7ff', 900);
      ringEffect(this, this.player.x, this.player.y, 50, 0x9de7ff, 300);
    }
  }

  // =====================================================
  // ตีเบา / ตีชาร์จ
  // =====================================================
  private performLight() {
    if (this.character.id === 'akkhani') this.akkhaniLight();
    else this.lumaLight();
  }

  private performCharged() {
    if (this.character.id === 'akkhani') this.akkhaniCharged();
    else this.lumaCharged();
  }

  // ---------- อัคนี: ตีเบา = ฟันกวาด ----------
  private akkhaniLight() {
    const A = AKKHANI.light;
    const token = this.beginAction();
    const now = this.time.now;
    const dir = this.getAttackDir(A.assistRange, A.assistAngle);
    if (Math.abs(dir.x) > 0.3) this.player.setFlipX(dir.x < 0);
    this.facing.copy(dir);

    this.isAttacking = true;
    this.setPlayerTexture('hero_clay_attack');
    sfx.swing();
    spawnArcSlash(this, this.player.x, this.player.y, Math.atan2(dir.y, dir.x), A.range, A.halfAngle, 0xff6a5a, 6, 180);
    this.cameras.main.shake(80, 0.003);

    this.sweep = {
      dir,
      range: A.range,
      halfAngle: A.halfAngle,
      damage: A.damage,
      until: now + A.activeMs,
      hit: false,
      actionId: ++this.actionSeq
    };

    this.isLunging = true;
    this.player.setVelocity(dir.x * A.lungeSpeed, dir.y * A.lungeSpeed);
    this.time.delayedCall(A.lungeMs, () => {
      if (token !== this.actionToken) return;
      this.isLunging = false;
      this.player.setVelocity(0);
    });
    this.time.delayedCall(A.durationMs, () => {
      if (token !== this.actionToken) return;
      this.isAttacking = false;
      this.setPlayerTexture('hero_clay_idle');
    });
  }

  // ---------- อัคนี: ตีค้าง = ฟันกวาด แล้วพุ่งดาบ ----------
  private akkhaniCharged() {
    const C = AKKHANI.charged;
    const token = this.beginAction();
    const now = this.time.now;
    const dir = this.getAttackDir(C.assistRange, C.assistAngle);
    if (Math.abs(dir.x) > 0.3) this.player.setFlipX(dir.x < 0);
    this.facing.copy(dir);
    const actionId = ++this.actionSeq;

    this.isAttacking = true;
    this.isActionLocked = true;
    this.setPlayerTexture('hero_clay_attack');
    this.player.setVelocity(0);

    // 1) ฟันกวาด
    sfx.swing();
    spawnArcSlash(this, this.player.x, this.player.y, Math.atan2(dir.y, dir.x), C.sweepRange, C.sweepHalfAngle, 0xffb15a, 7, 200);
    this.cameras.main.shake(100, 0.004);
    this.sweep = {
      dir,
      range: C.sweepRange,
      halfAngle: C.sweepHalfAngle,
      damage: C.sweepDamage,
      until: now + C.sweepActiveMs,
      hit: false,
      actionId
    };

    // 2) พุ่งดาบ
    this.time.delayedCall(C.thrustDelayMs, () => {
      if (token !== this.actionToken) return;
      this.isLunging = true;
      this.thrust = { until: this.time.now + C.thrustMs, damage: C.thrustDamage, hit: false, actionId };
      this.player.setVelocity(dir.x * C.thrustSpeed, dir.y * C.thrustSpeed);
      sfx.dash();
      spawnThrustDir(this, this.player.x, this.player.y, dir.x, dir.y, 150, 3);
      this.cameras.main.shake(120, 0.005);
      this.time.addEvent({ delay: 40, repeat: 4, callback: () => this.spawnAfterimage(0xff8a5a) });
    });
    this.time.delayedCall(C.thrustDelayMs + C.thrustMs, () => {
      if (token !== this.actionToken) return;
      this.isLunging = false;
      this.player.setVelocity(0);
    });

    // 3) จบท่า
    this.time.delayedCall(C.totalMs, () => {
      if (token !== this.actionToken) return;
      this.isAttacking = false;
      this.isActionLocked = false;
      this.setPlayerTexture('hero_clay_idle');
    });
  }

  // ---------- อัคนี: สกิล = อมตะ แล้วฟันกวาดใหญ่ ----------
  private akkhaniSkill() {
    const S = AKKHANI.skill;
    const token = this.beginAction();
    this.skillReadyAt = this.time.now + this.character.skillCooldownMs;

    this.isAttacking = true;
    this.isActionLocked = true;
    this.skillInvincible = true;
    this.player.setVelocity(0);
    this.setPlayerTexture('hero_clay_attack');

    ringEffect(this, this.player.x, this.player.y, 70, 0xffffff, S.windupMs);
    this.tweens.add({
      targets: this.player,
      alpha: 0.5,
      duration: 80,
      yoyo: true,
      repeat: Math.floor(S.windupMs / 160)
    });

    this.time.delayedCall(S.windupMs, () => {
      if (token !== this.actionToken) return;
      this.skillInvincible = false;
      this.player.setAlpha(1);

      const dir = this.getAttackDir(S.assistRange, S.assistAngle);
      this.facing.copy(dir);
      if (Math.abs(dir.x) > 0.3) this.player.setFlipX(dir.x < 0);

      sfx.swing();
      spawnArcSlash(this, this.player.x, this.player.y, Math.atan2(dir.y, dir.x), S.range, S.halfAngle, 0xff3b2f, 10, 300);
      ringEffect(this, this.player.x, this.player.y, S.range * 0.7, 0xff8a5a, 300);
      this.cameras.main.shake(220, 0.012);

      this.sweep = {
        dir,
        range: S.range,
        halfAngle: S.halfAngle,
        damage: S.damage,
        until: this.time.now + S.activeMs,
        hit: false,
        actionId: ++this.actionSeq,
        onHit: () => this.healPlayer(S.heal)
      };
    });

    this.time.delayedCall(S.windupMs + S.recoverMs, () => {
      if (token !== this.actionToken) return;
      this.isAttacking = false;
      this.isActionLocked = false;
      this.setPlayerTexture('hero_clay_idle');
    });
  }

  // ---------- ลูมิ: ตีเบา = ยิงกระสุน ระเบิดปลายทาง ----------
  private lumaLight() {
    const L = LUMA.light;
    const token = this.beginAction();
    const dir = this.getAttackDir(L.assistRange, L.assistAngle);
    if (Math.abs(dir.x) > 0.3) this.player.setFlipX(dir.x < 0);
    this.facing.copy(dir);

    this.isAttacking = true;
    this.setPlayerTexture('hero_clay_attack');
    sfx.swing();

    this.fireShot(dir, L, 'light', ++this.actionSeq);

    this.time.delayedCall(L.cooldownMs, () => {
      if (token !== this.actionToken) return;
      this.isAttacking = false;
      this.setPlayerTexture('hero_clay_idle');
    });
  }

  // ---------- ลูมิ: ตีชาร์จ = ยิงกระสุนพัด ----------
  private lumaCharged() {
    const C = LUMA.charged;
    const token = this.beginAction();
    const dir = this.getAttackDir(C.assistRange, C.assistAngle);
    if (Math.abs(dir.x) > 0.3) this.player.setFlipX(dir.x < 0);
    this.facing.copy(dir);
    const actionId = ++this.actionSeq;

    this.isAttacking = true;
    this.setPlayerTexture('hero_clay_attack');
    sfx.swing();
    this.cameras.main.shake(100, 0.004);

    const baseAngle = Math.atan2(dir.y, dir.x);
    for (let i = 0; i < C.count; i++) {
      const offset = Phaser.Math.DegToRad((i - (C.count - 1) / 2) * C.spreadDeg);
      const d = new Phaser.Math.Vector2(Math.cos(baseAngle + offset), Math.sin(baseAngle + offset));
      this.fireShot(d, C, 'charge', actionId);
    }

    this.time.delayedCall(C.totalMs, () => {
      if (token !== this.actionToken) return;
      this.isAttacking = false;
      this.setPlayerTexture('hero_clay_idle');
    });
  }

  private fireShot(
    dir: Phaser.Math.Vector2,
    cfg: { speed: number; range: number; radius: number; color: number; aoeRadius: number },
    kind: 'light' | 'charge',
    actionId: number
  ) {
    const shot = new PlayerShot(
      this,
      this.player.x + dir.x * 14,
      this.player.y + dir.y * 14,
      dir.x,
      dir.y,
      { speed: cfg.speed, range: cfg.range, radius: cfg.radius, color: cfg.color },
      () => {
        if (!this.monster.isAlive || !this.monster.isTargetable) return null;
        const m = this.monster.sprite;
        return { x: m.x, y: m.y, r: this.bossRadius() };
      },
      (x, y, ratio) => this.onShotDetonate(kind, actionId, x, y, ratio, cfg.aoeRadius, cfg.color)
    );
    this.shots.push(shot);
  }

  private onShotDetonate(
    kind: 'light' | 'charge',
    actionId: number,
    x: number,
    y: number,
    ratio: number,
    aoeRadius: number,
    color: number
  ) {
    ringEffect(this, x, y, aoeRadius + 8, color, 220);
    burst(this, x, y, color, kind === 'light' ? 6 : 3, aoeRadius * 1.2, 3);

    if (!this.monster.isAlive) return;
    const m = this.monster.sprite;
    const d = Phaser.Math.Distance.Between(x, y, m.x, m.y);
    if (d > aoeRadius + this.bossRadius()) return;

    let damage: number;
    if (kind === 'light') {
      const far = ratio >= LUMA.light.farRatio;
      damage = far ? LUMA.light.farDamage : LUMA.light.nearDamage;
      if (far) showDamage(this, m.x, m.y - this.monster.sprite.displayHeight / 2 - 24, 'FAR!', '#9de7ff', 500);
    } else {
      damage = LUMA.charged.damage;
    }
    this.hitBoss(damage, actionId);
  }

  // ---------- ลูมิ: สกิล = แดช (ไม่อมตะ) ----------
  private lumaDash() {
    const D = LUMA.dash;
    const token = this.beginAction();
    this.skillReadyAt = this.time.now + this.character.skillCooldownMs;
    this.isDashing = true;
    sfx.dash();

    let dx = (this.keyD.isDown ? 1 : 0) - (this.keyA.isDown ? 1 : 0);
    let dy = (this.keyS.isDown ? 1 : 0) - (this.keyW.isDown ? 1 : 0);
    if (dx === 0 && dy === 0) {
      dx = this.facing.x;
      dy = this.facing.y;
    }
    const len = Math.hypot(dx, dy) || 1;
    this.player.setVelocity((dx / len) * D.speed, (dy / len) * D.speed);
    this.player.setAlpha(0.8);

    this.time.addEvent({ delay: 30, repeat: 5, callback: () => this.spawnAfterimage(0x66ccff) });

    this.time.delayedCall(D.durationMs, () => {
      if (token !== this.actionToken) return;
      this.isDashing = false;
      if (!this.isDead) {
        this.player.setAlpha(1);
        this.player.setVelocity(0);
      }
    });
  }

  private spawnAfterimage(color: number) {
    const tex = this.useClay ? this.currentTexture : 'hero';
    const ghost = this.add.sprite(this.player.x, this.player.y, tex);
    ghost.setScale(this.player.scaleX, this.player.scaleY);
    ghost.setFlipX(this.player.flipX);
    ghost.setTint(color);
    ghost.setAlpha(0.5);
    ghost.setDepth(DEPTH.AFTERIMAGE);
    this.tweens.add({
      targets: ghost,
      alpha: 0,
      duration: 250,
      onComplete: () => ghost.destroy()
    });
  }

  // =====================================================
  // ผู้เล่นโดนตี / ตาย / บอสตาย
  // =====================================================
  private damagePlayer(player: any, amount: number, fromX: number, fromY: number) {
    if (this.isDead || this.isVictory || this.isInvincible || this.skillInvincible) return;

    // โล่กัน 1 ฮิต
    if (this.shield) {
      this.shield = false;
      sfx.hit();
      ringEffect(this, player.x, player.y, 44, 0x66e0ff, 300);
      burst(this, player.x, player.y, 0x66e0ff, 10, 40, 4);
      showDamage(this, player.x, player.y, 'BLOCK', '#66e0ff');
      this.isInvincible = true;
      this.time.delayedCall(450, () => {
        if (!this.isDead) this.isInvincible = false;
      });
      return;
    }

    this.perks.onPlayerHurt();
    this.interruptActions();

    this.playerHP = Math.max(0, this.playerHP - amount);
    this.hud.update(this.playerHP);
    sfx.hurt();
    this.hitStop(80);

    const dx = player.x - fromX;
    const dy = player.y - fromY;
    const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    this.isStunned = true;
    player.setVelocity((dx / len) * 300, (dy / len) * 300);
    this.time.delayedCall(150, () => {
      this.isStunned = false;
      if (!this.isDead) player.setVelocity(0);
    });

    player.setTintFill(0xff3333);
    this.time.delayedCall(100, () => this.applyBaseTint());
    this.cameras.main.shake(200, 0.015);
    this.cameras.main.flash(120, 255, 0, 0);
    showDamage(this, player.x, player.y, '-' + amount, '#ff5555');
    burst(this, player.x, player.y, 0xff3333, 8, 36, 5);

    if (this.playerHP <= 0 && !this.isVictory) {
      this.gameOver();
      return;
    }

    // พาสซีฟอัคนี: เลือดลดแล้วได้โล่ (มีคูลดาวน์)
    if (this.character.id === 'akkhani' && !this.shield && this.time.now >= this.passiveReadyAt) {
      this.shield = true;
      this.passiveReadyAt = this.time.now + AKKHANI.passive.shieldCooldownMs;
      ringEffect(this, player.x, player.y, 40, 0x66e0ff, 400);
    }

    this.isInvincible = true;
    this.tweens.add({
      targets: player,
      alpha: 0.3,
      duration: 80,
      yoyo: true,
      repeat: 5
    });
    this.time.delayedCall(1000, () => {
      this.isInvincible = false;
      if (!this.isDead) player.setAlpha(1);
    });
  }

    // =====================================================
  // ไฟไหม้ (ภัสมะเรียกทุกเฟรมที่ผู้เล่นอยู่ในไฟ)
  // =====================================================
  private applyBurn(delta: number) {
    if (this.isDead || this.isVictory || this.skillInvincible) return;
    const now = this.time.now;
    if (now < this.burnImmuneUntil) return;
    this.burnLastInFire = now;

    if (this.burnLevel === 0) {
      // เริ่มติดไฟ — โล่กันได้ 1 ครั้ง
      if (this.shield) {
        this.shield = false;
        this.burnImmuneUntil = now + BURN.shieldImmuneMs;
        sfx.hit();
        ringEffect(this, this.player.x, this.player.y, 44, 0x66e0ff, 300);
        showDamage(this, this.player.x, this.player.y, 'BLOCK', '#66e0ff');
        return;
      }
      this.burnLevel = 1;
      this.burnExposure = 0;
      this.burnTick = 0;
      this.burnDecay = 0;
      return;
    }

    this.burnExposure += delta;
    if (this.burnExposure >= BURN.exposureMsPerLevel && this.burnLevel < BURN.maxLevel) {
      this.burnLevel++;
      this.burnExposure = 0;
      ringEffect(this, this.player.x, this.player.y, 30, 0xff8a3a, 250);
    }
  }

  private updateBurn(delta: number, now: number) {
    if (this.burnLevel <= 0 || this.isDead || this.isVictory) return;

    // ออกจากไฟนานพอ → ค่อยๆ ลดระดับ
    if (now - this.burnLastInFire > BURN.graceMs) {
      this.burnDecay += delta;
      if (this.burnDecay >= BURN.decayMsPerLevel) {
        this.burnDecay = 0;
        this.burnLevel--;
        this.burnTick = 0;
      }
    } else {
      this.burnDecay = 0;
    }
    if (this.burnLevel <= 0) return;

    // ติ๊กดาเมจ (ถี่ขึ้นตามระดับ)
    this.burnTick += delta;
    if (this.burnTick >= BURN.tickIntervals[this.burnLevel]) {
      this.burnTick = 0;
      this.burnDamage(BURN.tickDamage);
    }

    if (now - this.burnFxAt > 250) {
      this.burnFxAt = now;
      burst(this, this.player.x, this.player.y - 6, 0xff8a3a, 2, 18, 3);
    }
  }

  // ดาเมจจากไฟ: ไม่ขัดจังหวะท่า ไม่สะบัด ไม่ติดช่วงอมตะ (ไม่สนช่วง i-frame หลังโดนตี)
  private burnDamage(n: number) {
    if (this.isDead || this.isVictory || this.skillInvincible) return;
    this.perks.onPlayerHurt();
    this.playerHP = Math.max(0, this.playerHP - n);
    this.hud.update(this.playerHP);
    sfx.hurt();
    showDamage(this, this.player.x, this.player.y, '-' + n, '#ff9a3a');
    burst(this, this.player.x, this.player.y, 0xff8a3a, 6, 30, 4);
    this.player.setTintFill(0xff8a3a);
    this.time.delayedCall(80, () => this.applyBaseTint());
    this.cameras.main.shake(80, 0.004);

    if (this.playerHP <= 0) {
      this.gameOver();
      return;
    }

    // พาสซีฟอัคนี: เลือดลดแล้วได้โล่
    if (this.character.id === 'akkhani' && !this.shield && this.time.now >= this.passiveReadyAt) {
      this.shield = true;
      this.passiveReadyAt = this.time.now + AKKHANI.passive.shieldCooldownMs;
      ringEffect(this, this.player.x, this.player.y, 40, 0x66e0ff, 400);
    }
  }
  private gameOver() {
    this.isDead = true;
    this.player.setTint(0x555555);
    this.player.setAlpha(1);
    this.shieldRing.setVisible(false);
    burst(this, this.player.x, this.player.y, 0xff3333, 16, 70, 7);
    showEndScreen(this, 'GAME OVER', '#ff4444', 'กด R เพื่อกลับฐาน');
  }

  private onMonsterDeath() {
    this.player.setAlpha(1);
    this.burnLevel = 0;
    this.bossHud.update(0);
    sfx.bossDie();
    this.hitStop(180);
    this.cameras.main.shake(300, 0.02);

    this.sweep = null;
    this.thrust = null;
    for (const s of this.shots) s.destroy();
    this.shots = [];

    this.lootBox = new LootBox(this, this.monster.sprite.x, this.monster.sprite.y);
    if (this.bossCollider) this.bossCollider.destroy();
  }

  private showControlsNotice() {
    const label =
      this.character.id === 'akkhani'
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
  }
}