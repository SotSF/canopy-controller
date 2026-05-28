export type Polar = { r: number; theta: number };

export const clientPointToPolar = (
  clientX: number,
  clientY: number,
  centerX: number,
  centerY: number,
  radius: number,
): Polar => {
  const dx = clientX - centerX;
  const dy = clientY - centerY;
  return {
    r: radius === 0 ? 0 : Math.min(1, Math.hypot(dx, dy) / radius),
    theta: Math.atan2(dy, dx),
  };
};

export const isInsideCircle = (
  clientX: number,
  clientY: number,
  centerX: number,
  centerY: number,
  radius: number,
) => Math.hypot(clientX - centerX, clientY - centerY) <= radius;

export const clientPointToAngle = (
  clientX: number,
  clientY: number,
  centerX: number,
  centerY: number,
) => Math.atan2(clientY - centerY, clientX - centerX);

export const polarToPadPercent = ({ r, theta }: Polar) => ({
  x: 50 + r * 50 * Math.cos(theta),
  y: 50 + r * 50 * Math.sin(theta),
});

/** Wrap radians to [-π, π] for range inputs and trig. */
export const normalizeRadians = (radians: number) => {
  const twoPi = Math.PI * 2;
  let angle = radians % twoPi;
  if (angle > Math.PI) angle -= twoPi;
  if (angle < -Math.PI) angle += twoPi;
  return angle;
};
