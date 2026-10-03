// main.js — khởi động P1: tải async theo từng bước, không treo main thread.
import * as THREE from 'three';
import { CONFIG, FAST, MOBILE } from './config.js';
import { createRenderer, createScene, createCamera, createControls, fitResize } from './scene.js';
import { buildLights, buildSky, buildClouds } from './lighting.js';
import { createDayNight } from './daynight.js';
import { createWeather } from './weather.js';
import { buildStreetlights } from './streetlights.js';
import { buildSea } from './water.js';
import { buildTerrain, scatterRocks, setTrailSamples as setRockTrailSamples, meshHeight } from './cliff.js';
import { buildRoad, buildTrail } from './roads.js';
import { buildLighthouse, buildKeeperHouse } from './lighthouse.js';
import { plantJabami, plantPalms, plantGrass, plantCliffGreens, plantRoadCorridor, setTrailSamples as setVegTrailSamples } from './vegetation.js';
import { buildVillage } from './village.js';
import { buildPier } from './pier.js';
import { buildReef } from './reef.js';
import { buildWaterfall } from './waterfall.js';
import { buildPaddy } from './paddy.js';
import { buildFlowerTrees } from './flowertree.js';
import { buildPalmForest } from './palmforest.js';
import { buildAnimals } from './animals.js';
import { buildCar } from './car.js';
import { roadCurve } from './roadpath.js';
import { UI } from './ui.js';

const T0 = performance.now();

const ui = new UI();
const renderer = createRenderer(document.getElementById('scene'));
// Cảnh P1 tĩnh: giữ shadow map đóng băng ngay từ đầu để quá trình tải model không
// vô tình vẽ lại toàn bộ pass bóng ở mỗi frame. Sau khi đủ cây/đá/nhà, boot() chỉ
// cập nhật shadow map đúng một lần. Cách này giảm mạnh jank cả desktop lẫn mobile.
renderer.shadowMap.autoUpdate = false;
// Trình render phần mềm (máy kiểm thử/thiết bị không có GPU) không đủ sức cho pass
// bóng của hàng trăm cây; tự hạ bóng thay vì khóa main thread hàng chục giây.
const gl = renderer.getContext();
const dbg = gl.getExtension('WEBGL_debug_renderer_info');
const rendererName = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '';
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|software/i.test(rendererName || '');
if (SOFTWARE_RENDERER) renderer.shadowMap.enabled = false;
const scene = createScene();
const camera = createCamera();
const controls = createControls(camera, renderer.domElement);
fitResize(renderer, camera);
// Debug: ?cam=x,z để nhảy camera tới tọa độ (QA vị trí thú)
// Camera bay cao theo địa hình, không chôn trong đồi
try {
  const m = new URLSearchParams(location.search).get('cam');
  if (m) {
    const [cx, cz] = m.split(',').map(Number);
    if (isFinite(cx) && isFinite(cz)) {
      const camX = cx + 15, camZ = cz + 15;
      const camY = Math.max(meshHeight(camX, camZ), meshHeight(cx, cz)) + 12;
      camera.position.set(camX, camY, camZ);
      controls.target.set(cx, meshHeight(cx, cz) + 2, cz);
      controls.update();
    }
  }
} catch (e) {}

// Phần dựng đồng bộ, nhẹ (vài chục ms): trời, biển, địa hình, đường
const { sun, hemi } = buildLights(scene);
const sky = buildSky(scene);
const clouds = buildClouds(scene);
const sea = buildSea(scene);
buildTerrain(scene);
const { roadSamples, length: roadLen } = buildRoad(scene);
// Đèn đường 2 bên đường vòng (instanced, chỉ sáng ban đêm)
const street = buildStreetlights(scene, roadCurve());
// Ngày/đêm + thời tiết — khởi tạo sau khi có đủ sun/sky/clouds/sea
const daynight = createDayNight({ scene, renderer, sun, hemi, sky, clouds, sea });
const weather = createWeather({ scene, sun, hemi, clouds });
window.__DAYNIGHT__ = daynight;
window.__WEATHER__ = weather;
// Lối mòn đất lên hải đăng (drap theo địa hình, không khắc ledge)
const { trailSamples, length: trailLen } = buildTrail(scene);
setVegTrailSamples(trailSamples);
setRockTrailSamples(trailSamples);

