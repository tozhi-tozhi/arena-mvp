// ค่าคงที่ของเกม — แก้ตัวเลขที่นี่ที่เดียว ทั้งเกมเปลี่ยนตาม

// ทิศทางแสงกลางของภาพกระดาษ: แสงเข้าซ้ายบน เงาทอดไปขวาล่าง
export const LIGHT = {
  DIR_X: 1,
  DIR_Y: 1,
  OFFSET_X: 6,
  OFFSET_Y: 4
};

// =====================================================
// พื้นที่ออกแบบ กับ ความละเอียดวาด — แยกกันคนละหน้าที่
// GAME_WIDTH/HEIGHT = พื้นที่ตรรกะที่ UI และกล้องยึด (คงที่ทุกอุปกรณ์)
// CANVAS_W/H        = จำนวนพิกเซลที่วาดจริง (ยิ่งมากยิ่งคม)
// VIEW_SCALE        = ตัวคูณซูมของทุกกล้อง เพื่อชดเชยแคนวาสที่ใหญ่กว่า
// ผล: ทุกเครื่องเห็นสนาม 1200x600 เท่ากัน แต่จอใหญ่/มือถือวาดละเอียดกว่า
// =====================================================
export const GAME_WIDTH = 1200;
export const GAME_HEIGHT = 600;

/** อ่านขนาดจอจริงเพื่อตั้งความละเอียดวาด — รันครั้งเดียวตอนโหลดโมดูล */
function canvasSize(): { w: number; h: number } {
  if (typeof window === 'undefined') return { w: GAME_WIDTH, h: GAME_HEIGHT };
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  // ยึดความสูงจอ ไม่เกิน 1080 กันภาระเครื่อง · แล้วคงสัดส่วน 2:1 ของพื้นที่ออกแบบ
  const h = Math.max(GAME_HEIGHT, Math.min(Math.round(window.innerHeight * dpr), 1080));
  return { w: h * 2, h };
}

const cv = canvasSize();
export const CANVAS_W = cv.w;
export const CANVAS_H = cv.h;
export const VIEW_SCALE = CANVAS_W / GAME_WIDTH;

// กรอบเมนูที่ออกแบบไว้กว้าง 800 — จัดกลางในพื้นที่ออกแบบเสมอ
export const MENU_W = 800;
export const MENU_OX = (GAME_WIDTH - MENU_W) / 2;

// ขนาดโลกเกม — สนามใหญ่กว่าหน้าจอหลายเท่าในแต่ละแกน
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