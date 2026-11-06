import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, WALL_THICKNESS, SPRITE_SCALE, DEPTH, PLAYER_ATTACK_DAMAGE } from '../config';
import { showDamage, burst, spawnThrust, spawnAfterimage, makeVignette } from '../systems/effects';
import { PlayerHUD } from '../ui/PlayerHUD';
import { BossHUD } from '../ui/BossHUD';
import { showEndScreen } from '../ui/GameOverScreen';
import { Monster } from '../entities/Monster';
import { MONSTERS, pickRandomMonsterId } from '../data/monsters';
import { EquipmentSystem } from '../systems/EquipmentSystem';

export class GameScene extends Phaser.Scene {
  private player: any;
  private equipment!: EquipmentSystem;

  // ปุ่มควบคุม
  private keyW: any;
  private keyA: any;
  private keyS: any;
  private keyD: any;
  private keyDash: any;
  private keyAttack: any;
  private keyRestart: any;

  private attackHitbox: any;
  private isAttacking: boolean = false;
  private hitThisSwing: boolean = false;
  private isDashing: boolean = false;

  // สถานะผู้เล่น
  private playerHP: number = 5;
  private maxPlayerHP: number = 5;
  private isInvincible: boolean = false;
  private isStunned: boolean = false;
  private isDead: boolean = false;
  private isVictory: boolean = false;
  private hud!: PlayerHUD;
  private playerShadow: any;

