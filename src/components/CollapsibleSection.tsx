import { ReactNode } from "react";

type CollapsibleSectionProps = {
  visible: boolean;
  onToggle: () => void;
  label: string;
  children?: ReactNode;
  className?: string;
};

export const CollapsibleSection = ({
  visible,
  onToggle,
  label,
  children,
  className,
}: CollapsibleSectionProps) => (
  <div
    className={`ui-section ${visible ? "" : "ui-section--hidden"} ${className ?? ""}`}
  >
    <button
      type="button"
      className="ui-section-toggle"
      onClick={onToggle}
      aria-label={visible ? `Hide ${label}` : `Show ${label}`}
      aria-expanded={visible}
      title={visible ? `Hide ${label}` : `Show ${label}`}
    >
      <span className="ui-section-chevron" aria-hidden />
    </button>
    {visible && children}
  </div>
);
