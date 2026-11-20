// src/characters/AkkhaniKit.ts — ชุดท่าของอัคนี (ย้ายมาจาก PlayerActor)
import Phaser from 'phaser';
import { DEPTH } from '../config';
import { showDamage, burst, spawnThrustDir, ringEffect } from '../systems/effects';
import { spawnArcSlash } from '../systems/combatFx';
import { sfx } from '../systems/sfx';
import { AKKHANI, type CharacterId } from '../data/characters';
import { loadout } from '../systems/Loadout';
import { COMBO3_SPIN, COMBO3_WAVE, COMBO3_TRIANGLE, AKK_PASSIVE_CRIT, AKK_PASSIVE_RUSH, CHARGE_RUSH, CHARGE_HEAL, ULT_SLAM, ULT_STAR, SKILL_SLOTS, findSkill, ultimateCooldownOf, type SkillOption, type SkillSlot } from '../data/skills';
import { spawnPixelFx, hasPixelFx } from '../systems/pixelFx';
import type { CombatTarget } from '../systems/CombatTarget';
import { controls } from '../systems/Controls';
import type { PlayerActor } from '../actors/PlayerActor';
import type { CharacterKit } from './CharacterKit';


// ท่าไม้ตาย A: เฟรมที่เริ่มโล่/เฟรมที่ฟันออก (ตามคลิป skill)
const SKILL_SHIELD_FROM = 3;
const SKILL_SLASH_AT = 5;

// คลื่นดาบของอัคนี (คอมโบ B) — บินทะลุศัตรู โดนเป้าละครั้ง
interface SwordWave {
  gfx: any;
  dx: number;
  dy: number;
  traveled: number;
  handled: Set<CombatTarget>;
  actionId: number;
  dead: boolean;
}

/** อ่านตัวเลือกสกิลที่ใส่ไว้ของตัวละครที่เล่นอยู่ (a/b/c ต่อช่อง) — อ่านครั้งเดียวตอนสร้างผู้เล่น */
function readSkillOptions(char: CharacterId): Record<SkillSlot, SkillOption> {
  const out = {} as Record<SkillSlot, SkillOption>;
  for (const slot of SKILL_SLOTS) {
    const d = findSkill(loadout.skillOf(slot));
    out[slot] = d && d.char === char ? d.option : 'a';
  }
  return out;
}

/**
 * ชุดท่าของอัคนี — พาสซีฟ/คอมโบ/ชาร์จ/ไม้ตาย ทั้ง 12 สกิล
 * ตัวเลขทั้งหมดอยู่ใน data/skills.ts · ของกลาง (เดิน/เล็ง/เลือด/รับดาเมจ) อยู่ที่ PlayerActor
 */
export class AkkhaniKit implements CharacterKit {
  private opt: Record<SkillSlot, SkillOption>;
  private critCount: number = 0;
  private critReady: boolean = false;
  private critActionId: number = -1;
  private rushEnergyMs: number = 0;
  private rushReady: boolean = false;
  private waves: SwordWave[] = [];
  private auraGfx: any;
  private buffUntil: number = 0;
  private passiveReadyAt: number = 0;
  private lastCountedAction: number = -1;

  constructor(private p: PlayerActor) {
    this.opt = readSkillOptions('akkhani');
    this.auraGfx = this.p.scene.add.graphics();
    this.auraGfx.setDepth(DEPTH.PLAYER + 1);
  }

  // ---------------------------------------------------------------
  // จุดเชื่อมกับ PlayerActor (สัญญา CharacterKit)
  // ---------------------------------------------------------------
  speedMult(now: number): number {
    return this.buffSpeedMult(now);
  }

  update(now: number, delta: number): void {
    this.updatePassiveEnergy(delta);
    this.updateWaves(delta);
    this.drawAura(now);
  }

  chargeNeeded(): number {
    if (this.opt.charge === 'b') return CHARGE_RUSH.holdMs;
    if (this.opt.charge === 'c') return CHARGE_HEAL.holdMs;
    return AKKHANI.charged.holdMs;
  }

  /** พาสซีฟ C: พลังเต็มแล้ว ตีปกติครั้งถัดไปกลายเป็นรัว 5 ฮิต */
  lightOverride(): boolean {
    if (this.opt.passive === 'c' && this.rushReady) {
      this.performRush();
      return true;
    }
    return false;
  }

  light(): void {
    this.akkhaniLight();
  }

  /** ฮิต 3 ของคอมโบ — ผลมาจากสกิลช่องคอมโบที่ใส่ไว้ */
  comboFinisher(): void {
    if (this.opt.combo === 'b') this.akkhaniComboWave();
    else if (this.opt.combo === 'c') this.akkhaniComboTriangle();
    else this.akkhaniComboSpin();
  }

  charged(): void {
    if (this.opt.charge === 'b') this.akkhaniRush();
    else if (this.opt.charge === 'c') this.akkhaniHealRush();
    else this.akkhaniCharged();
  }

  ultimate(): void {
    if (this.opt.ultimate === 'b') this.akkhaniUltSlam();
    else if (this.opt.ultimate === 'c') this.akkhaniUltStar();
    else this.akkhaniSkill();
  }

  modifyDamage(damage: number, actionId: number): number {
    return this.applyAkkhaniModifiers(damage, actionId);
  }

  /** ตีโดนจริง 1 ครั้งต่อแอ็กชัน — พาสซีฟ B นับครบแล้วฮิตถัดไปติดคริ */
  onHitLanded(actionId: number): void {
    // นับต่อการโจมตี 1 ครั้ง · การโจมตีที่ติดคริเองไม่นับ
    if (this.opt.passive !== 'b') return;
    if (actionId === this.critActionId || actionId === this.lastCountedAction) return;
    this.lastCountedAction = actionId;
    if (this.critReady) return;
    this.critCount++;
    if (this.critCount >= AKK_PASSIVE_CRIT.hitsNeeded) {
      this.critCount = 0;
      this.critReady = true;
      showDamage(this.p.scene, this.p.sprite.x, this.p.sprite.y - 44, 'คริพร้อม!', '#ffd166', 700);
      ringEffect(this.p.scene, this.p.sprite.x, this.p.sprite.y, 40, 0xffd166, 260);
    }
  }

