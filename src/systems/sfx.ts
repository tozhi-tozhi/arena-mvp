// src/systems/sfx.ts — เสียงสังเคราะห์ด้วย Web Audio (ไม่ต้องมีไฟล์เสียง)
// Phase 3G · P1: บัสรวม+คอมเพรสเซอร์ · เสียงเท้าตามชนิดพื้น · ลมกระดาษพื้นหลัง · หัวใจเต้นตอนเลือดต่ำ ·
//                สติงเกอร์บอสตื่น + เสียงตึงเครียดตอนสู้ · เสียงจังหวะสำคัญ (เควส/ประตู/เสาฟื้น/ผนึก/ตาย/กลับฐาน)
// ระดับเสียงปรับที่ค่าคงที่ด้านล่างที่เดียว

let ctx: AudioContext | null = null;
let bus: GainNode | null = null;
let muted = false;
try {
  muted = localStorage.getItem('arena_muted') === '1';
} catch (e) {}

// ---------- ระดับเสียง (ปรับที่นี่) ----------
const MASTER_VOL = 0.9;    // รวมทั้งหมด
const AMBIENT_VOL = 0.9;   // ลม/กระดาษพื้นหลัง
const STEP_VOL = 1;        // เสียงเท้า
const HEART_VOL = 1;       // หัวใจเต้น
const TENSION_VOL = 0.05;  // เสียงทุ้มตึงเครียดตอนสู้บอส

function getCtx(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx!.state === 'suspended') ctx!.resume(); // เบราว์เซอร์ต้องรอให้ผู้เล่นกดปุ่มก่อน
  return ctx;
}

// บัสรวม: master gain → คอมเพรสเซอร์ → ลำโพง (กันเสียงซ้อนกันแล้วแตก)
function getBus(c: AudioContext): GainNode {
  if (!bus) {
    bus = c.createGain();
    bus.gain.value = MASTER_VOL;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 18;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    bus.connect(comp);
    comp.connect(c.destination);
  }
  return bus;
}

// พับแท็บ = พักเสียง · กลับมา = เล่นต่อ
try {
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend();
    else if (!muted) ctx.resume();
  });
} catch (e) {}

// ---------- ตัวสร้างเสียงพื้นฐาน ----------
// เสียงโทน: ไล่ความถี่จาก freq ไป endFreq
function tone(freq: number, endFreq: number, durMs: number, type: OscillatorType, vol: number, delayMs = 0) {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime + delayMs / 1000;
  const t1 = t0 + durMs / 1000;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(1, freq), t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t1);
  gain.gain.setValueAtTime(Math.max(0.0011, vol), t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t1);
  osc.connect(gain);
  gain.connect(getBus(c));
  osc.start(t0);
  osc.stop(t1 + 0.02);
}

// เสียงซ่า (ปะทะ/ลม)
function noise(durMs: number, vol: number, delayMs = 0) {
  const c = getCtx();
  if (!c) return;
  const len = Math.floor((c.sampleRate * durMs) / 1000);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const gain = c.createGain();
  gain.gain.value = vol;
  src.connect(gain);
  gain.connect(getBus(c));
  src.start(c.currentTime + delayMs / 1000);
}

// เสียงซ่าผ่านฟิลเตอร์ (เสียงเท้า/กระดาษ/ลมวูบ) — endFreq = ไล่ความถี่ฟิลเตอร์ระหว่างเล่น
function fnoise(
  durMs: number, vol: number, type: BiquadFilterType, freq: number, q: number,
  delayMs = 0, endFreq?: number
) {
  const c = getCtx();
  if (!c) return;
  const len = Math.max(1, Math.floor((c.sampleRate * durMs) / 1000));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const k = 1 - i / len;
    d[i] = (Math.random() * 2 - 1) * k * k;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  const t0 = c.currentTime + delayMs / 1000;
  f.frequency.setValueAtTime(Math.max(20, freq), t0);
  if (endFreq) f.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + durMs / 1000);
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f);
  f.connect(g);
  g.connect(getBus(c));
  src.start(t0);
}

// ---------- บรรยากาศ: ลมกระดาษ ----------
interface Ambient {
  out: GainNode;
  tension: GainNode;
  nodes: AudioScheduledSourceNode[];
  timer: any;
}
let ambient: Ambient | null = null;
let ambientWanted = false;
let tensionOn = false;

