// paddy.js — Ruộng bậc thang Blender GLB + lúa InstancedMesh
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { meshHeight } from './cliff.js';

const PADDY_CENTER = [-52, -18];

export function buildPaddy(scene) {
  return new Promise((resolve) => {
    if (window.__DBG__) window.__DBG__('paddy', 'đang tải...');
    const loader = new GLTFLoader();
    loader.load('models/blender/paddy.glb', (gltf) => {
      const terraces = gltf.scene;
      const [cx, cz] = PADDY_CENTER;
      const gy = meshHeight(cx, cz);
      terraces.position.set(cx, gy, cz);
      terraces.rotation.y = 0.2;
      terraces.traverse((obj) => {
        if (obj.isMesh) { obj.receiveShadow = true; obj.castShadow = true; }
      });
      scene.add(terraces);
      const riceGeo = new THREE.ConeGeometry(0.09, 0.65, 5);
      const riceMat = new THREE.MeshStandardMaterial({ color: 0x5da24a, roughness: 0.8 });
      const riceIM = new THREE.InstancedMesh(riceGeo, riceMat, 384);
      const dummy = new THREE.Object3D();
      let idx = 0;
      for (let t = 0; t < 4; t++) {
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 12; c++) {
            const rx = -6 + c * 1.1 + (Math.random() - 0.5) * 0.3;
            const ry = -t * 12.5 - 4 + r * 1.1 + (Math.random() - 0.5) * 0.3;
            dummy.position.set(cx + rx, gy - t * 0.9 + 0.35, cz + ry);
            dummy.rotation.set((Math.random()-0.5)*0.15, Math.random()*Math.PI*2, (Math.random()-0.5)*0.15);
            const s = 0.8 + Math.random() * 0.4;
            dummy.scale.set(s, s, s);
            dummy.updateMatrix();
            riceIM.setMatrixAt(idx++, dummy.matrix);
          }
        }
      }
      riceIM.count = idx;
      riceIM.castShadow = true;
      scene.add(riceIM);
      const group = new THREE.Group();
      group.add(terraces); group.add(riceIM);
      group.userData.tick = () => {};
      console.log('[paddy] Blender GLB đã gắn');
      if (window.__DBG__) window.__DBG__('paddy', '✅ OK');
      window.__PADDY__ = { group };
      resolve(group);
    }, undefined, (err) => {
      console.error('[paddy] Lỗi load:', err);
      if (window.__DBG__) window.__DBG__('paddy', '❌ LỖI: ' + (err.message || err));
      resolve(null);
    });
  });
}
