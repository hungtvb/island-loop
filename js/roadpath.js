// roadpath.js — toán đường DÙNG CHUNG cho cliff.js (khắc ledge), roads.js
// (dựng mặt đường/mòn), car.js (xe chạy) và các module scatter (trừ hành lang).
//  - ĐƯỜNG VÒNG KHÉP KÍN quanh đảo ở vùng thấp — tuyến tham quan đi qua các
//    điểm nhấn: chân đồi hải đăng P1 (= điểm đầu lối mòn, t=0) → sườn đông-bắc
//    → cụm dừa bãi bắc P3 → ven biển bắc → cụm dừa tây-nam P3 → bãi cát phía
//    tây → làng chài P2 → cụm dừa bãi nam P3 → khép vòng về chân đồi.
//    Đường cong CatmullRom KHÉP KÍN (closed=true); mọi hàm t đều wrap theo vòng.
//  - LỐI MÒN ĐẤT: từ điểm t=0 (chân đồi) uốn zic-zac lên hải đăng như đường
//    người đi bộ thật — hẹp, mặt đất nện, mép mềm, không viền/vạch.
// Cao độ bám địa hình — đường vòng một phần đắp nổi/cắt vào sườn đồi (ledge),
// lối mòn drap hoàn toàn theo đất (không khắc ledge).
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { baseTerrainHeight, vnoise } from './terrain.js';

export const CX = CONFIG.cliff.x;   // 88
export const CZ = CONFIG.cliff.z;   // -5
export const TH_MAX = Math.PI * 2;  // giữ export cho tương thích

// Nửa rộng mặt cắt ledge (đường + lề) và vùng blend vào sườn đồi.
export const LEDGE_HALF = 4.6;
export const LEDGE_BLEND = 3.6;

// t tại chân đồi hải đăng = điểm đầu lối mòn đất.
export const TRAILHEAD_T = 0;

function V(x, y, z) { return new THREE.Vector3(x, y, z); }

// Control points ĐƯỜNG VÒNG (x,z) — thứ tự quanh đảo, KHÉP KÍN.
// Điểm [0] = chân đồi hải đăng (điểm đầu lối mòn).
const LOOP_XZ = [
  [74, 28],     // P1: chân đồi hải đăng
  [46, -22],    // sườn đông-bắc (cách mũi đá ~45m)
  [40, -52],    // đông-bắc
  [28, -72],    // gần cụm dừa bãi bắc P3
  [-5, -88],    // ven biển bắc
  [-48, -80],   // tây-bắc
  [-88, -66],   // gần cụm dừa tây-nam P3
  [-108, -50],  // ven biển tây: vòng cung trơn (không cua tay áo)
  [-116, -30],
  [-118, -10],
  [-114, 2],    // vòng cung ôm cua tây-bắc (trải đều, không gấp)
  [-106, 8],
  [-96, 10],
  [-79, 16],    // vòng TRÁNH làng phía bắc (không đè nhà)
  [-68, 20],
  [-56, 23],
  [-48, 28],    // ôm cua xuống phía nam (trải đều)
  [-42, 42],
  [-40, 60],    // nam
  [-32, 82],    // vòng cung qua cụm dừa nam
  [-14, 94],
  [2, 92],
  [22, 80],
  [48, 64],
  [62, 48],     // nắn mềm chỗ khép vòng (sau [48,64], trước [74,28])
];

function buildControlPoints() {
  // Cao độ bám địa hình + làm mịn vòng tròn (không leo đơn điệu như đường hở —
  // vòng khép kín phải về lại cao độ ban đầu).
  const pts = LOOP_XZ.map(([x, z]) => V(x, baseTerrainHeight(x, z), z));
  for (let pass = 0; pass < 4; pass++) {
    const ys = pts.map((p) => p.y);
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      pts[i].y = ys[i] * 0.5 + ys[(i - 1 + n) % n] * 0.25 + ys[(i + 1) % n] * 0.25;
    }
  }
  return pts;
}

