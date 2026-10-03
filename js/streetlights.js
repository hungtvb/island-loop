// streetlights.js — đèn đường 2 bên đường vòng.
// Trụ + tay đèn + bóng đèn + quầng sáng dưới đất, TẤT CẢ instanced (rẻ mobile).
// Bóng đèn chỉ dùng emissive (không thêm đèn thật) — sáng dần theo nightFactor.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { meshHeight } from './cliff.js';

const SPACING = 18;      // cách nhau ~18m
const OFFSET = 5.4;      // cách tim đường 5.4m (ngoài mép đường 3.2m)

export function buildStreetlights(scene, curve) {
  const length = curve.getLength();
  const N = Math.max(8, Math.floor(length / SPACING));

  // Trụ (cao 4.6m) + tay ngang hướng về phía đường (+Z local)
  const pole = new THREE.CylinderGeometry(0.09, 0.13, 4.6, 7);
  pole.translate(0, 2.3, 0);
  const arm = new THREE.BoxGeometry(0.09, 0.09, 1.5);
  arm.translate(0, 4.55, 0.75);
  const poleGeo = mergeGeometries([pole, arm], false);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2e3a33, roughness: 0.8, metalness: 0.35 });

  // Bóng đèn ở đầu tay (1.5m về phía đường)
  const headGeo = new THREE.BoxGeometry(0.55, 0.16, 0.34);
  headGeo.translate(0, 4.48, 1.5);
  const headMat = new THREE.MeshStandardMaterial({
    color: 0x3a3a3a, emissive: 0xffc46b, emissiveIntensity: 0, roughness: 0.6, metalness: 0,
  });

  // Quầng sáng ấm dưới đất (additive, mờ)
  const poolGeo = new THREE.CircleGeometry(2.8, 20);
  poolGeo.rotateX(-Math.PI / 2);
  const poolMat = new THREE.MeshBasicMaterial({
    color: 0xffbe6a, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });

  const poles = new THREE.InstancedMesh(poleGeo, poleMat, N);
  const heads = new THREE.InstancedMesh(headGeo, headMat, N);
  const pools = new THREE.InstancedMesh(poolGeo, poolMat, N);
  poles.castShadow = true;

  const p = new THREE.Vector3(), tan = new THREE.Vector3(), side = new THREE.Vector3();
  const d = new THREE.Object3D();
  for (let i = 0; i < N; i++) {
    const t = (i + 0.5) / N;
    curve.getPointAt(t, p);
    curve.getTangentAt(t, tan);
    side.set(-tan.z, 0, tan.x).normalize();
    const sgn = i % 2 === 0 ? 1 : -1;   // xen kẽ 2 bên đường
    const px = p.x + side.x * OFFSET * sgn;
    const pz = p.z + side.z * OFFSET * sgn;
    const gy = meshHeight(px, pz) - 0.05;
    // Tay đèn hướng về tim đường: +Z local → vector (-side * sgn)
    const yaw = Math.atan2(-side.x * sgn, -side.z * sgn);
    d.position.set(px, gy, pz);
    d.rotation.set(0, yaw, 0);
    d.updateMatrix();
    poles.setMatrixAt(i, d.matrix);
    heads.setMatrixAt(i, d.matrix);
    // Quầng sáng đặt dưới đầu đèn (lệch 1.5m về phía đường)
    d.position.set(px - side.x * sgn * 1.5, gy + 0.12, pz - side.z * sgn * 1.5);
    d.updateMatrix();
    pools.setMatrixAt(i, d.matrix);
  }
  poles.instanceMatrix.needsUpdate = true;
  heads.instanceMatrix.needsUpdate = true;
  pools.instanceMatrix.needsUpdate = true;
  scene.add(poles, heads, pools);

  return {
    count: N,
    // Ban đêm: bóng đèn phát sáng vàng + quầng sáng dưới đất hiện ra
    setNight(nf) {
      headMat.emissiveIntensity = 2.6 * nf;
      poolMat.opacity = 0.20 * nf;
    },
    update() { /* tĩnh — không cần tick */ },
  };
}
