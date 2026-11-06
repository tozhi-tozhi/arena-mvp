import Phaser from 'phaser';

class GameScene extends Phaser.Scene {
  private player: any;
  
  // ปุ่มควบคุมแบบ WASD
  private keyW: any;
  private keyA: any;
  private keyS: any;
  private keyD: any;
  private keyDash: any;
  private keyAttack: any;

  private attackHitbox: any;
  private isAttacking: boolean = false;
  private enemy: any;
  private enemyHP: number = 3;
  private maxEnemyHP: number = 3;
  private hpBar: any;

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
    // 1. สร้างพื้นหลัง
    for (let x = 0; x < 25; x++) {
      for (let y = 0; y < 19; y++) {
        this.add.image(x * 32, y * 32, 'floor').setOrigin(0);
      }
    }

    // 2. สร้างผู้เล่น
    this.player = this.physics.add.sprite(400, 300, 'hero') as any;
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);

    // 3. ตั้งค่า Input
    const keyboard = this.input.keyboard as any;
    this.keyW = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyDash = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.keyAttack = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    
    console.log('✅ Keyboard (WASD) initialized. Click game to focus!');

    // 4. สร้างศัตรู
    this.enemy = this.physics.add.sprite(600, 300, 'slime') as any;
    this.enemy.setCollideWorldBounds(true);
    this.enemy.setDepth(5);

    // 5. สร้าง HP Bar ศัตรู
    this.hpBar = this.add.graphics();
    this.updateEnemyHPBar();

    // 6. สร้าง Attack Hitbox (ใช้ rectangle และ existing physics)
    this.attackHitbox = this.add.rectangle(0, 0, 40, 40, 0x00ff00, 0.5);
    this.physics.add.existing(this.attackHitbox, false); // false = dynamic body
    // ✅ หมายเหตุ: ไม่ต้องมี setDebug เพราะ config เปิด debug: true ไว้แล้ว มันจะขึ้นกรอบเขียวให้อัตโนมัติ

    // 7. ตั้งค่าการชนระหว่าง Hitbox กับศัตรู
    this.physics.add.overlap(this.attackHitbox, this.enemy, this.handleHit, undefined, this);

    // 8. ตั้งค่ากล้อง
    this.cameras.main.setBounds(0, 0, 800, 600);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // 9. บังคับ Focus ที่ Canvas เมื่อคลิก
    this.sys.game.canvas.addEventListener('click', () => {
      this.sys.game.canvas.focus();
      console.log('🎮 Game Canvas Focused!');
    });
  }

  update(time: number, delta: number) {
    if (!this.player) return;

    const speed = 160;
    this.player.setVelocity(0);

    // Movement ด้วย WASD
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

    // Dash (Shift)
    if (this.keyDash && Phaser.Input.Keyboard.JustDown(this.keyDash)) {
      const dashSpeed = 400;
      const direction = this.player.flipX ? -1 : 1;
      this.player.setVelocityX(dashSpeed * direction);
      this.player.setAlpha(0.5);
      this.time.delayedCall(200, () => {
        this.player.setAlpha(1);
        this.player.setVelocity(0);
      });
    }

    // Attack (Space)
    if (this.keyAttack && Phaser.Input.Keyboard.JustDown(this.keyAttack) && !this.isAttacking) {
      this.performAttack();
    }

    // Enemy AI
    if (this.enemy && this.enemy.active && this.enemyHP > 0) {
      this.physics.moveToObject(this.enemy, this.player, 60);
      if (this.enemy.x < this.player.x) this.enemy.setFlipX(false);
      else this.enemy.setFlipX(true);
    }
  }

  private performAttack() {
    this.isAttacking = true;
    const offset = this.player.flipX ? -30 : 30;
    this.attackHitbox.setPosition(this.player.x + offset, this.player.y);
    this.attackHitbox.setVisible(true); // ✅ เปลี่ยนจาก setActive เป็น setVisible สำหรับ Rectangle
    
    this.cameras.main.shake(100, 0.003);
    
    this.time.delayedCall(200, () => {
      this.isAttacking = false;
      this.attackHitbox.setVisible(false);
    });
  }

  private handleHit(hitbox: any, target: any) {
    if (!target.active || this.enemyHP <= 0) return;

    this.enemyHP--;
    this.updateEnemyHPBar();

    const knockDir = this.player.flipX ? -1 : 1;
    target.setVelocityX(knockDir * 200);
    
    target.setTint(0xffffff);
    this.time.delayedCall(100, () => target.clearTint());
    
    this.cameras.main.shake(150, 0.01);

    if (this.enemyHP <= 0) {
      target.destroy();
      this.hpBar.clear();
      this.time.delayedCall(2000, () => this.respawnEnemy());
    }
  }

  private updateEnemyHPBar() {
    this.hpBar.clear();
    const barWidth = 50;
    const barHeight = 6;
    const x = this.enemy.x - barWidth / 2;
    const y = this.enemy.y - 30;

    this.hpBar.fillStyle(0x330000);
    this.hpBar.fillRect(x, y, barWidth, barHeight);

    const hpPercent = Math.max(0, this.enemyHP / this.maxEnemyHP);
    this.hpBar.fillStyle(0x00ff00);
    this.hpBar.fillRect(x, y, barWidth * hpPercent, barHeight);
  }

  private respawnEnemy() {
    this.enemyHP = this.maxEnemyHP;
    this.enemy = this.physics.add.sprite(
      Phaser.Math.Between(100, 700),
      Phaser.Math.Between(100, 500),
      'slime'
    ) as any;
    this.enemy.setCollideWorldBounds(true);
    this.enemy.setDepth(5);
    
    this.physics.add.overlap(this.attackHitbox, this.enemy, this.handleHit, undefined, this);
    this.updateEnemyHPBar();
  }
}

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#1a1a1a',
  parent: 'app',
  input: {
    keyboard: {
      target: window
    }
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 } as any,
      debug: true
    }
  },
  scene: [GameScene]
};

const game = new Phaser.Game(config);