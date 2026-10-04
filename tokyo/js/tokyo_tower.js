// tokyo_tower.js
import { loadGLB } from './loaders.js';

export async function buildTokyoTower(scene) {
  const tower = await loadGLB('models/tokyo_tower.glb');
  tower.position.set(0, 0, 0);
  scene.add(tower);
  return tower;
}