  /** ผู้เล่นรับดาเมจแต่ยังไม่ตาย — พาสซีฟ A ได้โล่ 1 ฮิต */
  onHurt(): void {
    if (this.opt.passive === 'a' && !this.p.shield && this.p.time.now >= this.passiveReadyAt) {
      this.p.shield = true;
      this.passiveReadyAt = this.p.time.now + AKKHANI.passive.shieldCooldownMs;
      ringEffect(this.p.scene, this.p.sprite.x, this.p.sprite.y, 40, 0x66e0ff, 400);
    }
  }

  updateHud(now: number): void {
    this.updateAkkPassiveText(now);
    const buffLeft = this.buffUntil - now;
    this.p.buffText
      .setText(buffLeft > 0 ? `โหมดบุก ${(buffLeft / 1000).toFixed(1)}s` : '')
      .setColor('#ff8a3a');
  }

  /** จบการเผชิญหน้า (ชนะ/ออกแมพ) — เก็บของที่ลอยค้างอยู่ */
  reset(): void {
    for (const w of this.waves) w.gfx.destroy();
    this.waves = [];
  }

  destroy(): void {
    this.reset();
    this.auraGfx.destroy();
  }

  // ---------------------------------------------------------------
  // ท่าและสถานะของอัคนี
  // ---------------------------------------------------------------
  /** อัคนี ฮิต 3 — หมุนฟันรอบตัว โดนทุกทิศ (ภาพชั่วคราว: ใช้คลิป skill เดิม จนกว่าจะมี combo3_spin) */
  private akkhaniComboSpin() {
    const S = COMBO3_SPIN;
    const token = this.p.beginAction();
    const now = this.p.time.now;
    const dir = this.p.getAttackDir(AKKHANI.light.assistRange, AKKHANI.light.assistAngle);
    this.p.facing.copy(dir);
    if (Math.abs(dir.x) > 0.3) this.p.sprite.setFlipX(dir.x < 0);
    this.p.isAttacking = true;
    this.p.isActionLocked = true; // หมุนอยู่กับที่
    this.p.sprite.setVelocity(0);
    this.p.playSkillClip('combo3_spin', S.durationMs);
    sfx.swing();
    spawnArcSlash(
      this.p.scene,
      this.p.sprite.x,
      this.p.sprite.y,
      Math.atan2(dir.y, dir.x),
      S.range,
      S.halfAngle,
      0xff8a5a,
      7,
      240
    );
    spawnPixelFx(this.p.scene, 'spin-slash', {
      x: this.p.sprite.x,
      y: this.p.feetY(),
      scale: 2,
      depth: DEPTH.SLASH + 1
    });
    this.p.cam.shake(110, 0.005);
    this.p.sweep = {
      dir,
      range: S.range,
      halfAngle: S.halfAngle,
      damage: S.damage,
      until: now + S.activeMs,
      handled: new Set<CombatTarget>(),
      actionId: ++this.p.actionSeq
    };
    this.p.time.delayedCall(S.durationMs, () => {
      if (token !== this.p.actionToken) return;
      this.p.isAttacking = false;
      this.p.isActionLocked = false;
      this.p.setPlayerTexture('hero_clay_idle');
    });
  }

  private akkhaniLight() {
    const A = AKKHANI.light;
    const token = this.p.beginAction();
    const now = this.p.time.now;
    const dir = this.p.getAttackDir(A.assistRange, A.assistAngle);
    if (Math.abs(dir.x) > 0.3) this.p.sprite.setFlipX(dir.x < 0);
    this.p.facing.copy(dir);

    this.p.isAttacking = true;
    this.p.playSkillClip(this.p.lightHit === 2 ? 'combo2' : 'combo1', A.durationMs);
    sfx.swing();
    spawnArcSlash(
      this.p.scene,
      this.p.sprite.x,
      this.p.sprite.y,
      Math.atan2(dir.y, dir.x),
      A.range,
      A.halfAngle,
      0xff6a5a,
      6,
      180
    );
    this.p.slashFx(2);
    this.p.cam.shake(80, 0.003);

    this.p.sweep = {
      dir,
      range: A.range,
      halfAngle: A.halfAngle,
      damage: A.damage,
      until: now + A.activeMs,
      handled: new Set<CombatTarget>(),
      actionId: ++this.p.actionSeq
    };

    this.p.isLunging = true;
    this.p.sprite.setVelocity(dir.x * A.lungeSpeed, dir.y * A.lungeSpeed);
    this.p.time.delayedCall(A.lungeMs, () => {
      if (token !== this.p.actionToken) return;
      this.p.isLunging = false;
      this.p.sprite.setVelocity(0);
    });
    this.p.time.delayedCall(A.durationMs, () => {
      if (token !== this.p.actionToken) return;
      this.p.isAttacking = false;
      this.p.setPlayerTexture('hero_clay_idle');
    });
  }

