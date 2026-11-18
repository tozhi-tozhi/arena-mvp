// src/ui/TouchControlsScene.ts — ปุ่มสัมผัสสำหรับมือถือ (ฉากซ้อนบนสุด วาดเฉพาะเมื่อโหมด = touch)
// จอยซ้าย (ลอยตามนิ้ว) · ปุ่มตี (ค้าง = ชาร์จ) · ปุ่มสกิล · E · B · Q · M · R
// สื่อสารผ่าน `touch` ใน Controls.ts เท่านั้น — PlayerActor อ่านจากที่นั่น ฉากเกมรับปุ่มผ่าน pressed()
// ปุ่ม B/Q ส่งเหตุการณ์ keydown ไปที่ฉากเกมตรง ๆ (ฉากเดิมฟังด้วย kb.on อยู่แล้ว)
// ไม่ใช้ Container — เป็นวัตถุแบน (ตามกฎ UI ของโปรเจกต์)
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { controls, touch } from '../systems/Controls';
import { sfx } from '../systems/sfx';

type Ctx = 'none' | 'world' | 'base' | 'menu';
type BtnName = 'attack' | 'skill' | 'E' | 'B' | 'Q' | 'M' | 'R' | 'back';

interface Btn {
  bg: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  color: number;
  r: number;
}

// ปุ่มไหนแสดงในบริบทไหน
const SHOW: Record<Ctx, BtnName[]> = {
  none: [],
  world: ['attack', 'skill', 'E', 'B', 'Q', 'M', 'R'],
  base: ['E', 'B', 'M'],
  menu: ['back']
};

const JOY_R = 62; // รัศมีฐานจอย
const JOY_KNOB_R = 28;
const JOY_DEAD = 0.22; // ต่ำกว่านี้ถือว่าไม่เดิน
const JOY_ZONE_X = GAME_WIDTH * 0.5; // แตะซีกซ้ายของจอเพื่อเริ่มจอย
const JOY_IDLE_X = 120;
const JOY_IDLE_Y = GAME_HEIGHT - 130;

export class TouchControlsScene extends Phaser.Scene {
  private btns = new Map<BtnName, Btn>();
  private joyBase!: Phaser.GameObjects.Arc;
  private joyKnob!: Phaser.GameObjects.Arc;
  private joyId = -1;
  private joyOx = JOY_IDLE_X;
  private joyOy = JOY_IDLE_Y;
  private attackId = -1;
  private skillId = -1;
  private ctx: Ctx = 'none';

  constructor() {
    super({ key: 'TouchControlsScene' });
  }

