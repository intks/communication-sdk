var u = Object.defineProperty;
var n = (e, i, t) => i in e ? u(e, i, { enumerable: !0, configurable: !0, writable: !0, value: t }) : e[i] = t;
var o = (e, i, t) => n(e, typeof i != "symbol" ? i + "" : i, t);
import { SubscribeType as r } from "amazon-ivs-web-broadcast";
class p {
  constructor() {
    o(this, "subscriptions", /* @__PURE__ */ new Map());
  }
  setSubscription(i, t) {
    const s = this.subscriptions.get(i) || { video: !0, audio: !0 };
    this.subscriptions.set(i, {
      video: t.video ?? s.video,
      audio: t.audio ?? s.audio
    });
  }
  getSubscription(i) {
    return this.subscriptions.get(i) || null;
  }
  removeSubscription(i) {
    this.subscriptions.delete(i);
  }
  getSubscribeType(i) {
    const t = this.getSubscription(i.id) || { video: !0, audio: !0 };
    return t.video && t.audio ? r.AUDIO_VIDEO : t.video ? r.AUDIO_VIDEO : t.audio ? r.AUDIO_ONLY : r.NONE;
  }
}
export {
  p as SubscriptionManager
};
