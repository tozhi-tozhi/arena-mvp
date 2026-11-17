// src/data/minimap.ts — ตัวเลขและสีของแผนที่กระดาษ (3F: หมอกสำรวจ + ร่องรอยรัง)
// แผนที่วาดจากสีแผ่นพื้นจริงใน data/world.ts — ไม่ใช่สีสมมติ
export const MINIMAP = {
  left: 14,            // ชิดซ้ายจอ
  bottom: 560,         // ขอบล่างแผง (เหนือแถบเลือดบอสที่ y 577)
  widthFull: 184,
  widthSmall: 128,
  pad: 8,
  headerFull: 22,
  headerSmall: 16,
  noteRow: 14,         // แถวข้อความ "พบอะไรใหม่" (โหมดเต็มเท่านั้น)
  legendRow: 16,
  mapMinH: 60,
  mapMaxH: 176,

  fogCols: 26,         // ช่องหมอกแนวนอน
  fogRows: 20,
  revealRadius: 620,   // รัศมีเปิดหมอก (px ในโลก)
  visibleRatio: 0.92,  // ในรัศมีนี้ = สว่างเต็มที่ นอกนั้นแต่เคยเดิน = หรี่
  fogAlpha: 0.93,      // ยังไม่เคยเดิน = ทึบ
  dimAlpha: 0.42,      // เคยเดินแต่ไม่ได้อยู่แถวนี้ = หรี่

  redrawMs: 66,        // วาดหมอก/ร่องรอย/เครื่องหมายถี่แค่ไหน (ลูกศรผู้เล่นวาดทุกเฟรม)
  trailEveryMs: 240,
  trailMinDist: 55,    // เดินห่างจากจุดล่าสุดเท่านี้ถึงโปรยร่องรอยใหม่
  trailMax: 300,
  noteMs: 2200,

  colors: {
    panel: 0x14100a,
    border: 0xffd166,
    hairline: 0x4a4130,
    fog: 0x0b0906,
    paper: 0xe8e0c8,
    home: 0x7dff9b,
    next: 0xffd166,
    locked: 0x8d8677,
    heal: 0x7dff9b,
    lair: 0xff5a3a,
    loot: 0x9de7ff,
    site: 0xe8e0c8,
    cache: 0xffd166,
    player: 0xffffff,
    trail: 0xffd166
  }
};