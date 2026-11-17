// src/entities/SealedCache.ts — กล่องผนึกกระดาษ (ทำมินิเกมแถบจังหวะเพื่อเปิด)
import Phaser from 'phaser';
import { DEPTH } from '../config';
import { makeGlow, destroyGlow } from '../systems/effects';

export class SealedCache {
  readonly x: number;
  readonly y: number;
  public isCracked: boolean = false;
  public isBroken: boolean = false;
  public isResolved: boolean = false;
  private scene: Phaser.Scene;
  private sprite: Phaser.GameObjects.Container;
  private glow: any;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.x = x;
    this.y = y;

    // สร้าง Texture กล่องผนึก (กระดาษ + แถบอำพัน)
    const texKey = 'sealed_cache';
    if (!scene.textures.exists(texKey)) {
      const g = scene.make.graphics({ x: 0, y: 0, add: false } as any);
      
      // ตัวกล่องกระดาษ
      g.fillStyle(0xd8cfb8, 1);
      g.fillRect(0, 0, 40, 30);
      g.lineStyle(2, 0x6a5f48, 1);
      g.strokeRect(0, 0, 40, 30);
      
      // แถบอำพันคาดกลาง
      g.fillStyle(0xffd166, 1);
      g.fillRect(0, 12, 40, 8);
      
      // ตราประทับสีแดง
      g.fillStyle(0xff5a3a, 1);
      g.fillCircle(20, 16, 5);
      g.lineStyle(1, 0x6a2b1a, 1);
      g.strokeCircle(20, 16, 5);
      
      g.generateTexture(texKey, 40, 30);
      g.destroy();
    }

    const boxImg = scene.add.image(0, 0, texKey);
    this.sprite = scene.add.container(x, y, [boxImg]);
    this.sprite.setDepth(DEPTH.ENEMY);

    // แสงอำพันสีทอง (P3b)
    this.glow = makeGlow(scene, x, y, 40, 0xffd166, true);
  }

  isNear(px: number, py: number): boolean {
    return Phaser.Math.Distance.Between(this.x, this.y, px, py) <= 60;
  }

  /** เรียกทุกเฟรมจากฉาก — อัปเดตสถานะ (เว้นว่างไว้เพื่อให้เข้ากับ Signature ของ WorldScene) */
  tick(_px: number, _py: number, _now: number) {
    // เมธอดนี้เว้นว่างไว้ เนื่องจาก WorldScene ส่งค่ามาให้ แต่ตัวกล่องยังไม่ต้องทำอะไรเพิ่ม
    // ในอนาคตสามารถใส่ Logic ให้แสงสว่างวาบเมื่อผู้เล่นเดินใกล้ได้ที่นี่
  }

  /** เปิดสำเร็จ (จากมินิเกม) */
  crackOpen() {
    this.isCracked = true;
    this.isResolved = true;
    
    // เอฟเฟกต์ภาพกล่องเปิด
    this.sprite.setAlpha(0.4);
    this.sprite.setScale(1.1);
    
    if (this.glow) {
      destroyGlow(this.glow);
      this.glow = null;
    }
  }

  /** ผนึกแตก/พัง (จากมินิเกมพลาด) */
  breakSeal() {
    this.isBroken = true;
    this.isResolved = true;
    
    // เอฟเฟกต์ภาพกล่องพัง
    this.sprite.setAlpha(0.3);
    this.sprite.setAngle(15);
    
    if (this.glow) {
      destroyGlow(this.glow);
      this.glow = null;
    }
  }

  destroy() {
    if (this.sprite) this.sprite.destroy();
    if (this.glow) destroyGlow(this.glow);
  }
}