// Chuẩn hoá t về [0,1) theo vòng khép kín.
function wrapT(t) { return ((t % 1) + 1) % 1; }

let _curve = null, _samples = null, _bounds = null;
function getCurve() {
  if (!_curve) {
    _curve = new THREE.CatmullRomCurve3(buildControlPoints(), true, 'centripetal', 0.5);
    const raw = _curve.getSpacedPoints(720);
    _samples = raw.slice(0, 720); // bỏ điểm cuối trùng điểm đầu (đường khép kín)
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const p of _samples) {
      if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x;
      if (p.z < z0) z0 = p.z; if (p.z > z1) z1 = p.z;
    }
    _bounds = { x0: x0 - 25, x1: x1 + 25, z0: z0 - 25, z1: z1 + 25 };
  }
  return _curve;
}
function getSamples() { getCurve(); return _samples; }
function sampleCount() { getCurve(); return _samples.length; }

// Curve đường vòng (khép kín) — cho car.js lái xe theo.
export function roadCurve() { getCurve(); return _curve; }

// Cao độ mặt ledge theo t — DÙNG CHUNG cho cliff.js (khắc) và roads.js.
export function ledgeHeightAt(t) {
  const s = getSamples(), N = s.length;
  const f = wrapT(t) * N;
  const i0 = Math.floor(f) % N, i1 = (i0 + 1) % N, k = f - Math.floor(f);
  const a = s[i0], b = s[i1];
  return a.y + (b.y - a.y) * k;
}

// Cao độ mặt đường (giữ để tương thích — thực chất = ledgeHeightAt).
export function roadY(t) {
  return ledgeHeightAt(t) + 0.28;
}

// Nửa rộng ledge biến thiên nhẹ theo t — bậc đường không đều như đèo thật.
export function ledgeHalfAt(th) {
  const t = wrapT(th / TH_MAX);
  return LEDGE_HALF * (1 + 0.35 * (vnoise(t * 7.3 + 2.0, 4.4) - 0.5));
}

// Điểm trên tim đường tại t (wrap theo vòng).
export function roadPointAt(t) {
  const s = getSamples(), N = s.length;
  const f = wrapT(t) * N;
  const i0 = Math.floor(f) % N, i1 = (i0 + 1) % N, k = f - Math.floor(f);
  const a = s[i0], b = s[i1];
  return {
    x: a.x + (b.x - a.x) * k,
    y: a.y + (b.y - a.y) * k,
    z: a.z + (b.z - a.z) * k,
  };
}

// Tham số đường gần nhất cho điểm (x,z): { t, th, dist } — tìm trên vòng kín.
export function roadParam(x, z) {
  const s = getSamples(), N = s.length;
  const B = _bounds;
  if (x < B.x0 || x > B.x1 || z < B.z0 || z > B.z1) return null;
  let bi = 0, bd = Infinity;
  const STEP = 12;
  for (let i = 0; i < N; i += STEP) {
    const dx = x - s[i].x, dz = z - s[i].z;
    const d = dx * dx + dz * dz;
    if (d < bd) { bd = d; bi = i; }
  }
  for (let k = -STEP; k <= STEP; k++) {
    const i = (bi + k + N) % N;
    const dx = x - s[i].x, dz = z - s[i].z;
    const d = dx * dx + dz * dz;
    if (d < bd) { bd = d; bi = i; }
  }
  // chiếu lên 2 đoạn kề (có wrap) để dist chính xác hơn
  let bestD = bd, bestT = bi / N;
  for (const off of [-1, 0]) {
    const pi = (bi + off + N) % N, qi = (bi + off + 1 + N) % N;
    const p = s[pi], q = s[qi];
    const vx = q.x - p.x, vz = q.z - p.z;
    const len2 = vx * vx + vz * vz;
    if (len2 < 1e-9) continue;
    let u = ((x - p.x) * vx + (z - p.z) * vz) / len2;
    u = Math.min(Math.max(u, 0), 1);
    const px = p.x + vx * u, pz = p.z + vz * u;
    const d = (x - px) * (x - px) + (z - pz) * (z - pz);
    if (d < bestD) { bestD = d; bestT = wrapT((pi + u) / N); }
  }
  return { t: bestT, th: bestT * TH_MAX, dist: Math.sqrt(bestD) };
}

