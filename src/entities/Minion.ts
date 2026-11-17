// src/entities/Minion.ts — ตัวแทะกระดาษ: เดินสุ่ม → ไล่เมื่อใกล้ → ง้าง (วงเตือน) → พุ่ง → เปิดให้ตี
// คุยกับฉากผ่าน hooks เท่านั้น — ไม่รู้จัก PlayerActor/WorldScene โดยตรง
// เป้าต่อสู้ผ่าน minionAsTarget (CombatTarget.ts) — PlayerActor ไม่ต้องแก้เลย
import Phaser from 'phaser';
import { DEPTH } from '../config';
import { MINION } from '../data/minions';
import { burst, ringEffect, showDamage } from '../systems/effects';
import { sfx } from '../systems/sfx';
import { ensureMinionTexture, MINION_TEX } from '../systems/minionTextures';

export interface MinionHooks {
  onHitPlayer: (damage: number, fromX: number, fromY: number) => void;
  onDeath: (minion: Minion) => void;
  playerAlive: () => boolean;
  playerPos: () => { x: number; y: number };
}

type State = 'wander' | 'chase' | 'telegraph' | 'lunge' | 'recover' | 'return';

export class Minion {
  readonly sprite: any;
  hp: number;
  private scene: Phaser.Scene;
  private hooks: MinionHooks;
  private shadow: Phaser.GameObjects.Ellipse;
  private gfx: Phaser.GameObjects.Graphics;
  private hpBar: Phaser.GameObjects.Graphics;
  private home: { x: number; y: number };
  private wanderTarget: { x: number; y: number };
  private state: State = 'wander';
  private timer: number = 0;
  private lockX: number = 0;
  private lockY: number = 0;
  private lungeDirX: number = 0;
  private lungeDirY: number = 0;
  private hitDone: boolean = false;
  private dead: boolean = false;
  private baseScale: number;

