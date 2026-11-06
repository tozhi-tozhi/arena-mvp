import Phaser from 'phaser';

class GameScene extends Phaser.Scene {
  private player: any;

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
  private isInvincible: boolean = false; // อมตะชั่วคราวหลังโดนตี
  private isStunned: boolean = false;    // ถูกกระเด็น ควบคุมไม่ได้แป๊บเดียว
  private isDead: boolean = false;
  private playerHpBar: any;
  private playerHpLabel: any;

  // ศัตรู
  private enemy: any;
  private enemyHP: number = 3;
  private maxEnemyHP: number = 3;
  private hpBar: any;
  private hitCollider: any;
  private touchCollider: any;

  private playerShadow: any;
  private enemyShadow: any;

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
    this.enemyHP = this.maxEnemyHP;
    this.isAttacking = false;
    this.hitThisSwing = false;
    this.isDashing = false;
    this.isInvincible = false;
    this.isStunned = false;
    this.isDead = false;

    // 1. สร้างพื้นหลัง
    this.add.tileSprite(0, 0, 800, 600, 'floor').setOrigin(0).setTileScale(2).setDepth(0);

    // กำแพงรอบห้อง (หนา 32px)
    const t = 32;
    this.add.tileSprite(0, 0, 800, t, 'wall').setOrigin(0).setTileScale(2).setDepth(1);
    this.add.tileSprite(0, 600 - t, 800, t, 'wall').setOrigin(0).setTileScale(2).setDepth(1);
    this.add.tileSprite(0, 0, t, 600, 'wall').setOrigin(0).setTileScale(2).setDepth(1);
    this.add.tileSprite(800 - t, 0, t, 600, 'wall').setOrigin(0).setTileScale(2).setDepth(1);

    this.physics.world.setBounds(t, t, 800 - t * 2, 600 - t * 2);

    // เงามืดขอบจอ (vignette)
    this.makeVignette();

    // เงาใต้ตัวละคร
    this.playerShadow = this.add.ellipse(400, 314, 26, 10, 0x000000, 0.35).setDepth(4);
    this.enemyShadow = this.add.ellipse(600, 312, 26, 10, 0x000000, 0.35).setDepth(3);

