// village.js — P2: LÀNG CHÀI mái ngói cam ven biển phía tây.
// Cụm 8–12 nhà hữu cơ quanh ngõ đất nhỏ tại vùng san phẳng CONFIG.village.
// Nhà đặt theo meshHeight (mặt render thật) — đứng trực tiếp trên cỏ,
// KHÔNG bệ, KHÔNG lơ lửng (bài học P1).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from './config.js';
import { meshHeight } from './cliff.js';

const VG = CONFIG.village;
const _loader = new GLTFLoader();

// Nạp nền: mỗi model có timeout riêng, lỗi thì bỏ qua model đó (fallback)
// chứ không bao giờ làm treo cả quá trình dựng làng.
const LOAD_TIMEOUT_MS = 20000;
async function loadGLB(path) {
  try {
    const gltf = await Promise.race([
      _loader.loadAsync(path),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout ' + LOAD_TIMEOUT_MS + 'ms')), LOAD_TIMEOUT_MS)),
    ]);
    gltf.scene.updateMatrixWorld(true);
    return gltf.scene;
  } catch (e) {
    console.warn('[village] bỏ qua model lỗi:', path, e && e.message);
    return null;
  }
}

// Đặt object (đã chuẩn hoá: đáy ở y=0, tâm XZ ở 0) lên địa hình thật.
function plantOnGround(obj, x, z, rotY, sink = 0.18) {
  const y = meshHeight(x, z);
  obj.position.set(x, y - sink, z);
  obj.rotation.y = rotY;
  return obj;
}

// Chuẩn hoá: bake world matrix vào geometry, dồn đáy về y=0, tâm XZ về 0.
// Trả về { geos: [{geo, mat}], size } — geometry đã ở frame game (Y-up).
function bakeNormalized(root) {
  root.updateMatrixWorld(true);
  const out = [];
  const box = new THREE.Box3();
  const items = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    items.push({ geo: g, mat: o.material });
    g.computeBoundingBox();
    box.union(g.boundingBox);
  });
  const c = box.getCenter(new THREE.Vector3());
  for (const it of items) {
    it.geo.translate(-c.x, -box.min.y, -c.z);
    out.push(it);
  }
  const size = box.getSize(new THREE.Vector3());
  return { items: out, size };
}

// Tách mesh "cặp nhà" (2 nhà dính trong 1 mesh) thành 2 geometry riêng
// theo mặt phẳng giữa trục ngang dài nhất.
function splitPair(baked) {
  const geos = baked.items.map((it) => it.geo.index ? it.geo.toNonIndexed() : it.geo);
  const mat = baked.items[0].mat;
  const whole = mergeGeometries(geos, false);
  whole.computeBoundingBox();
  const bb = whole.boundingBox;
  const sx = bb.max.x - bb.min.x, sz = bb.max.z - bb.min.z;
  const axis = sx >= sz ? 'x' : 'z';
  const mid = axis === 'x' ? (bb.min.x + bb.max.x) / 2 : (bb.min.z + bb.max.z) / 2;
  const pos = whole.attributes.position;
  const buckets = [[], []];
  const A = new THREE.Vector3(), B = new THREE.Vector3(), Cc = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    A.fromBufferAttribute(pos, i); B.fromBufferAttribute(pos, i + 1); Cc.fromBufferAttribute(pos, i + 2);
    const c = axis === 'x' ? (A.x + B.x + Cc.x) / 3 : (A.z + B.z + Cc.z) / 3;
    buckets[c < mid ? 0 : 1].push(i);
  }
  if (!buckets[0].length || !buckets[1].length) return [{ geo: whole, mat }];
  const pick = (tris) => {
    const g = new THREE.BufferGeometry();
    for (const name of ['position', 'normal', 'uv']) {
      const src = whole.attributes[name];
      if (!src) continue;
      const arr = new Float32Array(tris.length * 3 * src.itemSize);
      let k = 0;
      for (const t of tris) for (let v = 0; v < 3; v++) {
        for (let m = 0; m < src.itemSize; m++) arr[k++] = src.getComponent(t + v, m);
      }
      g.setAttribute(name, new THREE.BufferAttribute(arr, src.itemSize));
    }
    // chuẩn hoá: đáy về 0, tâm XZ về 0
    g.computeBoundingBox();
    const b = g.boundingBox, cc = b.getCenter(new THREE.Vector3());
    g.translate(-cc.x, -b.min.y, -cc.z);
    g.computeBoundingBox();
    return { geo: g, mat };
  };
  return [pick(buckets[0]), pick(buckets[1])];
}

