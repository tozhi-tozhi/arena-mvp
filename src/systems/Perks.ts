// src/systems/Perks.ts — เครื่องราง + ตัวกลางเรียกพฤติกรรมสัตว์เลี้ยง
// สัตว์เลี้ยงทำอะไรได้ ย้ายไปอยู่ที่ petBehaviors.ts แล้ว — ไฟล์นี้ไม่รู้จักชื่อสัตว์อีก
// ผลของเลเวลอ่านจาก Upgrades.ts ที่เดียวกับโรงตีเหล็กแสดง
import { loadout } from './Loadout';
import { showDamage } from './effects';
import { type CharmId } from '../data/charms';
import { PETS, type PetId } from '../data/pets';
import { Pet } from '../entities/Pet';
import { charmEffectNow, petEffectNow } from './Upgrades';
import { behaviorOf, type PetBehavior, type PetCtx } from './petBehaviors';

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
  private behavior: PetBehavior | null = null;
  private petInterval: number = 0;
  private petNextAt: number = 0;
  private speedBuffUntil: number = 0;
  private lastBuffImageAt: number = 0;

  // เครื่องราง
  private healsLeft: number = 0;
  private streakCount: number = 0;
  private streakReady: boolean = false;
  private doubleActionId: number = -1;
  private lastHitAction: number = -1;

  // ผลตามเลเวลที่อัปเกรดไว้
  private charmFx = charmEffectNow('');
  private petFx = petEffectNow('');

  constructor(ctx: PerkContext) {
    this.ctx = ctx;
    this.charmId = loadout.charmId;
    this.petId = loadout.petId;
    this.charmFx = charmEffectNow(this.charmId ?? '');
    this.petFx = petEffectNow(this.petId ?? '');
    this.healsLeft = this.charmFx.healMaxPerHunt;

    this.behavior = behaviorOf(this.petId);
    if (this.petId && this.behavior) {
      const now = ctx.scene.time.now;
      const p = ctx.getPlayer();
      this.petInterval = Math.max(500, this.behavior.intervalMs(this.petFx));
      this.petNextAt = now + this.petInterval;
      this.pet = new Pet(ctx.scene, PETS[this.petId], p.x - 30, p.y - 30);
    }
  }

  /** กล่องเครื่องมือที่ส่งให้พฤติกรรมสัตว์ใช้ */
  private petCtx(): PetCtx {
    return {
      scene: this.ctx.scene,
      getPlayer: this.ctx.getPlayer,
      getTarget: this.ctx.getBoss,
      damage: this.ctx.damageBoss,
      setSpeedBuff: (until) => { this.speedBuffUntil = until; },
      pet: this.pet
    };
  }

  // ---------- เรียกทุกเฟรม ----------
  update(now: number, delta: number) {
    const p = this.ctx.getPlayer();
    if (this.pet && this.behavior) {
      const remain = Math.max(0, this.petNextAt - now);
      this.pet.update(delta, p.x, p.y, 1 - remain / this.petInterval);
      if (now >= this.petNextAt) {
        const fired = this.behavior.fire(this.petCtx(), this.petFx, now);
        // ออกฤทธิ์ไม่ได้ (ไม่มีเป้า) → ลองใหม่ในครึ่งวินาที ไม่เสียรอบเต็ม
        this.petNextAt = now + (fired ? this.petInterval : 500);
      }
    }

    // เอฟเฟกต์เงาตามตัวตอนบัฟความเร็วทำงาน
    if (now < this.speedBuffUntil && now - this.lastBuffImageAt > 110) {
      this.lastBuffImageAt = now;
      this.ctx.spawnAfterimage(0xfff27a);
    }
  }

  speedMultiplier(now: number): number {
    return now < this.speedBuffUntil ? 1 + this.petFx.swiftBonusPct / 100 : 1;
  }

  // ---------- เครื่องราง ----------
  /** เรียกทุกครั้งที่ผู้เล่นสร้างดาเมจให้เป้า คืนค่าดาเมจ (อาจถูกคูณ) */
  onPlayerHit(damage: number, actionId: number): number {
    if (actionId < 0 || !this.charmId) return damage;
    // "การโจมตี 1 ครั้งที่โดน" = รหัสแอ็กชันเดียวนับแค่ครั้งแรก (กระสุนพัดหลายนัดนับเป็น 1)
    if (actionId !== this.lastHitAction) {
      this.lastHitAction = actionId;
      this.onFirstHit(actionId);
    }
    return actionId === this.doubleActionId ? damage * this.charmFx.streakMultiplier : damage;
  }

  private onFirstHit(actionId: number) {
    const p = this.ctx.getPlayer();
    const scene = this.ctx.scene;
    if (this.charmId === 'heal') {
      if (
        this.healsLeft > 0 &&
        this.ctx.getHP() < this.ctx.getMaxHP() &&
        Math.random() < this.charmFx.healChance
      ) {
        this.healsLeft--;
        this.ctx.heal(this.charmFx.healAmount);
      }
    } else if (this.charmId === 'streak') {
      if (this.streakReady) {
        this.doubleActionId = actionId;
        this.streakReady = false;
        this.streakCount = 0;
        showDamage(scene, p.x, p.y - 45, `x${this.charmFx.streakMultiplier}!`, '#ffd54a', 700);
      } else {
        this.streakCount++;
        if (this.streakCount >= this.charmFx.streakHitsNeeded) {
          this.streakReady = true;
          showDamage(scene, p.x, p.y - 45, 'สตรีคพร้อม!', '#ffd54a', 700);
        }
      }
    }
  }

  /** ถูกตีจนเลือดลดจริง (โล่กันได้ไม่นับ) */
  onPlayerHurt() {
    this.streakCount = 0;
    this.streakReady = false;
  }

  /** ข้อความสถานะเครื่องรางบน HUD */
  charmHud(): { text: string; color: string } | null {
    if (this.charmId === 'heal') {
      return { text: `ตราต่อชีวิต: ฟื้นได้อีก ${this.healsLeft}`, color: '#a8e6a3' };
    }
    if (this.charmId === 'streak') {
      if (this.streakReady) return { text: `ตราไร้รอย: x${this.charmFx.streakMultiplier} พร้อม!`, color: '#ffd54a' };
      return { text: `ตราไร้รอย: ${this.streakCount}/${this.charmFx.streakHitsNeeded}`, color: '#ffe9a0' };
    }
    return null;
  }
}