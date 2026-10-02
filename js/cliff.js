// cliff.js — dựng lưới địa hình đảo + rải đá stylized (instancing).
// Địa hình: heightfield đồi lượn sóng (terrain.js) + khắc ledge đường đèo.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CONFIG } from './config.js';
import { baseTerrainHeight, slopeAt as slopeAtBase, vnoise, smooth01, mulberry32, HX, HZ, headlandMask, plateauFactor } from './terrain.js';
import { roadParam, ledgeFactor, ledgeHalfAt, ledgeHeightAt, trailParam, trailYAt, trailBenchFactor } from './roadpath.js';

const C = CONFIG.cliff;

// Hàm địa hình DUY NHẤT — mọi module (đường, cây, đá, biển) đều dùng chung:
// địa hình gốc + khắc ledge đường nhựa + khắc băng ghế hẹp cho lối mòn đất.
export function terrainHeight(x, z) {
  let h = baseTerrainHeight(x, z);
  const dh = Math.hypot(x - HX, z - HZ);
  // Khắc ledge đường nhựa vào sườn đồi (không khắc trong đĩa đỉnh).
  const rp = roadParam(x, z);
  if (rp && dh > 7) {
    const k = ledgeFactor(rp.dist, ledgeHalfAt(rp.th));
    if (k > 0) {
      const ledgeH = ledgeHeightAt(rp.t);
      h = h * (1 - k) + ledgeH * k;
    }
  }
  // Khắc băng ghế hẹp cho lối mòn đất (như đường mòn leo núi thật) — lối mòn
  // không bao giờ lơ lửng/chôn/dốc đứng dù địa hình đá lởm chởm.
  // Bench đủ mạnh khắp nơi: profile lối mòn đã được tính để bám sát địa hình
  // nên trên đỉnh phẳng bench gần như không phải làm gì (không khắc rãnh).
  // QUAN TRỌNG: không để băng ghế đè lên ledge đường vòng — chỗ nào đường đã
  // khắc phẳng thì giữ nguyên ledge (đường ưu tiên), lối mòn chỉ khắc ở ngoài
  // hành lang đường. Trước đây bench đè lên làm địa hình đội lên mặt đường,
  // xe chui qua đất ở khu hải đăng.
  const tp = trailParam(x, z);
  if (tp) {
    const k = trailBenchFactor(tp.dist);
    if (k > 0) {
      let kk = k;
      if (rp && dh > 7) {
        const roadK = ledgeFactor(rp.dist, ledgeHalfAt(rp.th));
        if (roadK > 0) kk = k * (1 - roadK);
      }
      if (kk > 0) h = h * (1 - kk) + trailYAt(tp.t) * kk;
    }
  }
  // Đệm phẳng dưới công trình đỉnh đồi (nhà + hải đăng): xóa gợn undulation
  // để mảng sân vàng của model nhà chìm hẳn dưới đất, công trình không cập kênh.
  const dHouse = Math.hypot(x - CONFIG.house.pos[0], z - CONFIG.house.pos[2]);
  const dLight = Math.hypot(x - CONFIG.lighthouse.pos[0], z - CONFIG.lighthouse.pos[2]);
  const dB = Math.min(dHouse, dLight);
  if (dB < 7) {
    const k = 1 - smooth01((dB - 4) / 3);
    h = h * (1 - k) + CONFIG.cliff.padHeight * k;
  }
  return h;
}

export function slopeAt(x, z) {
  return slopeAtBase(x, z, terrainHeight);
}

// Lưới cao độ KHỚP TUYỆT ĐỐI với mesh địa hình đã render (bilinear đúng các
// đỉnh đã dựng trong buildTerrain).
// BẮT BUỘC dùng cho mọi scatter đặt vật thể (đá, cây): trên vách đá lởm chởm,
// nội suy tuyến tính của lưới 2.1m lệch khỏi hàm analytic terrainHeight tới
// ~2m — đá/cây đặt theo analytic sẽ LƠ LỬNG trước mặt vách (bug user báo).
const _hg = { n: 0, x0: 0, z0: 0, sx: 1, sz: 1, h: null };
function buildHeightGrid(p) {
  const n = Math.round(Math.sqrt(p.count));
  _hg.n = n;
  _hg.x0 = p.getX(0); _hg.z0 = p.getZ(0);
  _hg.sx = p.getX(1) - p.getX(0);
  _hg.sz = p.getZ(n) - p.getZ(0);
  _hg.h = new Float32Array(p.count);
  for (let k = 0; k < p.count; k++) _hg.h[k] = p.getY(k);
}
export function meshHeight(x, z) {
  const g = _hg;
  if (!g.h) return terrainHeight(x, z);
  const fx = (x - g.x0) / g.sx, fz = (z - g.z0) / g.sz;
  const i0 = Math.floor(fx), j0 = Math.floor(fz), n = g.n;
  if (i0 < 0 || j0 < 0 || i0 + 1 >= n || j0 + 1 >= n) return terrainHeight(x, z);
  const ax = fx - i0, az = fz - j0, H = g.h;
  const a = H[j0 * n + i0], b = H[j0 * n + i0 + 1];
  const c = H[(j0 + 1) * n + i0], d = H[(j0 + 1) * n + i0 + 1];
  return a * (1 - ax) * (1 - az) + b * ax * (1 - az) + c * (1 - ax) * az + d * ax * az;
}

