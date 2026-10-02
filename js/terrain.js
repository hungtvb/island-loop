// terrain.js — ĐỊA HÌNH DUY NHẤT của đảo: heightfield đồi lượn sóng tự nhiên.
// Mũi đá hải đăng KHÔNG còn là khối nón rời — nó là ĐIỂM CAO của cùng heightfield:
// địa hình lượn lên dần rồi nhô thành mũi đá dựng đứng ở góc đảo.
// Mọi module (cliff, roadpath, vegetation, water-GLSL) đều dùng chung công thức này.
import { CONFIG } from './config.js';

const C = CONFIG.cliff, I = CONFIG.island;
export const HX = C.x, HZ = C.z;   // tâm mũi đá = tâm địa hình

// --- Noise deterministic (không cần state) ---
export function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}
export function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y) {
  return vnoise(x, y) * 0.55
       + vnoise(x * 2.13 + 5.2, y * 2.13 + 1.3) * 0.28
       + vnoise(x * 4.41 + 9.1, y * 4.41 + 7.7) * 0.17;
}
export function smooth01(x) {
  const c = Math.min(Math.max(x, 0), 1);
  return c * c * (3 - 2 * c);
}

// Bờ biển lởm chởm tự nhiên: bán kính đường bờ biến thiên theo góc (chuỗi sin
// tần số thấp, biên độ tối đa ±30%) → vịnh lõm + mũi đất nhô như đảo thật trong
// ảnh mẫu (ý user: "cái đảo sao mà tròn 1 cách hoàn hảo thế").
// Vẫn là MỘT đảo duy nhất (biến thiên xuyên tâm mượt, không tách đảo).
// Cố ý chỉ dùng sin/cos (không dùng vnoise): water.js port CHÍNH XÁC công thức
// này sang GLSL để bọt biển ôm đúng đường bờ mới — vnoise cho kết quả khác nhau
// giữa float32 (GLSL) và float64 (JS) nên bọt sẽ lệch khỏi mép nước.
function angWin(ang, center, width) {
  let d = Math.abs(ang - center);
  d = Math.min(d, Math.PI * 2 - d);
  return 1 - smooth01(d / width);
}
export function coastK(ang) {
  let w = 0.16 * Math.sin(2 * ang + 1.3)
        + 0.09 * Math.sin(3 * ang + 4.1)
        + 0.05 * Math.sin(5 * ang + 2.2);
  // Giữ bờ ổn định ở vùng quan trọng (giữ nguyên ý đồ thiết kế cũ):
  w = Math.max(w, 0.06 * angWin(ang, 3.0585, 0.50));   // làng chài P2 (-72,6): bờ không lấn vào
  w = Math.max(w, -0.08 * angWin(ang, -0.0567, 0.45)); // mũi đá hải đăng (88,-5): giữ gần như cũ
  w = Math.max(w, -0.03 * angWin(ang, 1.15, 0.95));    // đường nhựa phía nam: bờ không lấn vào đường
  return 1 + w;
}

// Mask đá mũi hải đăng (0..1): bất đối xứng quanh tâm (HX,HZ) — phía biển
// (đông) ngắn & dốc đứng kiểu mũi đá, phía đất liền (tây) dài & thoải, mép mask
// lượn theo noise → silhouette lởm chởm. Dùng chung cho địa hình (rawHeight)
// và tô màu đá (cliff.js) để vùng đá khớp đúng vùng địa hình đá.
export function headlandMask(x, z) {
  const dxh = x - HX, dzh = z - HZ;
  const dh = Math.hypot(dxh, dzh);
  const hang = Math.atan2(dzh, dxh);
  const toLand = 0.5 - 0.5 * Math.cos(hang); // 1 về phía đảo (tây), 0 ra biển (đông)
  const maskR = C.bumpR * (0.72 + 0.56 * toLand)
              * (0.80 + 0.40 * vnoise(Math.cos(hang) * 1.9 + 4.4, Math.sin(hang) * 1.9 + 8.1));
  const hm = 1 - smooth01((dh - maskR * 0.30) / (maskR * 0.95));
  return { hm, dh, hang, maskR };
}

