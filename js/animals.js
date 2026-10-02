// animals.js — ĐỘNG VẬT: hải âu, bướm, gà, chó, mèo, cua, rùa biển, cá.
// Nạp NỀN qua bgLoad() trong main.js — TUYỆT ĐỐI không chặn boot, không phá fix
// loading. Mỗi model có timeout/fallback riêng: lỗi thì bỏ qua nhóm đó.
// BẮT BUỘC dùng bản _game (seagull bản gốc render đen do material cũ).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from './config.js';
import { meshHeight } from './cliff.js';
import { mulberry32 } from './terrain.js';

const AM = CONFIG.animals.models;
const _loader = new GLTFLoader();
// 90s: đủ cho model nặng nhất (~3.9MB) trên mạng chậm ~500kbps (~64s).
// Trước đây 20s khiến chó + hải âu bị bỏ qua thầm lặng trên mạng yếu (iPhone user).
const LOAD_TIMEOUT_MS = 90000;
const MAX_ATTEMPTS = 3;

// Tải model an toàn: retry khi lỗi mạng/timeout, KHÔNG retry khi file lỗi parse.
// hooks: { onRetry(name, attempt), onFail(name, msg) } — để hiện tiến trình lên UI.
async function loadSafe(path, label, hooks = {}) {
  const name = label || path;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const gltf = await Promise.race([
        _loader.loadAsync(path),
        new Promise((_, rej) => setTimeout(() => {
          const e = new Error('timeout ' + LOAD_TIMEOUT_MS + 'ms');
          e.timeout = true;
          rej(e);
        }, LOAD_TIMEOUT_MS)),
      ]);
      gltf.scene.updateMatrixWorld(true);
      return gltf;
    } catch (e) {
      const isErr = e instanceof Error;
      const msg = isErr ? (e.message || '') : String(e);
      // Lỗi parse GLB luôn là Error với message mô tả → không retry.
      // Rejection không phải Error (ProgressEvent/DOMException của fetch) gần như
      // chắc chắn là lỗi mạng → retry.
      const retryable = e && (e.timeout === true || !isErr ||
        /failed to fetch|networkerror|network request failed|err_internet|err_connection|err_timed_out|err_network|timeout|abort|econn/i.test(msg));
      if (retryable && attempt < MAX_ATTEMPTS) {
        console.warn(`[animals] thử lại (${attempt}/${MAX_ATTEMPTS}):`, name);
        if (hooks.onRetry) hooks.onRetry(name, attempt);
        await new Promise((r) => setTimeout(r, 1200 * attempt)); // backoff nhẹ
        continue;
      }
      console.warn('[animals] bỏ qua model lỗi:', name, msg);
      if (hooks.onFail) hooks.onFail(name, msg);
      return null;
    }
  }
  return null;
}

// Clone cây xương (skinned) kèm skeleton — thay cho SkeletonUtils (không có trong lib).
function cloneSkinned(root) {
  const clone = root.clone(true);
  const src = [], dst = [];
  root.traverse((o) => src.push(o));
  clone.traverse((o) => dst.push(o));
  const map = new Map(src.map((o, i) => [o, dst[i]]));
  for (let i = 0; i < src.length; i++) {
    if (src[i].isSkinnedMesh) {
      const sk = dst[i];
      sk.skeleton = new THREE.Skeleton(
        src[i].skeleton.bones.map((b) => map.get(b)),
        src[i].skeleton.boneInverses
      );
      sk.bindMatrix.copy(src[i].bindMatrix);
      sk.bindMatrixInverse.copy(src[i].bindMatrixInverse);
    }
  }
  return clone;
}

// AI-generated model đôi khi gán texture.channel=1 trong khi geometry không có
// uv1 → three r160 compile shader lỗi 'uv1 undeclared' (gặp ở model chó).
// Ép mọi texture về uv0 cho an toàn.
function fixTextureChannels(root) {
  root.traverse((o) => {
    if (o.isMesh || o.isSkinnedMesh) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const mt of mats) {
        for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap']) {
          if (mt[k]) mt[k].channel = 0;
        }
      }
    }
  });
}

