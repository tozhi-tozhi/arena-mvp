// src/actors/RemotePlayer.ts — ตัวผี: ภาพของผู้เล่นคนอื่นบนจอเรา
// ไม่มี physics ไม่ฟังอินพุต ไม่มี HUD ไม่แตะ profiles.local ไม่รันชุดท่า
// หน้าที่: โชว์สไปรต์ + เงา + ป้ายชื่อ แล้วเล่นคลิปตามข้อมูลสถานะที่ส่งมา
import Phaser from 'phaser';
import { DEPTH, SPRITE_SCALE } from '../config';
import { makeShadow, syncShadow } from '../systems/effects';
import { ClipSet } from '../systems/ClipSet';
import { CHARACTERS, type CharacterDef, type CharacterId } from '../data/characters';

const CLAY_SCALE = 0.68;
const NAME_COLOR = '#c084fc'; // ม่วง = ตัวตน (ห้ามใช้แดงส้ม/ทอง)
const GHOST_DEPTH_GAP = 0.1; // ตัวผีอยู่ใต้ตัวจริงเสมอ
const LERP_MS = 90; // ค่ายิ่งมาก ยิ่งนุ่มแต่ตามช้า

/** ข้อมูลสถานะที่ตัวผีรับ — รูปแบบเดียวกับที่จะส่งผ่านเน็ตใน D2 (ส่งครบทุกแพ็กเก็ต ไม่พึ่งแพ็กเก็ตก่อนหน้า) */
export interface GhostState {
  x: number;
  y: number;
  /** true = หันซ้าย */
  flip: boolean;
  clip: string;
  /** เวลาต่อเฟรม (ตัวเลขเดียวหรืออาเรย์รายเฟรม) */
  ms: number | number[];
  /** นับเพิ่มทุกครั้งที่เริ่มคลิป — แยกกรณีเล่นคลิปเดิมซ้ำ */
  clipSeq: number;
  /** คลิปเริ่มมาแล้วกี่ ms ตอนส่ง */
  age: number;
  /** ภาพที่สไปรต์โชว์อยู่ (เฉพาะตัวละครที่ยังไม่มีคลิป เช่น ลูมิ) */
  tex?: string;
}

export class RemotePlayer {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly character: CharacterDef;
  readonly clips: ClipSet;

  private scene: Phaser.Scene;
  private shadow: any;
  private label: Phaser.GameObjects.Text;
  private shadowOffset: number;
  private currentTexture: string;
  private targetX: number;
  private targetY: number;
  private lastSeq: number = -1;
  private lastClip: string = '';
  private clipStartAt: number = 0;
  private clipMs: number | number[] = 0;
  private remoteTex: string = '';

  constructor(scene: Phaser.Scene, x: number, y: number, charId: CharacterId, name: string) {
    this.scene = scene;
    this.character = CHARACTERS[charId];
    this.clips = new ClipSet(scene, charId);
    this.targetX = x;
    this.targetY = y;

    const hasClay = scene.textures.exists('hero_clay_idle');
    let texture = 'hero';
    let base = SPRITE_SCALE;
    if (this.clips.ready) {
      texture = this.clips.keyOf('idle', 1);
      base = this.clips.scale;
    } else if (hasClay) {
      texture = 'hero_clay_idle';
      base = CLAY_SCALE;
    }

    this.currentTexture = texture;
    this.sprite = scene.add.sprite(x, y, texture);
    this.sprite.setDepth(DEPTH.PLAYER - GHOST_DEPTH_GAP);
    this.sprite.setScale(base * this.character.scale);
    if (!this.clips.ready) this.sprite.setTint(this.character.tint);

    const usesArt = this.clips.ready || hasClay;
    this.shadowOffset = usesArt ? this.sprite.displayHeight / 2 - 6 : 14;
    const shadowWidth = Math.max(26, this.sprite.displayWidth * 0.38);
    const shadowHeight = Math.max(10, this.sprite.displayWidth * 0.14);
    this.shadow = makeShadow(scene, shadowWidth, shadowHeight, DEPTH.PLAYER_SHADOW, 0.35);
    syncShadow(this.shadow, this.sprite, 0, false, this.shadowOffset);

    this.label = scene.add
      .text(x, y, name, {
        fontFamily: '"Noto Sans Thai", monospace',
        fontSize: '12px',
        fontStyle: 'bold',
        color: NAME_COLOR,
        stroke: '#000000',
        strokeThickness: 3
      })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.PLAYER + 1);