// Hệ số khắc ledge: 1 trong lòng đường, → 0 ở mép blend.
export function ledgeFactor(dist, halfW) {
  const hw = halfW === undefined ? LEDGE_HALF : halfW;
  if (dist >= hw + LEDGE_BLEND) return 0;
  if (dist <= hw) return 1;
  const t = (dist - hw) / LEDGE_BLEND;
  return 1 - t * t * (3 - 2 * t);
}

// === LỐI MÒN ĐẤT lên hải đăng (theo ý user: bỏ đường nhựa lên đồi) ===
// Từ điểm t=0 đường vòng (chân đồi) uốn ZIC-ZAC lên đỉnh theo sườn tây-nam
// (phía thoải, tránh mặt đá dựng phía biển): KHÔNG xoắn ốc đều — góc dao động
// + bán kính gợn noise mạnh như đường người đi bộ thật. Hẹp (~1.9m), mặt đất
// nện, mép mềm tan vào cỏ (xem roads.js).
// Cao độ: tuyến ngang bám địa hình, cao độ LÀM MỊN MẠNH + giới hạn độ dốc như
// đường mòn được ủi, rồi khắc băng ghế hẹp vào sườn đồi (cliff.js) — lối mòn
// không bao giờ lơ lửng/chôn/dốc đứng.
export const TRAIL_HALF = 0.95;
// San mặt bằng hành lang cho lối mòn (như dọn đường mòn thật): xóa gò đá
// lởm chởm trong hành lang để lối mòn luôn bám đất — nửa rộng mặt bằng +
// vùng blend mềm vào địa hình tự nhiên xung quanh.
export const TRAIL_BENCH_HALF = 2.5;
export const TRAIL_BENCH_BLEND = 4.0;
export function trailBenchFactor(dist) {
  if (dist >= TRAIL_BENCH_HALF + TRAIL_BENCH_BLEND) return 0;
  if (dist <= TRAIL_BENCH_HALF) return 1;
  const t = (dist - TRAIL_BENCH_HALF) / TRAIL_BENCH_BLEND;
  return 1 - t * t * (3 - 2 * t);
}

