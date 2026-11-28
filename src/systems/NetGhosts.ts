// src/systems/NetGhosts.ts — ตัวผีจากเน็ต + เหตุการณ์ตีหุ่น + เอฟเฟกต์ท่าของเพื่อน
// แบบดาว: client ส่ง 'state' หา host · host รวมทุกคนส่ง 'world' ให้ทุกคน · 20 ครั้งต่อวินาที
// ส่งครบทุกแพ็กเก็ต ไม่พึ่งแพ็กเก็ตก่อนหน้า (เน็ต reliable:false) · ตัดแพ็กเก็ตเก่าด้วย ts ต่อผู้ส่ง
// ฮิต และ fx (เอฟเฟกต์ภาพ) แนบไปกับสถานะ 1 วินาที ฝั่งรับตัดซ้ำด้วยเลขเหตุการณ์
// ไม่แตะ PlayerActor: อ่านสถานะจาก actor.clips (ClipSet บันทึกคลิปล่าสุดไว้ให้แล้ว)
import Phaser from 'phaser';
import { RemotePlayer, type GhostState } from '../actors/RemotePlayer';
import type { PlayerActor } from '../actors/PlayerActor';
import type { CharacterId } from '../data/characters';
import { net } from './NetManager';
import { setNetFxSink, playRemoteFx } from './netFx';

const SEND_EVERY_MS = 50; // 20 ครั้งต่อวินาที
const STALE_MS = 3000; // เงียบเกินนี้ = ถอดตัวผี
const HIT_KEEP_MS = 1000; // แนบฮิตซ้ำกี่ ms (กันแพ็กเก็ตหาย)
const SEEN_KEEP_MS = 5000; // จำเลขเหตุการณ์ที่เห็นแล้วกี่ ms
const FX_KEEP_MS = 1000; // แนบ fx ซ้ำกี่ ms
const FX_MAX = 16; // เพดาน fx ของเราต่อแพ็กเก็ต (รัว 5 ฮิต/ระบำสามเหลี่ยมสร้างเยอะ)
const FX_RELAY_MAX = 24; // เพดาน fx ที่ host ส่งต่อต่อแพ็กเก็ต

interface Entry {
  char: CharacterId;
  ts: number;
  s: GhostState;
  at: number;
  dirty: boolean;
}

interface HitEv {
  hid: number;
  i: number;
  dmg: number;
  at: number;
  from: string;
}

interface FxEv {
  e: any;
  at: number;
  from: string;
}

export class NetGhosts {
  private scene: Phaser.Scene;
  private actor: PlayerActor;
  private entries = new Map<string, Entry>();
  private ghosts = new Map<string, RemotePlayer>();
  private lastSendAt: number = -1;
  /** บวกเข้า clipSeq กันเลขซ้ำตอนฉากถูกสร้างใหม่ (ตัวผีจะเริ่มคลิปใหม่เสมอเมื่อเลขเปลี่ยน) */
  private seqBase: number = Math.floor(Math.random() * 1000000);

  // ---------- ฮิต ----------
  private hitBase: number = Math.floor(Math.random() * 1000000000);
  private hitSeq: number = 0;
  /** ฮิตของเราเอง (ล่าสุด 1 วิ) */
  private myHits: HitEv[] = [];
  /** host เท่านั้น: ฮิตที่รับจาก client รอส่งต่อให้คนอื่น */
  private relay: HitEv[] = [];
  private seen = new Map<string, number>();
  /** ฉากตั้งไว้รับฮิตของเพื่อน: i = ลำดับหุ่น · dmg = ดาเมจ · from = id ผู้ตี */
  onRemoteHit: ((i: number, dmg: number, from: string) => void) | null = null;
  /** ตัวนับสำหรับแผงวินิจฉัย: ฮิตที่เราส่ง / ฮิตของเพื่อนที่รับ */
  sentHits = 0;
  recvHits = 0;

  // ---------- เอฟเฟกต์ภาพของท่า ----------
  private fxBase: number = Math.floor(Math.random() * 1000000000);
  private fxSeq: number = 0;
  /** fx ของเราเอง (ล่าสุด 1 วิ) */
  private myFx: FxEv[] = [];
  /** host เท่านั้น: fx ที่รับจาก client รอส่งต่อให้คนอื่น */
  private relayFx: FxEv[] = [];
  sentFx = 0;
  recvFx = 0;

  constructor(scene: Phaser.Scene, actor: PlayerActor) {
    this.scene = scene;
    this.actor = actor;
    net.onMessage = (fromId, m) => this.onMessage(fromId, m);
    setNetFxSink((e) => this.recordFx(e));
  }

  /** จำนวนตัวผีจากเน็ตที่แสดงอยู่ */
  count(): number {
    return this.ghosts.size;
  }

