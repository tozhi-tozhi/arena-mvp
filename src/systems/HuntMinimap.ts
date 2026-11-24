// src/systems/HuntMinimap.ts — แผนที่กระดาษประจำแอเรีย (3F)
// หมอกสำรวจ: เดินเข้าไปเท่านั้นถึงเห็น · ร่องรอย: ทางที่เดิน + รังบอสที่พบแล้วจำไว้ทั้งทริป
// เป็น UI ติดจอ (scrollFactor 0) — UiCamera แยกไปกล้อง UI ให้เอง ไม่โตตามซูมตอนสู้บอส
// วาดด้วย Graphics ล้วน 4 ชั้น: พื้น (ครั้งเดียว) · หมอก (เป็นจังหวะ) · ร่องรอย+เครื่องหมาย (เป็นจังหวะ) · ลูกศรผู้เล่น (ทุกเฟรม)
// Q หรือคลิกที่แผง = เต็ม → เล็ก → ปิด · ปิดแล้วยังมีปุ่มเล็กให้เรียกกลับ
import Phaser from 'phaser';
import { DEPTH } from '../config';
import { TILE_KINDS } from '../data/world';
import { MINIMAP } from '../data/minimap';
import type { AreaLayout } from './AreaGenerator';
import type { DroppedItem } from '../entities/DroppedItem';
import type { SpawnedBoss } from './AreaBosses';
import type { HealShrine } from '../entities/HealShrine';
import type { ActiveQuest } from './AreaQuests';
import { sfx } from './sfx';

export interface MinimapSources {
  player: () => { x: number; y: number; vx: number; vy: number };
  items: () => DroppedItem[];
  bosses: () => SpawnedBoss[];
  shrines: () => HealShrine[];
  quest: () => ActiveQuest;
  exitUnlocked: () => boolean;
}

type Mode = 'full' | 'small' | 'off';

// จำขนาดที่ผู้เล่นเลือกล่าสุดไว้ข้ามแอเรีย — เริ่มที่ขนาดกลางตามที่ต้องการ
let savedMode: Mode = 'small';

const C = MINIMAP.colors;
const D = DEPTH.HUD - 1; // ใต้ HUD อื่น — ลูกศรนำทางประตูยังวาดทับแผนที่ได้

export class HuntMinimap {
  private scene: Phaser.Scene;
  private layout: AreaLayout;
  private src: MinimapSources;

  private objs: Phaser.GameObjects.GameObject[] = [];
  private fogG: any = null;
  private liveG: any = null;
  private playerG: any = null;
  private pctText: Phaser.GameObjects.Text | null = null;
  private noteText: Phaser.GameObjects.Text | null = null;

  private mode: Mode = savedMode;
  private explored: Uint8Array;
  private found = new Set<string>();
  private lairs: { x: number; y: number; alive: () => boolean }[] = [];
  private trail: { x: number; y: number }[] = [];
  private lastTrailAt = 0;
  private lastDrawAt = 0;
  private angle = -Math.PI / 2;

  // กรอบแผนที่บนจอ (คำนวณใหม่ทุกครั้งที่สลับขนาด)
  private mx = 0;
  private my = 0;
  private mw = 0;
  private mh = 0;
  private worldCellW = 1;
  private worldCellH = 1;

  constructor(scene: Phaser.Scene, layout: AreaLayout, sources: MinimapSources) {
    this.scene = scene;
    this.layout = layout;
    this.src = sources;
    this.explored = new Uint8Array(MINIMAP.fogCols * MINIMAP.fogRows);
    this.worldCellW = layout.width / MINIMAP.fogCols;
    this.worldCellH = layout.height / MINIMAP.fogRows;
    this.build();
  }

  // =====================================================
  //  สลับขนาด / เก็บของ
  // =====================================================
  cycleMode() {
    this.mode = this.mode === 'full' ? 'small' : this.mode === 'small' ? 'off' : 'full';
    savedMode = this.mode; // จำไว้ใช้ต่อในแอเรียถัดไป
    sfx.open();
    this.build();
  }

