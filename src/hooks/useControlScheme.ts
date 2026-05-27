import { useCallback, useState } from "react";
import {
  ControlScheme,
  loadControlScheme,
  saveControlScheme,
} from "../modules/controlScheme";

export const useControlScheme = () => {
  const [scheme, setScheme] = useState<ControlScheme>(loadControlScheme);

  const selectScheme = useCallback((next: ControlScheme) => {
    setScheme(next);
    saveControlScheme(next);
  }, []);

  return { scheme, selectScheme };
};
