// เอฟเฟกต์ภาพทั้งหมด — แต่ละฟังก์ชันรับ scene เข้ามา แล้ววาดเอฟเฟกต์ลงไป
import Phaser from 'phaser';
import { DEPTH, GAME_WIDTH, GAME_HEIGHT, LIGHT } from '../config';
import { RARITY, type Rarity } from '../data/rarity';

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

  g.lineStyle(5, 0xf4f8ff, 0.95);
  g.beginPath();
  g.moveTo(direction * 8, 0);
  g.lineTo(direction * length, 0);
  g.strokePath();

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
  // ใช้ texture เดียวกับ sprite จริง — ผู้เล่นอัคนี/ลูมิจะได้ afterimage ของตัวเอง ไม่ใช่ 'hero'
  const ghost = scene.add.image(sprite.x, sprite.y, sprite.texture.key);
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
  if (!scene.textures.exists('vignette')) {
    const tex = scene.textures.createCanvas('vignette', w, h) as any;
    const ctx = tex.getContext();
    // วงรีตามสัดส่วนจอ — ขยายจากสัดส่วนเดิม 4:3 กันขอบซ้ายขวามืดเกินเมื่อจอกว้างขึ้น
    const sx = w / h / (4 / 3);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(sx, 1);
    const g = ctx.createRadialGradient(0, 0, h * 0.35, 0, 0, h * 0.85);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = g;
    ctx.fillRect(-w / 2 / sx, -h / 2, w / sx, h);
    ctx.restore();
    tex.refresh();
  }
  scene.add.image(0, 0, 'vignette').setOrigin(0).setDepth(DEPTH.VIGNETTE).setScrollFactor(0);
}

// --- ระบบเงารวมศูนย์ (Paper Cutout P3a) ---
export function makeShadow(
  scene: Phaser.Scene,
  width: number,
  height: number,
  depth: number = DEPTH.ENEMY_SHADOW,
  alpha: number = 0.35
): Phaser.GameObjects.Ellipse {
  return scene.add.ellipse(0, 0, width, height, 0x000000, alpha).setDepth(depth);
}

export function syncShadow(
  shadow: Phaser.GameObjects.Ellipse,
  sprite: any,
  groundOffsetY: number = 0,
  isFake: boolean = false,
  customOffsetY: number | null = null
) {
  if (!shadow || !shadow.active) return;
  // กลับทิศทางถ้าเป็นเงาปลอม (ร่างลวงของมายา)
  const dirX = isFake ? -LIGHT.DIR_X : LIGHT.DIR_X;
  const dirY = isFake ? -LIGHT.DIR_Y : LIGHT.DIR_Y;

  const baseY = customOffsetY !== null ? sprite.y + customOffsetY : sprite.y + sprite.displayHeight / 2 - 4;

  shadow.setPosition(
    sprite.x + LIGHT.OFFSET_X * dirX,
    baseY + groundOffsetY + LIGHT.OFFSET_Y * dirY
  );
}

// --- ระบบแสงอำพันกลาง (P3b) ---
export function makeGlow(
  scene: Phaser.Scene, 
  x: number, 
  y: number, 
  radius: number, 
  color: number,
  pulse: boolean = true
): Phaser.GameObjects.Container {
  // สร้างวงกลมโปร่งแสงซ้อนกัน 2 ชั้นเพื่อให้ดูเป็น Glow นุ่มๆ
  const outer = scene.add.circle(0, 0, radius, color, 0.15);
  const inner = scene.add.circle(0, 0, radius * 0.6, color, 0.25);
  
  // ใช้ Blend Mode ADD เพื่อให้แสงสว่างซ้อนทับฉากหลัง
  outer.setBlendMode(Phaser.BlendModes.ADD);
  inner.setBlendMode(Phaser.BlendModes.ADD);
  
  // รวมร่างเป็น Container เพื่อให้ขยับ/ลบทีเดียว
  const container = scene.add.container(x, y, [outer, inner]);
  container.setDepth(DEPTH.TELEGRAPH - 1); // อยู่ใต้ Telegraph แต่เหนือพื้น

  if (pulse) {
    scene.tweens.add({
      targets: container,
      scale: 1.1,
      alpha: 0.6,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }
  return container;
}

export function destroyGlow(glow: Phaser.GameObjects.Container | any) {
  if (!glow) return;
  if (glow.active) {
    glow.destroy();
  }
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

  const thickness = 4 + level * 1.5;
  const color = level >= 3 ? 0xffd54a : level >= 2 ? 0x9de7ff : 0xf4f8ff;

  g.lineStyle(thickness, color, 0.95);
  g.beginPath();
  g.moveTo(8, 0);
  g.lineTo(length, 0);
  g.strokePath();

  g.fillStyle(color, 1);
  g.beginPath();
  g.moveTo(length, 0);
  g.lineTo(length - 14 - level * 2, -7 - level);
  g.lineTo(length - 14 - level * 2, 7 + level);
  g.closePath();
  g.fillPath();

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

// แบนเนอร์ประกาศ rarity (epic ขึ้นไปเท่านั้น — common/rare ไม่ต้องเด้ง)
export function showRarityBanner(
  scene: Phaser.Scene,
  x: number,
  y: number,
  rarity: Rarity,
  itemName: string
) {
  const rd = RARITY[rarity];
  if (!rd.glow) return; // เฉพาะ epic/legendary

  const isLegendary = rarity === 'legendary';
  const title = isLegendary ? `★ ${rd.name} ★` : `✦ ${rd.name}`;

  const bg = scene.add.rectangle(x, y, 240, 44, 0x000000, 0.78);
  bg.setStrokeStyle(3, rd.colorNum);
  bg.setDepth(DEPTH.DAMAGE_POPUP);
  bg.setScale(0.5);
  bg.setAlpha(0.5);

  const label = scene.add.text(x, y - 6, title, {
    fontFamily: '"Noto Sans Thai", monospace',
    fontSize: '20px',
    fontStyle: 'bold',
    color: rd.color,
    stroke: '#000000',
    strokeThickness: 4
  }).setOrigin(0.5).setDepth(DEPTH.DAMAGE_POPUP + 1).setAlpha(0);

  // แสดงชื่อไอเทม (ไม่มีตัวเลขแล้ว)
  const itemLabel = scene.add.text(x, y + 18, itemName, {
    fontFamily: '"Noto Sans Thai", monospace',
    fontSize: '14px',
    color: '#ffffff',
    stroke: '#000000',
    strokeThickness: 3
  }).setOrigin(0.5).setDepth(DEPTH.DAMAGE_POPUP + 1).setAlpha(0);

  scene.tweens.add({
    targets: bg,
    scaleX: 1, scaleY: 1, alpha: 1,
    duration: 250,
    ease: 'Back.easeOut'
  });
  scene.tweens.add({
    targets: [label, itemLabel],
    alpha: 1,
    duration: 200,
    delay: 100
  });

  if (isLegendary) {
    burst(scene, x, y - 10, rd.colorNum, 14, 70, 4);
    scene.cameras.main.flash(120, 255, 230, 150);
  }

  scene.time.delayedCall(1400, () => {
    scene.tweens.add({
      targets: [bg, label, itemLabel],
      y: y - 40,
      alpha: 0,
      duration: 500,
      onComplete: () => {
        bg.destroy();
        label.destroy();
        itemLabel.destroy();
      }
    });
  });
}