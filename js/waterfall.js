// waterfall.js — Thác nước Blender GLB (thay procedural cũ)
// Model: models/blender/waterfall.glb (vách đá + dòng nước + bọt + hồ)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { meshHeight } from './cliff.js';
import { WATERFALL_B64 } from './waterfall_b64.js';

function b64ToArrayBuffer(b64) {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export function buildWaterfall(scene) {
  return new Promise((resolve) => {
    const loader = new GLTFLoader();
    const buffer = b64ToArrayBuffer(WATERFALL_B64);

    loader.parse(buffer, '', (gltf) => {
      const model = gltf.scene;

      // Vị trí thác: vách đá phía đông (96, -5)
      // Đỉnh thác bám địa hình, chân ở mặt nước
      const fx = 96, fz = -5;
      const topY = meshHeight(93, -5) - 1.5;  // lùi vào 3m
      const baseY = 0.3;  // mặt nước

      // Model Blender cao 20m, scale để khớp chiều cao thực
      const modelH = 20;
      const needH = Math.max(topY - baseY, 8);
      const s = needH / modelH;

      model.scale.setScalar(s);
      // Đặt chân model ở mặt nước, xoay để mặt trước hướng ra biển (đông)
      model.position.set(fx, baseY, fz);
      model.rotation.y = Math.PI / 2;  // mặt trước (y+) hướng đông (+x)

      model.traverse((obj) => {
        if (obj.isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });

      scene.add(model);
      console.log('[waterfall] Blender GLB đã gắn, scale:', s.toFixed(2));
      window.__WATERFALL__ = { model, scale: s };
      resolve(model);
    }, (err) => {
      console.error('[waterfall] Lỗi load GLB:', err);
      resolve(null);
    });
  });
}
