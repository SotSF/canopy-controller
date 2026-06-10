import { useEffect, useMemo, useRef, useState } from "react";
import { debounce } from "lodash";
import {
  clientPointToAngle,
  clientPointToPolar,
  isInsideCircle,
  polarToPadPercent,
  Polar,
} from "../modules/polar";

type TouchPositionPadProps = {
  color: string;
  padRotation: number;
  shipPosition: Polar | null;
  onPosition: (position: Polar) => void;
  onRotationCommit: (rotation: number, delta: number) => void;
  showToolbar?: boolean;
  isCalibrating?: boolean;
  onIsCalibratingChange?: (isCalibrating: boolean) => void;
};

const ROTATION_COMMIT_MS = 15;
/** Handle sits near the top of the pad, inset so it is not clipped by the viewport. */
const HANDLE_LOCAL_THETA = -Math.PI / 2;
const HANDLE_RADIUS = 0.88;

/** Undo screen-space X when the stage is mirrored with scaleX(-1). */
const mirrorClientX = (clientX: number, centerX: number) =>
  2 * centerX - clientX;

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
  onRotationCommit,
  showToolbar = true,
  isCalibrating: isCalibratingProp,
  onIsCalibratingChange,
}: TouchPositionPadProps) => {
  const padRef = useRef<HTMLDivElement>(null);
  const rotatorRef = useRef<HTMLDivElement>(null);
  const rotationRef = useRef(padRotation);
  const committedRotationRef = useRef(padRotation);
  const positionPointerId = useRef<number | null>(null);
  const rotatePointerId = useRef<number | null>(null);
  const rotateDragStart = useRef<{
    pointerAngle: number;
    padRotation: number;
  } | null>(null);
  const [isCalibratingInternal, setIsCalibratingInternal] = useState(false);
  const isCalibratingControlled = isCalibratingProp !== undefined;
  const isCalibrating = isCalibratingControlled
    ? isCalibratingProp
    : isCalibratingInternal;
  const prevCalibratingRef = useRef(isCalibrating);
  const [hasHandleInteraction, setHasHandleInteraction] = useState(false);
  const [calibratingRotation, setCalibratingRotation] = useState(padRotation);
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

  const setIsCalibrating = (next: boolean) => {
    onIsCalibratingChange?.(next);
    if (!isCalibratingControlled) {
      setIsCalibratingInternal(next);
    }
  };

  useEffect(() => {
    if (prevCalibratingRef.current && !isCalibrating) {
      commitRotation.flush();
      setHasHandleInteraction(false);
    } else if (!prevCalibratingRef.current && isCalibrating) {
      setCalibratingRotation(rotationRef.current);
      setHasHandleInteraction(false);
    }
    prevCalibratingRef.current = isCalibrating;
  }, [isCalibrating, commitRotation]);

  useEffect(() => {
    rotationRef.current = padRotation;
    committedRotationRef.current = padRotation;
    setCalibratingRotation(padRotation);
    applyPadRotation(rotatorRef.current, padRotation);
  }, [padRotation]);

  const updatePosition = (clientX: number, clientY: number) => {
    const pad = padRef.current;
    if (!pad) return;

    const { centerX, centerY, radius } = getCircleGeometry(pad);
    const screen = clientPointToPolar(
      mirrorClientX(clientX, centerX),
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

  const onPadPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isCalibrating) return;

    const pad = padRef.current;
    if (!pad) return;

    const { centerX, centerY, radius } = getCircleGeometry(pad);
    if (
      !isInsideCircle(event.clientX, event.clientY, centerX, centerY, radius)
    ) {
      return;
    }

    positionPointerId.current = event.pointerId;
    pad.setPointerCapture(event.pointerId);
    updatePosition(event.clientX, event.clientY);
  };

  const onPadPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (positionPointerId.current !== event.pointerId) return;
    updatePosition(event.clientX, event.clientY);
  };

  const onPadPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (positionPointerId.current !== event.pointerId) return;

    positionPointerId.current = null;
    padRef.current?.releasePointerCapture(event.pointerId);
    setIndicator(null);
  };

  const onRotateHandleDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    setHasHandleInteraction(true);
    const pad = padRef.current;
    if (!pad) return;

    const { centerX, centerY } = getCircleGeometry(pad);
    rotatePointerId.current = event.pointerId;
    rotateDragStart.current = {
      pointerAngle: clientPointToAngle(
        mirrorClientX(event.clientX, centerX),
        event.clientY,
        centerX,
        centerY,
      ),
      padRotation: rotationRef.current,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onRotateHandleMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (rotatePointerId.current !== event.pointerId) return;

    const pad = padRef.current;
    const start = rotateDragStart.current;
    if (!pad || !start) return;

    const { centerX, centerY } = getCircleGeometry(pad);
    const pointerAngle = clientPointToAngle(
      mirrorClientX(event.clientX, centerX),
      event.clientY,
      centerX,
      centerY,
    );
    const rotation = start.padRotation + (pointerAngle - start.pointerAngle);
    rotationRef.current = rotation;
    setCalibratingRotation(rotation);
    applyPadRotation(rotatorRef.current, rotation);
    commitRotation(rotation);
  };

  const onRotateHandleEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (rotatePointerId.current !== event.pointerId) return;

    rotatePointerId.current = null;
    rotateDragStart.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    commitRotation.flush();
  };

  const shipPercent = shipPosition ? polarToPadPercent(shipPosition) : null;
  const handleAngleRad = calibratingRotation + HANDLE_LOCAL_THETA;
  const handlePosition = polarToPadPercent({
    r: HANDLE_RADIUS,
    theta: handleAngleRad,
  });

  return (
    <div className="touch-position-pad-stack">
      {showToolbar && (
        <div className="touch-position-pad-toolbar">
          {isCalibrating ? (
            <button
              type="button"
              className="touch-position-pad-toolbar-button touch-position-pad-toolbar-button--done"
              onClick={() => setIsCalibrating(false)}
            >
              Done
            </button>
          ) : (
            <button
              type="button"
              className="touch-position-pad-toolbar-button"
              onClick={() => setIsCalibrating(true)}
            >
              Calibrate
            </button>
          )}
        </div>
      )}
      {isCalibrating && (
        <p className="touch-position-pad-calibrate-help">
          Click and drag the white circle until what you see here lines up with
          what you see on the canopy
        </p>
      )}
      <div
        className={`touch-position-pad-stage${isCalibrating ? " touch-position-pad-stage--calibrating" : ""}`}
      >
        <div ref={rotatorRef} className="touch-position-pad-rotator">
          <div
            ref={padRef}
            className="touch-position-pad"
            style={{
              borderColor: color,
              boxShadow: `0 0 16px 0 ${color}`,
            }}
            onPointerDown={onPadPointerDown}
            onPointerMove={onPadPointerMove}
            onPointerUp={onPadPointerEnd}
            onPointerCancel={onPadPointerEnd}
            aria-label="Touch position control"
          >
            <div
              className="touch-position-pad-center-marker"
              style={{ borderColor: color }}
              aria-hidden
            />
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
        {isCalibrating && (
          <div
            className={`touch-position-pad-rotate-handle${hasHandleInteraction ? "" : " touch-position-pad-rotate-handle--wiggle"}`}
            style={{
              left: `${handlePosition.x}%`,
              top: `${handlePosition.y}%`,
              ["--handle-tangent-angle" as string]: `${handleAngleRad}rad`,
            }}
            onPointerDown={onRotateHandleDown}
            onPointerMove={onRotateHandleMove}
            onPointerUp={onRotateHandleEnd}
            onPointerCancel={onRotateHandleEnd}
            aria-label="Drag to rotate touch pad"
          />
        )}
      </div>
    </div>
  );
};