// --- texture lối ngõ (mặt đất nện, mép mềm — cùng họ với lối mòn P1) ---
function makeLaneTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 128, 0);
  g.addColorStop(0.00, 'rgba(150,118,78,0)');
  g.addColorStop(0.25, 'rgba(150,118,78,0.95)');
  g.addColorStop(0.50, 'rgba(160,128,86,1)');
  g.addColorStop(0.75, 'rgba(150,118,78,0.95)');
  g.addColorStop(1.00, 'rgba(150,118,78,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 300; i++) {
    const x = Math.random() * 128, y = Math.random() * 128;
    const edge = Math.sin((x / 128) * Math.PI);
    if (edge < 0.25) continue;
    const v = 110 + Math.random() * 70 | 0;
    ctx.fillStyle = `rgba(${v},${v * 0.78 | 0},${v * 0.55 | 0},${0.25 * edge})`;
    const s = 1 + Math.random() * 2;
    ctx.fillRect(x, y, s, s);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function buildLane(scene) {
  const pts2 = [[-88, 0], [-80, 4], [-72, 3], [-64, 7], [-56, 5]];
  const pts = pts2.map(([x, z]) => new THREE.Vector3(x, meshHeight(x, z) + 0.09, z));
  const curve = new THREE.CatmullRomCurve3(pts);
  const segs = 160, hw = 0.85;
  const positions = new Float32Array((segs + 1) * 2 * 3);
  const uvs = new Float32Array((segs + 1) * 2 * 2);
  const idx = [];
  const up = new THREE.Vector3(0, 1, 0);
  const p = new THREE.Vector3(), tan = new THREE.Vector3(), side = new THREE.Vector3();
  const len = curve.getLength();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPoint(t, p);
    curve.getTangent(t, tan);
    side.crossVectors(up, tan).normalize().multiplyScalar(hw);
    const lx = p.x - side.x, lz = p.z - side.z, rx = p.x + side.x, rz = p.z + side.z;
    const ly = Math.min(Math.max(p.y, meshHeight(lx, lz) + 0.06), p.y + 0.4);
    const ry = Math.min(Math.max(p.y, meshHeight(rx, rz) + 0.06), p.y + 0.4);
    positions.set([lx, ly, lz, rx, ry, rz], i * 6);
    const v = (t * len) / 3;
    uvs.set([0, v, 1, v], i * 4);
    if (i < segs) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const lane = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    map: makeLaneTexture(), transparent: true, depthWrite: false, roughness: 1, metalness: 0,
  }));
  lane.renderOrder = 3;
  lane.receiveShadow = true;
  scene.add(lane);
  return curve;
}

// --- NHÀ ---
async function buildHouses(scene) {
  const M = VG.models;
  const placeNorm = (norm, x, z, rot, s = 1, sink = 0.22) => {
    const g = new THREE.Group();
    for (const it of norm.items) {
      const m = new THREE.Mesh(it.geo, it.mat);
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
    }
    g.scale.setScalar(s);
    plantOnGround(g, x, z, rot, sink);
    scene.add(g);
    return g;
  };

  // Nhà chính mái ngói cam + nhà tháp (giữ nguyên cấu trúc model)
  const main = await loadGLB(M.houseMain);
  const tall = await loadGLB(M.houseTall);
  const placedGroups = [];
  let placed = 0;
  if (main) { placedGroups.push(placeNorm(bakeNormalized(main), -71, 0, 0.5, 1.0)); placed++; }    // nhà chính — nổi bật giữa làng
  if (tall) { placedGroups.push(placeNorm(bakeNormalized(tall), -62, 10, -0.7, 1.0)); placed++; }  // nhà tháp mái hiên cam

  // Kit: tách các cặp nhà thành nhà lẻ
  const kit = await loadGLB(M.houseKit);
  const pairNames = ['Object_12', 'Object_17', 'Object_19', 'Object_20', 'Object_22', 'Object_23'];
  const singles = [];
  if (kit) {
    for (const nm of pairNames) {
      const meshes = [];
      kit.traverse((o) => { if (o.isMesh && o.name === nm) meshes.push(o); });
      for (const mm of meshes) {
        for (const pt of splitPair(bakeNormalized(mm))) singles.push(pt);
      }
    }
  }
  // 8 nhà nền từ kit — cụm hữu cơ quanh ngõ (không xếp lưới)
  const spots = [
    [-80, 9, 1.1], [-65, -3, 2.9], [-57, 3, -1.4], [-85, -5, 1.9],
    [-76, -9, 3.5], [-59, 14, -2.3], [-89, 6, 1.3], [-67, 15, 0.2],
  ];
  let kitPlaced = 0;
  for (let i = 0; i < spots.length && i < singles.length; i++) {
    const [x, z, rot] = spots[i];
    const s = singles[i];
    const m = new THREE.Mesh(s.geo, s.mat);
    m.castShadow = true; m.receiveShadow = true;
    const g = new THREE.Group();
    g.add(m);
    g.scale.setScalar(0.92 + (i % 3) * 0.09);
    plantOnGround(g, x, z, rot, 0.22);
    scene.add(g);
    placedGroups.push(g);
    kitPlaced++;
  }

  // Tìm material cửa sổ/kính trong các nhà đã đặt → cho phát sáng vàng ấm ban đêm
  const seen = new Set();
  for (const g of placedGroups) {
    g.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const mt of mats) {
        if (!mt || !mt.emissive || seen.has(mt)) continue;
        const nm = (mt.name || '').toLowerCase();
        if (/window|glass|fenster|vitre|madobe/i.test(nm)) {
          seen.add(mt);
          _windowMats.push(mt);
        }
      }
    });
  }
  if (!_windowMats.length) console.log('[village] không tìm thấy material cửa sổ — chỉ đèn lồng sáng đêm');
  return { houseCount: placed + kitPlaced };
}

