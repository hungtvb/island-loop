// waterfall.js — Thác nước Blender GLB
// Model: models/blender/waterfall.glb
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { meshHeight } from './cliff.js';

export function buildWaterfall(scene) {
  return new Promise((resolve) => {
    if (window.__DBG__) window.__DBG__('waterfall', 'đang tải...');
    const loader = new GLTFLoader();
    loader.load('models/blender/waterfall.glb', (gltf) => {
      const model = gltf.scene;
      const fx = 99, fz = -5;  // dịch ra đông 3m để không bị chôn trong vách đá
      const topY = meshHeight(93, -5) - 1.5;
      const baseY = 0.3;
      const modelH = 20;
      const needH = Math.max(topY - baseY, 8);
      const s = needH / modelH;
      model.scale.setScalar(s);
      model.position.set(fx, baseY, fz);
      model.rotation.y = Math.PI / 2;
      model.traverse((obj) => {
        if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; }
      });
      scene.add(model);
      console.log('[waterfall] Blender GLB đã gắn');
      if (window.__DBG__) window.__DBG__('waterfall', '✅ OK');
      window.__WATERFALL__ = { model };
      resolve(model);
    }, undefined, (err) => {
      console.error('[waterfall] Lỗi load:', err);
      if (window.__DBG__) window.__DBG__('waterfall', '❌ LỖI: ' + (err.message || err));
      resolve(null);
    });
  });
}
