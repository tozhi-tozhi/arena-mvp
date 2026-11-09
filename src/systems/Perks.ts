// เครื่องราง + สัตว์เลี้ยง — แยกออกจาก GameScene เพื่อให้แก้ง่าย
import Phaser from 'phaser';
import { DEPTH } from '../config';
import { loadout } from './Loadout';
import { showDamage, ringEffect, burst } from './effects';
import { CHARM_HEAL, CHARM_STREAK, type CharmId } from '../data/charms';
import { PETS, PET_SPEED, PET_MORTAR, type PetId } from '../data/pets';
import { Pet } from '../entities/Pet';

export interface PerkContext {
  scene: Phaser.Scene;
  getPlayer: () => { x: number; y: number };
  getBoss: () => { x: number; y: number; r: number } | null;
  getHP: () => number;
  getMaxHP: () => number;
  heal: (n: number) => void;
  damageBoss: (damage: number, actionId: number) => void;
  spawnAfterimage: (color: number) => void;
}

export class Perks {
  private ctx: PerkContext;
  private charmId: CharmId | null;
  private petId: PetId | null;

  // สัตว์เลี้ยง
  private pet: Pet | null = null;
  private petInterval: number = 0;
  private petNextAt: number = 0;
  private speedBuffUntil: number = 0;
  private lastBuffImageAt: number = 0;

  // เครื่องราง
  private healsLeft: number = CHARM_HEAL.maxPerHunt;
  private streakCount: number = 0;
  private streakReady: boolean = false;
  private doubleActionId: number = -1;
  private lastHitAction: number = -1;

  constructor(ctx: PerkContext) {
    this.ctx = ctx;
    this.charmId = loadout.charmId;
    this.petId = loadout.petId;

    if (this.petId) {
      const now = ctx.scene.time.now;
      const p = ctx.getPlayer();
      this.petInterval = this.petId === 'swift' ? PET_SPEED.intervalMs : PET_MORTAR.intervalMs;
      this.petNextAt = now + this.petInterval;
      this.pet = new Pet(ctx.scene, this.petId, PETS[this.petId].color, p.x - 30, p.y - 30);
    }
  }

  // ---------- เรียกทุกเฟรม ----------
  update(now: number, delta: number) {
    const p = this.ctx.getPlayer();

    if (this.pet) {
      const remain = Math.max(0, this.petNextAt - now);
      this.pet.update(delta, p.x, p.y, 1 - remain / this.petInterval);

      if (now >= this.petNextAt) {
        if (this.petId === 'swift') {
          this.petNextAt = now + this.petInterval;
          this.fireSpeedBuff(now);
        } else {
          const boss = this.ctx.getBoss();
          if (!boss) {
            this.petNextAt = now + 500; // ยังไม่มีบอสให้ยิง — ลองใหม่เร็วๆ
          } else {
            this.petNextAt = now + this.petInterval;
            this.fireMortar(boss);
          }
        }
      }
    }

    // เอฟเฟกต์เงาตามตัวตอนบัฟความเร็วทำงาน
    if (now < this.speedBuffUntil && now - this.lastBuffImageAt > 110) {
      this.lastBuffImageAt = now;
      this.ctx.spawnAfterimage(0xfff27a);
    }
  }

  speedMultiplier(now: number): number {
    return now < this.speedBuffUntil ? PET_SPEED.multiplier : 1;
  }

  // ---------- สัตว์เลี้ยง: บัฟความเร็ว ----------
  private fireSpeedBuff(now: number) {
    this.speedBuffUntil = now + PET_SPEED.durationMs;
    const p = this.ctx.getPlayer();
    this.pet?.pulse();
    ringEffect(this.ctx.scene, p.x, p.y, 40, 0xfff27a, 300);
    showDamage(this.ctx.scene, p.x, p.y - 45, 'เร็วขึ้น!', '#fff27a', 800);
  }