// Chuẩn hoá: scale để chiều dài nhất = targetLen (mét), đáy về y=0, tâm XZ về 0.
// Trả về group ngoài (đã scale) — đặt lên địa hình bằng meshHeight như các module khác.
function fitToSize(root, targetLen) {
  fixTextureChannels(root);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const tmp = new THREE.Box3();
  root.traverse((o) => {
    if (o.isMesh || o.isSkinnedMesh) {
      o.geometry.computeBoundingBox();
      tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
      box.union(tmp);
    }
  });
  const size = box.getSize(new THREE.Vector3());
  const c = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 1e-6);
  const s = targetLen / maxDim;
  const inner = new THREE.Group();
  inner.position.set(-c.x, -box.min.y, -c.z);
  inner.add(root);
  const outer = new THREE.Group();
  outer.scale.setScalar(s);
  outer.add(inner);
  outer.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return outer;
}

function shadowify(root) {
  root.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) { o.castShadow = true; o.receiveShadow = true; } });
}

// Gộp toàn bộ mesh cứng thành 1 mesh (cho cua 11 mảnh) — giảm draw call.
function mergeStatic(root) {
  try {
    root.updateMatrixWorld(true);
    const geos = [];
    let mat = null;
    root.traverse((o) => {
      if (o.isMesh && !o.isSkinnedMesh) {
        const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        g.applyMatrix4(o.matrixWorld);
        // mergeGeometries đòi cùng bộ attribute — chỉ giữ position/normal/uv
        const clean = new THREE.BufferGeometry();
        clean.setAttribute('position', g.getAttribute('position'));
        if (g.getAttribute('normal')) clean.setAttribute('normal', g.getAttribute('normal'));
        if (g.getAttribute('uv')) clean.setAttribute('uv', g.getAttribute('uv'));
        geos.push(clean);
        if (!mat) mat = o.material;
      }
    });
    if (!geos.length) return null;
    const merged = mergeGeometries(geos, false);
    if (!merged) return null;
    const m = new THREE.Mesh(merged, mat || new THREE.MeshStandardMaterial({ color: 0xcc5533 }));
    shadowify(m);
    return m;
  } catch (e) {
    console.warn('[animals] merge thất bại, dùng nguyên bản:', e && e.message);
    return null;
  }
}

// Tìm điểm dưới nước theo hướng ra biển từ (x,z)
function findWaterSpot(x, z, dx, dz) {
  for (let d = 10; d <= 80; d += 5) {
    const px = x + dx * d, pz = z + dz * d;
    if (meshHeight(px, pz) < -1.0) return [px, pz];
  }
  return [x + dx * 60, z + dz * 60];
}

