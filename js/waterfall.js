// waterfall.js — Thác nước đổ từ vách đá mũi hải đăng xuống biển.
// Dựng procedural: dòng thác (shader nước chảy) + bọt trắng + hồ nước + sương mù.
import * as THREE from 'three';
import { meshHeight } from './cliff.js';

// Shader dòng thác: vệt nước trắng/xanh chảy xuống
const FALL_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FALL_FRAG = `
uniform float uTime;
varying vec2 vUv;
// hash + noise đơn giản
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  // Vệt nước chảy xuống: noise kéo dài theo chiều dọc, cuộn theo thời gian
  vec2 p = vec2(vUv.x * 6.0, vUv.y * 3.0 - uTime * 1.8);
  float n = noise(p) * 0.6 + noise(p * 2.3) * 0.4;
  // Viền thác mờ dần 2 bên
  float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
  // Đầu thác (trên) đặc hơn, cuối (dưới) tơi ra
  float body = smoothstep(0.0, 0.25, vUv.y) * 0.7 + 0.3;
  vec3 waterCol = mix(vec3(0.75, 0.88, 0.95), vec3(1.0), n);
  float alpha = edge * body * (0.55 + 0.45 * n);
  gl_FragColor = vec4(waterCol, alpha);
}`;

export function buildWaterfall(scene) {
  const group = new THREE.Group();

  // Vị trí: vách đá phía đông mũi hải đăng, mặt hướng ra biển (đông)
  // Dùng meshHeight để bám địa hình thật — không lơ lửng, không chôn
  const fx = 96, fz = -5;           // chân vách đá (hướng đông)
  const cliffTop = meshHeight(93, fz);   // đỉnh vách (lùi vào đất liền 3m)
  const topY = Math.max(8, cliffTop - 1.5); // đỉnh thác dưới mép vách 1.5m, tối thiểu 8m
  const botY = 0.5;
  const fallH = topY - botY;
  const fallW = 3.5;                // rộng 3.5m

  // --- Dòng thác chính: mặt phẳng đứng ---
  const fallGeo = new THREE.PlaneGeometry(fallW, fallH, 1, 1);
  const fallMat = new THREE.ShaderMaterial({
    vertexShader: FALL_VERT,
    fragmentShader: FALL_FRAG,
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const fall = new THREE.Mesh(fallGeo, fallMat);
  // Mặt hướng đông (ra biển): xoay plane
  fall.position.set(fx, (topY + botY) / 2, fz);
  fall.rotation.y = Math.PI / 2; // plane mặc định hướng +Z, xoay để hướng +X (đông)
  // Hơi nghiêng vào vách đá
  fall.rotation.z = 0.06;
  group.add(fall);

  // --- Dòng thác phụ (mỏng hơn, lệch sang bên) ---
  const fall2 = new THREE.Mesh(
    new THREE.PlaneGeometry(fallW * 0.45, fallH * 0.85, 1, 1),
    fallMat
  );
  fall2.position.set(fx - 0.3, (topY + botY) / 2 - 1, fz + fallW * 0.7);
  fall2.rotation.y = Math.PI / 2;
  fall2.rotation.z = 0.08;
  group.add(fall2);

  // --- Vách đá sau thác (tối để thác nổi bật) ---
  const rockGeo = new THREE.PlaneGeometry(fallW * 2.2, fallH * 1.1);
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x4a4540, roughness: 0.95, metalness: 0.0,
  });
  const rock = new THREE.Mesh(rockGeo, rockMat);
  rock.position.set(fx - 0.8, (topY + botY) / 2, fz);
  rock.rotation.y = Math.PI / 2;
  group.add(rock);

  // --- Bọt trắng đầu thác ---
  const foamTopGeo = new THREE.TorusGeometry(fallW * 0.45, 0.25, 6, 12);
  const foamMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.85, fog: false,
  });
  const foamTop = new THREE.Mesh(foamTopGeo, foamMat);
  foamTop.position.set(fx, topY - 0.3, fz);
  foamTop.rotation.y = Math.PI / 2;
  group.add(foamTop);

  // --- Hồ nước dưới chân thác ---
  const poolGeo = new THREE.CircleGeometry(5, 20);
  const poolMat = new THREE.MeshStandardMaterial({
    color: 0x5fb3c9, roughness: 0.3, metalness: 0.1,
    transparent: true, opacity: 0.85,
  });
  const pool = new THREE.Mesh(poolGeo, poolMat);
  pool.rotation.x = -Math.PI / 2;
  // Hồ ở mực nước biển, nhưng nếu địa hình cao hơn thì đặt trên mặt đất
  const poolGround = meshHeight(fx + 1.5, fz);
  pool.position.set(fx + 1.5, Math.max(0.15, poolGround + 0.1), fz);
  pool.receiveShadow = true;
  group.add(pool);

  // --- Bọt trắng chân thác (vòng tròn) ---
  const foamBot = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.5, 6, 16),
    foamMat.clone()
  );
  foamBot.position.set(fx + 0.8, 0.25, fz);
  foamBot.rotation.x = Math.PI / 2;
  group.add(foamBot);

  // --- Sương mù: vài sprite trắng mờ bay lên ---
  const mistMat = new THREE.SpriteMaterial({
    color: 0xffffff, transparent: true, opacity: 0.25, fog: false,
    depthWrite: false,
  });
  const mists = [];
  for (let i = 0; i < 5; i++) {
    const sp = new THREE.Sprite(mistMat.clone());
    const s = 2 + Math.random() * 2;
    sp.scale.set(s, s, 1);
    sp.position.set(
      fx + 0.5 + (Math.random() - 0.5) * 3,
      1 + Math.random() * 2,
      fz + (Math.random() - 0.5) * 3
    );
    sp.userData = {
      baseY: sp.position.y,
      phase: Math.random() * Math.PI * 2,
      speed: 0.3 + Math.random() * 0.4,
    };
    group.add(sp);
    mists.push(sp);
  }

  // Animation: cập nhật shader + sương mù bay
  const clock = { t: 0 };
  group.userData.tick = (dt) => {
    clock.t += dt;
    fallMat.uniforms.uTime.value = clock.t;
    for (const sp of mists) {
      const u = sp.userData;
      u.phase += dt * u.speed;
      sp.position.y = u.baseY + Math.sin(u.phase) * 0.8 + (clock.t * 0.15 % 2);
      sp.material.opacity = 0.18 + 0.1 * Math.sin(u.phase * 1.3);
      // Reset khi bay quá cao
      if (sp.position.y > u.baseY + 3) {
        sp.position.y = u.baseY;
      }
    }
    // Bọt chân thác nhấp nhô
    foamBot.scale.setScalar(1 + 0.06 * Math.sin(clock.t * 3));
  };

  scene.add(group);
  window.__WATERFALL__ = group;
  return group;
}
