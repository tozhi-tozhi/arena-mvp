// โรงตีเหล็ก — ฉากเต็มจอแยกจากฐาน ไม่มีปัญหา UI ทับกัน
// การ์ดผลลัพธ์: "ตอนนี้ได้อะไร → อัปแล้วจะได้อะไร" ไม่โชว์สูตรคูณใด ๆ
import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { CHARMS, CHARM_IDS } from '../data/charms';
import { PETS, PET_IDS } from '../data/pets';
import { LOOT_TABLE } from '../data/loot';
import { RARITY, type Rarity } from '../data/rarity';
import { huntSession } from '../systems/HuntSession';
import { ensureItemIcons } from '../systems/itemIcons';
import { sfx } from '../systems/sfx';
import {
  MAX_LEVEL, MELT_NEED, levelOf, costForNext, canUpgrade,
  performUpgrade, meltItems, nextRarity, materialOf,
  charmEffectLines, petEffectLines, type UpgradeType, type EffectLine
} from '../systems/Upgrades';

type Tab = 'charm' | 'pet' | 'melt';

// ---------- ตำแหน่งบนจอ (ปรับที่นี่ที่เดียว) ----------
const PAD = 28; // ระยะขอบในการ์ด
const L = {
  titleY: 32,
  hintY: 58,
  tabY: 96,
  cardTop: 132,
  cardH: 186,
  cardGap: 16,
  meltTop: 132,
  meltH: 92,
  meltGap: 8,
  toastY: 534,
  backY: 566
};

export class UpgradeScene extends Phaser.Scene {
  private objs: Phaser.GameObjects.GameObject[] = [];
  private activeTab: Tab = 'charm';
  private toast: Phaser.GameObjects.Text | null = null;

  constructor() { super({ key: 'UpgradeScene' }); }

  create() {
    ensureItemIcons(this);
    this.objs = [];
    this.cameras.main.setBackgroundColor('#14100a');

    const kb = this.input.keyboard as any;
    kb.on('keydown-ESC', () => this.backToBase());
    kb.on('keydown-ONE', () => this.switchTab('charm'));
    kb.on('keydown-TWO', () => this.switchTab('pet'));
    kb.on('keydown-THREE', () => this.switchTab('melt'));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => kb.removeAllListeners());

