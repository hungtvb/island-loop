// reef.js — Rạn san hô Blender GLB (thay procedural cũ)
// Model: 3 loại san hô (cành hồng, khối tím, ống vàng)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { meshHeight } from './cliff.js';
import { CORAL_P1 } from './coral_b64_p1.js';
import { CORAL_P2 } from './coral_b64_p2.js';
import { CORAL_P3 } from './coral_b64_p3.js';
import { CORAL_P4 } from './coral_b64_p4.js';
import { CORAL_P5 } from './coral_b64_p5.js';
import { CORAL_P6 } from './coral_b64_p6.js';
import { CORAL_P7 } from './coral_b64_p7.js';
import { CORAL_P8 } from './coral_b64_p8.js';
import { CORAL_P9 } from './coral_b64_p9.js';
import { CORAL_P10 } from './coral_b64_p10.js';
const CORAL_B64 = CORAL_P1 + CORAL_P2 + CORAL_P3 + CORAL_P4 + CORAL_P5 + CORAL_P6 + CORAL_P7 + CORAL_P8 + CORAL_P9 + CORAL_P10;

function b64ToArrayBuffer(b64) {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

// Tìm điểm nước nông
function findShallowSpot(x, z, dx, dz) {
  for (let d = 8; d <= 60; d += 4) {
    const px = x + dx * d, pz = z + dz * d;
    const h = meshHeight(px, pz);
    if (h < -0.4 && h > -1.5) return [px, pz, h];
  }
  return null;
}

export function buildReef(scene) {
  return new Promise((resolve) => {
    const loader = new GLTFLoader();
    const buffer = b64ToArrayBuffer(CORAL_B64);

    loader.parse(buffer, '', (gltf) => {
      const template = gltf.scene;

      // Các điểm đặt san hô quanh đảo
      const spots = [
        [2, 106, 0.02, 1], [15, 100, 0.15, 0.99], [-10, 102, -0.1, 0.99],
        [-140, -5, -1, -0.05], [-142, 18, -1, 0.1],
        [105, 20, 0.98, 0.2], [100, -30, 0.95, -0.3],
        [-20, -105, -0.2, -0.98], [30, -100, 0.3, -0.95],
      ];

      const group = new THREE.Group();
      let placed = 0;

      for (const [x, z, dx, dz] of spots) {
        const found = findShallowSpot(x, z, dx, dz);
        if (!found) continue;
        const [px, pz, seabed] = found;

        // Mỗi điểm: 2 cụm san hô
        for (let c = 0; c < 2; c++) {
          const coral = template.clone();
          const ox = (Math.random() - 0.5) * 8;
          const oz = (Math.random() - 0.5) * 8;

          // Đặt sao cho nhô khỏi mặt nước ~0.5m
          // Model cao ~3m (sau khi scale 1.5), đặt đáy ở seabed - 0.2
          const s = 1.2 + Math.random() * 0.8;
          coral.scale.setScalar(s);
          coral.position.set(px + ox, seabed - 0.2, pz + oz);
          coral.rotation.y = Math.random() * Math.PI * 2;

          coral.traverse((obj) => {
            if (obj.isMesh) { obj.castShadow = true; }
          });

          group.add(coral);
          placed++;
        }
      }

      scene.add(group);
      console.log('[reef] Blender GLB đã gắn', placed, 'cụm');
      window.__REEF__ = { group, count: placed };
      resolve({ group, count: placed });
    }, (err) => {
      console.error('[reef] Lỗi load GLB:', err);
      resolve({ group: null, count: 0 });
    });
  });
}
