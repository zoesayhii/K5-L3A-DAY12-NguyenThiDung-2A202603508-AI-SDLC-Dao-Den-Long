// Canh benchmark chuan (Ticket-04 muc 1): 200 Bong Muc wander + 100 dom dom rai deu tren dao Dem 1 (seed), L1-L3 sang fuel 100.
import { makeRng } from './prng.mjs';

export const BENCH_SHADES = 200;
export const BENCH_MOTES = 100;
const R = 38;

export function benchScenario(seed) {
  const rng = makeRng(seed);
  const disk = () => {
    const a = rng() * Math.PI * 2;
    const r = R * Math.sqrt(rng()); // rai deu theo dien tich
    return [r * Math.cos(a), r * Math.sin(a)];
  };
  return {
    random_motes: false,
    random_shades: false,
    random_drifters: false,
    wind_enabled: false,
    player: { pos: [0, 0], carried: 0 },
    lanterns: [{ id: 'L1', lit: true, fuel: 100 }, { id: 'L2', lit: true, fuel: 100 }, { id: 'L3', lit: true, fuel: 100 }],
    motes: Array.from({ length: BENCH_MOTES }, disk),
    shades: Array.from({ length: BENCH_SHADES }, () => ({ pos: disk(), state: 'wander' })),
  };
}

// Camera bay vong: tam (0,0,0), ban kinh 30, Y=15, xuat phat goc 0 (30,15,0), nguoc chieu kim dong ho, 15 s/vong.
export function benchCamera(tSeconds) {
  const a = (2 * Math.PI * tSeconds) / 15;
  return [30 * Math.cos(a), 15, 30 * Math.sin(a)];
}
