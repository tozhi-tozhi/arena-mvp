// เซฟ/โหลดความคืบหน้า (กระเป๋า + ชุดที่เลือก) ลง localStorage
import { huntSession } from './HuntSession';
import { loadout } from './Loadout';

const SAVE_KEY = 'arena_save_v2';

export function saveGame() {
  try {
    const data = {
      bag: huntSession.exportBag(),
      loadout: loadout.export()
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) {}
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    huntSession.importBag(data.bag || []);
    loadout.import(data.loadout || {});
  } catch (e) {}
}

export function resetSave() {
  huntSession.clear();
  loadout.reset();
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) {}
}