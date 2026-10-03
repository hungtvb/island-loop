// lighthouse.js — hải đăng + nhà người gác đèn + tia đèn xoay.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CONFIG } from './config.js';
import { meshHeight } from './cliff.js';

function shadowify(obj) {
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
}

export async function buildLighthouse(scene) {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(CONFIG.lighthouse.model);
  const g = gltf.scene;
  g.position.set(...CONFIG.lighthouse.pos);
  shadowify(g);
  scene.add(g);

  // Tia đèn xoay trên đỉnh tháp — nón nhỏ, mờ nhẹ, tinh tế (không còn nón trắng khổng lồ)
  const box = new THREE.Box3().setFromObject(g);
  const lampY = box.max.y - 1.4;
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfff3c4, transparent: true, opacity: 0.05,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
  const beamGroup = new THREE.Group();
  for (const s of [1, -1]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.5, 12, 16, 1, true), beamMat);
    cone.rotation.z = s * Math.PI / 2;
    cone.position.x = s * 8;
    beamGroup.add(cone);
  }
  beamGroup.position.set(CONFIG.lighthouse.pos[0], lampY, CONFIG.lighthouse.pos[2]);
  scene.add(beamGroup);

  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff6d8, fog: false });
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 16, 12),
    lampMat
  );
  lamp.position.set(CONFIG.lighthouse.pos[0], lampY, CONFIG.lighthouse.pos[2]);
  scene.add(lamp);

  // Đèn thật duy nhất của hải đăng: sáng ấm ban đêm, tắt ban ngày
  const beamLight = new THREE.PointLight(0xffd9a0, 0, 60, 1.8);
  beamLight.position.set(CONFIG.lighthouse.pos[0], lampY + 0.5, CONFIG.lighthouse.pos[2]);
  scene.add(beamLight);

  const _lampDay = new THREE.Color(0xd9d2bd);
  const _lampNight = new THREE.Color(0xfff3c0);
  return {
    update(dt) { beamGroup.rotation.y += dt * 0.85; },
    // Tia xoay CHỈ hiện ban đêm — ban ngày chỉ thấy bóng đèn trên đỉnh
    setNight(nf) {
      beamGroup.visible = nf > 0.02;
      beamMat.opacity = 0.30 * nf;
      lampMat.color.copy(_lampDay).lerp(_lampNight, nf);
      beamLight.intensity = 60 * nf;
    },
  };
}

export async function buildKeeperHouse(scene) {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(CONFIG.house.model);
  const g = gltf.scene;
  g.scale.setScalar(7);   // model gốc chỉ ~1m — phóng lên ~7m cho xứng với hải đăng 15m
  const hx = CONFIG.house.pos[0], hz = CONFIG.house.pos[2];
  // Nhà đứng TRỰC TIẾP trên mặt địa hình (không bệ hộp vuông — theo ý user):
  // chân nhà chôn 0.55m vào đất cho tự nhiên. Mảng sân vàng trong texture của
  // model (mặt phẳng ở ~0.43m trên chân nhà) nhờ đó chìm hẳn dưới mặt đất.
  // Dùng meshHeight (mặt render thật) chứ không dùng analytic — trên đỉnh đồi
  // lởm chởm analytic lệch khỏi mặt render, sân vàng sẽ lộ lại.
  const groundY = meshHeight(hx, hz);
  g.position.set(hx, groundY, hz);
  g.rotation.y = CONFIG.house.rotY;
  const box = new THREE.Box3().setFromObject(g);
  g.position.y -= box.min.y - (groundY - 0.55);
  shadowify(g);
  scene.add(g);
  return g;
}
