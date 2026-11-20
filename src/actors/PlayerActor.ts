// src/actors/PlayerActor.ts — ผู้เล่น (ส่วนกลาง): เดิน / เล็ง / เลือด / รับดาเมจ / ไฟไหม้ / HUD / ภาพ / คอมโบ
// ท่าตี ท่าชาร์จ ไม้ตาย และพาสซีฟของแต่ละตัวละครอยู่ใน src/characters/ (ชุดท่า) — ไฟล์นี้ไม่รู้จักชื่อตัวละคร
// ไม่รู้จักบอสโดยตรง — คุยกับเป้าหมายผ่าน CombatTarget ที่ฉากส่งให้ผ่าน host.getTargets()
import Phaser from 'phaser';
import { SPRITE_SCALE, DEPTH } from '../config';
import { showDamage, burst, ringEffect, makeShadow, syncShadow } from '../systems/effects';
import { spawnArcSlash } from '../systems/combatFx';
import { sfx } from '../systems/sfx';
import { PlayerHUD } from '../ui/PlayerHUD';
import { CHARACTERS, type CharacterDef } from '../data/characters';
import { loadout } from '../systems/Loadout';
import { findSkill } from '../data/skills';
import { ComboTracker } from '../systems/ComboTracker';
import { ClipSet } from '../systems/ClipSet';
import { createKit } from '../characters/registry';
import type { CharacterKit } from '../characters/CharacterKit';
import { huntSession } from '../systems/HuntSession';
import { Perks } from '../systems/Perks';
import { charStarEffectNow, type CharStarEffect } from '../systems/Upgrades';
import { BURN } from '../data/bosses';
import { spawnPixelFx } from '../systems/pixelFx';
import type { CombatTarget } from '../systems/CombatTarget';
import { controls, touch, skillKeyLabel } from '../systems/Controls';

const CLAY_SCALE = 0.68;

