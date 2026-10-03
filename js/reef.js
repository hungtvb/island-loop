// reef.js — Rạn san hô stylized kiểu anime/Ghibli ở vùng nước nông quanh đảo.
// Dựng procedural bằng Three.js. San hô nhô khỏi mặt nước (nước opaque nên
// phần dưới mặt nước không thấy — san hô vươn lên trên để nhìn được).
import * as THREE from 'three';
import { meshHeight } from './cliff.js';

// Màu san hô tươi kiểu Ghibli
const CORAL_COLORS = {
  branch: [0xff7e8a, 0xff9e6b, 0xff6b9d],  // hồng/cam
  mound: [0x9b7ede, 0x6bc5d6, 0x7ed6a8],   // tím/xanh lá nhạt
  tube: [0xffd66b, 0xffb45e, 0xfff08a],    // vàng
};

function coralMat(color) {
  return new THREE.MeshStandardMaterial({
    color, roughness: 0.7, metalness: 0.0,
  });
}

// San hô cành: thân chính + các nhánh
function buildBranchCoral(mats, rng) {
  const g = new THREE.Group();
  const color = CORAL_COLORS.branch[Math.floor(rng() * CORAL_COLORS.branch.length)];
  const mat = coralMat(color);
  const h = 1.2 + rng() * 1.0; // cao 1.2-2.2m

  // Thân chính
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, h, 6), mat);
  trunk.position.y = h / 2;
  trunk.castShadow = true;
  g.add(trunk);

  // Nhánh: 4-7 nhánh tỏa ra
  const nBranches = 4 + Math.floor(rng() * 4);
  for (let i = 0; i < nBranches; i++) {
    const bh = 0.5 + rng() * 0.7;
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, bh, 5), mat);
    const ang = (i / nBranches) * Math.PI * 2 + rng() * 0.5;
    const tilt = 0.4 + rng() * 0.4;
    branch.position.set(
      Math.cos(ang) * 0.15,
      h * (0.5 + rng() * 0.4),
      Math.sin(ang) * 0.15
    );
    branch.rotation.set(
      Math.sin(ang) * tilt,
      0,
      -Math.cos(ang) * tilt
    );
    // Dịch nhánh ra ngoài theo hướng nghiêng
    branch.translateY(bh / 2 - 0.1);
    branch.castShadow = true;
    g.add(branch);

    // Đầu nhánh: quả cầu nhỏ
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), mat);
    tip.position.copy(branch.position);
    tip.position.y += bh / 2;
    g.add(tip);
  }
  return g;
}

// San hô khối: cụm cầu lồi
function buildMoundCoral(mats, rng) {
  const g = new THREE.Group();
  const color = CORAL_COLORS.mound[Math.floor(rng() * CORAL_COLORS.mound.length)];
  const mat = coralMat(color);
  const n = 5 + Math.floor(rng() * 4);
  for (let i = 0; i < n; i++) {
    const r = 0.25 + rng() * 0.35;
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), mat);
    const ang = rng() * Math.PI * 2;
    const dist = rng() * 0.5;
    s.position.set(Math.cos(ang) * dist, r * 0.6, Math.sin(ang) * dist);
    s.scale.y = 0.7 + rng() * 0.4;
    s.castShadow = true;
    g.add(s);
  }
  return g;
}

// San hô ống: các ống đứng
function buildTubeCoral(mats, rng) {
  const g = new THREE.Group();
  const color = CORAL_COLORS.tube[Math.floor(rng() * CORAL_COLORS.tube.length)];
  const mat = coralMat(color);
  const n = 4 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const h = 0.6 + rng() * 0.9;
    const r = 0.09 + rng() * 0.06;
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.8, h, 7), mat);
    const ang = rng() * Math.PI * 2;
    const dist = rng() * 0.4;
    tube.position.set(Math.cos(ang) * dist, h / 2, Math.sin(ang) * dist);
    // Hơi nghiêng
    tube.rotation.x = (rng() - 0.5) * 0.2;
    tube.rotation.z = (rng() - 0.5) * 0.2;
    tube.castShadow = true;
    g.add(tube);
    // Miệng ống: vòng tròn đậm hơn
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(r * 0.85, 0.025, 5, 10),
      coralMat(0xfff8e0)
    );
    rim.position.copy(tube.position);
    rim.position.y += h / 2;
    rim.rotation.x = Math.PI / 2 + tube.rotation.x;
    g.add(rim);
  }
  return g;
}

// Tìm điểm nước nông: đáy từ -0.4 đến -1.2m (san hô cao 1.5-2.5m sẽ nhô khỏi mặt nước)
function findShallowSpot(x, z, dx, dz) {
  for (let d = 8; d <= 60; d += 4) {
    const px = x + dx * d, pz = z + dz * d;
    const h = meshHeight(px, pz);
    if (h < -0.4 && h > -1.2) return [px, pz, h];
  }
  return null;
}

export function buildReef(scene) {
  const rng = Math.random;
  const group = new THREE.Group();
  const builders = [buildBranchCoral, buildMoundCoral, buildTubeCoral];

  // Các cụm san hô quanh đảo (hướng từ tâm đảo ra biển)
  const spots = [
    // Bãi nam (gần rùa/cá)
    [2, 106, 0.02, 1],
    [15, 100, 0.15, 0.99],
    [-10, 102, -0.1, 0.99],
    // Bãi tây (gần cầu tàu nhưng không chắn đường thuyền)
    [-140, -5, -1, -0.05],
    [-142, 18, -1, 0.1],
    // Bãi đông
    [105, 20, 0.98, 0.2],
    [100, -30, 0.95, -0.3],
    // Bãi bắc
    [-20, -105, -0.2, -0.98],
    [30, -100, 0.3, -0.95],
  ];

  let placed = 0;
  for (const [x, z, dx, dz] of spots) {
    const found = findShallowSpot(x, z, dx, dz);
    if (!found) continue;
    const [px, pz, seabed] = found;

    // Mỗi điểm: 1-3 cụm san hô
    const nClusters = 1 + Math.floor(rng() * 3);
    for (let c = 0; c < nClusters; c++) {
      const builder = builders[Math.floor(rng() * builders.length)];
      const coral = builder(null, rng);
      const ox = (rng() - 0.5) * 6;
      const oz = (rng() - 0.5) * 6;
      // Đặt đáy san hô dưới đáy biển một chút (không lơ lửng)
      coral.position.set(px + ox, seabed - 0.15, pz + oz);
      coral.rotation.y = rng() * Math.PI * 2;
      // Scale đảm bảo đỉnh nhô khỏi mặt nước: đáy sâu bao nhiêu thì scale bấy nhiêu
      // (san hô gốc cao ~1.5m, cần đỉnh > 0.3m trên mặt nước)
      const depth = Math.abs(seabed - 0.15);
      const needH = depth + 0.4; // chiều cao cần thiết
      const s = Math.max(0.8 + rng() * 0.6, needH / 1.5);
      coral.scale.setScalar(Math.min(s, 2.5)); // giới hạn không quá to
      group.add(coral);
      placed++;
    }
  }

  scene.add(group);
  window.__REEF__ = { group, count: placed };
  return { group, count: placed };
}
