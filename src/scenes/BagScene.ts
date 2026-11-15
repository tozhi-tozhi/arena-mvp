// หน้ากระเป๋า — แยกฉากเต็มจอจากฐาน กด B หรือปุ่มกระเป๋าเพื่อเปิด
// แสดงไอเทมทั้ง 4 ชนิด × 4 ระดับ พร้อมผลรวม ไม่ต้องเดาในหน้าหลอมอีก
import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { LOOT_TABLE } from '../data/loot';
import { RARITY, RARITY_IDS, type Rarity } from '../data/rarity';
import { huntSession } from '../systems/HuntSession';
import { ensureItemIcons } from '../systems/itemIcons';
import { sfx } from '../systems/sfx';

// ---------- ตำแหน่งบนจอ (แก้เลย์เอาต์ที่นี่ที่เดียว) ----------
const L = {
  titleY: 40,
  hintY: 68,
  gridTop: 100,
  panelW: 344,
  panelH: 196,
  gapX: 24,
  gapY: 20,
  totalY: 526,
  backY: 556
};

export class BagScene extends Phaser.Scene {
  private objs: Phaser.GameObjects.GameObject[] = [];

  constructor() { super({ key: 'BagScene' }); }

  create() {
    ensureItemIcons(this);
    this.objs = [];
    this.cameras.main.setBackgroundColor('#14100a');

    const kb = this.input.keyboard as any;
    kb.on('keydown-ESC', () => this.backToBase());
    kb.on('keydown-B', () => this.backToBase());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => kb.removeAllListeners());

    this.render();
  }

  private backToBase() {
    sfx.pickup();
    this.scene.start('BaseScene');
  }

  private text(x: number, y: number, str: string, size: number, color: string, originX = 0.5, bold = false) {
    const t = this.add.text(x, y, str, {
      fontFamily: '"Noto Sans Thai", monospace',
      fontSize: `${size}px`,
      fontStyle: bold ? 'bold' : 'normal',
      color,
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(originX, 0.5);
    this.objs.push(t);
    return t;
  }

  private rect(x: number, y: number, w: number, h: number, fill: number, alpha = 1, stroke?: number) {
    const r = this.add.rectangle(x, y, w, h, fill, alpha);
    if (stroke !== undefined) r.setStrokeStyle(2, stroke);
    this.objs.push(r);
    return r;
  }

  // ถ้าอนาคตมีภาพแยกตามระดับ (เช่น item_ore_rare) จะหยิบมาใช้เองอัตโนมัติ
  private rarityIconKey(baseIcon: string, rarity: Rarity): string | null {
    const key = `${baseIcon}_${rarity}`;
    return this.textures.exists(key) ? key : null;
  }

  private render() {
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
    const cx = GAME_WIDTH / 2;

    this.text(cx, L.titleY, 'กระเป๋านักล่า', 28, '#ffd54a', 0.5, true);
    this.text(cx, L.hintY, 'ESC หรือ B = กลับฐาน', 12, '#a89f8c');

    const startX = cx - (L.panelW * 2 + L.gapX) / 2;
    let grandTotal = 0;

    LOOT_TABLE.forEach((def, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const left = startX + col * (L.panelW + L.gapX);
      const top = L.gridTop + row * (L.panelH + L.gapY);
      const pcx = left + L.panelW / 2;
      const right = left + L.panelW;

      const counts = RARITY_IDS.map((r) => huntSession.getCountByRarity(def.id, r));
      const total = counts.reduce((a, b) => a + b, 0);
      grandTotal += total;

      let highest: Rarity | null = null;
      RARITY_IDS.forEach((r, k) => { if (counts[k] > 0) highest = r; });

      this.rect(pcx, top + L.panelH / 2, L.panelW, L.panelH, 0x1b1810, 1, 0x3d3524);
      if (highest) this.rect(left + 2, top + L.panelH / 2, 3, L.panelH - 10, RARITY[highest].colorNum, 0.85);

      // หัวแผง: ไอคอน + ชื่อ + ยอดรวม
      if (this.textures.exists(def.icon)) {
        const icon = this.add.image(left + 30, top + 28, def.icon)
          .setDisplaySize(36, 36)
          .setAlpha(total > 0 ? 1 : 0.3);
        this.objs.push(icon);
      }
      this.text(left + 58, top + 28, def.name, 19, total > 0 ? '#ffffff' : '#6f6858', 0, true);
      this.text(right - 18, top + 28, `รวม ${total}`, 15, total > 0 ? '#ffd54a' : '#4f4a42', 1, true);

      this.rect(pcx, top + 52, L.panelW - 32, 1, 0x4a4130, 0.7);

      // 4 แถวระดับ — เลข 0 ก็แสดง เพื่อให้เห็นว่าขาดระดับไหน
      RARITY_IDS.forEach((r, k) => {
        const rd = RARITY[r];
        const n = counts[k];
        const y = top + 76 + k * 30;
        const has = n > 0;

        const iconKey = this.rarityIconKey(def.icon, r);
        if (iconKey) {
          const mini = this.add.image(left + 30, y, iconKey).setDisplaySize(20, 20).setAlpha(has ? 1 : 0.28);
          this.objs.push(mini);
        } else {
          this.rect(left + 30, y, 12, 12, rd.colorNum, has ? 1 : 0.25);
        }

        this.text(left + 50, y, rd.name, 14, has ? rd.color : '#5f5a50', 0);
        this.text(right - 22, y, `${n} ชิ้น`, 15, has ? '#ffffff' : '#4f4a42', 1, true);
      });
    });

    this.text(cx, L.totalY, `ของทั้งหมดในกระเป๋า ${grandTotal} ชิ้น`, 14, '#a89f8c');

    const back = this.rect(cx, L.backY, 180, 38, 0x3a2a08, 1, 0xffd54a);
    back.setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.time.delayedCall(0, () => this.backToBase()));
    this.text(cx, L.backY, 'กลับฐาน (ESC)', 16, '#ffd54a', 0.5, true);
  }
}