// นอยส์สีชมพู (นุ่มกว่านอยส์ขาว) ตัดปลายให้ลูปต่อกันเนียน
function pinkBuffer(c: AudioContext, seconds: number): AudioBuffer {
  const fade = Math.floor(c.sampleRate * 0.25);
  const total = Math.floor(c.sampleRate * seconds) + fade;
  const raw = new Float32Array(total);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < total; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    raw[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  const len = total - fade;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const out = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    if (i < fade) {
      const t = i / fade;
      out[i] = raw[i] * t + raw[len + i] * (1 - t);
    } else out[i] = raw[i];
  }
  return buf;
}

function addLfo(c: AudioContext, hz: number, depth: number, target: AudioParam, nodes: AudioScheduledSourceNode[]) {
  const o = c.createOscillator();
  o.frequency.value = hz;
  const g = c.createGain();
  g.gain.value = depth;
  o.connect(g);
  g.connect(target);
  o.start();
  nodes.push(o);
}

function buildAmbient(c: AudioContext): Ambient {
  const nodes: AudioScheduledSourceNode[] = [];
  const out = c.createGain();
  out.gain.value = 0;
  out.connect(getBus(c));
  out.gain.linearRampToValueAtTime(AMBIENT_VOL, c.currentTime + 2.5); // เฟดเข้า

  const buf = pinkBuffer(c, 5);

  // ลมต่ำ — ดังเบาลงสลับช้า ๆ
  const w1 = c.createBufferSource();
  w1.buffer = buf;
  w1.loop = true;
  const f1 = c.createBiquadFilter();
  f1.type = 'lowpass';
  f1.frequency.value = 420;
  f1.Q.value = 0.6;
  const g1 = c.createGain();
  g1.gain.value = 0.1;
  w1.connect(f1);
  f1.connect(g1);
  g1.connect(out);
  w1.start();
  nodes.push(w1);
  addLfo(c, 0.09, 0.06, g1.gain, nodes);
  addLfo(c, 0.05, 160, f1.frequency, nodes);

  // อากาศกระดาษ — ฟู่บาง ๆ ย่านสูง
  const w2 = c.createBufferSource();
  w2.buffer = buf;
  w2.loop = true;
  const f2 = c.createBiquadFilter();
  f2.type = 'bandpass';
  f2.frequency.value = 2600;
  f2.Q.value = 0.7;
  const g2 = c.createGain();
  g2.gain.value = 0.035;
  w2.connect(f2);
  f2.connect(g2);
  g2.connect(out);
  w2.start(0, 1.7);
  nodes.push(w2);
  addLfo(c, 0.17, 0.025, g2.gain, nodes);

  // เสียงทุ้มตึงเครียด (ปิดไว้ก่อน เปิดตอนสู้บอส) — สองโทนเพี้ยนกันนิดให้เกิดจังหวะสั่น
  const tension = c.createGain();
  tension.gain.value = 0;
  tension.connect(out);
  for (const hz of [55, 58]) {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = hz;
    o.connect(tension);
    o.start();
    nodes.push(o);
  }

  return { out, tension, nodes, timer: null };
}

function rustle() {
  const f = 2600 + Math.random() * 1800;
  fnoise(380 + Math.random() * 320, 0.05, 'bandpass', f, 1.1, 0, f * 0.6);
  const n = 2 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) fnoise(12 + Math.random() * 18, 0.05, 'highpass', 3500, 0.7, Math.random() * 420);
}

function scheduleRustle(a: Ambient) {
  a.timer = setTimeout(() => {
    if (ambient !== a) return;
    rustle();
    scheduleRustle(a);
  }, 2500 + Math.random() * 6500);
}

function applyTension() {
  const a = ambient;
  if (!a || !ctx) return;
  try {
    const t = ctx.currentTime;
    a.tension.gain.cancelScheduledValues(t);
    a.tension.gain.setValueAtTime(a.tension.gain.value, t);
    a.tension.gain.linearRampToValueAtTime(tensionOn ? TENSION_VOL : 0, t + 1.2);
  } catch (e) {}
}

function killAmbient() {
  const a = ambient;
  if (!a) return;
  ambient = null;
  clearTimeout(a.timer);
  try {
    if (ctx) {
      const t = ctx.currentTime;
      a.out.gain.cancelScheduledValues(t);
      a.out.gain.setValueAtTime(a.out.gain.value, t);
      a.out.gain.linearRampToValueAtTime(0, t + 0.5); // เฟดออก
    }
  } catch (e) {}
  setTimeout(() => {
    for (const n of a.nodes) {
      try { n.stop(); } catch (e) {}
    }
    try { a.out.disconnect(); } catch (e) {}
  }, 650);
}

