// src/systems/petBehaviors.ts — ทะเบียนพฤติกรรมสัตว์เลี้ยง (แบบเดียวกับทะเบียนบอส)
// เพิ่มสัตว์ใหม่ = เพิ่มข้อมูลใน data/pets.ts + เพิ่มก้อนในตารางนี้ที่เดียว
// ห้ามแก้ Perks.ts หรือ Pet.ts เพื่อรองรับสัตว์ตัวใหม่
// ผลตามเลเวลอ่านจาก PetEffect (Upgrades.ts) — ที่เดียวกับโรงตีเหล็กแสดง
import Phaser from 'phaser';
import { DEPTH } from '../config';
import { showDamage, ringEffect, burst } from './effects';
import { PET_MORTAR, type PetId } from '../data/pets';
import type { PetEffect } from './Upgrades';

/** สิ่งที่พฤติกรรมเรียกใช้ได้ — ไม่รู้จัก PlayerActor โดยตรง */
export interface PetCtx {
  scene: Phaser.Scene;
  getPlayer: () => { x: number; y: number };
  /** เป้าที่ตีได้ใกล้สุด (บอส/ตัวแทะ) — ไม่มีให้ยิงคืน null */
  getTarget: () => { x: number; y: number; r: number } | null;
  damage: (amount: number, actionId: number) => void;
  /** ตั้งเวลาสิ้นสุดบัฟความเร็ว — Perks เป็นคนเอาไปคูณความเร็วเดิน */
  setSpeedBuff: (untilMs: number) => void;
  pet: { pulse: () => void; pos: () => { x: number; y: number } } | null;
}

export interface PetBehavior {
  /** ออกฤทธิ์ทุกกี่มิลลิวินาที (ตามเลเวล) */
  intervalMs: (fx: PetEffect) => number;
  /** ออกฤทธิ์ — คืน false ถ้ายังทำไม่ได้ (เช่นไม่มีเป้า) แล้วจะลองใหม่เร็ว ๆ */
  fire: (ctx: PetCtx, fx: PetEffect, now: number) => boolean;
}

// ---------- ลมวูบ: บัฟความเร็วเป็นช่วง ----------
const swiftBehavior: PetBehavior = {
  intervalMs: (fx) => fx.swiftIntervalMs,
  fire: (ctx, fx, now) => {
    ctx.setSpeedBuff(now + fx.swiftDurationMs);
    const p = ctx.getPlayer();
    ctx.pet?.pulse();
    ringEffect(ctx.scene, p.x, p.y, 40, 0xfff27a, 300);
    showDamage(ctx.scene, p.x, p.y - 45, `เร็วขึ้น +${fx.swiftBonusPct}%!`, '#fff27a', 800);
    return true;
  }
};

// ---------- ครกจิ๋ว: กระสุนตกใส่จุดที่เป้ายืน ----------
const mortarBehavior: PetBehavior = {
  intervalMs: (fx) => fx.mortarIntervalMs,
  fire: (ctx, fx) => {
    const target = ctx.getTarget();
    if (!target) return false; // ยังไม่มีเป้า → ไม่เสียรอบ ยิงทันทีที่มี

    const scene = ctx.scene;
    // ดาเมจตามเลเวล แต่คงขนาดวง/เวลาบินเดิม (ภาพกับพื้นที่โดนตรงกัน)
    const M = { ...PET_MORTAR, damage: fx.mortarDamage };
    const tx = target.x;
    const ty = target.y;
    const from = ctx.pet ? ctx.pet.pos() : ctx.getPlayer();
    ctx.pet?.pulse();

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
          const nowTarget = ctx.getTarget();
          if (
            nowTarget &&
            Phaser.Math.Distance.Between(tx, ty, nowTarget.x, nowTarget.y) <=
              M.radius + nowTarget.r * 0.5
          ) {
            // -1 = ไม่ใช่การโจมตีของผู้เล่น (ไม่นับพาสซีฟ/เครื่องราง)
            ctx.damage(M.damage, -1);
          }
        }
      });
    });
    return true;
  }
};

export const PET_BEHAVIORS: Record<PetId, PetBehavior> = {
  swift: swiftBehavior,
  mortar: mortarBehavior
};

/** ไม่รู้จักสัตว์ตัวนี้ = คืน null (เกมไม่พัง แค่ไม่ออกฤทธิ์) */
export function behaviorOf(id: PetId | null): PetBehavior | null {
  if (!id) return null;
  return PET_BEHAVIORS[id] ?? null;
}