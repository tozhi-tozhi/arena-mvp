// src/systems/AreaQuests.ts — สุ่มเควส 1 อย่างต่อแอเรีย + ตรวจความสำเร็จ + ร่องรอยนำทาง
// เควสสำรวจ: สุ่ม 2–3 จุด เหยียบครบทุกจุดถึงสำเร็จ — จุดที่พบแล้วเปลี่ยนเป็นสีเขียว
import Phaser from 'phaser';
import { DEPTH } from '../config';
import type { AreaLayout, Point } from './AreaGenerator';
import { makeRng } from './AreaGenerator';
import {
  QUEST_POOL, COLLECT_NEED, EXPLORE_POINTS, EXPLORE_RADIUS, EXPLORE_MIN_BETWEEN,
  TRAIL, GLINT, type QuestDef
} from '../data/quests';
import { SealedCache } from '../entities/SealedCache';
import { GROUND_LOOT_PER_SPOT } from '../data/world';
import { showDamage, burst, ringEffect, makeGlow, destroyGlow } from './effects';
import { sfx } from './sfx';

export interface SiteVisual {
  ring: Phaser.GameObjects.Arc;
  pole: Phaser.GameObjects.Rectangle;
  glow: any;
}

export interface ActiveQuest {
  def: QuestDef;
  /** explore: 2–3 จุด · seal: 1 จุด · collect/hunt: ว่าง */
  sites: Point[];
  /** สถานะเหยียบจุด (ใช้กับ explore) */
  visited: boolean[];
  /** วง + เสา ของจุดสำรวจ (เปลี่ยนสีเมื่อพบ) */
  visuals: SiteVisual[];
  cache: SealedCache | null;
  done: boolean;
  collected: number;
  /** จำนวนของพื้นที่ต้องเก็บ (ไม่เกินของพื้นที่มีจริงในแมพ) */
  collectNeed: number;
}

export interface QuestContext {
  playerX: number;
  playerY: number;
  aliveBosses: number;
  totalBosses: number;
}

/** สุ่มเควส + วางจุด/กล่อง/ร่องรอย — เรียกครั้งเดียวตอนสร้างแอเรีย */
export function setupAreaQuest(
  scene: Phaser.Scene,
  layout: AreaLayout,
  seed: number,
  bossCount: number
): ActiveQuest {
  const rng = makeRng(seed ^ 0x9e3779b9);
  
  // แก้บั๊ก const pool ซ้ำ และกรองเควสที่ทำไม่ได้ออก
  const pool = QUEST_POOL.filter((q) =>
    (q.kind !== 'hunt' || bossCount > 0) &&
    (q.kind !== 'collect' || layout.lootSpots.length > 0)
  );
  
  const def = pool[Math.floor(rng() * pool.length)];

  const quest: ActiveQuest = {
    def, sites: [], visited: [], visuals: [], cache: null, done: false, collected: 0,
    collectNeed: Math.min(COLLECT_NEED, layout.lootSpots.length * GROUND_LOOT_PER_SPOT)
  };

  if (def.kind === 'explore') {
    const need = EXPLORE_POINTS[0] + Math.floor(rng() * (EXPLORE_POINTS[1] - EXPLORE_POINTS[0] + 1));
    for (let i = 0; i < need; i++) {
      const site = pickSite(layout, rng, quest.sites);
      quest.sites.push(site);
      quest.visited.push(false);
      quest.visuals.push(makeSiteMark(scene, site));
      layTrail(scene, layout.spawn, site, rng);
    }
  } else if (def.kind === 'seal') {
    const site = pickSite(layout, rng, []);
    quest.sites.push(site);
    quest.cache = new SealedCache(scene, site.x, site.y);
    layTrail(scene, layout.spawn, site, rng);
  } else if (def.kind === 'collect') {
    for (const spot of layout.lootSpots) layTrail(scene, layout.spawn, spot, rng);
  }

  return quest;
}

/** จุดเป้าหมาย: ห่างจุดเกิด/ประตู/ลานกลาง และห่างจุดเป้าหมายอื่น — ผ่อนเงื่อนไขเป็นขั้น */
function pickSite(layout: AreaLayout, rng: () => number, avoid: Point[]): Point {
  for (let relax = 0; relax < 3; relax++) {
    const k = 1 - relax * 0.3;
    for (let tries = 0; tries < 250; tries++) {
      const x = 280 + rng() * (layout.width - 560);
      const y = 280 + rng() * (layout.height - 560);
      if (Math.hypot(x - layout.spawn.x, y - layout.spawn.y) < 900 * k) continue;
      if (Math.hypot(x - layout.exitGate.x, y - layout.exitGate.y) < 300) continue;
      if (Math.hypot(x - layout.arena.x, y - layout.arena.y) < layout.arena.r * k) continue;
      if (avoid.some((p) => Math.hypot(x - p.x, y - p.y) < EXPLORE_MIN_BETWEEN * k)) continue;
      return { x, y };
    }
  }
  return layout.lootSpots[0] ?? { x: layout.width / 2, y: layout.height / 2 };
}