  destroy() {
    for (const o of this.objs) {
      this.scene.tweens.killTweensOf(o);
      if (o.active) o.destroy();
    }
    this.objs = [];
    this.fogG = null;
    this.liveG = null;
    this.playerG = null;
    this.pctText = null;
    this.noteText = null;
  }

  private build() {
    this.destroy();
    const full = this.mode === 'full';

    if (this.mode === 'off') {
      // ปิดแผนที่แล้วยังต้องเรียกกลับได้ — ปุ่มเล็กมุมเดิม
      const pill = this.ui(this.scene.add.rectangle(MINIMAP.left + 47, MINIMAP.bottom - 11, 94, 22, C.panel, 0.88));
      pill.setStrokeStyle(1, C.hairline);
      pill.setInteractive({ useHandCursor: true });
      pill.on('pointerdown', () => this.scene.time.delayedCall(0, () => this.cycleMode()));
      this.label(MINIMAP.left + 47, MINIMAP.bottom - 11, '[Q] แผนที่', 10, '#a89f8c', 0.5);
      return;
    }

    const panelW = full ? MINIMAP.widthFull : MINIMAP.widthSmall;
    const headerH = full ? MINIMAP.headerFull : MINIMAP.headerSmall;
    const noteH = full ? MINIMAP.noteRow : 0;
    const legendH = full ? MINIMAP.legendRow : 0;
    const pad = MINIMAP.pad;

    this.mw = panelW - pad * 2;
    this.mh = Phaser.Math.Clamp(
      Math.round(this.mw * (this.layout.height / this.layout.width)),
      MINIMAP.mapMinH, MINIMAP.mapMaxH
    );
    const panelH = pad + headerH + this.mh + noteH + legendH + pad;
    const left = MINIMAP.left;
    const top = MINIMAP.bottom - panelH;
    this.mx = left + pad;
    this.my = top + pad + headerH;

    const bg = this.ui(this.scene.add.rectangle(left + panelW / 2, top + panelH / 2, panelW, panelH, C.panel, 0.9));
    bg.setStrokeStyle(2, C.border);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => this.scene.time.delayedCall(0, () => this.cycleMode()));
    const inner = this.ui(this.scene.add.rectangle(left + panelW / 2, top + panelH / 2, panelW - 8, panelH - 8, 0x000000, 0.001));
    inner.setStrokeStyle(1, C.hairline);

    // หัวแผง
    this.label(this.mx, top + pad + headerH / 2 - 1, full ? 'แผนที่กระดาษ' : 'แผนที่', full ? 11 : 10, '#ffd54a', 0, true);
    const pct = this.label(this.mx + this.mw, top + pad + headerH / 2 - 1, '', 10, '#a89f8c', 1);
    this.pctText = pct;

    // พื้นแผนที่ (วาดครั้งเดียว) → หมอก → ร่องรอย/เครื่องหมาย → ลูกศรผู้เล่น
    const baseG = this.gfx();
    this.drawTerrain(baseG);
    this.fogG = this.gfx();
    this.liveG = this.gfx();
    this.playerG = this.gfx();

    // ทิศเหนือกำกับไว้ กันหลงทิศ
    this.label(this.mx + this.mw / 2, this.my + 8, 'น', 9, '#e8e0c8', 0.5).setAlpha(0.45);

    if (full) {
      this.noteText = this.label(this.mx + this.mw / 2, this.my + this.mh + noteH / 2 + 2, '', 10, '#7dff9b', 0.5);
      this.noteText.setAlpha(0);
      const items: { c: number; t: string }[] = [
        { c: C.home, t: 'ฐาน' }, { c: C.next, t: 'ออก' }, { c: C.heal, t: 'ฟื้น' },
        { c: C.lair, t: 'รัง' }, { c: C.loot, t: 'ของ' }
      ];
      const slot = this.mw / items.length;
      const ly = this.my + this.mh + noteH + legendH / 2 + 2;
      items.forEach((it, i) => {
        const x = this.mx + slot * i + 4;
        const dot = this.ui(this.scene.add.circle(x, ly, 2.6, it.c));
        dot.setDepth(D + 1);
        this.label(x + 6, ly, it.t, 10, '#c9c2b2', 0);
      });
    }

