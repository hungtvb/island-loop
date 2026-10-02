// palmforest.js — P3: RỪNG DỪA VEN BIỂN.
// 3 cụm dừa dày (grove) trên bãi cát + vài cây nghiêng ra mặt nước +
// cây lá rộng jabami xen ở rìa rừng. Dừa đung đưa nhẹ trong gió (xoay cứng
// cả cây theo sin — rẻ, không skinning từng lá).
// Module mới độc lập: CHỈ ĐỌC terrain/cliff/roadpath/vegetation/village,
// không sửa chúng. Mọi cây đặt theo meshHeight (mặt render thật).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CONFIG } from './config.js';
import { meshHeight, slopeAt } from './cliff.js';
import { roadParam, trailParam } from './roadpath.js';
import { mulberry32 } from './terrain.js';

const loader = new GLTFLoader();

// Nạp nền: timeout riêng từng model, lỗi thì bỏ qua phần đó chứ không treo.
const LOAD_TIMEOUT_MS = 20000;
async function loadSafe(url) {
  try {
    return await Promise.race([
      loader.loadAsync(url),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout ' + LOAD_TIMEOUT_MS + 'ms')), LOAD_TIMEOUT_MS)),
    ]);
  } catch (e) {
    console.warn('[palmforest] bỏ qua model lỗi:', url, e && e.message);
    return null;
  }
}

// 3 cụm rừng dừa — tọa độ đã quét số học: dải bãi cát rộng, thoải,
// cách đường/nhà/làng/mũi đá đủ xa (xem /tmp/p3/scan.mjs).
const GROVES = [
  { x: 26, z: -98, r: 20 },    // bãi bắc
  { x: 2, z: 106, r: 20 },     // bãi nam
  { x: -118, z: -62, r: 20 },  // bãi tây-nam
];
const PALM_H = 7.0;            // khớp CONFIG.trees.palmHeight (dừa rải rác P1)
const GROVE_CAP = 60;          // tối đa mỗi cụm
const MIN_DIST = 4.5;          // tán dừa ~5m → khoảng này tán vừa giao nhau

function clearOf(x, z) {
  const rp = roadParam(x, z);
  if (rp && rp.dist < 13) return false;
  const tp = trailParam(x, z);
  if (tp && tp.dist < 5) return false;
  if (Math.hypot(x - CONFIG.village.x, z - CONFIG.village.z) < 34) return false;
  if (Math.hypot(x - CONFIG.cliff.x, z - CONFIG.cliff.z) < 42) return false;
  if (Math.hypot(x - CONFIG.house.pos[0], z - CONFIG.house.pos[2]) < 12) return false;
  if (Math.hypot(x - CONFIG.lighthouse.pos[0], z - CONFIG.lighthouse.pos[2]) < 14) return false;
  return true;
}

function farFrom(pts, x, z, d) {
  for (const p of pts) {
    const dx = p.x - x, dz = p.z - z;
    if (dx * dx + dz * dz < d * d) return false;
  }
  return true;
}

// Rải dừa trong cụm: lưới jitter + thưa dần ở rìa cho tự nhiên.
function placeGrove(rng, cx, cz, R) {
  const pts = [];
  const step = 3.0;
  for (let gx = -R - 8; gx <= R + 8 && pts.length < GROVE_CAP; gx += step) {
    for (let gz = -R - 8; gz <= R + 8 && pts.length < GROVE_CAP; gz += step) {
      const x = cx + gx + (rng() * 2 - 1) * 1.4;
      const z = cz + gz + (rng() * 2 - 1) * 1.4;
      const d = Math.hypot(x - cx, z - cz);
      if (d > R) continue;
      if (d > R * 0.75 && rng() < ((d / R) - 0.75) * 2.2) continue; // rìa thưa
      const h = meshHeight(x, z);
      if (h < 0.9 || h > 5.0) continue;      // dải cát/bãi thấp
      if (slopeAt(x, z) > 0.5) continue;
      if (!clearOf(x, z)) continue;
      if (!farFrom(pts, x, z, MIN_DIST)) continue;
      pts.push({ x, z, h, lean: rng() * 0.06, leanDir: rng() * Math.PI * 2 });
    }
  }
  return pts;
}

// Vài cây dừa nghiêng ra biển ở mép nước — nghiêng theo hướng dốc xuống (ra biển).
function placeLeaners(rng, cx, cz, grovePts) {
  const out = [];
  for (let t = 0; t < 400 && out.length < 3; t++) {
    const a = rng() * Math.PI * 2, r = 20 + rng() * 12;
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    const h = meshHeight(x, z);
    if (h < 0.55 || h > 1.15) continue;      // sát mép nước nhưng gốc trên cát
    if (slopeAt(x, z) > 0.6) continue;
    if (!clearOf(x, z)) continue;
    if (!farFrom(out, x, z, 9)) continue;
    if (!farFrom(grovePts, x, z, 5)) continue;
    const e = 2.0;
    const gx = (meshHeight(x + e, z) - meshHeight(x - e, z)) / (2 * e);
    const gz = (meshHeight(x, z + e) - meshHeight(x, z - e)) / (2 * e);
    const gl = Math.hypot(gx, gz);
    if (gl < 1e-4) continue;
    out.push({ x, z, h, lean: 0.30 + rng() * 0.12, leanDir: Math.atan2(-gz / gl, -gx / gl) });
  }
  return out;
}

