// src/scenes/GameScene.ts — ห้องฝึก (Training Room): หุ่นฟาง + แผง DPS + เครื่องมือทดสอบท่า
// คีย์ฉาก 'GameScene' คงเดิม — ฐานยังเรียก scene.start('GameScene') ได้เหมือนเดิม
// ไม่มีบอส ไม่มีลูท ไม่มีประตูออก · ออกด้วย ESC · เปิด Loadout ด้วย L (กลับมาห้องเดิมที่ยืนเดิม)
import Phaser from 'phaser';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WALL_THICKNESS,
  SPRITE_SCALE,
  DEPTH,
  VIEW_SCALE
} from '../config';
import { makeVignette } from '../systems/effects';
import { UiCamera } from '../systems/UiCamera';
import { sfx } from '../systems/sfx';
import { loadout } from '../systems/Loadout';
import { saveGame } from '../systems/SaveGame';
import { findSkill, SKILL_SLOTS } from '../data/skills';
import { loadMagmusFrames } from '../systems/magmusFrames';
import { loadPixelFx } from '../systems/pixelFx';
import { PlayerActor, FX_TUNE } from '../actors/PlayerActor';
import type { CombatTarget } from '../systems/CombatTarget';
import { StrawDummy, dummyAsTarget, DUMMY } from '../entities/StrawDummy';
import { DpsMeter } from '../systems/DpsMeter';
import { trainingState, type TrainingRun } from '../systems/trainingState';
import { controls, pressed, CONTROL_LABEL } from '../systems/Controls';
import { profiles } from '../systems/PlayerProfile';

const TIMER_MS = 30000; // จับเวลาทดสอบ DPS
const HITBOX_HOLD_MS = 500; // ค้างภาพกรวยฟันไว้ให้ดูหลังฟันออก
const MIN_MEASURE = 80; // วัดระยะเฉพาะการเคลื่อนที่ที่ไกลเกินนี้ (กันก้าวสั้นของตีเบา)
const MEASURE_SHOW_MS = 4000;
const PANEL_EVERY_MS = 100;
const FX_DEFAULT_REF = 90; // ต้องตรงกับค่าเริ่มต้น FX_TUNE.refWidth ใน PlayerActor
const RULER_RINGS = [100, 200, 300, 400, 500];
const SELF_HIT = 100;
const PATROL_INDEX = 4; // หุ่นตัวที่ 5 เป็นหุ่นเดินวน
const SLOT_SHORT: Record<string, string> = { passive: 'P', combo: 'Cb', charge: 'Ch', ultimate: 'U' };

export class GameScene extends Phaser.Scene {
  private actor!: PlayerActor;
  private meter: DpsMeter = new DpsMeter();
  private dummies: StrawDummy[] = [];
  private targets: CombatTarget[] = [];
  private colliders: any[] = [];

  private keyM!: Phaser.Input.Keyboard.Key;
  private leaving: boolean = false;

  // จับเวลา 30 วินาที
  private timer: { armed: boolean; startAt: number; endAt: number } | null = null;
  private frozenDps: number | null = null;

  // ภาพช่วยทดสอบ
  private hitGfx!: Phaser.GameObjects.Graphics;
  private rulerGfx!: Phaser.GameObjects.Graphics;
  private measureGfx!: Phaser.GameObjects.Graphics;
  private rulerLabels: Phaser.GameObjects.Text[] = [];
  private measureText!: Phaser.GameObjects.Text;
  private sweepRef: any = null;
  private sweepSnap: { x: number; y: number; ang: number; range: number; half: number; at: number } | null = null;
  private wasLunging: boolean = false;
  private lungeStart: { x: number; y: number } | null = null;
  private measure: { x1: number; y1: number; x2: number; y2: number; dist: number; at: number } | null = null;
  private lastMove: number = 0;

  // UI
  private panel!: Phaser.GameObjects.Text;
  private panelAt: number = 0;
  private controlLabel!: Phaser.GameObjects.Text;
  private uiCam!: UiCamera;

  constructor() {
    super({ key: 'GameScene' });
  }

