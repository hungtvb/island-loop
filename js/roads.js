// roads.js — đường nhựa vòng đảo (vùng thấp) + LỐI MÒN ĐẤT lên hải đăng.
// Đường nhựa nằm trên ledge đã khắc vào địa hình (xem roadpath.js + cliff.js).
// Lối mòn: hẹp (~1.9m), mặt đất nện ấm, mép mềm tan vào cỏ — drap theo địa hình.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { terrainHeight } from './cliff.js';
import { ledgeHeightAt, roadPointAt, TH_MAX, trailPointAt, TRAIL_HALF } from './roadpath.js';

function makeRoadTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#a7aaaf';   // nhựa SÁNG — nổi bật trên nền đá xám trầm + vai đất nâu
  ctx.fillRect(0, 0, 256, 256);
  // nhiễu nhựa đường
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(${160 + Math.random() * 40 | 0},${160 + Math.random() * 40 | 0},${168 + Math.random() * 40 | 0},0.12)`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  // viền trắng DÀY (30px mỗi bên ≈ 0.75m) — đọc rõ là ĐƯỜNG từ góc cao
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(2, 0, 30, 256);
  ctx.fillRect(224, 0, 30, 256);
  // vạch giữa vàng đứt đoạn, to rõ
  ctx.fillStyle = '#f0c93e';
  for (let y = 0; y < 256; y += 86) ctx.fillRect(122, y, 12, 48);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function buildRoad(scene) {
  const R = CONFIG.road;
  const pts = [];
  for (let i = 0; i <= R.samples; i++) {
    const t = i / R.samples;
    const rp = roadPointAt(t);   // tim đường (đã gồm tâm lệch + wobble) — khớp ledge đã khắc
    // mặt đường = cao độ ledge đã khắc + lift — hai bên luôn khớp (xem roadpath.js)
    pts.push(new THREE.Vector3(rp.x, ledgeHeightAt(t) + R.lift, rp.z));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const segs = R.ribbonSegs;
  const hw = R.width / 2;
  const positions = new Float32Array((segs + 1) * 2 * 3);
  const uvs = new Float32Array((segs + 1) * 2 * 2);
  const idx = [];
  const up = new THREE.Vector3(0, 1, 0);
  const p = new THREE.Vector3(), tan = new THREE.Vector3(), side = new THREE.Vector3();
  const approxLen = curve.getLength();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPoint(t, p);
    curve.getTangent(t, tan);
    side.crossVectors(up, tan).normalize().multiplyScalar(hw);
    // bám địa hình ở mép để không bị hở/hõm — nhưng GIỚI HẠN độ nâng (+1.2m)
    // để mép đường không bao giờ dựng thành "cánh buồm" nếu địa hình mép cao
    // bất thường (vách dốc); thay vào đó đường sẽ khép vào vách như đường đèo thật.
    const lx = p.x - side.x, lz = p.z - side.z;
    const rx = p.x + side.x, rz = p.z + side.z;
    const ly = Math.min(Math.max(p.y, terrainHeight(lx, lz) + 0.12), p.y + 1.2);
    const ry = Math.min(Math.max(p.y, terrainHeight(rx, rz) + 0.12), p.y + 1.2);
    positions.set([lx, ly, lz, rx, ry, rz], i * 6);
    const v = (t * approxLen) / 8;
    uvs.set([0, v, 1, v], i * 4);
    if (i < segs) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ map: makeRoadTexture(), roughness: 0.92, metalness: 0 });
  const road = new THREE.Mesh(geo, mat);
  road.receiveShadow = true;
  scene.add(road);

  // điểm mẫu dọc đường để các module khác trừ hành lang
  const roadSamples = curve.getSpacedPoints(600);
  return { curve, roadSamples, length: approxLen };
}

// --- LỐI MÒN ĐẤT lên hải đăng (theo ý user: bỏ đường nhựa lên đồi) ---

function makeTrailTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  // mặt đất nện ấm, MÉP MỀM tan vào cỏ (alpha ngang) — không viền trắng/vạch kẻ
  const g = ctx.createLinearGradient(0, 0, 128, 0);
  g.addColorStop(0.00, 'rgba(150,118,78,0)');
  g.addColorStop(0.22, 'rgba(150,118,78,0.95)');
  g.addColorStop(0.50, 'rgba(159,127,85,1)');
  g.addColorStop(0.78, 'rgba(150,118,78,0.95)');
  g.addColorStop(1.00, 'rgba(150,118,78,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  // lốm đốm sỏi/đất cho mặt mòn tự nhiên
  for (let i = 0; i < 380; i++) {
    const x = Math.random() * 128, y = Math.random() * 128;
    const edge = Math.sin((x / 128) * Math.PI);
    if (edge < 0.2) continue;
    const v = 110 + Math.random() * 70 | 0;
    ctx.fillStyle = `rgba(${v},${v * 0.78 | 0},${v * 0.55 | 0},${0.28 * edge})`;
    const s = 1 + Math.random() * 2.5;
    ctx.fillRect(x, y, s, s);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeDiscTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
  g.addColorStop(0, 'rgba(155,124,82,1)');
  g.addColorStop(0.62, 'rgba(152,121,80,0.95)');
  g.addColorStop(1, 'rgba(150,118,78,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 200; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * 58;
    const x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r;
    const v = 110 + Math.random() * 60 | 0;
    ctx.fillStyle = `rgba(${v},${v * 0.78 | 0},${v * 0.55 | 0},0.25)`;
    ctx.fillRect(x, y, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildTrail(scene) {
  const T = CONFIG.trail;
  const pts = [];
  const N = 400;
  for (let i = 0; i <= N; i++) {
    const p = trailPointAt(i / N);
    pts.push(new THREE.Vector3(p.x, p.y + T.lift, p.z));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const segs = 520, hw = T.width / 2;
  const positions = new Float32Array((segs + 1) * 2 * 3);
  const uvs = new Float32Array((segs + 1) * 2 * 2);
  const idx = [];
  const up = new THREE.Vector3(0, 1, 0);
  const p = new THREE.Vector3(), tan = new THREE.Vector3(), side = new THREE.Vector3();
  const approxLen = curve.getLength();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPoint(t, p);
    curve.getTangent(t, tan);
    side.crossVectors(up, tan).normalize().multiplyScalar(hw);
    // mép bám địa hình cho khỏi hở — lối mòn hẹp nên chỉ nâng nhẹ
    const lx = p.x - side.x, lz = p.z - side.z;
    const rx = p.x + side.x, rz = p.z + side.z;
    const ly = Math.min(Math.max(p.y, terrainHeight(lx, lz) + 0.08), p.y + 0.5);
    const ry = Math.min(Math.max(p.y, terrainHeight(rx, rz) + 0.08), p.y + 0.5);
    positions.set([lx, ly, lz, rx, ry, rz], i * 6);
    const v = (t * approxLen) / 3;
    uvs.set([0, v, 1, v], i * 4);
    if (i < segs) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    map: makeTrailTexture(), transparent: true, depthWrite: false,
    roughness: 1, metalness: 0,
  });
  const trail = new THREE.Mesh(geo, mat);
  trail.renderOrder = 3;
  trail.receiveShadow = true;
  scene.add(trail);

  // vạt đất ở điểm đầu lối mòn — nối liền cuối đường nhựa, che mép nhựa cụt
  const start = trailPointAt(0);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(3.4, 28),
    new THREE.MeshStandardMaterial({ map: makeDiscTexture(), transparent: true, depthWrite: false, roughness: 1, metalness: 0 })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(start.x, terrainHeight(start.x, start.z) + 0.10, start.z);
  disc.renderOrder = 2;
  disc.receiveShadow = true;
  scene.add(disc);

  // bậc đá tự nhiên ở những đoạn dốc nhất (cách nhau ≥6m, tối đa 9 bậc)
  const spaced = curve.getSpacedPoints(220);
  const grades = [];
  for (let i = 1; i < spaced.length; i++) {
    const run = Math.hypot(spaced[i].x - spaced[i - 1].x, spaced[i].z - spaced[i - 1].z);
    grades.push({ i, g: run > 0.01 ? (spaced[i].y - spaced[i - 1].y) / run : 0 });
  }
  grades.sort((a, b) => b.g - a.g);
  const stepGeo = new THREE.CylinderGeometry(0.72, 0.88, 0.16, 7);
  const stepMat = new THREE.MeshStandardMaterial({ color: 0x9a9186, roughness: 0.95, metalness: 0 });
  const picked = [];
  for (const { i, g } of grades) {
    if (g < 0.20 || picked.length >= 9) continue;
    if (picked.some(q => Math.abs(q - i) < 14)) continue;
    picked.push(i);
    const sp = spaced[i], sq = spaced[Math.min(i + 1, spaced.length - 1)];
    const step = new THREE.Mesh(stepGeo, stepMat);
    step.position.set(sp.x, terrainHeight(sp.x, sp.z) + 0.10, sp.z);
    step.rotation.y = Math.atan2(sq.x - sp.x, sq.z - sp.z) + (Math.random() - 0.5) * 0.4;
    const ss = 0.9 + Math.random() * 0.3;
    step.scale.set(ss, 1, ss);
    step.castShadow = true;
    step.receiveShadow = true;
    scene.add(step);
  }

  const trailSamples = curve.getSpacedPoints(320);
  return { trailSamples, length: approxLen };
}
