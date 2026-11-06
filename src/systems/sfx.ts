// เสียงสังเคราะห์ด้วย Web Audio — ไม่ต้องมีไฟล์เสียง
let ctx: AudioContext | null = null;
let muted = false;
try {
  muted = localStorage.getItem('arena_muted') === '1';
} catch (e) {}

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

// เสียงโทน: ไล่ความถี่จาก freq ไป endFreq
function tone(freq: number, endFreq: number, durMs: number, type: OscillatorType, vol: number, delayMs = 0) {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime + delayMs / 1000;
  const t1 = t0 + durMs / 1000;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t1);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t1);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t0);
  osc.stop(t1 + 0.02);
}

// เสียงซ่า (ใช้ทำเสียงปะทะ/ลม)
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
  gain.connect(c.destination);
  src.start(c.currentTime + delayMs / 1000);
}

export const sfx = {
  swing: () => { tone(620, 200, 110, 'triangle', 0.12); noise(80, 0.06); },
  hit: () => { tone(220, 60, 120, 'square', 0.16); noise(70, 0.18); },
  hurt: () => { tone(180, 50, 260, 'sawtooth', 0.18); noise(120, 0.22); },
  dash: () => { tone(300, 900, 130, 'sine', 0.1); noise(110, 0.07); },
  open: () => { tone(300, 600, 150, 'triangle', 0.12); tone(600, 900, 120, 'triangle', 0.1, 100); },
  pickup: () => { tone(660, 660, 80, 'square', 0.09); tone(990, 990, 130, 'square', 0.09, 70); },
  warn: () => { tone(440, 440, 80, 'square', 0.06); tone(440, 440, 80, 'square', 0.06, 130); },
  bossDie: () => { tone(220, 40, 700, 'sawtooth', 0.22); noise(500, 0.28); },

  // สลับเปิด/ปิดเสียง (จำค่าไว้ข้ามการรีเฟรช) — คืนค่า true ถ้าตอนนี้ปิดเสียง
  toggleMute: (): boolean => {
    muted = !muted;
    try {
      localStorage.setItem('arena_muted', muted ? '1' : '0');
    } catch (e) {}
    return muted;
  }
};