function terrainColor(x, z, h, slope, rng) {
  const dh = Math.hypot(x - HX, z - HZ);
  const n = Math.sin(x * 0.11) * Math.sin(z * 0.13) + Math.sin(x * 0.031 + 1.7) * Math.sin(z * 0.043 + 0.6);
  const patch = vnoise(x * 0.045 + 3.3, z * 0.045 + 8.8);
  let col;
  if (h < 1.7) {
    // cát: loang 2 tông + dải cát ướt sẫm ôm mép nước
    const t = Math.min(Math.max(h / 1.7, 0), 1);
    const pt = 0.5 + 0.5 * Math.sin(patch * 12.6 + n * 1.5);
    const dk = 0.88 + 0.18 * pt;
    col = [(0.91 - 0.06 * t) * dk, (0.82 - 0.05 * t) * dk, (0.60 - 0.04 * t) * dk];
    if (h < 0.55) { const w = 0.80 + 0.2 * (h / 0.55); col = [col[0] * w, col[1] * w, col[2] * w]; }
    col.push(0);
  } else {
    // Đá / cỏ: pha trộn MỀM theo rockMix (0=cỏ, 1=đá) — vành đỉnh chuyển dần sang
    // cỏ khi lên gần mặt đỉnh, không còn lằn ranh cứng giữa đá và cỏ đỉnh đồi.
    // Như ảnh mẫu: đá xám sẫm chỉ lộ ở mũi dựng, đồi phủ xanh.
    // Vùng đá bám đúng mask noise của mũi đá (headlandMask) — khớp địa hình mới.
    let rockMix = slope > 0.55 ? 1 : 0;
    const hr = headlandMask(x, z).hm;
    if (h > 10) rockMix = Math.max(rockMix, smooth01((hr - 0.25) / 0.35));
    const pf = smooth01((h - (C.padHeight - 5)) / 3.5);   // 0 thấp → 1 ở mặt đỉnh
    if (dh < C.padFlat + C.padBlend + 3) rockMix *= (1 - pf);

    // cỏ: thung lũng xanh đậm, gò cao xanh nhạt ấm — địa hình lượn ĐỌC ĐƯỢC
    // bằng màu sắc (như ảnh mẫu), không chỉ bằng bóng đổ
    const hT = smooth01((h - 2) / 12);
    const g = 0.5 + n * 0.09 + (patch - 0.5) * 0.25;
    let grass;
    if (n > 0.9) grass = [0.62 + g * 0.2, 0.66, 0.30];          // mảng cỏ khô
    else grass = [
      0.20 + hT * 0.22 + g * 0.18,
      0.44 + hT * 0.14 + g * 0.16,
      0.18 + hT * 0.08,
    ];

    // đá: xám nâu ẤM, vân blotch 3D-ish — TRỘN CAO ĐỘ h vào tọa độ noise để chi
    // tiết vỡ ra mọi hướng trên vách dựng, không còn sọc dọc "vẽ máy".
    // (noise chỉ theo xz trên vách đứng sẽ bị kéo thành sọc dọc)
    const bn = vnoise(x * 0.16 + h * 0.17 + 4.4, z * 0.16 - h * 0.13 + 1.9);
    const bn2 = vnoise(x * 0.05 - h * 0.06 + 9.1, z * 0.05 + h * 0.08 + 3.7);
    const shade = 0.92 + 0.20 * bn + 0.08 * (bn2 - 0.5);
    const v = (0.25 + n * 0.025 + rng() * 0.030) * shade;
    const rock = [v * 1.14, v * 0.99, v * 0.85];

    col = [
      grass[0] + (rock[0] - grass[0]) * rockMix,
      grass[1] + (rock[1] - grass[1]) * rockMix,
      grass[2] + (rock[2] - grass[2]) * rockMix,
      rockMix,
    ];
  }
  // Vai đường: dải ĐẤT ĐÁ SẪM ôm hai bên mặt nhựa → mặt đường sáng nổi bật
  // trên nền tối (như ảnh mẫu). Chỉ ngoài mặt đường, không đè lên cát mép nước.
  if (h > 0.8) {
    const rp = roadParam(x, z);
    if (rp) {
      const hw = ledgeHalfAt(rp.th);
      const k = ledgeFactor(rp.dist, hw);
      const roadHW = CONFIG.road.width / 2 + 0.3;
      if (k > 0.15 && rp.dist > roadHW) {
        const sh = Math.min(1, (k - 0.15) * 2.2) * 0.75;
        col[0] = col[0] * (1 - sh) + 0.21 * sh;
        col[1] = col[1] * (1 - sh) + 0.175 * sh;
        col[2] = col[2] * (1 - sh) + 0.15 * sh;
      }
    }
  }
  return col;
}

