// src/systems/ghostFeeder.ts — ตัวป้อนปลอมสำหรับทดสอบตัวผี (ยังไม่มีเน็ต)
// สร้างข้อมูลสถานะรูปแบบเดียวกับที่จะส่งผ่านเน็ตใน D2 · ส่งที่ 20 ครั้งต่อวินาที
// ช่วง D2 แทนตัวป้อนนี้ด้วยข้อมูลจากเน็ต ตัวผีไม่ต้องแก้
import type { GhostState } from '../actors/RemotePlayer';

const SEND_EVERY_MS = 50; // 20 ครั้งต่อวินาที
const WALK_SPEED = 150; // px ต่อวินาที (เท่าความเร็วเดินอัคนี)

export class GhostFeeder {
  private cx: number;
  private cy: number;
  private radius: number;
  private startAt: number;
  private lastSendAt: number = -1;
  private clipSeq: number = 0;
  private clipStartAt: number;

  constructor(cx: number, cy: number, radius: number, now: number) {
    this.cx = cx;
    this.cy = cy;
    this.radius = radius;
    this.startAt = now;
    this.clipStartAt = now;
    this.clipSeq = 1;
  }

  /** ตำแหน่งเริ่มของบอท (มุม 0) */
  startPos(): { x: number; y: number } {
    return { x: this.cx + this.radius, y: this.cy };
  }

  /** เรียกทุกเฟรม — ถึงรอบส่งคืนข้อมูลสถานะ ไม่ถึงคืน null */
  tick(now: number): GhostState | null {
    if (this.lastSendAt >= 0 && now - this.lastSendAt < SEND_EVERY_MS) return null;
    this.lastSendAt = now;

    const omega = WALK_SPEED / this.radius; // เรเดียนต่อวินาที
    const a = ((now - this.startAt) / 1000) * omega;
    const x = this.cx + Math.cos(a) * this.radius;
    const y = this.cy + Math.sin(a) * this.radius;
    const vx = -Math.sin(a); // ทิศแนวสัมผัส (วนตามเข็มนาฬิกาบนจอ)

    return {
      x,
      y,
      flip: vx < 0,
      clip: 'walk',
      ms: 120,
      clipSeq: this.clipSeq,
      age: now - this.clipStartAt
    };
  }
}