// --- PROPS: thùng (instanced), cột đèn + đèn lồng (instanced), giàn lưới ---
let _lanternMat = null;
let _nightF = 0;            // 0=ngày, 1=đêm — main.js cập nhật mỗi frame
const _windowMats = [];     // material cửa sổ (tên chứa window/glass) → emissive ban đêm

async function buildProps(scene) {
  const M = VG.models;
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 0.92, metalness: 0 });

  // Thùng gỗ — gộp geometry rồi instancing
  const barrelRoot = await loadGLB(M.barrel);
  if (barrelRoot) {
  {
    const root = barrelRoot;
    const { items } = bakeNormalized(root);
    const merged = mergeGeometries(items.map((it) => it.geo.index ? it.geo.toNonIndexed() : it.geo), false);
    const mat = items[0].mat;
    const spots = [
      [-69, 2, 0.4], [-73, 5, 2.1], [-60, 8, 1.2], [-78, 7, 2.8],
      [-64, -1, 0.9], [-82, -3, 1.7], [-58, 12, 2.4], [-70, -6, 0.2],
    ];
    const inst = new THREE.InstancedMesh(merged, mat, spots.length);
    const d = new THREE.Object3D();
    spots.forEach(([x, z, r], i) => {
      d.position.set(x, meshHeight(x, z), z);
      d.rotation.y = r;
      d.scale.setScalar(0.036);   // thùng ~0.9m
      d.updateMatrix();
      inst.setMatrixAt(i, d.matrix);
    });
    inst.castShadow = true; inst.receiveShadow = true;
    scene.add(inst);
  }
  }

  // Cột đèn gỗ dọc ngõ (gộp thành 1 mesh tĩnh) + đèn lồng treo (instanced, phát sáng)
  const lampXf = [];
  {
    const postGeos = [];
    const postAt = (x, z, rot) => {
      const y = meshHeight(x, z);
      const pole = new THREE.CylinderGeometry(0.09, 0.11, 2.8, 7);
      pole.translate(0, 1.4, 0);
      const arm = new THREE.BoxGeometry(1.0, 0.07, 0.07);
      arm.translate(0.32, 2.62, 0);
      const pg = mergeGeometries([pole, arm], false);
      pg.rotateY(rot);
      pg.translate(x, y, z);
      postGeos.push(pg);
      // vị trí treo đèn: đầu thanh ngang
      const hx = x + Math.cos(rot) * 0.82, hz = z - Math.sin(rot) * 0.82;
      lampXf.push([hx, y + 2.58, hz]);
    };
    [[-84, 2, 0.3], [-78, 5, -0.2], [-72, 4, 0.5], [-66, 6, -0.4], [-60, 6, 0.2], [-56, 4, -0.3]]
      .forEach(([x, z, r]) => postAt(x, z, r));
    const posts = new THREE.Mesh(mergeGeometries(postGeos, false), woodMat);
    posts.castShadow = true; posts.receiveShadow = true;
    scene.add(posts);

    const lroot = await loadGLB(M.lantern);
    if (lroot) {
    const { items } = bakeNormalized(lroot);
    const lg = items[0].geo; // 3.14×6.71 — đỉnh ở y=0 sau chuẩn hoá? kiểm: đáy về 0
    lg.computeBoundingBox();
    lg.translate(0, -lg.boundingBox.max.y, 0); // treo từ đỉnh
    const lmat = new THREE.MeshStandardMaterial({
      map: items[0].mat.map || null,
      color: 0xffffff,
      emissive: 0xff8c3a, emissiveIntensity: 0.55,
      emissiveMap: items[0].mat.map || null,
      roughness: 0.85, metalness: 0,
    });
    _lanternMat = lmat;
    const inst = new THREE.InstancedMesh(lg, lmat, lampXf.length);
    const d = new THREE.Object3D();
    lampXf.forEach(([x, y, z], i) => {
      d.position.set(x, y, z);
      d.rotation.y = Math.random() * 0.6 - 0.3;
      d.scale.setScalar(0.14);   // đèn ~0.45×0.95m (nhỏ gọn)
      d.updateMatrix();
      inst.setMatrixAt(i, d.matrix);
    });
    inst.castShadow = true;
    scene.add(inst);
    }
  }

  // Giàn phơi lưới: 2 cột + lưới treo
  {
    const nroot = await loadGLB(M.net);
    const netItems = nroot ? bakeNormalized(nroot).items : null;
    const ng = netItems ? netItems[0].geo : null; // 4×2.6 — mép trên ở max.y
    const nmat = netItems ? netItems[0].mat : null;
    if (ng) ng.computeBoundingBox();
    const racks = [[-75, -4, 0.35], [-63, 12, -0.5]];
    for (const [x, z, rot] of racks) {
      const y = meshHeight(x, z);
      const grp = new THREE.Group();
      for (const s of [-1, 1]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.0, 7), woodMat);
        pole.position.set(s * 2.4, 1.0, 0);
        pole.castShadow = true;
        grp.add(pole);
      }
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 5.0, 6), woodMat);
      bar.rotation.z = Math.PI / 2;
      bar.position.y = 1.9;
      bar.castShadow = true;
      grp.add(bar);
      if (ng) {
        const net = new THREE.Mesh(ng, nmat);
        net.scale.setScalar(1.25);
        net.position.y = 1.88 - ng.boundingBox.max.y * 1.25 + 0.02;
        net.castShadow = true;
        grp.add(net);
      }
      grp.position.set(x, y, z);
      grp.rotation.y = rot;
      scene.add(grp);
    }
  }
}

