export type UiSection =
  | "colorWheel"
  | "colorPresets"
  | "gyroToggle"
  | "calibration"
  | "touchPad"
  | "actionButtons"
  | "joysticks";

const STORAGE_KEY = "canopy-ui-visibility";

export const defaultUiVisibility: Record<UiSection, boolean> = {
  colorWheel: true,
  colorPresets: true,
  gyroToggle: true,
  calibration: true,
  touchPad: true,
  actionButtons: true,
  joysticks: true,
};

export const loadUiVisibility = (): Record<UiSection, boolean> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultUiVisibility };
    return { ...defaultUiVisibility, ...JSON.parse(raw) };
  } catch {
    return { ...defaultUiVisibility };
  }
};

export const saveUiVisibility = (visibility: Record<UiSection, boolean>) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(visibility));
};
