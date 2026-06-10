import { normalizeRadians } from "./polar";

const STORAGE_KEY = "canopy-pad-rotation";

export const loadPadRotation = (): number => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return 0;
    const rotation = Number(raw);
    if (!Number.isFinite(rotation)) return 0;
    return normalizeRadians(rotation);
  } catch {
    return 0;
  }
};

export const savePadRotation = (rotation: number) => {
  localStorage.setItem(STORAGE_KEY, String(normalizeRadians(rotation)));
};
