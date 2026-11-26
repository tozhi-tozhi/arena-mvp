// src/scenes/OnlineScene.ts — หน้า "ห้องออนไลน์": สร้างห้อง / ใส่รหัส 4 หลัก / รอเพื่อน / host กดเริ่ม
// กดหรือแตะได้เหมือนกันทุกอุปกรณ์ · ปุ่มตัวเลขบนจอ (คอมพิมพ์เลขจากคีย์บอร์ดได้ด้วย)
// การต่อเน็ตอยู่ที่ systems/NetManager.ts ฉากนี้แค่สั่งและแสดงผล
// ไม่ใช้ Container · วัตถุทุกชิ้น scrollFactor(0) ให้กล้อง UI วาด (เหมือน BaseScene)
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DEPTH } from '../config';
import { BASE_COLOR } from '../data/base';
import { UiCamera } from '../systems/UiCamera';
import { net, NET_MAX_PLAYERS } from '../systems/NetManager';
import { saveGame } from '../systems/SaveGame';
import { sfx } from '../systems/sfx';

type Mode = 'home' | 'join';

const DIAG_EVERY_MS = 300;

export class OnlineScene extends Phaser.Scene {
  private uiCam!: UiCamera;
  private objs: Phaser.GameObjects.GameObject[] = [];
  private diag!: Phaser.GameObjects.Text;
  private mode: Mode = 'home';
  private joinCode: string = '';
  private shownSig: string = '';
  private diagAt: number = 0;
  private leaving: boolean = false;
  private toast: Phaser.GameObjects.Text | null = null;
  /** เคยเห็นสถานะ "เริ่มแล้ว" ไปแล้วไหม — ตามพาตัวเองเข้าห้องฝึกเฉพาะตอนเปลี่ยนจากยังไม่เริ่มเป็นเริ่ม */
  private seenStarted: boolean = false;

  constructor() {
    super({ key: 'OnlineScene' });
  }

  create() {
    this.uiCam = new UiCamera(this);
    this.cameras.main.setBackgroundColor('#14100a');
    this.objs = [];
    this.mode = 'home';
    this.joinCode = '';
    this.shownSig = '';
    this.diagAt = 0;
    this.leaving = false;
    this.toast = null;
    this.seenStarted = net.started; // กลับมาจากห้องฝึกตอนสถานะยังเป็น "เริ่มแล้ว" = ไม่เด้งกลับเข้าไปทันที

    this.diag = this.add
      .text(16, 84, '', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#9de7ff',
        stroke: '#000000',
        strokeThickness: 2,
        wordWrap: { width: 320 }
      })
      .setOrigin(0, 0)
      .setDepth(DEPTH.HUD)
      .setScrollFactor(0);

    net.onLog = (msg) => this.showToast(msg);

