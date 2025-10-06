var u = Object.defineProperty;
var b = (h, t, i) => t in h ? u(h, t, { enumerable: !0, configurable: !0, writable: !0, value: i }) : h[t] = i;
var r = (h, t, i) => b(h, typeof t != "symbol" ? t + "" : t, i);
class w {
  constructor(t, i, e) {
    r(this, "config");
    r(this, "callbacks");
    r(this, "mediaManager");
    r(this, "canvases", /* @__PURE__ */ new Map());
    r(this, "resizeObservers", /* @__PURE__ */ new Map());
    r(this, "animationFrameId", null);
    r(this, "lastRender", 0);
    r(this, "targetFps", 15);
    r(this, "isSafari", /Safari/i.test(navigator.userAgent) && !/Chrome/i.test(navigator.userAgent));
    this.config = t, this.callbacks = i, this.mediaManager = e;
  }
  addParticipant(t) {
    if (!this.config.useMultipleCanvas || !this.config.canvasContainerElement) return;
    const i = this.createCanvas(t, this.config.canvasContainerElement);
    this.config.canvasContainerElement.appendChild(i), this.setupResizeObserver(t, i, this.config.canvasContainerElement), this.startRenderLoop();
  }
  removeParticipant(t) {
    this.removeCanvas(t), this.canvases.size === 0 && this.stopRenderLoop();
  }
  createCanvas(t, i) {
    var c, n, l;
    const e = document.createElement("canvas");
    e.id = `participant-canvas-${t}`, e.style.width = "100%", e.style.height = "100%", e.style.display = "block", e.style.objectFit = "cover", (c = this.config.canvasConfig) != null && c.style && Object.assign(e.style, this.config.canvasConfig.style);
    const o = window.devicePixelRatio || 1, s = i.getBoundingClientRect();
    e.width = (s.width || ((n = this.config.canvasConfig) == null ? void 0 : n.width) || 640) * o, e.height = (s.height || ((l = this.config.canvasConfig) == null ? void 0 : l.height) || 480) * o;
    const a = e.getContext("2d");
    return a && (a.scale(o, o), a.imageSmoothingEnabled = !0, a.imageSmoothingQuality = this.isSafari ? "medium" : "high"), this.canvases.set(t, e), this.callbacks.onParticipantCanvasCreated && this.callbacks.onParticipantCanvasCreated(t, e), e;
  }
  removeCanvas(t) {
    const i = this.resizeObservers.get(t);
    i && (i.disconnect(), this.resizeObservers.delete(t));
    const e = this.canvases.get(t);
    e && e.parentNode && e.parentNode.removeChild(e), this.canvases.delete(t), this.callbacks.onParticipantCanvasRemoved && this.callbacks.onParticipantCanvasRemoved(t);
  }
  setupResizeObserver(t, i, e) {
    const o = () => {
      var l, d;
      const a = window.devicePixelRatio || 1, c = e.getBoundingClientRect();
      i.width = (c.width || ((l = this.config.canvasConfig) == null ? void 0 : l.width) || 640) * a, i.height = (c.height || ((d = this.config.canvasConfig) == null ? void 0 : d.height) || 480) * a;
      const n = i.getContext("2d");
      n && (n.scale(a, a), n.imageSmoothingEnabled = !0, n.imageSmoothingQuality = this.isSafari ? "medium" : "high");
    };
    o();
    const s = new ResizeObserver(o);
    s.observe(e), this.resizeObservers.set(t, s);
  }
  startRenderLoop() {
    if (this.animationFrameId) return;
    const t = () => {
      const i = performance.now();
      if (i - this.lastRender < 1e3 / this.targetFps) {
        this.animationFrameId = requestAnimationFrame(t);
        return;
      }
      this.lastRender = i, this.canvases.forEach((e, o) => this.renderCanvas(o, e)), this.animationFrameId = requestAnimationFrame(t);
    };
    this.animationFrameId = requestAnimationFrame(t);
  }
  stopRenderLoop() {
    this.animationFrameId && (cancelAnimationFrame(this.animationFrameId), this.animationFrameId = null);
  }
  renderCanvas(t, i) {
    const e = i.getContext("2d");
    if (!e) return;
    const o = window.devicePixelRatio || 1, s = i.width / o, a = i.height / o;
    e.clearRect(0, 0, s, a), e.fillStyle = "#3c4043", e.fillRect(0, 0, s, a);
    const c = this.mediaManager.media.get(t), n = c == null ? void 0 : c.videoElement;
    if (n && n.videoWidth > 0 && n.videoHeight > 0 && n) {
      const v = Math.min(s / n.videoWidth, a / n.videoHeight), g = n.videoWidth * v, m = n.videoHeight * v, p = (s - g) / 2, C = (a - m) / 2;
      e.drawImage(n, p, C, g, m);
    } else {
      e.fillStyle = "#222", e.fillRect(0, 0, s, a);
      const v = t.slice(0, 2).toUpperCase();
      e.fillStyle = "#555", e.beginPath();
      const g = Math.min(s, a) * 0.28;
      e.arc(s / 2, a / 2 - 8, g, 0, Math.PI * 2), e.fill(), e.fillStyle = "#ddd", e.font = `${Math.floor(g * 0.9)}px sans-serif`, e.textAlign = "center", e.textBaseline = "middle", e.fillText(v, s / 2, a / 2 - 8);
    }
    e.fillStyle = "rgba(0,0,0,0.6)", e.fillRect(0, a - 40, s, 40), e.fillStyle = "#fff", e.font = "12px sans-serif", e.textAlign = "left", e.textBaseline = "middle", e.fillText(t, 8, a - 20);
    const d = this.mediaManager.getVolume(t), f = Math.min(1, d) * (s - 16);
    f > 0 && (e.fillStyle = d > 0.7 ? "#ea4335" : d > 0.3 ? "#fbbc04" : "#34a853", e.fillRect(8, a - 8, f, 4));
  }
  getCanvases() {
    return new Map(this.canvases);
  }
  getCanvas(t) {
    return this.canvases.get(t) || null;
  }
  cleanup() {
    this.canvases.forEach((t, i) => this.removeCanvas(i)), this.stopRenderLoop();
  }
}
export {
  w as RenderManager
};