// --- THUYỀN trên bãi cát phía tây làng ---
async function buildBoats(scene) {
  const root = await loadGLB(VG.models.boat);
  if (!root) return 0;
  const { items, size } = bakeNormalized(root);
  const mkBoat = () => {
    const g = new THREE.Group();
    for (const it of items) {
      const m = new THREE.Mesh(it.geo, it.mat);
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
    }
    return g;
  };
  const spots = [
    [-132, 2, Math.PI / 2 + 0.25, 0.05],
    [-133, 11, Math.PI / 2 - 0.35, -0.04],
  ];
  for (const [x, z, rot, tilt] of spots) {
    const b = mkBoat();
    b.scale.setScalar(0.13);   // thuyền ~7m
    const y = meshHeight(x, z);
    b.position.set(x, y + 0.12, z);
    b.rotation.y = rot;
    b.rotation.z = tilt;
    // chìm nhẹ keel xuống cát: box.min.y sau scale
    const box = new THREE.Box3().setFromObject(b);
    b.position.y -= (box.min.y - (y - 0.15));
    scene.add(b);
  }
  return spots.length;
}

export async function buildVillage(scene) {
  buildLane(scene);
  const { houseCount } = await buildHouses(scene);
  await buildProps(scene);
  const boatCount = await buildBoats(scene);
  const t0 = performance.now();
  window.__P2_READY__ = true;
  window.__P2_VILLAGE__ = { houseCount, boatCount, barrelCount: 8, lanternCount: 6, netRackCount: 2 };
  return {
    houseCount,
    // Ban đêm: cửa sổ phát sáng vàng ấm; đèn lồng sáng mạnh + nhấp nháy nến
    setNight(nf) {
      _nightF = nf;
      for (const mt of _windowMats) {
        mt.emissive.setHex(0xffb45e);
        mt.emissiveIntensity = 1.7 * nf;
      }
    },
    update(dt) {
      // đèn lồng: ban ngày mờ, ban đêm sáng ấm nhấp nháy nhẹ như lửa nến
      if (_lanternMat) {
        const t = (performance.now() - t0) / 1000;
        const flick = Math.sin(t * 2.1) * 0.05 + Math.sin(t * 5.7) * 0.02;
        _lanternMat.emissiveIntensity = (0.12 + 0.78 * _nightF) + flick * (0.3 + 0.7 * _nightF);
      }
    },
  };
}

// Cho phép chỉnh độ sáng đèn khi game có chu kỳ ngày/đêm (P sau)
export function setLanternGlow(k) {
  if (_lanternMat) _lanternMat.emissiveIntensity = k;
}
