// src/systems/NetManager.ts — ตัวจัดการต่อเน็ตของเกม (PeerJS · แบบดาว: client ต่อ host เท่านั้น)
// อยู่ระดับโมดูล (เหมือน profiles / trainingState) เพื่อให้การต่อไม่หลุดตอนฉากถูกสร้างใหม่ (L / ESC / ล้มแล้วเริ่มใหม่)
// ตรรกะก๊อปปี้จาก netspike/src/main.js: รหัสห้อง 4 ตัว · json + reliable:false · ping ทุก 1 วิ · ดู ICE ตั้งแต่เริ่มต่อ
import { Peer } from 'peerjs';

const ROOM_PREFIX = 'phnt-';
const MAX_PLAYERS = 4;
const CONNECT_TIMEOUT_MS = 15000;
const PING_EVERY_MS = 1000;
const TYPE_EVERY_MS = 3000;
const RTT_KEEP = 300;
const SILENCE_SHOW_MS = 3000;

export type NetStatus = 'idle' | 'connecting' | 'online' | 'failed';
export type NetRole = 'host' | 'client' | null;

interface PeerStats {
  id: string;
  conn: any;
  rtts: number[];
  pingSent: number;
  pongRecv: number;
  sent: number;
  recv: number;
  type: string;
  ice: string;
  cand: { host: number; srflx: number; relay: number };
  createdAt: number;
  lastRecvAt: number;
}

const STATUS_TEXT: Record<NetStatus, string> = {
  idle: 'ปิด',
  connecting: 'กำลังต่อ',
  online: 'ออนไลน์',
  failed: 'ผิดพลาด'
};

export class NetManager {
  role: NetRole = null;
  status: NetStatus = 'idle';
  roomCode: string = '';
  myId: string = '';
  link: string = '';
  lastError: string = '';
  /** ฉากตั้งไว้แสดงข้อความสั้น ๆ (toast) — ฉากต้องตั้งเป็น null ตอน SHUTDOWN */
  onLog: ((msg: string) => void) | null = null;
  /** ข้อความเกมที่ไม่ใช่ ping/pong/full — D2-2 ใช้รับสถานะผู้เล่น */
  onMessage: ((fromId: string, m: any) => void) | null = null;

  private peer: any = null;
  private conns = new Map<string, any>();
  private stats = new Map<string, PeerStats>();
  private pingTimer: any = null;
  private typeTimer: any = null;
  private connectTimer: any = null;
  /** เลขรอบการต่อ — handler ของรอบเก่าที่ยิงมาหลังออกห้องจะถูกทิ้ง */
  private session: number = 0;

  /** รหัสห้องจากลิงก์เชิญ ?room=XXXX — ไม่มี/ไม่ครบ 4 ตัว = '' */
  static roomFromUrl(): string {
    if (typeof location === 'undefined') return '';
    const raw = new URLSearchParams(location.search).get('room') || '';
    const code = raw.toUpperCase().slice(0, 4);
    return code.length === 4 ? code : '';
  }

  /** จำนวนผู้เล่นในห้อง (รวมเรา) — 0 ถ้าไม่ได้อยู่ในห้อง */
  playerCount(): number {
    return this.role ? 1 + this.conns.size : 0;
  }

  /** เพื่อนที่เปิดการเชื่อมต่อแล้ว (id) */
  openPeerIds(): string[] {
    const out: string[] = [];
    for (const [id, c] of this.conns) if (c.open) out.push(id);
    return out;
  }

  // ---------------------------------------------------------------
  // สร้างห้อง / เข้าห้อง / ออก
  // ---------------------------------------------------------------
  createRoom(retry: number = 0) {
    if (this.peer && retry === 0) return;
    this.role = 'host';
    this.status = 'connecting';
    this.lastError = '';
    this.roomCode = Math.random().toString(36).slice(2, 6).toUpperCase();
    this.openPeer(ROOM_PREFIX + this.roomCode, (e: any) => {
      if (e.type === 'unavailable-id' && retry < 5) {
        this.destroyPeerOnly();
        this.createRoom(retry + 1);
        return true;
      }
      return false;
    });
  }

  joinRoom(code: string) {
    if (this.peer) return;
    const c = code.trim().toUpperCase();
    if (c.length !== 4) {
      this.notice('รหัสห้องต้องครบ 4 ตัว');
      return;
    }
    this.role = 'client';
    this.status = 'connecting';
    this.lastError = '';
    this.roomCode = c;
    this.openPeer(null, null);
  }

