export type ControlScheme = "colorPicker" | "globalPosition" | "joysticks";

const STORAGE_KEY = "canopy-control-scheme";

export const defaultControlScheme: ControlScheme = "globalPosition";

export const loadControlScheme = (): ControlScheme => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "colorPicker" || raw === "globalPosition" || raw === "joysticks") {
      return raw;
    }
  } catch {
    /* ignore */
  }
  return defaultControlScheme;
};

export const saveControlScheme = (scheme: ControlScheme) => {
  localStorage.setItem(STORAGE_KEY, scheme);
};

export const controlSchemeLabels: Record<ControlScheme, string> = {
  colorPicker: "Color picker",
  globalPosition: "Global position",
  joysticks: "Joysticks",
};
