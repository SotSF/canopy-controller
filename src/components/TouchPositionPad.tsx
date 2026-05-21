import { useRef, useState } from "react";
import { clientPointToPolar, isInsideCircle, Polar } from "../modules/polar";

type TouchPositionPadProps = {
  color: string;
  onPosition: (position: Polar) => void;
};

const getCircleGeometry = (element: HTMLDivElement) => {
  const rect = element.getBoundingClientRect();
  const radius = rect.width / 2;
  return {
    centerX: rect.left + radius,
    centerY: rect.top + radius,
    radius,
  };
};

export const TouchPositionPad = ({ color, onPosition }: TouchPositionPadProps) => {
  const padRef = useRef<HTMLDivElement>(null);
  const activePointerId = useRef<number | null>(null);
  const [indicator, setIndicator] = useState<{ x: number; y: number } | null>(
    null,
  );

  const updatePosition = (clientX: number, clientY: number) => {
    const pad = padRef.current;
    if (!pad) return;

    const { centerX, centerY, radius } = getCircleGeometry(pad);
    const position = clientPointToPolar(clientX, clientY, centerX, centerY, radius);
    onPosition(position);

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const distance = Math.hypot(dx, dy);
    const clampedDistance = Math.min(distance, radius);
    const angle = Math.atan2(dy, dx);
    setIndicator({
      x: 50 + (clampedDistance / radius) * 50 * Math.cos(angle),
      y: 50 + (clampedDistance / radius) * 50 * Math.sin(angle),
    });
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const pad = padRef.current;
    if (!pad) return;

    const { centerX, centerY, radius } = getCircleGeometry(pad);
    if (!isInsideCircle(event.clientX, event.clientY, centerX, centerY, radius)) {
      return;
    }

    activePointerId.current = event.pointerId;
    pad.setPointerCapture(event.pointerId);
    updatePosition(event.clientX, event.clientY);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== event.pointerId) return;
    updatePosition(event.clientX, event.clientY);
  };

  const onPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== event.pointerId) return;

    activePointerId.current = null;
    padRef.current?.releasePointerCapture(event.pointerId);
    setIndicator(null);
  };

  return (
    <div
      ref={padRef}
      className="touch-position-pad"
      style={{
        borderColor: color,
        boxShadow: `0 0 16px 0 ${color}`,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      aria-label="Touch position control"
    >
      {indicator && (
        <div
          className="touch-position-pad-indicator"
          style={{
            left: `${indicator.x}%`,
            top: `${indicator.y}%`,
            backgroundColor: color,
            boxShadow: `0 0 12px 2px ${color}`,
          }}
        />
      )}
    </div>
  );
};