    if (this.clips.ready) this.clips.play('idle', 1000, scene.time.now);
    this.placeLabel();
  }

  get x(): number {
    return this.sprite.x;
  }
  get y(): number {
    return this.sprite.y;
  }
  /** ชื่อคลิปที่เล่นอยู่ (ไว้แสดงในแผงวินิจฉัย) */
  get clipName(): string {
    return this.clips.current;
  }
  get seq(): number {
    return this.lastSeq;
  }

  /** รับข้อมูลสถานะใหม่ — ตำแหน่งตั้งเป็นเป้า ตัวผีค่อยเลื่อนตาม (lerp) */
  applyState(s: GhostState, now: number) {
    this.targetX = s.x;
    this.targetY = s.y;
    this.sprite.setFlipX(s.flip);
    this.remoteTex = s.tex ?? '';
    // เริ่มคลิปใหม่เมื่อชื่อเปลี่ยน หรือ clipSeq เปลี่ยน (เล่นคลิปเดิมซ้ำ)
    if (s.clipSeq !== this.lastSeq || s.clip !== this.lastClip) {
      this.lastSeq = s.clipSeq;
      this.lastClip = s.clip;
      // เวลาเริ่มคลิปคิดจากนาฬิกาเครื่องเราเอง (ลบ age) เพราะนาฬิกาแต่ละเครื่องไม่ตรงกัน
      this.clipStartAt = now - s.age;
      this.clipMs = s.ms;
      this.clips.play(s.clip, s.ms, now - s.age);
    }
  }

  /** เรียกทุกเฟรมจากฉาก */
  update(now: number, delta: number) {
    const k = 1 - Math.exp(-delta / LERP_MS);
    this.sprite.x += (this.targetX - this.sprite.x) * k;
    this.sprite.y += (this.targetY - this.sprite.y) * k;
    // ตัวละครที่ไม่มีคลิป (ลูมิ): โชว์ภาพตามที่เจ้าของส่งมา
    if (!this.clips.ready && this.remoteTex && this.remoteTex !== this.currentTexture && this.scene.textures.exists(this.remoteTex)) {
      this.sprite.setTexture(this.remoteTex);
      this.currentTexture = this.remoteTex;
    }

    if (this.clips.ready) {
      const key = this.frameKey(now);
      if (key && key !== this.currentTexture && this.scene.textures.exists(key)) {
        this.sprite.setTexture(key);
        this.currentTexture = key;
      }
    }
    syncShadow(this.shadow, this.sprite, 0, false, this.shadowOffset);
    this.placeLabel();
  }
  /** เลือกเฟรมที่ควรโชว์ — charge_hold เล่นรอบเดียวแล้วค้างเฟรมสุดท้าย (กฎเดียวกับ PlayerActor.updateAkkVisual) */
  private frameKey(now: number): string {
    if (this.clips.current === 'charge_hold') {
      const n = this.clips.frames.charge_hold ?? 7;
      const total = Array.isArray(this.clipMs)
        ? this.clipMs.reduce((a, b) => a + b, 0)
        : this.clipMs * n;
      if (now - this.clipStartAt >= total) return this.clips.keyOf('charge_hold', n);
    }
    return this.clips.frameKeyAt(now);
  }
  private placeLabel() {
    this.label.setPosition(this.sprite.x, this.sprite.y - this.sprite.displayHeight / 2 - 6);
  }

  destroy() {
    this.sprite.destroy();
    this.label.destroy();
    if (this.shadow && this.shadow.destroy) this.shadow.destroy();
  }
}