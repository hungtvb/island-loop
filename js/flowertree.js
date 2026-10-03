// flowertree.js — Cây hoa anh đào Blender GLB (thay procedural cũ)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { meshHeight } from './cliff.js';
import { FLOWERTREE_P1 } from './flowertree_b64_p1.js';
import { FLOWERTREE_P2 } from './flowertree_b64_p2.js';
const FLOWERTREE_B64 = FLOWERTREE_P1 + FLOWERTREE_P2;

function b64ToArrayBuffer(b64) {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

// Vị trí 8 cây (giữ nguyên như cũ)
const TREE_SPOTS = [
  [-60, 12, 1.0], [-85, -5, 1.2], [-65, -8, 0.9],
  [-45, 38, 1.1], [30, 70, 1.0], [55, 40, 1.15],
  [-40, -25, 0.95], [-100, -20, 1.05],
];

export function buildFlowerTrees(scene) {
  return new Promise((resolve) => {
    const loader = new GLTFLoader();
    const buffer = b64ToArrayBuffer(FLOWERTREE_B64);

    loader.parse(buffer, '', (gltf) => {
      const template = gltf.scene;
      const group = new THREE.Group();

      // Petal system cho cánh hoa rơi (giữ từ bản cũ)
      const petalGeo = new THREE.PlaneGeometry(0.12, 0.09);
      const petalMat = new THREE.MeshBasicMaterial({
        color: 0xffc9e0, transparent: true, opacity: 0.85,
        side: THREE.DoubleSide, fog: false,
      });
      const petalSystems = [];

      for (const [x, z, s] of TREE_SPOTS) {
        const y = meshHeight(x, z);
        const tree = template.clone();
        tree.scale.setScalar(s);
        tree.position.set(x, y - 0.1, z);
        tree.rotation.y = Math.random() * Math.PI * 2;
        tree.traverse((obj) => {
          if (obj.isMesh) { obj.castShadow = true; }
        });
        group.add(tree);

        // Cánh hoa rơi
        const N = 20;
        const petals = new THREE.InstancedMesh(petalGeo, petalMat, N);
        const dummy = new THREE.Object3D();
        const pdata = [];
        for (let i = 0; i < N; i++) {
          pdata.push({
            x: x + (Math.random() - 0.5) * 6 * s,
            y: y + 2 + Math.random() * 4 * s,
            z: z + (Math.random() - 0.5) * 6 * s,
            vy: 0.4 + Math.random() * 0.5,
            phase: Math.random() * Math.PI * 2,
            spin: (Math.random() - 0.5) * 3,
            topY: y + 2 + Math.random() * 4 * s,
          });
        }
        petalSystems.push({ mesh: petals, data: pdata, dummy });
        group.add(petals);
      }

      group.userData.tick = (dt) => {
        for (const ps of petalSystems) {
          for (let i = 0; i < ps.data.length; i++) {
            const p = ps.data[i];
            p.y -= p.vy * dt;
            p.phase += dt * 1.5;
            if (p.y < 0.1) p.y = p.topY;
            ps.dummy.position.set(
              p.x + Math.sin(p.phase) * 0.8,
              p.y,
              p.z + Math.cos(p.phase * 0.7) * 0.6
            );
            const rot = p.phase * p.spin;
            ps.dummy.rotation.set(rot, rot * 0.7, rot * 0.5);
            ps.dummy.updateMatrix();
            ps.mesh.setMatrixAt(i, ps.dummy.matrix);
          }
          ps.mesh.instanceMatrix.needsUpdate = true;
        }
      };

      scene.add(group);
      console.log('[flowertree] Blender GLB đã gắn', TREE_SPOTS.length, 'cây');
      window.__FLOWERTREES__ = { group, count: TREE_SPOTS.length };
      resolve(group);
    }, (err) => {
      console.error('[flowertree] Lỗi load GLB:', err);
      resolve(null);
    });
  });
}
