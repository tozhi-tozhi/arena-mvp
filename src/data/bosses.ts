// ข้อมูลและตัวเลขสมดุลของบอส + ระบบไฟไหม้ของผู้เล่น
// เลือดบอสเป็น "เลือดฐานเขตตื้น" (ตัวคูณเขตตื้น = 1.0) — เขตถัดไปคูณใน data/depth.ts
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
    desc: 'กระต่ายฝันร้าย — กระโดดแยกเงา กรงสามเหลี่ยม ตีผิดร่างเลือดไม่ลด'
  }
};

export const BOSS_DEFS: Record<BossId, BossDef> = {
  phasama: { id: 'phasama', name: 'ภัสมะ', hp: 3000, color: 0xff6a2a, displayWidth: 195 },
  maya: { id: 'maya', name: 'มายา', hp: 2600, color: 0xb07aff, displayWidth: 155 }
};

export function pickRandomBossId(): BossId {
  return BOSS_IDS[Math.floor(Math.random() * BOSS_IDS.length)];
}

// ตัวคูณดาเมจที่บอสตีผู้เล่น — ปัดเศษที่ใกล้ที่สุด ขั้นต่ำ 1
export function scaleBossDamage(base: number, mult: number): number {
  return Math.max(1, Math.round(base * mult));
}

// ---------- ระบบไฟไหม้ (ผู้เล่น) ----------
export const BURN = {
  maxLevel: 5,
  exposureMsPerLevel: 600,
  graceMs: 300,
  decayMsPerLevel: 700,
  tickIntervals: [0, 1500, 1200, 900, 700, 500],
  tickDamage: 50,
  shieldImmuneMs: 700
};

// ---------- ภัสมะ (บอสไฟ) ----------
export const PHASAMA = {
  walkSpeed: 55,
  rageSpeedMult: 1.25,
  chaseMs: [1100, 1900] as [number, number],
  flame: {
    telegraphMs: 700,
    durationMs: 2400,
    length: 215,
    halfAngle: 26,
    turnDegPerSec: 30,
    turnRampMs: 900,
    turnStartRatio: 0.35,
    moveSpeed: 34,
    recoverMs: 1200
  },
  dash: {
    telegraphMs: 550,
    speed: 520,
    durationMs: 450,
    flameLength: 150,
    flameHalfAngle: 38,
    bodyDamage: 120,
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
    dashDamage: 100,
    dizzyMs: 2000,
    dizzyDamageMult: 1.5
  }
};

// ---------- มายา (บอสฝันร้าย) ----------
// ตัวปรับความยากหลัก: jump.radius / tri.size / clone.count / chaseMs
export const MAYA = {
  walkSpeed: 46,
  rageSpeedMult: 1.25,
  chaseMs: [700, 1200] as [number, number],
  jump: {
    telegraphMs: 700,
    flightMs: 450,
    radius: 100,
    damage: 120,
    recoverMs: 600
  },
  vanish: {
    telegraphMs: 900,
    trackMs: 600,
    fallMs: 250,
    radius: 115,
    damage: 200,
    recoverMs: 700
  },
  tri: {
    size: 110,
    warnMs: 800,
    flashMs: 200,
    gapMs: 300,
    damage: 100,
    waves: 3,
    wavesRage: 4,
    perWave: 1,
    perWaveRage: 1,
    cageCount: 3,
    cageRingDist: 85,
    cageGapSlots: 6,
    minDistFromBoss: 0,
    windupMs: 450,
    recoverMs: 600
  },
  clone: {
    durationMs: 5000,
    delayMs: 260,
    distMin: 95,
    distMax: 155,
    count: 2,
    countRage: 3,
    punishTriSize: 78,
    punishWarnMs: 620
  }
};

// รายชื่อบอสที่สามารถสุ่มเกิดใน The World ได้
export const SPAWNABLE_BOSSES: BossId[] = ['phasama', 'maya'];