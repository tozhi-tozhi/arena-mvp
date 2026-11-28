// src/characters/LumaKit.ts — ชุดท่าของลูมิ (ย้ายมาจาก PlayerActor)
import Phaser from 'phaser';
import { showDamage } from '../systems/effects';
import { burst, ringEffect, shotFx, shotEndFx } from '../systems/netFx';
import { sfx } from '../systems/netFx';
import { PlayerShot } from '../entities/PlayerShot';
import { LUMA } from '../data/characters';
import { loadout } from '../systems/Loadout';
import { COMBO3_FAN, skillId, ultimateCooldownOf } from '../data/skills';
import type { CombatTarget } from '../systems/CombatTarget';
import type { PlayerActor } from '../actors/PlayerActor';
import type { CharacterKit } from './CharacterKit';


/**
 * ชุดท่าของลูมิ — ยิงกระสุน / แดช / พาสซีฟนับโจมตี
 * ระบบกระสุนอยู่ในชุดท่านี้ (ลูมิเป็นตัวเดียวที่ยิง) — ถ้ามีตัวที่สองที่ยิง ให้แยกเป็นตัวช่วยกลางตอนนั้น
 */
export class LumaKit implements CharacterKit {
  private shots: PlayerShot[] = [];
  private hitCounter: number = 0;
  private lastCountedAction: number = -1;

  constructor(private p: PlayerActor) {}

  // ---------------------------------------------------------------
  // จุดเชื่อมกับ PlayerActor (สัญญา CharacterKit)
  // ---------------------------------------------------------------
  speedMult(_now: number): number {
    return 1;
  }

  update(_now: number, delta: number): void {
    for (const s of this.shots) s.update(delta);
    this.shots = this.shots.filter((s) => s.isAlive());
  }

  chargeNeeded(): number {
    return LUMA.charged.holdMs;
  }

  lightOverride(): boolean {
    return false;
  }

  light(): void {
    this.lumaLight();
  }

  /** ฮิต 3 ของคอมโบ — ตอนนี้มีเฉพาะตัวเลือก A (พัด 3 นัด) */
  comboFinisher(): void {
    const id = loadout.skillOf('combo');
    if (id === skillId('luma', 'combo', 'a')) {
      this.lumaComboFan();
      return;
    }
    this.lumaLight();
  }

  charged(): void {
    this.lumaCharged();
  }

  /** ท่าฝนดาวตกยังไม่ทำ — ใช้แดชเดิมเป็นตัวยืนพื้นไปก่อน */
  ultimate(): void {
    this.lumaDash();
  }

  modifyDamage(damage: number, _actionId: number): number {
    return damage;
  }

  /** พาสซีฟ: ตีโดนครบจำนวนครั้ง (นับต่อการโจมตี 1 ครั้ง) รีเซ็ตคูลดาวน์ไม้ตาย */
  onHitLanded(actionId: number): void {
    if (actionId === this.lastCountedAction) return;
    this.lastCountedAction = actionId;
    this.hitCounter++;
    if (this.hitCounter >= this.p.starFx.passiveHitsNeeded) {
      this.hitCounter = 0;
      this.p.skillReadyAt = 0;
      showDamage(this.p.scene, this.p.sprite.x, this.p.sprite.y - 40, 'แดชพร้อม!', '#9de7ff', 900);
      ringEffect(this.p.scene, this.p.sprite.x, this.p.sprite.y, 50, 0x9de7ff, 300);
    }
  }

  onHurt(): void {}

  updateHud(_now: number): void {
    this.p.passiveText
      .setText(`นับโจมตี ${this.hitCounter}/${this.p.starFx.passiveHitsNeeded}`)
      .setColor('#ffc8f5');
  }

  reset(): void {}

  destroy(): void {
    for (const s of this.shots) s.destroy();
    this.shots = [];
  }

