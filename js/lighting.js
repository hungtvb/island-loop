// lighting.js — nắng, bầu trời gradient, mây trôi.
import * as THREE from 'three';
import { CONFIG, FAST, MOBILE } from './config.js';

export function buildLights(scene) {
  const sun = new THREE.DirectionalLight(CONFIG.sun.color, CONFIG.sun.intensity);
  sun.position.set(...CONFIG.sun.pos);
  sun.target.position.set(30, 10, 0);
  scene.add(sun.target);
  sun.castShadow = !FAST;
  // Mobile: shadow map 1024 đủ mịn cho cảnh tĩnh, rẻ hơn 2048 rất nhiều trên GPU tile-based.
  sun.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
  const S = 120;
  sun.shadow.camera.left = -S; sun.shadow.camera.right = S;
  sun.shadow.camera.top = S; sun.shadow.camera.bottom = -S;
  sun.shadow.camera.near = 20; sun.shadow.camera.far = 600;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 1.5;
  scene.add(sun);

  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8f7f5f, 0.75);
  scene.add(hemi);
  return { sun, hemi };
}

const SKY_VERT = `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SKY_FRAG = `
uniform vec3 uSunDir;
uniform vec3 uZen;      // màu đỉnh trời (daynight.js điều khiển theo giờ)
uniform vec3 uHor;      // màu chân trời
uniform vec3 uSunTint;  // màu đĩa mặt trời (ửng đỏ lúc hoàng hôn)
uniform vec3 uMoonDir;  // hướng mặt trăng
uniform float uStarAmt; // 0=ngày, 1=đêm
uniform float uSunAmt;  // 0=đêm, 1=ngày — độ hiện của đĩa mặt trời
uniform float uMoonAmt; // 0=ngày, 1=đêm — độ hiện của đĩa mặt trăng
uniform float uTime;
varying vec3 vDir;
float hash13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHor, uZen, pow(clamp(h, 0.0, 1.0), 0.55));
  if (h < 0.0) col = mix(uHor, uZen * 0.5, clamp(-h * 3.0, 0.0, 1.0));
  vec3 sd = normalize(uSunDir);
  float s = max(dot(d, sd), 0.0);
  col += uSunTint * pow(s, 700.0) * 2.5 * uSunAmt;  // đĩa mặt trời (mờ dần về đêm)
  col += uSunTint * pow(s, 8.0) * 0.22 * uSunAmt;   // quầng sáng
  // Mặt trăng: đĩa nhạt + quầng mờ (chỉ hiện ban đêm)
  vec3 md = normalize(uMoonDir);
  float m = max(dot(d, md), 0.0);
  col += vec3(0.92, 0.95, 1.0) * smoothstep(0.99955, 0.99985, m) * 1.3 * uMoonAmt;
  col += vec3(0.50, 0.58, 0.75) * pow(m, 300.0) * 0.15 * uMoonAmt;
  // Sao: hash trên hướng nhìn, nhấp nháy nhẹ
  if (uStarAmt > 0.003 && h > 0.02) {
    vec3 g = floor(d * 230.0);
    float sh = hash13(g);
    float star = smoothstep(0.994, 1.0, sh);
    float tw = 0.65 + 0.35 * sin(uTime * 2.5 + sh * 40.0);
    col += vec3(0.85, 0.90, 1.0) * star * tw * uStarAmt * smoothstep(0.02, 0.25, h);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

export function buildSky(scene) {
  const geo = new THREE.SphereGeometry(2200, 32, 16);
  const mat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    uniforms: {
      uSunDir: { value: new THREE.Vector3(...CONFIG.sun.pos).normalize() },
      uZen: { value: new THREE.Color(0.19, 0.44, 0.84) },
      uHor: { value: new THREE.Color(0.99, 0.86, 0.67) },
      uSunTint: { value: new THREE.Color(1.0, 0.92, 0.78) },
      uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
      uStarAmt: { value: 0 },
      uSunAmt: { value: 1 },
      uMoonAmt: { value: 0 },
      uTime: { value: 0 },
    },
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.frustumCulled = false;
  scene.add(sky);
  return sky;
}

function makeCloudTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  for (let i = 0; i < 16; i++) {
    const x = 24 + Math.random() * 80, y = 44 + Math.random() * 40, r = 14 + Math.random() * 22;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Mây: sprite 2D trôi chậm. Trả về { update(dt) }.
export function buildClouds(scene) {
  const tex = makeCloudTexture();
  const clouds = [];
  for (let i = 0; i < 10; i++) {
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.8, depthWrite: false, fog: false });
    const sp = new THREE.Sprite(mat);
    const a = Math.random() * Math.PI * 2, r = 280 + Math.random() * 500;
    sp.position.set(Math.cos(a) * r, 140 + Math.random() * 90, Math.sin(a) * r);
    const s = 70 + Math.random() * 90;
    sp.scale.set(s, s * 0.45, 1);
    scene.add(sp);
    clouds.push({ sp, speed: 1.2 + Math.random() * 1.6 });
  }
  return {
    update(dt) {
      for (const c of clouds) {
        c.sp.position.x += c.speed * dt;
        if (c.sp.position.x > 800) c.sp.position.x = -800;
      }
    },
    sprites: clouds.map((c) => c.sp),
  };
}
