// เซฟ/โหลดความคืบหน้า (กระเป๋า + เลเวลอุปกรณ์) ลง localStorage
import { huntSession } from './HuntSession';
import { playerEquipment } from './EquipmentSystem';

const SAVE_KEY = 'arena_save_v1';

export function saveGame() {
  try {
    const data = {
      bag: huntSession.exportBag(),
      levels: playerEquipment.exportLevels()
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
    playerEquipment.importLevels(data.levels || {});
  } catch (e) {}
}

export function resetSave() {
  huntSession.clear();
  playerEquipment.reset();
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) {}
}