  private akkhaniCharged() {
    const C = AKKHANI.charged;
    const token = this.p.beginAction();
    const now = this.p.time.now;
    const dir = this.p.getAttackDir(C.assistRange, C.assistAngle);
    if (Math.abs(dir.x) > 0.3) this.p.sprite.setFlipX(dir.x < 0);
    this.p.facing.copy(dir);
    const actionId = ++this.p.actionSeq;

    this.p.isAttacking = true;
    this.p.isActionLocked = true;
    this.p.playSkillClip('combo1', C.thrustDelayMs);
    this.p.sprite.setVelocity(0);

    sfx.swing();
    spawnArcSlash(
      this.p.scene,
      this.p.sprite.x,
      this.p.sprite.y,
      Math.atan2(dir.y, dir.x),
      C.sweepRange,
      C.sweepHalfAngle,
      0xffb15a,
      7,
      200
    );
    this.p.slashFx(2);
    this.p.cam.shake(100, 0.004);
    this.p.sweep = {
      dir,
      range: C.sweepRange,
      halfAngle: C.sweepHalfAngle,
      damage: C.sweepDamage,
      until: now + C.sweepActiveMs,
      handled: new Set<CombatTarget>(),
      actionId
    };

    this.p.time.delayedCall(C.thrustDelayMs, () => {
      if (token !== this.p.actionToken) return;
      this.p.playSkillClip('charge_spin', C.thrustMs);
      this.p.isLunging = true;
      this.p.thrust = {
        until: this.p.time.now + C.thrustMs,
        damage: C.thrustDamage,
        handled: new Set<CombatTarget>(),
        actionId
      };
      // โหมดคีย์บอร์ด/สัมผัส: พุ่งไปทางที่บังคับอยู่ตอนเริ่มพุ่ง (ไม่ได้บังคับ = ทางเดียวกับที่ฟัน) · โหมดเมาส์เหมือนเดิม
      let tdir = dir;
      if (controls.mode !== 'mouse') {
        const mv = this.p.getMoveInput();
        if (mv.x !== 0 || mv.y !== 0) {
          tdir = new Phaser.Math.Vector2(mv.x, mv.y);
          this.p.facing.copy(tdir);
          if (Math.abs(tdir.x) > 0.3) this.p.sprite.setFlipX(tdir.x < 0);
        }
      }
      const thrustSpeed = C.thrustSpeed * this.p.starFx.thrustSpeedMult;
      this.p.sprite.setVelocity(tdir.x * thrustSpeed, tdir.y * thrustSpeed);
      sfx.dash();
      this.p.thrustFx(tdir, C.thrustMs);
      spawnThrustDir(this.p.scene, this.p.sprite.x, this.p.sprite.y, tdir.x, tdir.y, 150, 3);
      this.p.cam.shake(120, 0.005);
      this.p.time.addEvent({ delay: 40, repeat: 4, callback: () => this.p.spawnAfterimage(0xff8a5a) });
    });
    this.p.time.delayedCall(C.thrustDelayMs + C.thrustMs, () => {
      if (token !== this.p.actionToken) return;
      this.p.isLunging = false;
      this.p.sprite.setVelocity(0);
    });

    this.p.time.delayedCall(C.totalMs, () => {
      if (token !== this.p.actionToken) return;
      this.p.isAttacking = false;
      this.p.isActionLocked = false;
      this.p.setPlayerTexture('hero_clay_idle');
    });
  }

  private akkhaniSkill() {
    const S = AKKHANI.skill;
    const token = this.p.beginAction();
    this.p.skillReadyAt = this.p.time.now + ultimateCooldownOf(this.p.character.id);
    this.p.ultReadyAt = this.p.skillReadyAt;
    this.p.isAttacking = true;
    this.p.isActionLocked = true;
    this.p.skillInvincible = true;
    this.p.sprite.setVelocity(0);

    const nSweep = this.p.clips.frames.ulti_sweep ?? 8;
    const nPre = Math.max(1, SKILL_SLASH_AT - 1);
    const nPost = Math.max(1, nSweep - nPre);
    if (this.p.clips.ready) {
      const dur = [...Array(nPre).fill(S.windupMs / nPre), ...Array(nPost).fill(S.activeMs / nPost)];
      this.p.playClip('ulti_sweep', dur, false);
    } else {
      this.p.setPlayerTexture('hero_clay_attack');
    }

    ringEffect(this.p.scene, this.p.sprite.x, this.p.sprite.y, 70, 0xffffff, S.windupMs);
    this.p.tweens.add({
      targets: this.p.sprite,
      alpha: 0.5,
      duration: 80,
      yoyo: true,
      repeat: Math.floor(S.windupMs / 160)
    });

    const shieldAt = ((SKILL_SHIELD_FROM - 1) * S.windupMs) / nPre;
    this.p.time.delayedCall(shieldAt, () => {
      if (token !== this.p.actionToken) return;
      spawnPixelFx(this.p.scene, 'divine-shield', {
        x: this.p.sprite.x,
        y: this.p.feetY(),
        scale: 2,
        depth: DEPTH.SLASH + 1,
        durationMs: S.windupMs - shieldAt,
        fadeOutMs: 100,
        follow: () => ({ x: this.p.sprite.x, y: this.p.feetY() })
      });
    });

    this.p.time.delayedCall(S.windupMs, () => {
      if (token !== this.p.actionToken) return;
      this.p.skillInvincible = false;
      this.p.sprite.setAlpha(1);

      const dir = this.p.getAttackDir(S.assistRange, S.assistAngle);
      this.p.facing.copy(dir);
      if (Math.abs(dir.x) > 0.3) this.p.sprite.setFlipX(dir.x < 0);

      sfx.swing();
      spawnArcSlash(
        this.p.scene,
        this.p.sprite.x,
        this.p.sprite.y,
        Math.atan2(dir.y, dir.x),
        S.range,
        S.halfAngle,
        0xff3b2f,
        10,
        300
      );
      ringEffect(this.p.scene, this.p.sprite.x, this.p.sprite.y, S.range * 0.7, 0xff8a5a, 300);
      spawnPixelFx(this.p.scene, 'spin-slash', {
        x: this.p.sprite.x,
        y: this.p.feetY(),
        scale: 2,
        depth: DEPTH.SLASH + 1
      });
      this.p.cam.shake(220, 0.012);

      this.p.sweep = {
        dir,
        range: S.range,
        halfAngle: S.halfAngle,
        damage: S.damage,
        until: this.p.time.now + S.activeMs,
        handled: new Set<CombatTarget>(),
        actionId: ++this.p.actionSeq,
        onHit: () => this.p.healPlayer(this.p.starFx.skillHeal)
      };
    });

    this.p.time.delayedCall(S.windupMs + S.recoverMs, () => {
      if (token !== this.p.actionToken) return;
      this.p.isAttacking = false;
      this.p.isActionLocked = false;
      this.p.setPlayerTexture('hero_clay_idle');
    });
  }

  private buffSpeedMult(now: number): number {
    return now < this.buffUntil ? ULT_SLAM.speedMult : 1;
  }

