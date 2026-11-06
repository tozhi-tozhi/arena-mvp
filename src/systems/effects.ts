// เอฟเฟกต์ภาพทั้งหมด — แต่ละฟังก์ชันรับ scene เข้ามา แล้ววาดเอฟเฟกต์ลงไป
import Phaser from 'phaser';
import { DEPTH, GAME_WIDTH, GAME_HEIGHT } from '../config';

// ตัวเลขดาเมจลอยขึ้นแล้วจาง
export function showDamage(scene: Phaser.Scene, x: number, y: number, text: string, color: string, durationMs: number = 600) {
  const label = scene.add.text(x, y - 20, text, {
    fontFamily: 'monospace',
    fontSize: '22px',
    fontStyle: 'bold',
    color: color,
    stroke: '#000000',
    strokeThickness: 4
  });
  label.setOrigin(0.5);
  label.setDepth(DEPTH.DAMAGE_POPUP);
  scene.tweens.add({
    targets: label,
    y: y - 55,
    alpha: 0,
    duration: durationMs,
    onComplete: () => label.destroy()
  });
}

// เศษสี่เหลี่ยมเล็ก ๆ กระจายออกจากจุดหนึ่ง (ใช้ตอนโดนตี / ตาย)
export function burst(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
  count: number,
  dist: number,
  size: number
) {
  for (let i = 0; i < count; i++) {
    const p = scene.add.rectangle(x, y, size, size, color);
    p.setDepth(DEPTH.BURST);
    const ang = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const d = Phaser.Math.FloatBetween(dist * 0.5, dist);
    scene.tweens.add({
      targets: p,
      x: x + Math.cos(ang) * d,
      y: y + Math.sin(ang) * d,
      alpha: 0,
      duration: Phaser.Math.Between(250, 450),
      onComplete: () => p.destroy()
    });
  }
}

// เส้นฟันสีขาวโค้ง ขยายแล้วจางหาย
export function spawnSlash(scene: Phaser.Scene, x: number, y: number, facingLeft: boolean) {
  const g = scene.add.graphics();
  g.setPosition(x, y);
  g.setDepth(DEPTH.SLASH);
  g.lineStyle(5, 0xffffff, 1);
  g.beginPath();
  const a0 = facingLeft ? 120 : -60;
  const a1 = facingLeft ? 240 : 60;
  g.arc(0, 0, 40, Phaser.Math.DegToRad(a0), Phaser.Math.DegToRad(a1), false);
  g.strokePath();
  scene.tweens.add({
    targets: g,
    alpha: 0,
    scaleX: 1.4,
    scaleY: 1.4,
    duration: 180,
    onComplete: () => g.destroy()
  });
}


// เส้นแทงพุ่งตรงสำหรับอาวุธประเภทหอก
export function spawnThrust(
  scene: Phaser.Scene,
  x: number,
  y: number,
  facingLeft: boolean,
  length: number
) {
  const direction = facingLeft ? -1 : 1;
  const g = scene.add.graphics();
  g.setPosition(x, y);
  g.setDepth(DEPTH.SLASH);

  // ก้านหอก/เส้นแรงปะทะ
  g.lineStyle(5, 0xf4f8ff, 0.95);
  g.beginPath();
  g.moveTo(direction * 8, 0);
  g.lineTo(direction * length, 0);
  g.strokePath();

  // ปลายแหลม
  g.fillStyle(0x9de7ff, 1);
  g.beginPath();
  g.moveTo(direction * length, 0);
  g.lineTo(direction * (length - 14), -7);
  g.lineTo(direction * (length - 14), 7);
  g.closePath();
  g.fillPath();

  scene.tweens.add({
    targets: g,
    alpha: 0,
    x: x + direction * 8,
    duration: 140,
    onComplete: () => g.destroy()
  });
}

// ภาพซ้อนสีฟ้าตามหลังตอน dash
export function spawnAfterimage(scene: Phaser.Scene, sprite: any) {
  const ghost = scene.add.image(sprite.x, sprite.y, 'hero');
  ghost.setScale(sprite.scaleX);
  ghost.setFlipX(sprite.flipX);
  ghost.setTint(0x66ccff);
  ghost.setAlpha(0.5);
  ghost.setDepth(DEPTH.AFTERIMAGE);
  scene.tweens.add({
    targets: ghost,
    alpha: 0,
    duration: 250,
    onComplete: () => ghost.destroy()
  });
}

// เงามืดขอบจอ
export function makeVignette(scene: Phaser.Scene) {
  const w = GAME_WIDTH;
  const h = GAME_HEIGHT;
  // ตอนกด R เริ่มใหม่ texture นี้มีอยู่แล้ว ไม่ต้องสร้างซ้ำ
  if (!scene.textures.exists('vignette')) {
    const tex = scene.textures.createCanvas('vignette', w, h) as any;
    const ctx = tex.getContext();
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.85);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    tex.refresh();
  }
  scene.add.image(0, 0, 'vignette').setOrigin(0).setDepth(DEPTH.VIGNETTE).setScrollFactor(0);
}

// วงแหวนขยายออกแล้วจางหาย (ใช้ตอนบอสกระแทกพื้น / เปลี่ยนเฟส)
export function ringEffect(
  scene: Phaser.Scene,
  x: number,
  y: number,
  radius: number,
  color: number,
  duration: number
) {
  const ring: any = scene.add.circle(x, y, radius);
  ring.setStrokeStyle(4, color);
  ring.setDepth(DEPTH.BURST);
  ring.setScale(0.2);
  scene.tweens.add({
    targets: ring,
    scale: 1,
    alpha: 0,
    duration: duration,
    onComplete: () => ring.destroy()
  });
}
// เส้นแทงหอก หมุนไปตามทิศใดก็ได้ — level สูงขึ้น = หอกหนาขึ้น/สีเปลี่ยน
export function spawnThrustDir(
  scene: Phaser.Scene,
  x: number,
  y: number,
  dx: number,
  dy: number,
  length: number,
  level: number = 1
) {
  const g = scene.add.graphics();
  g.setPosition(x, y);
  g.setDepth(DEPTH.SLASH);
  g.setRotation(Math.atan2(dy, dx));

  // เลเวลกำหนดความหนา + สี (Lv.1 = ขาว, Lv.2 = ฟ้า, Lv.3 = ทอง)
  const thickness = 4 + level * 1.5;
  const color = level >= 3 ? 0xffd54a : level >= 2 ? 0x9de7ff : 0xf4f8ff;

  // ก้านหอก
  g.lineStyle(thickness, color, 0.95);
  g.beginPath();
  g.moveTo(8, 0);
  g.lineTo(length, 0);
  g.strokePath();

  // ปลายแหลม (ใหญ่ขึ้นตามเลเวล)
  g.fillStyle(color, 1);
  g.beginPath();
  g.moveTo(length, 0);
  g.lineTo(length - 14 - level * 2, -7 - level);
  g.lineTo(length - 14 - level * 2, 7 + level);
  g.closePath();
  g.fillPath();

  // Lv.3+: เพิ่มเส้นเรืองรอง (glow) รอบก้าน
  if (level >= 3) {
    g.lineStyle(11, color, 0.2);
    g.beginPath();
    g.moveTo(8, 0);
    g.lineTo(length, 0);
    g.strokePath();
  }

  scene.tweens.add({
    targets: g,
    alpha: 0,
    x: x + dx * 8,
    y: y + dy * 8,
    duration: 140,
    onComplete: () => g.destroy()
  });
}