    this.render();
  }

  private backToBase() {
    sfx.pickup();
    this.scene.start('BaseScene');
  }

  private switchTab(tab: Tab) {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    sfx.open();
    this.render();
  }

  // ---------- ตัวช่วยวาด ----------
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

  private button(x: number, y: number, w: number, h: number, label: string, enabled: boolean, onPick: () => void, accent = 0xffd54a) {
    const box = this.rect(x, y, w, h, enabled ? 0x2a2210 : 0x191712, 1, enabled ? accent : 0x3d3a33);
    if (enabled) {
      box.setInteractive({ useHandCursor: true });
      box.on('pointerover', () => box.setFillStyle(0x3d3016));
      box.on('pointerout', () => box.setFillStyle(0x2a2210));
      box.on('pointerdown', () => this.time.delayedCall(0, onPick));
    }
    this.text(x, y, label, 14, enabled ? '#ffe9a3' : '#6b665c', 0.5, enabled);
    return box;
  }

  private flash(msg: string, color = '#7dff9b') {
    if (this.toast?.active) this.toast.destroy();
    this.toast = this.add.text(GAME_WIDTH / 2, L.toastY, msg, {
      fontFamily: '"Noto Sans Thai", monospace',
      fontSize: '14px', fontStyle: 'bold', color,
      backgroundColor: 'rgba(0,0,0,0.8)', padding: { x: 12, y: 4 },
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5).setDepth(50);
    this.tweens.add({ targets: this.toast, alpha: 0, delay: 1300, duration: 400, onComplete: () => this.toast?.destroy() });
  }

  // ---------- วาดทั้งหน้า ----------
  private render() {
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
    const cx = GAME_WIDTH / 2;

    this.text(cx, L.titleY, 'โรงตีเหล็ก', 26, '#ffd54a', 0.5, true);
    this.text(cx, L.hintY, '1 เครื่องราง · 2 สัตว์เลี้ยง · 3 หลอมของ · ESC กลับฐาน', 12, '#a89f8c');

    const tabs: { id: Tab; label: string; x: number }[] = [
      { id: 'charm', label: 'เครื่องราง', x: cx - 190 },
      { id: 'pet', label: 'สัตว์เลี้ยง', x: cx },
      { id: 'melt', label: 'หลอมของ', x: cx + 190 }
    ];
    for (const t of tabs) {
      const on = this.activeTab === t.id;
      const box = this.rect(t.x, L.tabY, 170, 34, on ? 0x3a2a08 : 0x1b1810, 1, on ? 0xffd54a : 0x4a4130);
      box.setInteractive({ useHandCursor: true });
      box.on('pointerdown', () => this.time.delayedCall(0, () => this.switchTab(t.id)));
      this.text(t.x, L.tabY, t.label, 15, on ? '#ffd54a' : '#8d8677', 0.5, on);
    }

    if (this.activeTab === 'melt') this.renderMelt();
    else this.renderUpgrade(this.activeTab);

    this.button(cx, L.backY, 180, 34, 'กลับฐาน', true, () => this.backToBase());
  }

  // ---------- แถวผลลัพธ์: ตอนนี้ → หลังอัป ----------
  private effectRow(y: number, line: EffectLine, leftX: number, nowX: number, arrowX: number, nextX: number) {
    this.text(leftX, y, line.label, 13, '#c9c2b2', 0);
    this.text(nowX, y, line.now, 14, '#ffffff', 0.5, true);
    if (line.next === null) {
      this.text(nextX, y, 'สูงสุดแล้ว', 12, '#8d8677', 0.5);
    } else {
      this.text(arrowX, y, '→', 14, line.improved ? '#7dff9b' : '#5f5a50', 0.5);
      this.text(nextX, y, line.next, 14, line.improved ? '#7dff9b' : '#8d8677', 0.5, line.improved);
    }
  }

  // ---------- แท็บอัปเกรด ----------
  private renderUpgrade(type: UpgradeType) {
    const ids = type === 'charm' ? CHARM_IDS : PET_IDS;
    const defs: Record<string, { name: string }> = type === 'charm' ? (CHARMS as any) : (PETS as any);
    const matId = materialOf(type);
    const matName = LOOT_TABLE.find((l) => l.id === matId)?.name ?? matId;
    const cardW = 720;
    const cx = GAME_WIDTH / 2;
    const left = cx - cardW / 2;

    ids.forEach((id, i) => {
      const top = L.cardTop + i * (L.cardH + L.cardGap);
      const lv = levelOf(type, id);
      const cost = costForNext(lv);
      const ok = canUpgrade(type, lv);
      const lines = type === 'charm' ? charmEffectLines(id, lv) : petEffectLines(id, lv);

      this.rect(cx, top + L.cardH / 2, cardW, L.cardH, 0x1b1810, 1, ok ? 0x5a4a20 : 0x3d3524);

      // หัวการ์ด: ชื่อ + เลเวล + แถบ progress
      this.text(left + PAD, top + 24, defs[id].name, 19, '#ffffff', 0, true);
      this.text(left + PAD + 190, top + 24, `Lv.${lv}/${MAX_LEVEL}`, 15, '#ffd54a', 0, true);
      for (let k = 0; k < MAX_LEVEL; k++) {
        this.rect(left + PAD + 300 + k * 20, top + 24, 16, 8, k < lv ? 0xffd54a : 0x3a352a);
      }

      // คอลัมน์ผลลัพธ์
      const headY = top + 52;
      const nowX = left + 400;
      const arrowX = left + 470;
      const nextX = left + 545;
      this.text(nowX, headY, 'ตอนนี้', 12, '#8d8677', 0.5, true);
      this.text(nextX, headY, lv >= MAX_LEVEL ? '' : 'หลังอัปเกรด', 12, '#7dff9b', 0.5, true);

      lines.forEach((ln, k) => {
        this.effectRow(top + 76 + k * 24, ln, left + PAD, nowX, arrowX, nextX);
      });

      // ราคา + ปุ่ม (แถวล่างการ์ด)
      const footY = top + L.cardH - 24;
      if (!cost) {
        this.text(left + PAD, footY, 'อัปเกรดสูงสุดแล้ว', 13, '#ffd54a', 0, true);
      } else {
        const parts: string[] = [];
        const have = huntSession.getCountByRarity(matId, cost.reqRarity);
        parts.push(`${matName}[${RARITY[cost.reqRarity].name}] ${have}/${cost.amount}`);
        if (cost.reqRarity2) {
          const have2 = huntSession.getCountByRarity(matId, cost.reqRarity2);
          parts.push(`[${RARITY[cost.reqRarity2].name}] ${have2}/${cost.amount2}`);
        }
        this.text(left + PAD, footY, `ใช้: ${parts.join('  +  ')}`, 12, ok ? '#e8e8e8' : '#8d8677', 0);
      }

      const label = !cost ? 'สูงสุด' : ok ? 'อัปเกรด' : 'ของไม่พอ';
      this.button(left + cardW - 92, footY, 140, 34, label, ok, () => {
        if (performUpgrade(type, id)) {
          sfx.pickup();
          this.render();
          this.flash(`${defs[id].name} เป็น Lv.${levelOf(type, id)} แล้ว — ผลใหม่ใช้งานทันทีในการล่าครั้งถัดไป`);
        }
      }, 0x7dff9b);
    });
  }

  // ---------- แท็บหลอมของ ----------
  private renderMelt() {
    const froms: Rarity[] = ['common', 'rare', 'epic'];
    const cx = GAME_WIDTH / 2;
    const cardW = 720;
    const left = cx - cardW / 2;

    LOOT_TABLE.forEach((def, i) => {
      const top = L.meltTop + i * (L.meltH + L.meltGap);
      this.rect(cx, top + L.meltH / 2, cardW, L.meltH, 0x1b1810, 1, 0x3d3524);

      if (this.textures.exists(def.icon)) {
        const icon = this.add.image(left + 34, top + 30, def.icon).setDisplaySize(34, 34);
        this.objs.push(icon);
      }
      this.text(left + 62, top + 30, def.name, 17, '#ffffff', 0, true);

      const counts = froms.map((r) => `[${RARITY[r].name}] ${huntSession.getCountByRarity(def.id, r)}`).join('   ');
      this.text(left + 62, top + 58, counts, 12, '#a89f8c', 0);

      froms.forEach((from, k) => {
        const to = nextRarity(from)!;
        const have = huntSession.getCountByRarity(def.id, from);
        const ok = have >= MELT_NEED;
        const bx = left + 330 + k * 130;
        this.button(bx, top + 30, 122, 30, `${RARITY[from].name} ${have}/${MELT_NEED}`, ok, () => {
          if (meltItems(def.id, from)) {
            sfx.open();
            this.render();
            this.flash(`หลอมได้ ${def.name} [${RARITY[to].name}] 1 ชิ้น`, RARITY[to].color);
          }
        }, RARITY[to].colorNum);
      });

      this.text(cx, top + L.meltH - 14, `หลอม ${MELT_NEED} ชิ้น ได้ระดับถัดไป 1 ชิ้น`, 11, '#6f6858');
    });
  }
}