  // ---------- สัตว์เลี้ยง: ปืนใหญ่ครก ----------
  private fireMortar(boss: { x: number; y: number; r: number }) {
    const scene = this.ctx.scene;
    const M = PET_MORTAR;
    const tx = boss.x;
    const ty = boss.y;
    const from = this.pet ? this.pet.pos() : this.ctx.getPlayer();
    this.pet?.pulse();

    // วงเตือนที่พื้น (วงในขยายจนเต็ม = ตก)
    const marker = scene.add.circle(tx, ty, M.radius, 0xff5a3a, 0.1);
    marker.setStrokeStyle(2, 0xff5a3a, 0.9);
    marker.setDepth(DEPTH.PLAYER_SHADOW);
    const fill = scene.add.circle(tx, ty, M.radius, 0xff5a3a, 0.28);
    fill.setDepth(DEPTH.PLAYER_SHADOW);
    fill.setScale(0.05);
    scene.tweens.add({ targets: fill, scale: 1, duration: M.flightMs });

    // กระสุนพุ่งขึ้นฟ้า
    const shell = scene.add.circle(from.x, from.y, 5, 0xffe08a);
    shell.setStrokeStyle(2, 0xff8a3a);
    shell.setDepth(DEPTH.PLAYER + 3);
    scene.tweens.add({
      targets: shell,
      y: from.y - 320,
      alpha: 0.2,
      duration: 350,
      onComplete: () => shell.setVisible(false)
    });

    // ตกลงมาที่เป้าหมาย
    scene.time.delayedCall(M.flightMs - 350, () => {
      shell.setPosition(tx, ty - 320);
      shell.setAlpha(1);
      shell.setVisible(true);
      scene.tweens.add({
        targets: shell,
        y: ty,
        duration: 350,
        onComplete: () => {
          marker.destroy();
          fill.destroy();
          shell.destroy();
          ringEffect(scene, tx, ty, M.radius, 0xff8a3a, 350);
          burst(scene, tx, ty, 0xffb04a, 14, M.radius, 6);
          scene.cameras.main.shake(140, 0.007);

          const b = this.ctx.getBoss();
          if (b && Phaser.Math.Distance.Between(tx, ty, b.x, b.y) <= M.radius + b.r * 0.5) {
            this.ctx.damageBoss(M.damage, -1); // -1 = ไม่ใช่การโจมตีของผู้เล่น (ไม่นับพาสซีฟ/เครื่องราง)
          }
        }
      });
    });
  }

  // ---------- เครื่องราง ----------
  // เรียกทุกครั้งที่ผู้เล่นสร้างดาเมจให้บอส คืนค่าดาเมจ (อาจถูกคูณ)
  onPlayerHit(damage: number, actionId: number): number {
    if (actionId < 0 || !this.charmId) return damage;

    // "การโจมตี 1 ครั้งที่โดน" = actionId เดียวกันนับแค่ครั้งแรก (กระสุนพัดหลายนัดนับเป็น 1)
    if (actionId !== this.lastHitAction) {
      this.lastHitAction = actionId;
      this.onFirstHit(actionId);
    }
    return actionId === this.doubleActionId ? damage * CHARM_STREAK.multiplier : damage;
  }

  private onFirstHit(actionId: number) {
    const p = this.ctx.getPlayer();
    const scene = this.ctx.scene;

    if (this.charmId === 'heal') {
      if (
        this.healsLeft > 0 &&
        this.ctx.getHP() < this.ctx.getMaxHP() &&
        Math.random() < CHARM_HEAL.chance
      ) {
        this.healsLeft--;
        this.ctx.heal(CHARM_HEAL.amount);
      }
    } else if (this.charmId === 'streak') {
      if (this.streakReady) {
        this.doubleActionId = actionId;
        this.streakReady = false;
        this.streakCount = 0;
        showDamage(scene, p.x, p.y - 45, 'x2!', '#ffd54a', 700);
      } else {
        this.streakCount++;
        if (this.streakCount >= CHARM_STREAK.hitsNeeded) {
          this.streakReady = true;
          showDamage(scene, p.x, p.y - 45, 'สตรีคพร้อม!', '#ffd54a', 700);
        }
      }
    }
  }

  // ถูกตีจนเลือดลดจริง (โล่กันได้ไม่นับ)
  onPlayerHurt() {
    this.streakCount = 0;
    this.streakReady = false;
  }

  // ข้อความสถานะเครื่องรางบน HUD
  charmHud(): { text: string; color: string } | null {
    if (this.charmId === 'heal') {
      return { text: `ตราต่อชีวิต: ฟื้นได้อีก ${this.healsLeft}`, color: '#a8e6a3' };
    }
    if (this.charmId === 'streak') {
      if (this.streakReady) return { text: 'ตราไร้รอย: x2 พร้อม!', color: '#ffd54a' };
      return { text: `ตราไร้รอย: ${this.streakCount}/${CHARM_STREAK.hitsNeeded}`, color: '#ffe9a0' };
    }
    return null;
  }
}