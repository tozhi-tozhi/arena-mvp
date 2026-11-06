// ตารางของล่า (Loot) — รายการไอเทมที่ดรอปจากกล่อง
// เพิ่มไอเทมใหม่ = เพิ่มอีกก้อนในตารางนี้ (เปลี่ยน icon เป็นชื่อรูปที่มีจริงได้เลย)
export interface LootDef {
  id: string;
  name: string;
  icon: string;   // ชื่อรูปใน preload (ตอนนี้ใช้ green_potion ทั้งหมด)
  weight: number; // ค่าน้ำหนักสุ่ม — ยิ่งมากยิ่งออกบ่อย
  rarity: string; // ระดับความหายาก (ไว้แสดง)
  color: string;  // สีชื่อไอเทมตามระดับ
}

export const LOOT_TABLE: LootDef[] = [
  { id: 'herb',    name: 'สมุนไพร',      icon: 'green_potion', weight: 60, rarity: 'ทั่วไป', color: '#a8e6a3' },
  { id: 'essence', name: 'ธาตุสกัด',     icon: 'green_potion', weight: 30, rarity: 'หายาก',  color: '#7db8ff' },
  { id: 'relic',   name: 'ชิ้นส่วนโบราณ', icon: 'green_potion', weight: 10, rarity: 'ตำนาน',  color: '#ffd54a' }
];

// สุ่มไอเทมตามน้ำหนัก (weight สูง = โอกาสออกสูง)
export function rollLoot(random: () => number = Math.random): LootDef {
  const totalWeight = LOOT_TABLE.reduce((sum, item) => sum + item.weight, 0);
  let roll = random() * totalWeight;
  for (const item of LOOT_TABLE) {
    roll -= item.weight;
    if (roll < 0) return item;
  }
  return LOOT_TABLE[0]; // กันเหนียว (ปกติไม่มาถึง)
}