  // ---------- พาสซีฟ B: คริติคอล / พาสซีฟ C: สะสมพลังรัว 5 ฮิต ----------
  private applyAkkhaniModifiers(damage: number, actionId: number): number {
    if (this.p.time.now < this.buffUntil) damage = Math.round(damage * ULT_SLAM.damageMult);
    if (this.opt.passive === 'b' && actionId >= 0) {
      if (actionId === this.critActionId) return Math.round(damage * AKK_PASSIVE_CRIT.multiplier);
      if (this.critReady) {
        this.critReady = false;
        this.critCount = 0;
        this.critActionId = actionId;
        showDamage(this.p.scene, this.p.sprite.x, this.p.sprite.y - 44, 'CRIT!', '#ffd166', 700);
        const critFx = spawnPixelFx(this.p.scene, 'crit-hit', {
          x: this.p.sprite.x, y: this.p.feetY(), scale: 1, tint: 0xffd166, fitMs: 420, depth: DEPTH.SLASH + 1
        });
        if (!critFx) ringEffect(this.p.scene, this.p.sprite.x, this.p.sprite.y, 46, 0xffd166, 260);
        return Math.round(damage * AKK_PASSIVE_CRIT.multiplier);
      }
    }
    return damage;
  }

  private fillRushEnergy() {
    this.rushEnergyMs = AKK_PASSIVE_RUSH.chargeMs;
    if (this.rushReady) return;
    this.rushReady = true;
    showDamage(this.p.scene, this.p.sprite.x, this.p.sprite.y - 44, 'พลังเต็ม!', '#ffb15a', 800);
    const fullFx = spawnPixelFx(this.p.scene, 'divine-shield', {
      x: this.p.sprite.x, y: this.p.feetY(), scale: 1, tint: 0xffb15a, add: true,
      durationMs: 420, fadeOutMs: 140, depth: DEPTH.SLASH + 1
    });
    if (!fullFx) ringEffect(this.p.scene, this.p.sprite.x, this.p.sprite.y, 50, 0xffb15a, 320);
  }

  private updatePassiveEnergy(delta: number) {
    if (this.p.character.id !== 'akkhani' || this.opt.passive !== 'c' || this.rushReady) return;
    this.rushEnergyMs += delta;
    if (this.rushEnergyMs >= AKK_PASSIVE_RUSH.chargeMs) this.fillRushEnergy();
  }

  /** ท่าชาร์จ B กระตุ้นพาสซีฟที่ใส่ไว้ทันที */
  private triggerPassiveFromCharge() {
    if (this.opt.passive === 'a') {
      if (!this.p.shield) {
        this.p.shield = true;
        const shieldFx = spawnPixelFx(this.p.scene, 'divine-shield', {
          x: this.p.sprite.x, y: this.p.feetY(), scale: 1, tint: 0x9de7ff, add: true,
          durationMs: 400, fadeOutMs: 140, depth: DEPTH.SLASH + 1
        });
        if (!shieldFx) ringEffect(this.p.scene, this.p.sprite.x, this.p.sprite.y, 40, 0x66e0ff, 400);
        showDamage(this.p.scene, this.p.sprite.x, this.p.sprite.y - 44, 'โล่!', '#66e0ff', 700);
      }
    } else if (this.opt.passive === 'b') {
      if (!this.critReady) {
        this.critReady = true;
        this.critCount = 0;
        showDamage(this.p.scene, this.p.sprite.x, this.p.sprite.y - 44, 'คริพร้อม!', '#ffd166', 700);
      }
    } else {
      this.fillRushEnergy();
    }
  }

  /** พาสซีฟ C: ตีปกติครั้งถัดไปกลายเป็นรัว 5 ฮิตอยู่กับที่ (ฮิตที่ 5 แรงสุด) */
  private performRush() {
    const R = AKK_PASSIVE_RUSH;
    const token = this.p.beginAction();
    this.rushReady = false;
    this.rushEnergyMs = 0;
    this.p.combo.reset();
    const actionId = ++this.p.actionSeq;
    this.p.isAttacking = true;
    this.p.isActionLocked = true;
    this.p.sprite.setVelocity(0);
    this.p.playSkillClip('barrage', R.totalMs);
    // เอฟเฟกต์รัวดาบสีทอง — เล่นจบพร้อมท่าพอดี
    spawnPixelFx(this.p.scene, 'dagger-flurry', {
      x: this.p.sprite.x,
      y: this.p.feetY(),
      scale: 1,
      angle: Math.atan2(this.p.facing.y, this.p.facing.x),
      fitMs: R.totalMs,
      depth: DEPTH.SLASH + 1
    });
    sfx.swing();

    R.hits.forEach((dmg, i) => {
      this.p.time.delayedCall(R.windupMs + i * R.strikeGapMs, () => {
        if (token !== this.p.actionToken) return;
        const last = i === R.hits.length - 1;
        const dir = this.p.getAttackDir(AKKHANI.light.assistRange, AKKHANI.light.assistAngle);
        this.p.facing.copy(dir);
        if (Math.abs(dir.x) > 0.3) this.p.sprite.setFlipX(dir.x < 0);
        sfx.swing();
        spawnArcSlash(
          this.p.scene,
          this.p.sprite.x,
          this.p.sprite.y,
          Math.atan2(dir.y, dir.x),
          R.range,
          R.halfAngle,
          last ? 0xffb15a : 0xff6a5a,
          last ? 9 : 4,
          last ? 240 : 150
        );
        if (last) {
          this.p.slashFx(2);
          this.p.cam.shake(140, 0.006);
        }
        this.p.sweep = {
          dir,
          range: R.range,
          halfAngle: R.halfAngle,
          damage: dmg,
          until: this.p.time.now + R.activeMs,
          handled: new Set<CombatTarget>(),
          actionId
        };
        this.p.updateSweep(this.p.time.now); // ตรวจโดนทันที ไม่รอเฟรมถัดไป — เครื่องกระตุกก็ไม่ข้ามฮิต
      });
    });
    this.p.time.delayedCall(R.totalMs, () => this.p.endAction(token));
  }