function startAmbient() {
  ambientWanted = true;
  if (muted || ambient) return;
  const c = getCtx();
  if (!c) return;
  ambient = buildAmbient(c);
  scheduleRustle(ambient);
  if (tensionOn) applyTension();
}

function stopAmbient() {
  ambientWanted = false;
  tensionOn = false;
  killAmbient();
}

// ---------- เสียงเท้า ----------
let stepFlip = false;
function step(kind: string = 'dirt') {
  stepFlip = !stepFlip;
  const v = STEP_VOL * (0.85 + Math.random() * 0.3);
  const j = 0.9 + Math.random() * 0.25 + (stepFlip ? 0.04 : 0);
  switch (kind) {
    case 'moss':
      fnoise(95, 0.05 * v, 'lowpass', 330 * j, 0.7);
      tone(80 * j, 50, 60, 'sine', 0.03 * v);
      break;
    case 'gravel':
      fnoise(65, 0.07 * v, 'bandpass', 1900 * j, 1.3);
      fnoise(35, 0.045 * v, 'highpass', 3200, 0.7, 18);
      break;
    case 'sand':
      fnoise(120, 0.045 * v, 'bandpass', 1100 * j, 0.5, 0, 700);
      break;
    case 'brush':
      fnoise(130, 0.06 * v, 'bandpass', 2700 * j, 0.8, 0, 1800);
      fnoise(40, 0.03 * v, 'highpass', 4000, 0.7, 25);
      break;
    default: // dirt
      fnoise(75, 0.06 * v, 'lowpass', 520 * j, 0.8);
      tone(95 * j, 55, 55, 'sine', 0.035 * v);
  }
}

// ---------- ชุดเสียงเดิม (ยังใช้ชื่อเดิม) ----------
const swing = () => { tone(620, 200, 110, 'triangle', 0.12); noise(80, 0.06); };
const hit = () => { tone(220, 60, 120, 'square', 0.16); noise(70, 0.18); };
const hurt = () => { tone(180, 50, 260, 'sawtooth', 0.18); noise(120, 0.22); };
const dash = () => { tone(300, 900, 130, 'sine', 0.1); noise(110, 0.07); };
const open = () => { tone(300, 600, 150, 'triangle', 0.12); tone(600, 900, 120, 'triangle', 0.1, 100); };
const pickup = () => { tone(660, 660, 80, 'square', 0.09); tone(990, 990, 130, 'square', 0.09, 70); };
const warn = () => { tone(440, 440, 80, 'square', 0.06); tone(440, 440, 80, 'square', 0.06, 130); };
const bossDie = () => { tone(220, 40, 700, 'sawtooth', 0.22); noise(500, 0.28); };