  leave() {
    this.session++;
    this.clearTimers();
    for (const c of this.conns.values()) {
      try { c.close(); } catch (_e) { /* ปล่อยผ่าน */ }
    }
    this.destroyPeerOnly();
    this.conns.clear();
    this.stats.clear();
    this.role = null;
    this.status = 'idle';
    this.roomCode = '';
    this.myId = '';
    this.link = '';
    this.lastError = '';
  }

  // ---------------------------------------------------------------
  // ส่งข้อมูล (D2-2 ใช้)
  // ---------------------------------------------------------------
  /** ส่งให้ทุกคนที่ต่ออยู่ */
  broadcast(msg: any) {
    for (const [id, c] of this.conns) {
      if (!c.open) continue;
      c.send(msg);
      const st = this.stats.get(id);
      if (st) st.sent++;
    }
  }

  /** client ส่งให้ host (host เรียกไม่มีผล) */
  sendHost(msg: any) {
    if (this.role !== 'client') return;
    for (const [id, c] of this.conns) {
      if (!c.open) continue;
      c.send(msg);
      const st = this.stats.get(id);
      if (st) st.sent++;
      return;
    }
  }

  // ---------------------------------------------------------------
  // ภายใน
  // ---------------------------------------------------------------
  private notice(msg: string) {
    console.log('[net]', msg);
    if (this.onLog) this.onLog(msg);
  }

  private dbg(msg: string) {
    console.log('[net]', msg);
  }

