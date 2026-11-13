// ข้อมูลและตัวเลขสมดุลของบอส + ระบบไฟไหม้ของผู้เล่น
import type { BossDef } from '../entities/BossBase';

export type BossId = 'phasama' | 'maya';
export type BossChoice = BossId | 'random';

export const BOSS_IDS: BossId[] = ['phasama', 'maya'];

export interface BossInfo {
  id: BossId;
  name: string;
  desc: string;
}

export const BOSSES: Record<BossId, BossInfo> = {
  phasama: {
    id: 'phasama',
    name: 'ภัสมะ',
    desc: 'ตัวนิ่มลาวา — พ่นไฟค้าง ไฟสะสม คลั่งแล้วหมุนเป็นลูกข่าง'
  },
  maya: {
    id: 'maya',
    name: 'มายา',
    desc: 'กระต่ายฝันร้าย — กระโดดแยกร่าง ระเบิดสามเหลี่ยม'
  }
};

export const BOSS_DEFS: Record<BossId, BossDef> = {
  phasama: { id: 'phasama', name: 'ภัสมะ', hp: 80, color: 0xff6a2a, displayWidth: 144 },
  maya: { id: 'maya', name: 'มายา', hp: 70, color: 0xb07aff, displayWidth: 112 }
};

export function pickRandomBossId(): BossId {
  return BOSS_IDS[Math.floor(Math.random() * BOSS_IDS.length)];
}

// ---------- ระบบไฟไหม้ (ผู้เล่น) ----------
export const BURN = {
  maxLevel: 5,
  exposureMsPerLevel: 600,   // อยู่ในไฟนานเท่านี้ ระดับ +1
  graceMs: 300,              // ออกจากไฟแล้วรอเท่านี้ก่อนเริ่มลดระดับ
  decayMsPerLevel: 700,      // ลดระดับทีละ 1 ทุกเท่านี้
  tickIntervals: [0, 1500, 1200, 900, 700, 500], // ติ๊กดาเมจ ตามระดับ (ms)
  tickDamage: 1,
  shieldImmuneMs: 700        // หลังโล่กันไฟ จะไม่ติดไฟซ้ำช่วงสั้นๆ
};

// ---------- ภัสมะ (บอสไฟ) ----------
export const PHASAMA = {
  walkSpeed: 55,
  rageSpeedMult: 1.25,
  chaseMs: [1100, 1900] as [number, number],
  flame: {
    telegraphMs: 600,
    durationMs: 2800,
    length: 240,
    halfAngle: 28,        // ครึ่งมุมกรวยไฟ (องศา)
    turnDegPerSec: 55,    // ความเร็วที่กรวยหมุนตามผู้เล่น (ตัวปรับความยากหลัก)
    moveSpeed: 38,
    recoverMs: 1000
  },
  dash: {
    telegraphMs: 550,
    speed: 520,
    durationMs: 450,
    flameLength: 150,
    flameHalfAngle: 38,
    bodyDamage: 1,
    recoverMs: 900
  },
  spin: {
    telegraphMs: 700,
    durationMs: 4500,
    ringRadius: 120,
    spinDegPerSec: 720,
    moveSpeed: 85,
    dashEveryMs: 1500,
    dashAimMs: 400,
    dashSpeed: 460,
    dashDurationMs: 320,
    dizzyMs: 2000,
    dizzyDamageMult: 1.5
  }
};

// ---------- มายา (บอสฝันร้าย) ----------
export const MAYA = {
  walkSpeed: 40,
  rageSpeedMult: 1.2,
  chaseMs: [1200, 2000] as [number, number],
  jump: { telegraphMs: 700, flightMs: 450, radius: 62, damage: 1, recoverMs: 900 },
  vanish: { telegraphMs: 900, trackMs: 600, fallMs: 250, radius: 70, damage: 1, recoverMs: 900 },
  tri: {
    size: 75,              // รัศมีสามเหลี่ยม
    warnMs: 800,           // เวลาเตือนก่อนระเบิด
    flashMs: 200,
    gapMs: 350,            // ระยะห่างระหว่างระลอก
    damage: 1,
    waves: 4,
    wavesRage: 3,
    perWave: 1,
    perWaveRage: 2,
    nearPlayerChance: 0.6, // โอกาสที่จุดระเบิดจะโผล่ใกล้ผู้เล่น (บีบให้ต้องขยับ)
    nearRadius: 90,
    minDistFromBoss: 140,
    windupMs: 450,
    recoverMs: 900
  },
  clone: {
    durationMs: 4500,
    delayMs: 300,          // ร่างปลอมเลียนการเคลื่อนไหวช้ากว่าตัวจริง
    distMin: 90,
    distMax: 150,
    alpha: 0.55,
    count: 1,
    countRage: 2
  }
};