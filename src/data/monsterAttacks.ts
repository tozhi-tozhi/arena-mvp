// ตารางท่าโจมตีของมอนสเตอร์ — เพิ่มท่าใหม่ = เพิ่มอีกก้อนในตารางนี้

export type AttackKind = 'slam' | 'charge' | 'shockwave' | 'beam' | 'projectile';

export interface AttackDef {
  kind: AttackKind;
  damage: number;
  telegraphMs: number;
  recoverMs: number;

  // slam / shockwave
  radius?: number;

  // charge
  speed?: number;
  durationMs?: number;

  // beam (ลำแสงตรง)
  length?: number;
  width?: number;

  // projectile (ยิงกระสุน)
  projectileSpeed?: number;
  projectileRadius?: number;
  projectileLife?: number;
  projectileCount?: number;   // 1 = ลูกเดียว, 3 = กระจาย 3 ลูก
  projectileSpread?: number;  // องศาระหว่างลูก (ใช้เมื่อ count > 1)
}

export const ATTACKS: Record<string, AttackDef> = {
  // ---------- ของเดิม ----------
  slam: { kind: 'slam', damage: 2, telegraphMs: 800, recoverMs: 900, radius: 110 },
  charge: { kind: 'charge', damage: 1, telegraphMs: 700, recoverMs: 1000, speed: 420, durationMs: 550 },
  charge_fast: { kind: 'charge', damage: 1, telegraphMs: 550, recoverMs: 800, speed: 520, durationMs: 500 },
  shockwave: { kind: 'shockwave', damage: 1, telegraphMs: 600, recoverMs: 900, radius: 280, durationMs: 700 },

  // ---------- ใหม่: ลำแสงตรง (หลบด้วยการขยับออกข้าง) ----------
  beam: {
    kind: 'beam',
    damage: 2,
    telegraphMs: 950,
    recoverMs: 900,
    length: 380,
    width: 44
  },

  // ---------- ใหม่: ยิงกระสุนลูกเดียว (หลบด้วยการขยับ/swipe) ----------
  projectile: {
    kind: 'projectile',
    damage: 1,
    telegraphMs: 500,
    recoverMs: 700,
    projectileSpeed: 190,
    projectileRadius: 11,
    projectileLife: 3500,
    projectileCount: 1
  },

  // ---------- ใหม่: ยิง 3 ลูกกระจาย (ต้องหาช่องว่าง) ----------
  triple_projectile: {
    kind: 'projectile',
    damage: 1,
    telegraphMs: 650,
    recoverMs: 950,
    projectileSpeed: 220,
    projectileRadius: 9,
    projectileLife: 3500,
    projectileCount: 3,
    projectileSpread: 18
  }
};