    const kb = this.input.keyboard as any;
    kb.on('keydown-ESC', () => this.goBack());
    kb.on('keydown', (ev: any) => this.onKey(ev));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      kb.removeAllListeners();
      net.onLog = null;
    });

    this.render();
  }

  update(_time: number, _delta: number) {
    // host กดเริ่มแล้ว (client เห็นผ่านรายชื่อห้องที่ host ส่งมา) → ไปห้องฝึกพร้อมกัน
    if (!net.started) {
      this.seenStarted = false;
    } else if (!this.seenStarted && !this.leaving && net.role) {
      this.seenStarted = true;
      this.goTraining();
      return;
    }

    const sig = this.signature();
    if (sig !== this.shownSig) this.render();

    const now = this.time.now;
    if (now - this.diagAt >= DIAG_EVERY_MS) {
      this.diagAt = now;
      this.diag.setText(net.role ? net.panelLines().join('\n') : '');
    }
  }

  // =====================================================
  //  สถานะ → ภาพ
  // =====================================================
  private signature(): string {
    const ids = net.roster.map((p) => p.id).join(',');
    return [this.mode, this.joinCode, net.role, net.status, net.lastError, net.roomCode, ids, net.started].join('|');
  }

  private clearObjs() {
    for (const o of this.objs) o.destroy();
    this.objs = [];
  }

  private render() {
    this.clearObjs();
    this.shownSig = this.signature();
    const cx = GAME_WIDTH / 2;

    this.txt(cx, 44, 'ห้องออนไลน์', 30, '#ffd54a', 0.5, true);

    if (net.role) {
      if (net.status === 'failed') this.renderFailed();
      else if (net.status === 'connecting') this.renderConnecting();
      else this.renderRoom();
    } else if (this.mode === 'join') {
      this.renderJoin();
    } else {
      this.renderHome();
    }
  }

  // ---------- หน้าแรก ----------
  private renderHome() {
    const cx = GAME_WIDTH / 2;
    this.btn(cx - 200, 270, 360, 120, 'สร้างห้อง', BASE_COLOR.green, true, 30, () => {
      net.createRoom();
      sfx.pickup();
    }, 'ได้รหัส 4 หลัก ให้เพื่อนใส่');
    this.btn(cx + 200, 270, 360, 120, 'เข้าห้อง', BASE_COLOR.blue, true, 30, () => {
      this.mode = 'join';
      this.joinCode = '';
      sfx.open();
    }, 'ใส่รหัสที่เพื่อนให้');
    this.btn(cx, 520, 260, 48, '← กลับฐาน', BASE_COLOR.paper, true, 18, () => this.goBack());
  }

  // ---------- ใส่รหัส ----------
  private renderJoin() {
    const cx = GAME_WIDTH / 2;
    this.txt(cx, 84, 'ใส่รหัสห้อง 4 หลัก', 18, '#e8e0c8');

    for (let i = 0; i < 4; i++) {
      const x = cx - 150 + i * 100;
      const ch = this.joinCode[i] ?? '';
      const box = this.add
        .rectangle(x, 140, 80, 88, 0x221d10, 1)
        .setStrokeStyle(3, ch ? BASE_COLOR.gold : 0x4a4130)
        .setDepth(DEPTH.HUD)
        .setScrollFactor(0);
      this.objs.push(box);
      if (ch) this.txt(x, 140, ch, 48, '#ffffff', 0.5, true);
    }

    // แป้นตัวเลข 3 คอลัมน์ x 4 แถว: 1-9 / ลบ 0 เข้าห้อง
    const colX = [cx - 122, cx, cx + 122];
    for (let n = 1; n <= 9; n++) {
      const r = Math.floor((n - 1) / 3);
      const c = (n - 1) % 3;
      this.btn(colX[c], 240 + r * 70, 110, 58, String(n), BASE_COLOR.paper, true, 28, () => this.addDigit(String(n)));
    }
    this.btn(colX[0], 450, 110, 58, 'ลบ', BASE_COLOR.danger, this.joinCode.length > 0, 22, () => this.delDigit());
    this.btn(colX[1], 450, 110, 58, '0', BASE_COLOR.paper, true, 28, () => this.addDigit('0'));
    this.btn(colX[2], 450, 110, 58, 'เข้าห้อง', BASE_COLOR.green, this.joinCode.length === 4, 20, () => this.submitJoin());

    this.btn(cx, 540, 220, 44, 'ยกเลิก', BASE_COLOR.paper, true, 16, () => this.goBack());
  }

  // ---------- กำลังต่อ ----------
  private renderConnecting() {
    const cx = GAME_WIDTH / 2;
    const what = net.role === 'host' ? 'กำลังสร้างห้อง…' : `กำลังเข้าห้อง ${net.roomCode}…`;
    this.txt(cx, 250, what, 26, '#ffffff', 0.5, true);
    this.txt(cx, 292, 'รอสักครู่ (ถ้านานเกิน 15 วินาทีจะแจ้งให้ทราบ)', 13, '#a89f8c');
    this.btn(cx, 450, 220, 48, 'ยกเลิก', BASE_COLOR.danger, true, 18, () => this.leaveRoom());
  }

  // ---------- ต่อไม่ติด / หลุด ----------
  private renderFailed() {
    const cx = GAME_WIDTH / 2;
    this.txt(cx, 230, net.lastError || 'เชื่อมต่อไม่สำเร็จ', 26, '#ff9a8a', 0.5, true);
    this.txt(cx, 272, 'ดูรายละเอียดการต่อได้ที่ข้อความมุมซ้ายบน', 13, '#a89f8c');
    this.btn(cx, 400, 260, 56, 'กลับหน้าแรก', BASE_COLOR.gold, true, 22, () => this.leaveRoom());
  }

  // ---------- ในห้อง ----------
  private renderRoom() {
    const cx = GAME_WIDTH / 2;
    const isHost = net.role === 'host';

    this.txt(cx, 104, `รหัสห้อง ${net.roomCode}`, 52, '#ffffff', 0.5, true);
    this.txt(
      cx,
      154,
      isHost ? 'บอกรหัสนี้ให้เพื่อน แล้วให้เพื่อนกด "เข้าห้อง"' : 'เข้าห้องแล้ว — รอ host กดเริ่ม',
      15,
      '#e8e0c8'
    );

    // รายชื่อ 4 ช่อง
    for (let i = 0; i < NET_MAX_PLAYERS; i++) {
      const y = 214 + i * 52;
      const p = net.roster[i];
      const filled = !!p;
      const box = this.add
        .rectangle(cx, y, 460, 44, filled ? 0x221d10 : 0x191611, 1)
        .setStrokeStyle(2, filled ? BASE_COLOR.gold : 0x3a3426)
        .setDepth(DEPTH.HUD)
        .setScrollFactor(0);
      this.objs.push(box);
      if (filled) {
        const tag = `${p.host ? ' (host)' : ''}${p.id === net.myId ? ' (คุณ)' : ''}`;
        this.txt(cx, y, `${i + 1}. ${p.name}${tag}`, 18, '#ffffff', 0.5, true);
      } else {
        this.txt(cx, y, `${i + 1}. ว่าง`, 16, '#6d6755');
      }
    }

    if (isHost) {
      this.btn(cx, 455, 320, 60, 'เริ่ม', BASE_COLOR.green, true, 30, () => this.startAsHost(), `${net.roster.length} คนในห้อง`);
    } else {
      this.btn(cx, 455, 320, 60, 'รอ host เริ่ม…', BASE_COLOR.paper, false, 20, () => undefined);
    }
    this.btn(cx, 535, 220, 44, 'ออกห้อง', BASE_COLOR.danger, true, 16, () => this.leaveRoom());
  }

  // =====================================================
  //  การกระทำ
  // =====================================================
  private addDigit(d: string) {
    if (this.joinCode.length >= 4) return;
    this.joinCode += d;
    sfx.open();
  }

  private delDigit() {
    if (this.joinCode.length === 0) return;
    this.joinCode = this.joinCode.slice(0, -1);
    sfx.open();
  }

  private submitJoin() {
    if (this.joinCode.length !== 4) return;
    sfx.pickup();
    net.joinRoom(this.joinCode);
  }

  private startAsHost() {
    if (this.leaving || net.role !== 'host') return;
    net.startGame();
    this.goTraining();
  }

  private leaveRoom() {
    net.leave();
    this.mode = 'home';
    this.joinCode = '';
    sfx.open();
  }

  /** ESC / ปุ่มกลับ: ใส่รหัส→หน้าแรก · อยู่ในห้อง→ออกห้อง · หน้าแรก→กลับฐาน */
  private goBack() {
    if (this.leaving) return;
    if (net.role) {
      this.leaveRoom();
      return;
    }
    if (this.mode === 'join') {
      this.mode = 'home';
      this.joinCode = '';
      sfx.open();
      return;
    }
    this.leaving = true;
    saveGame();
    sfx.open();
    this.scene.start('BaseScene');
  }

  /** เข้าห้องฝึกพร้อมกัน (ตอนถึงช่อง E ปุ่มเริ่มจะพาเข้า The World แทน) */
  private goTraining() {
    if (this.leaving) return;
    this.leaving = true;
    saveGame();
    sfx.whoosh();
    this.scene.start('GameScene');
  }

  /** พิมพ์เลขจากคีย์บอร์ด (เฉพาะตอนอยู่หน้าใส่รหัส) */
  private onKey(ev: any) {
    if (net.role || this.mode !== 'join') return;
    const k: string = ev.key;
    if (/^[0-9]$/.test(k)) {
      this.addDigit(k);
      this.later(() => undefined);
    } else if (k === 'Backspace') {
      this.delDigit();
    } else if (k === 'Enter') {
      this.submitJoin();
    }
  }

  // =====================================================
  //  ตัวช่วยวาด
  // =====================================================
  /** เลื่อนไปทำหลังจบเหตุการณ์แตะ — กันทำลายวัตถุที่กำลังรับเหตุการณ์อยู่ */
  private later(fn: () => void) {
    this.time.delayedCall(0, fn);
  }

  private txt(x: number, y: number, str: string, size: number, color: string, originX: number = 0.5, bold: boolean = false) {
    const t = this.add
      .text(x, y, str, {
        fontFamily: '"Noto Sans Thai", monospace',
        fontSize: `${size}px`,
        fontStyle: bold ? 'bold' : 'normal',
        color,
        stroke: '#000000',
        strokeThickness: Math.min(5, Math.max(2, Math.round(size / 8)))
      })
      .setOrigin(originX, 0.5)
      .setDepth(DEPTH.HUD + 1)
      .setScrollFactor(0);
    this.objs.push(t);
    return t;
  }

  private btn(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    color: number,
    enabled: boolean,
    fontSize: number,
    onPress: () => void,
    sub?: string
  ) {
    const fill = enabled ? 0x221d10 : 0x191611;
    const box = this.add
      .rectangle(x, y, w, h, fill, 1)
      .setStrokeStyle(3, enabled ? color : 0x4a4130)
      .setDepth(DEPTH.HUD)
      .setScrollFactor(0);
    box.setInteractive({ useHandCursor: enabled });
    if (enabled) {
      box.on('pointerover', () => box.setFillStyle(0x3d3016));
      box.on('pointerout', () => box.setFillStyle(fill));
      box.on('pointerdown', () => this.later(onPress));
    }
    this.objs.push(box);
    this.txt(x, sub ? y - 12 : y, label, fontSize, enabled ? '#ffffff' : '#8d8677', 0.5, true);
    if (sub) this.txt(x, y + fontSize * 0.7, sub, 12, enabled ? '#c9c2b2' : '#8d8677');
  }

  private showToast(msg: string) {
    if (this.toast && this.toast.active) this.toast.destroy();
    this.toast = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 100, msg, {
        fontFamily: '"Noto Sans Thai", monospace',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#7dff9b',
        stroke: '#000000',
        strokeThickness: 4,
        backgroundColor: 'rgba(0,0,0,0.72)',
        padding: { x: 12, y: 6 }
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.OVERLAY)
      .setScrollFactor(0);
    const t = this.toast;
    this.tweens.add({
      targets: t,
      alpha: 0,
      y: t.y - 20,
      delay: 1400,
      duration: 480,
      onComplete: () => t.destroy()
    });
  }
}