// src/systems/ClipSet.ts — ตัวเล่นคลิปภาพของ "ตัวละครหนึ่งตัว" (ไม่รู้จักชื่อตัวละครใดเลย)
// หน้าที่: โหลดภาพ · เช็กว่าคลิปไหนใช้ได้ · จำว่ากำลังเล่นคลิปอะไร · คำนวณว่าเฟรมนี้ควรโชว์รูปไหน
// ผู้เล่นเรียกใช้ผ่านเมธอดเล็ก ๆ — ตรรกะเฟรมทั้งหมดอยู่ในนี้ที่เดียว
import Phaser from 'phaser';
import type { CharacterId } from '../data/characters';
import { ART_CHARACTERS, artOf, clipFilePath, clipTextureKey, hasFrameArt } from '../data/characterArt';

export class ClipSet {
  private scene: Phaser.Scene;
  private char: CharacterId;
  /** ภาพชุดนี้เล่นได้จริงไหม (มีท่ายืน+ท่าเดินครบทุกเฟรม) */
  readonly ready: boolean;
  /** สเกลพื้นฐานของภาพชุดนี้ */
  readonly scale: number;
  /** จำนวนเฟรมของคลิปที่ "ใช้ได้จริง" — คลิปที่ภาพไม่ครบจะไม่อยู่ในก้อนนี้ */
  readonly frames: Record<string, number> = {};

  private clip = '';
  private startAt = 0;
  private durations: number[] = [];
  private looping = false;

  /** บันทึกคลิปล่าสุดที่เริ่มเล่น — ไว้ส่งสถานะข้ามเน็ตให้ตัวผีของเพื่อน (ไม่กระทบการเล่นภาพ) */
  seq = 0;
  lastMs: number | number[] = 1000;
  lastStartAt = 0;
  constructor(scene: Phaser.Scene, char: CharacterId) {
    this.scene = scene;
    this.char = char;
    const art = artOf(char);
    this.scale = art.scale;

    if (!hasFrameArt(char)) {
      this.ready = false;
      return;
    }

    // คัดเฉพาะคลิปที่ไฟล์ครบทุกเฟรม — ขาดเฟรมเดียวตัดทิ้งทั้งคลิป
    for (const name of Object.keys(art.clips)) {
      const def = art.clips[name];
      let ok = def.frames > 0;
      for (let i = 1; i <= def.frames && ok; i++) {
        if (!scene.textures.exists(clipTextureKey(char, name, i))) ok = false;
      }
      if (ok) this.frames[name] = def.frames;
    }

    this.ready = !!this.frames.idle && !!this.frames.walk;
    if (!this.ready) return;

    // คลิปที่ยังไม่มีภาพ → ชี้ไปคลิปสำรองที่มีจริง (ไล่หลายชั้นได้ แต่กันวงวน)
    for (const name of Object.keys(art.clips)) {
      if (this.frames[name]) continue;
      let target = art.clips[name].fallback ?? '';
      for (let hop = 0; hop < 4 && target && !this.frames[target]; hop++) {
        target = art.clips[target]?.fallback ?? '';
      }
      if (target && this.frames[target]) this.frames[name] = this.frames[target];
    }
    // จำชื่อคลิปจริงที่ใช้แทนแล้ว — เวลาเล่นจะได้หยิบเฟรมถูกชุด
    this.resolved = {};
    for (const name of Object.keys(art.clips)) {
      if (!this.frames[name]) continue;
      let target = name;
      for (let hop = 0; hop < 4 && !this.hasOwn(target); hop++) {
        target = art.clips[target]?.fallback ?? '';
        if (!target) break;
      }
      this.resolved[name] = this.hasOwn(target) ? target : name;
    }
  }

  private resolved: Record<string, string> = {};

  /** คลิปนี้มีไฟล์ของตัวเองจริงไหม (ไม่ใช่ยืมคลิปสำรอง) */
  private hasOwn(name: string): boolean {
    const def = artOf(this.char).clips[name];
    if (!def || def.frames <= 0) return false;
    for (let i = 1; i <= def.frames; i++) {
      if (!this.scene.textures.exists(clipTextureKey(this.char, name, i))) return false;
    }
    return true;
  }

  /** ชื่อคลิปที่เล่นอยู่ตอนนี้ ('' = ยังไม่ได้เล่น) */
  get current(): string { return this.clip; }

  /** คลิปนี้เล่นได้ไหม */
  can(clip: string): boolean {
    return this.ready && !!this.frames[clip];
  }

  /** คีย์ภาพเฟรมหนึ่งของคลิปที่ขอ (ถ้าเป็นคลิปสำรองจะได้ภาพของคลิปสำรอง) */
  keyOf(clip: string, i: number): string {
    const real = this.resolved[clip] ?? clip;
    return clipTextureKey(this.char, real, i);
  }

  /** เริ่มเล่นคลิป — frameMs เป็นตัวเลขเดียวหรืออาเรย์รายเฟรมก็ได้ */
  play(clip: string, frameMs: number | number[], now: number): void {
    if (!this.can(clip)) return;
    const n = this.frames[clip];
    const def = artOf(this.char).clips[clip];
    this.clip = clip;
    this.startAt = now;
    this.seq++;
    this.lastMs = frameMs;
    this.lastStartAt = now;
    this.looping = !!def?.loop;
    this.durations = Array.isArray(frameMs) ? frameMs.slice() : new Array(n).fill(frameMs);
  }

  /** คีย์ภาพที่ควรแสดง ณ เวลานี้ — '' ถ้ายังไม่ได้เล่นคลิปใด */
  frameKeyAt(now: number): string {
    if (!this.clip || !this.frames[this.clip]) return '';
    const n = this.frames[this.clip];
    let t = now - this.startAt;
    if (this.looping) {
      const total = this.durations.reduce((a, b) => a + b, 0);
      if (total > 0) t = t % total;
    }
    let i = 0;
    while (i < n - 1 && t >= (this.durations[i] ?? 100)) {
      t -= this.durations[i] ?? 100;
      i++;
    }
    return this.keyOf(this.clip, i + 1);
  }

  /** โหลดภาพทุกตัวละครที่มีตาราง — ฉากเรียกใน preload (โหลดซ้ำ Phaser ข้ามให้เอง) */
  static loadAll(scene: Phaser.Scene): void {
    for (const char of ART_CHARACTERS) {
      const art = artOf(char);
      for (const name of Object.keys(art.clips)) {
        if (art.clips[name].planned) continue; // ยังไม่มีไฟล์ — ไม่ต้องขอโหลด
const n = art.clips[name].frames;
        for (let i = 1; i <= n; i++) {
          scene.load.image(clipTextureKey(char, name, i), clipFilePath(char, name, i));
        }
      }
    }
  }
}