// src/actors/PlayerActor.ts — ผู้เล่น + ตรรกะต่อสู้ทั้งหมด (ย้ายมาจาก GameScene ใน Phase 3A)
// ใช้ร่วมกันได้ทั้งห้องฝึก (GameScene) และ The World (WorldScene)
// ไม่รู้จักบอสโดยตรง — คุยกับเป้าหมายผ่าน CombatTarget ที่ฉากส่งให้ผ่าน host.getTargets()
import Phaser from 'phaser';
import { SPRITE_SCALE, DEPTH } from '../config';
import { showDamage, burst, spawnThrustDir, ringEffect, makeShadow, syncShadow } from '../systems/effects';
import { spawnArcSlash } from '../systems/combatFx';
import { sfx } from '../systems/sfx';
import { PlayerHUD } from '../ui/PlayerHUD';
import { PlayerShot } from '../entities/PlayerShot';
import { CHARACTERS, AKKHANI, LUMA, type CharacterDef } from '../data/characters';
import { loadout } from '../systems/Loadout';
import { COMBO3_SPIN, COMBO3_FAN, skillId, findSkill, ultimateCooldownOf } from '../data/skills';
import { ComboTracker } from '../systems/ComboTracker';
import { huntSession } from '../systems/HuntSession';
import { Perks } from '../systems/Perks';
import { charStarEffectNow, type CharStarEffect } from '../systems/Upgrades';
import { BURN } from '../data/bosses';
import { spawnPixelFx } from '../systems/pixelFx';
import type { CombatTarget } from '../systems/CombatTarget';
import { controls, touch, skillKeyLabel } from '../systems/Controls';

const CLAY_SCALE = 0.68;
const WALK_FRAME_MS = 150;
const AKK_SCALE = 0.43;
const AKK_FRAMES = { idle: 1, walk: 4, attack: 5, charge: 7, thrust: 8, skill: 8, knock: 8 };
type AkkClip = keyof typeof AKK_FRAMES;
const akkKey = (clip: string, i: number) => `akk_${clip}_${String(i).padStart(2, '0')}`;
const KNOCK_HOLD_MS = 1600;
const SKILL_SHIELD_FROM = 3;
const SKILL_SLASH_AT = 5;

// เล็งอัตโนมัติ (โหมดสัมผัส)
const AUTO_MINION_RANGE = 380; // ไม่มีบอสให้เล็ง → เล็งตัวแทะที่อยู่ในระยะนี้
const AUTO_LOCK_TOL = 90; // เป้าที่ล็อกไว้ขยับไม่เกินนี้ต่อเฟรม = ตัวเดิม
const AUTO_SWITCH_RATIO = 1.25; // เป้าใหม่ต้องใกล้กว่าเดิมเกิน 25% ถึงจะสลับ (กันเป้ากระตุก)

// ความรู้สึกหนักตอนตีโดน (ms) — ต้องไม่ขึ้นกับขนาดตัวเลขดาเมจ
// เดิมคิดจากดาเมจตรง ๆ พอขยายสเกลเลือดเป็นหลักร้อยแล้วหยุดเดินเป็นวินาที
const HIT_STOP_BASE_MS = 40;   // พื้นฐานทุกฮิต
const HIT_STOP_PER_100 = 12;   // เพิ่มตามดาเมจ ทุก 100 หน่วย = 12 ms
const HIT_STOP_MAX_MS = 90;    // เพดาน — เกินนี้คือแข็งทื่อ ไม่ใช่หนัก

// ท่าฟันกวาด — โดนเป้าละ 1 ครั้งต่อท่า (handled เก็บเป้าที่ตรวจไปแล้ว)
interface Sweep {
  dir: Phaser.Math.Vector2;
  range: number;
  halfAngle: number;
  damage: number;
  until: number;
  handled: Set<CombatTarget>;
  actionId: number;
  onHit?: () => void;
  onHitFired?: boolean;
}

interface Thrust {
  until: number;
  damage: number;
  handled: Set<CombatTarget>;
  actionId: number;
}

/** สิ่งที่ฉากต้องให้ PlayerActor */
export interface PlayerActorHost {
  /** เป้าหมายทั้งหมดที่ผู้เล่นตีได้ตอนนี้ (บอส / มอนสเตอร์) */
  getTargets(): CombatTarget[];
  /** เรียกหลังเป้าหมายโดนดาเมจ — ไว้อัปเดตแถบเลือดบอส ฯลฯ */
  onTargetDamaged?(target: CombatTarget): void;
  /** ผู้เล่นตาย และเล่นท่า knock จบแล้ว — ฉากเป็นคนโชว์หน้าจอจบ */
  onDeathShown(): void;
  /** ฉากที่ไม่มีการต่อสู้ (ฐาน) ตั้ง true — ปุ่ม J/K ของโหมดคีย์บอร์ดจะไม่ออกท่า (กันชนปุ่มลัด) */
  suppressKeyCombat?: boolean;
}

export class PlayerActor {
  readonly sprite: any;
  readonly character: CharacterDef;

  private scene: Phaser.Scene;
  private host: PlayerActorHost;
  private baseScale: number = CLAY_SCALE;

  private keyW: any;
  private keyA: any;
  private keyS: any;
  private keyD: any;
  private keyJ: any;
  private keyK: any;
  private arrows: any;
  private lastMode: string = '';
  private autoLock: { x: number; y: number } | null = null;
  private attackHeld: boolean = false;
  private attackPressed: boolean = false;
  private attackReleased: boolean = false;
  private skillPressed: boolean = false;
  private attackBufferUntil: number = 0;
  private onPointerDown: (p: Phaser.Input.Pointer) => void;
  private onPointerUp: (p: Phaser.Input.Pointer) => void;

  private isAttacking: boolean = false;
  private isActionLocked: boolean = false;
  private isLunging: boolean = false;
  private isDashing: boolean = false;
  private isCharging: boolean = false;
  private chargeStartAt: number = 0;
  private skillInvincible: boolean = false;
  private actionToken: number = 0;
  private actionSeq: number = 0;
  private actionStartedAt: number = 0;
  private sweep: Sweep | null = null;
  private thrust: Thrust | null = null;
  private skillReadyAt: number = 0;
  // คูลดาวน์แยกต่อช่องสกิล — ช่องไม้ตายใช้ก้อนนี้ (ช่องอื่นจะเพิ่มตอนต่อเข้าระบบ)
  private ultReadyAt: number = 0;
  private shots: PlayerShot[] = [];

  private shield: boolean = false;
  private passiveReadyAt: number = 0;
  private hitCounter: number = 0;
  private lastCountedAction: number = -1;
  // ตัวนับคอมโบ 3 ฮิต (แยกจากตัวนับพาสซีฟของลูมิที่อยู่ข้างบน)
  private combo = new ComboTracker();
  private comboGfx: any;

  private facing = new Phaser.Math.Vector2(1, 0);
  private hitStopUntil: number = 0;

  private playerHP: number = 5;
  private maxPlayerHP: number = 5;
  private isInvincible: boolean = false;
  private isStunned: boolean = false;
  private _isDead: boolean = false;
  private _isVictory: boolean = false;
  private hud: PlayerHUD;
  private playerShadow: any;
  private useClay: boolean = false;

  private chargeGfx: any;
  private shieldRing: any;
  private skillText: any;
  private passiveText: any;
  private charmText: any;
  private burnText: any;
  private perks: Perks;
  private starFx: CharStarEffect; // ผลของดาวตัวละคร อ่านครั้งเดียวตอนสร้าง

  private burnLevel: number = 0;
  private burnExposure: number = 0;
  private burnTick: number = 0;
  private burnDecay: number = 0;
  private burnLastInFire: number = 0;
  private burnImmuneUntil: number = 0;
  private burnFxAt: number = 0;

  private walkFrameTimer: number = 0;
  private walkFrameIndex: number = 0;
  private currentTexture: string = 'hero';
  private useAkk: boolean = false;
  private akkClip: string = '';
  private akkClipStart: number = 0;
  private akkDur: number[] = [];
  private akkClipLoop: boolean = false;

  // ---------------------------------------------------------------
  // โหลดภาพของผู้เล่น — ฉากเรียกใน preload() (โหลดซ้ำได้ Phaser ข้ามให้เอง)
  // ---------------------------------------------------------------
  static preloadAssets(scene: Phaser.Scene) {
    scene.load.image('hero_clay_idle', 'assets/hero_clay_idle.png');
    scene.load.image('hero_clay_walk1', 'assets/hero_clay_walk1.png');
    scene.load.image('hero_clay_walk2', 'assets/hero_clay_walk2.png');
    scene.load.image('hero_clay_attack', 'assets/hero_clay_attack.png');
    scene.load.image('hero', 'assets/hero.png');
    for (const [clip, n] of Object.entries(AKK_FRAMES)) {
      for (let i = 1; i <= n; i++) {
        const nn = String(i).padStart(2, '0');
        scene.load.image(akkKey(clip, i), `assets/characters/akkhani/char_akkhani_${clip}_${nn}.png`);
      }
    }
  }