  // ---------------------------------------------------------------
  // ท่าและกระสุนของลูมิ
  // ---------------------------------------------------------------
  /** ลูมิ ฮิต 3 — ยิงกระสุน 3 ลูกกระจายเป็นพัด (นับพาสซีฟเป็น 1 ครั้ง เพราะใช้รหัสแอ็กชันเดียว) */
  private lumaComboFan() {
    const F = COMBO3_FAN;
    const token = this.p.beginAction();
    const dir = this.p.getAttackDir(LUMA.light.assistRange, LUMA.light.assistAngle);
    if (Math.abs(dir.x) > 0.3) this.p.sprite.setFlipX(dir.x < 0);
    this.p.facing.copy(dir);
    const actionId = ++this.p.actionSeq;
    this.p.isAttacking = true;
    this.p.setPlayerTexture('hero_clay_attack');
    sfx.swing();
    this.p.muzzleFx(dir, F.color);
    const baseAngle = Math.atan2(dir.y, dir.x);
    for (let i = 0; i < F.count; i++) {
      const offset = Phaser.Math.DegToRad((i - (F.count - 1) / 2) * F.spreadDeg);
      const d = new Phaser.Math.Vector2(Math.cos(baseAngle + offset), Math.sin(baseAngle + offset));
      this.fireShot(d, F, 'combo', actionId);
    }
    this.p.time.delayedCall(F.totalMs, () => {
      if (token !== this.p.actionToken) return;
      this.p.isAttacking = false;
      this.p.setPlayerTexture('hero_clay_idle');
    });
  }

  private lumaLight() {
    const L = LUMA.light;
    const token = this.p.beginAction();
    const dir = this.p.getAttackDir(L.assistRange, L.assistAngle);
    if (Math.abs(dir.x) > 0.3) this.p.sprite.setFlipX(dir.x < 0);
    this.p.facing.copy(dir);
    this.p.isAttacking = true;
    this.p.setPlayerTexture('hero_clay_attack');
    sfx.swing();
    this.p.muzzleFx(dir, L.color);
    this.fireShot(dir, L, 'light', ++this.p.actionSeq);
    this.p.time.delayedCall(L.cooldownMs, () => {
      if (token !== this.p.actionToken) return;
      this.p.isAttacking = false;
      this.p.setPlayerTexture('hero_clay_idle');
    });
  }

  private lumaCharged() {
    const C = LUMA.charged;
    const token = this.p.beginAction();
    const dir = this.p.getAttackDir(C.assistRange, C.assistAngle);
    if (Math.abs(dir.x) > 0.3) this.p.sprite.setFlipX(dir.x < 0);
    this.p.facing.copy(dir);
    const actionId = ++this.p.actionSeq;

    this.p.isAttacking = true;
    this.p.setPlayerTexture('hero_clay_attack');
    sfx.swing();
    this.p.cam.shake(100, 0.004);

    const baseAngle = Math.atan2(dir.y, dir.x);
    // ★1 พัดกว้าง: เพิ่มจำนวนนัด แต่คงมุมห่างต่อนัดเดิม (พัดกว้างขึ้นจริง)
    const shotCount = C.count + this.p.starFx.chargedCountBonus;
    for (let i = 0; i < shotCount; i++) {
      const offset = Phaser.Math.DegToRad((i - (shotCount - 1) / 2) * C.spreadDeg);
      const d = new Phaser.Math.Vector2(Math.cos(baseAngle + offset), Math.sin(baseAngle + offset));
      this.fireShot(d, C, 'charge', actionId);
    }

    this.p.time.delayedCall(C.totalMs, () => {
      if (token !== this.p.actionToken) return;
      this.p.isAttacking = false;
      this.p.setPlayerTexture('hero_clay_idle');
    });
  }

  private lumaDash() {
    const D = LUMA.dash;
    const token = this.p.beginAction();
this.p.skillReadyAt = this.p.time.now + ultimateCooldownOf(this.p.character.id);
this.p.ultReadyAt = this.p.skillReadyAt;
this.p.isDashing = true;
    sfx.dash();

    const mv = this.p.getMoveInput();
    let dx = mv.x;
    let dy = mv.y;
    if (dx === 0 && dy === 0) {
      dx = this.p.facing.x;
      dy = this.p.facing.y;
    }
    const len = Math.hypot(dx, dy) || 1;
    // ★2 แดชยาว: เร็วขึ้นและนานขึ้นตามตัวคูณเดียวกัน
    const dashSpeed = D.speed * this.p.starFx.dashDistMult;
    const dashMs = D.durationMs * this.p.starFx.dashDistMult;
    this.p.sprite.setVelocity((dx / len) * dashSpeed, (dy / len) * dashSpeed);
    this.p.sprite.setAlpha(0.8);

    this.p.time.addEvent({ delay: 30, repeat: 5, callback: () => this.p.spawnAfterimage(0x66ccff) });

    this.p.time.delayedCall(dashMs, () => {
      if (token !== this.p.actionToken) return;
      this.p.isDashing = false;
      if (!this.p.isDead) {
        this.p.sprite.setAlpha(1);
        this.p.sprite.setVelocity(0);
      }
    });
  }