function buildTrailPoints() {
  // 1. tuyến ngang (x,z): đường cong tham số SẠCH — một vòng cung uốn lượn
  // 229° ôm sườn tây-nam-bắc (không qua vách biển đông), bán kính thu dần
  // từ chân đồi →7m, uốn lượn ±2.5m tạo dáng đi bộ tự nhiên. Góc ĐƠN ĐIỆU tăng nên
  // KHÔNG BAO GIỜ tự cắt. Địa hình trong hành lang được san phẳng theo
  // profile (như dọn đường mòn thật) nên lối mòn luôn bám đất.
  // QUAN TRỌNG: bán kính thu vào NHANH ngay từ đầu (t^0.45) để lối mòn tách
  // khỏi hành lang đường vòng — trước đây nó chạy song song/đè lên đường
  // ~1/3 chiều dài, băng ghế lối mòn đội địa hình lên mặt đường làm xe chui
  // qua đất ở khu hải đăng.
  const end = roadPointAt(TRAILHEAD_T);   // chân đồi = điểm đầu lối mòn
  const TURN = 4.0, R1 = 7;
  const R0 = Math.hypot(end.x - CX, end.z - CZ); // bán kính thực từ chân đồi
  const a0 = Math.atan2(end.z - CZ, end.x - CX);
  const N = 48, route = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const ang = a0 + t * TURN;
    const rBase = R0 - (R0 - R1) * Math.pow(t, 0.3);
    // uốn lượn: 3 nhịp, biên độ tắt ở 2 đầu để nối khít
    const env = Math.sin(Math.min(t * 1.04, 1) * Math.PI);
    const wob = Math.sin(t * Math.PI * 6 + 0.7) * 2.5 * env;
    const r = Math.max(6, rBase + wob);
    let x = CX + r * Math.cos(ang), z = CZ + r * Math.sin(ang);
    if (i === 0) { x = end.x; z = end.z; }
    route.push({ x, z });
  }
  // 2. cao độ: GIỮ THẤP (bám mặt đường vòng) trong ~28% đầu khi lối mòn còn đi
  // sát đường, rồi mới leo lên đỉnh — tránh lối mòn lơ lửng trên ledge đường
  // ở đoạn bench phải nhường cho đường. Độ dốc dồn vào 72% cuối (~19%, có bậc
  // đá ở đoạn dốc như cũ).
  const y0 = ledgeHeightAt(TRAILHEAD_T) + 0.3, y1 = CONFIG.cliff.padHeight;
  return route.map((p, i) => {
    const t = i / N;
    const tc = Math.min(Math.max((t - 0.28) / 0.72, 0), 1);
    const e = tc * tc * (3 - 2 * tc);
    return V(p.x, y0 + (y1 - y0) * e, p.z);
  });
}

let _tCurve = null, _tSamples = null, _tBounds = null;
function getTrailCurve() {
  if (!_tCurve) {
    _tCurve = new THREE.CatmullRomCurve3(buildTrailPoints(), false, 'centripetal', 0.5);
    _tSamples = _tCurve.getSpacedPoints(400);
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const p of _tSamples) {
      if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x;
      if (p.z < z0) z0 = p.z; if (p.z > z1) z1 = p.z;
    }
    _tBounds = { x0: x0 - 20, x1: x1 + 20, z0: z0 - 20, z1: z1 + 20 };
  }
  return _tCurve;
}
function getTrailSamples() { getTrailCurve(); return _tSamples; }

// Điểm trên tim lối mòn tại t ∈ [0,1].
export function trailPointAt(t) {
  const s = getTrailSamples();
  const f = Math.min(Math.max(t, 0), 1) * (s.length - 1);
  const i = Math.floor(f), k = f - i;
  const a = s[i], b = s[Math.min(i + 1, s.length - 1)];
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k };
}

// Mẫu dọc lối mòn cho các module khác (trừ hành lang, bậc đá...).
export function trailSamples() { return getTrailSamples().slice(); }

// Cao độ mặt lối mòn tại t ∈ [0,1] — DÙNG CHUNG cho cliff.js (khắc băng ghế).
export function trailYAt(t) { return trailPointAt(t).y; }

// Tham số lối mòn gần nhất cho điểm (x,z): { t, dist }.
export function trailParam(x, z) {
  const s = getTrailSamples();
  const B = _tBounds;
  if (x < B.x0 || x > B.x1 || z < B.z0 || z > B.z1) return null;
  let bi = 0, bd = Infinity;
  const STEP = 10;
  for (let i = 0; i < s.length; i += STEP) {
    const dx = x - s[i].x, dz = z - s[i].z;
    const d = dx * dx + dz * dz;
    if (d < bd) { bd = d; bi = i; }
  }
  const lo = Math.max(0, bi - STEP), hi = Math.min(s.length - 1, bi + STEP);
  for (let i = lo; i <= hi; i++) {
    const dx = x - s[i].x, dz = z - s[i].z;
    const d = dx * dx + dz * dz;
    if (d < bd) { bd = d; bi = i; }
  }
  return { t: bi / (s.length - 1), dist: Math.sqrt(bd) };
}
