// car.js — P6: xe tự chạy trên đường vòng + car switcher + hỗ trợ camera follow.
// - Jeep 2013 (mặc định): bánh tách riêng → quay theo tốc độ, bánh trước đánh
//   lái vào cua. Vật liệu physical được gọn về standard cho nhẹ mobile.
// - VW van retro: 1 mesh duy nhất (bánh dính liền thân → không quay được);
//   bản _game đã gỡ KHR_materials_unlit nên sáng/tối đúng theo ngày/đêm.
// Xe chạy dọc tim đường vòng khép kín, đúng hướng tiếp tuyến, tốc độ vừa phải.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CONFIG } from './config.js';
import { ledgeHeightAt } from './roadpath.js';

const CARS = [
  {
    id: 'jeep', label: 'Jeep',
    url: 'models/car/2013_equipped_jeep_wrangler_unlimited_rubicon_game.glb',
    targetLen: 4.6,
    wheelNames: ['WheelFL', 'WheelFR', 'WheelBL', 'WheelBR'],
    steerNames: ['WheelFL', 'WheelFR'],
  },
  {
    id: 'van', label: 'Van',
    url: 'models/car/retro_anime_vintage_volkswagen_van_game.glb',
    targetLen: 4.5,
    wheelNames: null, // 1 mesh — bánh không quay được
  },
];

const LOAD_TIMEOUT_MS = 30000;
// Màu đèn xe: ngày (mờ) → đêm (sáng)
const _headDay = new THREE.Color(0xcfd6da), _headNight = new THREE.Color(0xfff3cf);
const _tailDay = new THREE.Color(0x7a1a1a), _tailNight = new THREE.Color(0xff2a1a);
const loader = new GLTFLoader();
function loadSafe(url) {
  return Promise.race([
    loader.loadAsync(url),
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout ' + LOAD_TIMEOUT_MS + 'ms: ' + url)), LOAD_TIMEOUT_MS)),
  ]);
}

// physical → standard (nhẹ shader cho mobile; xe không có texture nên an toàn).
function lightenMaterials(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const conv = mats.map((m) => {
      if (m && m.isMeshPhysicalMaterial) {
        const s = new THREE.MeshStandardMaterial();
        s.color.copy(m.color);
        s.roughness = m.roughness;
        s.metalness = m.metalness;
        s.name = m.name;
        return s;
      }
      return m;
    });
    o.material = Array.isArray(o.material) ? conv : conv[0];
  });
}

// Dựng pivot cho từng bánh (quay quanh trục x) + bọc steer cho bánh trước.
// Trả về [{pivot, steerG, radius}] — radius theo đơn vị local của xe.
function buildWheelPivots(root, wheelNames, steerNames) {
  root.updateMatrixWorld(true);
  const per = {};
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const w of wheelNames) {
      if (o.name.includes(w)) (per[w] = per[w] || []).push(o);
    }
  });
  const out = [];
  const tmp = new THREE.Vector3();
  for (const w of wheelNames) {
    const meshes = per[w] || [];
    if (!meshes.length) continue;
    const box = new THREE.Box3();
    for (const m of meshes) box.expandByObject(m);
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const parent = meshes[0].parent;
    parent.updateWorldMatrix(true, false);
    const pivot = new THREE.Group();
    pivot.position.copy(parent.worldToLocal(c.clone()));
    parent.add(pivot);
    for (const m of meshes) pivot.attach(m);
    let steerG = null;
    if (steerNames.includes(w)) {
      steerG = new THREE.Group();
      steerG.position.copy(pivot.position);
      pivot.parent.add(steerG);
      // đưa pivot về gốc của steerG (giữ nguyên world transform)
      tmp.set(0, 0, 0);
      pivot.position.copy(steerG.worldToLocal(pivot.getWorldPosition(tmp)));
      steerG.attach(pivot);
      pivot.position.set(0, 0, 0);
    }
    out.push({ name: w, pivot, steerG, radius: size.y / 2 });
  }
  return out;
}

