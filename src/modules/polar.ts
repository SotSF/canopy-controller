export type Polar = { r: number; theta: number };

const viewportCenter = () => ({
  cx: window.innerWidth / 2,
  cy: window.innerHeight / 2,
  maxR: Math.hypot(window.innerWidth / 2, window.innerHeight / 2),
});

export const cartesianToPolar = (clientX: number, clientY: number): Polar => {
  const { cx, cy, maxR } = viewportCenter();
  const dx = clientX - cx;
  const dy = clientY - cy;
  return {
    r: maxR === 0 ? 0 : Math.hypot(dx, dy) / maxR,
    theta: Math.atan2(dy, dx),
  };
};

export const polarToPercent = ({ r, theta }: Polar) => {
  const { cx, cy, maxR } = viewportCenter();
  const x = cx + r * maxR * Math.cos(theta);
  const y = cy + r * maxR * Math.sin(theta);
  return {
    left: `${(x / window.innerWidth) * 100}%`,
    top: `${(y / window.innerHeight) * 100}%`,
  };
};
