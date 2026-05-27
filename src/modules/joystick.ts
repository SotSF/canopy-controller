import { JoyStick } from "./joy";

interface Joy {
  GetX(): number;
  GetY(): number;
  Recolor(color: string): void;
}

export let joyL: Joy | undefined;
export let joyR: Joy | undefined;

const joystickContainerReady = (id: string) => {
  const element = document.getElementById(id);
  return element !== null && element.clientWidth > 0 && element.clientHeight > 0;
};

export const drawJoys = (color: string) => {
  if (!joystickContainerReady("joystickL") || !joystickContainerReady("joystickR")) {
    return;
  }

  document.getElementById("joystickLCanvas")?.remove();
  document.getElementById("joystickRCanvas")?.remove();

  const defaultOptions = {
    internalFillColor: color,
    internalStrokeColor: color,
    externalStrokeColor: color,
  };
  joyL = new JoyStick(
    "joystickL",
    {
      title: "joystickLCanvas",
      ...defaultOptions,
    },
    null!,
  );
  joyR = new JoyStick(
    "joystickR",
    {
      title: "joystickRCanvas",
      ...defaultOptions,
    },
    null!,
  );
};

export const recolorJoys = (color: string) => {
  joyL?.Recolor(color);
  joyR?.Recolor(color);
};