let paused = false;
let simTime = 0;
let lighthouseTick = null;
let villageTick = null;
let pierTick = null;
let reefTick = null;
let waterfallTick = null;
let paddyTick = null;
let flowerTick = null;
let palmTick = null;
let animalTick = null;
let carApi = null;

// P6: camera follow xe — 'free' (orbit như cũ) | 'far' (theo từ xa) | 'chase' (sát đuôi)
let camMode = 'free';
function setCamMode(m) {
  if ((m === 'far' || m === 'chase') && !carApi) return; // xe chưa nạp xong
  camMode = m;
  viewTarget = null;
  controls.enabled = (m === 'free');
  ui.setCamActive(m);
}

ui.onPause((p) => { paused = p; });
ui.onOrbit((on) => { controls.autoRotate = on; });
ui.onCamMode((m) => setCamMode(m));
ui.onCarSwitch(() => {
  if (!carApi) return;
  const other = carApi.carId === 'jeep' ? 'van' : 'jeep';
  if (carApi.setCar(other)) ui.setCarLabel(carApi.carLabel());
});
// Ngày/đêm + thời tiết (máy render phần mềm: vẽ lại 1 frame sau khi đổi)
ui.onTime((h) => {
  daynight.setTime(h);
  if (SOFTWARE_RENDERER) requestAnimationFrame(() => renderer.render(scene, camera));
});
ui.onWeather((m) => {
  weather.setWeather(m);
  if (SOFTWARE_RENDERER) requestAnimationFrame(() => renderer.render(scene, camera));
});
ui.setTimeActive(9);
ui.setWeatherActive('sunny');
window.addEventListener('keydown', (e) => {
  if (e.key === '1') setCamMode('far');
  else if (e.key === '2') setCamMode('chase');
  else if (e.key === '0') setCamMode('free');
});

// Bay mượt tới góc nhìn preset (giữ viewTarget cho tương lai, hiện tắt nút view)
let viewTarget = null;

// Phát hiện treo main thread:
//  - stepCpuSumMs:  TỔNG CPU thuần của mọi bước tải (parse GLB + dựng instanced + địa hình)
//                    — con số trung thực nhất về chi phí tải, có ý nghĩa trên mọi máy.
//  - maxStepGapMs:  CPU thuần của bước nặng nhất — bước nào block main thread lâu nhất.
//  - maxFrameGapMs: khoảng trống frame dài nhất trong lúc tải. TRÊN MÁY TEST (SwiftShader
//                    vẽ bằng phần mềm) số này bao gồm cả thời gian raster từng frame bằng CPU
//                    nên rất to — KHÔNG phải thời gian treo. Trên GPU thật nó sẽ nhỏ hơn nhiều.
//  - coldLoadS:     wall-clock từ lúc mở trang tới khi sẵn sàng, ĐO TRÊN MÁY TEST.
//                    Bao gồm cả raster phần mềm của SwiftShader → không đại diện cho máy thật.
let stepCpuSumMs = 0;
let maxStepGapMs = 0;
let maxFrameGapMs = 0;
let lastFrameT = performance.now();
let loading = true;
const nextFrame = () => new Promise((r) => requestAnimationFrame(r));

// SwiftShader (trình kiểm thử / máy không có GPU) không render liên tục để tránh
// khóa CPU. Khi viewport đổi (xoay màn hình, chuyển desktop ↔ mobile), canvas bị
// clear nên cần vẽ lại đúng một frame sau resize; GPU thật vẫn dùng vòng lặp thường.
window.addEventListener('resize', () => {
  if (!loading && SOFTWARE_RENDERER) requestAnimationFrame(() => renderer.render(scene, camera));
});