export function buildTerrain(scene) {
  const SIZE = 420, SEG = 200;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const rockF = new Float32Array(pos.count);
  const rng = mulberry32(CONFIG.seed);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    const s = slopeAt(x, z);
    const [r, g, b, rock] = terrainColor(x, z, h, s, rng);
    colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = b;
    rockF[i] = rock;
  }
  buildHeightGrid(pos);   // lưới cao độ khớp mesh render — scatter ĐÁ/CÂY dùng meshHeight
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aRock', new THREE.BufferAttribute(rockF, 1));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  // Gân đá chi tiết ở mức per-pixel: nhiễu normal chỉ trên vùng đá (vRock=1),
  // cát/cỏ giữ mịn. Không tốn thêm đỉnh nào.
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aRock;\nvarying float vRock;\nvarying vec3 vRPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRock = aRock;\nvRPos = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vRock;
        varying vec3 vRPos;
        float rhash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float rnoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          float a = rhash(i), b = rhash(i + vec2(0.0, 1.0));
          float c = rhash(i + vec2(0.0, 1.0)), d = rhash(i + vec2(1.0, 1.0));
          return a + (b - a) * u.x + (c - a) * u.y + (a - b - c + d) * u.x * u.y;
        }`)
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
        if (vRock > 0.01) {
          // TRỘN vRPos.y vào tọa độ noise: trên vách dựng, normal phải đổi theo
          // chiều đứng — noise chỉ theo xz sẽ bị kéo thành sọc dọc.
          vec2 ruv = vRPos.xz * 1.35 + vRPos.y * 0.9;
          vec2 ruv2 = vRPos.xz * 4.2 - vRPos.y * 1.7;
          float b0 = rnoise(ruv) * 0.6 + rnoise(ruv2) * 0.4;
          float bx = rnoise(ruv + vec2(0.35, 0.0)) * 0.6 + rnoise(ruv2 + vec2(0.35, 0.0)) * 0.4;
          float bz = rnoise(ruv + vec2(0.0, 0.35)) * 0.6 + rnoise(ruv2 + vec2(0.0, 0.35)) * 0.4;
          normal = normalize(normal + vec3((b0 - bx) * 2.6, 0.0, (b0 - bz) * 2.6) * vRock);
        }`);
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

// Rải đá stylized (InstancedMesh từng mesh con).
// 4 nhóm: sườn mũi đá + bãi cát quanh đảo + chân vách đá phía biển (ôm mép nước)
// + mảng đá găm trên mặt vách phía biển.
// Mẫu trừ lối mòn (setTrailSamples) để đá không chặn lối đi bộ.
// CAO ĐỘ ĐẶT ĐÁ = meshHeight (mặt mesh render thật), KHÔNG dùng terrainHeight
// analytic — trên vách lởm chởm analytic lệch khỏi mặt render tới ~2m khiến đá
// lơ lửng (bug user báo "đá bay trên không trung").
let _trailSamples = null;
export function setTrailSamples(s) { _trailSamples = s; }