  create() {
    // จอยซ้าย + ปุ่มตี + ปุ่มสกิล ต้องกดพร้อมกันได้ (ค่าเริ่มต้นมีนิ้วเดียว)
    this.input.addPointer(3);

    this.joyBase = this.add.circle(JOY_IDLE_X, JOY_IDLE_Y, JOY_R, 0xffffff, 0.1).setStrokeStyle(3, 0xffffff, 0.45).setDepth(10);
    this.joyKnob = this.add.circle(JOY_IDLE_X, JOY_IDLE_Y, JOY_KNOB_R, 0xffffff, 0.3).setStrokeStyle(2, 0xffffff, 0.7).setDepth(11);

    this.addBtn('attack', 708, GAME_HEIGHT - 122, 50, 0xff6a5a, 'ตี', 22);
    this.addBtn('skill', 598, GAME_HEIGHT - 66, 36, 0x9de7ff, 'สกิล', 16);
    this.addBtn('E', 612, GAME_HEIGHT - 168, 28, 0xffd166, 'E', 20);
    this.addBtn('B', 654, 72, 19, 0x9de7ff, 'B', 15);
    this.addBtn('Q', 704, 72, 19, 0xe8e0c8, 'Q', 15);
    this.addBtn('M', 754, 72, 19, 0xe8e0c8, 'M', 15);
    this.addBtn('R', GAME_WIDTH / 2, 24, 16, 0x7dff9b, 'R', 14);
    this.addBtn('back', 46, GAME_HEIGHT - 44, 26, 0xe8e0c8, '←', 24);

    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUp, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerdown', this.onDown, this);
      this.input.off('pointermove', this.onMove, this);
      this.input.off('pointerup', this.onUp, this);
      this.input.off('pointerupoutside', this.onUp, this);
    });

    this.applyContext();
  }

  // ---------------------------------------------------------------
  // สร้างปุ่ม
  // ---------------------------------------------------------------
  private addBtn(name: BtnName, x: number, y: number, r: number, color: number, text: string, fontSize: number) {
    const bg = this.add.circle(x, y, r, color, 0.2).setStrokeStyle(3, color, 0.85).setDepth(10);
    bg.setInteractive(new Phaser.Geom.Circle(r, r, r), Phaser.Geom.Circle.Contains);
    const label = this.add
      .text(x, y, text, {
        fontFamily: '"Noto Sans Thai", monospace',
        fontSize: `${fontSize}px`,
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3
      })
      .setOrigin(0.5)
      .setDepth(11)
      .setAlpha(0.9);
    this.btns.set(name, { bg, label, color, r });
    bg.on('pointerdown', (p: Phaser.Input.Pointer) => this.onBtnDown(name, p));
  }

  private lit(name: BtnName, on: boolean) {
    const b = this.btns.get(name);
    if (b) b.bg.setFillStyle(b.color, on ? 0.55 : 0.2);
  }

  private onBtnDown(name: BtnName, p: Phaser.Input.Pointer) {
    if (!this.isOn()) return;
    sfx.unlock();
    this.lit(name, true);
    switch (name) {
      case 'attack':
        this.attackId = p.id;
        touch.pressAttack();
        break;
      case 'skill':
        this.skillId = p.id;
        touch.pressSkill();
        this.time.delayedCall(120, () => this.lit('skill', false));
        break;
      case 'E':
      case 'M':
      case 'R':
        touch.pulse(name);
        this.time.delayedCall(120, () => this.lit(name, false));
        break;
      case 'B':
      case 'Q':
        this.emitKey(name);
        this.time.delayedCall(120, () => this.lit(name, false));
        break;
      case 'back':
        this.emitKey('ESC');
        this.time.delayedCall(120, () => this.lit('back', false));
        break;
    }
  }

  /** ส่งเหตุการณ์ปุ่มคีย์บอร์ดไปที่ฉากเกมที่กำลังทำงาน (ฉากเดิมฟัง kb.on('keydown-X') อยู่แล้ว) */
  private emitKey(key: string) {
    const target = this.gameScene();
    if (!target) return;
    const kb: any = target.input.keyboard;
    if (kb && typeof kb.emit === 'function') kb.emit('keydown-' + key, {});
  }

  // ---------------------------------------------------------------
  // จอย (ลอยตามนิ้ว — แตะซีกซ้ายของจอตรงไหนก็ได้)
  // ---------------------------------------------------------------
  private onDown(p: Phaser.Input.Pointer) {
    if (!this.isOn()) return;
    sfx.unlock();
    if (this.joyId !== -1) return;
    if (this.ctx !== 'world' && this.ctx !== 'base') return;
    if (p.x > JOY_ZONE_X) return;
    if (this.input.hitTestPointer(p).length > 0) return; // โดนปุ่ม ไม่ใช่จอย
    this.joyId = p.id;
    this.joyOx = Phaser.Math.Clamp(p.x, JOY_R + 8, JOY_ZONE_X);
    this.joyOy = Phaser.Math.Clamp(p.y, 110 + JOY_R, GAME_HEIGHT - JOY_R - 8);
    this.joyBase.setPosition(this.joyOx, this.joyOy).setAlpha(1);
    this.moveStick(p);
  }

  private onMove(p: Phaser.Input.Pointer) {
    if (p.id !== this.joyId) return;
    this.moveStick(p);
  }

  private moveStick(p: Phaser.Input.Pointer) {
    const dx = p.x - this.joyOx;
    const dy = p.y - this.joyOy;
    const dist = Math.hypot(dx, dy);
    const k = dist > JOY_R ? JOY_R / dist : 1;
    this.joyKnob.setPosition(this.joyOx + dx * k, this.joyOy + dy * k);
    if (dist / JOY_R < JOY_DEAD || dist === 0) {
      touch.moveX = 0;
      touch.moveY = 0;
    } else {
      touch.moveX = dx / dist;
      touch.moveY = dy / dist;
    }
  }

  private onUp(p: Phaser.Input.Pointer) {
    if (p.id === this.joyId) this.releaseJoy();
    if (p.id === this.attackId) {
      this.attackId = -1;
      touch.releaseAttack();
      this.lit('attack', false);
    }
    if (p.id === this.skillId) {
      this.skillId = -1;
    }
  }

  private releaseJoy() {
    this.joyId = -1;
    touch.moveX = 0;
    touch.moveY = 0;
    this.joyBase.setPosition(JOY_IDLE_X, JOY_IDLE_Y);
    this.joyKnob.setPosition(JOY_IDLE_X, JOY_IDLE_Y);
  }

  private releaseAll() {
    this.releaseJoy();
    if (this.attackId !== -1) {
      this.attackId = -1;
      touch.releaseAttack();
    }
    this.skillId = -1;
    for (const name of this.btns.keys()) this.lit(name, false);
  }

  // ---------------------------------------------------------------
  // บริบท — ฉากเกมตัวไหนทำงานอยู่ → โชว์ปุ่มชุดไหน
  // ---------------------------------------------------------------
  private isOn(): boolean {
    return controls.mode === 'touch';
  }

  private gameScene(): Phaser.Scene | null {
    const active = this.scene.manager.getScenes(true) as Phaser.Scene[];
    for (const s of active) {
      if (s.sys.settings.key !== 'TouchControlsScene') return s;
    }
    return null;
  }

  private detectContext(): Ctx {
    if (!this.isOn()) return 'none';
    const s = this.gameScene();
    if (!s) return 'none';
    const key = s.sys.settings.key;
    if (key === 'WorldScene' || key === 'GameScene') return 'world';
    if (key === 'BaseScene') return 'base';
    return 'menu';
  }

  private applyContext() {
    const show = new Set<BtnName>(SHOW[this.ctx]);
    for (const [name, b] of this.btns) {
      const v = show.has(name);
      b.bg.setVisible(v);
      b.label.setVisible(v);
    }
    const joy = this.ctx === 'world' || this.ctx === 'base';
    this.joyBase.setVisible(joy);
    this.joyKnob.setVisible(joy);
  }

  update() {
    const next = this.detectContext();
    if (next !== this.ctx) {
      this.ctx = next;
      this.releaseAll();
      this.applyContext();
      if (next === 'none') touch.reset();
    }
  }
}
