// roadpath.js — toán đường DÙNG CHUNG cho cliff.js (khắc ledge), roads.js
// (dựng mặt đường/mòn) và các module scatter (trừ hành lang).
//  - ĐƯỜNG NHỰA: chỉ còn đường vòng đảo ở vùng thấp, kết thúc ở chân đồi
//    (điểm đầu lối mòn). KHÔNG còn đường nhựa lên đồi (theo ý user).
//  - LỐI MÒN ĐẤT: từ điểm cuối đường nhựa uốn zic-zac lên hải đăng như đường
//    người đi bộ thật — hẹp, mặt đất nện, mép mềm, không viền/vạch.
// Cao độ bám địa hình — đường nhựa một phần đắp nổi/cắt vào sườn đồi (ledge),
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

function V(x, y, z) { return new THREE.Vector3(x, y, z); }

// Dựng control points ĐƯỜNG NHỰA: đường làng quanh co qua đồi thấp từ bãi biển
// tới chân mũi đá — điểm cuối là điểm đầu lối mòn (vạt đất ở chân đồi).
function buildControlPoints() {
  const raw = [
    V(-30, 2.6, 95), V(-8, 3.8, 88), V(22, 5.8, 80), V(48, 7.8, 64),
    V(64, 10.0, 46), V(74, 11.8, 28),
  ];

  // Snap cao độ bám địa hình + leo đơn điệu (không bao giờ tụt).
  const pts = [];
  let prevY = -Infinity;
  for (let i = 0; i < raw.length; i++) {
    const p = raw[i];
    const t = baseTerrainHeight(p.x, p.z);
    let y = Math.min(Math.max(p.y, t - 2.0), t + 6.0);  // bám địa hình ±
    y = Math.max(y, prevY + 0.12);   // leo đơn điệu
    pts.push(V(p.x, y, p.z));
    prevY = y;
  }
  return pts;
}

let _curve = null, _samples = null, _bounds = null;
function getCurve() {
  if (!_curve) {
    _curve = new THREE.CatmullRomCurve3(buildControlPoints(), false, 'centripetal', 0.5);
    _samples = _curve.getSpacedPoints(720);
    // bounding box để roadParam loại nhanh điểm ở xa đường
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

// Cao độ mặt ledge theo t ∈ [0,1] — DÙNG CHUNG cho cliff.js (khắc) và roads.js.
export function ledgeHeightAt(t) {
  const s = getSamples();
  const f = Math.min(Math.max(t, 0), 1) * (s.length - 1);
  const i = Math.floor(f), k = f - i;
  const a = s[i], b = s[Math.min(i + 1, s.length - 1)];
  return a.y + (b.y - a.y) * k;
}

// Cao độ mặt đường (giữ để tương thích — thực chất = ledgeHeightAt).
export function roadY(t) {
  return ledgeHeightAt(t) + 0.28;
}

// Nửa rộng ledge biến thiên nhẹ theo t — bậc đường không đều như đèo thật.
export function ledgeHalfAt(th) {
  const t = th / TH_MAX;
  return LEDGE_HALF * (1 + 0.35 * (vnoise(t * 7.3 + 2.0, 4.4) - 0.5));
}

// Điểm trên tim đường tại t ∈ [0,1].
export function roadPointAt(t) {
  const s = getSamples();
  const f = Math.min(Math.max(t, 0), 1) * (s.length - 1);
  const i = Math.floor(f), k = f - i;
  const a = s[i], b = s[Math.min(i + 1, s.length - 1)];
  return {
    x: a.x + (b.x - a.x) * k,
    y: a.y + (b.y - a.y) * k,
    z: a.z + (b.z - a.z) * k,
  };
}

// Tham số đường gần nhất cho điểm (x,z): { t, th, dist }.
// coarse-to-fine trên samples đã spacing đều + loại nhanh bằng bounding box.
export function roadParam(x, z) {
  const s = getSamples();
  const B = _bounds;
  if (x < B.x0 || x > B.x1 || z < B.z0 || z > B.z1) return null;
  let bi = 0, bd = Infinity;
  const STEP = 12;
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
  // chiếu lên đoạn thẳng giữa 2 sample kề để dist chính xác hơn
  const a = s[Math.max(0, bi - 1)], b = s[bi], c = s[Math.min(s.length - 1, bi + 1)];
  let bestD = bd, bestT = bi / (s.length - 1);
  for (const [p, q, ti, tj] of [[a, b, (bi - 1) / (s.length - 1), bi / (s.length - 1)], [b, c, bi / (s.length - 1), (bi + 1) / (s.length - 1)]]) {
    const vx = q.x - p.x, vz = q.z - p.z;
    const len2 = vx * vx + vz * vz;
    if (len2 < 1e-9) continue;
    let u = ((x - p.x) * vx + (z - p.z) * vz) / len2;
    u = Math.min(Math.max(u, 0), 1);
    const px = p.x + vx * u, pz = p.z + vz * u;
    const d = (x - px) * (x - px) + (z - pz) * (z - pz);
    if (d < bestD) { bestD = d; bestT = ti + (tj - ti) * u; }
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

// === LỐI MÒN ĐẤT lên hải đăng (thay thế đường nhựa xoắn đã bỏ, theo ý user) ===
// Từ điểm cuối đường nhựa (chân đồi) uốn ZIC-ZAC lên đỉnh theo sườn tây-nam
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
  // 32→7m, uốn lượn ±2.5m tạo dáng đi bộ tự nhiên. Góc ĐƠN ĐIỆU tăng nên
  // KHÔNG BAO GIỜ tự cắt. Địa hình trong hành lang được san phẳng theo
  // profile (như dọn đường mòn thật) nên lối mòn luôn bám đất.
  const end = roadPointAt(1);   // điểm cuối đường nhựa = điểm đầu lối mòn
  const TURN = 4.0, R0 = 32, R1 = 7;
  const a0 = Math.atan2(end.z - CZ, end.x - CX);
  const N = 48, route = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const ang = a0 + t * TURN;
    const rBase = R0 - (R0 - R1) * Math.pow(t, 0.85);
    // uốn lượn: 3 nhịp, biên độ tắt ở 2 đầu để nối khít
    const env = Math.sin(Math.min(t * 1.04, 1) * Math.PI);
    const wob = Math.sin(t * Math.PI * 6 + 0.7) * 2.5 * env;
    const r = Math.max(6, rBase + wob);
    let x = CX + r * Math.cos(ang), z = CZ + r * Math.sin(ang);
    if (i === 0) { x = end.x; z = end.z; }
    route.push({ x, z });
  }
  // 2. cao độ: tuyến tính mượt từ mặt đường nhựa lên đỉnh (độ dốc ~22%,
  // có bậc đá ở đoạn dốc) — địa hình sẽ được san theo profile này
  const y0 = ledgeHeightAt(1) + 0.3, y1 = CONFIG.cliff.padHeight;
  return route.map((p, i) => {
    const t = i / N;
    const e = t * t * (3 - 2 * t) * 0.25 + t * 0.75; // easing nhẹ ở 2 đầu
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