// FIX GỐC kẹt loading 12% (lần 3): trên mạng thật chập chờn, một request model
// (vd hải đăng 4.6MB) có thể stall vĩnh viễn — promise không settle, boot dừng
// thầm lặng ở đúng bước đó. Ép mọi bước settle bằng timeout + bắt lỗi, và đặt
// deadline toàn cục để cảnh LUÔN mở được.
const STEP_TIMEOUT_MS = 25000;  // mỗi bước boot: quá 25s coi như lỗi, bỏ qua bước
const BOOT_DEADLINE_MS = 60000; // backstop toàn cục: cảnh luôn mở trong 60s

function withTimeout(promise, ms, label) {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error('timeout ' + ms + 'ms: ' + label)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

async function step(name, frac, fn) {
  ui.progress(name, frac);
  await nextFrame();  // nhả main thread để UI kịp vẽ (1 frame là đủ)
  const t = performance.now();
  let out;
  try {
    out = await withTimeout(fn(), STEP_TIMEOUT_MS, name);
  } catch (e) {
    // Bước lỗi/timeout: cảnh báo NGAY TRÊN LOADER rồi đi tiếp — không để một
    // model treo cả quá trình boot.
    console.warn('[boot] bước lỗi, bỏ qua:', name, '-', (e && e.message) || e);
    ui.warn(name + ' tải lỗi — bỏ qua, tiếp tục');
    return undefined;
  }
  const dur = performance.now() - t;
  maxStepGapMs = Math.max(maxStepGapMs, dur);
  stepCpuSumMs += dur;
  return out;
}

const counts = {};

let finished = false;
let deadlineTimer = null;

// Kết thúc boot — idempotent: đường bình thường và deadline backstop không đá nhau.
function finishBoot(forced) {
  if (finished) return;
  finished = true;
  if (deadlineTimer) clearTimeout(deadlineTimer);
  loading = false;
  ui.progress('Hoàn tất', 1);

  if (!forced) {
    // Toàn bộ vật thể P1 đã có mặt: cập nhật shadow map đúng một lần rồi tiếp tục
    // dùng lại texture bóng tĩnh. Không warm-up nhiều frame — SwiftShader và GPU
    // mobile đều tránh được cú raster lặp không cần thiết.
    if (!FAST && !SOFTWARE_RENDERER) renderer.shadowMap.needsUpdate = true;

    const readyS = (performance.now() - T0) / 1000;
    renderer.render(scene, camera);
    const info = renderer.info.render;
    const metrics = {
      coldLoadS: +readyS.toFixed(2),
      stepCpuSumMs: +stepCpuSumMs.toFixed(0),
      maxStepGapMs: +maxStepGapMs.toFixed(1),
      maxFrameGapMs: +maxFrameGapMs.toFixed(0),
      drawCalls: info.calls,
      triangles: info.triangles,
      roadLengthM: Math.round(roadLen),
      trailLengthM: Math.round(trailLen),
      trees: counts,
    };
    ui.writeMetrics(metrics);
    window.__P1_METRICS__ = metrics;
    try {
      fetch('__metrics__?' + new URLSearchParams({ m: JSON.stringify(metrics) }).toString()).catch(() => {});
    } catch (e) { /* bỏ qua */ }
  } else {
    // Deadline backstop: mở cảnh với những gì đã tải được, đánh dấu để test biết.
    console.warn('[boot] quá deadline — mở cảnh ở chế độ rút gọn');
    const metrics = { forced: true, coldLoadS: +((performance.now() - T0) / 1000).toFixed(2) };
    ui.writeMetrics(metrics);
    window.__P1_METRICS__ = metrics;
    window.__P1_FORCED__ = true;
  }

  window.__P1_READY__ = true;
  ui.ready();

  // P2 + P3 nạp NỀN sau khi cảnh đã mở — không chặn boot. Mỗi model có
  // timeout/fallback riêng trong module của nó; lỗi thì bỏ qua phần đó.
  // Xong thì cập nhật shadow map một lần để làng/rừng có bóng.
  const refreshShadows = () => { if (!SOFTWARE_RENDERER) renderer.shadowMap.needsUpdate = true; };
  const bgLoad = (label, fn, onDone) => {
    Promise.resolve().then(fn).then(
      (r) => { console.log('[bg] xong:', label); refreshShadows(); if (onDone) onDone(r); },
      (e) => console.warn('[bg] lỗi:', label, e && e.message)
    );
  };
  bgLoad('Làng chài P2', () => buildVillage(scene), (v) => { villageTick = v; counts.houses = v.houseCount; });
  bgLoad('Cầu tàu P4', () => buildPier(scene), (p) => { pierTick = p; });
  bgLoad('Rạn san hô P4', () => buildReef(scene), (r) => { reefTick = r; counts.reef = r.count; });
  bgLoad('Thác nước P5', () => buildWaterfall(scene), (w) => { waterfallTick = w; });
  bgLoad('Ruộng lúa P5', () => buildPaddy(scene), (p) => { paddyTick = p; });
  bgLoad('Cây hoa P5', () => buildFlowerTrees(scene), (f) => { flowerTick = f; });
  bgLoad('Rừng dừa P3', () => buildPalmForest(scene), (p) => { palmTick = p; counts.palmForest = p.counts; });
  bgLoad('Động vật', () => buildAnimals(scene, (done, total, note) => {
    // Chỉ báo tiến trình nạp nền — loader chính đã gỡ sau ready().
    // done>=total + còn note = có lỗi: GIỮ pill lại cho user đọc, không tự ẩn.
    if (done >= total) { if (note) ui.bgNote(note); else ui.bgNoteDone(); }
    else ui.bgNote(note || `Đang nạp động vật… ${done}/${total}`);
  }), (a) => { animalTick = a; counts.animals = a.counts; });
  // P6: xe tự chạy — nạp nền sau boot, không chặn cảnh
  bgLoad('Xe P6', () => buildCar(scene, roadCurve(), roadLen, (done, total, note) => {
    if (done >= total) ui.bgNoteDone();
    else ui.bgNote(note || `Đang nạp xe… ${done}/${total}`);
  }), (c) => { carApi = c; if (c) ui.setCarLabel(c.carLabel()); });
}

async function boot() {
  const steps = [
    ['Hải đăng', 0.12, async () => { lighthouseTick = await buildLighthouse(scene); }],
    ['Nhà gác đèn', 0.24, () => buildKeeperHouse(scene)],
    ['Đá vách đá', 0.34, () => scatterRocks(scene, roadSamples)],
    ['Cây jabami v1', 0.44, async () => { counts.j1 = await plantJabami(scene, 0, roadSamples); }],
    ['Cây jabami v2', 0.54, async () => { counts.j2 = await plantJabami(scene, 1, roadSamples); }],
    ['Cây jabami v3', 0.64, async () => { counts.j3 = await plantJabami(scene, 2, roadSamples); }],
    ['Cây jabami v4', 0.74, async () => { counts.j4 = await plantJabami(scene, 3, roadSamples); }],
    ['Cây phủ sườn đá', 0.79, async () => { counts.cliff = await plantCliffGreens(scene, roadSamples); }],
    ['Rừng dừa', 0.84, async () => { counts.palm = await plantPalms(scene, roadSamples); }],
    ['Cỏ dại', 0.90, async () => { counts.grass = await plantGrass(scene, roadSamples); }],
    ['Hành lang cây', 0.94, async () => { counts.corridor = await plantRoadCorridor(scene, roadSamples); }],
  ];
  for (const [name, frac, fn] of steps) await step(name, frac, fn);
  finishBoot(false);
}

const clock = new THREE.Clock();

// Hook kiểm chứng (chỉ dùng khi test): đặt góc máy ngay + chụp canvas.
// Render + toDataURL đồng bộ trong cùng một task — không phụ thuộc rAF/compositor.
window.__P1_CAM__ = { camera, controls };
window.__P1_SCENE__ = scene;
window.__CAM__ = { get mode() { return camMode; }, setMode: (m) => setCamMode(m) };
const _followFlat = new THREE.Vector3();
const _followDes = new THREE.Vector3();
const _followLook = new THREE.Vector3();
window.__P1_SHOT__ = () => {
  renderer.render(scene, camera);
  return renderer.domElement.toDataURL('image/png');
};

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  if (loading) maxFrameGapMs = Math.max(maxFrameGapMs, now - lastFrameT);
  lastFrameT = now;

  const dt = Math.min(clock.getDelta(), 0.1);
  if (!paused) {
    simTime += dt;
    sea.update(dt, simTime);
    clouds.update(dt);
    // Ngày/đêm trước, thời tiết sau (thời tiết chỉnh trên giá trị gốc trong ngày)
    daynight.update(dt);
    const nf = daynight.nightFactor;
    weather.update(dt, nf);
    // Đẩy nightFactor tới các module: hải đăng, làng, xe, đèn đường
    if (lighthouseTick && lighthouseTick.setNight) lighthouseTick.setNight(nf);
    if (villageTick && villageTick.setNight) villageTick.setNight(nf);
    if (pierTick && pierTick.userData.setNight) pierTick.userData.setNight(nf);
    if (carApi && carApi.setNight) carApi.setNight(nf);
    if (street) street.setNight(nf);
    if (lighthouseTick) lighthouseTick.update(dt);
    if (villageTick) villageTick.update(dt);
    if (palmTick) palmTick.update(dt);
    if (animalTick) animalTick.update(dt);
    if (carApi) carApi.update(dt);
    if (waterfallTick && waterfallTick.userData.tick) waterfallTick.userData.tick(dt);
    if (paddyTick && paddyTick.userData.tick) paddyTick.userData.tick(dt, simTime);
    if (flowerTick && flowerTick.userData.tick) flowerTick.userData.tick(dt, simTime);
  }
  if (viewTarget) {
    const k = 1 - Math.exp(-3 * dt);
    camera.position.lerp(viewTarget.pos, k);
    controls.target.lerp(viewTarget.tgt, k);
    if (camera.position.distanceTo(viewTarget.pos) < 0.5) viewTarget = null;
  }
  if (camMode === 'free') {
    controls.update();
  } else if (carApi && carApi.ready) {
    // P6: camera follow xe — far: cao + xa thấy toàn cảnh; chase: sát đuôi
    const cp = carApi.getPos(), cf = carApi.getForward();
    _followFlat.set(cf.x, 0, cf.z).normalize();
    let kk;
    if (camMode === 'far') {
      _followDes.copy(cp).addScaledVector(_followFlat, -30);
      _followDes.y = cp.y + 17;
      _followLook.copy(cp).addScaledVector(_followFlat, 8);
      kk = 1 - Math.exp(-2.5 * dt);
    } else {
      _followDes.copy(cp).addScaledVector(_followFlat, -8);
      _followDes.y = cp.y + 3.4;
      _followLook.copy(cp).addScaledVector(_followFlat, 12);
      _followLook.y += 1.2;
      kk = 1 - Math.exp(-5 * dt);
    }
    camera.position.lerp(_followDes, kk);
    controls.target.lerp(_followLook, kk);
    camera.lookAt(controls.target);
  }
  // Loader che toàn bộ canvas: không raster cảnh 3D đang dở trong lúc chờ/parse GLB.
  // Tránh SwiftShader hoặc GPU mobile giành main thread giữa các bước tải.
  if (!loading && !SOFTWARE_RENDERER) renderer.render(scene, camera);
}

// Deadline toàn cục: dù boot() kẹt ở đâu, cảnh LUÔN mở trong 60s.
deadlineTimer = setTimeout(() => {
  if (!finished) {
    ui.warn('Tải quá lâu — mở cảnh với những gì đã có');
    finishBoot(true);
  }
}, BOOT_DEADLINE_MS);

// Phòng tuyến cuối: boot() không bao giờ được treo thầm lặng.
boot().catch((e) => {
  console.error('[boot] fatal', e);
  ui.warn('Khởi động gặp lỗi — mở cảnh với những gì đã có');
  finishBoot(true);
});
animate();