  /** ฉากเรียกเมื่อเราตีหุ่นโดน (ไม่ได้ต่อเน็ตอยู่ = ไม่ทำอะไร) */
  recordHit(i: number, dmg: number) {
    if (!net.role) return;
    this.myHits.push({ hid: this.hitBase + ++this.hitSeq, i, dmg, at: this.scene.time.now, from: '' });
    this.sentHits++;
  }

  /** เรียกทุกเฟรมจากฉาก (เรียกก่อนจุดที่ฉากหยุดเพราะเมนู เพื่อให้เพื่อนยังเห็นเราค้างอยู่ ไม่หาย) */
  update(now: number, delta: number) {
    if (!net.role || net.status !== 'online') {
      this.clearAll();
      return;
    }
    this.pruneHits(now);
    this.sendTick(now);

    for (const [id, e] of [...this.entries]) {
      if (now - e.at > STALE_MS) {
        this.removeOne(id);
        continue;
      }
      let g = this.ghosts.get(id);
      if (g && g.character.id !== e.char) {
        g.destroy();
        this.ghosts.delete(id);
        g = undefined;
      }
      if (!g) {
        g = new RemotePlayer(this.scene, e.s.x, e.s.y, e.char, this.nameOf(id));
        this.ghosts.set(id, g);
      }
      if (e.dirty) {
        g.applyState(e.s, now);
        e.dirty = false;
      }
      g.update(now, delta);
    }
  }

  destroy() {
    net.onMessage = null;
    setNetFxSink(null);
    this.onRemoteHit = null;
    this.clearAll();
  }

  // ---------------------------------------------------------------
  // ส่ง
  // ---------------------------------------------------------------
  private mine(now: number): GhostState {
    const c = this.actor.clips;
    const has = c.current !== '';
    return {
      x: this.actor.x,
      y: this.actor.y,
      flip: !!this.actor.sprite.flipX,
      clip: has ? c.current : 'idle',
      ms: has ? c.lastMs : 1000,
      clipSeq: this.seqBase + c.seq,
      age: has ? Math.max(0, now - c.lastStartAt) : 0,
      // ตัวละครที่ยังไม่มีคลิป (ลูมิ): ส่งชื่อภาพที่สไปรต์โชว์อยู่ตอนนี้ ตัวผีโชว์ตาม
      tex: c.ready ? undefined : this.actor.sprite.texture.key
    };
  }

  /** ตัวรับจาก netFx: เอฟเฟกต์ที่เราเพิ่งเล่น — จดไว้แนบกับแพ็กเก็ตถัด ๆ ไป */
  private recordFx(e: any) {
    if (!net.role || net.status !== 'online') return;
    if (e.fol) {
      // เกาะตัว: ส่งระยะเยื้องจากตัวเรา ฝั่งรับเอาไปเกาะตัวผี
      e.ox = Math.round(e.x - this.actor.x);
      e.oy = Math.round(e.y - this.actor.y);
    }
    e.x = Math.round(e.x);
    e.y = Math.round(e.y);
    e.fid = this.fxBase + ++this.fxSeq;
    this.myFx.push({ e, at: this.scene.time.now, from: '' });
    if (this.myFx.length > FX_MAX) this.myFx.shift();
    this.sentFx++;
  }

  private sendTick(now: number) {
    if (this.lastSendAt >= 0 && now - this.lastSendAt < SEND_EVERY_MS) return;
    this.lastSendAt = now;
    if (net.openPeerIds().length === 0) return;

    const ts = performance.now();
    const char = this.actor.character.id;
    const s = this.mine(now);
    if (net.role === 'client') {
      const hits = this.myHits.map((h) => ({ hid: h.hid, i: h.i, dmg: h.dmg }));
      const fx = this.myFx.map((f) => f.e);
      net.sendHost({ t: 'state', ts, char, s, hits, fx });
    } else {
      const players: any[] = [{ id: net.myId, char, ts, s }];
      for (const [id, e] of this.entries) {
        if (now - e.at <= STALE_MS) players.push({ id, char: e.char, ts: e.ts, s: e.s });
      }
      const hits: any[] = [];
      for (const h of this.myHits) hits.push({ from: net.myId, hid: h.hid, i: h.i, dmg: h.dmg });
      for (const h of this.relay) hits.push({ from: h.from, hid: h.hid, i: h.i, dmg: h.dmg });
      const fx: any[] = [];
      for (const f of this.myFx) fx.push({ ...f.e, from: net.myId });
      for (const f of this.relayFx) fx.push({ ...f.e, from: f.from });
      net.broadcast({ t: 'world', players, hits, fx: fx.slice(-FX_RELAY_MAX) });
    }
  }

