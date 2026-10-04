// streets.js - Đường và đèn đường
import * as THREE from 'three';
import { loadGLB } from './loaders.js';

export async function buildStreets(scene) {
  const group = new THREE.Group();
  
  // Đường nhựa (grid)
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.95 });
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.8 });
  
  // 2 đường chính cắt nhau
  for (const [w, d, x, z] of [[200, 10, 0, 0], [10, 200, 0, 0]]) {
    const road = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), roadMat);
    road.position.set(x, 0.1, z);
    road.receiveShadow = true;
    group.add(road);
  }
  // Vạch kẻ đường
  for (let i = -90; i <= 90; i += 8) {
    if (Math.abs(i) < 8) continue; // bỏ qua ngã tư
    const l1 = new THREE.Mesh(new THREE.BoxGeometry(3, 0.05, 0.3), lineMat);
    l1.position.set(i, 0.22, 0);
    group.add(l1);
    const l2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 3), lineMat);
    l2.position.set(0, 0.22, i);
    group.add(l2);
  }
  // Vạch qua đường Shibuya (ngã tư)
  for (let i = -4; i <= 4; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 8), lineMat);
    s.position.set(i * 2, 0.22, 0);
    group.add(s);
  }
  
  // Đèn đường
  const lampModel = await loadGLB('models/streetlight.glb');
  for (let i = -80; i <= 80; i += 40) {
    for (const [x, z, rot] of [[i, 7, 0], [i, -7, Math.PI]]) {
      if (Math.abs(i) < 10) continue;
      const lamp = lampModel.clone();
      lamp.position.set(x, 0, z);
      lamp.rotation.y = rot;
      group.add(lamp);
    }
    for (const [x, z, rot] of [[7, i, -Math.PI/2], [-7, i, Math.PI/2]]) {
      if (Math.abs(i) < 10) continue;
      const lamp = lampModel.clone();
      lamp.position.set(x, 0, z);
      lamp.rotation.y = rot;
      group.add(lamp);
    }
  }
  
  scene.add(group);
  return group;
}