  constructor(scene: Phaser.Scene, x: number, y: number, host: PlayerActorHost) {
    this.scene = scene;
    this.host = host;
    this.character = CHARACTERS[loadout.characterId];
    this.starFx = charStarEffectNow(this.character.id);

    this.useClay =
      scene.textures.exists('hero_clay_idle') &&
      scene.textures.exists('hero_clay_walk1') &&
      scene.textures.exists('hero_clay_walk2') &&
      scene.textures.exists('hero_clay_attack');
    this.useAkk =
      this.character.id === 'akkhani' &&
      Object.entries(AKK_FRAMES).every(([clip, n]) =>
        Array.from({ length: n }, (_, i) => scene.textures.exists(akkKey(clip, i + 1))).every(Boolean)
      );
    if (this.useAkk) this.useClay = true;
    this.baseScale = this.useAkk ? AKK_SCALE : this.useClay ? CLAY_SCALE : SPRITE_SCALE;

this.maxPlayerHP = this.character.maxHP;
// เลือดข้ามแอเรีย: มีค่าค้างจากแมพก่อน → ใช้ค่านั้น (The World เท่านั้นที่ฝากค่าไว้)
// ห้องฝึก/ทริปแรกไม่ได้ฝาก → เต็มตามปกติ
const carriedHP = huntSession.getTripHP();
this.playerHP = carriedHP !== null ? Phaser.Math.Clamp(carriedHP, 1, this.maxPlayerHP) : this.maxPlayerHP;
    this.facing.set(1, 0);

    const startTexture = this.useAkk ? akkKey('idle', 1) : this.useClay ? 'hero_clay_idle' : 'hero';
    this.sprite = scene.physics.add.sprite(x, y, startTexture) as any;
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDepth(DEPTH.PLAYER);
    this.sprite.setScale(this.baseScale * this.character.scale);
    this.currentTexture = startTexture;

    const minPlayerSide = Math.min(this.sprite.width, this.sprite.height);
    const wantedHitboxDiameter = 48 / Math.max(this.sprite.scaleX, 0.001);
    const hitboxDiameter = Math.min(wantedHitboxDiameter, minPlayerSide * 0.75);
    const hitboxRadius = hitboxDiameter / 2;
    this.sprite.body.setCircle(
      hitboxRadius,
      (this.sprite.width - hitboxDiameter) / 2,
      (this.sprite.height - hitboxDiameter) / 2
    );
    this.applyBaseTint();

    const shadowOffset = this.useClay ? this.sprite.displayHeight / 2 - 6 : 14;
    const shadowWidth = Math.max(26, this.sprite.displayWidth * 0.38);
    const shadowHeight = Math.max(10, this.sprite.displayWidth * 0.14);
    // ระบบเงากลาง P3a
    this.playerShadow = makeShadow(scene, shadowWidth, shadowHeight, DEPTH.PLAYER_SHADOW, 0.35);
    syncShadow(this.playerShadow, this.sprite, 0, false, shadowOffset);

    this.chargeGfx = scene.add.graphics();
    this.chargeGfx.setDepth(DEPTH.PLAYER + 1);
    this.comboGfx = scene.add.graphics();
    this.comboGfx.setDepth(DEPTH.PLAYER + 1);
    this.shieldRing = scene.add.circle(x, y, Math.max(28, this.sprite.displayWidth * 0.36));
    this.shieldRing.setStrokeStyle(3, 0x66e0ff);
    this.shieldRing.setDepth(DEPTH.PLAYER + 1);
    this.shieldRing.setVisible(false);

    // ---------- ปุ่มและเมาส์ ----------
    const keyboard = scene.input.keyboard as any;
    this.keyW = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyJ = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J);
    this.keyK = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.K);
    this.arrows = keyboard.createCursorKeys();

this.onPointerDown = (p: Phaser.Input.Pointer) => {
  // คลิกโดนปุ่ม/แผงที่ interactive อยู่ (เช่น แผงถุงพกพา) → ไม่ถือเป็นการโจมตี
  if (controls.mode !== 'mouse') return; // โหมดคีย์บอร์ด/สัมผัสไม่ใช้เมาส์ตี
  if (this.scene.input.hitTestPointer(p).length > 0) return;
  if (p.button === 2) {
    this.skillPressed = true;
  } else if (p.button === 0) {
    this.attackHeld = true;
    this.attackPressed = true;
  }
};
    this.onPointerUp = (p: Phaser.Input.Pointer) => {
      if (controls.mode === 'mouse' && p.button === 0 && this.attackHeld) {
        this.attackHeld = false;
        this.attackReleased = true;
      }
    };
    scene.input.on('pointerdown', this.onPointerDown);
    scene.input.on('pointerup', this.onPointerUp);
    scene.input.on('pointerupoutside', this.onPointerUp);
    // ฉากปิด/เปลี่ยนแอเรีย → ถอดตัวฟังเมาส์ออก กันค้างซ้อน
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());

    // ---------- HUD ผู้เล่น ----------
    this.hud = new PlayerHUD(scene, this.maxPlayerHP);
    this.hud.update(this.playerHP); // อัปเดตหลอดเลือดให้ตรงกับค่าที่รับมาข้ามแมพ
    const textStyle = {
      fontFamily: '"Noto Sans Thai", monospace',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    };
    this.skillText = scene.add.text(44, 42, '', textStyle).setDepth(DEPTH.HUD).setScrollFactor(0);
    this.passiveText = scene.add.text(44, 62, '', textStyle).setDepth(DEPTH.HUD).setScrollFactor(0);
    this.charmText = scene.add.text(44, 82, '', textStyle).setDepth(DEPTH.HUD).setScrollFactor(0);
    this.burnText = scene.add.text(44, 102, '', textStyle).setDepth(DEPTH.HUD).setScrollFactor(0);

    // ---------- เครื่องราง + สัตว์เลี้ยง ----------
    this.perks = new Perks({
      scene,
      getPlayer: () => this.sprite,
      getBoss: () => {
        const t = this.nearestHittable();
        return t ? { x: t.x, y: t.y, r: t.radius } : null;
      },
      getHP: () => this.playerHP,
      getMaxHP: () => this.maxPlayerHP,
      heal: (n) => this.healPlayer(n),
      damageBoss: (damage, actionId) => {
        const t = this.nearestHittable();
        if (t) this.hitTarget(t, damage, actionId);
      },
      spawnAfterimage: (color) => this.spawnAfterimage(color)
    });
  }

  // ---------------------------------------------------------------
  // ตัวช่วยสำหรับฉาก
  // ---------------------------------------------------------------
  get x(): number {
    return this.sprite.x;
  }
  get y(): number {
    return this.sprite.y;
  }
  get isDead(): boolean {
    return this._isDead;
  }
  get isVictory(): boolean {
    return this._isVictory;
  }

  private get time() {
    return this.scene.time;
  }
  private get tweens() {
    return this.scene.tweens;
  }
  private get cam() {
    return this.scene.cameras.main;
  }

  /** ผู้เล่นเดินเข้าประตู/จบด่านสำเร็จ — หยุดการควบคุม */
setVictory() {
  this._isVictory = true;
  this.sprite.setVelocity(0);
  this.sprite.setAlpha(1);
}

/** เลือดปัจจุบัน — ฉากใช้ฝากข้ามแอเรีย */
get hp(): number {
  return this.playerHP;
}