    // 2. สร้างผู้เล่น
    this.player = this.physics.add.sprite(400, 300, 'hero') as any;
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);
    this.player.setScale(2);

    // 3. ตั้งค่า Input
    const keyboard = this.input.keyboard as any;
    this.keyW = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyDash = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.keyAttack = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyRestart = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);

    // 4. สร้างศัตรู
    this.enemy = this.physics.add.sprite(600, 300, 'slime') as any;
    this.enemy.setCollideWorldBounds(true);
    this.enemy.setDepth(5);
    this.enemy.setScale(2);

    // 5. สร้าง HP Bar ศัตรู
    this.hpBar = this.add.graphics();
    this.hpBar.setDepth(20);
    this.updateEnemyHPBar();

    // 6. Attack Hitbox (มองไม่เห็น ใช้แค่ตรวจการชน)
    this.attackHitbox = this.add.rectangle(0, 0, 40, 40, 0x00ff00, 0.5);
    this.physics.add.existing(this.attackHitbox, false);
    this.attackHitbox.setVisible(false);

    // 7. ตั้งค่าการชน (ฟันโดนศัตรู / ศัตรูชนผู้เล่น)
    this.registerEnemyOverlaps();

    // 8. UI เลือดผู้เล่น
    this.createPlayerHUD();

    // 9. ตั้งค่ากล้อง
    this.cameras.main.setBounds(0, 0, 800, 600);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // 10. บังคับ Focus ที่ Canvas เมื่อคลิก
    this.sys.game.canvas.addEventListener('click', () => {
      this.sys.game.canvas.focus();
    });
  }

  update(time: number, delta: number) {
    if (!this.player) return;

    // ตายแล้ว: รอกด R เพื่อเริ่มใหม่
    if (this.isDead) {
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

    // Enemy AI
    if (this.enemy && this.enemy.active && this.enemyHP > 0) {
      this.physics.moveToObject(this.enemy, this.player, 60);
      if (this.enemy.x < this.player.x) this.enemy.setFlipX(false);
      else this.enemy.setFlipX(true);
      this.updateEnemyHPBar();
    }

    // เงาตามตัวละคร
    this.playerShadow.setPosition(this.player.x, this.player.y + 14);
    if (this.enemy && this.enemy.active) {
      this.enemyShadow.setVisible(true);
      this.enemyShadow.setPosition(this.enemy.x, this.enemy.y + 12);
    } else {
      this.enemyShadow.setVisible(false);
    }
  }

  // ลงทะเบียนการชนของศัตรูตัวปัจจุบัน (เรียกตอนสร้าง/เกิดใหม่)
  private registerEnemyOverlaps() {
    if (this.hitCollider) this.hitCollider.destroy();
    if (this.touchCollider) this.touchCollider.destroy();
    this.hitCollider = this.physics.add.overlap(this.attackHitbox, this.enemy, this.handleHit, undefined, this);
    this.touchCollider = this.physics.add.overlap(this.player, this.enemy, this.handlePlayerHit, undefined, this);
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
      callback: () => this.spawnAfterimage()
    });

    this.time.delayedCall(200, () => {
      this.isDashing = false;
      if (!this.isDead) {
        this.player.setAlpha(1);
        this.player.setVelocity(0);
      }
    });
  }

  private spawnAfterimage() {
    const ghost = this.add.image(this.player.x, this.player.y, 'hero');
    ghost.setScale(2);
    ghost.setFlipX(this.player.flipX);
    ghost.setTint(0x66ccff);
    ghost.setAlpha(0.5);
    ghost.setDepth(9);
    this.tweens.add({
      targets: ghost,
      alpha: 0,
      duration: 250,
      onComplete: () => ghost.destroy()
    });
  }

  private performAttack() {
    this.isAttacking = true;
    this.hitThisSwing = false;
    const offset = this.player.flipX ? -36 : 36;
    this.attackHitbox.setPosition(this.player.x + offset, this.player.y);

    this.spawnSlash();
    this.cameras.main.shake(100, 0.003);

    this.time.delayedCall(200, () => {
      this.isAttacking = false;
    });
  }

  private spawnSlash() {
    const facingLeft = this.player.flipX;
    const g = this.add.graphics();
    g.setPosition(this.player.x, this.player.y);
    g.setDepth(15);
    g.lineStyle(5, 0xffffff, 1);
    g.beginPath();
    const a0 = facingLeft ? 120 : -60;
    const a1 = facingLeft ? 240 : 60;
    g.arc(0, 0, 40, Phaser.Math.DegToRad(a0), Phaser.Math.DegToRad(a1), false);
    g.strokePath();
    this.tweens.add({
      targets: g,
      alpha: 0,
      scaleX: 1.4,
      scaleY: 1.4,
      duration: 180,
      onComplete: () => g.destroy()
    });
  }

  // ผู้เล่นฟันโดนศัตรู
  private handleHit(hitbox: any, target: any) {
    if (!this.isAttacking || this.hitThisSwing) return;
    if (!target.active || this.enemyHP <= 0) return;

    this.hitThisSwing = true;
    this.enemyHP--;
    this.updateEnemyHPBar();

    const knockDir = this.player.flipX ? -1 : 1;
    target.setVelocityX(knockDir * 200);

    target.setTint(0xffffff);
    this.time.delayedCall(100, () => target.clearTint());
    this.tweens.add({
      targets: target,
      scaleX: 2.5,
      scaleY: 1.6,
      duration: 60,
      yoyo: true
    });

    this.showDamage(target.x, target.y, '1', '#ffe066');
    this.burst(target.x, target.y, 0xffffff, 6, 30, 4);
    this.cameras.main.shake(150, 0.01);

    if (this.enemyHP <= 0) {
      this.burst(target.x, target.y, 0x66dd66, 14, 60, 7);
      target.destroy();
      this.hpBar.clear();
      this.time.delayedCall(2000, () => this.respawnEnemy());
    }
  }

  // ศัตรูชนผู้เล่น -> ผู้เล่นเสียเลือด
  private handlePlayerHit(player: any, enemy: any) {
    if (this.isDead || this.isInvincible || this.isDashing) return;
    if (!enemy.active || this.enemyHP <= 0) return;

    this.playerHP--;
    this.updatePlayerHUD();

    // กระเด็นออกจากศัตรู
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    this.isStunned = true;
    player.setVelocity((dx / len) * 300, (dy / len) * 300);
    this.time.delayedCall(150, () => {
      this.isStunned = false;
      if (!this.isDead) player.setVelocity(0);
    });

    // เอฟเฟกต์โดนตี: กะพริบแดง + จอแดง + สั่น + เลขดาเมจแดง
    player.setTintFill(0xff3333);
    this.time.delayedCall(100, () => player.clearTint());
    this.cameras.main.shake(200, 0.015);
    this.cameras.main.flash(120, 255, 0, 0);
    this.showDamage(player.x, player.y, '-1', '#ff5555');
    this.burst(player.x, player.y, 0xff3333, 8, 36, 5);

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
    this.burst(this.player.x, this.player.y, 0xff3333, 16, 70, 7);

    const overlay = this.add.rectangle(0, 0, 800, 600, 0x000000, 0.6)
      .setOrigin(0).setDepth(120).setScrollFactor(0);
    const title = this.add.text(400, 260, 'GAME OVER', {
      fontFamily: 'monospace',
      fontSize: '56px',
      fontStyle: 'bold',
      color: '#ff4444',
      stroke: '#000000',
      strokeThickness: 8
    }).setOrigin(0.5).setDepth(121).setScrollFactor(0);
    const hint = this.add.text(400, 330, 'กด R เพื่อเล่นใหม่', {
      fontFamily: '"Noto Sans Thai", sans-serif',
      fontSize: '24px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(121).setScrollFactor(0);

    overlay.setAlpha(0);
    title.setAlpha(0);
    hint.setAlpha(0);
    this.tweens.add({ targets: overlay, alpha: 0.6, duration: 400 });
    this.tweens.add({ targets: [title, hint], alpha: 1, duration: 400, delay: 200 });
  }

  // UI เลือดผู้เล่น: ช่องสี่เหลี่ยม 5 ช่อง ติดจอมุมซ้ายบน
  private createPlayerHUD() {
    this.playerHpLabel = this.add.text(44, 16, 'HP', {
      fontFamily: 'monospace',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0, 0.5).setDepth(110).setScrollFactor(0);

    this.playerHpBar = this.add.graphics();
    this.playerHpBar.setDepth(110);
    this.playerHpBar.setScrollFactor(0);
    this.updatePlayerHUD();
  }

  private updatePlayerHUD() {
    const g = this.playerHpBar;
    g.clear();
    const startX = 74;
    const y = 8;
    const segW = 28;
    const segH = 16;
    const gap = 4;

    // กรอบดำหลังช่องทั้งหมด
    const totalW = this.maxPlayerHP * segW + (this.maxPlayerHP - 1) * gap;
    g.fillStyle(0x000000, 0.8);
    g.fillRect(startX - 3, y - 3, totalW + 6, segH + 6);

    for (let i = 0; i < this.maxPlayerHP; i++) {
      const x = startX + i * (segW + gap);
      if (i < this.playerHP) {
        g.fillStyle(0xe74c3c);           // ช่องเต็ม (แดง)
        g.fillRect(x, y, segW, segH);
        g.fillStyle(0xff8a80);           // แถบสว่างด้านบน ให้ดูมีมิติ
        g.fillRect(x, y, segW, 4);
      } else {
        g.fillStyle(0x3a1a1a);           // ช่องว่าง
        g.fillRect(x, y, segW, segH);
      }
    }
  }

  // ตัวเลขดาเมจลอยขึ้นแล้วจาง
  private showDamage(x: number, y: number, text: string, color: string) {
    const label = this.add.text(x, y - 20, text, {
      fontFamily: 'monospace',
      fontSize: '22px',
      fontStyle: 'bold',
      color: color,
      stroke: '#000000',
      strokeThickness: 4
    });
    label.setOrigin(0.5);
    label.setDepth(30);
    this.tweens.add({
      targets: label,
      y: y - 55,
      alpha: 0,
      duration: 600,
      onComplete: () => label.destroy()
    });
  }

  // เศษกระจาย
  private burst(x: number, y: number, color: number, count: number, dist: number, size: number) {
    for (let i = 0; i < count; i++) {
      const p = this.add.rectangle(x, y, size, size, color);
      p.setDepth(25);
      const ang = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const d = Phaser.Math.FloatBetween(dist * 0.5, dist);
      this.tweens.add({
        targets: p,
        x: x + Math.cos(ang) * d,
        y: y + Math.sin(ang) * d,
        alpha: 0,
        duration: Phaser.Math.Between(250, 450),
        onComplete: () => p.destroy()
      });
    }
  }

  private updateEnemyHPBar() {
    this.hpBar.clear();
    const barWidth = 50;
    const barHeight = 6;
    const x = this.enemy.x - barWidth / 2;
    const y = this.enemy.y - 36;

    this.hpBar.fillStyle(0x330000);
    this.hpBar.fillRect(x, y, barWidth, barHeight);

    const hpPercent = Math.max(0, this.enemyHP / this.maxEnemyHP);
    this.hpBar.fillStyle(0x00ff00);
    this.hpBar.fillRect(x, y, barWidth * hpPercent, barHeight);
  }

  private respawnEnemy() {
    if (this.isDead) return;
    this.enemyHP = this.maxEnemyHP;
    this.enemy = this.physics.add.sprite(
      Phaser.Math.Between(100, 700),
      Phaser.Math.Between(100, 500),
      'slime'
    ) as any;
    this.enemy.setCollideWorldBounds(true);
    this.enemy.setDepth(5);
    this.enemy.setScale(2);

    this.registerEnemyOverlaps();
    this.updateEnemyHPBar();
  }

  private makeVignette() {
    const w = 800, h = 600;
    // ตอนกด R เริ่มใหม่ texture นี้มีอยู่แล้ว ไม่ต้องสร้างซ้ำ
    if (!this.textures.exists('vignette')) {
      const tex = this.textures.createCanvas('vignette', w, h) as any;
      const ctx = tex.getContext();
      const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.85);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.65)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      tex.refresh();
    }
    this.add.image(0, 0, 'vignette').setOrigin(0).setDepth(100).setScrollFactor(0);
  }
}

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#1a1a1a',
  parent: 'app',
  pixelArt: true,
  input: {
    keyboard: {
      target: window
    }
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 } as any,
      debug: false
    }
  },
  scene: [GameScene]
};

const game = new Phaser.Game(config);