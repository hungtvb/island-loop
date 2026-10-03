// flowertree.js — Cây hoa hồng (sakura) kiểu anime/Ghibli.
// Dựng procedural: thân nâu + tán hoa hồng + cánh hoa rơi (particle).
import * as THREE from 'three';
import { meshHeight } from './cliff.js';

// Vị trí 8 cây: gần làng, gần đường (cách 10m+), gần ruộng, gần biển
// [x, z, scale]
const TREE_SPOTS = [
  [-60, 12, 1.0],    // gần làng (tây)
  [-85, -5, 1.2],    // gần làng (nam)
  [-65, -8, 0.9],    // gần làng
  [-45, 38, 1.1],    // gần đường (bắc làng, cách đường ~12m)
  [30, 70, 1.0],     // gần đường (nam)
  [55, 40, 1.15],    // gần đường (đông)
  [-40, -25, 0.95],  // gần ruộng lúa
  [-100, -20, 1.05], // gần biển tây
];

const PETAL_COLORS = [0xffb7d5, 0xffc9e0, 0xff9ec7, 0xffd6e8];

function buildOneTree(scale) {
  const g = new THREE.Group();

  // --- Thân: nâu sẫm, hơi cong ---
  const trunkH = 2.5 * scale;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18 * scale, 0.28 * scale, trunkH, 7),
    new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.9 })
  );
  trunk.position.y = trunkH / 2;
  trunk.castShadow = true;
  // Hơi nghiêng cho tự nhiên
  trunk.rotation.z = 0.05;
  g.add(trunk);

  // --- Cành: 3-4 cành tỏa ra ---
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + 0.4;
    const branch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06 * scale, 0.1 * scale, 1.2 * scale, 5),
      trunk.material
    );
    branch.position.set(
      Math.cos(ang) * 0.4 * scale,
      trunkH * 0.85,
      Math.sin(ang) * 0.4 * scale
    );
    branch.rotation.set(Math.sin(ang) * 0.7, 0, -Math.cos(ang) * 0.7);
    branch.castShadow = true;
    g.add(branch);
  }

  // --- Tán hoa: cụm cầu hồng ---
  const canopyY = trunkH + 0.8 * scale;
  const nPuffs = 6 + Math.floor(Math.random() * 3);
  for (let i = 0; i < nPuffs; i++) {
    const r = (0.7 + Math.random() * 0.6) * scale;
    const color = PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)];
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(r, 8, 6),
      new THREE.MeshStandardMaterial({
        color, roughness: 0.85, metalness: 0.0,
        // Hơi trong suốt cho mềm mại
        transparent: true, opacity: 0.95,
      })
    );
    const ang = Math.random() * Math.PI * 2;
    const dist = Math.random() * 1.2 * scale;
    puff.position.set(
      Math.cos(ang) * dist,
      canopyY + (Math.random() - 0.3) * 1.0 * scale,
      Math.sin(ang) * dist
    );
    puff.scale.y = 0.75; // dẹt một chút
    puff.castShadow = true;
    g.add(puff);
  }

  return g;
}

export function buildFlowerTrees(scene) {
  const group = new THREE.Group();
  const petalSystems = [];

  // Petal geometry: cánh hoa nhỏ (plane)
  const petalGeo = new THREE.PlaneGeometry(0.12, 0.09);
  const petalMat = new THREE.MeshBasicMaterial({
    color: 0xffc9e0, transparent: true, opacity: 0.85,
    side: THREE.DoubleSide, fog: false,
  });

  for (const [x, z, s] of TREE_SPOTS) {
    const y = meshHeight(x, z);
    const tree = buildOneTree(s);
    tree.position.set(x, y - 0.1, z); // chôn gốc 0.1m
    tree.rotation.y = Math.random() * Math.PI * 2;
    group.add(tree);

    // --- Cánh hoa rơi: 25 cánh quanh mỗi cây ---
    const N = 25;
    const petals = new THREE.InstancedMesh(petalGeo, petalMat, N);
    const dummy = new THREE.Object3D();
    const pdata = [];
    for (let i = 0; i < N; i++) {
      pdata.push({
        x: x + (Math.random() - 0.5) * 6 * s,
        y: y + 2 + Math.random() * 4 * s,
        z: z + (Math.random() - 0.5) * 6 * s,
        vy: 0.4 + Math.random() * 0.5,      // tốc độ rơi
        phase: Math.random() * Math.PI * 2,  // pha đung đưa
        spin: (Math.random() - 0.5) * 3,     // tốc độ xoay
        topY: y + 2 + Math.random() * 4 * s,
      });
    }
    petalSystems.push({ mesh: petals, data: pdata, dummy });
    group.add(petals);
  }

  // Animation cánh hoa rơi
  group.userData.tick = (dt, simTime) => {
    for (const ps of petalSystems) {
      for (let i = 0; i < ps.data.length; i++) {
        const p = ps.data[i];
        // Rơi xuống
        p.y -= p.vy * dt;
        // Đung đưa ngang theo gió
        p.phase += dt * 1.5;
        const swayX = Math.sin(p.phase) * 0.8;
        const swayZ = Math.cos(p.phase * 0.7) * 0.6;
        // Xoay cánh hoa
        const rot = p.phase * p.spin;
        // Reset khi chạm đất
        if (p.y < 0.1) {
          p.y = p.topY;
        }
        ps.dummy.position.set(p.x + swayX, p.y, p.z + swayZ);
        ps.dummy.rotation.set(rot, rot * 0.7, rot * 0.5);
        ps.dummy.updateMatrix();
        ps.mesh.setMatrixAt(i, ps.dummy.matrix);
      }
      ps.mesh.instanceMatrix.needsUpdate = true;
    }
  };

  scene.add(group);
  window.__FLOWERTREES__ = { group, count: TREE_SPOTS.length };
  return group;
}