  private fireShot(
    dir: Phaser.Math.Vector2,
    cfg: { speed: number; range: number; radius: number; color: number; aoeRadius: number },
    kind: 'light' | 'charge' | 'combo',
    actionId: number
  ) {
    const sx = this.p.sprite.x + dir.x * 14;
    const sy = this.p.sprite.y + dir.y * 14;
    // ส่งให้เพื่อนยิงกระสุนภาพล้วน (ไม่มีดาเมจ) · sid ไว้บอกเพื่อนให้ลบกระสุนเมื่อของเราระเบิด
    const sid = shotFx(sx, sy, dir.x, dir.y, cfg.speed, cfg.range, cfg.radius, cfg.color);
    const shot = new PlayerShot(
      this.p.scene,
      sx,
      sy,
      dir.x,
      dir.y,
      { speed: cfg.speed, range: cfg.range, radius: cfg.radius, color: cfg.color },
      // ตัวจริงที่กระสุนชนได้ (เฉพาะที่ตีโดนได้ตอนนี้)
      () =>
        this.p.host
          .getTargets()
          .filter((t) => t.isHittable())
          .map((t) => ({ x: t.x, y: t.y, r: t.radius })),
      (x, y, ratio) => {
        shotEndFx(sid, x, y);
        this.onShotDetonate(kind, actionId, x, y, ratio, cfg.aoeRadius, cfg.color);
      },
      // ร่างปลอมระหว่างทาง — กระสุนชนแล้วระเบิดที่ร่างนั้นเลย
      () => this.p.host.getTargets().flatMap((t) => t.getDecoys())
    );
    this.shots.push(shot);
  }

  private onShotDetonate(
    kind: 'light' | 'charge' | 'combo',
    actionId: number,
    x: number,
    y: number,
    ratio: number,
    aoeRadius: number,
    color: number
  ) {
    // ภาพระเบิด — งานภาพล้วน ไม่แตะดาเมจ
    ringEffect(this.p.scene, x, y, aoeRadius + 8, color, 220);
    ringEffect(this.p.scene, x, y, aoeRadius * 0.6, 0xffffff, 160);
    burst(this.p.scene, x, y, color, kind === 'light' ? 10 : 5, aoeRadius * 1.3, 4);
    if (kind === 'light') this.p.cam.shake(70, 0.0025);

    const targets = this.p.host.getTargets().filter((t) => t.isAlive());
    if (targets.length === 0) return;

    // ระเบิดโดนร่างปลอม -> แตก แต่เลือดเป้าไม่ลด (เป้าที่ร่างปลอมแตกจะไม่โดนดาเมจตัวจริงจากระเบิดลูกนี้)
    let brokeDecoy = false;
    const bodyTargets: CombatTarget[] = [];
    for (const t of targets) {
      let broke = false;
      for (const dc of t.getDecoys()) {
        const dd = Phaser.Math.Distance.Between(x, y, dc.x, dc.y);
        if (dd <= aoeRadius + dc.r) {
          if (t.hitDecoy(dc.index)) broke = true;
        }
      }
      if (broke) brokeDecoy = true;
      else bodyTargets.push(t);
    }
    if (brokeDecoy) {
      sfx.hit();
      this.p.hitStop(50);
    }

    for (const t of bodyTargets) {
      const d = Phaser.Math.Distance.Between(x, y, t.x, t.y);
      if (d > aoeRadius + t.radius) continue;
      let damage: number;
      if (kind === 'light') {
        const far = ratio >= LUMA.light.farRatio;
        damage = far ? LUMA.light.farDamage : LUMA.light.nearDamage;
        if (far) showDamage(this.p.scene, t.x, t.y - t.height / 2 - 24, 'FAR!', '#9de7ff', 500);
      } else {
      damage = kind === 'combo' ? COMBO3_FAN.damage : LUMA.charged.damage;
      }
      this.p.hitTarget(t, damage, actionId);
    }
  }
}