export async function scatterRocks(scene, roadSamples) {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(CONFIG.models.rocks);
  gltf.scene.updateMatrixWorld(true);
  const meshes = [];
  gltf.scene.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const rng = mulberry32(CONFIG.seed + 7);
  const dummy = new THREE.Object3D();
  const group = new THREE.Group();

  // Đá stylized: model gốc trắng kem (unlit) — phủ vật liệu đá xám ấm có shading
  // để tảng đá ngồi tự nhiên trong cảnh (trắng nguyên bản trông như tuyết).
  const rockMat = new THREE.MeshStandardMaterial({ color: 0xb5aca0, roughness: 0.95, metalness: 0 });

  function placeGroup(o) {
    let placed = 0;
    for (const m of meshes) {
      const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
      // Chuẩn hoá gốc về ĐÁY–TÂM model: các mesh đá trong GLB nằm lệch khỏi
      // origin theo layout scene của artist (vài mét) — không chuẩn hoá thì đá
      // bị đặt lệch hàng mét, trên vách dốc quy thành LƠ LỬNG (bug user báo).
      g.computeBoundingBox();
      const rbb = g.boundingBox;
      g.translate(-(rbb.min.x + rbb.max.x) / 2, -rbb.min.y, -(rbb.min.z + rbb.max.z) / 2);
      const im = new THREE.InstancedMesh(g, rockMat, o.count);
      let made = 0, guard = o.count * 60;
      while (made < o.count && guard-- > 0) {
        const a = rng() * Math.PI * 2;
        const dc = o.dcMin + rng() * (o.dcMax - o.dcMin);
        const x = o.cx + Math.cos(a) * dc, z = o.cz + Math.sin(a) * dc;
        const h = meshHeight(x, z);   // khớp mặt render — không lơ lửng
        if (h < o.hMin || h > o.hMax) continue;
        let near = false;
        for (const p of roadSamples) {
          const dx = x - p.x, dz = z - p.z;
          if (dx * dx + dz * dz < o.roadClear * o.roadClear) { near = true; break; }
        }
        // lối mòn đất: đá tảng không chặn lối đi bộ (hành lang hẹp hơn đường nhựa)
        if (!near && _trailSamples) {
          const tc = o.trailClear !== undefined ? o.trailClear : 3.2;
          for (const p of _trailSamples) {
            const dx = x - p.x, dz = z - p.z;
            if (dx * dx + dz * dz < tc * tc) { near = true; break; }
          }
        }
        if (near) continue;
        const s = o.sMin + rng() * (o.sMax - o.sMin);
        dummy.position.set(x, h - o.sink * s, z);
        dummy.rotation.set(0, rng() * Math.PI * 2, 0);
        dummy.scale.set(s, s * (0.8 + rng() * 0.5), s);
        dummy.updateMatrix();
        im.setMatrixAt(made, dummy.matrix);
        made++; placed++;
      }
      im.count = made;
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = true;
      im.receiveShadow = true;
      im.frustumCulled = false;
      group.add(im);
    }
    return placed;
  }

  let placed = 0;
  // A. Sườn mũi đá: găm vào sườn + quanh chân (đá xám sẫm lộ giữa cây như ảnh mẫu)
  placed += placeGroup({ count: 12, cx: HX, cz: HZ, dcMin: 10, dcMax: 38,
    hMin: 0.4, hMax: 24, sMin: 0.8, sMax: 2.6, sink: 0.45, roadClear: 9 });
  // B. Đá bãi cát quanh đảo (nhỏ, lún nông) — vòng bãi cát dịch theo bờ biến thiên
  placed += placeGroup({ count: 12, cx: 0, cz: 0, dcMin: 80, dcMax: 170,
    hMin: 0.2, hMax: 1.8, sMin: 0.3, sMax: 0.9, sink: 0.35, roadClear: 6 });
  // C. Đá chân vách đá phía biển (đông): nhô khỏi mặt nước — hết vẻ "cắm thẳng như bị cắt"
  placed += placeGroup({ count: 12, cx: HX + 30, cz: HZ, dcMin: 8, dcMax: 30,
    hMin: -1.5, hMax: 1.2, sMin: 1.2, sMax: 2.8, sink: 0.25, roadClear: 8 });
  // D. Mảng đá lởm chởm GĂM TRÊN MẶT VÁCH phía biển: găm sâu vào vách dựng cho mặt
  // đá có chi tiết lồi lõm tự nhiên, phá vẻ "vẽ máy" của heightfield
  placed += placeGroup({ count: 14, cx: HX + 16, cz: HZ, dcMin: 2, dcMax: 26,
    hMin: 3, hMax: 24, sMin: 0.5, sMax: 1.6, sink: 0.7, roadClear: 7 });

  scene.add(group);
  return placed;
}