// Tạo texture rằn ri quân đội tự nhiên hơn (màu trầm, đốm nhỏ, có nhiễu)
function makeCamoTexture() {
  try {
    const S = 512;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const ctx = cv.getContext('2d');
    // nền xanh olive trầm
    ctx.fillStyle = '#3d4229';
    ctx.fillRect(0, 0, S, S);
    // màu rằn ri trầm tự nhiên (woodland)
    const colors = ['#2a2f1e', '#4a3f2a', '#1f2318', '#55502e'];
    // đốm nhỏ, méo mó tự nhiên
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      const cx = Math.random() * S, cy = Math.random() * S;
      const r = 12 + Math.random() * 28;
      for (let a = 0; a < Math.PI * 2; a += 0.4) {
        const rr = r * (0.5 + Math.random() * 0.8);
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.7;
        if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    }
    // thêm nhiễu hạt cho tự nhiên
    const img = ctx.getImageData(0, 0, S, S);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 18;
      d[i] += n; d[i+1] += n; d[i+2] += n;
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  } catch (e) {
    console.warn('Camo texture failed, using solid color:', e.message);
    return null;
  }
}

// Sơn lại Jeep: rằn ri quân đội, bánh xe đen.
// Nếu tạo camo lỗi thì dùng màu solid để xe vẫn hiện.
function repaintJeep(root) {
  const BLACK = 0x141414;
  const FALLBACK_GREEN = 0x4b5320;
  let camoTex = null;
  try { camoTex = makeCamoTexture(); } catch (e) { camoTex = null; }
  const BODY_MATS = ['carpaint', 'rubiconnone1', 'material', 'material_9', 'extra'];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m) continue;
      const nm = (m.name || '').toLowerCase();
      if (nm.includes('glass') || nm.includes('glows') || nm.includes('plate') || nm.includes('interior') || nm.includes('badges')) continue;
      if (BODY_MATS.some((b) => nm.includes(b))) {
        if (camoTex) {
          m.map = camoTex;
          m.color.setHex(0xffffff);
        } else {
          m.map = null;
          m.color.setHex(FALLBACK_GREEN);
        }
        m.metalness = 0.15;
        m.roughness = 0.75;
        m.needsUpdate = true;
      } else if (nm.includes('rim') || nm.includes('tire') || nm.includes('under')) {
        m.map = null;
        m.color.setHex(BLACK);
        m.metalness = 0.1;
        m.roughness = 0.9;
        m.needsUpdate = true;
      }
    }
  });
}

async function buildOneCar(scene, cfg) {
  const gltf = await loadSafe(cfg.url);
  lightenMaterials(gltf.scene);
  if (cfg.id === 'jeep') repaintJeep(gltf.scene); // sơn xanh rêu + bánh đen theo ý Tony
  const wheels = cfg.wheelNames ? buildWheelPivots(gltf.scene, cfg.wheelNames, cfg.steerNames || []) : [];

  // chuẩn hoá: dài = targetLen (trục z là hướng đầu xe), đáy y=0, tâm xz về 0
  gltf.scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const size = box.getSize(new THREE.Vector3());
  const s = cfg.targetLen / size.z;
  const inner = new THREE.Group();
  inner.add(gltf.scene);
  inner.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  const group = new THREE.Group();
  group.add(inner);
  group.scale.setScalar(s);
  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });

  // Đèn pha / đèn hậu — bóng đèn emissive giả + 1 SpotLight thật chiếu đường.
  // CHỈ sáng ban đêm (setNight). Gắn vào group (đơn vị ≈ mét, đầu xe = +Z).
  const front = cfg.targetLen / 2 - 0.15, rear = -cfg.targetLen / 2 + 0.15;
  const headMats = [], tailMats = [];
  const mkLamp = (x, y, z, r, dayHex, bucket) => {
    const mt = new THREE.MeshBasicMaterial({ color: dayHex, fog: false });
    const mm = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mt);
    mm.position.set(x, y, z);
    group.add(mm);
    bucket.push(mt);
  };
  mkLamp(-0.72, 0.78, front, 0.10, 0xcfd6da, headMats);
  mkLamp(0.72, 0.78, front, 0.10, 0xcfd6da, headMats);
  mkLamp(-0.72, 0.85, rear, 0.07, 0x7a1a1a, tailMats);
  mkLamp(0.72, 0.85, rear, 0.07, 0x7a1a1a, tailMats);
  const spot = new THREE.SpotLight(0xffeecf, 0, 34, 0.55, 0.5, 1.4);
  spot.position.set(0, 1.1, front - 0.3);
  spot.target.position.set(0, 0.1, front + 14);
  group.add(spot);
  group.add(spot.target);

  group.visible = false;
  scene.add(group);
  const wheelR = wheels.length ? wheels[0].radius * s : 0.35 * s;
  return { cfg, group, wheels, scale: s, wheelR, spot, headMats, tailMats };
}

