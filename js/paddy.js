// paddy.js — Ruộng lúa bậc thang kiểu anime/Ghibli gần làng chài.
// Dựng procedural: bờ đất + mặt nước + lúa (instanced, đung đưa trong gió).
import * as THREE from 'three';
import { meshHeight } from './cliff.js';

// Vị trí: đông-nam làng chài, đất tương đối bằng, tránh đường và nhà
// Làng ở (-72, 6), đường vòng phía bắc (z=20+), nên đặt ruộng ở phía nam
const PADDY_CENTER = [-52, -18];
const TERRACES = 4;           // 4 tầng
const TERRACE_W = 14;         // rộng 14m mỗi tầng
const TERRACE_D = 10;         // sâu 10m mỗi tầng
const STEP_H = 0.9;           // mỗi tầng thấp hơn 0.9m
const GAP = 2.5;              // khoảng cách giữa các tầng

export function buildPaddy(scene) {
  const group = new THREE.Group();
  const baseH = meshHeight(PADDY_CENTER[0], PADDY_CENTER[1]);

  const earthMat = new THREE.MeshStandardMaterial({
    color: 0x7a5c3d, roughness: 0.95, metalness: 0.0, // đất nâu
  });
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x7ec8d8, roughness: 0.15, metalness: 0.3, // nước phản chiếu
    transparent: true, opacity: 0.85,
  });
  const riceMat = new THREE.MeshStandardMaterial({
    color: 0x5da24a, roughness: 0.8, metalness: 0.0, // lúa xanh
    side: THREE.DoubleSide,
  });

  const riceInstances = [];
  const dummy = new THREE.Object3D();

  for (let t = 0; t < TERRACES; t++) {
    // Mỗi tầng lùi dần về phía nam và thấp dần
    const cx = PADDY_CENTER[0] + t * 3;  // hơi lệch đông mỗi tầng
    const cz = PADDY_CENTER[1] - t * (TERRACE_D + GAP);
    const cy = baseH - t * STEP_H;
    // Bám địa hình: lấy cao độ thực tế
    const groundY = meshHeight(cx, cz);
    const y = Math.min(cy, groundY + 0.3);

    // --- Bờ đất: khung viền quanh ruộng ---
    const wallH = 0.7, wallT = 0.6;
    // 4 bờ
    const walls = [
      [TERRACE_W + wallT * 2, wallH, wallT, 0, -TERRACE_D / 2],           // bắc
      [TERRACE_W + wallT * 2, wallH, wallT, 0, TERRACE_D / 2],            // nam
      [wallT, wallH, TERRACE_D, -TERRACE_W / 2, 0],                       // tây
      [wallT, wallH, TERRACE_D, TERRACE_W / 2, 0],                        // đông
    ];
    for (const [w, h, d, ox, oz] of walls) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), earthMat);
      wall.position.set(cx + ox, y - h / 2 + 0.1, cz + oz);
      wall.castShadow = true;
      wall.receiveShadow = true;
      group.add(wall);
    }

    // --- Đáy ruộng (đất) ---
    const bed = new THREE.Mesh(
      new THREE.BoxGeometry(TERRACE_W, 0.2, TERRACE_D),
      earthMat
    );
    bed.position.set(cx, y - 0.25, cz);
    bed.receiveShadow = true;
    group.add(bed);

    // --- Mặt nước ---
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(TERRACE_W - 0.3, TERRACE_D - 0.3),
      waterMat
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(cx, y - 0.05, cz);
    water.receiveShadow = true;
    group.add(water);

    // --- Lúa: rải đều trong ruộng (instanced sau) ---
    const rows = 8, cols = 12;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lx = cx - TERRACE_W / 2 + 1 + (c / (cols - 1)) * (TERRACE_W - 2);
        const lz = cz - TERRACE_D / 2 + 1 + (r / (rows - 1)) * (TERRACE_D - 2);
        // Ngẫu nhiên nhẹ
        const jx = (Math.random() - 0.5) * 0.5;
        const jz = (Math.random() - 0.5) * 0.5;
        riceInstances.push({
          x: lx + jx, y: y, z: lz + jz,
          s: 0.7 + Math.random() * 0.5,
          rot: Math.random() * Math.PI * 2,
          phase: Math.random() * Math.PI * 2,
        });
      }
    }
  }

  // --- Dựng InstancedMesh cho lúa ---
  // Cây lúa: 3 lá chéo nhau (dạng nón dẹt)
  const riceGeo = new THREE.ConeGeometry(0.18, 0.7, 5);
  riceGeo.translate(0, 0.35, 0); // gốc ở đáy
  const riceIM = new THREE.InstancedMesh(riceGeo, riceMat, riceInstances.length);
  riceInstances.forEach((rc, i) => {
    dummy.position.set(rc.x, rc.y, rc.z);
    dummy.rotation.set(0, rc.rot, 0);
    dummy.scale.setScalar(rc.s);
    dummy.updateMatrix();
    riceIM.setMatrixAt(i, dummy.matrix);
  });
  riceIM.castShadow = true;
  riceIM.instanceMatrix.needsUpdate = true;
  group.add(riceIM);

  // Animation đung đưa: xoay nhẹ theo gió (dùng onBeforeRender hoặc tick)
  // Đơn giản: lưu để main.js tick
  group.userData.tick = (dt, simTime) => {
    // Đung đưa bằng cách xoay group lúa rất nhẹ — rẻ hơn update từng instance
    riceIM.rotation.z = 0.02 * Math.sin(simTime * 1.2);
    riceIM.rotation.x = 0.015 * Math.cos(simTime * 0.9);
  };
  group.userData.riceIM = riceIM;

  scene.add(group);
  window.__PADDY__ = { group, terraces: TERRACES, riceCount: riceInstances.length };
  return group;
}
