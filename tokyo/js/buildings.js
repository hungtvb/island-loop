// buildings.js - Tòa văn phòng
import * as THREE from 'three';
import { loadGLB } from './loaders.js';

const POSITIONS = [
  // [x, z, variant, rotY]
  [-45, -30, 'a', 0], [45, -30, 'b', 0],
  [-45, 30, 'c', 0], [45, 30, 'a', Math.PI/2],
  [-80, -60, 'b', 0], [80, -60, 'c', 0],
  [-80, 60, 'a', 0], [80, 60, 'b', Math.PI/2],
  [0, -70, 'c', 0], [0, 70, 'a', 0],
];

export async function buildBuildings(scene) {
  const models = {
    a: await loadGLB('models/office_a.glb'),
    b: await loadGLB('models/office_b.glb'),
    c: await loadGLB('models/office_c.glb'),
  };
  const group = new THREE.Group();
  for (const [x, z, v, rot] of POSITIONS) {
    const b = models[v].clone();
    b.position.set(x, 0, z);
    b.rotation.y = rot;
    group.add(b);
  }
  scene.add(group);
  return group;
}