  // ---------- คอมโบ B: คลื่นดาบพุ่งหน้า ทะลุศัตรู ----------
  private akkhaniComboWave() {
    const W = COMBO3_WAVE;
    const token = this.p.beginAction();
    const dir = this.p.getAttackDir(AKKHANI.light.assistRange, AKKHANI.light.assistAngle);
    this.p.facing.copy(dir);
    if (Math.abs(dir.x) > 0.3) this.p.sprite.setFlipX(dir.x < 0);
    const actionId = ++this.p.actionSeq;
    this.p.isAttacking = true;
    this.p.isActionLocked = true;
    this.p.sprite.setVelocity(0);
    this.p.playSkillClip('combo3_wave', W.totalMs);
    this.p.time.delayedCall(W.releaseMs, () => {
      if (token !== this.p.actionToken) return;
      sfx.swing();
      this.p.slashFx(2);
      this.p.cam.shake(110, 0.005);
      this.spawnWave(dir, actionId);
    });
    this.p.time.delayedCall(W.totalMs, () => this.p.endAction(token));
  }

  private spawnWave(dir: Phaser.Math.Vector2, actionId: number) {
    const W = COMBO3_WAVE;
    const g = this.p.scene.add.graphics();
    g.setDepth(DEPTH.SLASH);
    g.setBlendMode(Phaser.BlendModes.ADD);
    const cx = -W.halfWidth * 0.4; // จุดศูนย์กลางวงอยู่ด้านหลัง ปลายโค้งชี้ไปข้างหน้า
    g.lineStyle(12, 0xff6a3a, 0.28);
    g.beginPath();
    g.arc(cx, 0, W.halfWidth, -1.2, 1.2, false);
    g.strokePath();
    g.lineStyle(5, 0xffd9a0, 0.95);
    g.beginPath();
    g.arc(cx, 0, W.halfWidth, -1.2, 1.2, false);
    g.strokePath();
    g.setPosition(this.p.sprite.x + dir.x * 30, this.p.sprite.y + dir.y * 30);
    g.setRotation(Math.atan2(dir.y, dir.x));
    this.waves.push({ gfx: g, dx: dir.x, dy: dir.y, traveled: 0, handled: new Set<CombatTarget>(), actionId, dead: false });
  }

  private updateWaves(delta: number) {
    if (this.waves.length === 0) return;
    const W = COMBO3_WAVE;
    const wb = this.p.scene.physics.world.bounds;
    for (const w of this.waves) {
      if (w.dead) continue;
      const step = (W.speed * delta) / 1000;
      w.gfx.x += w.dx * step;
      w.gfx.y += w.dy * step;
      w.traveled += step;

      for (const t of this.p.host.getTargets()) {
        if (!t.isAlive()) continue;
        // ร่างปลอมตรงทาง — คลื่นทะลุไปต่อ แต่ร่างปลอมแตก
        for (const d of t.getDecoys()) {
          if (Phaser.Math.Distance.Between(w.gfx.x, w.gfx.y, d.x, d.y) <= d.r + W.halfWidth) this.p.breakDecoy(t, d.index);
        }
        if (w.handled.has(t) || !t.isHittable()) continue;
        if (Phaser.Math.Distance.Between(w.gfx.x, w.gfx.y, t.x, t.y) <= t.radius + W.halfWidth) {
          w.handled.add(t);
          this.p.hitTarget(t, W.damage, w.actionId);
          burst(this.p.scene, t.x, t.y, 0xff8a5a, 6, 34, 4);
        }
      }

      const outside = w.gfx.x < wb.x || w.gfx.x > wb.right || w.gfx.y < wb.y || w.gfx.y > wb.bottom;
      if (outside || w.traveled >= W.range) {
        w.dead = true;
        const gfx = w.gfx;
        this.p.scene.tweens.add({ targets: gfx, alpha: 0, duration: 140, onComplete: () => gfx.destroy() });
      }
    }
    this.waves = this.waves.filter((w) => !w.dead);
  }

  // ---------- คอมโบ C: ระบำดาบสามเหลี่ยม ----------
  private akkhaniComboTriangle() {
    const T = COMBO3_TRIANGLE;
    const token = this.p.beginAction();
    const dir0 = this.p.getAttackDir(AKKHANI.light.assistRange, AKKHANI.light.assistAngle);
    this.p.facing.copy(dir0);
    if (Math.abs(dir0.x) > 0.3) this.p.sprite.setFlipX(dir0.x < 0);
    const actionId = ++this.p.actionSeq;
    this.p.isAttacking = true;
    this.p.isActionLocked = true;
    this.p.isLunging = true;
    this.p.skillInvincible = true;
    this.p.sprite.setVelocity(0);
    this.p.playSkillClip('combo3_triangle', T.totalMs);
    // เอฟเฟกต์ระบำดาบสีทอง — เกาะตามตัวขณะพุ่งสลับจุดยอด
    spawnPixelFx(this.p.scene, 'dagger-flurry', {
      x: this.p.sprite.x,
      y: this.p.feetY(),
      scale: 1,
      angle: Math.atan2(dir0.y, dir0.x),
      fitMs: T.totalMs,
      depth: DEPTH.SLASH + 1,
      follow: () => ({ x: this.p.sprite.x, y: this.p.feetY() })
    });

    // จุดยอดเทียบจุดเริ่ม (f = ไปข้างหน้า, r = ไปทางขวา) — วนกลับมาใกล้จุดเริ่ม
    const verts = [
      { f: T.forward, r: -T.side },
      { f: T.forward, r: T.side },
      { f: 0, r: 0 }
    ];
    const rx = -dir0.y;
    const ry = dir0.x;
    let curF = 0;
    let curR = 0;
    verts.forEach((v, i) => {
      const df = v.f - curF;
      const dr = v.r - curR;
      curF = v.f;
      curR = v.r;
      const vx = (dir0.x * df + rx * dr) / (T.moveMs / 1000);
      const vy = (dir0.y * df + ry * dr) / (T.moveMs / 1000);
      const tMove = T.windupMs + i * (T.moveMs + T.pauseMs);
      this.p.time.delayedCall(tMove, () => {
        if (token !== this.p.actionToken) return;
        this.p.sprite.setVelocity(vx, vy);
        this.p.spawnAfterimage(0xff8a5a);
      });
      this.p.time.delayedCall(tMove + T.moveMs, () => {
        if (token !== this.p.actionToken) return;
        this.p.sprite.setVelocity(0);
        this.triangleStrike(i, T.damages[i], actionId, dir0);
      });
    });
    this.p.time.delayedCall(T.totalMs, () => this.p.endAction(token));
  }

