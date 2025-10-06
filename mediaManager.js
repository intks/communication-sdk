var f = Object.defineProperty;
var p = (n, t, e) => t in n ? f(n, t, { enumerable: !0, configurable: !0, writable: !0, value: e }) : n[t] = e;
var r = (n, t, e) => p(n, typeof t != "symbol" ? t + "" : t, e);
class v {
  constructor(t, e) {
    r(this, "callbacks");
    r(this, "subscriptionManager");
    r(this, "audioContext", null);
    r(this, "selfId", null);
    r(this, "isSafari", /Safari/i.test(navigator.userAgent) && !/Chrome/i.test(navigator.userAgent));
    r(this, "media", /* @__PURE__ */ new Map());
    this.callbacks = t, this.subscriptionManager = e;
  }
  initializeParticipant(t) {
    this.media.set(t, {
      remoteStream: null,
      videoElement: null,
      audioElement: null,
      volume: 0,
      streamStatus: { hasAudio: !1, hasVideo: !1, isActive: !1, lastUpdated: Date.now() }
    });
  }
  addStreams(t, e) {
    const a = this.media.get(t), s = e.map((o) => o.mediaStreamTrack).filter((o) => o);
    let i;
    return a != null && a.remoteStream ? (i = a.remoteStream, s.forEach((o) => {
      i.getTrackById(o.id) || i.addTrack(o);
    })) : i = new MediaStream(s), a && (a.remoteStream = i), i;
  }
  removeStreams(t, e) {
    const a = this.media.get(t);
    return a != null && a.remoteStream ? (e.forEach((s) => {
      s.mediaStreamTrack && a.remoteStream.removeTrack(s.mediaStreamTrack);
    }), a.remoteStream.getAudioTracks().some((s) => s.readyState === "live") || this.cleanupAudio(t), this.updateVideoElement(t), a.remoteStream.getTracks().length > 0) : !1;
  }
  attachStreams(t) {
    const e = this.media.get(t);
    e != null && e.remoteStream && (this.updateVideoElement(t), t !== this.selfId && e.remoteStream.getAudioTracks().length > 0 ? this.setupAudioPlayback(t) : t === this.selfId && this.cleanupAudio(t), this.updateStreamStatus(t));
  }
  updateVideoElement(t) {
    const e = this.media.get(t);
    if (e != null && e.remoteStream)
      if (e.videoElement)
        e.videoElement.srcObject = e.remoteStream, e.videoElement.play().catch(() => {
        });
      else {
        const a = document.createElement("video");
        a.autoplay = !0, a.playsInline = !0, a.muted = !0, a.srcObject = e.remoteStream, a.play().catch(() => {
        }), e.videoElement = a;
      }
  }
  setupAudioPlayback(t) {
    const e = this.media.get(t);
    if (e != null && e.remoteStream) {
      if (!e.audioElement) {
        const a = document.createElement("audio");
        a.autoplay = !0, a.muted = !1, a.controls = !1, a.style.display = "none", document.body.appendChild(a), e.audioElement = a;
      }
      if (e.audioElement.srcObject = e.remoteStream, e.audioElement.play().catch(() => {
      }), !this.isSafari) {
        const a = this.getAudioContext();
        if (a) {
          const s = a.createMediaStreamSource(e.remoteStream), i = a.createAnalyser();
          i.fftSize = 256, i.smoothingTimeConstant = 0.8, s.connect(i), e.audioContext = a, e.source = s, e.analyser = i;
        }
      }
    }
  }
  cleanupAudio(t) {
    var a;
    const e = this.media.get(t);
    e && (e.audioElement && (e.audioElement.pause(), e.audioElement.srcObject = null, (a = e.audioElement.parentNode) == null || a.removeChild(e.audioElement), e.audioElement = null), e.source && (e.source.disconnect(), e.source = null), e.audioContext && (e.audioContext.close().catch(() => {
    }), e.audioContext = null), e.analyser = null);
  }
  updateSubscription(t) {
    const e = this.media.get(t), a = this.subscriptionManager.getSubscription(t);
    !(e != null && e.remoteStream) || !a || (a.audio && e.remoteStream.getAudioTracks().length > 0 ? this.setupAudioPlayback(t) : this.cleanupAudio(t), this.updateStreamStatus(t));
  }
  updateStreamStatus(t) {
    var m, c, d, h;
    const e = this.media.get(t), a = this.subscriptionManager.getSubscription(t) || { video: !0, audio: !0 };
    if (!e) return;
    const s = ((m = e.remoteStream) == null ? void 0 : m.getAudioTracks().some((l) => l.readyState === "live")) ?? !1, i = (e == null ? void 0 : e.videoElement) && ((c = e == null ? void 0 : e.videoElement) == null ? void 0 : c.videoWidth) > 0 && ((d = e.videoElement) == null ? void 0 : d.videoHeight) > 0 || (((h = e.remoteStream) == null ? void 0 : h.getVideoTracks().some((l) => l.readyState === "live")) ?? !1), o = {
      hasAudio: a.audio && s,
      hasVideo: a.video && i,
      isActive: !!e.remoteStream && (s || i),
      lastUpdated: Date.now()
    }, u = e.streamStatus, S = u.hasAudio !== o.hasAudio || u.hasVideo !== o.hasVideo || u.isActive !== o.isActive;
    e.streamStatus = o, S && this.callbacks.onStreamStatusChanged && this.callbacks.onStreamStatusChanged(t, o);
  }
  getVolume(t) {
    var e;
    return ((e = this.media.get(t)) == null ? void 0 : e.volume) ?? 0;
  }
  getAnalyser(t) {
    var e;
    return ((e = this.media.get(t)) == null ? void 0 : e.analyser) ?? null;
  }
  cleanup(t) {
    const e = this.media.get(t);
    e && (e.streamStatus.isActive = !1, e.streamStatus.lastUpdated = Date.now(), this.callbacks.onStreamStatusChanged && this.callbacks.onStreamStatusChanged(t, e.streamStatus), e.videoElement = null, this.cleanupAudio(t), e.remoteStream = null, e.volume = 0, this.media.delete(t));
  }
  cleanupAll() {
    this.media.forEach((t, e) => this.cleanup(e));
  }
  setSelfId(t) {
    this.selfId = t;
  }
  getAudioContext() {
    if (this.audioContext && this.audioContext.state !== "closed") return this.audioContext;
    try {
      return this.audioContext = new AudioContext(), this.audioContext.state === "suspended" && this.audioContext.resume().catch(() => {
      }), this.audioContext;
    } catch {
      return null;
    }
  }
}
export {
  v as MediaManager
};
