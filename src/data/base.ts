// src/data/base.ts — ตัวเลขและสีของ "ฐานนักล่า" (Phase 4)
// ฉากฐาน · ห้องแต่งตัว · ระบบภาพของฐาน อ่านค่าจากที่นี่ที่เดียว
// ทิศแสงยึด LIGHT ใน config (ซ้ายบน → เงาขวาล่าง)

export const BASE = {
  width: 1600,
  height: 1200,
  wall: 56,        // ความหนาขอบกระดาษรอบฐาน
  dust: 24,        // จำนวนฝุ่นกระดาษลอย
  emberMs: 260,    // ช่วงสะเก็ดไฟจากเตาตีเหล็ก (ms)
  titleMs: 2400    // เวลาโชว์ป้ายชื่อฐานตอนเดินเข้ามา
};

export const BASE_COLOR = {
  floorA: 0x3b3020,
  floorB: 0x33291b,
  wall: 0x241c12,
  wallEdge: 0x50402a,
  rug: 0x6d4a2c,
  rugInk: 0x2a1c10,
  paper: 0xe8e0c8,
  paperDim: 0xcfc4a6,
  ink: 0x2a2018,
  wood: 0x5a3a1e,
  woodLight: 0x8a5a2e,
  stone: 0x6f6a5c,
  steel: 0x4a4a52,
  lamp: 0xffb347,
  ember: 0xff7a2a,
  gold: 0xffd166,
  green: 0x7dff9b,
  blue: 0x9de7ff,
  violet: 0xc084fc,
  danger: 0xff5a3a
};

export type BaseSpotId = 'wardrobe' | 'forge' | 'chest' | 'gate' | 'desk' | 'dummy';

export interface BaseSpotDef {
  id: BaseSpotId;
  name: string;    // ชื่อจุดบนป้าย
  key: string;     // ปุ่มลัดที่โชว์คู่กัน
  color: number;
  dx: number;      // เยื้องจากกลางฐาน (แกน X)
  dy: number;      // เยื้องจากกลางฐาน (แกน Y)
  radius: number;  // ระยะที่กด E ได้
  devOnly?: boolean;
}

// วงเรืองแสง = จุดยืนใช้งาน · ของตกแต่งวางเยื้องไปทางเหนือของวงเสมอ
export const BASE_SPOTS: BaseSpotDef[] = [
  { id: 'wardrobe', name: 'ห้องแต่งตัว',       key: 'L',     color: BASE_COLOR.violet, dx: 0,    dy: -300, radius: 104 },
  { id: 'forge',    name: 'โรงตีเหล็ก',        key: 'F',     color: BASE_COLOR.gold,   dx: -430, dy: -210, radius: 104 },
  { id: 'chest',    name: 'หีบเก็บของ',        key: 'B',     color: BASE_COLOR.blue,   dx: 430,  dy: -210, radius: 104 },
  { id: 'gate',     name: 'ประตูสู่โลกกว้าง',  key: 'T',     color: BASE_COLOR.green,  dx: 430,  dy: 250,  radius: 110 },
  { id: 'desk',     name: 'โต๊ะบันทึก',        key: 'J',     color: BASE_COLOR.paper,  dx: -430, dy: 250,  radius: 104 },
  { id: 'dummy',    name: 'หุ่นซ้อม [ทดสอบ]',  key: 'ENTER', color: BASE_COLOR.danger, dx: 0,    dy: 340,  radius: 100, devOnly: true }
];