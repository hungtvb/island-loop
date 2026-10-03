// water.js — mặt biển: gợn sóng bằng normal procedural trong fragment shader
// (không dịch chuyển đỉnh → không còn sọc/facet), bọt mép theo đúng đường bờ.
// Biển THU HẸP (CONFIG.sea.size) — mép biển chìm trong fade chân trời, không lộ mép.
import * as THREE from 'three';
import { CONFIG, MOBILE } from './config.js';

// Mặt phẳng tĩnh — mọi chi tiết sóng nằm ở normal trong fragment.
const SEA_VERT = `
varying vec3 vWorld;

void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

// Sóng analytic: đạo hàm của các sóng sin định hướng — mịn tuyệt đối.
// Mobile: 2 sóng (bản gọn, nhẹ fill-rate). Desktop: 4 sóng, biên độ dịu (~60% bản cũ).
function seaNormalGLSL() {
  const waves = MOBILE
    ? [[0.90, 0.20, 0.55, 1.4, 0.033], [-0.50, 0.80, 0.90, -1.1, 0.023]]
    : [[0.90, 0.20, 0.55, 1.4, 0.033], [-0.50, 0.80, 0.90, -1.1, 0.023],
       [0.70, -0.70, 1.60, 2.3, 0.013], [0.20, 1.00, 2.60, -2.9, 0.007]];
  let s = `
vec3 seaNormal(vec2 p, float t) {
  float dx = 0.0, dz = 0.0;`;
  waves.forEach((w, i) => {
    s += `
  { vec2 d = vec2(${w[0]}, ${w[1]}); float k = ${w[2]};
    float ph = dot(p, d) * k ${w[3] >= 0 ? '+' : '-'} t * ${Math.abs(w[3])};
    dx += ${w[4]} * d.x * k * cos(ph); dz += ${w[4]} * d.y * k * cos(ph); }`;
  });
  s += `
  return normalize(vec3(-dx, 1.0, -dz));
}`;
  return s;
}

// Thông số địa hình DÙNG CHUNG với terrain.js — bơm từ CONFIG vào GLSL để bọt/mép
// nước luôn khớp địa hình thật (đổi kích thước đồi không phải sửa tay 2 nơi).
// Chỉ cần xấp xỉ (vòm đảo + gò mũi đá, không noise) — đủ cho bọt ôm bờ và gradient sâu.
const C = CONFIG.cliff, I = CONFIG.island;
const G = {
  hx: C.x.toFixed(1), hz: C.z.toFixed(1),
  bumpH: C.bumpH.toFixed(1), bumpR: C.bumpR.toFixed(1),
  domeH: I.domeH.toFixed(1), domeR: I.domeR.toFixed(1),
};

const SEA_FRAG = `
uniform vec3 uSunDir;
uniform float uTime;
uniform vec3 uHorizonColor;
uniform float uDim;   // daynight.js: 1=ngày, ~0.28=đêm
varying vec3 vWorld;

float s01(float x) { float c = clamp(x, 0.0, 1.0); return c * c * (3.0 - 2.0 * c); }
float angWin(float ang, float center, float width) {
  float d = abs(ang - center);
  d = min(d, 6.2831853 - d);
  return 1.0 - s01(d / width);
}
// KHỚP CHÍNH XÁC coastK() trong terrain.js (chỉ dùng sin/cos nên float32/float64
// cho kết quả như nhau) — bọt biển ôm đúng đường bờ mới, không còn lệch.
float coastK(float ang) {
  float w = 0.16 * sin(2.0 * ang + 1.3) + 0.09 * sin(3.0 * ang + 4.1) + 0.05 * sin(5.0 * ang + 2.2);
  w = max(w, 0.06 * angWin(ang, 3.0585, 0.50));
  w = max(w, -0.08 * angWin(ang, -0.0567, 0.45));
  w = max(w, -0.03 * angWin(ang, 1.15, 0.95));
  return 1.0 + w;
}
float terrainHeight(vec2 p) {
  float r = length(p);
  float rEff = r / coastK(atan(p.y, p.x));
  float h = ${G.domeH} * exp(-pow(rEff / ${G.domeR}, 2.0)) - 3.2;
  vec2 d = p - vec2(${G.hx}, ${G.hz});
  float dh = length(d);
  h += ${G.bumpH} * exp(-pow(dh / ${G.bumpR}, 2.0));
  return h;
}

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
  return a + (b - a) * u.x + (c - a) * u.y + (a - b - c + d) * u.x * u.y;
}

${seaNormalGLSL()}

void main() {
  float vTerr = terrainHeight(vWorld.xz);   // tính theo từng pixel: mép bọt sắc nét
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 N = seaNormal(vWorld.xz, uTime);

  // Gradient độ sâu DỊU: nông ngọc lam nhạt → sâu xanh thẫm
  float depthT = smoothstep(1.2, -10.0, vTerr);
  vec3 deep = vec3(0.023, 0.23, 0.44);
  vec3 shal = vec3(0.15, 0.63, 0.62);
  vec3 col = mix(shal, deep, depthT);

  float fres = pow(1.0 - max(dot(V, N), 0.0), 3.0);
  col = mix(col, vec3(0.60, 0.78, 0.94), fres * 0.60);

  // Ánh nắng lấp lánh NHẸ trên gợn sóng (bản cũ 0.9 gây lốm đốm như nhiễu TV)
  vec3 R = reflect(-normalize(uSunDir), N);
  float spec = pow(max(dot(R, V), 0.0), 160.0);
  col += vec3(1.0, 0.95, 0.85) * spec * 0.35;

  // Bọt trắng quanh mép bờ — rìa vỡ tự nhiên bằng noise, MỀM và ÔM SÁT mép nước
  // (không loang ra vùng nông như bản cũ)
  float foamBand = smoothstep(1.0, 0.05, abs(vTerr + 0.20)) * smoothstep(-1.4, -0.2, vTerr);
  float fn = vnoise(vWorld.xz * 0.55 + vec2(uTime * 0.35, -uTime * 0.22));
  ${MOBILE ? '' : 'fn = 0.65 * fn + 0.35 * vnoise(vWorld.xz * 1.7 - vec2(uTime * 0.5, uTime * 0.3));'}
  float foam = foamBand * smoothstep(0.38, 0.75, fn);

  col = mix(col, vec3(0.96, 0.98, 0.99), clamp(foam, 0.0, 1.0) * 0.55);

  // Fade ra chân trời: mép biển (450m) chìm hẳn vào màu trời — không lộ mép biển
  float fogF = smoothstep(200.0, 470.0, length(cameraPosition - vWorld));
  col = mix(col, uHorizonColor, fogF);
  gl_FragColor = vec4(col * uDim, 1.0);
}`;

export function buildSea(scene) {
  const S = CONFIG.sea.size;
  const geo = new THREE.PlaneGeometry(S, S, 4, 4);   // mặt phẳng tĩnh — không cần chia đỉnh
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    vertexShader: SEA_VERT,
    fragmentShader: SEA_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(...CONFIG.sun.pos).normalize() },
      uHorizonColor: { value: new THREE.Color(0.85, 0.81, 0.74) },  // khớp màu trời ở chân trời
      uDim: { value: 1 },
    },
  });
  const sea = new THREE.Mesh(geo, mat);
  sea.position.y = 0;
  sea.frustumCulled = false;
  scene.add(sea);
  return {
    update(dt, simTime) { mat.uniforms.uTime.value = simTime; },
    uniforms: mat.uniforms,
  };
}