  private triangleStrike(i: number, damage: number, actionId: number, fallbackDir: Phaser.Math.Vector2) {
    const T = COMBO3_TRIANGLE;
    // ฟันเข้าหาเป้าที่ใกล้สุด ไม่มีเป้าก็ฟันทางเดิม
    let dir = fallbackDir.clone();
    const t = this.p.nearestHittable();
    if (t) {
      const dx = t.x - this.p.sprite.x;
      const dy = t.y - this.p.sprite.y;
      const len = Math.hypot(dx, dy);
      if (len >= 6) dir = new Phaser.Math.Vector2(dx / len, dy / len);
    }
    this.p.facing.copy(dir);
    if (Math.abs(dir.x) > 0.3) this.p.sprite.setFlipX(dir.x < 0);
    const last = i === T.damages.length - 1;
    sfx.swing();
    spawnArcSlash(
      this.p.scene,
      this.p.sprite.x,
      this.p.sprite.y,
      Math.atan2(dir.y, dir.x),
      T.range,
      T.halfAngle,
      last ? 0xff5a3a : 0xff8a5a,
      last ? 9 : 6,
      220
    );
    this.p.cam.shake(last ? 120 : 80, last ? 0.006 : 0.004);
    this.p.sweep = {
      dir,
      range: T.range,
      halfAngle: T.halfAngle,
      damage,
      until: this.p.time.now + T.activeMs,
      handled: new Set<CombatTarget>(),
      actionId
    };
    this.p.updateSweep(this.p.time.now); // ตรวจโดนทันที ไม่รอเฟรมถัดไป
  }

  // ---------- ชาร์จ B: พุ่งทันที + กระตุ้นพาสซีฟ ----------
  private akkhaniRush() {
    const C = CHARGE_RUSH;
    const token = this.p.beginAction();
    const base = this.p.getAttackDir(AKKHANI.charged.assistRange, AKKHANI.charged.assistAngle);
    const dir = this.p.rushDirection(base);
    this.p.facing.copy(dir);
    if (Math.abs(dir.x) > 0.3) this.p.sprite.setFlipX(dir.x < 0);
    const actionId = ++this.p.actionSeq;
    this.p.isAttacking = true;
    this.p.isActionLocked = true;
    this.p.isLunging = true;
    this.triggerPassiveFromCharge();
    this.p.playSkillClip('charge_rush', C.totalMs);
    this.p.thrust = {
      until: this.p.time.now + C.durationMs,
      damage: C.damage,
      handled: new Set<CombatTarget>(),
      actionId
    };
    this.p.sprite.setVelocity(dir.x * C.speed, dir.y * C.speed);
    sfx.dash();
    this.p.thrustFx(dir, C.durationMs);
    spawnThrustDir(this.p.scene, this.p.sprite.x, this.p.sprite.y, dir.x, dir.y, 150, 3);
    this.p.cam.shake(110, 0.005);
    this.p.time.addEvent({ delay: 40, repeat: 4, callback: () => this.p.spawnAfterimage(0xff8a5a) });
    this.p.time.delayedCall(C.durationMs, () => {
      if (token !== this.p.actionToken) return;
      this.p.isLunging = false;
      this.p.sprite.setVelocity(0);
    });
    this.p.time.delayedCall(C.totalMs, () => this.p.endAction(token));
  }

  // ---------- ชาร์จ C: พุ่งฟัน ถ้าโดนฟื้นเลือด ----------
  private akkhaniHealRush() {
    const C = CHARGE_HEAL;
    const token = this.p.beginAction();
    const base = this.p.getAttackDir(AKKHANI.charged.assistRange, AKKHANI.charged.assistAngle);
    const dir = this.p.rushDirection(base);
    this.p.facing.copy(dir);
    if (Math.abs(dir.x) > 0.3) this.p.sprite.setFlipX(dir.x < 0);
    const actionId = ++this.p.actionSeq;
    this.p.isAttacking = true;
    this.p.isActionLocked = true;
    this.p.isLunging = true;
    this.p.playSkillClip('charge_heal', C.totalMs);
    this.p.thrust = {
      until: this.p.time.now + C.durationMs,
      damage: C.damage,
      handled: new Set<CombatTarget>(),
      actionId,
      onHit: () => {
        const n = Math.round((this.p.maxPlayerHP * C.healPercent) / 100);
        this.p.healPlayer(n);
        const healFx = spawnPixelFx(this.p.scene, 'heal', {
          x: this.p.sprite.x, y: this.p.feetY(), scale: 1, fitMs: 700, depth: DEPTH.SLASH + 1
        });
        if (!healFx) {
          burst(this.p.scene, this.p.sprite.x, this.p.sprite.y, 0x7dff9b, 10, 40, 4);
          ringEffect(this.p.scene, this.p.sprite.x, this.p.sprite.y, 44, 0x7dff9b, 320);
        }
      }
    };
    this.p.sprite.setVelocity(dir.x * C.speed, dir.y * C.speed);
    sfx.dash();
    this.p.thrustFx(dir, C.durationMs);
    spawnThrustDir(this.p.scene, this.p.sprite.x, this.p.sprite.y, dir.x, dir.y, 170, 3);
    this.p.cam.shake(110, 0.005);
    this.p.time.addEvent({ delay: 40, repeat: 5, callback: () => this.p.spawnAfterimage(0xff8a5a) });
    // รอยฟันสั้นระหว่างพุ่งผ่าน
    this.p.time.delayedCall(Math.round(C.durationMs * 0.4), () => {
      if (token !== this.p.actionToken) return;
      spawnArcSlash(this.p.scene, this.p.sprite.x, this.p.sprite.y, Math.atan2(dir.y, dir.x), 80, 100, 0xffb15a, 6, 180);
    });
    this.p.time.delayedCall(C.durationMs, () => {
      if (token !== this.p.actionToken) return;
      this.p.isLunging = false;
      this.p.sprite.setVelocity(0);
    });
    this.p.time.delayedCall(C.totalMs, () => this.p.endAction(token));
  }

