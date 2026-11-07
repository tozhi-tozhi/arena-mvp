// src/scenes/GameScene.ts — ฉบับ Phaser 4 safe mode
import Phaser from 'phaser';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  WALL_THICKNESS,
  SPRITE_SCALE,
  DEPTH,
  PLAYER_ATTACK_DAMAGE,
  DASH_COOLDOWN_MS,
  AIM_ASSIST_RANGE,
  AIM_ASSIST_ANGLE
} from '../config';
import { showDamage, burst, spawnThrustDir, makeVignette, ringEffect } from '../systems/effects';
import { sfx } from '../systems/sfx';
import { PlayerHUD } from '../ui/PlayerHUD';
import { BossHUD } from '../ui/BossHUD';
import { showEndScreen } from '../ui/GameOverScreen';
import { Monster } from '../entities/Monster';
import { MONSTERS, pickRandomMonsterId } from '../data/monsters';
import { EquipmentSystem, playerEquipment } from '../systems/EquipmentSystem';
import { saveGame } from '../systems/SaveGame';
import { LootBox } from '../entities/LootBox';
import { showHuntSummary } from '../ui/HuntSummaryScreen';
import { DroppedItem } from '../entities/DroppedItem';
import { ExitPortal } from '../entities/ExitPortal';
import { rollLoot, type LootDef } from '../data/loot';
import { huntSession } from '../systems/HuntSession';

// ค่าปรับแต่งขนาด Clay — แก้ตรงนี้ที่เดียว
const CLAY_SCALE = 0.8;
// ความเร็วสลับเฟรมเดิน (ms) — ยิ่งเลขน้อยยิ่งสลับเร็ว
const WALK_FRAME_MS = 150;

export class GameScene extends Phaser.Scene {
  private player: any;
  private equipment!: EquipmentSystem;

  private keyW: any;
  private keyA: any;
  private keyS: any;
  private keyD: any;
  private keyDash: any;
  private keyAttack: any;
  private keyRestart: any;
  private keyInteract: any;
  private keyMute: any;

  private isAttacking: boolean = false;
  private hitThisSwing: boolean = false;
  private isDashing: boolean = false;

  private facing = new Phaser.Math.Vector2(1, 0);
  private swingOrigin = new Phaser.Math.Vector2();
  private swingDir = new Phaser.Math.Vector2(1, 0);
  private swingRange: number = 0;
  private lastDashAt: number = -9999;
  
  // ⬅️ แก้บั๊กค้าง: ใช้ flag แทน physics.world.pause()
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

  // ⬅️ สำหรับสลับเฟรมเดินแบบ manual
  private walkFrameTimer: number = 0;
  private walkFrameIndex: number = 0; // 0 = walk1, 1 = walk2
  private currentTexture: string = 'hero';