/** วงจาง + เสากระดาษ — เครื่องหมายจุดสำรวจ (ยังพบ = สีครีม, พบแล้ว = เขียว) */
function makeSiteMark(scene: Phaser.Scene, site: Point): SiteVisual {
  const ring = scene.add.circle(site.x, site.y, EXPLORE_RADIUS, 0xd8cfb8, 0.06);
  ring.setStrokeStyle(2, 0xd8cfb8, 0.35);
  ring.setDepth(DEPTH.TELEGRAPH);
  
  const pole = scene.add.rectangle(site.x, site.y - 14, 8, 34, 0xe8e0c8);
  pole.setStrokeStyle(2, 0x8a6a2a);
  pole.setDepth(DEPTH.ENEMY);
  
  scene.tweens.add({ targets: pole, angle: 4, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

  // แสงอำพันสีทอง (P3b)
  const glow = makeGlow(scene, site.x, site.y, 35, 0xffd166, true);

  return { ring, pole, glow };
}

/** เหยียบจุดสำเร็จ — เปลี่ยนเครื่องหมายเป็นเขียว + เอฟเฟกต์ยืนยัน */
function markSiteVisited(scene: Phaser.Scene, quest: ActiveQuest, index: number) {
  quest.visited[index] = true;
  const v = quest.visuals[index];
  const site = quest.sites[index];
  if (v) {
    v.ring.setFillStyle(0x7dff9b, 0.1).setStrokeStyle(3, 0x7dff9b, 0.8);
    scene.tweens.killTweensOf(v.pole);
    v.pole.setAngle(0).setFillStyle(0x7dff9b);
    destroyGlow(v.glow); // ดับแสงเมื่อสำเร็จ
  }
  burst(scene, site.x, site.y, 0x7dff9b, 10, 60, 4);
  ringEffect(scene, site.x, site.y, EXPLORE_RADIUS, 0x7dff9b, 400);
  
  // เสาแสงพุ่งฟ้า ณ จุดที่พบ — เห็นแต่ไกลว่าจุดไหนเคลียร์แล้ว
  const beam = scene.add.rectangle(site.x, site.y - 120, 10, 240, 0x7dff9b, 0.55);
  beam.setDepth(DEPTH.BURST);
  scene.tweens.add({
    targets: beam, alpha: 0, scaleY: 1.4, duration: 1200,
    onComplete: () => beam.destroy()
  });
  
  sfx.pickup();
  const found = quest.visited.filter(Boolean).length;
  showDamage(scene, site.x, site.y - 50, `พบจุดสำรวจ (${found}/${quest.sites.length})`, '#7dff9b', 1400);
}

/** โปรยเศษกระดาษจาง ๆ จากทางจุดเกิดมุ่งเข้าหาเป้า — เดินตามก็เจอ แต่ไม่ชี้ตรง */
function layTrail(scene: Phaser.Scene, from: Point, to: Point, rng: () => number) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / len;
  const uy = dy / len;
  for (let i = 0; i < TRAIL.crumbCount; i++) {
    const d = TRAIL.crumbStartDist + i * TRAIL.crumbGap;
    if (d >= len - 60) break;
    const sway = (rng() - 0.5) * 90;
    const x = to.x - ux * d - uy * sway;
    const y = to.y - uy * d + ux * sway;
    const crumb = scene.add.rectangle(x, y, TRAIL.size, TRAIL.size * 0.7, 0xe8e0c8, 0.5);
    crumb.setAngle(rng() * 180);
    crumb.setDepth(DEPTH.FLOOR + 1);
    scene.tweens.add({
      targets: crumb, alpha: 0.2, duration: 1200 + rng() * 800,
      yoyo: true, repeat: -1, delay: rng() * 900
    });
  }
}

/** เรียกทุกเฟรม — คืน true "เฟรมที่ทำสำเร็จพอดี" (ฉากใช้ปลดประตูครั้งเดียว) */
export function tickQuest(scene: Phaser.Scene, quest: ActiveQuest, ctx: QuestContext): boolean {
  if (quest.done) return false;
  let ok = false;
  switch (quest.def.kind) {
    case 'collect':
      ok = quest.collectNeed > 0 && quest.collected >= quest.collectNeed;
      break;
    case 'hunt':
      ok = ctx.totalBosses > 0 && ctx.aliveBosses === 0;
      break;
    case 'explore':
      for (let i = 0; i < quest.sites.length; i++) {
        if (quest.visited[i]) continue;
        const s = quest.sites[i];
        if (Phaser.Math.Distance.Between(ctx.playerX, ctx.playerY, s.x, s.y) <= EXPLORE_RADIUS) {
          markSiteVisited(scene, quest, i);
        }
      }
      ok = quest.sites.length > 0 && quest.visited.every(Boolean);
      break;
    case 'seal':
      ok = !!quest.cache && quest.cache.isCracked;
      break;
  }
  if (ok) quest.done = true;
  return ok;
}

/** ข้อความคืบหน้าสำหรับ HUD */
export function questProgressText(quest: ActiveQuest, ctx: QuestContext): string {
  if (quest.done) return 'สำเร็จ!';
  switch (quest.def.kind) {
    case 'collect': return `${quest.collected}/${quest.collectNeed} ชิ้น`;
    case 'hunt':    return `บอสเหลือ ${ctx.aliveBosses}`;
    case 'explore': return `${quest.visited.filter(Boolean).length}/${quest.sites.length} จุด`;
    case 'seal':    return quest.cache?.isBroken ? 'ผนึกพังแล้ว' : 'ยังไม่แกะ';
  }
}

/** แสงวาบที่จุดสำรวจยังไม่พบ เมื่อเข้าใกล้พอ — เรียกทุกเฟรม (กล่องจัดการวาบของตัวเอง) */
export function tickQuestGlint(
  scene: Phaser.Scene, quest: ActiveQuest, px: number, py: number,
  now: number, lastGlintAt: { value: number }
) {
  if (quest.done || quest.cache || quest.def.kind !== 'explore') return;
  if (now - lastGlintAt.value < GLINT.everyMs) return;
  // วาบเฉพาะจุดที่ยังไม่พบ และใกล้ที่สุด — ไม่เหมาทุกจุดพร้อมกัน
  let best: Point | null = null;
  let bestD = Infinity;
  for (let i = 0; i < quest.sites.length; i++) {
    if (quest.visited[i]) continue;
    const s = quest.sites[i];
    const d = Phaser.Math.Distance.Between(px, py, s.x, s.y);
    if (d < bestD) { bestD = d; best = s; }
  }
  if (!best || bestD > GLINT.range) return;
  lastGlintAt.value = now;
  const glint = scene.add.circle(best.x, best.y - 20, 6, GLINT.color, 0.9);
  glint.setDepth(DEPTH.BURST);
  scene.tweens.add({ targets: glint, scale: 2.4, alpha: 0, duration: 700, onComplete: () => glint.destroy() });
}

/** ใบ้เชิงทิศ+ระยะ — คมขึ้น: ทิศ 8 ทิศ + เมตรตัวเลข + จำนวนจุดที่เหลือ */
export function questDirectionHint(
  quest: ActiveQuest, px: number, py: number, layout: AreaLayout, groundSpots: Point[] = []
): string {
  let target: Point | null = null;

  if (quest.def.kind === 'explore') {
    let bestD = Infinity;
    for (let i = 0; i < quest.sites.length; i++) {
      if (quest.visited[i]) continue;
      const s = quest.sites[i];
      const d = Math.hypot(s.x - px, s.y - py);
      if (d < bestD) { bestD = d; target = s; }
    }
    if (!target) return 'ครบทุกจุดแล้ว';
  } else if (quest.def.kind === 'seal') {
    if (quest.cache?.isBroken) return 'ผนึกพังแล้ว — หาประตูกลับฐาน';
    target = quest.sites[0] ?? null;
  } else if (quest.def.kind === 'collect') {
    let bestD = Infinity;
    for (const s of groundSpots) {
      const d = Math.hypot(s.x - px, s.y - py);
      if (d < bestD) { bestD = d; target = s; }
    }
  }

  if (!target) return quest.def.hint;
  const dx = target.x - px;
  const dy = target.y - py;
  const dist = Math.hypot(dx, dy);
  // เมตรเกม: 100px = 1 เมตร — ตัวเลขทำให้กะเวลาเดินได้จริง
  const meters = Math.round(dist / 100);
  if (dist < 200) return 'อยู่ตรงนี้แล้ว — มองหาแสงวาบกับเครื่องหมาย';
  const dir = compass8(dx, dy);
  let tail = '';
  if (quest.def.kind === 'explore') {
    const left = quest.visited.filter((v) => !v).length;
    tail = ` · เหลือ ${left} จุด`;
  } else if (quest.def.kind === 'collect') {
    tail = ' · แหล่งของใกล้สุด';
  }
  return `มุ่ง${dir} ~${meters} ม.${tail}`;
}

function compass8(dx: number, dy: number): string {
  const names = ['ตะวันออก', 'ตะวันออกเฉียงใต้', 'ใต้', 'ตะวันตกเฉียงใต้', 'ตะวันตก', 'ตะวันตกเฉียงเหนือ', 'เหนือ', 'ตะวันออกเฉียงเหนือ'];
  const a = Math.atan2(dy, dx);
  const idx = Math.round(a / (Math.PI / 4));
  return names[((idx % 8) + 8) % 8];
}