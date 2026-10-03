// daynight.js — chu kỳ ngày/đêm kiểu Ghibli.
// Ban đêm trời KHÔNG tối đen hoàn toàn: vẫn nhìn rõ cảnh nhờ ánh trăng xanh
// nhạt + sao. Điều khiển mặt trời/mặt trăng, màu trời, sương mù, độ phơi sáng.
// Các module khác (đèn, xe, nhà...) đọc nightFactor (0=ngày, 1=đêm) để bật/tắt.
import * as THREE from 'three';

const _c1 = new THREE.Color(), _c2 = new THREE.Color();

function sstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// Bảng màu theo giờ: [giờ, hex] — nội suy vòng 24h.
const ZEN_STOPS = [
  [0, 0x070b18], [4.5, 0x070b18], [6, 0x3d4c7d], [7.5, 0x2e6cc8],
  [12, 0x306fd6], [16, 0x2d68bd], [17.5, 0x4c4a8c], [18.7, 0x2b2b58],
  [20, 0x0a1028], [22, 0x070b18], [24, 0x070b18],
];
const HOR_STOPS = [
  [0, 0x18243d], [4.5, 0x18243d], [6, 0xe8a06a], [7.5, 0xf2ddba],
  [12, 0xfcdcae], [16, 0xf5d9a8], [17.5, 0xff9a55], [18.7, 0xe86a4a],
  [20, 0x2b2b4e], [22, 0x18243d], [24, 0x18243d],
];

function stopColor(stops, h, out) {
  let i = 0;
  while (i < stops.length - 2 && h >= stops[i + 1][0]) i++;
  const h0 = stops[i][0], c0 = stops[i][1];
  const h1 = stops[i + 1][0], c1 = stops[i + 1][1];
  const t = Math.min(1, Math.max(0, (h - h0) / Math.max(1e-5, h1 - h0)));
  out.setHex(c0).lerp(_c2.setHex(c1), t);
  return out;
}

export function createDayNight(opts) {
  const { scene, renderer, sun, hemi, sky, clouds, sea } = opts;
  const U = sky.material.uniforms;
  const sunDir = new THREE.Vector3();
  const moonDir = new THREE.Vector3();
  let time = 9;    // giờ trong ngày (0-24) — mặc định 9h sáng
  let elapsed = 0;

  const api = {
    nightFactor: 0,   // 0 = ngày hẳn, 1 = đêm hẳn (nội suy mượt lúc chạng vạng)
    setTime(h) { time = ((h % 24) + 24) % 24; },
    getTime() { return time; },
    isNight() { return api.nightFactor > 0.5; },
    update(dt) {
      elapsed += dt;
      // Mặt trời mọc 6h (đông) — lặn 18h (tây); nửa đêm mặt trời ở đáy
      const ang = ((time - 6) / 12) * Math.PI;
      const sinA = Math.sin(ang);
      const dayF = sstep(-0.06, 0.28, sinA);
      const nightF = 1 - dayF;
      api.nightFactor = nightF;

      sunDir.set(Math.cos(ang) * 0.85, sinA, 0.45).normalize();
      moonDir.copy(sunDir).negate();

      // Mặt trời / ánh trăng dùng chung 1 directional light (giữ nguyên bóng đổ)
      const duskF = Math.min(1, Math.max(0, 1 - Math.abs(sinA) / 0.4)) * (1 - nightF);
      _c1.setHex(0xffe7c4).lerp(_c2.setHex(0xff9a50), duskF * 0.85); // hoàng hôn ửng cam
      _c1.lerp(_c2.setHex(0x9db4dd), nightF);                          // đêm: xanh ánh trăng
      sun.color.copy(_c1);
      sun.intensity = 2.8 * dayF + 0.5 * nightF;
      sun.position.copy(dayF >= 0.5 ? sunDir : moonDir).multiplyScalar(300);

      // Sáng môi trường
      hemi.intensity = 0.75 * dayF + 0.30 * nightF;
      hemi.color.setHex(0xbfd9ff).lerp(_c2.setHex(0x24304d), nightF);
      hemi.groundColor.setHex(0x8f7f5f).lerp(_c2.setHex(0x11141c), nightF);

      // Bầu trời: gradient + mặt trời/mặt trăng/sao theo giờ
      stopColor(ZEN_STOPS, time, U.uZen.value);
      stopColor(HOR_STOPS, time, U.uHor.value);
      U.uSunDir.value.copy(sunDir);
      U.uMoonDir.value.copy(moonDir);
      U.uStarAmt.value = nightF;
      U.uTime.value = elapsed;
      _c1.setHex(0xffffff).lerp(_c2.setHex(0xffb37a), duskF);
      U.uSunTint.value.copy(_c1);

      // Sương mù + phơi sáng: đêm se lại, tối hơn nhưng vẫn thấy cảnh
      scene.fog.color.setHex(0xcfe0f2).lerp(_c2.setHex(0x111b30), nightF);
      scene.fog.near = 260 - 70 * nightF;
      scene.fog.far = 1200 - 350 * nightF;
      renderer.toneMappingExposure = 1.05 - 0.18 * nightF;

      // Mây nhuộm theo giờ
      if (clouds && clouds.sprites) {
        _c1.setHex(0xffffff).lerp(_c2.setHex(0x2a3752), nightF);
        for (const sp of clouds.sprites) sp.material.color.copy(_c1);
      }

      // Biển: tối theo đêm, chân trời khớp màu trời
      if (sea && sea.uniforms) {
        sea.uniforms.uDim.value = 1 - 0.72 * nightF;
        sea.uniforms.uHorizonColor.value.copy(U.uHor.value);
        sea.uniforms.uSunDir.value.copy(dayF >= 0.5 ? sunDir : moonDir);
      }
    },
  };
  api.update(0);
  return api;
}