  private monster!: Monster;
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
    // โหลดรูป Clay 4 ไฟล์แยก (ถ้าไฟล์ไม่มี จะ fallback ไปใช้ hero.png อัตโนมัติ)
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
  }

  create() {
    // เช็คว่ามีรูป Clay ครบ 4 ไฟล์ไหม
    this.useClay = 
      this.textures.exists('hero_clay_idle') &&
      this.textures.exists('hero_clay_walk1') &&
      this.textures.exists('hero_clay_walk2') &&
      this.textures.exists('hero_clay_attack');

    // รีเซ็ตสถานะ
    this.playerHP = this.maxPlayerHP;
    this.equipment = playerEquipment;
    this.isAttacking = false;
    this.hitThisSwing = false;
    this.isDashing = false;
    this.isInvincible = false;
    this.isStunned = false;
    this.isDead = false;
    this.isVictory = false;
    this.facing.set(1, 0);
    this.lastDashAt = -9999;
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
    this.player.setScale(this.useClay ? CLAY_SCALE : SPRITE_SCALE);
    this.currentTexture = startTexture;

    // เงาใต้ผู้เล่น
    const shadowOffset = this.useClay ? this.player.displayHeight / 2 - 6 : 14;
    this.playerShadow = this.add
      .ellipse(400, 300 + shadowOffset, 26, 10, 0x000000, 0.35)
      .setDepth(DEPTH.PLAYER_SHADOW);

    // Input
    const keyboard = this.input.keyboard as any;
    this.keyW = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyDash = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.keyAttack = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyRestart = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.keyInteract = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.keyMute = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);

    // สร้างบอส
    const def = MONSTERS[pickRandomMonsterId()];
    this.monster = new Monster(this, def, 600, 300, {
      getTargets: () => (this.isDead ? [] : [this.player]),
      onHitTarget: (target, damage, fromX, fromY) => this.damagePlayer(target, damage, fromX, fromY),
      onDeath: () => this.onMonsterDeath()
    });
    this.bossHud = new BossHUD(this, def.name, def.hp);
    this.bossCollider = this.physics.add.collider(this.player, this.monster.sprite);

    this.hud = new PlayerHUD(this, this.maxPlayerHP);
    this.showGearNotice();

    this.cameras.main.setBounds(0, 0, W, H);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    this.sys.game.canvas.addEventListener('click', () => {
      this.sys.game.canvas.focus();
    });
  }

  update(_time: number, delta: number) {
    if (!this.player) return;

    if (Phaser.Input.Keyboard.JustDown(this.keyMute)) {
      const nowMuted = sfx.toggleMute();
      showDamage(this, this.player.x, this.player.y - 40, nowMuted ? 'ปิดเสียง' : 'เปิดเสียง', '#ffffff', 900);
    }

    if (this.isDead) {
      if (this.keyRestart && Phaser.Input.Keyboard.JustDown(this.keyRestart)) {
        this.scene.start('BaseScene');
      }
      return;
    }
    if (this.isVictory) {
      if (this.keyRestart && Phaser.Input.Keyboard.JustDown(this.keyRestart)) {
        this.scene.start('BaseScene');
      }
      return;
    }

    // ⬅️ hit-stop แบบ soft (ไม่ pause physics world — บอสยังเดินได้)
    const isHitStopped = this.time.now < this.hitStopUntil;

    const speed = 160;
    let vx = 0;
    let vy = 0;

    if (!isHitStopped && !this.isDashing && !this.isStunned) {
      if (this.keyA.isDown) vx -= 1;
      if (this.keyD.isDown) vx += 1;
      if (this.keyW.isDown) vy -= 1;
      if (this.keyS.isDown) vy += 1;

      if (vx !== 0 || vy !== 0) {
        const len = Math.hypot(vx, vy);
        vx /= len;
        vy /= len;
        this.facing.set(vx, vy);
        if (vx !== 0) this.player.setFlipX(vx < 0);
      }
      this.player.setVelocity(vx * speed, vy * speed);
    } else if (isHitStopped) {
      // ตอน hit-stop ให้หยุดแค่ player (velocity = 0) แต่ไม่ pause physics
      this.player.setVelocity(0);
    }

    // ---------- สลับ texture ผู้เล่น (เดิน / ยืน / โจมตี) ----------
    if (!this.isAttacking) {
      if (vx !== 0 || vy !== 0 || this.isDashing) {
        // เดิน: สลับ walk1 <-> walk2 ทุกๆ WALK_FRAME_MS
        this.walkFrameTimer += delta;
        if (this.walkFrameTimer >= WALK_FRAME_MS) {
          this.walkFrameTimer = 0;
          this.walkFrameIndex = 1 - this.walkFrameIndex;
          const walkTex = this.walkFrameIndex === 0 ? 'hero_clay_walk1' : 'hero_clay_walk2';
          this.setPlayerTexture(walkTex);
        }
      } else {
        // ยืนนิ่ง
        this.walkFrameTimer = 0;
        this.setPlayerTexture('hero_clay_idle');
      }
    }

    if (
      this.keyDash &&
      Phaser.Input.Keyboard.JustDown(this.keyDash) &&
      !this.isDashing &&
      !this.isStunned &&
      this.time.now - this.lastDashAt >= DASH_COOLDOWN_MS
    ) {
      this.performDash();
    }

    if (this.keyAttack && Phaser.Input.Keyboard.JustDown(this.keyAttack) && !this.isAttacking && !this.isStunned) {
      this.performAttack();
    }

    // บอสอัปเดตเสมอ (แม้ตอน hit-stop ก็ยังเดินได้ เพราะเราไม่ pause physics)
    this.monster.update(delta);

    if (this.isAttacking && !this.hitThisSwing && this.monster.isAlive && this.swingHitsMonster()) {
      this.applyPlayerHit();
    }

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

    const shadowOffset = this.useClay ? this.player.displayHeight / 2 - 6 : 14;
    this.playerShadow.setPosition(this.player.x, this.player.y + shadowOffset);
  }

  // ---------- ตัวช่วยสลับ texture (ไม่เรียกซ้ำถ้าเป็น texture เดิม) ----------
  private setPlayerTexture(key: string) {
    if (!this.useClay) return; // ใช้ hero.png ตัวเดิม ไม่สลับ
    if (this.currentTexture === key) return; // อยู่ texture เดิมแล้ว ข้าม
    if (!this.textures.exists(key)) return; // ไม่มีไฟล์นี้ (กัน crash)
    
    this.player.setTexture(key);
    this.currentTexture = key;
    // รักษาสเกลและ flip หลังสลับ texture
    this.player.setScale(CLAY_SCALE);
  }

  private performDash() {
    this.isDashing = true;
    this.lastDashAt = this.time.now;
    sfx.dash();

    const dashSpeed = 400;
    let dx = (this.keyD.isDown ? 1 : 0) - (this.keyA.isDown ? 1 : 0);
    let dy = (this.keyS.isDown ? 1 : 0) - (this.keyW.isDown ? 1 : 0);
    if (dx === 0 && dy === 0) {
      dx = this.facing.x;
      dy = this.facing.y;
    }
    const len = Math.hypot(dx, dy) || 1;
    this.player.setVelocity((dx / len) * dashSpeed, (dy / len) * dashSpeed);
    this.player.setAlpha(0.6);

    this.time.addEvent({
      delay: 30,
      repeat: 5,
      callback: () => this.spawnClayAfterimage()
    });

    this.time.delayedCall(200, () => {
      this.isDashing = false;
      if (!this.isDead) {
        this.player.setAlpha(1);
        this.player.setVelocity(0);
      }
    });
  }

  private getAttackDir(): Phaser.Math.Vector2 {
    const dir = this.facing.clone();
    if (!this.monster.isAlive) return dir;

    const m = this.monster.sprite;
    const toBoss = new Phaser.Math.Vector2(m.x - this.player.x, m.y - this.player.y);
    const dist = toBoss.length();
    if (dist > 0 && dist < AIM_ASSIST_RANGE) {
      toBoss.normalize();
      if (dir.dot(toBoss) > Math.cos(Phaser.Math.DegToRad(AIM_ASSIST_ANGLE))) {
        return toBoss;
      }
    }
    return dir;
  }

  private performAttack() {
    this.isAttacking = true;
    this.hitThisSwing = false;
    sfx.swing();

    const weaponRange = this.equipment.getEffectValue('weapon');
    const dir = this.getAttackDir();

    this.swingOrigin.set(this.player.x, this.player.y);
    this.swingDir.copy(dir);
    this.swingRange = weaponRange;
    if (Math.abs(dir.x) > 0.3) this.player.setFlipX(dir.x < 0);

    // ⬅️ เปลี่ยนเป็น texture โจมตี
    this.setPlayerTexture('hero_clay_attack');

    const wLv = this.equipment.getLevel('weapon');
    spawnThrustDir(this, this.player.x, this.player.y, dir.x, dir.y, weaponRange, wLv);
    this.cameras.main.shake(100, 0.003);

    this.time.delayedCall(200, () => {
      this.isAttacking = false;
      // กลับไปท่ายืนหลังโจมตีเสร็จ
      this.setPlayerTexture('hero_clay_idle');
    });
  }

  private swingHitsMonster(): boolean {
    const m = this.monster.sprite;
    const reach = m.displayWidth * 0.4 + 14;
    let t =
      (m.x - this.swingOrigin.x) * this.swingDir.x +
      (m.y - this.swingOrigin.y) * this.swingDir.y;
    t = Phaser.Math.Clamp(t, 0, this.swingRange);
    const px = this.swingOrigin.x + this.swingDir.x * t;
    const py = this.swingOrigin.y + this.swingDir.y * t;
    return Phaser.Math.Distance.Between(px, py, m.x, m.y) <= reach;
  }

  private applyPlayerHit() {
    this.hitThisSwing = true;
    sfx.hit();
    this.monster.takeDamage(PLAYER_ATTACK_DAMAGE);
    this.bossHud.update(this.monster.hp);

    const wLv = this.equipment.getLevel('weapon');
    const m = this.monster.sprite;

    if (wLv >= 2) {
      burst(this, m.x, m.y, 0x9de7ff, 8, 70, 5);
    }
    if (wLv >= 3) {
      ringEffect(this, m.x, m.y, 60, 0xffd54a, 280);
      burst(this, m.x, m.y, 0xffd54a, 10, 90, 6);
    }

    this.cameras.main.shake(150, 0.01 + (wLv - 1) * 0.005);
    this.hitStop(55 + (wLv - 1) * 15);
  }

  // ⬅️ hit-stop แบบ soft: ใช้แค่ flag ไม่ pause physics world
  private hitStop(ms: number) {
    this.hitStopUntil = Math.max(this.hitStopUntil, this.time.now + ms);
    // ไม่เรียก this.physics.world.pause() อีกต่อไป
  }

  private damagePlayer(player: any, amount: number, fromX: number, fromY: number) {
    if (this.isDead || this.isVictory || this.isInvincible || this.isDashing) return;

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
    this.time.delayedCall(100, () => player.clearTint());
    this.cameras.main.shake(200, 0.015);
    this.cameras.main.flash(120, 255, 0, 0);
    showDamage(this, player.x, player.y, '-' + amount, '#ff5555');
    burst(this, player.x, player.y, 0xff3333, 8, 36, 5);

    if (this.monster.isAlive) {
      const reflect = this.equipment.getEffectValue('armor');
      if (reflect > 0) {
        this.monster.takeDamage(reflect);
        this.bossHud.update(this.monster.hp);
      }
    }

    if (this.playerHP <= 0 && !this.isVictory) {
      this.gameOver();
      return;
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

  private gameOver() {
    this.isDead = true;
    this.player.setTint(0x555555);
    this.player.setAlpha(1);
    burst(this, this.player.x, this.player.y, 0xff3333, 16, 70, 7);
    showEndScreen(this, 'GAME OVER', '#ff4444', 'กด R เพื่อกลับฐาน');
  }

  private onMonsterDeath() {
    this.player.setAlpha(1);
    this.bossHud.update(0);
    sfx.bossDie();
    this.hitStop(180);
    this.cameras.main.shake(300, 0.02);

    const heal = this.equipment.getEffectValue('helmet');
    if (heal > 0 && this.playerHP < this.maxPlayerHP) {
      const before = this.playerHP;
      this.playerHP = Math.min(this.maxPlayerHP, this.playerHP + heal);
      const gained = this.playerHP - before;
      if (gained > 0) {
        this.hud.update(this.playerHP);
        showDamage(this, this.player.x, this.player.y - 20, '+' + gained, '#66ff88');
      }
    }

    this.lootBox = new LootBox(this, this.monster.sprite.x, this.monster.sprite.y);
    if (this.bossCollider) this.bossCollider.destroy();
  }

  private spawnClayAfterimage() {
    // ใช้ texture เดียวกับที่กำลังแสดงอยู่
    const tex = this.useClay ? this.currentTexture : 'hero';
    const ghost = this.add.sprite(this.player.x, this.player.y, tex);
    ghost.setScale(this.player.scaleX, this.player.scaleY);
    ghost.setFlipX(this.player.flipX);
    ghost.setTint(0x66ccff);
    ghost.setAlpha(0.5);
    ghost.setDepth(DEPTH.AFTERIMAGE);
    this.tweens.add({
      targets: ghost,
      alpha: 0,
      duration: 250,
      onComplete: () => ghost.destroy()
    });
  }

  private showGearNotice() {
    const wLv = this.equipment.getLevel('weapon');
    const aLv = this.equipment.getLevel('armor');
    const hLv = this.equipment.getLevel('helmet');
    const label = `ATK Lv.${wLv}   ·   DEF Lv.${aLv}   ·   HP+ Lv.${hLv}`;

    const notice = this.add.text(GAME_WIDTH / 2, 60, label, {
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
      delay: 2200,
      duration: 500,
      onComplete: () => notice.destroy()
    });
  }
}