// ---------------------------------------------------------------------------
// HẢI ÂU — 6 con bay lượn quanh mũi hải đăng + 2 con đậu
async function buildSeagulls(scene, rng, mixers, tickers, counts, markers, hooks) {
  const gltf = await loadSafe(AM.seagull, 'Hải âu', hooks);
  if (!gltf) return;
  const LH = CONFIG.lighthouse.pos; // [88, 30, -5]
  const flyers = [];
  const N = 6;
  for (let i = 0; i < N; i++) {
    const g = fitToSize(cloneSkinned(gltf.scene), 0.65);
    const mixer = new THREE.AnimationMixer(g);
    const clipName = i % 3 === 2 ? 'glide' : 'fly';
    const clip = gltf.animations.find((a) => a.name === clipName) || gltf.animations[0];
    if (clip) mixer.clipAction(clip).play();
    mixers.push(mixer);
    scene.add(g);
    markers.push({ label: 'gull_fly_' + i, obj: g });
    flyers.push({
      g,
      r: 14 + rng() * 14,
      h: 38 + rng() * 10,
      w: (0.18 + rng() * 0.15) * (rng() < 0.5 ? 1 : -1),
      phase: rng() * Math.PI * 2,
    });
  }
  // 2 con đậu: một trên mũi đá gần hải đăng, một trên bãi cát phía tây
  const perches = [[97, 3, 'look'], [-126, 10, 'eat']];
  for (let pi = 0; pi < perches.length; pi++) {
    const [px, pz, clipName] = perches[pi];
    const g = fitToSize(cloneSkinned(gltf.scene), 0.55);
    const mixer = new THREE.AnimationMixer(g);
    const clip = gltf.animations.find((a) => a.name === clipName);
    if (clip) mixer.clipAction(clip).play();
    mixers.push(mixer);
    g.position.set(px, meshHeight(px, pz), pz);
    g.rotation.y = rng() * Math.PI * 2;
    scene.add(g);
    markers.push({ label: 'gull_perch_' + pi, obj: g });
  }
  counts.seagulls = N + perches.length;
  const t0 = performance.now();
  tickers.push((dt) => {
    const t = (performance.now() - t0) / 1000;
    for (const f of flyers) {
      const a = f.phase + f.w * t;
      const x = LH[0] + Math.cos(a) * f.r;
      const z = LH[2] + Math.sin(a) * f.r;
      const y = f.h + Math.sin(t * 0.6 + f.phase) * 1.5;
      // hướng tiếp tuyến + nghiêng vào cua
      const vx = -Math.sin(a) * Math.sign(f.w), vz = Math.cos(a) * Math.sign(f.w);
      f.g.position.set(x, y, z);
      f.g.rotation.set(0, Math.atan2(vx, vz), -Math.sign(f.w) * 0.22, 'YXZ');
    }
  });
}

// ---------------------------------------------------------------------------
// BƯỚM — 8 con bay lượn quanh rừng dừa P3 + làng
async function buildButterflies(scene, rng, mixers, tickers, counts, markers, hooks) {
  const gltf = await loadSafe(AM.butterfly, 'Bướm', hooks);
  if (!gltf) return;
  const spots = [
    [26, -98], [2, 106], [-118, -62],   // 3 cụm dừa P3
    [-72, 6],                            // làng
  ];
  const flies = [];
  let n = 0;
  for (const [cx, cz] of spots) {
    for (let k = 0; k < 2; k++) {
      const g = fitToSize(cloneSkinned(gltf.scene), 0.32);
      const mixer = new THREE.AnimationMixer(g);
      const clip = gltf.animations.find((a) => a.name === 'Flying') || gltf.animations[0];
      if (clip) { const act = mixer.clipAction(clip); act.play(); }
      // lệch pha cánh cho tự nhiên
      mixer.setTime(rng() * 2);
      mixers.push(mixer);
      scene.add(g);
      markers.push({ label: 'butterfly_' + n, obj: g });
      const gy = meshHeight(cx, cz);
      flies.push({
        g, cx, cz, gy,
        ax: 3 + rng() * 5, az: 3 + rng() * 5,
        w1: 0.25 + rng() * 0.3, w2: 0.22 + rng() * 0.3, w3: 0.9 + rng() * 0.6,
        p1: rng() * 6.28, p2: rng() * 6.28, p3: rng() * 6.28,
        h: 1.6 + rng() * 1.8,
      });
      n++;
    }
  }
  counts.butterflies = n;
  const t0 = performance.now();
  tickers.push(() => {
    const t = (performance.now() - t0) / 1000;
    for (const f of flies) {
      const x = f.cx + f.ax * Math.sin(f.w1 * t + f.p1);
      const z = f.cz + f.az * Math.sin(f.w2 * t + f.p2);
      const y = f.gy + f.h + 0.5 * Math.sin(f.w3 * t + f.p3);
      const vx = f.ax * f.w1 * Math.cos(f.w1 * t + f.p1);
      const vz = f.az * f.w2 * Math.cos(f.w2 * t + f.p2);
      f.g.position.set(x, y, z);
      if (Math.abs(vx) + Math.abs(vz) > 0.01) f.g.rotation.y = Math.atan2(vx, vz);
    }
  });
}

