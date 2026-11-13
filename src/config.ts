// ค่าคงที่ของเกม — แก้ตัวเลขที่นี่ที่เดียว ทั้งเกมเปลี่ยนตาม

// ขนาดหน้าจอ (Viewport) — คงเดิมเพื่อไม่ให้ HUD และ UI เปลี่ยนสัดส่วน
export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;

// ขนาดโลกเกม — สนามใหญ่กว่าหน้าจอ 4 เท่าในแต่ละแกน
export const WORLD_WIDTH = 3200;
export const WORLD_HEIGHT = 2400;
export const WALL_THICKNESS = 32;
export const SPRITE_SCALE = 2;

// ดาเมจที่ผู้เล่นฟัน 1 ครั้ง
export const PLAYER_ATTACK_DAMAGE = 1;

// ลำดับการวาด (เลขมาก = อยู่ด้านหน้า)
export const DEPTH = {
  FLOOR: 0,
  WALL: 1,
  TELEGRAPH: 2,
  ENEMY_SHADOW: 3,
  PLAYER_SHADOW: 4,
  ENEMY: 5,
  AFTERIMAGE: 9,
  PLAYER: 10,
  SLASH: 15,
  ENEMY_HP_BAR: 20,
  BURST: 25,
  DAMAGE_POPUP: 30,
  VIGNETTE: 100,
  HUD: 110,
  OVERLAY: 120,
  OVERLAY_TEXT: 121
} as const;
// ปรับความรู้สึกการควบคุม
export const DASH_COOLDOWN_MS = 700;   // พัก dash กี่ ms
export const AIM_ASSIST_RANGE = 190;   // บอสอยู่ใกล้กว่านี้ ถึงจะช่วยเล็ง
export const AIM_ASSIST_ANGLE = 75;    // กรวยช่วยเล็ง (องศา จากทิศที่หันอยู่)

// เครื่องมือช่วยทดสอบ (หน้า Base: F2 แจกของ, F9 ล้างเซฟ) — ปิดก่อนปล่อยเกมจริง
export const DEV_TOOLS = true;