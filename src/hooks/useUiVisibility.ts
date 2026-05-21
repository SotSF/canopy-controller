import { useCallback, useState } from "react";
import {
  loadUiVisibility,
  saveUiVisibility,
  UiSection,
} from "../modules/uiVisibility";

export const useUiVisibility = () => {
  const [visibility, setVisibility] = useState(loadUiVisibility);

  const toggle = useCallback((section: UiSection) => {
    setVisibility((prev) => {
      const next = { ...prev, [section]: !prev[section] };
      saveUiVisibility(next);
      return next;
    });
  }, []);

  return { visibility, toggle };
};