// ---------------------------------------------------------------------------
// LÀNG (nhẹ): gà trống+mái, mèo — tải trước để user thấy con vật sớm
async function buildChickenCat(scene, rng, tickers, counts, markers, hooks) {
  // Gà — đi quanh sân + mổ thóc (thủ công, model không có anim)
  const chickenGltf = await loadSafe(AM.chicken, 'Gà', hooks);
  if (chickenGltf) {
    const g = fitToSize(chickenGltf.scene, 0.55);
    const cx = -76, cz = 2, gy = meshHeight(cx, cz);
    scene.add(g);
    markers.push({ label: 'chicken', obj: g });
    const t0 = performance.now();
    tickers.push(() => {
      const t = (performance.now() - t0) / 1000;
      const a = t * 0.25;
      const x = cx + Math.cos(a) * 1.6, z = cz + Math.sin(a) * 1.6;
      g.position.set(x, meshHeight(x, z), z);
      g.rotation.y = Math.atan2(-Math.sin(a), Math.cos(a)) + Math.PI / 2;
      // mổ thóc theo chu kỳ
      const peck = Math.pow(Math.max(0, Math.sin(t * 2.2)), 6);
      g.rotation.x = peck * 0.55;
    });
    counts.chickens = 1;
  }
  // Mèo — trên bãi cỏ cạnh nhà (tránh mái hiên nhà chính)
  const catGltf = await loadSafe(AM.cat, 'Mèo', hooks);
  if (catGltf) {
    const g = fitToSize(catGltf.scene, 0.55);
    const x = -63, z = -6;
    const gy = meshHeight(x, z);
    g.position.set(x, gy, z);
    g.rotation.y = -0.6;
    scene.add(g);
    markers.push({ label: 'cat', obj: g });
    const t0 = performance.now();
    tickers.push(() => {
      const t = (performance.now() - t0) / 1000;
      g.position.y = gy + 0.006 * Math.sin(t * 1.2 + 2);
    });
    counts.cat = 1;
  }
}

// LÀNG (nặng 3.9MB): chó — tải sau cùng với hải âu
async function buildDog(scene, rng, tickers, counts, markers, hooks) {
  // Chó — đứng cạnh nhà (thở nhẹ)
  const dogGltf = await loadSafe(AM.dog, 'Chó', hooks);
  if (dogGltf) {
    const g = fitToSize(dogGltf.scene, 0.55);
    const x = -60, z = 0;
    const gy = meshHeight(x, z);
    g.position.set(x, gy, z);
    g.rotation.y = 2.2;
    scene.add(g);
    markers.push({ label: 'dog', obj: g });
    const t0 = performance.now();
    tickers.push(() => {
      const t = (performance.now() - t0) / 1000;
      g.position.y = gy + 0.008 * Math.sin(t * 1.6);
    });
    counts.dog = 1;
  }
}

