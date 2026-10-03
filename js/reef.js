// reef.js — Rạn san hô Blender GLB
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { meshHeight } from './cliff.js';

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
    if (window.__DBG__) window.__DBG__('reef', 'đang tải...');
    const loader = new GLTFLoader();
    loader.load('models/blender/coral.glb', (gltf) => {
      const template = gltf.scene;
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
        for (let c = 0; c < 2; c++) {
          const coral = template.clone();
          const ox = (Math.random() - 0.5) * 8;
          const oz = (Math.random() - 0.5) * 8;
          const s = 1.2 + Math.random() * 0.8;
          coral.scale.setScalar(s);
          coral.position.set(px + ox, seabed - 0.2, pz + oz);
          coral.rotation.y = Math.random() * Math.PI * 2;
          coral.traverse((obj) => { if (obj.isMesh) obj.castShadow = true; });
          group.add(coral);
          placed++;
        }
      }
      scene.add(group);
      console.log('[reef] Blender GLB đã gắn', placed, 'cụm');
      if (window.__DBG__) window.__DBG__('reef', '✅ OK (' + placed + ')');
      window.__REEF__ = { group, count: placed };
      resolve({ group, count: placed });
    }, undefined, (err) => {
      console.error('[reef] Lỗi load:', err);
      if (window.__DBG__) window.__DBG__('reef', '❌ LỖI: ' + (err.message || err));
      resolve({ group: null, count: 0 });
    });
  });
}
