// src/systems/NetGhosts.ts — ตัวผีจากเน็ต: ส่งสถานะของเรา + รับสถานะเพื่อน แล้วสร้าง/อัปเดต/ถอด RemotePlayer
// แบบดาว: client ส่ง 'state' หา host · host รวมทุกคนส่ง 'world' ให้ทุกคน · 20 ครั้งต่อวินาที
// ส่งครบทุกแพ็กเก็ต ไม่พึ่งแพ็กเก็ตก่อนหน้า (เน็ต reliable:false) · ตัดแพ็กเก็ตเก่าด้วย ts ต่อผู้ส่ง
// ไม่แตะ PlayerActor: อ่านสถานะจาก actor.clips (ClipSet บันทึกคลิปล่าสุดไว้ให้แล้ว)
import Phaser from 'phaser';
import { RemotePlayer, type GhostState } from '../actors/RemotePlayer';
import type { PlayerActor } from '../actors/PlayerActor';
import type { CharacterId } from '../data/characters';
import { net } from './NetManager';

const SEND_EVERY_MS = 50; // 20 ครั้งต่อวินาที
const STALE_MS = 3000; // เงียบเกินนี้ = ถอดตัวผี

interface Entry {
  char: CharacterId;
  ts: number;
  s: GhostState;
  at: number;
  dirty: boolean;
}

export class NetGhosts {
  private scene: Phaser.Scene;
  private actor: PlayerActor;
  private entries = new Map<string, Entry>();
  private ghosts = new Map<string, RemotePlayer>();
  private lastSendAt: number = -1;
  /** บวกเข้า clipSeq กันเลขซ้ำตอนฉากถูกสร้างใหม่ (ตัวผีจะเริ่มคลิปใหม่เสมอเมื่อเลขเปลี่ยน) */
  private seqBase: number = Math.floor(Math.random() * 1000000);

  constructor(scene: Phaser.Scene, actor: PlayerActor) {
    this.scene = scene;
    this.actor = actor;
    net.onMessage = (fromId, m) => this.onMessage(fromId, m);
  }

  /** จำนวนตัวผีจากเน็ตที่แสดงอยู่ */
  count(): number {
    return this.ghosts.size;
  }

  /** เรียกทุกเฟรมจากฉาก (เรียกก่อนจุดที่ฉากหยุดเพราะเมนู เพื่อให้เพื่อนยังเห็นเราค้างอยู่ ไม่หาย) */
  update(now: number, delta: number) {
    if (!net.role || net.status !== 'online') {
      this.clearAll();
      return;
    }
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
      age: has ? Math.max(0, now - c.lastStartAt) : 0
    };
  }

  private sendTick(now: number) {
    if (this.lastSendAt >= 0 && now - this.lastSendAt < SEND_EVERY_MS) return;
    this.lastSendAt = now;
    if (net.openPeerIds().length === 0) return;

    const ts = performance.now();
    const char = this.actor.character.id;
    const s = this.mine(now);
    if (net.role === 'client') {
      net.sendHost({ t: 'state', ts, char, s });
    } else {
      const players: any[] = [{ id: net.myId, char, ts, s }];
      for (const [id, e] of this.entries) {
        if (now - e.at <= STALE_MS) players.push({ id, char: e.char, ts: e.ts, s: e.s });
      }
      net.broadcast({ t: 'world', players });
    }
  }

  // ---------------------------------------------------------------
  // รับ
  // ---------------------------------------------------------------
  private onMessage(fromId: string, m: any) {
    const now = this.scene.time.now;
    if (m.t === 'state' && net.role === 'host') {
      this.take(fromId, m.char, m.ts, m.s, now);
    } else if (m.t === 'world' && net.role === 'client' && Array.isArray(m.players)) {
      for (const p of m.players) {
        if (!p || p.id === net.myId) continue;
        this.take(p.id, p.char, p.ts, p.s, now);
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

  // ---------------------------------------------------------------
  // ภายใน
  // ---------------------------------------------------------------
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
  }
}