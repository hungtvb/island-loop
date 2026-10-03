// waterfall.js — Thác nước Blender GLB
// Model: models/blender/waterfall.glb
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { meshHeight } from './cliff.js';

export function buildWaterfall(scene) {
  return new Promise((resolve) => {
    const loader = new GLTFLoader();
    loader.load('models/blender/waterfall.glb', (gltf) => {
      const model = gltf.scene;
      // Vách đá dốc từ x=96 (30m) xuống x=114 (5m). Đặt thác ở x=108 (địa hình 11m)
      // để không bị chôn dưới đất
      const fx = 108, fz = -5;
      const topY = 29.0;  // đỉnh vách đá
      const baseY = 0.3;
      const modelH = 20;
      const needH = topY - baseY;
      const s = needH / modelH;
      model.scale.setScalar(s);
      model.position.set(fx, baseY, fz);
      model.rotation.y = Math.PI / 2;  // mặt trước hướng đông
      model.traverse((obj) => {
        if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; }
      });
      scene.add(model);
      console.log('[waterfall] Blender GLB đã gắn');
      window.__WATERFALL__ = { model };
      resolve(model);
    }, undefined, (err) => {
      console.error('[waterfall] Lỗi load:', err);
      resolve(null);
    });
  });
}