    this.lastDrawAt = 0; // บังคับวาดรอบแรกทันที
  }

  // ---------- ตัวช่วยสร้างวัตถุ (ทุกชิ้นติดจอ) ----------
  private ui<T extends Phaser.GameObjects.GameObject>(o: T): T {
    (o as any).setScrollFactor(0);
    (o as any).setDepth(D);
    this.objs.push(o);
    return o;
  }

  private gfx(): any {
    return this.ui(this.scene.add.graphics());
  }

  private label(x: number, y: number, str: string, size: number, color: string, ox: number, bold = false) {
    const t = this.ui(this.scene.add.text(x, y, str, {
      fontFamily: '"Noto Sans Thai", monospace',
      fontSize: `${size}px`,
      fontStyle: bold ? 'bold' : 'normal',
      color,
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(ox, 0.5));
    t.setDepth(D + 1);
    return t;
  }

  private sx(wx: number): number { return this.mx + (wx / this.layout.width) * this.mw; }
  private sy(wy: number): number { return this.my + (wy / this.layout.height) * this.mh; }

  // =====================================================
  //  พื้นแผนที่: สีแผ่นจริง + ลานกลาง + ขอบแอเรีย
  // =====================================================
  private drawTerrain(g: any) {
    const L = this.layout;
    const tw = this.mw / L.cols;
    const th = this.mh / L.rows;
    for (let r = 0; r < L.rows; r++) {
      for (let c = 0; c < L.cols; c++) {
        const kind = L.tiles[r * L.cols + c];
        g.fillStyle(TILE_KINDS[kind].base, 1);
        g.fillRect(this.mx + c * tw, this.my + r * th, tw + 0.6, th + 0.6);
      }
    }
    // ลานกลาง (ที่ว่างสำหรับสู้บอส) — วงจางช่วยกะตำแหน่ง
    g.lineStyle(1, C.paper, 0.18);
    g.strokeCircle(this.sx(L.arena.x), this.sy(L.arena.y), (L.arena.r / L.width) * this.mw);
    g.lineStyle(1.5, C.hairline, 0.9);
    g.strokeRect(this.mx, this.my, this.mw, this.mh);
  }

  // =====================================================
  //  เรียกทุกเฟรมจาก WorldScene
  // =====================================================
  update(_delta: number, now: number) {
    const p = this.src.player();
    this.reveal(p.x, p.y);

    // ทิศลูกศร = ทิศที่เดินจริง (หยุดแล้วคงทิศเดิม)
    if (Math.hypot(p.vx, p.vy) > 20) this.angle = Math.atan2(p.vy, p.vx);

    if (this.mode === 'off') return;

    this.drawPlayer(p.x, p.y);

    if (now - this.lastDrawAt < MINIMAP.redrawMs) return;
    this.lastDrawAt = now;

    this.dropTrail(p.x, p.y, now);
    this.discover();
    this.drawFog(p.x, p.y);
    this.drawLive(now);
    this.updatePercent();
  }

  // ---------- เปิดหมอกรอบตัว ----------
  private reveal(px: number, py: number) {
    const cols = MINIMAP.fogCols;
    const rows = MINIMAP.fogRows;
    const cc = Math.floor(px / this.worldCellW);
    const cr = Math.floor(py / this.worldCellH);
    const rx = Math.ceil(MINIMAP.revealRadius / this.worldCellW);
    const ry = Math.ceil(MINIMAP.revealRadius / this.worldCellH);
    const r2 = MINIMAP.revealRadius * MINIMAP.revealRadius;
    for (let r = Math.max(0, cr - ry); r <= Math.min(rows - 1, cr + ry); r++) {
      for (let c = Math.max(0, cc - rx); c <= Math.min(cols - 1, cc + rx); c++) {
        const wx = (c + 0.5) * this.worldCellW;
        const wy = (r + 0.5) * this.worldCellH;
        const dx = wx - px;
        const dy = wy - py;
        if (dx * dx + dy * dy <= r2) this.explored[r * cols + c] = 1;
      }
    }
  }

  private isExplored(wx: number, wy: number): boolean {
    const c = Phaser.Math.Clamp(Math.floor(wx / this.worldCellW), 0, MINIMAP.fogCols - 1);
    const r = Phaser.Math.Clamp(Math.floor(wy / this.worldCellH), 0, MINIMAP.fogRows - 1);
    return this.explored[r * MINIMAP.fogCols + c] === 1;
  }

  // ---------- หมอก: รวมช่องสีเดียวกันเป็นแถบเดียว (ประหยัดการวาด) ----------
  private cellState(c: number, r: number, px: number, py: number, visR2: number): number {
    if (this.explored[r * MINIMAP.fogCols + c] === 0) return 2; // ยังไม่เคยเดิน
    const wx = (c + 0.5) * this.worldCellW;
    const wy = (r + 0.5) * this.worldCellH;
    const dx = wx - px;
    const dy = wy - py;
    return dx * dx + dy * dy <= visR2 ? 0 : 1; // 0 = มองเห็นตอนนี้ · 1 = เคยเห็น
  }

  private drawFog(px: number, py: number) {
    const g = this.fogG;
    if (!g || !g.active) return;
    g.clear();
    const cols = MINIMAP.fogCols;
    const rows = MINIMAP.fogRows;
    const cw = this.mw / cols;
    const ch = this.mh / rows;
    const visR = MINIMAP.revealRadius * MINIMAP.visibleRatio;
    const visR2 = visR * visR;
    for (let r = 0; r < rows; r++) {
      let start = 0;
      let state = this.cellState(0, r, px, py, visR2);
      for (let c = 1; c <= cols; c++) {
        const st = c < cols ? this.cellState(c, r, px, py, visR2) : -1;
        if (st === state) continue;
        if (state > 0) {
          g.fillStyle(C.fog, state === 2 ? MINIMAP.fogAlpha : MINIMAP.dimAlpha);
          g.fillRect(this.mx + start * cw, this.my + r * ch, (c - start) * cw + 0.6, ch + 0.6);
        }
        start = c;
        state = st;
      }
    }
  }

  // ---------- ร่องรอยทางที่เดิน ----------
  private dropTrail(px: number, py: number, now: number) {
    if (now - this.lastTrailAt < MINIMAP.trailEveryMs) return;
    const last = this.trail[this.trail.length - 1];
    if (last && Phaser.Math.Distance.Between(last.x, last.y, px, py) < MINIMAP.trailMinDist) return;
    this.lastTrailAt = now;
    this.trail.push({ x: px, y: py });
    if (this.trail.length > MINIMAP.trailMax) this.trail.shift();
  }

  // ---------- พบอะไรใหม่: จดจำไว้ทั้งทริป + บอกผู้เล่น ----------
  private discover() {
    for (const s of this.src.bosses()) {
      const b = s.boss;
      const key = `lair_${s.x}_${s.y}`;
      if (this.found.has(key)) continue;
      if (!this.isExplored(s.x, s.y)) continue;
      this.found.add(key);
      this.lairs.push({ x: s.x, y: s.y, alive: () => b.isAlive });
      this.note('พบรังบอส — จำไว้ในแผนที่แล้ว', '#ff8a7a');
      sfx.warn();
    }
    for (const s of this.src.shrines()) {
      const key = `heal_${s.x}_${s.y}`;
      if (this.found.has(key) || !this.isExplored(s.x, s.y)) continue;
      this.found.add(key);
      this.note('พบเสาฟื้นเลือด', '#7dff9b');
      sfx.pickup();
    }
    const q = this.src.quest();
    if (q.cache) {
      const key = `cache_${q.cache.x}_${q.cache.y}`;
      if (!this.found.has(key) && this.isExplored(q.cache.x, q.cache.y)) {
        this.found.add(key);
        this.note('พบกล่องผนึก', '#ffd54a');
        sfx.pickup();
      }
    }
    if (q.def.kind === 'explore') {
      q.sites.forEach((s, i) => {
        const key = `site_${i}`;
        if (this.found.has(key) || !this.isExplored(s.x, s.y)) return;
        this.found.add(key);
        this.note('พบจุดสำรวจ', '#e8e0c8');
        sfx.pickup();
      });
    }
    for (const it of this.src.items()) {
      if (it.isCollected || it.source !== 'ground') continue;
      const key = `loot_${Math.round(it.sprite.x)}_${Math.round(it.sprite.y)}`;
      if (this.found.has(key) || !this.isExplored(it.sprite.x, it.sprite.y)) continue;
      this.found.add(key);
      this.note('พบของตกพื้น', '#9de7ff');
    }
  }

  private note(msg: string, color: string) {
    const t = this.noteText;
    if (!t || !t.active) return;
    this.scene.tweens.killTweensOf(t);
    t.setText(msg).setColor(color).setAlpha(1);
    this.scene.tweens.add({ targets: t, alpha: 0, delay: MINIMAP.noteMs, duration: 500 });
  }

  // =====================================================
  //  เครื่องหมายบนแผนที่
  // =====================================================
  private drawLive(now: number) {
    const g = this.liveG;
    if (!g || !g.active) return;
    g.clear();

    // ร่องรอย: ยิ่งใหม่ยิ่งชัด
    const n = this.trail.length;
    if (n > 1) {
      const buckets = 4;
      for (let b = 0; b < buckets; b++) {
        const from = Math.floor(((n - 1) * b) / buckets);
        const to = Math.floor(((n - 1) * (b + 1)) / buckets);
        if (to <= from) continue;
        g.lineStyle(1.4, C.trail, 0.1 + 0.45 * (b / (buckets - 1)));
        g.beginPath();
        g.moveTo(this.sx(this.trail[from].x), this.sy(this.trail[from].y));
        for (let i = from + 1; i <= to; i++) g.lineTo(this.sx(this.trail[i].x), this.sy(this.trail[i].y));
        g.strokePath();
      }
    }

    // ของตกพื้นที่ยังไม่เก็บ (เฉพาะที่เดินเคยเห็น)
    for (const it of this.src.items()) {
      if (it.isCollected || it.source !== 'ground') continue;
      if (!this.isExplored(it.sprite.x, it.sprite.y)) continue;
      this.dot(g, this.sx(it.sprite.x), this.sy(it.sprite.y), 1.8, C.loot, 0.9);
    }

    // จุดสำรวจ: ยังไม่พบ = วงครีม · พบแล้ว = เขียว
    const q = this.src.quest();
    if (q.def.kind === 'explore') {
      q.sites.forEach((s, i) => {
        if (!this.isExplored(s.x, s.y)) return;
        const x = this.sx(s.x);
        const y = this.sy(s.y);
        if (q.visited[i]) this.cross(g, x, y, 3.4, C.heal, 1);
        else this.ring(g, x, y, 3.4, C.site, 1, 0.9);
      });
    }

    // เสาฟื้นเลือด
    for (const s of this.src.shrines()) {
      if (!this.isExplored(s.x, s.y)) continue;
      this.cross(g, this.sx(s.x), this.sy(s.y), 3.2, C.heal, 0.95);
    }

    // กล่องผนึก: ยังไม่แกะ = เหลี่ยมทอง · จบแล้ว = จาง
    if (q.cache && this.isExplored(q.cache.x, q.cache.y)) {
      const done = q.cache.isResolved;
      this.diamond(g, this.sx(q.cache.x), this.sy(q.cache.y), 3.4, done ? C.locked : C.cache, done ? 0.5 : 1);
    }

    // รังบอสที่พบแล้ว — จำไว้แม้หมอกปิดทับ (ตัวตายแล้วขีดฆ่า)
    for (const l of this.lairs) {
      const x = this.sx(l.x);
      const y = this.sy(l.y);
      if (l.alive()) {
        this.tri(g, x, y, 4.2, C.lair, 1);
        this.ring(g, x, y, 6.2, C.lair, 1, 0.35);
      } else {
        this.cross(g, x, y, 3.6, C.locked, 0.75);
      }
    }

    // ประตูกลับฐาน: เห็นเสมอ (ทางกลับบ้านไม่มีวันหลง)
    const rg = this.layout.returnGate;
    this.ring(g, this.sx(rg.x), this.sy(rg.y), 4, C.home, 1.6, 1);
    this.dot(g, this.sx(rg.x), this.sy(rg.y), 1.5, C.home, 1);

    // ประตูไปต่อ: ล็อก = เทา · ปลดแล้ว = ทองเต้น
    const eg = this.layout.exitGate;
    const ex = this.sx(eg.x);
    const ey = this.sy(eg.y);
    if (this.src.exitUnlocked()) {
      const pulse = 3.6 + Math.sin(now / 260) * 1.1;
      this.diamond(g, ex, ey, pulse, C.next, 1);
      this.ring(g, ex, ey, pulse + 3, C.next, 1, 0.4);
    } else {
      this.diamond(g, ex, ey, 3.2, C.locked, 0.7);
    }
  }

  private drawPlayer(px: number, py: number) {
    const g = this.playerG;
    if (!g || !g.active) return;
    g.clear();
    const x = this.sx(px);
    const y = this.sy(py);
    // วงรัศมีมองเห็น — ให้เข้าใจว่าหมอกเปิดตามการเดิน
    g.lineStyle(1, C.paper, 0.16);
    g.strokeCircle(x, y, (MINIMAP.revealRadius / this.layout.width) * this.mw);
    // ลูกศรทิศที่เดิน
    const s = 5.4;
    const a = this.angle;
    const p1 = [x + Math.cos(a) * s, y + Math.sin(a) * s];
    const p2 = [x + Math.cos(a + 2.5) * s * 0.8, y + Math.sin(a + 2.5) * s * 0.8];
    const p3 = [x + Math.cos(a - 2.5) * s * 0.8, y + Math.sin(a - 2.5) * s * 0.8];
    g.fillStyle(0x000000, 0.55);
    g.fillCircle(x, y, 4.2);
    g.fillStyle(C.player, 1);
    g.beginPath();
    g.moveTo(p1[0], p1[1]);
    g.lineTo(p2[0], p2[1]);
    g.lineTo(p3[0], p3[1]);
    g.closePath();
    g.fillPath();
    g.lineStyle(1, 0x2a2018, 0.9);
    g.strokePath();
  }

  private updatePercent() {
    if (!this.pctText || !this.pctText.active) return;
    let n = 0;
    for (let i = 0; i < this.explored.length; i++) if (this.explored[i]) n++;
    const pct = Math.round((n / this.explored.length) * 100);
    this.pctText.setText(`${pct}% [Q]`);
  }

  // ---------- รูปเครื่องหมายเล็ก ----------
  private dot(g: any, x: number, y: number, r: number, color: number, alpha: number) {
    g.fillStyle(color, alpha);
    g.fillCircle(x, y, r);
  }

  private ring(g: any, x: number, y: number, r: number, color: number, w: number, alpha: number) {
    g.lineStyle(w, color, alpha);
    g.strokeCircle(x, y, r);
  }

  private cross(g: any, x: number, y: number, r: number, color: number, alpha: number) {
    g.lineStyle(1.8, color, alpha);
    g.beginPath();
    g.moveTo(x - r, y); g.lineTo(x + r, y);
    g.moveTo(x, y - r); g.lineTo(x, y + r);
    g.strokePath();
  }

  private diamond(g: any, x: number, y: number, r: number, color: number, alpha: number) {
    g.fillStyle(color, alpha);
    g.beginPath();
    g.moveTo(x, y - r);
    g.lineTo(x + r, y);
    g.lineTo(x, y + r);
    g.lineTo(x - r, y);
    g.closePath();
    g.fillPath();
  }

  private tri(g: any, x: number, y: number, r: number, color: number, alpha: number) {
    g.fillStyle(color, alpha);
    g.beginPath();
    g.moveTo(x, y - r);
    g.lineTo(x + r * 0.9, y + r * 0.75);
    g.lineTo(x - r * 0.9, y + r * 0.75);
    g.closePath();
    g.fillPath();
  }
}