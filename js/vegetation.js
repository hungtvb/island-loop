// vegetation.js — rừng cây + dừa + cỏ bằng InstancedMesh, trừ hành lang đường.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CONFIG } from './config.js';
import { slopeAt, meshHeight } from './cliff.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Mẫu trừ lối mòn đất (setTrailSamples từ main.js): cây/cỏ không mọc chặn lối đi.
let _trailSamples = null;
export function setTrailSamples(s) { _trailSamples = s; }

function distToRoadSq(x, z, samples) {
  let m = Infinity;
  for (let i = 0; i < samples.length; i++) {
    const dx = x - samples[i].x, dz = z - samples[i].z;
    const d = dx * dx + dz * dz;
    if (d < m) m = d;
  }
  return m;
}

// Rải điểm theo quy tắc loại trừ. Trả về mảng {x,y,z,rot,s}.
// o: hMin/hMax (cao độ), slope (dốc tối đa), roadClear (tránh đường),
//    padClear (tránh đĩa pad đỉnh đồi), cx/cz + rMin/rMax (tâm & vành rải),
//    sinkK (lún thêm theo độ dốc — cây trên sườn dốc không bị "bay" chân).
function scatter(rng, count, o, roadSamples) {
  const pts = [];
  const cx = o.cx !== undefined ? o.cx : 0;
  const cz = o.cz !== undefined ? o.cz : 0;
  const rMin = o.rMin !== undefined ? o.rMin : 6;
  const rMax = o.rMax !== undefined ? o.rMax : 118;
  let guard = count * 80;
  while (pts.length < count && guard-- > 0) {
    const a = rng() * Math.PI * 2;
    const r = rMin + Math.sqrt(rng()) * (rMax - rMin);
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    const h = meshHeight(x, z);   // khớp mặt render — cây không lơ lửng/chôn trên vách lởm chởm
    if (h < o.hMin || h > o.hMax) continue;
    const sl = slopeAt(x, z);
    if (sl > o.slope) continue;
    if (distToRoadSq(x, z, roadSamples) < o.roadClear * o.roadClear) continue;
    // lối mòn đất hẹp → hành lang trừ hẹp hơn đường nhựa (mặc định 3.2m)
    const tc = o.trailClear !== undefined ? o.trailClear : 3.2;
    if (_trailSamples && distToRoadSq(x, z, _trailSamples) < tc * tc) continue;
    if (Math.hypot(x - CONFIG.cliff.x, z - CONFIG.cliff.z) < o.padClear) continue;
    // Vùng làng chài P2: không trồng cây rậm (cỏ thưa được phép)
    if (o.villageClear !== false) {
      const VG = CONFIG.village;
      const vd = Math.hypot(x - VG.x, z - VG.z);
      if (vd < VG.flatR + 10) continue;
    }
    const dhx = x - CONFIG.house.pos[0], dhz = z - CONFIG.house.pos[2];
    // Quanh nhà gác đèn: cây to tránh xa tường, cỏ được mọc sát chân nhà
    const houseClear = o.houseClear !== undefined ? o.houseClear : 49; // mặc định 7m
    if (dhx * dhx + dhz * dhz < houseClear) continue;
    pts.push({ x, y: h - 0.15 - sl * (o.sinkK || 0), z, rot: rng() * Math.PI * 2, s: 0.85 + rng() * 0.45 });
  }
  return pts;
}

// Dựng InstancedMesh cho một model với danh sách điểm đã rải.
// Chuẩn hoá: chân model chạm đất, cao đúng targetH.
// p.q (Quaternion, optional): hướng đầy đủ — dùng cho cây nghiêng tán vào đường.
function makeInstanced(gltf, placements, targetH, castShadow) {
  const group = new THREE.Group();
  // QUAN TRỌNG: bake matrixWorld của node vào geometry. Nhiều GLB Sketchfab có node
  // scale 0.01 (cây jabami) hoặc 0.01×70 (đá) — nếu clone geometry thô mà chuẩn hoá theo
  // bbox đã scale thì cây/đá sẽ KHỔNG LỒ ×100 và nuốt camera.
  gltf.scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const size = box.getSize(new THREE.Vector3());
  const s0 = targetH / size.y;
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  const meshes = [];
  gltf.scene.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const dummy = new THREE.Object3D();
  for (const m of meshes) {
    const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
    g.translate(-cx, -box.min.y, -cz);   // gốc về chân model
    const im = new THREE.InstancedMesh(g, m.material, Math.max(placements.length, 1));
    for (let i = 0; i < placements.length; i++) {
      const p = placements[i];
      dummy.position.set(p.x, p.y, p.z);
      if (p.q) dummy.quaternion.copy(p.q);
      else dummy.rotation.set(0, p.rot, 0);
      const s = s0 * p.s;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
    }
    im.count = placements.length;
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = castShadow;
    im.receiveShadow = true;
    im.frustumCulled = false;  // instancing: tắt culling theo bounding gốc — cây KHÔNG BAO GIỜ biến mất
    group.add(im);
  }
  return { group, placed: placements.length };
}