  // ---------- ไม้ตาย B: ฟาดพื้น คลื่นกระแทก + บัฟ ----------
  private akkhaniUltSlam() {
    const U = ULT_SLAM;
    const token = this.p.beginAction();
    this.p.skillReadyAt = this.p.time.now + ultimateCooldownOf(this.p.character.id);
    this.p.ultReadyAt = this.p.skillReadyAt;
    this.p.isAttacking = true;
    this.p.isActionLocked = true;
    this.p.sprite.setVelocity(0);
    this.p.playSkillClip('ulti_slam', U.windupMs + U.recoverMs);
    ringEffect(this.p.scene, this.p.sprite.x, this.p.sprite.y, 56, 0xffb15a, U.windupMs);

    this.p.time.delayedCall(U.windupMs, () => {
      if (token !== this.p.actionToken) return;
      const x = this.p.sprite.x;
      const y = this.p.sprite.y;
      sfx.swing();
      const slamFx = spawnPixelFx(this.p.scene, 'ground-slam', {
        x, y: this.p.feetY(), scale: 1, fitMs: 900, depth: DEPTH.SLASH + 1
      });
      if (!slamFx) {
        ringEffect(this.p.scene, x, y, U.radius, 0xffb15a, 420);
        ringEffect(this.p.scene, x, y, U.radius * 0.6, 0xffffff, 280);
        burst(this.p.scene, x, y, 0xc9a06a, 16, U.radius * 0.9, 5);
      }
      this.p.cam.shake(240, 0.012);
      this.p.sweep = {
        dir: this.p.facing.clone(),
        range: U.radius,
        halfAngle: 180,
        damage: U.damage,
        until: this.p.time.now + 120,
        handled: new Set<CombatTarget>(),
        actionId: ++this.p.actionSeq
      };
      // บัฟโหมดบุก: เร็วขึ้น + ดาเมจเพิ่ม + โล่ 1 ฮิต
      this.buffUntil = this.p.time.now + U.buffMs;
      this.p.shield = true;
      showDamage(this.p.scene, x, y - 44, 'โหมดบุก!', '#ff8a3a', 800);
    });
    this.p.time.delayedCall(U.windupMs + U.recoverMs, () => this.p.endAction(token));
  }

  // ---------- ไม้ตาย C: ดาบ 7 เล่ม หายตัว ฟันดาว 7 แฉก ----------
  private akkhaniUltStar() {
    const U = ULT_STAR;
    const token = this.p.beginAction();
    this.p.skillReadyAt = this.p.time.now + ultimateCooldownOf(this.p.character.id);
    this.p.ultReadyAt = this.p.skillReadyAt;
    const cx = this.p.sprite.x;
    const cy = this.p.sprite.y;
    this.p.isAttacking = true;
    this.p.isActionLocked = true;
    this.p.skillInvincible = true;
    this.p.sprite.setVelocity(0);
    const total = U.windupMs + U.vanishMs + U.recoverMs;
    const nStar = this.p.clips.frames.ulti_star ?? 8;
    if (nStar >= 6) {
      // เฟรม 01–04 = ช่วงร่าย · เฟรม 05 ค้างตลอดช่วงหายตัว · เฟรมที่เหลือ = ช่วงปรากฏตัว
      const pre = 4;
      const post = nStar - pre - 1;
      const dur = [
        ...Array(pre).fill(U.windupMs / pre),
        U.vanishMs,
        ...Array(post).fill(U.recoverMs / post)
      ];
      this.p.playSkillClip('ulti_star', total, dur);
    } else {
      this.p.playSkillClip('ulti_star', total);
    }

    // ช่วงที่ 1: เงาดาบ 7 เล่มล้อมตัว หมุนแล้วรวมเข้าหากลาง
    const blades = this.p.scene.add.graphics();
    blades.setDepth(DEPTH.SLASH);
    blades.setBlendMode(Phaser.BlendModes.ADD);
    blades.lineStyle(4, 0xffb15a, 0.9);
    for (let k = 0; k < U.points; k++) {
      const a = -Math.PI / 2 + (k * Math.PI * 2) / U.points;
      blades.beginPath();
      blades.moveTo(Math.cos(a) * 34, Math.sin(a) * 34);
      blades.lineTo(Math.cos(a) * 66, Math.sin(a) * 66);
      blades.strokePath();
    }
    blades.setPosition(cx, cy);
    blades.setAlpha(0);
    this.p.scene.tweens.add({
      targets: blades,
      alpha: 1,
      rotation: 1.2,
      duration: U.windupMs,
      onComplete: () => {
        this.p.scene.tweens.add({ targets: blades, alpha: 0, scale: 0.2, duration: 160, onComplete: () => blades.destroy() });
      }
    });
    ringEffect(this.p.scene, cx, cy, 70, 0xffffff, U.windupMs);

    // ช่วงที่ 2: หายตัว
    this.p.time.delayedCall(U.windupMs, () => {
      if (token !== this.p.actionToken) return;
      this.p.vanished = true;
      // เอฟเฟกต์หายตัวสีทอง — จบพร้อมช่วงหายตัว ไม่ค้างหลังปรากฏตัว
      spawnPixelFx(this.p.scene, 'blink-out', {
        x: cx,
        y: this.p.feetY(),
        scale: 1,
        fitMs: U.vanishMs,
        depth: DEPTH.SLASH + 1
      });
      this.p.sprite.setAlpha(0);
      burst(this.p.scene, cx, cy, 0xff8a5a, 12, 60, 4);
    });

    // รอยฟันดาว 7 แฉกปรากฏพร้อมกัน
    this.p.time.delayedCall(U.windupMs + U.starDelayMs, () => {
      if (token !== this.p.actionToken) return;
      sfx.swing();
      this.drawStar(cx, cy);
      this.p.cam.shake(260, 0.012);
      this.p.sweep = {
        dir: new Phaser.Math.Vector2(1, 0),
        range: U.radius,
        halfAngle: 180,
        damage: U.damage,
        until: this.p.time.now + 150,
        handled: new Set<CombatTarget>(),
        actionId: ++this.p.actionSeq
      };
    });

    // ช่วงที่ 3: ปรากฏตัวกลางดาว
    this.p.time.delayedCall(U.windupMs + U.vanishMs, () => {
      if (token !== this.p.actionToken) return;
      this.p.vanished = false;
      this.p.sprite.setAlpha(1);
      const backFx = spawnPixelFx(this.p.scene, 'spin-slash', {
        x: cx, y: this.p.feetY(), scale: 1, tint: 0xff8a5a, add: true, depth: DEPTH.SLASH + 1
      });
      if (!backFx) {
        ringEffect(this.p.scene, cx, cy, 60, 0xff8a5a, 300);
        burst(this.p.scene, cx, cy, 0xff8a5a, 10, 50, 4);
      }
    });
    this.p.time.delayedCall(total, () => this.p.endAction(token));
  }

