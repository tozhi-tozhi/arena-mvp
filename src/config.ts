// ค่าคงที่ของเกม — แก้ตัวเลขที่นี่ที่เดียว ทั้งเกมเปลี่ยนตาม

export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;
export const WALL_THICKNESS = 32;
export const SPRITE_SCALE = 2;

// ดาเมจที่ผู้เล่นฟัน 1 ครั้ง
export const PLAYER_ATTACK_DAMAGE = 1;

// ลำดับการวาด (เลขมาก = อยู่ด้านหน้า)
export const DEPTH = {
  FLOOR: 0,
  WALL: 1,
  TELEGRAPH: 2, // เครื่องหมายเตือนบนพื้น (วงแดง/แถบแดง)
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