  private iceConfig(): any {
    return { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
  }

  private destroyPeerOnly() {
    if (this.peer) {
      try { this.peer.destroy(); } catch (_e) { /* ปล่อยผ่าน */ }
      this.peer = null;
    }
  }

  private clearTimers() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.typeTimer) clearInterval(this.typeTimer);
    if (this.connectTimer) clearTimeout(this.connectTimer);
    this.pingTimer = null;
    this.typeTimer = null;
    this.connectTimer = null;
  }

  private openPeer(id: string | null, onError: ((e: any) => boolean) | null) {
    const s = ++this.session;
    const opts: any = { config: this.iceConfig(), debug: 1 };
    const peer: any = id ? new Peer(id, opts) : new Peer(opts);
    this.peer = peer;

    peer.on('open', (pid: string) => {
      if (s !== this.session) return;
      this.myId = pid;
      this.dbg(`เชื่อมเซิร์ฟเวอร์จับคู่แล้ว id=${pid}`);
      this.onPeerOpen(s);
    });

    peer.on('error', (e: any) => {
      if (s !== this.session) return;
      this.dbg(`PeerJS error: ${e.type} ${e.message || ''}`);
      if (onError && onError(e)) return;
      this.status = 'failed';
      if (e.type === 'peer-unavailable') this.lastError = `ไม่พบห้อง ${this.roomCode}`;
      else if (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error') this.lastError = 'ติดต่อเซิร์ฟเวอร์จับคู่ไม่ได้';
      else this.lastError = `ข้อผิดพลาด ${e.type}`;
      this.notice(this.lastError);
    });

    peer.on('disconnected', () => {
      if (s !== this.session) return;
      this.dbg('หลุดจากเซิร์ฟเวอร์จับคู่ (การเชื่อมตรงที่ต่อแล้วยังใช้ได้)');
    });

    if (this.role === 'host') {
      peer.on('connection', (conn: any) => {
        if (s !== this.session) return;
        if (this.conns.size >= MAX_PLAYERS - 1) {
          conn.on('open', () => {
            conn.send({ t: 'full' });
            setTimeout(() => { try { conn.close(); } catch (_e) { /* ปล่อยผ่าน */ } }, 300);
          });
          return;
        }
        this.attachConn(conn, s);
      });
    }
  }

  private onPeerOpen(s: number) {
    if (this.role === 'host') {
      this.status = 'online';
      this.link = `${location.origin}${location.pathname}?room=${this.roomCode}`;
      this.startTimers();
      if (navigator.clipboard) {
        navigator.clipboard.writeText(this.link)
          .then(() => this.notice(`สร้างห้อง ${this.roomCode} แล้ว — คัดลอกลิงก์เชิญแล้ว`))
          .catch(() => this.notice(`สร้างห้อง ${this.roomCode} แล้ว — คัดลอกลิงก์เองจากแผง`));
      } else {
        this.notice(`สร้างห้อง ${this.roomCode} แล้ว — คัดลอกลิงก์เองจากแผง`);
      }
    } else {
      const conn = this.peer.connect(ROOM_PREFIX + this.roomCode, { serialization: 'json', reliable: false });
      this.attachConn(conn, s);
      this.startTimers();
      this.connectTimer = setTimeout(() => {
        if (s !== this.session) return;
        if (this.conns.size === 0) {
          this.status = 'failed';
          this.lastError = 'ต่อไม่ติดใน 15 วินาที';
          this.notice('ต่อไม่ติดใน 15 วินาที — ดูสถานะ ICE ในแผง');
        }
      }, CONNECT_TIMEOUT_MS);
    }
  }

  private startTimers() {
    if (this.pingTimer) return;
    this.pingTimer = setInterval(() => {
      for (const [id, c] of this.conns) {
        if (!c.open) continue;
        c.send({ t: 'ping', ts: performance.now() });
        const st = this.stats.get(id);
        if (st) {
          st.pingSent++;
          st.sent++;
        }
      }
    }, PING_EVERY_MS);
    this.typeTimer = setInterval(() => {
      for (const st of this.stats.values()) this.readType(st);
    }, TYPE_EVERY_MS);
  }

  private attachConn(conn: any, s: number) {
    const st: PeerStats = {
      id: conn.peer,
      conn,
      rtts: [],
      pingSent: 0,
      pongRecv: 0,
      sent: 0,
      recv: 0,
      type: '(ยังไม่รู้)',
      ice: '—',
      cand: { host: 0, srflx: 0, relay: 0 },
      createdAt: performance.now(),
      lastRecvAt: performance.now()
    };
    this.stats.set(conn.peer, st);
    this.watchIce(conn, st, s, 0);

    conn.on('open', () => {
      if (s !== this.session) return;
      this.conns.set(conn.peer, conn);
      this.status = 'online';
      st.lastRecvAt = performance.now();
      if (this.connectTimer) {
        clearTimeout(this.connectTimer);
        this.connectTimer = null;
      }
      this.notice(this.role === 'host' ? `เพื่อนเข้าห้อง (${this.playerCount()}/${MAX_PLAYERS})` : 'ต่อ host สำเร็จ');
      this.readType(st);
    });

    conn.on('data', (m: any) => {
      if (s !== this.session) return;
      this.onData(conn, st, m);
    });

    conn.on('close', () => {
      if (s !== this.session) return;
      this.conns.delete(conn.peer);
      this.stats.delete(conn.peer);
      if (this.role === 'client') {
        this.status = 'failed';
        this.lastError = 'host หลุด';
        this.notice('host หลุด — เล่นคนเดียวต่อได้');
      } else {
        this.notice(`เพื่อนหลุด (${this.playerCount()}/${MAX_PLAYERS})`);
      }
    });

    conn.on('error', (e: any) => {
      if (s !== this.session) return;
      this.dbg(`ข้อผิดพลาดการเชื่อมต่อ ${conn.peer}: ${e}`);
    });
  }

  private onData(conn: any, st: PeerStats, m: any) {
    st.recv++;
    st.lastRecvAt = performance.now();
    if (!m || typeof m.t !== 'string') return;
    switch (m.t) {
      case 'ping':
        conn.send({ t: 'pong', ts: m.ts });
        st.sent++;
        break;
      case 'pong':
        st.pongRecv++;
        st.rtts.push(performance.now() - m.ts);
        if (st.rtts.length > RTT_KEEP) st.rtts.shift();
        break;
      case 'full':
        this.status = 'failed';
        this.lastError = 'ห้องเต็ม (สูงสุด 4 คน)';
        this.notice(this.lastError);
        break;
      default:
        if (this.onMessage) this.onMessage(conn.peer, m);
        break;
    }
  }

  // ดูสถานะ ICE ตั้งแต่เริ่มต่อ (ไม่รอให้เปิดสำเร็จ) — ไม่งั้นต่อไม่ติดแล้วเงียบ (บทเรียน S15)
  private watchIce(conn: any, st: PeerStats, s: number, tries: number) {
    if (s !== this.session) return;
    const pc: any = conn.peerConnection;
    if (!pc) {
      if (tries < 20) setTimeout(() => this.watchIce(conn, st, s, tries + 1), 150);
      else this.dbg(`ไม่พบ peerConnection ของ ${conn.peer}`);
      return;
    }
    st.ice = pc.iceConnectionState;
    pc.addEventListener('icecandidate', (ev: any) => {
      if (!ev.candidate) {
        this.dbg(`รวบรวม ICE จบ (${st.id.slice(-4)}): host ${st.cand.host} · srflx ${st.cand.srflx} · relay ${st.cand.relay}`);
        return;
      }
      let t: string = ev.candidate.type;
      if (!t) {
        const mm = /typ (\w+)/.exec(ev.candidate.candidate || '');
        t = mm ? mm[1] : 'unknown';
      }
      if ((st.cand as any)[t] !== undefined) (st.cand as any)[t]++;
    });
    pc.addEventListener('iceconnectionstatechange', () => {
      st.ice = pc.iceConnectionState;
      this.dbg(`ICE ${st.id.slice(-4)}: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'failed' && s === this.session) {
        this.status = 'failed';
        this.lastError = 'ต่อไม่ติด: หาเส้นทางตรงไม่เจอ';
        this.notice(`${this.lastError} (srflx ${st.cand.srflx})`);
      }
    });
  }

  // อ่านว่าต่อแบบไหน (host / srflx / relay)
  private async readType(st: PeerStats) {
    const pc: any = st.conn && st.conn.peerConnection;
    if (!pc || !pc.getStats) return;
    try {
      const rep: any = await pc.getStats();
      let pair: any = null;
      rep.forEach((r: any) => {
        if (r.type === 'transport' && r.selectedCandidatePairId) pair = rep.get(r.selectedCandidatePairId);
      });
      if (!pair) {
        rep.forEach((r: any) => {
          if (r.type === 'candidate-pair' && r.state === 'succeeded' && r.nominated) pair = r;
        });
      }
      if (!pair) return;
      const l = rep.get(pair.localCandidateId);
      const r2 = rep.get(pair.remoteCandidateId);
      st.type = `${l ? l.candidateType : '?'}<->${r2 ? r2.candidateType : '?'}`;
    } catch (_e) { /* ปล่อยผ่าน */ }
  }

  // ---------------------------------------------------------------
  // บรรทัดสำหรับแผงวินิจฉัยและป้าย
  // ---------------------------------------------------------------
  /** ข้อความสั้นสำหรับป้ายมุมซ้ายล่าง */
  labelText(): string {
    if (!this.role) {
      const code = NetManager.roomFromUrl();
      return code ? `เน็ต: ปิด  ([O] เข้าห้อง ${code})` : 'เน็ต: ปิด  ([O] สร้างห้อง)';
    }
    return `เน็ต: ${STATUS_TEXT[this.status]} · ${this.roomCode} · ${this.playerCount()}/${MAX_PLAYERS}  ([O] ออกห้อง)`;
  }

  /** บรรทัดของแผงวินิจฉัย */
  panelLines(): string[] {
    const lines: string[] = [];
    if (!this.role) {
      lines.push('เน็ต: ปิด');
      return lines;
    }
    let head = `เน็ต: ${STATUS_TEXT[this.status]} · ${this.role === 'host' ? 'host' : 'client'} · ห้อง ${this.roomCode} · ${this.playerCount()}/${MAX_PLAYERS} คน`;
    if (this.lastError) head += ` · ${this.lastError}`;
    lines.push(head);
    if (this.role === 'host' && this.conns.size === 0 && this.link) lines.push(`ลิงก์เชิญ: ${this.link}`);
    const now = performance.now();
    for (const st of this.stats.values()) {
      const open = this.conns.has(st.id);
      const r = this.summarize(st.rtts);
      const base = st.pingSent - 1;
      const loss = base > 0 ? (Math.max(0, base - st.pongRecv) / base) * 100 : 0;
      const quiet = now - st.lastRecvAt;
      let line = `  ${st.id.slice(-4)} ${open ? '' : '[ยังไม่เปิด] '}${st.type} · ICE ${st.ice}`;
      if (r) line += ` · RTT ${r.avg.toFixed(0)}/${r.p95.toFixed(0)} ms · หาย ${loss.toFixed(1)}%`;
      if (open && quiet > SILENCE_SHOW_MS) line += ` · เงียบ ${(quiet / 1000).toFixed(0)} วิ`;
      lines.push(line);
    }
    return lines;
  }

  private summarize(arr: number[]): { avg: number; p95: number } | null {
    if (arr.length === 0) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
    return { avg, p95 };
  }
}

export const net = new NetManager();