  /** ดาว 7 แฉกเส้นตัดกัน (จุดยอด k เชื่อมจุด k+3) สีส้มแดงเรืองแสง ค้างสั้น ๆ แล้วจาง */
  private drawStar(cx: number, cy: number) {
    const U = ULT_STAR;
    const g = this.p.scene.add.graphics();
    g.setDepth(DEPTH.ENEMY_SHADOW);
    g.setBlendMode(Phaser.BlendModes.ADD);
    const pts: { x: number; y: number }[] = [];
    for (let k = 0; k < U.points; k++) {
      const a = -Math.PI / 2 + (k * Math.PI * 2) / U.points;
      pts.push({ x: cx + Math.cos(a) * U.radius, y: cy + Math.sin(a) * U.radius });
    }
    for (const [width, alpha, color] of [[12, 0.22, 0xff3b2f], [4, 0.95, 0xffb08a]] as Array<[number, number, number]>) {
      g.lineStyle(width, color, alpha);
      for (let k = 0; k < U.points; k++) {
        const a = pts[k];
        const b = pts[(k + 3) % U.points];
        g.beginPath();
        g.moveTo(a.x, a.y);
        g.lineTo(b.x, b.y);
        g.strokePath();
      }
      g.beginPath();
      g.arc(cx, cy, U.radius, 0, Math.PI * 2, false);
      g.strokePath();
    }
    this.p.scene.tweens.add({
      targets: g,
      alpha: 0,
      delay: 260,
      duration: 480,
      onComplete: () => g.destroy()
    });
  }

  // ---------- ภาพบอกสถานะ: ประกายพาสซีฟ / ออร่าโหมดบุก ----------
  private drawAura(now: number) {
    const g = this.auraGfx;
    g.clear();
    if (this.p.character.id !== 'akkhani' || this.p._isDead || this.p.vanished) return;
    const px = this.p.sprite.x;
    const py = this.p.sprite.y;
    const r = Math.max(30, this.p.sprite.displayWidth * 0.42);

    if (now < this.buffUntil) {
      const left = this.buffUntil - now;
      const a = left < 1000 ? 0.25 + 0.25 * Math.sin(now / 60) : 0.55;
      g.lineStyle(3, 0xff8a3a, a);
      g.strokeCircle(px, py, r + 6 + Math.sin(now / 120) * 2);
    }

    if (this.opt.passive === 'b') {
      const n = this.critReady ? 4 : this.critCount;
      for (let i = 0; i < n; i++) {
        const a = now / 420 + (i * Math.PI) / 2;
        g.fillStyle(0xffd166, 0.95);
        g.fillCircle(px + Math.cos(a) * r, py + Math.sin(a) * r * 0.7, 3);
      }
      if (this.critReady) {
        g.lineStyle(2, 0xffd166, 0.5 + 0.3 * Math.sin(now / 80));
        g.strokeCircle(px, py, r + 2);
      }
    } else if (this.opt.passive === 'c') {
      if (this.rushReady) {
        g.lineStyle(3, 0xffb15a, 0.6 + 0.3 * Math.sin(now / 70));
        g.strokeCircle(px, py, r + 3);
      } else {
        const k = this.rushEnergyMs / AKK_PASSIVE_RUSH.chargeMs;
        if (k > 0.05) {
          g.lineStyle(2, 0xff5a3a, 0.15 + 0.35 * k);
          g.strokeCircle(px, py, r * (0.6 + 0.4 * k));
        }
      }
    }
  }

  private updateAkkPassiveText(now: number) {
    const t = this.p.passiveText;
    if (this.opt.passive === 'b') {
      if (this.critReady) t.setText('คริติคอล: ฮิตถัดไปติดคริ!').setColor('#ffd166');
      else t.setText(`คริติคอล: ${this.critCount}/${AKK_PASSIVE_CRIT.hitsNeeded}`).setColor('#ffe9a3');
      return;
    }
    if (this.opt.passive === 'c') {
      if (this.rushReady) t.setText('พลังเต็ม: ตีปกติ = รัว 5 ฮิต!').setColor('#ffb15a');
      else {
        const pct = Math.floor((this.rushEnergyMs / AKK_PASSIVE_RUSH.chargeMs) * 100);
        t.setText(`สะสมพลัง: ${pct}%`).setColor('#ffc8a0');
      }
      return;
    }
    if (this.p.shield) t.setText('โล่: กันได้ 1 ฮิต').setColor('#66e0ff');
    else if (now < this.passiveReadyAt) {
      t.setText(`โล่: คูลดาวน์ ${((this.passiveReadyAt - now) / 1000).toFixed(1)}s`).setColor('#bbbbbb');
    } else t.setText('โล่: รอตอนถูกตี').setColor('#bbbbbb');
  }
}
