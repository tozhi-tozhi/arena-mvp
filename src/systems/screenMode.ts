// src/systems/screenMode.ts — เต็มจอ + ล็อกแนวนอน สำหรับมือถือ
// ใช้ DOM API ตรง ๆ ไม่พึ่ง Phaser ScaleManager — โหมด FIT จะคำนวณขนาดใหม่เองเมื่อจอเปลี่ยน
// เบราว์เซอร์ที่ไม่สนับสนุนเต็มจอ (เช่น iPhone Safari) → ปุ่มซ่อนตัวเอง เกมเล่นต่อได้ปกติ

/** เข้าเต็มจอได้ไหม (ต้องเช็กทั้งชื่อมาตรฐานและชื่อเก่าของ WebKit) */
export function canFullscreen(): boolean {
  const el: any = document.documentElement;
  return typeof el.requestFullscreen === 'function' || typeof el.webkitRequestFullscreen === 'function';
}

export function isFullscreen(): boolean {
  const d: any = document;
  return !!(d.fullscreenElement || d.webkitFullscreenElement);
}

/** ล็อกเป็นแนวนอน — ได้เฉพาะบางเบราว์เซอร์และต้องเต็มจอก่อน · ล้มเหลวก็ปล่อยผ่าน */
function lockLandscape(): void {
  const o: any = window.screen ? (window.screen as any).orientation : null;
  if (!o || typeof o.lock !== 'function') return;
  try {
    const p = o.lock('landscape');
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch (e) {
    // เบราว์เซอร์ปฏิเสธการล็อก — ผู้เล่นหมุนจอเองได้
  }
}

/** ขอเข้า/ออกเต็มจอ — ต้องเรียกจากการแตะหรือคลิกของผู้เล่นเท่านั้น เบราว์เซอร์ถึงจะยอม */
export function toggleFullscreen(): void {
  const el: any = document.documentElement;
  const d: any = document;
  try {
    if (isFullscreen()) {
      if (typeof d.exitFullscreen === 'function') d.exitFullscreen();
      else if (typeof d.webkitExitFullscreen === 'function') d.webkitExitFullscreen();
      return;
    }
    if (typeof el.requestFullscreen === 'function') {
      const p = el.requestFullscreen({ navigationUI: 'hide' });
      if (p && typeof p.then === 'function') p.then(lockLandscape).catch(() => {});
    } else if (typeof el.webkitRequestFullscreen === 'function') {
      el.webkitRequestFullscreen();
      lockLandscape();
    }
  } catch (e) {
    // ถูกปฏิเสธหรือไม่รองรับ — เล่นต่อในหน้าต่างปกติ
  }
}