// Cây lá rộng (jabami v3/v4 nhẹ) xen ở rìa rừng dừa.
function placeRim(rng, cx, cz, R, grovePts) {
  const out = [];
  for (let t = 0; t < 500 && out.length < 10; t++) {
    const a = rng() * Math.PI * 2, r = R + 2 + rng() * 10;
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    const h = meshHeight(x, z);
    if (h < 1.2 || h > 7) continue;
    if (slopeAt(x, z) > 0.6) continue;
    if (!clearOf(x, z)) continue;
    if (!farFrom(grovePts, x, z, 5)) continue;
    if (!farFrom(out, x, z, 6)) continue;
    out.push({ x, z, h, v: out.length % 2 }); // 0 → v3, 1 → v4
  }
  return out;
}

// Chuẩn hoá GLB: bake world matrix, đáy về y=0, tâm XZ về 0, cao đúng targetH.
// Trả về [{geo, mat}] đã ở frame game.
function bakeScaled(gltf, targetH) {
  gltf.scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const size = box.getSize(new THREE.Vector3());
  const s0 = targetH / size.y;
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  const items = [];
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    g.translate(-cx, -box.min.y, -cz);
    g.scale(s0, s0, s0);
    items.push({ geo: g, mat: o.material });
  });
  return items;
}

const _dummy = new THREE.Object3D();
const _q = new THREE.Quaternion();
const _qy = new THREE.Quaternion();
const _ql = new THREE.Quaternion();
const _qs = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
const _axis = new THREE.Vector3();

export async function buildPalmForest(scene) {
  const rng = mulberry32(CONFIG.seed + 500);

  // --- 1. Tính vị trí ---
  const grovePts = [], leaners = [], rimPts = [];
  for (const g of GROVES) {
    const pts = placeGrove(rng, g.x, g.z, g.r);
    grovePts.push(...pts);
    leaners.push(...placeLeaners(rng, g.x, g.z, pts));
    rimPts.push(...placeRim(rng, g.x, g.z, g.r, pts));
  }

  // --- 2. Dừa (instanced, đung đưa trong gió) ---
  const palmGltf = await loadSafe(CONFIG.models.palm);
  const palmItems = palmGltf ? bakeScaled(palmGltf, PALM_H) : [];
  const palms = []; // {x,y,z, s, qy, ql, swayAxis, phase, speed}
  const allPalmPts = grovePts.concat(leaners);
  for (const p of allPalmPts) {
    const leaner = p.lean >= 0.2;
    _qy.setFromAxisAngle(_up, rng() * Math.PI * 2);
    // lean trong frame thế giới: trục ngang vuông góc hướng nghiêng
    _axis.set(Math.cos(p.leanDir), 0, Math.sin(p.leanDir));
    const perp = new THREE.Vector3().crossVectors(_up, _axis).normalize();
    const ql = new THREE.Quaternion().setFromAxisAngle(perp, p.lean);
    const swayAxis = new THREE.Vector3(Math.cos(p.leanDir + 1.7), 0, Math.sin(p.leanDir + 1.7)).normalize();
    palms.push({
      x: p.x, y: p.h - (leaner ? 0.35 : 0.25), z: p.z,
      s: 0.88 + rng() * 0.3,
      qy: _qy.clone(), ql,
      swayAxis, phase: rng() * Math.PI * 2, speed: 0.8 + rng() * 0.4,
    });
  }
  const palmIMs = palmItems.map(({ geo, mat }) => {
    const im = new THREE.InstancedMesh(geo, mat, Math.max(palms.length, 1));
    im.count = palms.length;
    im.castShadow = true;
    im.receiveShadow = true;
    im.frustumCulled = false;
    scene.add(im);
    return im;
  });

  let swayT = 0;
  function updatePalms(dt) {
    swayT += dt;
    for (let i = 0; i < palms.length; i++) {
      const p = palms[i];
      _qs.setFromAxisAngle(p.swayAxis, 0.03 * Math.sin(swayT * p.speed + p.phase));
      _q.copy(p.ql).multiply(p.qy).multiply(_qs);
      _dummy.position.set(p.x, p.y, p.z);
      _dummy.quaternion.copy(_q);
      _dummy.scale.setScalar(p.s);
      _dummy.updateMatrix();
      for (const im of palmIMs) im.setMatrixAt(i, _dummy.matrix);
    }
    for (const im of palmIMs) im.instanceMatrix.needsUpdate = true;
  }
  updatePalms(0); // dựng ma trận lần đầu

  // --- 3. Cây lá rộng ở rìa (tĩnh, instanced) ---
  const rimHeights = [CONFIG.trees.jabamiHeights[2], CONFIG.trees.jabamiHeights[3]];
  const rimUrls = [CONFIG.models.jabami[2], CONFIG.models.jabami[3]];
  let rimCount = 0;
  for (let v = 0; v < 2; v++) {
    const pts = rimPts.filter((p) => p.v === v);
    if (!pts.length) continue;
    const rimGltf = await loadSafe(rimUrls[v]);
    if (!rimGltf) continue;
    const items = bakeScaled(rimGltf, rimHeights[v]);
    for (const { geo, mat } of items) {
      const im = new THREE.InstancedMesh(geo, mat, pts.length);
      pts.forEach((p, i) => {
        _dummy.position.set(p.x, p.h - 0.15, p.z);
        _dummy.quaternion.identity();
        _dummy.rotateY(rng() * Math.PI * 2);
        _dummy.scale.setScalar(0.85 + rng() * 0.4);
        _dummy.updateMatrix();
        im.setMatrixAt(i, _dummy.matrix);
      });
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = true;
      im.receiveShadow = true;
      im.frustumCulled = false;
      scene.add(im);
    }
    rimCount += pts.length;
  }

  const counts = { groves: GROVES.length, palms: palms.length, leaners: leaners.length, rimTrees: rimCount };
  window.__P3_PALMS__ = palms.map((p) => ({ x: +p.x.toFixed(1), y: +p.y.toFixed(2), z: +p.z.toFixed(1) }));
  window.__P3_READY__ = true;
  return { counts, update: updatePalms };
}