  constructor(scene: Phaser.Scene, x: number, y: number, hooks: MinionHooks) {
    this.scene = scene;
    this.hooks = hooks;
    this.hp = MINION.hp;
    ensureMinionTexture(scene);

    this.sprite = scene.physics.add.sprite(x, y, MINION_TEX);
    this.baseScale = MINION.displayWidth / this.sprite.width;
    this.sprite.setScale(this.baseScale);
    this.sprite.setDepth(DEPTH.ENEMY);
    this.sprite.setCollideWorldBounds(true);
    const diameter = Math.min(this.sprite.width, this.sprite.height) * 0.7;
    this.sprite.body.setCircle(
      diameter / 2,
      (this.sprite.width - diameter) / 2,
      (this.sprite.height - diameter) / 2
    );

    // เงาทอดขวาล่างตามแสงเกม
    this.shadow = scene.add
      .ellipse(x + 5, y + this.sprite.displayHeight / 2, MINION.displayWidth * 0.8, MINION.displayWidth * 0.22, 0x000000, 0.3)
      .setDepth(DEPTH.ENEMY_SHADOW);

    this.gfx = scene.add.graphics().setDepth(DEPTH.TELEGRAPH);
    this.hpBar = scene.add.graphics().setDepth(DEPTH.ENEMY_HP_BAR);

    this.home = { x, y };
    this.wanderTarget = { x, y };
    this.timer = Phaser.Math.Between(MINION.wanderPauseMs[0], MINION.wanderPauseMs[1]);

    // หายใจขยุบ ๆ — ให้รู้สึกมีชีวิตแม้ยืนเฉย
    scene.tweens.add({
      targets: this.sprite,
      scaleY: this.baseScale * 0.9,
      duration: 380,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  get isAlive(): boolean { return !this.dead; }
  get radius(): number { return MINION.displayWidth * 0.42; }

  update(delta: number) {
    if (this.dead) return;
    this.shadow.setPosition(this.sprite.x + 5, this.sprite.y + this.sprite.displayHeight / 2);
    this.drawHpBar();

    const p = this.hooks.playerPos();
    const alive = this.hooks.playerAlive();
    const d = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, p.x, p.y);

    switch (this.state) {
      case 'wander': this.tickWander(delta, p, alive, d); break;
      case 'chase': this.tickChase(p, alive, d); break;
      case 'telegraph': this.tickTelegraph(delta); break;
      case 'lunge': this.tickLunge(delta, p, alive); break;
      case 'recover': this.tickRecover(delta, alive, d); break;
      case 'return': this.tickReturn(alive, d); break;
    }
  }

  // ---------- เดินแทะสุ่มรอบบ้าน ----------
  private tickWander(delta: number, p: { x: number; y: number }, alive: boolean, d: number) {
    if (alive && d <= MINION.aggroRadius) {
      this.state = 'chase';
      return;
    }
    this.timer -= delta;
    const dd = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, this.wanderTarget.x, this.wanderTarget.y);
    if (this.timer <= 0 || dd < 12) {
      this.pickWanderTarget();
      this.timer = Phaser.Math.Between(MINION.wanderPauseMs[0], MINION.wanderPauseMs[1]);
    }
    this.scene.physics.moveTo(this.sprite, this.wanderTarget.x, this.wanderTarget.y, MINION.wanderSpeed);
    this.sprite.setFlipX(this.wanderTarget.x < this.sprite.x);
  }

  private pickWanderTarget() {
    const b = this.scene.physics.world.bounds;
    const a = Math.random() * Math.PI * 2;
    const r = 40 + Math.random() * MINION.wanderDist;
    this.wanderTarget = {
      x: Phaser.Math.Clamp(this.home.x + Math.cos(a) * r, b.x + 40, b.right - 40),
      y: Phaser.Math.Clamp(this.home.y + Math.sin(a) * r, b.y + 40, b.bottom - 40)
    };
  }

  // ---------- ไล่ (เดินหนีทันเสมอ) ----------
  private tickChase(p: { x: number; y: number }, alive: boolean, d: number) {
    if (!alive || d > MINION.leashRadius) {
      this.state = 'return';
      return;
    }
    if (d <= MINION.attackRange) {
      this.startTelegraph(p);
      return;
    }
    this.scene.physics.moveToObject(this.sprite, p, MINION.chaseSpeed);
    this.sprite.setFlipX(p.x < this.sprite.x);
  }

  // ---------- ง้าง: ล็อกตำแหน่งผู้เล่น + วงเตือน (เดินออกก็พ้น) ----------
  private startTelegraph(p: { x: number; y: number }) {
    this.state = 'telegraph';
    this.timer = MINION.telegraphMs;
    this.lockX = p.x;
    this.lockY = p.y;
    this.sprite.setVelocity(0);
    this.sprite.setFlipX(p.x < this.sprite.x);
    sfx.warn();
  }

  private tickTelegraph(delta: number) {
    this.timer -= delta;
    const p = Phaser.Math.Clamp(1 - this.timer / MINION.telegraphMs, 0, 1);
    const g = this.gfx;
    g.clear();
    g.fillStyle(0xff5a3a, 0.1 + 0.2 * p);
    g.fillCircle(this.lockX, this.lockY, MINION.hitRadius);
    g.lineStyle(2, 0xff5a3a, 0.9);
    g.strokeCircle(this.lockX, this.lockY, MINION.hitRadius);
    g.fillStyle(0xff5a3a, 0.3);
    g.fillCircle(this.lockX, this.lockY, MINION.hitRadius * p);
    if (this.timer <= 0) {
      this.gfx.clear();
      const dx = this.lockX - this.sprite.x;
      const dy = this.lockY - this.sprite.y;
      const len = Math.max(1, Math.hypot(dx, dy));
      this.lungeDirX = dx / len;
      this.lungeDirY = dy / len;
      this.sprite.setVelocity(this.lungeDirX * MINION.lungeSpeed, this.lungeDirY * MINION.lungeSpeed);
      this.timer = MINION.lungeMs;
      this.hitDone = false;
      this.state = 'lunge';
    }
  }

  // ---------- พุ่งชน (โดนครั้งเดียวต่อการพุ่ง) ----------
  private tickLunge(delta: number, p: { x: number; y: number }, alive: boolean) {
    this.timer -= delta;
    if (!this.hitDone && alive) {
      const d = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, p.x, p.y);
      if (d <= MINION.hitRadius) {
        this.hitDone = true;
        this.hooks.onHitPlayer(MINION.damage, this.sprite.x, this.sprite.y);
      }
    }
    if (this.timer <= 0) {
      this.sprite.setVelocity(0);
      this.timer = MINION.recoverMs;
      this.state = 'recover';
    }
  }

