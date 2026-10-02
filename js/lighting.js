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
  return { sun };
}

const SKY_VERT = `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SKY_FRAG = `
uniform vec3 uSunDir;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 zen = vec3(0.19, 0.44, 0.84);
  vec3 hor = vec3(0.99, 0.86, 0.67);
  vec3 col = mix(hor, zen, pow(clamp(h, 0.0, 1.0), 0.55));
  if (h < 0.0) col = mix(hor, vec3(0.58, 0.72, 0.86), clamp(-h * 3.0, 0.0, 1.0));
  vec3 sd = normalize(uSunDir);
  float s = max(dot(d, sd), 0.0);
  col += vec3(1.0, 0.92, 0.78) * pow(s, 700.0) * 2.5;  // đĩa mặt trời
  col += vec3(1.0, 0.80, 0.55) * pow(s, 8.0) * 0.22;   // quầng sáng
  gl_FragColor = vec4(col, 1.0);
}`;

export function buildSky(scene) {
  const geo = new THREE.SphereGeometry(2200, 32, 16);
  const mat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    uniforms: { uSunDir: { value: new THREE.Vector3(...CONFIG.sun.pos).normalize() } },
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
  };
}