// แรงสั่นจอตอนตีโดน — ห้ามคูณตามดาเมจตรง ๆ (บทเรียนเดียวกับ	hit-stop)
// เดิม: 0.006 + damage * 0.002 → ดาเมจ 200 = 0.406 จอสะบัดแรงกว่าตอนโดนตีหลายเท่า
const SHAKE_BASE = 0.004;     // พื้นฐานทุกฮิต
const SHAKE_PER_100 = 0.002;  // เพิ่มทุก 100 ดาเมจ
const SHAKE_MAX = 0.012;      // เพดาน — เท่าท่าไม้ตาย ไม่เกินตอนโดนตี (0.015)
const WALK_FRAME_MS = 150;
// รายการคลิป/จำนวนเฟรม/สเกล ย้ายไป data/characterArt.ts แล้ว — ตัวเล่นอยู่ที่ systems/ClipSet.ts
const KNOCK_HOLD_MS = 1600;

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
  onHit?: () => void;
  onHitFired?: boolean;
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

  scene: Phaser.Scene;
  host: PlayerActorHost;
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

  isAttacking: boolean = false;
  isActionLocked: boolean = false;
  isLunging: boolean = false;
  isDashing: boolean = false;
  private isCharging: boolean = false;
  private chargeStartAt: number = 0;
  skillInvincible: boolean = false;
  actionToken: number = 0;
  actionSeq: number = 0;
  private actionStartedAt: number = 0;
  sweep: Sweep | null = null;
  thrust: Thrust | null = null;
  skillReadyAt: number = 0;
  // คูลดาวน์แยกต่อช่องสกิล — ช่องไม้ตายใช้ก้อนนี้ (ช่องอื่นจะเพิ่มตอนต่อเข้าระบบ)
  ultReadyAt: number = 0;

  shield: boolean = false;
  // ตัวนับคอมโบ 3 ฮิต (แยกจากตัวนับพาสซีฟของลูมิที่อยู่ข้างบน)
  combo = new ComboTracker();
  /** เลขฮิตตีปกติที่กำลังจะออก (1/2) — ชุดท่าใช้อ่านเลือกคลิป combo1/combo2 */
  lightHit: number = 1;
  private comboGfx: any;
  // ชุดท่าของตัวละครที่เล่นอยู่ (ท่าตี/ชาร์จ/ไม้ตาย/พาสซีฟ) — ดู src/characters/
  private kit!: CharacterKit;
  buffText: any;
  vanished: boolean = false;

  facing = new Phaser.Math.Vector2(1, 0);
  private hitStopUntil: number = 0;

  private playerHP: number = 5;
  maxPlayerHP: number = 5;
  private isInvincible: boolean = false;
  private isStunned: boolean = false;
  _isDead: boolean = false;
  private _isVictory: boolean = false;
  private hud: PlayerHUD;
  private playerShadow: any;
  private useClay: boolean = false;

  private chargeGfx: any;
  private shieldRing: any;
  private skillText: any;
  passiveText: any;
  private charmText: any;
  private burnText: any;
  private perks: Perks;
  starFx: CharStarEffect; // ผลของดาวตัวละคร อ่านครั้งเดียวตอนสร้าง

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
  clips!: ClipSet;

  // ---------------------------------------------------------------
  // โหลดภาพของผู้เล่น — ฉากเรียกใน preload() (โหลดซ้ำได้ Phaser ข้ามให้เอง)
  // ---------------------------------------------------------------
  static preloadAssets(scene: Phaser.Scene) {
    scene.load.image('hero_clay_idle', 'assets/hero_clay_idle.png');
    scene.load.image('hero_clay_walk1', 'assets/hero_clay_walk1.png');
    scene.load.image('hero_clay_walk2', 'assets/hero_clay_walk2.png');
    scene.load.image('hero_clay_attack', 'assets/hero_clay_attack.png');
    scene.load.image('hero', 'assets/hero.png');
    ClipSet.loadAll(scene);
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
    this.clips = new ClipSet(scene, this.character.id);
if (this.clips.ready) this.useClay = true;
    this.baseScale = this.clips.ready ? this.clips.scale : this.useClay ? CLAY_SCALE : SPRITE_SCALE;

this.maxPlayerHP = this.character.maxHP;
// เลือดข้ามแอเรีย: มีค่าค้างจากแมพก่อน → ใช้ค่านั้น (The World เท่านั้นที่ฝากค่าไว้)
// ห้องฝึก/ทริปแรกไม่ได้ฝาก → เต็มตามปกติ
const carriedHP = huntSession.getTripHP();
this.playerHP = carriedHP !== null ? Phaser.Math.Clamp(carriedHP, 1, this.maxPlayerHP) : this.maxPlayerHP;
    this.facing.set(1, 0);

    const startTexture = this.clips.ready ? this.clips.keyOf('idle', 1) : this.useClay ? 'hero_clay_idle' : 'hero';
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
    this.buffText = scene.add.text(44, 122, '', textStyle).setDepth(DEPTH.HUD).setScrollFactor(0);
    this.kit = createKit(this.character.id, this);

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

  get time() {
    return this.scene.time;
  }
  get tweens() {
    return this.scene.tweens;
  }
  get cam() {
    return this.scene.cameras.main;
  }

  /** ผู้เล่นเดินเข้าประตู/จบด่านสำเร็จ — หยุดการควบคุม */
setVictory() {
  this._isVictory = true;
  this.vanished = false;
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
    this.vanished = false;
    this.kit.reset();
    this.burnLevel = 0;
    this.sweep = null;
    this.thrust = null;
    this.kit.destroy();
  }

  destroy() {
    this.scene.input.off('pointerdown', this.onPointerDown);
    this.scene.input.off('pointerup', this.onPointerUp);
    this.scene.input.off('pointerupoutside', this.onPointerUp);
  }

  // เป้าหมายที่ตีได้ ใกล้ผู้เล่นที่สุด (เครื่องรางครกจิ๋วใช้)
  nearestHittable(): CombatTarget | null {
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

    if (this.isDead && this.clips.ready) this.updateClip(this.time.now);
    if (this.isDead || this.isVictory) return;

    const now = this.time.now;
    const isHitStopped = now < this.hitStopUntil;

    const speed = this.character.speed * (this.isCharging ? 0.5 : 1) * this.perks.speedMultiplier(now) * this.kit.speedMult(now);
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

    if (this.clips.ready) {
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
      this.kit.ultimate();
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
          if (held >= this.kit.chargeNeeded()) this.kit.charged();
          else this.performLight();
        }
      }
    }

    this.perks.update(now, delta);
    this.updateBurn(delta, now);
    this.updateSweep(now);
    this.updateThrust(now);

    this.kit.update(now, delta);

    const shadowOffset = this.useClay ? this.sprite.displayHeight / 2 - 6 : 14;
    syncShadow(this.playerShadow, this.sprite, 0, false, this.useClay ? this.sprite.displayHeight / 2 - 6 : 14);
    this.shieldRing.setPosition(this.sprite.x, this.sprite.y);
    this.shieldRing.setVisible(this.shield && !this.vanished);
    this.playerShadow.setVisible(!this.vanished);
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
  breakDecoy(target: CombatTarget, index: number): boolean {
    if (!target.hitDecoy(index)) return false;
    sfx.hit();
    this.cam.shake(90, 0.004);
    this.hitStop(50);
    return true;
  }

  updateSweep(now: number) {
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
        if (!t.onHitFired) {
          t.onHitFired = true;
          t.onHit?.();
        }
      }
    }
  }

  // ดาเมจลงเป้าหมาย — จุดเดียวที่ดาเมจผู้เล่นผ่าน (เครื่องราง, ฮิตสต็อป, นับพาสซีฟ)
  hitTarget(target: CombatTarget, damage: number, actionId: number) {
    if (!target.isHittable()) return;
    damage = this.perks.onPlayerHit(damage, actionId);
    damage = this.kit.modifyDamage(damage, actionId);
    sfx.hit();
    target.takeHit(damage);
    this.host.onTargetDamaged?.(target);
    const shake = Math.min(SHAKE_MAX, SHAKE_BASE + (damage / 100) * SHAKE_PER_100);
    this.cam.shake(120, shake);
    const weight = Math.min(HIT_STOP_MAX_MS, HIT_STOP_BASE_MS + (damage / 100) * HIT_STOP_PER_100);
    this.hitStop(weight);
    if (actionId >= 0) this.kit.onHitLanded(actionId);
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
      const blockFx = spawnPixelFx(this.scene, 'divine-shield', {
        x: player.x, y: this.feetY(), scale: 1, tint: 0x9de7ff, add: true,
        durationMs: 320, fadeOutMs: 120, depth: DEPTH.SLASH + 1
      });
      if (!blockFx) {
        ringEffect(this.scene, player.x, player.y, 44, 0x66e0ff, 300);
        burst(this.scene, player.x, player.y, 0x66e0ff, 10, 40, 4);
      }
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

    this.kit.onHurt();

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
    if (this.clips.ready) {
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
    if (!this.clips.ready) this.sprite.setTint(this.character.tint);
  }

  setPlayerTexture(key: string) {
    if (!this.useClay) return;
    // บล็อกรูป clay เฉพาะตอนเล่นอัคนีที่มีเฟรมจริงเท่านั้น (ลูมิต้องเปลี่ยนรูปได้)
    if (this.clips.ready && key.startsWith('hero_clay')) return;
    if (this.currentTexture === key) return;
    if (!this.scene.textures.exists(key)) return;
    this.sprite.setTexture(key);
    this.currentTexture = key;
    this.sprite.setScale(this.baseScale * this.character.scale);
  }

 playClip(clip: string, frameMs: number | number[], _loop: boolean) {
this.clips.play(clip, frameMs, this.time.now);
}
playAttackClip(frameMs: number) {
if (this.clips.can('attack')) this.playClip('attack', frameMs, false);
else this.setPlayerTexture('hero_clay_attack');
}
private updateClip(now: number) {
const key = this.clips.frameKeyAt(now);
if (key) this.setPlayerTexture(key);
}
  private updateAkkVisual(now: number, moving: boolean) {
    let want = '';
    if (!this.isAttacking) {
      if (this.isCharging && now - this.chargeStartAt >= 120) want = 'charge_hold';
      else want = moving ? 'walk' : 'idle';
    }
    if (want && want !== this.clips.current) {
      if (want === 'walk') this.playClip('walk', 120, true);
      else if (want === 'charge_hold') {
        const n = this.clips.frames.charge_hold ?? 7;
        const ms = Math.max(40, (this.kit.chargeNeeded() - 120) / Math.max(1, n));
        this.playClip('charge_hold', ms, true);
      } else this.playClip('idle', 1000, true);
    }
    this.updateClip(now);
  }

  feetY(): number {
    return this.clips.ready
      ? this.sprite.y + this.sprite.displayHeight * 0.45
      : this.sprite.y + this.sprite.displayHeight / 2;
  }

  slashFx(scale: number, angle?: number, tint?: number) {
    spawnPixelFx(this.scene, 'sword-slash', {
      x: this.sprite.x,
      y: this.feetY(),
      scale,
      flipX: angle === undefined ? this.sprite.flipX : false,
      angle,
      tint,
      depth: DEPTH.SLASH + 1
    });
  }

  /** เอฟเฟกต์พุ่งดาบ — วางที่เท้า หมุนตามทิศพุ่ง บีบให้จบพร้อมท่า */
  thrustFx(dir: Phaser.Math.Vector2, totalMs: number) {
    spawnPixelFx(this.scene, 'thrust', {
      x: this.sprite.x,
      y: this.feetY(),
      scale: 1,
      angle: Math.atan2(dir.y, dir.x),
      fitMs: totalMs,
      depth: DEPTH.SLASH + 1
    });
  }

  muzzleFx(dir: Phaser.Math.Vector2, color: number) {
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
  getAttackDir(assistRange: number, assistAngle: number): Phaser.Math.Vector2 {
    const base = this.getAimDir();
    if (controls.mode === 'keys') return this.assistSnap(base, assistRange, assistAngle);
    return base;
  }

  /** ทิศที่บังคับอยู่ (WASD / ลูกศร / จอย) — ทำเป็นเวกเตอร์หน่วยแล้ว · 0,0 = ไม่ได้บังคับ */
  getMoveInput(): { x: number; y: number } {
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


  private cancelCharge() {
    this.isCharging = false;
    this.chargeGfx.clear();
  }

  private drawCharge(held: number, now: number) {
    const g = this.chargeGfx;
    g.clear();
    if (held < 120) return;
    const need = this.kit.chargeNeeded();
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

  /** ตีปกติ — คอมโบ 3 ฮิต: ฮิต 3 ให้ชุดท่าเลือกท่าตามสกิลช่องคอมโบ */
  private performLight() {
    if (this.kit.lightOverride()) return;
    const hit = this.combo.nextHit(this.time.now);
    if (hit === 3) {
      this.kit.comboFinisher();
      return;
    }
    this.lightHit = hit;
    this.kit.light();
  }

  beginAction(): number {
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

    this.kit.updateHud(now);
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

  healPlayer(n: number) {
    const before = this.playerHP;
    this.playerHP = Math.min(this.maxPlayerHP, this.playerHP + n);
    const gained = this.playerHP - before;
    if (gained > 0) {
      this.hud.update(this.playerHP);
      showDamage(this.scene, this.sprite.x, this.sprite.y - 20, '+' + gained, '#66ff88');
    }
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

  // ===============================================================
  //  สกิลอัคนีตัวเลือก B / C (ค่าตัวเลขทั้งหมดอยู่ใน data/skills.ts)
  // ===============================================================

  /** เล่นคลิปของท่า — ไม่มีภาพจริงก็ถอยไปคลิปสำรองตามตาราง · ไม่มีภาพเลยก็ใช้ภาพดินน้ำมัน */
  playSkillClip(clip: string, totalMs: number, durations?: number[]) {
    if (this.clips.ready) {
      const n = Math.max(1, this.clips.frames[clip] ?? 1);
      this.playClip(clip, durations ?? totalMs / n, false);
    } else this.setPlayerTexture('hero_clay_attack');
  }

  /** จบท่า: ปลดล็อกทุกอย่างที่ท่านี้ล็อกไว้ */
  endAction(token: number) {
    if (token !== this.actionToken) return;
    this.isAttacking = false;
    this.isActionLocked = false;
    this.isLunging = false;
    this.skillInvincible = false;
    this.sprite.setVelocity(0);
    this.setPlayerTexture('hero_clay_idle');
  }

  /** ท่าพุ่ง: โหมดเมาส์พุ่งตามเป้า · โหมดคีย์บอร์ด/สัมผัสพุ่งไปทางที่บังคับอยู่ (เหมือนชาร์จ A) */
  rushDirection(base: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    if (controls.mode === 'mouse') return base;
    const mv = this.getMoveInput();
    if (mv.x === 0 && mv.y === 0) return base;
    return new Phaser.Math.Vector2(mv.x, mv.y);
  }

  spawnAfterimage(color: number) {
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

    this.kit.onHurt();
  }
}