export async function buildCar(scene, roadCurve, roadLength, onProgress) {
  const speed = 8.5; // m/s — vừa phải cho đường tham quan
  const cars = [];
  const total = CARS.length;
  for (let i = 0; i < CARS.length; i++) {
    try {
      if (onProgress) onProgress(i, total, `Đang nạp xe ${CARS[i].label}…`);
      cars.push(await buildOneCar(scene, CARS[i]));
    } catch (e) {
      console.warn('[car] bỏ qua xe lỗi:', CARS[i].id, (e && e.message) || e);
    }
  }
  if (!cars.length) {
    if (onProgress) onProgress(total, total, '⚠ Không tải được xe');
    return null;
  }
  if (onProgress) onProgress(total, total, '');

  const st = {
    cars,
    idx: 0,
    u: 0.02,
    speed,
    roadLength,
    curve: roadCurve,
    ready: true,
    prevYaw: 0,
    steer: 0,
  };
  const pos = new THREE.Vector3(), tan = new THREE.Vector3();
  const active = () => st.cars[st.idx];

  function place(dt) {
    const car = active();
    st.u = (st.u + (st.speed * dt) / st.roadLength) % 1;
    roadCurve.getPointAt(st.u, pos);
    roadCurve.getTangentAt(st.u, tan);
    // Mặt đường visual = ledge + lift (xem roads.js) — xe phải đứng TRÊN mặt
    // đường, không phải trên ledge. Trước đây thiếu +lift nên bánh chìm dưới
    // đường và xe chui qua lòng đất.
    const surfY = ledgeHeightAt(st.u) + CONFIG.road.lift;
    car.group.position.set(pos.x, surfY + 0.06, pos.z);
    const yaw = Math.atan2(tan.x, tan.z);
    const pitch = -Math.asin(THREE.MathUtils.clamp(tan.y, -1, 1));
    car.group.rotation.order = 'YXZ';
    car.group.rotation.set(pitch, yaw, 0);
    // bánh quay + đánh lái
    if (dt > 0) {
      const w = st.speed / car.wheelR;
      let dyaw = yaw - st.prevYaw;
      if (dyaw > Math.PI) dyaw -= Math.PI * 2;
      if (dyaw < -Math.PI) dyaw += Math.PI * 2;
      const yawRate = dyaw / dt;
      const steerTarget = THREE.MathUtils.clamp(Math.atan2(2.9 * yawRate, st.speed), -0.45, 0.45);
      st.steer += (steerTarget - st.steer) * Math.min(1, 7 * dt);
      for (const wh of car.wheels) {
        wh.pivot.rotation.x += w * dt;
        if (wh.steerG) wh.steerG.rotation.y = st.steer;
      }
    }
    st.prevYaw = yaw;
    st.pos = car.group.position;
    st.fwd = tan;
  }
  place(0);
  cars[0].group.visible = true;

  window.__CAR__ = {
    get ready() { return st.ready; },
    get carId() { return active().cfg.id; },
    get u() { return st.u; },
    get pos() { return st.pos ? [st.pos.x, st.pos.y, st.pos.z] : null; },
  };

  return {
    get ready() { return true; },
    get carId() { return active().cfg.id; },
    getPos() { return st.pos ? st.pos.clone() : new THREE.Vector3(); },
    getForward() { return st.fwd ? st.fwd.clone() : new THREE.Vector3(0, 0, 1); },
    setCar(id) {
      const i = st.cars.findIndex((c) => c.cfg.id === id);
      if (i < 0 || i === st.idx) return false;
      active().group.visible = false;
      st.idx = i;
      active().group.visible = true;
      place(0);
      return true;
    },
    carLabel() { return active().cfg.label; },
    // Ban đêm: bật đèn pha (SpotLight chiếu đường) + bóng đèn trước/sau sáng
    setNight(nf) {
      for (const c of st.cars) {
        c.spot.intensity = 150 * nf;
        for (const m of c.headMats) m.color.copy(_headDay).lerp(_headNight, nf);
        for (const m of c.tailMats) m.color.copy(_tailDay).lerp(_tailNight, nf);
      }
    },
    update(dt) { place(dt); },
  };
}
