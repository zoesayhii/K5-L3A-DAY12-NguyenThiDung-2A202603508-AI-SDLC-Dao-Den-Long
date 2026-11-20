// Ban do chuan Ticket-02. Goc do tu +X nguoc chieu kim dong ho: (x,z) = r*(cos, sin).
const DEG = Math.PI / 180;
export const pol = (r, deg, y = 0) => [r * Math.cos(deg * DEG), y, r * Math.sin(deg * DEG)];
const ring = (n, r, startDeg, y = 0, cx = 0) =>
  Array.from({ length: n }, (_, i) => {
    const p = pol(r, startDeg + (360 / n) * i, y);
    p[0] += cx;
    return p;
  });
const inCircle = (x, z, cx, cz, r) => Math.hypot(x - cx, z - cz) <= r;

// ---- Dem 1: Dao Ben
const night1 = {
  id: 1,
  start: [0, 0, 0],
  lanterns: [
    ['L1', [0, 0, 25]],
    ['L2', [23.8, 0, 7.7]],
    ['L3', [14.7, 0, -20.2]],
    ['L4', [-14.7, 0, -20.2]],
    ['L5', [-23.8, 0, 7.7]],
  ],
  motePoints: [...ring(8, 12, 0), ...ring(16, 33, 0)],
  shadePoints: ring(12, 37, 15),
  shadeInterval: 480,
  shadeMax: 6,
  charms: [],
  drifters: false,
  wind: false,
  pads: [],
  driftArea: [[0, 0, 40]],
  surface: (x, z) => (inCircle(x, z, 0, 0, 40) ? 0 : null),
};

// ---- Dem 2: Dao Cau
const bridge = (x, z) => x >= 26 && x <= 44 && z >= -2 && z <= 2;
const night2 = {
  id: 2,
  start: [0, 0, 0],
  lanterns: [
    ['L1', [0, 0, 20]],
    ['L2', [17, 0, -10]],
    ['L3', [-17, 0, -10]],
    ['L4', [70, 0, 20]],
    ['L5', [87, 0, -10]],
    ['L6', [53, 0, -10]],
  ],
  motePoints: [
    ...ring(4, 10, 0), ...ring(8, 22, 0),
    ...ring(4, 10, 0, 0, 70), ...ring(8, 22, 0, 0, 70),
  ],
  shadePoints: [...ring(8, 26, 22.5), ...ring(8, 26, 22.5, 0, 70)],
  shadeInterval: 420,
  shadeMax: 8,
  charms: [['C1', [35, 0, 0]]],
  drifters: true,
  wind: false,
  // pad: pos, vy, toc do ngang, huong ngang (vector don vi)
  pads: [
    { pos: [20, 0, 18], vy: 14, h: 24, dir: unit([70 - 20, 0 - 18]) },
    { pos: [50, 0, -18], vy: 14, h: 24, dir: unit([0 - 50, 0 + 18]) },
  ],
  driftArea: [[0, 0, 28], [70, 0, 28]],
  surface: (x, z) => (inCircle(x, z, 0, 0, 28) || inCircle(x, z, 70, 0, 28) || bridge(x, z) ? 0 : null),
};
function unit([x, z]) {
  const d = Math.hypot(x, z);
  return [x / d, z / d];
}

// ---- Dem 3: Dao Chuong
const RAMP_ANGLES = [30, 150];
function night3Surface(x, z) {
  const r = Math.hypot(x, z);
  if (r > 45) return null;
  let y = 0;
  if (r >= 12 && r <= 24 && z > 0) y = 3;
  if (r <= 8) y = 6;
  for (const a of RAMP_ANGLES) {
    const dx = Math.cos(a * DEG);
    const dz = Math.sin(a * DEG);
    const t = x * dx + z * dz;
    const w = Math.abs(-x * dz + z * dx);
    if (t >= 24 && t <= 30 && w <= 1.5) y = Math.max(y, (3 * (30 - t)) / 6);
  }
  return y;
}
const night3 = {
  id: 3,
  // Gia dinh: (0,0,0) nam trong thap chuong => xuat phat o tang 0, phia -Z.
  start: [0, 0, -30],
  lanterns: [
    ['L1', [0, 6, 6]],
    ['L2', [18, 3, 10]],
    ['L3', [-18, 3, 10]],
    ['L4', [35, 0, -10]],
    ['L5', [-35, 0, -10]],
    ['L6', [20, 0, -35]],
    ['L7', [-20, 0, -35]],
  ],
  motePoints: [...ring(18, 34, 0), ...Array.from({ length: 8 }, (_, i) => pol(18, 20 * (i + 1), 3)), ...ring(4, 5, 45, 6)],
  shadePoints: ring(16, 43, 0),
  shadeInterval: 360,
  shadeMax: 10,
  charms: [['C1', [30, 0, 25]], ['C2', [-30, 0, 25]]],
  drifters: true,
  wind: true,
  pads: [{ pos: [0, 3, 13], vy: 12, h: 8, dir: [0, -1] }],
  tower: { r: 2, h: 8 + 6 },
  driftArea: [[0, 0, 45]],
  surface: night3Surface,
};

export const NIGHTS = { 1: night1, 2: night2, 3: night3 };