// Cao độ địa hình GỐC (chưa khắc đường) — deterministic, rẻ, dùng ở mọi nơi.
//  - Đồi lượn: fBm 3 octave ±13m + sóng rộng ±3.5m + chi tiết mịn, tắt dần ra mép.
//  - Đồi phụ: 1 gò rõ rệt trong đảo (cao 15m) cho địa hình có cao thấp.
//  - Vùng làng chài P2: san phẳng ~40×40m (tọa độ trong CONFIG.village).
//  - Mũi đá: dựng bằng NOISE (ridged/fBm) có mask tập trung ở góc đảo — lởm chởm
//    tự nhiên như đồi phụ, CỘNG vào đồi (không max) → mọc liền từ địa hình.
//  - Vân đá craggy: ridged noise 3D-ish (trộn cao độ h vào tọa độ noise) để mặt đá
//    không bị kéo thành sọc dọc trên vách dựng.
//  - Đỉnh: đĩa méo mó tự nhiên (mép lượn theo noise) ở padHeight cho hải đăng + nhà.
function rawHeight(x, z) {
  const r = Math.hypot(x, z);
  // Bờ biển biến thiên theo góc → đảo không còn tròn hoàn hảo.
  // rEff: mọi thành phần xuyên tâm (dome, edgeFade) dùng bán kính hiệu dụng này.
  const rEff = r / coastK(Math.atan2(z, x));
  // đồi lượn sóng — tắt dần từ rEff=85→130 để vành bãi cát quanh đảo mịn tự nhiên.
  // 3 tầng: gò lớn (±13m, bước ~60m) + sóng rộng (±3.5m, bước ~125m) + chi tiết mịn.
  const edgeFade = 1 - smooth01((rEff - 85) / 45);
  const hills = (fbm(x * 0.016 + 3.1, z * 0.016 + 8.7) - 0.5) * 26 * edgeFade;
  const swell = (vnoise(x * 0.008 + 21.4, z * 0.008 + 13.9) - 0.5) * 7 * edgeFade;
  const detail = (vnoise(x * 0.05 + 11.7, z * 0.05 + 4.2) - 0.5) * 2.4 * edgeFade;
  let h = I.domeH * Math.exp(-((rEff / I.domeR) ** 2)) - 3.2 + hills + swell + detail;

  // Đồi phụ trong đảo: gò rõ rệt cho địa hình có cao thấp (tránh đường + làng P2)
  const d2 = (x + 25) * (x + 25) + (z + 50) * (z + 50);
  h += 15 * Math.exp(-(d2 / (38 * 38))) * edgeFade;

  // Mũi đá hải đăng: dựng bằng NOISE TỰ NHIÊN (không còn gò gaussian mịn) —
  // ridged noise → sống núi, rãnh, mỏm đá lởm chởm bất đối xứng, tự nhiên như
  // đồi phụ. Cộng vào đồi nên mọc liền từ địa hình, không còn đường ranh.
  const { hm, dh, hang } = headlandMask(x, z);
  if (hm > 0) {
    const rn = vnoise(x * 0.055 + h * 0.10 + 2.2, z * 0.055 - h * 0.08 + 5.5);
    const ridge = Math.pow(1 - Math.abs(2 * rn - 1), 1.7);
    const lump = fbm(x * 0.030 + 9.1, z * 0.030 + 3.3);
    // neo đỉnh ~bumpH ở tâm cho hải đăng + nhà; càng ra rìa càng lởm chởm
    const peakHold = 1 - smooth01(dh / (C.bumpR * 0.5));
    const rockH = C.bumpH * (peakHold * 0.97 + (1 - peakHold) * (0.55 + 0.40 * ridge) * (0.80 + 0.35 * lump));
    h += rockH * hm;
  }

  // Vân đá gồ ghề kiểu craggy trên phần đá dựng — TRỘN CAO ĐỘ h vào tọa độ noise
  // để chi tiết không bị kéo dài thành sọc dọc trên vách đứng (heightfield dốc).
  const crag = Math.min(Math.max((h - 14) / 10, 0), 1)
             * Math.min(Math.max((34 - dh) / 14, 0), 1);
  if (crag > 0) {
    const n1 = vnoise(x * 0.10 + h * 0.12 + 7.3, z * 0.10 - h * 0.09 + 3.1);
    const n2 = vnoise(x * 0.21 + h * 0.19 + 1.7, z * 0.21 + h * 0.15 + 9.2);
    const ridge = Math.pow(1 - Math.abs(2 * n1 - 1), 1.5);
    h += (ridge - 0.45) * 3.2 * crag + (n2 - 0.5) * 2.2 * crag;
  }

  // Đỉnh cho hải đăng + nhà gác đèn + điểm cuối lối mòn: đĩa MÉO MÓ tự nhiên —
  // mép lượn theo noise (không tròn đều như compa), mặt gợn nhẹ nhưng phẳng
  // tuyệt đối ở đúng tâm để hải đăng không bao giờ lơ lửng.
  // Sườn lên đỉnh thoai thoải đều các hướng (như đỉnh đồi thứ 2) để lối mòn leo được.
  const pdh = dh * (0.78 + 0.44 * vnoise(Math.cos(hang) * 2.6 + 1.3, Math.sin(hang) * 2.6 + 6.1));
  const padBlendW = C.padBlend * 1.75; // ~14m: sườn lên đỉnh thoải, tự nhiên
  if (pdh < C.padFlat + padBlendW) {
    const pt = 1 - smooth01((pdh - C.padFlat) / padBlendW);
    const und = (vnoise(x * 0.11 + 3.3, z * 0.11 + 7.7) - 0.5) * 1.2 * smooth01(pdh / 4);
    h = h * (1 - pt) + (C.padHeight + und) * pt;
  }
  return h;
}

