// main.js - Entry point
import * as THREE from 'three';
import { createScene } from './scene.js';
import { buildTokyoTower } from './tokyo_tower.js';
import { buildBuildings } from './buildings.js';
import { buildHouses } from './houses.js';
import { buildNature } from './nature.js';
import { buildStreets } from './streets.js';
import { buildCars, updateCars, toggleCars } from './cars.js';

const { scene, camera, renderer, controls } = createScene();

// UI
const loadLabel = document.getElementById('load-label');
const loadPct = document.getElementById('load-pct');
const loadFill = document.getElementById('load-bar-fill');
const loader_el = document.getElementById('loader');

function setProgress(label, pct) {
  loadLabel.textContent = label;
  loadPct.textContent = pct + '%';
  loadFill.style.width = pct + '%';
}

async function init() {
  const steps = [
    ['Tháp Tokyo', buildTokyoTower],
    ['Tòa văn phòng', buildBuildings],
    ['Nhà truyền thống', buildHouses],
    ['Cây sakura', buildNature],
    ['Đường phố', buildStreets],
    ['Xe cộ', buildCars],
  ];
  for (let i = 0; i < steps.length; i++) {
    const [label, fn] = steps[i];
    setProgress(label, Math.round(i / steps.length * 100));
    await fn(scene);
  }
  setProgress('Hoàn thành', 100);
  setTimeout(() => loader_el.style.display = 'none', 500);
  
  // Menu
  document.getElementById('btn-menu').onclick = () => {
    document.getElementById('menu-panel').classList.toggle('open');
  };
  document.getElementById('btn-cam1').onclick = () => {
    camera.position.set(60, 30, 60);
    controls.target.set(28, 15, 28);
  };
  document.getElementById('btn-cam2').onclick = () => {
    camera.position.set(100, 80, 100);
    controls.target.set(0, 0, 0);
  };
  document.getElementById('btn-free').onclick = () => {
    document.getElementById('menu-panel').classList.remove('open');
  };
  document.getElementById('btn-toggle-cars').onclick = (e) => {
    const on = toggleCars();
    e.target.textContent = on ? 'Tắt xe chạy' : 'Bật xe chạy';
  };
  
  animate();
}

function animate() {
  requestAnimationFrame(animate);
  updateCars();
  controls.update();
  renderer.render(scene, camera);
}

init().catch(e => {
  console.error(e);
  loadLabel.textContent = 'Lỗi: ' + e.message;
});
