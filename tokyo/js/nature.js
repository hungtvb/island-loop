// nature.js - Cây sakura
import * as THREE from 'three';
import { loadGLB } from './loaders.js';

const POSITIONS = [
  [-35, -45], [35, -45], [-35, 45], [35, 45],
  [-70, 0], [70, 0], [12, -45], [-12, 45],
];

export async function buildNature(scene) {
  const model = await loadGLB('models/sakura.glb');
  const group = new THREE.Group();
  for (const [x, z] of POSITIONS) {
    const t = model.clone();
    t.position.set(x, 0, z);
    t.rotation.y = Math.random() * Math.PI * 2;
    const s = 0.8 + Math.random() * 0.5;
    t.scale.setScalar(s);
    group.add(t);
  }
  scene.add(group);
  return group;
}
