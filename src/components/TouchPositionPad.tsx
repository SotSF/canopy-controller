import { useEffect, useMemo, useRef, useState } from "react";
import { debounce } from "lodash";
import {
  clientPointToPolar,
  isInsideCircle,
  normalizeRadians,
  polarToPadPercent,
  Polar,
} from "../modules/polar";

type TouchPositionPadProps = {
  color: string;
  padRotation: number;
  shipPosition: Polar | null;
  onPosition: (position: Polar) => void;
  onRotationPreview: (rotation: number) => void;
  onRotationCommit: (rotation: number, delta: number) => void;
};

const ROTATION_SLIDER_MIN = -Math.PI;
const ROTATION_SLIDER_MAX = Math.PI;
const ROTATION_SLIDER_STEP = 0.01;
const ROTATION_COMMIT_MS = 150;

const getCircleGeometry = (element: HTMLDivElement) => {
  const rect = element.getBoundingClientRect();
  const radius = element.offsetWidth / 2;
  return {
    centerX: rect.left + rect.width / 2,
    centerY: rect.top + rect.height / 2,
    radius,
  };
};

const applyPadRotation = (element: HTMLDivElement | null, radians: number) => {
  if (!element) return;
  element.style.transform = `rotate(${radians}rad)`;
};

export const TouchPositionPad = ({
  color,
  padRotation,
  shipPosition,
  onPosition,
  onRotationPreview,
  onRotationCommit,
}: TouchPositionPadProps) => {
  const padRef = useRef<HTMLDivElement>(null);
  const rotatorRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLInputElement>(null);
  const rotationRef = useRef(padRotation);
  const committedRotationRef = useRef(padRotation);
  const activePointerId = useRef<number | null>(null);
  const [indicator, setIndicator] = useState<{ x: number; y: number } | null>(
    null,
  );

  const commitRotation = useMemo(
    () =>
      debounce((rotation: number) => {
        const delta = rotation - committedRotationRef.current;
        committedRotationRef.current = rotation;
        onRotationCommit(rotation, delta);
      }, ROTATION_COMMIT_MS),
    [onRotationCommit],
  );

  useEffect(() => () => commitRotation.cancel(), [commitRotation]);

  useEffect(() => {
    rotationRef.current = padRotation;
    committedRotationRef.current = padRotation;
    applyPadRotation(rotatorRef.current, padRotation);
    if (sliderRef.current) {
      const slider = sliderRef.current;
      slider.value = String(normalizeRadians(padRotation));
      slider.setCustomValidity("");
    }
  }, [padRotation]);

  const updatePosition = (clientX: number, clientY: number) => {
    const pad = padRef.current;
    if (!pad) return;

    const { centerX, centerY, radius } = getCircleGeometry(pad);
    const screen = clientPointToPolar(
      clientX,
      clientY,
      centerX,
      centerY,
      radius,
    );
    const position = {
      r: screen.r,
      theta: screen.theta - rotationRef.current,
    };
    onPosition(position);
    setIndicator(polarToPadPercent(position));
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const pad = padRef.current;
    if (!pad) return;

    const { centerX, centerY, radius } = getCircleGeometry(pad);
    if (
      !isInsideCircle(event.clientX, event.clientY, centerX, centerY, radius)
    ) {
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

  const onSliderInput = (event: React.FormEvent<HTMLInputElement>) => {
    const rotation = normalizeRadians(Number(event.currentTarget.value));
    event.currentTarget.setCustomValidity("");
    rotationRef.current = rotation;
    applyPadRotation(rotatorRef.current, rotation);
    onRotationPreview(rotation);
    commitRotation(rotation);
  };

  const shipPercent = shipPosition ? polarToPadPercent(shipPosition) : null;

  return (
    <div className="touch-position-pad-stack">
      <div className="touch-position-pad-stage">
        <div ref={rotatorRef} className="touch-position-pad-rotator">
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
            {shipPercent && (
              <div
                className="touch-position-pad-ship"
                style={{
                  left: `${shipPercent.x}%`,
                  top: `${shipPercent.y}%`,
                  backgroundColor: color,
                  boxShadow: `0 0 12px 2px ${color}`,
                }}
                aria-hidden
              />
            )}
            {indicator && (
              <div
                className="touch-position-pad-indicator"
                style={{
                  left: `${indicator.x}%`,
                  top: `${indicator.y}%`,
                }}
                aria-hidden
              />
            )}
          </div>
        </div>
      </div>
      <label className="touch-position-pad-rotation-label">
        <span className="touch-position-pad-rotation-label-text">Rotate</span>
        <input
          ref={sliderRef}
          type="range"
          className="touch-position-pad-rotation-slider"
          min={ROTATION_SLIDER_MIN}
          max={ROTATION_SLIDER_MAX}
          step={ROTATION_SLIDER_STEP}
          defaultValue={normalizeRadians(padRotation)}
          onInput={onSliderInput}
          onInvalid={(event) => event.preventDefault()}
          aria-label="Rotate touch pad"
        />
      </label>
    </div>
  );
};