/** ฟื้นเลือดจากภายนอก (จุดฟื้นเลือดในแมพ) — คืนจำนวนที่ฟื้นจริง */
heal(n: number): number {
  if (this.isDead || this.isVictory) return 0;
  const before = this.playerHP;
  this.playerHP = Math.min(this.maxPlayerHP, this.playerHP + n);
  const gained = this.playerHP - before;
  if (gained > 0) {
    this.hud.update(this.playerHP);
    showDamage(this.scene, this.sprite.x, this.sprite.y - 20, '+' + gained, '#66ff88');
  }
  return gained;
}

  /** บอสตัวที่ผูกกับการสู้ตายแล้ว — ล้างท่าที่ค้างอยู่ (ห้องฝึกเรียกตอนบอสตาย) */
  endEncounter() {
    this.sprite.setAlpha(1);
    this.burnLevel = 0;
    this.sweep = null;
    this.thrust = null;
    for (const s of this.shots) s.destroy();
    this.shots = [];
  }

  destroy() {
    this.scene.input.off('pointerdown', this.onPointerDown);
    this.scene.input.off('pointerup', this.onPointerUp);
    this.scene.input.off('pointerupoutside', this.onPointerUp);
  }

  // เป้าหมายที่ตีได้ ใกล้ผู้เล่นที่สุด (เครื่องรางครกจิ๋วใช้)
  private nearestHittable(): CombatTarget | null {
    let best: CombatTarget | null = null;
    let bestD = Infinity;
    for (const t of this.host.getTargets()) {
      if (!t.isHittable()) continue;
      const d = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, t.x, t.y);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  // ---------------------------------------------------------------
  // เรียกทุกเฟรมจากฉาก
  // ---------------------------------------------------------------
  update(delta: number) {
    this.pollNonMouseInput();
    const attackPressed = this.attackPressed;
    const attackReleased = this.attackReleased;
    const skillPressed = this.skillPressed;
    this.attackPressed = false;
    this.attackReleased = false;
    this.skillPressed = false;

    if (this.isDead && this.useAkk) this.updateClip(this.time.now);
    if (this.isDead || this.isVictory) return;

    const now = this.time.now;
    const isHitStopped = now < this.hitStopUntil;

    const speed = this.character.speed * (this.isCharging ? 0.5 : 1) * this.perks.speedMultiplier(now);
    const canMove =
      !isHitStopped && !this.isDashing && !this.isLunging && !this.isStunned && !this.isActionLocked;
    let vx = 0;
    let vy = 0;

    if (canMove) {
      const mv = this.getMoveInput();
      vx = mv.x;
      vy = mv.y;
      this.sprite.setVelocity(vx * speed, vy * speed);
    } else if (isHitStopped) {
      this.sprite.setVelocity(0);
    } else if (this.isActionLocked && !this.isLunging && !this.isDashing && !this.isStunned) {
      this.sprite.setVelocity(0);
    }

    if (!this.isActionLocked && !this.isLunging && !this.isDashing && !this.isStunned) {
      const aim = this.getAimDir();
      this.facing.copy(aim);
      if (Math.abs(aim.x) > 0.15) this.sprite.setFlipX(aim.x < 0);
    }

    if (this.useAkk) {
      this.updateAkkVisual(now, vx !== 0 || vy !== 0);
    } else if (!this.isAttacking) {
      if (vx !== 0 || vy !== 0 || this.isDashing) {
        this.walkFrameTimer += delta;
        if (this.walkFrameTimer >= WALK_FRAME_MS) {
          this.walkFrameTimer = 0;
          this.walkFrameIndex = 1 - this.walkFrameIndex;
          this.setPlayerTexture(this.walkFrameIndex === 0 ? 'hero_clay_walk1' : 'hero_clay_walk2');
        }
      } else {
        this.walkFrameTimer = 0;
        this.setPlayerTexture('hero_clay_idle');
      }
    }

    if (
      skillPressed &&
      now >= this.skillReadyAt &&
      !this.isActionLocked &&
      !this.isStunned &&
      !this.isDashing &&
      !isHitStopped
    ) {
      this.cancelCharge();
      this.performUltimate();
    }

    const canAct =
      !this.isAttacking && !this.isActionLocked && !this.isStunned && !this.isDashing && !isHitStopped;

    if (attackPressed) {
      if (canAct) {
        this.attackBufferUntil = 0;
        this.isCharging = true;
        this.chargeStartAt = now;
      } else {
        this.attackBufferUntil = now + 180;
      }
    } else if (canAct && !this.isCharging && now <= this.attackBufferUntil) {
      this.attackBufferUntil = 0;
      if (this.attackHeld) {
        this.isCharging = true;
        this.chargeStartAt = now;
      } else {
        this.performLight();
      }
    }

    if (this.isCharging) {
      if (this.isStunned || this.isActionLocked || this.isDashing) {
        this.cancelCharge();
      } else {
        const held = now - this.chargeStartAt;
        this.drawCharge(held, now);
        if (attackReleased) {
          this.cancelCharge();
          if (held >= this.chargeNeeded()) this.performCharged();
          else this.performLight();
        }
      }
    }

    this.perks.update(now, delta);
    this.updateBurn(delta, now);
    this.updateSweep(now);
    this.updateThrust(now);

    for (const s of this.shots) s.update(delta);
    this.shots = this.shots.filter((s) => s.isAlive());

    const shadowOffset = this.useClay ? this.sprite.displayHeight / 2 - 6 : 14;
    syncShadow(this.playerShadow, this.sprite, 0, false, this.useClay ? this.sprite.displayHeight / 2 - 6 : 14);
    this.shieldRing.setPosition(this.sprite.x, this.sprite.y);
    this.shieldRing.setVisible(this.shield);
    this.drawComboPips(now);
    this.updateHudTexts(now);
  }

  // ---------------------------------------------------------------
  // ตรวจโดนเป้าหมาย (รองรับหลายเป้า — เป้าละ 1 ครั้งต่อท่า)
  // ---------------------------------------------------------------

  // ตรวจว่าจุดหนึ่งอยู่ในกรวยฟันไหม (ใช้ทั้งตัวจริงและร่างปลอม)
  private inSweepCone(s: Sweep, tx: number, ty: number, tr: number): boolean {
    const dx = tx - this.sprite.x;
    const dy = ty - this.sprite.y;
    const dist = Math.hypot(dx, dy);
    if (dist > s.range + tr) return false;
    if (dist <= tr + 14) return true;
    const dot = Phaser.Math.Clamp((dx * s.dir.x + dy * s.dir.y) / dist, -1, 1);
    const angle = Math.acos(dot);
    const widen = Math.asin(Math.min(1, tr / dist));
    return angle <= Phaser.Math.DegToRad(s.halfAngle) + widen;
  }

  // ตีร่างปลอมแตก — เลือดเป้าไม่ลด (ใช้ทั้งฟัน พุ่ง ระเบิด)
  private breakDecoy(target: CombatTarget, index: number): boolean {
    if (!target.hitDecoy(index)) return false;
    sfx.hit();
    this.cam.shake(90, 0.004);
    this.hitStop(50);
    return true;
  }

  private updateSweep(now: number) {
    const s = this.sweep;
    if (!s) return;
    const targets = this.host.getTargets().filter((t) => t.isAlive());
    if (now > s.until || targets.length === 0) {
      this.sweep = null;
      return;
    }

    for (const t of targets) {
      if (s.handled.has(t)) continue;

      // ร่างปลอมก่อน — ตีโดนร่างปลอมถือว่าเสียท่าไปฟรี (เลือดเป้าไม่ลด)
      let decoyHit = false;
      for (const d of t.getDecoys()) {
        if (this.inSweepCone(s, d.x, d.y, d.r)) {
          s.handled.add(t);
          this.breakDecoy(t, d.index);
          decoyHit = true;
          break;
        }
      }
      if (decoyHit) continue;

      if (!this.inSweepCone(s, t.x, t.y, t.radius)) continue;
      s.handled.add(t);
      this.hitTarget(t, s.damage, s.actionId);
      // ผลพิเศษของท่า (เช่นสกิลอัคนีฟื้นเลือด) ทำครั้งเดียวต่อท่า ไม่ว่าโดนกี่เป้า
      if (!s.onHitFired) {
        s.onHitFired = true;
        s.onHit?.();
      }
    }
  }

  private updateThrust(now: number) {
    const t = this.thrust;
    if (!t) return;
    const targets = this.host.getTargets().filter((x) => x.isAlive());
    if (now > t.until || targets.length === 0) {
      this.thrust = null;
      return;
    }

    for (const target of targets) {
      if (t.handled.has(target)) continue;

      // ร่างปลอมขวางทางพุ่ง — ชนแล้วแตก แต่เป้าไม่เจ็บ
      let decoyHit = false;
      for (const dc of target.getDecoys()) {
        const dd = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, dc.x, dc.y);
        if (dd <= dc.r + 30) {
          t.handled.add(target);
          this.breakDecoy(target, dc.index);
          decoyHit = true;
          break;
        }
      }
      if (decoyHit) continue;

      const d = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, target.x, target.y);
      if (d <= target.radius + 30) {
        t.handled.add(target);
        this.hitTarget(target, t.damage, t.actionId);
      }
    }
  }

  // ดาเมจลงเป้าหมาย — จุดเดียวที่ดาเมจผู้เล่นผ่าน (เครื่องราง, ฮิตสต็อป, นับพาสซีฟ)
  private hitTarget(target: CombatTarget, damage: number, actionId: number) {
    if (!target.isHittable()) return;
    damage = this.perks.onPlayerHit(damage, actionId);
    sfx.hit();
    target.takeHit(damage);
    this.host.onTargetDamaged?.(target);
    this.cam.shake(120, 0.006 + damage * 0.002);
    const weight = Math.min(HIT_STOP_MAX_MS, HIT_STOP_BASE_MS + (damage / 100) * HIT_STOP_PER_100);
    this.hitStop(weight);
    if (actionId >= 0) this.countAttackHit(actionId);
  }

  private fireShot(
    dir: Phaser.Math.Vector2,
    cfg: { speed: number; range: number; radius: number; color: number; aoeRadius: number },
    kind: 'light' | 'charge' | 'combo',
    actionId: number
  ) {
    const shot = new PlayerShot(
      this.scene,
      this.sprite.x + dir.x * 14,
      this.sprite.y + dir.y * 14,
      dir.x,
      dir.y,
      { speed: cfg.speed, range: cfg.range, radius: cfg.radius, color: cfg.color },
      // ตัวจริงที่กระสุนชนได้ (เฉพาะที่ตีโดนได้ตอนนี้)
      () =>
        this.host
          .getTargets()
          .filter((t) => t.isHittable())
          .map((t) => ({ x: t.x, y: t.y, r: t.radius })),
      (x, y, ratio) => this.onShotDetonate(kind, actionId, x, y, ratio, cfg.aoeRadius, cfg.color),
      // ร่างปลอมระหว่างทาง — กระสุนชนแล้วระเบิดที่ร่างนั้นเลย
      () => this.host.getTargets().flatMap((t) => t.getDecoys())
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
    ringEffect(this.scene, x, y, aoeRadius + 8, color, 220);
    ringEffect(this.scene, x, y, aoeRadius * 0.6, 0xffffff, 160);
    burst(this.scene, x, y, color, kind === 'light' ? 10 : 5, aoeRadius * 1.3, 4);
    if (kind === 'light') this.cam.shake(70, 0.0025);

    const targets = this.host.getTargets().filter((t) => t.isAlive());
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
      this.hitStop(50);
    }

    for (const t of bodyTargets) {
      const d = Phaser.Math.Distance.Between(x, y, t.x, t.y);
      if (d > aoeRadius + t.radius) continue;
      let damage: number;
      if (kind === 'light') {
        const far = ratio >= LUMA.light.farRatio;
        damage = far ? LUMA.light.farDamage : LUMA.light.nearDamage;
        if (far) showDamage(this.scene, t.x, t.y - t.height / 2 - 24, 'FAR!', '#9de7ff', 500);
      } else {
      damage = kind === 'combo' ? COMBO3_FAN.damage : LUMA.charged.damage;
      }
      this.hitTarget(t, damage, actionId);
    }
  }

  // ---------------------------------------------------------------
  // โดนตี / ไฟไหม้ / ตาย
  // ---------------------------------------------------------------
  /** บอส/มอนสเตอร์ตีผู้เล่น — ฉากส่งต่อมาจาก hooks.onHitTarget */
  takeDamage(amount: number, fromX: number, fromY: number) {
    const player = this.sprite;
    if (this.isDead || this.isVictory || this.isInvincible || this.skillInvincible) return;

    if (this.shield) {
      this.shield = false;
      sfx.hit();
      ringEffect(this.scene, player.x, player.y, 44, 0x66e0ff, 300);
      burst(this.scene, player.x, player.y, 0x66e0ff, 10, 40, 4);
      showDamage(this.scene, player.x, player.y, 'BLOCK', '#66e0ff');
      this.isInvincible = true;
      this.time.delayedCall(450, () => {
        if (!this.isDead) this.isInvincible = false;
      });
      return;
    }

    this.perks.onPlayerHurt();
    this.interruptActions();

    this.playerHP = Math.max(0, this.playerHP - amount);
    this.hud.update(this.playerHP);
    sfx.hurt();
    this.hitStop(80);

    const dx = player.x - fromX;
    const dy = player.y - fromY;
    const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    this.isStunned = true;
    player.setVelocity((dx / len) * 300, (dy / len) * 300);
    this.time.delayedCall(150, () => {
      this.isStunned = false;
      if (!this.isDead) player.setVelocity(0);
    });

    player.setTint(0xff3333).setTintMode(Phaser.TintModes.FILL);
    this.time.delayedCall(100, () => this.applyBaseTint());
    this.cam.shake(200, 0.015);
    this.cam.flash(120, 255, 0, 0);
    showDamage(this.scene, player.x, player.y, '-' + amount, '#ff5555');
    burst(this.scene, player.x, player.y, 0xff3333, 8, 36, 5);

    if (this.playerHP <= 0 && !this.isVictory) {
      this.die();
      return;
    }

    if (this.character.id === 'akkhani' && !this.shield && this.time.now >= this.passiveReadyAt) {
      this.shield = true;
      this.passiveReadyAt = this.time.now + AKKHANI.passive.shieldCooldownMs;
      ringEffect(this.scene, player.x, player.y, 40, 0x66e0ff, 400);
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

  private die() {
    this._isDead = true;
    this.combo.reset();
    this.comboGfx.clear();
    this.cancelCharge();
    this.sprite.setAlpha(1);
    this.shieldRing.setVisible(false);
    burst(this.scene, this.sprite.x, this.sprite.y, 0xff3333, 16, 70, 7);
    const show = () => this.host.onDeathShown();
    if (this.useAkk) {
      this.sprite.setVelocity(0);
      this.playClip('knock', 130, false);
      this.time.delayedCall(KNOCK_HOLD_MS, show);
    } else {
      this.sprite.clearTint(); // รีเซ็ตโหมดฟิลล์ ไม่งั้นสไปรต์เป็นแผ่นเทาทึบ
      this.sprite.setTint(0x555555);
      show();
    }
  }

  // ---------------------------------------------------------------
  // ท่าและภาพ (ย้ายจาก GameScene ตามเดิม)
  // ---------------------------------------------------------------
  private applyBaseTint() {
    if (this.isDead) return; // ตายแล้วห้ามทับสีเทาท่าตาย
    this.sprite.clearTint();
    if (!this.useAkk) this.sprite.setTint(this.character.tint);
  }

  private setPlayerTexture(key: string) {
    if (!this.useClay) return;
    // บล็อกรูป clay เฉพาะตอนเล่นอัคนีที่มีเฟรมจริงเท่านั้น (ลูมิต้องเปลี่ยนรูปได้)
    if (this.useAkk && this.character.id === 'akkhani' && key.startsWith('hero_clay')) return;
    if (this.currentTexture === key) return;
    if (!this.scene.textures.exists(key)) return;
    this.sprite.setTexture(key);
    this.currentTexture = key;
    this.sprite.setScale(this.baseScale * this.character.scale);
  }

  private playClip(clip: AkkClip, frameMs: number | number[], loop: boolean) {
    this.akkClip = clip;
    this.akkClipStart = this.time.now;
    this.akkClipLoop = loop;
    this.akkDur = Array.isArray(frameMs) ? frameMs : Array(AKK_FRAMES[clip]).fill(frameMs);
  }

  private playAttackClip(frameMs: number) {
    if (this.useAkk) this.playClip('attack', frameMs, false);
    else this.setPlayerTexture('hero_clay_attack');
  }

  private updateClip(now: number) {
    if (!this.useAkk || !this.akkClip) return;
    const n = AKK_FRAMES[this.akkClip as AkkClip];
    let t = now - this.akkClipStart;
    if (this.akkClipLoop) {
      const total = this.akkDur.reduce((a, b) => a + b, 0);
      if (total > 0) t = t % total;
    }
    let i = 0;
    while (i < n - 1 && t >= (this.akkDur[i] ?? 100)) {
      t -= this.akkDur[i] ?? 100;
      i++;
    }
    this.setPlayerTexture(akkKey(this.akkClip, i + 1));
  }

  private updateAkkVisual(now: number, moving: boolean) {
    let want = '';
    if (!this.isAttacking) {
      if (this.isCharging && now - this.chargeStartAt >= 120) want = 'charge';
      else want = moving ? 'walk' : 'idle';
    }
    if (want && want !== this.akkClip) {
      if (want === 'walk') this.playClip('walk', 120, true);
      else if (want === 'charge') {
        const ms = Math.max(30, (this.chargeNeeded() - 120) / (AKK_FRAMES.charge - 1));
        this.playClip('charge', ms, false);
      } else this.playClip('idle', 1000, true);
    }
    this.updateClip(now);
  }

  private feetY(): number {
    return this.useAkk
      ? this.sprite.y + this.sprite.displayHeight * 0.45
      : this.sprite.y + this.sprite.displayHeight / 2;
  }

  private slashFx(scale: number) {
    spawnPixelFx(this.scene, 'sword-slash', {
      x: this.sprite.x,
      y: this.feetY(),
      scale,
      flipX: this.sprite.flipX,
      depth: DEPTH.SLASH + 1
    });
  }

  private muzzleFx(dir: Phaser.Math.Vector2, color: number) {
    const mx = this.sprite.x + dir.x * 20;
    const my = this.sprite.y + dir.y * 20;
    spawnArcSlash(this.scene, mx, my, Math.atan2(dir.y, dir.x), 26, 35, color, 3, 130);
    ringEffect(this.scene, mx, my, 18, color, 150);
    burst(this.scene, mx, my, color, 4, 22, 3);
  }

private getAimDir(): Phaser.Math.Vector2 {
  if (controls.mode === 'touch') return this.getAutoAimDir();
  if (controls.mode === 'keys') return this.getFacingDir();
  const p = this.scene.input.activePointer;
  const cam = this.cam;
  // แปลงจุดเมาส์เป็นพิกัดโลกผ่านกล้อง — คิดระยะซูมด้วย (เดิมบวก scroll ตรง ๆ = เล็งเอียงตอนซูม 0.75)
  const world = (cam as any).getWorldPoint
    ? (cam as any).getWorldPoint(p.x, p.y)
    : {
        x: cam.scrollX + (p.x - cam.width / 2) / cam.zoom + cam.width / 2,
        y: cam.scrollY + (p.y - cam.height / 2) / cam.zoom + cam.height / 2
      };
  const dx = world.x - this.sprite.x;
  const dy = world.y - this.sprite.y;
  const len = Math.hypot(dx, dy);
  if (len < 6) return this.facing.clone();
  return new Phaser.Math.Vector2(dx / len, dy / len);
}

  // ทิศตี: เมาส์ = ตามเคอร์เซอร์ · สัมผัส = เล็งอัตโนมัติ · คีย์บอร์ด = ทิศที่หัน + กรวยช่วยเล็ง
  private getAttackDir(assistRange: number, assistAngle: number): Phaser.Math.Vector2 {
    const base = this.getAimDir();
    if (controls.mode === 'keys') return this.assistSnap(base, assistRange, assistAngle);
    return base;
  }

  /** ทิศที่บังคับอยู่ (WASD / ลูกศร / จอย) — ทำเป็นเวกเตอร์หน่วยแล้ว · 0,0 = ไม่ได้บังคับ */
  private getMoveInput(): { x: number; y: number } {
    // จอสัมผัส: ใช้จอยถ้ากำลังแตะอยู่ ไม่งั้นตกไปอ่านคีย์บอร์ด (เครื่องที่มีทั้งจอสัมผัสและคีย์บอร์ดก็เล่นได้)
    if (controls.mode === 'touch' && (touch.moveX !== 0 || touch.moveY !== 0)) return { x: touch.moveX, y: touch.moveY };
    const arr = controls.mode === 'keys' ? this.arrows : null;
    let x = 0;
    let y = 0;
    if (this.keyA.isDown || (arr && arr.left.isDown)) x -= 1;
    if (this.keyD.isDown || (arr && arr.right.isDown)) x += 1;
    if (this.keyW.isDown || (arr && arr.up.isDown)) y -= 1;
    if (this.keyS.isDown || (arr && arr.down.isDown)) y += 1;
    if (x !== 0 || y !== 0) {
      const len = Math.hypot(x, y);
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  /** โหมดคีย์บอร์ด: หันไปทางที่เดินล่าสุด */
  private getFacingDir(): Phaser.Math.Vector2 {
    const mv = this.getMoveInput();
    if (mv.x !== 0 || mv.y !== 0) return new Phaser.Math.Vector2(mv.x, mv.y);
    return this.facing.clone();
  }

  /** โหมดสัมผัส: หันหาบอสที่ใกล้สุด · ไม่มีเป้า = ทางที่เดิน · ไม่เดิน = ทางเดิม */
  private getAutoAimDir(): Phaser.Math.Vector2 {
    const t = this.pickAutoTarget();
    if (t) {
      const dx = t.x - this.sprite.x;
      const dy = t.y - this.sprite.y;
      const len = Math.hypot(dx, dy);
      if (len >= 6) return new Phaser.Math.Vector2(dx / len, dy / len);
    }
    return this.getFacingDir();
  }

  /**
   * เลือกเป้าเล็งอัตโนมัติ: บอสที่ตื่นอยู่ใกล้สุดก่อน (นับร่างปลอมของมายาด้วย — เลือกตามระยะ ไม่เลือกตามจริง/ปลอม)
   * ไม่มีบอส → ตัวแทะในระยะ AUTO_MINION_RANGE · ล็อกเป้าเดิมไว้จนกว่าตัวอื่นจะใกล้กว่าชัดเจน
   */
  private pickAutoTarget(): { x: number; y: number } | null {
    const px = this.sprite.x;
    const py = this.sprite.y;
    const bosses: Array<{ x: number; y: number }> = [];
    const minions: Array<{ x: number; y: number }> = [];
    for (const t of this.host.getTargets()) {
      if (!t.isHittable()) continue;
      const list = t.kind === 'boss' ? bosses : minions;
      list.push({ x: t.x, y: t.y });
      for (const d of t.getDecoys()) list.push({ x: d.x, y: d.y });
    }
    let pool = bosses;
    if (pool.length === 0) {
      pool = minions.filter((m) => Phaser.Math.Distance.Between(px, py, m.x, m.y) <= AUTO_MINION_RANGE);
    }
    if (pool.length === 0) {
      this.autoLock = null;
      return null;
    }
    let best = pool[0];
    let bestD = Infinity;
    for (const c of pool) {
      const d = Phaser.Math.Distance.Between(px, py, c.x, c.y);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (this.autoLock) {
      let prev: { x: number; y: number } | null = null;
      let prevGap = AUTO_LOCK_TOL;
      for (const c of pool) {
        const gap = Phaser.Math.Distance.Between(c.x, c.y, this.autoLock.x, this.autoLock.y);
        if (gap < prevGap) {
          prevGap = gap;
          prev = c;
        }
      }
      if (prev && Phaser.Math.Distance.Between(px, py, prev.x, prev.y) <= bestD * AUTO_SWITCH_RATIO) best = prev;
    }
    this.autoLock = { x: best.x, y: best.y };
    return best;
  }

  /** โหมดคีย์บอร์ด: มีเป้าอยู่ในกรวยหน้าตัวละคร (ค่า assist ของแต่ละท่าใน characters.ts) → ปรับทิศเข้าหาเป้า */
  private assistSnap(base: Phaser.Math.Vector2, range: number, halfAngleDeg: number): Phaser.Math.Vector2 {
    const px = this.sprite.x;
    const py = this.sprite.y;
    const maxRad = Phaser.Math.DegToRad(halfAngleDeg);
    let best = null as Phaser.Math.Vector2 | null;
    let bestAng = Infinity;
    const consider = (x: number, y: number, r: number) => {
      const dx = x - px;
      const dy = y - py;
      const dist = Math.hypot(dx, dy);
      if (dist < 1 || dist - r > range) return;
      const ang = Math.acos(Phaser.Math.Clamp((dx * base.x + dy * base.y) / dist, -1, 1));
      if (ang <= maxRad && ang < bestAng) {
        bestAng = ang;
        best = new Phaser.Math.Vector2(dx / dist, dy / dist);
      }
    };
    for (const t of this.host.getTargets()) {
      if (!t.isHittable()) continue;
      consider(t.x, t.y, t.radius);
      for (const d of t.getDecoys()) consider(d.x, d.y, d.r);
    }
    return best ?? base;
  }

  /** โหมดคีย์บอร์ด (J ตี / K สกิล) และสัมผัส (ปุ่มบนจอ) — แปลงเป็นค่าชุดเดียวกับที่เมาส์เคยตั้งให้ */
  private pollNonMouseInput() {
    const mode = controls.mode;
    if (mode !== this.lastMode) {
      // สลับโหมดกลางเกม — ล้างสถานะปุ่มค้างของโหมดเก่า
      this.lastMode = mode;
      this.attackHeld = false;
      this.attackPressed = false;
      this.attackReleased = false;
      this.skillPressed = false;
      this.autoLock = null;
    }
    if (mode === 'keys') {
      const jDown = Phaser.Input.Keyboard.JustDown(this.keyJ);
      const jUp = Phaser.Input.Keyboard.JustUp(this.keyJ);
      const kDown = Phaser.Input.Keyboard.JustDown(this.keyK);
      if (this.host.suppressKeyCombat) {
        this.attackHeld = false;
        return;
      }
      if (jDown) {
        this.attackPressed = true;
        this.attackHeld = true;
      }
      if (jUp) {
        this.attackReleased = true;
        this.attackHeld = false;
      }
      if (kDown) this.skillPressed = true;
    } else if (mode === 'touch') {
      this.attackHeld = touch.attackDown;
      if (touch.takeAttackPressed()) this.attackPressed = true;
      if (touch.takeAttackReleased()) this.attackReleased = true;
      if (touch.takeSkillPressed()) this.skillPressed = true;
    }
  }


  private chargeNeeded(): number {
    return this.character.id === 'akkhani' ? AKKHANI.charged.holdMs : LUMA.charged.holdMs;
  }

  private cancelCharge() {
    this.isCharging = false;
    this.chargeGfx.clear();
  }

  private drawCharge(held: number, now: number) {
    const g = this.chargeGfx;
    g.clear();
    if (held < 120) return;
    const need = this.chargeNeeded();
    const k = Math.min(1, held / need);
    const ready = held >= need;
    const px = this.sprite.x;
    const py = this.sprite.y;

    g.lineStyle(3, ready ? 0xffd54a : 0xffffff, ready ? 1 : 0.7);
    g.beginPath();
    g.arc(px, py, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k, false);
    g.strokePath();

    if (ready) {
      g.lineStyle(2, 0xffd54a, 0.5);
      g.strokeCircle(px, py, 33 + Math.sin(now / 60) * 3);
    }
  }

  private beginAction(): number {
    this.actionToken++;
    this.actionStartedAt = this.time.now;
    this.isAttacking = false;
    this.isLunging = false;
    this.isActionLocked = false;
    this.sweep = null;
    this.thrust = null;
    return this.actionToken;
  }

  private interruptActions() {
    this.actionToken++;
    this.isAttacking = false;
    this.isActionLocked = false;
    this.isLunging = false;
    this.isDashing = false;
    this.skillInvincible = false;
    this.sweep = null;
    this.thrust = null;
    this.cancelCharge();
    this.setPlayerTexture('hero_clay_idle');
  }

  /** ชื่อไม้ตายที่ใส่ไว้จริง — ไม่มีในตารางก็ใช้ชื่อเดิมของตัวละคร */
  private ultimateName(): string {
    const d = findSkill(loadout.skillOf('ultimate'));
    return d ? d.name : this.character.skillName;
  }

  private updateHudTexts(now: number) {
    const remain = Math.max(0, this.skillReadyAt - now);
    if (remain <= 0) {
      this.skillText.setText(`${skillKeyLabel()} · ${this.ultimateName()} · พร้อม`).setColor('#7dff9a');
    } else {
      this.skillText
        .setText(`${skillKeyLabel()} · ${this.ultimateName()} · ${(remain / 1000).toFixed(1)}s`)
        .setColor('#bbbbbb');
    }

    if (this.character.id === 'akkhani') {
      if (this.shield) {
        this.passiveText.setText('โล่: กันได้ 1 ฮิต').setColor('#66e0ff');
      } else if (now < this.passiveReadyAt) {
        this.passiveText
          .setText(`โล่: คูลดาวน์ ${((this.passiveReadyAt - now) / 1000).toFixed(1)}s`)
          .setColor('#bbbbbb');
      } else {
        this.passiveText.setText('โล่: รอตอนถูกตี').setColor('#bbbbbb');
      }
    } else {
      this.passiveText
        .setText(`นับโจมตี ${this.hitCounter}/${this.starFx.passiveHitsNeeded}`)
        .setColor('#ffc8f5');
    }
    const ch = this.perks.charmHud();
    this.charmText.setText(ch ? ch.text : '').setColor(ch ? ch.color : '#bbbbbb');
    this.burnText
      .setText(this.burnLevel > 0 ? `ไหม้ Lv ${this.burnLevel}/${BURN.maxLevel}` : '')
      .setColor('#ff9a3a');
  }

  /** หยุดเฟรมสั้น ๆ ให้รู้สึกหนัก — ฉากใช้ตอนบอสตาย */
  hitStop(ms: number) {
    this.hitStopUntil = Math.max(this.hitStopUntil, this.time.now + ms);
  }

  private healPlayer(n: number) {
    const before = this.playerHP;
    this.playerHP = Math.min(this.maxPlayerHP, this.playerHP + n);
    const gained = this.playerHP - before;
    if (gained > 0) {
      this.hud.update(this.playerHP);
      showDamage(this.scene, this.sprite.x, this.sprite.y - 20, '+' + gained, '#66ff88');
    }
  }

  private countAttackHit(actionId: number) {
    if (this.character.id !== 'luma') return;
    if (actionId === this.lastCountedAction) return;
    this.lastCountedAction = actionId;
    this.hitCounter++;
    if (this.hitCounter >= this.starFx.passiveHitsNeeded) {
      this.hitCounter = 0;
      this.skillReadyAt = 0;
      showDamage(this.scene, this.sprite.x, this.sprite.y - 40, 'แดชพร้อม!', '#9de7ff', 900);
      ringEffect(this.scene, this.sprite.x, this.sprite.y, 50, 0x9de7ff, 300);
    }
  }

  private performLight() {
    const hit = this.combo.nextHit(this.time.now);
    if (hit === 3) {
      this.performComboFinisher();
      return;
    }
    if (this.character.id === 'akkhani') this.akkhaniLight();
    else this.lumaLight();
  }

  /** ฮิต 3 ของคอมโบ — ผลมาจากสกิลช่องคอมโบที่ใส่ไว้ (ตอนนี้มีเฉพาะตัวเลือก A) */
  private performComboFinisher() {
    const id = loadout.skillOf('combo');
    if (this.character.id === 'akkhani') {
      if (id === skillId('akkhani', 'combo', 'a')) {
        this.akkhaniComboSpin();
        return;
      }
      this.akkhaniLight(); // ยังไม่มีท่านี้ในเกม → ใช้ฟันธรรมดาแทน เกมไม่พัง
      return;
    }
    if (id === skillId('luma', 'combo', 'a')) {
      this.lumaComboFan();
      return;
    }
    this.lumaLight();
  }

  /** อัคนี ฮิต 3 — หมุนฟันรอบตัว โดนทุกทิศ (ภาพชั่วคราว: ใช้คลิป skill เดิม จนกว่าจะมี combo3_spin) */
  private akkhaniComboSpin() {
    const S = COMBO3_SPIN;
    const token = this.beginAction();
    const now = this.time.now;
    const dir = this.getAttackDir(AKKHANI.light.assistRange, AKKHANI.light.assistAngle);
    this.facing.copy(dir);
    if (Math.abs(dir.x) > 0.3) this.sprite.setFlipX(dir.x < 0);
    this.isAttacking = true;
    this.isActionLocked = true; // หมุนอยู่กับที่
    this.sprite.setVelocity(0);
    if (this.useAkk) this.playClip('skill', S.durationMs / AKK_FRAMES.skill, false);
    else this.setPlayerTexture('hero_clay_attack');
    sfx.swing();
    spawnArcSlash(
      this.scene,
      this.sprite.x,
      this.sprite.y,
      Math.atan2(dir.y, dir.x),
      S.range,
      S.halfAngle,
      0xff8a5a,
      7,
      240
    );
    spawnPixelFx(this.scene, 'spin-slash', {
      x: this.sprite.x,
      y: this.feetY(),
      scale: 2,
      depth: DEPTH.SLASH + 1
    });
    this.cam.shake(110, 0.005);
    this.sweep = {
      dir,
      range: S.range,
      halfAngle: S.halfAngle,
      damage: S.damage,
      until: now + S.activeMs,
      handled: new Set<CombatTarget>(),
      actionId: ++this.actionSeq
    };
    this.time.delayedCall(S.durationMs, () => {
      if (token !== this.actionToken) return;
      this.isAttacking = false;
      this.isActionLocked = false;
      this.setPlayerTexture('hero_clay_idle');
    });
  }

  /** ลูมิ ฮิต 3 — ยิงกระสุน 3 ลูกกระจายเป็นพัด (นับพาสซีฟเป็น 1 ครั้ง เพราะใช้รหัสแอ็กชันเดียว) */
  private lumaComboFan() {
    const F = COMBO3_FAN;
    const token = this.beginAction();
    const dir = this.getAttackDir(LUMA.light.assistRange, LUMA.light.assistAngle);
    if (Math.abs(dir.x) > 0.3) this.sprite.setFlipX(dir.x < 0);
    this.facing.copy(dir);
    const actionId = ++this.actionSeq;
    this.isAttacking = true;
    this.setPlayerTexture('hero_clay_attack');
    sfx.swing();
    this.muzzleFx(dir, F.color);
    const baseAngle = Math.atan2(dir.y, dir.x);
    for (let i = 0; i < F.count; i++) {
      const offset = Phaser.Math.DegToRad((i - (F.count - 1) / 2) * F.spreadDeg);
      const d = new Phaser.Math.Vector2(Math.cos(baseAngle + offset), Math.sin(baseAngle + offset));
      this.fireShot(d, F, 'combo', actionId);
    }
    this.time.delayedCall(F.totalMs, () => {
      if (token !== this.actionToken) return;
      this.isAttacking = false;
      this.setPlayerTexture('hero_clay_idle');
    });
  }

  /** จุด 3 จุดเหนือหัว — บอกว่าตีไปถึงฮิตไหนแล้ว (จุดทอง = ฮิต 3 คือท่าคอมโบ) */
  private drawComboPips(now: number) {
    const g = this.comboGfx;
    g.clear();
    const done = this.combo.progress(now);
    if (done <= 0) return;
    const y = this.sprite.y - this.sprite.displayHeight / 2 - 12;
    const gap = 9;
    const x0 = this.sprite.x - gap;
    for (let i = 0; i < 3; i++) {
      const filled = i < done;
      const color = i === 2 ? 0xffd166 : 0xffffff;
      g.fillStyle(0x000000, 0.5);
      g.fillCircle(x0 + i * gap, y, 4);
      g.fillStyle(color, filled ? 0.95 : 0.22);
      g.fillCircle(x0 + i * gap, y, 2.6);
    }
  }

  /** ไม้ตาย = สกิลช่อง Ultimate ที่ใส่ไว้ (ตอนนี้มีเฉพาะตัวเลือก A ของทั้งสองตัวละคร) */
  private performUltimate() {
    const id = loadout.skillOf('ultimate');
    if (this.character.id === 'akkhani') {
      if (id === skillId('akkhani', 'ultimate', 'a')) {
        this.akkhaniSkill();
        return;
      }
      this.akkhaniSkill(); // ยังไม่มีท่านี้ในเกม → ใช้ท่าเดิมแทน เกมไม่พัง
      return;
    }
    if (id === skillId('luma', 'ultimate', 'a')) {
      this.lumaDash(); // ท่าฝนดาวตกยังไม่ทำ — ใช้แดชเดิมเป็นตัวยืนพื้นไปก่อน
      return;
    }
    this.lumaDash();
  }

  private performCharged() {
    if (this.character.id === 'akkhani') this.akkhaniCharged();
    else this.lumaCharged();
  }

  private akkhaniLight() {
    const A = AKKHANI.light;
    const token = this.beginAction();
    const now = this.time.now;
    const dir = this.getAttackDir(A.assistRange, A.assistAngle);
    if (Math.abs(dir.x) > 0.3) this.sprite.setFlipX(dir.x < 0);
    this.facing.copy(dir);

    this.isAttacking = true;
    this.playAttackClip(A.durationMs / AKK_FRAMES.attack);
    sfx.swing();
    spawnArcSlash(
      this.scene,
      this.sprite.x,
      this.sprite.y,
      Math.atan2(dir.y, dir.x),
      A.range,
      A.halfAngle,
      0xff6a5a,
      6,
      180
    );
    this.slashFx(2);
    this.cam.shake(80, 0.003);

    this.sweep = {
      dir,
      range: A.range,
      halfAngle: A.halfAngle,
      damage: A.damage,
      until: now + A.activeMs,
      handled: new Set<CombatTarget>(),
      actionId: ++this.actionSeq
    };

    this.isLunging = true;
    this.sprite.setVelocity(dir.x * A.lungeSpeed, dir.y * A.lungeSpeed);
    this.time.delayedCall(A.lungeMs, () => {
      if (token !== this.actionToken) return;
      this.isLunging = false;
      this.sprite.setVelocity(0);
    });
    this.time.delayedCall(A.durationMs, () => {
      if (token !== this.actionToken) return;
      this.isAttacking = false;
      this.setPlayerTexture('hero_clay_idle');
    });
  }

  private akkhaniCharged() {
    const C = AKKHANI.charged;
    const token = this.beginAction();
    const now = this.time.now;
    const dir = this.getAttackDir(C.assistRange, C.assistAngle);
    if (Math.abs(dir.x) > 0.3) this.sprite.setFlipX(dir.x < 0);
    this.facing.copy(dir);
    const actionId = ++this.actionSeq;

    this.isAttacking = true;
    this.isActionLocked = true;
    this.playAttackClip(C.thrustDelayMs / AKK_FRAMES.attack);
    this.sprite.setVelocity(0);

    sfx.swing();
    spawnArcSlash(
      this.scene,
      this.sprite.x,
      this.sprite.y,
      Math.atan2(dir.y, dir.x),
      C.sweepRange,
      C.sweepHalfAngle,
      0xffb15a,
      7,
      200
    );
    this.slashFx(2);
    this.cam.shake(100, 0.004);
    this.sweep = {
      dir,
      range: C.sweepRange,
      halfAngle: C.sweepHalfAngle,
      damage: C.sweepDamage,
      until: now + C.sweepActiveMs,
      handled: new Set<CombatTarget>(),
      actionId
    };

    this.time.delayedCall(C.thrustDelayMs, () => {
      if (token !== this.actionToken) return;
      if (this.useAkk) this.playClip('thrust', C.thrustMs / AKK_FRAMES.thrust, false);
      this.isLunging = true;
      this.thrust = {
        until: this.time.now + C.thrustMs,
        damage: C.thrustDamage,
        handled: new Set<CombatTarget>(),
        actionId
      };
      // โหมดคีย์บอร์ด/สัมผัส: พุ่งไปทางที่บังคับอยู่ตอนเริ่มพุ่ง (ไม่ได้บังคับ = ทางเดียวกับที่ฟัน) · โหมดเมาส์เหมือนเดิม
      let tdir = dir;
      if (controls.mode !== 'mouse') {
        const mv = this.getMoveInput();
        if (mv.x !== 0 || mv.y !== 0) {
          tdir = new Phaser.Math.Vector2(mv.x, mv.y);
          this.facing.copy(tdir);
          if (Math.abs(tdir.x) > 0.3) this.sprite.setFlipX(tdir.x < 0);
        }
      }
      const thrustSpeed = C.thrustSpeed * this.starFx.thrustSpeedMult;
      this.sprite.setVelocity(tdir.x * thrustSpeed, tdir.y * thrustSpeed);
      sfx.dash();
      spawnThrustDir(this.scene, this.sprite.x, this.sprite.y, tdir.x, tdir.y, 150, 3);
      this.cam.shake(120, 0.005);
      this.time.addEvent({ delay: 40, repeat: 4, callback: () => this.spawnAfterimage(0xff8a5a) });
    });
    this.time.delayedCall(C.thrustDelayMs + C.thrustMs, () => {
      if (token !== this.actionToken) return;
      this.isLunging = false;
      this.sprite.setVelocity(0);
    });

    this.time.delayedCall(C.totalMs, () => {
      if (token !== this.actionToken) return;
      this.isAttacking = false;
      this.isActionLocked = false;
      this.setPlayerTexture('hero_clay_idle');
    });
  }

  private akkhaniSkill() {
    const S = AKKHANI.skill;
    const token = this.beginAction();
    this.skillReadyAt = this.time.now + ultimateCooldownOf(this.character.id);
    this.ultReadyAt = this.skillReadyAt;
    this.isAttacking = true;
    this.isActionLocked = true;
    this.skillInvincible = true;
    this.sprite.setVelocity(0);

    const nPre = SKILL_SLASH_AT - 1;
    const nPost = AKK_FRAMES.skill - nPre;
    if (this.useAkk) {
      const dur = [...Array(nPre).fill(S.windupMs / nPre), ...Array(nPost).fill(S.activeMs / nPost)];
      this.playClip('skill', dur, false);
    } else {
      this.setPlayerTexture('hero_clay_attack');
    }

    ringEffect(this.scene, this.sprite.x, this.sprite.y, 70, 0xffffff, S.windupMs);
    this.tweens.add({
      targets: this.sprite,
      alpha: 0.5,
      duration: 80,
      yoyo: true,
      repeat: Math.floor(S.windupMs / 160)
    });

    const shieldAt = ((SKILL_SHIELD_FROM - 1) * S.windupMs) / nPre;
    this.time.delayedCall(shieldAt, () => {
      if (token !== this.actionToken) return;
      spawnPixelFx(this.scene, 'divine-shield', {
        x: this.sprite.x,
        y: this.feetY(),
        scale: 2,
        depth: DEPTH.SLASH + 1,
        durationMs: S.windupMs - shieldAt,
        fadeOutMs: 100,
        follow: () => ({ x: this.sprite.x, y: this.feetY() })
      });
    });

    this.time.delayedCall(S.windupMs, () => {
      if (token !== this.actionToken) return;
      this.skillInvincible = false;
      this.sprite.setAlpha(1);

      const dir = this.getAttackDir(S.assistRange, S.assistAngle);
      this.facing.copy(dir);
      if (Math.abs(dir.x) > 0.3) this.sprite.setFlipX(dir.x < 0);

      sfx.swing();
      spawnArcSlash(
        this.scene,
        this.sprite.x,
        this.sprite.y,
        Math.atan2(dir.y, dir.x),
        S.range,
        S.halfAngle,
        0xff3b2f,
        10,
        300
      );
      ringEffect(this.scene, this.sprite.x, this.sprite.y, S.range * 0.7, 0xff8a5a, 300);
      spawnPixelFx(this.scene, 'spin-slash', {
        x: this.sprite.x,
        y: this.feetY(),
        scale: 2,
        depth: DEPTH.SLASH + 1
      });
      this.cam.shake(220, 0.012);

      this.sweep = {
        dir,
        range: S.range,
        halfAngle: S.halfAngle,
        damage: S.damage,
        until: this.time.now + S.activeMs,
        handled: new Set<CombatTarget>(),
        actionId: ++this.actionSeq,
        onHit: () => this.healPlayer(this.starFx.skillHeal)
      };
    });

    this.time.delayedCall(S.windupMs + S.recoverMs, () => {
      if (token !== this.actionToken) return;
      this.isAttacking = false;
      this.isActionLocked = false;
      this.setPlayerTexture('hero_clay_idle');
    });
  }

  private lumaLight() {
    const L = LUMA.light;
    const token = this.beginAction();
    const dir = this.getAttackDir(L.assistRange, L.assistAngle);
    if (Math.abs(dir.x) > 0.3) this.sprite.setFlipX(dir.x < 0);
    this.facing.copy(dir);
    this.isAttacking = true;
    this.setPlayerTexture('hero_clay_attack');
    sfx.swing();
    this.muzzleFx(dir, L.color);
    this.fireShot(dir, L, 'light', ++this.actionSeq);
    this.time.delayedCall(L.cooldownMs, () => {
      if (token !== this.actionToken) return;
      this.isAttacking = false;
      this.setPlayerTexture('hero_clay_idle');
    });
  }

  private lumaCharged() {
    const C = LUMA.charged;
    const token = this.beginAction();
    const dir = this.getAttackDir(C.assistRange, C.assistAngle);
    if (Math.abs(dir.x) > 0.3) this.sprite.setFlipX(dir.x < 0);
    this.facing.copy(dir);
    const actionId = ++this.actionSeq;

    this.isAttacking = true;
    this.setPlayerTexture('hero_clay_attack');
    sfx.swing();
    this.cam.shake(100, 0.004);

    const baseAngle = Math.atan2(dir.y, dir.x);
    // ★1 พัดกว้าง: เพิ่มจำนวนนัด แต่คงมุมห่างต่อนัดเดิม (พัดกว้างขึ้นจริง)
    const shotCount = C.count + this.starFx.chargedCountBonus;
    for (let i = 0; i < shotCount; i++) {
      const offset = Phaser.Math.DegToRad((i - (shotCount - 1) / 2) * C.spreadDeg);
      const d = new Phaser.Math.Vector2(Math.cos(baseAngle + offset), Math.sin(baseAngle + offset));
      this.fireShot(d, C, 'charge', actionId);
    }

    this.time.delayedCall(C.totalMs, () => {
      if (token !== this.actionToken) return;
      this.isAttacking = false;
      this.setPlayerTexture('hero_clay_idle');
    });
  }

  private lumaDash() {
    const D = LUMA.dash;
    const token = this.beginAction();
this.skillReadyAt = this.time.now + ultimateCooldownOf(this.character.id);
this.ultReadyAt = this.skillReadyAt;
this.isDashing = true;
    sfx.dash();

    const mv = this.getMoveInput();
    let dx = mv.x;
    let dy = mv.y;
    if (dx === 0 && dy === 0) {
      dx = this.facing.x;
      dy = this.facing.y;
    }
    const len = Math.hypot(dx, dy) || 1;
    // ★2 แดชยาว: เร็วขึ้นและนานขึ้นตามตัวคูณเดียวกัน
    const dashSpeed = D.speed * this.starFx.dashDistMult;
    const dashMs = D.durationMs * this.starFx.dashDistMult;
    this.sprite.setVelocity((dx / len) * dashSpeed, (dy / len) * dashSpeed);
    this.sprite.setAlpha(0.8);

    this.time.addEvent({ delay: 30, repeat: 5, callback: () => this.spawnAfterimage(0x66ccff) });

    this.time.delayedCall(dashMs, () => {
      if (token !== this.actionToken) return;
      this.isDashing = false;
      if (!this.isDead) {
        this.sprite.setAlpha(1);
        this.sprite.setVelocity(0);
      }
    });
  }

  private spawnAfterimage(color: number) {
    const tex = this.useClay ? this.currentTexture : 'hero';
    const ghost = this.scene.add.sprite(this.sprite.x, this.sprite.y, tex);
    ghost.setScale(this.sprite.scaleX, this.sprite.scaleY);
    ghost.setFlipX(this.sprite.flipX);
    ghost.setTint(color);
    ghost.setAlpha(0.5);
    ghost.setDepth(DEPTH.AFTERIMAGE);
    this.tweens.add({
      targets: ghost,
      alpha: 0,
      duration: 250,
      onComplete: () => ghost.destroy()
    });
  }

  /** บอสส่งความร้อนมา (ไฟของภัสมะ) — ฉากส่งต่อจาก hooks.onBurn */
  applyBurn(delta: number) {
    if (this.isDead || this.isVictory || this.skillInvincible) return;
    const now = this.time.now;
    if (now < this.burnImmuneUntil) return;
    this.burnLastInFire = now;

    if (this.burnLevel === 0) {
      // ★2 โล่กันไฟ: ก่อนได้ดาว โล่กันดาเมจได้แต่ยังติดไฟ
      if (this.shield && this.starFx.shieldBlocksBurn) {
        this.shield = false;
        this.burnImmuneUntil = now + BURN.shieldImmuneMs;
        sfx.hit();
        ringEffect(this.scene, this.sprite.x, this.sprite.y, 44, 0x66e0ff, 300);
        showDamage(this.scene, this.sprite.x, this.sprite.y, 'BLOCK', '#66e0ff');
        return;
      }
      this.burnLevel = 1;
      this.burnExposure = 0;
      this.burnTick = 0;
      this.burnDecay = 0;
      return;
    }

    this.burnExposure += delta;
    if (this.burnExposure >= BURN.exposureMsPerLevel && this.burnLevel < BURN.maxLevel) {
      this.burnLevel++;
      this.burnExposure = 0;
      ringEffect(this.scene, this.sprite.x, this.sprite.y, 30, 0xff8a3a, 250);
    }
  }

  private updateBurn(delta: number, now: number) {
    if (this.burnLevel <= 0 || this.isDead || this.isVictory) return;

    if (now - this.burnLastInFire > BURN.graceMs) {
      this.burnDecay += delta;
      if (this.burnDecay >= BURN.decayMsPerLevel) {
        this.burnDecay = 0;
        this.burnLevel--;
        this.burnTick = 0;
      }
    } else {
      this.burnDecay = 0;
    }
    if (this.burnLevel <= 0) return;

    this.burnTick += delta;
    if (this.burnTick >= BURN.tickIntervals[this.burnLevel]) {
      this.burnTick = 0;
      this.burnDamage(BURN.tickDamage);
    }

    if (now - this.burnFxAt > 250) {
      this.burnFxAt = now;
      burst(this.scene, this.sprite.x, this.sprite.y - 6, 0xff8a3a, 2, 18, 3);
    }
  }

  private burnDamage(n: number) {
    if (this.isDead || this.isVictory || this.skillInvincible) return;
    this.perks.onPlayerHurt();
    this.playerHP = Math.max(0, this.playerHP - n);
    this.hud.update(this.playerHP);
    sfx.hurt();
    showDamage(this.scene, this.sprite.x, this.sprite.y, '-' + n, '#ff9a3a');
    burst(this.scene, this.sprite.x, this.sprite.y, 0xff8a3a, 6, 30, 4);
    this.sprite.setTint(0xff8a3a).setTintMode(Phaser.TintModes.FILL);
    this.time.delayedCall(80, () => this.applyBaseTint());
    this.cam.shake(80, 0.004);

    if (this.playerHP <= 0) {
      this.die();
      return;
    }

    if (this.character.id === 'akkhani' && !this.shield && this.time.now >= this.passiveReadyAt) {
      this.shield = true;
      this.passiveReadyAt = this.time.now + AKKHANI.passive.shieldCooldownMs;
      ringEffect(this.scene, this.sprite.x, this.sprite.y, 40, 0x66e0ff, 400);
    }
  }
}
