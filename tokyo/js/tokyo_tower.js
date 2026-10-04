// tokyo_tower.js
import { loadGLB } from './loaders.js';

export async function buildTokyoTower(scene) {
  const tower = await loadGLB('models/tokyo_tower.glb');
  tower.position.set(28, 0, 28); // dời khỏi ngã tư, có sân riêng
  scene.add(tower);
  return tower;
}
