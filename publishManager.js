var r = Object.defineProperty;
var d = (o, i, a) => i in o ? r(o, i, { enumerable: !0, configurable: !0, writable: !0, value: a }) : o[i] = a;
var e = (o, i, a) => d(o, typeof i != "symbol" ? i + "" : i, a);
import { LocalStageStream as c } from "amazon-ivs-web-broadcast";
import { openVideoInputDevice as h, openAudioInputDevice as n } from "./utils/media.js";
class f {
  constructor(i, a) {
    e(this, "config");
    e(this, "callbacks");
    e(this, "localStreams", []);
    e(this, "localStream", null);
    e(this, "isPublishing", !1);
    e(this, "isLocalAudioEnabled", !0);
    e(this, "defaultVideoResolution", { width: 1280, height: 720 });
    this.config = i, this.callbacks = a;
  }
  async startPublishing() {
    try {
      if (this.localStreams = [], this.config.videoInputDeviceId) {
        const a = (await h(
          this.config.videoInputDeviceId,
          this.defaultVideoResolution.width,
          this.defaultVideoResolution.height
        )).getVideoTracks()[0];
        if (a) {
          const l = this.config.enableInBandMessaging !== !1 ? { inBandMessaging: { enabled: !0 } } : void 0;
          this.localStreams.push(new c(a, l));
        }
      }
      if (this.config.audioInputDeviceId) {
        const a = (await n(this.config.audioInputDeviceId)).getAudioTracks()[0];
        a && (a.enabled = this.isLocalAudioEnabled, this.localStreams.push(new c(a)));
      }
      this.localStreams.length > 0 && (this.localStream = new MediaStream(this.localStreams.map((i) => i.mediaStreamTrack).filter((i) => i)), this.callbacks.onLocalStreamReady && this.callbacks.onLocalStreamReady(this.localStream), this.config.localVideoElement && (this.config.localVideoElement.srcObject = this.localStream, this.config.localVideoElement.muted = !0, this.config.localVideoElement.playsInline = !0, this.config.localVideoElement.play().catch(() => console.warn("Failed to play local video")))), this.isPublishing = !0, this.callbacks.onPublishingStarted && this.callbacks.onPublishingStarted();
    } catch (i) {
      throw console.error("Failed to start publishing:", i), this.callbacks.onError && this.callbacks.onError(i), i;
    }
  }
  stopPublishing() {
    this.localStream && (this.localStream.getTracks().forEach((i) => i.stop()), this.localStream = null), this.localStreams.forEach((i) => {
      var a;
      return (a = i.mediaStreamTrack) == null ? void 0 : a.stop();
    }), this.localStreams = [], this.isPublishing = !1, this.callbacks.onPublishingStopped && this.callbacks.onPublishingStopped();
  }
  toggleVideo() {
    if (!this.localStream) return;
    const i = this.localStream.getVideoTracks()[0];
    i && (i.enabled = !i.enabled, this.callbacks.onVideoToggled && this.callbacks.onVideoToggled(i.enabled));
  }
  toggleAudio() {
    this.setLocalAudioEnabled(!this.isLocalAudioEnabled);
  }
  setLocalAudioEnabled(i) {
    var l;
    this.isLocalAudioEnabled = i;
    const a = (l = this.localStreams.find((s) => {
      var t;
      return ((t = s.mediaStreamTrack) == null ? void 0 : t.kind) === "audio";
    })) == null ? void 0 : l.mediaStreamTrack;
    i && !a && this.config.audioInputDeviceId ? n(this.config.audioInputDeviceId).then((s) => {
      const t = s.getAudioTracks()[0];
      t && (this.localStreams.push(new c(t)), this.localStream ? this.localStream.addTrack(t) : this.localStream = new MediaStream([t]), this.config.localVideoElement && (this.config.localVideoElement.srcObject = this.localStream, this.config.localVideoElement.play().catch(() => {
      })), this.callbacks.onAudioToggled && this.callbacks.onAudioToggled(!0));
    }).catch(() => {
      this.callbacks.onAudioToggled && this.callbacks.onAudioToggled(!1);
    }) : a && (a.enabled = i, this.callbacks.onAudioToggled && this.callbacks.onAudioToggled(i));
  }
  setLocalVideoEnabled(i) {
    if (!this.localStream) return;
    const a = this.localStream.getVideoTracks()[0];
    a && (a.enabled = i, this.callbacks.onVideoToggled && this.callbacks.onVideoToggled(i));
  }
  getStreams() {
    return this.localStreams.filter((i) => {
      const a = i.mediaStreamTrack;
      return a ? a.kind === "audio" ? this.isLocalAudioEnabled && a.enabled : !0 : !1;
    });
  }
  shouldPublish() {
    return this.config.role === "admin" || this.config.role === "user" && this.isPublishing;
  }
}
export {
  f as PublishManager
};
