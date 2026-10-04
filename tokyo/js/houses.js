// houses.js - Nhà truyền thống
import * as THREE from 'three';
import { loadGLB } from './loaders.js';

const POSITIONS = [
  [-25, -55, 0], [25, -55, 0], [-25, 55, Math.PI], [25, 55, Math.PI],
  [-60, -15, Math.PI/2], [60, -15, -Math.PI/2],
];

export async function buildHouses(scene) {
  const model = await loadGLB('models/jp_house.glb');
  const group = new THREE.Group();
  for (const [x, z, rot] of POSITIONS) {
    const h = model.clone();
    h.position.set(x, 0, z);
    h.rotation.y = rot;
    group.add(h);
  }
  scene.add(group);
  return group;
}
