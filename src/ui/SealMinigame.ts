// src/ui/SealMinigame.ts — มินิเกมแถบจังหวะแกะผนึก (เกมไม่หยุดเวลา)
// เคอร์เซอร์วิ่งไป-กลับบนแถบ · กด E ตอนอยู่ในช่วงทอง = ผ่าน 1 แผล
// ต้องผ่าน 2 แผล · พลาดครบ 3 ครั้ง = ผนึกพัง · ช่วงทองแคบลงทุกครั้งที่พลาด
// แผงเป็น UI interactive — PlayerActor กันคลิกทะลุให้แล้ว (hitTestPointer)
import Phaser from 'phaser';
import { GAME_WIDTH, DEPTH } from '../config';
import { SEAL } from '../data/quests';
import { sfx } from '../systems/sfx';

const PANEL_W = 420;
const PANEL_H = 118;
const BAR_W = 360;
const BAR_H = 18;
const HITS_NEEDED = 2;
const D = DEPTH.OVERLAY_TEXT; // เหนือ HUD ทั้งหมด แต่ฉากยังเดิน/บอสยังตีได้

export class SealMinigame {
  private scene: Phaser.Scene;
  private objs: Phaser.GameObjects.GameObject[] = [];
  private cursor: Phaser.GameObjects.Rectangle;
  private zone: Phaser.GameObjects.Rectangle;
  private statusText: Phaser.GameObjects.Text;
  private pos = 0;          // ตำแหน่งเคอร์เซอร์ 0..1
  private dir = 1;
  private zoneStart = 0.4;  // จุดเริ่มช่วงทอง 0..1
  private zoneW: number = SEAL.zoneWidth;
  private hits = 0;
  private misses = 0;
  private finished = false;
  private onDone: (success: boolean) => void;

  constructor(scene: Phaser.Scene, onDone: (success: boolean) => void) {
    this.scene = scene;
    this.onDone = onDone;
    const cx = GAME_WIDTH / 2;
    const top = 132; // ใต้ HUD บน ไม่บังลานสู้กลางจอ

    const ui = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      (o as any).setScrollFactor(0);
      (o as any).setDepth(D);
      this.objs.push(o);
      return o;
    };

    const bg = ui(scene.add.rectangle(cx, top + PANEL_H / 2, PANEL_W, PANEL_H, 0x14100a, 0.94));
    bg.setStrokeStyle(2, 0xffd166);
    bg.setInteractive(); // กันคลิกทะลุไปออกดาบ

    ui(scene.add.text(cx, top + 20, 'แกะผนึก — กด E ในช่องทอง', {
      fontFamily: '"Noto Sans Thai", monospace', fontSize: '15px', fontStyle: 'bold',
      color: '#ffd166', stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5));

    // แถบหลัก
    const barX = cx - BAR_W / 2;
    const barY = top + 52;
    ui(scene.add.rectangle(cx, barY + BAR_H / 2, BAR_W, BAR_H, 0x241f14).setStrokeStyle(1, 0x4a4130));
    this.zone = ui(scene.add.rectangle(0, barY + BAR_H / 2, BAR_W * this.zoneW, BAR_H - 4, 0xffd166, 0.85));
    this.cursor = ui(scene.add.rectangle(barX, barY + BAR_H / 2, 5, BAR_H + 8, 0xffffff));
    this.placeZone();

    this.statusText = ui(scene.add.text(cx, top + 92, '', {
      fontFamily: '"Noto Sans Thai", monospace', fontSize: '12px',
      color: '#c9c2b2', stroke: '#000000', strokeThickness: 2
    }).setOrigin(0.5));
    this.refreshStatus();
    sfx.open();
  }

  get isFinished(): boolean { return this.finished; }

  private placeZone() {
    // สุ่มตำแหน่งช่วงทองใหม่ทุกครั้ง — ท่องจังหวะไม่ได้
    this.zoneStart = 0.12 + Math.random() * (0.76 - this.zoneW);
    const barX = GAME_WIDTH / 2 - BAR_W / 2;
    this.zone.setPosition(barX + (this.zoneStart + this.zoneW / 2) * BAR_W, this.zone.y);
    this.zone.setSize(BAR_W * this.zoneW, BAR_H - 4);
  }

  private refreshStatus() {
    this.statusText.setText(
      `แผลผนึก ${this.hits}/${HITS_NEEDED} · พลาดได้ ${SEAL.attempts - this.misses} ครั้ง · เกมไม่หยุด!`
    );
  }

  /** เรียกทุกเฟรมจาก WorldScene */
  update(delta: number) {
    if (this.finished) return;
    this.pos += (this.dir * delta) / SEAL.sweepMs;
    if (this.pos >= 1) { this.pos = 1; this.dir = -1; }
    if (this.pos <= 0) { this.pos = 0; this.dir = 1; }
    const barX = GAME_WIDTH / 2 - BAR_W / 2;
    this.cursor.setX(barX + this.pos * BAR_W);
  }

  /** ผู้เล่นกด E — ตัดสินผล */
  press() {
    if (this.finished) return;
    const inZone = this.pos >= this.zoneStart && this.pos <= this.zoneStart + this.zoneW;
    if (inZone) {
      this.hits++;
      sfx.pickup();
      this.flashZone(0x7dff9b);
      if (this.hits >= HITS_NEEDED) {
        this.finish(true);
        return;
      }
    } else {
      this.misses++;
      sfx.hurt();
      this.flashZone(0xff5a3a);
      this.zoneW *= SEAL.zoneShrink; // พลาดแล้วแคบลง — กดดันขึ้นทีละขั้น
      if (this.misses >= SEAL.attempts) {
        this.finish(false);
        return;
      }
    }
    this.placeZone();
    this.refreshStatus();
  }

  private flashZone(color: number) {
    const old = this.zone.fillColor;
    this.zone.setFillStyle(color);
    this.scene.time.delayedCall(120, () => {
      if (this.zone.active) this.zone.setFillStyle(old);
    });
  }

  private finish(success: boolean) {
    this.finished = true;
    this.statusText.setText(success ? 'ผนึกแตก!' : 'ผนึกพัง...').setColor(success ? '#7dff9b' : '#ff8a7a');
    this.scene.time.delayedCall(450, () => {
      this.destroy();
      this.onDone(success);
    });
  }

  destroy() {
    for (const o of this.objs) if (o.active) o.destroy();
    this.objs = [];
  }
}