  // ---------- พุ่งเสร็จนิ่ง = เปิดให้ตีฟรี ----------
  private tickRecover(delta: number, alive: boolean, d: number) {
    this.timer -= delta;
    if (this.timer <= 0) {
      this.state = alive && d <= MINION.leashRadius ? 'chase' : 'return';
    }
  }

  // ---------- เลิกไล่ กลับบ้าน ----------
  private tickReturn(alive: boolean, d: number) {
    if (alive && d <= MINION.aggroRadius * 0.8) {
      this.state = 'chase';
      return;
    }
    const dd = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, this.home.x, this.home.y);
    if (dd < 20) {
      this.sprite.setVelocity(0);
      this.state = 'wander';
      return;
    }
    this.scene.physics.moveTo(this.sprite, this.home.x, this.home.y, MINION.chaseSpeed * 0.8);
    this.sprite.setFlipX(this.home.x < this.sprite.x);
  }

  // ---------- โดนตี / ตาย ----------
  takeHit(damage: number) {
    if (this.dead) return;
    this.hp = Math.max(0, this.hp - damage);
    this.sprite.setTint(0xffffff);
    this.scene.time.delayedCall(80, () => {
      if (!this.dead) this.sprite.clearTint();
    });
    showDamage(this.scene, this.sprite.x, this.sprite.y - this.sprite.displayHeight / 2, String(damage), '#ffe066', 450);
    burst(this.scene, this.sprite.x, this.sprite.y, 0xe8e0c8, 4, 30, 3);
    if (this.hp <= 0) this.die();
  }

  private die() {
    this.dead = true;
    this.scene.tweens.killTweensOf(this.sprite);
    burst(this.scene, this.sprite.x, this.sprite.y, MINION.color, 12, 60, 5);
    ringEffect(this.scene, this.sprite.x, this.sprite.y, 40, 0xe8e0c8, 250);
    sfx.hit();
    this.gfx.clear();
    this.sprite.destroy();
    this.shadow.destroy();
    this.gfx.destroy();
    this.hpBar.destroy();
    this.hooks.onDeath(this);
  }

  /** ล้างทิ้งตอนเปลี่ยนแอเรีย — ไม่ดรอปของ ไม่เรียก onDeath */
  destroy() {
    if (this.dead) return;
    this.dead = true;
    this.scene.tweens.killTweensOf(this.sprite);
    if (this.sprite.active) this.sprite.destroy();
    if (this.shadow.active) this.shadow.destroy();
    if (this.gfx.active) this.gfx.destroy();
    if (this.hpBar.active) this.hpBar.destroy();
  }

  // แถบเลือดเล็กเหนือหัว — โชว์เฉพาะตอนโดนตีแล้ว (ไม่รกจอตอนเต็ม)
  private drawHpBar() {
    const g = this.hpBar;
    g.clear();
    if (this.hp >= MINION.hp) return;
    const w = 28;
    const x = this.sprite.x - w / 2;
    const y = this.sprite.y - this.sprite.displayHeight / 2 - 10;
    g.fillStyle(0x000000, 0.6);
    g.fillRect(x - 1, y - 1, w + 2, 5);
    g.fillStyle(0x7dff9b, 1);
    g.fillRect(x, y, w * (this.hp / MINION.hp), 3);
  }
}