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
import { showDamage, burst, spawnThrustDir, spawnAfterimage, makeVignette } from '../systems/effects';
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

  // ---------- ทิศทาง / การแทง / hit-stop ----------
  private facing = new Phaser.Math.Vector2(1, 0);   // ทิศที่ตัวละครหันอยู่
  private swingOrigin = new Phaser.Math.Vector2();  // จุดที่เริ่มแทงครั้งล่าสุด
  private swingDir = new Phaser.Math.Vector2(1, 0); // ทิศที่แทงครั้งล่าสุด
  private swingRange: number = 0;
  private lastDashAt: number = -9999;
  private hitStopUntil: number = 0;

  private playerHP: number = 5;
  private maxPlayerHP: number = 5;
  private isInvincible: boolean = false;
  private isStunned: boolean = false;
  private isDead: boolean = false;
  private isVictory: boolean = false;
  private hud!: PlayerHUD;
  private playerShadow: any;

  private monster!: Monster;
  private bossHud!: BossHUD;
  private bossCollider: any;

  // ---------- ระบบเก็บของ (กระเป๋า) ----------
  private lootBox: LootBox | null = null;
  private droppedItem: DroppedItem | null = null;
  private exitPortal: ExitPortal | null = null;
  private huntLoot: LootDef[] = [];   // ของที่เก็บได้ในรอบนี้
  private huntStartTime: number = 0;  // เวลาเริ่มล่า

  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    this.load.image('floor', 'assets/floor.png');
    this.load.image('wall', 'assets/wall.png');
    this.load.image('hero', 'assets/hero.png');
    this.load.image('slime', 'assets/slime.png');
    // Asset กล่องไอเทม + ไอเทม (ถ้าไฟล์หาย เกมไม่พัง — จะใช้สี่เหลี่ยมแทน)
    this.load.image('loot_box_closed', 'assets/loot_box_closed.png');
    this.load.image('loot_box_open', 'assets/loot_box_open.png');
    this.load.image('green_potion', 'assets/green_potion.png');
  }

  create() {
    // รีเซ็ตสถานะทุกครั้งที่เริ่มใหม่
    this.playerHP = this.maxPlayerHP;
    this.equipment = playerEquipment; // ตัวเดียวกับที่อัปเกรดไว้ที่ฐาน
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

    // รีเซ็ตระบบเก็บของ
    this.lootBox = null;
    this.droppedItem = null;
    this.exitPortal = null;
    this.huntLoot = [];
    this.huntStartTime = this.time.now; // เริ่มนับเวลาการล่า

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
    this.player = this.physics.add.sprite(400, 300, 'hero') as any;
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(DEPTH.PLAYER);
    this.player.setScale(SPRITE_SCALE);

    // เงาใต้ผู้เล่น
    this.playerShadow = this.add.ellipse(400, 314, 26, 10, 0x000000, 0.35).setDepth(DEPTH.PLAYER_SHADOW);

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

    // Collider (ตัวผู้เล่นชนตัวบอส) — การตีใช้การคำนวณเส้นหอกแทน ไม่ใช้ hitbox แล้ว
    this.bossCollider = this.physics.add.collider(this.player, this.monster.sprite);

    // UI
    this.hud = new PlayerHUD(this, this.maxPlayerHP);

    // กล้อง
    this.cameras.main.setBounds(0, 0, W, H);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // Focus
    this.sys.game.canvas.addEventListener('click', () => {
      this.sys.game.canvas.focus();
    });
  }

  update(_time: number, delta: number) {
    if (!this.player) return;

    // กด M สลับเปิด/ปิดเสียง
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

    // hit-stop: ช่วงภาพหยุดแวบหนึ่ง (เกมหยุดนิ่ง แต่เอฟเฟกต์ยังเล่นต่อ)
    if (this.time.now < this.hitStopUntil) return;
    if (this.physics.world.isPaused) this.physics.world.resume();

    const speed = 160;

    if (!this.isDashing && !this.isStunned) {
      let vx = 0;
      let vy = 0;
      if (this.keyA.isDown) vx -= 1;
      if (this.keyD.isDown) vx += 1;
      if (this.keyW.isDown) vy -= 1;
      if (this.keyS.isDown) vy += 1;

      if (vx !== 0 || vy !== 0) {
        const len = Math.hypot(vx, vy); // ทำให้เดินทแยงไม่เร็วกว่าเดินตรง
        vx /= len;
        vy /= len;
        this.facing.set(vx, vy);
        if (vx !== 0) this.player.setFlipX(vx < 0);
      }
      this.player.setVelocity(vx * speed, vy * speed);
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

    this.monster.update(delta);

    // ตรวจว่าหอกแทงโดนบอสไหม (ตลอด 200ms ที่กำลังแทง)
    if (this.isAttacking && !this.hitThisSwing && this.monster.isAlive && this.swingHitsMonster()) {
      this.applyPlayerHit();
    }

    // ---------- ระบบเก็บของ (3 ขั้นตอน: กล่อง -> ไอเทม -> ประตู) ----------
    const justPressedE = Phaser.Input.Keyboard.JustDown(this.keyInteract);

    // ขั้นที่ 1: กล่องไอเทม — กด E เพื่อเปิด แล้วคายไอเทม
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
            const rolledLoot = rollLoot(); // สุ่มของตามความหายาก
            this.droppedItem = new DroppedItem(this, boxX, boxY, rolledLoot);
            this.lootBox = null; // กล่องเปิดเสร็จแล้ว
          });
        }
      }
    }

    // ขั้นที่ 2: ไอเทมบนพื้น — กด E เพื่อเก็บเข้ากระเป๋า
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
            huntSession.addItem(loot);        // เข้ากระเป๋า (จำข้ามรอบ)
            saveGame();
            this.huntLoot.push(loot);         // บันทึกของรอบนี้
            this.droppedItem = null;
            showDamage(this, this.player.x, this.player.y - 40, `+ ${loot.name}`, loot.color, 1500);
            // เก็บครบแล้ว -> เปิดประตูทางออกกลางจอ
            this.exitPortal = new ExitPortal(this, GAME_WIDTH / 2, GAME_HEIGHT / 2);
          });
        }
      }
    }

    // ขั้นที่ 3: ประตูทางออก — กด E เพื่อกลับฐาน (สรุปผล)
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

    this.playerShadow.setPosition(this.player.x, this.player.y + 14);
  }

  private performDash() {
    this.isDashing = true;
    this.lastDashAt = this.time.now;
    sfx.dash();

    const dashSpeed = 400;
    // dash ไปทางที่กำลังกดเดิน ถ้าไม่ได้กดอะไรให้ไปทางที่หันอยู่
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
      callback: () => spawnAfterimage(this, this.player)
    });

    this.time.delayedCall(200, () => {
      this.isDashing = false;
      if (!this.isDead) {
        this.player.setAlpha(1);
        this.player.setVelocity(0);
      }
    });
  }

  // ทิศที่จะแทง: ปกติคือทิศที่หันอยู่ แต่ถ้าบอสอยู่ในกรวยหน้าตัวจะล็อกเข้าหาบอส (aim assist)
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

    // จำจุดและทิศที่แทง ไว้ให้ swingHitsMonster() ใช้ตรวจ
    this.swingOrigin.set(this.player.x, this.player.y);
    this.swingDir.copy(dir);
    this.swingRange = weaponRange;
    if (Math.abs(dir.x) > 0.3) this.player.setFlipX(dir.x < 0);

    spawnThrustDir(this, this.player.x, this.player.y, dir.x, dir.y, weaponRange);
    this.cameras.main.shake(100, 0.003);

    this.time.delayedCall(200, () => {
      this.isAttacking = false;
    });
  }

  // เช็คว่าเส้นหอก (จากจุดแทง ยาวตามระยะอาวุธ) แตะตัวบอสไหม — ใช้ได้ทุกมุม
  private swingHitsMonster(): boolean {
    const m = this.monster.sprite;
    const reach = m.displayWidth * 0.4 + 14; // รัศมีตัวบอส + ความหนาหอก (ปรับเลข 14 ให้ตีง่าย/ยากขึ้น)
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
    this.cameras.main.shake(150, 0.01);
    this.hitStop(55);
  }

  // หยุดเกมชั่วคราว (ms) — เอาค่าที่นานกว่าเสมอ
  private hitStop(ms: number) {
    this.hitStopUntil = Math.max(this.hitStopUntil, this.time.now + ms);
    this.physics.world.pause();
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

    // Thorn Armor
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
    this.physics.pause();
    this.player.setTint(0x555555);
    this.player.setAlpha(1);
    burst(this, this.player.x, this.player.y, 0xff3333, 16, 70, 7);
    showEndScreen(this, 'GAME OVER', '#ff4444', 'กด R เพื่อเล่นใหม่');
  }

  private onMonsterDeath() {
    this.player.setAlpha(1);
    this.bossHud.update(0);
    sfx.bossDie();
    this.hitStop(180);
    this.cameras.main.shake(300, 0.02);

    // Hunter Helmet
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

    // Item Drop
    this.lootBox = new LootBox(this, this.monster.sprite.x, this.monster.sprite.y);

    if (this.bossCollider) this.bossCollider.destroy();
  }
}