// 4 ระดับ rarity — สีและชื่อใช้ร่วมทั้งเกม
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export const RARITY: Record<Rarity, {
  name: string;      // ชื่อไทย
  color: string;     // hex สำหรับ text
  colorNum: number;  // เลขสำหรับ Graphics
  glow: boolean;     // มีเรืองแสงไหม
}> = {
  common:    { name: 'ทั่วไป',  color: '#a8e6a3', colorNum: 0xa8e6a3, glow: false },
  rare:      { name: 'หายาก',   color: '#7db8ff', colorNum: 0x7db8ff, glow: false },
  epic:      { name: 'มหากาพย์', color: '#c084fc', colorNum: 0xc084fc, glow: true },
  legendary: { name: 'ตำนาน',   color: '#ffd54a', colorNum: 0xffd54a, glow: true }
};