const loader = new GLTFLoader();

// Cache GLB theo URL — nhiều bước plant dùng chung model (rừng đảo + rừng sườn đá)
// mà không tải lại file hai lần.
const gltfCache = new Map();
function loadGLB(url) {
  if (!gltfCache.has(url)) gltfCache.set(url, loader.loadAsync(url));
  return gltfCache.get(url);
}

// Mỗi hàm là một bước tải trong hàng đợi chunked của main.js.
export async function plantJabami(scene, variant, roadSamples) {
  const rng = mulberry32(CONFIG.seed + 100 + variant);
  // Rừng phủ đồi cỏ: dày ở thung lũng/sườn thoải, không leo lên phần đá dựng
  // rMax 150: phủ cả các mũi đất mới nhô ra khi bờ biến thiên theo góc
  const pts = scatter(rng, CONFIG.trees.jabamiCounts[variant], {
    hMin: 2.2, hMax: 20, slope: 0.6, roadClear: 9.5, trailClear: 4.5, padClear: 20, rMax: 150,
  }, roadSamples);
  const gltf = await loadGLB(CONFIG.models.jabami[variant]);
  const { group } = makeInstanced(gltf, pts, CONFIG.trees.jabamiHeights[variant], true);
  scene.add(group);
  return pts.length;
}

export async function plantPalms(scene, roadSamples) {
  const rng = mulberry32(CONFIG.seed + 200);
  // Dừa quanh bãi cát — rMax 150: bám cả bãi cát của các mũi đất mới
  const pts = scatter(rng, CONFIG.trees.palmCount, {
    hMin: 1.0, hMax: 5, slope: 0.5, roadClear: 9.5, trailClear: 4, padClear: 20, rMax: 150,
  }, roadSamples);
  const gltf = await loadGLB(CONFIG.models.palm);
  const { group } = makeInstanced(gltf, pts, CONFIG.trees.palmHeight, true);
  scene.add(group);
  return pts.length;
}

export async function plantGrass(scene, roadSamples) {
  const rng = mulberry32(CONFIG.seed + 300);
  const pts = scatter(rng, CONFIG.trees.grassCount, {
    hMin: 1.0, hMax: 28, slope: 0.9, roadClear: 3.4, trailClear: 1.6, padClear: 15, villageClear: false,
    houseClear: 9,   // cỏ mọc sát chân nhà gác đèn cho tự nhiên
    rMax: 150,       // phủ cả các mũi đất mới nhô ra khi bờ biến thiên theo góc
  }, roadSamples);
  const gltf = await loadGLB(CONFIG.models.grass);
  const { group } = makeInstanced(gltf, pts, CONFIG.trees.grassHeight, false);
  scene.add(group);
  return pts.length;
}

// HÀNH LANG CÂY VEN ĐƯỜNG VÒNG — cây 2 bên đường, tán nghiêng giao nhau phía
// trên tạo bóng mát khi xe chạy (yêu cầu của user). Dùng instancing có sẵn,
// không trồng vào corridor đường (offset ≥6.5m), không khóa main thread.
const GROVE_CENTERS = [[26, -98], [2, 106], [-118, -62]]; // cụm dừa P3 — giữ khoảng
const _upV = new THREE.Vector3(0, 1, 0);
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();