export const sfx = {
  swing, hit, hurt, dash, open, pickup, warn, bossDie,

  /** ปลุก AudioContext ตอนแตะจอครั้งแรก (มือถือ/iOS ต้องมีท่าทางผู้ใช้ก่อนถึงจะมีเสียง) */
  unlock: () => { getCtx(); },

  // ----- P1: ใหม่ -----
  step,
  startAmbient,
  stopAmbient,
  /** เปิด/ปิดเสียงทุ้มตึงเครียด (ตอนสู้บอส) */
  setTension: (on: boolean) => {
    tensionOn = on;
    applyTension();
  },

  /** หัวใจเต้นตอนเลือดต่ำ — intensity 0..1 */
  heartbeat: (intensity = 1) => {
    const I = Math.max(0.2, Math.min(1, intensity)) * HEART_VOL;
    tone(70, 38, 140, 'sine', 0.34 * I);
    fnoise(60, 0.06 * I, 'lowpass', 220, 0.8);
    tone(58, 34, 160, 'sine', 0.24 * I, 190);
  },

  /** สติงเกอร์บอสตื่น */
  bossWake: () => {
    tone(90, 58, 950, 'sawtooth', 0.16);
    tone(127, 84, 950, 'sawtooth', 0.09);
    tone(300, 900, 520, 'triangle', 0.05, 180);
    fnoise(520, 0.08, 'bandpass', 400, 0.9, 120, 2200);
    tone(60, 28, 520, 'sine', 0.3, 720);
    noise(320, 0.16, 720);
  },

  /** เก็บของ — ยิ่งหายากยิ่งหรู */
  pickupRarity: (rarity: string) => {
    pickup();
    switch (rarity) {
      case 'rare':
        tone(1320, 1320, 170, 'triangle', 0.06, 130);
        break;
      case 'epic':
        [880, 1100, 1320].forEach((f, i) => tone(f, f, 150, 'triangle', 0.07, 110 + i * 80));
        break;
      case 'legendary':
        [880, 1100, 1320, 1760].forEach((f, i) => tone(f, f, 170, 'triangle', 0.08, 110 + i * 75));
        tone(2640, 2640, 500, 'sine', 0.04, 400);
        fnoise(300, 0.05, 'highpass', 5000, 0.7, 380);
        break;
    }
  },

  /** เควสสำเร็จ — อาร์เพจจิโอสว่าง */
  questDone: () => {
    [523, 659, 784].forEach((f, i) => tone(f, f, 140, 'triangle', 0.1, i * 95));
    tone(1047, 1047, 480, 'sine', 0.1, 285);
    tone(1568, 1568, 380, 'sine', 0.04, 330);
  },

  /** ประตูไปต่อเปิด — หินครูด + ระฆังเบา (หน่วงหลังเสียงเควส) */
  gateUnlock: () => {
    tone(70, 45, 420, 'sawtooth', 0.08, 450);
    fnoise(420, 0.1, 'lowpass', 420, 1, 450);
    tone(880, 880, 320, 'sine', 0.07, 820);
  },

  /** เสาฟื้นเลือด */
  shrineStart: () => {
    tone(392, 523, 260, 'sine', 0.09);
    tone(523, 784, 300, 'sine', 0.07, 120);
  },
  shrineTick: () => {
    tone(784, 784, 140, 'sine', 0.06);
    tone(1175, 1175, 200, 'sine', 0.04, 60);
  },
  shrineBreak: () => {
    tone(330, 170, 220, 'triangle', 0.09);
    noise(90, 0.07);
  },

  /** ผนึก */
  sealBreak: () => {
    fnoise(140, 0.14, 'highpass', 1500, 0.8);
    tone(180, 60, 260, 'square', 0.1);
    [880, 1100, 1320].forEach((f, i) => tone(f, f, 200, 'triangle', 0.07, 130 + i * 90));
    tone(2200, 2200, 450, 'sine', 0.035, 420);
  },
  sealBackfire: () => {
    tone(150, 40, 380, 'sawtooth', 0.14);
    fnoise(260, 0.16, 'lowpass', 900, 0.9);
  },

  /** ตัวแทะกระดาษ */
  minionLunge: () => {
    fnoise(180, 0.07, 'bandpass', 800, 0.9, 0, 2200);
    tone(500, 200, 160, 'triangle', 0.045);
  },
  minionDie: () => {
    hit();
    for (let i = 0; i < 5; i++) fnoise(25 + Math.random() * 30, 0.08, 'highpass', 2500, 0.7, 20 + i * 35);
    tone(300, 120, 170, 'triangle', 0.06, 40);
  },

  /** ฉากเปลี่ยนแมพ/ตาย/กลับฐาน */
  whoosh: () => {
    fnoise(520, 0.12, 'bandpass', 300, 0.9, 0, 2400);
    tone(200, 500, 420, 'sine', 0.04);
  },
  death: () => {
    tone(330, 80, 900, 'sawtooth', 0.16, 200);
    tone(165, 40, 1200, 'sine', 0.2, 200);
    fnoise(420, 0.14, 'lowpass', 320, 0.9, 200);
  },
  homeward: () => {
    [392, 494, 587, 784].forEach((f, i) => tone(f, f, 200, 'triangle', 0.09, i * 120));
    tone(1175, 1175, 600, 'sine', 0.06, 480);
  },

  // สลับเปิด/ปิดเสียง (จำค่าไว้ข้ามการรีเฟรช) — คืนค่า true ถ้าตอนนี้ปิดเสียง
  toggleMute: (): boolean => {
    muted = !muted;
    try {
      localStorage.setItem('arena_muted', muted ? '1' : '0');
    } catch (e) {}
    if (muted) killAmbient();
    else if (ambientWanted) startAmbient();
    return muted;
  }
};