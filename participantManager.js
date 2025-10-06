var s = Object.defineProperty;
var e = (a, i, t) => i in a ? s(a, i, { enumerable: !0, configurable: !0, writable: !0, value: t }) : a[i] = t;
var r = (a, i, t) => e(a, typeof i != "symbol" ? i + "" : i, t);
class p {
  constructor() {
    r(this, "participants", /* @__PURE__ */ new Map());
  }
  add(i) {
    this.participants.set(i.id, i);
  }
  remove(i) {
    this.participants.delete(i);
  }
  getParticipants() {
    return Array.from(this.participants.values()).map((i) => {
      var t;
      return {
        id: i.id,
        userId: i.userId || "",
        role: (t = i.attributes) == null ? void 0 : t.role,
        isPublishing: !!i.isPublishing
      };
    });
  }
  clear() {
    this.participants.clear();
  }
}
export {
  p as ParticipantManager
};
