// src/systems/SaveGame.ts
import { huntSession } from './HuntSession';
import { loadout } from './Loadout';
import { upgrades } from './Upgrades'; // 🆕 import

const SAVE_KEY = 'arena_save_v3'; // เปลี่ยนเป็น v3

export function saveGame() {
  try {
    const data = {
      bag: huntSession.exportBag(),
      loadout: loadout.export(),
      upgrades: upgrades.export() // 🆕 เพิ่มการเซฟเลเวล
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) {}
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY) || localStorage.getItem('arena_save_v2'); // ดึง v2 เก่ามาด้วย
    if (!raw) return;
    const data = JSON.parse(raw);
    huntSession.importBag(data.bag || []);
    loadout.import(data.loadout || {});
    upgrades.import(data.upgrades || {}); // 🆕 โหลดเลเวล
  } catch (e) {}
}

export function resetSave() {
  huntSession.clear();
  loadout.reset();
  upgrades.reset(); // 🆕 รีเซ็ตเลเวล
  try {
    localStorage.removeItem('arena_save_v3');
    localStorage.removeItem('arena_save_v2');
  } catch (e) {}
}