// src/ui/TouchControlsScene.ts — ปุ่มสัมผัสสำหรับมือถือ (ฉากซ้อนบนสุด วาดเฉพาะเมื่อโหมด = touch)
// จอยซ้าย (ลอยตามนิ้ว) · ปุ่มตี (ค้าง = ชาร์จ) · ปุ่มสกิล · E · B · Q · M · R · เต็มจอ
// กล้องฉากนี้ตั้งจุดกำเนิด (0,0) + ซูม VIEW_SCALE → พิกัดนิ้วหาร VIEW_SCALE แล้วเทียบกับพื้นที่ออกแบบได้เลย
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, VIEW_SCALE } from '../config';
import { controls, touch } from '../systems/Controls';
import { sfx } from '../systems/sfx';
import { canFullscreen, toggleFullscreen } from '../systems/screenMode';

type Ctx = 'none' | 'world' | 'base' | 'menu';
type BtnName = 'attack' | 'skill' | 'E' | 'B' | 'Q' | 'M' | 'R' | 'back' | 'full';

interface Btn {
  bg: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  color: number;
  r: number;
}

const SHOW: Record<Ctx, BtnName[]> = {
  none: [],
  world: ['attack', 'skill', 'E', 'R'],
  base: [],
  menu: ['back', 'full']
};

const JOY_R = 68;
const JOY_KNOB_R = 32;
const JOY_DEAD = 0.22;
const JOY_ZONE_X = GAME_WIDTH * 0.5;
const JOY_IDLE_X = 124;
const JOY_IDLE_Y = GAME_HEIGHT - 132;

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
  private fullOk = canFullscreen();
  /** เมนูของฉากเปิดอยู่ = ซ่อนจอยและปุ่มทั้งหมด */
  private blocked = false;
  constructor() {
    super({ key: 'TouchControlsScene' });
  }

  create() {
    this.input.addPointer(3);
    this.applyRig();

    this.joyBase = this.add.circle(JOY_IDLE_X, JOY_IDLE_Y, JOY_R, 0xffffff, 0.1).setStrokeStyle(3, 0xffffff, 0.45).setDepth(10);
    this.joyKnob = this.add.circle(JOY_IDLE_X, JOY_IDLE_Y, JOY_KNOB_R, 0xffffff, 0.3).setStrokeStyle(2, 0xffffff, 0.7).setDepth(11);

    // ปุ่มขยายใหญ่ขึ้นทุกปุ่ม — ระยะห่างตรวจแล้วไม่ทับกัน
    this.addBtn('attack', GAME_WIDTH - 100, GAME_HEIGHT - 130, 62, 0xff6a5a, 'ตี', 26);
    this.addBtn('skill', GAME_WIDTH - 225, GAME_HEIGHT - 72, 46, 0x9de7ff, 'สกิล', 19);
    this.addBtn('E', GAME_WIDTH - 210, GAME_HEIGHT - 190, 36, 0xffd166, 'E', 24);
    this.addBtn('B', GAME_WIDTH - 170, 78, 26, 0x9de7ff, 'B', 19);
    this.addBtn('Q', GAME_WIDTH - 108, 78, 26, 0xe8e0c8, 'Q', 19);
    this.addBtn('M', GAME_WIDTH - 46, 78, 26, 0xe8e0c8, 'M', 19);
    this.addBtn('R', GAME_WIDTH / 2, 30, 24, 0x7dff9b, 'R', 18);
    this.addBtn('back', 52, GAME_HEIGHT - 52, 32, 0xe8e0c8, '←', 28);
    this.addBtn('full', GAME_WIDTH - 46, GAME_HEIGHT - 46, 28, 0xe8e0c8, '⛶', 24);

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

  /** กล้องฉากปุ่ม: ขยายจากมุมซ้ายบน ให้พื้นที่ออกแบบคลุมเต็มแคนวาส */
  private applyRig() {
    const c = this.cameras.main;
    c.setPosition(0, 0);
    c.setScroll(0, 0);
    c.setZoom(VIEW_SCALE);
    c.originX = 0;
    c.originY = 0;
  }

  update() {
    this.applyRig();
    const next = this.detectContext();
    const blk = touch.blockJoy;
    if (next !== this.ctx || blk !== this.blocked) {
      this.ctx = next;
      this.blocked = blk;
      this.releaseAll();
      this.applyContext();
      if (next === 'none') touch.reset();
    }
    // เมนูของฉากเปิดอยู่ = ปล่อยจอยที่ค้างและซ่อนไว้ (ไม่ให้วาดทับเมนู)
    if (touch.blockJoy && this.joyId !== -1) this.releaseJoy();
    const joyShow = (this.ctx === 'world' || this.ctx === 'base') && !touch.blockJoy;
    this.joyBase.setVisible(joyShow);
    this.joyKnob.setVisible(joyShow);
  }

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
      case 'full':
        toggleFullscreen();
        this.time.delayedCall(120, () => this.lit('full', false));
        break;
    }
  }

  private emitKey(key: string) {
    const target = this.gameScene();
    if (!target) return;
    const kb: any = target.input.keyboard;
    if (kb && typeof kb.emit === 'function') kb.emit('keydown-' + key, {});
  }

  private onDown(p: Phaser.Input.Pointer) {
    if (!this.isOn()) return;
    sfx.unlock();
    if (this.joyId !== -1 || touch.blockJoy) return;
    if (this.ctx !== 'world' && this.ctx !== 'base') return;
    const px = p.x / VIEW_SCALE;
    const py = p.y / VIEW_SCALE;
    if (px > JOY_ZONE_X) return;
    if (this.input.hitTestPointer(p).length > 0) return;
    this.joyId = p.id;
    this.joyOx = Phaser.Math.Clamp(px, JOY_R + 8, JOY_ZONE_X);
    this.joyOy = Phaser.Math.Clamp(py, 120 + JOY_R, GAME_HEIGHT - JOY_R - 8);
    this.joyBase.setPosition(this.joyOx, this.joyOy).setAlpha(1);
    this.moveStick(p);
  }

  private onMove(p: Phaser.Input.Pointer) {
    if (p.id !== this.joyId) return;
    this.moveStick(p);
  }

  private moveStick(p: Phaser.Input.Pointer) {
    const dx = p.x / VIEW_SCALE - this.joyOx;
    const dy = p.y / VIEW_SCALE - this.joyOy;
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
    if (p.id === this.skillId) this.skillId = -1;
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
    const show = new Set<BtnName>(this.blocked ? [] : SHOW[this.ctx]);
    for (const [name, b] of this.btns) {
      const v = show.has(name) && (name !== 'full' || this.fullOk);
      b.bg.setVisible(v);
      b.label.setVisible(v);
    }
    const joy = (this.ctx === 'world' || this.ctx === 'base') && !this.blocked;
    this.joyBase.setVisible(joy);
    this.joyKnob.setVisible(joy);
  }
}