// Hệ số "đĩa đỉnh" 0..1 (1 = trên mặt phẳng đỉnh) — để lối mòn tắt bench đá
// khi đã lên tới đỉnh phẳng, tránh khắc rãnh nhân tạo quanh nhà/hải đăng.
export function plateauFactor(x, z) {
  const dxh = x - HX, dzh = z - HZ;
  const dh = Math.hypot(dxh, dzh);
  const hang = Math.atan2(dzh, dxh);
  const pdh = dh * (0.78 + 0.44 * vnoise(Math.cos(hang) * 2.6 + 1.3, Math.sin(hang) * 2.6 + 6.1));
  const padBlendW = C.padBlend * 1.75;
  if (pdh >= C.padFlat + padBlendW) return 0;
  return 1 - smooth01((pdh - C.padFlat) / padBlendW);
}

// Vùng đất bằng cho P2 làng chài (~40×40m tại CONFIG.village): san phẳng về một
// cao độ duy nhất (tính 1 lần từ địa hình gốc, kẹp 2.5..6m để luôn trên mặt nước,
// gần bãi biển). Mọi module dùng baseTerrainHeight đều thấy mặt bằng này.
let _villageH = null;
export function baseTerrainHeight(x, z) {
  let h = rawHeight(x, z);
  const VG = CONFIG.village;
  // mask VUÔNG (chebyshev) → vùng bằng đúng ~40×40m cho P2 làng chài
  const vd = Math.max(Math.abs(x - VG.x), Math.abs(z - VG.z));
  if (vd < VG.flatR + VG.blendR) {
    if (_villageH === null) _villageH = Math.min(Math.max(rawHeight(VG.x, VG.z), 2.5), 6);
    const t = smooth01((vd - VG.flatR) / VG.blendR);
    h = _villageH * (1 - t) + h * t;
  }
  return h;
}

// Độ dốc tại (x,z) — dùng cho tô màu + rải cây/đá.
export function slopeAt(x, z, hFn) {
  const e = 1.2;
  const dx = (hFn(x + e, z) - hFn(x - e, z)) / (2 * e);
  const dz = (hFn(x, z + e) - hFn(x, z - e)) / (2 * e);
  return Math.hypot(dx, dz);
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