  // โหลดชุดเดิมไว้ครบ (ฉากอื่นอาจพึ่งภาพที่ฉากนี้เคยโหลด — โหลดซ้ำ Phaser ข้ามให้เอง)
  preload() {
    PlayerActor.preloadAssets(this);

    this.load.image('floor', 'assets/floor.png');
    this.load.image('wall', 'assets/wall.png');
    this.load.image('slime', 'assets/slime.png');
    this.load.image('loot_box_closed', 'assets/loot_box_closed.png');
    this.load.image('loot_box_open', 'assets/loot_box_open.png');
    this.load.image('green_potion', 'assets/green_potion.png');
    this.load.image('boss_phasama', 'assets/boss_phasama.png');
    this.load.image('boss_phasama_ball', 'assets/boss_phasama_ball.png');
    this.load.image('boss_maya', 'assets/boss_maya.png');
    loadMagmusFrames(this);
    loadPixelFx(this);
  }

  create() {
    // ฉากเดิมถูกใช้ซ้ำตอน restart — ล้างค่าทุกตัวที่เป็นของรอบก่อน
    this.uiCam = new UiCamera(this);
    this.leaving = false;
    this.dummies = [];
    this.targets = [];
    this.colliders = [];
    this.timer = null;
    this.frozenDps = null;
    this.sweepRef = null;
    this.sweepSnap = null;
    this.wasLunging = false;
    this.lungeStart = null;
    this.measure = null;
    this.lastMove = 0;
    this.panelAt = 0;
    this.rulerLabels = [];
    this.meter = new DpsMeter();

    const W = WORLD_WIDTH;
    const H = WORLD_HEIGHT;
    const t = WALL_THICKNESS;
    this.add.tileSprite(0, 0, W, H, 'floor').setOrigin(0).setTileScale(SPRITE_SCALE).setDepth(DEPTH.FLOOR);
    this.createFloorDetails();
    this.add.tileSprite(0, 0, W, t, 'wall').setOrigin(0).setTileScale(SPRITE_SCALE).setDepth(DEPTH.WALL);
    this.add.tileSprite(0, H - t, W, t, 'wall').setOrigin(0).setTileScale(SPRITE_SCALE).setDepth(DEPTH.WALL);
    this.add.tileSprite(0, 0, t, H, 'wall').setOrigin(0).setTileScale(SPRITE_SCALE).setDepth(DEPTH.WALL);
    this.add.tileSprite(W - t, 0, t, H, 'wall').setOrigin(0).setTileScale(SPRITE_SCALE).setDepth(DEPTH.WALL);

    this.physics.world.setBounds(t, t, W - t * 2, H - t * 2);
    makeVignette(this);

    // ตำแหน่งเริ่ม: กลับจากเปิด Loadout / ล้มแล้วเริ่มใหม่ = ยืนจุดเดิม · ไม่มี = ซ้ายของกลางห้องเล็กน้อย
    const saved = trainingState.pos;
    trainingState.pos = null;
    const px = saved ? Phaser.Math.Clamp(saved.x, t + 40, W - t - 40) : W / 2 - 100;
    const py = saved ? Phaser.Math.Clamp(saved.y, t + 40, H - t - 40) : H / 2;

    this.hitGfx = this.add.graphics().setDepth(DEPTH.TELEGRAPH);
    this.rulerGfx = this.add.graphics().setDepth(DEPTH.FLOOR + 3);
    this.measureGfx = this.add.graphics().setDepth(DEPTH.TELEGRAPH);
    this.buildRulerLabels();

    // ---------- ผู้เล่น (ตรรกะทั้งหมดอยู่ใน PlayerActor) ----------
    this.actor = new PlayerActor(this, px, py, {
      getTargets: () => this.targets,
      onDeathShown: () => this.onPlayerDeath()
    }, profiles.local);

    this.spawnDummies(W / 2, H / 2, W, H);
    this.applyCollide();

    this.keyM = (this.input.keyboard as any).addKey(Phaser.Input.Keyboard.KeyCodes.M);
    this.bindKeys();
    this.buildPanel();
    this.buildControlLabel();

    const camera = this.cameras.main;
    camera.setZoom(VIEW_SCALE);
    camera.setBounds(0, 0, W, H);
    camera.startFollow(this.actor.sprite, true, 0.08, 0.08);
    camera.setDeadzone(440 / VIEW_SCALE, 340 / VIEW_SCALE);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      (this.input.keyboard as any).removeAllListeners();
      for (const d of this.dummies) d.destroy();
    });

    this.refreshPanel(this.time.now, true);
  }

  update(_time: number, delta: number) {
    if (!this.actor) return;
    const now = this.time.now;

    if (pressed(this.keyM, 'M')) {
      const off = sfx.toggleMute();
      this.showToast(off ? 'ปิดเสียง' : 'เปิดเสียง');
    }

    // ผู้เล่น: ควบคุม + ต่อสู้ + เครื่องราง/สัตว์เลี้ยง + HUD ของผู้เล่น
    this.actor.update(delta);
    if (this.actor.isDead) return; // เริ่มห้องใหม่เองใน onPlayerDeath

    for (const d of this.dummies) d.update();
    this.trackLunge(now);
    this.updateTimer(now);
    this.drawHitboxes(now);
    this.drawRuler();
    this.drawMeasure(now);
    this.refreshPanel(now, false);
  }

  // =====================================================
  //  หุ่น + การชน
  // =====================================================
  private spawnDummies(cx: number, cy: number, W: number, H: number) {
    const t = WALL_THICKNESS;
    const place = (dx: number, dy: number) => ({
      x: Phaser.Math.Clamp(cx + dx, t + 80, W - t - 80),
      y: Phaser.Math.Clamp(cy + dy, t + 100, H - t - 100)
    });
    // กลุ่ม 3 ตัวใกล้ (ทดสอบฟันโดนหลายเป้า) · ตัวไกลสุด (ทดสอบระยะพุ่ง) · ตัวเดินวนซ้ายมือ
    const spots = [place(240, 0), place(290, -80), place(290, 80), place(560, 0), place(-280, 0)];
    for (const p of spots) {
      this.dummies.push(new StrawDummy(this, p.x, p.y, (damage) => this.onDummyHit(damage)));
    }
    this.dummies[PATROL_INDEX].setPatrol(trainingState.patrol);
    // สร้าง CombatTarget ครั้งเดียว ไม่สร้างใน getTargets()
    this.targets = this.dummies.map((d) => dummyAsTarget(d));
  }

  /** เปิด/ปิดการชนระหว่างผู้เล่นกับหุ่น (หุ่นเป็นของแข็งเหมือนบอสตอนเปิด) */
  private applyCollide() {
    for (const c of this.colliders) c.destroy();
    this.colliders = [];
    if (!trainingState.collide) return;
    for (const d of this.dummies) {
      this.colliders.push(this.physics.add.collider(this.actor.sprite, d.sprite));
    }
  }

  private onDummyHit(damage: number) {
    const now = this.time.now;
    // จับเวลาเริ่มนับตอนตีฮิตแรก
    if (this.timer && this.timer.armed) {
      this.timer.armed = false;
      this.timer.startAt = now;
      this.timer.endAt = now + TIMER_MS;
    }
    this.meter.record(now, damage);
  }

  // =====================================================
  //  ปุ่ม
  // =====================================================
  private bindKeys() {
    const kb = this.input.keyboard as any;
    kb.on('keydown-L', () => this.openLoadout());
    kb.on('keydown-R', () => this.onResetKey());
    kb.on('keydown-G', () => this.selfHit());
    kb.on('keydown-H', () => this.toggleHitbox());
    kb.on('keydown-X', () => this.toggleRuler());
    kb.on('keydown-T', () => this.toggleTimer());
    kb.on('keydown-N', () => this.togglePatrol());
    kb.on('keydown-C', () => this.toggleCollide());
    kb.on('keydown-OPEN_BRACKET', () => this.tuneFx(-1));
    kb.on('keydown-CLOSED_BRACKET', () => this.tuneFx(1));
    kb.on('keydown-ESC', () => this.exitRoom());
    kb.on('keydown-V', () => this.cycleControls());
  }

  /** เปิดห้องแต่งตัว (ตัวละคร/สกิล/เครื่องราง/สัตว์เลี้ยง) — ปิดแล้วกลับมาห้องนี้ ยืนจุดเดิม สกิลใหม่มีผลทันที */
  private openLoadout() {
    if (this.leaving || this.actor.isDead) return;
    this.leaving = true;
    saveGame();
    trainingState.pos = { x: this.actor.x, y: this.actor.y };
    trainingState.loadoutReturn = 'GameScene';
    sfx.open();
    this.scene.start('LoadoutScene');
  }

  private exitRoom() {
    if (this.leaving) return;
    this.leaving = true;
    saveGame();
    trainingState.loadoutReturn = '';
    trainingState.pos = null;
    sfx.whoosh();
    this.scene.start('BaseScene');
  }

  private onPlayerDeath() {
    this.showToast('ล้มแล้ว — เริ่มห้องใหม่');
    this.time.delayedCall(600, () => this.restartRoom());
  }

  private restartRoom() {
    if (this.leaving) return;
    this.leaving = true;
    trainingState.pos = { x: this.actor.x, y: this.actor.y };
    this.scene.restart();
  }

  private onResetKey() {
    if (this.actor.isDead) {
      this.restartRoom();
      return;
    }
    this.meter.reset();
    this.frozenDps = null;
    this.timer = null;
    this.lastMove = 0;
    this.measure = null;
    this.actor.heal(this.actor.maxPlayerHP);
    this.actor.skillReadyAt = 0;
    this.actor.ultReadyAt = 0;
    this.showToast('รีเซ็ตแล้ว: เลือดเต็ม · คูลดาวน์ไม้ตาย · DPS');
  }

  /** โดนตีเบา ๆ ให้ตัวเอง — ทดสอบโล่ Passive A และทุกอย่างที่ทำงานตอนรับดาเมจ */
  private selfHit() {
    if (this.actor.isDead) return;
    if (this.actor.hp <= SELF_HIT) this.actor.heal(this.actor.maxPlayerHP);
    this.actor.takeDamage(SELF_HIT, this.actor.x - 40, this.actor.y);
  }

  private toggleHitbox() {
    trainingState.hitbox = !trainingState.hitbox;
    this.showToast(trainingState.hitbox ? 'แสดง hitbox' : 'ซ่อน hitbox');
  }

  private toggleRuler() {
    trainingState.ruler = !trainingState.ruler;
    this.showToast(trainingState.ruler ? 'แสดงไม้บรรทัดระยะ' : 'ซ่อนไม้บรรทัดระยะ');
  }

  private togglePatrol() {
    trainingState.patrol = !trainingState.patrol;
    this.dummies[PATROL_INDEX].setPatrol(trainingState.patrol);
    this.showToast(trainingState.patrol ? 'หุ่นซ้ายมือเดินวน' : 'หุ่นซ้ายมือหยุดนิ่ง');
  }

  private toggleCollide() {
    trainingState.collide = !trainingState.collide;
    this.applyCollide();
    this.showToast(trainingState.collide ? 'ชนหุ่น: เปิด (ตันเหมือนบอส)' : 'ชนหุ่น: ปิด (เดินทะลุได้)');
  }

  /** ปรับขนาดเอฟเฟกต์ทุกท่าที่ใช้ fxScale สด — dir +1 = ใหญ่ขึ้น · เจอค่าที่ชอบแล้วจดเลข REF ไปแก้ในโค้ด */
  private tuneFx(dir: number) {
    FX_TUNE.refWidth = Phaser.Math.Clamp(FX_TUNE.refWidth - dir * 5, 30, 240);
    this.showToast(`ขนาดเอฟเฟกต์ ×${(FX_DEFAULT_REF / FX_TUNE.refWidth).toFixed(2)} (REF ${FX_TUNE.refWidth})`);
  }

  private cycleControls() {
    if (this.leaving) return;
    controls.cycle();
    this.refreshControlLabel();
    sfx.open();
    this.showToast('ควบคุม: ' + CONTROL_LABEL[controls.mode]);
  }

  // =====================================================
  //  จับเวลา 30 วินาที
  // =====================================================
  private toggleTimer() {
    if (this.actor.isDead) return;
    if (this.timer) {
      this.timer = null;
      this.meter.reset();
      this.frozenDps = null;
      this.showToast('ยกเลิกจับเวลา');
      return;
    }
    this.meter.reset();
    this.frozenDps = null;
    this.meter.idleResetMs = Infinity; // ห้ามแตกรอบกลางการจับเวลา
    this.timer = { armed: true, startAt: 0, endAt: 0 };
    this.showToast('จับเวลา 30 วิ — เริ่มนับเมื่อตีฮิตแรก');
  }

  private updateTimer(now: number) {
    const t = this.timer;
    if (!t || t.armed) return;
    if (now >= t.endAt) this.finishTimer();
  }

  private finishTimer() {
    const dps = this.meter.total / (TIMER_MS / 1000);
    const run: TrainingRun = {
      dps,
      total: this.meter.total,
      hits: this.meter.count,
      maxHit: this.meter.maxHit,
      label: this.skillLabel()
    };
    trainingState.runs.unshift(run);
    if (trainingState.runs.length > 5) trainingState.runs.length = 5;
    this.meter.locked = true;
    this.frozenDps = dps;
    this.timer = null;
    sfx.pickup();
    this.showToast(`จบ 30 วิ · DPS ${dps.toFixed(1)} · ${this.meter.count} ฮิต`);
  }

  /** ชื่อชุดสกิลที่ใส่อยู่ เช่น "อัคนี P:A Cb:B Ch:C U:A" — ใช้ติดป้ายผลจับเวลา */
  private skillLabel(): string {
    const id = this.actor.character.id;
    const parts: string[] = [];
    for (const slot of SKILL_SLOTS) {
      const d = findSkill(loadout.skillOf(slot));
      const opt = d && d.char === id ? d.option : 'a';
      parts.push(`${SLOT_SHORT[slot] ?? slot}:${String(opt).toUpperCase()}`);
    }
    return `${this.actor.character.name} ${parts.join(' ')}`;
  }

  // =====================================================
  //  ภาพช่วยทดสอบ: hitbox / ไม้บรรทัด / วัดระยะพุ่ง
  // =====================================================
  /** วัดระยะที่ตัวละครเคลื่อนที่ระหว่างท่า (isLunging) — เทียบ Charge A/B/C ด้วยตัวเลข */
  private trackLunge(now: number) {
    const l = this.actor.isLunging;
    if (l && !this.wasLunging) this.lungeStart = { x: this.actor.x, y: this.actor.y };
    if (!l && this.wasLunging && this.lungeStart) {
      const dist = Math.round(Phaser.Math.Distance.Between(this.lungeStart.x, this.lungeStart.y, this.actor.x, this.actor.y));
      if (dist >= MIN_MEASURE) {
        this.lastMove = dist;
        this.measure = { x1: this.lungeStart.x, y1: this.lungeStart.y, x2: this.actor.x, y2: this.actor.y, dist, at: now };
      }
      this.lungeStart = null;
    }
    this.wasLunging = l;
  }

  private drawMeasure(now: number) {
    const g = this.measureGfx;
    g.clear();
    const m = this.measure;
    if (!m || now - m.at > MEASURE_SHOW_MS) {
      this.measureText.setVisible(false);
      return;
    }
    const a = 1 - (now - m.at) / MEASURE_SHOW_MS;
    g.lineStyle(2, 0xffd166, 0.3 + 0.6 * a);
    g.beginPath();
    g.moveTo(m.x1, m.y1);
    g.lineTo(m.x2, m.y2);
    g.strokePath();
    g.fillStyle(0xffd166, 0.3 + 0.6 * a);
    g.fillCircle(m.x1, m.y1, 5);
    g.fillCircle(m.x2, m.y2, 5);
    this.measureText
      .setPosition((m.x1 + m.x2) / 2, (m.y1 + m.y2) / 2 - 14)
      .setText(`${m.dist} px`)
      .setAlpha(0.4 + 0.6 * a)
      .setVisible(true);
  }

  private buildRulerLabels() {
    this.rulerLabels = RULER_RINGS.map((r) =>
      this.add
        .text(0, 0, String(r), {
          fontFamily: 'monospace',
          fontSize: '11px',
          color: '#e8e0c8',
          stroke: '#000000',
          strokeThickness: 3
        })
        .setDepth(DEPTH.FLOOR + 3)
        .setVisible(false)
    );
    this.measureText = this.add
      .text(0, 0, '', {
        fontFamily: '"Noto Sans Thai", monospace',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#ffd166',
        stroke: '#000000',
        strokeThickness: 3
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.TELEGRAPH)
      .setVisible(false);
  }

  private drawRuler() {
    const g = this.rulerGfx;
    g.clear();
    const on = trainingState.ruler;
    for (const l of this.rulerLabels) l.setVisible(on);
    if (!on) return;
    const x = this.actor.x;
    const y = this.actor.y;
    RULER_RINGS.forEach((r, i) => {
      g.lineStyle(1, 0xe8e0c8, i % 2 === 0 ? 0.55 : 0.3);
      g.strokeCircle(x, y, r);
      this.rulerLabels[i].setPosition(x + r + 4, y - 8);
    });
  }

  /** กรวยฟันที่ใช้ตรวจจริง (ค้างให้ดู 0.5 วินาที) + วงพุ่ง + วงเป้าของหุ่น — ภาพ debug ไม่แตะ gameplay */
  private drawHitboxes(now: number) {
    const g = this.hitGfx;
    g.clear();
    if (!trainingState.hitbox) {
      this.sweepSnap = null;
      return;
    }
    g.lineStyle(2, 0x7dff9b, 0.55);
    for (const d of this.dummies) g.strokeCircle(d.sprite.x, d.sprite.y, DUMMY.radius);

    const s = this.actor.sweep;
    if (s && s !== this.sweepRef) {
      this.sweepRef = s;
      this.sweepSnap = {
        x: this.actor.x,
        y: this.actor.y,
        ang: Math.atan2(s.dir.y, s.dir.x),
        range: s.range,
        half: s.halfAngle,
        at: now
      };
    }
    const snap = this.sweepSnap;
    if (snap) {
      const age = now - snap.at;
      if (age > HITBOX_HOLD_MS) {
        this.sweepSnap = null;
      } else {
        const a = 1 - age / HITBOX_HOLD_MS;
        g.fillStyle(0x9de7ff, 0.04 + 0.12 * a);
        g.lineStyle(2, 0x9de7ff, 0.1 + 0.9 * a);
        if (snap.half >= 180) {
          g.fillCircle(snap.x, snap.y, snap.range);
          g.strokeCircle(snap.x, snap.y, snap.range);
        } else {
          const half = Phaser.Math.DegToRad(snap.half);
          g.beginPath();
          g.moveTo(snap.x, snap.y);
          g.arc(snap.x, snap.y, snap.range, snap.ang - half, snap.ang + half, false);
          g.closePath();
          g.fillPath();
          g.strokePath();
        }
      }
    }

    // ท่าพุ่ง: เป้าโดนเมื่อวงเป้าแตะวงรัศมี 30 รอบตัวผู้เล่น
    if (this.actor.thrust) {
      g.lineStyle(2, 0xffb15a, 0.9);
      g.strokeCircle(this.actor.x, this.actor.y, 30);
    }
  }

  // =====================================================
  //  UI
  // =====================================================
  private buildPanel() {
    this.panel = this.add
      .text(GAME_WIDTH - 14, 14, '', {
        fontFamily: '"Noto Sans Thai", monospace',
        fontSize: '13px',
        color: '#ffffff',
        backgroundColor: 'rgba(20, 16, 10, 0.88)',
        padding: { x: 10, y: 8 },
        lineSpacing: 3
      })
      .setOrigin(1, 0)
      .setDepth(DEPTH.HUD)
      .setScrollFactor(0);

    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT - 34,
        'L Loadout · R รีเซ็ต · G โดนตี · T จับเวลา · H hitbox · X ไม้บรรทัด · C ชนหุ่น · N หุ่นเดิน · [ ] เอฟเฟกต์ · ESC กลับฐาน',
        {
          fontFamily: '"Noto Sans Thai", monospace',
          fontSize: '10px',
          color: '#a89f8c',
          stroke: '#000000',
          strokeThickness: 2
        }
      )
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.HUD)
      .setScrollFactor(0);
  }

  private currentDps(now: number): number {
    if (this.frozenDps !== null) return this.frozenDps;
    if (this.timer && !this.timer.armed) {
      return this.meter.total / Math.max(1, (now - this.timer.startAt) / 1000);
    }
    return this.meter.dps(now);
  }

  private refreshPanel(now: number, force: boolean) {
    if (!force && now - this.panelAt < PANEL_EVERY_MS) return;
    this.panelAt = now;
    const m = this.meter;
    const lines: string[] = [];
    lines.push(`ห้องฝึก · ${this.actor.character.name}`);

    if (this.timer) {
      if (this.timer.armed) lines.push('จับเวลา 30 วิ: รอตีฮิตแรก…');
      else lines.push(`จับเวลา: เหลือ ${Math.max(0, (this.timer.endAt - now) / 1000).toFixed(1)} วิ`);
    }

    let tag = '';
    if (this.frozenDps !== null) tag = '  (ผลจับเวลา · R รีเซ็ต)';
    else if (m.count > 0) tag = m.isActive(now) ? '  ●' : '  (หยุดแล้ว)';
    lines.push(`DPS ${this.currentDps(now).toFixed(1)}${tag}`);
    lines.push(`ดาเมจรวม ${m.total.toLocaleString()} · ${m.count} ฮิต`);
    lines.push(`ฮิตแรงสุด ${m.maxHit} · ล่าสุด ${m.lastHit}`);
    const recent = m.recentList();
    lines.push(`ลำดับ: ${recent.length > 0 ? recent.join(' · ') : '—'}`);
    lines.push(`ระยะพุ่งล่าสุด ${this.lastMove > 0 ? this.lastMove + ' px' : '—'}`);

    if (trainingState.runs.length > 0) {
      lines.push('— ผลจับเวลา 30 วิ —');
      trainingState.runs.slice(0, 3).forEach((r, i) => {
        lines.push(`#${i + 1} ${r.dps.toFixed(1)} · ${r.label}`);
      });
    }

    const flag = (b: boolean) => (b ? 'เปิด' : 'ปิด');
    lines.push(`H hitbox ${flag(trainingState.hitbox)} · X ไม้บรรทัด ${flag(trainingState.ruler)}`);
    lines.push(`C ชนหุ่น ${flag(trainingState.collide)} · N หุ่นเดิน ${flag(trainingState.patrol)}`);
    lines.push(`[ ] ขนาดเอฟเฟกต์ ×${(FX_DEFAULT_REF / FX_TUNE.refWidth).toFixed(2)}`);

    // วินิจฉัยความคม: ยืด > 1 = ภาพถูกขยาย (นุ่ม) · = 1 คมตามพิกเซล · < 1 = ถูกย่อ
    const cv = this.sys.game.canvas;
    const box = cv.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const stretch = (box.width * dpr) / cv.width;
    lines.push(`DPR ${dpr.toFixed(2)} · แคนวาส ${cv.width}×${cv.height} · ยืด ×${stretch.toFixed(2)}`);
    lines.push(`หน้าต่าง ${window.innerWidth}×${window.innerHeight} css`);

    // วินิจฉัยกล้อง: กล้อง ui ต้องซูมเท่า VIEW_SCALE และกว้างเท่า CANVAS_W
    const uc = this.uiCam?.cam;
    lines.push(
      `VIEW_SCALE ${VIEW_SCALE.toFixed(3)} · ui ${uc ? uc.zoom.toFixed(3) + ' / ' + uc.width + '×' + uc.height : 'ไม่มีกล้อง ui'} · main ${this.cameras.main.zoom.toFixed(3)}`
    );
    lines.push(`FPS ${Math.round(this.game.loop.actualFps)}`);

    // วัดพื้นที่ที่กล้อง ui มองเห็นจริง — ถ้าจุดเริ่มไม่ใช่ 0,0 คือต้นเหตุที่ UI เลื่อน
    if (uc) {
      const wv = uc.worldView;
      // จุดออกแบบ 0,0 และ 1200,600 ต้องลงที่มุมจอพอดี (0,0 และ แคนวาสจริง)
      const mapX = (dx: number) => uc.x + uc.zoom * (dx - uc.width * uc.originX);
      const mapY = (dy: number) => uc.y + uc.zoom * (dy - uc.height * uc.originY);
      lines.push(`ui origin ${uc.originX}/${uc.originY} · มุมซ้ายบน ${mapX(0).toFixed(0)},${mapY(0).toFixed(0)} · มุมขวาล่าง ${mapX(GAME_WIDTH).toFixed(0)},${mapY(GAME_HEIGHT).toFixed(0)}`);
      lines.push(`origin ${uc.originX}/${uc.originY} · กล้อง ${this.cameras.cameras.length} ตัว · เกม ${this.game.scale.gameSize.width}×${this.game.scale.gameSize.height}`);
      // ตำแหน่ง viewport ของกล้องบนแคนวาส — ต้องเป็น 0,0 และกว้างเท่าแคนวาสจริง
      lines.push(`ui pos ${uc.x},${uc.y} · main pos ${this.cameras.main.x},${this.cameras.main.y} zoom ${this.cameras.main.zoom.toFixed(3)}`);
      lines.push(`แคนวาสจริง ${this.sys.game.canvas.width}×${this.sys.game.canvas.height} · scale ${this.game.scale.displaySize.width}×${this.game.scale.displaySize.height}`);
      // ทดสอบวาดจุดอ้างอิงมุมซ้ายบนของพื้นที่ออกแบบ — ถ้าไม่เห็น = มุมซ้ายบนยังถูกตัดจริง
      lines.push(`main เห็น ${this.cameras.main.worldView.x.toFixed(0)},${this.cameras.main.worldView.y.toFixed(0)} ขนาด ${this.cameras.main.worldView.width.toFixed(0)}×${this.cameras.main.worldView.height.toFixed(0)}`);
    }

    this.panel.setText(lines.join('\n'));
  }

  /** ป้ายมุมซ้ายล่าง: โหมดควบคุมปัจจุบัน — กด V หรือแตะเพื่อสลับ (แบบเดียวกับฐาน) */
  private buildControlLabel() {
    this.controlLabel = this.add
      .text(12, GAME_HEIGHT - 10, '', {
        fontFamily: '"Noto Sans Thai", monospace',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#a89f8c',
        stroke: '#000000',
        strokeThickness: 3
      })
      .setOrigin(0, 1)
      .setDepth(DEPTH.HUD)
      .setScrollFactor(0);
    this.controlLabel.setInteractive({ useHandCursor: true });
    this.controlLabel.on('pointerdown', () => this.cycleControls());
    this.refreshControlLabel();
  }

  private refreshControlLabel() {
    this.controlLabel.setText(`ควบคุม: ${CONTROL_LABEL[controls.mode]}  ([V] หรือแตะเพื่อสลับ)`);
  }

  private showToast(msg: string) {
    const toast = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 140, msg, {
        fontFamily: '"Noto Sans Thai", monospace',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#7dff9b',
        stroke: '#000000',
        strokeThickness: 4,
        backgroundColor: 'rgba(0,0,0,0.72)',
        padding: { x: 12, y: 6 }
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.OVERLAY)
      .setScrollFactor(0);
    this.tweens.add({
      targets: toast,
      alpha: 0,
      y: toast.y - 20,
      delay: 1400,
      duration: 480,
      onComplete: () => toast.destroy()
    });
  }

  // =====================================================
  //  พื้นห้อง (ชุดเดิม)
  // =====================================================
  private createFloorDetails() {
    const g = this.add.graphics();
    g.setDepth(DEPTH.FLOOR + 0.5);

    let seed = 20261113;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    const dirtColors = [0x66543d, 0x85704d, 0x9b8158, 0x596044, 0x77705a];

    for (let i = 0; i < 650; i++) {
      const x = rand() * WORLD_WIDTH;
      const y = rand() * WORLD_HEIGHT;
      const w = 12 + rand() * 45;
      const h = 8 + rand() * 25;
      const color = dirtColors[Math.floor(rand() * dirtColors.length)];
      g.fillStyle(color, 0.08 + rand() * 0.09);
      g.fillEllipse(x, y, w, h);
    }

    for (let i = 0; i < 320; i++) {
      const x = rand() * WORLD_WIDTH;
      const y = rand() * WORLD_HEIGHT;
      const r = 2 + rand() * 5;
      g.fillStyle(rand() > 0.5 ? 0xaaa18a : 0x403e38, 0.18 + rand() * 0.12);
      g.fillEllipse(x, y, r * 2, r);
    }

    for (let i = 0; i < 180; i++) {
      const x = rand() * WORLD_WIDTH;
      const y = rand() * WORLD_HEIGHT;
      g.lineStyle(2, 0x596d3d, 0.25);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - 4 - rand() * 5, y - 5 - rand() * 7);
      g.moveTo(x, y);
      g.lineTo(x + 4 + rand() * 5, y - 4 - rand() * 6);
      g.strokePath();
    }
  }
}