// ---------------------------------------------------------------------------
// THÚ RỪNG — hươu, lợn rừng, cáo, thỏ (tách từ pack 100), khỉ, nai sừng tấm.
// Đặt SÁT ĐƯỜNG (cách tim ~11m) để xe chạy qua nhìn thấy — theo yêu cầu user.
// Đứng/gặm cỏ nhẹ, thỏ nhảy chập chững, nai ăn cỏ (animation thật).
async function buildForestAnimals(scene, rng, mixers, tickers, counts, markers, hooks) {
  const spots = [
    // [model, label, targetLen, x, z, rotY] — phía TRONG đảo (rừng), cách đường 8-12m
    // rải đều quanh vòng để xe chạy lúc nào cũng thấy thú
    ['deer', 'Hươu', 2.2, 64.6, 24.5, 0.8],
    ['boar', 'Lợn rừng', 1.5, 49.2, -0.3, 1.9],
    ['monkey', 'Khỉ', 1.0, 35.7, -23.3, 1.5],
    ['deer', 'Hươu', 2.2, 31.4, -51.4, -2.1],
    ['fox', 'Cáo', 1.1, 11.9, -71.9, 2.6],
    ['rabbit', 'Thỏ', 0.65, -15.7, -77.9, 1.2],
    ['boar', 'Lợn rừng', 1.5, -43.7, -71.2, -0.7],
    ['elk', 'Nai sừng tấm', 2.5, -65, -55, -0.8],
    ['monkey', 'Khỉ', 1.0, -97.4, -47.6, -1.2],
    ['deer', 'Hươu', 2.2, -107.7, -20.2, 0.5],
    ['boar', 'Lợn rừng', 1.5, -88, 0, 2.2],
    ['fox', 'Cáo', 1.1, -39.2, 23.1, -1.8],
    ['rabbit', 'Thỏ', 0.65, -34.6, 50.9, 0.9],
    ['monkey', 'Khỉ', 1.0, -23.5, 78.0, 2.0],
  ]; // bỏ nai phía nam (dốc đứng, lơ lửng) — giữ 1 nai phía tây
  let n = 0;
  for (const [key, label, len, x, z, ry] of spots) {
    const gltf = await loadSafe(AM[key], label, hooks);
    if (!gltf) continue;
    const isPack = ['deer'].includes(key); // chỉ hươu còn dùng pack (nằm nghiêng)
    if (isPack) {
      // Model tách từ pack nằm nghiêng — xoay -90° quanh X cho đứng lên
      // TRƯỚC khi fitToSize chuẩn hoá bbox (đã kiểm bằng render).
      gltf.scene.rotation.x = -Math.PI / 2;
      gltf.scene.updateMatrixWorld(true);
    }
    // Heo/cáo/thỏ model riêng đã đứng đúng hướng, không xoay
    const g = fitToSize(gltf.scene, len);
    const gy = meshHeight(x, z);
    // Heo/cáo: bbox bind-pose sai (đáy không ở chân) → hạ thủ công cho chạm đất
    const yFix = key === 'boar' ? -0.18 : key === 'fox' ? -0.48 : 0;
    g.position.set(x, gy + yFix, z);
    g.rotation.y = ry;
    scene.add(g);
    markers.push({ label: key + n, obj: g });
    // Animation thật cho các model có clip (heo 11 clip, cáo 1, thỏ 1, nai ăn cỏ)
    const animKey = key === 'boar' ? /walk/i : null;
    if (gltf.animations.length && (animKey || ['fox', 'rabbit', 'boar'].includes(key))) {
      const clip = animKey
        ? (gltf.animations.find((a) => animKey.test(a.name)) || gltf.animations[0])
        : gltf.animations[0];
      if (clip) {
        const mixer = new THREE.AnimationMixer(g);
        mixer.clipAction(clip).play();
        mixers.push(mixer);
      }
    }
    const t0 = performance.now() + n * 1300;
    const isRabbit = key === 'rabbit';
    const isElk = key === 'elk';
    const hasRealAnim = ['boar', 'fox', 'rabbit'].includes(key) && gltf.animations.length;
    if (!hasRealAnim) { // có animation thật thì không cần ticker giả
      tickers.push(() => {
        const t = (performance.now() - t0) / 1000;
        const baseY = gy + yFix;
        if (isRabbit) {
          const hop = Math.max(0, Math.sin(t * 2.4));
          g.position.y = baseY + hop * hop * 0.06; // nhảy thấp hơn, đỡ lơ lửng
          g.rotation.x = -hop * 0.2;
        } else {
          g.position.y = baseY + 0.008 * Math.sin(t * 1.1 + n); // thở nhẹ, không lơ lửng
          g.rotation.x = Math.pow(Math.max(0, Math.sin(t * 0.5 + n * 2)), 4) * 0.2;
        }
      });
    }
    n++;
  }
  counts.forest = n;
}