  private pruneHits(now: number) {
    this.myHits = this.myHits.filter((h) => now - h.at <= HIT_KEEP_MS);
    this.relay = this.relay.filter((h) => now - h.at <= HIT_KEEP_MS);
    this.myFx = this.myFx.filter((f) => now - f.at <= FX_KEEP_MS);
    this.relayFx = this.relayFx.filter((f) => now - f.at <= FX_KEEP_MS);
    for (const [k, t] of this.seen) {
      if (now - t > SEEN_KEEP_MS) this.seen.delete(k);
    }
  }

  // ---------------------------------------------------------------
  // รับ
  // ---------------------------------------------------------------
  private onMessage(fromId: string, m: any) {
    const now = this.scene.time.now;
    if (m.t === 'state' && net.role === 'host') {
      this.take(fromId, m.char, m.ts, m.s, now);
      if (Array.isArray(m.hits)) {
        for (const h of m.hits) this.handleHit(fromId, h, now, true);
      }
      if (Array.isArray(m.fx)) {
        for (const f of m.fx) this.handleFx(fromId, f, now, true);
      }
    } else if (m.t === 'world' && net.role === 'client' && Array.isArray(m.players)) {
      for (const p of m.players) {
        if (!p || p.id === net.myId) continue;
        this.take(p.id, p.char, p.ts, p.s, now);
      }
      if (Array.isArray(m.hits)) {
        for (const h of m.hits) {
          if (!h || h.from === net.myId) continue; // ฮิตของเราเอง ไม่ต้องแสดงซ้ำ
          this.handleHit(h.from, h, now, false);
        }
      }
      if (Array.isArray(m.fx)) {
        for (const f of m.fx) {
          if (!f || f.from === net.myId) continue; // fx ของเราเอง เล่นไปแล้วที่เครื่องเรา
          this.handleFx(f.from, f, now, false);
        }
      }
    }
  }

  private take(id: any, char: any, ts: any, s: any, now: number) {
    if (typeof id !== 'string' || !s) return;
    if (typeof s.x !== 'number' || typeof s.y !== 'number' || typeof s.clip !== 'string') return;
    if (char !== 'akkhani' && char !== 'luma') return;
    const t = typeof ts === 'number' ? ts : 0;
    const prev = this.entries.get(id);
    if (prev && t <= prev.ts) return; // แพ็กเก็ตเก่ากว่าที่เคยรับ
    this.entries.set(id, { char, ts: t, s: s as GhostState, at: now, dirty: true });
  }

  private handleHit(from: any, h: any, now: number, relayIt: boolean) {
    if (typeof from !== 'string' || !h) return;
    if (typeof h.hid !== 'number' || typeof h.i !== 'number' || typeof h.dmg !== 'number') return;
    const key = `${from}:${h.hid}`;
    if (this.seen.has(key)) return; // ฮิตเดิมที่แนบมาซ้ำ
    this.seen.set(key, now);
    this.recvHits++;
    if (relayIt) this.relay.push({ hid: h.hid, i: h.i, dmg: h.dmg, at: now, from });
    if (this.onRemoteHit) this.onRemoteHit(h.i, h.dmg, from);
  }

  private handleFx(from: any, f: any, now: number, relayIt: boolean) {
    if (typeof from !== 'string' || !f || typeof f.fid !== 'number') return;
    const key = `${from}:f${f.fid}`;
    if (this.seen.has(key)) return; // fx เดิมที่แนบมาซ้ำ
    this.seen.set(key, now);
    this.recvFx++;
    if (relayIt) {
      this.relayFx.push({ e: f, at: now, from });
      if (this.relayFx.length > FX_RELAY_MAX) this.relayFx.shift();
    }
    playRemoteFx(this.scene, f, this.ghosts.get(from));
  }

  // ---------------------------------------------------------------
  // ภายใน
  // ---------------------------------------------------------------
  statsText(): string {
    return `ฮิตส่ง ${this.sentHits} · ฮิตรับ ${this.recvHits} · fx ส่ง ${this.sentFx} · fx รับ ${this.recvFx}`;
  }

  private nameOf(id: string): string {
    const r = net.roster.find((p) => p.id === id);
    return r ? r.name : 'ผู้เล่น';
  }

  private removeOne(id: string) {
    const g = this.ghosts.get(id);
    if (g) g.destroy();
    this.ghosts.delete(id);
    this.entries.delete(id);
  }

  private clearAll() {
    for (const g of this.ghosts.values()) g.destroy();
    this.ghosts.clear();
    this.entries.clear();
    this.myHits = [];
    this.relay = [];
    this.myFx = [];
    this.relayFx = [];
  }
}