export async function plantRoadCorridor(scene, roadSamples) {
  const rng = mulberry32(CONFIG.seed + 600);
  const n = roadSamples.length;
  // bước ~7m dọc đường
  const stepLen = 7;
  let acc = 0;
  const byVariant = [[], [], [], []];
  const palmPts = [];
  const VG = CONFIG.village;
  const fwd = new THREE.Vector3(), lat = new THREE.Vector3();
  let station = 0;

  for (let i = 0; i < n - 1; i++) { // bỏ điểm cuối trùng điểm đầu (vòng kín)
    const p = roadSamples[i];
    const q = roadSamples[(i + 1) % n];
    acc += Math.hypot(q.x - p.x, q.z - p.z);
    if (acc < stepLen && i > 0) continue;
    acc = 0;
    station++;

    const pa = roadSamples[(i - 2 + n) % n], pb = roadSamples[(i + 2) % n];
    fwd.set(pb.x - pa.x, 0, pb.z - pa.z);
    if (fwd.lengthSq() < 1e-6) continue;
    fwd.normalize();

    for (const s of [1, -1]) {
      // lateral: xoay fwd +90° (s=+1) / -90° (s=-1)
      lat.set(-fwd.z * s, 0, fwd.x * s);
      const off = 6.5 + rng() * 2.5;
      const x = p.x + lat.x * off, z = p.z + lat.z * off;
      const h = meshHeight(x, z);
      if (h < 1.5 || h > 18) continue;
      if (slopeAt(x, z) > 0.55) continue;
      if (Math.hypot(x - VG.x, z - VG.z) < 30) continue;          // trong làng
      if (Math.hypot(x - 74, z - 28) < 12) continue;              // ngã ba lối mòn
      let inGrove = false;
      for (const [gx, gz] of GROVE_CENTERS) {
        if (Math.hypot(x - gx, z - gz) < 26) { inGrove = true; break; }
      }
      if (inGrove) continue;
      if (distToRoadSq(x, z, roadSamples) < 5.5 * 5.5) continue;   // cua gấp cắt vào
      if (Math.hypot(x - CONFIG.cliff.x, z - CONFIG.cliff.z) < 24) continue;

      // nghiêng tán vào đường: quay quanh trục fwd một góc -s*lean
      const lean = 0.10 + rng() * 0.07;
      _q1.setFromAxisAngle(fwd, -s * lean);
      _q2.setFromAxisAngle(_upV, rng() * Math.PI * 2);
      const qq = _q1.clone().multiply(_q2);
      const pt = { x, y: h - 0.15, z, rot: 0, s: 0.9 + rng() * 0.4, q: qq };
      if (station % 6 === 0 && s === 1) palmPts.push(pt);
      else byVariant[station % 4].push(pt);
    }
  }

  let placed = 0;
  for (let v = 0; v < 4; v++) {
    if (!byVariant[v].length) continue;
    const gltf = await loadGLB(CONFIG.models.jabami[v]);
    const { group } = makeInstanced(gltf, byVariant[v], CONFIG.trees.jabamiHeights[v] + 1.5, true);
    scene.add(group);
    placed += byVariant[v].length;
  }
  if (palmPts.length) {
    const gltf = await loadGLB(CONFIG.models.palm);
    const { group } = makeInstanced(gltf, palmPts, CONFIG.trees.palmHeight + 1.0, true);
    scene.add(group);
    placed += palmPts.length;
  }
  return placed;
}
// RỪNG PHỦ SƯỜN VÁCH ĐÁ — như ảnh mẫu: cây xanh phủ kín sườn, đá xám sẫm chỉ lộ
// từng mảng. Trừ hành lang đường (đường vòng vẫn đọc rõ) + đĩa pad đỉnh.
// LƯU Ý: các vòng đường chỉ cách nhau ~8.7m nên roadClear tính từ TIM đường phải
// nhỏ (6.5m ≈ 3.3m từ mép nhựa) — bản cũ 8.5m loại trừ cả sườn đồi nên không cây
// nào mọc được. Cây trên sườn đá dốc: slope tới 2.0, lún chân theo dốc.
export async function plantCliffGreens(scene, roadSamples) {
  const CX = CONFIG.cliff.x, CZ = CONFIG.cliff.z;
  const out = { trees: 0, grass: 0, palms: 0 };
  // Cây jabami trên sườn mũi đá (chịu dốc, lún chân theo dốc) — thưa dần lên
  // phần đá dựng, như ảnh mẫu: đồi xanh, đá xám sẫm chỉ lộ ở mũi dựng
  for (let v = 0; v < 4; v++) {
    const rng = mulberry32(CONFIG.seed + 400 + v);
    const pts = scatter(rng, CONFIG.trees.cliffTrees[v], {
      cx: CX, cz: CZ, rMin: 10, rMax: 40,
      hMin: 3.5, hMax: 24, slope: 2.5, roadClear: 6.5, trailClear: 3.2, padClear: 12, sinkK: 0.8,
    }, roadSamples);
    const gltf = await loadGLB(CONFIG.models.jabami[v]);
    const { group } = makeInstanced(gltf, pts, CONFIG.trees.jabamiHeights[v], true);
    scene.add(group);
    out.trees += pts.length;
  }
  // Bụi cỏ len lỏi trên sườn đá (cỏ thấp, không che đường → hành lang hẹp hơn)
  {
    const rng = mulberry32(CONFIG.seed + 440);
    const pts = scatter(rng, CONFIG.trees.cliffGrass, {
      cx: CX, cz: CZ, rMin: 9, rMax: 42,
      hMin: 2.5, hMax: 26, slope: 3.0, roadClear: 4.5, trailClear: 2.0, padClear: 11, sinkK: 0,
    }, roadSamples);
    const gltf = await loadGLB(CONFIG.models.grass);
    const { group } = makeInstanced(gltf, pts, CONFIG.trees.grassHeight, false);
    scene.add(group);
    out.grass = pts.length;
  }
  // Dừa quanh chân mũi đá (phía bãi cát/đồi thấp)
  {
    const rng = mulberry32(CONFIG.seed + 450);
    const pts = scatter(rng, CONFIG.trees.cliffPalms, {
      cx: CX, cz: CZ, rMin: 28, rMax: 58,
      hMin: 0.8, hMax: 5, slope: 0.6, roadClear: 8, trailClear: 4, padClear: 26, sinkK: 0,
    }, roadSamples);
    const gltf = await loadGLB(CONFIG.models.palm);
    const { group } = makeInstanced(gltf, pts, CONFIG.trees.palmHeight, true);
    scene.add(group);
    out.palms = pts.length;
  }
  return out;
}