// ---------------------------------------------------------------------------
// CUA — 5 con trên bãi cát phía tây (gần thuyền), bò ngang chậm
async function buildCrabs(scene, rng, tickers, counts, markers, hooks) {
  const gltf = await loadSafe(AM.crab, 'Cua', hooks);
  if (!gltf) return;
  const spots = [[-128, 0], [-130, 8], [-135, -3], [-127, 12], [-133, 5]];
  const crabs = [];
  const mergedProto = mergeStatic(gltf.scene); // gộp 1 lần, dùng chung
  for (const [cx, cz] of spots) {
    const body = mergedProto ? mergedProto.clone() : gltf.scene.clone(true);
    const g = fitToSize(body, 0.42);
    const gy = meshHeight(cx, cz);
    g.position.set(cx, gy, cz);
    const yaw = rng() * Math.PI * 2;
    g.rotation.y = yaw;
    scene.add(g);
    markers.push({ label: 'crab', obj: g });
    crabs.push({ g, cx, cz, gy, yaw, phase: rng() * 6.28, amp: 1.5 + rng() * 1.5 });
  }
  counts.crabs = crabs.length;
  const t0 = performance.now();
  tickers.push(() => {
    const t = (performance.now() - t0) / 1000;
    for (const c of crabs) {
      // cua bò ngang: dịch theo trục vuông góc hướng mặt
      const s = Math.sin(t * 0.35 + c.phase);
      c.g.position.x = c.cx + Math.cos(c.yaw + Math.PI / 2) * s * c.amp;
      c.g.position.z = c.cz - Math.sin(c.yaw + Math.PI / 2) * s * c.amp;
      c.g.position.y = c.gy + 0.02 * Math.abs(Math.sin(t * 2.4 + c.phase));
      c.g.rotation.y = c.yaw + 0.15 * Math.sin(t * 0.8 + c.phase);
    }
  });
}

// ---------------------------------------------------------------------------
// BIỂN: rùa bơi mặt nước + đàn cá tang vàng nhảy khỏi mặt nước
// (nước opaque nên cá dưới nước không thấy — cho cá nhảy lên khỏi mặt nước)
async function buildSeaAnimals(scene, rng, mixers, tickers, counts, markers, hooks) {
  // điểm dưới nước ngoài bãi nam
  const dir = Math.hypot(2, 106) > 0 ? [2 / Math.hypot(2, 106), 106 / Math.hypot(2, 106)] : [0, 1];
  const [wx, wz] = findWaterSpot(2, 106, dir[0], dir[1]);

  const turtleGltf = await loadSafe(AM.turtle, 'Rùa', hooks);
  if (turtleGltf) {
    const g = fitToSize(turtleGltf.scene, 1.0);
    scene.add(g);
    markers.push({ label: 'turtle', obj: g });
    const t0 = performance.now();
    const r = 11, w = 0.12;
    tickers.push(() => {
      const t = (performance.now() - t0) / 1000;
      const a = t * w;
      const x = wx + Math.cos(a) * r, z = wz + Math.sin(a) * r;
      g.position.set(x, 0.06, z);
      g.rotation.set(0.05 * Math.sin(t * 0.5), Math.atan2(-Math.sin(a), Math.cos(a)), 0.08 * Math.sin(t * 0.4), 'YXZ');
    });
    counts.turtle = 1;
  }

  const fishGltf = await loadSafe(AM.fish, 'Cá', hooks);
  if (fishGltf) {
    const fishes = [];
    const N = 6;
    for (let i = 0; i < N; i++) {
      const g = fitToSize(cloneSkinned(fishGltf.scene), 0.30);
      const mixer = new THREE.AnimationMixer(g);
      const clip = fishGltf.animations.find((a) => /swim/i.test(a.name)) || fishGltf.animations[0];
      if (clip) mixer.clipAction(clip).play();
      mixer.setTime(rng() * 2);
      mixers.push(mixer);
      scene.add(g);
      if (i === 0) markers.push({ label: 'fish', obj: g });
      fishes.push({
        g,
        r: 5 + rng() * 5,
        w: 0.25 + rng() * 0.2,
        phase: (i / N) * Math.PI * 2 + rng() * 0.5,
        leapW: 0.5 + rng() * 0.35,
        leapP: rng() * 6.28,
      });
    }
    counts.fish = N;
    const t0 = performance.now();
    tickers.push(() => {
      const t = (performance.now() - t0) / 1000;
      for (const f of fishes) {
        const a = f.phase + t * f.w;
        const x = wx + Math.cos(a) * f.r;
        const z = wz + Math.sin(a) * f.r;
        // nhảy khỏi mặt nước theo chu kỳ, còn lại ẩn dưới nước
        const leap = Math.pow(Math.max(0, Math.sin(t * f.leapW + f.leapP)), 2.0);
        const y = -0.35 + leap * 1.8;
        f.g.position.set(x, y, z);
        const vx = -Math.sin(a) * f.w, vz = Math.cos(a) * f.w;
        f.g.rotation.set(leap > 0.02 ? -0.5 : 0, Math.atan2(vx, vz), 0, 'YXZ');
      }
    });
  }
}

