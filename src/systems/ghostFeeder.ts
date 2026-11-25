// src/systems/ghostFeeder.ts — ตัวป้อนปลอมสำหรับทดสอบตัวผี (ยังไม่มีเน็ต)
// สร้างข้อมูลสถานะรูปแบบเดียวกับที่จะส่งผ่านเน็ตใน D2 · ส่งที่ 20 ครั้งต่อวินาที
// บอทเดินวน แล้วหยุดเล่นคลิปทีละท่าตามลำดับ วนซ้ำไม่จบ
// ช่วง D2 แทนตัวป้อนนี้ด้วยข้อมูลจากเน็ต ตัวผีไม่ต้องแก้
import type { GhostState } from '../actors/RemotePlayer';
import { artOf } from '../data/characterArt';

const SEND_EVERY_MS = 50; // 20 ครั้งต่อวินาที
const WALK_SPEED = 150; // px ต่อวินาที (เท่าความเร็วเดินอัคนี)
const HOLD_AFTER_MS = 500; // ค้างท้ายท่าก่อนไปท่าถัดไป
const CHARGE_HOLD_MS = 60; // เวลาต่อเฟรมของ charge_hold (ค่าทดสอบ)
const CHARGE_HOLD_EXTRA = 1500; // ค้างเฟรมสุดท้ายนานเท่านี้ เพื่อดูว่าไม่วนซ้ำ

// ลำดับคลิปทดสอบ — combo1 ซ้ำสองรอบติดกันเพื่อทดสอบ clipSeq
const CLIP_ORDER = [
  'combo1', 'combo1', 'combo2',
  'combo3_spin', 'combo3_wave', 'combo3_triangle',
  'barrage',
  'charge_hold', 'charge_spin', 'charge_rush', 'charge_heal',
  'ulti_sweep', 'ulti_slam', 'ulti_star',
  'knock'
];

interface Stage {
  clip: string;
  ms: number;
  durationMs: number;
  moving: boolean;
}

export class GhostFeeder {
  private cx: number;
  private cy: number;
  private radius: number;
  private angle: number = 0;
  private flip: boolean = false;
  private lastSendAt: number = -1;
  private clipSeq: number = 1;
  private stages: Stage[] = [];
  private idx: number = 0;
  private stageStartAt: number;

  constructor(cx: number, cy: number, radius: number, now: number) {
    this.cx = cx;
    this.cy = cy;
    this.radius = radius;
    this.stageStartAt = now;

    const clips = artOf('akkhani').clips;
    this.stages.push({ clip: 'walk', ms: 120, durationMs: 3000, moving: true });
    this.stages.push({ clip: 'idle', ms: 1000, durationMs: 1000, moving: false });
    for (const name of CLIP_ORDER) {
      const def = clips[name];
      if (!def) continue;
      const ms = name === 'charge_hold' ? CHARGE_HOLD_MS : def.frameMs ?? 60;
      const extra = name === 'charge_hold' ? CHARGE_HOLD_EXTRA : HOLD_AFTER_MS;
      this.stages.push({ clip: name, ms, durationMs: def.frames * ms + extra, moving: false });
      this.stages.push({ clip: 'idle', ms: 1000, durationMs: 600, moving: false });
    }
  }

  /** ตำแหน่งเริ่มของบอท (มุม 0) */
  startPos(): { x: number; y: number } {
    return { x: this.cx + this.radius, y: this.cy };
  }

  /** เรียกทุกเฟรม — ถึงรอบส่งคืนข้อมูลสถานะ ไม่ถึงคืน null */
  tick(now: number): GhostState | null {
    if (this.lastSendAt >= 0 && now - this.lastSendAt < SEND_EVERY_MS) return null;
    const dt = this.lastSendAt < 0 ? 0 : now - this.lastSendAt;
    this.lastSendAt = now;

    let stage = this.stages[this.idx];
    if (now - this.stageStartAt >= stage.durationMs) {
      this.idx = (this.idx + 1) % this.stages.length;
      this.stageStartAt = now;
      this.clipSeq++;
      stage = this.stages[this.idx];
    }

    if (stage.moving) {
      const omega = WALK_SPEED / this.radius; // เรเดียนต่อวินาที
      this.angle += (omega * dt) / 1000;
      this.flip = -Math.sin(this.angle) < 0; // ทิศแนวสัมผัส
    }

    return {
      x: this.cx + Math.cos(this.angle) * this.radius,
      y: this.cy + Math.sin(this.angle) * this.radius,
      flip: this.flip,
      clip: stage.clip,
      ms: stage.ms,
      clipSeq: this.clipSeq,
      age: now - this.stageStartAt
    };
  }
}