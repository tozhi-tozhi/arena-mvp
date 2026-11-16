// src/systems/AreaGenerator.ts — สุ่มประกอบแอเรียจากแผ่นภูมิประเทศ 400x400
// ฟังก์ชันล้วน (ไม่แตะ Phaser) — seed เดียวกัน ได้แอเรียเดียวกัน ทดสอบง่าย
import {
  TILE_SIZE,
  AREA_SIZES,
  TILE_KIND_IDS,
  TILE_KINDS,
  TILE_CLUSTER_CHANCE,
  SPAWN_INSET,
  GATE_INSET,
  PROP_CLEAR_RADIUS,
  CENTER_CLEAR_RADIUS,
  GROUND_LOOT_SPOTS,
  LOOT_MIN_FROM_SPAWN,
  LOOT_MIN_BETWEEN,
  type TileKind
} from '../data/world';

export interface Point {
  x: number;
  y: number;
}
export type PropKind = 'rock' | 'bush' | 'tuft';
export interface PropSpawn extends Point {
  kind: PropKind;
  scale: number;
  flip: boolean;
}
export interface AreaLayout {
  seed: number;
  cols: number;
  rows: number;
  width: number;
  height: number;
  /** ชนิดแผ่น เรียงทีละแถว (index = row * cols + col) */
  tiles: TileKind[];
  spawn: Point;
  returnGate: Point;
  exitGate: Point;
  /** Negative Space กลางแอเรีย (เว้นไว้สู้บอส) */
  arena: Point & { r: number };
  props: PropSpawn[];
  /** จุดของตกพื้น (แต่ละจุดวางไอเทมหลายชิ้นรอบ ๆ) */
  lootSpots: Point[];
}

// ตัวสุ่มแบบกำหนด seed ได้ (mulberry32)
export function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(rng: () => number): TileKind {
  const total = TILE_KIND_IDS.reduce((s, k) => s + TILE_KINDS[k].weight, 0);
  let r = rng() * total;
  for (const k of TILE_KIND_IDS) {
    r -= TILE_KINDS[k].weight;
    if (r <= 0) return k;
  }
  return TILE_KIND_IDS[0];
}

type Side = 'left' | 'right' | 'top' | 'bottom';
const OPPOSITE: Record<Side, Side> = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };

// จุดบนขอบด้านที่เลือก ห่างขอบ inset px และอยู่ตำแหน่ง t (0..1) ตามแนวขอบ
function edgePoint(side: Side, inset: number, t: number, w: number, h: number): Point {
  const along = (len: number) => Math.max(TILE_SIZE, Math.min(len - TILE_SIZE, len * t));
  if (side === 'left') return { x: inset, y: along(h) };
  if (side === 'right') return { x: w - inset, y: along(h) };
  if (side === 'top') return { x: along(w), y: inset };
  return { x: along(w), y: h - inset };
}

export function generateArea(seed: number): AreaLayout {
  const rng = makeRng(seed);
  const size = AREA_SIZES[Math.floor(rng() * AREA_SIZES.length)];
  const { cols, rows } = size;
  const width = cols * TILE_SIZE;
  const height = rows * TILE_SIZE;

  // ---------- แผ่นภูมิประเทศ (เกาะกลุ่มกับแผ่นซ้าย/บน) ----------
  const tiles: TileKind[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const left = c > 0 ? tiles[r * cols + c - 1] : null;
      const up = r > 0 ? tiles[(r - 1) * cols + c] : null;
      const neighbors = [left, up].filter(Boolean) as TileKind[];
      if (neighbors.length && rng() < TILE_CLUSTER_CHANCE) {
        tiles.push(neighbors[Math.floor(rng() * neighbors.length)]);
      } else {
        tiles.push(pickWeighted(rng));
      }
    }
  }

  // ---------- จุดเกิด + ประตูกลับฐาน (ด้านหนึ่ง) · ประตูไปต่อ (ด้านตรงข้าม) ----------
  const sides: Side[] = ['left', 'right', 'top', 'bottom'];
  const spawnSide = sides[Math.floor(rng() * sides.length)];
  const alongT = 0.25 + rng() * 0.5;
  const spawn = edgePoint(spawnSide, SPAWN_INSET, alongT, width, height);
  const returnGate = edgePoint(spawnSide, GATE_INSET, alongT, width, height);
  const exitGate = edgePoint(OPPOSITE[spawnSide], GATE_INSET, 0.25 + rng() * 0.5, width, height);
  const arena = { x: width / 2, y: height / 2, r: CENTER_CLEAR_RADIUS };

  // ---------- ของตกแต่งพื้น (ยังไม่ชน/ไม่บัง — แค่ให้เห็นการเคลื่อนที่) ----------
  const keepClear: (Point & { r: number })[] = [
    { ...spawn, r: PROP_CLEAR_RADIUS },
    { ...returnGate, r: PROP_CLEAR_RADIUS },
    { ...exitGate, r: PROP_CLEAR_RADIUS },
    arena
  ];
  const props: PropSpawn[] = [];
  const margin = 60;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const [lo, hi] = TILE_KINDS[tiles[r * cols + c]].props;
      const n = lo + Math.floor(rng() * (hi - lo + 1));
      for (let i = 0; i < n; i++) {
        const x = c * TILE_SIZE + margin + rng() * (TILE_SIZE - margin * 2);
        const y = r * TILE_SIZE + margin + rng() * (TILE_SIZE - margin * 2);
        if (keepClear.some((z) => Math.hypot(x - z.x, y - z.y) < z.r)) continue;
        const roll = rng();
        props.push({
          x,
          y,
          kind: roll < 0.35 ? 'rock' : roll < 0.65 ? 'bush' : 'tuft',
          scale: 0.8 + rng() * 0.6,
          flip: rng() < 0.5
        });
      }
    }
  }

  // ---------- จุดของตกพื้น 2–4 จุด: ห่างจุดเกิด/ประตู/ลานกลาง และห่างกันเอง ----------
  const lootSpots: Point[] = [];
  const wantSpots = GROUND_LOOT_SPOTS[0] + Math.floor(rng() * (GROUND_LOOT_SPOTS[1] - GROUND_LOOT_SPOTS[0] + 1));
  for (let relax = 0; relax < 3 && lootSpots.length < wantSpots; relax++) {
    const k = 1 - relax * 0.25; // ผ่อนเงื่อนไขระยะลงทีละขั้น ถ้าสุ่มไม่ติด
    for (let tries = 0; tries < 300 && lootSpots.length < wantSpots; tries++) {
      const x = 260 + rng() * (width - 520);
      const y = 260 + rng() * (height - 520);
      if (Math.hypot(x - spawn.x, y - spawn.y) < LOOT_MIN_FROM_SPAWN * k) continue;
      if (Math.hypot(x - exitGate.x, y - exitGate.y) < 300) continue;
      if (Math.hypot(x - arena.x, y - arena.y) < arena.r) continue;
      if (lootSpots.some((p) => Math.hypot(x - p.x, y - p.y) < LOOT_MIN_BETWEEN * k)) continue;
      lootSpots.push({ x, y });
    }
  }

  return { seed, cols, rows, width, height, tiles, spawn, returnGate, exitGate, arena, props, lootSpots };
}
