// cars.js - Xe đậu và xe chạy
import * as THREE from 'three';
import { loadGLB } from './loaders.js';

const COLORS = ['red', 'blue', 'yellow'];
let movingCars = [];
let carsEnabled = true;

// Đường xe chạy: vòng quanh 2 trục đường chính
const PATHS = [
  // Đường ngang (z=2.5 và z=-2.5)
  { axis: 'x', fixed: 2.5, from: -95, to: 95, dir: 1 },
  { axis: 'x', fixed: -2.5, from: 95, to: -95, dir: -1 },
  // Đường dọc (x=2.5 và x=-2.5)
  { axis: 'z', fixed: 2.5, from: -95, to: 95, dir: 1 },
  { axis: 'z', fixed: -2.5, from: 95, to: -95, dir: -1 },
];

export async function buildCars(scene) {
  const models = {};
  for (const c of COLORS) {
    models[c] = await loadGLB(`models/jp_car_${c}.glb`);
  }
  const group = new THREE.Group();
  
  // Xe đậu (bãi đậu xe)
  const parked = [
    [-60, 15, 0, 'red'], [-60, 20, 0, 'blue'], [-60, 25, 0, 'yellow'],
    [55, -15, Math.PI, 'blue'], [55, -20, Math.PI, 'red'],
    [-15, 50, Math.PI/2, 'yellow'], [15, -50, -Math.PI/2, 'red'],
  ];
  for (const [x, z, rot, color] of parked) {
    const car = models[color].clone();
    car.position.set(x, 0, z);
    car.rotation.y = rot;
    group.add(car);
  }
  
  // Xe chạy (8 xe, 2 xe mỗi làn)
  for (let i = 0; i < 8; i++) {
    const path = PATHS[i % 4];
    const color = COLORS[i % 3];
    const car = models[color].clone();
    const t = Math.random(); // vị trí ngẫu nhiên trên đường
    car.userData = { path, t, speed: 0.008 + Math.random() * 0.004 };
    group.add(car);
    movingCars.push(car);
  }
  
  scene.add(group);
  return group;
}

export function updateCars() {
  if (!carsEnabled) return;
  for (const car of movingCars) {
    const { path, speed } = car.userData;
    car.userData.t += speed * path.dir;
    if (car.userData.t > 1) car.userData.t = 0;
    if (car.userData.t < 0) car.userData.t = 1;
    
    const pos = path.from + (path.to - path.from) * car.userData.t;
    if (path.axis === 'x') {
      car.position.set(pos, 0.2, path.fixed);
      car.rotation.y = path.dir > 0 ? Math.PI/2 : -Math.PI/2;
    } else {
      car.position.set(path.fixed, 0.2, pos);
      car.rotation.y = path.dir > 0 ? 0 : Math.PI;
    }
  }
}

export function toggleCars() {
  carsEnabled = !carsEnabled;
  return carsEnabled;
}
