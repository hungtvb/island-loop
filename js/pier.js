// pier.js — Cầu tàu gỗ kiểu anime/Ghibli ở bãi biển phía tây.
// Dựng procedural bằng Three.js (không cần model ngoài).
// Vị trí: từ bãi cát (-128, 6) vươn ra biển tới (-148, 6), dài ~20m.

import * as THREE from 'three';
import { meshHeight } from './cliff.js';

// Gỗ kiểu Ghibli: nâu ấm, hơi thô
const WOOD = 0x8a6844;
const WOOD_DARK = 0x6b4e33;
const WOOD_LIGHT = 0xa07d52;

function woodMat(color = WOOD) {
  return new THREE.MeshStandardMaterial({
    color, roughness: 0.85, metalness: 0.0,
  });
}

export function buildPier(scene) {
  const group = new THREE.Group();
  const matWood = woodMat(WOOD);
  const matDark = woodMat(WOOD_DARK);
  const matLight = woodMat(WOOD_LIGHT);

  // Hướng cầu: từ bờ (-128, 6) ra biển (-148, 6) — dọc trục X
  const startX = -128, endX = -148, zc = 6;
  const length = Math.abs(endX - startX); // 20m
  const width = 3;                        // rộng 3m
  const deckY = 1.4;                      // mặt cầu cao 1.4m trên mực nước (y=0)

  // --- Cọc gỗ: 2 hàng, mỗi 2.5m một cặp ---
  const postGeo = new THREE.CylinderGeometry(0.14, 0.16, 4.5, 8);
  const nPosts = Math.floor(length / 2.5) + 1;
  for (let i = 0; i < nPosts; i++) {
    const x = startX - (i * 2.5);
    for (const dz of [-width / 2 + 0.2, width / 2 - 0.2]) {
      const post = new THREE.Mesh(postGeo, matDark);
      // Cọc từ dưới cát/nước lên tới mặt cầu
      const groundY = Math.min(meshHeight(x, zc + dz), 0.5);
      const postTop = deckY - 0.1;
      const postH = postTop - (groundY - 1.5); // cắm sâu 1.5m dưới đất
      post.scale.y = postH / 4.5;
      post.position.set(x, (postTop + groundY - 1.5) / 2, zc + dz);
      post.castShadow = true;
      post.receiveShadow = true;
      // Hơi nghiêng ngẫu nhiên cho tự nhiên
      post.rotation.z = (Math.sin(i * 12.9898) * 0.5) * 0.03;
      post.rotation.x = (Math.cos(i * 78.233) * 0.5) * 0.03;
      group.add(post);
    }
  }

  // --- Ván sàn: từng tấm ván ngang, có khe hở nhỏ ---
  const plankW = 0.28, gap = 0.04;
  const nPlanks = Math.floor(length / (plankW + gap));
  const plankGeo = new THREE.BoxGeometry(plankW, 0.08, width);
  for (let i = 0; i < nPlanks; i++) {
    const x = startX - 0.2 - (i * (plankW + gap));
    // Đổi màu ván xen kẽ cho tự nhiên
    const m = (i % 3 === 0) ? matLight : (i % 3 === 1 ? matWood : matDark);
    const plank = new THREE.Mesh(plankGeo, m);
    plank.position.set(x, deckY, zc);
    plank.castShadow = true;
    plank.receiveShadow = true;
    // Hơi lệch ngẫu nhiên
    plank.rotation.y = (Math.sin(i * 39.425) * 0.5) * 0.01;
    group.add(plank);
  }

  // --- Dầm dọc dưới sàn ---
  const beamGeo = new THREE.BoxGeometry(length, 0.18, 0.18);
  for (const dz of [-width / 2 + 0.2, width / 2 - 0.2]) {
    const beam = new THREE.Mesh(beamGeo, matDark);
    beam.position.set((startX + endX) / 2, deckY - 0.15, zc + dz);
    beam.castShadow = true;
    group.add(beam);
  }

  // --- Lan can 2 bên ---
  const railPostGeo = new THREE.BoxGeometry(0.09, 1.0, 0.09);
  const railTopGeo = new THREE.BoxGeometry(length, 0.08, 0.12);
  for (const dz of [-width / 2, width / 2]) {
    // Trụ lan can mỗi 2.5m
    for (let i = 0; i < nPosts; i++) {
      const x = startX - (i * 2.5);
      const rp = new THREE.Mesh(railPostGeo, matWood);
      rp.position.set(x, deckY + 0.5, zc + dz);
      rp.castShadow = true;
      group.add(rp);
    }
    // Thanh ngang trên
    const rail = new THREE.Mesh(railTopGeo, matLight);
    rail.position.set((startX + endX) / 2, deckY + 1.0, zc + dz);
    rail.castShadow = true;
    group.add(rail);
    // Thanh ngang giữa
    const railMid = new THREE.Mesh(railTopGeo, matWood);
    railMid.scale.y = 0.6;
    railMid.position.set((startX + endX) / 2, deckY + 0.55, zc + dz);
    railMid.castShadow = true;
    group.add(railMid);
  }

  // --- Chòi nhỏ cuối cầu (kiểu Ghibli): 4 cột + mái ---
  const hutX = endX + 1.5;
  const hutMat = woodMat(WOOD);
  // Sàn chòi rộng hơn
  const hutFloor = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, 4), matWood);
  hutFloor.position.set(hutX, deckY + 0.05, zc);
  hutFloor.castShadow = true;
  hutFloor.receiveShadow = true;
  group.add(hutFloor);
  // 4 cột
  const hutPostGeo = new THREE.BoxGeometry(0.14, 2.4, 0.14);
  for (const [dx, dz] of [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]]) {
    const cp = new THREE.Mesh(hutPostGeo, hutMat);
    cp.position.set(hutX + dx, deckY + 1.2, zc + dz);
    cp.castShadow = true;
    group.add(cp);
  }
  // Mái chòi: hình chóp 4 mặt (kiểu nhà Nhật)
  const roofGeo = new THREE.ConeGeometry(3.2, 1.4, 4);
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x9a4a3a, roughness: 0.9, metalness: 0.0, // ngói đỏ nâu
  });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.set(hutX, deckY + 3.1, zc);
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  group.add(roof);

  // --- Đèn lồng treo ở chòi (sáng ban đêm) ---
  const lanternGeo = new THREE.SphereGeometry(0.18, 10, 8);
  const lanternMat = new THREE.MeshBasicMaterial({ color: 0xffb45e, fog: false });
  const lantern = new THREE.Mesh(lanternGeo, lanternMat);
  lantern.scale.y = 1.3;
  lantern.position.set(hutX, deckY + 2.0, zc);
  group.add(lantern);

  // Lưu để main.js bật/tắt đèn ban đêm
  group.userData.lanternMat = lanternMat;
  group.userData.setNight = (nf) => {
    lanternMat.color.setHex(0xffb45e).multiplyScalar(0.25 + 0.75 * nf);
  };

  scene.add(group);
  window.__PIER__ = group;
  return group;
}
