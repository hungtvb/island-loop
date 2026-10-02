// ui.js — overlay tải, thanh công cụ, ô số liệu kiểm chứng.
export class UI {
  constructor() {
    this.loaderEl = document.getElementById('loader');
    this.barEl = document.getElementById('load-bar-fill');
    this.labelEl = document.getElementById('load-label');
    this.pctEl = document.getElementById('load-pct');
    this.btnPause = document.getElementById('btn-pause');
    this.btnView = document.getElementById('btn-view');
    this.btnOrbit = document.getElementById('btn-orbit');
    this.btnCam1 = document.getElementById('btn-cam1');
    this.btnCam2 = document.getElementById('btn-cam2');
    this.btnFree = document.getElementById('btn-free');
    this.btnCar = document.getElementById('btn-car');
    this.metricsEl = document.getElementById('metrics');
    this.paused = false;
    this.orbitOn = true;
    this.viewMode = 'overview';
    this.camMode = 'free';
  }

  progress(name, frac) {
    this.labelEl.textContent = name;
    const pct = Math.round(frac * 100);
    this.barEl.style.width = pct + '%';
    this.pctEl.textContent = pct + '%';
  }

  // Cảnh báo ngay trên loader khi một bước tải lỗi/timeout — boot vẫn đi tiếp,
  // user thấy rõ phần nào bị bỏ qua thay vì treo thầm lặng ở một con số %.
  warn(msg) {
    let w = document.getElementById('load-warn');
    if (!w) {
      w = document.createElement('div');
      w.id = 'load-warn';
      w.style.cssText = 'color:#ffb74d;font-size:13px;max-width:min(420px,80vw);text-align:center;line-height:1.5';
      this.loaderEl.appendChild(w);
    }
    w.textContent = msg;
  }

  ready() {
    this.loaderEl.classList.add('done');
    setTimeout(() => this.loaderEl.remove(), 600);
  }

  // Chỉ báo tiến trình nạp NỀN (động vật...) — tồn tại độc lập với loader vì
  // loader bị gỡ sau ready(). Dạng viên thuốc nhỏ góc dưới, tự ẩn khi xong.
  bgNote(msg) {
    let n = document.getElementById('bg-note');
    if (!n) {
      n = document.createElement('div');
      n.id = 'bg-note';
      n.style.cssText = 'position:fixed;left:50%;bottom:14px;transform:translateX(-50%);' +
        'background:rgba(20,24,28,.82);color:#e8f0e8;font-size:12px;padding:7px 14px;' +
        'border-radius:16px;z-index:50;pointer-events:none;white-space:nowrap;max-width:92vw;' +
        'overflow:hidden;text-overflow:ellipsis;font-family:system-ui,sans-serif;transition:opacity .4s';
      document.body.appendChild(n);
    }
    n.style.opacity = '1';
    n.textContent = msg;
  }

  bgNoteDone() {
    const n = document.getElementById('bg-note');
    if (n) { n.style.opacity = '0'; setTimeout(() => n.remove(), 500); }
  }

  onPause(cb) {
    this.btnPause.addEventListener('click', () => {
      this.paused = !this.paused;
      this.btnPause.innerHTML = this.paused ? '▶ Tiếp tục' : '⏸ Tạm dừng';
      cb(this.paused);
    });
  }

  onView(cb) {
    this.btnView.addEventListener('click', () => {
      this.viewMode = this.viewMode === 'overview' ? 'lighthouse' : 'overview';
      this.btnView.innerHTML = this.viewMode === 'overview' ? '👁 Hải đăng' : '👁 Toàn cảnh';
      cb(this.viewMode);
    });
  }

  onOrbit(cb) {
    this.btnOrbit.addEventListener('click', () => {
      this.orbitOn = !this.orbitOn;
      this.btnOrbit.innerHTML = this.orbitOn ? '🔁 Tự xoay: bật' : '🔁 Tự xoay: tắt';
      cb(this.orbitOn);
    });
  }

  // P6: camera follow xe — far (xa), chase (đuôi), free (orbit tự do)
  onCamMode(cb) {
    const pick = (m) => { this.camMode = m; this.setCamActive(m); cb(m); };
    this.btnCam1.addEventListener('click', () => pick('far'));
    this.btnCam2.addEventListener('click', () => pick('chase'));
    this.btnFree.addEventListener('click', () => pick('free'));
  }

  setCamActive(m) {
    const on = 'outline:2px solid #ffd54f;';
    if (this.btnCam1) this.btnCam1.style.cssText = m === 'far' ? on : '';
    if (this.btnCam2) this.btnCam2.style.cssText = m === 'chase' ? on : '';
    if (this.btnFree) this.btnFree.style.cssText = m === 'free' ? on : '';
  }

  // P6: đổi xe trong game (không reload)
  onCarSwitch(cb) {
    this.btnCar.addEventListener('click', () => cb());
  }

  setCarLabel(label) {
    if (this.btnCar) this.btnCar.innerHTML = '🔄 Xe: ' + label;
  }

  writeMetrics(m) {
    this.metricsEl.textContent = JSON.stringify(m);
  }
}
