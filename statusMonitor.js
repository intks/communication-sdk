var A = Object.defineProperty;
var k = (i, e, t) => e in i ? A(i, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : i[e] = t;
var o = (i, e, t) => k(i, typeof e != "symbol" ? e + "" : e, t);
class I {
  constructor(e, t, n) {
    o(this, "callbacks");
    o(this, "mediaManager");
    o(this, "subscriptionManager");
    o(this, "intervalId", null);
    this.callbacks = e, this.mediaManager = t, this.subscriptionManager = n;
  }
  start() {
    this.stop(), this.intervalId = window.setInterval(() => {
      this.mediaManager.media.forEach((e, t) => {
        var d, g, S, f;
        const n = this.subscriptionManager.getSubscription(t) || { video: !0, audio: !0 };
        let h = 0;
        const r = e.analyser;
        if (r) {
          const s = new Uint8Array(r.fftSize);
          r.getByteTimeDomainData(s);
          let p = 0;
          for (let c = 0; c < s.length; c++) {
            const b = (s[c] - 128) / 128;
            p += b * b;
          }
          h = Math.min(1, Math.sqrt(p / s.length) * 2);
        }
        const u = e.volume;
        e.volume = u * 0.6 + h * 0.4, Math.abs(e.volume - u) > 0.02 && this.callbacks.onParticipantVolumeChanged && this.callbacks.onParticipantVolumeChanged(t, e.volume);
        const m = ((d = e.remoteStream) == null ? void 0 : d.getAudioTracks().some((s) => s.readyState === "live")) ?? !1, v = (e == null ? void 0 : e.videoElement) && ((g = e.videoElement) == null ? void 0 : g.videoWidth) > 0 && ((S = e.videoElement) == null ? void 0 : S.videoHeight) > 0 || (((f = e.remoteStream) == null ? void 0 : f.getVideoTracks().some((s) => s.readyState === "live")) ?? !1), a = {
          hasAudio: n.audio && m,
          hasVideo: n.video && v,
          isActive: !!e.remoteStream && (m || v),
          lastUpdated: Date.now()
        }, l = e.streamStatus, M = l.hasAudio !== a.hasAudio || l.hasVideo !== a.hasVideo || l.isActive !== a.isActive;
        e.streamStatus = a, M && this.callbacks.onStreamStatusChanged && this.callbacks.onStreamStatusChanged(t, a);
      });
    }, 500);
  }
  stop() {
    this.intervalId && (clearInterval(this.intervalId), this.intervalId = null);
  }
}
export {
  I as StatusMonitor
};
