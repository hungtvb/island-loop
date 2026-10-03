// paddy.js — Ruộng bậc thang Blender GLB (bờ + nước) + lúa InstancedMesh
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { meshHeight } from './cliff.js';
import { PADDY_B64 } from './paddy_b64.js';

function b64ToArrayBuffer(b64) {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

const PADDY_CENTER = [-52, -18];

export function buildPaddy(scene) {
  return new Promise((resolve) => {
    const loader = new GLTFLoader();
    const buffer = b64ToArrayBuffer(PADDY_B64);

    loader.parse(buffer, '', (gltf) => {
      const terraces = gltf.scene;

      // Đặt ruộng ở vị trí cũ, bám địa hình
      const [cx, cz] = PADDY_CENTER;
      const gy = meshHeight(cx, cz);
      terraces.position.set(cx, gy, cz);
      terraces.rotation.y = 0.2;
      terraces.traverse((obj) => {
        if (obj.isMesh) {
          obj.receiveShadow = true;
          obj.castShadow = true;
        }
      });
      scene.add(terraces);

      // Lúa: InstancedMesh
      const riceGeo = new THREE.ConeGeometry(0.09, 0.65, 5);
      const riceMat = new THREE.MeshStandardMaterial({
        color: 0x5da24a, roughness: 0.8,
      });
      const ROWS = 8, COLS = 12;
      const riceIM = new THREE.InstancedMesh(riceGeo, riceMat, ROWS * COLS * 4);
      const dummy = new THREE.Object3D();
      let idx = 0;

      for (let t = 0; t < 4; t++) {
        const ty = -t * 12.5;
        const tz = -t * 0.9;
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const rx = -6 + c * 1.1 + (Math.random() - 0.5) * 0.3;
            const ry = ty - 4 + r * 1.1 + (Math.random() - 0.5) * 0.3;
            dummy.position.set(cx + rx, gy + tz + 0.35, cz + ry);
            dummy.rotation.set(
              (Math.random() - 0.5) * 0.15,
              Math.random() * Math.PI * 2,
              (Math.random() - 0.5) * 0.15
            );
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
      group.add(terraces);
      group.add(riceIM);
      group.userData.tick = () => {}; // lúa tĩnh (tránh lỗi xoay quanh origin)

      console.log('[paddy] Blender GLB đã gắn +', idx, 'cây lúa');
      window.__PADDY__ = { group, riceCount: idx };
      resolve(group);
    }, (err) => {
      console.error('[paddy] Lỗi load GLB:', err);
      resolve(null);
    });
  });
}
