// scene.js — renderer, scene, camera, controls.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CONFIG, FAST, MOBILE } from './config.js';

export function createRenderer(canvas) {
  // Mobile: tắt MSAA (kẻ giết fill-rate số 1) — pixelRatio thấp đã đủ mịn.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !MOBILE && !FAST, powerPreference: 'high-performance' });
  renderer.setPixelRatio(FAST ? 1 : (MOBILE ? Math.min(window.devicePixelRatio || 1, 1.5) : Math.min(window.devicePixelRatio || 1, 2)));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = !FAST;
  // Mobile: bóng PCF rẻ hơn PCFSoft rất nhiều trên GPU tile-based.
  renderer.shadowMap.type = (MOBILE && !FAST) ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  return renderer;
}

export function createScene() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(CONFIG.fog.color, CONFIG.fog.near, CONFIG.fog.far);
  return scene;
}

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.5, 5000);
  camera.position.set(...CONFIG.camera.overview.pos);
  return camera;
}

export function createControls(camera, dom) {
  const controls = new OrbitControls(camera, dom);
  controls.target.set(...CONFIG.camera.overview.tgt);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.maxPolarAngle = 1.53;      // gần chạm mặt đất nhưng không chui xuống biển
  controls.minDistance = CONFIG.controls.minDistance;
  controls.maxDistance = CONFIG.controls.maxDistance;
  controls.autoRotate = true;         // 360° ngay khi mở
  controls.autoRotateSpeed = 0.55;
  return controls;
}

export function fitResize(renderer, camera) {
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}
