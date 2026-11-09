// เครื่องราง — ทำงานด้วย "เหตุการณ์" เท่านั้น (ห้ามใช้ตัวจับเวลา)
export type CharmId = 'heal' | 'streak';

export interface CharmDef {
  id: CharmId;
  name: string;
  desc: string;
}

export const CHARM_IDS: CharmId[] = ['heal', 'streak'];

export const CHARMS: Record<CharmId, CharmDef> = {
  heal: {
    id: 'heal',
    name: 'ตราต่อชีวิต',
    desc: 'โจมตีโดน 30% ฟื้นเลือด 1 (สูงสุด 2 ครั้งต่อการล่า)'
  },
  streak: {
    id: 'streak',
    name: 'ตราไร้รอย',
    desc: 'โจมตีโดนติด 5 ครั้งโดยไม่ถูกตี → การโจมตีครั้งถัดไป x2'
  }
};

// ตัวเลขสมดุล
export const CHARM_HEAL = {
  chance: 0.3,      // โอกาสต่อ "การโจมตี 1 ครั้งที่โดน"
  amount: 1,
  maxPerHunt: 2
};

export const CHARM_STREAK = {
  hitsNeeded: 5,
  multiplier: 2
};