  // มอนสเตอร์ (บอส)
  private monster!: Monster;
  private bossHud!: BossHUD;
  private hitCollider: any;
  private bossCollider: any;

  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    this.load.image('floor', 'assets/floor.png');
    this.load.image('wall', 'assets/wall.png');
    this.load.image('hero', 'assets/hero.png');
    this.load.image('slime', 'assets/slime.png');
  }

  create() {
    // รีเซ็ตสถานะทุกครั้งที่เริ่มใหม่ (จำเป็นตอนกด R เล่นใหม่)
    this.playerHP = this.maxPlayerHP;
    this.equipment = new EquipmentSystem();
    this.isAttacking = false;
    this.hitThisSwing = false;
    this.isDashing = false;
    this.isInvincible = false;
    this.isStunned = false;
    this.isDead = false;
    this.isVictory = false;

    // 1. พื้นและกำแพง
    const W = GAME_WIDTH;
    const H = GAME_HEIGHT;
    const t = WALL_THICKNESS;
    this.add.tileSprite(0, 0, W, H, 'floor').setOrigin(0).setTileScale(SPRITE_SCALE).setDepth(DEPTH.FLOOR);
    this.add.tileSprite(0, 0, W, t, 'wall').setOrigin(0).setTileScale(SPRITE_SCALE).setDepth(DEPTH.WALL);
    this.add.tileSprite(0, H - t, W, t, 'wall').setOrigin(0).setTileScale(SPRITE_SCALE).setDepth(DEPTH.WALL);
    this.add.tileSprite(0, 0, t, H, 'wall').setOrigin(0).setTileScale(SPRITE_SCALE).setDepth(DEPTH.WALL);
    this.add.tileSprite(W - t, 0, t, H, 'wall').setOrigin(0).setTileScale(SPRITE_SCALE).setDepth(DEPTH.WALL);

    this.physics.world.setBounds(t, t, W - t * 2, H - t * 2);

    // เงามืดขอบจอ
    makeVignette(this);

    // เงาใต้ผู้เล่น
    this.playerShadow = this.add.ellipse(400, 314, 26, 10, 0x000000, 0.35).setDepth(DEPTH.PLAYER_SHADOW);

    // 2. สร้างผู้เล่น
    this.player = this.physics.add.sprite(400, 300, 'hero') as any;
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(DEPTH.PLAYER);
    this.player.setScale(SPRITE_SCALE);

    // 3. ตั้งค่า Input
    const keyboard = this.input.keyboard as any;
    this.keyW = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyDash = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.keyAttack = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyRestart = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);

    // 4. สุ่มมอนที่จะเจอ (ผู้เล่นไม่รู้ล่วงหน้า) แล้วสร้างบอส
    const def = MONSTERS[pickRandomMonsterId()];
    this.monster = new Monster(this, def, 600, 300, {
      getTargets: () => (this.isDead ? [] : [this.player]),
      onHitTarget: (target, damage, fromX, fromY) => this.damagePlayer(target, damage, fromX, fromY),
      onDeath: () => this.onMonsterDeath()
    });
    this.bossHud = new BossHUD(this, def.name, def.hp);

    // 5. Attack Hitbox (มองไม่เห็น ใช้แค่ตรวจการชน)
    this.attackHitbox = this.add.rectangle(0, 0, 40, 40, 0x00ff00, 0.5);
    this.physics.add.existing(this.attackHitbox, false);
    this.attackHitbox.setVisible(false);

    // 6. ตั้งค่าการชน: ฟันโดนบอส + ผู้เล่นเดินทะลุบอสไม่ได้
    this.hitCollider = this.physics.add.overlap(this.attackHitbox, this.monster.sprite, this.handleHit, undefined, this);
    this.bossCollider = this.physics.add.collider(this.player, this.monster.sprite);

    // 7. UI เลือดผู้เล่น
    this.hud = new PlayerHUD(this, this.maxPlayerHP);

    // 8. กล้อง
    this.cameras.main.setBounds(0, 0, W, H);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // 9. บังคับ Focus ที่ Canvas เมื่อคลิก
    this.sys.game.canvas.addEventListener('click', () => {
      this.sys.game.canvas.focus();
    });
  }

  update(_time: number, delta: number) {
    if (!this.player) return;

    // จบการล่าแล้ว (แพ้หรือชนะ): รอกด R เพื่อเริ่มใหม่
    if (this.isDead || this.isVictory) {
      if (this.keyRestart && Phaser.Input.Keyboard.JustDown(this.keyRestart)) {
        this.scene.restart();
      }
      return;
    }

    const speed = 160;

    // ระหว่าง dash หรือถูกกระเด็น ไม่รีเซ็ตความเร็ว
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

    // Dash (Shift) — ระหว่างพุ่งเป็นอมตะ (i-frames)
    if (this.keyDash && Phaser.Input.Keyboard.JustDown(this.keyDash) && !this.isDashing && !this.isStunned) {
      this.performDash();
    }

    // Attack (Space)
    if (this.keyAttack && Phaser.Input.Keyboard.JustDown(this.keyAttack) && !this.isAttacking && !this.isStunned) {
      this.performAttack();
    }

    // บอสทำงานตามสถานะของมัน
    this.monster.update(delta);

    // เงาตามผู้เล่น
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

    // Weapon level controls spear reach. The hitbox starts at the player
    // and extends forward, instead of using the old short sword hitbox.
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

  // ผู้เล่นฟันโดนบอส (เอฟเฟกต์โดนตีของบอสอยู่ใน Monster.takeDamage)
  private handleHit(_hitbox: any, _target: any) {
    if (!this.isAttacking || this.hitThisSwing) return;
    if (this.isDead || this.isVictory || !this.monster.isAlive) return;

    this.hitThisSwing = true;
    this.monster.takeDamage(PLAYER_ATTACK_DAMAGE);
    this.bossHud.update(this.monster.hp);
    this.cameras.main.shake(150, 0.01);
  }

  // ผู้เล่นโดนท่าของบอส (บอสเรียกมาผ่าน hooks.onHitTarget)
  private damagePlayer(player: any, amount: number, fromX: number, fromY: number) {
    if (this.isDead || this.isVictory || this.isInvincible || this.isDashing) return;

    this.playerHP = Math.max(0, this.playerHP - amount);
    this.hud.update(this.playerHP);

    // กระเด็นออกจากจุดที่โดน
    const dx = player.x - fromX;
    const dy = player.y - fromY;
    const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    this.isStunned = true;
    player.setVelocity((dx / len) * 300, (dy / len) * 300);
    this.time.delayedCall(150, () => {
      this.isStunned = false;
      if (!this.isDead) player.setVelocity(0);
    });

    // เอฟเฟกต์โดนตี
    player.setTintFill(0xff3333);
    this.time.delayedCall(100, () => player.clearTint());
    this.cameras.main.shake(200, 0.015);
    this.cameras.main.flash(120, 255, 0, 0);
    showDamage(this, player.x, player.y, '-' + amount, '#ff5555');
    burst(this, player.x, player.y, 0xff3333, 8, 36, 5);

    if (this.playerHP <= 0) {
      this.gameOver();
      return;
    }

    // อมตะ 1 วินาที พร้อมกะพริบ
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

  // บอสตาย = ล่าสำเร็จ
  private onMonsterDeath() {
    this.isVictory = true;
    this.player.setVelocity(0);
    this.player.setAlpha(1);
    this.bossHud.update(0);
    if (this.hitCollider) this.hitCollider.destroy();
    if (this.bossCollider) this.bossCollider.destroy();

    this.time.delayedCall(1200, () => {
      showEndScreen(this, 'HUNT COMPLETE', '#ffd54a', 'กด R เพื่อล่าอีกครั้ง');
    });
  }
}