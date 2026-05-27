import Wheel from "@uiw/react-color-wheel";

type HSVA = { h: number; s: number; v: number; a: number };

type ColorPickerPanelProps = {
  hsva: HSVA;
  colorScale: string[];
  selection: number | "custom";
  customColor: string;
  onHsvaChange: (newColor: { hex: string; hsva: HSVA }) => void;
  onPresetSelect: (value: string, index: number) => void;
  onCustomSelect: () => void;
};

export const ColorPickerPanel = ({
  hsva,
  colorScale,
  selection,
  customColor,
  onHsvaChange,
  onPresetSelect,
  onCustomSelect,
}: ColorPickerPanelProps) => (
  <div className="color-picker-panel">
    <Wheel width={175} height={175} color={hsva} onChange={onHsvaChange} />
    <div className="color-container">
      {colorScale.map((value, index) => (
        <div
          key={index}
          className={`color ${selection === index ? "selected" : ""}`}
          tabIndex={0}
          style={{
            backgroundColor: value,
            boxShadow: `0 0 15px 2px ${value}`,
          }}
          onTouchStart={() => onPresetSelect(value, index)}
          onClick={() =>
            !("ontouchstart" in document.documentElement) &&
            onPresetSelect(value, index)
          }
        />
      ))}
      <div
        className={`color ${selection === "custom" ? "selected" : ""}`}
        tabIndex={0}
        style={{
          backgroundColor: customColor,
          boxShadow: `0 0 15px 2px ${customColor}`,
        }}
        onTouchStart={onCustomSelect}
        onClick={() =>
          !("ontouchstart" in document.documentElement) && onCustomSelect()
        }
      />
    </div>
  </div>
);
