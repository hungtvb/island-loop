// weather.js — thời tiết: nắng / nhiều mây / mưa.
// Mưa = 700 vệt line rẻ tiền rơi vòng quanh đảo; sương mù dày hơn, ánh sáng
// giảm. Chạy SAU daynight.update mỗi frame nên mọi chỉnh sửa đều tính trên
// giá trị gốc trong ngày (không cộng dồn). Không thêm đèn thật.
import * as THREE from 'three';

const MODES = {
  sunny:  { dim: 1.0,  cloudOp: 0.8,  tintK: 0.0,  fogK: 0.0 },
  cloudy: { dim: 0.62, cloudOp: 0.95, tintK: 0.45, fogK: 0.35 },
  rain:   { dim: 0.42, cloudOp: 1.0,  tintK: 0.55, fogK: 0.55 },
};
const TINT_HEX = { cloudy: 0xd8dee8, rain: 0x9aa4b5 };
const FOG_HEX = { cloudy: 0x9aa5b5, rain: 0x8a94a3 };

export function createWeather(opts) {
  const { scene, sun, hemi, clouds } = opts;
  let mode = 'sunny';

  // Mưa: vệt line đứng trong hộp 320×60×320 quanh đảo, rơi lặp vòng
  const COUNT = 700;
  const drops = [];
  for (let i = 0; i < COUNT; i++) {
    drops.push({
      x: (Math.random() - 0.5) * 320,
      y: Math.random() * 60,
      z: (Math.random() - 0.5) * 320,
      sp: 24 + Math.random() * 10,
    });
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 6), 3));
  const rainMat = new THREE.LineBasicMaterial({ color: 0xaebfd2, transparent: true, opacity: 0.35 });
  const rain = new THREE.LineSegments(rainGeo, rainMat);
  rain.visible = false;
  rain.frustumCulled = false;
  scene.add(rain);

  const _tint = new THREE.Color();
  const _base = new THREE.Color();
  const _night = new THREE.Color();

  const api = {
    setWeather(md) { if (MODES[md]) mode = md; },
    getWeather() { return mode; },
    update(dt, nightF = 0) {
      const M = MODES[mode];
      // Giảm sáng chung
      sun.intensity *= M.dim;
      hemi.intensity *= M.dim;

      // Mây: màu gốc theo ngày/đêm, xám đi khi Mây/Mưa (set tuyệt đối, không lerp tương đối)
      if (clouds && clouds.sprites) {
        _base.setHex(0xffffff).lerp(_night.setHex(0x2a3752), nightF);
        _tint.setHex(TINT_HEX[mode] || 0xffffff);
        _base.lerp(_tint, M.tintK);
        const k = Math.min(1, 2 * dt);
        for (const sp of clouds.sprites) {
          sp.material.opacity += (M.cloudOp - sp.material.opacity) * k;
          sp.material.color.copy(_base);
        }
      }

      // Sương mù dày + xám hơn
      if (M.fogK > 0) {
        scene.fog.near *= (1 - 0.35 * M.fogK);
        scene.fog.far *= (1 - 0.30 * M.fogK);
        scene.fog.color.lerp(_tint.setHex(FOG_HEX[mode]), M.fogK * 0.6);
      }

      // Mưa rơi
      const raining = mode === 'rain';
      rain.visible = raining;
      if (raining) {
        const p = rainGeo.attributes.position.array;
        for (let i = 0; i < COUNT; i++) {
          const dr = drops[i];
          dr.y -= dr.sp * dt;
          if (dr.y < 0) {
            dr.y = 60;
            dr.x = (Math.random() - 0.5) * 320;
            dr.z = (Math.random() - 0.5) * 320;
          }
          const o = i * 6;
          p[o] = dr.x; p[o + 1] = dr.y; p[o + 2] = dr.z;
          p[o + 3] = dr.x; p[o + 4] = dr.y + 1.1; p[o + 5] = dr.z;
        }
        rainGeo.attributes.position.needsUpdate = true;
      }
    },
  };
  return api;
}
