import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, WALL_THICKNESS, SPRITE_SCALE, DEPTH, PLAYER_ATTACK_DAMAGE } from '../config';
import { showDamage, burst, spawnThrust, spawnAfterimage, makeVignette } from '../systems/effects';
import { PlayerHUD } from '../ui/PlayerHUD';
import { BossHUD } from '../ui/BossHUD';
import { showEndScreen } from '../ui/GameOverScreen';
import { Monster } from '../entities/Monster';
import { MONSTERS, pickRandomMonsterId } from '../data/monsters';
import { EquipmentSystem } from '../systems/EquipmentSystem';
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

  private attackHitbox: any;
  private isAttacking: boolean = false;
  private hitThisSwing: boolean = false;
  private isDashing: boolean = false;

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
  private hitCollider: any;
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
    this.equipment = new EquipmentSystem();
    this.isAttacking = false;
    this.hitThisSwing = false;
    this.isDashing = false;
    this.isInvincible = false;
    this.isStunned = false;
    this.isDead = false;
    this.isVictory = false;

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

    // สร้างบอส
    const def = MONSTERS[pickRandomMonsterId()];
    this.monster = new Monster(this, def, 600, 300, {
      getTargets: () => (this.isDead ? [] : [this.player]),
      onHitTarget: (target, damage, fromX, fromY) => this.damagePlayer(target, damage, fromX, fromY),
      onDeath: () => this.onMonsterDeath()
    });
    this.bossHud = new BossHUD(this, def.name, def.hp);

    // Hitbox
    this.attackHitbox = this.add.rectangle(0, 0, 40, 40, 0x00ff00, 0.5);
    this.physics.add.existing(this.attackHitbox, false);
    this.attackHitbox.setVisible(false);

    // Collider
    this.hitCollider = this.physics.add.overlap(this.attackHitbox, this.monster.sprite, this.handleHit, undefined, this);
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

    if (this.isDead) {
      if (this.keyRestart && Phaser.Input.Keyboard.JustDown(this.keyRestart)) {
        this.scene.restart();
      }
      return;
    }
    if (this.isVictory) {
      if (this.keyRestart && Phaser.Input.Keyboard.JustDown(this.keyRestart)) {
        this.scene.restart();
      }
      return;
    }

    const speed = 160;

    if (!this.isDashing && !this.isStunned) {
      this.player.setVelocity(0);

      if (this.keyA.isDown) {
        this.player.setVelocityX(-speed);
        this.player.setFlipX(true);
      } else if (this.keyD.isDown) {
        this.player.setVelocityX(speed);
        this.player.setFlipX(false);
      }

      if (this.keyW.isDown) {
        this.player.setVelocityY(-speed);
      } else if (this.keyS.isDown) {
        this.player.setVelocityY(speed);
      }
    }

    if (this.keyDash && Phaser.Input.Keyboard.JustDown(this.keyDash) && !this.isDashing && !this.isStunned) {
      this.performDash();
    }

    if (this.keyAttack && Phaser.Input.Keyboard.JustDown(this.keyAttack) && !this.isAttacking && !this.isStunned) {
      this.performAttack();
    }

    this.monster.update(delta);

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
            huntSession.addItem(loot);        // เข้ากระเป๋า (จำข้ามรอบ)
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
    const dashSpeed = 400;
    const direction = this.player.flipX ? -1 : 1;
    this.player.setVelocityX(dashSpeed * direction);
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

  private performAttack() {
    this.isAttacking = true;
    this.hitThisSwing = false;

    const weaponRange = this.equipment.getEffectValue('weapon');
    const hitboxHeight = 26;
    const direction = this.player.flipX ? -1 : 1;
    const centerOffset = weaponRange / 2;

    this.attackHitbox.setSize(weaponRange, hitboxHeight);
    if (this.attackHitbox.body) {
      this.attackHitbox.body.setSize(weaponRange, hitboxHeight);
    }
    this.attackHitbox.setPosition(
      this.player.x + direction * centerOffset,
      this.player.y
    );

    spawnThrust(this, this.player.x, this.player.y, this.player.flipX, weaponRange);
    this.cameras.main.shake(100, 0.003);

    this.time.delayedCall(200, () => {
      this.isAttacking = false;
    });
  }

  private handleHit(_hitbox: any, _target: any) {
    if (!this.isAttacking || this.hitThisSwing) return;
    if (this.isDead || this.isVictory || !this.monster.isAlive) return;

    this.hitThisSwing = true;
    this.monster.takeDamage(PLAYER_ATTACK_DAMAGE);
    this.bossHud.update(this.monster.hp);
    this.cameras.main.shake(150, 0.01);
  }

  private damagePlayer(player: any, amount: number, fromX: number, fromY: number) {
    if (this.isDead || this.isVictory || this.isInvincible || this.isDashing) return;

    this.playerHP = Math.max(0, this.playerHP - amount);
    this.hud.update(this.playerHP);

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

    if (this.hitCollider) this.hitCollider.destroy();
    if (this.bossCollider) this.bossCollider.destroy();
  }
}