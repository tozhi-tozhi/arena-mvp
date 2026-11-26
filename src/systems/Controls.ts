// src/systems/Controls.ts — โหมดควบคุม 3 แบบ + สะพานส่งค่าจากปุ่มสัมผัส
// mouse = เมาส์เล็ง + WASD (ของเดิม)  ·  keys = คีย์บอร์ดล้วน (J ตี / K สกิล ทิศตามที่หัน)
// touch = จอสัมผัส (จอยซ้าย · ปุ่มตี · ปุ่มสกิล · เล็งอัตโนมัติหาบอสที่ใกล้สุด)
// ค่าที่เลือกเก็บใน localStorage แยกจากเซฟเกม (arena_controls) — ล้างเซฟไม่กระทบ
import Phaser from 'phaser';

export type ControlMode = 'mouse' | 'keys' | 'touch';
export const CONTROL_MODES: ControlMode[] = ['mouse', 'keys', 'touch'];

export const CONTROL_LABEL: Record<ControlMode, string> = {
  mouse: 'เมาส์ + WASD',
  keys: 'คีย์บอร์ดล้วน (J ตี · K สกิล)',
  touch: 'จอสัมผัส'
};

const STORAGE_KEY = 'arena_controls';

/** อุปกรณ์สัมผัสเป็นหลักไหม (มือถือ/แท็บเล็ต) */
export function isTouchDevice(): boolean {
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch (e) {
    return false;
  }
}

class ControlSettings {
  mode: ControlMode = 'mouse';
  private listeners: Array<(m: ControlMode) => void> = [];

  constructor() {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch (e) {}
    if (saved === 'mouse' || saved === 'keys' || saved === 'touch') {
      this.mode = saved;
    } else {
      // ยังไม่เคยเลือก — มือถือเริ่มที่โหมดสัมผัส ที่อื่นใช้แบบเดิม
      this.mode = isTouchDevice() ? 'touch' : 'mouse';
    }
  }

  set(m: ControlMode) {
    if (this.mode === m) return;
    this.mode = m;
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch (e) {}
    touch.reset();
    for (const fn of this.listeners) fn(m);
  }

  /** สลับโหมดถัดไป (mouse → keys → touch → mouse) */
  cycle(): ControlMode {
    const i = CONTROL_MODES.indexOf(this.mode);
    this.set(CONTROL_MODES[(i + 1) % CONTROL_MODES.length]);
    return this.mode;
  }

  onChange(fn: (m: ControlMode) => void) {
    this.listeners.push(fn);
  }
  offChange(fn: (m: ControlMode) => void) {
    this.listeners = this.listeners.filter((f) => f !== fn);
  }
}

export const controls = new ControlSettings();

/** ข้อความบอกปุ่มสกิลใน HUD ตามโหมด */
export function skillKeyLabel(): string {
  if (controls.mode === 'keys') return 'K';
  if (controls.mode === 'touch') return 'ปุ่มสกิล';
  return 'คลิกขวา';
}

const PULSE_LIFE_MS = 250; // ปุ่มกดแล้วไม่มีฉากไหนรับใน 250ms = ทิ้ง กันของค้างไปทำงานทีหลัง

/** สะพานจากฉากปุ่มสัมผัส (TouchControlsScene) ไปหา PlayerActor และฉากเกม */
class TouchBridge {
  /** ทิศเดิน (ทำให้เป็นเวกเตอร์หน่วยแล้ว · 0,0 = ไม่เดิน) */
  moveX = 0;
  moveY = 0;
    /** เมนูของฉากเปิดอยู่ = ซ่อนจอยและไม่รับนิ้วใหม่ (ฉากเมนูตั้ง/ปล่อยเอง · reset() ไม่แตะค่านี้) */
  blockJoy = false;
  /** ปุ่มตีถูกกดค้างอยู่ไหม (ใช้ชาร์จ) */
  attackDown = false;
  private attackPressedFlag = false;
  private attackReleasedFlag = false;
  private skillPressedFlag = false;
  private pulses = new Map<string, number>();

  reset() {
    this.moveX = 0;
    this.moveY = 0;
    this.attackDown = false;
    this.attackPressedFlag = false;
    this.attackReleasedFlag = false;
    this.skillPressedFlag = false;
    this.pulses.clear();
  }

  pressAttack() {
    this.attackDown = true;
    this.attackPressedFlag = true;
  }
  releaseAttack() {
    if (!this.attackDown) return;
    this.attackDown = false;
    this.attackReleasedFlag = true;
  }
  pressSkill() {
    this.skillPressedFlag = true;
  }

  takeAttackPressed(): boolean {
    const v = this.attackPressedFlag;
    this.attackPressedFlag = false;
    return v;
  }
  takeAttackReleased(): boolean {
    const v = this.attackReleasedFlag;
    this.attackReleasedFlag = false;
    return v;
  }
  takeSkillPressed(): boolean {
    const v = this.skillPressedFlag;
    this.skillPressedFlag = false;
    return v;
  }

  /** ปุ่มบนจอที่เทียบเท่าปุ่มคีย์บอร์ด ('E' | 'M' | 'R') — ฉากเกมมารับด้วย pressed() */
  pulse(name: string) {
    this.pulses.set(name, performance.now());
  }
  consume(name: string): boolean {
    const t = this.pulses.get(name);
    if (t === undefined) return false;
    this.pulses.delete(name);
    return performance.now() - t <= PULSE_LIFE_MS;
  }
}

export const touch = new TouchBridge();

/**
 * กดปุ่มคีย์บอร์ดนั้นหรือกดปุ่มบนจอที่ชื่อเดียวกัน — ฉากใช้แทน Phaser.Input.Keyboard.JustDown ตรง ๆ
 * (เรียกทั้งสองฝั่งเสมอ ไม่ให้ค่าฝั่งใดค้าง)
 */
export function pressed(key: Phaser.Input.Keyboard.Key, name: string): boolean {
  const a = Phaser.Input.Keyboard.JustDown(key);
  const b = touch.consume(name);
  return a || b;
}
