// src/entities/HealShrine.ts — เสาฟื้นเลือด: กด E ค้างพื้นที่ยืน → ฟื้นทีละหน่วย
// ตัวเสาไม่รู้จักผู้เล่น — ฉากส่งสถานะ (อยู่ในระยะ? เลือดเต็ม?) เข้ามาทาง tick()
import Phaser from 'phaser';
import { DEPTH } from '../config';
import { HEAL_SHRINE } from '../data/healing';
import { burst, ringEffect } from '../systems/effects';
import { sfx } from '../systems/sfx';

const TEX = 'heal_shrine';

function ensureTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(TEX)) return;
  const g: any = scene.make.graphics({ x: 0, y: 0, add: false } as any);
  // เสากระดาษตั้งตรง พันผ้าเขียวคาดเฉียง (แสงซ้ายบน)
  g.fillStyle(0xcfc4a6, 1);
  g.fillRect(20, 8, 16, 48);
  g.fillStyle(0xe8e0c8, 1);
  g.fillRect(20, 8, 7, 48);
  g.fillStyle(0xa89a7c, 0.9);
  g.fillRect(31, 8, 5, 48);
  // ผ้าพันเขียว
  g.fillStyle(HEAL_SHRINE.clothColor, 1);
  g.beginPath();
  g.moveTo(18, 22);
  g.lineTo(38, 16);
  g.lineTo(38, 26);
  g.lineTo(18, 32);
  g.closePath();
  g.fillPath();
  g.fillStyle(0x7dff9b, 0.9);
  g.beginPath();
  g.moveTo(18, 22);
  g.lineTo(38, 16);
  g.lineTo(38, 20);
  g.lineTo(18, 26);
  g.closePath();
  g.fillPath();
  // ยอดเสา: ผลึกเขียวเล็ก
  g.fillStyle(0x7dff9b, 1);
  g.beginPath();
  g.moveTo(28, 0);
  g.lineTo(34, 8);
  g.lineTo(22, 8);
  g.closePath();
  g.fillPath();
  // ขอบกระดาษ
  g.lineStyle(1.5, 0x6a5f48, 0.9);
  g.strokeRect(20, 8, 16, 48);
  g.generateTexture(TEX, 56, 60);
  g.destroy();
}

export class HealShrine {
  readonly x: number;
  readonly y: number;
  private scene: Phaser.Scene;
  private sprite: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Arc;
  private prompt: Phaser.GameObjects.Text;
  private channelGfx: Phaser.GameObjects.Graphics;
  private channeling = false;
  private tickTimer = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    ensureTexture(scene);

    // เงาขวาล่างตามแสงเกม
    const shadow = scene.add.ellipse(x + 6, y + 28, 40, 12, 0x000000, 0.3);
    shadow.setDepth(DEPTH.ENEMY_SHADOW);

    // ออร่าเขียวจางใต้เสา — บอกว่าเป็นจุดปลอดภัย desde ไกล
    this.glow = scene.add.circle(x, y + 20, 46, HEAL_SHRINE.color, 0.08);
    this.glow.setStrokeStyle(2, HEAL_SHRINE.color, 0.35);
    this.glow.setDepth(DEPTH.TELEGRAPH);
    scene.tweens.add({ targets: this.glow, scale: 1.12, alpha: 0.16, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.sprite = scene.add.image(x, y, TEX);
    this.sprite.setDisplaySize(HEAL_SHRINE.displayWidth, HEAL_SHRINE.displayWidth * (60 / 56));
    this.sprite.setDepth(DEPTH.ENEMY);

    this.prompt = scene.add.text(x, y - 48, '[E] พักฟื้น', {
      fontFamily: '"Noto Sans Thai", monospace', fontSize: '14px', fontStyle: 'bold',
      color: '#7dff9b', stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5).setDepth(DEPTH.HUD).setVisible(false);

    this.channelGfx = scene.add.graphics().setDepth(DEPTH.PLAYER + 1);
  }

  get isChanneling(): boolean { return this.channeling; }

  isNear(px: number, py: number): boolean {
    return Phaser.Math.Distance.Between(this.x, this.y, px, py) <= HEAL_SHRINE.interactRange;
  }

  inRange(px: number, py: number): boolean {
    return Phaser.Math.Distance.Between(this.x, this.y, px, py) <= HEAL_SHRINE.channelRange;
  }

  /** เรียกทุกเฟรมจากฉาก — โชว์ป้าย E เมื่อใกล้และเลือดยังไม่เต็ม */
  tick(px: number, py: number, hpFull: boolean) {
    this.prompt.setVisible(!hpFull && !this.channeling && this.isNear(px, py));
    if (hpFull && this.isNear(px, py) && !this.channeling) {
      this.prompt.setText('เลือดเต็มแล้ว').setVisible(true);
    } else {
      this.prompt.setText('[E] พักฟื้น');
    }
  }

  /** ผู้เล่นกด E ที่เสา — เริ่มฟื้น (คืน false ถ้าเลือดเต็มแล้ว ไม่ต้องเริ่ม) */
  startChannel(hpFull: boolean): boolean {
    if (hpFull || this.channeling) return false;
    this.channeling = true;
    this.tickTimer = 0;
    this.prompt.setVisible(false);
    sfx.shrineStart();
    return true;
  }

  /** ยกเลิกการฟื้น (เดินออก/โดนตี/เลือดเต็ม/จบทริป) */
  stopChannel() {
    if (!this.channeling) return;
    this.channeling = false;
    this.channelGfx.clear();
  }

  /** เรียกทุกเฟรมขณะ channeling — คืนจำนวนหน่วยที่ฟื้น "เฟรมนี้" (ฉากเอาไปเรียก actor.heal) */
  updateChannel(delta: number, px: number, py: number): number {
    if (!this.channeling) return 0;
    if (!this.inRange(px, py)) {
      this.stopChannel();
      return 0;
    }
    this.tickTimer += delta;
    // วงคืบหน้ารอบคุณผู้เล่น — อ่านได้ว่าอีกนานแค่ไหน
    const p = Phaser.Math.Clamp(this.tickTimer / HEAL_SHRINE.tickMs, 0, 1);
    const g = this.channelGfx;
    g.clear();
    g.lineStyle(3, HEAL_SHRINE.color, 0.85);
    g.beginPath();
    g.arc(px, py, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p, false);
    g.strokePath();
    if (this.tickTimer >= HEAL_SHRINE.tickMs) {
      this.tickTimer = 0;
      burst(this.scene, px, py - 10, HEAL_SHRINE.color, 6, 30, 3);
      ringEffect(this.scene, this.x, this.y, 50, HEAL_SHRINE.color, 300);
      sfx.shrineTick();
      return HEAL_SHRINE.healPerTick;
    }
    return 0;
  }

  destroy() {
    this.channelGfx.destroy();
    this.prompt.destroy();
  }
}