// ---------------------------------------------------------------------------
export async function buildAnimals(scene, onProgress) {
  const rng = mulberry32(CONFIG.seed + 700);
  const mixers = [];
  const tickers = [];
  const counts = {};
  const markers = []; // {label, obj} — cho probe kiểm chứng vị trí
  window.__ANIMALS__ = { mixers: 0, ...counts };

  // Thứ tự NHẸ TRƯỚC (~1.6MB: bướm/cua/rùa/cá/gà/mèo) để user thấy con vật sớm;
  // chó (3.9MB) + hải âu (3.3MB) tải sau cùng.
  // Mỗi nhóm độc lập: lỗi nhóm nào bỏ qua nhóm đó, không ảnh hưởng nhóm khác.
  const total = 7;
  let cur = 0;
  const fails = []; // [{name, msg}] — hiện rõ cho user khi xong, không trôi mất
  const hooks = {
    onRetry: (name, attempt) => {
      if (onProgress) onProgress(cur, total, `↻ ${name} — thử lại lần ${attempt + 1}…`);
    },
    onFail: (name, msg) => {
      fails.push({ name, msg: msg || '' });
      if (onProgress) onProgress(cur, total, `⚠ ${name} tải lỗi — bỏ qua`);
    },
  };
  const groups = [
    ['Bướm', () => buildButterflies(scene, rng, mixers, tickers, counts, markers, hooks)],
    ['Cua', () => buildCrabs(scene, rng, tickers, counts, markers, hooks)],
    ['Rùa & cá', () => buildSeaAnimals(scene, rng, mixers, tickers, counts, markers, hooks)],
    ['Gà & mèo', () => buildChickenCat(scene, rng, tickers, counts, markers, hooks)],
    ['Chó', () => buildDog(scene, rng, tickers, counts, markers, hooks)],
    ['Hải âu', () => buildSeagulls(scene, rng, mixers, tickers, counts, markers, hooks)],
    ['Thú rừng', () => buildForestAnimals(scene, rng, mixers, tickers, counts, markers, hooks)],
  ];
  if (onProgress) onProgress(0, total, 'Đang nạp động vật…');
  for (const [label, g] of groups) {
    try { await g(); } catch (e) {
      const msg = (e && e.message) || String(e);
      console.warn('[animals] bỏ qua nhóm lỗi:', label, msg);
      fails.push({ name: label, msg });
    }
    cur++;
    if (onProgress) onProgress(cur, total, cur >= total ? '' : `Đang nạp động vật… ${cur}/${total} · ${label} ✓`);
  }
  // Lỗi (nếu có) hiện RÕ và giữ lại trên pill — không tự ẩn như khi thành công.
  window.__ANIMALS_FAILS__ = fails;
  if (onProgress) {
    if (fails.length) onProgress(total, total, '⚠ Không tải được: ' + fails.map((f) => f.name).join(', '));
    else onProgress(total, total, '');
  }

  window.__ANIMALS__ = { mixers: mixers.length, ...counts };
  window.__ANIMALS_READY__ = true;
  window.__ANIMALS_DEBUG__ = () => markers.map((m) => ({
    label: m.label,
    p: [+m.obj.position.x.toFixed(2), +m.obj.position.y.toFixed(2), +m.obj.position.z.toFixed(2)],
  }));
  return {
    counts,
    update(dt) {
      for (const m of mixers) m.update(dt);
      for (const t of tickers) t(dt);
    },
  };
}
