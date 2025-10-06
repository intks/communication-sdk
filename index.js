var ld = Object.defineProperty;
var dd = (rn, U, z) => U in rn ? ld(rn, U, { enumerable: !0, configurable: !0, writable: !0, value: z }) : rn[U] = z;
var rt = (rn, U, z) => dd(rn, typeof U != "symbol" ? U + "" : U, z);
var aa = /* @__PURE__ */ ((rn) => (rn.MuteAudio = "MUTE_AUDIO", rn.UnmuteAudio = "UNMUTE_AUDIO", rn.MuteVideo = "MUTE_VIDEO", rn.UnmuteVideo = "UNMUTE_VIDEO", rn.StartPublishing = "START_PUBLISHING", rn.StopPublishing = "STOP_PUBLISHING", rn))(aa || {});
class hd {
  constructor(U, z, se, Te) {
    rt(this, "config");
    rt(this, "callbacks");
    rt(this, "publishManager");
    rt(this, "mediaManager");
    rt(this, "selfId", null);
    this.config = U, this.callbacks = z, this.publishManager = se, this.mediaManager = Te;
  }
  checkSelfParticipant(U, z) {
    const se = new Set(
      this.publishManager.getStreams().map((ze) => {
        var k;
        return (k = ze.mediaStreamTrack) == null ? void 0 : k.id;
      }).filter((ze) => ze)
    );
    z.some((ze) => ze.mediaStreamTrack && se.has(ze.mediaStreamTrack.id)) && (this.selfId = U.id, this.mediaManager.setSelfId(U.id));
  }
  handleSeiMessage(U, z) {
    const se = z.payload instanceof ArrayBuffer ? z.payload : z.payload instanceof Uint8Array ? z.payload.buffer.slice(z.payload.byteOffset, z.payload.byteOffset + z.payload.byteLength) : null;
    if (se)
      try {
        const Te = JSON.parse(new TextDecoder().decode(se));
        Te.type && (this.applyCommand(Te), this.callbacks.onCommandReceived && this.callbacks.onCommandReceived(Te, U.id));
      } catch {
        console.warn("Failed to parse SEI message");
      }
  }
  applyCommand(U) {
    const z = U.targetParticipantId, se = this.selfId && z && this.selfId === z;
    switch (U.type) {
      case aa.MuteAudio:
        z && (se ? this.publishManager.setLocalAudioEnabled(!1) : this.mediaManager.updateSubscription(z));
        break;
      case aa.UnmuteAudio:
        z && (se ? this.publishManager.setLocalAudioEnabled(!0) : this.mediaManager.updateSubscription(z));
        break;
      case aa.MuteVideo:
        z && (se ? this.publishManager.setLocalVideoEnabled(!1) : this.mediaManager.updateSubscription(z));
        break;
      case aa.UnmuteVideo:
        z && (se ? this.publishManager.setLocalVideoEnabled(!0) : this.mediaManager.updateSubscription(z));
        break;
      case aa.StopPublishing:
        se && this.publishManager.stopPublishing(), z && this.mediaManager.updateStreamStatus(z);
        break;
      case aa.StartPublishing:
        se && this.publishManager.startPublishing().catch(() => {
        }), z && this.mediaManager.updateStreamStatus(z);
        break;
    }
  }
  async broadcastCommand(U, z = 3) {
    if (this.config.role !== "admin") return !1;
    const se = this.publishManager.getStreams().find((k) => {
      var A;
      return ((A = k.mediaStreamTrack) == null ? void 0 : A.kind) === "video";
    });
    if (!se) return !1;
    const Te = new TextEncoder().encode(JSON.stringify({ ...U, timestamp: Date.now() })), ze = Te.buffer.slice(Te.byteOffset, Te.byteOffset + Te.byteLength);
    try {
      return await se.insertSeiMessage(ze, { repeatCount: z }), !0;
    } catch {
      try {
        return await se.insertSeiMessage(ze), !0;
      } catch {
        return !1;
      }
    }
  }
  muteAudio(U) {
    this.config.role === "admin" && (this.broadcastCommand({ type: aa.MuteAudio, targetParticipantId: U }), this.callbacks.onParticipantMuted && this.callbacks.onParticipantMuted(U, "audio"));
  }
  unmuteAudio(U) {
    this.config.role === "admin" && (this.broadcastCommand({ type: aa.UnmuteAudio, targetParticipantId: U }), this.callbacks.onParticipantUnmuted && this.callbacks.onParticipantUnmuted(U, "audio"));
  }
  muteVideo(U) {
    this.config.role === "admin" && (this.broadcastCommand({ type: aa.MuteVideo, targetParticipantId: U }), this.callbacks.onParticipantMuted && this.callbacks.onParticipantMuted(U, "video"));
  }
  unmuteVideo(U) {
    this.config.role === "admin" && (this.broadcastCommand({ type: aa.UnmuteVideo, targetParticipantId: U }), this.callbacks.onParticipantUnmuted && this.callbacks.onParticipantUnmuted(U, "video"));
  }
}
class fd {
  constructor(U, z) {
    rt(this, "callbacks");
    rt(this, "subscriptionManager");
    rt(this, "audioContext", null);
    rt(this, "selfId", null);
    rt(this, "isSafari", /Safari/i.test(navigator.userAgent) && !/Chrome/i.test(navigator.userAgent));
    rt(this, "media", /* @__PURE__ */ new Map());
    this.callbacks = U, this.subscriptionManager = z;
  }
  initializeParticipant(U) {
    this.media.set(U, {
      remoteStream: null,
      videoElement: null,
      audioElement: null,
      volume: 0,
      streamStatus: { hasAudio: !1, hasVideo: !1, isActive: !1, lastUpdated: Date.now() }
    });
  }
  addStreams(U, z) {
    const se = this.media.get(U), Te = z.map((k) => k.mediaStreamTrack).filter((k) => k);
    let ze;
    return se != null && se.remoteStream ? (ze = se.remoteStream, Te.forEach((k) => {
      ze.getTrackById(k.id) || ze.addTrack(k);
    })) : ze = new MediaStream(Te), se && (se.remoteStream = ze), ze;
  }
  removeStreams(U, z) {
    const se = this.media.get(U);
    return se != null && se.remoteStream ? (z.forEach((Te) => {
      Te.mediaStreamTrack && se.remoteStream.removeTrack(Te.mediaStreamTrack);
    }), se.remoteStream.getAudioTracks().some((Te) => Te.readyState === "live") || this.cleanupAudio(U), this.updateVideoElement(U), se.remoteStream.getTracks().length > 0) : !1;
  }
  attachStreams(U) {
    const z = this.media.get(U);
    z != null && z.remoteStream && (this.updateVideoElement(U), U !== this.selfId && z.remoteStream.getAudioTracks().length > 0 ? this.setupAudioPlayback(U) : U === this.selfId && this.cleanupAudio(U), this.updateStreamStatus(U));
  }
  updateVideoElement(U) {
    const z = this.media.get(U);
    if (z != null && z.remoteStream)
      if (z.videoElement)
        z.videoElement.srcObject = z.remoteStream, z.videoElement.play().catch(() => {
        });
      else {
        const se = document.createElement("video");
        se.autoplay = !0, se.playsInline = !0, se.muted = !0, se.srcObject = z.remoteStream, se.play().catch(() => {
        }), z.videoElement = se;
      }
  }
  setupAudioPlayback(U) {
    const z = this.media.get(U);
    if (z != null && z.remoteStream) {
      if (!z.audioElement) {
        const se = document.createElement("audio");
        se.autoplay = !0, se.muted = !1, se.controls = !1, se.style.display = "none", document.body.appendChild(se), z.audioElement = se;
      }
      if (z.audioElement.srcObject = z.remoteStream, z.audioElement.play().catch(() => {
      }), !this.isSafari) {
        const se = this.getAudioContext();
        if (se) {
          const Te = se.createMediaStreamSource(z.remoteStream), ze = se.createAnalyser();
          ze.fftSize = 256, ze.smoothingTimeConstant = 0.8, Te.connect(ze), z.audioContext = se, z.source = Te, z.analyser = ze;
        }
      }
    }
  }
  cleanupAudio(U) {
    var se;
    const z = this.media.get(U);
    z && (z.audioElement && (z.audioElement.pause(), z.audioElement.srcObject = null, (se = z.audioElement.parentNode) == null || se.removeChild(z.audioElement), z.audioElement = null), z.source && (z.source.disconnect(), z.source = null), z.audioContext && (z.audioContext.close().catch(() => {
    }), z.audioContext = null), z.analyser = null);
  }
  updateSubscription(U) {
    const z = this.media.get(U), se = this.subscriptionManager.getSubscription(U);
    !(z != null && z.remoteStream) || !se || (se.audio && z.remoteStream.getAudioTracks().length > 0 ? this.setupAudioPlayback(U) : this.cleanupAudio(U), this.updateStreamStatus(U));
  }
  updateStreamStatus(U) {
    var v, m, y, E;
    const z = this.media.get(U), se = this.subscriptionManager.getSubscription(U) || { video: !0, audio: !0 };
    if (!z) return;
    const Te = ((v = z.remoteStream) == null ? void 0 : v.getAudioTracks().some((C) => C.readyState === "live")) ?? !1, ze = (z == null ? void 0 : z.videoElement) && ((m = z == null ? void 0 : z.videoElement) == null ? void 0 : m.videoWidth) > 0 && ((y = z.videoElement) == null ? void 0 : y.videoHeight) > 0 || (((E = z.remoteStream) == null ? void 0 : E.getVideoTracks().some((C) => C.readyState === "live")) ?? !1), k = {
      hasAudio: se.audio && Te,
      hasVideo: se.video && ze,
      isActive: !!z.remoteStream && (Te || ze),
      lastUpdated: Date.now()
    }, A = z.streamStatus, p = A.hasAudio !== k.hasAudio || A.hasVideo !== k.hasVideo || A.isActive !== k.isActive;
    z.streamStatus = k, p && this.callbacks.onStreamStatusChanged && this.callbacks.onStreamStatusChanged(U, k);
  }
  getVolume(U) {
    var z;
    return ((z = this.media.get(U)) == null ? void 0 : z.volume) ?? 0;
  }
  getAnalyser(U) {
    var z;
    return ((z = this.media.get(U)) == null ? void 0 : z.analyser) ?? null;
  }
  cleanup(U) {
    const z = this.media.get(U);
    z && (z.streamStatus.isActive = !1, z.streamStatus.lastUpdated = Date.now(), this.callbacks.onStreamStatusChanged && this.callbacks.onStreamStatusChanged(U, z.streamStatus), z.videoElement = null, this.cleanupAudio(U), z.remoteStream = null, z.volume = 0, this.media.delete(U));
  }
  cleanupAll() {
    this.media.forEach((U, z) => this.cleanup(z));
  }
  setSelfId(U) {
    this.selfId = U;
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
class pd {
  constructor() {
    rt(this, "participants", /* @__PURE__ */ new Map());
  }
  add(U) {
    this.participants.set(U.id, U);
  }
  remove(U) {
    this.participants.delete(U);
  }
  getParticipants() {
    return Array.from(this.participants.values()).map((U) => {
      var z;
      return {
        id: U.id,
        userId: U.userId || "",
        role: (z = U.attributes) == null ? void 0 : z.role,
        isPublishing: !!U.isPublishing
      };
    });
  }
  clear() {
    this.participants.clear();
  }
}
var od = { exports: {} };
/*! For license information please see amazon-ivs-web-broadcast.js.LICENSE.txt */
(function(rn, U) {
  (function(z, se) {
    rn.exports = se();
  })(self, () => (() => {
    var z = { 2505: (k, A, p) => {
      k.exports = p(8015);
    }, 5592: (k, A, p) => {
      var v = p(9516), m = p(7522), y = p(3948), E = p(9106), C = p(9615), _ = p(2012), f = p(4202), b = p(4896), L = p(5845), D = p(8563), O = p(5656);
      k.exports = function(N) {
        return new Promise(function(G, $) {
          var q, te = N.data, ae = N.headers, de = N.responseType;
          function Oe() {
            N.cancelToken && N.cancelToken.unsubscribe(q), N.signal && N.signal.removeEventListener("abort", q);
          }
          v.isFormData(te) && v.isStandardBrowserEnv() && delete ae["Content-Type"];
          var W = new XMLHttpRequest();
          if (N.auth) {
            var ge = N.auth.username || "", ke = N.auth.password ? unescape(encodeURIComponent(N.auth.password)) : "";
            ae.Authorization = "Basic " + btoa(ge + ":" + ke);
          }
          var Se = C(N.baseURL, N.url);
          function Z() {
            if (W) {
              var ue = "getAllResponseHeaders" in W ? _(W.getAllResponseHeaders()) : null, pe = { data: de && de !== "text" && de !== "json" ? W.response : W.responseText, status: W.status, statusText: W.statusText, headers: ue, config: N, request: W };
              m(function(De) {
                G(De), Oe();
              }, function(De) {
                $(De), Oe();
              }, pe), W = null;
            }
          }
          if (W.open(N.method.toUpperCase(), E(Se, N.params, N.paramsSerializer), !0), W.timeout = N.timeout, "onloadend" in W ? W.onloadend = Z : W.onreadystatechange = function() {
            W && W.readyState === 4 && (W.status !== 0 || W.responseURL && W.responseURL.indexOf("file:") === 0) && setTimeout(Z);
          }, W.onabort = function() {
            W && ($(new L("Request aborted", L.ECONNABORTED, N, W)), W = null);
          }, W.onerror = function() {
            $(new L("Network Error", L.ERR_NETWORK, N, W, W)), W = null;
          }, W.ontimeout = function() {
            var ue = N.timeout ? "timeout of " + N.timeout + "ms exceeded" : "timeout exceeded", pe = N.transitional || b;
            N.timeoutErrorMessage && (ue = N.timeoutErrorMessage), $(new L(ue, pe.clarifyTimeoutError ? L.ETIMEDOUT : L.ECONNABORTED, N, W)), W = null;
          }, v.isStandardBrowserEnv()) {
            var J = (N.withCredentials || f(Se)) && N.xsrfCookieName ? y.read(N.xsrfCookieName) : void 0;
            J && (ae[N.xsrfHeaderName] = J);
          }
          "setRequestHeader" in W && v.forEach(ae, function(ue, pe) {
            te === void 0 && pe.toLowerCase() === "content-type" ? delete ae[pe] : W.setRequestHeader(pe, ue);
          }), v.isUndefined(N.withCredentials) || (W.withCredentials = !!N.withCredentials), de && de !== "json" && (W.responseType = N.responseType), typeof N.onDownloadProgress == "function" && W.addEventListener("progress", N.onDownloadProgress), typeof N.onUploadProgress == "function" && W.upload && W.upload.addEventListener("progress", N.onUploadProgress), (N.cancelToken || N.signal) && (q = function(ue) {
            W && ($(!ue || ue && ue.type ? new D() : ue), W.abort(), W = null);
          }, N.cancelToken && N.cancelToken.subscribe(q), N.signal && (N.signal.aborted ? q() : N.signal.addEventListener("abort", q))), te || (te = null);
          var X = O(Se);
          X && ["http", "https", "file"].indexOf(X) === -1 ? $(new L("Unsupported protocol " + X + ":", L.ERR_BAD_REQUEST, N)) : W.send(te);
        });
      };
    }, 8015: (k, A, p) => {
      var v = p(9516), m = p(9012), y = p(5155), E = p(5343), C = function _(f) {
        var b = new y(f), L = m(y.prototype.request, b);
        return v.extend(L, y.prototype, b), v.extend(L, b), L.create = function(D) {
          return _(E(f, D));
        }, L;
      }(p(7412));
      C.Axios = y, C.CanceledError = p(8563), C.CancelToken = p(3191), C.isCancel = p(3864), C.VERSION = p(9641).version, C.toFormData = p(6440), C.AxiosError = p(5845), C.Cancel = C.CanceledError, C.all = function(_) {
        return Promise.all(_);
      }, C.spread = p(7980), C.isAxiosError = p(5019), k.exports = C, k.exports.default = C;
    }, 3191: (k, A, p) => {
      var v = p(8563);
      function m(y) {
        if (typeof y != "function") throw new TypeError("executor must be a function.");
        var E;
        this.promise = new Promise(function(_) {
          E = _;
        });
        var C = this;
        this.promise.then(function(_) {
          if (C._listeners) {
            var f, b = C._listeners.length;
            for (f = 0; f < b; f++) C._listeners[f](_);
            C._listeners = null;
          }
        }), this.promise.then = function(_) {
          var f, b = new Promise(function(L) {
            C.subscribe(L), f = L;
          }).then(_);
          return b.cancel = function() {
            C.unsubscribe(f);
          }, b;
        }, y(function(_) {
          C.reason || (C.reason = new v(_), E(C.reason));
        });
      }
      m.prototype.throwIfRequested = function() {
        if (this.reason) throw this.reason;
      }, m.prototype.subscribe = function(y) {
        this.reason ? y(this.reason) : this._listeners ? this._listeners.push(y) : this._listeners = [y];
      }, m.prototype.unsubscribe = function(y) {
        if (this._listeners) {
          var E = this._listeners.indexOf(y);
          E !== -1 && this._listeners.splice(E, 1);
        }
      }, m.source = function() {
        var y;
        return { token: new m(function(E) {
          y = E;
        }), cancel: y };
      }, k.exports = m;
    }, 8563: (k, A, p) => {
      var v = p(5845);
      function m(y) {
        v.call(this, y ?? "canceled", v.ERR_CANCELED), this.name = "CanceledError";
      }
      p(9516).inherits(m, v, { __CANCEL__: !0 }), k.exports = m;
    }, 3864: (k) => {
      k.exports = function(A) {
        return !(!A || !A.__CANCEL__);
      };
    }, 5155: (k, A, p) => {
      var v = p(9516), m = p(9106), y = p(3471), E = p(4490), C = p(5343), _ = p(9615), f = p(4841), b = f.validators;
      function L(D) {
        this.defaults = D, this.interceptors = { request: new y(), response: new y() };
      }
      L.prototype.request = function(D, O) {
        typeof D == "string" ? (O = O || {}).url = D : O = D || {}, (O = C(this.defaults, O)).method ? O.method = O.method.toLowerCase() : this.defaults.method ? O.method = this.defaults.method.toLowerCase() : O.method = "get";
        var N = O.transitional;
        N !== void 0 && f.assertOptions(N, { silentJSONParsing: b.transitional(b.boolean), forcedJSONParsing: b.transitional(b.boolean), clarifyTimeoutError: b.transitional(b.boolean) }, !1);
        var G = [], $ = !0;
        this.interceptors.request.forEach(function(ge) {
          typeof ge.runWhen == "function" && ge.runWhen(O) === !1 || ($ = $ && ge.synchronous, G.unshift(ge.fulfilled, ge.rejected));
        });
        var q, te = [];
        if (this.interceptors.response.forEach(function(ge) {
          te.push(ge.fulfilled, ge.rejected);
        }), !$) {
          var ae = [E, void 0];
          for (Array.prototype.unshift.apply(ae, G), ae = ae.concat(te), q = Promise.resolve(O); ae.length; ) q = q.then(ae.shift(), ae.shift());
          return q;
        }
        for (var de = O; G.length; ) {
          var Oe = G.shift(), W = G.shift();
          try {
            de = Oe(de);
          } catch (ge) {
            W(ge);
            break;
          }
        }
        try {
          q = E(de);
        } catch (ge) {
          return Promise.reject(ge);
        }
        for (; te.length; ) q = q.then(te.shift(), te.shift());
        return q;
      }, L.prototype.getUri = function(D) {
        D = C(this.defaults, D);
        var O = _(D.baseURL, D.url);
        return m(O, D.params, D.paramsSerializer);
      }, v.forEach(["delete", "get", "head", "options"], function(D) {
        L.prototype[D] = function(O, N) {
          return this.request(C(N || {}, { method: D, url: O, data: (N || {}).data }));
        };
      }), v.forEach(["post", "put", "patch"], function(D) {
        function O(N) {
          return function(G, $, q) {
            return this.request(C(q || {}, { method: D, headers: N ? { "Content-Type": "multipart/form-data" } : {}, url: G, data: $ }));
          };
        }
        L.prototype[D] = O(), L.prototype[D + "Form"] = O(!0);
      }), k.exports = L;
    }, 5845: (k, A, p) => {
      var v = p(9516);
      function m(C, _, f, b, L) {
        Error.call(this), this.message = C, this.name = "AxiosError", _ && (this.code = _), f && (this.config = f), b && (this.request = b), L && (this.response = L);
      }
      v.inherits(m, Error, { toJSON: function() {
        return { message: this.message, name: this.name, description: this.description, number: this.number, fileName: this.fileName, lineNumber: this.lineNumber, columnNumber: this.columnNumber, stack: this.stack, config: this.config, code: this.code, status: this.response && this.response.status ? this.response.status : null };
      } });
      var y = m.prototype, E = {};
      ["ERR_BAD_OPTION_VALUE", "ERR_BAD_OPTION", "ECONNABORTED", "ETIMEDOUT", "ERR_NETWORK", "ERR_FR_TOO_MANY_REDIRECTS", "ERR_DEPRECATED", "ERR_BAD_RESPONSE", "ERR_BAD_REQUEST", "ERR_CANCELED"].forEach(function(C) {
        E[C] = { value: C };
      }), Object.defineProperties(m, E), Object.defineProperty(y, "isAxiosError", { value: !0 }), m.from = function(C, _, f, b, L, D) {
        var O = Object.create(y);
        return v.toFlatObject(C, O, function(N) {
          return N !== Error.prototype;
        }), m.call(O, C.message, _, f, b, L), O.name = C.name, D && Object.assign(O, D), O;
      }, k.exports = m;
    }, 3471: (k, A, p) => {
      var v = p(9516);
      function m() {
        this.handlers = [];
      }
      m.prototype.use = function(y, E, C) {
        return this.handlers.push({ fulfilled: y, rejected: E, synchronous: !!C && C.synchronous, runWhen: C ? C.runWhen : null }), this.handlers.length - 1;
      }, m.prototype.eject = function(y) {
        this.handlers[y] && (this.handlers[y] = null);
      }, m.prototype.forEach = function(y) {
        v.forEach(this.handlers, function(E) {
          E !== null && y(E);
        });
      }, k.exports = m;
    }, 9615: (k, A, p) => {
      var v = p(9137), m = p(4680);
      k.exports = function(y, E) {
        return y && !v(E) ? m(y, E) : E;
      };
    }, 4490: (k, A, p) => {
      var v = p(9516), m = p(2881), y = p(3864), E = p(7412), C = p(8563);
      function _(f) {
        if (f.cancelToken && f.cancelToken.throwIfRequested(), f.signal && f.signal.aborted) throw new C();
      }
      k.exports = function(f) {
        return _(f), f.headers = f.headers || {}, f.data = m.call(f, f.data, f.headers, f.transformRequest), f.headers = v.merge(f.headers.common || {}, f.headers[f.method] || {}, f.headers), v.forEach(["delete", "get", "head", "post", "put", "patch", "common"], function(b) {
          delete f.headers[b];
        }), (f.adapter || E.adapter)(f).then(function(b) {
          return _(f), b.data = m.call(f, b.data, b.headers, f.transformResponse), b;
        }, function(b) {
          return y(b) || (_(f), b && b.response && (b.response.data = m.call(f, b.response.data, b.response.headers, f.transformResponse))), Promise.reject(b);
        });
      };
    }, 5343: (k, A, p) => {
      var v = p(9516);
      k.exports = function(m, y) {
        y = y || {};
        var E = {};
        function C(O, N) {
          return v.isPlainObject(O) && v.isPlainObject(N) ? v.merge(O, N) : v.isPlainObject(N) ? v.merge({}, N) : v.isArray(N) ? N.slice() : N;
        }
        function _(O) {
          return v.isUndefined(y[O]) ? v.isUndefined(m[O]) ? void 0 : C(void 0, m[O]) : C(m[O], y[O]);
        }
        function f(O) {
          if (!v.isUndefined(y[O])) return C(void 0, y[O]);
        }
        function b(O) {
          return v.isUndefined(y[O]) ? v.isUndefined(m[O]) ? void 0 : C(void 0, m[O]) : C(void 0, y[O]);
        }
        function L(O) {
          return O in y ? C(m[O], y[O]) : O in m ? C(void 0, m[O]) : void 0;
        }
        var D = { url: f, method: f, data: f, baseURL: b, transformRequest: b, transformResponse: b, paramsSerializer: b, timeout: b, timeoutMessage: b, withCredentials: b, adapter: b, responseType: b, xsrfCookieName: b, xsrfHeaderName: b, onUploadProgress: b, onDownloadProgress: b, decompress: b, maxContentLength: b, maxBodyLength: b, beforeRedirect: b, transport: b, httpAgent: b, httpsAgent: b, cancelToken: b, socketPath: b, responseEncoding: b, validateStatus: L };
        return v.forEach(Object.keys(m).concat(Object.keys(y)), function(O) {
          var N = D[O] || _, G = N(O);
          v.isUndefined(G) && N !== L || (E[O] = G);
        }), E;
      };
    }, 7522: (k, A, p) => {
      var v = p(5845);
      k.exports = function(m, y, E) {
        var C = E.config.validateStatus;
        E.status && C && !C(E.status) ? y(new v("Request failed with status code " + E.status, [v.ERR_BAD_REQUEST, v.ERR_BAD_RESPONSE][Math.floor(E.status / 100) - 4], E.config, E.request, E)) : m(E);
      };
    }, 2881: (k, A, p) => {
      var v = p(9516), m = p(7412);
      k.exports = function(y, E, C) {
        var _ = this || m;
        return v.forEach(C, function(f) {
          y = f.call(_, y, E);
        }), y;
      };
    }, 7412: (k, A, p) => {
      var v = p(9516), m = p(7018), y = p(5845), E = p(4896), C = p(6440), _ = { "Content-Type": "application/x-www-form-urlencoded" };
      function f(D, O) {
        !v.isUndefined(D) && v.isUndefined(D["Content-Type"]) && (D["Content-Type"] = O);
      }
      var b, L = { transitional: E, adapter: ((typeof XMLHttpRequest < "u" || typeof process < "u" && Object.prototype.toString.call(process) === "[object process]") && (b = p(5592)), b), transformRequest: [function(D, O) {
        if (m(O, "Accept"), m(O, "Content-Type"), v.isFormData(D) || v.isArrayBuffer(D) || v.isBuffer(D) || v.isStream(D) || v.isFile(D) || v.isBlob(D)) return D;
        if (v.isArrayBufferView(D)) return D.buffer;
        if (v.isURLSearchParams(D)) return f(O, "application/x-www-form-urlencoded;charset=utf-8"), D.toString();
        var N, G = v.isObject(D), $ = O && O["Content-Type"];
        if ((N = v.isFileList(D)) || G && $ === "multipart/form-data") {
          var q = this.env && this.env.FormData;
          return C(N ? { "files[]": D } : D, q && new q());
        }
        return G || $ === "application/json" ? (f(O, "application/json"), function(te, ae, de) {
          if (v.isString(te)) try {
            return (ae || JSON.parse)(te), v.trim(te);
          } catch (Oe) {
            if (Oe.name !== "SyntaxError") throw Oe;
          }
          return (0, JSON.stringify)(te);
        }(D)) : D;
      }], transformResponse: [function(D) {
        var O = this.transitional || L.transitional, N = O && O.silentJSONParsing, G = O && O.forcedJSONParsing, $ = !N && this.responseType === "json";
        if ($ || G && v.isString(D) && D.length) try {
          return JSON.parse(D);
        } catch (q) {
          if ($)
            throw q.name === "SyntaxError" ? y.from(q, y.ERR_BAD_RESPONSE, this, null, this.response) : q;
        }
        return D;
      }], timeout: 0, xsrfCookieName: "XSRF-TOKEN", xsrfHeaderName: "X-XSRF-TOKEN", maxContentLength: -1, maxBodyLength: -1, env: { FormData: p(1534) }, validateStatus: function(D) {
        return D >= 200 && D < 300;
      }, headers: { common: { Accept: "application/json, text/plain, */*" } } };
      v.forEach(["delete", "get", "head"], function(D) {
        L.headers[D] = {};
      }), v.forEach(["post", "put", "patch"], function(D) {
        L.headers[D] = v.merge(_);
      }), k.exports = L;
    }, 4896: (k) => {
      k.exports = { silentJSONParsing: !0, forcedJSONParsing: !0, clarifyTimeoutError: !1 };
    }, 9641: (k) => {
      k.exports = { version: "0.27.2" };
    }, 9012: (k) => {
      k.exports = function(A, p) {
        return function() {
          for (var v = new Array(arguments.length), m = 0; m < v.length; m++) v[m] = arguments[m];
          return A.apply(p, v);
        };
      };
    }, 9106: (k, A, p) => {
      var v = p(9516);
      function m(y) {
        return encodeURIComponent(y).replace(/%3A/gi, ":").replace(/%24/g, "$").replace(/%2C/gi, ",").replace(/%20/g, "+").replace(/%5B/gi, "[").replace(/%5D/gi, "]");
      }
      k.exports = function(y, E, C) {
        if (!E) return y;
        var _;
        if (C) _ = C(E);
        else if (v.isURLSearchParams(E)) _ = E.toString();
        else {
          var f = [];
          v.forEach(E, function(L, D) {
            L != null && (v.isArray(L) ? D += "[]" : L = [L], v.forEach(L, function(O) {
              v.isDate(O) ? O = O.toISOString() : v.isObject(O) && (O = JSON.stringify(O)), f.push(m(D) + "=" + m(O));
            }));
          }), _ = f.join("&");
        }
        if (_) {
          var b = y.indexOf("#");
          b !== -1 && (y = y.slice(0, b)), y += (y.indexOf("?") === -1 ? "?" : "&") + _;
        }
        return y;
      };
    }, 4680: (k) => {
      k.exports = function(A, p) {
        return p ? A.replace(/\/+$/, "") + "/" + p.replace(/^\/+/, "") : A;
      };
    }, 3948: (k, A, p) => {
      var v = p(9516);
      k.exports = v.isStandardBrowserEnv() ? { write: function(m, y, E, C, _, f) {
        var b = [];
        b.push(m + "=" + encodeURIComponent(y)), v.isNumber(E) && b.push("expires=" + new Date(E).toGMTString()), v.isString(C) && b.push("path=" + C), v.isString(_) && b.push("domain=" + _), f === !0 && b.push("secure"), document.cookie = b.join("; ");
      }, read: function(m) {
        var y = document.cookie.match(new RegExp("(^|;\\s*)(" + m + ")=([^;]*)"));
        return y ? decodeURIComponent(y[3]) : null;
      }, remove: function(m) {
        this.write(m, "", Date.now() - 864e5);
      } } : { write: function() {
      }, read: function() {
        return null;
      }, remove: function() {
      } };
    }, 9137: (k) => {
      k.exports = function(A) {
        return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(A);
      };
    }, 5019: (k, A, p) => {
      var v = p(9516);
      k.exports = function(m) {
        return v.isObject(m) && m.isAxiosError === !0;
      };
    }, 4202: (k, A, p) => {
      var v = p(9516);
      k.exports = v.isStandardBrowserEnv() ? function() {
        var m, y = /(msie|trident)/i.test(navigator.userAgent), E = document.createElement("a");
        function C(_) {
          var f = _;
          return y && (E.setAttribute("href", f), f = E.href), E.setAttribute("href", f), { href: E.href, protocol: E.protocol ? E.protocol.replace(/:$/, "") : "", host: E.host, search: E.search ? E.search.replace(/^\?/, "") : "", hash: E.hash ? E.hash.replace(/^#/, "") : "", hostname: E.hostname, port: E.port, pathname: E.pathname.charAt(0) === "/" ? E.pathname : "/" + E.pathname };
        }
        return m = C(window.location.href), function(_) {
          var f = v.isString(_) ? C(_) : _;
          return f.protocol === m.protocol && f.host === m.host;
        };
      }() : function() {
        return !0;
      };
    }, 7018: (k, A, p) => {
      var v = p(9516);
      k.exports = function(m, y) {
        v.forEach(m, function(E, C) {
          C !== y && C.toUpperCase() === y.toUpperCase() && (m[y] = E, delete m[C]);
        });
      };
    }, 1534: (k) => {
      k.exports = null;
    }, 2012: (k, A, p) => {
      var v = p(9516), m = ["age", "authorization", "content-length", "content-type", "etag", "expires", "from", "host", "if-modified-since", "if-unmodified-since", "last-modified", "location", "max-forwards", "proxy-authorization", "referer", "retry-after", "user-agent"];
      k.exports = function(y) {
        var E, C, _, f = {};
        return y && v.forEach(y.split(`
`), function(b) {
          if (_ = b.indexOf(":"), E = v.trim(b.substr(0, _)).toLowerCase(), C = v.trim(b.substr(_ + 1)), E) {
            if (f[E] && m.indexOf(E) >= 0) return;
            f[E] = E === "set-cookie" ? (f[E] ? f[E] : []).concat([C]) : f[E] ? f[E] + ", " + C : C;
          }
        }), f;
      };
    }, 5656: (k) => {
      k.exports = function(A) {
        var p = /^([-+\w]{1,25})(:?\/\/|:)/.exec(A);
        return p && p[1] || "";
      };
    }, 7980: (k) => {
      k.exports = function(A) {
        return function(p) {
          return A.apply(null, p);
        };
      };
    }, 6440: (k, A, p) => {
      var v = p(9516);
      k.exports = function(m, y) {
        y = y || new FormData();
        var E = [];
        function C(_) {
          return _ === null ? "" : v.isDate(_) ? _.toISOString() : v.isArrayBuffer(_) || v.isTypedArray(_) ? typeof Blob == "function" ? new Blob([_]) : Buffer.from(_) : _;
        }
        return function _(f, b) {
          if (v.isPlainObject(f) || v.isArray(f)) {
            if (E.indexOf(f) !== -1) throw Error("Circular reference detected in " + b);
            E.push(f), v.forEach(f, function(L, D) {
              if (!v.isUndefined(L)) {
                var O, N = b ? b + "." + D : D;
                if (L && !b && typeof L == "object") {
                  if (v.endsWith(D, "{}")) L = JSON.stringify(L);
                  else if (v.endsWith(D, "[]") && (O = v.toArray(L))) return void O.forEach(function(G) {
                    !v.isUndefined(G) && y.append(N, C(G));
                  });
                }
                _(L, N);
              }
            }), E.pop();
          } else y.append(b, C(f));
        }(m), y;
      };
    }, 4841: (k, A, p) => {
      var v = p(9641).version, m = p(5845), y = {};
      ["object", "boolean", "number", "function", "string", "symbol"].forEach(function(C, _) {
        y[C] = function(f) {
          return typeof f === C || "a" + (_ < 1 ? "n " : " ") + C;
        };
      });
      var E = {};
      y.transitional = function(C, _, f) {
        function b(L, D) {
          return "[Axios v" + v + "] Transitional option '" + L + "'" + D + (f ? ". " + f : "");
        }
        return function(L, D, O) {
          if (C === !1) throw new m(b(D, " has been removed" + (_ ? " in " + _ : "")), m.ERR_DEPRECATED);
          return _ && !E[D] && (E[D] = !0, console.warn(b(D, " has been deprecated since v" + _ + " and will be removed in the near future"))), !C || C(L, D, O);
        };
      }, k.exports = { assertOptions: function(C, _, f) {
        if (typeof C != "object") throw new m("options must be an object", m.ERR_BAD_OPTION_VALUE);
        for (var b = Object.keys(C), L = b.length; L-- > 0; ) {
          var D = b[L], O = _[D];
          if (O) {
            var N = C[D], G = N === void 0 || O(N, D, C);
            if (G !== !0) throw new m("option " + D + " must be " + G, m.ERR_BAD_OPTION_VALUE);
          } else if (f !== !0) throw new m("Unknown option " + D, m.ERR_BAD_OPTION);
        }
      }, validators: y };
    }, 9516: (k, A, p) => {
      var v, m = p(9012), y = Object.prototype.toString, E = (v = /* @__PURE__ */ Object.create(null), function(W) {
        var ge = y.call(W);
        return v[ge] || (v[ge] = ge.slice(8, -1).toLowerCase());
      });
      function C(W) {
        return W = W.toLowerCase(), function(ge) {
          return E(ge) === W;
        };
      }
      function _(W) {
        return Array.isArray(W);
      }
      function f(W) {
        return W === void 0;
      }
      var b = C("ArrayBuffer");
      function L(W) {
        return W !== null && typeof W == "object";
      }
      function D(W) {
        if (E(W) !== "object") return !1;
        var ge = Object.getPrototypeOf(W);
        return ge === null || ge === Object.prototype;
      }
      var O = C("Date"), N = C("File"), G = C("Blob"), $ = C("FileList");
      function q(W) {
        return y.call(W) === "[object Function]";
      }
      var te = C("URLSearchParams");
      function ae(W, ge) {
        if (W != null) if (typeof W != "object" && (W = [W]), _(W)) for (var ke = 0, Se = W.length; ke < Se; ke++) ge.call(null, W[ke], ke, W);
        else for (var Z in W) Object.prototype.hasOwnProperty.call(W, Z) && ge.call(null, W[Z], Z, W);
      }
      var de, Oe = (de = typeof Uint8Array < "u" && Object.getPrototypeOf(Uint8Array), function(W) {
        return de && W instanceof de;
      });
      k.exports = { isArray: _, isArrayBuffer: b, isBuffer: function(W) {
        return W !== null && !f(W) && W.constructor !== null && !f(W.constructor) && typeof W.constructor.isBuffer == "function" && W.constructor.isBuffer(W);
      }, isFormData: function(W) {
        var ge = "[object FormData]";
        return W && (typeof FormData == "function" && W instanceof FormData || y.call(W) === ge || q(W.toString) && W.toString() === ge);
      }, isArrayBufferView: function(W) {
        return typeof ArrayBuffer < "u" && ArrayBuffer.isView ? ArrayBuffer.isView(W) : W && W.buffer && b(W.buffer);
      }, isString: function(W) {
        return typeof W == "string";
      }, isNumber: function(W) {
        return typeof W == "number";
      }, isObject: L, isPlainObject: D, isUndefined: f, isDate: O, isFile: N, isBlob: G, isFunction: q, isStream: function(W) {
        return L(W) && q(W.pipe);
      }, isURLSearchParams: te, isStandardBrowserEnv: function() {
        return (typeof navigator > "u" || navigator.product !== "ReactNative" && navigator.product !== "NativeScript" && navigator.product !== "NS") && typeof window < "u" && typeof document < "u";
      }, forEach: ae, merge: function W() {
        var ge = {};
        function ke(J, X) {
          D(ge[X]) && D(J) ? ge[X] = W(ge[X], J) : D(J) ? ge[X] = W({}, J) : _(J) ? ge[X] = J.slice() : ge[X] = J;
        }
        for (var Se = 0, Z = arguments.length; Se < Z; Se++) ae(arguments[Se], ke);
        return ge;
      }, extend: function(W, ge, ke) {
        return ae(ge, function(Se, Z) {
          W[Z] = ke && typeof Se == "function" ? m(Se, ke) : Se;
        }), W;
      }, trim: function(W) {
        return W.trim ? W.trim() : W.replace(/^\s+|\s+$/g, "");
      }, stripBOM: function(W) {
        return W.charCodeAt(0) === 65279 && (W = W.slice(1)), W;
      }, inherits: function(W, ge, ke, Se) {
        W.prototype = Object.create(ge.prototype, Se), W.prototype.constructor = W, ke && Object.assign(W.prototype, ke);
      }, toFlatObject: function(W, ge, ke) {
        var Se, Z, J, X = {};
        ge = ge || {};
        do {
          for (Z = (Se = Object.getOwnPropertyNames(W)).length; Z-- > 0; ) X[J = Se[Z]] || (ge[J] = W[J], X[J] = !0);
          W = Object.getPrototypeOf(W);
        } while (W && (!ke || ke(W, ge)) && W !== Object.prototype);
        return ge;
      }, kindOf: E, kindOfTest: C, endsWith: function(W, ge, ke) {
        W = String(W), (ke === void 0 || ke > W.length) && (ke = W.length), ke -= ge.length;
        var Se = W.indexOf(ge, ke);
        return Se !== -1 && Se === ke;
      }, toArray: function(W) {
        if (!W) return null;
        var ge = W.length;
        if (f(ge)) return null;
        for (var ke = new Array(ge); ge-- > 0; ) ke[ge] = W[ge];
        return ke;
      }, isTypedArray: Oe, isFileList: $ };
    }, 6880: function(k) {
      k.exports = function(A) {
        var p = {};
        function v(m) {
          if (p[m]) return p[m].exports;
          var y = p[m] = { i: m, l: !1, exports: {} };
          return A[m].call(y.exports, y, y.exports, v), y.l = !0, y.exports;
        }
        return v.m = A, v.c = p, v.d = function(m, y, E) {
          v.o(m, y) || Object.defineProperty(m, y, { enumerable: !0, get: E });
        }, v.r = function(m) {
          typeof Symbol < "u" && Symbol.toStringTag && Object.defineProperty(m, Symbol.toStringTag, { value: "Module" }), Object.defineProperty(m, "__esModule", { value: !0 });
        }, v.t = function(m, y) {
          if (1 & y && (m = v(m)), 8 & y || 4 & y && typeof m == "object" && m && m.__esModule) return m;
          var E = /* @__PURE__ */ Object.create(null);
          if (v.r(E), Object.defineProperty(E, "default", { enumerable: !0, value: m }), 2 & y && typeof m != "string") for (var C in m) v.d(E, C, (function(_) {
            return m[_];
          }).bind(null, C));
          return E;
        }, v.n = function(m) {
          var y = m && m.__esModule ? function() {
            return m.default;
          } : function() {
            return m;
          };
          return v.d(y, "a", y), y;
        }, v.o = function(m, y) {
          return Object.prototype.hasOwnProperty.call(m, y);
        }, v.p = "", v(v.s = 90);
      }({ 17: function(A, p, v) {
        p.__esModule = !0, p.default = void 0;
        var m = v(18), y = function() {
          function E() {
          }
          return E.getFirstMatch = function(C, _) {
            var f = _.match(C);
            return f && f.length > 0 && f[1] || "";
          }, E.getSecondMatch = function(C, _) {
            var f = _.match(C);
            return f && f.length > 1 && f[2] || "";
          }, E.matchAndReturnConst = function(C, _, f) {
            if (C.test(_)) return f;
          }, E.getWindowsVersionName = function(C) {
            switch (C) {
              case "NT":
                return "NT";
              case "XP":
              case "NT 5.1":
                return "XP";
              case "NT 5.0":
                return "2000";
              case "NT 5.2":
                return "2003";
              case "NT 6.0":
                return "Vista";
              case "NT 6.1":
                return "7";
              case "NT 6.2":
                return "8";
              case "NT 6.3":
                return "8.1";
              case "NT 10.0":
                return "10";
              default:
                return;
            }
          }, E.getMacOSVersionName = function(C) {
            var _ = C.split(".").splice(0, 2).map(function(f) {
              return parseInt(f, 10) || 0;
            });
            if (_.push(0), _[0] === 10) switch (_[1]) {
              case 5:
                return "Leopard";
              case 6:
                return "Snow Leopard";
              case 7:
                return "Lion";
              case 8:
                return "Mountain Lion";
              case 9:
                return "Mavericks";
              case 10:
                return "Yosemite";
              case 11:
                return "El Capitan";
              case 12:
                return "Sierra";
              case 13:
                return "High Sierra";
              case 14:
                return "Mojave";
              case 15:
                return "Catalina";
              default:
                return;
            }
          }, E.getAndroidVersionName = function(C) {
            var _ = C.split(".").splice(0, 2).map(function(f) {
              return parseInt(f, 10) || 0;
            });
            if (_.push(0), !(_[0] === 1 && _[1] < 5)) return _[0] === 1 && _[1] < 6 ? "Cupcake" : _[0] === 1 && _[1] >= 6 ? "Donut" : _[0] === 2 && _[1] < 2 ? "Eclair" : _[0] === 2 && _[1] === 2 ? "Froyo" : _[0] === 2 && _[1] > 2 ? "Gingerbread" : _[0] === 3 ? "Honeycomb" : _[0] === 4 && _[1] < 1 ? "Ice Cream Sandwich" : _[0] === 4 && _[1] < 4 ? "Jelly Bean" : _[0] === 4 && _[1] >= 4 ? "KitKat" : _[0] === 5 ? "Lollipop" : _[0] === 6 ? "Marshmallow" : _[0] === 7 ? "Nougat" : _[0] === 8 ? "Oreo" : _[0] === 9 ? "Pie" : void 0;
          }, E.getVersionPrecision = function(C) {
            return C.split(".").length;
          }, E.compareVersions = function(C, _, f) {
            f === void 0 && (f = !1);
            var b = E.getVersionPrecision(C), L = E.getVersionPrecision(_), D = Math.max(b, L), O = 0, N = E.map([C, _], function(G) {
              var $ = D - E.getVersionPrecision(G), q = G + new Array($ + 1).join(".0");
              return E.map(q.split("."), function(te) {
                return new Array(20 - te.length).join("0") + te;
              }).reverse();
            });
            for (f && (O = D - Math.min(b, L)), D -= 1; D >= O; ) {
              if (N[0][D] > N[1][D]) return 1;
              if (N[0][D] === N[1][D]) {
                if (D === O) return 0;
                D -= 1;
              } else if (N[0][D] < N[1][D]) return -1;
            }
          }, E.map = function(C, _) {
            var f, b = [];
            if (Array.prototype.map) return Array.prototype.map.call(C, _);
            for (f = 0; f < C.length; f += 1) b.push(_(C[f]));
            return b;
          }, E.find = function(C, _) {
            var f, b;
            if (Array.prototype.find) return Array.prototype.find.call(C, _);
            for (f = 0, b = C.length; f < b; f += 1) {
              var L = C[f];
              if (_(L, f)) return L;
            }
          }, E.assign = function(C) {
            for (var _, f, b = C, L = arguments.length, D = new Array(L > 1 ? L - 1 : 0), O = 1; O < L; O++) D[O - 1] = arguments[O];
            if (Object.assign) return Object.assign.apply(Object, [C].concat(D));
            var N = function() {
              var G = D[_];
              typeof G == "object" && G !== null && Object.keys(G).forEach(function($) {
                b[$] = G[$];
              });
            };
            for (_ = 0, f = D.length; _ < f; _ += 1) N();
            return C;
          }, E.getBrowserAlias = function(C) {
            return m.BROWSER_ALIASES_MAP[C];
          }, E.getBrowserTypeByAlias = function(C) {
            return m.BROWSER_MAP[C] || "";
          }, E;
        }();
        p.default = y, A.exports = p.default;
      }, 18: function(A, p, v) {
        p.__esModule = !0, p.ENGINE_MAP = p.OS_MAP = p.PLATFORMS_MAP = p.BROWSER_MAP = p.BROWSER_ALIASES_MAP = void 0, p.BROWSER_ALIASES_MAP = { "Amazon Silk": "amazon_silk", "Android Browser": "android", Bada: "bada", BlackBerry: "blackberry", Chrome: "chrome", Chromium: "chromium", Electron: "electron", Epiphany: "epiphany", Firefox: "firefox", Focus: "focus", Generic: "generic", "Google Search": "google_search", Googlebot: "googlebot", "Internet Explorer": "ie", "K-Meleon": "k_meleon", Maxthon: "maxthon", "Microsoft Edge": "edge", "MZ Browser": "mz", "NAVER Whale Browser": "naver", Opera: "opera", "Opera Coast": "opera_coast", PhantomJS: "phantomjs", Puffin: "puffin", QupZilla: "qupzilla", QQ: "qq", QQLite: "qqlite", Safari: "safari", Sailfish: "sailfish", "Samsung Internet for Android": "samsung_internet", SeaMonkey: "seamonkey", Sleipnir: "sleipnir", Swing: "swing", Tizen: "tizen", "UC Browser": "uc", Vivaldi: "vivaldi", "WebOS Browser": "webos", WeChat: "wechat", "Yandex Browser": "yandex", Roku: "roku" }, p.BROWSER_MAP = { amazon_silk: "Amazon Silk", android: "Android Browser", bada: "Bada", blackberry: "BlackBerry", chrome: "Chrome", chromium: "Chromium", electron: "Electron", epiphany: "Epiphany", firefox: "Firefox", focus: "Focus", generic: "Generic", googlebot: "Googlebot", google_search: "Google Search", ie: "Internet Explorer", k_meleon: "K-Meleon", maxthon: "Maxthon", edge: "Microsoft Edge", mz: "MZ Browser", naver: "NAVER Whale Browser", opera: "Opera", opera_coast: "Opera Coast", phantomjs: "PhantomJS", puffin: "Puffin", qupzilla: "QupZilla", qq: "QQ Browser", qqlite: "QQ Browser Lite", safari: "Safari", sailfish: "Sailfish", samsung_internet: "Samsung Internet for Android", seamonkey: "SeaMonkey", sleipnir: "Sleipnir", swing: "Swing", tizen: "Tizen", uc: "UC Browser", vivaldi: "Vivaldi", webos: "WebOS Browser", wechat: "WeChat", yandex: "Yandex Browser" }, p.PLATFORMS_MAP = { tablet: "tablet", mobile: "mobile", desktop: "desktop", tv: "tv" }, p.OS_MAP = { WindowsPhone: "Windows Phone", Windows: "Windows", MacOS: "macOS", iOS: "iOS", Android: "Android", WebOS: "WebOS", BlackBerry: "BlackBerry", Bada: "Bada", Tizen: "Tizen", Linux: "Linux", ChromeOS: "Chrome OS", PlayStation4: "PlayStation 4", Roku: "Roku" }, p.ENGINE_MAP = { EdgeHTML: "EdgeHTML", Blink: "Blink", Trident: "Trident", Presto: "Presto", Gecko: "Gecko", WebKit: "WebKit" };
      }, 90: function(A, p, v) {
        p.__esModule = !0, p.default = void 0;
        var m, y = (m = v(91)) && m.__esModule ? m : { default: m }, E = v(18);
        function C(f, b) {
          for (var L = 0; L < b.length; L++) {
            var D = b[L];
            D.enumerable = D.enumerable || !1, D.configurable = !0, "value" in D && (D.writable = !0), Object.defineProperty(f, D.key, D);
          }
        }
        var _ = function() {
          function f() {
          }
          var b, L, D;
          return f.getParser = function(O, N) {
            if (N === void 0 && (N = !1), typeof O != "string") throw new Error("UserAgent should be a string");
            return new y.default(O, N);
          }, f.parse = function(O) {
            return new y.default(O).getResult();
          }, b = f, D = [{ key: "BROWSER_MAP", get: function() {
            return E.BROWSER_MAP;
          } }, { key: "ENGINE_MAP", get: function() {
            return E.ENGINE_MAP;
          } }, { key: "OS_MAP", get: function() {
            return E.OS_MAP;
          } }, { key: "PLATFORMS_MAP", get: function() {
            return E.PLATFORMS_MAP;
          } }], (L = null) && C(b.prototype, L), D && C(b, D), f;
        }();
        p.default = _, A.exports = p.default;
      }, 91: function(A, p, v) {
        p.__esModule = !0, p.default = void 0;
        var m = f(v(92)), y = f(v(93)), E = f(v(94)), C = f(v(95)), _ = f(v(17));
        function f(L) {
          return L && L.__esModule ? L : { default: L };
        }
        var b = function() {
          function L(O, N) {
            if (N === void 0 && (N = !1), O == null || O === "") throw new Error("UserAgent parameter can't be empty");
            this._ua = O, this.parsedResult = {}, N !== !0 && this.parse();
          }
          var D = L.prototype;
          return D.getUA = function() {
            return this._ua;
          }, D.test = function(O) {
            return O.test(this._ua);
          }, D.parseBrowser = function() {
            var O = this;
            this.parsedResult.browser = {};
            var N = _.default.find(m.default, function(G) {
              if (typeof G.test == "function") return G.test(O);
              if (G.test instanceof Array) return G.test.some(function($) {
                return O.test($);
              });
              throw new Error("Browser's test function is not valid");
            });
            return N && (this.parsedResult.browser = N.describe(this.getUA())), this.parsedResult.browser;
          }, D.getBrowser = function() {
            return this.parsedResult.browser ? this.parsedResult.browser : this.parseBrowser();
          }, D.getBrowserName = function(O) {
            return O ? String(this.getBrowser().name).toLowerCase() || "" : this.getBrowser().name || "";
          }, D.getBrowserVersion = function() {
            return this.getBrowser().version;
          }, D.getOS = function() {
            return this.parsedResult.os ? this.parsedResult.os : this.parseOS();
          }, D.parseOS = function() {
            var O = this;
            this.parsedResult.os = {};
            var N = _.default.find(y.default, function(G) {
              if (typeof G.test == "function") return G.test(O);
              if (G.test instanceof Array) return G.test.some(function($) {
                return O.test($);
              });
              throw new Error("Browser's test function is not valid");
            });
            return N && (this.parsedResult.os = N.describe(this.getUA())), this.parsedResult.os;
          }, D.getOSName = function(O) {
            var N = this.getOS().name;
            return O ? String(N).toLowerCase() || "" : N || "";
          }, D.getOSVersion = function() {
            return this.getOS().version;
          }, D.getPlatform = function() {
            return this.parsedResult.platform ? this.parsedResult.platform : this.parsePlatform();
          }, D.getPlatformType = function(O) {
            O === void 0 && (O = !1);
            var N = this.getPlatform().type;
            return O ? String(N).toLowerCase() || "" : N || "";
          }, D.parsePlatform = function() {
            var O = this;
            this.parsedResult.platform = {};
            var N = _.default.find(E.default, function(G) {
              if (typeof G.test == "function") return G.test(O);
              if (G.test instanceof Array) return G.test.some(function($) {
                return O.test($);
              });
              throw new Error("Browser's test function is not valid");
            });
            return N && (this.parsedResult.platform = N.describe(this.getUA())), this.parsedResult.platform;
          }, D.getEngine = function() {
            return this.parsedResult.engine ? this.parsedResult.engine : this.parseEngine();
          }, D.getEngineName = function(O) {
            return O ? String(this.getEngine().name).toLowerCase() || "" : this.getEngine().name || "";
          }, D.parseEngine = function() {
            var O = this;
            this.parsedResult.engine = {};
            var N = _.default.find(C.default, function(G) {
              if (typeof G.test == "function") return G.test(O);
              if (G.test instanceof Array) return G.test.some(function($) {
                return O.test($);
              });
              throw new Error("Browser's test function is not valid");
            });
            return N && (this.parsedResult.engine = N.describe(this.getUA())), this.parsedResult.engine;
          }, D.parse = function() {
            return this.parseBrowser(), this.parseOS(), this.parsePlatform(), this.parseEngine(), this;
          }, D.getResult = function() {
            return _.default.assign({}, this.parsedResult);
          }, D.satisfies = function(O) {
            var N = this, G = {}, $ = 0, q = {}, te = 0;
            if (Object.keys(O).forEach(function(Z) {
              var J = O[Z];
              typeof J == "string" ? (q[Z] = J, te += 1) : typeof J == "object" && (G[Z] = J, $ += 1);
            }), $ > 0) {
              var ae = Object.keys(G), de = _.default.find(ae, function(Z) {
                return N.isOS(Z);
              });
              if (de) {
                var Oe = this.satisfies(G[de]);
                if (Oe !== void 0) return Oe;
              }
              var W = _.default.find(ae, function(Z) {
                return N.isPlatform(Z);
              });
              if (W) {
                var ge = this.satisfies(G[W]);
                if (ge !== void 0) return ge;
              }
            }
            if (te > 0) {
              var ke = Object.keys(q), Se = _.default.find(ke, function(Z) {
                return N.isBrowser(Z, !0);
              });
              if (Se !== void 0) return this.compareVersion(q[Se]);
            }
          }, D.isBrowser = function(O, N) {
            N === void 0 && (N = !1);
            var G = this.getBrowserName().toLowerCase(), $ = O.toLowerCase(), q = _.default.getBrowserTypeByAlias($);
            return N && q && ($ = q.toLowerCase()), $ === G;
          }, D.compareVersion = function(O) {
            var N = [0], G = O, $ = !1, q = this.getBrowserVersion();
            if (typeof q == "string") return O[0] === ">" || O[0] === "<" ? (G = O.substr(1), O[1] === "=" ? ($ = !0, G = O.substr(2)) : N = [], O[0] === ">" ? N.push(1) : N.push(-1)) : O[0] === "=" ? G = O.substr(1) : O[0] === "~" && ($ = !0, G = O.substr(1)), N.indexOf(_.default.compareVersions(q, G, $)) > -1;
          }, D.isOS = function(O) {
            return this.getOSName(!0) === String(O).toLowerCase();
          }, D.isPlatform = function(O) {
            return this.getPlatformType(!0) === String(O).toLowerCase();
          }, D.isEngine = function(O) {
            return this.getEngineName(!0) === String(O).toLowerCase();
          }, D.is = function(O, N) {
            return N === void 0 && (N = !1), this.isBrowser(O, N) || this.isOS(O) || this.isPlatform(O);
          }, D.some = function(O) {
            var N = this;
            return O === void 0 && (O = []), O.some(function(G) {
              return N.is(G);
            });
          }, L;
        }();
        p.default = b, A.exports = p.default;
      }, 92: function(A, p, v) {
        p.__esModule = !0, p.default = void 0;
        var m, y = (m = v(17)) && m.__esModule ? m : { default: m }, E = /version\/(\d+(\.?_?\d+)+)/i, C = [{ test: [/googlebot/i], describe: function(_) {
          var f = { name: "Googlebot" }, b = y.default.getFirstMatch(/googlebot\/(\d+(\.\d+))/i, _) || y.default.getFirstMatch(E, _);
          return b && (f.version = b), f;
        } }, { test: [/opera/i], describe: function(_) {
          var f = { name: "Opera" }, b = y.default.getFirstMatch(E, _) || y.default.getFirstMatch(/(?:opera)[\s/](\d+(\.?_?\d+)+)/i, _);
          return b && (f.version = b), f;
        } }, { test: [/opr\/|opios/i], describe: function(_) {
          var f = { name: "Opera" }, b = y.default.getFirstMatch(/(?:opr|opios)[\s/](\S+)/i, _) || y.default.getFirstMatch(E, _);
          return b && (f.version = b), f;
        } }, { test: [/SamsungBrowser/i], describe: function(_) {
          var f = { name: "Samsung Internet for Android" }, b = y.default.getFirstMatch(E, _) || y.default.getFirstMatch(/(?:SamsungBrowser)[\s/](\d+(\.?_?\d+)+)/i, _);
          return b && (f.version = b), f;
        } }, { test: [/Whale/i], describe: function(_) {
          var f = { name: "NAVER Whale Browser" }, b = y.default.getFirstMatch(E, _) || y.default.getFirstMatch(/(?:whale)[\s/](\d+(?:\.\d+)+)/i, _);
          return b && (f.version = b), f;
        } }, { test: [/MZBrowser/i], describe: function(_) {
          var f = { name: "MZ Browser" }, b = y.default.getFirstMatch(/(?:MZBrowser)[\s/](\d+(?:\.\d+)+)/i, _) || y.default.getFirstMatch(E, _);
          return b && (f.version = b), f;
        } }, { test: [/focus/i], describe: function(_) {
          var f = { name: "Focus" }, b = y.default.getFirstMatch(/(?:focus)[\s/](\d+(?:\.\d+)+)/i, _) || y.default.getFirstMatch(E, _);
          return b && (f.version = b), f;
        } }, { test: [/swing/i], describe: function(_) {
          var f = { name: "Swing" }, b = y.default.getFirstMatch(/(?:swing)[\s/](\d+(?:\.\d+)+)/i, _) || y.default.getFirstMatch(E, _);
          return b && (f.version = b), f;
        } }, { test: [/coast/i], describe: function(_) {
          var f = { name: "Opera Coast" }, b = y.default.getFirstMatch(E, _) || y.default.getFirstMatch(/(?:coast)[\s/](\d+(\.?_?\d+)+)/i, _);
          return b && (f.version = b), f;
        } }, { test: [/opt\/\d+(?:.?_?\d+)+/i], describe: function(_) {
          var f = { name: "Opera Touch" }, b = y.default.getFirstMatch(/(?:opt)[\s/](\d+(\.?_?\d+)+)/i, _) || y.default.getFirstMatch(E, _);
          return b && (f.version = b), f;
        } }, { test: [/yabrowser/i], describe: function(_) {
          var f = { name: "Yandex Browser" }, b = y.default.getFirstMatch(/(?:yabrowser)[\s/](\d+(\.?_?\d+)+)/i, _) || y.default.getFirstMatch(E, _);
          return b && (f.version = b), f;
        } }, { test: [/ucbrowser/i], describe: function(_) {
          var f = { name: "UC Browser" }, b = y.default.getFirstMatch(E, _) || y.default.getFirstMatch(/(?:ucbrowser)[\s/](\d+(\.?_?\d+)+)/i, _);
          return b && (f.version = b), f;
        } }, { test: [/Maxthon|mxios/i], describe: function(_) {
          var f = { name: "Maxthon" }, b = y.default.getFirstMatch(E, _) || y.default.getFirstMatch(/(?:Maxthon|mxios)[\s/](\d+(\.?_?\d+)+)/i, _);
          return b && (f.version = b), f;
        } }, { test: [/epiphany/i], describe: function(_) {
          var f = { name: "Epiphany" }, b = y.default.getFirstMatch(E, _) || y.default.getFirstMatch(/(?:epiphany)[\s/](\d+(\.?_?\d+)+)/i, _);
          return b && (f.version = b), f;
        } }, { test: [/puffin/i], describe: function(_) {
          var f = { name: "Puffin" }, b = y.default.getFirstMatch(E, _) || y.default.getFirstMatch(/(?:puffin)[\s/](\d+(\.?_?\d+)+)/i, _);
          return b && (f.version = b), f;
        } }, { test: [/sleipnir/i], describe: function(_) {
          var f = { name: "Sleipnir" }, b = y.default.getFirstMatch(E, _) || y.default.getFirstMatch(/(?:sleipnir)[\s/](\d+(\.?_?\d+)+)/i, _);
          return b && (f.version = b), f;
        } }, { test: [/k-meleon/i], describe: function(_) {
          var f = { name: "K-Meleon" }, b = y.default.getFirstMatch(E, _) || y.default.getFirstMatch(/(?:k-meleon)[\s/](\d+(\.?_?\d+)+)/i, _);
          return b && (f.version = b), f;
        } }, { test: [/micromessenger/i], describe: function(_) {
          var f = { name: "WeChat" }, b = y.default.getFirstMatch(/(?:micromessenger)[\s/](\d+(\.?_?\d+)+)/i, _) || y.default.getFirstMatch(E, _);
          return b && (f.version = b), f;
        } }, { test: [/qqbrowser/i], describe: function(_) {
          var f = { name: /qqbrowserlite/i.test(_) ? "QQ Browser Lite" : "QQ Browser" }, b = y.default.getFirstMatch(/(?:qqbrowserlite|qqbrowser)[/](\d+(\.?_?\d+)+)/i, _) || y.default.getFirstMatch(E, _);
          return b && (f.version = b), f;
        } }, { test: [/msie|trident/i], describe: function(_) {
          var f = { name: "Internet Explorer" }, b = y.default.getFirstMatch(/(?:msie |rv:)(\d+(\.?_?\d+)+)/i, _);
          return b && (f.version = b), f;
        } }, { test: [/\sedg\//i], describe: function(_) {
          var f = { name: "Microsoft Edge" }, b = y.default.getFirstMatch(/\sedg\/(\d+(\.?_?\d+)+)/i, _);
          return b && (f.version = b), f;
        } }, { test: [/edg([ea]|ios)/i], describe: function(_) {
          var f = { name: "Microsoft Edge" }, b = y.default.getSecondMatch(/edg([ea]|ios)\/(\d+(\.?_?\d+)+)/i, _);
          return b && (f.version = b), f;
        } }, { test: [/vivaldi/i], describe: function(_) {
          var f = { name: "Vivaldi" }, b = y.default.getFirstMatch(/vivaldi\/(\d+(\.?_?\d+)+)/i, _);
          return b && (f.version = b), f;
        } }, { test: [/seamonkey/i], describe: function(_) {
          var f = { name: "SeaMonkey" }, b = y.default.getFirstMatch(/seamonkey\/(\d+(\.?_?\d+)+)/i, _);
          return b && (f.version = b), f;
        } }, { test: [/sailfish/i], describe: function(_) {
          var f = { name: "Sailfish" }, b = y.default.getFirstMatch(/sailfish\s?browser\/(\d+(\.\d+)?)/i, _);
          return b && (f.version = b), f;
        } }, { test: [/silk/i], describe: function(_) {
          var f = { name: "Amazon Silk" }, b = y.default.getFirstMatch(/silk\/(\d+(\.?_?\d+)+)/i, _);
          return b && (f.version = b), f;
        } }, { test: [/phantom/i], describe: function(_) {
          var f = { name: "PhantomJS" }, b = y.default.getFirstMatch(/phantomjs\/(\d+(\.?_?\d+)+)/i, _);
          return b && (f.version = b), f;
        } }, { test: [/slimerjs/i], describe: function(_) {
          var f = { name: "SlimerJS" }, b = y.default.getFirstMatch(/slimerjs\/(\d+(\.?_?\d+)+)/i, _);
          return b && (f.version = b), f;
        } }, { test: [/blackberry|\bbb\d+/i, /rim\stablet/i], describe: function(_) {
          var f = { name: "BlackBerry" }, b = y.default.getFirstMatch(E, _) || y.default.getFirstMatch(/blackberry[\d]+\/(\d+(\.?_?\d+)+)/i, _);
          return b && (f.version = b), f;
        } }, { test: [/(web|hpw)[o0]s/i], describe: function(_) {
          var f = { name: "WebOS Browser" }, b = y.default.getFirstMatch(E, _) || y.default.getFirstMatch(/w(?:eb)?[o0]sbrowser\/(\d+(\.?_?\d+)+)/i, _);
          return b && (f.version = b), f;
        } }, { test: [/bada/i], describe: function(_) {
          var f = { name: "Bada" }, b = y.default.getFirstMatch(/dolfin\/(\d+(\.?_?\d+)+)/i, _);
          return b && (f.version = b), f;
        } }, { test: [/tizen/i], describe: function(_) {
          var f = { name: "Tizen" }, b = y.default.getFirstMatch(/(?:tizen\s?)?browser\/(\d+(\.?_?\d+)+)/i, _) || y.default.getFirstMatch(E, _);
          return b && (f.version = b), f;
        } }, { test: [/qupzilla/i], describe: function(_) {
          var f = { name: "QupZilla" }, b = y.default.getFirstMatch(/(?:qupzilla)[\s/](\d+(\.?_?\d+)+)/i, _) || y.default.getFirstMatch(E, _);
          return b && (f.version = b), f;
        } }, { test: [/firefox|iceweasel|fxios/i], describe: function(_) {
          var f = { name: "Firefox" }, b = y.default.getFirstMatch(/(?:firefox|iceweasel|fxios)[\s/](\d+(\.?_?\d+)+)/i, _);
          return b && (f.version = b), f;
        } }, { test: [/electron/i], describe: function(_) {
          var f = { name: "Electron" }, b = y.default.getFirstMatch(/(?:electron)\/(\d+(\.?_?\d+)+)/i, _);
          return b && (f.version = b), f;
        } }, { test: [/MiuiBrowser/i], describe: function(_) {
          var f = { name: "Miui" }, b = y.default.getFirstMatch(/(?:MiuiBrowser)[\s/](\d+(\.?_?\d+)+)/i, _);
          return b && (f.version = b), f;
        } }, { test: [/chromium/i], describe: function(_) {
          var f = { name: "Chromium" }, b = y.default.getFirstMatch(/(?:chromium)[\s/](\d+(\.?_?\d+)+)/i, _) || y.default.getFirstMatch(E, _);
          return b && (f.version = b), f;
        } }, { test: [/chrome|crios|crmo/i], describe: function(_) {
          var f = { name: "Chrome" }, b = y.default.getFirstMatch(/(?:chrome|crios|crmo)\/(\d+(\.?_?\d+)+)/i, _);
          return b && (f.version = b), f;
        } }, { test: [/GSA/i], describe: function(_) {
          var f = { name: "Google Search" }, b = y.default.getFirstMatch(/(?:GSA)\/(\d+(\.?_?\d+)+)/i, _);
          return b && (f.version = b), f;
        } }, { test: function(_) {
          var f = !_.test(/like android/i), b = _.test(/android/i);
          return f && b;
        }, describe: function(_) {
          var f = { name: "Android Browser" }, b = y.default.getFirstMatch(E, _);
          return b && (f.version = b), f;
        } }, { test: [/playstation 4/i], describe: function(_) {
          var f = { name: "PlayStation 4" }, b = y.default.getFirstMatch(E, _);
          return b && (f.version = b), f;
        } }, { test: [/safari|applewebkit/i], describe: function(_) {
          var f = { name: "Safari" }, b = y.default.getFirstMatch(E, _);
          return b && (f.version = b), f;
        } }, { test: [/.*/i], describe: function(_) {
          var f = _.search("\\(") !== -1 ? /^(.*)\/(.*)[ \t]\((.*)/ : /^(.*)\/(.*) /;
          return { name: y.default.getFirstMatch(f, _), version: y.default.getSecondMatch(f, _) };
        } }];
        p.default = C, A.exports = p.default;
      }, 93: function(A, p, v) {
        p.__esModule = !0, p.default = void 0;
        var m, y = (m = v(17)) && m.__esModule ? m : { default: m }, E = v(18), C = [{ test: [/Roku\/DVP/], describe: function(_) {
          var f = y.default.getFirstMatch(/Roku\/DVP-(\d+\.\d+)/i, _);
          return { name: E.OS_MAP.Roku, version: f };
        } }, { test: [/windows phone/i], describe: function(_) {
          var f = y.default.getFirstMatch(/windows phone (?:os)?\s?(\d+(\.\d+)*)/i, _);
          return { name: E.OS_MAP.WindowsPhone, version: f };
        } }, { test: [/windows /i], describe: function(_) {
          var f = y.default.getFirstMatch(/Windows ((NT|XP)( \d\d?.\d)?)/i, _), b = y.default.getWindowsVersionName(f);
          return { name: E.OS_MAP.Windows, version: f, versionName: b };
        } }, { test: [/Macintosh(.*?) FxiOS(.*?)\//], describe: function(_) {
          var f = { name: E.OS_MAP.iOS }, b = y.default.getSecondMatch(/(Version\/)(\d[\d.]+)/, _);
          return b && (f.version = b), f;
        } }, { test: [/macintosh/i], describe: function(_) {
          var f = y.default.getFirstMatch(/mac os x (\d+(\.?_?\d+)+)/i, _).replace(/[_\s]/g, "."), b = y.default.getMacOSVersionName(f), L = { name: E.OS_MAP.MacOS, version: f };
          return b && (L.versionName = b), L;
        } }, { test: [/(ipod|iphone|ipad)/i], describe: function(_) {
          var f = y.default.getFirstMatch(/os (\d+([_\s]\d+)*) like mac os x/i, _).replace(/[_\s]/g, ".");
          return { name: E.OS_MAP.iOS, version: f };
        } }, { test: function(_) {
          var f = !_.test(/like android/i), b = _.test(/android/i);
          return f && b;
        }, describe: function(_) {
          var f = y.default.getFirstMatch(/android[\s/-](\d+(\.\d+)*)/i, _), b = y.default.getAndroidVersionName(f), L = { name: E.OS_MAP.Android, version: f };
          return b && (L.versionName = b), L;
        } }, { test: [/(web|hpw)[o0]s/i], describe: function(_) {
          var f = y.default.getFirstMatch(/(?:web|hpw)[o0]s\/(\d+(\.\d+)*)/i, _), b = { name: E.OS_MAP.WebOS };
          return f && f.length && (b.version = f), b;
        } }, { test: [/blackberry|\bbb\d+/i, /rim\stablet/i], describe: function(_) {
          var f = y.default.getFirstMatch(/rim\stablet\sos\s(\d+(\.\d+)*)/i, _) || y.default.getFirstMatch(/blackberry\d+\/(\d+([_\s]\d+)*)/i, _) || y.default.getFirstMatch(/\bbb(\d+)/i, _);
          return { name: E.OS_MAP.BlackBerry, version: f };
        } }, { test: [/bada/i], describe: function(_) {
          var f = y.default.getFirstMatch(/bada\/(\d+(\.\d+)*)/i, _);
          return { name: E.OS_MAP.Bada, version: f };
        } }, { test: [/tizen/i], describe: function(_) {
          var f = y.default.getFirstMatch(/tizen[/\s](\d+(\.\d+)*)/i, _);
          return { name: E.OS_MAP.Tizen, version: f };
        } }, { test: [/linux/i], describe: function() {
          return { name: E.OS_MAP.Linux };
        } }, { test: [/CrOS/], describe: function() {
          return { name: E.OS_MAP.ChromeOS };
        } }, { test: [/PlayStation 4/], describe: function(_) {
          var f = y.default.getFirstMatch(/PlayStation 4[/\s](\d+(\.\d+)*)/i, _);
          return { name: E.OS_MAP.PlayStation4, version: f };
        } }];
        p.default = C, A.exports = p.default;
      }, 94: function(A, p, v) {
        p.__esModule = !0, p.default = void 0;
        var m, y = (m = v(17)) && m.__esModule ? m : { default: m }, E = v(18), C = [{ test: [/googlebot/i], describe: function() {
          return { type: "bot", vendor: "Google" };
        } }, { test: [/huawei/i], describe: function(_) {
          var f = y.default.getFirstMatch(/(can-l01)/i, _) && "Nova", b = { type: E.PLATFORMS_MAP.mobile, vendor: "Huawei" };
          return f && (b.model = f), b;
        } }, { test: [/nexus\s*(?:7|8|9|10).*/i], describe: function() {
          return { type: E.PLATFORMS_MAP.tablet, vendor: "Nexus" };
        } }, { test: [/ipad/i], describe: function() {
          return { type: E.PLATFORMS_MAP.tablet, vendor: "Apple", model: "iPad" };
        } }, { test: [/Macintosh(.*?) FxiOS(.*?)\//], describe: function() {
          return { type: E.PLATFORMS_MAP.tablet, vendor: "Apple", model: "iPad" };
        } }, { test: [/kftt build/i], describe: function() {
          return { type: E.PLATFORMS_MAP.tablet, vendor: "Amazon", model: "Kindle Fire HD 7" };
        } }, { test: [/silk/i], describe: function() {
          return { type: E.PLATFORMS_MAP.tablet, vendor: "Amazon" };
        } }, { test: [/tablet(?! pc)/i], describe: function() {
          return { type: E.PLATFORMS_MAP.tablet };
        } }, { test: function(_) {
          var f = _.test(/ipod|iphone/i), b = _.test(/like (ipod|iphone)/i);
          return f && !b;
        }, describe: function(_) {
          var f = y.default.getFirstMatch(/(ipod|iphone)/i, _);
          return { type: E.PLATFORMS_MAP.mobile, vendor: "Apple", model: f };
        } }, { test: [/nexus\s*[0-6].*/i, /galaxy nexus/i], describe: function() {
          return { type: E.PLATFORMS_MAP.mobile, vendor: "Nexus" };
        } }, { test: [/[^-]mobi/i], describe: function() {
          return { type: E.PLATFORMS_MAP.mobile };
        } }, { test: function(_) {
          return _.getBrowserName(!0) === "blackberry";
        }, describe: function() {
          return { type: E.PLATFORMS_MAP.mobile, vendor: "BlackBerry" };
        } }, { test: function(_) {
          return _.getBrowserName(!0) === "bada";
        }, describe: function() {
          return { type: E.PLATFORMS_MAP.mobile };
        } }, { test: function(_) {
          return _.getBrowserName() === "windows phone";
        }, describe: function() {
          return { type: E.PLATFORMS_MAP.mobile, vendor: "Microsoft" };
        } }, { test: function(_) {
          var f = Number(String(_.getOSVersion()).split(".")[0]);
          return _.getOSName(!0) === "android" && f >= 3;
        }, describe: function() {
          return { type: E.PLATFORMS_MAP.tablet };
        } }, { test: function(_) {
          return _.getOSName(!0) === "android";
        }, describe: function() {
          return { type: E.PLATFORMS_MAP.mobile };
        } }, { test: function(_) {
          return _.getOSName(!0) === "macos";
        }, describe: function() {
          return { type: E.PLATFORMS_MAP.desktop, vendor: "Apple" };
        } }, { test: function(_) {
          return _.getOSName(!0) === "windows";
        }, describe: function() {
          return { type: E.PLATFORMS_MAP.desktop };
        } }, { test: function(_) {
          return _.getOSName(!0) === "linux";
        }, describe: function() {
          return { type: E.PLATFORMS_MAP.desktop };
        } }, { test: function(_) {
          return _.getOSName(!0) === "playstation 4";
        }, describe: function() {
          return { type: E.PLATFORMS_MAP.tv };
        } }, { test: function(_) {
          return _.getOSName(!0) === "roku";
        }, describe: function() {
          return { type: E.PLATFORMS_MAP.tv };
        } }];
        p.default = C, A.exports = p.default;
      }, 95: function(A, p, v) {
        p.__esModule = !0, p.default = void 0;
        var m, y = (m = v(17)) && m.__esModule ? m : { default: m }, E = v(18), C = [{ test: function(_) {
          return _.getBrowserName(!0) === "microsoft edge";
        }, describe: function(_) {
          if (/\sedg\//i.test(_)) return { name: E.ENGINE_MAP.Blink };
          var f = y.default.getFirstMatch(/edge\/(\d+(\.?_?\d+)+)/i, _);
          return { name: E.ENGINE_MAP.EdgeHTML, version: f };
        } }, { test: [/trident/i], describe: function(_) {
          var f = { name: E.ENGINE_MAP.Trident }, b = y.default.getFirstMatch(/trident\/(\d+(\.?_?\d+)+)/i, _);
          return b && (f.version = b), f;
        } }, { test: function(_) {
          return _.test(/presto/i);
        }, describe: function(_) {
          var f = { name: E.ENGINE_MAP.Presto }, b = y.default.getFirstMatch(/presto\/(\d+(\.?_?\d+)+)/i, _);
          return b && (f.version = b), f;
        } }, { test: function(_) {
          var f = _.test(/gecko/i), b = _.test(/like gecko/i);
          return f && !b;
        }, describe: function(_) {
          var f = { name: E.ENGINE_MAP.Gecko }, b = y.default.getFirstMatch(/gecko\/(\d+(\.?_?\d+)+)/i, _);
          return b && (f.version = b), f;
        } }, { test: [/(apple)?webkit\/537\.36/i], describe: function() {
          return { name: E.ENGINE_MAP.Blink };
        } }, { test: [/(apple)?webkit/i], describe: function(_) {
          var f = { name: E.ENGINE_MAP.WebKit }, b = y.default.getFirstMatch(/webkit\/(\d+(\.?_?\d+)+)/i, _);
          return b && (f.version = b), f;
        } }];
        p.default = C, A.exports = p.default;
      } });
    }, 228: (k) => {
      var A = Object.prototype.hasOwnProperty, p = "~";
      function v() {
      }
      function m(_, f, b) {
        this.fn = _, this.context = f, this.once = b || !1;
      }
      function y(_, f, b, L, D) {
        if (typeof b != "function") throw new TypeError("The listener must be a function");
        var O = new m(b, L || _, D), N = p ? p + f : f;
        return _._events[N] ? _._events[N].fn ? _._events[N] = [_._events[N], O] : _._events[N].push(O) : (_._events[N] = O, _._eventsCount++), _;
      }
      function E(_, f) {
        --_._eventsCount == 0 ? _._events = new v() : delete _._events[f];
      }
      function C() {
        this._events = new v(), this._eventsCount = 0;
      }
      Object.create && (v.prototype = /* @__PURE__ */ Object.create(null), new v().__proto__ || (p = !1)), C.prototype.eventNames = function() {
        var _, f, b = [];
        if (this._eventsCount === 0) return b;
        for (f in _ = this._events) A.call(_, f) && b.push(p ? f.slice(1) : f);
        return Object.getOwnPropertySymbols ? b.concat(Object.getOwnPropertySymbols(_)) : b;
      }, C.prototype.listeners = function(_) {
        var f = p ? p + _ : _, b = this._events[f];
        if (!b) return [];
        if (b.fn) return [b.fn];
        for (var L = 0, D = b.length, O = new Array(D); L < D; L++) O[L] = b[L].fn;
        return O;
      }, C.prototype.listenerCount = function(_) {
        var f = p ? p + _ : _, b = this._events[f];
        return b ? b.fn ? 1 : b.length : 0;
      }, C.prototype.emit = function(_, f, b, L, D, O) {
        var N = p ? p + _ : _;
        if (!this._events[N]) return !1;
        var G, $, q = this._events[N], te = arguments.length;
        if (q.fn) {
          switch (q.once && this.removeListener(_, q.fn, void 0, !0), te) {
            case 1:
              return q.fn.call(q.context), !0;
            case 2:
              return q.fn.call(q.context, f), !0;
            case 3:
              return q.fn.call(q.context, f, b), !0;
            case 4:
              return q.fn.call(q.context, f, b, L), !0;
            case 5:
              return q.fn.call(q.context, f, b, L, D), !0;
            case 6:
              return q.fn.call(q.context, f, b, L, D, O), !0;
          }
          for ($ = 1, G = new Array(te - 1); $ < te; $++) G[$ - 1] = arguments[$];
          q.fn.apply(q.context, G);
        } else {
          var ae, de = q.length;
          for ($ = 0; $ < de; $++) switch (q[$].once && this.removeListener(_, q[$].fn, void 0, !0), te) {
            case 1:
              q[$].fn.call(q[$].context);
              break;
            case 2:
              q[$].fn.call(q[$].context, f);
              break;
            case 3:
              q[$].fn.call(q[$].context, f, b);
              break;
            case 4:
              q[$].fn.call(q[$].context, f, b, L);
              break;
            default:
              if (!G) for (ae = 1, G = new Array(te - 1); ae < te; ae++) G[ae - 1] = arguments[ae];
              q[$].fn.apply(q[$].context, G);
          }
        }
        return !0;
      }, C.prototype.on = function(_, f, b) {
        return y(this, _, f, b, !1);
      }, C.prototype.once = function(_, f, b) {
        return y(this, _, f, b, !0);
      }, C.prototype.removeListener = function(_, f, b, L) {
        var D = p ? p + _ : _;
        if (!this._events[D]) return this;
        if (!f) return E(this, D), this;
        var O = this._events[D];
        if (O.fn) O.fn !== f || L && !O.once || b && O.context !== b || E(this, D);
        else {
          for (var N = 0, G = [], $ = O.length; N < $; N++) (O[N].fn !== f || L && !O[N].once || b && O[N].context !== b) && G.push(O[N]);
          G.length ? this._events[D] = G.length === 1 ? G[0] : G : E(this, D);
        }
        return this;
      }, C.prototype.removeAllListeners = function(_) {
        var f;
        return _ ? (f = p ? p + _ : _, this._events[f] && E(this, f)) : (this._events = new v(), this._eventsCount = 0), this;
      }, C.prototype.off = C.prototype.removeListener, C.prototype.addListener = C.prototype.on, C.prefixed = p, C.EventEmitter = C, k.exports = C;
    }, 8954: function(k) {
      var A;
      A = () => (() => {
        var p = { 228: (y) => {
          var E = Object.prototype.hasOwnProperty, C = "~";
          function _() {
          }
          function f(O, N, G) {
            this.fn = O, this.context = N, this.once = G || !1;
          }
          function b(O, N, G, $, q) {
            if (typeof G != "function") throw new TypeError("The listener must be a function");
            var te = new f(G, $ || O, q), ae = C ? C + N : N;
            return O._events[ae] ? O._events[ae].fn ? O._events[ae] = [O._events[ae], te] : O._events[ae].push(te) : (O._events[ae] = te, O._eventsCount++), O;
          }
          function L(O, N) {
            --O._eventsCount == 0 ? O._events = new _() : delete O._events[N];
          }
          function D() {
            this._events = new _(), this._eventsCount = 0;
          }
          Object.create && (_.prototype = /* @__PURE__ */ Object.create(null), new _().__proto__ || (C = !1)), D.prototype.eventNames = function() {
            var O, N, G = [];
            if (this._eventsCount === 0) return G;
            for (N in O = this._events) E.call(O, N) && G.push(C ? N.slice(1) : N);
            return Object.getOwnPropertySymbols ? G.concat(Object.getOwnPropertySymbols(O)) : G;
          }, D.prototype.listeners = function(O) {
            var N = C ? C + O : O, G = this._events[N];
            if (!G) return [];
            if (G.fn) return [G.fn];
            for (var $ = 0, q = G.length, te = new Array(q); $ < q; $++) te[$] = G[$].fn;
            return te;
          }, D.prototype.listenerCount = function(O) {
            var N = C ? C + O : O, G = this._events[N];
            return G ? G.fn ? 1 : G.length : 0;
          }, D.prototype.emit = function(O, N, G, $, q, te) {
            var ae = C ? C + O : O;
            if (!this._events[ae]) return !1;
            var de, Oe, W = this._events[ae], ge = arguments.length;
            if (W.fn) {
              switch (W.once && this.removeListener(O, W.fn, void 0, !0), ge) {
                case 1:
                  return W.fn.call(W.context), !0;
                case 2:
                  return W.fn.call(W.context, N), !0;
                case 3:
                  return W.fn.call(W.context, N, G), !0;
                case 4:
                  return W.fn.call(W.context, N, G, $), !0;
                case 5:
                  return W.fn.call(W.context, N, G, $, q), !0;
                case 6:
                  return W.fn.call(W.context, N, G, $, q, te), !0;
              }
              for (Oe = 1, de = new Array(ge - 1); Oe < ge; Oe++) de[Oe - 1] = arguments[Oe];
              W.fn.apply(W.context, de);
            } else {
              var ke, Se = W.length;
              for (Oe = 0; Oe < Se; Oe++) switch (W[Oe].once && this.removeListener(O, W[Oe].fn, void 0, !0), ge) {
                case 1:
                  W[Oe].fn.call(W[Oe].context);
                  break;
                case 2:
                  W[Oe].fn.call(W[Oe].context, N);
                  break;
                case 3:
                  W[Oe].fn.call(W[Oe].context, N, G);
                  break;
                case 4:
                  W[Oe].fn.call(W[Oe].context, N, G, $);
                  break;
                default:
                  if (!de) for (ke = 1, de = new Array(ge - 1); ke < ge; ke++) de[ke - 1] = arguments[ke];
                  W[Oe].fn.apply(W[Oe].context, de);
              }
            }
            return !0;
          }, D.prototype.on = function(O, N, G) {
            return b(this, O, N, G, !1);
          }, D.prototype.once = function(O, N, G) {
            return b(this, O, N, G, !0);
          }, D.prototype.removeListener = function(O, N, G, $) {
            var q = C ? C + O : O;
            if (!this._events[q]) return this;
            if (!N) return L(this, q), this;
            var te = this._events[q];
            if (te.fn) te.fn !== N || $ && !te.once || G && te.context !== G || L(this, q);
            else {
              for (var ae = 0, de = [], Oe = te.length; ae < Oe; ae++) (te[ae].fn !== N || $ && !te[ae].once || G && te[ae].context !== G) && de.push(te[ae]);
              de.length ? this._events[q] = de.length === 1 ? de[0] : de : L(this, q);
            }
            return this;
          }, D.prototype.removeAllListeners = function(O) {
            var N;
            return O ? (N = C ? C + O : O, this._events[N] && L(this, N)) : (this._events = new _(), this._eventsCount = 0), this;
          }, D.prototype.off = D.prototype.removeListener, D.prototype.addListener = D.prototype.on, D.prefixed = C, D.EventEmitter = D, y.exports = D;
        }, 543: function(y, E, C) {
          var _;
          y = C.nmd(y), (function() {
            var f, b = "Expected a function", L = "__lodash_hash_undefined__", D = "__lodash_placeholder__", O = 32, N = 128, G = 1 / 0, $ = 9007199254740991, q = NaN, te = 4294967295, ae = [["ary", N], ["bind", 1], ["bindKey", 2], ["curry", 8], ["curryRight", 16], ["flip", 512], ["partial", O], ["partialRight", 64], ["rearg", 256]], de = "[object Arguments]", Oe = "[object Array]", W = "[object Boolean]", ge = "[object Date]", ke = "[object Error]", Se = "[object Function]", Z = "[object GeneratorFunction]", J = "[object Map]", X = "[object Number]", ue = "[object Object]", pe = "[object Promise]", De = "[object RegExp]", Ie = "[object Set]", _t = "[object String]", bn = "[object Symbol]", Jt = "[object WeakMap]", Dn = "[object ArrayBuffer]", kn = "[object DataView]", Ur = "[object Float32Array]", Tr = "[object Float64Array]", gr = "[object Int8Array]", $n = "[object Int16Array]", jr = "[object Int32Array]", Cr = "[object Uint8Array]", Ir = "[object Uint8ClampedArray]", qe = "[object Uint16Array]", Zr = "[object Uint32Array]", Ks = /\b__p \+= '';/g, un = /\b(__p \+=) '' \+/g, os = /(__e\(.*?\)|\b__t\)) \+\n'';/g, as = /&(?:amp|lt|gt|quot|#39);/g, sa = /[&<>"']/g, yo = RegExp(as.source), er = RegExp(sa.source), bo = /<%-([\s\S]+?)%>/g, Ni = /<%([\s\S]+?)%>/g, Zi = /<%=([\s\S]+?)%>/g, ss = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/, Mi = /^\w*$/, To = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g, ei = /[\\^$.*+?()[\]{}|]/g, cs = RegExp(ei.source), It = /^\s+/, jt = /\s/, us = /\{(?:\n\/\* \[wrapped with .+\] \*\/)?\n?/, Wc = /\{\n\/\* \[wrapped with (.+)\] \*/, zn = /,? & /, Ke = /[^\x00-\x2f\x3a-\x40\x5b-\x60\x7b-\x7f]+/g, Js = /[()=,{}\[\]\/\s]/, Si = /\\(\\)?/g, Ys = /\$\{([^\\}]*(?:\\.[^\\}]*)*)\}/g, Co = /\w*$/, ca = /^[-+]0x[0-9a-f]+$/i, Io = /^0b[01]+$/i, Y = /^\[object .+?Constructor\]$/, re = /^0o[0-7]+$/i, he = /^(?:0|[1-9]\d*)$/, be = /[\xc0-\xd6\xd8-\xf6\xf8-\xff\u0100-\u017f]/g, Xe = /($^)/, en = /['\n\r\u2028\u2029\\]/g, it = "\\ud800-\\udfff", tt = "\\u0300-\\u036f\\ufe20-\\ufe2f\\u20d0-\\u20ff", Ue = "\\u2700-\\u27bf", we = "a-z\\xdf-\\xf6\\xf8-\\xff", Ve = "A-Z\\xc0-\\xd6\\xd8-\\xde", We = "\\ufe0e\\ufe0f", St = "\\xac\\xb1\\xd7\\xf7\\x00-\\x2f\\x3a-\\x40\\x5b-\\x60\\x7b-\\xbf\\u2000-\\u206f \\t\\x0b\\f\\xa0\\ufeff\\n\\r\\u2028\\u2029\\u1680\\u180e\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200a\\u202f\\u205f\\u3000", Ft = "[" + it + "]", Ht = "[" + St + "]", Tn = "[" + tt + "]", ua = "\\d+", la = "[" + Ue + "]", Qs = "[" + we + "]", ls = "[^" + it + St + ua + Ue + we + Ve + "]", ds = "\\ud83c[\\udffb-\\udfff]", hs = "[^" + it + "]", da = "(?:\\ud83c[\\udde6-\\uddff]){2}", Li = "[\\ud800-\\udbff][\\udc00-\\udfff]", Ro = "[" + Ve + "]", Hc = "\\u200d", ha = "(?:" + Qs + "|" + ls + ")", fa = "(?:" + Ro + "|" + ls + ")", wo = "(?:['’](?:d|ll|m|re|s|t|ve))?", Oo = "(?:['’](?:D|LL|M|RE|S|T|VE))?", Ao = "(?:" + Tn + "|" + ds + ")?", pa = "[" + We + "]?", fs = pa + Ao + "(?:" + Hc + "(?:" + [hs, da, Li].join("|") + ")" + pa + Ao + ")*", Xs = "(?:" + [la, da, Li].join("|") + ")" + fs, $c = "(?:" + [hs + Tn + "?", Tn, da, Li, Ft].join("|") + ")", Fr = RegExp("['’]", "g"), Vr = RegExp(Tn, "g"), ga = RegExp(ds + "(?=" + ds + ")|" + $c + fs, "g"), Pu = RegExp([Ro + "?" + Qs + "+" + wo + "(?=" + [Ht, Ro, "$"].join("|") + ")", fa + "+" + Oo + "(?=" + [Ht, Ro + ha, "$"].join("|") + ")", Ro + "?" + ha + "+" + wo, Ro + "+" + Oo, "\\d*(?:1ST|2ND|3RD|(?![123])\\dTH)(?=\\b|[a-z_])", "\\d*(?:1st|2nd|3rd|(?![123])\\dth)(?=\\b|[A-Z_])", ua, Xs].join("|"), "g"), pl = RegExp("[" + Hc + it + tt + We + "]"), ps = /[a-z][A-Z]|[A-Z]{2}[a-z]|[0-9][a-zA-Z]|[a-zA-Z][0-9]|[^a-zA-Z0-9 ]/, zc = ["Array", "Buffer", "DataView", "Date", "Error", "Float32Array", "Float64Array", "Function", "Int8Array", "Int16Array", "Int32Array", "Map", "Math", "Object", "Promise", "RegExp", "Set", "String", "Symbol", "TypeError", "Uint8Array", "Uint8ClampedArray", "Uint16Array", "Uint32Array", "WeakMap", "_", "clearTimeout", "isFinite", "parseInt", "setTimeout"], $t = -1, Ye = {};
            Ye[Ur] = Ye[Tr] = Ye[gr] = Ye[$n] = Ye[jr] = Ye[Cr] = Ye[Ir] = Ye[qe] = Ye[Zr] = !0, Ye[de] = Ye[Oe] = Ye[Dn] = Ye[W] = Ye[kn] = Ye[ge] = Ye[ke] = Ye[Se] = Ye[J] = Ye[X] = Ye[ue] = Ye[De] = Ye[Ie] = Ye[_t] = Ye[Jt] = !1;
            var Vt = {};
            Vt[de] = Vt[Oe] = Vt[Dn] = Vt[kn] = Vt[W] = Vt[ge] = Vt[Ur] = Vt[Tr] = Vt[gr] = Vt[$n] = Vt[jr] = Vt[J] = Vt[X] = Vt[ue] = Vt[De] = Vt[Ie] = Vt[_t] = Vt[bn] = Vt[Cr] = Vt[Ir] = Vt[qe] = Vt[Zr] = !0, Vt[ke] = Vt[Se] = Vt[Jt] = !1;
            var qc = { "\\": "\\", "'": "'", "\n": "n", "\r": "r", "\u2028": "u2028", "\u2029": "u2029" }, Kc = parseFloat, Jc = parseInt, Du = typeof C.g == "object" && C.g && C.g.Object === Object && C.g, je = typeof self == "object" && self && self.Object === Object && self, Cn = Du || je || Function("return this")(), ot = E && !E.nodeType && E, eo = ot && y && !y.nodeType && y, ko = eo && eo.exports === ot, Nn = ko && Du.process, ln = function() {
              try {
                return eo && eo.require && eo.require("util").types || Nn && Nn.binding && Nn.binding("util");
              } catch {
              }
            }(), gs = ln && ln.isArrayBuffer, Zs = ln && ln.isDate, ec = ln && ln.isMap, ms = ln && ln.isRegExp, ma = ln && ln.isSet, tr = ln && ln.isTypedArray;
            function Rr(M, F, V) {
              switch (V.length) {
                case 0:
                  return M.call(F);
                case 1:
                  return M.call(F, V[0]);
                case 2:
                  return M.call(F, V[0], V[1]);
                case 3:
                  return M.call(F, V[0], V[1], V[2]);
              }
              return M.apply(F, V);
            }
            function wr(M, F, V, ne) {
              for (var Ee = -1, Pe = M == null ? 0 : M.length; ++Ee < Pe; ) {
                var Ze = M[Ee];
                F(ne, Ze, V(Ze), M);
              }
              return ne;
            }
            function Or(M, F) {
              for (var V = -1, ne = M == null ? 0 : M.length; ++V < ne && F(M[V], V, M) !== !1; ) ;
              return M;
            }
            function tc(M, F) {
              for (var V = M == null ? 0 : M.length; V-- && F(M[V], V, M) !== !1; ) ;
              return M;
            }
            function ti(M, F) {
              for (var V = -1, ne = M == null ? 0 : M.length; ++V < ne; ) if (!F(M[V], V, M)) return !1;
              return !0;
            }
            function Gr(M, F) {
              for (var V = -1, ne = M == null ? 0 : M.length, Ee = 0, Pe = []; ++V < ne; ) {
                var Ze = M[V];
                F(Ze, V, M) && (Pe[Ee++] = Ze);
              }
              return Pe;
            }
            function Po(M, F) {
              return !(M == null || !M.length) && _a(M, F, 0) > -1;
            }
            function Yt(M, F, V) {
              for (var ne = -1, Ee = M == null ? 0 : M.length; ++ne < Ee; ) if (V(F, M[ne])) return !0;
              return !1;
            }
            function lt(M, F) {
              for (var V = -1, ne = M == null ? 0 : M.length, Ee = Array(ne); ++V < ne; ) Ee[V] = F(M[V], V, M);
              return Ee;
            }
            function ni(M, F) {
              for (var V = -1, ne = F.length, Ee = M.length; ++V < ne; ) M[Ee + V] = F[V];
              return M;
            }
            function Yc(M, F, V, ne) {
              var Ee = -1, Pe = M == null ? 0 : M.length;
              for (ne && Pe && (V = M[++Ee]); ++Ee < Pe; ) V = F(V, M[Ee], Ee, M);
              return V;
            }
            function Qc(M, F, V, ne) {
              var Ee = M == null ? 0 : M.length;
              for (ne && Ee && (V = M[--Ee]); Ee--; ) V = F(V, M[Ee], Ee, M);
              return V;
            }
            function va(M, F) {
              for (var V = -1, ne = M == null ? 0 : M.length; ++V < ne; ) if (F(M[V], V, M)) return !0;
              return !1;
            }
            var In = Sa("length");
            function vs(M, F, V) {
              var ne;
              return V(M, function(Ee, Pe, Ze) {
                if (F(Ee, Pe, Ze)) return ne = Pe, !1;
              }), ne;
            }
            function ri(M, F, V, ne) {
              for (var Ee = M.length, Pe = V + (ne ? 1 : -1); ne ? Pe-- : ++Pe < Ee; ) if (F(M[Pe], Pe, M)) return Pe;
              return -1;
            }
            function _a(M, F, V) {
              return F == F ? function(ne, Ee, Pe) {
                for (var Ze = Pe - 1, on = ne.length; ++Ze < on; ) if (ne[Ze] === Ee) return Ze;
                return -1;
              }(M, F, V) : ri(M, Xc, V);
            }
            function Nu(M, F, V, ne) {
              for (var Ee = V - 1, Pe = M.length; ++Ee < Pe; ) if (ne(M[Ee], F)) return Ee;
              return -1;
            }
            function Xc(M) {
              return M != M;
            }
            function nr(M, F) {
              var V = M == null ? 0 : M.length;
              return V ? Ss(M, F) / V : q;
            }
            function Sa(M) {
              return function(F) {
                return F == null ? f : F[M];
              };
            }
            function _s(M) {
              return function(F) {
                return M == null ? f : M[F];
              };
            }
            function nc(M, F, V, ne, Ee) {
              return Ee(M, function(Pe, Ze, on) {
                V = ne ? (ne = !1, Pe) : F(V, Pe, Ze, on);
              }), V;
            }
            function Ss(M, F) {
              for (var V, ne = -1, Ee = M.length; ++ne < Ee; ) {
                var Pe = F(M[ne]);
                Pe !== f && (V = V === f ? Pe : V + Pe);
              }
              return V;
            }
            function rc(M, F) {
              for (var V = -1, ne = Array(M); ++V < M; ) ne[V] = F(V);
              return ne;
            }
            function rr(M) {
              return M && M.slice(0, dn(M) + 1).replace(It, "");
            }
            function qn(M) {
              return function(F) {
                return M(F);
              };
            }
            function to(M, F) {
              return lt(F, function(V) {
                return M[V];
              });
            }
            function Ea(M, F) {
              return M.has(F);
            }
            function Zc(M, F) {
              for (var V = -1, ne = M.length; ++V < ne && _a(F, M[V], 0) > -1; ) ;
              return V;
            }
            function Mu(M, F) {
              for (var V = M.length; V-- && _a(F, M[V], 0) > -1; ) ;
              return V;
            }
            var gl = _s({ À: "A", Á: "A", Â: "A", Ã: "A", Ä: "A", Å: "A", à: "a", á: "a", â: "a", ã: "a", ä: "a", å: "a", Ç: "C", ç: "c", Ð: "D", ð: "d", È: "E", É: "E", Ê: "E", Ë: "E", è: "e", é: "e", ê: "e", ë: "e", Ì: "I", Í: "I", Î: "I", Ï: "I", ì: "i", í: "i", î: "i", ï: "i", Ñ: "N", ñ: "n", Ò: "O", Ó: "O", Ô: "O", Õ: "O", Ö: "O", Ø: "O", ò: "o", ó: "o", ô: "o", õ: "o", ö: "o", ø: "o", Ù: "U", Ú: "U", Û: "U", Ü: "U", ù: "u", ú: "u", û: "u", ü: "u", Ý: "Y", ý: "y", ÿ: "y", Æ: "Ae", æ: "ae", Þ: "Th", þ: "th", ß: "ss", Ā: "A", Ă: "A", Ą: "A", ā: "a", ă: "a", ą: "a", Ć: "C", Ĉ: "C", Ċ: "C", Č: "C", ć: "c", ĉ: "c", ċ: "c", č: "c", Ď: "D", Đ: "D", ď: "d", đ: "d", Ē: "E", Ĕ: "E", Ė: "E", Ę: "E", Ě: "E", ē: "e", ĕ: "e", ė: "e", ę: "e", ě: "e", Ĝ: "G", Ğ: "G", Ġ: "G", Ģ: "G", ĝ: "g", ğ: "g", ġ: "g", ģ: "g", Ĥ: "H", Ħ: "H", ĥ: "h", ħ: "h", Ĩ: "I", Ī: "I", Ĭ: "I", Į: "I", İ: "I", ĩ: "i", ī: "i", ĭ: "i", į: "i", ı: "i", Ĵ: "J", ĵ: "j", Ķ: "K", ķ: "k", ĸ: "k", Ĺ: "L", Ļ: "L", Ľ: "L", Ŀ: "L", Ł: "L", ĺ: "l", ļ: "l", ľ: "l", ŀ: "l", ł: "l", Ń: "N", Ņ: "N", Ň: "N", Ŋ: "N", ń: "n", ņ: "n", ň: "n", ŋ: "n", Ō: "O", Ŏ: "O", Ő: "O", ō: "o", ŏ: "o", ő: "o", Ŕ: "R", Ŗ: "R", Ř: "R", ŕ: "r", ŗ: "r", ř: "r", Ś: "S", Ŝ: "S", Ş: "S", Š: "S", ś: "s", ŝ: "s", ş: "s", š: "s", Ţ: "T", Ť: "T", Ŧ: "T", ţ: "t", ť: "t", ŧ: "t", Ũ: "U", Ū: "U", Ŭ: "U", Ů: "U", Ű: "U", Ų: "U", ũ: "u", ū: "u", ŭ: "u", ů: "u", ű: "u", ų: "u", Ŵ: "W", ŵ: "w", Ŷ: "Y", ŷ: "y", Ÿ: "Y", Ź: "Z", Ż: "Z", Ž: "Z", ź: "z", ż: "z", ž: "z", Ĳ: "IJ", ĳ: "ij", Œ: "Oe", œ: "oe", ŉ: "'n", ſ: "s" }), ml = _s({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" });
            function ya(M) {
              return "\\" + qc[M];
            }
            function no(M) {
              return pl.test(M);
            }
            function ic(M) {
              var F = -1, V = Array(M.size);
              return M.forEach(function(ne, Ee) {
                V[++F] = [Ee, ne];
              }), V;
            }
            function xi(M, F) {
              return function(V) {
                return M(F(V));
              };
            }
            function Wr(M, F) {
              for (var V = -1, ne = M.length, Ee = 0, Pe = []; ++V < ne; ) {
                var Ze = M[V];
                Ze !== F && Ze !== D || (M[V] = D, Pe[Ee++] = V);
              }
              return Pe;
            }
            function oc(M) {
              var F = -1, V = Array(M.size);
              return M.forEach(function(ne) {
                V[++F] = ne;
              }), V;
            }
            function ii(M) {
              return no(M) ? function(F) {
                for (var V = ga.lastIndex = 0; ga.test(F); ) ++V;
                return V;
              }(M) : In(M);
            }
            function vn(M) {
              return no(M) ? function(F) {
                return F.match(ga) || [];
              }(M) : function(F) {
                return F.split("");
              }(M);
            }
            function dn(M) {
              for (var F = M.length; F-- && jt.test(M.charAt(F)); ) ;
              return F;
            }
            var ac = _s({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" }), Do = function M(F) {
              var V, ne = (F = F == null ? Cn : Do.defaults(Cn.Object(), F, Do.pick(Cn, zc))).Array, Ee = F.Date, Pe = F.Error, Ze = F.Function, on = F.Math, Qe = F.Object, Es = F.RegExp, mr = F.String, Rt = F.TypeError, Bi = ne.prototype, ro = Ze.prototype, Ar = Qe.prototype, Hr = F["__core-js_shared__"], xe = ro.toString, Fe = Ar.hasOwnProperty, eu = 0, ys = (V = /[^.]+$/.exec(Hr && Hr.keys && Hr.keys.IE_PROTO || "")) ? "Symbol(src)_1." + V : "", Je = Ar.toString, vl = xe.call(Qe), _l = Cn._, Sl = Es("^" + xe.call(Fe).replace(ei, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$"), Rn = ko ? F.Buffer : f, Un = F.Symbol, io = F.Uint8Array, tu = Rn ? Rn.allocUnsafe : f, No = xi(Qe.getPrototypeOf, Qe), nu = Qe.create, bs = Ar.propertyIsEnumerable, oi = Bi.splice, ru = Un ? Un.isConcatSpreadable : f, Ui = Un ? Un.iterator : f, Kn = Un ? Un.toStringTag : f, Mo = function() {
                try {
                  var e = Ki(Qe, "defineProperty");
                  return e({}, "", {}), e;
                } catch {
                }
              }(), El = F.clearTimeout !== Cn.clearTimeout && F.clearTimeout, ba = Ee && Ee.now !== Cn.Date.now && Ee.now, Lu = F.setTimeout !== Cn.setTimeout && F.setTimeout, Lo = on.ceil, xo = on.floor, Ta = Qe.getOwnPropertySymbols, yl = Rn ? Rn.isBuffer : f, Bo = F.isFinite, bl = Bi.join, xu = xi(Qe.keys, Qe), gt = on.max, wt = on.min, sc = Ee.now, Tl = F.parseInt, Ts = on.random, Bu = Bi.reverse, Ca = Ki(F, "DataView"), me = Ki(F, "Map"), zt = Ki(F, "Promise"), ai = Ki(F, "Set"), ji = Ki(F, "WeakMap"), Fi = Ki(Qe, "create"), Uo = ji && new ji(), $r = {}, Cl = po(Ca), jo = po(me), Uu = po(zt), Jn = po(ai), ju = po(ji), Yn = Un ? Un.prototype : f, Ei = Yn ? Yn.valueOf : f, oo = Yn ? Yn.toString : f;
              function g(e) {
                if (pn(e) && !ut(e) && !(e instanceof Ae)) {
                  if (e instanceof Qt) return e;
                  if (Fe.call(e, "__wrapped__")) return Wu(e);
                }
                return new Qt(e);
              }
              var $e = /* @__PURE__ */ function() {
                function e() {
                }
                return function(t) {
                  if (!st(t)) return {};
                  if (nu) return nu(t);
                  e.prototype = t;
                  var i = new e();
                  return e.prototype = f, i;
                };
              }();
              function si() {
              }
              function Qt(e, t) {
                this.__wrapped__ = e, this.__actions__ = [], this.__chain__ = !!t, this.__index__ = 0, this.__values__ = f;
              }
              function Ae(e) {
                this.__wrapped__ = e, this.__actions__ = [], this.__dir__ = 1, this.__filtered__ = !1, this.__iteratees__ = [], this.__takeCount__ = te, this.__views__ = [];
              }
              function ir(e) {
                var t = -1, i = e == null ? 0 : e.length;
                for (this.clear(); ++t < i; ) {
                  var o = e[t];
                  this.set(o[0], o[1]);
                }
              }
              function kt(e) {
                var t = -1, i = e == null ? 0 : e.length;
                for (this.clear(); ++t < i; ) {
                  var o = e[t];
                  this.set(o[0], o[1]);
                }
              }
              function hn(e) {
                var t = -1, i = e == null ? 0 : e.length;
                for (this.clear(); ++t < i; ) {
                  var o = e[t];
                  this.set(o[0], o[1]);
                }
              }
              function vr(e) {
                var t = -1, i = e == null ? 0 : e.length;
                for (this.__data__ = new hn(); ++t < i; ) this.add(e[t]);
              }
              function Ot(e) {
                var t = this.__data__ = new kt(e);
                this.size = t.size;
              }
              function le(e, t) {
                var i = ut(e), o = !i && Be(e), u = !i && !o && Ji(e), d = !i && !o && !u && qa(e), h = i || o || u || d, S = h ? rc(e.length, mr) : [], T = S.length;
                for (var I in e) !t && !Fe.call(e, I) || h && (I == "length" || u && (I == "offset" || I == "parent") || d && (I == "buffer" || I == "byteLength" || I == "byteOffset") || ki(I, T)) || S.push(I);
                return S;
              }
              function or(e) {
                var t = e.length;
                return t ? e[As(0, t - 1)] : f;
              }
              function Il(e, t) {
                return Pi(lr(e), _r(t, 0, e.length));
              }
              function cc(e) {
                return Pi(lr(e));
              }
              function ao(e, t, i) {
                (i !== f && !Qr(e[t], i) || i === f && !(t in e)) && _n(e, t, i);
              }
              function ci(e, t, i) {
                var o = e[t];
                Fe.call(e, t) && Qr(o, i) && (i !== f || t in e) || _n(e, t, i);
              }
              function yi(e, t) {
                for (var i = e.length; i--; ) if (Qr(e[i][0], t)) return i;
                return -1;
              }
              function iu(e, t, i, o) {
                return jn(e, function(u, d, h) {
                  t(o, u, i(u), h);
                }), o;
              }
              function ou(e, t) {
                return e && fn(t, ct(t), e);
              }
              function _n(e, t, i) {
                t == "__proto__" && Mo ? Mo(e, t, { configurable: !0, enumerable: !0, value: i, writable: !0 }) : e[t] = i;
              }
              function Ia(e, t) {
                for (var i = -1, o = t.length, u = ne(o), d = e == null; ++i < o; ) u[i] = d ? f : Ws(e, t[i]);
                return u;
              }
              function _r(e, t, i) {
                return e == e && (i !== f && (e = e <= i ? e : i), t !== f && (e = e >= t ? e : t)), e;
              }
              function an(e, t, i, o, u, d) {
                var h, S = 1 & t, T = 2 & t, I = 4 & t;
                if (i && (h = u ? i(e, o, u, d) : i(e)), h !== f) return h;
                if (!st(e)) return e;
                var R = ut(e);
                if (R) {
                  if (h = function(x) {
                    var H = x.length, K = new x.constructor(H);
                    return H && typeof x[0] == "string" && Fe.call(x, "index") && (K.index = x.index, K.input = x.input), K;
                  }(e), !S) return lr(e, h);
                } else {
                  var w = gn(e), P = w == Se || w == Z;
                  if (Ji(e)) return Ps(e, S);
                  if (w == ue || w == de || P && !u) {
                    if (h = T || P ? {} : bc(e), !S) return T ? function(x, H) {
                      return fn(x, Ls(x), H);
                    }(e, function(x, H) {
                      return x && fn(H, mn(H), x);
                    }(h, e)) : function(x, H) {
                      return fn(x, Mr(x), H);
                    }(e, ou(h, e));
                  } else {
                    if (!Vt[w]) return u ? e : {};
                    h = function(x, H, K) {
                      var Q, ie = x.constructor;
                      switch (H) {
                        case Dn:
                          return Ho(x);
                        case W:
                        case ge:
                          return new ie(+x);
                        case kn:
                          return function(ce, oe) {
                            var ee = oe ? Ho(ce.buffer) : ce.buffer;
                            return new ce.constructor(ee, ce.byteOffset, ce.byteLength);
                          }(x, K);
                        case Ur:
                        case Tr:
                        case gr:
                        case $n:
                        case jr:
                        case Cr:
                        case Ir:
                        case qe:
                        case Zr:
                          return ho(x, K);
                        case J:
                          return new ie();
                        case X:
                        case _t:
                          return new ie(x);
                        case De:
                          return function(ce) {
                            var oe = new ce.constructor(ce.source, Co.exec(ce));
                            return oe.lastIndex = ce.lastIndex, oe;
                          }(x);
                        case Ie:
                          return new ie();
                        case bn:
                          return Q = x, Ei ? Qe(Ei.call(Q)) : {};
                      }
                    }(e, w, S);
                  }
                }
                d || (d = new Ot());
                var B = d.get(e);
                if (B) return B;
                d.set(e, h), go(e) ? e.forEach(function(x) {
                  h.add(an(x, t, i, x, e, d));
                }) : Eu(e) && e.forEach(function(x, H) {
                  h.set(H, an(x, t, i, H, e, d));
                });
                var j = R ? f : (I ? T ? Ai : Vn : T ? mn : ct)(e);
                return Or(j || e, function(x, H) {
                  j && (x = e[H = x]), ci(h, H, an(x, t, i, H, e, d));
                }), h;
              }
              function Cs(e, t, i) {
                var o = i.length;
                if (e == null) return !o;
                for (e = Qe(e); o--; ) {
                  var u = i[o], d = t[u], h = e[u];
                  if (h === f && !(u in e) || !d(h)) return !1;
                }
                return !0;
              }
              function Is(e, t, i) {
                if (typeof e != "function") throw new Rt(b);
                return Qo(function() {
                  e.apply(f, i);
                }, t);
              }
              function ui(e, t, i, o) {
                var u = -1, d = Po, h = !0, S = e.length, T = [], I = t.length;
                if (!S) return T;
                i && (t = lt(t, qn(i))), o ? (d = Yt, h = !1) : t.length >= 200 && (d = Ea, h = !1, t = new vr(t));
                e: for (; ++u < S; ) {
                  var R = e[u], w = i == null ? R : i(R);
                  if (R = o || R !== 0 ? R : 0, h && w == w) {
                    for (var P = I; P--; ) if (t[P] === w) continue e;
                    T.push(R);
                  } else d(t, w, o) || T.push(R);
                }
                return T;
              }
              g.templateSettings = { escape: bo, evaluate: Ni, interpolate: Zi, variable: "", imports: { _: g } }, g.prototype = si.prototype, g.prototype.constructor = g, Qt.prototype = $e(si.prototype), Qt.prototype.constructor = Qt, Ae.prototype = $e(si.prototype), Ae.prototype.constructor = Ae, ir.prototype.clear = function() {
                this.__data__ = Fi ? Fi(null) : {}, this.size = 0;
              }, ir.prototype.delete = function(e) {
                var t = this.has(e) && delete this.__data__[e];
                return this.size -= t ? 1 : 0, t;
              }, ir.prototype.get = function(e) {
                var t = this.__data__;
                if (Fi) {
                  var i = t[e];
                  return i === L ? f : i;
                }
                return Fe.call(t, e) ? t[e] : f;
              }, ir.prototype.has = function(e) {
                var t = this.__data__;
                return Fi ? t[e] !== f : Fe.call(t, e);
              }, ir.prototype.set = function(e, t) {
                var i = this.__data__;
                return this.size += this.has(e) ? 0 : 1, i[e] = Fi && t === f ? L : t, this;
              }, kt.prototype.clear = function() {
                this.__data__ = [], this.size = 0;
              }, kt.prototype.delete = function(e) {
                var t = this.__data__, i = yi(t, e);
                return !(i < 0 || (i == t.length - 1 ? t.pop() : oi.call(t, i, 1), --this.size, 0));
              }, kt.prototype.get = function(e) {
                var t = this.__data__, i = yi(t, e);
                return i < 0 ? f : t[i][1];
              }, kt.prototype.has = function(e) {
                return yi(this.__data__, e) > -1;
              }, kt.prototype.set = function(e, t) {
                var i = this.__data__, o = yi(i, e);
                return o < 0 ? (++this.size, i.push([e, t])) : i[o][1] = t, this;
              }, hn.prototype.clear = function() {
                this.size = 0, this.__data__ = { hash: new ir(), map: new (me || kt)(), string: new ir() };
              }, hn.prototype.delete = function(e) {
                var t = Ge(this, e).delete(e);
                return this.size -= t ? 1 : 0, t;
              }, hn.prototype.get = function(e) {
                return Ge(this, e).get(e);
              }, hn.prototype.has = function(e) {
                return Ge(this, e).has(e);
              }, hn.prototype.set = function(e, t) {
                var i = Ge(this, e), o = i.size;
                return i.set(e, t), this.size += i.size == o ? 0 : 1, this;
              }, vr.prototype.add = vr.prototype.push = function(e) {
                return this.__data__.set(e, L), this;
              }, vr.prototype.has = function(e) {
                return this.__data__.has(e);
              }, Ot.prototype.clear = function() {
                this.__data__ = new kt(), this.size = 0;
              }, Ot.prototype.delete = function(e) {
                var t = this.__data__, i = t.delete(e);
                return this.size = t.size, i;
              }, Ot.prototype.get = function(e) {
                return this.__data__.get(e);
              }, Ot.prototype.has = function(e) {
                return this.__data__.has(e);
              }, Ot.prototype.set = function(e, t) {
                var i = this.__data__;
                if (i instanceof kt) {
                  var o = i.__data__;
                  if (!me || o.length < 199) return o.push([e, t]), this.size = ++i.size, this;
                  i = this.__data__ = new hn(o);
                }
                return i.set(e, t), this.size = i.size, this;
              };
              var jn = Ii(wn), uc = Ii(Oa, !0);
              function au(e, t) {
                var i = !0;
                return jn(e, function(o, u, d) {
                  return i = !!t(o, u, d);
                }), i;
              }
              function so(e, t, i) {
                for (var o = -1, u = e.length; ++o < u; ) {
                  var d = e[o], h = t(d);
                  if (h != null && (S === f ? h == h && !Xt(h) : i(h, S))) var S = h, T = d;
                }
                return T;
              }
              function lc(e, t) {
                var i = [];
                return jn(e, function(o, u, d) {
                  t(o, u, d) && i.push(o);
                }), i;
              }
              function bt(e, t, i, o, u) {
                var d = -1, h = e.length;
                for (i || (i = fu), u || (u = []); ++d < h; ) {
                  var S = e[d];
                  t > 0 && i(S) ? t > 1 ? bt(S, t - 1, i, o, u) : ni(u, S) : o || (u[u.length] = S);
                }
                return u;
              }
              var Ra = lu(), wa = lu(!0);
              function wn(e, t) {
                return e && Ra(e, t, ct);
              }
              function Oa(e, t) {
                return e && wa(e, t, ct);
              }
              function ar(e, t) {
                return Gr(t, function(i) {
                  return qt(e[i]);
                });
              }
              function sr(e, t) {
                for (var i = 0, o = (t = Mn(t, e)).length; e != null && i < o; ) e = e[Qn(t[i++])];
                return i && i == o ? e : f;
              }
              function Rs(e, t, i) {
                var o = t(e);
                return ut(e) ? o : ni(o, i(e));
              }
              function Nt(e) {
                return e == null ? e === f ? "[object Undefined]" : "[object Null]" : Kn && Kn in Qe(e) ? function(t) {
                  var i = Fe.call(t, Kn), o = t[Kn];
                  try {
                    t[Kn] = f;
                    var u = !0;
                  } catch {
                  }
                  var d = Je.call(t);
                  return u && (i ? t[Kn] = o : delete t[Kn]), d;
                }(e) : function(t) {
                  return Je.call(t);
                }(e);
              }
              function Aa(e, t) {
                return e > t;
              }
              function Fu(e, t) {
                return e != null && Fe.call(e, t);
              }
              function Vu(e, t) {
                return e != null && t in Qe(e);
              }
              function ka(e, t, i) {
                for (var o = i ? Yt : Po, u = e[0].length, d = e.length, h = d, S = ne(d), T = 1 / 0, I = []; h--; ) {
                  var R = e[h];
                  h && t && (R = lt(R, qn(t))), T = wt(R.length, T), S[h] = !i && (t || u >= 120 && R.length >= 120) ? new vr(h && R) : f;
                }
                R = e[0];
                var w = -1, P = S[0];
                e: for (; ++w < u && I.length < T; ) {
                  var B = R[w], j = t ? t(B) : B;
                  if (B = i || B !== 0 ? B : 0, !(P ? Ea(P, j) : o(I, j, i))) {
                    for (h = d; --h; ) {
                      var x = S[h];
                      if (!(x ? Ea(x, j) : o(e[h], j, i))) continue e;
                    }
                    P && P.push(j), I.push(B);
                  }
                }
                return I;
              }
              function Vi(e, t, i) {
                var o = (e = An(e, t = Mn(t, e))) == null ? e : e[Qn(hr(t))];
                return o == null ? f : Rr(o, e, i);
              }
              function dc(e) {
                return pn(e) && Nt(e) == de;
              }
              function bi(e, t, i, o, u) {
                return e === t || (e == null || t == null || !pn(e) && !pn(t) ? e != e && t != t : function(d, h, S, T, I, R) {
                  var w = ut(d), P = ut(h), B = w ? Oe : gn(d), j = P ? Oe : gn(h), x = (B = B == de ? ue : B) == ue, H = (j = j == de ? ue : j) == ue, K = B == j;
                  if (K && Ji(d)) {
                    if (!Ji(h)) return !1;
                    w = !0, x = !1;
                  }
                  if (K && !x) return R || (R = new Ot()), w || qa(d) ? qo(d, h, S, T, I, R) : function(ee, fe, ye, Ce, ve, _e, Le) {
                    switch (ye) {
                      case kn:
                        if (ee.byteLength != fe.byteLength || ee.byteOffset != fe.byteOffset) return !1;
                        ee = ee.buffer, fe = fe.buffer;
                      case Dn:
                        return !(ee.byteLength != fe.byteLength || !_e(new io(ee), new io(fe)));
                      case W:
                      case ge:
                      case X:
                        return Qr(+ee, +fe);
                      case ke:
                        return ee.name == fe.name && ee.message == fe.message;
                      case De:
                      case _t:
                        return ee == fe + "";
                      case J:
                        var et = ic;
                      case Ie:
                        var vt = 1 & Ce;
                        if (et || (et = oc), ee.size != fe.size && !vt) return !1;
                        var Et = Le.get(ee);
                        if (Et) return Et == fe;
                        Ce |= 2, Le.set(ee, fe);
                        var mt = qo(et(ee), et(fe), Ce, ve, _e, Le);
                        return Le.delete(ee), mt;
                      case bn:
                        if (Ei) return Ei.call(ee) == Ei.call(fe);
                    }
                    return !1;
                  }(d, h, B, S, T, I, R);
                  if (!(1 & S)) {
                    var Q = x && Fe.call(d, "__wrapped__"), ie = H && Fe.call(h, "__wrapped__");
                    if (Q || ie) {
                      var ce = Q ? d.value() : d, oe = ie ? h.value() : h;
                      return R || (R = new Ot()), I(ce, oe, S, T, R);
                    }
                  }
                  return !!K && (R || (R = new Ot()), function(ee, fe, ye, Ce, ve, _e) {
                    var Le = 1 & ye, et = Vn(ee), vt = et.length;
                    if (vt != Vn(fe).length && !Le) return !1;
                    for (var Et = vt; Et--; ) {
                      var mt = et[Et];
                      if (!(Le ? mt in fe : Fe.call(fe, mt))) return !1;
                    }
                    var Ct = _e.get(ee), Zt = _e.get(fe);
                    if (Ct && Zt) return Ct == fe && Zt == ee;
                    var Wt = !0;
                    _e.set(ee, fe), _e.set(fe, ee);
                    for (var Bt = Le; ++Et < vt; ) {
                      var Lt = ee[mt = et[Et]], Dt = fe[mt];
                      if (Ce) var Ut = Le ? Ce(Dt, Lt, mt, fe, ee, _e) : Ce(Lt, Dt, mt, ee, fe, _e);
                      if (!(Ut === f ? Lt === Dt || ve(Lt, Dt, ye, Ce, _e) : Ut)) {
                        Wt = !1;
                        break;
                      }
                      Bt || (Bt = mt == "constructor");
                    }
                    if (Wt && !Bt) {
                      var nn = ee.constructor, At = fe.constructor;
                      nn == At || !("constructor" in ee) || !("constructor" in fe) || typeof nn == "function" && nn instanceof nn && typeof At == "function" && At instanceof At || (Wt = !1);
                    }
                    return _e.delete(ee), _e.delete(fe), Wt;
                  }(d, h, S, T, I, R));
                }(e, t, i, o, bi, u));
              }
              function ws(e, t, i, o) {
                var u = i.length, d = u, h = !o;
                if (e == null) return !d;
                for (e = Qe(e); u--; ) {
                  var S = i[u];
                  if (h && S[2] ? S[1] !== e[S[0]] : !(S[0] in e)) return !1;
                }
                for (; ++u < d; ) {
                  var T = (S = i[u])[0], I = e[T], R = S[1];
                  if (h && S[2]) {
                    if (I === f && !(T in e)) return !1;
                  } else {
                    var w = new Ot();
                    if (o) var P = o(I, R, T, e, t, w);
                    if (!(P === f ? bi(R, I, 3, o, w) : P)) return !1;
                  }
                }
                return !0;
              }
              function Re(e) {
                return !(!st(e) || (t = e, ys && ys in t)) && (qt(e) ? Sl : Y).test(po(e));
                var t;
              }
              function hc(e) {
                return typeof e == "function" ? e : e == null ? Xn : typeof e == "object" ? ut(e) ? su(e[0], e[1]) : fc(e) : Ou(e);
              }
              function co(e) {
                if (!Jo(e)) return xu(e);
                var t = [];
                for (var i in Qe(e)) Fe.call(e, i) && i != "constructor" && t.push(i);
                return t;
              }
              function On(e, t) {
                return e < t;
              }
              function Os(e, t) {
                var i = -1, o = yt(e) ? ne(e.length) : [];
                return jn(e, function(u, d, h) {
                  o[++i] = t(u, d, h);
                }), o;
              }
              function fc(e) {
                var t = Fa(e);
                return t.length == 1 && t[0][2] ? Cc(t[0][0], t[0][1]) : function(i) {
                  return i === e || ws(i, e, t);
                };
              }
              function su(e, t) {
                return xn(e) && Yo(t) ? Cc(Qn(e), t) : function(i) {
                  var o = Ws(i, e);
                  return o === f && o === t ? yu(i, e) : bi(t, o, 3);
                };
              }
              function Fo(e, t, i, o, u) {
                e !== t && Ra(t, function(d, h) {
                  if (u || (u = new Ot()), st(d)) (function(T, I, R, w, P, B, j) {
                    var x = Va(T, R), H = Va(I, R), K = j.get(H);
                    if (K) ao(T, R, K);
                    else {
                      var Q = B ? B(x, H, R + "", T, I, j) : f, ie = Q === f;
                      if (ie) {
                        var ce = ut(H), oe = !ce && Ji(H), ee = !ce && !oe && qa(H);
                        Q = H, ce || oe || ee ? ut(x) ? Q = x : ft(x) ? Q = lr(x) : oe ? (ie = !1, Q = Ps(H, !0)) : ee ? (ie = !1, Q = ho(H, !0)) : Q = [] : pi(H) || Be(H) ? (Q = x, Be(x) ? Q = pt(x) : st(x) && !qt(x) || (Q = bc(H))) : ie = !1;
                      }
                      ie && (j.set(H, Q), P(Q, H, w, B, j), j.delete(H)), ao(T, R, Q);
                    }
                  })(e, t, h, i, Fo, o, u);
                  else {
                    var S = o ? o(Va(e, h), d, h + "", e, t, u) : f;
                    S === f && (S = d), ao(e, h, S);
                  }
                }, mn);
              }
              function Pa(e, t) {
                var i = e.length;
                if (i) return ki(t += t < 0 ? i : 0, i) ? e[t] : f;
              }
              function pc(e, t, i) {
                t = t.length ? lt(t, function(d) {
                  return ut(d) ? function(h) {
                    return sr(h, d.length === 1 ? d[0] : d);
                  } : d;
                }) : [Xn];
                var o = -1;
                t = lt(t, qn(He()));
                var u = Os(e, function(d, h, S) {
                  var T = lt(t, function(I) {
                    return I(d);
                  });
                  return { criteria: T, index: ++o, value: d };
                });
                return function(d) {
                  var h = d.length;
                  for (d.sort(function(S, T) {
                    return function(I, R, w) {
                      for (var P = -1, B = I.criteria, j = R.criteria, x = B.length, H = w.length; ++P < x; ) {
                        var K = Sc(B[P], j[P]);
                        if (K) return P >= H ? K : K * (w[P] == "desc" ? -1 : 1);
                      }
                      return I.index - R.index;
                    }(S, T, i);
                  }); h--; ) d[h] = d[h].value;
                  return d;
                }(u);
              }
              function uo(e, t, i) {
                for (var o = -1, u = t.length, d = {}; ++o < u; ) {
                  var h = t[o], S = sr(e, h);
                  i(S, h) && cr(d, Mn(h, e), S);
                }
                return d;
              }
              function gc(e, t, i, o) {
                var u = o ? Nu : _a, d = -1, h = t.length, S = e;
                for (e === t && (t = lr(t)), i && (S = lt(e, qn(i))); ++d < h; ) for (var T = 0, I = t[d], R = i ? i(I) : I; (T = u(S, R, T, o)) > -1; ) S !== e && oi.call(S, T, 1), oi.call(e, T, 1);
                return e;
              }
              function mc(e, t) {
                for (var i = e ? t.length : 0, o = i - 1; i--; ) {
                  var u = t[i];
                  if (i == o || u !== d) {
                    var d = u;
                    ki(u) ? oi.call(e, u, 1) : Dr(e, u);
                  }
                }
                return e;
              }
              function As(e, t) {
                return e + xo(Ts() * (t - e + 1));
              }
              function Da(e, t) {
                var i = "";
                if (!e || t < 1 || t > $) return i;
                do
                  t % 2 && (i += e), (t = xo(t / 2)) && (e += e);
                while (t);
                return i;
              }
              function ht(e, t) {
                return fo(Ic(e, t, Xn), e + "");
              }
              function at(e) {
                return or(ra(e));
              }
              function Na(e, t) {
                var i = ra(e);
                return Pi(i, _r(t, 0, i.length));
              }
              function cr(e, t, i, o) {
                if (!st(e)) return e;
                for (var u = -1, d = (t = Mn(t, e)).length, h = d - 1, S = e; S != null && ++u < d; ) {
                  var T = Qn(t[u]), I = i;
                  if (T === "__proto__" || T === "constructor" || T === "prototype") return e;
                  if (u != h) {
                    var R = S[T];
                    (I = o ? o(R, T, S) : f) === f && (I = st(R) ? R : ki(t[u + 1]) ? [] : {});
                  }
                  ci(S, T, I), S = S[T];
                }
                return e;
              }
              var Gi = Uo ? function(e, t) {
                return Uo.set(e, t), e;
              } : Xn, Fn = Mo ? function(e, t) {
                return Mo(e, "toString", { configurable: !0, enumerable: !1, value: Hs(t), writable: !0 });
              } : Xn;
              function lo(e) {
                return Pi(ra(e));
              }
              function dt(e, t, i) {
                var o = -1, u = e.length;
                t < 0 && (t = -t > u ? 0 : u + t), (i = i > u ? u : i) < 0 && (i += u), u = t > i ? 0 : i - t >>> 0, t >>>= 0;
                for (var d = ne(u); ++o < u; ) d[o] = e[o + t];
                return d;
              }
              function kr(e, t) {
                var i;
                return jn(e, function(o, u, d) {
                  return !(i = t(o, u, d));
                }), !!i;
              }
              function Pr(e, t, i) {
                var o = 0, u = e == null ? o : e.length;
                if (typeof t == "number" && t == t && u <= 2147483647) {
                  for (; o < u; ) {
                    var d = o + u >>> 1, h = e[d];
                    h !== null && !Xt(h) && (i ? h <= t : h < t) ? o = d + 1 : u = d;
                  }
                  return u;
                }
                return Vo(e, t, Xn, i);
              }
              function Vo(e, t, i, o) {
                var u = 0, d = e == null ? 0 : e.length;
                if (d === 0) return 0;
                for (var h = (t = i(t)) != t, S = t === null, T = Xt(t), I = t === f; u < d; ) {
                  var R = xo((u + d) / 2), w = i(e[R]), P = w !== f, B = w === null, j = w == w, x = Xt(w);
                  if (h) var H = o || j;
                  else H = I ? j && (o || P) : S ? j && P && (o || !B) : T ? j && P && !B && (o || !x) : !B && !x && (o ? w <= t : w < t);
                  H ? u = R + 1 : d = R;
                }
                return wt(d, 4294967294);
              }
              function ks(e, t) {
                for (var i = -1, o = e.length, u = 0, d = []; ++i < o; ) {
                  var h = e[i], S = t ? t(h) : h;
                  if (!i || !Qr(S, T)) {
                    var T = S;
                    d[u++] = h === 0 ? 0 : h;
                  }
                }
                return d;
              }
              function vc(e) {
                return typeof e == "number" ? e : Xt(e) ? q : +e;
              }
              function ur(e) {
                if (typeof e == "string") return e;
                if (ut(e)) return lt(e, ur) + "";
                if (Xt(e)) return oo ? oo.call(e) : "";
                var t = e + "";
                return t == "0" && 1 / e == -1 / 0 ? "-0" : t;
              }
              function Pt(e, t, i) {
                var o = -1, u = Po, d = e.length, h = !0, S = [], T = S;
                if (i) h = !1, u = Yt;
                else if (d >= 200) {
                  var I = t ? null : hu(e);
                  if (I) return oc(I);
                  h = !1, u = Ea, T = new vr();
                } else T = t ? [] : S;
                e: for (; ++o < d; ) {
                  var R = e[o], w = t ? t(R) : R;
                  if (R = i || R !== 0 ? R : 0, h && w == w) {
                    for (var P = T.length; P--; ) if (T[P] === w) continue e;
                    t && T.push(w), S.push(R);
                  } else u(T, w, i) || (T !== S && T.push(w), S.push(R));
                }
                return S;
              }
              function Dr(e, t) {
                return (e = An(e, t = Mn(t, e))) == null || delete e[Qn(hr(t))];
              }
              function Go(e, t, i, o) {
                return cr(e, t, i(sr(e, t)), o);
              }
              function Wi(e, t, i, o) {
                for (var u = e.length, d = o ? u : -1; (o ? d-- : ++d < u) && t(e[d], d, e); ) ;
                return i ? dt(e, o ? 0 : d, o ? d + 1 : u) : dt(e, o ? d + 1 : 0, o ? u : d);
              }
              function Wo(e, t) {
                var i = e;
                return i instanceof Ae && (i = i.value()), Yc(t, function(o, u) {
                  return u.func.apply(u.thisArg, ni([o], u.args));
                }, i);
              }
              function _c(e, t, i) {
                var o = e.length;
                if (o < 2) return o ? Pt(e[0]) : [];
                for (var u = -1, d = ne(o); ++u < o; ) for (var h = e[u], S = -1; ++S < o; ) S != u && (d[u] = ui(d[u] || h, e[S], t, i));
                return Pt(bt(d, 1), t, i);
              }
              function Ti(e, t, i) {
                for (var o = -1, u = e.length, d = t.length, h = {}; ++o < u; ) {
                  var S = o < d ? t[o] : f;
                  i(h, e[o], S);
                }
                return h;
              }
              function zr(e) {
                return ft(e) ? e : [];
              }
              function Hi(e) {
                return typeof e == "function" ? e : Xn;
              }
              function Mn(e, t) {
                return ut(e) ? e : xn(e, t) ? [e] : di(Me(e));
              }
              var li = ht;
              function Nr(e, t, i) {
                var o = e.length;
                return i = i === f ? o : i, !t && i >= o ? e : dt(e, t, i);
              }
              var $i = El || function(e) {
                return Cn.clearTimeout(e);
              };
              function Ps(e, t) {
                if (t) return e.slice();
                var i = e.length, o = tu ? tu(i) : new e.constructor(i);
                return e.copy(o), o;
              }
              function Ho(e) {
                var t = new e.constructor(e.byteLength);
                return new io(t).set(new io(e)), t;
              }
              function ho(e, t) {
                var i = t ? Ho(e.buffer) : e.buffer;
                return new e.constructor(i, e.byteOffset, e.length);
              }
              function Sc(e, t) {
                if (e !== t) {
                  var i = e !== f, o = e === null, u = e == e, d = Xt(e), h = t !== f, S = t === null, T = t == t, I = Xt(t);
                  if (!S && !I && !d && e > t || d && h && T && !S && !I || o && h && T || !i && T || !u) return 1;
                  if (!o && !d && !I && e < t || I && i && u && !o && !d || S && i && u || !h && u || !T) return -1;
                }
                return 0;
              }
              function cu(e, t, i, o) {
                for (var u = -1, d = e.length, h = i.length, S = -1, T = t.length, I = gt(d - h, 0), R = ne(T + I), w = !o; ++S < T; ) R[S] = t[S];
                for (; ++u < h; ) (w || u < d) && (R[i[u]] = e[u]);
                for (; I--; ) R[S++] = e[u++];
                return R;
              }
              function uu(e, t, i, o) {
                for (var u = -1, d = e.length, h = -1, S = i.length, T = -1, I = t.length, R = gt(d - S, 0), w = ne(R + I), P = !o; ++u < R; ) w[u] = e[u];
                for (var B = u; ++T < I; ) w[B + T] = t[T];
                for (; ++h < S; ) (P || u < d) && (w[B + i[h]] = e[u++]);
                return w;
              }
              function lr(e, t) {
                var i = -1, o = e.length;
                for (t || (t = ne(o)); ++i < o; ) t[i] = e[i];
                return t;
              }
              function fn(e, t, i, o) {
                var u = !i;
                i || (i = {});
                for (var d = -1, h = t.length; ++d < h; ) {
                  var S = t[d], T = o ? o(i[S], e[S], S, i, e) : f;
                  T === f && (T = e[S]), u ? _n(i, S, T) : ci(i, S, T);
                }
                return i;
              }
              function Sr(e, t) {
                return function(i, o) {
                  var u = ut(i) ? wr : iu, d = t ? t() : {};
                  return u(i, e, He(o, 2), d);
                };
              }
              function Ci(e) {
                return ht(function(t, i) {
                  var o = -1, u = i.length, d = u > 1 ? i[u - 1] : f, h = u > 2 ? i[2] : f;
                  for (d = e.length > 3 && typeof d == "function" ? (u--, d) : f, h && sn(i[0], i[1], h) && (d = u < 3 ? f : d, u = 1), t = Qe(t); ++o < u; ) {
                    var S = i[o];
                    S && e(t, S, o, d);
                  }
                  return t;
                });
              }
              function Ii(e, t) {
                return function(i, o) {
                  if (i == null) return i;
                  if (!yt(i)) return e(i, o);
                  for (var u = i.length, d = t ? u : -1, h = Qe(i); (t ? d-- : ++d < u) && o(h[d], d, h) !== !1; ) ;
                  return i;
                };
              }
              function lu(e) {
                return function(t, i, o) {
                  for (var u = -1, d = Qe(t), h = o(t), S = h.length; S--; ) {
                    var T = h[e ? S : ++u];
                    if (i(d[T], T, d) === !1) break;
                  }
                  return t;
                };
              }
              function du(e) {
                return function(t) {
                  var i = no(t = Me(t)) ? vn(t) : f, o = i ? i[0] : t.charAt(0), u = i ? Nr(i, 1).join("") : t.slice(1);
                  return o[e]() + u;
                };
              }
              function $o(e) {
                return function(t) {
                  return Yc(Ru(Cu(t).replace(Fr, "")), e, "");
                };
              }
              function Ri(e) {
                return function() {
                  var t = arguments;
                  switch (t.length) {
                    case 0:
                      return new e();
                    case 1:
                      return new e(t[0]);
                    case 2:
                      return new e(t[0], t[1]);
                    case 3:
                      return new e(t[0], t[1], t[2]);
                    case 4:
                      return new e(t[0], t[1], t[2], t[3]);
                    case 5:
                      return new e(t[0], t[1], t[2], t[3], t[4]);
                    case 6:
                      return new e(t[0], t[1], t[2], t[3], t[4], t[5]);
                    case 7:
                      return new e(t[0], t[1], t[2], t[3], t[4], t[5], t[6]);
                  }
                  var i = $e(e.prototype), o = e.apply(i, t);
                  return st(o) ? o : i;
                };
              }
              function Ma(e) {
                return function(t, i, o) {
                  var u = Qe(t);
                  if (!yt(t)) {
                    var d = He(i, 3);
                    t = ct(t), i = function(S) {
                      return d(u[S], S, u);
                    };
                  }
                  var h = e(t, i, o);
                  return h > -1 ? u[d ? t[h] : h] : f;
                };
              }
              function Ec(e) {
                return dr(function(t) {
                  var i = t.length, o = i, u = Qt.prototype.thru;
                  for (e && t.reverse(); o--; ) {
                    var d = t[o];
                    if (typeof d != "function") throw new Rt(b);
                    if (u && !h && zi(d) == "wrapper") var h = new Qt([], !0);
                  }
                  for (o = h ? o : i; ++o < i; ) {
                    var S = zi(d = t[o]), T = S == "wrapper" ? qr(d) : f;
                    h = T && Ko(T[0]) && T[1] == 424 && !T[4].length && T[9] == 1 ? h[zi(T[0])].apply(h, T[3]) : d.length == 1 && Ko(d) ? h[S]() : h.thru(d);
                  }
                  return function() {
                    var I = arguments, R = I[0];
                    if (h && I.length == 1 && ut(R)) return h.plant(R).value();
                    for (var w = 0, P = i ? t[w].apply(this, I) : R; ++w < i; ) P = t[w].call(this, P);
                    return P;
                  };
                });
              }
              function La(e, t, i, o, u, d, h, S, T, I) {
                var R = t & N, w = 1 & t, P = 2 & t, B = 24 & t, j = 512 & t, x = P ? f : Ri(e);
                return function H() {
                  for (var K = arguments.length, Q = ne(K), ie = K; ie--; ) Q[ie] = arguments[ie];
                  if (B) var ce = qi(H), oe = function(Ce, ve) {
                    for (var _e = Ce.length, Le = 0; _e--; ) Ce[_e] === ve && ++Le;
                    return Le;
                  }(Q, ce);
                  if (o && (Q = cu(Q, o, u, B)), d && (Q = uu(Q, d, h, B)), K -= oe, B && K < I) {
                    var ee = Wr(Q, ce);
                    return Ms(e, t, La, H.placeholder, i, Q, ee, S, T, I - K);
                  }
                  var fe = w ? i : this, ye = P ? fe[e] : e;
                  return K = Q.length, S ? Q = function(Ce, ve) {
                    for (var _e = Ce.length, Le = wt(ve.length, _e), et = lr(Ce); Le--; ) {
                      var vt = ve[Le];
                      Ce[Le] = ki(vt, _e) ? et[vt] : f;
                    }
                    return Ce;
                  }(Q, S) : j && K > 1 && Q.reverse(), R && T < K && (Q.length = T), this && this !== Cn && this instanceof H && (ye = x || Ri(ye)), ye.apply(fe, Q);
                };
              }
              function Er(e, t) {
                return function(i, o) {
                  return function(u, d, h, S) {
                    return wn(u, function(T, I, R) {
                      d(S, h(T), I, R);
                    }), S;
                  }(i, e, t(o), {});
                };
              }
              function xa(e, t) {
                return function(i, o) {
                  var u;
                  if (i === f && o === f) return t;
                  if (i !== f && (u = i), o !== f) {
                    if (u === f) return o;
                    typeof i == "string" || typeof o == "string" ? (i = ur(i), o = ur(o)) : (i = vc(i), o = vc(o)), u = e(i, o);
                  }
                  return u;
                };
              }
              function zo(e) {
                return dr(function(t) {
                  return t = lt(t, qn(He())), ht(function(i) {
                    var o = this;
                    return e(t, function(u) {
                      return Rr(u, o, i);
                    });
                  });
                });
              }
              function Ba(e, t) {
                var i = (t = t === f ? " " : ur(t)).length;
                if (i < 2) return i ? Da(t, e) : t;
                var o = Da(t, Lo(e / ii(t)));
                return no(t) ? Nr(vn(o), 0, e).join("") : o.slice(0, e);
              }
              function Ds(e) {
                return function(t, i, o) {
                  return o && typeof o != "number" && sn(t, i, o) && (i = o = f), t = Ne(t), i === f ? (i = t, t = 0) : i = Ne(i), function(u, d, h, S) {
                    for (var T = -1, I = gt(Lo((d - u) / (h || 1)), 0), R = ne(I); I--; ) R[S ? I : ++T] = u, u += h;
                    return R;
                  }(t, i, o = o === f ? t < i ? 1 : -1 : Ne(o), e);
                };
              }
              function Ns(e) {
                return function(t, i) {
                  return typeof t == "string" && typeof i == "string" || (t = Lr(t), i = Lr(i)), e(t, i);
                };
              }
              function Ms(e, t, i, o, u, d, h, S, T, I) {
                var R = 8 & t;
                t |= R ? O : 64, 4 & (t &= ~(R ? 64 : O)) || (t &= -4);
                var w = [e, t, u, R ? d : f, R ? h : f, R ? f : d, R ? f : h, S, T, I], P = i.apply(f, w);
                return Ko(e) && Rc(P, w), P.placeholder = o, Ga(P, e, t);
              }
              function yc(e) {
                var t = on[e];
                return function(i, o) {
                  if (i = Lr(i), (o = o == null ? 0 : wt(nt(o), 292)) && Bo(i)) {
                    var u = (Me(i) + "e").split("e");
                    return +((u = (Me(t(u[0] + "e" + (+u[1] + o))) + "e").split("e"))[0] + "e" + (+u[1] - o));
                  }
                  return t(i);
                };
              }
              var hu = ai && 1 / oc(new ai([, -0]))[1] == G ? function(e) {
                return new ai(e);
              } : Zn;
              function Gu(e) {
                return function(t) {
                  var i = gn(t);
                  return i == J ? ic(t) : i == Ie ? function(o) {
                    var u = -1, d = Array(o.size);
                    return o.forEach(function(h) {
                      d[++u] = [h, h];
                    }), d;
                  }(t) : function(o, u) {
                    return lt(u, function(d) {
                      return [d, o[d]];
                    });
                  }(t, e(t));
                };
              }
              function wi(e, t, i, o, u, d, h, S) {
                var T = 2 & t;
                if (!T && typeof e != "function") throw new Rt(b);
                var I = o ? o.length : 0;
                if (I || (t &= -97, o = u = f), h = h === f ? h : gt(nt(h), 0), S = S === f ? S : nt(S), I -= u ? u.length : 0, 64 & t) {
                  var R = o, w = u;
                  o = u = f;
                }
                var P = T ? f : qr(e), B = [e, t, i, o, u, R, w, d, h, S];
                if (P && function(x, H) {
                  var K = x[1], Q = H[1], ie = K | Q, ce = ie < 131, oe = Q == N && K == 8 || Q == N && K == 256 && x[7].length <= H[8] || Q == 384 && H[7].length <= H[8] && K == 8;
                  if (!ce && !oe) return x;
                  1 & Q && (x[2] = H[2], ie |= 1 & K ? 0 : 4);
                  var ee = H[3];
                  if (ee) {
                    var fe = x[3];
                    x[3] = fe ? cu(fe, ee, H[4]) : ee, x[4] = fe ? Wr(x[3], D) : H[4];
                  }
                  (ee = H[5]) && (fe = x[5], x[5] = fe ? uu(fe, ee, H[6]) : ee, x[6] = fe ? Wr(x[5], D) : H[6]), (ee = H[7]) && (x[7] = ee), Q & N && (x[8] = x[8] == null ? H[8] : wt(x[8], H[8])), x[9] == null && (x[9] = H[9]), x[0] = H[0], x[1] = ie;
                }(B, P), e = B[0], t = B[1], i = B[2], o = B[3], u = B[4], !(S = B[9] = B[9] === f ? T ? 0 : e.length : gt(B[9] - I, 0)) && 24 & t && (t &= -25), t && t != 1) j = t == 8 || t == 16 ? function(x, H, K) {
                  var Q = Ri(x);
                  return function ie() {
                    for (var ce = arguments.length, oe = ne(ce), ee = ce, fe = qi(ie); ee--; ) oe[ee] = arguments[ee];
                    var ye = ce < 3 && oe[0] !== fe && oe[ce - 1] !== fe ? [] : Wr(oe, fe);
                    return (ce -= ye.length) < K ? Ms(x, H, La, ie.placeholder, f, oe, ye, f, f, K - ce) : Rr(this && this !== Cn && this instanceof ie ? Q : x, this, oe);
                  };
                }(e, t, S) : t != O && t != 33 || u.length ? La.apply(f, B) : function(x, H, K, Q) {
                  var ie = 1 & H, ce = Ri(x);
                  return function oe() {
                    for (var ee = -1, fe = arguments.length, ye = -1, Ce = Q.length, ve = ne(Ce + fe), _e = this && this !== Cn && this instanceof oe ? ce : x; ++ye < Ce; ) ve[ye] = Q[ye];
                    for (; fe--; ) ve[ye++] = arguments[++ee];
                    return Rr(_e, ie ? K : this, ve);
                  };
                }(e, t, i, o);
                else var j = function(x, H, K) {
                  var Q = 1 & H, ie = Ri(x);
                  return function ce() {
                    return (this && this !== Cn && this instanceof ce ? ie : x).apply(Q ? K : this, arguments);
                  };
                }(e, t, i);
                return Ga((P ? Gi : Rc)(j, B), e, t);
              }
              function Oi(e, t, i, o) {
                return e === f || Qr(e, Ar[i]) && !Fe.call(o, i) ? t : e;
              }
              function Ua(e, t, i, o, u, d) {
                return st(e) && st(t) && (d.set(t, e), Fo(e, t, f, Ua, d), d.delete(t)), e;
              }
              function ja(e) {
                return pi(e) ? f : e;
              }
              function qo(e, t, i, o, u, d) {
                var h = 1 & i, S = e.length, T = t.length;
                if (S != T && !(h && T > S)) return !1;
                var I = d.get(e), R = d.get(t);
                if (I && R) return I == t && R == e;
                var w = -1, P = !0, B = 2 & i ? new vr() : f;
                for (d.set(e, t), d.set(t, e); ++w < S; ) {
                  var j = e[w], x = t[w];
                  if (o) var H = h ? o(x, j, w, t, e, d) : o(j, x, w, e, t, d);
                  if (H !== f) {
                    if (H) continue;
                    P = !1;
                    break;
                  }
                  if (B) {
                    if (!va(t, function(K, Q) {
                      if (!Ea(B, Q) && (j === K || u(j, K, i, o, d))) return B.push(Q);
                    })) {
                      P = !1;
                      break;
                    }
                  } else if (j !== x && !u(j, x, i, o, d)) {
                    P = !1;
                    break;
                  }
                }
                return d.delete(e), d.delete(t), P;
              }
              function dr(e) {
                return fo(Ic(e, f, gu), e + "");
              }
              function Vn(e) {
                return Rs(e, ct, Mr);
              }
              function Ai(e) {
                return Rs(e, mn, Ls);
              }
              var qr = Uo ? function(e) {
                return Uo.get(e);
              } : Zn;
              function zi(e) {
                for (var t = e.name + "", i = $r[t], o = Fe.call($r, t) ? i.length : 0; o--; ) {
                  var u = i[o], d = u.func;
                  if (d == null || d == e) return u.name;
                }
                return t;
              }
              function qi(e) {
                return (Fe.call(g, "placeholder") ? g : e).placeholder;
              }
              function He() {
                var e = g.iteratee || Gc;
                return e = e === Gc ? hc : e, arguments.length ? e(arguments[0], arguments[1]) : e;
              }
              function Ge(e, t) {
                var i, o, u = e.__data__;
                return ((o = typeof (i = t)) == "string" || o == "number" || o == "symbol" || o == "boolean" ? i !== "__proto__" : i === null) ? u[typeof t == "string" ? "string" : "hash"] : u.map;
              }
              function Fa(e) {
                for (var t = ct(e), i = t.length; i--; ) {
                  var o = t[i], u = e[o];
                  t[i] = [o, u, Yo(u)];
                }
                return t;
              }
              function Ki(e, t) {
                var i = function(o, u) {
                  return o == null ? f : o[u];
                }(e, t);
                return Re(i) ? i : f;
              }
              var Mr = Ta ? function(e) {
                return e == null ? [] : (e = Qe(e), Gr(Ta(e), function(t) {
                  return bs.call(e, t);
                }));
              } : Ya, Ls = Ta ? function(e) {
                for (var t = []; e; ) ni(t, Mr(e)), e = No(e);
                return t;
              } : Ya, gn = Nt;
              function Ln(e, t, i) {
                for (var o = -1, u = (t = Mn(t, e)).length, d = !1; ++o < u; ) {
                  var h = Qn(t[o]);
                  if (!(d = e != null && i(e, h))) break;
                  e = e[h];
                }
                return d || ++o != u ? d : !!(u = e == null ? 0 : e.length) && Kt(u) && ki(h, u) && (ut(e) || Be(e));
              }
              function bc(e) {
                return typeof e.constructor != "function" || Jo(e) ? {} : $e(No(e));
              }
              function fu(e) {
                return ut(e) || Be(e) || !!(ru && e && e[ru]);
              }
              function ki(e, t) {
                var i = typeof e;
                return !!(t = t ?? $) && (i == "number" || i != "symbol" && he.test(e)) && e > -1 && e % 1 == 0 && e < t;
              }
              function sn(e, t, i) {
                if (!st(i)) return !1;
                var o = typeof t;
                return !!(o == "number" ? yt(i) && ki(t, i.length) : o == "string" && t in i) && Qr(i[t], e);
              }
              function xn(e, t) {
                if (ut(e)) return !1;
                var i = typeof e;
                return !(i != "number" && i != "symbol" && i != "boolean" && e != null && !Xt(e)) || Mi.test(e) || !ss.test(e) || t != null && e in Qe(t);
              }
              function Ko(e) {
                var t = zi(e), i = g[t];
                if (typeof i != "function" || !(t in Ae.prototype)) return !1;
                if (e === i) return !0;
                var o = qr(i);
                return !!o && e === o[0];
              }
              (Ca && gn(new Ca(new ArrayBuffer(1))) != kn || me && gn(new me()) != J || zt && gn(zt.resolve()) != pe || ai && gn(new ai()) != Ie || ji && gn(new ji()) != Jt) && (gn = function(e) {
                var t = Nt(e), i = t == ue ? e.constructor : f, o = i ? po(i) : "";
                if (o) switch (o) {
                  case Cl:
                    return kn;
                  case jo:
                    return J;
                  case Uu:
                    return pe;
                  case Jn:
                    return Ie;
                  case ju:
                    return Jt;
                }
                return t;
              });
              var Tc = Hr ? qt : Au;
              function Jo(e) {
                var t = e && e.constructor;
                return e === (typeof t == "function" && t.prototype || Ar);
              }
              function Yo(e) {
                return e == e && !st(e);
              }
              function Cc(e, t) {
                return function(i) {
                  return i != null && i[e] === t && (t !== f || e in Qe(i));
                };
              }
              function Ic(e, t, i) {
                return t = gt(t === f ? e.length - 1 : t, 0), function() {
                  for (var o = arguments, u = -1, d = gt(o.length - t, 0), h = ne(d); ++u < d; ) h[u] = o[t + u];
                  u = -1;
                  for (var S = ne(t + 1); ++u < t; ) S[u] = o[u];
                  return S[t] = i(h), Rr(e, this, S);
                };
              }
              function An(e, t) {
                return t.length < 2 ? e : sr(e, dt(t, 0, -1));
              }
              function Va(e, t) {
                if ((t !== "constructor" || typeof e[t] != "function") && t != "__proto__") return e[t];
              }
              var Rc = wc(Gi), Qo = Lu || function(e, t) {
                return Cn.setTimeout(e, t);
              }, fo = wc(Fn);
              function Ga(e, t, i) {
                var o = t + "";
                return fo(e, function(u, d) {
                  var h = d.length;
                  if (!h) return u;
                  var S = h - 1;
                  return d[S] = (h > 1 ? "& " : "") + d[S], d = d.join(h > 2 ? ", " : " "), u.replace(us, `{
/* [wrapped with ` + d + `] */
`);
                }(o, function(u, d) {
                  return Or(ae, function(h) {
                    var S = "_." + h[0];
                    d & h[1] && !Po(u, S) && u.push(S);
                  }), u.sort();
                }(function(u) {
                  var d = u.match(Wc);
                  return d ? d[1].split(zn) : [];
                }(o), i)));
              }
              function wc(e) {
                var t = 0, i = 0;
                return function() {
                  var o = sc(), u = 16 - (o - i);
                  if (i = o, u > 0) {
                    if (++t >= 800) return arguments[0];
                  } else t = 0;
                  return e.apply(f, arguments);
                };
              }
              function Pi(e, t) {
                var i = -1, o = e.length, u = o - 1;
                for (t = t === f ? o : t; ++i < t; ) {
                  var d = As(i, u), h = e[d];
                  e[d] = e[i], e[i] = h;
                }
                return e.length = t, e;
              }
              var Wa, Oc, di = (Wa = ea(function(e) {
                var t = [];
                return e.charCodeAt(0) === 46 && t.push(""), e.replace(To, function(i, o, u, d) {
                  t.push(u ? d.replace(Si, "$1") : o || i);
                }), t;
              }, function(e) {
                return Oc.size === 500 && Oc.clear(), e;
              }), Oc = Wa.cache, Wa);
              function Qn(e) {
                if (typeof e == "string" || Xt(e)) return e;
                var t = e + "";
                return t == "0" && 1 / e == -1 / 0 ? "-0" : t;
              }
              function po(e) {
                if (e != null) {
                  try {
                    return xe.call(e);
                  } catch {
                  }
                  try {
                    return e + "";
                  } catch {
                  }
                }
                return "";
              }
              function Wu(e) {
                if (e instanceof Ae) return e.clone();
                var t = new Qt(e.__wrapped__, e.__chain__);
                return t.__actions__ = lr(e.__actions__), t.__index__ = e.__index__, t.__values__ = e.__values__, t;
              }
              var Rl = ht(function(e, t) {
                return ft(e) ? ui(e, bt(t, 1, ft, !0)) : [];
              }), pu = ht(function(e, t) {
                var i = hr(t);
                return ft(i) && (i = f), ft(e) ? ui(e, bt(t, 1, ft, !0), He(i, 2)) : [];
              }), Ac = ht(function(e, t) {
                var i = hr(t);
                return ft(i) && (i = f), ft(e) ? ui(e, bt(t, 1, ft, !0), f, i) : [];
              });
              function kc(e, t, i) {
                var o = e == null ? 0 : e.length;
                if (!o) return -1;
                var u = i == null ? 0 : nt(i);
                return u < 0 && (u = gt(o + u, 0)), ri(e, He(t, 3), u);
              }
              function xs(e, t, i) {
                var o = e == null ? 0 : e.length;
                if (!o) return -1;
                var u = o - 1;
                return i !== f && (u = nt(i), u = i < 0 ? gt(o + u, 0) : wt(u, o - 1)), ri(e, He(t, 3), u, !0);
              }
              function gu(e) {
                return e != null && e.length ? bt(e, 1) : [];
              }
              function Hu(e) {
                return e && e.length ? e[0] : f;
              }
              var wl = ht(function(e) {
                var t = lt(e, zr);
                return t.length && t[0] === e[0] ? ka(t) : [];
              }), $u = ht(function(e) {
                var t = hr(e), i = lt(e, zr);
                return t === hr(i) ? t = f : i.pop(), i.length && i[0] === e[0] ? ka(i, He(t, 2)) : [];
              }), Kr = ht(function(e) {
                var t = hr(e), i = lt(e, zr);
                return (t = typeof t == "function" ? t : f) && i.pop(), i.length && i[0] === e[0] ? ka(i, f, t) : [];
              });
              function hr(e) {
                var t = e == null ? 0 : e.length;
                return t ? e[t - 1] : f;
              }
              var zu = ht(qu);
              function qu(e, t) {
                return e && e.length && t && t.length ? gc(e, t) : e;
              }
              var Xo = dr(function(e, t) {
                var i = e == null ? 0 : e.length, o = Ia(e, t);
                return mc(e, lt(t, function(u) {
                  return ki(u, i) ? +u : u;
                }).sort(Sc)), o;
              });
              function Ha(e) {
                return e == null ? e : Bu.call(e);
              }
              var Ku = ht(function(e) {
                return Pt(bt(e, 1, ft, !0));
              }), Ol = ht(function(e) {
                var t = hr(e);
                return ft(t) && (t = f), Pt(bt(e, 1, ft, !0), He(t, 2));
              }), mu = ht(function(e) {
                var t = hr(e);
                return t = typeof t == "function" ? t : f, Pt(bt(e, 1, ft, !0), f, t);
              });
              function Pc(e) {
                if (!e || !e.length) return [];
                var t = 0;
                return e = Gr(e, function(i) {
                  if (ft(i)) return t = gt(i.length, t), !0;
                }), rc(t, function(i) {
                  return lt(e, Sa(i));
                });
              }
              function Ju(e, t) {
                if (!e || !e.length) return [];
                var i = Pc(e);
                return t == null ? i : lt(i, function(o) {
                  return Rr(t, f, o);
                });
              }
              var Al = ht(function(e, t) {
                return ft(e) ? ui(e, t) : [];
              }), kl = ht(function(e) {
                return _c(Gr(e, ft));
              }), Yu = ht(function(e) {
                var t = hr(e);
                return ft(t) && (t = f), _c(Gr(e, ft), He(t, 2));
              }), Pl = ht(function(e) {
                var t = hr(e);
                return t = typeof t == "function" ? t : f, _c(Gr(e, ft), f, t);
              }), Dl = ht(Pc), vu = ht(function(e) {
                var t = e.length, i = t > 1 ? e[t - 1] : f;
                return i = typeof i == "function" ? (e.pop(), i) : f, Ju(e, i);
              });
              function Bs(e) {
                var t = g(e);
                return t.__chain__ = !0, t;
              }
              function Dc(e, t) {
                return t(e);
              }
              var Nl = dr(function(e) {
                var t = e.length, i = t ? e[0] : 0, o = this.__wrapped__, u = function(d) {
                  return Ia(d, e);
                };
                return !(t > 1 || this.__actions__.length) && o instanceof Ae && ki(i) ? ((o = o.slice(i, +i + (t ? 1 : 0))).__actions__.push({ func: Dc, args: [u], thisArg: f }), new Qt(o, this.__chain__).thru(function(d) {
                  return t && !d.length && d.push(f), d;
                })) : this.thru(u);
              }), Ml = Sr(function(e, t, i) {
                Fe.call(e, i) ? ++e[i] : _n(e, i, 1);
              }), Ll = Ma(kc), Qu = Ma(xs);
              function _u(e, t) {
                return (ut(e) ? Or : jn)(e, He(t, 3));
              }
              function Xu(e, t) {
                return (ut(e) ? tc : uc)(e, He(t, 3));
              }
              var xl = Sr(function(e, t, i) {
                Fe.call(e, i) ? e[i].push(t) : _n(e, i, [t]);
              }), Zu = ht(function(e, t, i) {
                var o = -1, u = typeof t == "function", d = yt(e) ? ne(e.length) : [];
                return jn(e, function(h) {
                  d[++o] = u ? Rr(t, h, i) : Vi(h, t, i);
                }), d;
              }), Zo = Sr(function(e, t, i) {
                _n(e, i, t);
              });
              function Gn(e, t) {
                return (ut(e) ? lt : Os)(e, He(t, 3));
              }
              var Jr = Sr(function(e, t, i) {
                e[i ? 0 : 1].push(t);
              }, function() {
                return [[], []];
              }), Mt = ht(function(e, t) {
                if (e == null) return [];
                var i = t.length;
                return i > 1 && sn(e, t[0], t[1]) ? t = [] : i > 2 && sn(t[0], t[1], t[2]) && (t = [t[0]]), pc(e, bt(t, 1), []);
              }), Us = ba || function() {
                return Cn.Date.now();
              };
              function Nc(e, t, i) {
                return t = i ? f : t, t = e && t == null ? e.length : t, wi(e, N, f, f, f, f, t);
              }
              function Mc(e, t) {
                var i;
                if (typeof t != "function") throw new Rt(b);
                return e = nt(e), function() {
                  return --e > 0 && (i = t.apply(this, arguments)), e <= 1 && (t = f), i;
                };
              }
              var js = ht(function(e, t, i) {
                var o = 1;
                if (i.length) {
                  var u = Wr(i, qi(js));
                  o |= O;
                }
                return wi(e, o, t, i, u);
              }), Lc = ht(function(e, t, i) {
                var o = 3;
                if (i.length) {
                  var u = Wr(i, qi(Lc));
                  o |= O;
                }
                return wi(t, o, e, i, u);
              });
              function el(e, t, i) {
                var o, u, d, h, S, T, I = 0, R = !1, w = !1, P = !0;
                if (typeof e != "function") throw new Rt(b);
                function B(Q) {
                  var ie = o, ce = u;
                  return o = u = f, I = Q, h = e.apply(ce, ie);
                }
                function j(Q) {
                  var ie = Q - T;
                  return T === f || ie >= t || ie < 0 || w && Q - I >= d;
                }
                function x() {
                  var Q = Us();
                  if (j(Q)) return H(Q);
                  S = Qo(x, function(ie) {
                    var ce = t - (ie - T);
                    return w ? wt(ce, d - (ie - I)) : ce;
                  }(Q));
                }
                function H(Q) {
                  return S = f, P && o ? B(Q) : (o = u = f, h);
                }
                function K() {
                  var Q = Us(), ie = j(Q);
                  if (o = arguments, u = this, T = Q, ie) {
                    if (S === f) return function(ce) {
                      return I = ce, S = Qo(x, t), R ? B(ce) : h;
                    }(T);
                    if (w) return $i(S), S = Qo(x, t), B(T);
                  }
                  return S === f && (S = Qo(x, t)), h;
                }
                return t = Lr(t) || 0, st(i) && (R = !!i.leading, d = (w = "maxWait" in i) ? gt(Lr(i.maxWait) || 0, t) : d, P = "trailing" in i ? !!i.trailing : P), K.cancel = function() {
                  S !== f && $i(S), I = 0, o = T = u = S = f;
                }, K.flush = function() {
                  return S === f ? h : H(Us());
                }, K;
              }
              var Bl = ht(function(e, t) {
                return Is(e, 1, t);
              }), xc = ht(function(e, t, i) {
                return Is(e, Lr(t) || 0, i);
              });
              function ea(e, t) {
                if (typeof e != "function" || t != null && typeof t != "function") throw new Rt(b);
                var i = function() {
                  var o = arguments, u = t ? t.apply(this, o) : o[0], d = i.cache;
                  if (d.has(u)) return d.get(u);
                  var h = e.apply(this, o);
                  return i.cache = d.set(u, h) || d, h;
                };
                return i.cache = new (ea.Cache || hn)(), i;
              }
              function Bc(e) {
                if (typeof e != "function") throw new Rt(b);
                return function() {
                  var t = arguments;
                  switch (t.length) {
                    case 0:
                      return !e.call(this);
                    case 1:
                      return !e.call(this, t[0]);
                    case 2:
                      return !e.call(this, t[0], t[1]);
                    case 3:
                      return !e.call(this, t[0], t[1], t[2]);
                  }
                  return !e.apply(this, t);
                };
              }
              ea.Cache = hn;
              var Su = li(function(e, t) {
                var i = (t = t.length == 1 && ut(t[0]) ? lt(t[0], qn(He())) : lt(bt(t, 1), qn(He()))).length;
                return ht(function(o) {
                  for (var u = -1, d = wt(o.length, i); ++u < d; ) o[u] = t[u].call(this, o[u]);
                  return Rr(e, this, o);
                });
              }), $a = ht(function(e, t) {
                var i = Wr(t, qi($a));
                return wi(e, O, f, t, i);
              }), Wn = ht(function(e, t) {
                var i = Wr(t, qi(Wn));
                return wi(e, 64, f, t, i);
              }), Yr = dr(function(e, t) {
                return wi(e, 256, f, f, f, t);
              });
              function Qr(e, t) {
                return e === t || e != e && t != t;
              }
              var Ul = Ns(Aa), hi = Ns(function(e, t) {
                return e >= t;
              }), Be = dc(/* @__PURE__ */ function() {
                return arguments;
              }()) ? dc : function(e) {
                return pn(e) && Fe.call(e, "callee") && !bs.call(e, "callee");
              }, ut = ne.isArray, fr = gs ? qn(gs) : function(e) {
                return pn(e) && Nt(e) == Dn;
              };
              function yt(e) {
                return e != null && Kt(e.length) && !qt(e);
              }
              function ft(e) {
                return pn(e) && yt(e);
              }
              var Ji = yl || Au, Uc = Zs ? qn(Zs) : function(e) {
                return pn(e) && Nt(e) == ge;
              };
              function fi(e) {
                if (!pn(e)) return !1;
                var t = Nt(e);
                return t == ke || t == "[object DOMException]" || typeof e.message == "string" && typeof e.name == "string" && !pi(e);
              }
              function qt(e) {
                if (!st(e)) return !1;
                var t = Nt(e);
                return t == Se || t == Z || t == "[object AsyncFunction]" || t == "[object Proxy]";
              }
              function Yi(e) {
                return typeof e == "number" && e == nt(e);
              }
              function Kt(e) {
                return typeof e == "number" && e > -1 && e % 1 == 0 && e <= $;
              }
              function st(e) {
                var t = typeof e;
                return e != null && (t == "object" || t == "function");
              }
              function pn(e) {
                return e != null && typeof e == "object";
              }
              var Eu = ec ? qn(ec) : function(e) {
                return pn(e) && gn(e) == J;
              };
              function za(e) {
                return typeof e == "number" || pn(e) && Nt(e) == X;
              }
              function pi(e) {
                if (!pn(e) || Nt(e) != ue) return !1;
                var t = No(e);
                if (t === null) return !0;
                var i = Fe.call(t, "constructor") && t.constructor;
                return typeof i == "function" && i instanceof i && xe.call(i) == vl;
              }
              var Sn = ms ? qn(ms) : function(e) {
                return pn(e) && Nt(e) == De;
              }, go = ma ? qn(ma) : function(e) {
                return pn(e) && gn(e) == Ie;
              };
              function Tt(e) {
                return typeof e == "string" || !ut(e) && pn(e) && Nt(e) == _t;
              }
              function Xt(e) {
                return typeof e == "symbol" || pn(e) && Nt(e) == bn;
              }
              var qa = tr ? qn(tr) : function(e) {
                return pn(e) && Kt(e.length) && !!Ye[Nt(e)];
              }, Fs = Ns(On), Vs = Ns(function(e, t) {
                return e <= t;
              });
              function tn(e) {
                if (!e) return [];
                if (yt(e)) return Tt(e) ? vn(e) : lr(e);
                if (Ui && e[Ui]) return function(i) {
                  for (var o, u = []; !(o = i.next()).done; ) u.push(o.value);
                  return u;
                }(e[Ui]());
                var t = gn(e);
                return (t == J ? ic : t == Ie ? oc : ra)(e);
              }
              function Ne(e) {
                return e ? (e = Lr(e)) === G || e === -1 / 0 ? 17976931348623157e292 * (e < 0 ? -1 : 1) : e == e ? e : 0 : e === 0 ? e : 0;
              }
              function nt(e) {
                var t = Ne(e), i = t % 1;
                return t == t ? i ? t - i : t : 0;
              }
              function pr(e) {
                return e ? _r(nt(e), 0, te) : 0;
              }
              function Lr(e) {
                if (typeof e == "number") return e;
                if (Xt(e)) return q;
                if (st(e)) {
                  var t = typeof e.valueOf == "function" ? e.valueOf() : e;
                  e = st(t) ? t + "" : t;
                }
                if (typeof e != "string") return e === 0 ? e : +e;
                e = rr(e);
                var i = Io.test(e);
                return i || re.test(e) ? Jc(e.slice(2), i ? 2 : 8) : ca.test(e) ? q : +e;
              }
              function pt(e) {
                return fn(e, mn(e));
              }
              function Me(e) {
                return e == null ? "" : ur(e);
              }
              var tl = Ci(function(e, t) {
                if (Jo(t) || yt(t)) fn(t, ct(t), e);
                else for (var i in t) Fe.call(t, i) && ci(e, i, t[i]);
              }), Gs = Ci(function(e, t) {
                fn(t, mn(t), e);
              }), jc = Ci(function(e, t, i, o) {
                fn(t, mn(t), e, o);
              }), jl = Ci(function(e, t, i, o) {
                fn(t, ct(t), e, o);
              }), Fc = dr(Ia), mo = ht(function(e, t) {
                e = Qe(e);
                var i = -1, o = t.length, u = o > 2 ? t[2] : f;
                for (u && sn(t[0], t[1], u) && (o = 1); ++i < o; ) for (var d = t[i], h = mn(d), S = -1, T = h.length; ++S < T; ) {
                  var I = h[S], R = e[I];
                  (R === f || Qr(R, Ar[I]) && !Fe.call(e, I)) && (e[I] = d[I]);
                }
                return e;
              }), ta = ht(function(e) {
                return e.push(f, Ua), Rr(gi, f, e);
              });
              function Ws(e, t, i) {
                var o = e == null ? f : sr(e, t);
                return o === f ? i : o;
              }
              function yu(e, t) {
                return e != null && Ln(e, t, Vu);
              }
              var Fl = Er(function(e, t, i) {
                t != null && typeof t.toString != "function" && (t = Je.call(t)), e[t] = i;
              }, Hs(Xn)), Vl = Er(function(e, t, i) {
                t != null && typeof t.toString != "function" && (t = Je.call(t)), Fe.call(e, t) ? e[t].push(i) : e[t] = [i];
              }, He), xt = ht(Vi);
              function ct(e) {
                return yt(e) ? le(e) : co(e);
              }
              function mn(e) {
                return yt(e) ? le(e, !0) : function(t) {
                  if (!st(t)) return function(d) {
                    var h = [];
                    if (d != null) for (var S in Qe(d)) h.push(S);
                    return h;
                  }(t);
                  var i = Jo(t), o = [];
                  for (var u in t) (u != "constructor" || !i && Fe.call(t, u)) && o.push(u);
                  return o;
                }(e);
              }
              var na = Ci(function(e, t, i) {
                Fo(e, t, i);
              }), gi = Ci(function(e, t, i, o) {
                Fo(e, t, i, o);
              }), nl = dr(function(e, t) {
                var i = {};
                if (e == null) return i;
                var o = !1;
                t = lt(t, function(d) {
                  return d = Mn(d, e), o || (o = d.length > 1), d;
                }), fn(e, Ai(e), i), o && (i = an(i, 7, ja));
                for (var u = t.length; u--; ) Dr(i, t[u]);
                return i;
              }), Vc = dr(function(e, t) {
                return e == null ? {} : function(i, o) {
                  return uo(i, o, function(u, d) {
                    return yu(i, d);
                  });
                }(e, t);
              });
              function mi(e, t) {
                if (e == null) return {};
                var i = lt(Ai(e), function(o) {
                  return [o];
                });
                return t = He(t), uo(e, i, function(o, u) {
                  return t(o, u[0]);
                });
              }
              var cn = Gu(ct), En = Gu(mn);
              function ra(e) {
                return e == null ? [] : to(e, ct(e));
              }
              var bu = $o(function(e, t, i) {
                return t = t.toLowerCase(), e + (i ? Tu(t) : t);
              });
              function Tu(e) {
                return Ja(Me(e).toLowerCase());
              }
              function Cu(e) {
                return (e = Me(e)) && e.replace(be, gl).replace(Vr, "");
              }
              var rl = $o(function(e, t, i) {
                return e + (i ? "-" : "") + t.toLowerCase();
              }), Gl = $o(function(e, t, i) {
                return e + (i ? " " : "") + t.toLowerCase();
              }), il = du("toLowerCase"), Iu = $o(function(e, t, i) {
                return e + (i ? "_" : "") + t.toLowerCase();
              }), ol = $o(function(e, t, i) {
                return e + (i ? " " : "") + Ja(t);
              }), Ka = $o(function(e, t, i) {
                return e + (i ? " " : "") + t.toUpperCase();
              }), Ja = du("toUpperCase");
              function Ru(e, t, i) {
                return e = Me(e), (t = i ? f : t) === f ? function(o) {
                  return ps.test(o);
                }(e) ? function(o) {
                  return o.match(Pu) || [];
                }(e) : function(o) {
                  return o.match(Ke) || [];
                }(e) : e.match(t) || [];
              }
              var al = ht(function(e, t) {
                try {
                  return Rr(e, f, t);
                } catch (i) {
                  return fi(i) ? i : new Pe(i);
                }
              }), Hn = dr(function(e, t) {
                return Or(t, function(i) {
                  i = Qn(i), _n(e, i, js(e[i], e));
                }), e;
              });
              function Hs(e) {
                return function() {
                  return e;
                };
              }
              var vo = Ec(), yr = Ec(!0);
              function Xn(e) {
                return e;
              }
              function Gc(e) {
                return hc(typeof e == "function" ? e : an(e, 1));
              }
              var sl = ht(function(e, t) {
                return function(i) {
                  return Vi(i, e, t);
                };
              }), wu = ht(function(e, t) {
                return function(i) {
                  return Vi(e, i, t);
                };
              });
              function yn(e, t, i) {
                var o = ct(t), u = ar(t, o);
                i != null || st(t) && (u.length || !o.length) || (i = t, t = e, e = this, u = ar(t, ct(t)));
                var d = !(st(i) && "chain" in i && !i.chain), h = qt(e);
                return Or(u, function(S) {
                  var T = t[S];
                  e[S] = T, h && (e.prototype[S] = function() {
                    var I = this.__chain__;
                    if (d || I) {
                      var R = e(this.__wrapped__);
                      return (R.__actions__ = lr(this.__actions__)).push({ func: T, args: arguments, thisArg: e }), R.__chain__ = I, R;
                    }
                    return T.apply(e, ni([this.value()], arguments));
                  });
                }), e;
              }
              function Zn() {
              }
              var _o = zo(lt), Wl = zo(ti), Gt = zo(va);
              function Ou(e) {
                return xn(e) ? Sa(Qn(e)) : /* @__PURE__ */ function(t) {
                  return function(i) {
                    return sr(i, t);
                  };
                }(e);
              }
              var Hl = Ds(), ia = Ds(!0);
              function Ya() {
                return [];
              }
              function Au() {
                return !1;
              }
              var So, $l = xa(function(e, t) {
                return e + t;
              }, 0), s = yc("ceil"), r = xa(function(e, t) {
                return e / t;
              }, 1), a = yc("floor"), c = xa(function(e, t) {
                return e * t;
              }, 1), l = yc("round"), n = xa(function(e, t) {
                return e - t;
              }, 0);
              return g.after = function(e, t) {
                if (typeof t != "function") throw new Rt(b);
                return e = nt(e), function() {
                  if (--e < 1) return t.apply(this, arguments);
                };
              }, g.ary = Nc, g.assign = tl, g.assignIn = Gs, g.assignInWith = jc, g.assignWith = jl, g.at = Fc, g.before = Mc, g.bind = js, g.bindAll = Hn, g.bindKey = Lc, g.castArray = function() {
                if (!arguments.length) return [];
                var e = arguments[0];
                return ut(e) ? e : [e];
              }, g.chain = Bs, g.chunk = function(e, t, i) {
                t = (i ? sn(e, t, i) : t === f) ? 1 : gt(nt(t), 0);
                var o = e == null ? 0 : e.length;
                if (!o || t < 1) return [];
                for (var u = 0, d = 0, h = ne(Lo(o / t)); u < o; ) h[d++] = dt(e, u, u += t);
                return h;
              }, g.compact = function(e) {
                for (var t = -1, i = e == null ? 0 : e.length, o = 0, u = []; ++t < i; ) {
                  var d = e[t];
                  d && (u[o++] = d);
                }
                return u;
              }, g.concat = function() {
                var e = arguments.length;
                if (!e) return [];
                for (var t = ne(e - 1), i = arguments[0], o = e; o--; ) t[o - 1] = arguments[o];
                return ni(ut(i) ? lr(i) : [i], bt(t, 1));
              }, g.cond = function(e) {
                var t = e == null ? 0 : e.length, i = He();
                return e = t ? lt(e, function(o) {
                  if (typeof o[1] != "function") throw new Rt(b);
                  return [i(o[0]), o[1]];
                }) : [], ht(function(o) {
                  for (var u = -1; ++u < t; ) {
                    var d = e[u];
                    if (Rr(d[0], this, o)) return Rr(d[1], this, o);
                  }
                });
              }, g.conforms = function(e) {
                return function(t) {
                  var i = ct(t);
                  return function(o) {
                    return Cs(o, t, i);
                  };
                }(an(e, 1));
              }, g.constant = Hs, g.countBy = Ml, g.create = function(e, t) {
                var i = $e(e);
                return t == null ? i : ou(i, t);
              }, g.curry = function e(t, i, o) {
                var u = wi(t, 8, f, f, f, f, f, i = o ? f : i);
                return u.placeholder = e.placeholder, u;
              }, g.curryRight = function e(t, i, o) {
                var u = wi(t, 16, f, f, f, f, f, i = o ? f : i);
                return u.placeholder = e.placeholder, u;
              }, g.debounce = el, g.defaults = mo, g.defaultsDeep = ta, g.defer = Bl, g.delay = xc, g.difference = Rl, g.differenceBy = pu, g.differenceWith = Ac, g.drop = function(e, t, i) {
                var o = e == null ? 0 : e.length;
                return o ? dt(e, (t = i || t === f ? 1 : nt(t)) < 0 ? 0 : t, o) : [];
              }, g.dropRight = function(e, t, i) {
                var o = e == null ? 0 : e.length;
                return o ? dt(e, 0, (t = o - (t = i || t === f ? 1 : nt(t))) < 0 ? 0 : t) : [];
              }, g.dropRightWhile = function(e, t) {
                return e && e.length ? Wi(e, He(t, 3), !0, !0) : [];
              }, g.dropWhile = function(e, t) {
                return e && e.length ? Wi(e, He(t, 3), !0) : [];
              }, g.fill = function(e, t, i, o) {
                var u = e == null ? 0 : e.length;
                return u ? (i && typeof i != "number" && sn(e, t, i) && (i = 0, o = u), function(d, h, S, T) {
                  var I = d.length;
                  for ((S = nt(S)) < 0 && (S = -S > I ? 0 : I + S), (T = T === f || T > I ? I : nt(T)) < 0 && (T += I), T = S > T ? 0 : pr(T); S < T; ) d[S++] = h;
                  return d;
                }(e, t, i, o)) : [];
              }, g.filter = function(e, t) {
                return (ut(e) ? Gr : lc)(e, He(t, 3));
              }, g.flatMap = function(e, t) {
                return bt(Gn(e, t), 1);
              }, g.flatMapDeep = function(e, t) {
                return bt(Gn(e, t), G);
              }, g.flatMapDepth = function(e, t, i) {
                return i = i === f ? 1 : nt(i), bt(Gn(e, t), i);
              }, g.flatten = gu, g.flattenDeep = function(e) {
                return e != null && e.length ? bt(e, G) : [];
              }, g.flattenDepth = function(e, t) {
                return e != null && e.length ? bt(e, t = t === f ? 1 : nt(t)) : [];
              }, g.flip = function(e) {
                return wi(e, 512);
              }, g.flow = vo, g.flowRight = yr, g.fromPairs = function(e) {
                for (var t = -1, i = e == null ? 0 : e.length, o = {}; ++t < i; ) {
                  var u = e[t];
                  o[u[0]] = u[1];
                }
                return o;
              }, g.functions = function(e) {
                return e == null ? [] : ar(e, ct(e));
              }, g.functionsIn = function(e) {
                return e == null ? [] : ar(e, mn(e));
              }, g.groupBy = xl, g.initial = function(e) {
                return e != null && e.length ? dt(e, 0, -1) : [];
              }, g.intersection = wl, g.intersectionBy = $u, g.intersectionWith = Kr, g.invert = Fl, g.invertBy = Vl, g.invokeMap = Zu, g.iteratee = Gc, g.keyBy = Zo, g.keys = ct, g.keysIn = mn, g.map = Gn, g.mapKeys = function(e, t) {
                var i = {};
                return t = He(t, 3), wn(e, function(o, u, d) {
                  _n(i, t(o, u, d), o);
                }), i;
              }, g.mapValues = function(e, t) {
                var i = {};
                return t = He(t, 3), wn(e, function(o, u, d) {
                  _n(i, u, t(o, u, d));
                }), i;
              }, g.matches = function(e) {
                return fc(an(e, 1));
              }, g.matchesProperty = function(e, t) {
                return su(e, an(t, 1));
              }, g.memoize = ea, g.merge = na, g.mergeWith = gi, g.method = sl, g.methodOf = wu, g.mixin = yn, g.negate = Bc, g.nthArg = function(e) {
                return e = nt(e), ht(function(t) {
                  return Pa(t, e);
                });
              }, g.omit = nl, g.omitBy = function(e, t) {
                return mi(e, Bc(He(t)));
              }, g.once = function(e) {
                return Mc(2, e);
              }, g.orderBy = function(e, t, i, o) {
                return e == null ? [] : (ut(t) || (t = t == null ? [] : [t]), ut(i = o ? f : i) || (i = i == null ? [] : [i]), pc(e, t, i));
              }, g.over = _o, g.overArgs = Su, g.overEvery = Wl, g.overSome = Gt, g.partial = $a, g.partialRight = Wn, g.partition = Jr, g.pick = Vc, g.pickBy = mi, g.property = Ou, g.propertyOf = function(e) {
                return function(t) {
                  return e == null ? f : sr(e, t);
                };
              }, g.pull = zu, g.pullAll = qu, g.pullAllBy = function(e, t, i) {
                return e && e.length && t && t.length ? gc(e, t, He(i, 2)) : e;
              }, g.pullAllWith = function(e, t, i) {
                return e && e.length && t && t.length ? gc(e, t, f, i) : e;
              }, g.pullAt = Xo, g.range = Hl, g.rangeRight = ia, g.rearg = Yr, g.reject = function(e, t) {
                return (ut(e) ? Gr : lc)(e, Bc(He(t, 3)));
              }, g.remove = function(e, t) {
                var i = [];
                if (!e || !e.length) return i;
                var o = -1, u = [], d = e.length;
                for (t = He(t, 3); ++o < d; ) {
                  var h = e[o];
                  t(h, o, e) && (i.push(h), u.push(o));
                }
                return mc(e, u), i;
              }, g.rest = function(e, t) {
                if (typeof e != "function") throw new Rt(b);
                return ht(e, t = t === f ? t : nt(t));
              }, g.reverse = Ha, g.sampleSize = function(e, t, i) {
                return t = (i ? sn(e, t, i) : t === f) ? 1 : nt(t), (ut(e) ? Il : Na)(e, t);
              }, g.set = function(e, t, i) {
                return e == null ? e : cr(e, t, i);
              }, g.setWith = function(e, t, i, o) {
                return o = typeof o == "function" ? o : f, e == null ? e : cr(e, t, i, o);
              }, g.shuffle = function(e) {
                return (ut(e) ? cc : lo)(e);
              }, g.slice = function(e, t, i) {
                var o = e == null ? 0 : e.length;
                return o ? (i && typeof i != "number" && sn(e, t, i) ? (t = 0, i = o) : (t = t == null ? 0 : nt(t), i = i === f ? o : nt(i)), dt(e, t, i)) : [];
              }, g.sortBy = Mt, g.sortedUniq = function(e) {
                return e && e.length ? ks(e) : [];
              }, g.sortedUniqBy = function(e, t) {
                return e && e.length ? ks(e, He(t, 2)) : [];
              }, g.split = function(e, t, i) {
                return i && typeof i != "number" && sn(e, t, i) && (t = i = f), (i = i === f ? te : i >>> 0) ? (e = Me(e)) && (typeof t == "string" || t != null && !Sn(t)) && !(t = ur(t)) && no(e) ? Nr(vn(e), 0, i) : e.split(t, i) : [];
              }, g.spread = function(e, t) {
                if (typeof e != "function") throw new Rt(b);
                return t = t == null ? 0 : gt(nt(t), 0), ht(function(i) {
                  var o = i[t], u = Nr(i, 0, t);
                  return o && ni(u, o), Rr(e, this, u);
                });
              }, g.tail = function(e) {
                var t = e == null ? 0 : e.length;
                return t ? dt(e, 1, t) : [];
              }, g.take = function(e, t, i) {
                return e && e.length ? dt(e, 0, (t = i || t === f ? 1 : nt(t)) < 0 ? 0 : t) : [];
              }, g.takeRight = function(e, t, i) {
                var o = e == null ? 0 : e.length;
                return o ? dt(e, (t = o - (t = i || t === f ? 1 : nt(t))) < 0 ? 0 : t, o) : [];
              }, g.takeRightWhile = function(e, t) {
                return e && e.length ? Wi(e, He(t, 3), !1, !0) : [];
              }, g.takeWhile = function(e, t) {
                return e && e.length ? Wi(e, He(t, 3)) : [];
              }, g.tap = function(e, t) {
                return t(e), e;
              }, g.throttle = function(e, t, i) {
                var o = !0, u = !0;
                if (typeof e != "function") throw new Rt(b);
                return st(i) && (o = "leading" in i ? !!i.leading : o, u = "trailing" in i ? !!i.trailing : u), el(e, t, { leading: o, maxWait: t, trailing: u });
              }, g.thru = Dc, g.toArray = tn, g.toPairs = cn, g.toPairsIn = En, g.toPath = function(e) {
                return ut(e) ? lt(e, Qn) : Xt(e) ? [e] : lr(di(Me(e)));
              }, g.toPlainObject = pt, g.transform = function(e, t, i) {
                var o = ut(e), u = o || Ji(e) || qa(e);
                if (t = He(t, 4), i == null) {
                  var d = e && e.constructor;
                  i = u ? o ? new d() : [] : st(e) && qt(d) ? $e(No(e)) : {};
                }
                return (u ? Or : wn)(e, function(h, S, T) {
                  return t(i, h, S, T);
                }), i;
              }, g.unary = function(e) {
                return Nc(e, 1);
              }, g.union = Ku, g.unionBy = Ol, g.unionWith = mu, g.uniq = function(e) {
                return e && e.length ? Pt(e) : [];
              }, g.uniqBy = function(e, t) {
                return e && e.length ? Pt(e, He(t, 2)) : [];
              }, g.uniqWith = function(e, t) {
                return t = typeof t == "function" ? t : f, e && e.length ? Pt(e, f, t) : [];
              }, g.unset = function(e, t) {
                return e == null || Dr(e, t);
              }, g.unzip = Pc, g.unzipWith = Ju, g.update = function(e, t, i) {
                return e == null ? e : Go(e, t, Hi(i));
              }, g.updateWith = function(e, t, i, o) {
                return o = typeof o == "function" ? o : f, e == null ? e : Go(e, t, Hi(i), o);
              }, g.values = ra, g.valuesIn = function(e) {
                return e == null ? [] : to(e, mn(e));
              }, g.without = Al, g.words = Ru, g.wrap = function(e, t) {
                return $a(Hi(t), e);
              }, g.xor = kl, g.xorBy = Yu, g.xorWith = Pl, g.zip = Dl, g.zipObject = function(e, t) {
                return Ti(e || [], t || [], ci);
              }, g.zipObjectDeep = function(e, t) {
                return Ti(e || [], t || [], cr);
              }, g.zipWith = vu, g.entries = cn, g.entriesIn = En, g.extend = Gs, g.extendWith = jc, yn(g, g), g.add = $l, g.attempt = al, g.camelCase = bu, g.capitalize = Tu, g.ceil = s, g.clamp = function(e, t, i) {
                return i === f && (i = t, t = f), i !== f && (i = (i = Lr(i)) == i ? i : 0), t !== f && (t = (t = Lr(t)) == t ? t : 0), _r(Lr(e), t, i);
              }, g.clone = function(e) {
                return an(e, 4);
              }, g.cloneDeep = function(e) {
                return an(e, 5);
              }, g.cloneDeepWith = function(e, t) {
                return an(e, 5, t = typeof t == "function" ? t : f);
              }, g.cloneWith = function(e, t) {
                return an(e, 4, t = typeof t == "function" ? t : f);
              }, g.conformsTo = function(e, t) {
                return t == null || Cs(e, t, ct(t));
              }, g.deburr = Cu, g.defaultTo = function(e, t) {
                return e == null || e != e ? t : e;
              }, g.divide = r, g.endsWith = function(e, t, i) {
                e = Me(e), t = ur(t);
                var o = e.length, u = i = i === f ? o : _r(nt(i), 0, o);
                return (i -= t.length) >= 0 && e.slice(i, u) == t;
              }, g.eq = Qr, g.escape = function(e) {
                return (e = Me(e)) && er.test(e) ? e.replace(sa, ml) : e;
              }, g.escapeRegExp = function(e) {
                return (e = Me(e)) && cs.test(e) ? e.replace(ei, "\\$&") : e;
              }, g.every = function(e, t, i) {
                var o = ut(e) ? ti : au;
                return i && sn(e, t, i) && (t = f), o(e, He(t, 3));
              }, g.find = Ll, g.findIndex = kc, g.findKey = function(e, t) {
                return vs(e, He(t, 3), wn);
              }, g.findLast = Qu, g.findLastIndex = xs, g.findLastKey = function(e, t) {
                return vs(e, He(t, 3), Oa);
              }, g.floor = a, g.forEach = _u, g.forEachRight = Xu, g.forIn = function(e, t) {
                return e == null ? e : Ra(e, He(t, 3), mn);
              }, g.forInRight = function(e, t) {
                return e == null ? e : wa(e, He(t, 3), mn);
              }, g.forOwn = function(e, t) {
                return e && wn(e, He(t, 3));
              }, g.forOwnRight = function(e, t) {
                return e && Oa(e, He(t, 3));
              }, g.get = Ws, g.gt = Ul, g.gte = hi, g.has = function(e, t) {
                return e != null && Ln(e, t, Fu);
              }, g.hasIn = yu, g.head = Hu, g.identity = Xn, g.includes = function(e, t, i, o) {
                e = yt(e) ? e : ra(e), i = i && !o ? nt(i) : 0;
                var u = e.length;
                return i < 0 && (i = gt(u + i, 0)), Tt(e) ? i <= u && e.indexOf(t, i) > -1 : !!u && _a(e, t, i) > -1;
              }, g.indexOf = function(e, t, i) {
                var o = e == null ? 0 : e.length;
                if (!o) return -1;
                var u = i == null ? 0 : nt(i);
                return u < 0 && (u = gt(o + u, 0)), _a(e, t, u);
              }, g.inRange = function(e, t, i) {
                return t = Ne(t), i === f ? (i = t, t = 0) : i = Ne(i), function(o, u, d) {
                  return o >= wt(u, d) && o < gt(u, d);
                }(e = Lr(e), t, i);
              }, g.invoke = xt, g.isArguments = Be, g.isArray = ut, g.isArrayBuffer = fr, g.isArrayLike = yt, g.isArrayLikeObject = ft, g.isBoolean = function(e) {
                return e === !0 || e === !1 || pn(e) && Nt(e) == W;
              }, g.isBuffer = Ji, g.isDate = Uc, g.isElement = function(e) {
                return pn(e) && e.nodeType === 1 && !pi(e);
              }, g.isEmpty = function(e) {
                if (e == null) return !0;
                if (yt(e) && (ut(e) || typeof e == "string" || typeof e.splice == "function" || Ji(e) || qa(e) || Be(e))) return !e.length;
                var t = gn(e);
                if (t == J || t == Ie) return !e.size;
                if (Jo(e)) return !co(e).length;
                for (var i in e) if (Fe.call(e, i)) return !1;
                return !0;
              }, g.isEqual = function(e, t) {
                return bi(e, t);
              }, g.isEqualWith = function(e, t, i) {
                var o = (i = typeof i == "function" ? i : f) ? i(e, t) : f;
                return o === f ? bi(e, t, f, i) : !!o;
              }, g.isError = fi, g.isFinite = function(e) {
                return typeof e == "number" && Bo(e);
              }, g.isFunction = qt, g.isInteger = Yi, g.isLength = Kt, g.isMap = Eu, g.isMatch = function(e, t) {
                return e === t || ws(e, t, Fa(t));
              }, g.isMatchWith = function(e, t, i) {
                return i = typeof i == "function" ? i : f, ws(e, t, Fa(t), i);
              }, g.isNaN = function(e) {
                return za(e) && e != +e;
              }, g.isNative = function(e) {
                if (Tc(e)) throw new Pe("Unsupported core-js use. Try https://npms.io/search?q=ponyfill.");
                return Re(e);
              }, g.isNil = function(e) {
                return e == null;
              }, g.isNull = function(e) {
                return e === null;
              }, g.isNumber = za, g.isObject = st, g.isObjectLike = pn, g.isPlainObject = pi, g.isRegExp = Sn, g.isSafeInteger = function(e) {
                return Yi(e) && e >= -9007199254740991 && e <= $;
              }, g.isSet = go, g.isString = Tt, g.isSymbol = Xt, g.isTypedArray = qa, g.isUndefined = function(e) {
                return e === f;
              }, g.isWeakMap = function(e) {
                return pn(e) && gn(e) == Jt;
              }, g.isWeakSet = function(e) {
                return pn(e) && Nt(e) == "[object WeakSet]";
              }, g.join = function(e, t) {
                return e == null ? "" : bl.call(e, t);
              }, g.kebabCase = rl, g.last = hr, g.lastIndexOf = function(e, t, i) {
                var o = e == null ? 0 : e.length;
                if (!o) return -1;
                var u = o;
                return i !== f && (u = (u = nt(i)) < 0 ? gt(o + u, 0) : wt(u, o - 1)), t == t ? function(d, h, S) {
                  for (var T = S + 1; T--; ) if (d[T] === h) return T;
                  return T;
                }(e, t, u) : ri(e, Xc, u, !0);
              }, g.lowerCase = Gl, g.lowerFirst = il, g.lt = Fs, g.lte = Vs, g.max = function(e) {
                return e && e.length ? so(e, Xn, Aa) : f;
              }, g.maxBy = function(e, t) {
                return e && e.length ? so(e, He(t, 2), Aa) : f;
              }, g.mean = function(e) {
                return nr(e, Xn);
              }, g.meanBy = function(e, t) {
                return nr(e, He(t, 2));
              }, g.min = function(e) {
                return e && e.length ? so(e, Xn, On) : f;
              }, g.minBy = function(e, t) {
                return e && e.length ? so(e, He(t, 2), On) : f;
              }, g.stubArray = Ya, g.stubFalse = Au, g.stubObject = function() {
                return {};
              }, g.stubString = function() {
                return "";
              }, g.stubTrue = function() {
                return !0;
              }, g.multiply = c, g.nth = function(e, t) {
                return e && e.length ? Pa(e, nt(t)) : f;
              }, g.noConflict = function() {
                return Cn._ === this && (Cn._ = _l), this;
              }, g.noop = Zn, g.now = Us, g.pad = function(e, t, i) {
                e = Me(e);
                var o = (t = nt(t)) ? ii(e) : 0;
                if (!t || o >= t) return e;
                var u = (t - o) / 2;
                return Ba(xo(u), i) + e + Ba(Lo(u), i);
              }, g.padEnd = function(e, t, i) {
                e = Me(e);
                var o = (t = nt(t)) ? ii(e) : 0;
                return t && o < t ? e + Ba(t - o, i) : e;
              }, g.padStart = function(e, t, i) {
                e = Me(e);
                var o = (t = nt(t)) ? ii(e) : 0;
                return t && o < t ? Ba(t - o, i) + e : e;
              }, g.parseInt = function(e, t, i) {
                return i || t == null ? t = 0 : t && (t = +t), Tl(Me(e).replace(It, ""), t || 0);
              }, g.random = function(e, t, i) {
                if (i && typeof i != "boolean" && sn(e, t, i) && (t = i = f), i === f && (typeof t == "boolean" ? (i = t, t = f) : typeof e == "boolean" && (i = e, e = f)), e === f && t === f ? (e = 0, t = 1) : (e = Ne(e), t === f ? (t = e, e = 0) : t = Ne(t)), e > t) {
                  var o = e;
                  e = t, t = o;
                }
                if (i || e % 1 || t % 1) {
                  var u = Ts();
                  return wt(e + u * (t - e + Kc("1e-" + ((u + "").length - 1))), t);
                }
                return As(e, t);
              }, g.reduce = function(e, t, i) {
                var o = ut(e) ? Yc : nc, u = arguments.length < 3;
                return o(e, He(t, 4), i, u, jn);
              }, g.reduceRight = function(e, t, i) {
                var o = ut(e) ? Qc : nc, u = arguments.length < 3;
                return o(e, He(t, 4), i, u, uc);
              }, g.repeat = function(e, t, i) {
                return t = (i ? sn(e, t, i) : t === f) ? 1 : nt(t), Da(Me(e), t);
              }, g.replace = function() {
                var e = arguments, t = Me(e[0]);
                return e.length < 3 ? t : t.replace(e[1], e[2]);
              }, g.result = function(e, t, i) {
                var o = -1, u = (t = Mn(t, e)).length;
                for (u || (u = 1, e = f); ++o < u; ) {
                  var d = e == null ? f : e[Qn(t[o])];
                  d === f && (o = u, d = i), e = qt(d) ? d.call(e) : d;
                }
                return e;
              }, g.round = l, g.runInContext = M, g.sample = function(e) {
                return (ut(e) ? or : at)(e);
              }, g.size = function(e) {
                if (e == null) return 0;
                if (yt(e)) return Tt(e) ? ii(e) : e.length;
                var t = gn(e);
                return t == J || t == Ie ? e.size : co(e).length;
              }, g.snakeCase = Iu, g.some = function(e, t, i) {
                var o = ut(e) ? va : kr;
                return i && sn(e, t, i) && (t = f), o(e, He(t, 3));
              }, g.sortedIndex = function(e, t) {
                return Pr(e, t);
              }, g.sortedIndexBy = function(e, t, i) {
                return Vo(e, t, He(i, 2));
              }, g.sortedIndexOf = function(e, t) {
                var i = e == null ? 0 : e.length;
                if (i) {
                  var o = Pr(e, t);
                  if (o < i && Qr(e[o], t)) return o;
                }
                return -1;
              }, g.sortedLastIndex = function(e, t) {
                return Pr(e, t, !0);
              }, g.sortedLastIndexBy = function(e, t, i) {
                return Vo(e, t, He(i, 2), !0);
              }, g.sortedLastIndexOf = function(e, t) {
                if (e != null && e.length) {
                  var i = Pr(e, t, !0) - 1;
                  if (Qr(e[i], t)) return i;
                }
                return -1;
              }, g.startCase = ol, g.startsWith = function(e, t, i) {
                return e = Me(e), i = i == null ? 0 : _r(nt(i), 0, e.length), t = ur(t), e.slice(i, i + t.length) == t;
              }, g.subtract = n, g.sum = function(e) {
                return e && e.length ? Ss(e, Xn) : 0;
              }, g.sumBy = function(e, t) {
                return e && e.length ? Ss(e, He(t, 2)) : 0;
              }, g.template = function(e, t, i) {
                var o = g.templateSettings;
                i && sn(e, t, i) && (t = f), e = Me(e), t = jc({}, t, o, Oi);
                var u, d, h = jc({}, t.imports, o.imports, Oi), S = ct(h), T = to(h, S), I = 0, R = t.interpolate || Xe, w = "__p += '", P = Es((t.escape || Xe).source + "|" + R.source + "|" + (R === Zi ? Ys : Xe).source + "|" + (t.evaluate || Xe).source + "|$", "g"), B = "//# sourceURL=" + (Fe.call(t, "sourceURL") ? (t.sourceURL + "").replace(/\s/g, " ") : "lodash.templateSources[" + ++$t + "]") + `
`;
                e.replace(P, function(H, K, Q, ie, ce, oe) {
                  return Q || (Q = ie), w += e.slice(I, oe).replace(en, ya), K && (u = !0, w += `' +
__e(` + K + `) +
'`), ce && (d = !0, w += `';
` + ce + `;
__p += '`), Q && (w += `' +
((__t = (` + Q + `)) == null ? '' : __t) +
'`), I = oe + H.length, H;
                }), w += `';
`;
                var j = Fe.call(t, "variable") && t.variable;
                if (j) {
                  if (Js.test(j)) throw new Pe("Invalid `variable` option passed into `_.template`");
                } else w = `with (obj) {
` + w + `
}
`;
                w = (d ? w.replace(Ks, "") : w).replace(un, "$1").replace(os, "$1;"), w = "function(" + (j || "obj") + `) {
` + (j ? "" : `obj || (obj = {});
`) + "var __t, __p = ''" + (u ? ", __e = _.escape" : "") + (d ? `, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
` : `;
`) + w + `return __p
}`;
                var x = al(function() {
                  return Ze(S, B + "return " + w).apply(f, T);
                });
                if (x.source = w, fi(x)) throw x;
                return x;
              }, g.times = function(e, t) {
                if ((e = nt(e)) < 1 || e > $) return [];
                var i = te, o = wt(e, te);
                t = He(t), e -= te;
                for (var u = rc(o, t); ++i < e; ) t(i);
                return u;
              }, g.toFinite = Ne, g.toInteger = nt, g.toLength = pr, g.toLower = function(e) {
                return Me(e).toLowerCase();
              }, g.toNumber = Lr, g.toSafeInteger = function(e) {
                return e ? _r(nt(e), -9007199254740991, $) : e === 0 ? e : 0;
              }, g.toString = Me, g.toUpper = function(e) {
                return Me(e).toUpperCase();
              }, g.trim = function(e, t, i) {
                if ((e = Me(e)) && (i || t === f)) return rr(e);
                if (!e || !(t = ur(t))) return e;
                var o = vn(e), u = vn(t);
                return Nr(o, Zc(o, u), Mu(o, u) + 1).join("");
              }, g.trimEnd = function(e, t, i) {
                if ((e = Me(e)) && (i || t === f)) return e.slice(0, dn(e) + 1);
                if (!e || !(t = ur(t))) return e;
                var o = vn(e);
                return Nr(o, 0, Mu(o, vn(t)) + 1).join("");
              }, g.trimStart = function(e, t, i) {
                if ((e = Me(e)) && (i || t === f)) return e.replace(It, "");
                if (!e || !(t = ur(t))) return e;
                var o = vn(e);
                return Nr(o, Zc(o, vn(t))).join("");
              }, g.truncate = function(e, t) {
                var i = 30, o = "...";
                if (st(t)) {
                  var u = "separator" in t ? t.separator : u;
                  i = "length" in t ? nt(t.length) : i, o = "omission" in t ? ur(t.omission) : o;
                }
                var d = (e = Me(e)).length;
                if (no(e)) {
                  var h = vn(e);
                  d = h.length;
                }
                if (i >= d) return e;
                var S = i - ii(o);
                if (S < 1) return o;
                var T = h ? Nr(h, 0, S).join("") : e.slice(0, S);
                if (u === f) return T + o;
                if (h && (S += T.length - S), Sn(u)) {
                  if (e.slice(S).search(u)) {
                    var I, R = T;
                    for (u.global || (u = Es(u.source, Me(Co.exec(u)) + "g")), u.lastIndex = 0; I = u.exec(R); ) var w = I.index;
                    T = T.slice(0, w === f ? S : w);
                  }
                } else if (e.indexOf(ur(u), S) != S) {
                  var P = T.lastIndexOf(u);
                  P > -1 && (T = T.slice(0, P));
                }
                return T + o;
              }, g.unescape = function(e) {
                return (e = Me(e)) && yo.test(e) ? e.replace(as, ac) : e;
              }, g.uniqueId = function(e) {
                var t = ++eu;
                return Me(e) + t;
              }, g.upperCase = Ka, g.upperFirst = Ja, g.each = _u, g.eachRight = Xu, g.first = Hu, yn(g, (So = {}, wn(g, function(e, t) {
                Fe.call(g.prototype, t) || (So[t] = e);
              }), So), { chain: !1 }), g.VERSION = "4.17.21", Or(["bind", "bindKey", "curry", "curryRight", "partial", "partialRight"], function(e) {
                g[e].placeholder = g;
              }), Or(["drop", "take"], function(e, t) {
                Ae.prototype[e] = function(i) {
                  i = i === f ? 1 : gt(nt(i), 0);
                  var o = this.__filtered__ && !t ? new Ae(this) : this.clone();
                  return o.__filtered__ ? o.__takeCount__ = wt(i, o.__takeCount__) : o.__views__.push({ size: wt(i, te), type: e + (o.__dir__ < 0 ? "Right" : "") }), o;
                }, Ae.prototype[e + "Right"] = function(i) {
                  return this.reverse()[e](i).reverse();
                };
              }), Or(["filter", "map", "takeWhile"], function(e, t) {
                var i = t + 1, o = i == 1 || i == 3;
                Ae.prototype[e] = function(u) {
                  var d = this.clone();
                  return d.__iteratees__.push({ iteratee: He(u, 3), type: i }), d.__filtered__ = d.__filtered__ || o, d;
                };
              }), Or(["head", "last"], function(e, t) {
                var i = "take" + (t ? "Right" : "");
                Ae.prototype[e] = function() {
                  return this[i](1).value()[0];
                };
              }), Or(["initial", "tail"], function(e, t) {
                var i = "drop" + (t ? "" : "Right");
                Ae.prototype[e] = function() {
                  return this.__filtered__ ? new Ae(this) : this[i](1);
                };
              }), Ae.prototype.compact = function() {
                return this.filter(Xn);
              }, Ae.prototype.find = function(e) {
                return this.filter(e).head();
              }, Ae.prototype.findLast = function(e) {
                return this.reverse().find(e);
              }, Ae.prototype.invokeMap = ht(function(e, t) {
                return typeof e == "function" ? new Ae(this) : this.map(function(i) {
                  return Vi(i, e, t);
                });
              }), Ae.prototype.reject = function(e) {
                return this.filter(Bc(He(e)));
              }, Ae.prototype.slice = function(e, t) {
                e = nt(e);
                var i = this;
                return i.__filtered__ && (e > 0 || t < 0) ? new Ae(i) : (e < 0 ? i = i.takeRight(-e) : e && (i = i.drop(e)), t !== f && (i = (t = nt(t)) < 0 ? i.dropRight(-t) : i.take(t - e)), i);
              }, Ae.prototype.takeRightWhile = function(e) {
                return this.reverse().takeWhile(e).reverse();
              }, Ae.prototype.toArray = function() {
                return this.take(te);
              }, wn(Ae.prototype, function(e, t) {
                var i = /^(?:filter|find|map|reject)|While$/.test(t), o = /^(?:head|last)$/.test(t), u = g[o ? "take" + (t == "last" ? "Right" : "") : t], d = o || /^find/.test(t);
                u && (g.prototype[t] = function() {
                  var h = this.__wrapped__, S = o ? [1] : arguments, T = h instanceof Ae, I = S[0], R = T || ut(h), w = function(K) {
                    var Q = u.apply(g, ni([K], S));
                    return o && P ? Q[0] : Q;
                  };
                  R && i && typeof I == "function" && I.length != 1 && (T = R = !1);
                  var P = this.__chain__, B = !!this.__actions__.length, j = d && !P, x = T && !B;
                  if (!d && R) {
                    h = x ? h : new Ae(this);
                    var H = e.apply(h, S);
                    return H.__actions__.push({ func: Dc, args: [w], thisArg: f }), new Qt(H, P);
                  }
                  return j && x ? e.apply(this, S) : (H = this.thru(w), j ? o ? H.value()[0] : H.value() : H);
                });
              }), Or(["pop", "push", "shift", "sort", "splice", "unshift"], function(e) {
                var t = Bi[e], i = /^(?:push|sort|unshift)$/.test(e) ? "tap" : "thru", o = /^(?:pop|shift)$/.test(e);
                g.prototype[e] = function() {
                  var u = arguments;
                  if (o && !this.__chain__) {
                    var d = this.value();
                    return t.apply(ut(d) ? d : [], u);
                  }
                  return this[i](function(h) {
                    return t.apply(ut(h) ? h : [], u);
                  });
                };
              }), wn(Ae.prototype, function(e, t) {
                var i = g[t];
                if (i) {
                  var o = i.name + "";
                  Fe.call($r, o) || ($r[o] = []), $r[o].push({ name: t, func: i });
                }
              }), $r[La(f, 2).name] = [{ name: "wrapper", func: f }], Ae.prototype.clone = function() {
                var e = new Ae(this.__wrapped__);
                return e.__actions__ = lr(this.__actions__), e.__dir__ = this.__dir__, e.__filtered__ = this.__filtered__, e.__iteratees__ = lr(this.__iteratees__), e.__takeCount__ = this.__takeCount__, e.__views__ = lr(this.__views__), e;
              }, Ae.prototype.reverse = function() {
                if (this.__filtered__) {
                  var e = new Ae(this);
                  e.__dir__ = -1, e.__filtered__ = !0;
                } else (e = this.clone()).__dir__ *= -1;
                return e;
              }, Ae.prototype.value = function() {
                var e = this.__wrapped__.value(), t = this.__dir__, i = ut(e), o = t < 0, u = i ? e.length : 0, d = function(oe, ee, fe) {
                  for (var ye = -1, Ce = fe.length; ++ye < Ce; ) {
                    var ve = fe[ye], _e = ve.size;
                    switch (ve.type) {
                      case "drop":
                        oe += _e;
                        break;
                      case "dropRight":
                        ee -= _e;
                        break;
                      case "take":
                        ee = wt(ee, oe + _e);
                        break;
                      case "takeRight":
                        oe = gt(oe, ee - _e);
                    }
                  }
                  return { start: oe, end: ee };
                }(0, u, this.__views__), h = d.start, S = d.end, T = S - h, I = o ? S : h - 1, R = this.__iteratees__, w = R.length, P = 0, B = wt(T, this.__takeCount__);
                if (!i || !o && u == T && B == T) return Wo(e, this.__actions__);
                var j = [];
                e: for (; T-- && P < B; ) {
                  for (var x = -1, H = e[I += t]; ++x < w; ) {
                    var K = R[x], Q = K.iteratee, ie = K.type, ce = Q(H);
                    if (ie == 2) H = ce;
                    else if (!ce) {
                      if (ie == 1) continue e;
                      break e;
                    }
                  }
                  j[P++] = H;
                }
                return j;
              }, g.prototype.at = Nl, g.prototype.chain = function() {
                return Bs(this);
              }, g.prototype.commit = function() {
                return new Qt(this.value(), this.__chain__);
              }, g.prototype.next = function() {
                this.__values__ === f && (this.__values__ = tn(this.value()));
                var e = this.__index__ >= this.__values__.length;
                return { done: e, value: e ? f : this.__values__[this.__index__++] };
              }, g.prototype.plant = function(e) {
                for (var t, i = this; i instanceof si; ) {
                  var o = Wu(i);
                  o.__index__ = 0, o.__values__ = f, t ? u.__wrapped__ = o : t = o;
                  var u = o;
                  i = i.__wrapped__;
                }
                return u.__wrapped__ = e, t;
              }, g.prototype.reverse = function() {
                var e = this.__wrapped__;
                if (e instanceof Ae) {
                  var t = e;
                  return this.__actions__.length && (t = new Ae(this)), (t = t.reverse()).__actions__.push({ func: Dc, args: [Ha], thisArg: f }), new Qt(t, this.__chain__);
                }
                return this.thru(Ha);
              }, g.prototype.toJSON = g.prototype.valueOf = g.prototype.value = function() {
                return Wo(this.__wrapped__, this.__actions__);
              }, g.prototype.first = g.prototype.head, Ui && (g.prototype[Ui] = function() {
                return this;
              }), g;
            }();
            Cn._ = Do, (_ = (function() {
              return Do;
            }).call(E, C, E, y)) === f || (y.exports = _);
          }).call(this);
        }, 815: function(y, E) {
          var C, _, f = this && this.__extends || (C = function(Z, J) {
            return C = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(X, ue) {
              X.__proto__ = ue;
            } || function(X, ue) {
              for (var pe in ue) Object.prototype.hasOwnProperty.call(ue, pe) && (X[pe] = ue[pe]);
            }, C(Z, J);
          }, function(Z, J) {
            if (typeof J != "function" && J !== null) throw new TypeError("Class extends value " + String(J) + " is not a constructor or null");
            function X() {
              this.constructor = Z;
            }
            C(Z, J), Z.prototype = J === null ? Object.create(J) : (X.prototype = J.prototype, new X());
          });
          function b(Z) {
            return 60 * Z * 60;
          }
          function L(Z, J) {
            var X = {};
            return Object.assign(X, Z), J && Object.assign(X, J), X;
          }
          Object.defineProperty(E, "__esModule", { value: !0 }), E.DeviceConfigPropertyHolder = E.DeviceConfigManager = E.DeviceConfigEnv = void 0, function(Z) {
            Z.BETA = "beta", Z.PROD = "prod", Z.CUSTOM = "custom";
          }(_ || (E.DeviceConfigEnv = _ = {}));
          var D = function(Z) {
            function J(X) {
              return Z.call(this, X) || this;
            }
            return f(J, Z), J;
          }(Error), O = "data", N = b(2), G = "base64", $ = function() {
            function Z(J, X) {
              var ue, pe, De, Ie, _t, bn, Jt, Dn;
              if (!X.fileKey) throw new Error("options.fileKey cannot be empty");
              var kn = (ue = X.clock) !== null && ue !== void 0 ? ue : new ge(), Ur = kn.getMillis();
              switch (this.context = J, this.fileKey = X.fileKey, this.env = X.standardEnv, X.standardEnv) {
                case _.BETA:
                  this.fetchServer = "beta.ivs-device-config-beta.live-video.net";
                  break;
                case _.PROD:
                  this.fetchServer = "prod.ivs-device-config.live-video.net";
                  break;
                case _.CUSTOM:
                  if (!X.customServer) throw new Error("Custom env requires options.customServer");
                  this.fetchServer = X.customServer;
                  break;
                default:
                  throw new Error("Invalid value for standardEnv: ".concat(X.standardEnv));
              }
              this.trace = (pe = X.trace) !== null && pe !== void 0 ? pe : new de(X.enableConsoleLog), this.fetch = (De = X.fetch) !== null && De !== void 0 ? De : new ae(J), this.storage = new W("amazon_ivs_device_config_v1_" + X.fileKey, J.localStorage), this.state = new Se(this.storage, "state"), this.refresh = { refreshIntervalSeconds: (Ie = X.refresh.refreshIntervalSeconds) !== null && Ie !== void 0 ? Ie : 900, retryCount: (_t = X.refresh.retryCount) !== null && _t !== void 0 ? _t : 3, retryIntervalSeconds: (bn = X.refresh.retryIntervalSeconds) !== null && bn !== void 0 ? bn : 10, maxCacheAgeSeconds: (Jt = X.refresh.maxCacheAgeSeconds) !== null && Jt !== void 0 ? Jt : 259200, stopRefreshAfterSeconds: (Dn = X.refresh.stopRefreshAfterSeconds) !== null && Dn !== void 0 ? Dn : N, canRefreshNow: X.refresh.canRefreshNow }, this.emitMetrics = X.emitMetrics, this.analyticsProperties = X.analyticsProperties, this.enableConsoleLog = X.enableConsoleLog, this.clock = kn, this.isInitialRefreshDone = !1;
              var Tr = 0, gr = this.state.getState();
              gr && gr.fetchServer === this.fetchServer && gr.lastFetchWhenMs && (Tr = gr.lastFetchWhenMs);
              var $n, jr = kn.getMillis(), Cr = (jr - Tr) / 1e3;
              if (Cr <= this.refresh.maxCacheAgeSeconds) {
                var Ir = this.storage.getJson(O);
                Ir && Ir.fetchServer === this.fetchServer && this.setData(Ir.json);
              }
              this.lastUseMs = jr, Cr >= this.refresh.refreshIntervalSeconds || Tr == 0 ? $n = 0 : ($n = Math.round(this.refresh.refreshIntervalSeconds - Cr), this.isInitialRefreshDone = !0), $n < 5 && ($n = 5), this.trace.onTrace("Will start refresh in " + $n + " seconds"), this.fetchTask = this.context.setTimeout(this.startRefresh.bind(this), 1e3 * $n);
              var qe = kn.getMillis();
              this.initialLoadTime = qe - Ur;
            }
            return Z.getInstance = function(J, X) {
              try {
                if (!(J.fetch && J.setTimeout && J.clearTimeout && J.localStorage)) return void console.log("Context needs to provide fetch, setTimeout, clearTimeout, localStorage");
              } catch (ue) {
                return void console.error("Error checking for context properties " + ue);
              }
              if (this.gInstance) {
                if (this.gInstance.fileKey != X.fileKey) throw new Error("Existing instance has file key ".concat(this.gInstance.fileKey, ", now asking for ").concat(X.fileKey));
                return this.gInstance;
              }
              return this.gInstance = new Z(J, X), this.gInstance;
            }, Z.prototype.getConfigurationHolder = function(J) {
              var X, ue = this.clock.getMillis();
              this.lastUseMs = ue;
              var pe = (X = J.analytics) !== null && X !== void 0 ? X : new Oe(this.enableConsoleLog), De = 0, Ie = this.state.getState();
              return Ie && Ie.fetchServer === this.fetchServer && Ie.lastFetchWhenMs && (De = Ie.lastFetchWhenMs), (ue - De) / 1e3 <= this.refresh.maxCacheAgeSeconds ? new q(pe, this.analyticsProperties, this.properties, De, this.clock) : new q(pe, void 0, void 0, 0, this.clock);
            }, Z.prototype.getFetchUrl = function() {
              var J = "https://".concat(this.fetchServer, "/").concat(this.fileKey, ".json"), X = new URL(J);
              return X.searchParams.set("version", "1.0"), X;
            }, Z.clearInstance = function() {
              var J;
              (J = this.gInstance) === null || J === void 0 || J.clearInstanceImpl(), this.gInstance = void 0;
            }, Z.prototype.clearInstanceImpl = function() {
              this.context.clearTimeout(this.fetchTask), this.fetchTask = void 0, this.context.clearTimeout(this.retryTask), this.retryTask = void 0;
            }, Z.prototype.startRefresh = function() {
              var J = this;
              this.trace.onTrace("Starting refresh request"), this.fetchTask = void 0, this.retryTask && (this.context.clearTimeout(this.retryTask), this.retryTask = void 0), this.fetchTask = this.context.setTimeout(this.startRefresh.bind(this), 1e3 * this.refresh.refreshIntervalSeconds);
              var X = this.clock.getMillis();
              if ((X - this.lastUseMs) / 1e3 > this.refresh.stopRefreshAfterSeconds) this.trace.onTrace("Will not refresh due to refresh timeout");
              else if (!this.isInitialRefreshDone || this.refresh.canRefreshNow()) {
                this.isInitialRefreshDone = !0;
                var ue = {};
                this.fetchData().then(function(pe) {
                  J.processResponse(pe, ue, X), J.emitMetricsImpl(ue);
                }).catch(function(pe) {
                  J.exceptionMetrics(ue, pe), J.emitMetricsImpl(ue), J.trace.onTrace("Fetch error: " + pe), J.refresh.retryCount > 0 && J.scheduleRetry(1);
                });
              } else this.trace.onTrace("Will not refresh due to callback having returned false");
            }, Z.prototype.fetchData = function() {
              var J = this.getFetchUrl(), X = new Headers(), ue = this.state.getState();
              return ue.fetchServer === this.fetchServer && (ue.lastFetchWhenFullMs && this.clock.getMillis() - ue.lastFetchWhenFullMs > 1e3 * b(24) ? this.trace.onTrace("Forcing full refresh") : this.properties && ue.lastFetchEtagHeader && X.set("If-None-Match", ue.lastFetchEtagHeader)), this.fetch.fetchUrl(J, X);
            }, Z.prototype.processResponse = function(J, X, ue) {
              var pe = { fetchServer: this.fetchServer, lastFetchWhenMs: this.clock.getMillis() }, De = J.headers.get("etag");
              if (De && (pe.lastFetchEtagHeader = De), J.status < 300 && J.json) if (this.setData(J.json)) {
                this.trace.onTrace("Successfully parsed fetched data"), this.storage.setJson(O, { fetchServer: this.fetchServer, json: J.json });
                var Ie = this.clock.getMillis();
                pe.lastFetchWhenFullMs = Ie, this.state.setState(pe), X.success_new_data_count = 1, X.fetch_duration_average = Math.max(0, Ie - ue);
              } else X.fail_invalid_data_count = 1;
              else {
                if (J.status !== 304) {
                  var _t = "Unexpected http fetch status: " + J.status;
                  throw this.trace.onTrace(_t), new D(_t);
                }
                this.trace.onTrace("Server said no change in data"), Ie = this.clock.getMillis(), pe.lastFetchWhenMs = Ie, this.state.setState(pe), X.success_no_change_count = 1, X.fetch_duration_average = Math.max(0, Ie - ue);
              }
            }, Z.prototype.scheduleRetry = function(J) {
              var X = this;
              this.retryTask && this.context.clearTimeout(this.retryTask);
              var ue = J * this.refresh.retryIntervalSeconds;
              this.retryTask = this.context.setTimeout(function() {
                X.retryTask = void 0, X.fetchRetry(J);
              }, 1e3 * ue);
            }, Z.prototype.fetchRetry = function(J) {
              var X = this;
              this.trace.onTrace("Starting retry request ".concat(J, "..."));
              var ue = {}, pe = this.clock.getMillis();
              this.fetchData().then(function(De) {
                X.processResponse(De, ue, pe), X.emitMetricsImpl(ue);
              }).catch(function(De) {
                X.exceptionMetrics(ue, De), X.emitMetricsImpl(ue), X.trace.onTrace("Fetch error: " + De), X.refresh.retryCount > J && X.scheduleRetry(J + 1);
              });
            }, Z.prototype.setData = function(J) {
              if (!J) return !1;
              if (J.version !== "1.0") return this.trace.onTrace("Data version is not 1.0, not applying"), !1;
              var X = J.properties;
              if (!X || !Array.isArray(X)) return this.trace.onTrace("Data properties is not an array, not applying"), !1;
              for (var ue = /* @__PURE__ */ new Map(), pe = 0, De = X; pe < De.length; pe++) {
                var Ie = De[pe];
                if (Ie.name && Ie.type && this.isValidValueType(Ie.type)) {
                  if (Ie.value_string && typeof Ie.value_string != "string") {
                    this.trace.onTrace("Invalid type of value.value_string " + typeof Ie.value_string);
                    continue;
                  }
                  if (Ie.value_number && typeof Ie.value_number != "number") {
                    this.trace.onTrace("Invalid type of value.value_number " + typeof Ie.value_number);
                    continue;
                  }
                  if (Ie.value_boolean && typeof Ie.value_boolean != "boolean") {
                    this.trace.onTrace("Invalid type of value.value_boolean " + typeof Ie.value_boolean);
                    continue;
                  }
                  if (Ie.value_json && typeof Ie.value_json != "string") {
                    this.trace.onTrace("Invalid type of value.value_json " + typeof Ie.value_json);
                    continue;
                  }
                  if (Ie.value_analytics && typeof Ie.value_analytics != "string") {
                    this.trace.onTrace("Invalid type of item.value_analytics " + typeof Ie.value_analytics);
                    continue;
                  }
                  var _t = new ke(Ie.name, this.parseValueType(Ie.type), Ie.value_string, Ie.value_number, Ie.value_boolean, Ie.value_json, Ie.value_analytics, Ie.encoding);
                  ue.set(_t.name, _t);
                }
              }
              return ue.size != 0 && (this.properties = ue, !0);
            }, Z.prototype.isValidValueType = function(J) {
              return J === "string" || J === "number" || J === "boolean" || J == "json";
            }, Z.prototype.parseValueType = function(J) {
              switch (J) {
                case "string":
                  return te.STRING;
                case "number":
                  return te.NUMBER;
                case "boolean":
                  return te.BOOLEAN;
                case "json":
                  return te.JSON;
                default:
                  throw new Error("Unsupported value type ".concat(J));
              }
            }, Z.prototype.emitMetricsImpl = function(J) {
              var X, ue, pe, De, Ie, _t, bn = { initial_load_time: this.initialLoadTime, fetch_attempt_count: 1, fetch_duration_average: (X = J.fetch_duration_average) !== null && X !== void 0 ? X : 0, success_no_change_count: (ue = J.success_no_change_count) !== null && ue !== void 0 ? ue : 0, success_new_data_count: (pe = J.success_new_data_count) !== null && pe !== void 0 ? pe : 0, fail_exception_count: (De = J.fail_exception_count) !== null && De !== void 0 ? De : 0, fail_http_error_count: (Ie = J.fail_http_error_count) !== null && Ie !== void 0 ? Ie : 0, fail_invalid_data_count: (_t = J.fail_invalid_data_count) !== null && _t !== void 0 ? _t : 0 };
              this.emitMetrics(L(bn, this.analyticsProperties));
            }, Z.prototype.exceptionMetrics = function(J, X) {
              var ue;
              X instanceof D || !((ue = X == null ? void 0 : X.message) === null || ue === void 0) && ue.startsWith("http error") ? J.fail_http_error_count = 1 : J.fail_exception_count = 1;
            }, Z;
          }();
          E.DeviceConfigManager = $;
          var q = function() {
            function Z(J, X, ue, pe, De) {
              this.analytics = J, this.analyticsProperties = X, this.properties = ue, this.dataFetchedWhenMs = pe, this.clock = De;
            }
            return Z.prototype.getSize = function() {
              return this.properties ? this.properties.size : -1;
            }, Z.prototype.getStringValue = function(J) {
              var X, ue;
              if (this.properties) {
                var pe = this.properties.get(J);
                if (pe) {
                  if (pe.type === te.STRING) {
                    var De = (X = pe.valueString) !== null && X !== void 0 ? X : "";
                    return this.analytics.onValue(L({ key_name: pe.name, value: (ue = pe.valueAnalytics) !== null && ue !== void 0 ? ue : De, fetched_seconds_ago: this.getFetchedSecondsAgo() }, this.analyticsProperties)), De;
                  }
                  this.analytics.onError(L({ key_name: pe.name, message: "Type is not string" }, this.analyticsProperties));
                }
              } else this.analytics.onTrace(L({ key_name: J, message: "Configuration is not available" }, this.analyticsProperties));
            }, Z.prototype.getNumberValue = function(J) {
              var X, ue;
              if (this.properties) {
                var pe = this.properties.get(J);
                if (pe) {
                  if (pe.type === te.NUMBER) {
                    var De = (X = pe.valueNumber) !== null && X !== void 0 ? X : 0;
                    return this.analytics.onValue(L({ key_name: pe.name, value: (ue = pe.valueAnalytics) !== null && ue !== void 0 ? ue : De.toString(), fetched_seconds_ago: this.getFetchedSecondsAgo() }, this.analyticsProperties)), De;
                  }
                  this.analytics.onError(L({ key_name: pe.name, message: "Type is not number" }, this.analyticsProperties));
                }
              } else this.analytics.onTrace(L({ key_name: J, message: "Configuration is not available" }, this.analyticsProperties));
            }, Z.prototype.getBooleanValue = function(J) {
              var X, ue;
              if (this.properties) {
                var pe = this.properties.get(J);
                if (pe) {
                  if (pe.type === te.BOOLEAN) {
                    var De = (X = pe.valueBoolean) !== null && X !== void 0 && X;
                    return this.analytics.onValue(L({ key_name: pe.name, value: (ue = pe.valueAnalytics) !== null && ue !== void 0 ? ue : De.toString(), fetched_seconds_ago: this.getFetchedSecondsAgo() }, this.analyticsProperties)), De;
                  }
                  this.analytics.onError(L({ key_name: pe.name, message: "Type is not number" }, this.analyticsProperties));
                }
              } else this.analytics.onTrace(L({ key_name: J, message: "Configuration is not available" }, this.analyticsProperties));
            }, Z.prototype.getJsonValue = function(J) {
              var X, ue;
              if (this.properties) {
                var pe = this.properties.get(J);
                if (pe) {
                  if (pe.type === te.JSON) {
                    var De = pe.valueJson;
                    if (!De) return this.analytics.onValue(L({ key_name: pe.name, value: (X = pe.valueAnalytics) !== null && X !== void 0 ? X : "", fetched_seconds_ago: this.getFetchedSecondsAgo() }, this.analyticsProperties)), null;
                    try {
                      var Ie = JSON.parse(De);
                      return this.analytics.onValue(L({ key_name: pe.name, value: (ue = pe.valueAnalytics) !== null && ue !== void 0 ? ue : Ie, fetched_seconds_ago: this.getFetchedSecondsAgo() }, this.analyticsProperties)), Ie;
                    } catch {
                      return void this.analytics.onError(L({ key_name: pe.name, message: "JSON parse error" }, this.analyticsProperties));
                    }
                  }
                  this.analytics.onError(L({ key_name: pe.name, message: "Type is not JSON" }, this.analyticsProperties));
                }
              } else this.analytics.onTrace(L({ key_name: J, message: "Configuration is not available" }, this.analyticsProperties));
            }, Z.prototype.getFetchedSecondsAgo = function() {
              if (this.dataFetchedWhenMs) return (this.clock.getMillis() - this.dataFetchedWhenMs) / 1e3;
            }, Z;
          }();
          E.DeviceConfigPropertyHolder = q;
          var te, ae = function() {
            function Z(J) {
              this.context = J;
            }
            return Z.prototype.fetchUrl = function(J, X) {
              var ue = this, pe = { headers: X, cache: "no-store" }, De = null;
              if (typeof AbortController < "u") {
                var Ie = new AbortController();
                De = this.context.setTimeout(function() {
                  return Ie.abort();
                }, 15e3), pe.signal = Ie.signal;
              }
              return new Promise(function(_t, bn) {
                ue.context.fetch(J, pe).then(function(Jt) {
                  if (Jt.status >= 400) bn(new D("http error ".concat(Jt.status, ", ").concat(Jt.statusText)));
                  else {
                    var Dn = { status: Jt.status, headers: Jt.headers };
                    Jt.json().then(function(kn) {
                      Dn.json = kn, _t(Dn);
                    }).catch(function() {
                      _t(Dn);
                    });
                  }
                }).catch(function(Jt) {
                  bn(Jt);
                }).finally(function() {
                  De && ue.context.clearTimeout(De);
                });
              });
            }, Z;
          }(), de = function() {
            function Z(J) {
              this.enableConsoleLog = J;
            }
            return Z.prototype.onTrace = function(J) {
              this.enableConsoleLog && console.log("DeviceConfig trace: " + J);
            }, Z;
          }(), Oe = function() {
            function Z(J) {
              this.enableConsoleLog = J;
            }
            return Z.prototype.onValue = function(J) {
              this.enableConsoleLog && console.log("DeviceConfig analytics value:  ".concat(J));
            }, Z.prototype.onError = function(J) {
              this.enableConsoleLog && console.error("DeviceConfig analytics error: ".concat(J));
            }, Z.prototype.onTrace = function(J) {
              this.enableConsoleLog && console.log("DeviceConfig analytics trace: ".concat(J));
            }, Z;
          }(), W = function() {
            function Z(J, X) {
              this.prefix = J, this.storage = X;
            }
            return Z.prototype.getJson = function(J) {
              var X = this.prefix + "_" + J;
              try {
                var ue = this.storage.getItem(X);
                if (ue) return JSON.parse(ue);
              } catch (pe) {
                console.error("Error getting local storage key ".concat(X) + pe);
              }
              return null;
            }, Z.prototype.setJson = function(J, X) {
              var ue = this.prefix + "_" + J;
              try {
                this.storage.setItem(ue, JSON.stringify(X));
              } catch (pe) {
                console.error("Error setting local storage key ".concat(ue, ": ") + pe);
              }
            }, Z;
          }(), ge = function() {
            function Z() {
            }
            return Z.prototype.getMillis = function() {
              return Date.now();
            }, Z;
          }();
          (function(Z) {
            Z[Z.STRING = 0] = "STRING", Z[Z.NUMBER = 1] = "NUMBER", Z[Z.BOOLEAN = 2] = "BOOLEAN", Z[Z.JSON = 3] = "JSON";
          })(te || (te = {}));
          var ke = function(Z, J, X, ue, pe, De, Ie, _t) {
            switch (this.name = Z, this.type = J, this.valueString = X, this.valueNumber = ue, this.valueBoolean = pe, this.valueJson = De, this.valueAnalytics = Ie, this.type) {
              case te.STRING:
                _t === G && X && (this.valueString = atob(X));
                break;
              case te.JSON:
                _t === G && De && (this.valueJson = atob(De));
            }
          }, Se = function() {
            function Z(J, X) {
              var ue;
              this.storage = J, this.key = X, this.state = (ue = J.getJson(X)) !== null && ue !== void 0 ? ue : {};
            }
            return Z.prototype.getState = function() {
              return this.state;
            }, Z.prototype.setState = function(J) {
              Object.assign(this.state, J), this.storage.setJson(this.key, this.state);
            }, Z;
          }();
        }, 456: function(y, E, C) {
          var _ = this && this.__createBinding || (Object.create ? function(b, L, D, O) {
            O === void 0 && (O = D);
            var N = Object.getOwnPropertyDescriptor(L, D);
            N && !("get" in N ? !L.__esModule : N.writable || N.configurable) || (N = { enumerable: !0, get: function() {
              return L[D];
            } }), Object.defineProperty(b, O, N);
          } : function(b, L, D, O) {
            O === void 0 && (O = D), b[O] = L[D];
          }), f = this && this.__exportStar || function(b, L) {
            for (var D in b) D === "default" || Object.prototype.hasOwnProperty.call(L, D) || _(L, b, D);
          };
          Object.defineProperty(E, "__esModule", { value: !0 }), f(C(903), E);
        }, 903: function(y, E, C) {
          var _ = this && this.__spreadArray || function(L, D, O) {
            if (O || arguments.length === 2) for (var N, G = 0, $ = D.length; G < $; G++) !N && G in D || (N || (N = Array.prototype.slice.call(D, 0, G)), N[G] = D[G]);
            return L.concat(N || Array.prototype.slice.call(D));
          };
          Object.defineProperty(E, "__esModule", { value: !0 }), E.TypedEmitter = void 0;
          var f = C(228), b = function() {
            function L(D) {
              var O = D.propagateErrors;
              this.emitter = new f.EventEmitter(), this.propagateErrors = O != null && O;
            }
            return L.prototype.on = function(D, O) {
              O.call = this.wrapCall(D, O), this.emitter.on(D, O);
            }, L.prototype.off = function(D, O) {
              this.emitter.off(D, O);
            }, L.prototype.emit = function(D) {
              for (var O, N = [], G = 1; G < arguments.length; G++) N[G - 1] = arguments[G];
              (O = this.emitter).emit.apply(O, _([D], N, !1));
            }, L.prototype.removeAllListeners = function() {
              this.emitter.removeAllListeners();
            }, L.prototype.wrapCall = function(D, O) {
              var N = this;
              return function(G) {
                for (var $ = [], q = 1; q < arguments.length; q++) $[q - 1] = arguments[q];
                if (N.propagateErrors) O.apply(G, $);
                else try {
                  O.apply(G, $);
                } catch (de) {
                  var te = "Error in callback for ".concat(D), ae = O.name;
                  return ae && (te += " for function ".concat(ae)), void console.error(te, de);
                }
              };
            }, L;
          }();
          E.TypedEmitter = b;
        }, 987: function(y, E, C) {
          var _, f = this && this.__extends || (_ = function($, q) {
            return _ = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(te, ae) {
              te.__proto__ = ae;
            } || function(te, ae) {
              for (var de in ae) Object.prototype.hasOwnProperty.call(ae, de) && (te[de] = ae[de]);
            }, _($, q);
          }, function($, q) {
            if (typeof q != "function" && q !== null) throw new TypeError("Class extends value " + String(q) + " is not a constructor or null");
            function te() {
              this.constructor = $;
            }
            _($, q), $.prototype = q === null ? Object.create(q) : (te.prototype = q.prototype, new te());
          }), b = this && this.__createBinding || (Object.create ? function($, q, te, ae) {
            ae === void 0 && (ae = te);
            var de = Object.getOwnPropertyDescriptor(q, te);
            de && !("get" in de ? !q.__esModule : de.writable || de.configurable) || (de = { enumerable: !0, get: function() {
              return q[te];
            } }), Object.defineProperty($, ae, de);
          } : function($, q, te, ae) {
            ae === void 0 && (ae = te), $[ae] = q[te];
          }), L = this && this.__setModuleDefault || (Object.create ? function($, q) {
            Object.defineProperty($, "default", { enumerable: !0, value: q });
          } : function($, q) {
            $.default = q;
          }), D = this && this.__importStar || function($) {
            if ($ && $.__esModule) return $;
            var q = {};
            if ($ != null) for (var te in $) te !== "default" && Object.prototype.hasOwnProperty.call($, te) && b(q, $, te);
            return L(q, $), q;
          };
          Object.defineProperty(E, "__esModule", { value: !0 }), E.createFsm = E.FsmWildcardState = E.RejectedTransitionError = E.InvalidStateTransitionError = void 0;
          var O = D(C(293)), N = function($) {
            function q(te, ae) {
              var de = $.call(this, "Invalid transition from '".concat(ae, "' via event '").concat(te, "'")) || this;
              return de.name = "InvalidStateTransitionError", de;
            }
            return f(q, $), q;
          }(Error);
          E.InvalidStateTransitionError = N;
          var G = function($) {
            function q(te, ae, de) {
              var Oe = $.call(this, "Transition from '".concat(ae, "' via event '").concat(te, "' was rejected for: ").concat(de)) || this;
              return Oe.name = "RejectedTransitionError", Oe;
            }
            return f(q, $), q;
          }(Error);
          E.RejectedTransitionError = G, E.FsmWildcardState = "*", E.createFsm = function($) {
            var q, te = $.transitions, ae = $.callbacks, de = $.initialState, Oe = function(W) {
              var ge, ke = (ge = te[W]) === null || ge === void 0 ? void 0 : ge.from;
              return !!ke && (typeof ke == "string" ? ke === E.FsmWildcardState : ke.includes(de));
            };
            return { canTransition: Oe, transition: function(W, ge) {
              var ke, Se, Z, J, X, ue;
              if (!Oe(W)) return O.err(new N(String(de), String(W)));
              var pe = te[W];
              return pe.shouldTransition === void 0 || pe.shouldTransition(de) ? ((Se = (ke = ae == null ? void 0 : ae[de]) === null || ke === void 0 ? void 0 : ke.onExiting) === null || Se === void 0 || Se.call(ke), (Z = ae == null ? void 0 : ae.onStateExiting) === null || Z === void 0 || Z.call(ae, de), q = de, de = pe.to, (X = (J = ae == null ? void 0 : ae[de]) === null || J === void 0 ? void 0 : J.onChanged) === null || X === void 0 || X.call(J, q, ge), (ue = ae == null ? void 0 : ae.onStateChanged) === null || ue === void 0 || ue.call(ae, q, de, ge), O.ok(de)) : O.err(new G(String(de), String(W), "shouldTransition returned false"));
            }, previousState: function() {
              return q;
            }, currentState: function() {
              return de;
            } };
          };
        }, 156: function(y, E, C) {
          var _ = this && this.__createBinding || (Object.create ? function(b, L, D, O) {
            O === void 0 && (O = D);
            var N = Object.getOwnPropertyDescriptor(L, D);
            N && !("get" in N ? !L.__esModule : N.writable || N.configurable) || (N = { enumerable: !0, get: function() {
              return L[D];
            } }), Object.defineProperty(b, O, N);
          } : function(b, L, D, O) {
            O === void 0 && (O = D), b[O] = L[D];
          }), f = this && this.__exportStar || function(b, L) {
            for (var D in b) D === "default" || Object.prototype.hasOwnProperty.call(L, D) || _(L, b, D);
          };
          Object.defineProperty(E, "__esModule", { value: !0 }), E.VERSION = void 0, E.VERSION = "0.5.0", f(C(815), E), f(C(456), E), f(C(987), E), f(C(293), E), f(C(925), E);
        }, 925: function(y, E, C) {
          var _ = this && this.__createBinding || (Object.create ? function(b, L, D, O) {
            O === void 0 && (O = D);
            var N = Object.getOwnPropertyDescriptor(L, D);
            N && !("get" in N ? !L.__esModule : N.writable || N.configurable) || (N = { enumerable: !0, get: function() {
              return L[D];
            } }), Object.defineProperty(b, O, N);
          } : function(b, L, D, O) {
            O === void 0 && (O = D), b[O] = L[D];
          }), f = this && this.__exportStar || function(b, L) {
            for (var D in b) D === "default" || Object.prototype.hasOwnProperty.call(L, D) || _(L, b, D);
          };
          Object.defineProperty(E, "__esModule", { value: !0 }), f(C(166), E), f(C(612), E), f(C(56), E), f(C(139), E), f(C(877), E);
        }, 166: function(y, E, C) {
          var _ = this && this.__assign || function() {
            return _ = Object.assign || function($) {
              for (var q, te = 1, ae = arguments.length; te < ae; te++) for (var de in q = arguments[te]) Object.prototype.hasOwnProperty.call(q, de) && ($[de] = q[de]);
              return $;
            }, _.apply(this, arguments);
          }, f = this && this.__spreadArray || function($, q, te) {
            if (te || arguments.length === 2) for (var ae, de = 0, Oe = q.length; de < Oe; de++) !ae && de in q || (ae || (ae = Array.prototype.slice.call(q, 0, de)), ae[de] = q[de]);
            return $.concat(ae || Array.prototype.slice.call(q));
          };
          Object.defineProperty(E, "__esModule", { value: !0 }), E.getLogConfig = E.setLogConfig = E.setLogConfigByLevel = E.extractLogConfig = void 0;
          var b = C(612), L = C(56), D = C(139), O = C(478), N = { enabled: !1, levels: { debug: !0, log: !0, info: !0, warn: !0, error: !0 }, targets: [(0, L.createConsoleLogTarget)()], categories: {} }, G = Object.keys(N);
          E.extractLogConfig = function($) {
            var q = {};
            if (Object.keys($).some(function(W) {
              return G.includes(W);
            })) {
              for (var te = 0, ae = G; te < ae.length; te++) {
                var de = ae[te];
                if ($[de] !== void 0) {
                  var Oe = $[de];
                  q[de] = Oe;
                }
              }
              return q;
            }
          }, E.setLogConfigByLevel = function($) {
            var q = $.enabled || N.enabled, te = $.targets || N.targets, ae = { debug: !1, log: !1, info: !1, warn: !1, error: !1 }, de = function(Oe, W) {
              for (var ge = 0, ke = Oe; ge < ke.length; ge++) {
                var Se = ke[ge];
                ae[Se] = W;
              }
            };
            switch ($.level) {
              case "debug":
                de(["debug", "log", "info", "warn", "error"], q);
                break;
              case "log":
                de(["log", "info", "warn", "error"], q);
                break;
              case "info":
                de(["info", "warn", "error"], !0);
                break;
              case "warn":
                de(["warn", "error"], !0);
                break;
              case "error":
                de(["error"], !0);
            }
            (0, E.setLogConfig)({ enabled: q, levels: ae, targets: te });
          }, E.setLogConfig = function($) {
            var q = (0, O.mergeConfigs)(N, $);
            q && (N = q, b.defaultLogEmitter.emit(D.LogEventType.CONFIG_UPDATED, N));
          }, E.getLogConfig = function() {
            return { enabled: N.enabled, levels: _({}, N.levels), targets: f([], N.targets, !0), categories: _({}, N.categories) };
          };
        }, 612: (y, E, C) => {
          Object.defineProperty(E, "__esModule", { value: !0 }), E.defaultLogEmitter = void 0;
          var _ = C(456);
          E.defaultLogEmitter = new _.TypedEmitter({});
        }, 56: function(y, E, C) {
          var _ = this && this.__spreadArray || function(b, L, D) {
            if (D || arguments.length === 2) for (var O, N = 0, G = L.length; N < G; N++) !O && N in L || (O || (O = Array.prototype.slice.call(L, 0, N)), O[N] = L[N]);
            return b.concat(O || Array.prototype.slice.call(L));
          };
          Object.defineProperty(E, "__esModule", { value: !0 }), E.createEventLogTarget = E.createConsoleLogTarget = void 0;
          var f = C(139);
          E.createConsoleLogTarget = function() {
            return { handleMessage: function(b) {
              for (var L = [], D = 1; D < arguments.length; D++) L[D - 1] = arguments[D];
              console[b].apply(console, L);
            } };
          }, E.createEventLogTarget = function(b) {
            return { handleMessage: function(L) {
              for (var D = [], O = 1; O < arguments.length; O++) D[O - 1] = arguments[O];
              b.emit.apply(b, _([f.LogEventType.MESSAGE_LOGGED, L], D, !1));
            } };
          };
        }, 139: (y, E) => {
          var C;
          Object.defineProperty(E, "__esModule", { value: !0 }), E.LogEventType = void 0, function(_) {
            _.CONFIG_UPDATED = "logConfigUpdated", _.MESSAGE_LOGGED = "messageLogged";
          }(C || (E.LogEventType = C = {}));
        }, 877: function(y, E, C) {
          var _ = this && this.__assign || function() {
            return _ = Object.assign || function(G) {
              for (var $, q = 1, te = arguments.length; q < te; q++) for (var ae in $ = arguments[q]) Object.prototype.hasOwnProperty.call($, ae) && (G[ae] = $[ae]);
              return G;
            }, _.apply(this, arguments);
          }, f = this && this.__spreadArray || function(G, $, q) {
            if (q || arguments.length === 2) for (var te, ae = 0, de = $.length; ae < de; ae++) !te && ae in $ || (te || (te = Array.prototype.slice.call($, 0, ae)), te[ae] = $[ae]);
            return G.concat(te || Array.prototype.slice.call($));
          };
          Object.defineProperty(E, "__esModule", { value: !0 }), E.createLogger = void 0;
          var b = C(478), L = C(166), D = C(612), O = C(139), N = function(G, $) {
            return (0, b.mergeConfigs)(G, $) || G;
          };
          E.createLogger = function(G) {
            var $ = G.name, q = G.category, te = G.parent, ae = (0, L.extractLogConfig)(G) || {}, de = N((0, L.getLogConfig)(), ae);
            D.defaultLogEmitter.on(O.LogEventType.CONFIG_UPDATED, function(Se) {
              de = N(Se, ae || {});
            });
            var Oe = function(Se) {
              for (var Z = [], J = 1; J < arguments.length; J++) Z[J - 1] = arguments[J];
              if (te && !te.canLog(Se) || !ge(Se)) return !1;
              for (var X = W(), ue = (/* @__PURE__ */ new Date()).toTimeString().split(" ")[0], pe = f(["".concat(ue, " - (").concat(X, ")")], Z, !0), De = 0, Ie = de.targets; De < Ie.length; De++) {
                var _t = Ie[De];
                _t.handleMessage.apply(_t, f([Se], pe, !1));
              }
              return !0;
            }, W = function() {
              return te ? "".concat(te.getName(), " | ").concat($) : $;
            }, ge = function(Se) {
              return !(!de.enabled || !de.levels[Se] || de.targets.length === 0 || q !== void 0 && !de.categories[q]);
            }, ke = { debug: function() {
              for (var Se = [], Z = 0; Z < arguments.length; Z++) Se[Z] = arguments[Z];
              return Oe.apply(void 0, f(["debug"], Se, !1));
            }, log: function() {
              for (var Se = [], Z = 0; Z < arguments.length; Z++) Se[Z] = arguments[Z];
              return Oe.apply(void 0, f(["log"], Se, !1));
            }, info: function() {
              for (var Se = [], Z = 0; Z < arguments.length; Z++) Se[Z] = arguments[Z];
              return Oe.apply(void 0, f(["info"], Se, !1));
            }, warn: function() {
              for (var Se = [], Z = 0; Z < arguments.length; Z++) Se[Z] = arguments[Z];
              return Oe.apply(void 0, f(["warn"], Se, !1));
            }, error: function() {
              for (var Se = [], Z = 0; Z < arguments.length; Z++) Se[Z] = arguments[Z];
              return Oe.apply(void 0, f(["error"], Se, !1));
            }, getName: W, canLog: ge, getChildLogger: function(Se) {
              return (0, E.createLogger)(_(_({}, Se), { parent: ke }));
            }, setConfig: function(Se) {
              de = N(de, ae = Se);
            } };
            return ke;
          };
        }, 478: function(y, E, C) {
          var _ = this && this.__spreadArray || function(L, D, O) {
            if (O || arguments.length === 2) for (var N, G = 0, $ = D.length; G < $; G++) !N && G in D || (N || (N = Array.prototype.slice.call(D, 0, G)), N[G] = D[G]);
            return L.concat(N || Array.prototype.slice.call(D));
          };
          Object.defineProperty(E, "__esModule", { value: !0 }), E.mergeConfigs = void 0;
          var f = C(543), b = function(L, D) {
            if ((0, f.isArray)(L)) return D;
          };
          E.mergeConfigs = function(L) {
            for (var D = [], O = 1; O < arguments.length; O++) D[O - 1] = arguments[O];
            var N = D.map(function(G) {
              return G == null || typeof G != "object";
            }).filter(Boolean).length > 0;
            if (typeof L == "object" && !N) return f.mergeWith.apply(void 0, _(_([{}, L], D, !1), [b], !1));
          };
        }, 293: (y, E) => {
          Object.defineProperty(E, "__esModule", { value: !0 }), E.getErr = E.getOk_or = E.getOk = E.isNotOk = E.isOk = E.err = E.ok = void 0, E.ok = function(C) {
            return { ok: !0, value: C };
          }, E.err = function(C) {
            return { ok: !1, error: C };
          }, E.isOk = function(C) {
            return C.ok === !0;
          }, E.isNotOk = function(C) {
            return !(0, E.isOk)(C);
          }, E.getOk = function(C) {
            return C.ok === !0 ? C.value : void 0;
          }, E.getOk_or = function(C, _) {
            return C.ok === !0 ? C.value : _;
          }, E.getErr = function(C) {
            return C.ok === !0 ? void 0 : C.error;
          };
        } }, v = {};
        function m(y) {
          var E = v[y];
          if (E !== void 0) return E.exports;
          var C = v[y] = { id: y, loaded: !1, exports: {} };
          return p[y].call(C.exports, C, C.exports, m), C.loaded = !0, C.exports;
        }
        return m.g = function() {
          if (typeof globalThis == "object") return globalThis;
          try {
            return this || new Function("return this")();
          } catch {
            if (typeof window == "object") return window;
          }
        }(), m.nmd = (y) => (y.paths = [], y.children || (y.children = []), y), m(156);
      })(), k.exports = A();
    }, 1549: (k, A, p) => {
      var v = p(2032), m = p(3862), y = p(6721), E = p(2749), C = p(5749);
      function _(f) {
        var b = -1, L = f == null ? 0 : f.length;
        for (this.clear(); ++b < L; ) {
          var D = f[b];
          this.set(D[0], D[1]);
        }
      }
      _.prototype.clear = v, _.prototype.delete = m, _.prototype.get = y, _.prototype.has = E, _.prototype.set = C, k.exports = _;
    }, 79: (k, A, p) => {
      var v = p(3702), m = p(80), y = p(4739), E = p(8655), C = p(1175);
      function _(f) {
        var b = -1, L = f == null ? 0 : f.length;
        for (this.clear(); ++b < L; ) {
          var D = f[b];
          this.set(D[0], D[1]);
        }
      }
      _.prototype.clear = v, _.prototype.delete = m, _.prototype.get = y, _.prototype.has = E, _.prototype.set = C, k.exports = _;
    }, 8223: (k, A, p) => {
      var v = p(6110)(p(9325), "Map");
      k.exports = v;
    }, 3661: (k, A, p) => {
      var v = p(3040), m = p(7670), y = p(289), E = p(4509), C = p(2949);
      function _(f) {
        var b = -1, L = f == null ? 0 : f.length;
        for (this.clear(); ++b < L; ) {
          var D = f[b];
          this.set(D[0], D[1]);
        }
      }
      _.prototype.clear = v, _.prototype.delete = m, _.prototype.get = y, _.prototype.has = E, _.prototype.set = C, k.exports = _;
    }, 7217: (k, A, p) => {
      var v = p(79), m = p(1420), y = p(938), E = p(3605), C = p(9817), _ = p(945);
      function f(b) {
        var L = this.__data__ = new v(b);
        this.size = L.size;
      }
      f.prototype.clear = m, f.prototype.delete = y, f.prototype.get = E, f.prototype.has = C, f.prototype.set = _, k.exports = f;
    }, 1873: (k, A, p) => {
      var v = p(9325).Symbol;
      k.exports = v;
    }, 7828: (k, A, p) => {
      var v = p(9325).Uint8Array;
      k.exports = v;
    }, 1033: (k) => {
      k.exports = function(A, p, v) {
        switch (v.length) {
          case 0:
            return A.call(p);
          case 1:
            return A.call(p, v[0]);
          case 2:
            return A.call(p, v[0], v[1]);
          case 3:
            return A.call(p, v[0], v[1], v[2]);
        }
        return A.apply(p, v);
      };
    }, 695: (k, A, p) => {
      var v = p(8096), m = p(2428), y = p(6449), E = p(3656), C = p(361), _ = p(7167), f = Object.prototype.hasOwnProperty;
      k.exports = function(b, L) {
        var D = y(b), O = !D && m(b), N = !D && !O && E(b), G = !D && !O && !N && _(b), $ = D || O || N || G, q = $ ? v(b.length, String) : [], te = q.length;
        for (var ae in b) !L && !f.call(b, ae) || $ && (ae == "length" || N && (ae == "offset" || ae == "parent") || G && (ae == "buffer" || ae == "byteLength" || ae == "byteOffset") || C(ae, te)) || q.push(ae);
        return q;
      };
    }, 7805: (k, A, p) => {
      var v = p(3360), m = p(5288);
      k.exports = function(y, E, C) {
        (C !== void 0 && !m(y[E], C) || C === void 0 && !(E in y)) && v(y, E, C);
      };
    }, 6547: (k, A, p) => {
      var v = p(3360), m = p(5288), y = Object.prototype.hasOwnProperty;
      k.exports = function(E, C, _) {
        var f = E[C];
        y.call(E, C) && m(f, _) && (_ !== void 0 || C in E) || v(E, C, _);
      };
    }, 6025: (k, A, p) => {
      var v = p(5288);
      k.exports = function(m, y) {
        for (var E = m.length; E--; ) if (v(m[E][0], y)) return E;
        return -1;
      };
    }, 3360: (k, A, p) => {
      var v = p(3243);
      k.exports = function(m, y, E) {
        y == "__proto__" && v ? v(m, y, { configurable: !0, enumerable: !0, value: E, writable: !0 }) : m[y] = E;
      };
    }, 9344: (k, A, p) => {
      var v = p(3805), m = Object.create, y = /* @__PURE__ */ function() {
        function E() {
        }
        return function(C) {
          if (!v(C)) return {};
          if (m) return m(C);
          E.prototype = C;
          var _ = new E();
          return E.prototype = void 0, _;
        };
      }();
      k.exports = y;
    }, 6649: (k, A, p) => {
      var v = p(3221)();
      k.exports = v;
    }, 2552: (k, A, p) => {
      var v = p(1873), m = p(659), y = p(9350), E = v ? v.toStringTag : void 0;
      k.exports = function(C) {
        return C == null ? C === void 0 ? "[object Undefined]" : "[object Null]" : E && E in Object(C) ? m(C) : y(C);
      };
    }, 7534: (k, A, p) => {
      var v = p(2552), m = p(346);
      k.exports = function(y) {
        return m(y) && v(y) == "[object Arguments]";
      };
    }, 5083: (k, A, p) => {
      var v = p(1882), m = p(7296), y = p(3805), E = p(7473), C = /^\[object .+?Constructor\]$/, _ = Function.prototype, f = Object.prototype, b = _.toString, L = f.hasOwnProperty, D = RegExp("^" + b.call(L).replace(/[\\^$.*+?()[\]{}|]/g, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$");
      k.exports = function(O) {
        return !(!y(O) || m(O)) && (v(O) ? D : C).test(E(O));
      };
    }, 4901: (k, A, p) => {
      var v = p(2552), m = p(294), y = p(346), E = {};
      E["[object Float32Array]"] = E["[object Float64Array]"] = E["[object Int8Array]"] = E["[object Int16Array]"] = E["[object Int32Array]"] = E["[object Uint8Array]"] = E["[object Uint8ClampedArray]"] = E["[object Uint16Array]"] = E["[object Uint32Array]"] = !0, E["[object Arguments]"] = E["[object Array]"] = E["[object ArrayBuffer]"] = E["[object Boolean]"] = E["[object DataView]"] = E["[object Date]"] = E["[object Error]"] = E["[object Function]"] = E["[object Map]"] = E["[object Number]"] = E["[object Object]"] = E["[object RegExp]"] = E["[object Set]"] = E["[object String]"] = E["[object WeakMap]"] = !1, k.exports = function(C) {
        return y(C) && m(C.length) && !!E[v(C)];
      };
    }, 2903: (k, A, p) => {
      var v = p(3805), m = p(5527), y = p(181), E = Object.prototype.hasOwnProperty;
      k.exports = function(C) {
        if (!v(C)) return y(C);
        var _ = m(C), f = [];
        for (var b in C) (b != "constructor" || !_ && E.call(C, b)) && f.push(b);
        return f;
      };
    }, 5250: (k, A, p) => {
      var v = p(7217), m = p(7805), y = p(6649), E = p(2824), C = p(3805), _ = p(7241), f = p(4974);
      k.exports = function b(L, D, O, N, G) {
        L !== D && y(D, function($, q) {
          if (G || (G = new v()), C($)) E(L, D, q, O, b, N, G);
          else {
            var te = N ? N(f(L, q), $, q + "", L, D, G) : void 0;
            te === void 0 && (te = $), m(L, q, te);
          }
        }, _);
      };
    }, 2824: (k, A, p) => {
      var v = p(7805), m = p(3290), y = p(1961), E = p(3007), C = p(5529), _ = p(2428), f = p(6449), b = p(3693), L = p(3656), D = p(1882), O = p(3805), N = p(1331), G = p(7167), $ = p(4974), q = p(9884);
      k.exports = function(te, ae, de, Oe, W, ge, ke) {
        var Se = $(te, de), Z = $(ae, de), J = ke.get(Z);
        if (J) v(te, de, J);
        else {
          var X = ge ? ge(Se, Z, de + "", te, ae, ke) : void 0, ue = X === void 0;
          if (ue) {
            var pe = f(Z), De = !pe && L(Z), Ie = !pe && !De && G(Z);
            X = Z, pe || De || Ie ? f(Se) ? X = Se : b(Se) ? X = E(Se) : De ? (ue = !1, X = m(Z, !0)) : Ie ? (ue = !1, X = y(Z, !0)) : X = [] : N(Z) || _(Z) ? (X = Se, _(Se) ? X = q(Se) : O(Se) && !D(Se) || (X = C(Z))) : ue = !1;
          }
          ue && (ke.set(Z, X), W(X, Z, Oe, ge, ke), ke.delete(Z)), v(te, de, X);
        }
      };
    }, 9302: (k, A, p) => {
      var v = p(3488), m = p(6757), y = p(2865);
      k.exports = function(E, C) {
        return y(m(E, C, v), E + "");
      };
    }, 9570: (k, A, p) => {
      var v = p(7334), m = p(3243), y = p(3488), E = m ? function(C, _) {
        return m(C, "toString", { configurable: !0, enumerable: !1, value: v(_), writable: !0 });
      } : y;
      k.exports = E;
    }, 8096: (k) => {
      k.exports = function(A, p) {
        for (var v = -1, m = Array(A); ++v < A; ) m[v] = p(v);
        return m;
      };
    }, 7301: (k) => {
      k.exports = function(A) {
        return function(p) {
          return A(p);
        };
      };
    }, 9653: (k, A, p) => {
      var v = p(7828);
      k.exports = function(m) {
        var y = new m.constructor(m.byteLength);
        return new v(y).set(new v(m)), y;
      };
    }, 3290: (k, A, p) => {
      k = p.nmd(k);
      var v = p(9325), m = A && !A.nodeType && A, y = m && k && !k.nodeType && k, E = y && y.exports === m ? v.Buffer : void 0, C = E ? E.allocUnsafe : void 0;
      k.exports = function(_, f) {
        if (f) return _.slice();
        var b = _.length, L = C ? C(b) : new _.constructor(b);
        return _.copy(L), L;
      };
    }, 1961: (k, A, p) => {
      var v = p(9653);
      k.exports = function(m, y) {
        var E = y ? v(m.buffer) : m.buffer;
        return new m.constructor(E, m.byteOffset, m.length);
      };
    }, 3007: (k) => {
      k.exports = function(A, p) {
        var v = -1, m = A.length;
        for (p || (p = Array(m)); ++v < m; ) p[v] = A[v];
        return p;
      };
    }, 1791: (k, A, p) => {
      var v = p(6547), m = p(3360);
      k.exports = function(y, E, C, _) {
        var f = !C;
        C || (C = {});
        for (var b = -1, L = E.length; ++b < L; ) {
          var D = E[b], O = _ ? _(C[D], y[D], D, C, y) : void 0;
          O === void 0 && (O = y[D]), f ? m(C, D, O) : v(C, D, O);
        }
        return C;
      };
    }, 5481: (k, A, p) => {
      var v = p(9325)["__core-js_shared__"];
      k.exports = v;
    }, 999: (k, A, p) => {
      var v = p(9302), m = p(6800);
      k.exports = function(y) {
        return v(function(E, C) {
          var _ = -1, f = C.length, b = f > 1 ? C[f - 1] : void 0, L = f > 2 ? C[2] : void 0;
          for (b = y.length > 3 && typeof b == "function" ? (f--, b) : void 0, L && m(C[0], C[1], L) && (b = f < 3 ? void 0 : b, f = 1), E = Object(E); ++_ < f; ) {
            var D = C[_];
            D && y(E, D, _, b);
          }
          return E;
        });
      };
    }, 3221: (k) => {
      k.exports = function(A) {
        return function(p, v, m) {
          for (var y = -1, E = Object(p), C = m(p), _ = C.length; _--; ) {
            var f = C[A ? _ : ++y];
            if (v(E[f], f, E) === !1) break;
          }
          return p;
        };
      };
    }, 3243: (k, A, p) => {
      var v = p(6110), m = function() {
        try {
          var y = v(Object, "defineProperty");
          return y({}, "", {}), y;
        } catch {
        }
      }();
      k.exports = m;
    }, 4840: (k, A, p) => {
      var v = typeof p.g == "object" && p.g && p.g.Object === Object && p.g;
      k.exports = v;
    }, 2651: (k, A, p) => {
      var v = p(4218);
      k.exports = function(m, y) {
        var E = m.__data__;
        return v(y) ? E[typeof y == "string" ? "string" : "hash"] : E.map;
      };
    }, 6110: (k, A, p) => {
      var v = p(5083), m = p(392);
      k.exports = function(y, E) {
        var C = m(y, E);
        return v(C) ? C : void 0;
      };
    }, 8879: (k, A, p) => {
      var v = p(4335)(Object.getPrototypeOf, Object);
      k.exports = v;
    }, 659: (k, A, p) => {
      var v = p(1873), m = Object.prototype, y = m.hasOwnProperty, E = m.toString, C = v ? v.toStringTag : void 0;
      k.exports = function(_) {
        var f = y.call(_, C), b = _[C];
        try {
          _[C] = void 0;
          var L = !0;
        } catch {
        }
        var D = E.call(_);
        return L && (f ? _[C] = b : delete _[C]), D;
      };
    }, 392: (k) => {
      k.exports = function(A, p) {
        return A == null ? void 0 : A[p];
      };
    }, 2032: (k, A, p) => {
      var v = p(1042);
      k.exports = function() {
        this.__data__ = v ? v(null) : {}, this.size = 0;
      };
    }, 3862: (k) => {
      k.exports = function(A) {
        var p = this.has(A) && delete this.__data__[A];
        return this.size -= p ? 1 : 0, p;
      };
    }, 6721: (k, A, p) => {
      var v = p(1042), m = Object.prototype.hasOwnProperty;
      k.exports = function(y) {
        var E = this.__data__;
        if (v) {
          var C = E[y];
          return C === "__lodash_hash_undefined__" ? void 0 : C;
        }
        return m.call(E, y) ? E[y] : void 0;
      };
    }, 2749: (k, A, p) => {
      var v = p(1042), m = Object.prototype.hasOwnProperty;
      k.exports = function(y) {
        var E = this.__data__;
        return v ? E[y] !== void 0 : m.call(E, y);
      };
    }, 5749: (k, A, p) => {
      var v = p(1042);
      k.exports = function(m, y) {
        var E = this.__data__;
        return this.size += this.has(m) ? 0 : 1, E[m] = v && y === void 0 ? "__lodash_hash_undefined__" : y, this;
      };
    }, 5529: (k, A, p) => {
      var v = p(9344), m = p(8879), y = p(5527);
      k.exports = function(E) {
        return typeof E.constructor != "function" || y(E) ? {} : v(m(E));
      };
    }, 361: (k) => {
      var A = /^(?:0|[1-9]\d*)$/;
      k.exports = function(p, v) {
        var m = typeof p;
        return !!(v = v ?? 9007199254740991) && (m == "number" || m != "symbol" && A.test(p)) && p > -1 && p % 1 == 0 && p < v;
      };
    }, 6800: (k, A, p) => {
      var v = p(5288), m = p(4894), y = p(361), E = p(3805);
      k.exports = function(C, _, f) {
        if (!E(f)) return !1;
        var b = typeof _;
        return !!(b == "number" ? m(f) && y(_, f.length) : b == "string" && _ in f) && v(f[_], C);
      };
    }, 4218: (k) => {
      k.exports = function(A) {
        var p = typeof A;
        return p == "string" || p == "number" || p == "symbol" || p == "boolean" ? A !== "__proto__" : A === null;
      };
    }, 7296: (k, A, p) => {
      var v, m = p(5481), y = (v = /[^.]+$/.exec(m && m.keys && m.keys.IE_PROTO || "")) ? "Symbol(src)_1." + v : "";
      k.exports = function(E) {
        return !!y && y in E;
      };
    }, 5527: (k) => {
      var A = Object.prototype;
      k.exports = function(p) {
        var v = p && p.constructor;
        return p === (typeof v == "function" && v.prototype || A);
      };
    }, 3702: (k) => {
      k.exports = function() {
        this.__data__ = [], this.size = 0;
      };
    }, 80: (k, A, p) => {
      var v = p(6025), m = Array.prototype.splice;
      k.exports = function(y) {
        var E = this.__data__, C = v(E, y);
        return !(C < 0) && (C == E.length - 1 ? E.pop() : m.call(E, C, 1), --this.size, !0);
      };
    }, 4739: (k, A, p) => {
      var v = p(6025);
      k.exports = function(m) {
        var y = this.__data__, E = v(y, m);
        return E < 0 ? void 0 : y[E][1];
      };
    }, 8655: (k, A, p) => {
      var v = p(6025);
      k.exports = function(m) {
        return v(this.__data__, m) > -1;
      };
    }, 1175: (k, A, p) => {
      var v = p(6025);
      k.exports = function(m, y) {
        var E = this.__data__, C = v(E, m);
        return C < 0 ? (++this.size, E.push([m, y])) : E[C][1] = y, this;
      };
    }, 3040: (k, A, p) => {
      var v = p(1549), m = p(79), y = p(8223);
      k.exports = function() {
        this.size = 0, this.__data__ = { hash: new v(), map: new (y || m)(), string: new v() };
      };
    }, 7670: (k, A, p) => {
      var v = p(2651);
      k.exports = function(m) {
        var y = v(this, m).delete(m);
        return this.size -= y ? 1 : 0, y;
      };
    }, 289: (k, A, p) => {
      var v = p(2651);
      k.exports = function(m) {
        return v(this, m).get(m);
      };
    }, 4509: (k, A, p) => {
      var v = p(2651);
      k.exports = function(m) {
        return v(this, m).has(m);
      };
    }, 2949: (k, A, p) => {
      var v = p(2651);
      k.exports = function(m, y) {
        var E = v(this, m), C = E.size;
        return E.set(m, y), this.size += E.size == C ? 0 : 1, this;
      };
    }, 1042: (k, A, p) => {
      var v = p(6110)(Object, "create");
      k.exports = v;
    }, 181: (k) => {
      k.exports = function(A) {
        var p = [];
        if (A != null) for (var v in Object(A)) p.push(v);
        return p;
      };
    }, 6009: (k, A, p) => {
      k = p.nmd(k);
      var v = p(4840), m = A && !A.nodeType && A, y = m && k && !k.nodeType && k, E = y && y.exports === m && v.process, C = function() {
        try {
          var _ = y && y.require && y.require("util").types;
          return _ || E && E.binding && E.binding("util");
        } catch {
        }
      }();
      k.exports = C;
    }, 9350: (k) => {
      var A = Object.prototype.toString;
      k.exports = function(p) {
        return A.call(p);
      };
    }, 4335: (k) => {
      k.exports = function(A, p) {
        return function(v) {
          return A(p(v));
        };
      };
    }, 6757: (k, A, p) => {
      var v = p(1033), m = Math.max;
      k.exports = function(y, E, C) {
        return E = m(E === void 0 ? y.length - 1 : E, 0), function() {
          for (var _ = arguments, f = -1, b = m(_.length - E, 0), L = Array(b); ++f < b; ) L[f] = _[E + f];
          f = -1;
          for (var D = Array(E + 1); ++f < E; ) D[f] = _[f];
          return D[E] = C(L), v(y, this, D);
        };
      };
    }, 9325: (k, A, p) => {
      var v = p(4840), m = typeof self == "object" && self && self.Object === Object && self, y = v || m || Function("return this")();
      k.exports = y;
    }, 4974: (k) => {
      k.exports = function(A, p) {
        if ((p !== "constructor" || typeof A[p] != "function") && p != "__proto__") return A[p];
      };
    }, 2865: (k, A, p) => {
      var v = p(9570), m = p(1811)(v);
      k.exports = m;
    }, 1811: (k) => {
      var A = Date.now;
      k.exports = function(p) {
        var v = 0, m = 0;
        return function() {
          var y = A(), E = 16 - (y - m);
          if (m = y, E > 0) {
            if (++v >= 800) return arguments[0];
          } else v = 0;
          return p.apply(void 0, arguments);
        };
      };
    }, 1420: (k, A, p) => {
      var v = p(79);
      k.exports = function() {
        this.__data__ = new v(), this.size = 0;
      };
    }, 938: (k) => {
      k.exports = function(A) {
        var p = this.__data__, v = p.delete(A);
        return this.size = p.size, v;
      };
    }, 3605: (k) => {
      k.exports = function(A) {
        return this.__data__.get(A);
      };
    }, 9817: (k) => {
      k.exports = function(A) {
        return this.__data__.has(A);
      };
    }, 945: (k, A, p) => {
      var v = p(79), m = p(8223), y = p(3661);
      k.exports = function(E, C) {
        var _ = this.__data__;
        if (_ instanceof v) {
          var f = _.__data__;
          if (!m || f.length < 199) return f.push([E, C]), this.size = ++_.size, this;
          _ = this.__data__ = new y(f);
        }
        return _.set(E, C), this.size = _.size, this;
      };
    }, 7473: (k) => {
      var A = Function.prototype.toString;
      k.exports = function(p) {
        if (p != null) {
          try {
            return A.call(p);
          } catch {
          }
          try {
            return p + "";
          } catch {
          }
        }
        return "";
      };
    }, 7334: (k) => {
      k.exports = function(A) {
        return function() {
          return A;
        };
      };
    }, 5288: (k) => {
      k.exports = function(A, p) {
        return A === p || A != A && p != p;
      };
    }, 3488: (k) => {
      k.exports = function(A) {
        return A;
      };
    }, 2428: (k, A, p) => {
      var v = p(7534), m = p(346), y = Object.prototype, E = y.hasOwnProperty, C = y.propertyIsEnumerable, _ = v(/* @__PURE__ */ function() {
        return arguments;
      }()) ? v : function(f) {
        return m(f) && E.call(f, "callee") && !C.call(f, "callee");
      };
      k.exports = _;
    }, 6449: (k) => {
      var A = Array.isArray;
      k.exports = A;
    }, 4894: (k, A, p) => {
      var v = p(1882), m = p(294);
      k.exports = function(y) {
        return y != null && m(y.length) && !v(y);
      };
    }, 3693: (k, A, p) => {
      var v = p(4894), m = p(346);
      k.exports = function(y) {
        return m(y) && v(y);
      };
    }, 3656: (k, A, p) => {
      k = p.nmd(k);
      var v = p(9325), m = p(9935), y = A && !A.nodeType && A, E = y && k && !k.nodeType && k, C = E && E.exports === y ? v.Buffer : void 0, _ = (C ? C.isBuffer : void 0) || m;
      k.exports = _;
    }, 1882: (k, A, p) => {
      var v = p(2552), m = p(3805);
      k.exports = function(y) {
        if (!m(y)) return !1;
        var E = v(y);
        return E == "[object Function]" || E == "[object GeneratorFunction]" || E == "[object AsyncFunction]" || E == "[object Proxy]";
      };
    }, 294: (k) => {
      k.exports = function(A) {
        return typeof A == "number" && A > -1 && A % 1 == 0 && A <= 9007199254740991;
      };
    }, 3805: (k) => {
      k.exports = function(A) {
        var p = typeof A;
        return A != null && (p == "object" || p == "function");
      };
    }, 346: (k) => {
      k.exports = function(A) {
        return A != null && typeof A == "object";
      };
    }, 1331: (k, A, p) => {
      var v = p(2552), m = p(8879), y = p(346), E = Function.prototype, C = Object.prototype, _ = E.toString, f = C.hasOwnProperty, b = _.call(Object);
      k.exports = function(L) {
        if (!y(L) || v(L) != "[object Object]") return !1;
        var D = m(L);
        if (D === null) return !0;
        var O = f.call(D, "constructor") && D.constructor;
        return typeof O == "function" && O instanceof O && _.call(O) == b;
      };
    }, 7167: (k, A, p) => {
      var v = p(4901), m = p(7301), y = p(6009), E = y && y.isTypedArray, C = E ? m(E) : v;
      k.exports = C;
    }, 7241: (k, A, p) => {
      var v = p(695), m = p(2903), y = p(4894);
      k.exports = function(E) {
        return y(E) ? v(E, !0) : m(E);
      };
    }, 2543: function(k, A, p) {
      var v;
      k = p.nmd(k), (function() {
        var m, y = "Expected a function", E = "__lodash_hash_undefined__", C = "__lodash_placeholder__", _ = 16, f = 32, b = 64, L = 128, D = 256, O = 1 / 0, N = 9007199254740991, G = NaN, $ = 4294967295, q = [["ary", L], ["bind", 1], ["bindKey", 2], ["curry", 8], ["curryRight", _], ["flip", 512], ["partial", f], ["partialRight", b], ["rearg", D]], te = "[object Arguments]", ae = "[object Array]", de = "[object Boolean]", Oe = "[object Date]", W = "[object Error]", ge = "[object Function]", ke = "[object GeneratorFunction]", Se = "[object Map]", Z = "[object Number]", J = "[object Object]", X = "[object Promise]", ue = "[object RegExp]", pe = "[object Set]", De = "[object String]", Ie = "[object Symbol]", _t = "[object WeakMap]", bn = "[object ArrayBuffer]", Jt = "[object DataView]", Dn = "[object Float32Array]", kn = "[object Float64Array]", Ur = "[object Int8Array]", Tr = "[object Int16Array]", gr = "[object Int32Array]", $n = "[object Uint8Array]", jr = "[object Uint8ClampedArray]", Cr = "[object Uint16Array]", Ir = "[object Uint32Array]", qe = /\b__p \+= '';/g, Zr = /\b(__p \+=) '' \+/g, Ks = /(__e\(.*?\)|\b__t\)) \+\n'';/g, un = /&(?:amp|lt|gt|quot|#39);/g, os = /[&<>"']/g, as = RegExp(un.source), sa = RegExp(os.source), yo = /<%-([\s\S]+?)%>/g, er = /<%([\s\S]+?)%>/g, bo = /<%=([\s\S]+?)%>/g, Ni = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/, Zi = /^\w*$/, ss = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g, Mi = /[\\^$.*+?()[\]{}|]/g, To = RegExp(Mi.source), ei = /^\s+/, cs = /\s/, It = /\{(?:\n\/\* \[wrapped with .+\] \*\/)?\n?/, jt = /\{\n\/\* \[wrapped with (.+)\] \*/, us = /,? & /, Wc = /[^\x00-\x2f\x3a-\x40\x5b-\x60\x7b-\x7f]+/g, zn = /[()=,{}\[\]\/\s]/, Ke = /\\(\\)?/g, Js = /\$\{([^\\}]*(?:\\.[^\\}]*)*)\}/g, Si = /\w*$/, Ys = /^[-+]0x[0-9a-f]+$/i, Co = /^0b[01]+$/i, ca = /^\[object .+?Constructor\]$/, Io = /^0o[0-7]+$/i, Y = /^(?:0|[1-9]\d*)$/, re = /[\xc0-\xd6\xd8-\xf6\xf8-\xff\u0100-\u017f]/g, he = /($^)/, be = /['\n\r\u2028\u2029\\]/g, Xe = "\\ud800-\\udfff", en = "\\u0300-\\u036f\\ufe20-\\ufe2f\\u20d0-\\u20ff", it = "\\u2700-\\u27bf", tt = "a-z\\xdf-\\xf6\\xf8-\\xff", Ue = "A-Z\\xc0-\\xd6\\xd8-\\xde", we = "\\ufe0e\\ufe0f", Ve = "\\xac\\xb1\\xd7\\xf7\\x00-\\x2f\\x3a-\\x40\\x5b-\\x60\\x7b-\\xbf\\u2000-\\u206f \\t\\x0b\\f\\xa0\\ufeff\\n\\r\\u2028\\u2029\\u1680\\u180e\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200a\\u202f\\u205f\\u3000", We = "['’]", St = "[" + Xe + "]", Ft = "[" + Ve + "]", Ht = "[" + en + "]", Tn = "\\d+", ua = "[" + it + "]", la = "[" + tt + "]", Qs = "[^" + Xe + Ve + Tn + it + tt + Ue + "]", ls = "\\ud83c[\\udffb-\\udfff]", ds = "[^" + Xe + "]", hs = "(?:\\ud83c[\\udde6-\\uddff]){2}", da = "[\\ud800-\\udbff][\\udc00-\\udfff]", Li = "[" + Ue + "]", Ro = "\\u200d", Hc = "(?:" + la + "|" + Qs + ")", ha = "(?:" + Li + "|" + Qs + ")", fa = "(?:['’](?:d|ll|m|re|s|t|ve))?", wo = "(?:['’](?:D|LL|M|RE|S|T|VE))?", Oo = "(?:" + Ht + "|" + ls + ")?", Ao = "[" + we + "]?", pa = Ao + Oo + ("(?:" + Ro + "(?:" + [ds, hs, da].join("|") + ")" + Ao + Oo + ")*"), fs = "(?:" + [ua, hs, da].join("|") + ")" + pa, Xs = "(?:" + [ds + Ht + "?", Ht, hs, da, St].join("|") + ")", $c = RegExp(We, "g"), Fr = RegExp(Ht, "g"), Vr = RegExp(ls + "(?=" + ls + ")|" + Xs + pa, "g"), ga = RegExp([Li + "?" + la + "+" + fa + "(?=" + [Ft, Li, "$"].join("|") + ")", ha + "+" + wo + "(?=" + [Ft, Li + Hc, "$"].join("|") + ")", Li + "?" + Hc + "+" + fa, Li + "+" + wo, "\\d*(?:1ST|2ND|3RD|(?![123])\\dTH)(?=\\b|[a-z_])", "\\d*(?:1st|2nd|3rd|(?![123])\\dth)(?=\\b|[A-Z_])", Tn, fs].join("|"), "g"), Pu = RegExp("[" + Ro + Xe + en + we + "]"), pl = /[a-z][A-Z]|[A-Z]{2}[a-z]|[0-9][a-zA-Z]|[a-zA-Z][0-9]|[^a-zA-Z0-9 ]/, ps = ["Array", "Buffer", "DataView", "Date", "Error", "Float32Array", "Float64Array", "Function", "Int8Array", "Int16Array", "Int32Array", "Map", "Math", "Object", "Promise", "RegExp", "Set", "String", "Symbol", "TypeError", "Uint8Array", "Uint8ClampedArray", "Uint16Array", "Uint32Array", "WeakMap", "_", "clearTimeout", "isFinite", "parseInt", "setTimeout"], zc = -1, $t = {};
        $t[Dn] = $t[kn] = $t[Ur] = $t[Tr] = $t[gr] = $t[$n] = $t[jr] = $t[Cr] = $t[Ir] = !0, $t[te] = $t[ae] = $t[bn] = $t[de] = $t[Jt] = $t[Oe] = $t[W] = $t[ge] = $t[Se] = $t[Z] = $t[J] = $t[ue] = $t[pe] = $t[De] = $t[_t] = !1;
        var Ye = {};
        Ye[te] = Ye[ae] = Ye[bn] = Ye[Jt] = Ye[de] = Ye[Oe] = Ye[Dn] = Ye[kn] = Ye[Ur] = Ye[Tr] = Ye[gr] = Ye[Se] = Ye[Z] = Ye[J] = Ye[ue] = Ye[pe] = Ye[De] = Ye[Ie] = Ye[$n] = Ye[jr] = Ye[Cr] = Ye[Ir] = !0, Ye[W] = Ye[ge] = Ye[_t] = !1;
        var Vt = { "\\": "\\", "'": "'", "\n": "n", "\r": "r", "\u2028": "u2028", "\u2029": "u2029" }, qc = parseFloat, Kc = parseInt, Jc = typeof p.g == "object" && p.g && p.g.Object === Object && p.g, Du = typeof self == "object" && self && self.Object === Object && self, je = Jc || Du || Function("return this")(), Cn = A && !A.nodeType && A, ot = Cn && k && !k.nodeType && k, eo = ot && ot.exports === Cn, ko = eo && Jc.process, Nn = function() {
          try {
            var M = ot && ot.require && ot.require("util").types;
            return M || ko && ko.binding && ko.binding("util");
          } catch {
          }
        }(), ln = Nn && Nn.isArrayBuffer, gs = Nn && Nn.isDate, Zs = Nn && Nn.isMap, ec = Nn && Nn.isRegExp, ms = Nn && Nn.isSet, ma = Nn && Nn.isTypedArray;
        function tr(M, F, V) {
          switch (V.length) {
            case 0:
              return M.call(F);
            case 1:
              return M.call(F, V[0]);
            case 2:
              return M.call(F, V[0], V[1]);
            case 3:
              return M.call(F, V[0], V[1], V[2]);
          }
          return M.apply(F, V);
        }
        function Rr(M, F, V, ne) {
          for (var Ee = -1, Pe = M == null ? 0 : M.length; ++Ee < Pe; ) {
            var Ze = M[Ee];
            F(ne, Ze, V(Ze), M);
          }
          return ne;
        }
        function wr(M, F) {
          for (var V = -1, ne = M == null ? 0 : M.length; ++V < ne && F(M[V], V, M) !== !1; ) ;
          return M;
        }
        function Or(M, F) {
          for (var V = M == null ? 0 : M.length; V-- && F(M[V], V, M) !== !1; ) ;
          return M;
        }
        function tc(M, F) {
          for (var V = -1, ne = M == null ? 0 : M.length; ++V < ne; ) if (!F(M[V], V, M)) return !1;
          return !0;
        }
        function ti(M, F) {
          for (var V = -1, ne = M == null ? 0 : M.length, Ee = 0, Pe = []; ++V < ne; ) {
            var Ze = M[V];
            F(Ze, V, M) && (Pe[Ee++] = Ze);
          }
          return Pe;
        }
        function Gr(M, F) {
          return !!(M != null && M.length) && ri(M, F, 0) > -1;
        }
        function Po(M, F, V) {
          for (var ne = -1, Ee = M == null ? 0 : M.length; ++ne < Ee; ) if (V(F, M[ne])) return !0;
          return !1;
        }
        function Yt(M, F) {
          for (var V = -1, ne = M == null ? 0 : M.length, Ee = Array(ne); ++V < ne; ) Ee[V] = F(M[V], V, M);
          return Ee;
        }
        function lt(M, F) {
          for (var V = -1, ne = F.length, Ee = M.length; ++V < ne; ) M[Ee + V] = F[V];
          return M;
        }
        function ni(M, F, V, ne) {
          var Ee = -1, Pe = M == null ? 0 : M.length;
          for (ne && Pe && (V = M[++Ee]); ++Ee < Pe; ) V = F(V, M[Ee], Ee, M);
          return V;
        }
        function Yc(M, F, V, ne) {
          var Ee = M == null ? 0 : M.length;
          for (ne && Ee && (V = M[--Ee]); Ee--; ) V = F(V, M[Ee], Ee, M);
          return V;
        }
        function Qc(M, F) {
          for (var V = -1, ne = M == null ? 0 : M.length; ++V < ne; ) if (F(M[V], V, M)) return !0;
          return !1;
        }
        var va = nr("length");
        function In(M, F, V) {
          var ne;
          return V(M, function(Ee, Pe, Ze) {
            if (F(Ee, Pe, Ze)) return ne = Pe, !1;
          }), ne;
        }
        function vs(M, F, V, ne) {
          for (var Ee = M.length, Pe = V + (ne ? 1 : -1); ne ? Pe-- : ++Pe < Ee; ) if (F(M[Pe], Pe, M)) return Pe;
          return -1;
        }
        function ri(M, F, V) {
          return F == F ? function(ne, Ee, Pe) {
            for (var Ze = Pe - 1, on = ne.length; ++Ze < on; ) if (ne[Ze] === Ee) return Ze;
            return -1;
          }(M, F, V) : vs(M, Nu, V);
        }
        function _a(M, F, V, ne) {
          for (var Ee = V - 1, Pe = M.length; ++Ee < Pe; ) if (ne(M[Ee], F)) return Ee;
          return -1;
        }
        function Nu(M) {
          return M != M;
        }
        function Xc(M, F) {
          var V = M == null ? 0 : M.length;
          return V ? nc(M, F) / V : G;
        }
        function nr(M) {
          return function(F) {
            return F == null ? m : F[M];
          };
        }
        function Sa(M) {
          return function(F) {
            return M == null ? m : M[F];
          };
        }
        function _s(M, F, V, ne, Ee) {
          return Ee(M, function(Pe, Ze, on) {
            V = ne ? (ne = !1, Pe) : F(V, Pe, Ze, on);
          }), V;
        }
        function nc(M, F) {
          for (var V, ne = -1, Ee = M.length; ++ne < Ee; ) {
            var Pe = F(M[ne]);
            Pe !== m && (V = V === m ? Pe : V + Pe);
          }
          return V;
        }
        function Ss(M, F) {
          for (var V = -1, ne = Array(M); ++V < M; ) ne[V] = F(V);
          return ne;
        }
        function rc(M) {
          return M && M.slice(0, dn(M) + 1).replace(ei, "");
        }
        function rr(M) {
          return function(F) {
            return M(F);
          };
        }
        function qn(M, F) {
          return Yt(F, function(V) {
            return M[V];
          });
        }
        function to(M, F) {
          return M.has(F);
        }
        function Ea(M, F) {
          for (var V = -1, ne = M.length; ++V < ne && ri(F, M[V], 0) > -1; ) ;
          return V;
        }
        function Zc(M, F) {
          for (var V = M.length; V-- && ri(F, M[V], 0) > -1; ) ;
          return V;
        }
        var Mu = Sa({ À: "A", Á: "A", Â: "A", Ã: "A", Ä: "A", Å: "A", à: "a", á: "a", â: "a", ã: "a", ä: "a", å: "a", Ç: "C", ç: "c", Ð: "D", ð: "d", È: "E", É: "E", Ê: "E", Ë: "E", è: "e", é: "e", ê: "e", ë: "e", Ì: "I", Í: "I", Î: "I", Ï: "I", ì: "i", í: "i", î: "i", ï: "i", Ñ: "N", ñ: "n", Ò: "O", Ó: "O", Ô: "O", Õ: "O", Ö: "O", Ø: "O", ò: "o", ó: "o", ô: "o", õ: "o", ö: "o", ø: "o", Ù: "U", Ú: "U", Û: "U", Ü: "U", ù: "u", ú: "u", û: "u", ü: "u", Ý: "Y", ý: "y", ÿ: "y", Æ: "Ae", æ: "ae", Þ: "Th", þ: "th", ß: "ss", Ā: "A", Ă: "A", Ą: "A", ā: "a", ă: "a", ą: "a", Ć: "C", Ĉ: "C", Ċ: "C", Č: "C", ć: "c", ĉ: "c", ċ: "c", č: "c", Ď: "D", Đ: "D", ď: "d", đ: "d", Ē: "E", Ĕ: "E", Ė: "E", Ę: "E", Ě: "E", ē: "e", ĕ: "e", ė: "e", ę: "e", ě: "e", Ĝ: "G", Ğ: "G", Ġ: "G", Ģ: "G", ĝ: "g", ğ: "g", ġ: "g", ģ: "g", Ĥ: "H", Ħ: "H", ĥ: "h", ħ: "h", Ĩ: "I", Ī: "I", Ĭ: "I", Į: "I", İ: "I", ĩ: "i", ī: "i", ĭ: "i", į: "i", ı: "i", Ĵ: "J", ĵ: "j", Ķ: "K", ķ: "k", ĸ: "k", Ĺ: "L", Ļ: "L", Ľ: "L", Ŀ: "L", Ł: "L", ĺ: "l", ļ: "l", ľ: "l", ŀ: "l", ł: "l", Ń: "N", Ņ: "N", Ň: "N", Ŋ: "N", ń: "n", ņ: "n", ň: "n", ŋ: "n", Ō: "O", Ŏ: "O", Ő: "O", ō: "o", ŏ: "o", ő: "o", Ŕ: "R", Ŗ: "R", Ř: "R", ŕ: "r", ŗ: "r", ř: "r", Ś: "S", Ŝ: "S", Ş: "S", Š: "S", ś: "s", ŝ: "s", ş: "s", š: "s", Ţ: "T", Ť: "T", Ŧ: "T", ţ: "t", ť: "t", ŧ: "t", Ũ: "U", Ū: "U", Ŭ: "U", Ů: "U", Ű: "U", Ų: "U", ũ: "u", ū: "u", ŭ: "u", ů: "u", ű: "u", ų: "u", Ŵ: "W", ŵ: "w", Ŷ: "Y", ŷ: "y", Ÿ: "Y", Ź: "Z", Ż: "Z", Ž: "Z", ź: "z", ż: "z", ž: "z", Ĳ: "IJ", ĳ: "ij", Œ: "Oe", œ: "oe", ŉ: "'n", ſ: "s" }), gl = Sa({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" });
        function ml(M) {
          return "\\" + Vt[M];
        }
        function ya(M) {
          return Pu.test(M);
        }
        function no(M) {
          var F = -1, V = Array(M.size);
          return M.forEach(function(ne, Ee) {
            V[++F] = [Ee, ne];
          }), V;
        }
        function ic(M, F) {
          return function(V) {
            return M(F(V));
          };
        }
        function xi(M, F) {
          for (var V = -1, ne = M.length, Ee = 0, Pe = []; ++V < ne; ) {
            var Ze = M[V];
            Ze !== F && Ze !== C || (M[V] = C, Pe[Ee++] = V);
          }
          return Pe;
        }
        function Wr(M) {
          var F = -1, V = Array(M.size);
          return M.forEach(function(ne) {
            V[++F] = ne;
          }), V;
        }
        function oc(M) {
          var F = -1, V = Array(M.size);
          return M.forEach(function(ne) {
            V[++F] = [ne, ne];
          }), V;
        }
        function ii(M) {
          return ya(M) ? function(F) {
            for (var V = Vr.lastIndex = 0; Vr.test(F); ) ++V;
            return V;
          }(M) : va(M);
        }
        function vn(M) {
          return ya(M) ? function(F) {
            return F.match(Vr) || [];
          }(M) : function(F) {
            return F.split("");
          }(M);
        }
        function dn(M) {
          for (var F = M.length; F-- && cs.test(M.charAt(F)); ) ;
          return F;
        }
        var ac = Sa({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" }), Do = function M(F) {
          var V, ne = (F = F == null ? je : Do.defaults(je.Object(), F, Do.pick(je, ps))).Array, Ee = F.Date, Pe = F.Error, Ze = F.Function, on = F.Math, Qe = F.Object, Es = F.RegExp, mr = F.String, Rt = F.TypeError, Bi = ne.prototype, ro = Ze.prototype, Ar = Qe.prototype, Hr = F["__core-js_shared__"], xe = ro.toString, Fe = Ar.hasOwnProperty, eu = 0, ys = (V = /[^.]+$/.exec(Hr && Hr.keys && Hr.keys.IE_PROTO || "")) ? "Symbol(src)_1." + V : "", Je = Ar.toString, vl = xe.call(Qe), _l = je._, Sl = Es("^" + xe.call(Fe).replace(Mi, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$"), Rn = eo ? F.Buffer : m, Un = F.Symbol, io = F.Uint8Array, tu = Rn ? Rn.allocUnsafe : m, No = ic(Qe.getPrototypeOf, Qe), nu = Qe.create, bs = Ar.propertyIsEnumerable, oi = Bi.splice, ru = Un ? Un.isConcatSpreadable : m, Ui = Un ? Un.iterator : m, Kn = Un ? Un.toStringTag : m, Mo = function() {
            try {
              var n = Mr(Qe, "defineProperty");
              return n({}, "", {}), n;
            } catch {
            }
          }(), El = F.clearTimeout !== je.clearTimeout && F.clearTimeout, ba = Ee && Ee.now !== je.Date.now && Ee.now, Lu = F.setTimeout !== je.setTimeout && F.setTimeout, Lo = on.ceil, xo = on.floor, Ta = Qe.getOwnPropertySymbols, yl = Rn ? Rn.isBuffer : m, Bo = F.isFinite, bl = Bi.join, xu = ic(Qe.keys, Qe), gt = on.max, wt = on.min, sc = Ee.now, Tl = F.parseInt, Ts = on.random, Bu = Bi.reverse, Ca = Mr(F, "DataView"), me = Mr(F, "Map"), zt = Mr(F, "Promise"), ai = Mr(F, "Set"), ji = Mr(F, "WeakMap"), Fi = Mr(Qe, "create"), Uo = ji && new ji(), $r = {}, Cl = Qn(Ca), jo = Qn(me), Uu = Qn(zt), Jn = Qn(ai), ju = Qn(ji), Yn = Un ? Un.prototype : m, Ei = Yn ? Yn.valueOf : m, oo = Yn ? Yn.toString : m;
          function g(n) {
            if (st(n) && !Be(n) && !(n instanceof Ae)) {
              if (n instanceof Qt) return n;
              if (Fe.call(n, "__wrapped__")) return po(n);
            }
            return new Qt(n);
          }
          var $e = /* @__PURE__ */ function() {
            function n() {
            }
            return function(e) {
              if (!Kt(e)) return {};
              if (nu) return nu(e);
              n.prototype = e;
              var t = new n();
              return n.prototype = m, t;
            };
          }();
          function si() {
          }
          function Qt(n, e) {
            this.__wrapped__ = n, this.__actions__ = [], this.__chain__ = !!e, this.__index__ = 0, this.__values__ = m;
          }
          function Ae(n) {
            this.__wrapped__ = n, this.__actions__ = [], this.__dir__ = 1, this.__filtered__ = !1, this.__iteratees__ = [], this.__takeCount__ = $, this.__views__ = [];
          }
          function ir(n) {
            var e = -1, t = n == null ? 0 : n.length;
            for (this.clear(); ++e < t; ) {
              var i = n[e];
              this.set(i[0], i[1]);
            }
          }
          function kt(n) {
            var e = -1, t = n == null ? 0 : n.length;
            for (this.clear(); ++e < t; ) {
              var i = n[e];
              this.set(i[0], i[1]);
            }
          }
          function hn(n) {
            var e = -1, t = n == null ? 0 : n.length;
            for (this.clear(); ++e < t; ) {
              var i = n[e];
              this.set(i[0], i[1]);
            }
          }
          function vr(n) {
            var e = -1, t = n == null ? 0 : n.length;
            for (this.__data__ = new hn(); ++e < t; ) this.add(n[e]);
          }
          function Ot(n) {
            var e = this.__data__ = new kt(n);
            this.size = e.size;
          }
          function le(n, e) {
            var t = Be(n), i = !t && hi(n), o = !t && !i && ft(n), u = !t && !i && !o && Xt(n), d = t || i || o || u, h = d ? Ss(n.length, mr) : [], S = h.length;
            for (var T in n) !e && !Fe.call(n, T) || d && (T == "length" || o && (T == "offset" || T == "parent") || u && (T == "buffer" || T == "byteLength" || T == "byteOffset") || sn(T, S)) || h.push(T);
            return h;
          }
          function or(n) {
            var e = n.length;
            return e ? n[Da(0, e - 1)] : m;
          }
          function Il(n, e) {
            return Wa(fn(n), _r(e, 0, n.length));
          }
          function cc(n) {
            return Wa(fn(n));
          }
          function ao(n, e, t) {
            (t !== m && !Yr(n[e], t) || t === m && !(e in n)) && _n(n, e, t);
          }
          function ci(n, e, t) {
            var i = n[e];
            Fe.call(n, e) && Yr(i, t) && (t !== m || e in n) || _n(n, e, t);
          }
          function yi(n, e) {
            for (var t = n.length; t--; ) if (Yr(n[t][0], e)) return t;
            return -1;
          }
          function iu(n, e, t, i) {
            return jn(n, function(o, u, d) {
              e(i, o, t(o), d);
            }), i;
          }
          function ou(n, e) {
            return n && Sr(e, xt(e), n);
          }
          function _n(n, e, t) {
            e == "__proto__" && Mo ? Mo(n, e, { configurable: !0, enumerable: !0, value: t, writable: !0 }) : n[e] = t;
          }
          function Ia(n, e) {
            for (var t = -1, i = e.length, o = ne(i), u = n == null; ++t < i; ) o[t] = u ? m : ta(n, e[t]);
            return o;
          }
          function _r(n, e, t) {
            return n == n && (t !== m && (n = n <= t ? n : t), e !== m && (n = n >= e ? n : e)), n;
          }
          function an(n, e, t, i, o, u) {
            var d, h = 1 & e, S = 2 & e, T = 4 & e;
            if (t && (d = o ? t(n, i, o, u) : t(n)), d !== m) return d;
            if (!Kt(n)) return n;
            var I = Be(n);
            if (I) {
              if (d = function(j) {
                var x = j.length, H = new j.constructor(x);
                return x && typeof j[0] == "string" && Fe.call(j, "index") && (H.index = j.index, H.input = j.input), H;
              }(n), !h) return fn(n, d);
            } else {
              var R = Ln(n), w = R == ge || R == ke;
              if (ft(n)) return Ho(n, h);
              if (R == J || R == te || w && !o) {
                if (d = S || w ? {} : fu(n), !h) return S ? function(j, x) {
                  return Sr(j, gn(j), x);
                }(n, function(j, x) {
                  return j && Sr(x, ct(x), j);
                }(d, n)) : function(j, x) {
                  return Sr(j, Ls(j), x);
                }(n, ou(d, n));
              } else {
                if (!Ye[R]) return o ? n : {};
                d = function(j, x, H) {
                  var K = j.constructor;
                  switch (x) {
                    case bn:
                      return ho(j);
                    case de:
                    case Oe:
                      return new K(+j);
                    case Jt:
                      return function(ie, ce) {
                        var oe = ce ? ho(ie.buffer) : ie.buffer;
                        return new ie.constructor(oe, ie.byteOffset, ie.byteLength);
                      }(j, H);
                    case Dn:
                    case kn:
                    case Ur:
                    case Tr:
                    case gr:
                    case $n:
                    case jr:
                    case Cr:
                    case Ir:
                      return Sc(j, H);
                    case Se:
                      return new K();
                    case Z:
                    case De:
                      return new K(j);
                    case ue:
                      return function(ie) {
                        var ce = new ie.constructor(ie.source, Si.exec(ie));
                        return ce.lastIndex = ie.lastIndex, ce;
                      }(j);
                    case pe:
                      return new K();
                    case Ie:
                      return Q = j, Ei ? Qe(Ei.call(Q)) : {};
                  }
                  var Q;
                }(n, R, h);
              }
            }
            u || (u = new Ot());
            var P = u.get(n);
            if (P) return P;
            u.set(n, d), Sn(n) ? n.forEach(function(j) {
              d.add(an(j, e, t, j, n, u));
            }) : pn(n) && n.forEach(function(j, x) {
              d.set(x, an(j, e, t, x, n, u));
            });
            var B = I ? m : (T ? S ? qr : Ai : S ? ct : xt)(n);
            return wr(B || n, function(j, x) {
              B && (j = n[x = j]), ci(d, x, an(j, e, t, x, n, u));
            }), d;
          }
          function Cs(n, e, t) {
            var i = t.length;
            if (n == null) return !i;
            for (n = Qe(n); i--; ) {
              var o = t[i], u = e[o], d = n[o];
              if (d === m && !(o in n) || !u(d)) return !1;
            }
            return !0;
          }
          function Is(n, e, t) {
            if (typeof n != "function") throw new Rt(y);
            return fo(function() {
              n.apply(m, t);
            }, e);
          }
          function ui(n, e, t, i) {
            var o = -1, u = Gr, d = !0, h = n.length, S = [], T = e.length;
            if (!h) return S;
            t && (e = Yt(e, rr(t))), i ? (u = Po, d = !1) : e.length >= 200 && (u = to, d = !1, e = new vr(e));
            e: for (; ++o < h; ) {
              var I = n[o], R = t == null ? I : t(I);
              if (I = i || I !== 0 ? I : 0, d && R == R) {
                for (var w = T; w--; ) if (e[w] === R) continue e;
                S.push(I);
              } else u(e, R, i) || S.push(I);
            }
            return S;
          }
          g.templateSettings = { escape: yo, evaluate: er, interpolate: bo, variable: "", imports: { _: g } }, g.prototype = si.prototype, g.prototype.constructor = g, Qt.prototype = $e(si.prototype), Qt.prototype.constructor = Qt, Ae.prototype = $e(si.prototype), Ae.prototype.constructor = Ae, ir.prototype.clear = function() {
            this.__data__ = Fi ? Fi(null) : {}, this.size = 0;
          }, ir.prototype.delete = function(n) {
            var e = this.has(n) && delete this.__data__[n];
            return this.size -= e ? 1 : 0, e;
          }, ir.prototype.get = function(n) {
            var e = this.__data__;
            if (Fi) {
              var t = e[n];
              return t === E ? m : t;
            }
            return Fe.call(e, n) ? e[n] : m;
          }, ir.prototype.has = function(n) {
            var e = this.__data__;
            return Fi ? e[n] !== m : Fe.call(e, n);
          }, ir.prototype.set = function(n, e) {
            var t = this.__data__;
            return this.size += this.has(n) ? 0 : 1, t[n] = Fi && e === m ? E : e, this;
          }, kt.prototype.clear = function() {
            this.__data__ = [], this.size = 0;
          }, kt.prototype.delete = function(n) {
            var e = this.__data__, t = yi(e, n);
            return !(t < 0) && (t == e.length - 1 ? e.pop() : oi.call(e, t, 1), --this.size, !0);
          }, kt.prototype.get = function(n) {
            var e = this.__data__, t = yi(e, n);
            return t < 0 ? m : e[t][1];
          }, kt.prototype.has = function(n) {
            return yi(this.__data__, n) > -1;
          }, kt.prototype.set = function(n, e) {
            var t = this.__data__, i = yi(t, n);
            return i < 0 ? (++this.size, t.push([n, e])) : t[i][1] = e, this;
          }, hn.prototype.clear = function() {
            this.size = 0, this.__data__ = { hash: new ir(), map: new (me || kt)(), string: new ir() };
          }, hn.prototype.delete = function(n) {
            var e = Fa(this, n).delete(n);
            return this.size -= e ? 1 : 0, e;
          }, hn.prototype.get = function(n) {
            return Fa(this, n).get(n);
          }, hn.prototype.has = function(n) {
            return Fa(this, n).has(n);
          }, hn.prototype.set = function(n, e) {
            var t = Fa(this, n), i = t.size;
            return t.set(n, e), this.size += t.size == i ? 0 : 1, this;
          }, vr.prototype.add = vr.prototype.push = function(n) {
            return this.__data__.set(n, E), this;
          }, vr.prototype.has = function(n) {
            return this.__data__.has(n);
          }, Ot.prototype.clear = function() {
            this.__data__ = new kt(), this.size = 0;
          }, Ot.prototype.delete = function(n) {
            var e = this.__data__, t = e.delete(n);
            return this.size = e.size, t;
          }, Ot.prototype.get = function(n) {
            return this.__data__.get(n);
          }, Ot.prototype.has = function(n) {
            return this.__data__.has(n);
          }, Ot.prototype.set = function(n, e) {
            var t = this.__data__;
            if (t instanceof kt) {
              var i = t.__data__;
              if (!me || i.length < 199) return i.push([n, e]), this.size = ++t.size, this;
              t = this.__data__ = new hn(i);
            }
            return t.set(n, e), this.size = t.size, this;
          };
          var jn = lu(wn), uc = lu(Oa, !0);
          function au(n, e) {
            var t = !0;
            return jn(n, function(i, o, u) {
              return t = !!e(i, o, u);
            }), t;
          }
          function so(n, e, t) {
            for (var i = -1, o = n.length; ++i < o; ) {
              var u = n[i], d = e(u);
              if (d != null && (h === m ? d == d && !Tt(d) : t(d, h))) var h = d, S = u;
            }
            return S;
          }
          function lc(n, e) {
            var t = [];
            return jn(n, function(i, o, u) {
              e(i, o, u) && t.push(i);
            }), t;
          }
          function bt(n, e, t, i, o) {
            var u = -1, d = n.length;
            for (t || (t = ki), o || (o = []); ++u < d; ) {
              var h = n[u];
              e > 0 && t(h) ? e > 1 ? bt(h, e - 1, t, i, o) : lt(o, h) : i || (o[o.length] = h);
            }
            return o;
          }
          var Ra = du(), wa = du(!0);
          function wn(n, e) {
            return n && Ra(n, e, xt);
          }
          function Oa(n, e) {
            return n && wa(n, e, xt);
          }
          function ar(n, e) {
            return ti(e, function(t) {
              return fi(n[t]);
            });
          }
          function sr(n, e) {
            for (var t = 0, i = (e = li(e, n)).length; n != null && t < i; ) n = n[di(e[t++])];
            return t && t == i ? n : m;
          }
          function Rs(n, e, t) {
            var i = e(n);
            return Be(n) ? i : lt(i, t(n));
          }
          function Nt(n) {
            return n == null ? n === m ? "[object Undefined]" : "[object Null]" : Kn && Kn in Qe(n) ? function(e) {
              var t = Fe.call(e, Kn), i = e[Kn];
              try {
                e[Kn] = m;
                var o = !0;
              } catch {
              }
              var u = Je.call(e);
              return o && (t ? e[Kn] = i : delete e[Kn]), u;
            }(n) : function(e) {
              return Je.call(e);
            }(n);
          }
          function Aa(n, e) {
            return n > e;
          }
          function Fu(n, e) {
            return n != null && Fe.call(n, e);
          }
          function Vu(n, e) {
            return n != null && e in Qe(n);
          }
          function ka(n, e, t) {
            for (var i = t ? Po : Gr, o = n[0].length, u = n.length, d = u, h = ne(u), S = 1 / 0, T = []; d--; ) {
              var I = n[d];
              d && e && (I = Yt(I, rr(e))), S = wt(I.length, S), h[d] = !t && (e || o >= 120 && I.length >= 120) ? new vr(d && I) : m;
            }
            I = n[0];
            var R = -1, w = h[0];
            e: for (; ++R < o && T.length < S; ) {
              var P = I[R], B = e ? e(P) : P;
              if (P = t || P !== 0 ? P : 0, !(w ? to(w, B) : i(T, B, t))) {
                for (d = u; --d; ) {
                  var j = h[d];
                  if (!(j ? to(j, B) : i(n[d], B, t))) continue e;
                }
                w && w.push(B), T.push(P);
              }
            }
            return T;
          }
          function Vi(n, e, t) {
            var i = (n = Va(n, e = li(e, n))) == null ? n : n[di(Kr(e))];
            return i == null ? m : tr(i, n, t);
          }
          function dc(n) {
            return st(n) && Nt(n) == te;
          }
          function bi(n, e, t, i, o) {
            return n === e || (n == null || e == null || !st(n) && !st(e) ? n != n && e != e : function(u, d, h, S, T, I) {
              var R = Be(u), w = Be(d), P = R ? ae : Ln(u), B = w ? ae : Ln(d), j = (P = P == te ? J : P) == J, x = (B = B == te ? J : B) == J, H = P == B;
              if (H && ft(u)) {
                if (!ft(d)) return !1;
                R = !0, j = !1;
              }
              if (H && !j) return I || (I = new Ot()), R || Xt(u) ? dr(u, d, h, S, T, I) : function(oe, ee, fe, ye, Ce, ve, _e) {
                switch (fe) {
                  case Jt:
                    if (oe.byteLength != ee.byteLength || oe.byteOffset != ee.byteOffset) return !1;
                    oe = oe.buffer, ee = ee.buffer;
                  case bn:
                    return !(oe.byteLength != ee.byteLength || !ve(new io(oe), new io(ee)));
                  case de:
                  case Oe:
                  case Z:
                    return Yr(+oe, +ee);
                  case W:
                    return oe.name == ee.name && oe.message == ee.message;
                  case ue:
                  case De:
                    return oe == ee + "";
                  case Se:
                    var Le = no;
                  case pe:
                    var et = 1 & ye;
                    if (Le || (Le = Wr), oe.size != ee.size && !et) return !1;
                    var vt = _e.get(oe);
                    if (vt) return vt == ee;
                    ye |= 2, _e.set(oe, ee);
                    var Et = dr(Le(oe), Le(ee), ye, Ce, ve, _e);
                    return _e.delete(oe), Et;
                  case Ie:
                    if (Ei) return Ei.call(oe) == Ei.call(ee);
                }
                return !1;
              }(u, d, P, h, S, T, I);
              if (!(1 & h)) {
                var K = j && Fe.call(u, "__wrapped__"), Q = x && Fe.call(d, "__wrapped__");
                if (K || Q) {
                  var ie = K ? u.value() : u, ce = Q ? d.value() : d;
                  return I || (I = new Ot()), T(ie, ce, h, S, I);
                }
              }
              return H ? (I || (I = new Ot()), function(oe, ee, fe, ye, Ce, ve) {
                var _e = 1 & fe, Le = Ai(oe), et = Le.length, vt = Ai(ee), Et = vt.length;
                if (et != Et && !_e) return !1;
                for (var mt = et; mt--; ) {
                  var Ct = Le[mt];
                  if (!(_e ? Ct in ee : Fe.call(ee, Ct))) return !1;
                }
                var Zt = ve.get(oe), Wt = ve.get(ee);
                if (Zt && Wt) return Zt == ee && Wt == oe;
                var Bt = !0;
                ve.set(oe, ee), ve.set(ee, oe);
                for (var Lt = _e; ++mt < et; ) {
                  var Dt = oe[Ct = Le[mt]], Ut = ee[Ct];
                  if (ye) var nn = _e ? ye(Ut, Dt, Ct, ee, oe, ve) : ye(Dt, Ut, Ct, oe, ee, ve);
                  if (!(nn === m ? Dt === Ut || Ce(Dt, Ut, fe, ye, ve) : nn)) {
                    Bt = !1;
                    break;
                  }
                  Lt || (Lt = Ct == "constructor");
                }
                if (Bt && !Lt) {
                  var At = oe.constructor, Pn = ee.constructor;
                  At == Pn || !("constructor" in oe) || !("constructor" in ee) || typeof At == "function" && At instanceof At && typeof Pn == "function" && Pn instanceof Pn || (Bt = !1);
                }
                return ve.delete(oe), ve.delete(ee), Bt;
              }(u, d, h, S, T, I)) : !1;
            }(n, e, t, i, bi, o));
          }
          function ws(n, e, t, i) {
            var o = t.length, u = o, d = !i;
            if (n == null) return !u;
            for (n = Qe(n); o--; ) {
              var h = t[o];
              if (d && h[2] ? h[1] !== n[h[0]] : !(h[0] in n)) return !1;
            }
            for (; ++o < u; ) {
              var S = (h = t[o])[0], T = n[S], I = h[1];
              if (d && h[2]) {
                if (T === m && !(S in n)) return !1;
              } else {
                var R = new Ot();
                if (i) var w = i(T, I, S, n, e, R);
                if (!(w === m ? bi(I, T, 3, i, R) : w)) return !1;
              }
            }
            return !0;
          }
          function Re(n) {
            return !(!Kt(n) || (e = n, ys && ys in e)) && (fi(n) ? Sl : ca).test(Qn(n));
            var e;
          }
          function hc(n) {
            return typeof n == "function" ? n : n == null ? yr : typeof n == "object" ? Be(n) ? Fo(n[0], n[1]) : su(n) : Gt(n);
          }
          function co(n) {
            if (!Yo(n)) return xu(n);
            var e = [];
            for (var t in Qe(n)) Fe.call(n, t) && t != "constructor" && e.push(t);
            return e;
          }
          function On(n) {
            if (!Kt(n)) return function(o) {
              var u = [];
              if (o != null) for (var d in Qe(o)) u.push(d);
              return u;
            }(n);
            var e = Yo(n), t = [];
            for (var i in n) (i != "constructor" || !e && Fe.call(n, i)) && t.push(i);
            return t;
          }
          function Os(n, e) {
            return n < e;
          }
          function fc(n, e) {
            var t = -1, i = fr(n) ? ne(n.length) : [];
            return jn(n, function(o, u, d) {
              i[++t] = e(o, u, d);
            }), i;
          }
          function su(n) {
            var e = Ki(n);
            return e.length == 1 && e[0][2] ? Ic(e[0][0], e[0][1]) : function(t) {
              return t === n || ws(t, n, e);
            };
          }
          function Fo(n, e) {
            return Ko(n) && Cc(e) ? Ic(di(n), e) : function(t) {
              var i = ta(t, n);
              return i === m && i === e ? Ws(t, n) : bi(e, i, 3);
            };
          }
          function Pa(n, e, t, i, o) {
            n !== e && Ra(e, function(u, d) {
              if (o || (o = new Ot()), Kt(u)) (function(S, T, I, R, w, P, B) {
                var j = Rc(S, I), x = Rc(T, I), H = B.get(x);
                if (H) return void ao(S, I, H);
                var K = P ? P(j, x, I + "", S, T, B) : m, Q = K === m;
                if (Q) {
                  var ie = Be(x), ce = !ie && ft(x), oe = !ie && !ce && Xt(x);
                  K = x, ie || ce || oe ? Be(j) ? K = j : yt(j) ? K = fn(j) : ce ? (Q = !1, K = Ho(x, !0)) : oe ? (Q = !1, K = Sc(x, !0)) : K = [] : za(x) || hi(x) ? (K = j, hi(j) ? K = Lr(j) : Kt(j) && !fi(j) || (K = fu(x))) : Q = !1;
                }
                Q && (B.set(x, K), w(K, x, R, P, B), B.delete(x)), ao(S, I, K);
              })(n, e, d, t, Pa, i, o);
              else {
                var h = i ? i(Rc(n, d), u, d + "", n, e, o) : m;
                h === m && (h = u), ao(n, d, h);
              }
            }, ct);
          }
          function pc(n, e) {
            var t = n.length;
            if (t) return sn(e += e < 0 ? t : 0, t) ? n[e] : m;
          }
          function uo(n, e, t) {
            e = e.length ? Yt(e, function(u) {
              return Be(u) ? function(d) {
                return sr(d, u.length === 1 ? u[0] : u);
              } : u;
            }) : [yr];
            var i = -1;
            e = Yt(e, rr(Ge()));
            var o = fc(n, function(u, d, h) {
              var S = Yt(e, function(T) {
                return T(u);
              });
              return { criteria: S, index: ++i, value: u };
            });
            return function(u, d) {
              var h = u.length;
              for (u.sort(d); h--; ) u[h] = u[h].value;
              return u;
            }(o, function(u, d) {
              return function(h, S, T) {
                for (var I = -1, R = h.criteria, w = S.criteria, P = R.length, B = T.length; ++I < P; ) {
                  var j = cu(R[I], w[I]);
                  if (j) return I >= B ? j : j * (T[I] == "desc" ? -1 : 1);
                }
                return h.index - S.index;
              }(u, d, t);
            });
          }
          function gc(n, e, t) {
            for (var i = -1, o = e.length, u = {}; ++i < o; ) {
              var d = e[i], h = sr(n, d);
              t(h, d) && Gi(u, li(d, n), h);
            }
            return u;
          }
          function mc(n, e, t, i) {
            var o = i ? _a : ri, u = -1, d = e.length, h = n;
            for (n === e && (e = fn(e)), t && (h = Yt(n, rr(t))); ++u < d; ) for (var S = 0, T = e[u], I = t ? t(T) : T; (S = o(h, I, S, i)) > -1; ) h !== n && oi.call(h, S, 1), oi.call(n, S, 1);
            return n;
          }
          function As(n, e) {
            for (var t = n ? e.length : 0, i = t - 1; t--; ) {
              var o = e[t];
              if (t == i || o !== u) {
                var u = o;
                sn(o) ? oi.call(n, o, 1) : Go(n, o);
              }
            }
            return n;
          }
          function Da(n, e) {
            return n + xo(Ts() * (e - n + 1));
          }
          function ht(n, e) {
            var t = "";
            if (!n || e < 1 || e > N) return t;
            do
              e % 2 && (t += n), (e = xo(e / 2)) && (n += n);
            while (e);
            return t;
          }
          function at(n, e) {
            return Ga(An(n, e, yr), n + "");
          }
          function Na(n) {
            return or(En(n));
          }
          function cr(n, e) {
            var t = En(n);
            return Wa(t, _r(e, 0, t.length));
          }
          function Gi(n, e, t, i) {
            if (!Kt(n)) return n;
            for (var o = -1, u = (e = li(e, n)).length, d = u - 1, h = n; h != null && ++o < u; ) {
              var S = di(e[o]), T = t;
              if (S === "__proto__" || S === "constructor" || S === "prototype") return n;
              if (o != d) {
                var I = h[S];
                (T = i ? i(I, S, h) : m) === m && (T = Kt(I) ? I : sn(e[o + 1]) ? [] : {});
              }
              ci(h, S, T), h = h[S];
            }
            return n;
          }
          var Fn = Uo ? function(n, e) {
            return Uo.set(n, e), n;
          } : yr, lo = Mo ? function(n, e) {
            return Mo(n, "toString", { configurable: !0, enumerable: !1, value: Hn(e), writable: !0 });
          } : yr;
          function dt(n) {
            return Wa(En(n));
          }
          function kr(n, e, t) {
            var i = -1, o = n.length;
            e < 0 && (e = -e > o ? 0 : o + e), (t = t > o ? o : t) < 0 && (t += o), o = e > t ? 0 : t - e >>> 0, e >>>= 0;
            for (var u = ne(o); ++i < o; ) u[i] = n[i + e];
            return u;
          }
          function Pr(n, e) {
            var t;
            return jn(n, function(i, o, u) {
              return !(t = e(i, o, u));
            }), !!t;
          }
          function Vo(n, e, t) {
            var i = 0, o = n == null ? i : n.length;
            if (typeof e == "number" && e == e && o <= 2147483647) {
              for (; i < o; ) {
                var u = i + o >>> 1, d = n[u];
                d !== null && !Tt(d) && (t ? d <= e : d < e) ? i = u + 1 : o = u;
              }
              return o;
            }
            return ks(n, e, yr, t);
          }
          function ks(n, e, t, i) {
            var o = 0, u = n == null ? 0 : n.length;
            if (u === 0) return 0;
            for (var d = (e = t(e)) != e, h = e === null, S = Tt(e), T = e === m; o < u; ) {
              var I = xo((o + u) / 2), R = t(n[I]), w = R !== m, P = R === null, B = R == R, j = Tt(R);
              if (d) var x = i || B;
              else x = T ? B && (i || w) : h ? B && w && (i || !P) : S ? B && w && !P && (i || !j) : !P && !j && (i ? R <= e : R < e);
              x ? o = I + 1 : u = I;
            }
            return wt(u, 4294967294);
          }
          function vc(n, e) {
            for (var t = -1, i = n.length, o = 0, u = []; ++t < i; ) {
              var d = n[t], h = e ? e(d) : d;
              if (!t || !Yr(h, S)) {
                var S = h;
                u[o++] = d === 0 ? 0 : d;
              }
            }
            return u;
          }
          function ur(n) {
            return typeof n == "number" ? n : Tt(n) ? G : +n;
          }
          function Pt(n) {
            if (typeof n == "string") return n;
            if (Be(n)) return Yt(n, Pt) + "";
            if (Tt(n)) return oo ? oo.call(n) : "";
            var e = n + "";
            return e == "0" && 1 / n == -1 / 0 ? "-0" : e;
          }
          function Dr(n, e, t) {
            var i = -1, o = Gr, u = n.length, d = !0, h = [], S = h;
            if (t) d = !1, o = Po;
            else if (u >= 200) {
              var T = e ? null : Gu(n);
              if (T) return Wr(T);
              d = !1, o = to, S = new vr();
            } else S = e ? [] : h;
            e: for (; ++i < u; ) {
              var I = n[i], R = e ? e(I) : I;
              if (I = t || I !== 0 ? I : 0, d && R == R) {
                for (var w = S.length; w--; ) if (S[w] === R) continue e;
                e && S.push(R), h.push(I);
              } else o(S, R, t) || (S !== h && S.push(R), h.push(I));
            }
            return h;
          }
          function Go(n, e) {
            return (n = Va(n, e = li(e, n))) == null || delete n[di(Kr(e))];
          }
          function Wi(n, e, t, i) {
            return Gi(n, e, t(sr(n, e)), i);
          }
          function Wo(n, e, t, i) {
            for (var o = n.length, u = i ? o : -1; (i ? u-- : ++u < o) && e(n[u], u, n); ) ;
            return t ? kr(n, i ? 0 : u, i ? u + 1 : o) : kr(n, i ? u + 1 : 0, i ? o : u);
          }
          function _c(n, e) {
            var t = n;
            return t instanceof Ae && (t = t.value()), ni(e, function(i, o) {
              return o.func.apply(o.thisArg, lt([i], o.args));
            }, t);
          }
          function Ti(n, e, t) {
            var i = n.length;
            if (i < 2) return i ? Dr(n[0]) : [];
            for (var o = -1, u = ne(i); ++o < i; ) for (var d = n[o], h = -1; ++h < i; ) h != o && (u[o] = ui(u[o] || d, n[h], e, t));
            return Dr(bt(u, 1), e, t);
          }
          function zr(n, e, t) {
            for (var i = -1, o = n.length, u = e.length, d = {}; ++i < o; ) {
              var h = i < u ? e[i] : m;
              t(d, n[i], h);
            }
            return d;
          }
          function Hi(n) {
            return yt(n) ? n : [];
          }
          function Mn(n) {
            return typeof n == "function" ? n : yr;
          }
          function li(n, e) {
            return Be(n) ? n : Ko(n, e) ? [n] : Oc(pt(n));
          }
          var Nr = at;
          function $i(n, e, t) {
            var i = n.length;
            return t = t === m ? i : t, !e && t >= i ? n : kr(n, e, t);
          }
          var Ps = El || function(n) {
            return je.clearTimeout(n);
          };
          function Ho(n, e) {
            if (e) return n.slice();
            var t = n.length, i = tu ? tu(t) : new n.constructor(t);
            return n.copy(i), i;
          }
          function ho(n) {
            var e = new n.constructor(n.byteLength);
            return new io(e).set(new io(n)), e;
          }
          function Sc(n, e) {
            var t = e ? ho(n.buffer) : n.buffer;
            return new n.constructor(t, n.byteOffset, n.length);
          }
          function cu(n, e) {
            if (n !== e) {
              var t = n !== m, i = n === null, o = n == n, u = Tt(n), d = e !== m, h = e === null, S = e == e, T = Tt(e);
              if (!h && !T && !u && n > e || u && d && S && !h && !T || i && d && S || !t && S || !o) return 1;
              if (!i && !u && !T && n < e || T && t && o && !i && !u || h && t && o || !d && o || !S) return -1;
            }
            return 0;
          }
          function uu(n, e, t, i) {
            for (var o = -1, u = n.length, d = t.length, h = -1, S = e.length, T = gt(u - d, 0), I = ne(S + T), R = !i; ++h < S; ) I[h] = e[h];
            for (; ++o < d; ) (R || o < u) && (I[t[o]] = n[o]);
            for (; T--; ) I[h++] = n[o++];
            return I;
          }
          function lr(n, e, t, i) {
            for (var o = -1, u = n.length, d = -1, h = t.length, S = -1, T = e.length, I = gt(u - h, 0), R = ne(I + T), w = !i; ++o < I; ) R[o] = n[o];
            for (var P = o; ++S < T; ) R[P + S] = e[S];
            for (; ++d < h; ) (w || o < u) && (R[P + t[d]] = n[o++]);
            return R;
          }
          function fn(n, e) {
            var t = -1, i = n.length;
            for (e || (e = ne(i)); ++t < i; ) e[t] = n[t];
            return e;
          }
          function Sr(n, e, t, i) {
            var o = !t;
            t || (t = {});
            for (var u = -1, d = e.length; ++u < d; ) {
              var h = e[u], S = i ? i(t[h], n[h], h, t, n) : m;
              S === m && (S = n[h]), o ? _n(t, h, S) : ci(t, h, S);
            }
            return t;
          }
          function Ci(n, e) {
            return function(t, i) {
              var o = Be(t) ? Rr : iu, u = e ? e() : {};
              return o(t, n, Ge(i, 2), u);
            };
          }
          function Ii(n) {
            return at(function(e, t) {
              var i = -1, o = t.length, u = o > 1 ? t[o - 1] : m, d = o > 2 ? t[2] : m;
              for (u = n.length > 3 && typeof u == "function" ? (o--, u) : m, d && xn(t[0], t[1], d) && (u = o < 3 ? m : u, o = 1), e = Qe(e); ++i < o; ) {
                var h = t[i];
                h && n(e, h, i, u);
              }
              return e;
            });
          }
          function lu(n, e) {
            return function(t, i) {
              if (t == null) return t;
              if (!fr(t)) return n(t, i);
              for (var o = t.length, u = e ? o : -1, d = Qe(t); (e ? u-- : ++u < o) && i(d[u], u, d) !== !1; ) ;
              return t;
            };
          }
          function du(n) {
            return function(e, t, i) {
              for (var o = -1, u = Qe(e), d = i(e), h = d.length; h--; ) {
                var S = d[n ? h : ++o];
                if (t(u[S], S, u) === !1) break;
              }
              return e;
            };
          }
          function $o(n) {
            return function(e) {
              var t = ya(e = pt(e)) ? vn(e) : m, i = t ? t[0] : e.charAt(0), o = t ? $i(t, 1).join("") : e.slice(1);
              return i[n]() + o;
            };
          }
          function Ri(n) {
            return function(e) {
              return ni(Ja(Tu(e).replace($c, "")), n, "");
            };
          }
          function Ma(n) {
            return function() {
              var e = arguments;
              switch (e.length) {
                case 0:
                  return new n();
                case 1:
                  return new n(e[0]);
                case 2:
                  return new n(e[0], e[1]);
                case 3:
                  return new n(e[0], e[1], e[2]);
                case 4:
                  return new n(e[0], e[1], e[2], e[3]);
                case 5:
                  return new n(e[0], e[1], e[2], e[3], e[4]);
                case 6:
                  return new n(e[0], e[1], e[2], e[3], e[4], e[5]);
                case 7:
                  return new n(e[0], e[1], e[2], e[3], e[4], e[5], e[6]);
              }
              var t = $e(n.prototype), i = n.apply(t, e);
              return Kt(i) ? i : t;
            };
          }
          function Ec(n) {
            return function(e, t, i) {
              var o = Qe(e);
              if (!fr(e)) {
                var u = Ge(t, 3);
                e = xt(e), t = function(h) {
                  return u(o[h], h, o);
                };
              }
              var d = n(e, t, i);
              return d > -1 ? o[u ? e[d] : d] : m;
            };
          }
          function La(n) {
            return Vn(function(e) {
              var t = e.length, i = t, o = Qt.prototype.thru;
              for (n && e.reverse(); i--; ) {
                var u = e[i];
                if (typeof u != "function") throw new Rt(y);
                if (o && !d && qi(u) == "wrapper") var d = new Qt([], !0);
              }
              for (i = d ? i : t; ++i < t; ) {
                var h = qi(u = e[i]), S = h == "wrapper" ? zi(u) : m;
                d = S && Tc(S[0]) && S[1] == 424 && !S[4].length && S[9] == 1 ? d[qi(S[0])].apply(d, S[3]) : u.length == 1 && Tc(u) ? d[h]() : d.thru(u);
              }
              return function() {
                var T = arguments, I = T[0];
                if (d && T.length == 1 && Be(I)) return d.plant(I).value();
                for (var R = 0, w = t ? e[R].apply(this, T) : I; ++R < t; ) w = e[R].call(this, w);
                return w;
              };
            });
          }
          function Er(n, e, t, i, o, u, d, h, S, T) {
            var I = e & L, R = 1 & e, w = 2 & e, P = 24 & e, B = 512 & e, j = w ? m : Ma(n);
            return function x() {
              for (var H = arguments.length, K = ne(H), Q = H; Q--; ) K[Q] = arguments[Q];
              if (P) var ie = He(x), ce = function(ye, Ce) {
                for (var ve = ye.length, _e = 0; ve--; ) ye[ve] === Ce && ++_e;
                return _e;
              }(K, ie);
              if (i && (K = uu(K, i, o, P)), u && (K = lr(K, u, d, P)), H -= ce, P && H < T) {
                var oe = xi(K, ie);
                return yc(n, e, Er, x.placeholder, t, K, oe, h, S, T - H);
              }
              var ee = R ? t : this, fe = w ? ee[n] : n;
              return H = K.length, h ? K = function(ye, Ce) {
                for (var ve = ye.length, _e = wt(Ce.length, ve), Le = fn(ye); _e--; ) {
                  var et = Ce[_e];
                  ye[_e] = sn(et, ve) ? Le[et] : m;
                }
                return ye;
              }(K, h) : B && H > 1 && K.reverse(), I && S < H && (K.length = S), this && this !== je && this instanceof x && (fe = j || Ma(fe)), fe.apply(ee, K);
            };
          }
          function xa(n, e) {
            return function(t, i) {
              return function(o, u, d, h) {
                return wn(o, function(S, T, I) {
                  u(h, d(S), T, I);
                }), h;
              }(t, n, e(i), {});
            };
          }
          function zo(n, e) {
            return function(t, i) {
              var o;
              if (t === m && i === m) return e;
              if (t !== m && (o = t), i !== m) {
                if (o === m) return i;
                typeof t == "string" || typeof i == "string" ? (t = Pt(t), i = Pt(i)) : (t = ur(t), i = ur(i)), o = n(t, i);
              }
              return o;
            };
          }
          function Ba(n) {
            return Vn(function(e) {
              return e = Yt(e, rr(Ge())), at(function(t) {
                var i = this;
                return n(e, function(o) {
                  return tr(o, i, t);
                });
              });
            });
          }
          function Ds(n, e) {
            var t = (e = e === m ? " " : Pt(e)).length;
            if (t < 2) return t ? ht(e, n) : e;
            var i = ht(e, Lo(n / ii(e)));
            return ya(e) ? $i(vn(i), 0, n).join("") : i.slice(0, n);
          }
          function Ns(n) {
            return function(e, t, i) {
              return i && typeof i != "number" && xn(e, t, i) && (t = i = m), e = tn(e), t === m ? (t = e, e = 0) : t = tn(t), function(o, u, d, h) {
                for (var S = -1, T = gt(Lo((u - o) / (d || 1)), 0), I = ne(T); T--; ) I[h ? T : ++S] = o, o += d;
                return I;
              }(e, t, i = i === m ? e < t ? 1 : -1 : tn(i), n);
            };
          }
          function Ms(n) {
            return function(e, t) {
              return typeof e == "string" && typeof t == "string" || (e = pr(e), t = pr(t)), n(e, t);
            };
          }
          function yc(n, e, t, i, o, u, d, h, S, T) {
            var I = 8 & e;
            e |= I ? f : b, 4 & (e &= ~(I ? b : f)) || (e &= -4);
            var R = [n, e, o, I ? u : m, I ? d : m, I ? m : u, I ? m : d, h, S, T], w = t.apply(m, R);
            return Tc(n) && Qo(w, R), w.placeholder = i, wc(w, n, e);
          }
          function hu(n) {
            var e = on[n];
            return function(t, i) {
              if (t = pr(t), (i = i == null ? 0 : wt(Ne(i), 292)) && Bo(t)) {
                var o = (pt(t) + "e").split("e");
                return +((o = (pt(e(o[0] + "e" + (+o[1] + i))) + "e").split("e"))[0] + "e" + (+o[1] - i));
              }
              return e(t);
            };
          }
          var Gu = ai && 1 / Wr(new ai([, -0]))[1] == O ? function(n) {
            return new ai(n);
          } : yn;
          function wi(n) {
            return function(e) {
              var t = Ln(e);
              return t == Se ? no(e) : t == pe ? oc(e) : function(i, o) {
                return Yt(o, function(u) {
                  return [u, i[u]];
                });
              }(e, n(e));
            };
          }
          function Oi(n, e, t, i, o, u, d, h) {
            var S = 2 & e;
            if (!S && typeof n != "function") throw new Rt(y);
            var T = i ? i.length : 0;
            if (T || (e &= -97, i = o = m), d = d === m ? d : gt(Ne(d), 0), h = h === m ? h : Ne(h), T -= o ? o.length : 0, e & b) {
              var I = i, R = o;
              i = o = m;
            }
            var w = S ? m : zi(n), P = [n, e, t, i, o, I, R, u, d, h];
            if (w && function(j, x) {
              var H = j[1], K = x[1], Q = H | K, ie = Q < 131, ce = K == L && H == 8 || K == L && H == D && j[7].length <= x[8] || K == 384 && x[7].length <= x[8] && H == 8;
              if (!ie && !ce) return j;
              1 & K && (j[2] = x[2], Q |= 1 & H ? 0 : 4);
              var oe = x[3];
              if (oe) {
                var ee = j[3];
                j[3] = ee ? uu(ee, oe, x[4]) : oe, j[4] = ee ? xi(j[3], C) : x[4];
              }
              (oe = x[5]) && (ee = j[5], j[5] = ee ? lr(ee, oe, x[6]) : oe, j[6] = ee ? xi(j[5], C) : x[6]), (oe = x[7]) && (j[7] = oe), K & L && (j[8] = j[8] == null ? x[8] : wt(j[8], x[8])), j[9] == null && (j[9] = x[9]), j[0] = x[0], j[1] = Q;
            }(P, w), n = P[0], e = P[1], t = P[2], i = P[3], o = P[4], !(h = P[9] = P[9] === m ? S ? 0 : n.length : gt(P[9] - T, 0)) && 24 & e && (e &= -25), e && e != 1) B = e == 8 || e == _ ? function(j, x, H) {
              var K = Ma(j);
              return function Q() {
                for (var ie = arguments.length, ce = ne(ie), oe = ie, ee = He(Q); oe--; ) ce[oe] = arguments[oe];
                var fe = ie < 3 && ce[0] !== ee && ce[ie - 1] !== ee ? [] : xi(ce, ee);
                return (ie -= fe.length) < H ? yc(j, x, Er, Q.placeholder, m, ce, fe, m, m, H - ie) : tr(this && this !== je && this instanceof Q ? K : j, this, ce);
              };
            }(n, e, h) : e != f && e != 33 || o.length ? Er.apply(m, P) : function(j, x, H, K) {
              var Q = 1 & x, ie = Ma(j);
              return function ce() {
                for (var oe = -1, ee = arguments.length, fe = -1, ye = K.length, Ce = ne(ye + ee), ve = this && this !== je && this instanceof ce ? ie : j; ++fe < ye; ) Ce[fe] = K[fe];
                for (; ee--; ) Ce[fe++] = arguments[++oe];
                return tr(ve, Q ? H : this, Ce);
              };
            }(n, e, t, i);
            else var B = function(j, x, H) {
              var K = 1 & x, Q = Ma(j);
              return function ie() {
                return (this && this !== je && this instanceof ie ? Q : j).apply(K ? H : this, arguments);
              };
            }(n, e, t);
            return wc((w ? Fn : Qo)(B, P), n, e);
          }
          function Ua(n, e, t, i) {
            return n === m || Yr(n, Ar[t]) && !Fe.call(i, t) ? e : n;
          }
          function ja(n, e, t, i, o, u) {
            return Kt(n) && Kt(e) && (u.set(e, n), Pa(n, e, m, ja, u), u.delete(e)), n;
          }
          function qo(n) {
            return za(n) ? m : n;
          }
          function dr(n, e, t, i, o, u) {
            var d = 1 & t, h = n.length, S = e.length;
            if (h != S && !(d && S > h)) return !1;
            var T = u.get(n), I = u.get(e);
            if (T && I) return T == e && I == n;
            var R = -1, w = !0, P = 2 & t ? new vr() : m;
            for (u.set(n, e), u.set(e, n); ++R < h; ) {
              var B = n[R], j = e[R];
              if (i) var x = d ? i(j, B, R, e, n, u) : i(B, j, R, n, e, u);
              if (x !== m) {
                if (x) continue;
                w = !1;
                break;
              }
              if (P) {
                if (!Qc(e, function(H, K) {
                  if (!to(P, K) && (B === H || o(B, H, t, i, u))) return P.push(K);
                })) {
                  w = !1;
                  break;
                }
              } else if (B !== j && !o(B, j, t, i, u)) {
                w = !1;
                break;
              }
            }
            return u.delete(n), u.delete(e), w;
          }
          function Vn(n) {
            return Ga(An(n, m, xs), n + "");
          }
          function Ai(n) {
            return Rs(n, xt, Ls);
          }
          function qr(n) {
            return Rs(n, ct, gn);
          }
          var zi = Uo ? function(n) {
            return Uo.get(n);
          } : yn;
          function qi(n) {
            for (var e = n.name + "", t = $r[e], i = Fe.call($r, e) ? t.length : 0; i--; ) {
              var o = t[i], u = o.func;
              if (u == null || u == n) return o.name;
            }
            return e;
          }
          function He(n) {
            return (Fe.call(g, "placeholder") ? g : n).placeholder;
          }
          function Ge() {
            var n = g.iteratee || Xn;
            return n = n === Xn ? hc : n, arguments.length ? n(arguments[0], arguments[1]) : n;
          }
          function Fa(n, e) {
            var t, i, o = n.__data__;
            return ((i = typeof (t = e)) == "string" || i == "number" || i == "symbol" || i == "boolean" ? t !== "__proto__" : t === null) ? o[typeof e == "string" ? "string" : "hash"] : o.map;
          }
          function Ki(n) {
            for (var e = xt(n), t = e.length; t--; ) {
              var i = e[t], o = n[i];
              e[t] = [i, o, Cc(o)];
            }
            return e;
          }
          function Mr(n, e) {
            var t = function(i, o) {
              return i == null ? m : i[o];
            }(n, e);
            return Re(t) ? t : m;
          }
          var Ls = Ta ? function(n) {
            return n == null ? [] : (n = Qe(n), ti(Ta(n), function(e) {
              return bs.call(n, e);
            }));
          } : ia, gn = Ta ? function(n) {
            for (var e = []; n; ) lt(e, Ls(n)), n = No(n);
            return e;
          } : ia, Ln = Nt;
          function bc(n, e, t) {
            for (var i = -1, o = (e = li(e, n)).length, u = !1; ++i < o; ) {
              var d = di(e[i]);
              if (!(u = n != null && t(n, d))) break;
              n = n[d];
            }
            return u || ++i != o ? u : !!(o = n == null ? 0 : n.length) && Yi(o) && sn(d, o) && (Be(n) || hi(n));
          }
          function fu(n) {
            return typeof n.constructor != "function" || Yo(n) ? {} : $e(No(n));
          }
          function ki(n) {
            return Be(n) || hi(n) || !!(ru && n && n[ru]);
          }
          function sn(n, e) {
            var t = typeof n;
            return !!(e = e ?? N) && (t == "number" || t != "symbol" && Y.test(n)) && n > -1 && n % 1 == 0 && n < e;
          }
          function xn(n, e, t) {
            if (!Kt(t)) return !1;
            var i = typeof e;
            return !!(i == "number" ? fr(t) && sn(e, t.length) : i == "string" && e in t) && Yr(t[e], n);
          }
          function Ko(n, e) {
            if (Be(n)) return !1;
            var t = typeof n;
            return !(t != "number" && t != "symbol" && t != "boolean" && n != null && !Tt(n)) || Zi.test(n) || !Ni.test(n) || e != null && n in Qe(e);
          }
          function Tc(n) {
            var e = qi(n), t = g[e];
            if (typeof t != "function" || !(e in Ae.prototype)) return !1;
            if (n === t) return !0;
            var i = zi(t);
            return !!i && n === i[0];
          }
          (Ca && Ln(new Ca(new ArrayBuffer(1))) != Jt || me && Ln(new me()) != Se || zt && Ln(zt.resolve()) != X || ai && Ln(new ai()) != pe || ji && Ln(new ji()) != _t) && (Ln = function(n) {
            var e = Nt(n), t = e == J ? n.constructor : m, i = t ? Qn(t) : "";
            if (i) switch (i) {
              case Cl:
                return Jt;
              case jo:
                return Se;
              case Uu:
                return X;
              case Jn:
                return pe;
              case ju:
                return _t;
            }
            return e;
          });
          var Jo = Hr ? fi : Ya;
          function Yo(n) {
            var e = n && n.constructor;
            return n === (typeof e == "function" && e.prototype || Ar);
          }
          function Cc(n) {
            return n == n && !Kt(n);
          }
          function Ic(n, e) {
            return function(t) {
              return t != null && t[n] === e && (e !== m || n in Qe(t));
            };
          }
          function An(n, e, t) {
            return e = gt(e === m ? n.length - 1 : e, 0), function() {
              for (var i = arguments, o = -1, u = gt(i.length - e, 0), d = ne(u); ++o < u; ) d[o] = i[e + o];
              o = -1;
              for (var h = ne(e + 1); ++o < e; ) h[o] = i[o];
              return h[e] = t(d), tr(n, this, h);
            };
          }
          function Va(n, e) {
            return e.length < 2 ? n : sr(n, kr(e, 0, -1));
          }
          function Rc(n, e) {
            if ((e !== "constructor" || typeof n[e] != "function") && e != "__proto__") return n[e];
          }
          var Qo = Pi(Fn), fo = Lu || function(n, e) {
            return je.setTimeout(n, e);
          }, Ga = Pi(lo);
          function wc(n, e, t) {
            var i = e + "";
            return Ga(n, function(o, u) {
              var d = u.length;
              if (!d) return o;
              var h = d - 1;
              return u[h] = (d > 1 ? "& " : "") + u[h], u = u.join(d > 2 ? ", " : " "), o.replace(It, `{
/* [wrapped with ` + u + `] */
`);
            }(i, function(o, u) {
              return wr(q, function(d) {
                var h = "_." + d[0];
                u & d[1] && !Gr(o, h) && o.push(h);
              }), o.sort();
            }(function(o) {
              var u = o.match(jt);
              return u ? u[1].split(us) : [];
            }(i), t)));
          }
          function Pi(n) {
            var e = 0, t = 0;
            return function() {
              var i = sc(), o = 16 - (i - t);
              if (t = i, o > 0) {
                if (++e >= 800) return arguments[0];
              } else e = 0;
              return n.apply(m, arguments);
            };
          }
          function Wa(n, e) {
            var t = -1, i = n.length, o = i - 1;
            for (e = e === m ? i : e; ++t < e; ) {
              var u = Da(t, o), d = n[u];
              n[u] = n[t], n[t] = d;
            }
            return n.length = e, n;
          }
          var Oc = function(n) {
            var e = xc(n, function(i) {
              return t.size === 500 && t.clear(), i;
            }), t = e.cache;
            return e;
          }(function(n) {
            var e = [];
            return n.charCodeAt(0) === 46 && e.push(""), n.replace(ss, function(t, i, o, u) {
              e.push(o ? u.replace(Ke, "$1") : i || t);
            }), e;
          });
          function di(n) {
            if (typeof n == "string" || Tt(n)) return n;
            var e = n + "";
            return e == "0" && 1 / n == -1 / 0 ? "-0" : e;
          }
          function Qn(n) {
            if (n != null) {
              try {
                return xe.call(n);
              } catch {
              }
              try {
                return n + "";
              } catch {
              }
            }
            return "";
          }
          function po(n) {
            if (n instanceof Ae) return n.clone();
            var e = new Qt(n.__wrapped__, n.__chain__);
            return e.__actions__ = fn(n.__actions__), e.__index__ = n.__index__, e.__values__ = n.__values__, e;
          }
          var Wu = at(function(n, e) {
            return yt(n) ? ui(n, bt(e, 1, yt, !0)) : [];
          }), Rl = at(function(n, e) {
            var t = Kr(e);
            return yt(t) && (t = m), yt(n) ? ui(n, bt(e, 1, yt, !0), Ge(t, 2)) : [];
          }), pu = at(function(n, e) {
            var t = Kr(e);
            return yt(t) && (t = m), yt(n) ? ui(n, bt(e, 1, yt, !0), m, t) : [];
          });
          function Ac(n, e, t) {
            var i = n == null ? 0 : n.length;
            if (!i) return -1;
            var o = t == null ? 0 : Ne(t);
            return o < 0 && (o = gt(i + o, 0)), vs(n, Ge(e, 3), o);
          }
          function kc(n, e, t) {
            var i = n == null ? 0 : n.length;
            if (!i) return -1;
            var o = i - 1;
            return t !== m && (o = Ne(t), o = t < 0 ? gt(i + o, 0) : wt(o, i - 1)), vs(n, Ge(e, 3), o, !0);
          }
          function xs(n) {
            return n != null && n.length ? bt(n, 1) : [];
          }
          function gu(n) {
            return n && n.length ? n[0] : m;
          }
          var Hu = at(function(n) {
            var e = Yt(n, Hi);
            return e.length && e[0] === n[0] ? ka(e) : [];
          }), wl = at(function(n) {
            var e = Kr(n), t = Yt(n, Hi);
            return e === Kr(t) ? e = m : t.pop(), t.length && t[0] === n[0] ? ka(t, Ge(e, 2)) : [];
          }), $u = at(function(n) {
            var e = Kr(n), t = Yt(n, Hi);
            return (e = typeof e == "function" ? e : m) && t.pop(), t.length && t[0] === n[0] ? ka(t, m, e) : [];
          });
          function Kr(n) {
            var e = n == null ? 0 : n.length;
            return e ? n[e - 1] : m;
          }
          var hr = at(zu);
          function zu(n, e) {
            return n && n.length && e && e.length ? mc(n, e) : n;
          }
          var qu = Vn(function(n, e) {
            var t = n == null ? 0 : n.length, i = Ia(n, e);
            return As(n, Yt(e, function(o) {
              return sn(o, t) ? +o : o;
            }).sort(cu)), i;
          });
          function Xo(n) {
            return n == null ? n : Bu.call(n);
          }
          var Ha = at(function(n) {
            return Dr(bt(n, 1, yt, !0));
          }), Ku = at(function(n) {
            var e = Kr(n);
            return yt(e) && (e = m), Dr(bt(n, 1, yt, !0), Ge(e, 2));
          }), Ol = at(function(n) {
            var e = Kr(n);
            return e = typeof e == "function" ? e : m, Dr(bt(n, 1, yt, !0), m, e);
          });
          function mu(n) {
            if (!n || !n.length) return [];
            var e = 0;
            return n = ti(n, function(t) {
              if (yt(t)) return e = gt(t.length, e), !0;
            }), Ss(e, function(t) {
              return Yt(n, nr(t));
            });
          }
          function Pc(n, e) {
            if (!n || !n.length) return [];
            var t = mu(n);
            return e == null ? t : Yt(t, function(i) {
              return tr(e, m, i);
            });
          }
          var Ju = at(function(n, e) {
            return yt(n) ? ui(n, e) : [];
          }), Al = at(function(n) {
            return Ti(ti(n, yt));
          }), kl = at(function(n) {
            var e = Kr(n);
            return yt(e) && (e = m), Ti(ti(n, yt), Ge(e, 2));
          }), Yu = at(function(n) {
            var e = Kr(n);
            return e = typeof e == "function" ? e : m, Ti(ti(n, yt), m, e);
          }), Pl = at(mu), Dl = at(function(n) {
            var e = n.length, t = e > 1 ? n[e - 1] : m;
            return t = typeof t == "function" ? (n.pop(), t) : m, Pc(n, t);
          });
          function vu(n) {
            var e = g(n);
            return e.__chain__ = !0, e;
          }
          function Bs(n, e) {
            return e(n);
          }
          var Dc = Vn(function(n) {
            var e = n.length, t = e ? n[0] : 0, i = this.__wrapped__, o = function(u) {
              return Ia(u, n);
            };
            return !(e > 1 || this.__actions__.length) && i instanceof Ae && sn(t) ? ((i = i.slice(t, +t + (e ? 1 : 0))).__actions__.push({ func: Bs, args: [o], thisArg: m }), new Qt(i, this.__chain__).thru(function(u) {
              return e && !u.length && u.push(m), u;
            })) : this.thru(o);
          }), Nl = Ci(function(n, e, t) {
            Fe.call(n, t) ? ++n[t] : _n(n, t, 1);
          }), Ml = Ec(Ac), Ll = Ec(kc);
          function Qu(n, e) {
            return (Be(n) ? wr : jn)(n, Ge(e, 3));
          }
          function _u(n, e) {
            return (Be(n) ? Or : uc)(n, Ge(e, 3));
          }
          var Xu = Ci(function(n, e, t) {
            Fe.call(n, t) ? n[t].push(e) : _n(n, t, [e]);
          }), xl = at(function(n, e, t) {
            var i = -1, o = typeof e == "function", u = fr(n) ? ne(n.length) : [];
            return jn(n, function(d) {
              u[++i] = o ? tr(e, d, t) : Vi(d, e, t);
            }), u;
          }), Zu = Ci(function(n, e, t) {
            _n(n, t, e);
          });
          function Zo(n, e) {
            return (Be(n) ? Yt : fc)(n, Ge(e, 3));
          }
          var Gn = Ci(function(n, e, t) {
            n[t ? 0 : 1].push(e);
          }, function() {
            return [[], []];
          }), Jr = at(function(n, e) {
            if (n == null) return [];
            var t = e.length;
            return t > 1 && xn(n, e[0], e[1]) ? e = [] : t > 2 && xn(e[0], e[1], e[2]) && (e = [e[0]]), uo(n, bt(e, 1), []);
          }), Mt = ba || function() {
            return je.Date.now();
          };
          function Us(n, e, t) {
            return e = t ? m : e, e = n && e == null ? n.length : e, Oi(n, L, m, m, m, m, e);
          }
          function Nc(n, e) {
            var t;
            if (typeof e != "function") throw new Rt(y);
            return n = Ne(n), function() {
              return --n > 0 && (t = e.apply(this, arguments)), n <= 1 && (e = m), t;
            };
          }
          var Mc = at(function(n, e, t) {
            var i = 1;
            if (t.length) {
              var o = xi(t, He(Mc));
              i |= f;
            }
            return Oi(n, i, e, t, o);
          }), js = at(function(n, e, t) {
            var i = 3;
            if (t.length) {
              var o = xi(t, He(js));
              i |= f;
            }
            return Oi(e, i, n, t, o);
          });
          function Lc(n, e, t) {
            var i, o, u, d, h, S, T = 0, I = !1, R = !1, w = !0;
            if (typeof n != "function") throw new Rt(y);
            function P(K) {
              var Q = i, ie = o;
              return i = o = m, T = K, d = n.apply(ie, Q);
            }
            function B(K) {
              var Q = K - S;
              return S === m || Q >= e || Q < 0 || R && K - T >= u;
            }
            function j() {
              var K = Mt();
              if (B(K)) return x(K);
              h = fo(j, function(Q) {
                var ie = e - (Q - S);
                return R ? wt(ie, u - (Q - T)) : ie;
              }(K));
            }
            function x(K) {
              return h = m, w && i ? P(K) : (i = o = m, d);
            }
            function H() {
              var K = Mt(), Q = B(K);
              if (i = arguments, o = this, S = K, Q) {
                if (h === m) return function(ie) {
                  return T = ie, h = fo(j, e), I ? P(ie) : d;
                }(S);
                if (R) return Ps(h), h = fo(j, e), P(S);
              }
              return h === m && (h = fo(j, e)), d;
            }
            return e = pr(e) || 0, Kt(t) && (I = !!t.leading, u = (R = "maxWait" in t) ? gt(pr(t.maxWait) || 0, e) : u, w = "trailing" in t ? !!t.trailing : w), H.cancel = function() {
              h !== m && Ps(h), T = 0, i = S = o = h = m;
            }, H.flush = function() {
              return h === m ? d : x(Mt());
            }, H;
          }
          var el = at(function(n, e) {
            return Is(n, 1, e);
          }), Bl = at(function(n, e, t) {
            return Is(n, pr(e) || 0, t);
          });
          function xc(n, e) {
            if (typeof n != "function" || e != null && typeof e != "function") throw new Rt(y);
            var t = function() {
              var i = arguments, o = e ? e.apply(this, i) : i[0], u = t.cache;
              if (u.has(o)) return u.get(o);
              var d = n.apply(this, i);
              return t.cache = u.set(o, d) || u, d;
            };
            return t.cache = new (xc.Cache || hn)(), t;
          }
          function ea(n) {
            if (typeof n != "function") throw new Rt(y);
            return function() {
              var e = arguments;
              switch (e.length) {
                case 0:
                  return !n.call(this);
                case 1:
                  return !n.call(this, e[0]);
                case 2:
                  return !n.call(this, e[0], e[1]);
                case 3:
                  return !n.call(this, e[0], e[1], e[2]);
              }
              return !n.apply(this, e);
            };
          }
          xc.Cache = hn;
          var Bc = Nr(function(n, e) {
            var t = (e = e.length == 1 && Be(e[0]) ? Yt(e[0], rr(Ge())) : Yt(bt(e, 1), rr(Ge()))).length;
            return at(function(i) {
              for (var o = -1, u = wt(i.length, t); ++o < u; ) i[o] = e[o].call(this, i[o]);
              return tr(n, this, i);
            });
          }), Su = at(function(n, e) {
            var t = xi(e, He(Su));
            return Oi(n, f, m, e, t);
          }), $a = at(function(n, e) {
            var t = xi(e, He($a));
            return Oi(n, b, m, e, t);
          }), Wn = Vn(function(n, e) {
            return Oi(n, D, m, m, m, e);
          });
          function Yr(n, e) {
            return n === e || n != n && e != e;
          }
          var Qr = Ms(Aa), Ul = Ms(function(n, e) {
            return n >= e;
          }), hi = dc(/* @__PURE__ */ function() {
            return arguments;
          }()) ? dc : function(n) {
            return st(n) && Fe.call(n, "callee") && !bs.call(n, "callee");
          }, Be = ne.isArray, ut = ln ? rr(ln) : function(n) {
            return st(n) && Nt(n) == bn;
          };
          function fr(n) {
            return n != null && Yi(n.length) && !fi(n);
          }
          function yt(n) {
            return st(n) && fr(n);
          }
          var ft = yl || Ya, Ji = gs ? rr(gs) : function(n) {
            return st(n) && Nt(n) == Oe;
          };
          function Uc(n) {
            if (!st(n)) return !1;
            var e = Nt(n);
            return e == W || e == "[object DOMException]" || typeof n.message == "string" && typeof n.name == "string" && !za(n);
          }
          function fi(n) {
            if (!Kt(n)) return !1;
            var e = Nt(n);
            return e == ge || e == ke || e == "[object AsyncFunction]" || e == "[object Proxy]";
          }
          function qt(n) {
            return typeof n == "number" && n == Ne(n);
          }
          function Yi(n) {
            return typeof n == "number" && n > -1 && n % 1 == 0 && n <= N;
          }
          function Kt(n) {
            var e = typeof n;
            return n != null && (e == "object" || e == "function");
          }
          function st(n) {
            return n != null && typeof n == "object";
          }
          var pn = Zs ? rr(Zs) : function(n) {
            return st(n) && Ln(n) == Se;
          };
          function Eu(n) {
            return typeof n == "number" || st(n) && Nt(n) == Z;
          }
          function za(n) {
            if (!st(n) || Nt(n) != J) return !1;
            var e = No(n);
            if (e === null) return !0;
            var t = Fe.call(e, "constructor") && e.constructor;
            return typeof t == "function" && t instanceof t && xe.call(t) == vl;
          }
          var pi = ec ? rr(ec) : function(n) {
            return st(n) && Nt(n) == ue;
          }, Sn = ms ? rr(ms) : function(n) {
            return st(n) && Ln(n) == pe;
          };
          function go(n) {
            return typeof n == "string" || !Be(n) && st(n) && Nt(n) == De;
          }
          function Tt(n) {
            return typeof n == "symbol" || st(n) && Nt(n) == Ie;
          }
          var Xt = ma ? rr(ma) : function(n) {
            return st(n) && Yi(n.length) && !!$t[Nt(n)];
          }, qa = Ms(Os), Fs = Ms(function(n, e) {
            return n <= e;
          });
          function Vs(n) {
            if (!n) return [];
            if (fr(n)) return go(n) ? vn(n) : fn(n);
            if (Ui && n[Ui]) return function(t) {
              for (var i, o = []; !(i = t.next()).done; ) o.push(i.value);
              return o;
            }(n[Ui]());
            var e = Ln(n);
            return (e == Se ? no : e == pe ? Wr : En)(n);
          }
          function tn(n) {
            return n ? (n = pr(n)) === O || n === -1 / 0 ? 17976931348623157e292 * (n < 0 ? -1 : 1) : n == n ? n : 0 : n === 0 ? n : 0;
          }
          function Ne(n) {
            var e = tn(n), t = e % 1;
            return e == e ? t ? e - t : e : 0;
          }
          function nt(n) {
            return n ? _r(Ne(n), 0, $) : 0;
          }
          function pr(n) {
            if (typeof n == "number") return n;
            if (Tt(n)) return G;
            if (Kt(n)) {
              var e = typeof n.valueOf == "function" ? n.valueOf() : n;
              n = Kt(e) ? e + "" : e;
            }
            if (typeof n != "string") return n === 0 ? n : +n;
            n = rc(n);
            var t = Co.test(n);
            return t || Io.test(n) ? Kc(n.slice(2), t ? 2 : 8) : Ys.test(n) ? G : +n;
          }
          function Lr(n) {
            return Sr(n, ct(n));
          }
          function pt(n) {
            return n == null ? "" : Pt(n);
          }
          var Me = Ii(function(n, e) {
            if (Yo(e) || fr(e)) Sr(e, xt(e), n);
            else for (var t in e) Fe.call(e, t) && ci(n, t, e[t]);
          }), tl = Ii(function(n, e) {
            Sr(e, ct(e), n);
          }), Gs = Ii(function(n, e, t, i) {
            Sr(e, ct(e), n, i);
          }), jc = Ii(function(n, e, t, i) {
            Sr(e, xt(e), n, i);
          }), jl = Vn(Ia), Fc = at(function(n, e) {
            n = Qe(n);
            var t = -1, i = e.length, o = i > 2 ? e[2] : m;
            for (o && xn(e[0], e[1], o) && (i = 1); ++t < i; ) for (var u = e[t], d = ct(u), h = -1, S = d.length; ++h < S; ) {
              var T = d[h], I = n[T];
              (I === m || Yr(I, Ar[T]) && !Fe.call(n, T)) && (n[T] = u[T]);
            }
            return n;
          }), mo = at(function(n) {
            return n.push(m, ja), tr(na, m, n);
          });
          function ta(n, e, t) {
            var i = n == null ? m : sr(n, e);
            return i === m ? t : i;
          }
          function Ws(n, e) {
            return n != null && bc(n, e, Vu);
          }
          var yu = xa(function(n, e, t) {
            e != null && typeof e.toString != "function" && (e = Je.call(e)), n[e] = t;
          }, Hn(yr)), Fl = xa(function(n, e, t) {
            e != null && typeof e.toString != "function" && (e = Je.call(e)), Fe.call(n, e) ? n[e].push(t) : n[e] = [t];
          }, Ge), Vl = at(Vi);
          function xt(n) {
            return fr(n) ? le(n) : co(n);
          }
          function ct(n) {
            return fr(n) ? le(n, !0) : On(n);
          }
          var mn = Ii(function(n, e, t) {
            Pa(n, e, t);
          }), na = Ii(function(n, e, t, i) {
            Pa(n, e, t, i);
          }), gi = Vn(function(n, e) {
            var t = {};
            if (n == null) return t;
            var i = !1;
            e = Yt(e, function(u) {
              return u = li(u, n), i || (i = u.length > 1), u;
            }), Sr(n, qr(n), t), i && (t = an(t, 7, qo));
            for (var o = e.length; o--; ) Go(t, e[o]);
            return t;
          }), nl = Vn(function(n, e) {
            return n == null ? {} : function(t, i) {
              return gc(t, i, function(o, u) {
                return Ws(t, u);
              });
            }(n, e);
          });
          function Vc(n, e) {
            if (n == null) return {};
            var t = Yt(qr(n), function(i) {
              return [i];
            });
            return e = Ge(e), gc(n, t, function(i, o) {
              return e(i, o[0]);
            });
          }
          var mi = wi(xt), cn = wi(ct);
          function En(n) {
            return n == null ? [] : qn(n, xt(n));
          }
          var ra = Ri(function(n, e, t) {
            return e = e.toLowerCase(), n + (t ? bu(e) : e);
          });
          function bu(n) {
            return Ka(pt(n).toLowerCase());
          }
          function Tu(n) {
            return (n = pt(n)) && n.replace(re, Mu).replace(Fr, "");
          }
          var Cu = Ri(function(n, e, t) {
            return n + (t ? "-" : "") + e.toLowerCase();
          }), rl = Ri(function(n, e, t) {
            return n + (t ? " " : "") + e.toLowerCase();
          }), Gl = $o("toLowerCase"), il = Ri(function(n, e, t) {
            return n + (t ? "_" : "") + e.toLowerCase();
          }), Iu = Ri(function(n, e, t) {
            return n + (t ? " " : "") + Ka(e);
          }), ol = Ri(function(n, e, t) {
            return n + (t ? " " : "") + e.toUpperCase();
          }), Ka = $o("toUpperCase");
          function Ja(n, e, t) {
            return n = pt(n), (e = t ? m : e) === m ? function(i) {
              return pl.test(i);
            }(n) ? function(i) {
              return i.match(ga) || [];
            }(n) : function(i) {
              return i.match(Wc) || [];
            }(n) : n.match(e) || [];
          }
          var Ru = at(function(n, e) {
            try {
              return tr(n, m, e);
            } catch (t) {
              return Uc(t) ? t : new Pe(t);
            }
          }), al = Vn(function(n, e) {
            return wr(e, function(t) {
              t = di(t), _n(n, t, Mc(n[t], n));
            }), n;
          });
          function Hn(n) {
            return function() {
              return n;
            };
          }
          var Hs = La(), vo = La(!0);
          function yr(n) {
            return n;
          }
          function Xn(n) {
            return hc(typeof n == "function" ? n : an(n, 1));
          }
          var Gc = at(function(n, e) {
            return function(t) {
              return Vi(t, n, e);
            };
          }), sl = at(function(n, e) {
            return function(t) {
              return Vi(n, t, e);
            };
          });
          function wu(n, e, t) {
            var i = xt(e), o = ar(e, i);
            t != null || Kt(e) && (o.length || !i.length) || (t = e, e = n, n = this, o = ar(e, xt(e)));
            var u = !(Kt(t) && "chain" in t && !t.chain), d = fi(n);
            return wr(o, function(h) {
              var S = e[h];
              n[h] = S, d && (n.prototype[h] = function() {
                var T = this.__chain__;
                if (u || T) {
                  var I = n(this.__wrapped__);
                  return (I.__actions__ = fn(this.__actions__)).push({ func: S, args: arguments, thisArg: n }), I.__chain__ = T, I;
                }
                return S.apply(n, lt([this.value()], arguments));
              });
            }), n;
          }
          function yn() {
          }
          var Zn = Ba(Yt), _o = Ba(tc), Wl = Ba(Qc);
          function Gt(n) {
            return Ko(n) ? nr(di(n)) : /* @__PURE__ */ function(e) {
              return function(t) {
                return sr(t, e);
              };
            }(n);
          }
          var Ou = Ns(), Hl = Ns(!0);
          function ia() {
            return [];
          }
          function Ya() {
            return !1;
          }
          var Au = zo(function(n, e) {
            return n + e;
          }, 0), So = hu("ceil"), $l = zo(function(n, e) {
            return n / e;
          }, 1), s = hu("floor"), r, a = zo(function(n, e) {
            return n * e;
          }, 1), c = hu("round"), l = zo(function(n, e) {
            return n - e;
          }, 0);
          return g.after = function(n, e) {
            if (typeof e != "function") throw new Rt(y);
            return n = Ne(n), function() {
              if (--n < 1) return e.apply(this, arguments);
            };
          }, g.ary = Us, g.assign = Me, g.assignIn = tl, g.assignInWith = Gs, g.assignWith = jc, g.at = jl, g.before = Nc, g.bind = Mc, g.bindAll = al, g.bindKey = js, g.castArray = function() {
            if (!arguments.length) return [];
            var n = arguments[0];
            return Be(n) ? n : [n];
          }, g.chain = vu, g.chunk = function(n, e, t) {
            e = (t ? xn(n, e, t) : e === m) ? 1 : gt(Ne(e), 0);
            var i = n == null ? 0 : n.length;
            if (!i || e < 1) return [];
            for (var o = 0, u = 0, d = ne(Lo(i / e)); o < i; ) d[u++] = kr(n, o, o += e);
            return d;
          }, g.compact = function(n) {
            for (var e = -1, t = n == null ? 0 : n.length, i = 0, o = []; ++e < t; ) {
              var u = n[e];
              u && (o[i++] = u);
            }
            return o;
          }, g.concat = function() {
            var n = arguments.length;
            if (!n) return [];
            for (var e = ne(n - 1), t = arguments[0], i = n; i--; ) e[i - 1] = arguments[i];
            return lt(Be(t) ? fn(t) : [t], bt(e, 1));
          }, g.cond = function(n) {
            var e = n == null ? 0 : n.length, t = Ge();
            return n = e ? Yt(n, function(i) {
              if (typeof i[1] != "function") throw new Rt(y);
              return [t(i[0]), i[1]];
            }) : [], at(function(i) {
              for (var o = -1; ++o < e; ) {
                var u = n[o];
                if (tr(u[0], this, i)) return tr(u[1], this, i);
              }
            });
          }, g.conforms = function(n) {
            return function(e) {
              var t = xt(e);
              return function(i) {
                return Cs(i, e, t);
              };
            }(an(n, 1));
          }, g.constant = Hn, g.countBy = Nl, g.create = function(n, e) {
            var t = $e(n);
            return e == null ? t : ou(t, e);
          }, g.curry = function n(e, t, i) {
            var o = Oi(e, 8, m, m, m, m, m, t = i ? m : t);
            return o.placeholder = n.placeholder, o;
          }, g.curryRight = function n(e, t, i) {
            var o = Oi(e, _, m, m, m, m, m, t = i ? m : t);
            return o.placeholder = n.placeholder, o;
          }, g.debounce = Lc, g.defaults = Fc, g.defaultsDeep = mo, g.defer = el, g.delay = Bl, g.difference = Wu, g.differenceBy = Rl, g.differenceWith = pu, g.drop = function(n, e, t) {
            var i = n == null ? 0 : n.length;
            return i ? kr(n, (e = t || e === m ? 1 : Ne(e)) < 0 ? 0 : e, i) : [];
          }, g.dropRight = function(n, e, t) {
            var i = n == null ? 0 : n.length;
            return i ? kr(n, 0, (e = i - (e = t || e === m ? 1 : Ne(e))) < 0 ? 0 : e) : [];
          }, g.dropRightWhile = function(n, e) {
            return n && n.length ? Wo(n, Ge(e, 3), !0, !0) : [];
          }, g.dropWhile = function(n, e) {
            return n && n.length ? Wo(n, Ge(e, 3), !0) : [];
          }, g.fill = function(n, e, t, i) {
            var o = n == null ? 0 : n.length;
            return o ? (t && typeof t != "number" && xn(n, e, t) && (t = 0, i = o), function(u, d, h, S) {
              var T = u.length;
              for ((h = Ne(h)) < 0 && (h = -h > T ? 0 : T + h), (S = S === m || S > T ? T : Ne(S)) < 0 && (S += T), S = h > S ? 0 : nt(S); h < S; ) u[h++] = d;
              return u;
            }(n, e, t, i)) : [];
          }, g.filter = function(n, e) {
            return (Be(n) ? ti : lc)(n, Ge(e, 3));
          }, g.flatMap = function(n, e) {
            return bt(Zo(n, e), 1);
          }, g.flatMapDeep = function(n, e) {
            return bt(Zo(n, e), O);
          }, g.flatMapDepth = function(n, e, t) {
            return t = t === m ? 1 : Ne(t), bt(Zo(n, e), t);
          }, g.flatten = xs, g.flattenDeep = function(n) {
            return n != null && n.length ? bt(n, O) : [];
          }, g.flattenDepth = function(n, e) {
            return n != null && n.length ? bt(n, e = e === m ? 1 : Ne(e)) : [];
          }, g.flip = function(n) {
            return Oi(n, 512);
          }, g.flow = Hs, g.flowRight = vo, g.fromPairs = function(n) {
            for (var e = -1, t = n == null ? 0 : n.length, i = {}; ++e < t; ) {
              var o = n[e];
              i[o[0]] = o[1];
            }
            return i;
          }, g.functions = function(n) {
            return n == null ? [] : ar(n, xt(n));
          }, g.functionsIn = function(n) {
            return n == null ? [] : ar(n, ct(n));
          }, g.groupBy = Xu, g.initial = function(n) {
            return n != null && n.length ? kr(n, 0, -1) : [];
          }, g.intersection = Hu, g.intersectionBy = wl, g.intersectionWith = $u, g.invert = yu, g.invertBy = Fl, g.invokeMap = xl, g.iteratee = Xn, g.keyBy = Zu, g.keys = xt, g.keysIn = ct, g.map = Zo, g.mapKeys = function(n, e) {
            var t = {};
            return e = Ge(e, 3), wn(n, function(i, o, u) {
              _n(t, e(i, o, u), i);
            }), t;
          }, g.mapValues = function(n, e) {
            var t = {};
            return e = Ge(e, 3), wn(n, function(i, o, u) {
              _n(t, o, e(i, o, u));
            }), t;
          }, g.matches = function(n) {
            return su(an(n, 1));
          }, g.matchesProperty = function(n, e) {
            return Fo(n, an(e, 1));
          }, g.memoize = xc, g.merge = mn, g.mergeWith = na, g.method = Gc, g.methodOf = sl, g.mixin = wu, g.negate = ea, g.nthArg = function(n) {
            return n = Ne(n), at(function(e) {
              return pc(e, n);
            });
          }, g.omit = gi, g.omitBy = function(n, e) {
            return Vc(n, ea(Ge(e)));
          }, g.once = function(n) {
            return Nc(2, n);
          }, g.orderBy = function(n, e, t, i) {
            return n == null ? [] : (Be(e) || (e = e == null ? [] : [e]), Be(t = i ? m : t) || (t = t == null ? [] : [t]), uo(n, e, t));
          }, g.over = Zn, g.overArgs = Bc, g.overEvery = _o, g.overSome = Wl, g.partial = Su, g.partialRight = $a, g.partition = Gn, g.pick = nl, g.pickBy = Vc, g.property = Gt, g.propertyOf = function(n) {
            return function(e) {
              return n == null ? m : sr(n, e);
            };
          }, g.pull = hr, g.pullAll = zu, g.pullAllBy = function(n, e, t) {
            return n && n.length && e && e.length ? mc(n, e, Ge(t, 2)) : n;
          }, g.pullAllWith = function(n, e, t) {
            return n && n.length && e && e.length ? mc(n, e, m, t) : n;
          }, g.pullAt = qu, g.range = Ou, g.rangeRight = Hl, g.rearg = Wn, g.reject = function(n, e) {
            return (Be(n) ? ti : lc)(n, ea(Ge(e, 3)));
          }, g.remove = function(n, e) {
            var t = [];
            if (!n || !n.length) return t;
            var i = -1, o = [], u = n.length;
            for (e = Ge(e, 3); ++i < u; ) {
              var d = n[i];
              e(d, i, n) && (t.push(d), o.push(i));
            }
            return As(n, o), t;
          }, g.rest = function(n, e) {
            if (typeof n != "function") throw new Rt(y);
            return at(n, e = e === m ? e : Ne(e));
          }, g.reverse = Xo, g.sampleSize = function(n, e, t) {
            return e = (t ? xn(n, e, t) : e === m) ? 1 : Ne(e), (Be(n) ? Il : cr)(n, e);
          }, g.set = function(n, e, t) {
            return n == null ? n : Gi(n, e, t);
          }, g.setWith = function(n, e, t, i) {
            return i = typeof i == "function" ? i : m, n == null ? n : Gi(n, e, t, i);
          }, g.shuffle = function(n) {
            return (Be(n) ? cc : dt)(n);
          }, g.slice = function(n, e, t) {
            var i = n == null ? 0 : n.length;
            return i ? (t && typeof t != "number" && xn(n, e, t) ? (e = 0, t = i) : (e = e == null ? 0 : Ne(e), t = t === m ? i : Ne(t)), kr(n, e, t)) : [];
          }, g.sortBy = Jr, g.sortedUniq = function(n) {
            return n && n.length ? vc(n) : [];
          }, g.sortedUniqBy = function(n, e) {
            return n && n.length ? vc(n, Ge(e, 2)) : [];
          }, g.split = function(n, e, t) {
            return t && typeof t != "number" && xn(n, e, t) && (e = t = m), (t = t === m ? $ : t >>> 0) ? (n = pt(n)) && (typeof e == "string" || e != null && !pi(e)) && !(e = Pt(e)) && ya(n) ? $i(vn(n), 0, t) : n.split(e, t) : [];
          }, g.spread = function(n, e) {
            if (typeof n != "function") throw new Rt(y);
            return e = e == null ? 0 : gt(Ne(e), 0), at(function(t) {
              var i = t[e], o = $i(t, 0, e);
              return i && lt(o, i), tr(n, this, o);
            });
          }, g.tail = function(n) {
            var e = n == null ? 0 : n.length;
            return e ? kr(n, 1, e) : [];
          }, g.take = function(n, e, t) {
            return n && n.length ? kr(n, 0, (e = t || e === m ? 1 : Ne(e)) < 0 ? 0 : e) : [];
          }, g.takeRight = function(n, e, t) {
            var i = n == null ? 0 : n.length;
            return i ? kr(n, (e = i - (e = t || e === m ? 1 : Ne(e))) < 0 ? 0 : e, i) : [];
          }, g.takeRightWhile = function(n, e) {
            return n && n.length ? Wo(n, Ge(e, 3), !1, !0) : [];
          }, g.takeWhile = function(n, e) {
            return n && n.length ? Wo(n, Ge(e, 3)) : [];
          }, g.tap = function(n, e) {
            return e(n), n;
          }, g.throttle = function(n, e, t) {
            var i = !0, o = !0;
            if (typeof n != "function") throw new Rt(y);
            return Kt(t) && (i = "leading" in t ? !!t.leading : i, o = "trailing" in t ? !!t.trailing : o), Lc(n, e, { leading: i, maxWait: e, trailing: o });
          }, g.thru = Bs, g.toArray = Vs, g.toPairs = mi, g.toPairsIn = cn, g.toPath = function(n) {
            return Be(n) ? Yt(n, di) : Tt(n) ? [n] : fn(Oc(pt(n)));
          }, g.toPlainObject = Lr, g.transform = function(n, e, t) {
            var i = Be(n), o = i || ft(n) || Xt(n);
            if (e = Ge(e, 4), t == null) {
              var u = n && n.constructor;
              t = o ? i ? new u() : [] : Kt(n) && fi(u) ? $e(No(n)) : {};
            }
            return (o ? wr : wn)(n, function(d, h, S) {
              return e(t, d, h, S);
            }), t;
          }, g.unary = function(n) {
            return Us(n, 1);
          }, g.union = Ha, g.unionBy = Ku, g.unionWith = Ol, g.uniq = function(n) {
            return n && n.length ? Dr(n) : [];
          }, g.uniqBy = function(n, e) {
            return n && n.length ? Dr(n, Ge(e, 2)) : [];
          }, g.uniqWith = function(n, e) {
            return e = typeof e == "function" ? e : m, n && n.length ? Dr(n, m, e) : [];
          }, g.unset = function(n, e) {
            return n == null || Go(n, e);
          }, g.unzip = mu, g.unzipWith = Pc, g.update = function(n, e, t) {
            return n == null ? n : Wi(n, e, Mn(t));
          }, g.updateWith = function(n, e, t, i) {
            return i = typeof i == "function" ? i : m, n == null ? n : Wi(n, e, Mn(t), i);
          }, g.values = En, g.valuesIn = function(n) {
            return n == null ? [] : qn(n, ct(n));
          }, g.without = Ju, g.words = Ja, g.wrap = function(n, e) {
            return Su(Mn(e), n);
          }, g.xor = Al, g.xorBy = kl, g.xorWith = Yu, g.zip = Pl, g.zipObject = function(n, e) {
            return zr(n || [], e || [], ci);
          }, g.zipObjectDeep = function(n, e) {
            return zr(n || [], e || [], Gi);
          }, g.zipWith = Dl, g.entries = mi, g.entriesIn = cn, g.extend = tl, g.extendWith = Gs, wu(g, g), g.add = Au, g.attempt = Ru, g.camelCase = ra, g.capitalize = bu, g.ceil = So, g.clamp = function(n, e, t) {
            return t === m && (t = e, e = m), t !== m && (t = (t = pr(t)) == t ? t : 0), e !== m && (e = (e = pr(e)) == e ? e : 0), _r(pr(n), e, t);
          }, g.clone = function(n) {
            return an(n, 4);
          }, g.cloneDeep = function(n) {
            return an(n, 5);
          }, g.cloneDeepWith = function(n, e) {
            return an(n, 5, e = typeof e == "function" ? e : m);
          }, g.cloneWith = function(n, e) {
            return an(n, 4, e = typeof e == "function" ? e : m);
          }, g.conformsTo = function(n, e) {
            return e == null || Cs(n, e, xt(e));
          }, g.deburr = Tu, g.defaultTo = function(n, e) {
            return n == null || n != n ? e : n;
          }, g.divide = $l, g.endsWith = function(n, e, t) {
            n = pt(n), e = Pt(e);
            var i = n.length, o = t = t === m ? i : _r(Ne(t), 0, i);
            return (t -= e.length) >= 0 && n.slice(t, o) == e;
          }, g.eq = Yr, g.escape = function(n) {
            return (n = pt(n)) && sa.test(n) ? n.replace(os, gl) : n;
          }, g.escapeRegExp = function(n) {
            return (n = pt(n)) && To.test(n) ? n.replace(Mi, "\\$&") : n;
          }, g.every = function(n, e, t) {
            var i = Be(n) ? tc : au;
            return t && xn(n, e, t) && (e = m), i(n, Ge(e, 3));
          }, g.find = Ml, g.findIndex = Ac, g.findKey = function(n, e) {
            return In(n, Ge(e, 3), wn);
          }, g.findLast = Ll, g.findLastIndex = kc, g.findLastKey = function(n, e) {
            return In(n, Ge(e, 3), Oa);
          }, g.floor = s, g.forEach = Qu, g.forEachRight = _u, g.forIn = function(n, e) {
            return n == null ? n : Ra(n, Ge(e, 3), ct);
          }, g.forInRight = function(n, e) {
            return n == null ? n : wa(n, Ge(e, 3), ct);
          }, g.forOwn = function(n, e) {
            return n && wn(n, Ge(e, 3));
          }, g.forOwnRight = function(n, e) {
            return n && Oa(n, Ge(e, 3));
          }, g.get = ta, g.gt = Qr, g.gte = Ul, g.has = function(n, e) {
            return n != null && bc(n, e, Fu);
          }, g.hasIn = Ws, g.head = gu, g.identity = yr, g.includes = function(n, e, t, i) {
            n = fr(n) ? n : En(n), t = t && !i ? Ne(t) : 0;
            var o = n.length;
            return t < 0 && (t = gt(o + t, 0)), go(n) ? t <= o && n.indexOf(e, t) > -1 : !!o && ri(n, e, t) > -1;
          }, g.indexOf = function(n, e, t) {
            var i = n == null ? 0 : n.length;
            if (!i) return -1;
            var o = t == null ? 0 : Ne(t);
            return o < 0 && (o = gt(i + o, 0)), ri(n, e, o);
          }, g.inRange = function(n, e, t) {
            return e = tn(e), t === m ? (t = e, e = 0) : t = tn(t), function(i, o, u) {
              return i >= wt(o, u) && i < gt(o, u);
            }(n = pr(n), e, t);
          }, g.invoke = Vl, g.isArguments = hi, g.isArray = Be, g.isArrayBuffer = ut, g.isArrayLike = fr, g.isArrayLikeObject = yt, g.isBoolean = function(n) {
            return n === !0 || n === !1 || st(n) && Nt(n) == de;
          }, g.isBuffer = ft, g.isDate = Ji, g.isElement = function(n) {
            return st(n) && n.nodeType === 1 && !za(n);
          }, g.isEmpty = function(n) {
            if (n == null) return !0;
            if (fr(n) && (Be(n) || typeof n == "string" || typeof n.splice == "function" || ft(n) || Xt(n) || hi(n))) return !n.length;
            var e = Ln(n);
            if (e == Se || e == pe) return !n.size;
            if (Yo(n)) return !co(n).length;
            for (var t in n) if (Fe.call(n, t)) return !1;
            return !0;
          }, g.isEqual = function(n, e) {
            return bi(n, e);
          }, g.isEqualWith = function(n, e, t) {
            var i = (t = typeof t == "function" ? t : m) ? t(n, e) : m;
            return i === m ? bi(n, e, m, t) : !!i;
          }, g.isError = Uc, g.isFinite = function(n) {
            return typeof n == "number" && Bo(n);
          }, g.isFunction = fi, g.isInteger = qt, g.isLength = Yi, g.isMap = pn, g.isMatch = function(n, e) {
            return n === e || ws(n, e, Ki(e));
          }, g.isMatchWith = function(n, e, t) {
            return t = typeof t == "function" ? t : m, ws(n, e, Ki(e), t);
          }, g.isNaN = function(n) {
            return Eu(n) && n != +n;
          }, g.isNative = function(n) {
            if (Jo(n)) throw new Pe("Unsupported core-js use. Try https://npms.io/search?q=ponyfill.");
            return Re(n);
          }, g.isNil = function(n) {
            return n == null;
          }, g.isNull = function(n) {
            return n === null;
          }, g.isNumber = Eu, g.isObject = Kt, g.isObjectLike = st, g.isPlainObject = za, g.isRegExp = pi, g.isSafeInteger = function(n) {
            return qt(n) && n >= -9007199254740991 && n <= N;
          }, g.isSet = Sn, g.isString = go, g.isSymbol = Tt, g.isTypedArray = Xt, g.isUndefined = function(n) {
            return n === m;
          }, g.isWeakMap = function(n) {
            return st(n) && Ln(n) == _t;
          }, g.isWeakSet = function(n) {
            return st(n) && Nt(n) == "[object WeakSet]";
          }, g.join = function(n, e) {
            return n == null ? "" : bl.call(n, e);
          }, g.kebabCase = Cu, g.last = Kr, g.lastIndexOf = function(n, e, t) {
            var i = n == null ? 0 : n.length;
            if (!i) return -1;
            var o = i;
            return t !== m && (o = (o = Ne(t)) < 0 ? gt(i + o, 0) : wt(o, i - 1)), e == e ? function(u, d, h) {
              for (var S = h + 1; S--; ) if (u[S] === d) return S;
              return S;
            }(n, e, o) : vs(n, Nu, o, !0);
          }, g.lowerCase = rl, g.lowerFirst = Gl, g.lt = qa, g.lte = Fs, g.max = function(n) {
            return n && n.length ? so(n, yr, Aa) : m;
          }, g.maxBy = function(n, e) {
            return n && n.length ? so(n, Ge(e, 2), Aa) : m;
          }, g.mean = function(n) {
            return Xc(n, yr);
          }, g.meanBy = function(n, e) {
            return Xc(n, Ge(e, 2));
          }, g.min = function(n) {
            return n && n.length ? so(n, yr, Os) : m;
          }, g.minBy = function(n, e) {
            return n && n.length ? so(n, Ge(e, 2), Os) : m;
          }, g.stubArray = ia, g.stubFalse = Ya, g.stubObject = function() {
            return {};
          }, g.stubString = function() {
            return "";
          }, g.stubTrue = function() {
            return !0;
          }, g.multiply = a, g.nth = function(n, e) {
            return n && n.length ? pc(n, Ne(e)) : m;
          }, g.noConflict = function() {
            return je._ === this && (je._ = _l), this;
          }, g.noop = yn, g.now = Mt, g.pad = function(n, e, t) {
            n = pt(n);
            var i = (e = Ne(e)) ? ii(n) : 0;
            if (!e || i >= e) return n;
            var o = (e - i) / 2;
            return Ds(xo(o), t) + n + Ds(Lo(o), t);
          }, g.padEnd = function(n, e, t) {
            n = pt(n);
            var i = (e = Ne(e)) ? ii(n) : 0;
            return e && i < e ? n + Ds(e - i, t) : n;
          }, g.padStart = function(n, e, t) {
            n = pt(n);
            var i = (e = Ne(e)) ? ii(n) : 0;
            return e && i < e ? Ds(e - i, t) + n : n;
          }, g.parseInt = function(n, e, t) {
            return t || e == null ? e = 0 : e && (e = +e), Tl(pt(n).replace(ei, ""), e || 0);
          }, g.random = function(n, e, t) {
            if (t && typeof t != "boolean" && xn(n, e, t) && (e = t = m), t === m && (typeof e == "boolean" ? (t = e, e = m) : typeof n == "boolean" && (t = n, n = m)), n === m && e === m ? (n = 0, e = 1) : (n = tn(n), e === m ? (e = n, n = 0) : e = tn(e)), n > e) {
              var i = n;
              n = e, e = i;
            }
            if (t || n % 1 || e % 1) {
              var o = Ts();
              return wt(n + o * (e - n + qc("1e-" + ((o + "").length - 1))), e);
            }
            return Da(n, e);
          }, g.reduce = function(n, e, t) {
            var i = Be(n) ? ni : _s, o = arguments.length < 3;
            return i(n, Ge(e, 4), t, o, jn);
          }, g.reduceRight = function(n, e, t) {
            var i = Be(n) ? Yc : _s, o = arguments.length < 3;
            return i(n, Ge(e, 4), t, o, uc);
          }, g.repeat = function(n, e, t) {
            return e = (t ? xn(n, e, t) : e === m) ? 1 : Ne(e), ht(pt(n), e);
          }, g.replace = function() {
            var n = arguments, e = pt(n[0]);
            return n.length < 3 ? e : e.replace(n[1], n[2]);
          }, g.result = function(n, e, t) {
            var i = -1, o = (e = li(e, n)).length;
            for (o || (o = 1, n = m); ++i < o; ) {
              var u = n == null ? m : n[di(e[i])];
              u === m && (i = o, u = t), n = fi(u) ? u.call(n) : u;
            }
            return n;
          }, g.round = c, g.runInContext = M, g.sample = function(n) {
            return (Be(n) ? or : Na)(n);
          }, g.size = function(n) {
            if (n == null) return 0;
            if (fr(n)) return go(n) ? ii(n) : n.length;
            var e = Ln(n);
            return e == Se || e == pe ? n.size : co(n).length;
          }, g.snakeCase = il, g.some = function(n, e, t) {
            var i = Be(n) ? Qc : Pr;
            return t && xn(n, e, t) && (e = m), i(n, Ge(e, 3));
          }, g.sortedIndex = function(n, e) {
            return Vo(n, e);
          }, g.sortedIndexBy = function(n, e, t) {
            return ks(n, e, Ge(t, 2));
          }, g.sortedIndexOf = function(n, e) {
            var t = n == null ? 0 : n.length;
            if (t) {
              var i = Vo(n, e);
              if (i < t && Yr(n[i], e)) return i;
            }
            return -1;
          }, g.sortedLastIndex = function(n, e) {
            return Vo(n, e, !0);
          }, g.sortedLastIndexBy = function(n, e, t) {
            return ks(n, e, Ge(t, 2), !0);
          }, g.sortedLastIndexOf = function(n, e) {
            if (n != null && n.length) {
              var t = Vo(n, e, !0) - 1;
              if (Yr(n[t], e)) return t;
            }
            return -1;
          }, g.startCase = Iu, g.startsWith = function(n, e, t) {
            return n = pt(n), t = t == null ? 0 : _r(Ne(t), 0, n.length), e = Pt(e), n.slice(t, t + e.length) == e;
          }, g.subtract = l, g.sum = function(n) {
            return n && n.length ? nc(n, yr) : 0;
          }, g.sumBy = function(n, e) {
            return n && n.length ? nc(n, Ge(e, 2)) : 0;
          }, g.template = function(n, e, t) {
            var i = g.templateSettings;
            t && xn(n, e, t) && (e = m), n = pt(n), e = Gs({}, e, i, Ua);
            var o, u, d = Gs({}, e.imports, i.imports, Ua), h = xt(d), S = qn(d, h), T = 0, I = e.interpolate || he, R = "__p += '", w = Es((e.escape || he).source + "|" + I.source + "|" + (I === bo ? Js : he).source + "|" + (e.evaluate || he).source + "|$", "g"), P = "//# sourceURL=" + (Fe.call(e, "sourceURL") ? (e.sourceURL + "").replace(/\s/g, " ") : "lodash.templateSources[" + ++zc + "]") + `
`;
            n.replace(w, function(x, H, K, Q, ie, ce) {
              return K || (K = Q), R += n.slice(T, ce).replace(be, ml), H && (o = !0, R += `' +
__e(` + H + `) +
'`), ie && (u = !0, R += `';
` + ie + `;
__p += '`), K && (R += `' +
((__t = (` + K + `)) == null ? '' : __t) +
'`), T = ce + x.length, x;
            }), R += `';
`;
            var B = Fe.call(e, "variable") && e.variable;
            if (B) {
              if (zn.test(B)) throw new Pe("Invalid `variable` option passed into `_.template`");
            } else R = `with (obj) {
` + R + `
}
`;
            R = (u ? R.replace(qe, "") : R).replace(Zr, "$1").replace(Ks, "$1;"), R = "function(" + (B || "obj") + `) {
` + (B ? "" : `obj || (obj = {});
`) + "var __t, __p = ''" + (o ? ", __e = _.escape" : "") + (u ? `, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
` : `;
`) + R + `return __p
}`;
            var j = Ru(function() {
              return Ze(h, P + "return " + R).apply(m, S);
            });
            if (j.source = R, Uc(j)) throw j;
            return j;
          }, g.times = function(n, e) {
            if ((n = Ne(n)) < 1 || n > N) return [];
            var t = $, i = wt(n, $);
            e = Ge(e), n -= $;
            for (var o = Ss(i, e); ++t < n; ) e(t);
            return o;
          }, g.toFinite = tn, g.toInteger = Ne, g.toLength = nt, g.toLower = function(n) {
            return pt(n).toLowerCase();
          }, g.toNumber = pr, g.toSafeInteger = function(n) {
            return n ? _r(Ne(n), -9007199254740991, N) : n === 0 ? n : 0;
          }, g.toString = pt, g.toUpper = function(n) {
            return pt(n).toUpperCase();
          }, g.trim = function(n, e, t) {
            if ((n = pt(n)) && (t || e === m)) return rc(n);
            if (!n || !(e = Pt(e))) return n;
            var i = vn(n), o = vn(e);
            return $i(i, Ea(i, o), Zc(i, o) + 1).join("");
          }, g.trimEnd = function(n, e, t) {
            if ((n = pt(n)) && (t || e === m)) return n.slice(0, dn(n) + 1);
            if (!n || !(e = Pt(e))) return n;
            var i = vn(n);
            return $i(i, 0, Zc(i, vn(e)) + 1).join("");
          }, g.trimStart = function(n, e, t) {
            if ((n = pt(n)) && (t || e === m)) return n.replace(ei, "");
            if (!n || !(e = Pt(e))) return n;
            var i = vn(n);
            return $i(i, Ea(i, vn(e))).join("");
          }, g.truncate = function(n, e) {
            var t = 30, i = "...";
            if (Kt(e)) {
              var o = "separator" in e ? e.separator : o;
              t = "length" in e ? Ne(e.length) : t, i = "omission" in e ? Pt(e.omission) : i;
            }
            var u = (n = pt(n)).length;
            if (ya(n)) {
              var d = vn(n);
              u = d.length;
            }
            if (t >= u) return n;
            var h = t - ii(i);
            if (h < 1) return i;
            var S = d ? $i(d, 0, h).join("") : n.slice(0, h);
            if (o === m) return S + i;
            if (d && (h += S.length - h), pi(o)) {
              if (n.slice(h).search(o)) {
                var T, I = S;
                for (o.global || (o = Es(o.source, pt(Si.exec(o)) + "g")), o.lastIndex = 0; T = o.exec(I); ) var R = T.index;
                S = S.slice(0, R === m ? h : R);
              }
            } else if (n.indexOf(Pt(o), h) != h) {
              var w = S.lastIndexOf(o);
              w > -1 && (S = S.slice(0, w));
            }
            return S + i;
          }, g.unescape = function(n) {
            return (n = pt(n)) && as.test(n) ? n.replace(un, ac) : n;
          }, g.uniqueId = function(n) {
            var e = ++eu;
            return pt(n) + e;
          }, g.upperCase = ol, g.upperFirst = Ka, g.each = Qu, g.eachRight = _u, g.first = gu, wu(g, (r = {}, wn(g, function(n, e) {
            Fe.call(g.prototype, e) || (r[e] = n);
          }), r), { chain: !1 }), g.VERSION = "4.17.21", wr(["bind", "bindKey", "curry", "curryRight", "partial", "partialRight"], function(n) {
            g[n].placeholder = g;
          }), wr(["drop", "take"], function(n, e) {
            Ae.prototype[n] = function(t) {
              t = t === m ? 1 : gt(Ne(t), 0);
              var i = this.__filtered__ && !e ? new Ae(this) : this.clone();
              return i.__filtered__ ? i.__takeCount__ = wt(t, i.__takeCount__) : i.__views__.push({ size: wt(t, $), type: n + (i.__dir__ < 0 ? "Right" : "") }), i;
            }, Ae.prototype[n + "Right"] = function(t) {
              return this.reverse()[n](t).reverse();
            };
          }), wr(["filter", "map", "takeWhile"], function(n, e) {
            var t = e + 1, i = t == 1 || t == 3;
            Ae.prototype[n] = function(o) {
              var u = this.clone();
              return u.__iteratees__.push({ iteratee: Ge(o, 3), type: t }), u.__filtered__ = u.__filtered__ || i, u;
            };
          }), wr(["head", "last"], function(n, e) {
            var t = "take" + (e ? "Right" : "");
            Ae.prototype[n] = function() {
              return this[t](1).value()[0];
            };
          }), wr(["initial", "tail"], function(n, e) {
            var t = "drop" + (e ? "" : "Right");
            Ae.prototype[n] = function() {
              return this.__filtered__ ? new Ae(this) : this[t](1);
            };
          }), Ae.prototype.compact = function() {
            return this.filter(yr);
          }, Ae.prototype.find = function(n) {
            return this.filter(n).head();
          }, Ae.prototype.findLast = function(n) {
            return this.reverse().find(n);
          }, Ae.prototype.invokeMap = at(function(n, e) {
            return typeof n == "function" ? new Ae(this) : this.map(function(t) {
              return Vi(t, n, e);
            });
          }), Ae.prototype.reject = function(n) {
            return this.filter(ea(Ge(n)));
          }, Ae.prototype.slice = function(n, e) {
            n = Ne(n);
            var t = this;
            return t.__filtered__ && (n > 0 || e < 0) ? new Ae(t) : (n < 0 ? t = t.takeRight(-n) : n && (t = t.drop(n)), e !== m && (t = (e = Ne(e)) < 0 ? t.dropRight(-e) : t.take(e - n)), t);
          }, Ae.prototype.takeRightWhile = function(n) {
            return this.reverse().takeWhile(n).reverse();
          }, Ae.prototype.toArray = function() {
            return this.take($);
          }, wn(Ae.prototype, function(n, e) {
            var t = /^(?:filter|find|map|reject)|While$/.test(e), i = /^(?:head|last)$/.test(e), o = g[i ? "take" + (e == "last" ? "Right" : "") : e], u = i || /^find/.test(e);
            o && (g.prototype[e] = function() {
              var d = this.__wrapped__, h = i ? [1] : arguments, S = d instanceof Ae, T = h[0], I = S || Be(d), R = function(H) {
                var K = o.apply(g, lt([H], h));
                return i && w ? K[0] : K;
              };
              I && t && typeof T == "function" && T.length != 1 && (S = I = !1);
              var w = this.__chain__, P = !!this.__actions__.length, B = u && !w, j = S && !P;
              if (!u && I) {
                d = j ? d : new Ae(this);
                var x = n.apply(d, h);
                return x.__actions__.push({ func: Bs, args: [R], thisArg: m }), new Qt(x, w);
              }
              return B && j ? n.apply(this, h) : (x = this.thru(R), B ? i ? x.value()[0] : x.value() : x);
            });
          }), wr(["pop", "push", "shift", "sort", "splice", "unshift"], function(n) {
            var e = Bi[n], t = /^(?:push|sort|unshift)$/.test(n) ? "tap" : "thru", i = /^(?:pop|shift)$/.test(n);
            g.prototype[n] = function() {
              var o = arguments;
              if (i && !this.__chain__) {
                var u = this.value();
                return e.apply(Be(u) ? u : [], o);
              }
              return this[t](function(d) {
                return e.apply(Be(d) ? d : [], o);
              });
            };
          }), wn(Ae.prototype, function(n, e) {
            var t = g[e];
            if (t) {
              var i = t.name + "";
              Fe.call($r, i) || ($r[i] = []), $r[i].push({ name: e, func: t });
            }
          }), $r[Er(m, 2).name] = [{ name: "wrapper", func: m }], Ae.prototype.clone = function() {
            var n = new Ae(this.__wrapped__);
            return n.__actions__ = fn(this.__actions__), n.__dir__ = this.__dir__, n.__filtered__ = this.__filtered__, n.__iteratees__ = fn(this.__iteratees__), n.__takeCount__ = this.__takeCount__, n.__views__ = fn(this.__views__), n;
          }, Ae.prototype.reverse = function() {
            if (this.__filtered__) {
              var n = new Ae(this);
              n.__dir__ = -1, n.__filtered__ = !0;
            } else (n = this.clone()).__dir__ *= -1;
            return n;
          }, Ae.prototype.value = function() {
            var n = this.__wrapped__.value(), e = this.__dir__, t = Be(n), i = e < 0, o = t ? n.length : 0, u = function(ce, oe, ee) {
              for (var fe = -1, ye = ee.length; ++fe < ye; ) {
                var Ce = ee[fe], ve = Ce.size;
                switch (Ce.type) {
                  case "drop":
                    ce += ve;
                    break;
                  case "dropRight":
                    oe -= ve;
                    break;
                  case "take":
                    oe = wt(oe, ce + ve);
                    break;
                  case "takeRight":
                    ce = gt(ce, oe - ve);
                }
              }
              return { start: ce, end: oe };
            }(0, o, this.__views__), d = u.start, h = u.end, S = h - d, T = i ? h : d - 1, I = this.__iteratees__, R = I.length, w = 0, P = wt(S, this.__takeCount__);
            if (!t || !i && o == S && P == S) return _c(n, this.__actions__);
            var B = [];
            e: for (; S-- && w < P; ) {
              for (var j = -1, x = n[T += e]; ++j < R; ) {
                var H = I[j], K = H.iteratee, Q = H.type, ie = K(x);
                if (Q == 2) x = ie;
                else if (!ie) {
                  if (Q == 1) continue e;
                  break e;
                }
              }
              B[w++] = x;
            }
            return B;
          }, g.prototype.at = Dc, g.prototype.chain = function() {
            return vu(this);
          }, g.prototype.commit = function() {
            return new Qt(this.value(), this.__chain__);
          }, g.prototype.next = function() {
            this.__values__ === m && (this.__values__ = Vs(this.value()));
            var n = this.__index__ >= this.__values__.length;
            return { done: n, value: n ? m : this.__values__[this.__index__++] };
          }, g.prototype.plant = function(n) {
            for (var e, t = this; t instanceof si; ) {
              var i = po(t);
              i.__index__ = 0, i.__values__ = m, e ? o.__wrapped__ = i : e = i;
              var o = i;
              t = t.__wrapped__;
            }
            return o.__wrapped__ = n, e;
          }, g.prototype.reverse = function() {
            var n = this.__wrapped__;
            if (n instanceof Ae) {
              var e = n;
              return this.__actions__.length && (e = new Ae(this)), (e = e.reverse()).__actions__.push({ func: Bs, args: [Xo], thisArg: m }), new Qt(e, this.__chain__);
            }
            return this.thru(Xo);
          }, g.prototype.toJSON = g.prototype.valueOf = g.prototype.value = function() {
            return _c(this.__wrapped__, this.__actions__);
          }, g.prototype.first = g.prototype.head, Ui && (g.prototype[Ui] = function() {
            return this;
          }), g;
        }();
        je._ = Do, (v = (function() {
          return Do;
        }).call(A, p, A, k)) === m || (k.exports = v);
      }).call(this);
    }, 5364: (k, A, p) => {
      var v = p(5250), m = p(999)(function(y, E, C) {
        v(y, E, C);
      });
      k.exports = m;
    }, 9935: (k) => {
      k.exports = function() {
        return !1;
      };
    }, 9884: (k, A, p) => {
      var v = p(1791), m = p(7241);
      k.exports = function(y) {
        return v(y, m(y));
      };
    }, 5602: (k) => {
      var A = k.exports = { v: [{ name: "version", reg: /^(\d*)$/ }], o: [{ name: "origin", reg: /^(\S*) (\d*) (\d*) (\S*) IP(\d) (\S*)/, names: ["username", "sessionId", "sessionVersion", "netType", "ipVer", "address"], format: "%s %s %d %s IP%d %s" }], s: [{ name: "name" }], i: [{ name: "description" }], u: [{ name: "uri" }], e: [{ name: "email" }], p: [{ name: "phone" }], z: [{ name: "timezones" }], r: [{ name: "repeats" }], t: [{ name: "timing", reg: /^(\d*) (\d*)/, names: ["start", "stop"], format: "%d %d" }], c: [{ name: "connection", reg: /^IN IP(\d) (\S*)/, names: ["version", "ip"], format: "IN IP%d %s" }], b: [{ push: "bandwidth", reg: /^(TIAS|AS|CT|RR|RS):(\d*)/, names: ["type", "limit"], format: "%s:%s" }], m: [{ reg: /^(\w*) (\d*) ([\w/]*)(?: (.*))?/, names: ["type", "port", "protocol", "payloads"], format: "%s %d %s %s" }], a: [{ push: "rtp", reg: /^rtpmap:(\d*) ([\w\-.]*)(?:\s*\/(\d*)(?:\s*\/(\S*))?)?/, names: ["payload", "codec", "rate", "encoding"], format: function(p) {
        return p.encoding ? "rtpmap:%d %s/%s/%s" : p.rate ? "rtpmap:%d %s/%s" : "rtpmap:%d %s";
      } }, { push: "fmtp", reg: /^fmtp:(\d*) ([\S| ]*)/, names: ["payload", "config"], format: "fmtp:%d %s" }, { name: "control", reg: /^control:(.*)/, format: "control:%s" }, { name: "rtcp", reg: /^rtcp:(\d*)(?: (\S*) IP(\d) (\S*))?/, names: ["port", "netType", "ipVer", "address"], format: function(p) {
        return p.address != null ? "rtcp:%d %s IP%d %s" : "rtcp:%d";
      } }, { push: "rtcpFbTrrInt", reg: /^rtcp-fb:(\*|\d*) trr-int (\d*)/, names: ["payload", "value"], format: "rtcp-fb:%s trr-int %d" }, { push: "rtcpFb", reg: /^rtcp-fb:(\*|\d*) ([\w-_]*)(?: ([\w-_]*))?/, names: ["payload", "type", "subtype"], format: function(p) {
        return p.subtype != null ? "rtcp-fb:%s %s %s" : "rtcp-fb:%s %s";
      } }, { push: "ext", reg: /^extmap:(\d+)(?:\/(\w+))?(?: (urn:ietf:params:rtp-hdrext:encrypt))? (\S*)(?: (\S*))?/, names: ["value", "direction", "encrypt-uri", "uri", "config"], format: function(p) {
        return "extmap:%d" + (p.direction ? "/%s" : "%v") + (p["encrypt-uri"] ? " %s" : "%v") + " %s" + (p.config ? " %s" : "");
      } }, { name: "extmapAllowMixed", reg: /^(extmap-allow-mixed)/ }, { push: "crypto", reg: /^crypto:(\d*) ([\w_]*) (\S*)(?: (\S*))?/, names: ["id", "suite", "config", "sessionConfig"], format: function(p) {
        return p.sessionConfig != null ? "crypto:%d %s %s %s" : "crypto:%d %s %s";
      } }, { name: "setup", reg: /^setup:(\w*)/, format: "setup:%s" }, { name: "connectionType", reg: /^connection:(new|existing)/, format: "connection:%s" }, { name: "mid", reg: /^mid:([^\s]*)/, format: "mid:%s" }, { name: "msid", reg: /^msid:(.*)/, format: "msid:%s" }, { name: "ptime", reg: /^ptime:(\d*(?:\.\d*)*)/, format: "ptime:%d" }, { name: "maxptime", reg: /^maxptime:(\d*(?:\.\d*)*)/, format: "maxptime:%d" }, { name: "direction", reg: /^(sendrecv|recvonly|sendonly|inactive)/ }, { name: "icelite", reg: /^(ice-lite)/ }, { name: "iceUfrag", reg: /^ice-ufrag:(\S*)/, format: "ice-ufrag:%s" }, { name: "icePwd", reg: /^ice-pwd:(\S*)/, format: "ice-pwd:%s" }, { name: "fingerprint", reg: /^fingerprint:(\S*) (\S*)/, names: ["type", "hash"], format: "fingerprint:%s %s" }, { push: "candidates", reg: /^candidate:(\S*) (\d*) (\S*) (\d*) (\S*) (\d*) typ (\S*)(?: raddr (\S*) rport (\d*))?(?: tcptype (\S*))?(?: generation (\d*))?(?: network-id (\d*))?(?: network-cost (\d*))?/, names: ["foundation", "component", "transport", "priority", "ip", "port", "type", "raddr", "rport", "tcptype", "generation", "network-id", "network-cost"], format: function(p) {
        var v = "candidate:%s %d %s %d %s %d typ %s";
        return v += p.raddr != null ? " raddr %s rport %d" : "%v%v", v += p.tcptype != null ? " tcptype %s" : "%v", p.generation != null && (v += " generation %d"), v += p["network-id"] != null ? " network-id %d" : "%v", v += p["network-cost"] != null ? " network-cost %d" : "%v";
      } }, { name: "endOfCandidates", reg: /^(end-of-candidates)/ }, { name: "remoteCandidates", reg: /^remote-candidates:(.*)/, format: "remote-candidates:%s" }, { name: "iceOptions", reg: /^ice-options:(\S*)/, format: "ice-options:%s" }, { push: "ssrcs", reg: /^ssrc:(\d*) ([\w_-]*)(?::(.*))?/, names: ["id", "attribute", "value"], format: function(p) {
        var v = "ssrc:%d";
        return p.attribute != null && (v += " %s", p.value != null && (v += ":%s")), v;
      } }, { push: "ssrcGroups", reg: /^ssrc-group:([\x21\x23\x24\x25\x26\x27\x2A\x2B\x2D\x2E\w]*) (.*)/, names: ["semantics", "ssrcs"], format: "ssrc-group:%s %s" }, { name: "msidSemantic", reg: /^msid-semantic:\s?(\w*) (\S*)/, names: ["semantic", "token"], format: "msid-semantic: %s %s" }, { push: "groups", reg: /^group:(\w*) (.*)/, names: ["type", "mids"], format: "group:%s %s" }, { name: "rtcpMux", reg: /^(rtcp-mux)/ }, { name: "rtcpRsize", reg: /^(rtcp-rsize)/ }, { name: "sctpmap", reg: /^sctpmap:([\w_/]*) (\S*)(?: (\S*))?/, names: ["sctpmapNumber", "app", "maxMessageSize"], format: function(p) {
        return p.maxMessageSize != null ? "sctpmap:%s %s %s" : "sctpmap:%s %s";
      } }, { name: "xGoogleFlag", reg: /^x-google-flag:([^\s]*)/, format: "x-google-flag:%s" }, { push: "rids", reg: /^rid:([\d\w]+) (\w+)(?: ([\S| ]*))?/, names: ["id", "direction", "params"], format: function(p) {
        return p.params ? "rid:%s %s %s" : "rid:%s %s";
      } }, { push: "imageattrs", reg: new RegExp("^imageattr:(\\d+|\\*)[\\s\\t]+(send|recv)[\\s\\t]+(\\*|\\[\\S+\\](?:[\\s\\t]+\\[\\S+\\])*)(?:[\\s\\t]+(recv|send)[\\s\\t]+(\\*|\\[\\S+\\](?:[\\s\\t]+\\[\\S+\\])*))?"), names: ["pt", "dir1", "attrs1", "dir2", "attrs2"], format: function(p) {
        return "imageattr:%s %s %s" + (p.dir2 ? " %s %s" : "");
      } }, { name: "simulcast", reg: new RegExp("^simulcast:(send|recv) ([a-zA-Z0-9\\-_~;,]+)(?:\\s?(send|recv) ([a-zA-Z0-9\\-_~;,]+))?$"), names: ["dir1", "list1", "dir2", "list2"], format: function(p) {
        return "simulcast:%s %s" + (p.dir2 ? " %s %s" : "");
      } }, { name: "simulcast_03", reg: /^simulcast:[\s\t]+([\S+\s\t]+)$/, names: ["value"], format: "simulcast: %s" }, { name: "framerate", reg: /^framerate:(\d+(?:$|\.\d+))/, format: "framerate:%s" }, { name: "sourceFilter", reg: /^source-filter: *(excl|incl) (\S*) (IP4|IP6|\*) (\S*) (.*)/, names: ["filterMode", "netType", "addressTypes", "destAddress", "srcList"], format: "source-filter: %s %s %s %s %s" }, { name: "bundleOnly", reg: /^(bundle-only)/ }, { name: "label", reg: /^label:(.+)/, format: "label:%s" }, { name: "sctpPort", reg: /^sctp-port:(\d+)$/, format: "sctp-port:%s" }, { name: "maxMessageSize", reg: /^max-message-size:(\d+)$/, format: "max-message-size:%s" }, { push: "tsRefClocks", reg: /^ts-refclk:([^\s=]*)(?:=(\S*))?/, names: ["clksrc", "clksrcExt"], format: function(p) {
        return "ts-refclk:%s" + (p.clksrcExt != null ? "=%s" : "");
      } }, { name: "mediaClk", reg: /^mediaclk:(?:id=(\S*))? *([^\s=]*)(?:=(\S*))?(?: *rate=(\d+)\/(\d+))?/, names: ["id", "mediaClockName", "mediaClockValue", "rateNumerator", "rateDenominator"], format: function(p) {
        var v = "mediaclk:";
        return v += p.id != null ? "id=%s %s" : "%v%s", v += p.mediaClockValue != null ? "=%s" : "", v += p.rateNumerator != null ? " rate=%s" : "", v += p.rateDenominator != null ? "/%s" : "";
      } }, { name: "keywords", reg: /^keywds:(.+)$/, format: "keywds:%s" }, { name: "content", reg: /^content:(.+)/, format: "content:%s" }, { name: "bfcpFloorCtrl", reg: /^floorctrl:(c-only|s-only|c-s)/, format: "floorctrl:%s" }, { name: "bfcpConfId", reg: /^confid:(\d+)/, format: "confid:%s" }, { name: "bfcpUserId", reg: /^userid:(\d+)/, format: "userid:%s" }, { name: "bfcpFloorId", reg: /^floorid:(.+) (?:m-stream|mstrm):(.+)/, names: ["id", "mStream"], format: "floorid:%s mstrm:%s" }, { push: "invalid", names: ["value"] }] };
      Object.keys(A).forEach(function(p) {
        A[p].forEach(function(v) {
          v.reg || (v.reg = /(.*)/), v.format || (v.format = "%s");
        });
      });
    }, 7363: (k, A, p) => {
      var v = p(5020), m = p(3804);
      A.M9 = m, A.qg = v.parse, A.Sl = v.parseParams, v.parseFmtpConfig, v.parsePayloads, v.parseRemoteCandidates, v.parseImageAttributes, v.parseSimulcastStreamList;
    }, 5020: (k, A, p) => {
      var v = function(_) {
        return String(Number(_)) === _ ? Number(_) : _;
      }, m = function(_, f, b) {
        var L = _.name && _.names;
        _.push && !f[_.push] ? f[_.push] = [] : L && !f[_.name] && (f[_.name] = {});
        var D = _.push ? {} : L ? f[_.name] : f;
        (function(O, N, G, $) {
          if ($ && !G) N[$] = v(O[1]);
          else for (var q = 0; q < G.length; q += 1) O[q + 1] != null && (N[G[q]] = v(O[q + 1]));
        })(b.match(_.reg), D, _.names, _.name), _.push && f[_.push].push(D);
      }, y = p(5602), E = RegExp.prototype.test.bind(/^([a-z])=(.*)/);
      A.parse = function(_) {
        var f = {}, b = [], L = f;
        return _.split(/(\r\n|\r|\n)/).filter(E).forEach(function(D) {
          var O = D[0], N = D.slice(2);
          O === "m" && (b.push({ rtp: [], fmtp: [] }), L = b[b.length - 1]);
          for (var G = 0; G < (y[O] || []).length; G += 1) {
            var $ = y[O][G];
            if ($.reg.test(N)) return m($, L, N);
          }
        }), f.media = b, f;
      };
      var C = function(_, f) {
        var b = f.split(/=(.+)/, 2);
        return b.length === 2 ? _[b[0]] = v(b[1]) : b.length === 1 && f.length > 1 && (_[b[0]] = void 0), _;
      };
      A.parseParams = function(_) {
        return _.split(/;\s?/).reduce(C, {});
      }, A.parseFmtpConfig = A.parseParams, A.parsePayloads = function(_) {
        return _.toString().split(" ").map(Number);
      }, A.parseRemoteCandidates = function(_) {
        for (var f = [], b = _.split(" ").map(v), L = 0; L < b.length; L += 3) f.push({ component: b[L], ip: b[L + 1], port: b[L + 2] });
        return f;
      }, A.parseImageAttributes = function(_) {
        return _.split(" ").map(function(f) {
          return f.substring(1, f.length - 1).split(",").reduce(C, {});
        });
      }, A.parseSimulcastStreamList = function(_) {
        return _.split(";").map(function(f) {
          return f.split(",").map(function(b) {
            var L, D = !1;
            return b[0] !== "~" ? L = v(b) : (L = v(b.substring(1, b.length)), D = !0), { scid: L, paused: D };
          });
        });
      };
    }, 3804: (k, A, p) => {
      var v = p(5602), m = /%[sdv%]/g, y = function(f) {
        var b = 1, L = arguments, D = L.length;
        return f.replace(m, function(O) {
          if (b >= D) return O;
          var N = L[b];
          switch (b += 1, O) {
            case "%%":
              return "%";
            case "%s":
              return String(N);
            case "%d":
              return Number(N);
            case "%v":
              return "";
          }
        });
      }, E = function(f, b, L) {
        var D = [f + "=" + (b.format instanceof Function ? b.format(b.push ? L : L[b.name]) : b.format)];
        if (b.names) for (var O = 0; O < b.names.length; O += 1) {
          var N = b.names[O];
          b.name ? D.push(L[b.name][N]) : D.push(L[b.names[O]]);
        }
        else D.push(L[b.name]);
        return y.apply(null, D);
      }, C = ["v", "o", "s", "i", "u", "e", "p", "c", "b", "t", "r", "z", "a"], _ = ["i", "c", "b", "a"];
      k.exports = function(f, b) {
        b = b || {}, f.version == null && (f.version = 0), f.name == null && (f.name = " "), f.media.forEach(function(N) {
          N.payloads == null && (N.payloads = "");
        });
        var L = b.outerOrder || C, D = b.innerOrder || _, O = [];
        return L.forEach(function(N) {
          v[N].forEach(function(G) {
            G.name in f && f[G.name] != null ? O.push(E(N, G, f)) : G.push in f && f[G.push] != null && f[G.push].forEach(function($) {
              O.push(E(N, G, $));
            });
          });
        }), f.media.forEach(function(N) {
          O.push(E("m", v.m[0], N)), D.forEach(function(G) {
            v[G].forEach(function($) {
              $.name in N && N[$.name] != null ? O.push(E(G, $, N)) : $.push in N && N[$.push] != null && N[$.push].forEach(function(q) {
                O.push(E(G, $, q));
              });
            });
          });
        }), O.join(`\r
`) + `\r
`;
      };
    }, 7963: (k) => {
      const A = { generateIdentifier: function() {
        return Math.random().toString(36).substring(2, 12);
      } };
      A.localCName = A.generateIdentifier(), A.splitLines = function(p) {
        return p.trim().split(`
`).map((v) => v.trim());
      }, A.splitSections = function(p) {
        return p.split(`
m=`).map((v, m) => (m > 0 ? "m=" + v : v).trim() + `\r
`);
      }, A.getDescription = function(p) {
        const v = A.splitSections(p);
        return v && v[0];
      }, A.getMediaSections = function(p) {
        const v = A.splitSections(p);
        return v.shift(), v;
      }, A.matchPrefix = function(p, v) {
        return A.splitLines(p).filter((m) => m.indexOf(v) === 0);
      }, A.parseCandidate = function(p) {
        let v;
        v = p.indexOf("a=candidate:") === 0 ? p.substring(12).split(" ") : p.substring(10).split(" ");
        const m = { foundation: v[0], component: { 1: "rtp", 2: "rtcp" }[v[1]] || v[1], protocol: v[2].toLowerCase(), priority: parseInt(v[3], 10), ip: v[4], address: v[4], port: parseInt(v[5], 10), type: v[7] };
        for (let y = 8; y < v.length; y += 2) switch (v[y]) {
          case "raddr":
            m.relatedAddress = v[y + 1];
            break;
          case "rport":
            m.relatedPort = parseInt(v[y + 1], 10);
            break;
          case "tcptype":
            m.tcpType = v[y + 1];
            break;
          case "ufrag":
            m.ufrag = v[y + 1], m.usernameFragment = v[y + 1];
            break;
          default:
            m[v[y]] === void 0 && (m[v[y]] = v[y + 1]);
        }
        return m;
      }, A.writeCandidate = function(p) {
        const v = [];
        v.push(p.foundation);
        const m = p.component;
        m === "rtp" ? v.push(1) : m === "rtcp" ? v.push(2) : v.push(m), v.push(p.protocol.toUpperCase()), v.push(p.priority), v.push(p.address || p.ip), v.push(p.port);
        const y = p.type;
        return v.push("typ"), v.push(y), y !== "host" && p.relatedAddress && p.relatedPort && (v.push("raddr"), v.push(p.relatedAddress), v.push("rport"), v.push(p.relatedPort)), p.tcpType && p.protocol.toLowerCase() === "tcp" && (v.push("tcptype"), v.push(p.tcpType)), (p.usernameFragment || p.ufrag) && (v.push("ufrag"), v.push(p.usernameFragment || p.ufrag)), "candidate:" + v.join(" ");
      }, A.parseIceOptions = function(p) {
        return p.substring(14).split(" ");
      }, A.parseRtpMap = function(p) {
        let v = p.substring(9).split(" ");
        const m = { payloadType: parseInt(v.shift(), 10) };
        return v = v[0].split("/"), m.name = v[0], m.clockRate = parseInt(v[1], 10), m.channels = v.length === 3 ? parseInt(v[2], 10) : 1, m.numChannels = m.channels, m;
      }, A.writeRtpMap = function(p) {
        let v = p.payloadType;
        p.preferredPayloadType !== void 0 && (v = p.preferredPayloadType);
        const m = p.channels || p.numChannels || 1;
        return "a=rtpmap:" + v + " " + p.name + "/" + p.clockRate + (m !== 1 ? "/" + m : "") + `\r
`;
      }, A.parseExtmap = function(p) {
        const v = p.substring(9).split(" ");
        return { id: parseInt(v[0], 10), direction: v[0].indexOf("/") > 0 ? v[0].split("/")[1] : "sendrecv", uri: v[1], attributes: v.slice(2).join(" ") };
      }, A.writeExtmap = function(p) {
        return "a=extmap:" + (p.id || p.preferredId) + (p.direction && p.direction !== "sendrecv" ? "/" + p.direction : "") + " " + p.uri + (p.attributes ? " " + p.attributes : "") + `\r
`;
      }, A.parseFmtp = function(p) {
        const v = {};
        let m;
        const y = p.substring(p.indexOf(" ") + 1).split(";");
        for (let E = 0; E < y.length; E++) m = y[E].trim().split("="), v[m[0].trim()] = m[1];
        return v;
      }, A.writeFmtp = function(p) {
        let v = "", m = p.payloadType;
        if (p.preferredPayloadType !== void 0 && (m = p.preferredPayloadType), p.parameters && Object.keys(p.parameters).length) {
          const y = [];
          Object.keys(p.parameters).forEach((E) => {
            p.parameters[E] !== void 0 ? y.push(E + "=" + p.parameters[E]) : y.push(E);
          }), v += "a=fmtp:" + m + " " + y.join(";") + `\r
`;
        }
        return v;
      }, A.parseRtcpFb = function(p) {
        const v = p.substring(p.indexOf(" ") + 1).split(" ");
        return { type: v.shift(), parameter: v.join(" ") };
      }, A.writeRtcpFb = function(p) {
        let v = "", m = p.payloadType;
        return p.preferredPayloadType !== void 0 && (m = p.preferredPayloadType), p.rtcpFeedback && p.rtcpFeedback.length && p.rtcpFeedback.forEach((y) => {
          v += "a=rtcp-fb:" + m + " " + y.type + (y.parameter && y.parameter.length ? " " + y.parameter : "") + `\r
`;
        }), v;
      }, A.parseSsrcMedia = function(p) {
        const v = p.indexOf(" "), m = { ssrc: parseInt(p.substring(7, v), 10) }, y = p.indexOf(":", v);
        return y > -1 ? (m.attribute = p.substring(v + 1, y), m.value = p.substring(y + 1)) : m.attribute = p.substring(v + 1), m;
      }, A.parseSsrcGroup = function(p) {
        const v = p.substring(13).split(" ");
        return { semantics: v.shift(), ssrcs: v.map((m) => parseInt(m, 10)) };
      }, A.getMid = function(p) {
        const v = A.matchPrefix(p, "a=mid:")[0];
        if (v) return v.substring(6);
      }, A.parseFingerprint = function(p) {
        const v = p.substring(14).split(" ");
        return { algorithm: v[0].toLowerCase(), value: v[1].toUpperCase() };
      }, A.getDtlsParameters = function(p, v) {
        return { role: "auto", fingerprints: A.matchPrefix(p + v, "a=fingerprint:").map(A.parseFingerprint) };
      }, A.writeDtlsParameters = function(p, v) {
        let m = "a=setup:" + v + `\r
`;
        return p.fingerprints.forEach((y) => {
          m += "a=fingerprint:" + y.algorithm + " " + y.value + `\r
`;
        }), m;
      }, A.parseCryptoLine = function(p) {
        const v = p.substring(9).split(" ");
        return { tag: parseInt(v[0], 10), cryptoSuite: v[1], keyParams: v[2], sessionParams: v.slice(3) };
      }, A.writeCryptoLine = function(p) {
        return "a=crypto:" + p.tag + " " + p.cryptoSuite + " " + (typeof p.keyParams == "object" ? A.writeCryptoKeyParams(p.keyParams) : p.keyParams) + (p.sessionParams ? " " + p.sessionParams.join(" ") : "") + `\r
`;
      }, A.parseCryptoKeyParams = function(p) {
        if (p.indexOf("inline:") !== 0) return null;
        const v = p.substring(7).split("|");
        return { keyMethod: "inline", keySalt: v[0], lifeTime: v[1], mkiValue: v[2] ? v[2].split(":")[0] : void 0, mkiLength: v[2] ? v[2].split(":")[1] : void 0 };
      }, A.writeCryptoKeyParams = function(p) {
        return p.keyMethod + ":" + p.keySalt + (p.lifeTime ? "|" + p.lifeTime : "") + (p.mkiValue && p.mkiLength ? "|" + p.mkiValue + ":" + p.mkiLength : "");
      }, A.getCryptoParameters = function(p, v) {
        return A.matchPrefix(p + v, "a=crypto:").map(A.parseCryptoLine);
      }, A.getIceParameters = function(p, v) {
        const m = A.matchPrefix(p + v, "a=ice-ufrag:")[0], y = A.matchPrefix(p + v, "a=ice-pwd:")[0];
        return m && y ? { usernameFragment: m.substring(12), password: y.substring(10) } : null;
      }, A.writeIceParameters = function(p) {
        let v = "a=ice-ufrag:" + p.usernameFragment + `\r
a=ice-pwd:` + p.password + `\r
`;
        return p.iceLite && (v += `a=ice-lite\r
`), v;
      }, A.parseRtpParameters = function(p) {
        const v = { codecs: [], headerExtensions: [], fecMechanisms: [], rtcp: [] }, m = A.splitLines(p)[0].split(" ");
        v.profile = m[2];
        for (let E = 3; E < m.length; E++) {
          const C = m[E], _ = A.matchPrefix(p, "a=rtpmap:" + C + " ")[0];
          if (_) {
            const f = A.parseRtpMap(_), b = A.matchPrefix(p, "a=fmtp:" + C + " ");
            switch (f.parameters = b.length ? A.parseFmtp(b[0]) : {}, f.rtcpFeedback = A.matchPrefix(p, "a=rtcp-fb:" + C + " ").map(A.parseRtcpFb), v.codecs.push(f), f.name.toUpperCase()) {
              case "RED":
              case "ULPFEC":
                v.fecMechanisms.push(f.name.toUpperCase());
            }
          }
        }
        A.matchPrefix(p, "a=extmap:").forEach((E) => {
          v.headerExtensions.push(A.parseExtmap(E));
        });
        const y = A.matchPrefix(p, "a=rtcp-fb:* ").map(A.parseRtcpFb);
        return v.codecs.forEach((E) => {
          y.forEach((C) => {
            E.rtcpFeedback.find((_) => _.type === C.type && _.parameter === C.parameter) || E.rtcpFeedback.push(C);
          });
        }), v;
      }, A.writeRtpDescription = function(p, v) {
        let m = "";
        m += "m=" + p + " ", m += v.codecs.length > 0 ? "9" : "0", m += " " + (v.profile || "UDP/TLS/RTP/SAVPF") + " ", m += v.codecs.map((E) => E.preferredPayloadType !== void 0 ? E.preferredPayloadType : E.payloadType).join(" ") + `\r
`, m += `c=IN IP4 0.0.0.0\r
`, m += `a=rtcp:9 IN IP4 0.0.0.0\r
`, v.codecs.forEach((E) => {
          m += A.writeRtpMap(E), m += A.writeFmtp(E), m += A.writeRtcpFb(E);
        });
        let y = 0;
        return v.codecs.forEach((E) => {
          E.maxptime > y && (y = E.maxptime);
        }), y > 0 && (m += "a=maxptime:" + y + `\r
`), v.headerExtensions && v.headerExtensions.forEach((E) => {
          m += A.writeExtmap(E);
        }), m;
      }, A.parseRtpEncodingParameters = function(p) {
        const v = [], m = A.parseRtpParameters(p), y = m.fecMechanisms.indexOf("RED") !== -1, E = m.fecMechanisms.indexOf("ULPFEC") !== -1, C = A.matchPrefix(p, "a=ssrc:").map((D) => A.parseSsrcMedia(D)).filter((D) => D.attribute === "cname"), _ = C.length > 0 && C[0].ssrc;
        let f;
        const b = A.matchPrefix(p, "a=ssrc-group:FID").map((D) => D.substring(17).split(" ").map((O) => parseInt(O, 10)));
        b.length > 0 && b[0].length > 1 && b[0][0] === _ && (f = b[0][1]), m.codecs.forEach((D) => {
          if (D.name.toUpperCase() === "RTX" && D.parameters.apt) {
            let O = { ssrc: _, codecPayloadType: parseInt(D.parameters.apt, 10) };
            _ && f && (O.rtx = { ssrc: f }), v.push(O), y && (O = JSON.parse(JSON.stringify(O)), O.fec = { ssrc: _, mechanism: E ? "red+ulpfec" : "red" }, v.push(O));
          }
        }), v.length === 0 && _ && v.push({ ssrc: _ });
        let L = A.matchPrefix(p, "b=");
        return L.length && (L = L[0].indexOf("b=TIAS:") === 0 ? parseInt(L[0].substring(7), 10) : L[0].indexOf("b=AS:") === 0 ? 1e3 * parseInt(L[0].substring(5), 10) * 0.95 - 16e3 : void 0, v.forEach((D) => {
          D.maxBitrate = L;
        })), v;
      }, A.parseRtcpParameters = function(p) {
        const v = {}, m = A.matchPrefix(p, "a=ssrc:").map((C) => A.parseSsrcMedia(C)).filter((C) => C.attribute === "cname")[0];
        m && (v.cname = m.value, v.ssrc = m.ssrc);
        const y = A.matchPrefix(p, "a=rtcp-rsize");
        v.reducedSize = y.length > 0, v.compound = y.length === 0;
        const E = A.matchPrefix(p, "a=rtcp-mux");
        return v.mux = E.length > 0, v;
      }, A.writeRtcpParameters = function(p) {
        let v = "";
        return p.reducedSize && (v += `a=rtcp-rsize\r
`), p.mux && (v += `a=rtcp-mux\r
`), p.ssrc !== void 0 && p.cname && (v += "a=ssrc:" + p.ssrc + " cname:" + p.cname + `\r
`), v;
      }, A.parseMsid = function(p) {
        let v;
        const m = A.matchPrefix(p, "a=msid:");
        if (m.length === 1) return v = m[0].substring(7).split(" "), { stream: v[0], track: v[1] };
        const y = A.matchPrefix(p, "a=ssrc:").map((E) => A.parseSsrcMedia(E)).filter((E) => E.attribute === "msid");
        return y.length > 0 ? (v = y[0].value.split(" "), { stream: v[0], track: v[1] }) : void 0;
      }, A.parseSctpDescription = function(p) {
        const v = A.parseMLine(p), m = A.matchPrefix(p, "a=max-message-size:");
        let y;
        m.length > 0 && (y = parseInt(m[0].substring(19), 10)), isNaN(y) && (y = 65536);
        const E = A.matchPrefix(p, "a=sctp-port:");
        if (E.length > 0) return { port: parseInt(E[0].substring(12), 10), protocol: v.fmt, maxMessageSize: y };
        const C = A.matchPrefix(p, "a=sctpmap:");
        if (C.length > 0) {
          const _ = C[0].substring(10).split(" ");
          return { port: parseInt(_[0], 10), protocol: _[1], maxMessageSize: y };
        }
      }, A.writeSctpDescription = function(p, v) {
        let m = [];
        return m = p.protocol !== "DTLS/SCTP" ? ["m=" + p.kind + " 9 " + p.protocol + " " + v.protocol + `\r
`, `c=IN IP4 0.0.0.0\r
`, "a=sctp-port:" + v.port + `\r
`] : ["m=" + p.kind + " 9 " + p.protocol + " " + v.port + `\r
`, `c=IN IP4 0.0.0.0\r
`, "a=sctpmap:" + v.port + " " + v.protocol + ` 65535\r
`], v.maxMessageSize !== void 0 && m.push("a=max-message-size:" + v.maxMessageSize + `\r
`), m.join("");
      }, A.generateSessionId = function() {
        return Math.random().toString().substr(2, 22);
      }, A.writeSessionBoilerplate = function(p, v, m) {
        let y;
        const E = v !== void 0 ? v : 2;
        return y = p || A.generateSessionId(), `v=0\r
o=` + (m || "thisisadapterortc") + " " + y + " " + E + ` IN IP4 127.0.0.1\r
s=-\r
t=0 0\r
`;
      }, A.getDirection = function(p, v) {
        const m = A.splitLines(p);
        for (let y = 0; y < m.length; y++) switch (m[y]) {
          case "a=sendrecv":
          case "a=sendonly":
          case "a=recvonly":
          case "a=inactive":
            return m[y].substring(2);
        }
        return v ? A.getDirection(v) : "sendrecv";
      }, A.getKind = function(p) {
        return A.splitLines(p)[0].split(" ")[0].substring(2);
      }, A.isRejected = function(p) {
        return p.split(" ", 2)[1] === "0";
      }, A.parseMLine = function(p) {
        const v = A.splitLines(p)[0].substring(2).split(" ");
        return { kind: v[0], port: parseInt(v[1], 10), protocol: v[2], fmt: v.slice(3).join(" ") };
      }, A.parseOLine = function(p) {
        const v = A.matchPrefix(p, "o=")[0].substring(2).split(" ");
        return { username: v[0], sessionId: v[1], sessionVersion: parseInt(v[2], 10), netType: v[3], addressType: v[4], address: v[5] };
      }, A.isValidSDP = function(p) {
        if (typeof p != "string" || p.length === 0) return !1;
        const v = A.splitLines(p);
        for (let m = 0; m < v.length; m++) if (v[m].length < 2 || v[m].charAt(1) !== "=") return !1;
        return !0;
      }, k.exports = A;
    }, 5512: (k) => {
      k.exports = function(A, p, v, m) {
        var y = self || window;
        try {
          try {
            var E;
            try {
              E = new y.Blob([A]);
            } catch {
              (E = new (y.BlobBuilder || y.WebKitBlobBuilder || y.MozBlobBuilder || y.MSBlobBuilder)()).append(A), E = E.getBlob();
            }
            var C = y.URL || y.webkitURL, _ = C.createObjectURL(E), f = new y[p](_, v);
            return C.revokeObjectURL(_), f;
          } catch {
            return new y[p]("data:application/javascript,".concat(encodeURIComponent(A)), v);
          }
        } catch {
          if (!m) throw Error("Inline worker is not supported");
          return new y[p](m, v);
        }
      };
    }, 8630: (k, A, p) => {
      var v;
      (function(m) {
        (function() {
          var y = typeof globalThis == "object" ? globalThis : typeof p.g == "object" ? p.g : typeof self == "object" ? self : typeof this == "object" ? this : function() {
            try {
              return Function("return this;")();
            } catch {
            }
          }() || function() {
            try {
              return (0, eval)("(function() { return this; })()");
            } catch {
            }
          }(), E = C(m);
          function C(_, f) {
            return function(b, L) {
              Object.defineProperty(_, b, { configurable: !0, writable: !0, value: L }), f && f(b, L);
            };
          }
          y.Reflect !== void 0 && (E = C(y.Reflect, E)), function(_, f) {
            var b = Object.prototype.hasOwnProperty, L = typeof Symbol == "function", D = L && Symbol.toPrimitive !== void 0 ? Symbol.toPrimitive : "@@toPrimitive", O = L && Symbol.iterator !== void 0 ? Symbol.iterator : "@@iterator", N = typeof Object.create == "function", G = { __proto__: [] } instanceof Array, $ = !N && !G, q = { create: N ? function() {
              return Io(/* @__PURE__ */ Object.create(null));
            } : G ? function() {
              return Io({ __proto__: null });
            } : function() {
              return Io({});
            }, has: $ ? function(Y, re) {
              return b.call(Y, re);
            } : function(Y, re) {
              return re in Y;
            }, get: $ ? function(Y, re) {
              return b.call(Y, re) ? Y[re] : void 0;
            } : function(Y, re) {
              return Y[re];
            } }, te = Object.getPrototypeOf(Function), ae = typeof Map == "function" && typeof Map.prototype.entries == "function" ? Map : Ys(), de = typeof Set == "function" && typeof Set.prototype.entries == "function" ? Set : Co(), Oe = typeof WeakMap == "function" ? WeakMap : ca(), W = L ? Symbol.for("@reflect-metadata:registry") : void 0, ge = zn(), ke = Ke(ge);
            function Se(Y, re, he, be) {
              if (qe(he)) {
                if (!bo(Y)) throw new TypeError();
                if (!Zi(re)) throw new TypeError();
                return Jt(Y, re);
              }
              if (!bo(Y)) throw new TypeError();
              if (!un(re)) throw new TypeError();
              if (!un(be) && !qe(be) && !Zr(be)) throw new TypeError();
              return Zr(be) && (be = void 0), Dn(Y, re, he = er(he), be);
            }
            function Z(Y, re) {
              function he(be, Xe) {
                if (!un(be)) throw new TypeError();
                if (!qe(Xe) && !ss(Xe)) throw new TypeError();
                $n(Y, re, be, Xe);
              }
              return he;
            }
            function J(Y, re, he, be) {
              if (!un(he)) throw new TypeError();
              return qe(be) || (be = er(be)), $n(Y, re, he, be);
            }
            function X(Y, re, he) {
              if (!un(re)) throw new TypeError();
              return qe(he) || (he = er(he)), kn(Y, re, he);
            }
            function ue(Y, re, he) {
              if (!un(re)) throw new TypeError();
              return qe(he) || (he = er(he)), Ur(Y, re, he);
            }
            function pe(Y, re, he) {
              if (!un(re)) throw new TypeError();
              return qe(he) || (he = er(he)), Tr(Y, re, he);
            }
            function De(Y, re, he) {
              if (!un(re)) throw new TypeError();
              return qe(he) || (he = er(he)), gr(Y, re, he);
            }
            function Ie(Y, re) {
              if (!un(Y)) throw new TypeError();
              return qe(re) || (re = er(re)), jr(Y, re);
            }
            function _t(Y, re) {
              if (!un(Y)) throw new TypeError();
              return qe(re) || (re = er(re)), Cr(Y, re);
            }
            function bn(Y, re, he) {
              if (!un(re)) throw new TypeError();
              if (qe(he) || (he = er(he)), !un(re)) throw new TypeError();
              qe(he) || (he = er(he));
              var be = Si(re, he, !1);
              return !qe(be) && be.OrdinaryDeleteMetadata(Y, re, he);
            }
            function Jt(Y, re) {
              for (var he = Y.length - 1; he >= 0; --he) {
                var be = (0, Y[he])(re);
                if (!qe(be) && !Zr(be)) {
                  if (!Zi(be)) throw new TypeError();
                  re = be;
                }
              }
              return re;
            }
            function Dn(Y, re, he, be) {
              for (var Xe = Y.length - 1; Xe >= 0; --Xe) {
                var en = (0, Y[Xe])(re, he, be);
                if (!qe(en) && !Zr(en)) {
                  if (!un(en)) throw new TypeError();
                  be = en;
                }
              }
              return be;
            }
            function kn(Y, re, he) {
              if (Ur(Y, re, he)) return !0;
              var be = us(re);
              return !Zr(be) && kn(Y, be, he);
            }
            function Ur(Y, re, he) {
              var be = Si(re, he, !1);
              return !qe(be) && sa(be.OrdinaryHasOwnMetadata(Y, re, he));
            }
            function Tr(Y, re, he) {
              if (Ur(Y, re, he)) return gr(Y, re, he);
              var be = us(re);
              return Zr(be) ? void 0 : Tr(Y, be, he);
            }
            function gr(Y, re, he) {
              var be = Si(re, he, !1);
              if (!qe(be)) return be.OrdinaryGetOwnMetadata(Y, re, he);
            }
            function $n(Y, re, he, be) {
              Si(he, be, !0).OrdinaryDefineOwnMetadata(Y, re, he, be);
            }
            function jr(Y, re) {
              var he = Cr(Y, re), be = us(Y);
              if (be === null) return he;
              var Xe = jr(be, re);
              if (Xe.length <= 0) return he;
              if (he.length <= 0) return Xe;
              for (var en = new de(), it = [], tt = 0, Ue = he; tt < Ue.length; tt++) {
                var we = Ue[tt];
                en.has(we) || (en.add(we), it.push(we));
              }
              for (var Ve = 0, We = Xe; Ve < We.length; Ve++)
                we = We[Ve], en.has(we) || (en.add(we), it.push(we));
              return it;
            }
            function Cr(Y, re) {
              var he = Si(Y, re, !1);
              return he ? he.OrdinaryOwnMetadataKeys(Y, re) : [];
            }
            function Ir(Y) {
              if (Y === null) return 1;
              switch (typeof Y) {
                case "undefined":
                  return 0;
                case "boolean":
                  return 2;
                case "string":
                  return 3;
                case "symbol":
                  return 4;
                case "number":
                  return 5;
                case "object":
                  return Y === null ? 1 : 6;
                default:
                  return 6;
              }
            }
            function qe(Y) {
              return Y === void 0;
            }
            function Zr(Y) {
              return Y === null;
            }
            function Ks(Y) {
              return typeof Y == "symbol";
            }
            function un(Y) {
              return typeof Y == "object" ? Y !== null : typeof Y == "function";
            }
            function os(Y, re) {
              switch (Ir(Y)) {
                case 0:
                case 1:
                case 2:
                case 3:
                case 4:
                case 5:
                  return Y;
              }
              var he = "string", be = To(Y, D);
              if (be !== void 0) {
                var Xe = be.call(Y, he);
                if (un(Xe)) throw new TypeError();
                return Xe;
              }
              return as(Y);
            }
            function as(Y, re) {
              var he, be;
              {
                var Xe = Y.toString;
                if (Ni(Xe) && !un(be = Xe.call(Y)) || Ni(he = Y.valueOf) && !un(be = he.call(Y))) return be;
              }
              throw new TypeError();
            }
            function sa(Y) {
              return !!Y;
            }
            function yo(Y) {
              return "" + Y;
            }
            function er(Y) {
              var re = os(Y);
              return Ks(re) ? re : yo(re);
            }
            function bo(Y) {
              return Array.isArray ? Array.isArray(Y) : Y instanceof Object ? Y instanceof Array : Object.prototype.toString.call(Y) === "[object Array]";
            }
            function Ni(Y) {
              return typeof Y == "function";
            }
            function Zi(Y) {
              return typeof Y == "function";
            }
            function ss(Y) {
              switch (Ir(Y)) {
                case 3:
                case 4:
                  return !0;
                default:
                  return !1;
              }
            }
            function Mi(Y, re) {
              return Y === re || Y != Y && re != re;
            }
            function To(Y, re) {
              var he = Y[re];
              if (he != null) {
                if (!Ni(he)) throw new TypeError();
                return he;
              }
            }
            function ei(Y) {
              var re = To(Y, O);
              if (!Ni(re)) throw new TypeError();
              var he = re.call(Y);
              if (!un(he)) throw new TypeError();
              return he;
            }
            function cs(Y) {
              return Y.value;
            }
            function It(Y) {
              var re = Y.next();
              return !re.done && re;
            }
            function jt(Y) {
              var re = Y.return;
              re && re.call(Y);
            }
            function us(Y) {
              var re = Object.getPrototypeOf(Y);
              if (typeof Y != "function" || Y === te || re !== te) return re;
              var he = Y.prototype, be = he && Object.getPrototypeOf(he);
              if (be == null || be === Object.prototype) return re;
              var Xe = be.constructor;
              return typeof Xe != "function" || Xe === Y ? re : Xe;
            }
            function Wc() {
              var Y, re, he, be;
              qe(W) || f.Reflect === void 0 || W in f.Reflect || typeof f.Reflect.defineMetadata != "function" || (Y = Js(f.Reflect));
              var Xe = new Oe(), en = { registerProvider: it, getProvider: Ue, setProvider: Ve };
              return en;
              function it(We) {
                if (!Object.isExtensible(en)) throw new Error("Cannot add provider to a frozen registry.");
                switch (!0) {
                  case Y === We:
                    break;
                  case qe(re):
                    re = We;
                    break;
                  case re === We:
                    break;
                  case qe(he):
                    he = We;
                    break;
                  case he === We:
                    break;
                  default:
                    be === void 0 && (be = new de()), be.add(We);
                }
              }
              function tt(We, St) {
                if (!qe(re)) {
                  if (re.isProviderFor(We, St)) return re;
                  if (!qe(he)) {
                    if (he.isProviderFor(We, St)) return re;
                    if (!qe(be)) for (var Ft = ei(be); ; ) {
                      var Ht = It(Ft);
                      if (!Ht) return;
                      var Tn = cs(Ht);
                      if (Tn.isProviderFor(We, St)) return jt(Ft), Tn;
                    }
                  }
                }
                if (!qe(Y) && Y.isProviderFor(We, St)) return Y;
              }
              function Ue(We, St) {
                var Ft, Ht = Xe.get(We);
                return qe(Ht) || (Ft = Ht.get(St)), qe(Ft) && (qe(Ft = tt(We, St)) || (qe(Ht) && (Ht = new ae(), Xe.set(We, Ht)), Ht.set(St, Ft))), Ft;
              }
              function we(We) {
                if (qe(We)) throw new TypeError();
                return re === We || he === We || !qe(be) && be.has(We);
              }
              function Ve(We, St, Ft) {
                if (!we(Ft)) throw new Error("Metadata provider not registered.");
                var Ht = Ue(We, St);
                if (Ht !== Ft) {
                  if (!qe(Ht)) return !1;
                  var Tn = Xe.get(We);
                  qe(Tn) && (Tn = new ae(), Xe.set(We, Tn)), Tn.set(St, Ft);
                }
                return !0;
              }
            }
            function zn() {
              var Y;
              return !qe(W) && un(f.Reflect) && Object.isExtensible(f.Reflect) && (Y = f.Reflect[W]), qe(Y) && (Y = Wc()), !qe(W) && un(f.Reflect) && Object.isExtensible(f.Reflect) && Object.defineProperty(f.Reflect, W, { enumerable: !1, configurable: !1, writable: !1, value: Y }), Y;
            }
            function Ke(Y) {
              var re = new Oe(), he = { isProviderFor: function(we, Ve) {
                var We = re.get(we);
                return !qe(We) && We.has(Ve);
              }, OrdinaryDefineOwnMetadata: it, OrdinaryHasOwnMetadata: Xe, OrdinaryGetOwnMetadata: en, OrdinaryOwnMetadataKeys: tt, OrdinaryDeleteMetadata: Ue };
              return ge.registerProvider(he), he;
              function be(we, Ve, We) {
                var St = re.get(we), Ft = !1;
                if (qe(St)) {
                  if (!We) return;
                  St = new ae(), re.set(we, St), Ft = !0;
                }
                var Ht = St.get(Ve);
                if (qe(Ht)) {
                  if (!We) return;
                  if (Ht = new ae(), St.set(Ve, Ht), !Y.setProvider(we, Ve, he)) throw St.delete(Ve), Ft && re.delete(we), new Error("Wrong provider for target.");
                }
                return Ht;
              }
              function Xe(we, Ve, We) {
                var St = be(Ve, We, !1);
                return !qe(St) && sa(St.has(we));
              }
              function en(we, Ve, We) {
                var St = be(Ve, We, !1);
                if (!qe(St)) return St.get(we);
              }
              function it(we, Ve, We, St) {
                be(We, St, !0).set(we, Ve);
              }
              function tt(we, Ve) {
                var We = [], St = be(we, Ve, !1);
                if (qe(St)) return We;
                for (var Ft = ei(St.keys()), Ht = 0; ; ) {
                  var Tn = It(Ft);
                  if (!Tn) return We.length = Ht, We;
                  var ua = cs(Tn);
                  try {
                    We[Ht] = ua;
                  } catch (la) {
                    try {
                      jt(Ft);
                    } finally {
                      throw la;
                    }
                  }
                  Ht++;
                }
              }
              function Ue(we, Ve, We) {
                var St = be(Ve, We, !1);
                if (qe(St) || !St.delete(we)) return !1;
                if (St.size === 0) {
                  var Ft = re.get(Ve);
                  qe(Ft) || (Ft.delete(We), Ft.size === 0 && re.delete(Ft));
                }
                return !0;
              }
            }
            function Js(Y) {
              var re = Y.defineMetadata, he = Y.hasOwnMetadata, be = Y.getOwnMetadata, Xe = Y.getOwnMetadataKeys, en = Y.deleteMetadata, it = new Oe();
              return { isProviderFor: function(tt, Ue) {
                var we = it.get(tt);
                return !(qe(we) || !we.has(Ue)) || !!Xe(tt, Ue).length && (qe(we) && (we = new de(), it.set(tt, we)), we.add(Ue), !0);
              }, OrdinaryDefineOwnMetadata: re, OrdinaryHasOwnMetadata: he, OrdinaryGetOwnMetadata: be, OrdinaryOwnMetadataKeys: Xe, OrdinaryDeleteMetadata: en };
            }
            function Si(Y, re, he) {
              var be = ge.getProvider(Y, re);
              if (!qe(be)) return be;
              if (he) {
                if (ge.setProvider(Y, re, ke)) return ke;
                throw new Error("Illegal state.");
              }
            }
            function Ys() {
              var Y = {}, re = [], he = function() {
                function it(tt, Ue, we) {
                  this._index = 0, this._keys = tt, this._values = Ue, this._selector = we;
                }
                return it.prototype["@@iterator"] = function() {
                  return this;
                }, it.prototype[O] = function() {
                  return this;
                }, it.prototype.next = function() {
                  var tt = this._index;
                  if (tt >= 0 && tt < this._keys.length) {
                    var Ue = this._selector(this._keys[tt], this._values[tt]);
                    return tt + 1 >= this._keys.length ? (this._index = -1, this._keys = re, this._values = re) : this._index++, { value: Ue, done: !1 };
                  }
                  return { value: void 0, done: !0 };
                }, it.prototype.throw = function(tt) {
                  throw this._index >= 0 && (this._index = -1, this._keys = re, this._values = re), tt;
                }, it.prototype.return = function(tt) {
                  return this._index >= 0 && (this._index = -1, this._keys = re, this._values = re), { value: tt, done: !0 };
                }, it;
              }();
              return function() {
                function it() {
                  this._keys = [], this._values = [], this._cacheKey = Y, this._cacheIndex = -2;
                }
                return Object.defineProperty(it.prototype, "size", { get: function() {
                  return this._keys.length;
                }, enumerable: !0, configurable: !0 }), it.prototype.has = function(tt) {
                  return this._find(tt, !1) >= 0;
                }, it.prototype.get = function(tt) {
                  var Ue = this._find(tt, !1);
                  return Ue >= 0 ? this._values[Ue] : void 0;
                }, it.prototype.set = function(tt, Ue) {
                  var we = this._find(tt, !0);
                  return this._values[we] = Ue, this;
                }, it.prototype.delete = function(tt) {
                  var Ue = this._find(tt, !1);
                  if (Ue >= 0) {
                    for (var we = this._keys.length, Ve = Ue + 1; Ve < we; Ve++) this._keys[Ve - 1] = this._keys[Ve], this._values[Ve - 1] = this._values[Ve];
                    return this._keys.length--, this._values.length--, Mi(tt, this._cacheKey) && (this._cacheKey = Y, this._cacheIndex = -2), !0;
                  }
                  return !1;
                }, it.prototype.clear = function() {
                  this._keys.length = 0, this._values.length = 0, this._cacheKey = Y, this._cacheIndex = -2;
                }, it.prototype.keys = function() {
                  return new he(this._keys, this._values, be);
                }, it.prototype.values = function() {
                  return new he(this._keys, this._values, Xe);
                }, it.prototype.entries = function() {
                  return new he(this._keys, this._values, en);
                }, it.prototype["@@iterator"] = function() {
                  return this.entries();
                }, it.prototype[O] = function() {
                  return this.entries();
                }, it.prototype._find = function(tt, Ue) {
                  if (!Mi(this._cacheKey, tt)) {
                    this._cacheIndex = -1;
                    for (var we = 0; we < this._keys.length; we++) if (Mi(this._keys[we], tt)) {
                      this._cacheIndex = we;
                      break;
                    }
                  }
                  return this._cacheIndex < 0 && Ue && (this._cacheIndex = this._keys.length, this._keys.push(tt), this._values.push(void 0)), this._cacheIndex;
                }, it;
              }();
              function be(it, tt) {
                return it;
              }
              function Xe(it, tt) {
                return tt;
              }
              function en(it, tt) {
                return [it, tt];
              }
            }
            function Co() {
              return function() {
                function Y() {
                  this._map = new ae();
                }
                return Object.defineProperty(Y.prototype, "size", { get: function() {
                  return this._map.size;
                }, enumerable: !0, configurable: !0 }), Y.prototype.has = function(re) {
                  return this._map.has(re);
                }, Y.prototype.add = function(re) {
                  return this._map.set(re, re), this;
                }, Y.prototype.delete = function(re) {
                  return this._map.delete(re);
                }, Y.prototype.clear = function() {
                  this._map.clear();
                }, Y.prototype.keys = function() {
                  return this._map.keys();
                }, Y.prototype.values = function() {
                  return this._map.keys();
                }, Y.prototype.entries = function() {
                  return this._map.entries();
                }, Y.prototype["@@iterator"] = function() {
                  return this.keys();
                }, Y.prototype[O] = function() {
                  return this.keys();
                }, Y;
              }();
            }
            function ca() {
              var Y = 16, re = q.create(), he = be();
              return function() {
                function Ue() {
                  this._key = be();
                }
                return Ue.prototype.has = function(we) {
                  var Ve = Xe(we, !1);
                  return Ve !== void 0 && q.has(Ve, this._key);
                }, Ue.prototype.get = function(we) {
                  var Ve = Xe(we, !1);
                  return Ve !== void 0 ? q.get(Ve, this._key) : void 0;
                }, Ue.prototype.set = function(we, Ve) {
                  return Xe(we, !0)[this._key] = Ve, this;
                }, Ue.prototype.delete = function(we) {
                  var Ve = Xe(we, !1);
                  return Ve !== void 0 && delete Ve[this._key];
                }, Ue.prototype.clear = function() {
                  this._key = be();
                }, Ue;
              }();
              function be() {
                var Ue;
                do
                  Ue = "@@WeakMap@@" + tt();
                while (q.has(re, Ue));
                return re[Ue] = !0, Ue;
              }
              function Xe(Ue, we) {
                if (!b.call(Ue, he)) {
                  if (!we) return;
                  Object.defineProperty(Ue, he, { value: q.create() });
                }
                return Ue[he];
              }
              function en(Ue, we) {
                for (var Ve = 0; Ve < we; ++Ve) Ue[Ve] = 255 * Math.random() | 0;
                return Ue;
              }
              function it(Ue) {
                if (typeof Uint8Array == "function") {
                  var we = new Uint8Array(Ue);
                  return typeof crypto < "u" ? crypto.getRandomValues(we) : typeof msCrypto < "u" ? msCrypto.getRandomValues(we) : en(we, Ue), we;
                }
                return en(new Array(Ue), Ue);
              }
              function tt() {
                var Ue = it(Y);
                Ue[6] = 79 & Ue[6] | 64, Ue[8] = 191 & Ue[8] | 128;
                for (var we = "", Ve = 0; Ve < Y; ++Ve) {
                  var We = Ue[Ve];
                  Ve !== 4 && Ve !== 6 && Ve !== 8 || (we += "-"), We < 16 && (we += "0"), we += We.toString(16).toLowerCase();
                }
                return we;
              }
            }
            function Io(Y) {
              return Y.__ = void 0, delete Y.__, Y;
            }
            _("decorate", Se), _("metadata", Z), _("defineMetadata", J), _("hasMetadata", X), _("hasOwnMetadata", ue), _("getMetadata", pe), _("getOwnMetadata", De), _("getMetadataKeys", Ie), _("getOwnMetadataKeys", _t), _("deleteMetadata", bn);
          }(E, y), y.Reflect === void 0 && (y.Reflect = m);
        })();
      })(v || (v = {}));
    } }, se = {};
    function Te(k) {
      var A = se[k];
      if (A !== void 0) return A.exports;
      var p = se[k] = { id: k, loaded: !1, exports: {} };
      return z[k].call(p.exports, p, p.exports, Te), p.loaded = !0, p.exports;
    }
    Te.n = (k) => {
      var A = k && k.__esModule ? () => k.default : () => k;
      return Te.d(A, { a: A }), A;
    }, Te.d = (k, A) => {
      for (var p in A) Te.o(A, p) && !Te.o(k, p) && Object.defineProperty(k, p, { enumerable: !0, get: A[p] });
    }, Te.g = function() {
      if (typeof globalThis == "object") return globalThis;
      try {
        return this || new Function("return this")();
      } catch {
        if (typeof window == "object") return window;
      }
    }(), Te.o = (k, A) => Object.prototype.hasOwnProperty.call(k, A), Te.r = (k) => {
      typeof Symbol < "u" && Symbol.toStringTag && Object.defineProperty(k, Symbol.toStringTag, { value: "Module" }), Object.defineProperty(k, "__esModule", { value: !0 });
    }, Te.nmd = (k) => (k.paths = [], k.children || (k.children = []), k);
    var ze = {};
    return (() => {
      Te.r(ze), Te.d(ze, { BASIC_FULL_HD_LANDSCAPE: () => $t, BASIC_FULL_HD_PORTRAIT: () => Ye, BASIC_LANDSCAPE: () => ps, BASIC_PORTRAIT: () => zc, BroadcastClientError: () => Ke, BroadcastClientEvents: () => mr, ConnectionState: () => xe, Errors: () => m, InitialLayerPreference: () => Na, JitterBufferMinDelay: () => Fn, LOG_LEVEL: () => It, LocalStageStream: () => bu, LocalStageStreamEvents: () => gi, LogLevels: () => It, RemoteStageStream: () => ol, RemoteStageStreamEvents: () => mn, SIMULCAST_DUPLICATE_LAYERS_CONFIGURED: () => bc, SIMULCAST_LAYER_CONFIGURATION_CONFLICT: () => Jo, SIMULCAST_LAYER_INPUT_FRAMERATE_INSUFFICIENT: () => Ic, SIMULCAST_LAYER_INPUT_RESOLUTION_INSUFFICIENT: () => Cc, SIMULCAST_LAYER_INVALID_TYPE: () => gn, SIMULCAST_LAYER_ORIENTATION_MISMATCH: () => Yo, SIMULCAST_MAX_LAYERS_EXCEEDED: () => Ln, SIMULCAST_MAX_LAYER_BITRATE_EXCEEDED: () => fu, SIMULCAST_MAX_LAYER_DIMENSIONS_EXCEEDED: () => Ko, SIMULCAST_MAX_LAYER_FRAMERATE_EXCEEDED: () => sn, SIMULCAST_MIN_LAYER_BITRATE_EXCEEDED: () => ki, SIMULCAST_MIN_LAYER_DIMENSIONS_EXCEEDED: () => Tc, SIMULCAST_MIN_LAYER_FRAMERATE_EXCEEDED: () => xn, SIMULCAST_UNSUPPORTED: () => Ls, STAGE_MAX_AUDIO_BITRATE_KBPS: () => ho, STAGE_MAX_AUDIO_BITRATE_KBPS_DEFAULT: () => Sc, STAGE_MAX_BITRATE: () => zr, STAGE_MAX_FRAMERATE: () => Mn, STAGE_MAX_RESOLUTION: () => Nr, STAGE_MIN_AUDIO_BITRATE_KBPS: () => Ho, STAGE_MIN_BITRATE: () => Ti, STAGE_MIN_FRAMERATE: () => Hi, STAGE_MIN_RESOLUTION: () => li, STANDARD_LANDSCAPE: () => Vt, STANDARD_PORTRAIT: () => qc, SimulcastLayerPresets: () => Go, Stage: () => Au, StageConnectionState: () => Mt, StageErrorCategory: () => pt, StageErrorCode: () => Me, StageEvents: () => Gt, StageLeftReason: () => So, StageParticipantPublishState: () => cn, StageParticipantSubscribeState: () => En, StageStream: () => Vc, StageStreamLayerSelectedReason: () => na, StreamType: () => Je, SubscribeType: () => Ne, __version: () => Ca, create: () => Bu, default: () => $l, isSupported: () => cs });
      var k = {};
      Te.r(k), Te.d(k, { fixNegotiationNeeded: () => ue, shimAddTrackRemoveTrack: () => J, shimAddTrackRemoveTrackWithNative: () => Z, shimGetDisplayMedia: () => de, shimGetSendersWithDtmf: () => ge, shimGetStats: () => ke, shimGetUserMedia: () => ae, shimMediaStream: () => Oe, shimOnTrack: () => W, shimPeerConnection: () => X, shimSenderReceiverGetStats: () => Se });
      var A = {};
      Te.r(A), Te.d(A, { shimAddTransceiver: () => Ur, shimCreateAnswer: () => $n, shimCreateOffer: () => gr, shimGetDisplayMedia: () => De, shimGetParameters: () => Tr, shimGetUserMedia: () => pe, shimOnTrack: () => Ie, shimPeerConnection: () => _t, shimRTCDataChannel: () => kn, shimReceiverGetStats: () => Jt, shimRemoveStream: () => Dn, shimSenderGetStats: () => bn });
      var p = {};
      Te.r(p), Te.d(p, { shimAudioContext: () => as, shimCallbacksAPI: () => Ir, shimConstraints: () => Zr, shimCreateOfferLegacy: () => os, shimGetUserMedia: () => qe, shimLocalStreamsAPI: () => jr, shimRTCIceServerUrls: () => Ks, shimRemoteStreamsAPI: () => Cr, shimTrackEventTransceiver: () => un });
      var v = {};
      Te.r(v), Te.d(v, { removeExtmapAllowMixed: () => Mi, shimAddIceCandidateNullOrEmpty: () => To, shimConnectionState: () => ss, shimMaxMessageSize: () => Ni, shimParameterlessSetLocalDescription: () => ei, shimRTCIceCandidate: () => er, shimRTCIceCandidateRelayProtocol: () => bo, shimSendThrowTypeError: () => Zi });
      var m = {};
      Te.r(m), Te.d(m, { ADD_DEVICE_COMPOSITION_INDEX_MISSING_ERROR: () => Y, ADD_DEVICE_COMPOSITION_MISSING_ERROR: () => Io, ADD_DEVICE_CONSTRAINTS_ERROR: () => be, ADD_DEVICE_DEVICE_ERROR: () => Co, ADD_DEVICE_NAME_EXISTS_ERROR: () => ca, ADD_DEVICE_NAME_MISSING_ERROR: () => re, ADD_DEVICE_UNSUPPORTED: () => he, BROADCAST_CONFIGURATION_ERROR: () => Ht, BROADCAST_ERROR: () => Js, CAMERA_ERROR: () => Si, CLIENT_INVALID_ERROR: () => ds, EXCHANGE_POSITION_DEVICE_NOT_FOUND_ERROR: () => we, FAILED_TO_ADD_IMAGE_ERROR: () => Ve, INGEST_ENDPOINT_TYPE_ERROR: () => ua, INGEST_ENDPOINT_URL_ERROR: () => la, INPUT_ERROR: () => Ys, INVALID_STREAM_KEY: () => Ft, LOGGER_TYPE_ERROR: () => ls, LOG_LEVEL_TYPE_ERROR: () => Qs, NETWORK_RECONNECT_CONFIGURATION_ERROR: () => hs, NETWORK_RECONNECT_CONFIGURATION_INVALID_TIMEOUT_ERROR: () => da, PEER_CONNECTION_ERROR: () => St, PEER_SETUP_ERROR: () => We, REMOVE_DEVICE_NOT_FOUND_ERROR: () => Xe, REMOVE_IMAGE_NOT_FOUND_ERROR: () => en, STAGE_TOKEN_TYPE_ERROR: () => Ro, STAGE_WHIP_OVERRIDE_ERROR: () => Hc, STREAM_CONFIGURATION_ERROR: () => Tn, STREAM_KEY_INVALID_CHAR_ERROR: () => Li, UPDATE_VIDEO_DEVICE_COMPOSITION_INDEX_MISSING_ERROR: () => tt, UPDATE_VIDEO_DEVICE_COMPOSITION_MISSING_ERROR: () => it, UPDATE_VIDEO_DEVICE_COMPOSITION_NAME_NOT_FOUND_ERROR: () => Ue });
      var y = {};
      Te.r(y), Te.d(y, { BASIC_FULL_HD_LANDSCAPE: () => $t, BASIC_FULL_HD_PORTRAIT: () => Ye, BASIC_LANDSCAPE: () => ps, BASIC_PORTRAIT: () => zc, BroadcastClientError: () => Ke, BroadcastClientEvents: () => mr, ConnectionState: () => xe, Errors: () => m, LOG_LEVEL: () => It, LogLevels: () => It, STANDARD_LANDSCAPE: () => Vt, STANDARD_PORTRAIT: () => qc, __version: () => Ca, create: () => Bu, isSupported: () => cs });
      let E = !0, C = !0;
      function _(s, r, a) {
        const c = s.match(r);
        return c && c.length >= a && parseInt(c[a], 10);
      }
      function f(s, r, a) {
        if (!s.RTCPeerConnection) return;
        const c = s.RTCPeerConnection.prototype, l = c.addEventListener;
        c.addEventListener = function(e, t) {
          if (e !== r) return l.apply(this, arguments);
          const i = (o) => {
            const u = a(o);
            u && (t.handleEvent ? t.handleEvent(u) : t(u));
          };
          return this._eventMap = this._eventMap || {}, this._eventMap[r] || (this._eventMap[r] = /* @__PURE__ */ new Map()), this._eventMap[r].set(t, i), l.apply(this, [e, i]);
        };
        const n = c.removeEventListener;
        c.removeEventListener = function(e, t) {
          if (e !== r || !this._eventMap || !this._eventMap[r]) return n.apply(this, arguments);
          if (!this._eventMap[r].has(t)) return n.apply(this, arguments);
          const i = this._eventMap[r].get(t);
          return this._eventMap[r].delete(t), this._eventMap[r].size === 0 && delete this._eventMap[r], Object.keys(this._eventMap).length === 0 && delete this._eventMap, n.apply(this, [e, i]);
        }, Object.defineProperty(c, "on" + r, { get() {
          return this["_on" + r];
        }, set(e) {
          this["_on" + r] && (this.removeEventListener(r, this["_on" + r]), delete this["_on" + r]), e && this.addEventListener(r, this["_on" + r] = e);
        }, enumerable: !0, configurable: !0 });
      }
      function b(s) {
        return typeof s != "boolean" ? new Error("Argument type: " + typeof s + ". Please use a boolean.") : (E = s, s ? "adapter.js logging disabled" : "adapter.js logging enabled");
      }
      function L(s) {
        return typeof s != "boolean" ? new Error("Argument type: " + typeof s + ". Please use a boolean.") : (C = !s, "adapter.js deprecation warnings " + (s ? "disabled" : "enabled"));
      }
      function D() {
        if (typeof window == "object") {
          if (E) return;
          typeof console < "u" && typeof console.log == "function" && console.log.apply(console, arguments);
        }
      }
      function O(s, r) {
        C && console.warn(s + " is deprecated, please use " + r + " instead.");
      }
      function N(s) {
        return Object.prototype.toString.call(s) === "[object Object]";
      }
      function G(s) {
        return N(s) ? Object.keys(s).reduce(function(r, a) {
          const c = N(s[a]), l = c ? G(s[a]) : s[a], n = c && !Object.keys(l).length;
          return l === void 0 || n ? r : Object.assign(r, { [a]: l });
        }, {}) : s;
      }
      function $(s, r, a) {
        r && !a.has(r.id) && (a.set(r.id, r), Object.keys(r).forEach((c) => {
          c.endsWith("Id") ? $(s, s.get(r[c]), a) : c.endsWith("Ids") && r[c].forEach((l) => {
            $(s, s.get(l), a);
          });
        }));
      }
      function q(s, r, a) {
        const c = a ? "outbound-rtp" : "inbound-rtp", l = /* @__PURE__ */ new Map();
        if (r === null) return l;
        const n = [];
        return s.forEach((e) => {
          e.type === "track" && e.trackIdentifier === r.id && n.push(e);
        }), n.forEach((e) => {
          s.forEach((t) => {
            t.type === c && t.trackId === e.id && $(s, t, l);
          });
        }), l;
      }
      const te = D;
      function ae(s, r) {
        const a = s && s.navigator;
        if (!a.mediaDevices) return;
        const c = function(e) {
          if (typeof e != "object" || e.mandatory || e.optional) return e;
          const t = {};
          return Object.keys(e).forEach((i) => {
            if (i === "require" || i === "advanced" || i === "mediaSource") return;
            const o = typeof e[i] == "object" ? e[i] : { ideal: e[i] };
            o.exact !== void 0 && typeof o.exact == "number" && (o.min = o.max = o.exact);
            const u = function(d, h) {
              return d ? d + h.charAt(0).toUpperCase() + h.slice(1) : h === "deviceId" ? "sourceId" : h;
            };
            if (o.ideal !== void 0) {
              t.optional = t.optional || [];
              let d = {};
              typeof o.ideal == "number" ? (d[u("min", i)] = o.ideal, t.optional.push(d), d = {}, d[u("max", i)] = o.ideal, t.optional.push(d)) : (d[u("", i)] = o.ideal, t.optional.push(d));
            }
            o.exact !== void 0 && typeof o.exact != "number" ? (t.mandatory = t.mandatory || {}, t.mandatory[u("", i)] = o.exact) : ["min", "max"].forEach((d) => {
              o[d] !== void 0 && (t.mandatory = t.mandatory || {}, t.mandatory[u(d, i)] = o[d]);
            });
          }), e.advanced && (t.optional = (t.optional || []).concat(e.advanced)), t;
        }, l = function(e, t) {
          if (r.version >= 61) return t(e);
          if ((e = JSON.parse(JSON.stringify(e))) && typeof e.audio == "object") {
            const i = function(o, u, d) {
              u in o && !(d in o) && (o[d] = o[u], delete o[u]);
            };
            i((e = JSON.parse(JSON.stringify(e))).audio, "autoGainControl", "googAutoGainControl"), i(e.audio, "noiseSuppression", "googNoiseSuppression"), e.audio = c(e.audio);
          }
          if (e && typeof e.video == "object") {
            let i = e.video.facingMode;
            i = i && (typeof i == "object" ? i : { ideal: i });
            const o = r.version < 66;
            if (i && (i.exact === "user" || i.exact === "environment" || i.ideal === "user" || i.ideal === "environment") && (!a.mediaDevices.getSupportedConstraints || !a.mediaDevices.getSupportedConstraints().facingMode || o)) {
              let u;
              if (delete e.video.facingMode, i.exact === "environment" || i.ideal === "environment" ? u = ["back", "rear"] : i.exact !== "user" && i.ideal !== "user" || (u = ["front"]), u) return a.mediaDevices.enumerateDevices().then((d) => {
                let h = (d = d.filter((S) => S.kind === "videoinput")).find((S) => u.some((T) => S.label.toLowerCase().includes(T)));
                return !h && d.length && u.includes("back") && (h = d[d.length - 1]), h && (e.video.deviceId = i.exact ? { exact: h.deviceId } : { ideal: h.deviceId }), e.video = c(e.video), te("chrome: " + JSON.stringify(e)), t(e);
              });
            }
            e.video = c(e.video);
          }
          return te("chrome: " + JSON.stringify(e)), t(e);
        }, n = function(e) {
          return r.version >= 64 ? e : { name: { PermissionDeniedError: "NotAllowedError", PermissionDismissedError: "NotAllowedError", InvalidStateError: "NotAllowedError", DevicesNotFoundError: "NotFoundError", ConstraintNotSatisfiedError: "OverconstrainedError", TrackStartError: "NotReadableError", MediaDeviceFailedDueToShutdown: "NotAllowedError", MediaDeviceKillSwitchOn: "NotAllowedError", TabCaptureError: "AbortError", ScreenCaptureError: "AbortError", DeviceCaptureError: "AbortError" }[e.name] || e.name, message: e.message, constraint: e.constraint || e.constraintName, toString() {
            return this.name + (this.message && ": ") + this.message;
          } };
        };
        if (a.getUserMedia = (function(e, t, i) {
          l(e, (o) => {
            a.webkitGetUserMedia(o, t, (u) => {
              i && i(n(u));
            });
          });
        }).bind(a), a.mediaDevices.getUserMedia) {
          const e = a.mediaDevices.getUserMedia.bind(a.mediaDevices);
          a.mediaDevices.getUserMedia = function(t) {
            return l(t, (i) => e(i).then((o) => {
              if (i.audio && !o.getAudioTracks().length || i.video && !o.getVideoTracks().length) throw o.getTracks().forEach((u) => {
                u.stop();
              }), new DOMException("", "NotFoundError");
              return o;
            }, (o) => Promise.reject(n(o))));
          };
        }
      }
      function de(s, r) {
        s.navigator.mediaDevices && "getDisplayMedia" in s.navigator.mediaDevices || s.navigator.mediaDevices && (typeof r == "function" ? s.navigator.mediaDevices.getDisplayMedia = function(a) {
          return r(a).then((c) => {
            const l = a.video && a.video.width, n = a.video && a.video.height, e = a.video && a.video.frameRate;
            return a.video = { mandatory: { chromeMediaSource: "desktop", chromeMediaSourceId: c, maxFrameRate: e || 3 } }, l && (a.video.mandatory.maxWidth = l), n && (a.video.mandatory.maxHeight = n), s.navigator.mediaDevices.getUserMedia(a);
          });
        } : console.error("shimGetDisplayMedia: getSourceId argument is not a function"));
      }
      function Oe(s) {
        s.MediaStream = s.MediaStream || s.webkitMediaStream;
      }
      function W(s) {
        if (typeof s == "object" && s.RTCPeerConnection && !("ontrack" in s.RTCPeerConnection.prototype)) {
          Object.defineProperty(s.RTCPeerConnection.prototype, "ontrack", { get() {
            return this._ontrack;
          }, set(a) {
            this._ontrack && this.removeEventListener("track", this._ontrack), this.addEventListener("track", this._ontrack = a);
          }, enumerable: !0, configurable: !0 });
          const r = s.RTCPeerConnection.prototype.setRemoteDescription;
          s.RTCPeerConnection.prototype.setRemoteDescription = function() {
            return this._ontrackpoly || (this._ontrackpoly = (a) => {
              a.stream.addEventListener("addtrack", (c) => {
                let l;
                l = s.RTCPeerConnection.prototype.getReceivers ? this.getReceivers().find((e) => e.track && e.track.id === c.track.id) : { track: c.track };
                const n = new Event("track");
                n.track = c.track, n.receiver = l, n.transceiver = { receiver: l }, n.streams = [a.stream], this.dispatchEvent(n);
              }), a.stream.getTracks().forEach((c) => {
                let l;
                l = s.RTCPeerConnection.prototype.getReceivers ? this.getReceivers().find((e) => e.track && e.track.id === c.id) : { track: c };
                const n = new Event("track");
                n.track = c, n.receiver = l, n.transceiver = { receiver: l }, n.streams = [a.stream], this.dispatchEvent(n);
              });
            }, this.addEventListener("addstream", this._ontrackpoly)), r.apply(this, arguments);
          };
        } else f(s, "track", (r) => (r.transceiver || Object.defineProperty(r, "transceiver", { value: { receiver: r.receiver } }), r));
      }
      function ge(s) {
        if (typeof s == "object" && s.RTCPeerConnection && !("getSenders" in s.RTCPeerConnection.prototype) && "createDTMFSender" in s.RTCPeerConnection.prototype) {
          const r = function(l, n) {
            return { track: n, get dtmf() {
              return this._dtmf === void 0 && (n.kind === "audio" ? this._dtmf = l.createDTMFSender(n) : this._dtmf = null), this._dtmf;
            }, _pc: l };
          };
          if (!s.RTCPeerConnection.prototype.getSenders) {
            s.RTCPeerConnection.prototype.getSenders = function() {
              return this._senders = this._senders || [], this._senders.slice();
            };
            const l = s.RTCPeerConnection.prototype.addTrack;
            s.RTCPeerConnection.prototype.addTrack = function(e, t) {
              let i = l.apply(this, arguments);
              return i || (i = r(this, e), this._senders.push(i)), i;
            };
            const n = s.RTCPeerConnection.prototype.removeTrack;
            s.RTCPeerConnection.prototype.removeTrack = function(e) {
              n.apply(this, arguments);
              const t = this._senders.indexOf(e);
              t !== -1 && this._senders.splice(t, 1);
            };
          }
          const a = s.RTCPeerConnection.prototype.addStream;
          s.RTCPeerConnection.prototype.addStream = function(l) {
            this._senders = this._senders || [], a.apply(this, [l]), l.getTracks().forEach((n) => {
              this._senders.push(r(this, n));
            });
          };
          const c = s.RTCPeerConnection.prototype.removeStream;
          s.RTCPeerConnection.prototype.removeStream = function(l) {
            this._senders = this._senders || [], c.apply(this, [l]), l.getTracks().forEach((n) => {
              const e = this._senders.find((t) => t.track === n);
              e && this._senders.splice(this._senders.indexOf(e), 1);
            });
          };
        } else if (typeof s == "object" && s.RTCPeerConnection && "getSenders" in s.RTCPeerConnection.prototype && "createDTMFSender" in s.RTCPeerConnection.prototype && s.RTCRtpSender && !("dtmf" in s.RTCRtpSender.prototype)) {
          const r = s.RTCPeerConnection.prototype.getSenders;
          s.RTCPeerConnection.prototype.getSenders = function() {
            const a = r.apply(this, []);
            return a.forEach((c) => c._pc = this), a;
          }, Object.defineProperty(s.RTCRtpSender.prototype, "dtmf", { get() {
            return this._dtmf === void 0 && (this.track.kind === "audio" ? this._dtmf = this._pc.createDTMFSender(this.track) : this._dtmf = null), this._dtmf;
          } });
        }
      }
      function ke(s) {
        if (!s.RTCPeerConnection) return;
        const r = s.RTCPeerConnection.prototype.getStats;
        s.RTCPeerConnection.prototype.getStats = function() {
          const [a, c, l] = arguments;
          if (arguments.length > 0 && typeof a == "function") return r.apply(this, arguments);
          if (r.length === 0 && (arguments.length === 0 || typeof a != "function")) return r.apply(this, []);
          const n = function(t) {
            const i = {};
            return t.result().forEach((o) => {
              const u = { id: o.id, timestamp: o.timestamp, type: { localcandidate: "local-candidate", remotecandidate: "remote-candidate" }[o.type] || o.type };
              o.names().forEach((d) => {
                u[d] = o.stat(d);
              }), i[u.id] = u;
            }), i;
          }, e = function(t) {
            return new Map(Object.keys(t).map((i) => [i, t[i]]));
          };
          if (arguments.length >= 2) {
            const t = function(i) {
              c(e(n(i)));
            };
            return r.apply(this, [t, a]);
          }
          return new Promise((t, i) => {
            r.apply(this, [function(o) {
              t(e(n(o)));
            }, i]);
          }).then(c, l);
        };
      }
      function Se(s) {
        if (!(typeof s == "object" && s.RTCPeerConnection && s.RTCRtpSender && s.RTCRtpReceiver)) return;
        if (!("getStats" in s.RTCRtpSender.prototype)) {
          const a = s.RTCPeerConnection.prototype.getSenders;
          a && (s.RTCPeerConnection.prototype.getSenders = function() {
            const l = a.apply(this, []);
            return l.forEach((n) => n._pc = this), l;
          });
          const c = s.RTCPeerConnection.prototype.addTrack;
          c && (s.RTCPeerConnection.prototype.addTrack = function() {
            const l = c.apply(this, arguments);
            return l._pc = this, l;
          }), s.RTCRtpSender.prototype.getStats = function() {
            const l = this;
            return this._pc.getStats().then((n) => q(n, l.track, !0));
          };
        }
        if (!("getStats" in s.RTCRtpReceiver.prototype)) {
          const a = s.RTCPeerConnection.prototype.getReceivers;
          a && (s.RTCPeerConnection.prototype.getReceivers = function() {
            const c = a.apply(this, []);
            return c.forEach((l) => l._pc = this), c;
          }), f(s, "track", (c) => (c.receiver._pc = c.srcElement, c)), s.RTCRtpReceiver.prototype.getStats = function() {
            const c = this;
            return this._pc.getStats().then((l) => q(l, c.track, !1));
          };
        }
        if (!("getStats" in s.RTCRtpSender.prototype) || !("getStats" in s.RTCRtpReceiver.prototype)) return;
        const r = s.RTCPeerConnection.prototype.getStats;
        s.RTCPeerConnection.prototype.getStats = function() {
          if (arguments.length > 0 && arguments[0] instanceof s.MediaStreamTrack) {
            const a = arguments[0];
            let c, l, n;
            return this.getSenders().forEach((e) => {
              e.track === a && (c ? n = !0 : c = e);
            }), this.getReceivers().forEach((e) => (e.track === a && (l ? n = !0 : l = e), e.track === a)), n || c && l ? Promise.reject(new DOMException("There are more than one sender or receiver for the track.", "InvalidAccessError")) : c ? c.getStats() : l ? l.getStats() : Promise.reject(new DOMException("There is no sender or receiver for the track.", "InvalidAccessError"));
          }
          return r.apply(this, arguments);
        };
      }
      function Z(s) {
        s.RTCPeerConnection.prototype.getLocalStreams = function() {
          return this._shimmedLocalStreams = this._shimmedLocalStreams || {}, Object.keys(this._shimmedLocalStreams).map((n) => this._shimmedLocalStreams[n][0]);
        };
        const r = s.RTCPeerConnection.prototype.addTrack;
        s.RTCPeerConnection.prototype.addTrack = function(n, e) {
          if (!e) return r.apply(this, arguments);
          this._shimmedLocalStreams = this._shimmedLocalStreams || {};
          const t = r.apply(this, arguments);
          return this._shimmedLocalStreams[e.id] ? this._shimmedLocalStreams[e.id].indexOf(t) === -1 && this._shimmedLocalStreams[e.id].push(t) : this._shimmedLocalStreams[e.id] = [e, t], t;
        };
        const a = s.RTCPeerConnection.prototype.addStream;
        s.RTCPeerConnection.prototype.addStream = function(n) {
          this._shimmedLocalStreams = this._shimmedLocalStreams || {}, n.getTracks().forEach((i) => {
            if (this.getSenders().find((o) => o.track === i)) throw new DOMException("Track already exists.", "InvalidAccessError");
          });
          const e = this.getSenders();
          a.apply(this, arguments);
          const t = this.getSenders().filter((i) => e.indexOf(i) === -1);
          this._shimmedLocalStreams[n.id] = [n].concat(t);
        };
        const c = s.RTCPeerConnection.prototype.removeStream;
        s.RTCPeerConnection.prototype.removeStream = function(n) {
          return this._shimmedLocalStreams = this._shimmedLocalStreams || {}, delete this._shimmedLocalStreams[n.id], c.apply(this, arguments);
        };
        const l = s.RTCPeerConnection.prototype.removeTrack;
        s.RTCPeerConnection.prototype.removeTrack = function(n) {
          return this._shimmedLocalStreams = this._shimmedLocalStreams || {}, n && Object.keys(this._shimmedLocalStreams).forEach((e) => {
            const t = this._shimmedLocalStreams[e].indexOf(n);
            t !== -1 && this._shimmedLocalStreams[e].splice(t, 1), this._shimmedLocalStreams[e].length === 1 && delete this._shimmedLocalStreams[e];
          }), l.apply(this, arguments);
        };
      }
      function J(s, r) {
        if (!s.RTCPeerConnection) return;
        if (s.RTCPeerConnection.prototype.addTrack && r.version >= 65) return Z(s);
        const a = s.RTCPeerConnection.prototype.getLocalStreams;
        s.RTCPeerConnection.prototype.getLocalStreams = function() {
          const i = a.apply(this);
          return this._reverseStreams = this._reverseStreams || {}, i.map((o) => this._reverseStreams[o.id]);
        };
        const c = s.RTCPeerConnection.prototype.addStream;
        s.RTCPeerConnection.prototype.addStream = function(i) {
          if (this._streams = this._streams || {}, this._reverseStreams = this._reverseStreams || {}, i.getTracks().forEach((o) => {
            if (this.getSenders().find((u) => u.track === o)) throw new DOMException("Track already exists.", "InvalidAccessError");
          }), !this._reverseStreams[i.id]) {
            const o = new s.MediaStream(i.getTracks());
            this._streams[i.id] = o, this._reverseStreams[o.id] = i, i = o;
          }
          c.apply(this, [i]);
        };
        const l = s.RTCPeerConnection.prototype.removeStream;
        function n(i, o) {
          let u = o.sdp;
          return Object.keys(i._reverseStreams || []).forEach((d) => {
            const h = i._reverseStreams[d], S = i._streams[h.id];
            u = u.replace(new RegExp(S.id, "g"), h.id);
          }), new RTCSessionDescription({ type: o.type, sdp: u });
        }
        s.RTCPeerConnection.prototype.removeStream = function(i) {
          this._streams = this._streams || {}, this._reverseStreams = this._reverseStreams || {}, l.apply(this, [this._streams[i.id] || i]), delete this._reverseStreams[this._streams[i.id] ? this._streams[i.id].id : i.id], delete this._streams[i.id];
        }, s.RTCPeerConnection.prototype.addTrack = function(i, o) {
          if (this.signalingState === "closed") throw new DOMException("The RTCPeerConnection's signalingState is 'closed'.", "InvalidStateError");
          const u = [].slice.call(arguments, 1);
          if (u.length !== 1 || !u[0].getTracks().find((h) => h === i)) throw new DOMException("The adapter.js addTrack polyfill only supports a single  stream which is associated with the specified track.", "NotSupportedError");
          if (this.getSenders().find((h) => h.track === i)) throw new DOMException("Track already exists.", "InvalidAccessError");
          this._streams = this._streams || {}, this._reverseStreams = this._reverseStreams || {};
          const d = this._streams[o.id];
          if (d) d.addTrack(i), Promise.resolve().then(() => {
            this.dispatchEvent(new Event("negotiationneeded"));
          });
          else {
            const h = new s.MediaStream([i]);
            this._streams[o.id] = h, this._reverseStreams[h.id] = o, this.addStream(h);
          }
          return this.getSenders().find((h) => h.track === i);
        }, ["createOffer", "createAnswer"].forEach(function(i) {
          const o = s.RTCPeerConnection.prototype[i], u = { [i]() {
            const d = arguments;
            return arguments.length && typeof arguments[0] == "function" ? o.apply(this, [(h) => {
              const S = n(this, h);
              d[0].apply(null, [S]);
            }, (h) => {
              d[1] && d[1].apply(null, h);
            }, arguments[2]]) : o.apply(this, arguments).then((h) => n(this, h));
          } };
          s.RTCPeerConnection.prototype[i] = u[i];
        });
        const e = s.RTCPeerConnection.prototype.setLocalDescription;
        s.RTCPeerConnection.prototype.setLocalDescription = function() {
          return arguments.length && arguments[0].type ? (arguments[0] = function(i, o) {
            let u = o.sdp;
            return Object.keys(i._reverseStreams || []).forEach((d) => {
              const h = i._reverseStreams[d], S = i._streams[h.id];
              u = u.replace(new RegExp(h.id, "g"), S.id);
            }), new RTCSessionDescription({ type: o.type, sdp: u });
          }(this, arguments[0]), e.apply(this, arguments)) : e.apply(this, arguments);
        };
        const t = Object.getOwnPropertyDescriptor(s.RTCPeerConnection.prototype, "localDescription");
        Object.defineProperty(s.RTCPeerConnection.prototype, "localDescription", { get() {
          const i = t.get.apply(this);
          return i.type === "" ? i : n(this, i);
        } }), s.RTCPeerConnection.prototype.removeTrack = function(i) {
          if (this.signalingState === "closed") throw new DOMException("The RTCPeerConnection's signalingState is 'closed'.", "InvalidStateError");
          if (!i._pc) throw new DOMException("Argument 1 of RTCPeerConnection.removeTrack does not implement interface RTCRtpSender.", "TypeError");
          if (i._pc !== this) throw new DOMException("Sender was not created by this connection.", "InvalidAccessError");
          let o;
          this._streams = this._streams || {}, Object.keys(this._streams).forEach((u) => {
            this._streams[u].getTracks().find((d) => i.track === d) && (o = this._streams[u]);
          }), o && (o.getTracks().length === 1 ? this.removeStream(this._reverseStreams[o.id]) : o.removeTrack(i.track), this.dispatchEvent(new Event("negotiationneeded")));
        };
      }
      function X(s, r) {
        !s.RTCPeerConnection && s.webkitRTCPeerConnection && (s.RTCPeerConnection = s.webkitRTCPeerConnection), s.RTCPeerConnection && r.version < 53 && ["setLocalDescription", "setRemoteDescription", "addIceCandidate"].forEach(function(a) {
          const c = s.RTCPeerConnection.prototype[a], l = { [a]() {
            return arguments[0] = new (a === "addIceCandidate" ? s.RTCIceCandidate : s.RTCSessionDescription)(arguments[0]), c.apply(this, arguments);
          } };
          s.RTCPeerConnection.prototype[a] = l[a];
        });
      }
      function ue(s, r) {
        f(s, "negotiationneeded", (a) => {
          const c = a.target;
          if (!(r.version < 72 || c.getConfiguration && c.getConfiguration().sdpSemantics === "plan-b") || c.signalingState === "stable") return a;
        });
      }
      function pe(s, r) {
        const a = s && s.navigator, c = s && s.MediaStreamTrack;
        if (a.getUserMedia = function(l, n, e) {
          O("navigator.getUserMedia", "navigator.mediaDevices.getUserMedia"), a.mediaDevices.getUserMedia(l).then(n, e);
        }, !(r.version > 55 && "autoGainControl" in a.mediaDevices.getSupportedConstraints())) {
          const l = function(e, t, i) {
            t in e && !(i in e) && (e[i] = e[t], delete e[t]);
          }, n = a.mediaDevices.getUserMedia.bind(a.mediaDevices);
          if (a.mediaDevices.getUserMedia = function(e) {
            return typeof e == "object" && typeof e.audio == "object" && (e = JSON.parse(JSON.stringify(e)), l(e.audio, "autoGainControl", "mozAutoGainControl"), l(e.audio, "noiseSuppression", "mozNoiseSuppression")), n(e);
          }, c && c.prototype.getSettings) {
            const e = c.prototype.getSettings;
            c.prototype.getSettings = function() {
              const t = e.apply(this, arguments);
              return l(t, "mozAutoGainControl", "autoGainControl"), l(t, "mozNoiseSuppression", "noiseSuppression"), t;
            };
          }
          if (c && c.prototype.applyConstraints) {
            const e = c.prototype.applyConstraints;
            c.prototype.applyConstraints = function(t) {
              return this.kind === "audio" && typeof t == "object" && (t = JSON.parse(JSON.stringify(t)), l(t, "autoGainControl", "mozAutoGainControl"), l(t, "noiseSuppression", "mozNoiseSuppression")), e.apply(this, [t]);
            };
          }
        }
      }
      function De(s, r) {
        s.navigator.mediaDevices && "getDisplayMedia" in s.navigator.mediaDevices || s.navigator.mediaDevices && (s.navigator.mediaDevices.getDisplayMedia = function(a) {
          if (!a || !a.video) {
            const c = new DOMException("getDisplayMedia without video constraints is undefined");
            return c.name = "NotFoundError", c.code = 8, Promise.reject(c);
          }
          return a.video === !0 ? a.video = { mediaSource: r } : a.video.mediaSource = r, s.navigator.mediaDevices.getUserMedia(a);
        });
      }
      function Ie(s) {
        typeof s == "object" && s.RTCTrackEvent && "receiver" in s.RTCTrackEvent.prototype && !("transceiver" in s.RTCTrackEvent.prototype) && Object.defineProperty(s.RTCTrackEvent.prototype, "transceiver", { get() {
          return { receiver: this.receiver };
        } });
      }
      function _t(s, r) {
        if (typeof s != "object" || !s.RTCPeerConnection && !s.mozRTCPeerConnection) return;
        !s.RTCPeerConnection && s.mozRTCPeerConnection && (s.RTCPeerConnection = s.mozRTCPeerConnection), r.version < 53 && ["setLocalDescription", "setRemoteDescription", "addIceCandidate"].forEach(function(l) {
          const n = s.RTCPeerConnection.prototype[l], e = { [l]() {
            return arguments[0] = new (l === "addIceCandidate" ? s.RTCIceCandidate : s.RTCSessionDescription)(arguments[0]), n.apply(this, arguments);
          } };
          s.RTCPeerConnection.prototype[l] = e[l];
        });
        const a = { inboundrtp: "inbound-rtp", outboundrtp: "outbound-rtp", candidatepair: "candidate-pair", localcandidate: "local-candidate", remotecandidate: "remote-candidate" }, c = s.RTCPeerConnection.prototype.getStats;
        s.RTCPeerConnection.prototype.getStats = function() {
          const [l, n, e] = arguments;
          return c.apply(this, [l || null]).then((t) => {
            if (r.version < 53 && !n) try {
              t.forEach((i) => {
                i.type = a[i.type] || i.type;
              });
            } catch (i) {
              if (i.name !== "TypeError") throw i;
              t.forEach((o, u) => {
                t.set(u, Object.assign({}, o, { type: a[o.type] || o.type }));
              });
            }
            return t;
          }).then(n, e);
        };
      }
      function bn(s) {
        if (typeof s != "object" || !s.RTCPeerConnection || !s.RTCRtpSender || s.RTCRtpSender && "getStats" in s.RTCRtpSender.prototype) return;
        const r = s.RTCPeerConnection.prototype.getSenders;
        r && (s.RTCPeerConnection.prototype.getSenders = function() {
          const c = r.apply(this, []);
          return c.forEach((l) => l._pc = this), c;
        });
        const a = s.RTCPeerConnection.prototype.addTrack;
        a && (s.RTCPeerConnection.prototype.addTrack = function() {
          const c = a.apply(this, arguments);
          return c._pc = this, c;
        }), s.RTCRtpSender.prototype.getStats = function() {
          return this.track ? this._pc.getStats(this.track) : Promise.resolve(/* @__PURE__ */ new Map());
        };
      }
      function Jt(s) {
        if (typeof s != "object" || !s.RTCPeerConnection || !s.RTCRtpSender || s.RTCRtpSender && "getStats" in s.RTCRtpReceiver.prototype) return;
        const r = s.RTCPeerConnection.prototype.getReceivers;
        r && (s.RTCPeerConnection.prototype.getReceivers = function() {
          const a = r.apply(this, []);
          return a.forEach((c) => c._pc = this), a;
        }), f(s, "track", (a) => (a.receiver._pc = a.srcElement, a)), s.RTCRtpReceiver.prototype.getStats = function() {
          return this._pc.getStats(this.track);
        };
      }
      function Dn(s) {
        s.RTCPeerConnection && !("removeStream" in s.RTCPeerConnection.prototype) && (s.RTCPeerConnection.prototype.removeStream = function(r) {
          O("removeStream", "removeTrack"), this.getSenders().forEach((a) => {
            a.track && r.getTracks().includes(a.track) && this.removeTrack(a);
          });
        });
      }
      function kn(s) {
        s.DataChannel && !s.RTCDataChannel && (s.RTCDataChannel = s.DataChannel);
      }
      function Ur(s) {
        if (typeof s != "object" || !s.RTCPeerConnection) return;
        const r = s.RTCPeerConnection.prototype.addTransceiver;
        r && (s.RTCPeerConnection.prototype.addTransceiver = function() {
          this.setParametersPromises = [];
          let a = arguments[1] && arguments[1].sendEncodings;
          a === void 0 && (a = []), a = [...a];
          const c = a.length > 0;
          c && a.forEach((n) => {
            if ("rid" in n && !/^[a-z0-9]{0,16}$/i.test(n.rid))
              throw new TypeError("Invalid RID value provided.");
            if ("scaleResolutionDownBy" in n && !(parseFloat(n.scaleResolutionDownBy) >= 1)) throw new RangeError("scale_resolution_down_by must be >= 1.0");
            if ("maxFramerate" in n && !(parseFloat(n.maxFramerate) >= 0)) throw new RangeError("max_framerate must be >= 0.0");
          });
          const l = r.apply(this, arguments);
          if (c) {
            const { sender: n } = l, e = n.getParameters();
            (!("encodings" in e) || e.encodings.length === 1 && Object.keys(e.encodings[0]).length === 0) && (e.encodings = a, n.sendEncodings = a, this.setParametersPromises.push(n.setParameters(e).then(() => {
              delete n.sendEncodings;
            }).catch(() => {
              delete n.sendEncodings;
            })));
          }
          return l;
        });
      }
      function Tr(s) {
        if (typeof s != "object" || !s.RTCRtpSender) return;
        const r = s.RTCRtpSender.prototype.getParameters;
        r && (s.RTCRtpSender.prototype.getParameters = function() {
          const a = r.apply(this, arguments);
          return "encodings" in a || (a.encodings = [].concat(this.sendEncodings || [{}])), a;
        });
      }
      function gr(s) {
        if (typeof s != "object" || !s.RTCPeerConnection) return;
        const r = s.RTCPeerConnection.prototype.createOffer;
        s.RTCPeerConnection.prototype.createOffer = function() {
          return this.setParametersPromises && this.setParametersPromises.length ? Promise.all(this.setParametersPromises).then(() => r.apply(this, arguments)).finally(() => {
            this.setParametersPromises = [];
          }) : r.apply(this, arguments);
        };
      }
      function $n(s) {
        if (typeof s != "object" || !s.RTCPeerConnection) return;
        const r = s.RTCPeerConnection.prototype.createAnswer;
        s.RTCPeerConnection.prototype.createAnswer = function() {
          return this.setParametersPromises && this.setParametersPromises.length ? Promise.all(this.setParametersPromises).then(() => r.apply(this, arguments)).finally(() => {
            this.setParametersPromises = [];
          }) : r.apply(this, arguments);
        };
      }
      function jr(s) {
        if (typeof s == "object" && s.RTCPeerConnection) {
          if ("getLocalStreams" in s.RTCPeerConnection.prototype || (s.RTCPeerConnection.prototype.getLocalStreams = function() {
            return this._localStreams || (this._localStreams = []), this._localStreams;
          }), !("addStream" in s.RTCPeerConnection.prototype)) {
            const r = s.RTCPeerConnection.prototype.addTrack;
            s.RTCPeerConnection.prototype.addStream = function(a) {
              this._localStreams || (this._localStreams = []), this._localStreams.includes(a) || this._localStreams.push(a), a.getAudioTracks().forEach((c) => r.call(this, c, a)), a.getVideoTracks().forEach((c) => r.call(this, c, a));
            }, s.RTCPeerConnection.prototype.addTrack = function(a, ...c) {
              return c && c.forEach((l) => {
                this._localStreams ? this._localStreams.includes(l) || this._localStreams.push(l) : this._localStreams = [l];
              }), r.apply(this, arguments);
            };
          }
          "removeStream" in s.RTCPeerConnection.prototype || (s.RTCPeerConnection.prototype.removeStream = function(r) {
            this._localStreams || (this._localStreams = []);
            const a = this._localStreams.indexOf(r);
            if (a === -1) return;
            this._localStreams.splice(a, 1);
            const c = r.getTracks();
            this.getSenders().forEach((l) => {
              c.includes(l.track) && this.removeTrack(l);
            });
          });
        }
      }
      function Cr(s) {
        if (typeof s == "object" && s.RTCPeerConnection && ("getRemoteStreams" in s.RTCPeerConnection.prototype || (s.RTCPeerConnection.prototype.getRemoteStreams = function() {
          return this._remoteStreams ? this._remoteStreams : [];
        }), !("onaddstream" in s.RTCPeerConnection.prototype))) {
          Object.defineProperty(s.RTCPeerConnection.prototype, "onaddstream", { get() {
            return this._onaddstream;
          }, set(a) {
            this._onaddstream && (this.removeEventListener("addstream", this._onaddstream), this.removeEventListener("track", this._onaddstreampoly)), this.addEventListener("addstream", this._onaddstream = a), this.addEventListener("track", this._onaddstreampoly = (c) => {
              c.streams.forEach((l) => {
                if (this._remoteStreams || (this._remoteStreams = []), this._remoteStreams.includes(l)) return;
                this._remoteStreams.push(l);
                const n = new Event("addstream");
                n.stream = l, this.dispatchEvent(n);
              });
            });
          } });
          const r = s.RTCPeerConnection.prototype.setRemoteDescription;
          s.RTCPeerConnection.prototype.setRemoteDescription = function() {
            const a = this;
            return this._onaddstreampoly || this.addEventListener("track", this._onaddstreampoly = function(c) {
              c.streams.forEach((l) => {
                if (a._remoteStreams || (a._remoteStreams = []), a._remoteStreams.indexOf(l) >= 0) return;
                a._remoteStreams.push(l);
                const n = new Event("addstream");
                n.stream = l, a.dispatchEvent(n);
              });
            }), r.apply(a, arguments);
          };
        }
      }
      function Ir(s) {
        if (typeof s != "object" || !s.RTCPeerConnection) return;
        const r = s.RTCPeerConnection.prototype, a = r.createOffer, c = r.createAnswer, l = r.setLocalDescription, n = r.setRemoteDescription, e = r.addIceCandidate;
        r.createOffer = function(i, o) {
          const u = arguments.length >= 2 ? arguments[2] : arguments[0], d = a.apply(this, [u]);
          return o ? (d.then(i, o), Promise.resolve()) : d;
        }, r.createAnswer = function(i, o) {
          const u = arguments.length >= 2 ? arguments[2] : arguments[0], d = c.apply(this, [u]);
          return o ? (d.then(i, o), Promise.resolve()) : d;
        };
        let t = function(i, o, u) {
          const d = l.apply(this, [i]);
          return u ? (d.then(o, u), Promise.resolve()) : d;
        };
        r.setLocalDescription = t, t = function(i, o, u) {
          const d = n.apply(this, [i]);
          return u ? (d.then(o, u), Promise.resolve()) : d;
        }, r.setRemoteDescription = t, t = function(i, o, u) {
          const d = e.apply(this, [i]);
          return u ? (d.then(o, u), Promise.resolve()) : d;
        }, r.addIceCandidate = t;
      }
      function qe(s) {
        const r = s && s.navigator;
        if (r.mediaDevices && r.mediaDevices.getUserMedia) {
          const a = r.mediaDevices, c = a.getUserMedia.bind(a);
          r.mediaDevices.getUserMedia = (l) => c(Zr(l));
        }
        !r.getUserMedia && r.mediaDevices && r.mediaDevices.getUserMedia && (r.getUserMedia = (function(a, c, l) {
          r.mediaDevices.getUserMedia(a).then(c, l);
        }).bind(r));
      }
      function Zr(s) {
        return s && s.video !== void 0 ? Object.assign({}, s, { video: G(s.video) }) : s;
      }
      function Ks(s) {
        if (!s.RTCPeerConnection) return;
        const r = s.RTCPeerConnection;
        s.RTCPeerConnection = function(a, c) {
          if (a && a.iceServers) {
            const l = [];
            for (let n = 0; n < a.iceServers.length; n++) {
              let e = a.iceServers[n];
              e.urls === void 0 && e.url ? (O("RTCIceServer.url", "RTCIceServer.urls"), e = JSON.parse(JSON.stringify(e)), e.urls = e.url, delete e.url, l.push(e)) : l.push(a.iceServers[n]);
            }
            a.iceServers = l;
          }
          return new r(a, c);
        }, s.RTCPeerConnection.prototype = r.prototype, "generateCertificate" in r && Object.defineProperty(s.RTCPeerConnection, "generateCertificate", { get: () => r.generateCertificate });
      }
      function un(s) {
        typeof s == "object" && s.RTCTrackEvent && "receiver" in s.RTCTrackEvent.prototype && !("transceiver" in s.RTCTrackEvent.prototype) && Object.defineProperty(s.RTCTrackEvent.prototype, "transceiver", { get() {
          return { receiver: this.receiver };
        } });
      }
      function os(s) {
        const r = s.RTCPeerConnection.prototype.createOffer;
        s.RTCPeerConnection.prototype.createOffer = function(a) {
          if (a) {
            a.offerToReceiveAudio !== void 0 && (a.offerToReceiveAudio = !!a.offerToReceiveAudio);
            const c = this.getTransceivers().find((n) => n.receiver.track.kind === "audio");
            a.offerToReceiveAudio === !1 && c ? c.direction === "sendrecv" ? c.setDirection ? c.setDirection("sendonly") : c.direction = "sendonly" : c.direction === "recvonly" && (c.setDirection ? c.setDirection("inactive") : c.direction = "inactive") : a.offerToReceiveAudio !== !0 || c || this.addTransceiver("audio", { direction: "recvonly" }), a.offerToReceiveVideo !== void 0 && (a.offerToReceiveVideo = !!a.offerToReceiveVideo);
            const l = this.getTransceivers().find((n) => n.receiver.track.kind === "video");
            a.offerToReceiveVideo === !1 && l ? l.direction === "sendrecv" ? l.setDirection ? l.setDirection("sendonly") : l.direction = "sendonly" : l.direction === "recvonly" && (l.setDirection ? l.setDirection("inactive") : l.direction = "inactive") : a.offerToReceiveVideo !== !0 || l || this.addTransceiver("video", { direction: "recvonly" });
          }
          return r.apply(this, arguments);
        };
      }
      function as(s) {
        typeof s != "object" || s.AudioContext || (s.AudioContext = s.webkitAudioContext);
      }
      var sa = Te(7963), yo = Te.n(sa);
      function er(s) {
        if (!s.RTCIceCandidate || s.RTCIceCandidate && "foundation" in s.RTCIceCandidate.prototype) return;
        const r = s.RTCIceCandidate;
        s.RTCIceCandidate = function(a) {
          if (typeof a == "object" && a.candidate && a.candidate.indexOf("a=") === 0 && ((a = JSON.parse(JSON.stringify(a))).candidate = a.candidate.substring(2)), a.candidate && a.candidate.length) {
            const c = new r(a), l = yo().parseCandidate(a.candidate);
            for (const n in l) n in c || Object.defineProperty(c, n, { value: l[n] });
            return c.toJSON = function() {
              return { candidate: c.candidate, sdpMid: c.sdpMid, sdpMLineIndex: c.sdpMLineIndex, usernameFragment: c.usernameFragment };
            }, c;
          }
          return new r(a);
        }, s.RTCIceCandidate.prototype = r.prototype, f(s, "icecandidate", (a) => (a.candidate && Object.defineProperty(a, "candidate", { value: new s.RTCIceCandidate(a.candidate), writable: "false" }), a));
      }
      function bo(s) {
        !s.RTCIceCandidate || s.RTCIceCandidate && "relayProtocol" in s.RTCIceCandidate.prototype || f(s, "icecandidate", (r) => {
          if (r.candidate) {
            const a = yo().parseCandidate(r.candidate.candidate);
            a.type === "relay" && (r.candidate.relayProtocol = { 0: "tls", 1: "tcp", 2: "udp" }[a.priority >> 24]);
          }
          return r;
        });
      }
      function Ni(s, r) {
        if (!s.RTCPeerConnection) return;
        "sctp" in s.RTCPeerConnection.prototype || Object.defineProperty(s.RTCPeerConnection.prototype, "sctp", { get() {
          return this._sctp === void 0 ? null : this._sctp;
        } });
        const a = s.RTCPeerConnection.prototype.setRemoteDescription;
        s.RTCPeerConnection.prototype.setRemoteDescription = function() {
          if (this._sctp = null, r.browser === "chrome" && r.version >= 76) {
            const { sdpSemantics: c } = this.getConfiguration();
            c === "plan-b" && Object.defineProperty(this, "sctp", { get() {
              return this._sctp === void 0 ? null : this._sctp;
            }, enumerable: !0, configurable: !0 });
          }
          if (function(c) {
            if (!c || !c.sdp) return !1;
            const l = yo().splitSections(c.sdp);
            return l.shift(), l.some((n) => {
              const e = yo().parseMLine(n);
              return e && e.kind === "application" && e.protocol.indexOf("SCTP") !== -1;
            });
          }(arguments[0])) {
            const c = function(i) {
              const o = i.sdp.match(/mozilla...THIS_IS_SDPARTA-(\d+)/);
              if (o === null || o.length < 2) return -1;
              const u = parseInt(o[1], 10);
              return u != u ? -1 : u;
            }(arguments[0]), l = function(i) {
              let o = 65536;
              return r.browser === "firefox" && (o = r.version < 57 ? i === -1 ? 16384 : 2147483637 : r.version < 60 ? r.version === 57 ? 65535 : 65536 : 2147483637), o;
            }(c), n = function(i, o) {
              let u = 65536;
              r.browser === "firefox" && r.version === 57 && (u = 65535);
              const d = yo().matchPrefix(i.sdp, "a=max-message-size:");
              return d.length > 0 ? u = parseInt(d[0].substring(19), 10) : r.browser === "firefox" && o !== -1 && (u = 2147483637), u;
            }(arguments[0], c);
            let e;
            e = l === 0 && n === 0 ? Number.POSITIVE_INFINITY : l === 0 || n === 0 ? Math.max(l, n) : Math.min(l, n);
            const t = {};
            Object.defineProperty(t, "maxMessageSize", { get: () => e }), this._sctp = t;
          }
          return a.apply(this, arguments);
        };
      }
      function Zi(s) {
        if (!s.RTCPeerConnection || !("createDataChannel" in s.RTCPeerConnection.prototype)) return;
        function r(c, l) {
          const n = c.send;
          c.send = function() {
            const e = arguments[0], t = e.length || e.size || e.byteLength;
            if (c.readyState === "open" && l.sctp && t > l.sctp.maxMessageSize) throw new TypeError("Message too large (can send a maximum of " + l.sctp.maxMessageSize + " bytes)");
            return n.apply(c, arguments);
          };
        }
        const a = s.RTCPeerConnection.prototype.createDataChannel;
        s.RTCPeerConnection.prototype.createDataChannel = function() {
          const c = a.apply(this, arguments);
          return r(c, this), c;
        }, f(s, "datachannel", (c) => (r(c.channel, c.target), c));
      }
      function ss(s) {
        if (!s.RTCPeerConnection || "connectionState" in s.RTCPeerConnection.prototype) return;
        const r = s.RTCPeerConnection.prototype;
        Object.defineProperty(r, "connectionState", { get() {
          return { completed: "connected", checking: "connecting" }[this.iceConnectionState] || this.iceConnectionState;
        }, enumerable: !0, configurable: !0 }), Object.defineProperty(r, "onconnectionstatechange", { get() {
          return this._onconnectionstatechange || null;
        }, set(a) {
          this._onconnectionstatechange && (this.removeEventListener("connectionstatechange", this._onconnectionstatechange), delete this._onconnectionstatechange), a && this.addEventListener("connectionstatechange", this._onconnectionstatechange = a);
        }, enumerable: !0, configurable: !0 }), ["setLocalDescription", "setRemoteDescription"].forEach((a) => {
          const c = r[a];
          r[a] = function() {
            return this._connectionstatechangepoly || (this._connectionstatechangepoly = (l) => {
              const n = l.target;
              if (n._lastConnectionState !== n.connectionState) {
                n._lastConnectionState = n.connectionState;
                const e = new Event("connectionstatechange", l);
                n.dispatchEvent(e);
              }
              return l;
            }, this.addEventListener("iceconnectionstatechange", this._connectionstatechangepoly)), c.apply(this, arguments);
          };
        });
      }
      function Mi(s, r) {
        if (!s.RTCPeerConnection || r.browser === "chrome" && r.version >= 71 || r.browser === "safari" && r.version >= 605) return;
        const a = s.RTCPeerConnection.prototype.setRemoteDescription;
        s.RTCPeerConnection.prototype.setRemoteDescription = function(c) {
          if (c && c.sdp && c.sdp.indexOf(`
a=extmap-allow-mixed`) !== -1) {
            const l = c.sdp.split(`
`).filter((n) => n.trim() !== "a=extmap-allow-mixed").join(`
`);
            s.RTCSessionDescription && c instanceof s.RTCSessionDescription ? arguments[0] = new s.RTCSessionDescription({ type: c.type, sdp: l }) : c.sdp = l;
          }
          return a.apply(this, arguments);
        };
      }
      function To(s, r) {
        if (!s.RTCPeerConnection || !s.RTCPeerConnection.prototype) return;
        const a = s.RTCPeerConnection.prototype.addIceCandidate;
        a && a.length !== 0 && (s.RTCPeerConnection.prototype.addIceCandidate = function() {
          return arguments[0] ? (r.browser === "chrome" && r.version < 78 || r.browser === "firefox" && r.version < 68 || r.browser === "safari") && arguments[0] && arguments[0].candidate === "" ? Promise.resolve() : a.apply(this, arguments) : (arguments[1] && arguments[1].apply(null), Promise.resolve());
        });
      }
      function ei(s, r) {
        if (!s.RTCPeerConnection || !s.RTCPeerConnection.prototype) return;
        const a = s.RTCPeerConnection.prototype.setLocalDescription;
        a && a.length !== 0 && (s.RTCPeerConnection.prototype.setLocalDescription = function() {
          let c = arguments[0] || {};
          if (typeof c != "object" || c.type && c.sdp) return a.apply(this, arguments);
          if (c = { type: c.type, sdp: c.sdp }, !c.type) switch (this.signalingState) {
            case "stable":
            case "have-local-offer":
            case "have-remote-pranswer":
              c.type = "offer";
              break;
            default:
              c.type = "answer";
          }
          return c.sdp || c.type !== "offer" && c.type !== "answer" ? a.apply(this, [c]) : (c.type === "offer" ? this.createOffer : this.createAnswer).apply(this).then((l) => a.apply(this, [l]));
        });
      }
      (function({ window: s } = {}, r = { shimChrome: !0, shimFirefox: !0, shimSafari: !0 }) {
        const a = D, c = function(n) {
          const e = { browser: null, version: null };
          if (n === void 0 || !n.navigator || !n.navigator.userAgent) return e.browser = "Not a browser.", e;
          const { navigator: t } = n;
          if (t.mozGetUserMedia) e.browser = "firefox", e.version = _(t.userAgent, /Firefox\/(\d+)\./, 1);
          else if (t.webkitGetUserMedia || n.isSecureContext === !1 && n.webkitRTCPeerConnection) e.browser = "chrome", e.version = _(t.userAgent, /Chrom(e|ium)\/(\d+)\./, 2);
          else {
            if (!n.RTCPeerConnection || !t.userAgent.match(/AppleWebKit\/(\d+)\./)) return e.browser = "Not a supported browser.", e;
            e.browser = "safari", e.version = _(t.userAgent, /AppleWebKit\/(\d+)\./, 1), e.supportsUnifiedPlan = n.RTCRtpTransceiver && "currentDirection" in n.RTCRtpTransceiver.prototype;
          }
          return e;
        }(s), l = { browserDetails: c, commonShim: v, extractVersion: _, disableLog: b, disableWarnings: L, sdp: sa };
        switch (c.browser) {
          case "chrome":
            if (!k || !X || !r.shimChrome) return a("Chrome shim is not included in this adapter release."), l;
            if (c.version === null) return a("Chrome shim can not determine version, not shimming."), l;
            a("adapter.js shimming chrome."), l.browserShim = k, To(s, c), ei(s), ae(s, c), Oe(s), X(s, c), W(s), J(s, c), ge(s), ke(s), Se(s), ue(s, c), er(s), bo(s), ss(s), Ni(s, c), Zi(s), Mi(s, c);
            break;
          case "firefox":
            if (!A || !_t || !r.shimFirefox) return a("Firefox shim is not included in this adapter release."), l;
            a("adapter.js shimming firefox."), l.browserShim = A, To(s, c), ei(s), pe(s, c), _t(s, c), Ie(s), Dn(s), bn(s), Jt(s), kn(s), Ur(s), Tr(s), gr(s), $n(s), er(s), ss(s), Ni(s, c), Zi(s);
            break;
          case "safari":
            if (!p || !r.shimSafari) return a("Safari shim is not included in this adapter release."), l;
            a("adapter.js shimming safari."), l.browserShim = p, To(s, c), ei(s), Ks(s), os(s), Ir(s), jr(s), Cr(s), un(s), qe(s), as(s), er(s), bo(s), Ni(s, c), Zi(s), Mi(s, c);
            break;
          default:
            a("Unsupported browser!");
        }
      })({ window: typeof window > "u" ? void 0 : window }), Te(8630);
      const cs = () => typeof RTCPeerConnection == "function";
      var It, jt;
      (function(s) {
        s[s.TRACE = 0] = "TRACE", s[s.DEBUG = 1] = "DEBUG", s[s.INFO = 2] = "INFO", s[s.WARN = 3] = "WARN", s[s.ERROR = 4] = "ERROR", s[s.SILENT = 5] = "SILENT";
      })(It || (It = {})), function(s) {
        s.TIME = "Time", s.WEBRTC = "WebRTC", s.EMITTER = "Emitter", s.MEDIA = "Media", s.SUBSCRIPTION = "StageSubscription", s.PUBLICATION = "StagePublication", s.CONNECTION = "StageConnection", s.SOCKET = "StageSocket", s.BROADCAST_STAGE_CLIENT = "BroadcastStageClient", s.STAGE = "Stage", s.REMOTE_PARTICIPANT = "RemoteParticipant", s.LOCAL_PARTICIPANT = "LocalParticipant", s.CONFIGURATION = "Configuration", s.REMOTE_PLAYBACK = "RemotePlaybackController", s.REMOTE_STAGE_STREAM = "RemoteStageStream";
      }(jt || (jt = {}));
      const us = 12e4, Wc = 3e5, zn = "no-rid";
      class Ke extends Error {
        constructor({ name: r, message: a, code: c, details: l, cause: n, params: e }) {
          super(a), Error.captureStackTrace && Error.captureStackTrace(this, Ke), this.name = r || "BroadcastClientError", this.message = a, this.code = c, this.details = l, this.cause = n, this.params = e;
        }
      }
      const Js = { name: "BroadcastError", code: 1e3, message: "Unable to broadcast" }, Si = { name: "CameraError", code: 2e3, message: "Camera could not be captured" }, Ys = { name: "InputError", code: 3e3, message: "Input could not be attached" }, Co = { name: "AddDeviceError", code: 4e3, message: "Device is missing" }, ca = { name: "AddDeviceNameExistsError", code: 4001, message: "Name is already registered" }, Io = { name: "AddDeviceCompositionMissingError", code: 4002, message: "VideoComposition is missing" }, Y = { name: "AddDeviceCompositionIndexMissingError", code: 4003, message: `VideoComposition's "index" property is missing` }, re = { name: "AddDeviceNameMissingError", code: 4004, message: "Name property is missing" }, he = { name: "AddDeviceUnsupported", code: 4005, message: "Unsupported device" }, be = { name: "AddDeviceConstraintsError", code: 4006, message: "Constraints error" }, Xe = { name: "RemoveDeviceNotFoundError", code: 5e3, message: "Device not found" }, en = { name: "RemoveImageNotFoundError", code: 6e3, message: "Image not found" }, it = { name: "UpdateVideoDeviceCompositionMissingError", code: 7e3, message: "VideoComposition is missing" }, tt = { name: "UpdateVideoDeviceCompositionIndexMissingError", code: 7001, message: `VideoComposition's "index" property is missing` }, Ue = { name: "UpdateVideoDeviceCompositionNameMissingError", code: 7002, message: "Video device with that name is not found" }, we = { name: "ExchangePositionDeviceNotFoundError", code: 8e3, message: "Device with that name is not found" }, Ve = { name: "FailedToAddImageError", code: 9e3, message: "Failed to add image" }, We = { name: "PeerSetupError", code: 1e4, message: "Unexpected return value from setup request" }, St = { name: "PeerConnectionError", code: 10001, message: "Peer connection has failed." }, Ft = { name: "InvalidStreamKey", code: 10003, message: "Invalid Stream Key." }, Ht = { name: "BroadcastConfigurationError", code: 11e3, message: "Error when configuring broadcast client" }, Tn = { name: "StreamConfigurationError", code: 12e3, message: "Error when configuring stream" }, ua = { name: "IngestEndpointTypeError", code: 13e3, message: "Ingest endpoint must be a string" }, la = { name: "IngestEndpointUrlError", code: 13001, message: "Ingest endpoint must be a valid https or rtmps URL" }, Qs = { name: "LogLevelTypeError", code: 14e3, message: "Log Level must be a valid integer between [0..5]" }, ls = { name: "LoggerTypeError", code: 15e3, message: "Logger must be an object" }, ds = { name: "ClientInvalidError", code: 16e3, message: "Client is no longer valid, possibly due to delete() invocation." }, hs = { name: "NetworkReconnectConfigurationError", code: 17e3, message: "Error when configuring network reconnect" }, da = { name: "NetworkReconnectConfigurationInvalidTimeoutError", code: 17001, message: "Network reconnect timeout value must be a number between [10000, 300000]" }, Li = { name: "StreamKeyInvalidCharError", code: 18e3, message: "Streamkey must contain only [A-Za-z0-9_-] characters" }, Ro = { name: "StageTokenTypeError", code: 19e3, message: "Stage token must be a string" }, Hc = { name: "StageWhipUrlOverrideError", code: 19001, message: "Stage WHIP override URL must be a string starting with http" };
      var ha, fa, wo, Oo, Ao, pa, fs, Xs, $c, Fr = function(s, r, a, c) {
        if (a === "a" && !c) throw new TypeError("Private accessor was defined without a getter");
        if (typeof r == "function" ? s !== r || !c : !r.has(s)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
        return a === "m" ? c : a === "a" ? c.call(s) : c ? c.value : r.get(s);
      }, Vr = function(s, r, a, c, l) {
        if (typeof r == "function" ? s !== r || !l : !r.has(s)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
        return r.set(s, a), a;
      };
      const ga = 1920, Pu = 1080, pl = It.ERROR, ps = { maxResolution: { width: 852, height: 480 }, maxFramerate: 30, maxBitrate: 1500 }, zc = { maxResolution: { width: 480, height: 852 }, maxFramerate: 30, maxBitrate: 1500 }, $t = { maxResolution: { width: 1920, height: 1080 }, maxFramerate: 30, maxBitrate: 3500 }, Ye = { maxResolution: { width: 1080, height: 1920 }, maxFramerate: 30, maxBitrate: 3500 }, Vt = { maxResolution: { width: 1920, height: 1080 }, maxFramerate: 30, maxBitrate: 8500 }, qc = { maxResolution: { width: 1080, height: 1920 }, maxFramerate: 30, maxBitrate: 8500 }, Kc = { reconnect: !1, timeout: us };
      function Jc(s) {
        var r, a;
        if (typeof s != "string" && s !== void 0) throw new Ke(ua);
        if (s) {
          if (s.startsWith("https")) return s;
          {
            const c = /(?<protocol>(rtmps|https):\/\/)?(?<id>.+)\.(?<environment>(?=\S*['-])([a-zA-Z'-]+))\.live-video\.net.*/.exec(s);
            if (((r = c == null ? void 0 : c.groups) === null || r === void 0 ? void 0 : r.protocol) === "rtmps" && console.warn("rtmps server url detected; please pass in the ingest endpoint (no rtmps:// protocol) instead"), (a = c == null ? void 0 : c.groups) === null || a === void 0 ? void 0 : a.id) return `https://${c.groups.id}.webrtc.live-video.net:4443`;
            throw new Ke(la);
          }
        }
        return "";
      }
      class Du {
        constructor(r, a, c = ps, l, n = Kc) {
          this.LOG_LEVEL = It, this.BASIC_LANDSCAPE = ps, this.BASIC_PORTRAIT = zc, this.BASIC_FULL_HD_LANDSCAPE = $t, this.BASIC_FULL_HD_PORTRAIT = Ye, this.STANDARD_LANDSCAPE = Vt, this.STANDARD_PORTRAIT = qc, ha.set(this, void 0), fa.set(this, void 0), wo.set(this, ps), Oo.set(this, void 0), Ao.set(this, Kc), pa.set(this, (e) => {
            if (!e) throw new Ke(Object.assign(Object.assign({}, Tn), { details: "missing stream configuration" }));
            if (!(e.maxBitrate <= 8500 && e.maxBitrate >= 200)) throw new Ke(Object.assign(Object.assign({}, Tn), { details: "maxBitrate must be between 200 and 8500" }));
            if (!(e.maxFramerate <= 60 && e.maxFramerate >= 10)) throw new Ke(Object.assign(Object.assign({}, Tn), { details: "maxFramerate must be between 10 and 60" }));
            const t = e.maxResolution.width, i = e.maxResolution.height;
            if (t > ga || i > ga || t < 160 || i < 160 || t === ga && i > Pu || i === ga && t > Pu) throw new Ke(Object.assign(Object.assign({}, Tn), { details: "maxResolution values must be between 1080x1920 or 1920x1080" }));
          }), fs.set(this, (e) => {
            if (!e) return;
            const t = Number(e), i = Number.isInteger(t), o = t >= It.TRACE, u = t <= It.SILENT;
            if (!i || !o || !u) throw new Ke(Qs);
          }), Xs.set(this, (e) => {
            if (e && typeof e != "object") throw new Ke(ls);
          }), $c.set(this, (e) => {
            if (!e) return;
            if (typeof e != "object" || typeof e.reconnect != "boolean") throw new Ke(hs);
            const { timeout: t } = e;
            if (t !== void 0 && (Number.isNaN(t) || typeof t != "number" || t < 1e4 || t > Wc)) throw new Ke(da);
          }), Fr(this, Xs, "f").call(this, l), Fr(this, fs, "f").call(this, a), Fr(this, pa, "f").call(this, c), Vr(this, ha, r), Vr(this, fa, a), Vr(this, wo, c), Vr(this, Oo, l), Vr(this, Ao, n);
        }
        get ingestEndpoint() {
          return Fr(this, ha, "f");
        }
        set ingestEndpoint(r) {
          Vr(this, ha, Jc(r));
        }
        get streamConfig() {
          return Fr(this, wo, "f");
        }
        set streamConfig(r) {
          Fr(this, pa, "f").call(this, r), Vr(this, wo, r);
        }
        get logLevel() {
          return Fr(this, fa, "f");
        }
        set logLevel(r) {
          Fr(this, fs, "f").call(this, r), Vr(this, fa, r);
        }
        get logger() {
          return Fr(this, Oo, "f");
        }
        set logger(r) {
          Fr(this, Xs, "f").call(this, r), Vr(this, Oo, r);
        }
        get networkReconnectConfig() {
          return Fr(this, Ao, "f");
        }
        set networkReconnectConfig(r) {
          Fr(this, $c, "f").call(this, r), Vr(this, Ao, r);
        }
      }
      ha = /* @__PURE__ */ new WeakMap(), fa = /* @__PURE__ */ new WeakMap(), wo = /* @__PURE__ */ new WeakMap(), Oo = /* @__PURE__ */ new WeakMap(), Ao = /* @__PURE__ */ new WeakMap(), pa = /* @__PURE__ */ new WeakMap(), fs = /* @__PURE__ */ new WeakMap(), Xs = /* @__PURE__ */ new WeakMap(), $c = /* @__PURE__ */ new WeakMap();
      var je, Cn = Te(228);
      (function(s) {
        s.PUBLISHED_VIDEO_STATS = "ivs_broadcast_webrtc_published_video_stats", s.PUBLISHED_VIDEO_STATS_WINDOW = "ivs_broadcast_webrtc_published_video_stats_window", s.PUBLISHED_AUDIO_STATS = "ivs_broadcast_webrtc_published_audio_stats", s.PUBLISHED_AUDIO_STATS_WINDOW = "ivs_broadcast_webrtc_published_audio_stats_window", s.SUBSCRIBED_VIDEO_STATS = "ivs_broadcast_webrtc_subscribed_video_stats", s.SUBSCRIBED_VIDEO_STATS_WINDOW = "ivs_broadcast_webrtc_sbcrbd_video_stats_window", s.SUBSCRIBED_AUDIO_STATS = "ivs_broadcast_webrtc_subscribed_audio_stats", s.SUBSCRIBED_AUDIO_STATS_WINDOW = "ivs_broadcast_webrtc_sbcrbd_audio_stats_window", s.PUBLISH = "ivs_broadcast_multihost_publish", s.UNPUBLISH = "ivs_broadcast_multihost_unpublish", s.SUBSCRIBE = "ivs_broadcast_multihost_subscribe", s.UNSUBSCRIBE = "ivs_broadcast_multihost_unsubscribe", s.PUBLISH_STARTED = "ivs_broadcast_multihost_publish_started", s.PUBLISH_FAILED = "ivs_broadcast_multihost_publish_failed", s.PUBLISH_ENDED = "ivs_broadcast_multihost_publish_ended", s.STATE_UPDATED = "ivs_broadcast_multihost_event_state_updated", s.SUBSCRIBE_STARTED = "ivs_broadcast_multihost_subscribe_started", s.SUBSCRIBE_FAILED = "ivs_broadcast_multihost_subscribe_failed", s.SUBSCRIBE_ENDED = "ivs_broadcast_multihost_subscribe_ended", s.FIRST_FRAME = "ivs_broadcast_multihost_first_frame", s.JOIN = "ivs_broadcast_multihost_join", s.JOIN_ATTEMPT = "ivs_broadcast_multihost_event_connect_attempt", s.JOIN_ATTEMPT_FAILED = "ivs_broadcast_multihost_event_connect_failed", s.JOIN_ENDED = "ivs_broadcast_multihost_join_ended", s.LEAVE = "ivs_broadcast_multihost_leave", s.REASSIGNMENT_REQUEST = "ivs_broadcast_multihost_reassignment_request", s.SERVER_REQUEST = "ivs_broadcast_multihost_server_request", s.TRACE = "ivs_broadcast_stage_trace", s.ERROR = "ivs_broadcast_error", s.MINUTE = "ivs_broadcast_multihost_minute", s.CONNECTION_STATE = "ivs_broadcast_webrtc_connection_state", s.ICE_GATHERING_STATE = "ivs_broadcast_webrtc_gathering_state", s.EDP_CONNECTED = "ivs_broadcast_multihost_event_connected", s.EDP_DISCONNECTED = "ivs_broadcast_multihost_event_disconnected", s.EDP_PONG = "ivs_broadcast_multihost_edp_rtt", s.SIMULCAST_LAYER_INFO = "ivs_broadcast_simulcast_layer_info", s.MULTIHOST_CONFIGURATION = "ivs_broadcast_multihost_configuration", s.MULTIHOST_SUBSCRIBE_CONFIGURATION = "ivs_broadcast_multihost_subscribe_configuration", s.PLAYBACK_LAYER_REQUEST = "ivs_broadcast_multihost_playback_layer_request", s.PLAYBACK_LAYER_STATE = "ivs_broadcast_multihost_playback_layer_state", s.SELECTED_PAIR_CHANGE = "ivs_broadcast_webrtc_selected_pair_change", s.ANALYTICS_HEALTH_REPORT = "ivs_broadcast_analytics_health_report", s.DEVCONF_ERROR = "ivs_devconf_error", s.DEVCONF_OPS_METRICS = "ivs_devconf_ops_metrics", s.DEVCONF_TRACE = "ivs_devconf_trace", s.DEVCONF_VALUE = "ivs_devconf_value";
      })(je || (je = {}));
      class ot {
        constructor(r, a, c, l) {
          this.event = r, this.properties = { client_time: (/* @__PURE__ */ new Date()).toISOString(), customer_id: a.customerId, device_software: window.navigator.userAgent, multihost_id: a.stageARN, participant_id: a.participantID, participant_user_id: a.userID, platform: "web", sdk_version: "1.28.0", stage_arn: a.stageARN, trace_id: c.value }, a.attrGsRole && (this.properties.token_attribute_0 = a.attrGsRole), a.attrGsSessionId && (this.properties.token_attribute_1 = a.attrGsSessionId), this.critical = l;
        }
      }
      class eo extends ot {
        constructor(r) {
          super(je.ERROR, r.token, r.traceId, !0), Object.assign(this.properties, { code: r.code, tag: r.tag, description: r.message, remote_participant_id: r.remoteParticipantId, request_uuid: r.requestUUID, is_nominal: r.nominal, is_fatal: r.fatal, details: r.details, location: r.location, event_count: r.count });
        }
      }
      function ko(s) {
        const r = window.IVS_CLIENT_OVERRIDES;
        return typeof r == "object" ? r[s] : s === "logLevel" ? window.STAGES_LOG_LEVEL : s === "appLabel" ? window.IVS_APP_LABEL : s === "whipUrl" ? window.IVS_DATA_PLANE_ENDPOINT : void 0;
      }
      function Nn(s) {
        const r = ko(s);
        if (typeof r == "string") return r;
      }
      function ln(s) {
        const r = ko(s);
        if (typeof r == "boolean") return r;
      }
      function gs(s) {
        const r = ko(s);
        if (typeof r == "number") return r;
        if (typeof r == "string") {
          const a = parseFloat(r);
          if (!isNaN(a)) return a;
        }
      }
      function Zs() {
        const s = ko("logLevel");
        if (typeof s == "number" && Object.values(It).includes(s)) return s;
      }
      function ec() {
        return ln("disableXdp");
      }
      function ms() {
        return ln("preferMainProfile");
      }
      function ma() {
        return ln("enableInitialLayerOnSdp");
      }
      function tr() {
        return ln("disableAudioRtcpRsize");
      }
      var Rr = function(s, r, a, c) {
        return new (a || (a = Promise))(function(l, n) {
          function e(o) {
            try {
              i(c.next(o));
            } catch (u) {
              n(u);
            }
          }
          function t(o) {
            try {
              i(c.throw(o));
            } catch (u) {
              n(u);
            }
          }
          function i(o) {
            var u;
            o.done ? l(o.value) : (u = o.value, u instanceof a ? u : new a(function(d) {
              d(u);
            })).then(e, t);
          }
          i((c = c.apply(s, [])).next());
        });
      };
      function wr() {
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (s) => {
          const r = 16 * Math.random() | 0;
          return (s === "x" ? r : 3 & r | 8).toString(16);
        });
      }
      function Or(s, r = (a) => {
      }) {
        Rr(this, void 0, void 0, function* () {
          try {
            yield s();
          } catch (a) {
            r(a);
          }
        });
      }
      var tc = Te(6880), ti = function(s, r, a, c) {
        return new (a || (a = Promise))(function(l, n) {
          function e(o) {
            try {
              i(c.next(o));
            } catch (u) {
              n(u);
            }
          }
          function t(o) {
            try {
              i(c.throw(o));
            } catch (u) {
              n(u);
            }
          }
          function i(o) {
            var u;
            o.done ? l(o.value) : (u = o.value, u instanceof a ? u : new a(function(d) {
              d(u);
            })).then(e, t);
          }
          i((c = c.apply(s, [])).next());
        });
      };
      function Gr(s, r, a = {}, c = "") {
        return ti(this, void 0, void 0, function* () {
          const l = new XMLHttpRequest();
          return l.open(s, r, !0), a && Object.keys(a).forEach((n) => {
            a.hasOwnProperty(n) && l.setRequestHeader(n, a[n]);
          }), new Promise((n, e) => {
            l.onreadystatechange = () => {
              l.readyState === 4 && (l.status >= 200 && l.status < 300 ? n(l.responseText) : e(new Error(`Ingest ${s} ${r} responded ${l.status}
${l.responseText}`)));
            }, l.send(c);
          });
        });
      }
      function Po(s) {
        const r = Date.now();
        for (const c of s) c.properties.batch_time_millis = r;
        var a;
        return { headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" }, body: `data=${a = JSON.stringify(s), btoa(encodeURIComponent(a).replace(/%([0-9A-F]{2})/g, (c, l) => String.fromCharCode(+`0x${l}`)))}` };
      }
      class Yt {
        send(r, a = !1) {
          return ti(this, void 0, void 0, function* () {
            const { currentEndpoint: c } = nr, { headers: l, body: n } = Po(r), e = "eventSenderResult", t = r.length;
            if (a) {
              const i = navigator.sendBeacon(c, n);
              nr.trackEvent({ type: e, success: i, count: t });
            } else Or(() => ti(this, void 0, void 0, function* () {
              yield Gr("POST", c, l, n), nr.trackEvent({ type: e, success: !0, count: t });
            }), () => {
              nr.trackEvent({ type: e, success: !1, count: t });
            });
          });
        }
      }
      class lt {
        constructor() {
          this.emitter = new Cn();
        }
        hasListenersFor(r) {
          return this.emitter.listenerCount(r) > 0;
        }
        on(r, a, c) {
          a.call = /* @__PURE__ */ function(l, n) {
            return function(e, ...t) {
              try {
                n.apply(e, t);
              } catch (i) {
                let o = `Error in callback for ${l}`;
                const u = n.name;
                return u && (o += ` for function ${u}`), void console.error(`${o}
`, i);
              }
            };
          }(r, a), this.emitter.on(r, a, c);
        }
        off(r, a, c) {
          this.emitter.off(r, a, c);
        }
        emit(r, ...a) {
          this.emitter.emit(r, ...a);
        }
        removeAllListeners() {
          this.emitter.removeAllListeners();
        }
      }
      const ni = "https://broadcast.stats.live-video.net/";
      class Yc {
        constructor({ totalEvents: r, totalEventsLost: a, windowedEvents: c, windowedEventsLost: l, currentEndpoint: n }) {
          this.transformProperties = (t, i, o, u, d) => ({ total_events: t, total_events_lost: i, windowed_events: o, windowed_events_lost: u, current_endpoint: d ?? ni });
          const e = this.transformProperties(r, a, c, l, n);
          this.data = { event: je.ANALYTICS_HEALTH_REPORT, properties: Object.assign({}, e) };
        }
      }
      const Qc = { totalEvents: 0, totalEventsSent: 0, totalEventsLost: 0, windowedEvents: 0, windowedEventsSent: 0, windowedEventsLost: 0 };
      var va, In;
      (function(s) {
        s.ANALYTICS_EVENT = "ANALYTICS_EVENT";
      })(va || (va = {}));
      class vs extends lt {
        constructor() {
          super(), this.eventSenderMetrics = Object.assign({}, Qc), this.scheduleHealthReport = () => {
            this.reportTimer = window.setTimeout(this.onHealthReportInterval, 6e4);
          }, this.onHealthReportInterval = () => {
            const r = Object.assign({}, this.eventSenderMetrics);
            if (this.eventSenderMetrics.windowedEvents === 0 ? this.emptyWindows++ : this.emptyWindows = 0, this.emptyWindows > 3) return window.clearTimeout(this.reportTimer), void (this.reportTimer = void 0);
            this.postHealthReport(r), this.eventSenderMetrics.windowedEvents = 0, this.eventSenderMetrics.windowedEventsSent = 0, this.eventSenderMetrics.windowedEventsLost = 0, this.scheduleHealthReport();
          }, this.emptyWindows = 0;
        }
        trackEventSendResult(r) {
          const { count: a, success: c } = r;
          this.eventSenderMetrics.totalEvents += a, this.eventSenderMetrics.windowedEvents += a, c ? (this.eventSenderMetrics.totalEventsSent += a, this.eventSenderMetrics.windowedEventsSent += a) : (this.eventSenderMetrics.totalEventsLost += a, this.eventSenderMetrics.windowedEventsLost += a), this.isHealthReportScheduled() || this.scheduleHealthReport();
        }
        isHealthReportScheduled() {
          return typeof this.reportTimer == "number";
        }
        postHealthReport(r) {
          const a = new Yc(r);
          this.emit(va.ANALYTICS_EVENT, a);
        }
      }
      (function(s) {
        s[s.EXCELLENT = 4] = "EXCELLENT", s[s.GOOD = 3] = "GOOD", s[s.NORMAL = 2] = "NORMAL", s[s.POOR = 1] = "POOR", s[s.DOWN = 0] = "DOWN";
      })(In || (In = {}));
      var ri;
      (function(s) {
        s.NETWORK_QUALITY_CHANGE = "networkQualityChange";
      })(ri || (ri = {}));
      class _a extends lt {
        constructor() {
          super(), this.lastNetworkStatus = {}, this.networkAssessment = { networkQuality: In.NORMAL, reason: "no-data" }, this.checkNetworkStatus = () => {
            var r, a;
            const c = (r = navigator == null ? void 0 : navigator.connection) !== null && r !== void 0 ? r : {}, l = { downlink: c.downlink, effectiveType: c.effectiveType, rtt: c.rtt, isOnline: (a = navigator.onLine) === null || a === void 0 || a };
            if (!this.isChangedNetworkStatus(this.lastNetworkStatus, l)) return;
            this.lastNetworkStatus = l;
            const n = this.networkAssessment, e = function(t) {
              const { rtt: i, downlink: o, isOnline: u } = t;
              if (!u) return { networkQuality: In.DOWN, reason: "offline" };
              if (typeof i != "number" || typeof o != "number") return { networkQuality: In.NORMAL, reason: "no-data" };
              let d = 0;
              i > 800 ? d += 2 : i > 300 && (d += 1), o < 2.5 ? d += 2 : o < 5 && (d += 1);
              const h = "score";
              switch (d) {
                case 4:
                  return { networkQuality: In.POOR, reason: h };
                case 0:
                  return { networkQuality: In.EXCELLENT, reason: h };
                default:
                  return { networkQuality: d <= 2 ? In.GOOD : In.NORMAL, reason: h };
              }
            }(l);
            n.networkQuality !== e.networkQuality && this.emit(ri.NETWORK_QUALITY_CHANGE, n.networkQuality, e.networkQuality), this.networkAssessment = e;
          }, this.getNetworkQuality = () => this.networkAssessment.networkQuality, this.setupWindowListeners(), this.checkNetworkStatus();
        }
        setupWindowListeners() {
          window.addEventListener("online", () => {
            this.checkNetworkStatus();
          }), window.addEventListener("offline", () => {
            this.checkNetworkStatus();
          }), window.navigator.connection && window.navigator.connection.addEventListener("change", () => {
            this.checkNetworkStatus();
          });
        }
        isChangedNetworkStatus(r, a) {
          const { downlink: c, effectiveType: l, rtt: n, isOnline: e } = a;
          return r.effectiveType !== l || r.downlink !== c || r.rtt !== n || r.isOnline !== e;
        }
      }
      var Nu = function(s, r, a, c) {
        return new (a || (a = Promise))(function(l, n) {
          function e(o) {
            try {
              i(c.next(o));
            } catch (u) {
              n(u);
            }
          }
          function t(o) {
            try {
              i(c.throw(o));
            } catch (u) {
              n(u);
            }
          }
          function i(o) {
            var u;
            o.done ? l(o.value) : (u = o.value, u instanceof a ? u : new a(function(d) {
              d(u);
            })).then(e, t);
          }
          i((c = c.apply(s, [])).next());
        });
      };
      class Xc {
        constructor() {
          this.globalSessionId = wr(), this.currentGlobalEndpoint = ni, this.healthReporter = new vs(), this.networkMonitor = new _a(), this.healthReporter.on(va.ANALYTICS_EVENT, (c) => {
            this.trackGlobalEvent(c);
          });
          const r = tc.getParser(navigator.userAgent), a = function(c) {
            const l = /^(\d+)\.(\d+)\.(\d+)[+|-]?(.*)?$/.exec(c) || /^(\d+)\.(\d+)[+|-]?(.*)?$/.exec(c) || /^(\d+)$/.exec(c) || [];
            return { major: parseInt(l[1], 10) || 0, minor: parseInt(l[2], 10) || 0, patch: parseInt(l[3], 10) || 0 };
          }(String(r.getBrowserVersion()));
          this.globalProperties = { browser: navigator.appVersion, browser_family: r.getBrowserName().toLowerCase(), browser_version: `${a.major}.${a.minor}`, customer_id: "ivs", host: window.location.hostname, os_name: r.getOSName(), os_version: String(r.getOSVersion()), platform: "web", global_session_id: this.getGlobalSessionId(), sdk_version: "1.28.0", user_agent: navigator.userAgent, is_backgrounded: (document == null ? void 0 : document.visibilityState) === "hidden" };
        }
        trackGlobalEvent(r) {
          const a = this.getGlobalProperties();
          r.data.properties = Object.assign(Object.assign(Object.assign({}, a), r.data.properties), { current_endpoint: this.currentEndpoint });
          const { headers: c, body: l } = Po([r.data]);
          Or(() => Nu(this, void 0, void 0, function* () {
            yield Gr("POST", this.currentEndpoint, c, l);
          }));
        }
        updateGlobalProperties() {
          this.globalProperties = Object.assign(Object.assign({}, this.globalProperties), { is_backgrounded: (document == null ? void 0 : document.visibilityState) === "hidden" });
        }
        getGlobalSessionId() {
          return this.globalSessionId;
        }
        getGlobalProperties() {
          return this.updateGlobalProperties(), this.globalProperties;
        }
        set currentEndpoint(r) {
          this.currentGlobalEndpoint = r;
        }
        get currentEndpoint() {
          var r;
          return !((r = window.IVS_CLIENT_OVERRIDES) === null || r === void 0) && r.analyticsPostUrl ? window.IVS_CLIENT_OVERRIDES.analyticsPostUrl : this.currentGlobalEndpoint;
        }
        trackEvent(r) {
          r.type === "eventSenderResult" && this.healthReporter.trackEventSendResult(r);
        }
        getNetworkQuality() {
          return this.networkMonitor.getNetworkQuality();
        }
      }
      window.IVS_CLIENT_GLOBAL_STATE || (window.IVS_CLIENT_GLOBAL_STATE = {}), window.IVS_CLIENT_GLOBAL_STATE.session || (window.IVS_CLIENT_GLOBAL_STATE.session = new Xc());
      const nr = window.IVS_CLIENT_GLOBAL_STATE.session;
      function Sa(s) {
        if (!s) throw new Error("eventSender is not defined");
      }
      class _s {
        constructor() {
          this.sharedProperties = {}, this.eventSender = {}, this.queuedEvents = [], this.genSessionId();
          const r = function() {
            const a = Nn("appLabel");
            if (a !== void 0) return a.substring(0, 64);
          }();
          this.eventSender = new Yt(), this.initSharedProperties({ appLabel: r }), this.errorReports = /* @__PURE__ */ new Map();
        }
        start() {
          this.flushInterval || (this.flushInterval = window.setInterval(() => {
            this.queueAggregateErrors({ force: !1 }), this.flushEvents();
          }, 1e3));
        }
        stop(r) {
          let a = !1;
          clearInterval(this.flushInterval), this.flushInterval = void 0, this.queueAggregateErrors({ force: !0 }), r && (this.queuedEvents = this.queuedEvents.filter((c) => c.critical), a = !0), this.flushEvents(a), this.genSessionId();
        }
        trackEvent(r, a = !1) {
          let c = this.sharedProperties;
          a && (c = { global_session_id: this.sharedProperties.global_session_id, session_id: this.sharedProperties.session_id, browser: this.sharedProperties.browser, browser_family: this.sharedProperties.browser_family, browser_version: this.sharedProperties.browser_version, os_name: this.sharedProperties.os_name, os_version: this.sharedProperties.os_version, is_backgrounded: this.sharedProperties.is_backgrounded }), (document == null ? void 0 : document.visibilityState) === "hidden" && (c.is_backgrounded = !0), "data" in r ? (r.data.properties = Object.assign({}, c, r.data.properties), this.queuedEvents.push(r.data)) : (r.properties = Object.assign({}, c, r.properties), this.queuedEvents.push(r));
        }
        trackEventNoSharedProps(r) {
          this.trackEvent(r, !0);
        }
        trackErrorAndThrow(r) {
          throw this.trackError(r), r;
        }
        trackError(r) {
          const a = `${r.code}${r.fatal}${r.nominal}${r.tag}${r.traceId.value}`, c = this.errorReports.get(a), l = { error: r, queuedAt: Date.now(), count: 0 };
          return c ? (c.count === 0 && (c.error = r), c.count += 1, c.queuedAt + 6e4 <= Date.now() ? (this.trackErrorReportIfNeeded(c), void this.errorReports.set(a, l)) : void 0) : (this.errorReports.set(a, l), void this.trackEvent(new eo(r)));
        }
        queueAggregateErrors({ force: r = !1 }) {
          this.errorReports.forEach((a, c) => {
            const l = a.queuedAt + 6e4;
            !r && l > Date.now() || (this.trackErrorReportIfNeeded(a), this.errorReports.delete(c));
          });
        }
        trackErrorReportIfNeeded(r) {
          if (r.count === 0) return;
          const a = r.error;
          a.count = r.count, this.trackEvent(new eo(a));
        }
        batchEvents(r) {
          Sa(this.eventSender);
          const a = r.map((c) => (c.data.properties = Object.assign({}, this.sharedProperties, c.data.properties), c.data));
          this.eventSender.send(a);
        }
        initSharedProperties({ appLabel: r }) {
          const a = nr.getGlobalProperties();
          this.sharedProperties = Object.assign(Object.assign({}, a), { session_id: this.sessionId }), r && (this.sharedProperties.app_label = r);
        }
        genSessionId() {
          this.sessionId = wr(), this.sharedProperties.session_id = this.sessionId;
        }
        flushEvents(r = !1) {
          Sa(this.eventSender), this.queuedEvents.length > 0 && this.eventSender.send(this.queuedEvents, r), this.queuedEvents = [];
        }
        getSessionId() {
          return this.sessionId;
        }
      }
      class nc {
        constructor(r, a) {
          this.transformProperties = (l, n) => ({ sum: l.sum, median: l.median(), min: l.min, max: l.max, p90: l.percentile(0.9), event_count: l.data.length, period: n });
          const c = this.transformProperties(r, a);
          this.data = { event: dn.CONGESTION_TIME, properties: c };
        }
      }
      class Ss {
        constructor(r, a, c) {
          this.transformProperties = (n, e, t) => ({ duration: (n.getTime() - ((e == null ? void 0 : e.getTime()) || 0)) / 1e3, ecn_negotiated: !1, ingest_session_id: t });
          const l = this.transformProperties(r, a, c);
          this.data = { event: dn.CONNECTION_ESTABLISHED, properties: l };
        }
      }
      class rc {
        constructor(r, a) {
          this.transformProperties = (l, n) => ({ sum: l.sum, median: l.median(), min: l.min, max: l.max, p90: l.percentile(0.9), event_count: l.data.length, period: n });
          const c = this.transformProperties(r, a);
          this.data = { event: dn.CONNECTION_RTT, properties: c };
        }
      }
      class rr {
        constructor(r) {
          this.transformProperties = (c) => {
            var l;
            return { is_fatal: (l = c.isFatal) !== null && l !== void 0 && l, value: c.value, code: c.code, description: c.description };
          };
          const a = this.transformProperties(r);
          this.data = { event: dn.ERROR, properties: a };
        }
      }
      class qn {
        constructor(r, a) {
          this.transformProperties = (l, n) => ({ type: l, input_device_id: n.deviceId, position: n.facingMode || "unknown" });
          const c = this.transformProperties(r, a);
          this.data = { event: dn.INPUT_DEVICE_ATTACHED, properties: c };
        }
      }
      class to {
        constructor(r, a) {
          this.transformProperties = (l, n) => ({ type: l, input_device_id: n.deviceId, position: n.facingMode || "unknown" });
          const c = this.transformProperties(r, a);
          this.data = { event: dn.INPUT_DEVICE_DETACHED, properties: c };
        }
      }
      class Ea {
        constructor(r, a) {
          this.transformProperties = (l, n) => ({ sum: l.sum, median: l.median(), min: l.min, max: l.max, p90: l.percentile(0.9), event_count: l.data.length, period: n });
          const c = this.transformProperties(r, a);
          this.data = { event: dn.MEASURED_BITRATE, properties: c };
        }
      }
      class Zc {
        constructor(r, a) {
          this.transformProperties = (l, n) => ({ minutes_logged: Math.round((l.timestamp - n) / 6e4) });
          const c = this.transformProperties(r, a);
          this.data = { event: dn.MINUTE_BROADCAST, properties: c };
        }
      }
      class Mu {
        constructor(r, a) {
          this.transformProperties = (l, n) => ({ sum: l.sum, median: l.median(), min: l.min, max: l.max, p90: l.percentile(0.9), event_count: l.data.length, period: n });
          const c = this.transformProperties(r, a);
          this.data = { event: dn.RECOMMENDED_BITRATE, properties: c };
        }
      }
      class gl {
        constructor(r) {
          this.transformProperties = (c) => ({ codec: c.mimeType, bitrate: 0, sample_rate: c.clockRate, channel_count: c.channels });
          const a = this.transformProperties(r);
          this.data = { event: dn.SESSION_AUDIO_ENCODER_CONFIGURED, properties: a };
        }
      }
      class ml {
        constructor(r) {
          this.transformProperties = (c) => ({ codec: "audio", bitrate: 32e3, sample_rate: c.sampleRate, channel_count: c.channelCount });
          const a = this.transformProperties(r);
          this.data = { event: dn.SESSION_AUDIO_PROPERTIES, properties: a };
        }
      }
      class ya {
        constructor(r, a, c) {
          this.transformProperties = (n, e, t) => ({ codec: t.mimeType, codec_profile: e.profile, codec_level: e.level, rate_mode: "vbr", initial_bitrate: 0, keyframe_interval: 2, width: n.width, height: n.height, bframe_count: 0, target_fps: n.frameRate });
          const l = this.transformProperties(r, a, c);
          this.data = { event: dn.SESSION_VIDEO_ENCODER_CONFIGURED, properties: l };
        }
      }
      class no {
        constructor(r) {
          this.transformProperties = (c) => ({ codec: "video", initial_bitrate: 32e3, min_bitrate: 0, max_bitrate: 0, keyframe_interval: 2, width: c.width, height: c.height, auto_bitrate_enabled: !0, bframes_enabled: !1, target_fps: c.frameRate });
          const a = this.transformProperties(r);
          this.data = { event: dn.SESSION_VIDEO_PROPERTIES, properties: a };
        }
      }
      class ic {
        constructor(r, a) {
          this.transformProperties = (l, n) => ({ sum: l.sum, median: l.median(), min: l.min, max: l.max, p90: l.percentile(0.9), event_count: l.data.length, period: n });
          const c = this.transformProperties(r, a);
          this.data = { event: dn.SOURCE_AUDIO_LATENCY, properties: c };
        }
      }
      class xi {
        constructor(r, a) {
          this.transformProperties = (l, n) => ({ sum: l.sum, median: l.median(), min: l.min, max: l.max, p90: l.percentile(0.9), event_count: l.data.length, period: n });
          const c = this.transformProperties(r, a);
          this.data = { event: dn.SOURCE_VIDEO_LATENCY, properties: c };
        }
      }
      class Wr {
        constructor(r, a) {
          this.transformProperties = ({ protocol: l, hostname: n, port: e }, t) => ({ protocol: l, endpoint_host: n, endpoint_port: e, reason: t });
          const c = this.transformProperties(r, a);
          this.data = { event: dn.START_BROADCAST, properties: c };
        }
      }
      class oc {
        constructor(r) {
          this.transformProperties = ({ protocol: c, hostname: l, port: n }) => ({ protocol: c, endpoint_host: l, endpoint_port: n });
          const a = this.transformProperties(r);
          this.data = { event: dn.STOP_BROADCAST, properties: a };
        }
      }
      class ii {
        constructor(r) {
          this.transformProperties = (c) => ({ bytes_sent: c.bytesSent, header_bytes_sent: c.headerBytesSent, nack_count: c.nackCount, packets_sent: c.packetsSent, retransmitted_bytes_sent: c.retransmittedBytesSent, retransmitted_packets_sent: c.retransmittedPacketsSent });
          const a = this.transformProperties(r);
          this.data = { event: dn.WEBRTC_AUDIO_STATS, properties: a };
        }
      }
      class vn {
        constructor(r) {
          this.transformProperties = (c) => ({ bytes_sent: c.bytesSent, fir_count: c.firCount, frames_encoded: c.framesEncoded, frames_sent: c.framesSent, header_bytes_sent: c.headerBytesSent, huge_frames_sent: c.hugeFramesSent, key_frames_encoded: c.keyFramesEncoded, nack_count: c.nackCount, packets_sent: c.packetsSent, pli_count: c.pliCount, quality_limitation_reason: c.qualityLimitationReason, quality_limitation_resolution_changes: c.qualityLimitationResolutionChanges, retransmitted_bytes_sent: c.retransmittedBytesSent, retransmitted_packets_sent: c.retransmittedPacketsSent, total_encode_time: c.totalEncodeTime, total_encoded_bytes_target: c.totalEncodedBytesTarget, total_packet_send_delay: c.totalPacketSendDelay });
          const a = this.transformProperties(r);
          this.data = { event: dn.WEBRTC_VIDEO_STATS, properties: a };
        }
      }
      var dn, ac;
      (function(s) {
        s.START_BROADCAST = "ivs_broadcast_start_broadcast", s.STOP_BROADCAST = "ivs_broadcast_stop_broadcast", s.MINUTE_BROADCAST = "ivs_broadcast_minute_broadcast", s.WEBRTC_AUDIO_STATS = "ivs_broadcast_webrtc_audio_stats", s.WEBRTC_VIDEO_STATS = "ivs_broadcast_webrtc_video_stats", s.WEBRTC_AUDIO_STATS_WINDOW = "ivs_broadcast_webrtc_audio_stats_window", s.WEBRTC_VIDEO_STATS_WINDOW = "ivs_broadcast_webrtc_video_stats_window", s.CONNECTION_ESTABLISHED = "ivs_broadcast_connection_established", s.SESSION_VIDEO_PROPERTIES = "ivs_broadcast_session_video_properties", s.SESSION_AUDIO_PROPERTIES = "ivs_broadcast_session_audio_properties", s.SESSION_VIDEO_ENCODER_CONFIGURED = "ivs_broadcast_session_video_encoder_configured", s.SESSION_AUDIO_ENCODER_CONFIGURED = "ivs_broadcast_session_audio_encoder_configured", s.SOURCE_AUDIO_LATENCY = "ivs_broadcast_source_audio_latency", s.SOURCE_VIDEO_LATENCY = "ivs_broadcast_source_video_latency", s.INPUT_DEVICE_ATTACHED = "ivs_broadcast_input_device_attached", s.INPUT_DEVICE_DETACHED = "ivs_broadcast_input_device_detached", s.CONGESTION_TIME = "ivs_broadcast_congestion_time", s.BUFFER_DURATION = "ivs_broadcast_buffer_duration", s.MEASURED_BITRATE = "ivs_broadcast_measured_bitrate", s.RECOMMENDED_BITRATE = "ivs_broadcast_recommended_bitrate", s.CONNECTION_RTT = "ivs_broadcast_connection_rtt", s.ERROR = "ivs_broadcast_error";
      })(dn || (dn = {})), function(s) {
        s.USER_INITIATED = "user-initiated", s.NETWORK_DISCONNECT = "network-disconnect";
      }(ac || (ac = {}));
      const Do = { [It.INFO]: "#528bff", [It.WARN]: "#ffb31a", [It.DEBUG]: "#00f593", [It.ERROR]: "#ff4f4d", [It.TRACE]: "", [It.SILENT]: "", [jt.TIME]: "#53535f", [jt.WEBRTC]: "#0e9bd8", [jt.SUBSCRIPTION]: "#ffc400", [jt.CONNECTION]: "#ff5edb", [jt.SOCKET]: "#8585ff", [jt.EMITTER]: "#adadb8", [jt.LOCAL_PARTICIPANT]: "#1DD21D", [jt.STAGE]: "#EC9806", [jt.REMOTE_PARTICIPANT]: "#0680EC", details: "#808080" }, M = ({ label: s }) => `background: ${Do[s] || "#333333"}; color: white; padding: 3px; margin-left: 3px;`, F = Object.entries(It), V = (s, r, a) => {
        const c = M({ label: s }), [l] = F.find(([, T]) => T === Number(s)) || [], n = `%c${l}`, e = M({ label: r }), t = `%c${r}`, i = M({ label: jt.TIME }), o = `%c[${(/* @__PURE__ */ new Date()).toISOString()}]`, u = M({ label: "details" }), d = `%c[${a}]`, h = [o, n, t], S = [i, c, e];
        return a && (h.push(d), S.push(u)), [h.join(""), ...S];
      }, ne = { debug(s) {
        console.groupCollapsed(...V(It.DEBUG, s.scope, s.label)), console.debug(s.msg, Object.assign(Object.assign({}, s), { level: "debug" })), console.groupEnd();
      }, info(s) {
        console.groupCollapsed(...V(It.INFO, s.scope, s.label)), console.info(s.msg, Object.assign(Object.assign({}, s), { level: "info" })), console.groupEnd();
      }, warn(s) {
        console.groupCollapsed(...V(It.WARN, s.scope, s.label)), console.warn(s.msg, Object.assign(Object.assign({}, s), { level: "warn" })), console.groupEnd();
      }, error(s) {
        console.groupCollapsed(...V(It.ERROR, s.scope, s.label)), console.error(s), console.groupEnd();
      } };
      var Ee = function(s, r) {
        var a = {};
        for (var c in s) Object.prototype.hasOwnProperty.call(s, c) && r.indexOf(c) < 0 && (a[c] = s[c]);
        if (s != null && typeof Object.getOwnPropertySymbols == "function") {
          var l = 0;
          for (c = Object.getOwnPropertySymbols(s); l < c.length; l++) r.indexOf(c[l]) < 0 && Object.prototype.propertyIsEnumerable.call(s, c[l]) && (a[c[l]] = s[c[l]]);
        }
        return a;
      };
      Object.entries(It);
      class Pe {
        constructor(r = pl, a = ne) {
          this.logLevel = r, this.loggerInstance = a;
        }
        debug(r) {
          var a, c;
          this.logLevel > It.DEBUG || (c = (a = this.loggerInstance).debug) === null || c === void 0 || c.call(a, JSON.parse(JSON.stringify(Object.assign(Object.assign({}, r), { level: "debug" }))));
        }
        info(r) {
          var a, c;
          this.logLevel > It.INFO || (c = (a = this.loggerInstance).info) === null || c === void 0 || c.call(a, JSON.parse(JSON.stringify(Object.assign(Object.assign({}, r), { level: "info" }))));
        }
        warn(r) {
          var a, c;
          this.logLevel > It.WARN || (c = (a = this.loggerInstance).warn) === null || c === void 0 || c.call(a, JSON.parse(JSON.stringify(Object.assign(Object.assign({}, r), { level: "warn" }))));
        }
        error(r) {
          var a, c, { err: l } = r, n = Ee(r, ["err"]);
          this.logLevel > It.ERROR || (c = (a = this.loggerInstance).error) === null || c === void 0 || c.call(a, Object.assign({ err: l }, n));
        }
      }
      class Ze {
        constructor(r, a) {
          this.logger = r, this.scope = a;
        }
        debug(r) {
          var a, c;
          (c = (a = this.logger).debug) === null || c === void 0 || c.call(a, JSON.parse(JSON.stringify(Object.assign(Object.assign({}, r), { scope: this.scope }))));
        }
        info(r) {
          var a, c;
          (c = (a = this.logger).info) === null || c === void 0 || c.call(a, JSON.parse(JSON.stringify(Object.assign(Object.assign({}, r), { scope: this.scope }))));
        }
        warn(r) {
          var a, c;
          (c = (a = this.logger).warn) === null || c === void 0 || c.call(a, JSON.parse(JSON.stringify(Object.assign(Object.assign({}, r), { scope: this.scope }))));
        }
        error(r) {
          var a, c, { err: l } = r, n = Ee(r, ["err"]);
          (c = (a = this.logger).error) === null || c === void 0 || c.call(a, Object.assign(Object.assign({ err: l }, n), { scope: this.scope }));
        }
        unwrap() {
          return this.logger;
        }
      }
      class on {
        constructor() {
          this.min = 0, this.max = 0, this.sum = 0, this.data = [];
        }
        push(r) {
          (this.min === 0 || r < this.min) && (this.min = r), r >= this.max && (this.max = r), this.data.push(r), this.sum += r;
        }
        median() {
          this.data.sort();
          const r = this.data.length >> 1;
          return this.data.length % 2 == 0 ? this.data[r - 1] + this.data[r] >> 1 : this.data[r];
        }
        percentile(r) {
          if (this.data.length === 0) return 0;
          if (r <= 0) return this.data[0];
          if (r >= 1) return this.data[this.data.length - 1];
          const a = (this.data.length - 1) * r, c = Math.floor(a), l = c + 1, n = a % 1;
          return l >= this.data.length ? this.data[c] : this.data[c] * (1 - n) + this.data[l] * n;
        }
      }
      var Qe = function(s, r, a, c) {
        return new (a || (a = Promise))(function(l, n) {
          function e(o) {
            try {
              i(c.next(o));
            } catch (u) {
              n(u);
            }
          }
          function t(o) {
            try {
              i(c.throw(o));
            } catch (u) {
              n(u);
            }
          }
          function i(o) {
            var u;
            o.done ? l(o.value) : (u = o.value, u instanceof a ? u : new a(function(d) {
              d(u);
            })).then(e, t);
          }
          i((c = c.apply(s, [])).next());
        });
      };
      class Es {
        constructor(r, a, c, l) {
          this.peerClient = r, this.broadcastCanvasManager = a, this.analyticsTracker = l, this.logger = new Ze(c, jt.EMITTER), this.previousBytesSent = 0, this.startTimestamp = 0, this.initializeSamples();
        }
        start() {
          this.logger.info({ msg: "start emitter" }), this.collectSamplesTimerId = window.setInterval(() => {
            this.collectSamples();
          }, 1e3), this.trackSamplesTimerId = window.setInterval(() => {
            this.trackSamples();
          }, 3e4), this.trackPeerConnectionStatsTimerId = window.setInterval(() => {
            this.trackPeerConnectionStats();
          }, 6e4), this.trackSamples();
        }
        stop() {
          clearInterval(this.collectSamplesTimerId), clearInterval(this.trackSamplesTimerId), clearInterval(this.trackPeerConnectionStatsTimerId), this.collectSamplesTimerId = void 0, this.trackSamplesTimerId = void 0, this.trackPeerConnectionStatsTimerId = void 0;
        }
        trackPeerConnectionStats() {
          return Qe(this, void 0, void 0, function* () {
            (yield this.peerClient.getReports()).forEach((r) => {
              if (r.type === "outbound-rtp") switch (r.kind) {
                case "audio":
                  this.analyticsTracker.trackEvent(new ii(r));
                  break;
                case "video": {
                  const a = new vn(r), c = new Zc(r, this.startTimestamp);
                  this.analyticsTracker.batchEvents([a, c]);
                  break;
                }
                default:
                  this.logger.warn({ msg: "unknown report kind: ", reportKind: r.kind });
              }
            });
          });
        }
        collectSamples() {
          return Qe(this, void 0, void 0, function* () {
            let r = 0;
            this.audioLatencySamples.push(this.broadcastCanvasManager.getAudioLatency()), this.videoLatencySamples.push(this.broadcastCanvasManager.getVideoLatency()), (yield this.peerClient.getReports()).forEach((c) => {
              switch (c.type) {
                case "candidate-pair":
                  c.nominated && (this.rttSamples.push(c.currentRoundTripTime), this.recommendedBitrateSamples.push(c.availableOutgoingBitrate));
                  break;
                case "outbound-rtp":
                  r += c.bytesSent || 0, this.startTimestamp === 0 && c.kind === "video" && (this.startTimestamp = c.timestamp);
              }
            });
            const a = 8 * Math.round(r - this.previousBytesSent);
            this.previousBytesSent = r, this.measuredBitrateSamples.push(a);
          });
        }
        trackSamples() {
          const a = new ic(this.audioLatencySamples, 30), c = new xi(this.videoLatencySamples, 30), l = new nc(this.congestionTimeSamples, 30), n = new Ea(this.measuredBitrateSamples, 30), e = new Mu(this.recommendedBitrateSamples, 30), t = new rc(this.rttSamples, 30);
          this.analyticsTracker.batchEvents([a, c, l, n, e, t]), this.initializeSamples();
        }
        initializeSamples() {
          this.audioLatencySamples = new on(), this.videoLatencySamples = new on(), this.congestionTimeSamples = new on(), this.measuredBitrateSamples = new on(), this.recommendedBitrateSamples = new on(), this.rttSamples = new on();
        }
      }
      const mr = { CONNECTION_STATE_CHANGE: "connectionStateChange", ERROR: "clientError", ACTIVE_STATE_CHANGE: "activeStateChange" }, Rt = "connectionStateChange", Bi = "sdpNegotiated", ro = "clientError", Ar = "seiMessageReceived", Hr = "transformError";
      var xe;
      (function(s) {
        s.CLOSED = "closed", s.COMPLETED = "completed", s.CONNECTED = "connected", s.CONNECTING = "connecting", s.DISCONNECTED = "disconnected", s.FAILED = "failed", s.IDLE = "idle", s.NEW = "new", s.NONE = "none";
      })(xe || (xe = {}));
      const Fe = (s) => {
        const r = (n) => {
          var e;
          return !((e = n.deviceId) === null || e === void 0) && e.startsWith("web-contents-media-stream") ? "tab" : void 0;
        }, a = (n) => {
          var e;
          return !((e = n.deviceId) === null || e === void 0) && e.startsWith("window") && n.displaySurface === "window" ? "window" : void 0;
        }, c = (n) => {
          var e;
          return !((e = n.deviceId) === null || e === void 0) && e.startsWith("screen") && n.displaySurface === "monitor" ? "screen" : void 0;
        };
        return (r(l = s) || a(l) || c(l) ? void 0 : "camera") || c(s) || a(s) || r(s) || "unknown";
        var l;
      };
      function eu(s, r) {
        return s.find((a) => a.kind === r);
      }
      function ys(s) {
        return (s == null ? void 0 : s.readyState) === "live";
      }
      var Je;
      (function(s) {
        s.VIDEO = "video", s.AUDIO = "audio";
      })(Je || (Je = {}));
      class vl {
        constructor() {
          this.mediaTracks = /* @__PURE__ */ new Map([[Je.VIDEO, void 0], [Je.AUDIO, void 0]]);
        }
        setTrack(r, a) {
          this.mediaTracks.set(r, a);
        }
        getTrack(r) {
          return this.mediaTracks.get(r);
        }
      }
      class _l {
        constructor() {
          this.levelAsymmetryAllowed = !1, this.packetisationMode = !1, this.profile = "", this.level = 0;
        }
        extractVideoSdpFmtpLine(r) {
          return r ? (r.split("\r").join(";").split(`
`).join(";").split(" ").join(";").split(";").map((a) => a.trim()).filter(Boolean).forEach((a) => {
            const c = a.split("=");
            if (c.length === 2) switch (c[0]) {
              case "level-asymmetry-allowed":
                c[1] === "1" ? this.levelAsymmetryAllowed = !0 : this.levelAsymmetryAllowed = !1;
                break;
              case "packetization-mode":
                c[1] === "1" ? this.packetisationMode = !0 : this.packetisationMode = !1;
                break;
              case "profile-level-id":
                this.profile = this.getProfileFromId(c[1]), this.level = this.getLevelFromId(c[1]);
            }
          }), { levelAsymmetryAllowed: this.levelAsymmetryAllowed, packetisationMode: this.packetisationMode, profile: this.profile, level: this.level }) : { levelAsymmetryAllowed: this.levelAsymmetryAllowed, packetisationMode: this.packetisationMode, profile: this.profile, level: this.level };
        }
        getProfileFromId(r) {
          const a = r.substr(0, 2), c = r.substr(2, 2);
          switch (a.substr(0, 2)) {
            case "42":
              return "baseline";
            case "4d":
              return "main";
            case "58":
              return "extended";
            case "64":
              return "high";
            case "6e":
              return c === "00" ? "high 10" : "high 10 intra";
            case "7a":
              return c === "00" ? "high 42" : "high 42 intra";
            case "f4":
              return c === "00" ? "high 44" : "high 44 intra";
            default:
              return "unknown";
          }
        }
        getLevelFromId(r) {
          return parseInt(r.substr(4, 2), 16);
        }
      }
      function Sl(s) {
        return btoa(JSON.stringify(s));
      }
      var Rn, Un = function(s, r, a, c) {
        return new (a || (a = Promise))(function(l, n) {
          function e(o) {
            try {
              i(c.next(o));
            } catch (u) {
              n(u);
            }
          }
          function t(o) {
            try {
              i(c.throw(o));
            } catch (u) {
              n(u);
            }
          }
          function i(o) {
            var u;
            o.done ? l(o.value) : (u = o.value, u instanceof a ? u : new a(function(d) {
              d(u);
            })).then(e, t);
          }
          i((c = c.apply(s, [])).next());
        });
      };
      (function(s) {
        s.IDLE = "idle", s.EXECUTING = "executing", s.RECONNECTING = "reconnecting";
      })(Rn || (Rn = {}));
      class io {
        constructor(r, a = 12e4, c, l) {
          this.state = Rn.IDLE, this.failureCallback = () => {
          }, this.peerClient = r, this.timeout = a, this.logger = c, this.emitter = l;
        }
        onFailure(r) {
          this.failureCallback = r;
        }
        setStartConfig(r, a) {
          this.ingestEndpoint = r, this.streamKey = a;
        }
        execute() {
          const { id: r } = this;
          this.state === Rn.IDLE && (this.state = Rn.EXECUTING, this.emitter.emit(mr.CONNECTION_STATE_CHANGE, xe.CONNECTING), this.logger.info({ msg: "Starting execution of reconnect strategy.", id: r }), this.startTimeoutTimer(this.timeout), this.executeStrategy());
        }
        startTimeoutTimer(r) {
          this.timeoutTimerId = window.setTimeout(() => {
            this.state !== Rn.IDLE && (this.logger.info({ msg: "Reconnect strategy timed out." }), this.stop(), this.emitter.emit(mr.CONNECTION_STATE_CHANGE, xe.FAILED), this.failureCallback());
          }, r);
        }
        stop() {
          this.state = Rn.IDLE, clearTimeout(this.timeoutTimerId), this.stopStrategy();
        }
        reconnect() {
          return Un(this, void 0, void 0, function* () {
            if (this.ingestEndpoint && this.streamKey) {
              const r = this.peerClient.getConnectionState();
              try {
                this.logger.info({ msg: "Attempting reconnect." }), r === xe.CONNECTED ? this.logger.info({ msg: "Already connected! Stopping reconnect strategy." }) : (yield this.peerClient.start(this.ingestEndpoint, this.streamKey), this.logger.info({ msg: "Reconnect succeeded!" })), this.stop();
              } catch (a) {
                throw this.logger.error({ err: a }), a;
              }
            }
          });
        }
        isActive() {
          return this.state !== Rn.IDLE;
        }
      }
      class tu extends io {
        constructor() {
          super(...arguments), this.id = "ExponentialBackoffStrategy";
        }
        executeStrategy() {
          let r = 5e3;
          const a = () => Un(this, void 0, void 0, function* () {
            if (this.state === Rn.EXECUTING) try {
              this.state = Rn.RECONNECTING, yield this.reconnect();
            } catch {
              this.logger.warn({ msg: "Attempted reconnect failed. Trying again in: ", nextRetry: r }), this.state = Rn.EXECUTING, this.currentTimeoutId = window.setTimeout(a, r), r *= 2;
            }
          });
          this.currentTimeoutId = window.setTimeout(a, 0);
        }
        stopStrategy() {
          clearTimeout(this.currentTimeoutId);
        }
      }
      class No extends io {
        constructor() {
          super(...arguments), this.id = "NetworkApiStrategy", this.onConnectionChange = () => Un(this, void 0, void 0, function* () {
            if (navigator.onLine && this.state === Rn.EXECUTING) {
              this.state = Rn.RECONNECTING;
              try {
                yield this.reconnect();
              } catch {
                this.logger.warn({ msg: "Attempted reconnect failed." }), this.state = Rn.EXECUTING;
              }
            }
          });
        }
        executeStrategy() {
          navigator.connection.addEventListener("change", this.onConnectionChange), this.onConnectionChange();
        }
        stopStrategy() {
          navigator.connection.removeEventListener("change", this.onConnectionChange);
        }
      }
      class nu {
        static create(r, a = Kc, c, l) {
          const { reconnect: n, timeout: e } = a;
          if (n) {
            const t = tc.getParser(navigator.userAgent).getBrowserName().toLowerCase();
            return ["edge", "chrome"].includes(t) && navigator.connection ? new No(r, e, c, l) : new tu(r, e, c, l);
          }
        }
      }
      var bs, oi = function(s, r, a, c) {
        return new (a || (a = Promise))(function(l, n) {
          function e(o) {
            try {
              i(c.next(o));
            } catch (u) {
              n(u);
            }
          }
          function t(o) {
            try {
              i(c.throw(o));
            } catch (u) {
              n(u);
            }
          }
          function i(o) {
            var u;
            o.done ? l(o.value) : (u = o.value, u instanceof a ? u : new a(function(d) {
              d(u);
            })).then(e, t);
          }
          i((c = c.apply(s, [])).next());
        });
      }, ru = function(s, r, a, c) {
        if (a === "a" && !c) throw new TypeError("Private accessor was defined without a getter");
        if (typeof r == "function" ? s !== r || !c : !r.has(s)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
        return a === "m" ? c : a === "a" ? c.call(s) : c ? c.value : r.get(s);
      };
      const Ui = (s) => !!s;
      function Kn(s) {
        if (!s) throw new Error("PeerConnection is not defined");
      }
      const Mo = { bundlePolicy: "max-bundle", rtcpMuxPolicy: "require", enableDtlsSrtp: { exact: !0 }, enableRtpDataChannels: { exact: !1 }, optional: [{ googHighStartBitrate: { exact: 0 } }, { googPayloadPadding: { exact: !0 } }, { googScreencastMinBitrate: { exact: 100 } }, { googCpuOveruseDetection: { exact: !0 } }, { googCpuOveruseEncodeUsage: { exact: !0 } }, { googCpuUnderuseThreshold: { exact: 55 } }, { googCpuOveruseThreshold: { exact: 85 } }, { enableDscp: { exact: !0 } }] };
      class El {
        constructor(r, a, c, l, n) {
          this.config = r, this.emitter = a, this.mediaStreamManager = c, this.analyticsTracker = n, this.establishConnection = (e, t) => oi(this, void 0, void 0, function* () {
            var i, o, u;
            Kn(this.peerConnection);
            try {
              const d = yield this.peerConnection.createOffer({ offerToReceiveAudio: !1, offerToReceiveVideo: !1 });
              yield this.handleLocalDescription(d), yield this.sendSetupRequest(e, t, d);
            } catch (d) {
              if (d instanceof Error) {
                (i = (u = d).code) !== null && i !== void 0 || (u.code = We.code);
                const h = new Ke(Object.assign(Object.assign({}, We), { name: d.name, message: d.message, code: d == null ? void 0 : d.code, cause: d }));
                throw !((o = this.reconnectStrategy) === null || o === void 0) && o.isActive() || this.handleError(d.code, d.message), this.stop(), h;
              }
            }
          }), this.getSessionId = () => this.ingestSessionId, this.getConnectionState = () => {
            var e;
            if (!this.peerConnection) return xe.NONE;
            const t = (e = this.reconnectStrategy) === null || e === void 0 ? void 0 : e.isActive(), i = this.peerConnection.connectionState || this.peerConnection.iceConnectionState;
            switch (i) {
              case "new":
                return xe.NEW;
              case "closed":
                return xe.CLOSED;
              case "disconnected":
                return t ? xe.CONNECTING : xe.DISCONNECTED;
              case "failed":
                return t ? xe.CONNECTING : xe.FAILED;
              case "idle":
                return xe.IDLE;
              case "checking":
              case "connecting":
                return xe.CONNECTING;
              case "completed":
              case "connected":
                return xe.CONNECTED;
              default:
                return this.logger.warn({ msg: "Unhandled connection state:", rawState: i }), xe.IDLE;
            }
          }, this.onConnectionStateChange = () => {
            var e;
            const t = this.getConnectionState();
            switch (t) {
              case xe.CONNECTED: {
                this.emitter.emit(mr.CONNECTION_STATE_CHANGE, t);
                const i = /* @__PURE__ */ new Date();
                this.analyticsTracker.trackEvent(new Ss(i, this.connectionStartDate, this.ingestSessionId));
                const o = this.mediaStreamManager.getTrack(Je.AUDIO), u = this.mediaStreamManager.getTrack(Je.VIDEO);
                if (u) {
                  const d = u.getSettings();
                  this.analyticsTracker.trackEvent(new no(d));
                }
                if (o) {
                  const d = o.getSettings();
                  this.analyticsTracker.trackEvent(new ml(d));
                }
                (((e = this.peerConnection) === null || e === void 0 ? void 0 : e.getSenders()) || []).forEach((d) => {
                  var h;
                  (((h = d.getParameters()) === null || h === void 0 ? void 0 : h.codecs) || []).forEach((S) => {
                    var T;
                    switch ((T = d.track) === null || T === void 0 ? void 0 : T.kind) {
                      case "video": {
                        if (!u) break;
                        const I = new _l().extractVideoSdpFmtpLine(S.sdpFmtpLine), R = u.getSettings();
                        this.analyticsTracker.trackEvent(new ya(R, I, S));
                        break;
                      }
                      case "audio":
                        if (!o) break;
                        this.analyticsTracker.trackEvent(new gl(S));
                    }
                  });
                });
                break;
              }
              case xe.CONNECTING:
                this.emitter.emit(mr.CONNECTION_STATE_CHANGE, t), this.connectionStartDate = /* @__PURE__ */ new Date(), this.disconnectionStartDate = void 0;
                break;
              case xe.FAILED:
                this.reconnectStrategy ? this.reconnectStrategy.execute() : (this.emitter.emit(mr.CONNECTION_STATE_CHANGE, t), this.handleTerminalConnectionFailure());
                break;
              case xe.DISCONNECTED:
                this.emitter.emit(mr.CONNECTION_STATE_CHANGE, t), this.disconnectionStartDate = /* @__PURE__ */ new Date();
                break;
              default:
                this.emitter.emit(mr.CONNECTION_STATE_CHANGE, t);
            }
          }, this.handleLocalDescription = (e) => oi(this, void 0, void 0, function* () {
            var t;
            return (t = this.peerConnection) === null || t === void 0 ? void 0 : t.setLocalDescription(e);
          }), bs.set(this, (e) => {
            if (typeof e != "string") throw new Ke(ua);
            try {
              new URL(e);
            } catch {
              throw new Ke(la);
            }
          }), this.logger = new Ze(l, jt.WEBRTC), this.createReconnectStrategy(r);
        }
        start(r, a) {
          var c;
          return oi(this, void 0, void 0, function* () {
            ru(this, bs, "f").call(this, r);
            const l = [this.mediaStreamManager.getTrack(Je.VIDEO), this.mediaStreamManager.getTrack(Je.AUDIO)].filter(Ui);
            if (this.createPeerConnection(), this.addTracks({ tracks: l }), this.reconnectStrategy && this.reconnectStrategy.setStartConfig(r, a), yield this.establishConnection(r, a), !((c = this.reconnectStrategy) === null || c === void 0) && c.isActive()) {
              const n = new URL(r);
              this.analyticsTracker.trackEvent(new Wr({ protocol: "webrtc", hostname: n.hostname, port: n.port }, ac.NETWORK_DISCONNECT));
            }
          });
        }
        stop() {
          var r, a, c, l;
          this.stateCheckInterval && (clearInterval(this.stateCheckInterval), this.stateCheckInterval = void 0), this.stopStreamDataChannel && this.stopStreamDataChannel.readyState === "open" && this.stopStreamDataChannel.send(" "), [xe.NEW, xe.CONNECTING, xe.CONNECTED].includes(this.getConnectionState()) && this.emitter.emit(mr.CONNECTION_STATE_CHANGE, xe.CLOSED), (r = this.peerConnection) === null || r === void 0 || r.close(), (a = this.peerConnection) === null || a === void 0 || a.removeEventListener("connectionstatechange", this.onConnectionStateChange), (c = this.peerConnection) === null || c === void 0 || c.removeEventListener("iceconnectionstatechange", this.onConnectionStateChange), this.ingestSessionId = void 0, (l = this.reconnectStrategy) === null || l === void 0 || l.stop();
        }
        addTracks(r) {
          var a;
          if (Kn(this.peerConnection), !r) return;
          const c = this.peerConnection.getSenders().map((n) => {
            var e;
            return (e = n.track) === null || e === void 0 ? void 0 : e.id;
          }), l = r.tracks.filter((n) => !c.includes(n.id));
          for (const n of l) (a = this.peerConnection) === null || a === void 0 || a.addTrack(n);
        }
        getReports() {
          var r;
          return oi(this, void 0, void 0, function* () {
            try {
              const a = (yield (r = this.peerConnection) === null || r === void 0 ? void 0 : r.getStats()) || [], c = [];
              return a.forEach((l) => {
                c.push(l);
              }), c;
            } catch {
              return [];
            }
          });
        }
        sendSetupRequest(r, a, c) {
          var l;
          return oi(this, void 0, void 0, function* () {
            const n = yield fetch(`${r}/v1/offer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.assign({ offer: Sl(c), streamKey: a }, this.config.streamConfig)) });
            if (!n.ok) throw function(t) {
              let i = new Ke(Object.assign({}, We));
              return (t == null ? void 0 : t.code) === 1007 && (i = new Ke(Object.assign({}, Ft))), t != null && t.message && (i.message = t.message), i;
            }(yield n.json());
            const e = yield n.json();
            e != null && e.answer && (yield (l = this.peerConnection) === null || l === void 0 ? void 0 : l.setRemoteDescription(function(t) {
              return JSON.parse(atob(t));
            }(e.answer)), this.ingestSessionId = e.ingestSessionId);
          });
        }
        handleTerminalConnectionFailure() {
          const r = new Ke(St);
          this.handleError(r.code, r.message);
        }
        handleError(r, a) {
          this.analyticsTracker.trackEvent(new rr({ code: r, description: a, isFatal: !0 })), this.emitter.emit(mr.ERROR, { code: r, message: a });
        }
        createPeerConnection() {
          var r;
          const a = this.getConnectionState(), c = a !== xe.NONE, l = a !== xe.CLOSED, n = (r = this.reconnectStrategy) === null || r === void 0 ? void 0 : r.isActive();
          c && l && !n || (this.stateCheckInterval && (clearInterval(this.stateCheckInterval), this.stateCheckInterval = void 0), this.stateCheckInterval = window.setInterval(() => {
            const e = this.getConnectionState();
            if (this.reconnectStrategy && e === xe.DISCONNECTED && this.disconnectionStartDate) {
              const t = Date.now() - this.disconnectionStartDate.getTime();
              this.logger.info({ msg: "Time since disconnected:", timeSinceDisconnect: t }), t > 1e4 && (this.disconnectionStartDate = void 0, this.reconnectStrategy.execute());
            } else e === xe.CLOSED && (this.handleTerminalConnectionFailure(), clearInterval(this.stateCheckInterval), this.stateCheckInterval = void 0);
          }, 1e3), this.peerConnection = new RTCPeerConnection(Mo), this.stopStreamDataChannel = this.peerConnection.createDataChannel("stopStream"), this.peerConnection.addEventListener("connectionstatechange", this.onConnectionStateChange), this.peerConnection.addEventListener("iceconnectionstatechange", this.onConnectionStateChange));
        }
        createReconnectStrategy(r) {
          if (this.reconnectStrategy = nu.create(this, r.networkReconnectConfig, this.logger, this.emitter), this.reconnectStrategy) {
            this.reconnectStrategy.onFailure(this.handleTerminalConnectionFailure.bind(this));
            const a = this.reconnectStrategy.id;
            this.logger.info({ msg: "Using reconnect strategy:", strategyId: a });
          }
        }
      }
      bs = /* @__PURE__ */ new WeakMap();
      var ba, Lu, Lo = Te(5364);
      (function(s) {
        s.CONFIG = "config", s.UPDATE = "update", s.START = "start", s.STOP = "stop";
      })(ba || (ba = {})), function(s) {
        s.VIDEO_SEND = "video/send", s.VIDEO_RECEIVE = "video/receive", s.INSERT_SEI = "insertSei";
      }(Lu || (Lu = {}));
      var xo = Te(5512), Ta = Te.n(xo);
      function yl() {
        return Ta()(`/*! For license information please see scheduler.worker.worker.js.LICENSE.txt */
(()=>{"use strict";var i,t;!function(i){i.CONFIG="config",i.UPDATE="update",i.START="start",i.STOP="stop"}(i||(i={})),function(i){i.VIDEO_SEND="video/send",i.VIDEO_RECEIVE="video/receive",i.INSERT_SEI="insertSei"}(t||(t={}));const s=self;const n=new class Scheduler{constructor(){this.config={frameRate:60,isRunning:!1}}setConfig(i){this.config=Object.assign(Object.assign({},this.config),i),this.config.isRunning&&(this.stop(),this.start())}start(){this.config.isRunning||(this.intervalId=setInterval((()=>{s.postMessage({type:i.UPDATE})}),1e3/this.config.frameRate),this.config.isRunning=!0)}stop(){this.config.isRunning&&(clearInterval(this.intervalId),this.intervalId=void 0,this.config.isRunning=!1)}};s.addEventListener("message",(function(t){var s;if(null===(s=null==t?void 0:t.data)||void 0===s?void 0:s.type)switch(t.data.type){case i.CONFIG:n.setConfig(t.data.payload||{});break;case i.START:n.start();break;case i.STOP:n.stop()}}))})();`, "Worker", void 0, void 0);
      }
      var Bo = function(s, r, a, c) {
        return new (a || (a = Promise))(function(l, n) {
          function e(o) {
            try {
              i(c.next(o));
            } catch (u) {
              n(u);
            }
          }
          function t(o) {
            try {
              i(c.throw(o));
            } catch (u) {
              n(u);
            }
          }
          function i(o) {
            var u;
            o.done ? l(o.value) : (u = o.value, u instanceof a ? u : new a(function(d) {
              d(u);
            })).then(e, t);
          }
          i((c = c.apply(s, [])).next());
        });
      };
      class bl {
        constructor(r, a, c) {
          this.config = r, this.mediaStreamManager = a, this.analyticsTracker = c, this.handleWorkerEvent = (t) => {
            var i;
            ((i = t.data) === null || i === void 0 ? void 0 : i.type) === ba.UPDATE && this.drawComposite();
          }, this.mixer = { video: [], audio: [] }, this.schedulerWorker = new yl(), this.running = !1, this.compositeEl = document.createElement("canvas"), this.compositeEl.height = this.config.streamConfig.maxResolution.height, this.compositeEl.width = this.config.streamConfig.maxResolution.width;
          const l = this.compositeEl.getContext("2d");
          if (l === null) throw new Ke(Object.assign({}, Js));
          this.compositeContext = l, this.compositeStream = this.compositeEl.captureStream(typeof CanvasCaptureMediaStreamTrack !== void 0 ? 0 : 30);
          const n = eu(this.compositeStream.getTracks(), Je.VIDEO);
          this.audioContext = new AudioContext(), this.unlockAudioContext(), this.audioDestination = this.audioContext.createMediaStreamDestination(), this.setupSilence();
          const e = eu(this.audioDestination.stream.getTracks(), Je.AUDIO);
          n && this.mediaStreamManager.setTrack(Je.VIDEO, n), e && this.mediaStreamManager.setTrack(Je.AUDIO, e), this.schedulerWorker.addEventListener("message", this.handleWorkerEvent), this.schedulerWorker.postMessage({ type: ba.CONFIG, payload: { frameRate: this.config.streamConfig.maxFramerate } }), this.previewElement = null, this.previewCtx = null, this.nextMix = (/* @__PURE__ */ new Date()).getTime();
        }
        attachPreview(r) {
          this.previewElement = r;
          const { width: a, height: c } = this.config.streamConfig.maxResolution;
          this.previewElement.width = a, this.previewElement.height = c, this.previewCtx = this.previewElement.getContext("2d");
        }
        detachPreview() {
          this.previewElement = null, this.previewCtx = null;
        }
        setupSilence() {
          const r = this.audioContext.createConstantSource(), a = this.audioContext.createGain();
          a.gain.value = 1e-3, r.connect(a), a.connect(this.audioDestination), r.start();
        }
        unlockAudioContext() {
          if (this.audioContext.state !== "suspended") return;
          const r = document.body, a = ["touchstart", "touchend", "mousedown", "keydown"], c = () => {
            a.forEach((n) => {
              r.removeEventListener(n, l);
            });
          }, l = () => {
            this.audioContext.resume().then(c);
          };
          a.forEach((n) => {
            r.addEventListener(n, l, !1);
          });
        }
        getTracks() {
          return [this.mediaStreamManager.getTrack(Je.VIDEO), this.mediaStreamManager.getTrack(Je.AUDIO)];
        }
        getCanvasVideoTrack() {
          return this.mediaStreamManager.getTrack(Je.VIDEO);
        }
        getAudioInputDevice(r) {
          if (typeof r != "string") return;
          const a = this.mixer.audio.find((c) => {
            if (c.name === r) return c.source;
          });
          return a == null ? void 0 : a.source;
        }
        getVideoInputDevice(r) {
          if (typeof r == "string") return this.mixer.video.find((a) => a.name === r);
        }
        getCanvasDimensions() {
          return { height: this.compositeEl.height, width: this.compositeEl.width };
        }
        addVideoInputDevice(r, a, c) {
          var l;
          return Bo(this, void 0, void 0, function* () {
            if (typeof r != "object") throw new Ke(Object.assign({}, Co));
            if (!a || typeof a != "string") throw new Ke(Object.assign({}, re));
            if (this.mixer.video.some((h) => h.name === a)) throw new Ke(Object.assign({}, ca));
            if (!c) throw new Ke(Object.assign({}, Io));
            if (typeof c.index != "number") throw new Ke(Object.assign({}, Y));
            const n = function() {
              const h = document.createElement("video");
              return h.autoplay = !0, h.muted = !0, h.setAttribute("playsinline", ""), h.setAttribute("webkit-playsinline", ""), h;
            }(), e = r.getVideoTracks(), [t] = e;
            if (!e.length) throw new Ke(Object.assign({}, Si));
            const i = t.getConstraints(), o = Lo({}, i, { frameRate: this.config.streamConfig.maxFramerate });
            try {
              yield t.applyConstraints(o);
            } catch (h) {
              let S = "Unknown constraints error";
              h instanceof Error && (S = h.message), this.analyticsTracker.trackEvent(new rr({ description: `${be.message}: ${S}`, isFatal: !1, code: be.code }));
            }
            const u = () => Bo(this, void 0, void 0, function* () {
              let h = 0;
              for (; h < 5; ) try {
                return void (yield n.play());
              } catch (S) {
                if (!(S instanceof Error)) throw new Error("unknown error trying to add video to broadcast");
                h++, yield new Promise((T) => setTimeout(T, 150));
              }
              throw new Error("Error playing video, tries exceeded");
            }), d = new MediaStream([t]);
            n.srcObject = d;
            try {
              yield u();
              const h = { name: a, element: n, position: c, source: d, render: !0 }, S = ((l = t.getSettings) === null || l === void 0 ? void 0 : l.call(t)) || {};
              this.analyticsTracker.trackEvent(new qn(Fe(S), S)), this.mixer.video.push(h);
            } catch (h) {
              throw new Ke(Object.assign(Object.assign({}, Si), { cause: h }));
            }
          });
        }
        addImageSource(r, a, c) {
          var l;
          return Bo(this, void 0, void 0, function* () {
            if (!r) throw new Ke(Object.assign({}, Co));
            if (!a || typeof a != "string") throw new Ke(Object.assign({}, re));
            if (r.tagName === "image") throw new Ke(Object.assign({}, he));
            if (this.mixer.video.some((e) => e.name === a)) throw new Ke(Object.assign({}, ca));
            if (!c) throw new Ke(Object.assign({}, Io));
            if (typeof c.index != "number") throw new Ke(Object.assign({}, Y));
            if (r instanceof Image) {
              const e = (l = r.src) === null || l === void 0 ? void 0 : l.slice();
              try {
                const t = r.src ? new URL(r.src) : {};
                if (t.host && t.hostname) {
                  const i = yield fetch(r.src).then((u) => Bo(this, void 0, void 0, function* () {
                    return u.blob();
                  })), o = yield new Promise((u) => {
                    const d = new FileReader();
                    d.onload = () => {
                      u(d.result);
                    }, d.readAsDataURL(i);
                  });
                  r.src = o;
                }
              } catch {
                throw new Ke(Object.assign(Object.assign({}, Ve), { params: { details: `Image URL: ${e}` } }));
              }
            }
            const n = { name: a, element: r, position: c, render: !0 };
            this.mixer.video.push(n);
          });
        }
        addAudioInputDevice(r, a) {
          return Bo(this, void 0, void 0, function* () {
            if (typeof r != "object") throw new Ke(Object.assign({}, Co));
            if (!a || typeof a != "string") throw new Ke(Object.assign({}, re));
            if (this.mixer.audio.some((t) => t.name === a)) throw new Ke(Object.assign({}, ca));
            const c = r.getAudioTracks();
            if (!c.length) throw new Ke(Object.assign({}, Ys));
            const l = this.audioContext.createMediaStreamSource(new MediaStream(c)), n = this.audioContext.createGain();
            n.gain.value = 1, l.connect(n), n.connect(this.audioDestination);
            const e = { name: a, source: r, audioTrackSource: l, gainNode: n };
            this.analyticsTracker.trackEvent(new qn("audio", { deviceId: r.id })), this.mixer.audio.push(e);
          });
        }
        removeImage(r) {
          const a = this.mixer.video.findIndex((c) => c.name === r);
          if (a < 0) throw new Ke(Object.assign({}, en));
          this.mixer.video.splice(a, 1);
        }
        removeVideoInputDevice(r) {
          var a;
          const c = this.removeDevice(r, this.mixer.video);
          if (!c) throw new Ke(Object.assign({}, Xe));
          {
            const l = eu(c.source.getTracks(), Je.VIDEO);
            if (!l) throw new Ke(Object.assign({}, Xe));
            c.element.srcObject = null, l.stop();
            const n = ((a = l == null ? void 0 : l.getSettings) === null || a === void 0 ? void 0 : a.call(l)) || {};
            this.analyticsTracker.trackEvent(new to(Fe(n), n));
          }
        }
        removeAudioInputDevice(r) {
          const a = this.removeDevice(r, this.mixer.audio);
          if (a != null && a.audioTrackSource) {
            for (const c of a.source.getTracks()) c.stop(), this.analyticsTracker.trackEvent(new to("audio", { deviceId: c.id }));
            a.gainNode.disconnect(this.audioDestination);
          } else if (!a) throw new Ke(Object.assign({}, Xe));
        }
        updateVideoDeviceComposition(r, a) {
          if (!r || typeof r != "string") throw new Ke(Object.assign({}, Ue));
          if (!a) throw new Ke(Object.assign({}, it));
          if (typeof a.index != "number") throw new Ke(Object.assign({}, tt));
          this.mixer.video.forEach((c, l) => {
            c.name === r && (c.position = a);
          });
        }
        exchangeVideoDevicePositions(r, a) {
          const c = this.getVideoInputDevice(r), l = this.getVideoInputDevice(a);
          if (!c) throw new Ke(Object.assign(Object.assign({}, we), { params: { details: `device with name: "${r}" not found` } }));
          if (!l) throw new Ke(Object.assign(Object.assign({}, we), { params: { details: `device with name: "${a}" not found` } }));
          const n = Object.assign({}, c.position), e = Object.assign({}, l.position);
          for (const t of this.mixer.video) t.name === r && (xu(e.x) ? t.position = Object.assign(Object.assign({}, t.position), e) : t.position = { index: e.index }), t.name === a && (xu(n.x) ? t.position = Object.assign(Object.assign({}, t.position), n) : t.position = { index: n.index });
        }
        start() {
          this.running || (this.running = !0, this.schedulerWorker.postMessage({ type: ba.CONFIG, payload: { frameRate: this.config.streamConfig.maxFramerate } }), this.schedulerWorker.postMessage({ type: ba.START }));
        }
        stop() {
          this.running && (this.running = !1, this.schedulerWorker.removeEventListener("message", this.handleWorkerEvent));
        }
        isCapturing() {
          return this.running;
        }
        getAudioLatency() {
          return this.audioContext.baseLatency;
        }
        getVideoLatency() {
          var r;
          return ((r = this.mediaStreamManager.getTrack(Je.VIDEO)) === null || r === void 0 ? void 0 : r.getConstraints().latency) || 0;
        }
        disableVideo() {
          this.mixer.video.forEach((r) => {
            r.render = !1;
          });
        }
        enableVideo() {
          this.mixer.video.forEach((r) => {
            r.render = !0;
          });
        }
        disableAudio() {
          this.mixer.audio.forEach((r) => {
            r.audioTrackSource && (r.gainNode.gain.value = 0);
          });
        }
        enableAudio() {
          this.mixer.audio.forEach((r) => {
            r.audioTrackSource && (r.gainNode.gain.value = 1);
          });
        }
        getDrawRegion(r, a, c) {
          var l, n, e, t;
          let i = (l = r.position.x) !== null && l !== void 0 ? l : 0, o = (n = r.position.y) !== null && n !== void 0 ? n : 0;
          const u = (e = r.position.width) !== null && e !== void 0 ? e : a - i, d = (t = r.position.height) !== null && t !== void 0 ? t : c - o, h = u / d;
          let S = r.element.width, T = r.element.height;
          r.element instanceof HTMLVideoElement && (S = r.element.videoWidth, T = r.element.videoHeight);
          const I = S / T;
          let R = u, w = d;
          return I > h ? (R = u, w = 2 * Math.round(u / I / 2), o += (d - w) / 2) : I < h && (w = d, R = 2 * Math.round(d * I / 2), i += (u - R) / 2), { x: i, y: o, width: R, height: w };
        }
        drawComposite() {
          if (!this.shouldMix(/* @__PURE__ */ new Date())) return;
          this.compositeContext.clearRect(0, 0, this.compositeEl.width, this.compositeEl.height), this.drawBlackScreen();
          const r = this.mixer.video.filter((a) => a.render);
          r.sort((a, c) => a.position.index - c.position.index);
          for (const a of r) {
            const { x: c, y: l, width: n, height: e } = this.getDrawRegion(a, this.compositeEl.width, this.compositeEl.height);
            this.compositeContext.drawImage(a.element, c, l, n, e);
          }
          this.previewElement && this.previewCtx && this.previewCtx.drawImage(this.compositeEl, 0, 0, this.previewElement.width, this.previewElement.height), this.requestCanvasCapture();
        }
        requestCanvasCapture() {
          typeof CanvasCaptureMediaStreamTrack !== void 0 && (typeof this.compositeStream.requestFrame == "function" ? this.compositeStream.requestFrame() : this.mediaStreamManager.getTrack(Je.VIDEO).requestFrame());
        }
        drawBlackScreen() {
          this.compositeContext.fillStyle = "#000000", this.compositeContext.fillRect(0, 0, this.compositeEl.width, this.compositeEl.height);
        }
        removeDevice(r, a) {
          const c = a.findIndex((l) => ((n) => n.name === r)(l));
          if (!(c < 0)) return a.splice(c, 1)[0];
        }
        shouldMix(r) {
          if (r.getTime() < this.nextMix) return !1;
          for (; this.nextMix <= r.getTime(); ) this.nextMix += 1e3 / this.config.streamConfig.maxFramerate;
          return !0;
        }
      }
      function xu(s) {
        return Number.isSafeInteger(s);
      }
      var gt, wt, sc = function(s, r, a, c) {
        return new (a || (a = Promise))(function(l, n) {
          function e(o) {
            try {
              i(c.next(o));
            } catch (u) {
              n(u);
            }
          }
          function t(o) {
            try {
              i(c.throw(o));
            } catch (u) {
              n(u);
            }
          }
          function i(o) {
            var u;
            o.done ? l(o.value) : (u = o.value, u instanceof a ? u : new a(function(d) {
              d(u);
            })).then(e, t);
          }
          i((c = c.apply(s, [])).next());
        });
      }, Tl = function(s, r, a, c) {
        if (a === "a" && !c) throw new TypeError("Private accessor was defined without a getter");
        if (typeof r == "function" ? s !== r || !c : !r.has(s)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
        return a === "m" ? c : a === "a" ? c.call(s) : c ? c.value : r.get(s);
      };
      class Ts {
        constructor(r) {
          this.config = r, gt.add(this), this.emitter = new Cn(), this.isValid = !0, this.emitter.on(mr.ERROR, this.stopBroadcast), this.config.ingestEndpoint && (this.url = new URL(this.config.ingestEndpoint)), this.analyticsTracker = new _s(), this.mediaStreamManager = new vl();
          const a = new Pe(r.logLevel, r.logger);
          this.peerClient = new El(this.config, this.emitter, this.mediaStreamManager, a, this.analyticsTracker), this.broadcastCanvasManager = new bl(r, this.mediaStreamManager, this.analyticsTracker), this.peerStatsTracker = new Es(this.peerClient, this.broadcastCanvasManager, a, this.analyticsTracker), this.broadcastCanvasManager.start(), Object.getOwnPropertyNames(Ts.prototype).forEach((c) => {
            this[c] = new Proxy(this[c], { apply: (l, n, e) => {
              if (!n.isValid) throw new Ke(Object.assign({}, ds));
              return Reflect.apply(l, n, e);
            } });
          }), window.addEventListener("beforeunload", () => {
            this.analyticsTracker.stop(!0);
          });
        }
        delete() {
          this.isValid = !1, this.peerClient.stop(), this.broadcastCanvasManager.stop(), this.emitter.removeAllListeners();
        }
        startBroadcast(r, a) {
          return sc(this, void 0, void 0, function* () {
            Tl(this, gt, "m", wt).call(this, r);
            const c = Jc(a || this.config.ingestEndpoint);
            this.analyticsTracker.start(), this.peerStatsTracker.start(), yield this.peerClient.start(c, r), this.emitter.emit(mr.ACTIVE_STATE_CHANGE, !0), this.url = new URL(c), this.url && this.analyticsTracker.trackEvent(new Wr({ protocol: "webrtc", hostname: this.url.hostname, port: this.url.port }, ac.USER_INITIATED));
          });
        }
        stopBroadcast() {
          var r, a, c;
          this.url && this.analyticsTracker.trackEvent(new oc({ protocol: "webrtc", hostname: this.url.hostname, port: this.url.port })), (r = this.peerStatsTracker) === null || r === void 0 || r.stop(), (a = this.peerClient) === null || a === void 0 || a.stop(), (c = this.emitter) === null || c === void 0 || c.emit(mr.ACTIVE_STATE_CHANGE, !1);
        }
        getCanvasDimensions() {
          return this.broadcastCanvasManager.getCanvasDimensions();
        }
        addVideoInputDevice(r, a, c) {
          return sc(this, void 0, void 0, function* () {
            return this.broadcastCanvasManager.addVideoInputDevice(r, a, c);
          });
        }
        addImageSource(r, a, c) {
          return sc(this, void 0, void 0, function* () {
            return this.broadcastCanvasManager.addImageSource(r, a, c);
          });
        }
        addAudioInputDevice(r, a) {
          return sc(this, void 0, void 0, function* () {
            return this.broadcastCanvasManager.addAudioInputDevice(r, a);
          });
        }
        removeVideoInputDevice(r) {
          this.broadcastCanvasManager.removeVideoInputDevice(r);
        }
        removeAudioInputDevice(r) {
          this.broadcastCanvasManager.removeAudioInputDevice(r);
        }
        removeImage(r) {
          this.broadcastCanvasManager.removeImage(r);
        }
        updateVideoDeviceComposition(r, a) {
          this.broadcastCanvasManager.updateVideoDeviceComposition(r, a);
        }
        exchangeVideoDevicePositions(r, a) {
          this.broadcastCanvasManager.exchangeVideoDevicePositions(r, a);
        }
        getAudioInputDevice(r) {
          return this.broadcastCanvasManager.getAudioInputDevice(r);
        }
        getVideoInputDevice(r) {
          return this.broadcastCanvasManager.getVideoInputDevice(r);
        }
        getConnectionState() {
          return this.peerClient.getConnectionState();
        }
        getSessionId() {
          return this.peerClient.getSessionId();
        }
        on(r, a) {
          this.emitter.on(r, a);
        }
        off(r, a) {
          this.emitter.off(r, a);
        }
        getAudioContext() {
          return this.broadcastCanvasManager.audioContext;
        }
        attachPreview(r) {
          this.broadcastCanvasManager.attachPreview(r);
        }
        detachPreview() {
          this.broadcastCanvasManager.detachPreview();
        }
        disableVideo() {
          this.broadcastCanvasManager.disableVideo();
        }
        enableVideo() {
          this.broadcastCanvasManager.enableVideo();
        }
        disableAudio() {
          this.broadcastCanvasManager.disableAudio();
        }
        enableAudio() {
          this.broadcastCanvasManager.enableAudio();
        }
      }
      function Bu(s) {
        return new Ts(function(r) {
          const a = new Du();
          return a.streamConfig = r.streamConfig, a.ingestEndpoint = r.ingestEndpoint, a.logger = r.logger, a.logLevel = r.logLevel, a.networkReconnectConfig = r.networkReconnectConfig, a;
        }(s));
      }
      gt = /* @__PURE__ */ new WeakSet(), wt = function(s) {
        if (typeof s != "string" || !/^[a-zA-Z0-9_-]+$/.test(s)) throw new Ke(Li);
      };
      const Ca = "1.28.0";
      var me, zt = Te(2543);
      (function(s) {
        s.PUBLISH = "publish", s.SUBSCRIBE = "subscribe", s.JOIN = "join", s.LEAVE = "leave";
      })(me || (me = {}));
      const ai = 2, ji = "X-Stages-Options", Fi = "cap";
      class Uo extends ot {
        constructor(r) {
          super(je.LEAVE, r.token, r.traceId, !1), Object.assign(this.properties, { action: me.LEAVE, event_endpoint: r.eventEndpoint, whip_endpoint: r.whipEndpoint, reason: r.reason }), this.critical = !0;
        }
      }
      function $r(s) {
        const r = "0123456789abcdef";
        let a = "";
        for (let c = 0; c < s; c += 1) a += r.charAt(Math.floor(16 * Math.random()));
        return a;
      }
      class Cl {
        constructor() {
          const r = $r;
          this.value = `${r(8)}-${r(4)}-${r(4)}-${r(4)}-${r(12)}`;
        }
      }
      function jo() {
        return new Cl();
      }
      class Uu {
        constructor() {
          const r = (Date.now() / 1e3 | 0).toString(16);
          this.value = `1-${r}-${$r(24)}`;
        }
      }
      function Jn() {
        return new Uu();
      }
      var ju, Yn, Ei, oo = Te(2505), g = Te.n(oo);
      (function(s) {
        s.MESSAGE = "message", s.RESPONSE = "response";
      })(ju || (ju = {})), function(s) {
        s.STAGE_DELETED = "STAGE_DELETED", s.PARTICIPANT_DISCONNECTED = "PARTICIPANT_DISCONNECTED", s.TOKEN_INVALID = "TOKEN_INVALID", s.TOKEN_EXPIRED = "TOKEN_EXPIRED", s.TOKEN_INVALID_SIGNATURE = "TOKEN_INVALID_SIGNATURE", s.TOKEN_MISSING = "TOKEN_MISSING", s.INTERNAL = "INTERNAL", s.BAD_REQUEST = "BAD_REQUEST";
      }(Yn || (Yn = {})), function(s) {
        s[s.BAD_REQUEST = 400] = "BAD_REQUEST", s[s.UNAUTHORIZED = 401] = "UNAUTHORIZED", s[s.FORBIDDEN = 403] = "FORBIDDEN", s[s.NOT_FOUND = 404] = "NOT_FOUND", s[s.INTERNAL_SERVER_ERROR = 500] = "INTERNAL_SERVER_ERROR";
      }(Ei || (Ei = {}));
      class $e extends Ke {
        constructor({ token: r, traceId: a, code: c, tag: l, location: n, message: e, details: t, remoteParticipantId: i, requestUUID: o, fatal: u, nominal: d, action: h, count: S = 1 }) {
          super({ name: "StageClientError", message: e, code: c }), Error.captureStackTrace && Error.captureStackTrace(this, $e), this.action = h, this.token = r, this.traceId = a, this.code = c, this.tag = l, this.location = n, this.message = e, this.details = t, this.remoteParticipantId = i, this.requestUUID = o, this.fatal = u, this.nominal = d, this.count = S;
        }
      }
      const si = "signalling_session", Qt = "webrtc_sink", Ae = "webrtc_unsink", ir = "webrtc_source";
      function kt(s, r) {
        switch (s) {
          case me.PUBLISH:
            return Qt;
          case me.SUBSCRIBE:
            return `webrtc_source:${r}`;
          default:
            return "unknown";
        }
      }
      function hn(s, r) {
        var a, c, l, n;
        const e = { code: s.code, message: `${s.message}: ${r.name} ${r.message}`, fatal: (a = s.fatal) !== null && a !== void 0 && a, nominal: (c = s.nominal) !== null && c !== void 0 && c };
        return r instanceof $e && (e.fatal = (l = r.fatal) !== null && l !== void 0 && l, e.nominal = (n = r.nominal) !== null && n !== void 0 && n), e;
      }
      function vr(s, r) {
        if (s === 0) return le.UNKNOWN_SERVER_ERROR;
        if (!(s < 400)) if (s >= 400 && s <= 403) switch (r) {
          case Ot.TokenExpired:
            return le.EXPIRED_TOKEN;
          case Ot.NoPermissions:
            return le.TOKEN_PERMISSIONS_DENIED;
          case Ot.StageAtCapacity:
            return le.STAGE_AT_CAPACITY;
          case Ot.NoMatchingCodec:
            return le.NO_MATCHING_CODEC;
          default:
            return le.UNKNOWN_SERVER_ERROR;
        }
        else {
          if (s === 404) return r === Ot.RemoteStreamNotFound ? le.REMOTE_STREAM_NOT_FOUND : le.UNKNOWN_SERVER_ERROR;
          if (s === 412) return r === Ot.AbortedMHCPError ? le.MHCP_ABORTED : le.UNKNOWN_SERVER_ERROR;
          if (s === 429) return r === Ot.StageAuthThrottled ? le.STAGE_AUTH_THROTTLED : le.WHIP_TOO_MANY_REQUESTS;
          if (s !== 500) return le.UNKNOWN_SERVER_ERROR;
          switch (r) {
            case Ot.InternalMHCPError:
              return le.INTERNAL_MHCP_ERROR;
            case Ot.UnreachableMHCP:
              return le.UNREACHABLE_MHCP;
            case Ot.InvalidSessionStatus:
              return le.INVALID_SESSION_STATUS;
            default:
              return le.INTERNAL_SERVER_ERROR;
          }
        }
      }
      var Ot;
      (function(s) {
        s[s.Unspecified = 2001] = "Unspecified", s[s.TokenExpired = 2002] = "TokenExpired", s[s.NoPermissions = 2003] = "NoPermissions", s[s.RemoteStreamNotFound = 2004] = "RemoteStreamNotFound", s[s.StageAtCapacity = 2005] = "StageAtCapacity", s[s.InternalMHCPError = 2006] = "InternalMHCPError", s[s.UncategorizedMHCPError = 2007] = "UncategorizedMHCPError", s[s.UnreachableMHCP = 2008] = "UnreachableMHCP", s[s.InvalidSessionStatus = 2010] = "InvalidSessionStatus", s[s.PostWithoutOptions = 2011] = "PostWithoutOptions", s[s.AbortedMHCPError = 2012] = "AbortedMHCPError", s[s.StageAuthThrottled = 2013] = "StageAuthThrottled", s[s.NoMatchingCodec = 2014] = "NoMatchingCodec";
      })(Ot || (Ot = {}));
      const le = { MALFORMED_TOKEN: { code: 1e3, message: "Token is malformed", fatal: !0, nominal: !0 }, EXPIRED_TOKEN: { code: 1001, message: "Token expired and is no longer valid", fatal: !0, nominal: !0 }, STAGE_DELETED: { code: 1037, message: "Stage has been deleted", fatal: !0, nominal: !0 }, PARTICIPANT_DISCONNECTED: { code: 1038, message: "Participant has been disconnected", fatal: !0, nominal: !0 }, JOIN_SERVER_INTERNAL_ERROR: { code: 1039, message: "Internal server error during join", fatal: !1, nominal: !1 }, JOIN_SERVER_BAD_REQUEST: { code: 1040, message: "Bad request during join", fatal: !0, nominal: !1 }, UNPUBLISH_FAILURE: { code: 1013, message: "Failed to unpublish", fatal: !1, nominal: !1 }, UNSUBSCRIBE_FAILURE: { code: 1014, message: "Failed to unsubscribe", fatal: !1, nominal: !1 }, PUBLISH_FAILURE: { code: 1015, message: "Failed to publish", fatal: !1, nominal: !1 }, SUBSCRIBE_FAILURE: { code: 1016, message: "Failed to subscribe", fatal: !1, nominal: !1 }, JOIN_FAILURE: { code: 1017, message: "Failed to join", fatal: !0, nominal: !1 }, JOIN_TIMED_OUT: { code: 1019, message: "Join timed out", fatal: !0, nominal: !1 }, PUBLISH_TIMED_OUT: { code: 1020, message: "Publish timed out", fatal: !1, nominal: !1 }, SUBSCRIBE_TIMED_OUT: { code: 1021, message: "Subscribe timed out", fatal: !1, nominal: !1 }, NO_CANDIDATES: { code: 1022, message: "No ICE candidates", fatal: !1, nominal: !1 }, OPERATION_ABORTED: { code: 1023, message: "Request aborted", fatal: !1, nominal: !0 }, STAGE_AT_CAPACITY: { code: 1024, message: "Stage at capacity", fatal: !0, nominal: !0 }, INTERNAL_SERVER_ERROR: { code: 1025, message: "Internal server error", fatal: !0, nominal: !1 }, TOKEN_PERMISSIONS_DENIED: { code: 1026, message: "Token permissions are not valid for the operation", fatal: !0, nominal: !1 }, REMOTE_STREAM_NOT_FOUND: { code: 1027, message: "Contributor group (PUBLISH) or remote stream (SUBSCRIBE) not found", fatal: !0, nominal: !1 }, INTERNAL_MHCP_ERROR: { code: 1028, message: "Authorization failed due to internal MHCP error", fatal: !0, nominal: !1 }, UNCATEGORIZED_MHCP_ERROR: { code: 1029, message: "Authorization failed due to uncategorized MHCP error", fatal: !0, nominal: !1 }, UNREACHABLE_MHCP: { code: 1030, message: "Authorization failed due to MHCP unreachable", fatal: !0, nominal: !1 }, INVALID_SESSION_STATUS: { code: 1031, message: "Stream has already been published (PUBLISH) or subscribed to (SUBSCRIBE)", fatal: !0, nominal: !1 }, POST_WITHOUT_OPTIONS: { code: 1032, message: "Cannot POST without OPTIONS in mandatory TURN", fatal: !0, nominal: !1 }, MHCP_ABORTED: { code: 1033, message: "Publisher state conflict", fatal: !0, nominal: !1 }, STAGE_AUTH_THROTTLED: { code: 1034, message: "Too many requests", fatal: !1, nominal: !1 }, NO_MATCHING_CODEC: { code: 1035, message: "No matching codec found", fatal: !0, nominal: !1 }, CHIME_MEETING_NOT_FOUND: { code: 1098, message: "Meeting or Attendee was deleted", fatal: !0, nominal: !0 }, UNKNOWN_SERVER_ERROR: { code: 1099, message: "Service error code unknown or not found", fatal: !0, nominal: !1 }, XDP_CONNECTION_LOST: { code: 1221, message: "Connection lost during SDP exchange", fatal: !1, nominal: !1 }, XDP_INVALID_ANSWER_MSG: { code: 1222, message: "Invalid answer message received by client", fatal: !1, nominal: !1 }, XDP_TIMEOUT: { code: 1223, message: "Failed to receive SDP answer within timeout period", fatal: !1, nominal: !1 }, XDP_UNEXPECTED_ERROR: { code: 1224, message: "Unexpected error encountered", fatal: !1, nominal: !1 }, WEBSOCKET_MESSAGE_PARSE_FAILURE: { code: 1204, message: "Failed to parse websocket message", fatal: !1, nominal: !1 }, WHIP_SESSION_RESOURCE_DELETED: { code: 1206, message: "WHIP signaling session resource not found", fatal: !0, nominal: !0 }, WHIP_TOO_MANY_REQUESTS: { code: 1207, message: "WHIP endpoint received too many requests", fatal: !1, nominal: !1 }, WHIP_OPTIONS_FAILURE: { code: 1501, message: "Failed to get ICE Servers from OPTIONS", fatal: !1, nominal: !1 }, WHIP_POST_FAILURE: { code: 1502, message: "WHIP post failure", fatal: !1, nominal: !1 }, WHIP_DELETE_FAILURE: { code: 1503, message: "WHIP delete failure", fatal: !1, nominal: !1 }, WHIP_URL_MISSING: { code: 1504, message: "WHIP delete failure", fatal: !1, nominal: !1 }, WHEP_SET_LAYER_REQUEST_FAILED: { code: 1510, message: "Set layer request failed for reason: Unknown", fatal: !1, nominal: !1 }, WHEP_SET_LAYER_REQUEST_THROTTLED: { code: 1511, message: "Too many set layer requests", fatal: !1, nominal: !0 }, WHEP_GET_LAYER_STATE_FAILED: { code: 1512, message: "Get layer state failed for reason: Unknown", fatal: !1, nominal: !1 }, WHEP_GET_LAYER_STATE_THROTTLED: { code: 1513, message: "Too many get layer state requests", fatal: !1, nominal: !0 }, EVENT_PLANE_WS_CREATE_FAILED: { code: 1300, message: "Error creating WebSocket", fatal: !0, nominal: !1 }, EVENT_PLANE_WS_UNEXPECTED_CLOSE: { code: 1302, message: "Unexpectedly not connected to event plane", fatal: !1, nominal: !1 }, EVENT_PLANE_PING_SEND_FAIL: { code: 1303, message: "Ping send fail", fatal: !1, nominal: !1 }, EVENT_PLANE_PONG_TIMEOUT: { code: 1304, message: "Pong timed out", fatal: !1, nominal: !1 }, EVENT_PLANE_WS_CLOSE_BEFORE_OPEN: { code: 1305, message: "Connect attempt closed by server", fatal: !1, nominal: !1 }, PEER_CONNECTION_NETWORK_FAILURE: { code: 1400, message: "PeerConnection is lost due to unknown network error", fatal: !1, nominal: !1 }, CREATE_OFFER_FAILURE: { code: 1402, message: "Failed to set local description", fatal: !1, nominal: !1 }, CREATE_PEER_CONNECTION_FAILURE: { code: 1403, message: "Failed to create a peer connection", fatal: !1, nominal: !1 }, ICE_CANDIDATE_ERROR: { code: 1404, message: "ICE candidate error", fatal: !1, nominal: !1 }, SET_ANSWER_FAILURE: { code: 1405, message: "Failed to set remote answer", fatal: !1, nominal: !1 }, NETWORK_FAILURE: { code: 1406, message: "Failed due to network problem", fatal: !1, nominal: !1 }, SEI_INSERT_NOT_PUBLISHING_VIDEO: { code: 1460, message: "SEI failed to insert due to not publishing video", fatal: !1, nominal: !0 }, SEI_INSERT_INBAND_NOT_ENABLED: { code: 1461, message: "SEI failed to insert due to in-band messaging not being enabled", fatal: !1, nominal: !0 }, REASSIGNMENT_REQUEST_INVALID_LOCAL_PARTICIPANT_ID: { code: 1470, message: "Invalid participant id in the reassignment message", fatal: !1, nominal: !1 }, REASSIGNMENT_REQUEST_INVALID_REMOTE_PARTICIPANT_ID: { code: 1471, message: "Invalid remote participant id in the reassignment message", fatal: !1, nominal: !1 }, REASSIGNMENT_REQUEST_INVALID_REMOTE_PEER_CONNECTION_STATE: { code: 1472, message: "Invalid subscriber peer connection state for reassignment", fatal: !1, nominal: !1 }, REASSIGNMENT_REQUEST_ALREADY_IN_PROGRESS: { code: 1473, message: "Request rejected because client is already processing a previous reassignment request", fatal: !1, nominal: !1 }, UNEXPECTED_ERROR: { code: 9999, message: "Encountered unexpected error condition. Expected StageClientError type.", fatal: !1, nominal: !1 }, TRANSFORM_UNEXPECTED_ERROR: { code: 1480, message: "Unexpected error occurred during transform execution", fatal: !1, nominal: !1 }, TRANSFORM_TOO_MANY_ERRORS: { code: 1481, message: "Transformer encountered too many consecutive errors", fatal: !1, nominal: !1 }, TRANSFORM_NOT_SUPPORTED_BY_PLATFORM: { code: 1482, message: "Transforms are not supported by this platform", fatal: !1, nominal: !1 }, CODEC_HANDLE_INCOMPATIBLE_UNEXPECTED_ERROR: { code: 1490, message: "Unexpected error occurred when handling incompatible codecs", fatal: !1, nominal: !1 } };
      var or;
      (function(s) {
        s.UNPUBLISH = "unpublish", s.UNSUBSCRIBE = "unsubscribe", s.UNLOAD = "unload", s.CONNECTION_FAIL = "connection fail", s.REASSIGNMENT = "reassignment";
      })(or || (or = {}));
      const Il = "stageJoined", cc = "stageParticipantJoined", ao = "stageParticipantLeft", ci = "stageParticipantKicked", yi = "stageParticipantUpdated", iu = "localPublishingChanged", ou = "stageRefresh", _n = "stateChange", Ia = "error", _r = "reassignmentRequest", an = "incompatibleCodecs", Cs = "connectionStateChange", Is = "mediaStreamCreated", ui = "mediaStreamRemoved", jn = "error", uc = "stageStreamSeiMessageReceived", au = "transformError", so = "reassignmentStarted", lc = "reassignmentSuccess", bt = "reassignmentFailed", Ra = "open", wa = "closed", wn = "messageParseError", Oa = "refresh", ar = "error", sr = "stageStateMessage", Rs = "sdpAnswer", Nt = "disconnectMessage", Aa = "reassignmentMessage", Fu = "incompatibleCodecs", Vu = "ssu";
      function ka(s) {
        return a = function(c) {
          return c.replace(/-/g, "+").replace(/_/g, "/").padEnd(c.length + (4 - c.length % 4) % 4, "=");
        }(s), window.atob(a);
        var a;
      }
      class Vi {
        constructor(r, a) {
          var c;
          this.analyticsTracker = a, this.rawToken = r;
          const l = r.split(".");
          if (l.length !== 3) throw Error(`Token format incorrect. length: ${l.length}`);
          try {
            this.header = JSON.parse(ka(l[0]));
          } catch (t) {
            const i = t instanceof Error ? `: ${t.message}` : "";
            throw Error(`Error parsing Stage Token header${i}`);
          }
          try {
            this.claims = JSON.parse(ka(l[1]));
          } catch (t) {
            const i = t instanceof Error ? `: ${t.message}` : "";
            throw Error(`Error parsing Stage Token claims${i}`);
          }
          this.signature = l[2];
          const { claims: n } = this;
          this.stageARN = n.resource, this.customerId = (c = function(t) {
            if (t.indexOf("arn:aws:") < 0) return;
            const i = t.split(":");
            return i.length >= 5 ? i[4] : void 0;
          }(this.stageARN)) !== null && c !== void 0 ? c : "unknown", this.participantID = n.jti, this.eventsURL = n.events_url, this.whipURL = Nn("whipUrl") || n.whip_url, this.userID = n.user_id, this.expirationTime = n.exp, this.topic = n.topic, this.parseVersionFlags(n.version);
          const { attributes: e } = n;
          e && (this.attrGsRole = e.gs_role, this.attrGsSessionId = e.gs_session_id);
        }
        getPublishEndpoint() {
          let r = "";
          return this.whipURL && this.participantID && (r = `${this.whipURL}/publish/${this.participantID}`), r;
        }
        getSubscribeEndpoint(r) {
          let a = "";
          return this.whipURL && (a = `${this.whipURL}/subscribe/${r}`), a;
        }
        assertTokenIsUnexpired(r, a, c, l) {
          ln("disableTokenValidation") || (!this.expirationTime || Date.now() / 1e3 >= this.expirationTime) && this.analyticsTracker.trackErrorAndThrow(new $e(Object.assign(Object.assign({}, le.EXPIRED_TOKEN), { action: me.JOIN, location: c, tag: a, token: this, traceId: r, remoteParticipantId: l, message: le.EXPIRED_TOKEN.message, details: `Token expired at ${this.expirationTime} and is no longer valid` })));
        }
        parseVersionFlags(r) {
          if (!r) return;
          const a = r.split(".");
          a.length === 2 && (this.versionFlags = parseInt(a[1], 10));
        }
        shouldSendSilentAudio() {
          return this.versionFlags === void 0 || !!(this.versionFlags & ai);
        }
      }
      function dc(s, r) {
        return new Vi(s, r);
      }
      var bi;
      (function(s) {
        s.PUBLISH = "publish", s.SUBSCRIBE = "subscribe";
      })(bi || (bi = {}));
      class ws {
        constructor(r, a) {
          this.throttleDuration = 0, this.throttled = !1, this.timeout = 0, this.unthrottle = () => {
            this.trailing && this.trailingFn && this.trailingFn(...this.trailingFnArgs), this.clear();
          }, this.throttleDuration = r, this.trailing = !(a && a.skipTrailing);
        }
        invoke(r, ...a) {
          return this.throttled ? (this.trailingFn = r, this.trailingFnArgs = a, !1) : (this.throttled = !0, this.timeout = window.setTimeout(this.unthrottle, this.throttleDuration), r(...a), !0);
        }
        clear() {
          clearTimeout(this.timeout), this.timeout = 0, this.throttled = !1, delete this.trailingFn, delete this.trailingFnArgs;
        }
      }
      var Re = Te(8954);
      class hc extends ot {
        constructor(r, a, c, l, n, e, t, i) {
          super(je.SERVER_REQUEST, a, t, !0), Object.assign(this.properties, { action: r, http_method: l, remote_participant_id: e, request_uuid: n, url: c, transport: i });
        }
      }
      const co = "draft-ietf-wish-whip-04";
      var On, Os = function(s, r, a, c) {
        return new (a || (a = Promise))(function(l, n) {
          function e(o) {
            try {
              i(c.next(o));
            } catch (u) {
              n(u);
            }
          }
          function t(o) {
            try {
              i(c.throw(o));
            } catch (u) {
              n(u);
            }
          }
          function i(o) {
            var u;
            o.done ? l(o.value) : (u = o.value, u instanceof a ? u : new a(function(d) {
              d(u);
            })).then(e, t);
          }
          i((c = c.apply(s, [])).next());
        });
      };
      function fc(s, r) {
        return Os(this, void 0, void 0, function* () {
          s.validateStatus = (c) => c >= 200 && c < 300 || c === 403;
          const a = yield g()(s);
          if (a.status === 403) {
            if (a.data.code === 2003) throw new oo.AxiosError("Request failed with status code 403", "ERR_BAD_REQUEST", s, a.request, a);
            return s.url === a.request.responseURL ? (s.validateStatus = (c) => c >= 200 && c < 300, g()(s)) : (s.url = a.request.responseURL, r < 5 ? fc(s, r + 1) : (s.validateStatus = (c) => c >= 200 && c < 300, g()(s)));
          }
          return a;
        });
      }
      function su(s) {
        return Os(this, void 0, void 0, function* () {
          return fc(s, 0);
        });
      }
      function Fo() {
      }
      function Pa(s) {
        switch (s) {
          case "new":
            return xe.NEW;
          case "closed":
            return xe.CLOSED;
          case "disconnected":
            return xe.DISCONNECTED;
          case "failed":
            return xe.FAILED;
          case "idle":
            return xe.IDLE;
          case "checking":
          case "connecting":
            return xe.CONNECTING;
          case "completed":
          case "connected":
            return xe.CONNECTED;
          default:
            throw new Error(`unknown connecion state: ${s}`);
        }
      }
      function pc(s, r, a) {
        let c = document.createElement(r);
        const l = () => {
          c && (c.removeEventListener("loadeddata", n), c.removeEventListener("error", l), c.srcObject = null, c.src = "", c = null);
        }, n = () => {
          l(), a(r);
        };
        return c.addEventListener("loadeddata", n), c.addEventListener("error", l), c.srcObject = s, l;
      }
      class uo extends ot {
        constructor(r, a, c, l, n) {
          super(je.TRACE, r, a, !1), Object.assign(this.properties, { action: l, message: c, remote_participant_id: n });
        }
      }
      class gc extends ot {
        constructor(r, a, c, l, n) {
          super(je.CONNECTION_STATE, a, c, !1), Object.assign(this.properties, { action: r, remote_participant_id: n, state: l });
        }
      }
      class mc extends ot {
        constructor(r, a, c, l, n) {
          super(je.ICE_GATHERING_STATE, a, c, !1), Object.assign(this.properties, { action: r, remote_participant_id: n, state: l });
        }
      }
      (function(s) {
        s.POST = "post", s.CONNECTED = "connected", s.ICE_GATHERING = "icegathering", s.SDP_EXCHANGE = "sdpExchange", s.SET_REMOTE_DESC = "setRemoteDesc", s.PEER_CONNECTION = "peerConnection";
      })(On || (On = {}));
      const As = "start", Da = "stop";
      class ht {
        constructor(r, a) {
          this.marks = {}, this.optionsDuration = 0, this.postDuration = 0, this.timeToCandidate = 0, this.timeToConnected = 0, this.sdpExchangeDuration = 0, this.sdpExchangeTransport = "", this.setRemoteDescDuration = 0, this.peerConnectionDuration = 0, this.action = r, this.traceId = a;
        }
        markActionStart() {
          this.markStart(On.CONNECTED);
        }
        markPostStart() {
          this.markStart(On.POST);
        }
        markPostStop() {
          this.markStop(On.POST), this.postDuration = this.measure(On.POST);
        }
        markIceGatheringStart() {
          this.markStart(On.ICE_GATHERING);
        }
        markIceGatheringStop() {
          this.markStop(On.ICE_GATHERING), this.timeToCandidate = this.measure(On.ICE_GATHERING);
        }
        markActionStop() {
          this.markStop(On.CONNECTED), this.timeToConnected = this.measure(On.CONNECTED), this.markStop(On.PEER_CONNECTION), this.peerConnectionDuration = this.measure(On.PEER_CONNECTION);
        }
        markSetRemoteDescStart() {
          this.markStart(On.SET_REMOTE_DESC);
        }
        markSetRemoteDescStop() {
          const r = On.SET_REMOTE_DESC;
          this.markStop(r), this.setRemoteDescDuration = this.measure(r), this.markStart(On.PEER_CONNECTION);
        }
        markSdpExchangeStart() {
          this.markStart(On.SDP_EXCHANGE);
        }
        markSdpExchangeStop() {
          const r = On.SDP_EXCHANGE;
          this.markStop(r), this.sdpExchangeDuration = this.measure(r);
        }
        setTransport(r) {
          this.sdpExchangeTransport = r;
        }
        markStart(r) {
          this.marks[`${this.namespace}.${r}.${As}`] = performance.now();
        }
        markStop(r) {
          this.marks[`${this.namespace}.${r}.${Da}`] = performance.now();
        }
        measure(r) {
          const a = `${this.namespace}.${r}.${As}`, c = `${this.namespace}.${r}.${Da}`, l = this.marks[a], n = this.marks[c];
          return l === void 0 || n === void 0 ? 0 : n - l;
        }
        get namespace() {
          return `ivswb.peerclient.${this.action}.${this.traceId.value}`;
        }
        getMeasurements() {
          const { optionsDuration: r, postDuration: a, timeToCandidate: c, timeToConnected: l, sdpExchangeDuration: n, sdpExchangeTransport: e, setRemoteDescDuration: t, peerConnectionDuration: i } = this;
          return { optionsDuration: r, postDuration: a, timeToCandidate: c, timeToConnected: l, sdpExchangeDuration: n, sdpExchangeTransport: e, setRemoteDescDuration: t, peerConnectionDuration: i };
        }
        resetMeasurements(r) {
          this.traceId = r, this.marks = {}, this.optionsDuration = 0, this.postDuration = 0, this.timeToCandidate = 0, this.timeToConnected = 0, this.sdpExchangeDuration = 0, this.sdpExchangeTransport = "", this.setRemoteDescDuration = 0, this.peerConnectionDuration = 0;
        }
      }
      var at, Na, cr, Gi, Fn;
      (function(s) {
        s.VIDEO = "video", s.AUDIO = "audio";
      })(at || (at = {})), function(s) {
        s.LOWEST_QUALITY = "lowest_quality", s.HIGHEST_QUALITY = "highest_quality";
      }(Na || (Na = {})), function(s) {
        s.HI = "hi", s.MID = "mid", s.LOW = "low";
      }(cr || (cr = {})), function(s) {
        s.PORTRAIT = "portrait", s.LANDSCAPE = "landscape";
      }(Gi || (Gi = {})), function(s) {
        s.DEFAULT = "default", s.LOW = "low", s.MEDIUM = "medium", s.HIGH = "high";
      }(Fn || (Fn = {}));
      var lo = Te(7363);
      class dt {
        constructor(r) {
          this.sdp = r;
        }
        static splitLines(r) {
          return r.trim().split(`
`).map((a) => a.trim());
        }
        static splitSections(r) {
          return r.split(`
m=`).map((a, c) => (c > 0 ? `m=${a}` : a).trim() + dt.CRLF);
        }
        getUniqueRtpHeaderExtensionId(r) {
          const a = [];
          for (const l of r) if (/^a=extmap:/.test(l.trim())) {
            const n = +l.split("a=extmap:")[1].split(" ")[0];
            a.includes(n) || a.push(n);
          }
          a.sort((l, n) => l - n);
          let c = 0;
          for (const l of a) {
            if (l - c > 1) return c + 1;
            c = l;
          }
          return c === 14 ? -1 : c + 1;
        }
        withVideoLayersAllocationRtpHeaderExtension(r) {
          const a = "http://www.webrtc.org/experiments/rtp-hdrext/video-layers-allocation00", c = r ? r.getRtpHeaderExtensionId(a) : -1, l = c === -1 ? this.getUniqueRtpHeaderExtensionId(dt.splitLines(this.sdp)) : c, n = dt.splitSections(this.sdp), e = [];
          for (let i of n) {
            if (/^m=video/.test(i) && dt.getRtpHeaderExtensionIdInSection(i, a) === -1) {
              const o = dt.splitLines(i), u = [];
              if (l === -1 || this.hasRtpHeaderExtensionId(l)) {
                e.push(i);
                continue;
              }
              for (const d of o) if (u.push(d), /^a=sendrecv/.test(d.trim())) {
                const h = `a=extmap:${l} ${a}`;
                u.push(h);
              }
              i = u.join(dt.CRLF) + dt.CRLF;
            } else if (c !== -1 && /^m=video/.test(i) && dt.getRtpHeaderExtensionIdInSection(i, a) !== c) {
              const o = dt.splitLines(i), u = [];
              for (const d of o) {
                if (/^a=extmap:/.test(d.trim()) && d.split("a=extmap:")[1].split(" ")[1] === a) {
                  if (!this.hasRtpHeaderExtensionId(c)) {
                    const h = `a=extmap:${c} ${a}`;
                    u.push(h);
                  }
                  continue;
                }
                u.push(d);
              }
              i = u.join(dt.CRLF) + dt.CRLF;
            }
            e.push(i);
          }
          const t = e.join("");
          return new dt(t);
        }
        withOpusAudioConfig(r, a) {
          const c = lo.qg(this.sdp);
          for (const l of c.media) if (l.type === "audio") {
            const { payload: n } = l.rtp.find((o) => o.codec === "opus");
            if (!n) continue;
            let e = l.fmtp.find((o) => o.payload === n);
            e || (e = { payload: n, config: "" });
            const t = lo.Sl(e.config);
            if (t.maxaveragebitrate = r, typeof a == "boolean") {
              const o = a ? 1 : 0;
              t["sprop-stereo"] = o, t.stereo = o;
            }
            let i = "";
            for (const o of Object.keys(t)) i += `${o}=${t[o]}; `;
            e.config = i.trim();
          }
          return new dt(lo.M9(c));
        }
        withoutAudioRtcpRSize() {
          var r;
          const a = lo.qg(this.sdp);
          for (const c of a.media) {
            if (c.type !== "audio") continue;
            const l = tr() !== void 0, n = (r = tr()) !== null && r !== void 0 && r;
            l && (c.rtcpRsize = n ? void 0 : "rtcp-rsize");
          }
          return new dt(lo.M9(a));
        }
        withFilteredCandidates(r) {
          const a = lo.qg(this.sdp);
          return a.media.forEach((c) => {
            const l = c.candidates;
            if (l) {
              const n = l.filter((e) => e.transport === r);
              c.candidates = n;
            }
          }), new dt(lo.M9(a));
        }
        static getRtpHeaderExtensionIdInSection(r, a) {
          const c = dt.splitLines(r);
          for (const l of c) if (/^a=extmap:/.test(l.trim())) {
            const n = l.split("a=extmap:")[1].split(" "), e = +n[0];
            if (n[1] === a) return e;
          }
          return -1;
        }
        getRtpHeaderExtensionId(r) {
          const a = dt.splitSections(this.sdp);
          for (const c of a) if (/^m=video/.test(c)) {
            const l = dt.getRtpHeaderExtensionIdInSection(c, r);
            if (l !== -1) return l;
          }
          return -1;
        }
        hasRtpHeaderExtensionId(r) {
          const a = dt.splitLines(this.sdp);
          for (const c of a) if (/^a=extmap:/.test(c.trim()) && +c.split("a=extmap:")[1].split(" ")[0] === r)
            return !0;
          return !1;
        }
        hasAudioNacksEnabled() {
          var r, a, c;
          return ((c = (a = ((r = lo.qg(this.sdp).media.filter((l) => l.type === "audio")[0]) !== null && r !== void 0 ? r : {}).rtcpFb) === null || a === void 0 ? void 0 : a.filter((l) => l.type === "nack")) !== null && c !== void 0 ? c : []).length > 0;
        }
      }
      function kr(s) {
        const { config: r } = s;
        return [{ maxBitrate: r.maxBitrateBps }];
      }
      dt.CRLF = `\r
`, dt.rfc7587LowestBitrate = 6e3, dt.rfc7587HighestBitrate = 51e4;
      function Pr(s) {
        return 1e3 * s;
      }
      const Vo = (s, ...r) => {
        const a = r.map((c) => typeof c != "object").filter(Boolean).length > 0;
        if (typeof s == "object" && !a) return (0, zt.merge)({}, s, ...r);
      }, ks = (s) => vc(s), vc = (s) => (0, zt.cloneDeep)(s), ur = (s) => {
        switch (s) {
          case Na.HIGHEST_QUALITY:
            return "highest";
          case Na.LOWEST_QUALITY:
          default:
            return "lowest";
        }
      }, Pt = (s) => Object.freeze(s), Dr = Object.freeze({ DEFAULT_1080: Pt({ maxBitrateKbps: 2500, maxFramerate: 30, width: 1920, height: 1080 }), INACTIVE: Pt({ maxBitrateKbps: 0, maxFramerate: 0, width: 0, height: 0 }) }), Go = Object.freeze({ DEFAULT_720: Pt({ maxBitrateKbps: 2500, maxFramerate: 30, width: 1280, height: 720 }), DEFAULT_540: Pt({ maxBitrateKbps: 1400, maxFramerate: 15, width: 960, height: 540 }), DEFAULT_480: Pt({ maxBitrateKbps: 1100, maxFramerate: 15, width: 854, height: 480 }), DEFAULT_360: Pt({ maxBitrateKbps: 600, maxFramerate: 15, width: 640, height: 360 }), DEFAULT_270: Pt({ maxBitrateKbps: 350, maxFramerate: 15, width: 480, height: 270 }), DEFAULT_180: Pt({ maxBitrateKbps: 150, maxFramerate: 15, width: 320, height: 180 }), DEFAULT_160: Pt({ maxBitrateKbps: 120, maxFramerate: 15, width: 284, height: 160 }) }), Wi = Object.freeze({ HI: Pt(Object.assign({}, Go.DEFAULT_720)), MID: Pt(Object.assign(Object.assign({}, Go.DEFAULT_360), { maxBitrateKbps: 700, maxFramerate: 20 })), LOW: Pt(Object.assign(Object.assign({}, Go.DEFAULT_180), { maxBitrateKbps: 200, maxFramerate: 15 })) }), Wo = (s) => ({ rid: s, active: !1, scaleFactor: _c(s), maxBitrateBps: Pr(Dr.INACTIVE.maxBitrateKbps), maxFramerate: Dr.INACTIVE.maxFramerate, width: Dr.INACTIVE.width, height: Dr.INACTIVE.height }), _c = (s) => {
        switch (s) {
          case cr.HI:
            return 1;
          case cr.MID:
            return 2;
          case cr.LOW:
            return 4;
          default:
            return 1;
        }
      }, Ti = 50, zr = 2500, Hi = 10, Mn = 30, li = 160, Nr = 1280, $i = 720 * Nr, Ps = 16 / 9, Ho = 12, ho = 128, Sc = 64, cu = { [Fn.DEFAULT]: 0, [Fn.LOW]: 50, [Fn.MEDIUM]: 150, [Fn.HIGH]: 250 }, uu = { [Fn.DEFAULT]: 0, [Fn.LOW]: 100, [Fn.MEDIUM]: 200, [Fn.HIGH]: 300 };
      function lr(s) {
        const { outbound: r, remoteInbound: a, networkQuality: c } = s;
        return { networkQuality: c, nackCount: r.nackCount, packetsSent: r.packetsSent, packetsLost: a == null ? void 0 : a.packetsLost, retransmittedPacketsSent: r.retransmittedPacketsSent, bytesSent: r.bytesSent, headerBytesSent: r.headerBytesSent, retransmittedBytesSent: r.retransmittedBytesSent, totalPacketSendDelay: r.totalPacketSendDelay };
      }
      function fn(s) {
        var r, a, c;
        const { outbound: l, remoteInbound: n, networkQuality: e } = s;
        return { networkQuality: e, nackCount: l.nackCount, packetsSent: l.packetsSent, packetsLost: n == null ? void 0 : n.packetsLost, retransmittedPacketsSent: l.retransmittedPacketsSent, bytesSent: l.bytesSent, headerBytesSent: l.headerBytesSent, retransmittedBytesSent: l.retransmittedBytesSent, totalPacketSendDelay: l.totalPacketSendDelay, firCount: l.firCount, pliCount: l.pliCount, framesEncoded: l.framesEncoded, keyFramesEncoded: l.keyFramesEncoded, totalEncodeTime: l.totalEncodeTime, totalEncodedBytesTarget: l.totalEncodedBytesTarget, framesSent: l.framesSent, hugeFramesSent: l.hugeFramesSent, active: ((r = l.framesPerSecond) !== null && r !== void 0 ? r : 0) !== 0, qualityLimitationReason: l.qualityLimitationReason, qualityLimitationResolutionChanges: l.qualityLimitationResolutionChanges, qualityLimitationCpuDuration: (a = l.qualityLimitationDurations) === null || a === void 0 ? void 0 : a.cpu, qualityLimitationBandwidthDuration: (c = l.qualityLimitationDurations) === null || c === void 0 ? void 0 : c.bandwidth, frameWidth: l.frameWidth, frameHeight: l.frameHeight, framesPerSecond: l.framesPerSecond, rid: l.rid, ssrc: l.ssrc };
      }
      function Sr(s, r) {
        const a = /* @__PURE__ */ new Map(), c = /* @__PURE__ */ new Map();
        for (const l of r.values()) if (l.kind === s && l.type === "outbound-rtp" && l.ssrc) {
          const n = l.rid || zn;
          c.set(l.ssrc, n);
          let e = a.get(n);
          e || (e = {}, a.set(n, e)), e.outbound = l;
        }
        for (const l of r.values()) if (l.kind === s && l.type === "remote-inbound-rtp" && l.ssrc) {
          const n = c.get(l.ssrc) || zn, e = a.get(n);
          e && (e.remoteInbound = l);
        }
        return a;
      }
      function Ci(s, r) {
        const a = /* @__PURE__ */ new Map();
        for (const c of r.values()) if (c.kind === s && c.type === "inbound-rtp") {
          const l = c.rid || zn;
          a.set(l, { inbound: c });
        }
        return a;
      }
      function Ii(s, r) {
        return s !== In.DOWN && r != null ? r : s;
      }
      const lu = (s, r) => {
        const a = [], c = nr.getNetworkQuality(), l = Sr("audio", s);
        for (const n of l.values()) if (n.outbound) {
          const e = n.outbound.rid || zn, t = Ii(c, r.get(e)), i = lr({ outbound: n.outbound, remoteInbound: n.remoteInbound, networkQuality: t });
          a.push(i);
        }
        if (a.length) return a;
      }, du = (s, r) => {
        const a = [], c = nr.getNetworkQuality(), l = Sr("video", s);
        for (const n of l.values()) if (n.outbound) {
          const e = n.outbound.rid || zn, t = fn({ outbound: n.outbound, remoteInbound: n.remoteInbound });
          if (t.active) {
            const i = Ii(c, r.get(e));
            t.networkQuality = i;
          }
          a.push(t);
        }
        if (a.length) return a;
      }, $o = (s, r) => {
        const a = [], c = nr.getNetworkQuality(), l = Ci("audio", s);
        for (const e of l.values()) if (e.inbound) {
          const t = e.inbound.id;
          if (!t) continue;
          const i = Ii(c, r.get(t)), o = { networkQuality: (n = { inbound: e.inbound, networkQuality: i }).networkQuality, nackCount: n.inbound.nackCount, packetsReceived: n.inbound.packetsReceived, packetsLost: n.inbound.packetsLost, packetsDiscarded: n.inbound.packetsDiscarded, bytesReceived: n.inbound.bytesReceived, headerBytesReceived: n.inbound.headerBytesReceived, jitterBufferDelay: n.inbound.jitterBufferDelay, jitterBufferEmittedCount: n.inbound.jitterBufferEmittedCount, jitter: n.inbound.jitter, totalSamplesReceived: n.inbound.totalSamplesReceived, concealedSamples: n.inbound.concealedSamples, silentConcealedSamples: n.inbound.silentConcealedSamples, concealmentEvents: n.inbound.concealmentEvents, insertedSamplesForDeceleration: n.inbound.insertedSamplesForDeceleration, removedSamplesForAcceleration: n.inbound.removedSamplesForAcceleration, audioLevel: n.inbound.audioLevel };
          a.push(o);
        }
        var n;
        if (a.length) return a;
      }, Ri = (s, r) => {
        const a = [], c = nr.getNetworkQuality(), l = Ci("video", s);
        for (const e of l.values()) if (e.inbound) {
          const t = e.inbound.id;
          if (!t) continue;
          const i = { networkQuality: (n = { inbound: e.inbound, networkQuality: Ii(c, r.get(t)) }).networkQuality, nackCount: n.inbound.nackCount, packetsReceived: n.inbound.packetsReceived, packetsLost: n.inbound.packetsLost, packetsDiscarded: n.inbound.packetsDiscarded, bytesReceived: n.inbound.bytesReceived, headerBytesReceived: n.inbound.headerBytesReceived, jitterBufferDelay: n.inbound.jitterBufferDelay, jitterBufferEmittedCount: n.inbound.jitterBufferEmittedCount, jitter: n.inbound.jitter, pliCount: n.inbound.pliCount, firCount: n.inbound.firCount, framesReceived: n.inbound.framesReceived, framesDecoded: n.inbound.framesDecoded, keyFramesDecoded: n.inbound.keyFramesDecoded, framesDropped: n.inbound.framesDropped, totalDecodeTime: n.inbound.totalDecodeTime, totalInterFrameDelay: n.inbound.totalInterFrameDelay, totalSquaredInterFrameDelay: n.inbound.totalSquaredInterFrameDelay, pauseCount: n.inbound.pauseCount, totalPausesDuration: n.inbound.totalPausesDuration, freezeCount: n.inbound.freezeCount, totalFreezesDuration: n.inbound.totalFreezesDuration, frameWidth: n.inbound.frameWidth, frameHeight: n.inbound.frameHeight, framesPerSecond: n.inbound.framesPerSecond, ssrc: n.inbound.ssrc };
          a.push(i);
        }
        var n;
        if (a.length) return a;
      };
      var Ma = function(s, r, a, c) {
        return new (a || (a = Promise))(function(l, n) {
          function e(o) {
            try {
              i(c.next(o));
            } catch (u) {
              n(u);
            }
          }
          function t(o) {
            try {
              i(c.throw(o));
            } catch (u) {
              n(u);
            }
          }
          function i(o) {
            var u;
            o.done ? l(o.value) : (u = o.value, u instanceof a ? u : new a(function(d) {
              d(u);
            })).then(e, t);
          }
          i((c = c.apply(s, [])).next());
        });
      };
      const Ec = "H264", La = (s) => {
        const r = s == null ? void 0 : s.split("/");
        if ((r == null ? void 0 : r.length) === 2) return r[1];
      }, Er = (s, r) => {
        const a = La(s);
        if (s === void 0 || a === void 0) return;
        const c = { mimeSubtype: a };
        if (r) {
          const l = ((n) => {
            const e = n.split(";"), t = /* @__PURE__ */ new Map();
            for (const i of e) {
              const [o, u] = i.split("=");
              t.set(o, u);
            }
            return t;
          })(r);
          switch (a) {
            case Ec: {
              const n = l.get("profile-level-id");
              n && ((e, t) => {
                if (t.length < 6) return;
                const i = t.substring(0, 4), o = parseInt(t.substring(4, 6), 16);
                e.profile = i, e.level = o;
              })(c, n);
              break;
            }
            case "H265":
              ((n, e) => {
                const t = e.get("profile-id") || "0", i = e.get("tier-flag") || "0", o = parseInt(e.get("level-id") || "0", 10), u = [i, t].join("_");
                n.profile = u, n.level = o;
              })(c, l);
          }
        }
        return c;
      }, xa = (s, r) => s.sort((a, c) => {
        if (La(a.mimeType) === Ec) {
          const l = Er(a.mimeType, a.sdpFmtpLine);
          if ((l == null ? void 0 : l.profile) === r) return -1;
        }
        return 0;
      }), zo = (s, r) => {
        var a;
        const c = Er(s.mimeType, s.sdpFmtpLine);
        return (c == null ? void 0 : c.mimeSubtype.toLowerCase()) === r.mime.toLowerCase() && ((a = c == null ? void 0 : c.profile) === null || a === void 0 ? void 0 : a.toLowerCase().indexOf(r.config.toLowerCase())) === 0;
      }, Ba = (s, r) => r.filter((a) => !a.mimeType.endsWith("rtx")).filter((a) => a.mimeType.indexOf("packetization-mode=0") === -1).find((a) => s.reduce((c, l) => c && zo(a, l) === !1, !0));
      class Ds extends ot {
        constructor(r, a, c, l, n, e, t, i, o) {
          var u, d;
          super(je.PUBLISHED_VIDEO_STATS, r, a, !1), Object.assign(this.properties, Object.assign({ action: me.PUBLISH, node: (u = c == null ? void 0 : c.node) !== null && u !== void 0 ? u : "", cluster: (d = c == null ? void 0 : c.cluster) !== null && d !== void 0 ? d : "" }, ((h, S, T, I, R, w) => {
            var P, B, j, x, H, K, Q, ie, ce, oe, ee, fe, ye, Ce, ve, _e, Le, et, vt, Et, mt, Ct, Zt, Wt, Bt, Lt, Dt, Ut, nn, At, Pn, xr, br;
            const vi = (B = (P = h == null ? void 0 : h.qualityLimitationDurations) === null || P === void 0 ? void 0 : P.cpu) !== null && B !== void 0 ? B : 0, _i = (x = (j = h == null ? void 0 : h.qualityLimitationDurations) === null || j === void 0 ? void 0 : j.bandwidth) !== null && x !== void 0 ? x : 0, Br = Math.max((H = h == null ? void 0 : h.bytesSent) !== null && H !== void 0 ? H : 0, 0), Qi = 8 * Br / (w ?? 1), Di = Math.max((K = S == null ? void 0 : S.packetsLost) !== null && K !== void 0 ? K : 0, 0), Xi = Math.max((Q = h == null ? void 0 : h.packetsSent) !== null && Q !== void 0 ? Q : 0, 0), Eo = Di / Math.max(Xi, 1), Xr = Er(I == null ? void 0 : I.mimeType, I == null ? void 0 : I.sdpFmtpLine);
            return { active: !!(h != null && h.framesPerSecond) && h.framesPerSecond !== 0, bytes_sent: Br, codec_mime_type: Xr == null ? void 0 : Xr.mimeSubtype, codec_profile: Xr == null ? void 0 : Xr.profile, codec_level: Xr == null ? void 0 : Xr.level, configured_bitrate: R == null ? void 0 : R.max_bitrate, connection_bandwidth: (ce = (ie = T == null ? void 0 : T.candidatePair) === null || ie === void 0 ? void 0 : ie.availableOutgoingBitrate) !== null && ce !== void 0 ? ce : 0, encode_bitrate: Qi, encoder_implementation: (oe = h == null ? void 0 : h.encoderImplementation) !== null && oe !== void 0 ? oe : "unknown", fir_count: (ee = h == null ? void 0 : h.firCount) !== null && ee !== void 0 ? ee : 0, fraction_packets_lost: Eo, frame_height: Math.max((fe = h == null ? void 0 : h.frameHeight) !== null && fe !== void 0 ? fe : 0, 0), frame_width: Math.max((ye = h == null ? void 0 : h.frameWidth) !== null && ye !== void 0 ? ye : 0, 0), frames_encoded: (Ce = h == null ? void 0 : h.framesEncoded) !== null && Ce !== void 0 ? Ce : 0, frames_per_second: Math.max((ve = h == null ? void 0 : h.framesPerSecond) !== null && ve !== void 0 ? ve : 0, 0), frames_sent: (_e = h == null ? void 0 : h.framesSent) !== null && _e !== void 0 ? _e : 0, header_bytes_sent: (Le = h == null ? void 0 : h.headerBytesSent) !== null && Le !== void 0 ? Le : 0, huge_frames_sent: (et = h == null ? void 0 : h.hugeFramesSent) !== null && et !== void 0 ? et : 0, key_frames_encoded: (vt = h == null ? void 0 : h.keyFramesEncoded) !== null && vt !== void 0 ? vt : 0, nack_count: (Et = h == null ? void 0 : h.nackCount) !== null && Et !== void 0 ? Et : 0, packets_lost: Di, packets_sent: Xi, power_efficient_encoder: (mt = h == null ? void 0 : h.powerEfficientEncoder) !== null && mt !== void 0 && mt, pli_count: (Ct = h == null ? void 0 : h.pliCount) !== null && Ct !== void 0 ? Ct : 0, quality_limitation_reason: (Zt = h == null ? void 0 : h.qualityLimitationReason) !== null && Zt !== void 0 ? Zt : "none", quality_limitation_resolution_changes: (Wt = h == null ? void 0 : h.qualityLimitationResolutionChanges) !== null && Wt !== void 0 ? Wt : 0, quality_limitation_cpu_duration: vi, quality_limitation_bandwidth_duration: _i, retransmitted_bytes_sent: (Bt = h == null ? void 0 : h.retransmittedBytesSent) !== null && Bt !== void 0 ? Bt : 0, retransmitted_packets_sent: (Lt = h == null ? void 0 : h.retransmittedPacketsSent) !== null && Lt !== void 0 ? Lt : 0, rid: (Dt = h == null ? void 0 : h.rid) !== null && Dt !== void 0 ? Dt : zn, scalability_mode: (Ut = h == null ? void 0 : h.scalabilityMode) !== null && Ut !== void 0 ? Ut : "unknown", target_bitrate: Math.max((nn = h == null ? void 0 : h.targetBitrate) !== null && nn !== void 0 ? nn : 0, 0), total_encode_time: (At = h == null ? void 0 : h.totalEncodeTime) !== null && At !== void 0 ? At : 0, total_encoded_bytes_target: (Pn = h == null ? void 0 : h.totalEncodedBytesTarget) !== null && Pn !== void 0 ? Pn : 0, total_packet_send_delay: (xr = h == null ? void 0 : h.totalPacketSendDelay) !== null && xr !== void 0 ? xr : 0, protocol: (br = T == null ? void 0 : T.localCandidate) === null || br === void 0 ? void 0 : br.protocol };
          })(l, n, e, t, i, o)));
        }
      }
      class Ns extends ot {
        constructor(r, a, c, l, n, e, t, i, o, u, d, h) {
          var S, T, I, R;
          super(je.PUBLISHED_VIDEO_STATS_WINDOW, r, a, !1);
          const w = Math.max(((S = l == null ? void 0 : l.timestamp) !== null && S !== void 0 ? S : 0) - ((T = n == null ? void 0 : n.timestamp) !== null && T !== void 0 ? T : 0), 0);
          Object.assign(this.properties, Object.assign({ action: me.PUBLISH, node: (I = c == null ? void 0 : c.node) !== null && I !== void 0 ? I : "", cluster: (R = c == null ? void 0 : c.cluster) !== null && R !== void 0 ? R : "", window_size_ms: w }, ((P, B, j, x, H, K, Q, ie, ce, oe) => {
            var ee, fe, ye, Ce, ve, _e, Le, et, vt, Et, mt, Ct, Zt, Wt, Bt, Lt, Dt, Ut, nn, At, Pn, xr, br, vi, _i, Br, Qi, Di, Xi, Eo, Xr, Qa, $s, oa, Xa, zs, Za, es, qs, ts, ns, rs, cl, ul, ll, dl, zl, ql, Kl, Jl, ku, hl, Yl, is;
            const Zl = (fe = (ee = P == null ? void 0 : P.qualityLimitationDurations) === null || ee === void 0 ? void 0 : ee.cpu) !== null && fe !== void 0 ? fe : 0, Ql = (Ce = (ye = B == null ? void 0 : B.qualityLimitationDurations) === null || ye === void 0 ? void 0 : ye.cpu) !== null && Ce !== void 0 ? Ce : 0, Xl = (_e = (ve = P == null ? void 0 : P.qualityLimitationDurations) === null || ve === void 0 ? void 0 : ve.bandwidth) !== null && _e !== void 0 ? _e : 0, ad = (et = (Le = B == null ? void 0 : B.qualityLimitationDurations) === null || Le === void 0 ? void 0 : Le.bandwidth) !== null && et !== void 0 ? et : 0, ed = Math.max(((vt = P == null ? void 0 : P.bytesSent) !== null && vt !== void 0 ? vt : 0) - ((Et = B == null ? void 0 : B.bytesSent) !== null && Et !== void 0 ? Et : 0), 0), td = typeof ie != "number" ? 1 : ie / 1e3, sd = 8 * ed / td, nd = Math.max(((mt = j == null ? void 0 : j.packetsLost) !== null && mt !== void 0 ? mt : 0) - ((Ct = x == null ? void 0 : x.packetsLost) !== null && Ct !== void 0 ? Ct : 0), 0), rd = Math.max(((Zt = P == null ? void 0 : P.packetsSent) !== null && Zt !== void 0 ? Zt : 0) - ((Wt = B == null ? void 0 : B.packetsSent) !== null && Wt !== void 0 ? Wt : 0), 0), cd = nd / Math.max(rd, 1), fl = Er(K == null ? void 0 : K.mimeType, K == null ? void 0 : K.sdpFmtpLine), ud = 8 * (oe || 0) / td;
            return { active: !!(P != null && P.framesPerSecond) && (P == null ? void 0 : P.framesPerSecond) !== 0, bytes_sent: ed, codec_mime_type: fl == null ? void 0 : fl.mimeSubtype, codec_profile: fl == null ? void 0 : fl.profile, codec_level: fl == null ? void 0 : fl.level, configured_bitrate: Q == null ? void 0 : Q.max_bitrate, connection_bandwidth: (Lt = (Bt = H == null ? void 0 : H.candidatePair) === null || Bt === void 0 ? void 0 : Bt.availableOutgoingBitrate) !== null && Lt !== void 0 ? Lt : 0, encode_bitrate: sd, encoder_implementation: (Dt = P == null ? void 0 : P.encoderImplementation) !== null && Dt !== void 0 ? Dt : "unknown", fir_count: Math.max(((Ut = P == null ? void 0 : P.firCount) !== null && Ut !== void 0 ? Ut : 0) - ((nn = B == null ? void 0 : B.firCount) !== null && nn !== void 0 ? nn : 0), 0), fraction_packets_lost: cd, frame_height: Math.max((At = P == null ? void 0 : P.frameHeight) !== null && At !== void 0 ? At : 0, 0), frame_width: Math.max((Pn = P == null ? void 0 : P.frameWidth) !== null && Pn !== void 0 ? Pn : 0, 0), frames_encoded: Math.max(((xr = P == null ? void 0 : P.framesEncoded) !== null && xr !== void 0 ? xr : 0) - ((br = B == null ? void 0 : B.framesEncoded) !== null && br !== void 0 ? br : 0), 0), frames_per_second: Math.max((vi = P == null ? void 0 : P.framesPerSecond) !== null && vi !== void 0 ? vi : 0, 0), frames_sent: Math.max(((_i = P == null ? void 0 : P.framesSent) !== null && _i !== void 0 ? _i : 0) - ((Br = B == null ? void 0 : B.framesSent) !== null && Br !== void 0 ? Br : 0), 0), header_bytes_sent: Math.max(((Qi = P == null ? void 0 : P.headerBytesSent) !== null && Qi !== void 0 ? Qi : 0) - ((Di = B == null ? void 0 : B.headerBytesSent) !== null && Di !== void 0 ? Di : 0), 0), huge_frames_sent: Math.max(((Xi = P == null ? void 0 : P.hugeFramesSent) !== null && Xi !== void 0 ? Xi : 0) - ((Eo = B == null ? void 0 : B.hugeFramesSent) !== null && Eo !== void 0 ? Eo : 0), 0), key_frames_encoded: Math.max(((Xr = P == null ? void 0 : P.keyFramesEncoded) !== null && Xr !== void 0 ? Xr : 0) - ((Qa = B == null ? void 0 : B.keyFramesEncoded) !== null && Qa !== void 0 ? Qa : 0), 0), nack_count: Math.max((($s = P == null ? void 0 : P.nackCount) !== null && $s !== void 0 ? $s : 0) - ((oa = B == null ? void 0 : B.nackCount) !== null && oa !== void 0 ? oa : 0), 0), packets_lost: nd, packets_sent: rd, power_efficient_encoder: (Xa = P == null ? void 0 : P.powerEfficientEncoder) !== null && Xa !== void 0 && Xa, pli_count: Math.max(((zs = P == null ? void 0 : P.pliCount) !== null && zs !== void 0 ? zs : 0) - ((Za = B == null ? void 0 : B.pliCount) !== null && Za !== void 0 ? Za : 0), 0), quality_limitation_reason: (es = P == null ? void 0 : P.qualityLimitationReason) !== null && es !== void 0 ? es : "none", quality_limitation_resolution_changes: Math.max(((qs = P == null ? void 0 : P.qualityLimitationResolutionChanges) !== null && qs !== void 0 ? qs : 0) - ((ts = B == null ? void 0 : B.qualityLimitationResolutionChanges) !== null && ts !== void 0 ? ts : 0), 0), quality_limitation_cpu_duration: Math.max(Zl - Ql, 0), quality_limitation_bandwidth_duration: Math.max(Xl - ad, 0), retransmitted_bytes_sent: Math.max(((ns = P == null ? void 0 : P.retransmittedBytesSent) !== null && ns !== void 0 ? ns : 0) - ((rs = B == null ? void 0 : B.retransmittedBytesSent) !== null && rs !== void 0 ? rs : 0), 0), rid: (cl = P == null ? void 0 : P.rid) !== null && cl !== void 0 ? cl : zn, retransmitted_packets_sent: Math.max(((ul = P == null ? void 0 : P.retransmittedPacketsSent) !== null && ul !== void 0 ? ul : 0) - ((ll = B == null ? void 0 : B.retransmittedPacketsSent) !== null && ll !== void 0 ? ll : 0), 0), scalability_mode: (dl = P == null ? void 0 : P.scalabilityMode) !== null && dl !== void 0 ? dl : "unknown", target_bitrate: Math.max((zl = P == null ? void 0 : P.targetBitrate) !== null && zl !== void 0 ? zl : 0, 0), total_encode_time: Math.max(((ql = P == null ? void 0 : P.totalEncodeTime) !== null && ql !== void 0 ? ql : 0) - ((Kl = B == null ? void 0 : B.totalEncodeTime) !== null && Kl !== void 0 ? Kl : 0), 0), total_encoded_bytes_target: Math.max(((Jl = P == null ? void 0 : P.totalEncodedBytesTarget) !== null && Jl !== void 0 ? Jl : 0) - ((ku = B == null ? void 0 : B.totalEncodedBytesTarget) !== null && ku !== void 0 ? ku : 0), 0), total_packet_send_delay: Math.max(((hl = P == null ? void 0 : P.totalPacketSendDelay) !== null && hl !== void 0 ? hl : 0) - ((Yl = B == null ? void 0 : B.totalPacketSendDelay) !== null && Yl !== void 0 ? Yl : 0), 0), sei_write_count: ce, sei_bytes_sent: oe, sei_bitrate: ud, protocol: (is = H == null ? void 0 : H.localCandidate) === null || is === void 0 ? void 0 : is.protocol };
          })(l, n, e, t, i, o, u, w, d, h)));
        }
      }
      class Ms extends ot {
        constructor(r, a, c, l, n, e, t, i, o, u) {
          var d, h;
          super(je.PUBLISHED_AUDIO_STATS, r, a, !1), Object.assign(this.properties, Object.assign({ action: me.PUBLISH, node: (d = c == null ? void 0 : c.node) !== null && d !== void 0 ? d : "", cluster: (h = c == null ? void 0 : c.cluster) !== null && h !== void 0 ? h : "" }, ((S, T, I, R, w, P, B) => {
            var j, x, H, K, Q, ie, ce, oe, ee, fe, ye, Ce, ve;
            const _e = Math.max((j = S == null ? void 0 : S.bytesSent) !== null && j !== void 0 ? j : 0, 0), Le = 8 * _e / (P ?? 1), et = Math.max((x = T == null ? void 0 : T.packetsLost) !== null && x !== void 0 ? x : 0, 0), vt = Math.max((H = S == null ? void 0 : S.packetsSent) !== null && H !== void 0 ? H : 0, 0), Et = et / Math.max(vt, 1), mt = Er(R == null ? void 0 : R.mimeType, R == null ? void 0 : R.sdpFmtpLine);
            return { audio_nacks_enabled: (K = B == null ? void 0 : B.audioNacks) !== null && K !== void 0 && K, bytes_sent: _e, codec_mime_type: mt == null ? void 0 : mt.mimeSubtype, configured_bitrate: (Q = w == null ? void 0 : w.max_audio_bitrate_bps) !== null && Q !== void 0 ? Q : 0, connection_bandwidth: (ce = (ie = I == null ? void 0 : I.candidatePair) === null || ie === void 0 ? void 0 : ie.availableOutgoingBitrate) !== null && ce !== void 0 ? ce : 0, encode_bitrate: Le, fraction_packets_lost: Et, header_bytes_sent: (oe = S == null ? void 0 : S.headerBytesSent) !== null && oe !== void 0 ? oe : 0, nack_count: (ee = S == null ? void 0 : S.nackCount) !== null && ee !== void 0 ? ee : 0, packets_lost: et, packets_sent: vt, retransmitted_bytes_sent: (fe = S == null ? void 0 : S.retransmittedBytesSent) !== null && fe !== void 0 ? fe : 0, retransmitted_packets_sent: (ye = S == null ? void 0 : S.retransmittedPacketsSent) !== null && ye !== void 0 ? ye : 0, target_bitrate: (Ce = S == null ? void 0 : S.targetBitrate) !== null && Ce !== void 0 ? Ce : 0, protocol: (ve = I == null ? void 0 : I.localCandidate) === null || ve === void 0 ? void 0 : ve.protocol };
          })(l, n, e, t, i, o, u)));
        }
      }
      class yc extends ot {
        constructor(r, a, c, l, n, e, t, i, o, u, d) {
          var h, S, T, I;
          super(je.PUBLISHED_AUDIO_STATS_WINDOW, r, a, !1);
          const R = Math.max(((h = l == null ? void 0 : l.timestamp) !== null && h !== void 0 ? h : 0) - ((S = n == null ? void 0 : n.timestamp) !== null && S !== void 0 ? S : 0), 0);
          Object.assign(this.properties, Object.assign({ action: me.PUBLISH, node: (T = c == null ? void 0 : c.node) !== null && T !== void 0 ? T : "", cluster: (I = c == null ? void 0 : c.cluster) !== null && I !== void 0 ? I : "", window_size_ms: R }, ((w, P, B, j, x, H, K, Q, ie) => {
            var ce, oe, ee, fe, ye, Ce, ve, _e, Le, et, vt, Et, mt, Ct, Zt, Wt, Bt, Lt, Dt, Ut, nn, At;
            const Pn = Math.max(((ce = w == null ? void 0 : w.bytesSent) !== null && ce !== void 0 ? ce : 0) - ((oe = P == null ? void 0 : P.bytesSent) !== null && oe !== void 0 ? oe : 0), 0), xr = 8 * Pn / (typeof Q != "number" ? 1 : Q / 1e3), br = Math.max(((ee = B == null ? void 0 : B.packetsLost) !== null && ee !== void 0 ? ee : 0) - ((fe = j == null ? void 0 : j.packetsLost) !== null && fe !== void 0 ? fe : 0), 0), vi = Math.max(((ye = w == null ? void 0 : w.packetsSent) !== null && ye !== void 0 ? ye : 0) - ((Ce = P == null ? void 0 : P.packetsSent) !== null && Ce !== void 0 ? Ce : 0), 0), _i = br / Math.max(vi, 1), Br = Er(H == null ? void 0 : H.mimeType, H == null ? void 0 : H.sdpFmtpLine);
            return { audio_nacks_enabled: (ve = ie == null ? void 0 : ie.audioNacks) !== null && ve !== void 0 && ve, bytes_sent: Pn, codec_mime_type: Br == null ? void 0 : Br.mimeSubtype, configured_bitrate: (_e = K == null ? void 0 : K.max_audio_bitrate_bps) !== null && _e !== void 0 ? _e : 0, connection_bandwidth: (et = (Le = x == null ? void 0 : x.candidatePair) === null || Le === void 0 ? void 0 : Le.availableOutgoingBitrate) !== null && et !== void 0 ? et : 0, encode_bitrate: xr, fraction_packets_lost: _i, header_bytes_sent: Math.max(((vt = w == null ? void 0 : w.headerBytesSent) !== null && vt !== void 0 ? vt : 0) - ((Et = P == null ? void 0 : P.headerBytesSent) !== null && Et !== void 0 ? Et : 0), 0), nack_count: Math.max(((mt = w == null ? void 0 : w.nackCount) !== null && mt !== void 0 ? mt : 0) - ((Ct = P == null ? void 0 : P.nackCount) !== null && Ct !== void 0 ? Ct : 0), 0), packets_lost: br, packets_sent: Math.max(((Zt = w == null ? void 0 : w.packetsSent) !== null && Zt !== void 0 ? Zt : 0) - ((Wt = P == null ? void 0 : P.packetsSent) !== null && Wt !== void 0 ? Wt : 0), 0), retransmitted_bytes_sent: Math.max(((Bt = w == null ? void 0 : w.retransmittedBytesSent) !== null && Bt !== void 0 ? Bt : 0) - ((Lt = P == null ? void 0 : P.retransmittedBytesSent) !== null && Lt !== void 0 ? Lt : 0), 0), retransmitted_packets_sent: Math.max(((Dt = w == null ? void 0 : w.retransmittedPacketsSent) !== null && Dt !== void 0 ? Dt : 0) - ((Ut = P == null ? void 0 : P.retransmittedPacketsSent) !== null && Ut !== void 0 ? Ut : 0), 0), target_bitrate: Math.max((nn = w == null ? void 0 : w.targetBitrate) !== null && nn !== void 0 ? nn : 0, 0), protocol: (At = x == null ? void 0 : x.localCandidate) === null || At === void 0 ? void 0 : At.protocol };
          })(l, n, e, t, i, o, u, R, d)));
        }
      }
      class hu extends ot {
        constructor(r, a, c, l, n, e, t, i) {
          var o, u;
          super(je.SUBSCRIBED_VIDEO_STATS, r, a, !1), Object.assign(this.properties, Object.assign({ action: me.SUBSCRIBE, node: (o = l == null ? void 0 : l.node) !== null && o !== void 0 ? o : "", cluster: (u = l == null ? void 0 : l.cluster) !== null && u !== void 0 ? u : "", remote_participant_id: c }, ((d, h, S, T) => {
            var I, R, w, P, B, j, x, H, K, Q, ie, ce, oe, ee, fe, ye, Ce, ve, _e, Le, et, vt, Et, mt;
            let Ct = 0;
            d != null && d.jitterBufferDelay && (d != null && d.jitterBufferEmittedCount) && d.jitterBufferEmittedCount > 0 && (Ct = d.jitterBufferDelay / d.jitterBufferEmittedCount);
            const Zt = T ?? 1, Wt = Math.max((I = d == null ? void 0 : d.bytesReceived) !== null && I !== void 0 ? I : 0, 0), Bt = 8 * Wt / Zt;
            let Lt = 0;
            d != null && d.totalDecodeTime && (d != null && d.framesDecoded) && (Lt = d.totalDecodeTime / Math.max(d == null ? void 0 : d.framesDecoded, 1));
            const Dt = Math.max((R = d == null ? void 0 : d.packetsLost) !== null && R !== void 0 ? R : 0, 0), Ut = Math.max((w = d == null ? void 0 : d.packetsReceived) !== null && w !== void 0 ? w : 0, 0), nn = Dt / Math.max(Ut + Dt, 1), At = Er(S == null ? void 0 : S.mimeType, S == null ? void 0 : S.sdpFmtpLine);
            return { bytes_received: Wt, codec_mime_type: At == null ? void 0 : At.mimeSubtype, codec_profile: At == null ? void 0 : At.profile, codec_level: At == null ? void 0 : At.level, connection_bandwidth: (B = (P = h == null ? void 0 : h.candidatePair) === null || P === void 0 ? void 0 : P.availableIncomingBitrate) !== null && B !== void 0 ? B : 0, decode_bitrate: Bt, decoder_implementation: (j = d == null ? void 0 : d.decoderImplementation) !== null && j !== void 0 ? j : "unknown", fir_count: Math.max((x = d == null ? void 0 : d.firCount) !== null && x !== void 0 ? x : 0, 0), fraction_packets_lost: nn, frame_decode_time_avg: Lt, frame_height: Math.max((H = d == null ? void 0 : d.frameHeight) !== null && H !== void 0 ? H : 0, 0), frame_width: Math.max((K = d == null ? void 0 : d.frameWidth) !== null && K !== void 0 ? K : 0, 0), frames_decoded: Math.max((Q = d == null ? void 0 : d.framesDecoded) !== null && Q !== void 0 ? Q : 0, 0), frames_dropped: Math.max((ie = d == null ? void 0 : d.framesDropped) !== null && ie !== void 0 ? ie : 0, 0), frames_received: Math.max((ce = d == null ? void 0 : d.framesReceived) !== null && ce !== void 0 ? ce : 0, 0), freeze_count: Math.max((oe = d == null ? void 0 : d.freezeCount) !== null && oe !== void 0 ? oe : 0, 0), frames_rendered: Math.max((ee = d == null ? void 0 : d.framesRendered) !== null && ee !== void 0 ? ee : 0, 0), frames_per_second: Math.max((fe = d == null ? void 0 : d.framesPerSecond) !== null && fe !== void 0 ? fe : 0, 0), header_bytes_received: Math.max((ye = d == null ? void 0 : d.headerBytesReceived) !== null && ye !== void 0 ? ye : 0, 0), jitter_buffer_delay_avg: Ct, key_frames_decoded: Math.max((Ce = d == null ? void 0 : d.keyFramesDecoded) !== null && Ce !== void 0 ? Ce : 0, 0), nack_count: Math.max((ve = d == null ? void 0 : d.nackCount) !== null && ve !== void 0 ? ve : 0, 0), packets_discarded: Math.max((_e = d == null ? void 0 : d.packetsDiscarded) !== null && _e !== void 0 ? _e : 0, 0), packets_lost: Dt, packets_received: Ut, pause_count: Math.max((Le = d == null ? void 0 : d.pauseCount) !== null && Le !== void 0 ? Le : 0, 0), pli_count: Math.max((et = d == null ? void 0 : d.pliCount) !== null && et !== void 0 ? et : 0, 0), power_efficient_decoder: (vt = d == null ? void 0 : d.powerEfficientDecoder) !== null && vt !== void 0 && vt, total_freezes_duration: Math.max((Et = d == null ? void 0 : d.totalFreezesDuration) !== null && Et !== void 0 ? Et : 0, 0), total_pauses_duration: Math.max((mt = d == null ? void 0 : d.totalPausesDuration) !== null && mt !== void 0 ? mt : 0, 0) };
          })(n, e, t, i)));
        }
      }
      class Gu extends ot {
        constructor(r, a, c, l, n, e, t, i, o, u, d) {
          var h, S, T, I;
          super(je.SUBSCRIBED_VIDEO_STATS_WINDOW, r, a, !1);
          const R = Math.max(((h = n == null ? void 0 : n.timestamp) !== null && h !== void 0 ? h : 0) - ((S = e == null ? void 0 : e.timestamp) !== null && S !== void 0 ? S : 0), 0);
          Object.assign(this.properties, Object.assign({ action: me.SUBSCRIBE, node: (T = l == null ? void 0 : l.node) !== null && T !== void 0 ? T : "", cluster: (I = l == null ? void 0 : l.cluster) !== null && I !== void 0 ? I : "", window_size_ms: R, remote_participant_id: c }, ((w, P, B, j, x, H, K, Q) => {
            var ie, ce, oe, ee, fe, ye, Ce, ve, _e, Le, et, vt, Et, mt, Ct, Zt, Wt, Bt, Lt, Dt, Ut, nn, At, Pn, xr, br, vi, _i, Br, Qi, Di, Xi, Eo, Xr, Qa, $s, oa, Xa, zs, Za, es, qs, ts, ns, rs;
            let cl = 0, ul = 0;
            if (w != null && w.jitterBufferEmittedCount && (P != null && P.jitterBufferEmittedCount) && w.jitterBufferEmittedCount > P.jitterBufferEmittedCount) {
              w != null && w.jitterBufferDelay && (P != null && P.jitterBufferDelay) && (cl = (w.jitterBufferDelay - P.jitterBufferDelay) / (w.jitterBufferEmittedCount - P.jitterBufferEmittedCount));
              const Ql = P == null ? void 0 : P.jitterBufferMinimumDelay, Xl = w == null ? void 0 : w.jitterBufferMinimumDelay;
              Ql && Xl && (ul = (Xl - Ql) / (w.jitterBufferEmittedCount - P.jitterBufferEmittedCount));
            }
            const ll = Math.max(((ie = w == null ? void 0 : w.bytesReceived) !== null && ie !== void 0 ? ie : 0) - ((ce = P == null ? void 0 : P.bytesReceived) !== null && ce !== void 0 ? ce : 0), 0), dl = typeof x != "number" ? 1 : x / 1e3, zl = 8 * ll / dl, ql = Math.max(((oe = w == null ? void 0 : w.totalDecodeTime) !== null && oe !== void 0 ? oe : 0) - ((ee = P == null ? void 0 : P.totalDecodeTime) !== null && ee !== void 0 ? ee : 0), 0), Kl = Math.max(((fe = w == null ? void 0 : w.framesDecoded) !== null && fe !== void 0 ? fe : 0) - ((ye = P == null ? void 0 : P.framesDecoded) !== null && ye !== void 0 ? ye : 0), 0), Jl = ql / Math.max(Kl, 1), ku = Math.max(((Ce = w == null ? void 0 : w.packetsLost) !== null && Ce !== void 0 ? Ce : 0) - ((ve = P == null ? void 0 : P.packetsLost) !== null && ve !== void 0 ? ve : 0), 0), hl = Math.max(((_e = w == null ? void 0 : w.packetsReceived) !== null && _e !== void 0 ? _e : 0) - ((Le = P == null ? void 0 : P.packetsReceived) !== null && Le !== void 0 ? Le : 0), 0), Yl = ku / Math.max(hl + ku, 1), is = Er(j == null ? void 0 : j.mimeType, j == null ? void 0 : j.sdpFmtpLine), Zl = 8 * (Q || 0) / dl;
            return { bytes_received: ll, codec_mime_type: is == null ? void 0 : is.mimeSubtype, codec_profile: is == null ? void 0 : is.profile, codec_level: is == null ? void 0 : is.level, connection_bandwidth: (vt = (et = B == null ? void 0 : B.candidatePair) === null || et === void 0 ? void 0 : et.availableIncomingBitrate) !== null && vt !== void 0 ? vt : 0, decode_bitrate: zl, decoder_implementation: (Et = w == null ? void 0 : w.decoderImplementation) !== null && Et !== void 0 ? Et : "unknown", fir_count: Math.max(((mt = w == null ? void 0 : w.firCount) !== null && mt !== void 0 ? mt : 0) - ((Ct = P == null ? void 0 : P.firCount) !== null && Ct !== void 0 ? Ct : 0), 0), fraction_packets_lost: Yl, frame_decode_time_avg: Jl, frame_height: Math.max((Zt = w == null ? void 0 : w.frameHeight) !== null && Zt !== void 0 ? Zt : 0, 0), frame_width: Math.max((Wt = w == null ? void 0 : w.frameWidth) !== null && Wt !== void 0 ? Wt : 0, 0), frames_decoded: Math.max(((Bt = w == null ? void 0 : w.framesDecoded) !== null && Bt !== void 0 ? Bt : 0) - ((Lt = P == null ? void 0 : P.framesDecoded) !== null && Lt !== void 0 ? Lt : 0), 0), frames_dropped: Math.max(((Dt = w == null ? void 0 : w.framesDropped) !== null && Dt !== void 0 ? Dt : 0) - ((Ut = P == null ? void 0 : P.framesDropped) !== null && Ut !== void 0 ? Ut : 0), 0), frames_received: Math.max(((nn = w == null ? void 0 : w.framesReceived) !== null && nn !== void 0 ? nn : 0) - ((At = P == null ? void 0 : P.framesReceived) !== null && At !== void 0 ? At : 0), 0), freeze_count: Math.max(((Pn = w == null ? void 0 : w.freezeCount) !== null && Pn !== void 0 ? Pn : 0) - ((xr = P == null ? void 0 : P.freezeCount) !== null && xr !== void 0 ? xr : 0), 0), frames_rendered: Math.max((br = w == null ? void 0 : w.framesRendered) !== null && br !== void 0 ? br : 0, 0), frames_per_second: Math.max((vi = w == null ? void 0 : w.framesPerSecond) !== null && vi !== void 0 ? vi : 0, 0), header_bytes_received: Math.max(((_i = w == null ? void 0 : w.headerBytesReceived) !== null && _i !== void 0 ? _i : 0) - ((Br = P == null ? void 0 : P.headerBytesReceived) !== null && Br !== void 0 ? Br : 0), 0), configured_jitter_buffer_min_delay_ms: H ?? 0, jitter_buffer_min_obtainable_delay: ul, jitter_buffer_delay_avg: cl, key_frames_decoded: Math.max(((Qi = w == null ? void 0 : w.keyFramesDecoded) !== null && Qi !== void 0 ? Qi : 0) - ((Di = P == null ? void 0 : P.keyFramesDecoded) !== null && Di !== void 0 ? Di : 0), 0), nack_count: Math.max(((Xi = w == null ? void 0 : w.nackCount) !== null && Xi !== void 0 ? Xi : 0) - ((Eo = P == null ? void 0 : P.nackCount) !== null && Eo !== void 0 ? Eo : 0), 0), packets_discarded: Math.max(((Xr = w == null ? void 0 : w.packetsDiscarded) !== null && Xr !== void 0 ? Xr : 0) - ((Qa = P == null ? void 0 : P.packetsDiscarded) !== null && Qa !== void 0 ? Qa : 0), 0), packets_lost: ku, packets_received: hl, pause_count: Math.max((($s = w == null ? void 0 : w.pauseCount) !== null && $s !== void 0 ? $s : 0) - ((oa = P == null ? void 0 : P.pauseCount) !== null && oa !== void 0 ? oa : 0), 0), pli_count: Math.max(((Xa = w == null ? void 0 : w.pliCount) !== null && Xa !== void 0 ? Xa : 0) - ((zs = P == null ? void 0 : P.pliCount) !== null && zs !== void 0 ? zs : 0), 0), power_efficient_decoder: (Za = w == null ? void 0 : w.powerEfficientDecoder) !== null && Za !== void 0 && Za, total_freezes_duration: Math.max(((es = w == null ? void 0 : w.totalFreezesDuration) !== null && es !== void 0 ? es : 0) - ((qs = P == null ? void 0 : P.totalFreezesDuration) !== null && qs !== void 0 ? qs : 0), 0), total_pauses_duration: Math.max(((ts = w == null ? void 0 : w.totalPausesDuration) !== null && ts !== void 0 ? ts : 0) - ((ns = P == null ? void 0 : P.totalPausesDuration) !== null && ns !== void 0 ? ns : 0), 0), sei_read_count: K, sei_bytes_received: Q, sei_bitrate: Zl, protocol: (rs = B == null ? void 0 : B.localCandidate) === null || rs === void 0 ? void 0 : rs.protocol };
          })(n, e, t, i, R, o, u, d)));
        }
      }
      class wi extends ot {
        constructor(r, a, c, l, n, e, t, i, o) {
          var u, d;
          super(je.SUBSCRIBED_AUDIO_STATS, r, a, !1), Object.assign(this.properties, Object.assign({ action: me.SUBSCRIBE, node: (u = l == null ? void 0 : l.node) !== null && u !== void 0 ? u : "", cluster: (d = l == null ? void 0 : l.cluster) !== null && d !== void 0 ? d : "", remote_participant_id: c }, ((h, S, T, I, R) => {
            var w, P, B, j, x, H, K, Q, ie, ce, oe, ee, fe, ye, Ce, ve, _e, Le;
            let et = 0;
            h != null && h.jitterBufferDelay && (h != null && h.jitterBufferEmittedCount) && h.jitterBufferEmittedCount > 0 && (et = h.jitterBufferDelay / h.jitterBufferEmittedCount);
            const vt = I ?? 1, Et = Math.max((w = h == null ? void 0 : h.bytesReceived) !== null && w !== void 0 ? w : 0, 0), mt = 8 * Et / vt, Ct = Math.max((P = h == null ? void 0 : h.packetsLost) !== null && P !== void 0 ? P : 0, 0), Zt = Math.max((B = h == null ? void 0 : h.packetsReceived) !== null && B !== void 0 ? B : 0, 0), Wt = Ct / Math.max(Zt + Ct, 1), Bt = Math.max((j = h == null ? void 0 : h.concealedSamples) !== null && j !== void 0 ? j : 0, 0), Lt = Math.max((x = h == null ? void 0 : h.totalSamplesReceived) !== null && x !== void 0 ? x : 0, 0), Dt = Bt / Math.max(Lt, 1), Ut = Er(T == null ? void 0 : T.mimeType, T == null ? void 0 : T.sdpFmtpLine);
            return { audio_level: (H = h == null ? void 0 : h.audioLevel) !== null && H !== void 0 ? H : 0, audio_nacks_enabled: (K = R == null ? void 0 : R.audioNacks) !== null && K !== void 0 && K, bytes_received: Et, codec_mime_type: Ut == null ? void 0 : Ut.mimeSubtype, connection_bandwidth: (ie = (Q = S == null ? void 0 : S.candidatePair) === null || Q === void 0 ? void 0 : Q.availableIncomingBitrate) !== null && ie !== void 0 ? ie : 0, concealed_samples: Bt, concealment_events: Math.max((ce = h == null ? void 0 : h.concealmentEvents) !== null && ce !== void 0 ? ce : 0, 0), silent_concealed_samples: Math.max((oe = h == null ? void 0 : h.silentConcealedSamples) !== null && oe !== void 0 ? oe : 0, 0), decode_bitrate: mt, fraction_audio_concealed: Dt, fraction_packets_lost: Wt, header_bytes_received: Math.max((ee = h == null ? void 0 : h.headerBytesReceived) !== null && ee !== void 0 ? ee : 0, 0), inserted_samples_for_deceleration: Math.max((fe = h == null ? void 0 : h.insertedSamplesForDeceleration) !== null && fe !== void 0 ? fe : 0, 0), jitter_buffer_delay_avg: et, packets_discarded: Math.max((ye = h == null ? void 0 : h.packetsDiscarded) !== null && ye !== void 0 ? ye : 0, 0), retransmitted_packets_received: Math.max((Ce = h == null ? void 0 : h.retransmittedPacketsReceived) !== null && Ce !== void 0 ? Ce : 0, 0), retransmitted_bytes_received: Math.max((ve = h == null ? void 0 : h.retransmittedBytesReceived) !== null && ve !== void 0 ? ve : 0, 0), packets_lost: Ct, packets_received: Zt, nack_count: Math.max((_e = h == null ? void 0 : h.nackCount) !== null && _e !== void 0 ? _e : 0, 0), removed_samples_for_acceleration: Math.max((Le = h == null ? void 0 : h.removedSamplesForAcceleration) !== null && Le !== void 0 ? Le : 0, 0), total_samples_received: Lt };
          })(n, e, t, i, o)));
        }
      }
      class Oi extends ot {
        constructor(r, a, c, l, n, e, t, i, o, u) {
          var d, h, S, T;
          super(je.SUBSCRIBED_AUDIO_STATS_WINDOW, r, a, !1);
          const I = Math.max(((d = n == null ? void 0 : n.timestamp) !== null && d !== void 0 ? d : 0) - ((h = e == null ? void 0 : e.timestamp) !== null && h !== void 0 ? h : 0), 0);
          Object.assign(this.properties, Object.assign({ action: me.SUBSCRIBE, window_size_ms: I, node: (S = l == null ? void 0 : l.node) !== null && S !== void 0 ? S : "", cluster: (T = l == null ? void 0 : l.cluster) !== null && T !== void 0 ? T : "", remote_participant_id: c }, ((R, w, P, B, j, x, H) => {
            var K, Q, ie, ce, oe, ee, fe, ye, Ce, ve, _e, Le, et, vt, Et, mt, Ct, Zt, Wt, Bt, Lt, Dt, Ut, nn, At, Pn, xr, br, vi, _i, Br, Qi, Di;
            let Xi = 0, Eo = 0;
            if (R != null && R.jitterBufferEmittedCount && (w != null && w.jitterBufferEmittedCount) && R.jitterBufferEmittedCount > w.jitterBufferEmittedCount) {
              R != null && R.jitterBufferDelay && (w != null && w.jitterBufferDelay) && (Xi = (R.jitterBufferDelay - w.jitterBufferDelay) / (R.jitterBufferEmittedCount - w.jitterBufferEmittedCount));
              const ns = w == null ? void 0 : w.jitterBufferMinimumDelay, rs = R == null ? void 0 : R.jitterBufferMinimumDelay;
              ns && rs && (Eo = (rs - ns) / (R.jitterBufferEmittedCount - w.jitterBufferEmittedCount));
            }
            const Xr = typeof j != "number" ? 1 : j / 1e3, Qa = Math.max(((K = R == null ? void 0 : R.bytesReceived) !== null && K !== void 0 ? K : 0) - ((Q = w == null ? void 0 : w.bytesReceived) !== null && Q !== void 0 ? Q : 0), 0), $s = 8 * Qa / Xr, oa = Math.max(((ie = R == null ? void 0 : R.packetsLost) !== null && ie !== void 0 ? ie : 0) - ((ce = w == null ? void 0 : w.packetsLost) !== null && ce !== void 0 ? ce : 0), 0), Xa = Math.max(((oe = R == null ? void 0 : R.packetsReceived) !== null && oe !== void 0 ? oe : 0) - ((ee = w == null ? void 0 : w.packetsReceived) !== null && ee !== void 0 ? ee : 0), 0), zs = oa / Math.max(Xa + oa, 1), Za = Math.max(((fe = R == null ? void 0 : R.concealedSamples) !== null && fe !== void 0 ? fe : 0) - ((ye = w == null ? void 0 : w.concealedSamples) !== null && ye !== void 0 ? ye : 0), 0), es = Math.max(((Ce = R == null ? void 0 : R.totalSamplesReceived) !== null && Ce !== void 0 ? Ce : 0) - ((ve = w == null ? void 0 : w.totalSamplesReceived) !== null && ve !== void 0 ? ve : 0), 0), qs = Za / Math.max(es, 1), ts = Er(B == null ? void 0 : B.mimeType, B == null ? void 0 : B.sdpFmtpLine);
            return { audio_level: (_e = R == null ? void 0 : R.audioLevel) !== null && _e !== void 0 ? _e : 0, audio_nacks_enabled: (Le = x == null ? void 0 : x.audioNacks) !== null && Le !== void 0 && Le, bytes_received: Qa, codec_mime_type: ts == null ? void 0 : ts.mimeSubtype, connection_bandwidth: (vt = (et = P == null ? void 0 : P.candidatePair) === null || et === void 0 ? void 0 : et.availableIncomingBitrate) !== null && vt !== void 0 ? vt : 0, decode_bitrate: $s, concealed_samples: Za, concealment_events: Math.max(((Et = R == null ? void 0 : R.concealmentEvents) !== null && Et !== void 0 ? Et : 0) - ((mt = w == null ? void 0 : w.concealmentEvents) !== null && mt !== void 0 ? mt : 0), 0), silent_concealed_samples: Math.max(((Ct = R == null ? void 0 : R.silentConcealedSamples) !== null && Ct !== void 0 ? Ct : 0) - ((Zt = w == null ? void 0 : w.silentConcealedSamples) !== null && Zt !== void 0 ? Zt : 0), 0), fraction_audio_concealed: qs, fraction_packets_lost: zs, header_bytes_received: Math.max(((Wt = R == null ? void 0 : R.headerBytesReceived) !== null && Wt !== void 0 ? Wt : 0) - ((Bt = w == null ? void 0 : w.headerBytesReceived) !== null && Bt !== void 0 ? Bt : 0), 0), inserted_samples_for_deceleration: Math.max(((Lt = R == null ? void 0 : R.insertedSamplesForDeceleration) !== null && Lt !== void 0 ? Lt : 0) - ((Dt = w == null ? void 0 : w.insertedSamplesForDeceleration) !== null && Dt !== void 0 ? Dt : 0), 0), configured_jitter_buffer_min_delay_ms: H ?? 0, jitter_buffer_min_obtainable_delay: Eo, jitter_buffer_delay_avg: Xi, packets_discarded: Math.max(((Ut = R == null ? void 0 : R.packetsDiscarded) !== null && Ut !== void 0 ? Ut : 0) - ((nn = w == null ? void 0 : w.packetsDiscarded) !== null && nn !== void 0 ? nn : 0), 0), packets_lost: oa, packets_received: Xa, nack_count: Math.max(((At = R == null ? void 0 : R.nackCount) !== null && At !== void 0 ? At : 0) - ((Pn = w == null ? void 0 : w.nackCount) !== null && Pn !== void 0 ? Pn : 0), 0), removed_samples_for_acceleration: Math.max(((xr = R == null ? void 0 : R.removedSamplesForAcceleration) !== null && xr !== void 0 ? xr : 0) - ((br = w == null ? void 0 : w.removedSamplesForAcceleration) !== null && br !== void 0 ? br : 0), 0), retransmitted_packets_received: Math.max(((vi = R == null ? void 0 : R.retransmittedPacketsReceived) !== null && vi !== void 0 ? vi : 0) - ((_i = w == null ? void 0 : w.retransmittedPacketsReceived) !== null && _i !== void 0 ? _i : 0), 0), retransmitted_bytes_received: Math.max(((Br = R == null ? void 0 : R.retransmittedBytesReceived) !== null && Br !== void 0 ? Br : 0) - ((Qi = w == null ? void 0 : w.retransmittedBytesReceived) !== null && Qi !== void 0 ? Qi : 0), 0), total_samples_received: es, protocol: (Di = P == null ? void 0 : P.localCandidate) === null || Di === void 0 ? void 0 : Di.protocol };
          })(n, e, t, i, I, o, u)));
        }
      }
      class Ua extends ot {
        constructor(r, a, c, l, n = me.PUBLISH, e = !1, t = "") {
          super(je.SIMULCAST_LAYER_INFO, r, a, !1), Object.assign(this.properties, { rid: c, active: l, selected: e, source: n === me.PUBLISH ? "publisher" : "subscriber", remote_participant_id: t });
        }
      }
      const ja = (s) => {
        console.warn(`[IVS Stages] ${s}`);
      };
      var qo, dr, Vn;
      (function(s) {
        s.Mobile = "mobile", s.Tablet = "tablet", s.Desktop = "desktop", s.Tv = "tv";
      })(qo || (qo = {})), function(s) {
        s.IOS = "iOS", s.MacOS = "macOS", s.Windows = "Windows", s.Android = "Android";
      }(dr || (dr = {})), function(s) {
        s.Safari = "Safari", s.Firefox = "Firefox", s.Chrome = "Chrome", s.IE = "Internet Explorer", s.Edge = "Microsoft Edge";
      }(Vn || (Vn = {}));
      const Ai = function(s) {
        const r = qr(s);
        return { platform: { isMobile: zi(qo.Mobile, r), isTablet: zi(qo.Tablet, r), isDesktop: zi(qo.Desktop, r), isTv: zi(qo.Tv, r) }, os: { name: He(r), version: qi(r), isIOS: Ge(dr.IOS, r), isMacOS: Ge(dr.MacOS, r), isWindows: Ge(dr.Windows, r), isAndroid: Ge(dr.Android, r) }, browser: { name: Ki(r), version: Fa(r), isSafari: Mr(Vn.Safari, r), isFirefox: Mr(Vn.Firefox, r), isChrome: Mr(Vn.Chrome, r), isIE: Mr(Vn.IE, r), isEdge: Mr(Vn.Edge, r) } };
      }(window.navigator.userAgent);
      function qr(s) {
        try {
          return tc.getParser(s || window.navigator.userAgent);
        } catch {
        }
      }
      function zi(s, r) {
        return () => (r || (r = qr()), !(!r || r.getPlatformType(!0) !== s.toLowerCase()));
      }
      function qi(s) {
        return () => (s || (s = qr()), s && s.getOSVersion() || "");
      }
      function He(s) {
        return () => (s || (s = qr()), s && s.getOSName() || "");
      }
      function Ge(s, r) {
        return () => (r || (r = qr()), !(!r || r.getOSName(!0) !== s.toLowerCase()));
      }
      function Fa(s) {
        return () => (s || (s = qr()), s && s.getBrowserVersion() || "");
      }
      function Ki(s) {
        return () => (s || (s = qr()), s && s.getBrowserName() || "");
      }
      function Mr(s, r) {
        return () => (r || (r = qr()), !(!r || r.getBrowserName().toLowerCase() !== s.toLowerCase()));
      }
      const Ls = { name: "SimulcastUnsupported", message: `Simulcast is only supported on Chromium browsers at bitrates over ${Wi.MID.maxBitrateKbps}Kbps`, code: 100 }, gn = { name: "SimulcastLayerInvalidType", message: "Layer configuration is invalid: ", code: 101 }, Ln = { name: "SimulcastMaxLayersExceeded", message: "No more than 3 simulcast layers may be configured", code: 102 }, bc = { name: "SimulcastDuplicateLayersConfigured", message: "Two duplicate layers are configured. At minimum bitrate, framerate, or dimensions must differ", code: 103 }, fu = { name: "SimulcastMaxLayerBitrateExceeded", message: `maxBitrateKbps cannot exceed ${zr} Kbps`, code: 105 }, ki = { name: "SimulcastMinLayerBitrateExceeded", message: `maxBitrateKbps cannot be less than ${Ti} Kbps`, code: 106 }, sn = { name: "SimulcastMaxLayerFramerateExceeded", message: `maxFramerate cannot exceed ${Mn} fps`, code: 107 }, xn = { name: "SimulcastMinLayerFramerateExceeded", message: `maxFramerate cannot be less than ${Hi} fps`, code: 108 }, Ko = { name: "SimulcastMaxLayerDimensionsExceeded", message: `dimensions cannot exceed max resolution of ${Nr}x720`, code: 109 }, Tc = { name: "SimulcastMinLayerDimensionsExceeded", message: `width or height cannot be lower than ${li}`, code: 110 }, Jo = { name: "SimulcastLayerConfigurationConflict", message: "Layer configuration conflict: ", code: 111 }, Yo = { name: "SimulcastLayerOrientationMismatch", message: "Layer orientation different from input video track: ", code: 112 }, Cc = { name: "SimulcastLayerInputResolutionInsufficient", message: "Input video resolution is lower than the configured layer: ", code: 113 }, Ic = { name: "SimulcastLayerInputFramerateInsufficient", message: "Input video framerate is lower than the configured layer: ", code: 114 };
      class An extends Error {
        constructor({ name: r, message: a, code: c, details: l, cause: n, params: e }) {
          super(a), Error.captureStackTrace && Error.captureStackTrace(this, An), this.name = r, this.message = a, this.code = c, this.details = l, this.cause = n, this.params = e;
        }
      }
      const Va = (s) => ({ rid: s.rid, active: s.active, scaleResolutionDownBy: s.scaleFactor, maxBitrate: s.maxBitrateBps, maxFramerate: s.maxFramerate }), Rc = (s, r) => s.width * s.height > r.width * r.height || s.maxBitrateKbps > r.maxBitrateKbps || s.maxFramerate > r.maxFramerate ? 1 : Qo(s, r) ? 0 : -1, Qo = (s, r) => {
        if (typeof s != "object" || typeof r != "object") return !1;
        const a = Object.keys(s);
        for (const c of a) if (s[c] !== r[c]) return !1;
        return !0;
      }, fo = (s) => {
        const { width: r, height: a } = Ga(s);
        return r * a;
      }, Ga = (s) => {
        const { height: r, width: a } = s;
        let c = Nr / Ps, l = Nr;
        return r !== void 0 && (c = r), a !== void 0 && (l = a), r && !a && (l = r * Ps), !r && a && (c = a / Ps), { height: c, width: l };
      }, wc = (s) => {
        const { width: r, height: a } = s;
        return r / a >= 1 ? Gi.LANDSCAPE : Gi.PORTRAIT;
      }, Pi = (s, r, a) => {
        var c;
        const l = (c = s.getSettings().frameRate) !== null && c !== void 0 ? c : Mn;
        return Object.assign(Object.assign({}, a), { active: !0, height: r.height, width: r.width, maxBitrateBps: Pr(r.maxBitrateKbps), maxFramerate: Math.min(r.maxFramerate, l), scaleFactor: Wa(r, s) });
      }, Wa = (s, r) => {
        const a = fo(r.getSettings()), c = fo(s);
        if (c >= a) return 1;
        const l = 1 / Math.sqrt(c / a);
        return Math.max(l, 1);
      }, Oc = (s) => {
        if (typeof s != "object") {
          const r = Object.assign({}, gn);
          throw r.message += " is not an object", new An(r);
        }
      }, di = (s, r) => {
        if (typeof s != "number") {
          const a = Object.assign({}, gn);
          throw a.message += "maxBitrateKbps is not a number", new An(a);
        }
        if (s < Ti) throw new An(Object.assign({}, ki));
        if (s > zr) throw new An(Object.assign({}, fu));
        if (r && s > r) {
          const a = Object.assign({}, Jo);
          throw a.message += `maxBitrateKbps cannot be greater than stage maxVideoBitrateKbps of ${r}`, new An(a);
        }
      }, Qn = (s, r) => {
        if (typeof s != "number") {
          const a = Object.assign({}, gn);
          throw a.message += "maxFramerate is not a number", new An(a);
        }
        if (s < Hi) throw new An(Object.assign({}, xn));
        if (s > Mn) throw new An(Object.assign({}, sn));
        if (r && s > r) {
          const a = Object.assign({}, Jo);
          throw a.message += `maxFramerate cannot be greater than stage maxFramerate of ${r} `, new An(a);
        }
      }, po = (s, r) => {
        var a;
        if (typeof s != "number" || typeof r != "number") {
          const n = Object.assign({}, gn);
          throw n.message += "width and height must be numbers", new An(n);
        }
        if (s < li || r < li) throw new An(Object.assign({}, Tc));
        const c = (a = ln("enable1080pResolution")) !== null && a !== void 0 && a, l = c ? 1920 : Nr;
        if (s > l || r > l) throw new An(Object.assign({}, Ko));
        if (s * r > (c ? 2073600 : $i)) throw new An(Object.assign({}, Ko));
      }, Wu = (s, r) => {
        const a = Ga(r.getSettings()), c = wc(a);
        c !== wc(s) && ja(`${Yo.message}forcing orientation to ${c}`);
      }, Rl = (s, r) => {
        var a, c, l, n, e;
        let t = (0, zt.cloneDeep)(r);
        const i = (a = t.simulcast) !== null && a !== void 0 ? a : {}, o = !Ai.browser.isChrome() && !Ai.browser.isEdge(), u = (l = (c = s.getSettings()) === null || c === void 0 ? void 0 : c.displaySurface) !== null && l !== void 0 && l, d = (n = t.maxVideoBitrateKbps) !== null && n !== void 0 ? n : zr, h = !(Array.isArray((e = r.simulcast) === null || e === void 0 ? void 0 : e.layers) || !r.maxVideoBitrateKbps) && d < Wi.MID.maxBitrateKbps;
        if (typeof i.enabled == "boolean" && i.enabled && (o || u || h)) {
          t.simulcast = { enabled: !1 };
          const { name: S, message: T } = Ls;
          ja(`${S}${T}, disabling the feature`);
        }
        return t = ((S, T) => {
          var I, R;
          const w = T, P = (I = T.simulcast) === null || I === void 0 ? void 0 : I.layers;
          if (P === void 0) return w;
          if (!Array.isArray(P)) {
            const B = Object.assign({}, gn);
            throw B.message += " layers is not an array", new An(B);
          }
          if (P.length === 0) return (R = w.simulcast) === null || R === void 0 || delete R.layers, w;
          if (P.length > 3) throw new An(Object.assign({}, Ln));
          if ((0, zt.uniqWith)(P, Qo).length !== P.length) throw new An(Object.assign({}, bc));
          for (const B of P) Oc(B), di(B.maxBitrateKbps, T.maxVideoBitrateKbps), Qn(B.maxFramerate, T.maxFramerate), po(B.width, B.height), Wu(B, S);
          return w;
        })(s, t), t;
      };
      function pu(s) {
        return s.track.kind === at.AUDIO;
      }
      function Ac(s) {
        return s.track.kind === at.VIDEO && typeof s.config == "object";
      }
      function kc(s) {
        if (s !== void 0 && (s < Ti || s > zr)) throw new Error(`Stage bitrate must be a number between ${Ti} kbps and ${zr} kbps inclusive`);
      }
      function xs(s) {
        return s !== void 0 && ("maxBitrate" in s || "maxVideoBitrateKbps" in s || "maxFramerate" in s || "simulcast" in s || "inBandMessaging" in s || "minBitrate" in s);
      }
      function gu(s, r) {
        if (r === void 0) return r;
        let a = (0, zt.cloneDeep)(r);
        return xs(a) ? (a.maxBitrate !== void 0 && (a.maxVideoBitrateKbps = a.maxBitrate, ja("maxBitrate is deprecated in favor of maxVideoBitrateKbps")), a = Rl(s, a), kc(a.maxVideoBitrateKbps), kc(a.minBitrate), function(c) {
          if (c !== void 0 && (c > Mn || c < Hi)) throw new Error(`Stage framerate must be between ${Hi} fps and ${Mn} fps inclusive`);
        }(a.maxFramerate), function(c) {
          if (c !== void 0) {
            if (typeof c != "object") throw new Error("In-band messaging config must be an object");
            if (typeof c.enabled != "boolean") throw new Error("In-band messaging config enabled property must be a boolean");
          }
        }(a.inBandMessaging)) : (function(c) {
          if (c !== void 0 && (c < Ho || c > ho)) throw new Error(`Stage audio bitrate must be between ${Ho} Kbps and ${ho} Kbps inclusive`);
        }(a.maxAudioBitrateKbps), function(c) {
          if (c !== void 0 && typeof c != "boolean") throw new Error("Stage stereo prop must be a boolean");
        }(a.stereo)), a;
      }
      const Hu = (s, r, a) => {
        var c;
        const l = { [cr.HI]: Wo(cr.HI), [cr.MID]: Wo(cr.MID), [cr.LOW]: Wo(cr.LOW) }, n = r.simulcast, e = a == null ? void 0 : a.simulcast;
        let t = n.layers.sort(Rc);
        const i = (c = e == null ? void 0 : e.layers) !== null && c !== void 0 ? c : [], o = t.length, u = i.length;
        return t = t.map((d) => {
          ((S, T) => {
            const { width: I, height: R } = Ga(T.getSettings()), { width: w, height: P } = S;
            if (w * P > I * R) {
              const B = `forcing layer of ${w}x${P} to the input dimensions ${I}x${R}`, { name: j, message: x } = Cc;
              ja(`${j}${x}${B}`);
            }
          })(d, s), ((S, T) => {
            var I;
            const R = (I = T.getSettings().frameRate) !== null && I !== void 0 ? I : Mn, w = S.maxFramerate;
            if (w > R) {
              const P = `forcing layer of ${w}fps to the input framerate of ${R}`, { name: B, message: j } = Ic;
              ja(`${B}${j}${P}`);
            }
          })(d, s);
          let h = ((S, T) => {
            const { maxVideoBitrateKbps: I } = T, R = S;
            return I && S.maxBitrateKbps > I && (R.maxBitrateKbps = I), R;
          })(d, r);
          return h = ((S, T) => {
            const { maxFramerate: I } = T, R = S;
            return I && S.maxFramerate > I && (R.maxFramerate = I), R;
          })(d, r), h;
        }), (u === 0 || u === 3) && o === 3 ? (l.hi = Pi(s, t[2], l.hi), l.mid = Pi(s, t[1], l.mid), l.low = Pi(s, t[0], l.low), Re.ok(l)) : u === 1 && o === 1 ? (l.hi = Pi(s, t[0], l.hi), Re.ok(l)) : u === 2 && o === 2 ? (l.hi = Pi(s, t[1], l.hi), l.low = Pi(s, t[0], l.low), Re.ok(l)) : Re.err(null);
      }, wl = (s, r, a) => {
        const c = r.simulcast, l = r.inBandMessaging, n = Pr(r.minBitrate), e = Pr(r.maxVideoBitrateKbps), t = r.maxFramerate;
        let i = [{ maxBitrate: e, maxFramerate: t }];
        const o = Hu(s, r, a ?? {});
        return c.enabled && o.ok && (i = ((u) => {
          const { hi: d, mid: h, low: S } = u;
          return [Va(S), Va(h), Va(d)];
        })(o.value)), { track: s, config: { minBitrateBps: n, maxBitrateBps: e, maxFramerate: t, inBandMessagingEnabled: l.enabled, simulcastEnabled: c.enabled, simulcastLayers: o.ok ? o.value : void 0, encodingLayers: i } };
      }, $u = (s) => {
        const r = s.mediaStreamTrack, a = s.normalizedConfig;
        let c = {};
        const l = s.validatedExternalConfig;
        return xs(l) && (c = l), function(n) {
          return n.kind === at.AUDIO;
        }(r) ? ((n, e) => {
          const t = { maxBitrateBps: Pr(e.maxAudioBitrateKbps) }, i = e == null ? void 0 : e.stereo;
          return typeof i == "boolean" && (t.stereo = i), { track: n, config: t };
        })(r, a) : wl(r, a, c);
      }, Kr = (s, r) => {
        const a = { minBitrate: Ti, maxBitrate: zr, maxVideoBitrateKbps: zr, maxFramerate: Mn, simulcast: { enabled: !1, layers: [Object.assign({}, Wi.HI), Object.assign({}, Wi.MID), Object.assign({}, Wi.LOW)] }, maxAudioBitrateKbps: Sc, stereo: !1, inBandMessaging: { enabled: !1 } }, c = (0, zt.cloneDeep)(r), l = Object.assign(Object.assign({}, a), c);
        return xs(c) && (c.simulcast && (l.simulcast = Object.assign(Object.assign({}, a.simulcast), c.simulcast)), c.inBandMessaging && (l.inBandMessaging = Object.assign(Object.assign({}, a.inBandMessaging), c.inBandMessaging))), l;
      }, hr = (s, r) => {
        if (typeof s == "number") return s;
        const a = r ? cu : uu;
        return a[s] !== void 0 ? a[s] : 0;
      };
      class zu extends ot {
        constructor(r, a, c, l) {
          super(je.MULTIHOST_CONFIGURATION, r, a, !1), Object.assign(this.properties, Object.assign(Object.assign({}, c), { action: l }));
        }
      }
      class qu extends ot {
        constructor(r, a, c, l, n) {
          super(je.MULTIHOST_SUBSCRIBE_CONFIGURATION, r, a, !1);
          const e = { trigger: c, remote_participant_id: l, min_delay_when_publishing: hr(n.jitterBuffer.minDelayWhenPublishing, !0), min_delay_when_subscribe_only: hr(n.jitterBuffer.minDelayWhenSubscribeOnly, !1), in_band_messaging_enabled: n.inBandMessaging.enabled, simulcast_initial_layer_preference: n.simulcast.initialLayerPreference, simulcast_layer_poll_interval_ms: n.simulcast.layerPollingIntervalMs, simulcast_layer_poll_enabled: n.simulcast.layerPollingEnabled };
          Object.assign(this.properties, e);
        }
      }
      var Xo = function(s, r, a, c) {
        return new (a || (a = Promise))(function(l, n) {
          function e(o) {
            try {
              i(c.next(o));
            } catch (u) {
              n(u);
            }
          }
          function t(o) {
            try {
              i(c.throw(o));
            } catch (u) {
              n(u);
            }
          }
          function i(o) {
            var u;
            o.done ? l(o.value) : (u = o.value, u instanceof a ? u : new a(function(d) {
              d(u);
            })).then(e, t);
          }
          i((c = c.apply(s, [])).next());
        });
      };
      class Ha {
        constructor(r, a, c, l, n) {
          this.analyticsTracker = n, this.simulcastEnabled = !1, this.simulcastState = { low: !1, mid: !1, hi: !1 }, this.sdp = new dt(""), this.sdpFeatures = { audioNacks: !1 }, this.multihostConfiguration = Ha.defaultMultihostConfiguration(), this.prevOutboundVideoStats = /* @__PURE__ */ new Map(), this.prevInboundVideoStats = /* @__PURE__ */ new Map(), this.prevRemoteInboundStats = /* @__PURE__ */ new Map(), this.sfuResource = { node: "", cluster: "" }, this.connectionStartedTimestamp = Date.now(), this.seiStats = { seiReadCnt: 0, seiBytesRead: 0, seiWriteCnt: 0, seiBytesWritten: 0 }, this.prevVideoReceiverTransformerStats = { seiReadCnt: 0, seiBytesRead: 0 }, this.prevVideoSenderTransformerStats = { seiWriteCnt: 0, seiBytesWritten: 0 }, this.vidNetworkQualityMap = /* @__PURE__ */ new Map(), this.audioNetworkQualityMap = /* @__PURE__ */ new Map(), this.onPeerConnectionStateChange = () => {
            switch (this.getConnectionState()) {
              case xe.CONNECTED:
                this.connectionStartedTimestamp = Date.now(), this.setupIntervals();
                break;
              case xe.FAILED:
                this.flushStats();
            }
          }, this.action = r, this.token = a, this.traceId = c, this.identifier = l;
        }
        static defaultMultihostConfiguration() {
          return { video_codec: "unknown", width: 0, height: 0, max_bitrate: 0, min_bitrate: 0, target_fps: 0, echo_cancellation: !1, auto_gain: !1, noise_suppression: !1, enable_simulcast: !1, max_audio_bitrate_bps: Pr(ho), hi_video_layer: "", mid_video_layer: "", low_video_layer: "" };
        }
        set sdpAnswer(r) {
          try {
            this.sdp = new dt(r), this.sdpFeatures.audioNacks = this.sdp.hasAudioNacksEnabled();
          } catch {
          }
        }
        start(r, a = !1) {
          this.peerConnection = r, this.simulcastEnabled = a, this.prevOutboundAudioStats = void 0, this.prevOutboundVideoStats = /* @__PURE__ */ new Map(), this.prevRemoteInboundStats = /* @__PURE__ */ new Map(), this.peerConnection.addEventListener("connectionstatechange", this.onPeerConnectionStateChange);
        }
        stop() {
          var r;
          clearInterval(this.uploadStatsInterval), this.uploadStatsInterval = void 0, (r = this.peerConnection) === null || r === void 0 || r.removeEventListener("connectionstatechange", this.onPeerConnectionStateChange);
        }
        updateSfuResource(r) {
          this.sfuResource = r;
        }
        updateMultihostConfiguration(r, a) {
          var c, l, n, e, t, i, o, u, d;
          return Xo(this, void 0, void 0, function* () {
            if (this.action !== me.PUBLISH || !this.peerConnection) return;
            const h = Ha.defaultMultihostConfiguration();
            if (a) {
              const S = this.peerConnection.getSenders().filter((R) => R.track !== null && R.track.kind === "video");
              let T = "unknown";
              S.length > 0 && (yield S[0].getStats()).forEach((R) => {
                if (R.type === "codec" && (h.video_codec = R.mimeType, R.sdpFmtpLine)) {
                  const w = R.sdpFmtpLine.match(/profile-level-id=([a-f0-9]+)/);
                  w && w.length > 0 && (T = w[1]);
                }
              });
              const I = a.track.getSettings();
              h.width = (c = I.width) !== null && c !== void 0 ? c : 0, h.height = (l = I.height) !== null && l !== void 0 ? l : 0, h.target_fps = (n = I.frameRate) !== null && n !== void 0 ? n : 0, a.config ? (h.max_bitrate = a.config.maxBitrateBps, h.min_bitrate = a.config.minBitrateBps, h.enable_simulcast = a.config.simulcastEnabled) : (h.max_bitrate = Pr(zr), h.min_bitrate = Pr(Ti), h.enable_simulcast = !1), a.config.simulcastEnabled && (h.hi_video_layer = this.mapLayerToMetric(T, (e = a.config.simulcastLayers) === null || e === void 0 ? void 0 : e.hi), h.mid_video_layer = this.mapLayerToMetric(T, (t = a.config.simulcastLayers) === null || t === void 0 ? void 0 : t.mid), h.low_video_layer = this.mapLayerToMetric(T, (i = a.config.simulcastLayers) === null || i === void 0 ? void 0 : i.low));
            }
            if (r) {
              const S = r.track.getSettings();
              h.auto_gain = (o = S.autoGainControl) !== null && o !== void 0 && o, h.echo_cancellation = (u = S.echoCancellation) !== null && u !== void 0 && u, h.noise_suppression = (d = S.noiseSuppression) !== null && d !== void 0 && d, h.max_audio_bitrate_bps = r.config.maxBitrateBps, h.stereo = r.config.stereo;
            }
            (0, zt.isEqual)(h, this.multihostConfiguration) || (this.analyticsTracker.trackEventNoSharedProps(new zu(this.token, this.traceId, h, this.action)), this.multihostConfiguration = h);
          });
        }
        resetTransformers(r, a) {
          this.senderVideoTransformer = a, this.receiveVideoTransformer = r, this.prevVideoReceiverTransformerStats = { seiReadCnt: 0, seiBytesRead: 0 }, this.prevVideoSenderTransformerStats = { seiWriteCnt: 0, seiBytesWritten: 0 };
        }
        getStats(r) {
          var a;
          return Xo(this, void 0, void 0, function* () {
            const c = yield (a = this.peerConnection) === null || a === void 0 ? void 0 : a.getStats(r), { action: l } = this;
            if (c) if (r.kind === "audio") {
              if (l === me.PUBLISH) return { action: l, rawReport: c, stats: lu(c, this.audioNetworkQualityMap) };
              if (l === me.SUBSCRIBE) return { action: l, rawReport: c, stats: $o(c, this.audioNetworkQualityMap) };
            } else {
              if (l === me.PUBLISH) return { action: l, rawReport: c, stats: du(c, this.vidNetworkQualityMap) };
              if (l === me.SUBSCRIBE) return { action: l, rawReport: c, stats: Ri(c, this.vidNetworkQualityMap) };
            }
          });
        }
        mapLayerToMetric(r, a) {
          return !a || !a.active ? "" : `${`${a.height}x${a.width}`}_${`${a.maxFramerate}fps`}_${a.maxBitrateBps / 1e3 + "kbps"}_${r}`;
        }
        updateJitterBufferMinDelay(r) {
          this.jitterBufferMinDelayInMs = r;
        }
        setupIntervals() {
          this.action === me.PUBLISH && this.simulcastEnabled && !this.pollSimulcastLayerInterval && (this.pollSimulcastLayers(), this.pollSimulcastLayerInterval = this.startInterval(this.pollSimulcastLayers, 5e3)), this.uploadStatsInterval || (this.uploadStats(), this.uploadStatsInterval = this.startInterval(this.uploadStats, 1e4));
        }
        startInterval(r, a) {
          return setInterval(r.bind(this), a);
        }
        getConnectionState() {
          var r;
          if (!this.peerConnection) return xe.NONE;
          const a = (r = this.peerConnection.connectionState) !== null && r !== void 0 ? r : this.peerConnection.iceConnectionState;
          try {
            return Pa(a);
          } catch {
            return xe.IDLE;
          }
        }
        pollSimulcastLayers() {
          var r;
          return Xo(this, void 0, void 0, function* () {
            if (this.getConnectionState() === xe.CONNECTED) {
              const a = yield (r = this.peerConnection) === null || r === void 0 ? void 0 : r.getStats();
              if (!a) return;
              a.forEach((c) => {
                var l;
                if (c.type === "outbound-rtp") {
                  const n = ((l = c.framesPerSecond) !== null && l !== void 0 ? l : 0) !== 0;
                  switch (c.rid) {
                    case "low":
                      n !== this.simulcastState.low && (this.simulcastState.low = n, this.analyticsTracker.trackEventNoSharedProps(new Ua(this.token, this.traceId, c.rid, n)));
                      break;
                    case "mid":
                      n !== this.simulcastState.mid && (this.simulcastState.mid = n, this.analyticsTracker.trackEventNoSharedProps(new Ua(this.token, this.traceId, c.rid, n)));
                      break;
                    case "hi":
                      n !== this.simulcastState.hi && (this.simulcastState.hi = n, this.analyticsTracker.trackEventNoSharedProps(new Ua(this.token, this.traceId, c.rid, n)));
                  }
                }
              });
            }
          });
        }
        flushStats() {
          var r;
          return Xo(this, void 0, void 0, function* () {
            const a = yield (r = this.peerConnection) === null || r === void 0 ? void 0 : r.getStats();
            a && (this.action === me.PUBLISH ? this.uploadPublisherStats(a) : this.action === me.SUBSCRIBE && this.uploadSubscriberStats(a));
          });
        }
        uploadStats() {
          var r;
          return Xo(this, void 0, void 0, function* () {
            if (this.getConnectionState() === xe.CONNECTED) {
              const a = yield (r = this.peerConnection) === null || r === void 0 ? void 0 : r.getStats();
              if (!a) return;
              this.action === me.PUBLISH ? this.uploadPublisherStats(a) : this.action === me.SUBSCRIBE && this.uploadSubscriberStats(a);
            }
          });
        }
        uploadPublisherStats(r) {
          var a, c;
          const l = { audio: {}, video: [], candidateStats: {} }, n = /* @__PURE__ */ new Map(), e = (Date.now() - this.connectionStartedTimestamp) / 1e3, t = Object.assign({}, this.multihostConfiguration), { seiWriteCnt: i, seiBytesWritten: o } = this.updateAndDiffSeiPublishStatsSinceLastUpdate((a = this.senderVideoTransformer) === null || a === void 0 ? void 0 : a.getSenderStats());
          if (this.seiStats.seiWriteCnt += i, this.seiStats.seiBytesWritten += o, r.forEach((u) => {
            if (u.type === "outbound-rtp") {
              const d = r.get(u.remoteId), h = this.prevRemoteInboundStats.get(u.remoteId);
              switch (d && this.prevRemoteInboundStats.set(d.id, d), u.kind) {
                case "audio":
                  l.audio = this.updateOutboundAudio(u), l.audio.remoteInbound = d, l.audio.prevRemoteInbound = h, l.audio.codec = n.get(u.codecId);
                  break;
                case "video":
                  l.video.push(Object.assign({}, this.updateOutboundVideo(u), { remoteInbound: d, prevRemoteInbound: h, codec: n.get(u.codecId) }));
              }
            }
            u.type === "candidate-pair" && u.nominated && (l.candidateStats.candidatePair = u, l.candidateStats.localCandidate = r.get(u.localCandidateId), l.candidateStats.remoteCandidate = r.get(u.remoteCandidate)), u.type === "codec" && n.set(u.id, u);
          }), l.video.forEach((u) => {
            var d, h;
            const { outbound: S, prevOutbound: T } = u;
            if (!S) return;
            const I = (h = (d = u.outbound) === null || d === void 0 ? void 0 : d.rid) !== null && h !== void 0 ? h : zn;
            this.updateNetworkQualityPublish(I, this.vidNetworkQualityMap, S, T);
          }), l.audio.outbound) {
            const u = (c = l.audio.outbound.rid) !== null && c !== void 0 ? c : zn;
            this.updateNetworkQualityPublish(u, this.audioNetworkQualityMap, l.audio.outbound, l.audio.prevOutbound);
          }
          this.analyticsTracker.trackEventNoSharedProps(new Ms(this.token, this.traceId, this.sfuResource, l.audio.outbound, l.audio.remoteInbound, l.candidateStats, l.audio.codec, t, e, this.sdpFeatures)), l.audio.prevOutbound && this.analyticsTracker.trackEventNoSharedProps(new yc(this.token, this.traceId, this.sfuResource, l.audio.outbound, l.audio.prevOutbound, l.audio.remoteInbound, l.audio.prevRemoteInbound, l.candidateStats, l.audio.codec, t, this.sdpFeatures)), l.video.forEach((u) => {
            this.analyticsTracker.trackEventNoSharedProps(new Ds(this.token, this.traceId, this.sfuResource, u.outbound, u.remoteInbound, l.candidateStats, u.codec, t, e)), u.prevOutbound && this.analyticsTracker.trackEventNoSharedProps(new Ns(this.token, this.traceId, this.sfuResource, u.outbound, u.prevOutbound, u.remoteInbound, u.prevRemoteInbound, l.candidateStats, u.codec, t, this.seiStats.seiWriteCnt, this.seiStats.seiBytesWritten));
          });
        }
        updateNetworkQualityPublish(r, a, c, l) {
          var n, e, t, i;
          let o = 0;
          const u = nr.getNetworkQuality(), d = (n = c.packetsSent) !== null && n !== void 0 ? n : 0, h = (e = c.nackCount) !== null && e !== void 0 ? e : 0;
          if (l) if (u === In.DOWN) a.set(r, In.DOWN);
          else {
            o = (h - ((t = l == null ? void 0 : l.nackCount) !== null && t !== void 0 ? t : 0)) / (d - ((i = l == null ? void 0 : l.packetsSent) !== null && i !== void 0 ? i : 0));
            const S = this.convertLostRatioToQuality(o);
            a.set(r, S);
          }
          else a.set(r, u);
        }
        updateNetworkQualitySubscribe(r, a, c) {
          var l, n, e, t;
          let i = 0;
          const o = nr.getNetworkQuality(), u = (l = a == null ? void 0 : a.packetsReceived) !== null && l !== void 0 ? l : 0, d = (n = a == null ? void 0 : a.nackCount) !== null && n !== void 0 ? n : 0;
          if (!a) return;
          const h = a.id;
          if (h) if (c) if (o === In.DOWN) r.set(h, In.DOWN);
          else {
            i = (d - ((e = c == null ? void 0 : c.nackCount) !== null && e !== void 0 ? e : 0)) / (u - ((t = c == null ? void 0 : c.packetsReceived) !== null && t !== void 0 ? t : 0));
            const S = this.convertLostRatioToQuality(i);
            r.set(h, S);
          }
          else r.set(h, o);
        }
        uploadSubscriberStats(r) {
          var a, c;
          const l = { audio: {}, video: {}, candidateStats: {} }, n = /* @__PURE__ */ new Map(), e = (Date.now() - this.connectionStartedTimestamp) / 1e3, t = (a = this.jitterBufferMinDelayInMs) !== null && a !== void 0 ? a : 0, { seiReadCnt: i, seiBytesRead: o } = this.updateAndDiffSeiSubscribeStatsSinceLastUpdate((c = this.receiveVideoTransformer) === null || c === void 0 ? void 0 : c.getReceiverStats());
          this.seiStats.seiReadCnt += i, this.seiStats.seiBytesRead += o, r.forEach((u) => {
            if (u.type === "inbound-rtp") switch (u.kind) {
              case "audio":
                l.audio = this.updateInboundAudio(u), l.audio.codec = n.get(u.codecId), this.updateNetworkQualitySubscribe(this.audioNetworkQualityMap, l.audio.inbound, l.audio.prevInbound);
                break;
              case "video":
                l.video = this.updateInboundVideo(u), l.video.codec = n.get(u.codecId), this.updateNetworkQualitySubscribe(this.vidNetworkQualityMap, l.video.inbound, l.video.prevInbound);
            }
            u.type === "candidate-pair" && u.nominated && (l.candidateStats.candidatePair = u, l.candidateStats.localCandidate = r.get(u.localCandidateId), l.candidateStats.remoteCandidate = r.get(u.remoteCandidate)), u.type === "codec" && n.set(u.id, u);
          }), this.analyticsTracker.trackEventNoSharedProps(new wi(this.token, this.traceId, this.identifier, this.sfuResource, l.audio.inbound, l.candidateStats, l.audio.codec, e, this.sdpFeatures)), l.audio.prevInbound && this.analyticsTracker.trackEventNoSharedProps(new Oi(this.token, this.traceId, this.identifier, this.sfuResource, l.audio.inbound, l.audio.prevInbound, l.candidateStats, l.audio.codec, this.sdpFeatures, t)), this.analyticsTracker.trackEventNoSharedProps(new hu(this.token, this.traceId, this.identifier, this.sfuResource, l.video.inbound, l.candidateStats, l.video.codec, e)), l.video.prevInbound && this.analyticsTracker.trackEventNoSharedProps(new Gu(this.token, this.traceId, this.identifier, this.sfuResource, l.video.inbound, l.video.prevInbound, l.candidateStats, l.video.codec, t, this.seiStats.seiReadCnt, this.seiStats.seiBytesRead));
        }
        updateAndDiffSeiSubscribeStatsSinceLastUpdate(r) {
          const a = this.prevVideoReceiverTransformerStats;
          if (!r) return { seiReadCnt: a.seiReadCnt, seiBytesRead: a.seiBytesRead };
          const c = r.seiReadCnt - a.seiReadCnt, l = r.seiBytesRead - a.seiBytesRead;
          return this.prevVideoReceiverTransformerStats = { seiReadCnt: r.seiReadCnt, seiBytesRead: r.seiBytesRead }, { seiReadCnt: c, seiBytesRead: l };
        }
        updateAndDiffSeiPublishStatsSinceLastUpdate(r) {
          const a = this.prevVideoSenderTransformerStats;
          if (!r) return { seiWriteCnt: a.seiWriteCnt, seiBytesWritten: a.seiBytesWritten };
          const c = r.seiWriteCnt - a.seiWriteCnt, l = r.seiBytesWritten - a.seiBytesWritten;
          return this.prevVideoSenderTransformerStats = { seiWriteCnt: r.seiWriteCnt, seiBytesWritten: r.seiBytesWritten }, { seiWriteCnt: c, seiBytesWritten: l };
        }
        updateOutboundAudio(r) {
          const a = r, c = this.prevOutboundAudioStats, l = r.id === (c == null ? void 0 : c.id) ? c : void 0;
          return this.prevOutboundAudioStats = r, { outbound: a, prevOutbound: l };
        }
        updateInboundAudio(r) {
          const a = r, c = this.prevInboundAudioStats, l = r.id === (c == null ? void 0 : c.id) ? c : void 0;
          return this.prevInboundAudioStats = r, { inbound: a, prevInbound: l };
        }
        updateInboundVideo(r) {
          const a = r, c = this.prevInboundVideoStats.get(zn), l = r.id === (c == null ? void 0 : c.id) ? c : void 0;
          return this.prevInboundVideoStats.set(zn, r), { inbound: a, prevInbound: l };
        }
        updateOutboundVideo(r) {
          const a = r, c = this.getPrevOutboundVideo(r), l = r.id === (c == null ? void 0 : c.id) ? c : void 0;
          return this.setPrevVideoStat(r), { outbound: a, prevOutbound: l };
        }
        getPrevOutboundVideo(r) {
          return this.simulcastEnabled && r.rid && this.prevOutboundVideoStats.has(r.rid) ? this.prevOutboundVideoStats.get(r.rid) : !this.simulcastEnabled && this.prevOutboundVideoStats.has(zn) ? this.prevOutboundVideoStats.get(zn) : void 0;
        }
        setPrevVideoStat(r) {
          this.simulcastEnabled && r.rid ? this.prevOutboundVideoStats.set(r.rid, r) : this.simulcastEnabled || this.prevOutboundVideoStats.set(zn, r);
        }
        convertLostRatioToQuality(r) {
          return r <= 0 ? In.EXCELLENT : r <= 0.01 ? In.GOOD : r <= 0.03 ? In.NORMAL : r <= 0.1 ? In.POOR : In.DOWN;
        }
      }
      class Ku extends ot {
        constructor(r, a, c, l, n) {
          super(je.MINUTE, r, a, !1), Object.assign(this.properties, { action: l ? me.PUBLISH : me.SUBSCRIBE, is_publishing: l, minutes_logged: c, subscribed_number: n });
        }
      }
      class Ol extends ot {
        constructor(r) {
          super(je.PUBLISH, r.token, r.traceId, !1), Object.assign(this.properties, { action: me.PUBLISH, remote_participant_id: r.token.participantID });
        }
      }
      class mu extends ot {
        constructor(r) {
          super(je.UNPUBLISH, r.token, r.traceId, !0), Object.assign(this.properties, { action: me.PUBLISH, remote_participant_id: r.token.participantID });
        }
      }
      class Pc extends ot {
        constructor(r) {
          var a, c, l, n;
          super(je.SUBSCRIBE, r.token, r.traceId, !1), Object.assign(this.properties, { action: me.SUBSCRIBE, remote_participant_id: r.subscribedId, subscribed_id: r.subscribedId, is_edp_connected: r.isEdpConnected, is_reassignment: r.isReassignment, node: (c = (a = r.preAttemptSfuResource) === null || a === void 0 ? void 0 : a.node) !== null && c !== void 0 ? c : "", cluster: (n = (l = r.preAttemptSfuResource) === null || l === void 0 ? void 0 : l.cluster) !== null && n !== void 0 ? n : "" });
        }
      }
      class Ju extends ot {
        constructor(r) {
          super(je.UNSUBSCRIBE, r.token, r.traceId, !0), Object.assign(this.properties, { action: me.SUBSCRIBE, remote_participant_id: r.unsubscribedId, unsubscribed_id: r.unsubscribedId });
        }
      }
      class Al extends ot {
        constructor(r) {
          var a, c, l, n;
          super(je.PUBLISH_STARTED, r.token, r.traceId, !1), Object.assign(this.properties, { action: me.PUBLISH, options_duration: r.optionsDuration, post_duration: r.postDuration, remote_participant_id: r.token.participantID, time_to_candidate: r.timeToCandidate, total_duration: r.totalDuration, edp_initial_connect_duration: r.edpInitialConnectDuration, edp_initial_connect_retry_times: r.edpInitialConnectRetries, edp_initial_state_duration: r.edpInitialStateDuration, edp_state_update_count: r.edpStateUpdateCount, sdp_exchange_duration: r.sdpExchangeDuration, sdp_exchange_transport: r.sdpExchangeTransport, set_remote_desc_duration: r.setRemoteDescDuration, peer_connection_duration: r.peerConnectionDuration, node: (c = (a = r.sfuResource) === null || a === void 0 ? void 0 : a.node) !== null && c !== void 0 ? c : "", cluster: (n = (l = r.sfuResource) === null || l === void 0 ? void 0 : l.cluster) !== null && n !== void 0 ? n : "", publish_retry_times: r.publishRetries, total_duration_with_retries: r.totalDurationWithRetries, protocol: r.protocol });
        }
      }
      class kl extends ot {
        constructor(r) {
          super(je.PUBLISH_FAILED, r.token, r.traceId, !1), Object.assign(this.properties, { action: me.PUBLISH, code: r.code, message: r.message, fatal: r.fatal, nominal: r.nominal, protocol: r.protocol });
        }
      }
      class Yu extends ot {
        constructor(r) {
          super(je.PUBLISH_ENDED, r.token, r.traceId, !0), Object.assign(this.properties, { action: me.PUBLISH, remote_participant_id: r.token.participantID, unpublish_successful: r.isUnpublishSuccessful, reason: r.reason, protocol: r.protocol });
        }
      }
      class Pl extends ot {
        constructor(r) {
          var a, c, l, n;
          super(je.SUBSCRIBE_STARTED, r.token, r.traceId, !1), Object.assign(this.properties, { action: me.SUBSCRIBE, options_duration: r.optionsDuration, post_duration: r.postDuration, remote_participant_id: r.remoteParticipantId, time_to_candidate: r.timeToCandidate, total_duration: r.totalDuration, edp_initial_connect_duration: r.edpInitialConnectDuration, edp_initial_connect_retry_times: r.edpInitialConnectRetries, edp_initial_state_duration: r.edpInitialStateDuration, edp_initial_state_publishing_count: r.edpInitialStatePublishingCount, edp_state_update_count: r.edpStateUpdateCount, sdp_exchange_duration: r.sdpExchangeDuration, sdp_exchange_transport: r.sdpExchangeTransport, set_remote_desc_duration: r.setRemoteDescDuration, peer_connection_duration: r.peerConnectionDuration, node: (c = (a = r.sfuResource) === null || a === void 0 ? void 0 : a.node) !== null && c !== void 0 ? c : "", cluster: (n = (l = r.sfuResource) === null || l === void 0 ? void 0 : l.cluster) !== null && n !== void 0 ? n : "", total_duration_with_retries: r.totalDurationWithRetries, subscribe_retry_times: r.subscribeRetryTimes, is_reassignment: r.isReassignment, protocol: r.protocol });
        }
      }
      class Dl extends ot {
        constructor(r) {
          super(je.SUBSCRIBE_FAILED, r.token, r.traceId, !1), Object.assign(this.properties, { action: me.SUBSCRIBE, remote_participant_id: r.remoteParticipantId, code: r.code, message: r.message, fatal: r.fatal, nominal: r.nominal, is_reassignment: r.isReassignment, protocol: r.protocol });
        }
      }
      class vu extends ot {
        constructor(r) {
          super(je.SUBSCRIBE_ENDED, r.token, r.traceId, !0), Object.assign(this.properties, { action: me.SUBSCRIBE, remote_participant_id: r.remoteParticipantId, unsubscribe_successful: r.isUnsubscribeSuccessful, reason: r.reason, protocol: r.protocol }), this.critical = !0;
        }
      }
      class Bs extends ot {
        constructor(r) {
          super(je.STATE_UPDATED, r.token, r.traceId, !1), Object.assign(this.properties, { audio_muted: r.isAudioMuted, is_disconnected: r.isDisconnected, is_publishing: r.isPublishing, other_participant_id: r.otherParticipantId, other_participant_user_id: r.otherParticipantUserId, video_stopped: r.isVideoStopped });
        }
      }
      class Dc extends ot {
        constructor(r) {
          var a, c, l, n, e;
          super(je.FIRST_FRAME, r.token, r.traceId, !1), Object.assign(this.properties, { action: me.SUBSCRIBE, remote_participant_id: r.remoteParticipantId, edp_initial_connect_duration: r.edpInitialConnectDuration, edp_initial_connect_retry_times: r.edpInitialConnectRetries, edp_initial_state_duration: r.edpInitialStateDuration, edp_initial_state_publishing_count: r.edpInitialStatePublishingCount, edp_state_update_count: r.edpStateUpdateCount, sdp_exchange_duration: r.sdpExchangeDuration, sdp_exchange_transport: r.sdpExchangeTransport, set_remote_desc_duration: r.setRemoteDescDuration, peer_connection_duration: r.peerConnectionDuration, node: (c = (a = r.sfuResource) === null || a === void 0 ? void 0 : a.node) !== null && c !== void 0 ? c : "", cluster: (n = (l = r.sfuResource) === null || l === void 0 ? void 0 : l.cluster) !== null && n !== void 0 ? n : "", video_was_paused: r.videoWasPaused, first_frame_duration: r.firstFrameDuration, total_duration_with_retries: r.totalDurationWithRetries, subscribe_retry_times: r.subscribeRetryTimes, media_type: r.mediaType, configured_jitter_buffer_min_delay_ms: (e = r.currentJitterBufferMinDelayInMs) !== null && e !== void 0 ? e : 0, protocol: r.protocol });
        }
      }
      class Nl extends ot {
        constructor(r) {
          super(je.EDP_PONG, r.token, r.traceId, !1), Object.assign(this.properties, { event_endpoint: r.eventEndpoint, protocol: r.protocol, edp_rtt: r.edpRttMs });
        }
      }
      class Ml extends ot {
        constructor(r) {
          super(je.JOIN, r.token, r.traceId, !1), Object.assign(this.properties, { action: me.JOIN, event_endpoint: r.eventEndpoint, whip_endpoint: r.whipEndpoint });
        }
      }
      class Ll extends ot {
        constructor(r) {
          super(je.JOIN_ATTEMPT, r.token, r.traceId, !1), Object.assign(this.properties, { action: me.JOIN, event_endpoint: r.eventEndpoint, whip_endpoint: r.whipEndpoint });
        }
      }
      class Qu extends ot {
        constructor(r) {
          super(je.JOIN_ATTEMPT_FAILED, r.token, r.traceId, !1), Object.assign(this.properties, { action: me.JOIN, event_endpoint: r.eventEndpoint, whip_endpoint: r.whipEndpoint, code: r.code, message: r.message, fatal: r.fatal, nominal: r.nominal, connect_retry_times: r.retryCnt });
        }
      }
      class _u extends ot {
        constructor(r) {
          super(je.EDP_DISCONNECTED, r.token, r.traceId, !1), Object.assign(this.properties, { event_endpoint: r.eventEndpoint, protocol: r.protocol }), this.critical = !0;
        }
      }
      class Xu extends ot {
        constructor(r) {
          super(je.EDP_CONNECTED, r.token, r.traceId, !1), Object.assign(this.properties, { event_endpoint: r.eventEndpoint, protocol: r.protocol, connect_retry_times: r.numRetries }), this.critical = !0;
        }
      }
      class xl {
        constructor(r, a, c) {
          this.token = r, this.analyticsTracker = c, this.protocol = "", this.connecting = !1, this.closing = !1, this.windowUnloading = !1, this.maxConnectRetries = 6, this.connectionAttempts = 0, this.latestSequenceNumber = 0, this.nextConnectionAttemptId = 0, this.connectTimeoutId = 0, this.latestPingTimestamp = 0, this.pingIntervalId = 0, this.pongTimeoutId = 0, this.pingIntervalMs = 15e3, this.pongTimeoutMs = 3e4, this.attemptConnect = (t) => {
            this.latestSequenceNumber = 0, this.traceId = t || Jn(), this.connectionAttempts++, this.trackJoinAttempt(this.connectionAttempts);
            const { topic: i, rawToken: o } = this.token;
            this.connecting = !0, this.closing = !1;
            try {
              const u = encodeURIComponent(this.traceId.value), d = `topic=${i}/publishers`, h = `traceid=${u}`, S = "error_over_ws=1", T = `${this.addr}?${S}&${d}&${h}`;
              this.socket = this.createWebSocket(T, o), this.socket.onmessage = this.onMessage.bind(this), this.socket.onerror = this.onError.bind(this), this.socket.onclose = this.onClose.bind(this), this.socket.onopen = this.onOpen.bind(this), this.protocol = this.socket.protocol;
            } catch (u) {
              const d = u instanceof Error ? u.message : void 0, h = this.createError(le.EVENT_PLANE_WS_CREATE_FAILED, d);
              this.trackJoinFailed(h, this.getRetryCount()), this.emitter.emit(ar, h);
            }
          }, this.triggerSocketOpen = (t) => {
            this.clearConnectionAttemptTimeouts();
            const i = this.getRetryCount();
            this.connectionAttempts = 0, this.connecting = !1, this.trackJoinStarted(i), this.emitter.emit(Ra, { retryCnt: i, traceId: this.traceId, initialStageState: t }), this.pingIntervalId = window.setInterval(this.ping, this.pingIntervalMs);
          }, this.ping = () => {
            var t;
            if (this.logger.debug({ msg: `${this.id}sending PING` }), !this.isSocketOpen()) {
              const i = `${this.id} attempting to ping an unopened socket`;
              return this.logger.warn({ msg: i }), void this.traceJoinOp(i);
            }
            this.latestPingTimestamp = performance.now(), this.pongTimeoutId === 0 && (this.pongTimeoutId = window.setTimeout(this.pongTimedOut, this.pongTimeoutMs)), (t = this.socket) === null || t === void 0 || t.send(JSON.stringify({ type: "PING" }));
          }, this.pongTimedOut = () => {
            if (!this.isSocketOpen()) {
              const i = `${this.id} attempting pong timeout on an unopened socket`;
              return this.logger.warn({ msg: i }), void this.traceJoinOp(i);
            }
            this.logger.debug({ msg: `${this.id} Pong timed out!` }), this.clearPingPongTracking();
            const t = this.createError(le.EVENT_PLANE_PONG_TIMEOUT);
            this.emitter.emit(ar, t);
          }, this.beforeUnload = () => {
            this.emitter.emit(wa, "beforeunload"), this.windowUnloading = !0;
          }, this.sendSdpOffer = (t, i, o, u, d, h, S, T) => {
            var I;
            const R = { type: "aws:ivs:SDP_OFFER", payload: { whipUrl: i, requestId: u, traceId: o, platform: "web", sdk: "1.28.0", whipVersion: co, content: t, contentType: "application/sdp" } };
            d && (R.payload.forceNode = d), h && (R.payload.assignmentToken = h), S && (R.payload.multiCodec = S);
            const w = ma() === void 0, P = ma() || w;
            T && P && (R.payload.initialLayerPref = ur(T)), (I = this.socket) === null || I === void 0 || I.send(JSON.stringify(R));
          }, this.checkNonFatalRetriesLimit = (t) => {
            if (t.fatal || this.connectionAttempts <= this.maxConnectRetries) return Re.ok(!0);
            this.logger.debug({ msg: `${this.id} maximum non-fatal retries of ${this.maxConnectRetries} exceeded` });
            const i = this.createError(le.JOIN_TIMED_OUT);
            return Re.err(i);
          }, this.getRetryCount = () => Math.max(this.connectionAttempts - 1, 0), this.trackSocketError = (t) => {
            this.connecting && this.trackJoinFailed(t, this.getRetryCount()), this.analyticsTracker.trackError(t);
          }, this.trackJoinEnded = () => {
            this.analyticsTracker.trackEventNoSharedProps(new _u({ token: this.token, eventEndpoint: this.token.eventsURL, traceId: this.traceId, protocol: this.protocol }));
          }, this.traceJoinOp = (t) => {
            this.analyticsTracker.trackEventNoSharedProps(new uo(this.token, this.traceId, t, me.JOIN));
          }, this.logger = new Ze(a, jt.SOCKET), this.emitter = new Cn.EventEmitter(), this.traceId = Jn(), this.id = `[${jo().value}] `;
          const l = gs("socketPingMs");
          l !== void 0 && (this.pingIntervalMs = l);
          const n = gs("socketPongMs");
          n !== void 0 && (this.pongTimeoutMs = n);
          const e = gs("socketConnectMaxRetries");
          e !== void 0 && (this.maxConnectRetries = e), window.addEventListener("beforeunload", this.beforeUnload);
        }
        connect(r, a, c = !1) {
          this.close(), this.logger.debug({ msg: `${this.id}connecting to ${this.addr}` }), this.addr = r, this.traceId = a, c && !this.connecting && (window.clearTimeout(this.connectTimeoutId), this.connectTimeoutId = window.setTimeout(this.connectTimedOut.bind(this), 12e3)), this.attemptConnect(a);
        }
        send(r) {
          var a;
          this.logger.debug({ msg: `${this.id}sending ${JSON.stringify(r)}` }), this.logger.debug({ msg: `${this.id}isReady called` }), this.isSocketOpen() ? (a = this.socket) === null || a === void 0 || a.send(JSON.stringify(r)) : this.logger.warn({ msg: "Trying to send data over stage socket that is not ready" });
        }
        close() {
          this.logger.debug({ msg: `${this.id}closing` });
          const r = this.connecting, a = this.isSocketOpen(), c = this.socket && this.socket.readyState === this.socket.CLOSING, l = this.getRetryCount();
          if (this.markSocketAsClosed(), this.clearPingPongTracking(), this.clearConnectionAttemptTimeouts(), this.connectionAttempts = 0, this.socket) {
            if (this.cleanupWebSocket(), a && this.isStateMessageReceived())
              this.trackJoinEnded(), this.emitter.emit(wa, "intentional-close");
            else if (r && !c) {
              const n = this.createError(le.OPERATION_ABORTED);
              this.trackJoinFailed(n, l), this.analyticsTracker.trackError(n), this.emitter.emit(ar, n);
            }
          }
        }
        markSocketAsClosed() {
          this.closing = !0, this.connecting = !1;
        }
        removeAllListeners() {
          window.removeEventListener("beforeunload", this.beforeUnload), this.emitter.removeAllListeners();
        }
        createWebSocket(r, a) {
          return new WebSocket(r, a);
        }
        cleanupWebSocket() {
          this.socket && (this.socket.close(), this.socket.onmessage = null, this.socket.onerror = null, this.socket.onclose = null, this.socket.onopen = null, this.socket = void 0);
        }
        createError(r, a) {
          return new $e(Object.assign({ action: me.JOIN, traceId: this.traceId, token: this.token, location: "StageSocket.connection", tag: si, details: a }, r));
        }
        on(r, a) {
          this.emitter.on(r, a);
        }
        off(r, a) {
          this.emitter.off(r, a);
        }
        onMessage(r) {
          this.logger.debug({ msg: `${this.id}received message: ${r.data}` });
          try {
            const a = JSON.parse(r.data);
            switch (a.type) {
              case "STAGE_STATE":
              case "aws:ivs:STAGE_STATE": {
                const c = a.payload.sequenceNumber;
                c > this.latestSequenceNumber && (this.latestSequenceNumber === 0 && this.connectTimeoutId > 0 ? (this.triggerSocketOpen(a), window.setTimeout(() => {
                  this.emitter.emit(sr, a);
                })) : this.emitter.emit(sr, a), this.latestSequenceNumber = c);
                break;
              }
              case "PONG":
                window.clearTimeout(this.pongTimeoutId), this.pongTimeoutId = 0, this.analyticsTracker.trackEventNoSharedProps(new Nl({ token: this.token, eventEndpoint: this.token.eventsURL, protocol: this.protocol, traceId: this.traceId, edpRttMs: performance.now() - this.latestPingTimestamp }));
                break;
              case "REFRESH":
                this.emitter.emit(Oa);
                break;
              case "aws:ivs:SDP_ANSWER":
                this.emitter.emit(Rs, a.payload);
                break;
              case "aws:ivs:DISCONNECT":
                this.emitter.emit(Nt, a.payload);
                break;
              case "aws:ivs:REASSIGN":
                this.emitter.emit(Aa, a.payload);
                break;
              case "aws:ivs:INCOMPATIBLE_CODECS":
                this.emitter.emit(Fu, a.payload);
                break;
              case "aws:ivs:SSU":
                this.emitter.emit(Vu, a.payload);
                break;
              case "aws:ivs:JOIN_ERROR":
                this.handleJoinError(a.payload);
                break;
              default:
                (0, zt.noop)();
            }
          } catch (a) {
            this.logger.debug({ msg: `onMessage JSON Parse error: ${a}` }), this.emitter.emit(wn, a);
          }
        }
        onError(r) {
          this.logger.debug({ msg: `${this.id}error: ${JSON.stringify(r)}` });
        }
        onClose(r) {
          if (this.logger.debug({ msg: `${this.id} onClose triggered with code (closing = ${this.closing}, connecting = ${this.connecting})` }), this.clearPingPongTracking(), this.closing) return void (this.closing = !1);
          if (this.windowUnloading) return;
          const a = `code: ${r == null ? void 0 : r.code}, reason: ${r == null ? void 0 : r.reason}, wasClean: ${r == null ? void 0 : r.wasClean}`;
          if (this.connecting) {
            const l = this.createError(le.EVENT_PLANE_WS_CLOSE_BEFORE_OPEN, a);
            return void this.handleSocketError(l);
          }
          this.logger.debug({ msg: `${this.id}unexpected close` }), this.emitter.emit(wa, "unknown");
          const c = this.createError(le.EVENT_PLANE_WS_UNEXPECTED_CLOSE, a);
          this.trackJoinEnded(), this.emitter.emit(ar, c);
        }
        onOpen() {
          this.logger.debug({ msg: `${this.id} socket opened` }), this.clearConnectionAttemptTimeouts(), this.connectTimeoutId = window.setTimeout(this.triggerSocketOpen, 12e3);
        }
        clearConnectionAttemptTimeouts() {
          window.clearTimeout(this.nextConnectionAttemptId), window.clearTimeout(this.connectTimeoutId), this.nextConnectionAttemptId = 0, this.connectTimeoutId = 0;
        }
        clearConnectionAttempts() {
          this.connectionAttempts = 0;
        }
        connectTimedOut() {
          this.connecting = !1, this.logger.debug({ msg: `${this.id} Connect timed out!` });
          const r = this.createError(le.JOIN_TIMED_OUT);
          this.isSocketConnecting() && this.trackJoinFailed(r, this.getRetryCount()), this.emitter.emit(ar, r), this.close();
        }
        clearPingPongTracking() {
          window.clearInterval(this.pingIntervalId), window.clearTimeout(this.pongTimeoutId), this.pingIntervalId = 0, this.pongTimeoutId = 0;
        }
        handleJoinError(r) {
          const a = function(l) {
            var n, e;
            let t;
            switch (l.code) {
              case Yn.TOKEN_EXPIRED:
                t = le.EXPIRED_TOKEN;
                break;
              case Yn.TOKEN_INVALID:
              case Yn.TOKEN_INVALID_SIGNATURE:
              case Yn.TOKEN_MISSING:
                t = le.MALFORMED_TOKEN;
                break;
              case Yn.STAGE_DELETED:
                t = le.STAGE_DELETED;
                break;
              case Yn.PARTICIPANT_DISCONNECTED:
                t = le.PARTICIPANT_DISCONNECTED;
                break;
              case Yn.INTERNAL:
                t = le.JOIN_SERVER_INTERNAL_ERROR;
                break;
              case Yn.BAD_REQUEST:
                t = le.JOIN_SERVER_BAD_REQUEST;
                break;
              default:
                t = Object.assign(Object.assign({}, le.JOIN_FAILURE), { message: l.message || le.JOIN_FAILURE.message });
            }
            return Object.assign(Object.assign({}, t), { fatal: (n = l.fatal) !== null && n !== void 0 ? n : t.fatal, nominal: (e = l.nominal) !== null && e !== void 0 ? e : t.nominal });
          }(r), c = this.createError(a, `JOIN_ERROR: ${r.code}`);
          this.logger.debug({ msg: `${this.id} received JOIN_ERROR: ${JSON.stringify(r)}` }), this.handleSocketError(c);
        }
        handleSocketError(r) {
          const a = this.checkNonFatalRetriesLimit(r);
          let c = r;
          a.ok || (c = a.error, c.details = `Timeout triggered by ${r.code}`), this.trackSocketError(c), this.markSocketAsClosed(), this.clearPingPongTracking(), this.clearConnectionAttemptTimeouts(), this.cleanupWebSocket(), c.fatal ? (this.clearConnectionAttempts(), this.emitter.emit(ar, c)) : this.queueExponentialBackoffRetry();
        }
        queueExponentialBackoffRetry() {
          let r = Math.pow(2, this.connectionAttempts - 1);
          r > 32 && (r = 32), this.logger.debug({ msg: `${this.id} reconnecting in ${r} seconds` }), window.clearTimeout(this.nextConnectionAttemptId), this.nextConnectionAttemptId = window.setTimeout(this.attemptConnect, 1e3 * r);
        }
        isSocketConnecting() {
          return this.socket && this.socket.readyState === this.socket.CONNECTING;
        }
        isSocketOpen() {
          return this.socket && this.socket.readyState === this.socket.OPEN;
        }
        isStateMessageReceived() {
          return this.latestSequenceNumber !== 0;
        }
        trackJoinStarted(r) {
          this.analyticsTracker.trackEventNoSharedProps(new Xu({ token: this.token, eventEndpoint: this.token.eventsURL, numRetries: r, protocol: this.protocol, traceId: this.traceId }));
        }
        trackJoinAttempt(r) {
          const { token: a, traceId: c } = this;
          this.analyticsTracker.trackEvent(new Ll({ token: a, eventEndpoint: (a == null ? void 0 : a.eventsURL) || "", whipEndpoint: (a == null ? void 0 : a.whipURL) || "", traceId: c }));
        }
        trackJoinFailed(r, a) {
          const { token: c, traceId: l, code: n, message: e, fatal: t, nominal: i } = r;
          this.analyticsTracker.trackEvent(new Qu({ token: c, eventEndpoint: c.eventsURL, whipEndpoint: c.whipURL, traceId: l, code: n, message: e, fatal: t, nominal: i, retryCnt: a }));
        }
      }
      var Zu = function(s, r, a, c) {
        return new (a || (a = Promise))(function(l, n) {
          function e(o) {
            try {
              i(c.next(o));
            } catch (u) {
              n(u);
            }
          }
          function t(o) {
            try {
              i(c.throw(o));
            } catch (u) {
              n(u);
            }
          }
          function i(o) {
            var u;
            o.done ? l(o.value) : (u = o.value, u instanceof a ? u : new a(function(d) {
              d(u);
            })).then(e, t);
          }
          i((c = c.apply(s, [])).next());
        });
      }, Zo, Gn, Jr, Mt;
      (function(s) {
        s.SDP_EXCHANGE = "xdp", s.JITTER_BUFFER_MIN_DELAY_MS = "jit_buf_min_delay_ms";
      })(Zo || (Zo = {})), function(s) {
        s.USER_INITIATED = "user-initiated", s.CLIENT_RECONNECT = "reconnect", s.TOKEN_REUSED = "token-reused", s.UNKNOWN = "unknown", s.PARTICIPANT_DISCONNECTED = "participant-disconnected", s.STAGE_DELETED = "stage-deleted", s.TOKEN_EXPIRED = "token-expired";
      }(Gn || (Gn = {})), function(s) {
        s[s.NOT_CONNECTED = 0] = "NOT_CONNECTED", s[s.CONNECTION_LOST = 1] = "CONNECTION_LOST", s[s.TIMEDOUT = 2] = "TIMEDOUT", s[s.ABORTED = 3] = "ABORTED", s[s.INVALID_MESSAGE = 4] = "INVALID_MESSAGE", s[s.UNEXPECTED_ERROR = 5] = "UNEXPECTED_ERROR";
      }(Jr || (Jr = {})), function(s) {
        s.DISCONNECTED = "disconnected", s.CONNECTING = "connecting", s.CONNECTED = "connected", s.ERRORED = "errored";
      }(Mt || (Mt = {}));
      class Us extends lt {
        constructor(r, a, c) {
          super(), this.token = r, this.nonScopedLogger = a, this.analyticsTracker = c, this.participants = /* @__PURE__ */ new Map(), this.disconnected = [], this.state = { value: Mt.DISCONNECTED, context: { connectStartTime: 0, hasConnected: !1 } }, this.features = { sdpExchange: !1 }, this.stats = this.resetStats(), this.stageMinutesLogged = 0, this.isStagePublishing = !1, this.onConnecting = (l, n) => {
            this.logger.debug({ msg: "onConnecting", context: l, event: n }), l.connectStartTime = performance.now();
            const e = n.type === "RECONNECT";
            e && this.stageSocket.close();
            const { eventsURL: t } = this.token;
            this.emit(_n, Mt.CONNECTING), this.state.value = Mt.CONNECTING;
            const i = !e;
            this.stageSocket.connect(t, this.traceId, i);
          }, this.onConnected = (l, n) => {
            this.logger.debug({ msg: "onConnected", context: l, event: n }), l.hasConnected = !0, this.emit(Il), this.emit(_n, Mt.CONNECTED), this.state.value = Mt.CONNECTED;
          }, this.onDisconnected = (l, n) => {
            this.logger.debug({ msg: "onDisconnected", context: l }), this.state.value = Mt.DISCONNECTED, this.stopStageMinuteLoggedInterval(!0), this.stageSocket.close(), l.hasConnected = !1, this.participants = /* @__PURE__ */ new Map(), this.disconnected = [], this.stageSocket.removeAllListeners(), this.resetStats(), this.emit(_n, Mt.DISCONNECTED, n);
          }, this.onErrored = (l, n) => {
            var e;
            this.logger.error({ msg: "Connection failure occurred", err: n.payload.error }), this.emit(_n, Mt.ERRORED), this.emit(Ia, n.payload.error), this.state.value = Mt.ERRORED;
            const t = n.payload.error;
            if (t instanceof $e && t.fatal && (!((e = t.details) === null || e === void 0) && e.includes("JOIN_ERROR")) && l.hasConnected) {
              const i = this.mapJoinErrorCodeToDisconnectReason(t);
              this.processStateUpdate({ type: "DISCONNECT", reason: i });
            } else l.hasConnected ? this.processStateUpdate({ type: "RECONNECT" }) : this.stageSocket.close();
          }, this.processStateUpdate = (l) => {
            const n = this.state.value, e = this.state.context;
            switch (n) {
              case Mt.DISCONNECTED:
                l.type === "CONNECT" && this.onConnecting(e, l);
                break;
              case Mt.CONNECTING:
                l.type === "RECONNECT" ? this.onConnecting(e, l) : l.type === "DISCONNECT" ? this.onDisconnected(e, l.reason) : l.type === "CONNECT_SUCCESS" ? this.onConnected(e, l) : l.type === "ERROR" && this.onErrored(e, l);
                break;
              case Mt.CONNECTED:
                l.type === "RECONNECT" ? this.onConnecting(e, l) : l.type === "DISCONNECT" ? this.onDisconnected(e, l.reason) : l.type === "ERROR" && this.onErrored(e, l);
                break;
              case Mt.ERRORED:
                l.type === "RECONNECT" ? this.onConnecting(e, l) : l.type === "DISCONNECT" && this.onDisconnected(e, l.reason);
            }
          }, this.measureConnect = (l, n) => {
            const e = this.stats.edpConnectCount, t = e + 1, i = performance.now(), o = i - n;
            return Object.assign(this.stats, { edpConnectCount: t, edpConnectDuration: o }), e === 0 && Object.assign(this.stats, { edpInitialStartConnectTime: n, edpInitialFinishConnectTime: i, edpInitialConnectDuration: o, edpInitialConnectRetries: l }), this.stats;
          }, this.measureStateUpdate = (l) => {
            const { edpInitialFinishConnectTime: n } = this.stats, e = this.stats.edpStateUpdateCount, t = e + 1;
            return Object.assign(this.stats, { edpStateUpdateCount: t }), e === 0 && Object.assign(this.stats, { edpInitialStateDuration: performance.now() - n, edpInitialStatePublishingCount: l }), this.stats;
          }, this.trackMessageParseError = (l) => {
            this.logger.error({ msg: "Message Parse Error occurred", err: l.err });
            const n = new $e({ token: l.token, traceId: l.traceId, code: le.WEBSOCKET_MESSAGE_PARSE_FAILURE.code, tag: l.tag, location: l.location, message: l.message, details: l.err.message });
            this.analyticsTracker.trackEvent(new eo(n));
          }, this.trackStageSocketMessageParseError = (l, n, e) => {
            this.trackMessageParseError({ token: l, traceId: n, tag: si, location: "StageConnection.onMessage", message: le.WEBSOCKET_MESSAGE_PARSE_FAILURE.message, err: e });
          }, this.trackStageStateMessageParseError = (l, n, e, t) => {
            this.trackMessageParseError({ token: l, traceId: n, tag: si, location: "StageConnection.onStageStateMessage", message: t, err: e });
          }, this.onDisconnectMessage = (l) => {
            this.analyticsTracker.trackEventNoSharedProps(new uo(this.token, this.traceId, `DISCONNECT message received: ${l.code}:${l.reason}`, me.JOIN));
            let n = Gn.UNKNOWN;
            if (l.code === "PARTICIPANT_DISCONNECTED") n = Gn.PARTICIPANT_DISCONNECTED;
            else if (l.code === "STAGE_DELETED") n = Gn.STAGE_DELETED;
            else if (l.code === "TOKEN_REUSED" && (n = Gn.TOKEN_REUSED, ln("disableTokenReuseMessage"))) return void console.warn("Token reuse is detected, but skipping as feature is disabled");
            console.warn(`Disconnecting client due to: ${l.reason}`), this.processStateUpdate({ type: "DISCONNECT", reason: n });
          }, this.onReassignmentMessage = (l) => {
            this.emit(_r, l);
          }, this.onIncompatibleCodecsMessage = (l) => {
            this.emit(an, l);
          }, this.onSsuMessage = (l) => {
            var n;
            const e = window.atob((n = l.A) !== null && n !== void 0 ? n : "").trim();
            e && e.startsWith("http") ? nr.currentEndpoint = e : this.logger.warn({ msg: "SSU Url invalid" });
          }, this.onStageStateMessage = (l, n, e) => {
            var t, i;
            this.logger.debug({ msg: "State Stage Message occurred", state: e });
            const o = e.payload, u = (t = o.participants) !== null && t !== void 0 ? t : [], d = (i = o.disconnected) !== null && i !== void 0 ? i : [], h = [], S = [];
            this.measureStateUpdate(u.length), this.enableFeaturesBasedOnServerFeatures(o.serverFeatures || []);
            const T = (I, R) => {
              this.analyticsTracker.trackEventNoSharedProps(new Bs({ token: l, otherParticipantId: I.id, otherParticipantUserId: I.userId, isAudioMuted: I.audioMuted, isVideoStopped: I.videoStopped, isPublishing: I.isPublishing, isDisconnected: R, traceId: n }));
            };
            this.participants.forEach((I) => {
              const R = u.find((w) => w.id === I.id);
              if (R) {
                let w = !0, P = !1;
                ["isPublishing", "id", "audioMuted", "joinedAt", "userId", "videoStopped"].forEach((B) => {
                  w = w && R[B.toString()] === I[B.toString()], w || (I[B.toString()] = R[B.toString()], P = !0);
                }), Object.keys(I.attributes).forEach((B) => {
                  w = w && R.attributes[B] === I.attributes[B], w || (I.attributes = R.attributes, P = !0);
                }), P && (T(I, !1), this.emit(yi, R));
              } else S.push(I);
            }), u.forEach((I) => {
              this.participants.get(I.id) || h.push(I);
            }), S.forEach((I) => {
              this.participants.delete(I.id), T(I, !0), this.emit(ao, I);
            }), h.forEach((I) => {
              this.participants.set(I.id, I), T(I, !1), this.emit(cc, I);
            }), d.forEach((I) => {
              this.disconnected.find((R) => R.id === I.id) || (this.disconnected.push(I), I.status === "KICKED" && this.emit(ci, I));
            }), this.disconnected = d;
          }, this.nonScopedLogger = a, this.logger = new Ze(a, jt.CONNECTION), this.stageSocket = new xl(r, this.nonScopedLogger, c), this.token = r, this.traceId = Jn();
        }
        resetStats() {
          return this.stats = { isConnected: !1, edpInitialStartConnectTime: 0, edpInitialFinishConnectTime: 0, edpConnectCount: 0, edpInitialConnectDuration: 0, edpConnectDuration: 0, edpInitialStateDuration: 0, edpInitialStatePublishingCount: 0, edpStateUpdateCount: 0, edpInitialConnectRetries: 0 }, this.stats;
        }
        connect(r) {
          return Zu(this, void 0, void 0, function* () {
            return this.logger.debug({ msg: "connect invoked", token: this.token, traceId: r }), this.traceId = r, this.state.value !== Mt.DISCONNECTED && (this.logger.debug({ msg: "Disconnecting previous connection" }), this.processStateUpdate({ type: "DISCONNECT", reason: Gn.CLIENT_RECONNECT })), new Promise((a, c) => {
              this.stageSocket.on(Ra, (l) => {
                var n, e;
                const { retryCnt: t, initialStageState: i } = l;
                i && this.enableFeaturesBasedOnServerFeatures((e = (n = i.payload) === null || n === void 0 ? void 0 : n.serverFeatures) !== null && e !== void 0 ? e : []), this.traceId = l.traceId || Jn(), this.measureConnect(t, this.state.context.connectStartTime), this.processStateUpdate({ type: "CONNECT_SUCCESS" }), this.startStageMinuteLoggedInterval(this.token, this.traceId), a(this.traceId);
              }), this.stageSocket.on(ar, (l) => {
                c(l), this.processStateUpdate({ type: "ERROR", payload: { error: l } });
              }), this.stageSocket.on(Oa, () => {
                this.logger.debug({ msg: "Refresh event occurred" }), this.emit(ou), this.processStateUpdate({ type: "RECONNECT" });
              }), this.stageSocket.on(sr, (l) => this.onStageStateMessage(this.token, this.traceId, l)), this.stageSocket.on(wn, (l) => this.trackStageSocketMessageParseError(this.token, this.traceId, l)), this.stageSocket.on(Nt, this.onDisconnectMessage), this.stageSocket.on(Aa, this.onReassignmentMessage), this.stageSocket.on(Fu, this.onIncompatibleCodecsMessage), this.stageSocket.on(Vu, this.onSsuMessage), this.stageSocket.on(wa, (l) => {
                this.stopStageMinuteLoggedInterval();
              }), this.processStateUpdate({ type: "CONNECT", payload: { token: this.token, traceId: r } });
            });
          });
        }
        disconnect() {
          return this.logger.debug({ msg: "disconnect invoked" }), this.processStateUpdate({ type: "DISCONNECT", reason: Gn.USER_INITIATED }), this.traceId;
        }
        getParticipant(r) {
          return this.participants.get(r);
        }
        listConnectedParticipants() {
          const r = [];
          return this.participants.forEach((a) => {
            a.subscribed && r.push(a);
          }), r;
        }
        listAvailableParticipants() {
          return Array.from(this.participants.values());
        }
        emitStageState(r, a) {
          this.stageSocket.send({ audioMuted: r, type: "SET_STATE", version: "0", videoStopped: a });
        }
        setStagePublishing(r) {
          this.isStagePublishing = r, this.emit(iu, this.isStagePublishing);
        }
        getIsStagePublishing() {
          return this.isStagePublishing;
        }
        startStageMinuteLoggedInterval(r, a) {
          this.uploadStageMinutesBroadcastInterval || (this.analyticsTracker.trackEvent(new Ku(r, a, this.stageMinutesLogged, this.isStagePublishing, 0)), this.stageMinutesLogged++, this.uploadStageMinutesBroadcastInterval = setInterval(() => {
            this.analyticsTracker.trackEvent(new Ku(r, a ?? Jn(), this.stageMinutesLogged, this.isStagePublishing, 0)), this.stageMinutesLogged++;
          }, 6e4));
        }
        stopStageMinuteLoggedInterval(r = !1) {
          this.uploadStageMinutesBroadcastInterval && (clearInterval(this.uploadStageMinutesBroadcastInterval), this.uploadStageMinutesBroadcastInterval = void 0), r && (this.stageMinutesLogged = 0);
        }
        enableFeaturesBasedOnServerFeatures(r) {
          const a = (e, t) => {
            this.trackStageStateMessageParseError(this.token, this.traceId, t, `Could not parse "${e}" from the Eevee server features list`);
          }, c = r.includes(Zo.SDP_EXCHANGE);
          this.features.sdpExchange !== c && (this.logger.debug({ msg: `XDP SDP exchange feature toggled: ${c}` }), this.features.sdpExchange = c);
          const l = r.find((e) => e.indexOf(Zo.JITTER_BUFFER_MIN_DELAY_MS) !== -1), n = (e) => {
            this.logger.debug({ msg: `jitterBufferMinDelay feature updated to: ${e}` }), this.features.jitterBufferMinDelayInMs = e;
          };
          if (l !== void 0) try {
            const e = l.split("=")[1], t = parseInt(e, 10);
            if (isNaN(t)) throw new Error("Unable to parse - result is NaN");
            if (t < 0) throw new Error("Unable to apply - result is negative");
            this.features.jitterBufferMinDelayInMs !== void 0 && this.features.jitterBufferMinDelayInMs === t || n(t);
          } catch (e) {
            a(l, e), n(void 0);
          }
          else n(void 0);
        }
        mapJoinErrorCodeToDisconnectReason(r) {
          switch (r.code) {
            case le.PARTICIPANT_DISCONNECTED.code:
              return Gn.PARTICIPANT_DISCONNECTED;
            case le.STAGE_DELETED.code:
              return Gn.STAGE_DELETED;
            case le.EXPIRED_TOKEN.code:
              return Gn.TOKEN_EXPIRED;
            default:
              return Gn.UNKNOWN;
          }
        }
        isConnected() {
          return this.state.value === Mt.CONNECTED;
        }
        supportsSdpExchange() {
          return this.features.sdpExchange;
        }
        jitterBufferMinDelayInMs() {
          return this.features.jitterBufferMinDelayInMs;
        }
        getConnectionStats() {
          return Object.assign({}, this.stats, { isConnected: this.isConnected() });
        }
        exchangeSdp(r, a, c, l, n, e, t, i, o) {
          return Zu(this, void 0, void 0, function* () {
            return this.isConnected() ? new Promise((u, d) => {
              const h = window.setTimeout(() => {
                S(), d(Jr.TIMEDOUT);
              }, 12e3), S = () => {
                window.clearTimeout(h), this.stageSocket.off(Rs, T), this.stageSocket.off(ar, I);
              }, T = (R) => {
                R.requestId === l && (S(), u(R));
              }, I = () => {
                S(), d(Jr.CONNECTION_LOST);
              };
              n == null || n.addEventListener("abort", () => {
                S(), d(Jr.ABORTED);
              }), this.stageSocket.on(Rs, T), this.stageSocket.on(ar, I), this.stageSocket.sendSdpOffer(r, a, c, l, e, t, i, o);
            }) : Promise.reject(Jr.NOT_CONNECTED);
          });
        }
      }
      class Nc {
        constructor(r) {
          this.token = r;
        }
      }
      const Mc = new RegExp("^(?:[a-z+]+:)?//", "i");
      function js(s) {
        return Mc.test(s);
      }
      function Lc({ sdpExchangeTransport: s, serverHttpResponse: r, serverErrorCode: a }) {
        return `sdpExchangeTransport: ${s}, serverHttpResponse: ${r}, serverErrorCode: ${a}`;
      }
      var el = function(s, r, a, c) {
        return new (a || (a = Promise))(function(l, n) {
          function e(o) {
            try {
              i(c.next(o));
            } catch (u) {
              n(u);
            }
          }
          function t(o) {
            try {
              i(c.throw(o));
            } catch (u) {
              n(u);
            }
          }
          function i(o) {
            var u;
            o.done ? l(o.value) : (u = o.value, u instanceof a ? u : new a(function(d) {
              d(u);
            })).then(e, t);
          }
          i((c = c.apply(s, [])).next());
        });
      };
      const Bl = { [Jr.ABORTED]: le.OPERATION_ABORTED, [Jr.NOT_CONNECTED]: le.EVENT_PLANE_WS_UNEXPECTED_CLOSE, [Jr.CONNECTION_LOST]: le.XDP_CONNECTION_LOST, [Jr.TIMEDOUT]: le.XDP_TIMEOUT, [Jr.INVALID_MESSAGE]: le.XDP_INVALID_ANSWER_MSG, [Jr.UNEXPECTED_ERROR]: le.XDP_UNEXPECTED_ERROR };
      class xc extends Nc {
        constructor(r, a, c, l) {
          super(r), this.token = r, this.stageConnection = a, this.contextData = c, this.analyticsTracker = l;
        }
        exchange(r) {
          return el(this, void 0, void 0, function* () {
            const a = jo(), { action: c } = this.contextData, { sdpOffer: l, url: n, traceId: e, forceNode: t, assignmentToken: i, multiCodec: o, abortController: u, initialLayerPreference: d } = r;
            let h;
            this.trackAttempt(n, a, e);
            try {
              h = yield this.stageConnection.exchangeSdp(l, n, e.value, a.value, u == null ? void 0 : u.signal, t, i, o, d);
            } catch (j) {
              if (typeof j == "number") throw this.createClientSideErrorFromReasonCode(j, e, a, c);
            }
            if (!h) return;
            const { httpStatusCode: S, errorCode: T, location: I, content: R, sessionDeleteLink: w, subscriberControlLink: P, videoLayersLink: B } = h;
            if (S >= 200 && S < 300) return { sdpAnswer: R, url: n, location: I, sessionDeleteLink: w, mediaControls: P, layerControls: B };
            throw this.createServerSideError(e, a, S, T, c);
          });
        }
        trackAttempt(r, a, c) {
          const { remoteParticipantId: l, action: n } = this.contextData;
          this.analyticsTracker.trackEventNoSharedProps(new hc(n, this.token, r, "POST", a.value, l, c, "xdp"));
        }
        createServerSideError(r, a, c, l, n) {
          const e = this.baseErrorProps(r, a);
          let t = vr(c, l);
          return t || (t = le.UNKNOWN_SERVER_ERROR), new $e(Object.assign(Object.assign(Object.assign({ action: n }, e), t), { details: Lc({ sdpExchangeTransport: "xdp", serverHttpResponse: c, serverErrorCode: l }) }));
        }
        baseErrorProps(r, a) {
          const { remoteParticipantId: c, action: l } = this.contextData;
          return { token: this.token, traceId: r, tag: kt(l, c), location: "EdpSdpExchanger.exchange", requestUUID: a, remoteParticipantId: c };
        }
        createClientSideErrorFromReasonCode(r, a, c, l) {
          const n = this.baseErrorProps(a, c), e = Bl[r];
          return new $e(e ? Object.assign(Object.assign({ action: l }, n), e) : Object.assign(Object.assign({ action: l }, n), le.XDP_INVALID_ANSWER_MSG));
        }
        getTransport() {
          return "sdp";
        }
      }
      var ea = function(s, r, a, c) {
        return new (a || (a = Promise))(function(l, n) {
          function e(o) {
            try {
              i(c.next(o));
            } catch (u) {
              n(u);
            }
          }
          function t(o) {
            try {
              i(c.throw(o));
            } catch (u) {
              n(u);
            }
          }
          function i(o) {
            var u;
            o.done ? l(o.value) : (u = o.value, u instanceof a ? u : new a(function(d) {
              d(u);
            })).then(e, t);
          }
          i((c = c.apply(s, [])).next());
        });
      };
      class Bc extends Nc {
        constructor(r, a, c) {
          super(r), this.contextData = a, this.analyticsTracker = c;
        }
        exchange(r) {
          var a, c, l;
          return ea(this, void 0, void 0, function* () {
            const n = jo(), { token: e } = this, { action: t, remoteParticipantId: i } = this.contextData, { sdpOffer: o, url: u, traceId: d, forceNode: h, assignmentToken: S, multiCodec: T, abortController: I, initialLayerPreference: R } = r;
            try {
              const P = "POST", B = "http";
              this.analyticsTracker.trackEventNoSharedProps(new hc(t, e, u, P, n.value, i, d, B));
              const j = { data: o, headers: { Authorization: `Bearer ${e.rawToken}`, "Content-Type": "application/sdp", "X-Stages-Platform": "web", "X-Stages-Request-ID": n.value, "X-Stages-SDK": "1.28.0", "X-Stages-Session-ID": this.analyticsTracker.getSessionId(), "X-Stages-Trace-ID": d.value, "X-Stages-WHIP-Version": co, [ji]: (w = JSON.stringify({ [Fi]: ["sau"] }), btoa(w).replace(/[^A-Za-z0-9+/]/g, "")) }, method: P, responseType: "text", url: u, signal: I == null ? void 0 : I.signal, params: {} };
              h && (j.params.force_node = h), S && (j.params.assignment_token = S), T && (j.params.multi_codec = !0);
              const x = ma() === void 0, H = ma() || x;
              R && j.headers && H && (j.headers["X-Stages-Initial-Layer-Pref"] = ur(R));
              const { data: K, headers: Q, request: ie } = yield su(j), ce = this.parseWhipResource(u, Q.location, Q.link);
              return { url: ie.responseURL, sdpAnswer: K, location: ce == null ? void 0 : ce.location, sessionDeleteLink: ce == null ? void 0 : ce.sessionDeleteLink, mediaControls: ce == null ? void 0 : ce.mediaControls, layerControls: ce == null ? void 0 : ce.layerControls };
            } catch (P) {
              if (g().isCancel(P))
                throw new $e(Object.assign(Object.assign({}, hn(le.OPERATION_ABORTED, P)), { action: t, token: e, traceId: d, tag: kt(t, i), location: "StagePeerClient.start", requestUUID: n, remoteParticipantId: i }));
              const B = Number((a = P == null ? void 0 : P.response) === null || a === void 0 ? void 0 : a.status) || -1, j = ((l = (c = P == null ? void 0 : P.response) === null || c === void 0 ? void 0 : c.data) === null || l === void 0 ? void 0 : l.code) || -1, x = function(H, K) {
                var Q;
                return H instanceof oo.AxiosError && H.response && typeof H.response.status == "number" ? H instanceof oo.AxiosError && H.code === "ERR_NETWORK" ? le.NETWORK_FAILURE : vr(Number(H.response.status), (Q = H.response.data) === null || Q === void 0 ? void 0 : Q.code) || K : K;
              }(P, le.WHIP_POST_FAILURE);
              throw new $e(Object.assign(Object.assign({}, hn(x, P)), { action: t, token: e, traceId: d, tag: kt(t, i), details: Lc({ sdpExchangeTransport: "http", serverHttpResponse: B, serverErrorCode: j }), location: "StagePeerClient.start", requestUUID: n, remoteParticipantId: i }));
            }
            var w;
          });
        }
        parseWhipResource(r, a, c) {
          const l = new URL(r);
          let n;
          return n = function(e, t, i) {
            if (!i) return e;
            if (e || (e = {}), js(i)) return e.location = i, e;
            const o = t.port ? `:${t.port}` : "";
            return e.location = `${t.protocol}//${t.hostname}${o}${i}`, e;
          }(n, l, a), n = function(e, t, i) {
            if (!i) return e;
            e || (e = {});
            const o = e;
            return i.split(",").forEach((u) => {
              const d = /<(.+)>;\s?rel="([a-z:-]+)"/.exec(u);
              if ((d == null ? void 0 : d.length) !== 3) return;
              let h;
              if (js(d[1])) h = d[1];
              else {
                const S = t.port ? `:${t.port}` : "";
                h = `${t.protocol}//${t.hostname}${S}${d[1]}`;
              }
              switch (d[2]) {
                case "urn:ietf:params:whip:ivs-stages:session-delete":
                  o.sessionDeleteLink = h;
                  break;
                case "urn:ietf:params:whep:core:playback-controls":
                  o.mediaControls = h;
                  break;
                case "urn:ietf:params:whep:ext:core:layer":
                  o.layerControls = h;
                  break;
                default:
                  return;
              }
            }), o;
          }(n, l, c), n;
        }
        getTransport() {
          return "http";
        }
      }
      function Su(s) {
        const { connection: r, token: a, action: c, identifier: l, tracker: n } = s, e = r && r.supportsSdpExchange() && r.isConnected(), t = c === me.SUBSCRIBE && e && !ec() && !ln("disableXdpSubscribe"), i = c === me.PUBLISH && e && !ec() && !ln("disableXdpPublish");
        return t || i ? new xc(a, r, { action: c, remoteParticipantId: l }, n) : new Bc(a, { action: c, remoteParticipantId: l }, n);
      }
      function $a({ stageErrorValue: s, action: r, token: a, traceId: c, tag: l, identifier: n, details: e }) {
        return new $e(Object.assign(Object.assign({}, s), { token: a, traceId: c, location: "peer-client", tag: l, action: r, remoteParticipantId: n, details: e }));
      }
      var Wn;
      function Yr(s) {
        var r;
        return !((r = s == null ? void 0 : s.sender) === null || r === void 0) && r.createEncodedStreams ? Wn.INSERTABLE_STREAMS : window.RTCRtpSender && "transform" in RTCRtpSender.prototype && window.RTCRtpScriptTransform ? Wn.ENCODED_TRANSFORMS : Wn.NONE;
      }
      function Qr(s) {
        var r;
        return !((r = s == null ? void 0 : s.receiver) === null || r === void 0) && r.createEncodedStreams ? Wn.INSERTABLE_STREAMS : window.RTCRtpReceiver && "transform" in RTCRtpReceiver.prototype && window.RTCRtpScriptTransform ? Wn.ENCODED_TRANSFORMS : Wn.NONE;
      }
      function Ul() {
        return Ta()(`/*! For license information please see transform.worker.worker.js.LICENSE.txt */
(()=>{"use strict";const e=new Uint8Array([158,80,78,165,238,90,79,2,148,159,176,51,163,118,141,162]);var t;!function(e){e.VIDEO_SEND="video/send",e.VIDEO_RECEIVE="video/receive",e.INSERT_SEI="insertSei"}(t||(t={}));function n(t,n){const{transformerId:s,type:r,payloads:a}=n;let o=[];if("sei"===n.type){const{value:n,messages:s}=function(t,n){function s(e,t,n){return n+t.length<=e.byteLength&&t.every(((t,s)=>e.getUint8(n+s)===t))}function r(e,t){const n=function(e,t){return new Uint8Array([0,0,1,6,5,...t,...e])}(e,function(e){const t=[];for(;e>=255;)t.push(255),e-=255;return t.push(e),new Uint8Array(t)}(t.length+e.length)),s=function(e){const t=[...e];let n=3;for(;n<t.length-2;)0!==t[n]||0!==t[n+1]||0!==t[n+2]&&1!==t[n+2]&&2!==t[n+2]&&3!==t[n+2]?n+=1:(t.splice(n+2,0,3),n+=3);return t}(new Uint8Array([...n,...t,128]));return new Uint8Array(s)}function a(e,n){const r=function(e){const t=new DataView(e);for(let e=0;e<t.byteLength-4;e++)if(s(t,[0,0,1],e)){const n=31&t.getUint8(e+3);if(n>=1&&n<=5)return e}return-1}(t.data);if(r>=0){const e=new ArrayBuffer(t.data.byteLength+n.byteLength),s=new Uint8Array(e);return s.set(new Uint8Array(t.data.slice(0,r)),0),s.set(n,r),s.set(new Uint8Array(t.data.slice(r)),r+n.byteLength),e}return e}return function(){const s=[];for(let o=0;o<n.length;o+=1){const i=r(e,new Uint8Array(n[o]));t.data=a(t.data,i),s.push({uuid:e,payload:n[o]})}return{value:t,messages:s}}()}(t,a||[]);t=n,o=s}return{success:!0,frame:t,transformerId:s,type:r,seiResult:o}}const s=function(){let e=[];const t=new Map;return{add:({payload:t,repeatCount:n})=>(e.push({payload:t,repeatCount:n}),!0),poll(n){t.has(n)||t.set(n,[]),t.size>0&&(t.forEach((t=>{t.push(...e)})),e=[]);const s=t.get(n)||[],r=s.filter((e=>e.repeatCount>0)).map((e=>Object.assign(Object.assign({},e),{repeatCount:e.repeatCount-1})));return t.set(n,r),s}}}(),r=e=>(t,r)=>{try{const a=t.getMetadata().synchronizationSource,o=(s?s.poll(a):[]).map((e=>e.payload)),i=n(t,Object.assign(Object.assign({},e),{payloads:o}));r.enqueue(i.frame),self.postMessage(Object.assign({success:i.success,seiResult:i.seiResult},e))}catch(t){self.postMessage(Object.assign({success:!1},e))}},a=e=>(t,n)=>{try{const s=function(e,t){const{type:n,transformerId:s}=t;if("sei"===n){const t=function(e){function t(e,t,n){return n+t.length<e.byteLength&&t.every(((t,s)=>e.getUint8(n+s)===t))}function n(e){const t=[];let n=0;for(;n<e.length;)0===e[n]&&0===e[n+1]&&3===e[n+2]?(t.push(e[n]),t.push(e[n+1]),n+=3):(t.push(e[n]),n+=1);return new Uint8Array(t)}function s(e){let t=2;const n=e.byteLength;for(;t<n;){let s=0;for(;t<n&&255===e[t];)s+=255,t++;s+=e[t],t++;const r=Math.min(t+s,n),a=new Uint8Array(e.slice(t,r));return{uuid:a.slice(0,16),payload:a.slice(16)}}}return{messages:function(e){const r=new DataView(e.data),a=[];let o=0;if(!t(r,[0,0,1],0)&&!t(r,[0,0,0,1],0))return[];for(;o<r.byteLength-5;)if(t(r,[0,0,1],o)){const i=o+3;o=i;const c=31&r.getUint8(o),u=31&r.getUint8(o+1);if(6===c&&5===u){for(;o<r.byteLength&&!t(r,[0,0,1],o);)o++;const c=o,u=s(n(new Uint8Array(e.data.slice(i,c))));u&&a.push(Object.assign({},u))}else o++}else o++;return a}(e),frame:e}}(e),{frame:r,messages:a}=t;return{success:!0,frame:r,type:n,transformerId:s,seiResult:a}}return{success:!0,frame:e,transformerId:s,type:n}}(t,e);n.enqueue(s.frame),self.postMessage(Object.assign({success:s.success,seiResult:s.seiResult},e))}catch(t){self.postMessage(Object.assign({success:!1},e))}};function o(e,t,n,s){const o=new TransformStream({transform:"video/send"===e?r(t):a(t)});n.pipeThrough(o).pipeTo(s)}const i=self;i.addEventListener("message",(function(e){var n,r,a;if(!(null===(n=null==e?void 0:e.data)||void 0===n?void 0:n.operation)||!(null===(r=null==e?void 0:e.data)||void 0===r?void 0:r.transformerId))return;const{operation:i,transformerId:c}=e.data;switch(i){case t.VIDEO_SEND:case t.VIDEO_RECEIVE:o(i,{method:i,transformerId:c,type:"sei"},e.data.readable,e.data.writable);break;case t.INSERT_SEI:s.add({payload:e.data.payload,repeatCount:null!==(a=e.data.repeatCount)&&void 0!==a?a:0})}})),i.addEventListener("rtctransform",(function(e){const t=e.transformer;if(!t)return;o(t.options.method,t.options,t.readable,t.writable)}))})();`, "Worker", void 0, void 0);
      }
      (function(s) {
        s.NONE = "none", s.ENCODED_TRANSFORMS = "encodedTransforms", s.INSERTABLE_STREAMS = "insertableStreams";
      })(Wn || (Wn = {}));
      const hi = /* @__PURE__ */ (() => {
        const s = {};
        return { getWorker: (r) => (s[r] || (s[r] = new Ul()), s[r]), destroy: (r) => {
          var a;
          (a = s[r]) === null || a === void 0 || a.terminate(), s[r] = void 0;
        } };
      })();
      var Be;
      (function(s) {
        s.NOT_PUBLISHING_VIDEO = "NOT_PUBLISHING_VIDEO", s.INBAND_MESSAGING_NOT_ENABLED = "INBAND_MESSAGING_NOT_ENABLED", s.INVALID_REPEAT_COUNT = "INVALID_REPEAT_COUNT", s.PAYLOAD_SIZE_INVALID = "PAYLOAD_SIZE_INVALID", s.PAYLOAD_RATE_EXCEEDED = "PAYLOAD_RATE_EXCEEDED", s.INVALID_TRACK_TYPE = "INVALID_TRACK_TYPE";
      })(Be || (Be = {}));
      class ut {
        constructor(r) {
          this.maxFramerate = r, this.queued = [];
        }
        validateMessagePayload(r, a) {
          if (r.byteLength <= 0) return Re.err(Be.PAYLOAD_SIZE_INVALID);
          if (a < 0 || a > 30) return Re.err(Be.INVALID_REPEAT_COUNT);
          if (r.byteLength > 1024) return Re.err(Be.PAYLOAD_SIZE_INVALID);
          this.queued = this.trimPastPayloads(this.queued, 1e3);
          const { before: c, after: l } = this.getPayloadSums(this.queued);
          if (c + r.byteLength > 10240 || l + r.byteLength * Math.max(1, a) > 10240) return Re.err(Be.PAYLOAD_RATE_EXCEEDED);
          if (this.queued.push({ byteLength: r.byteLength, timestamp: Date.now() }), a > 0) {
            const n = 1e3 / this.maxFramerate;
            let e = Date.now() + n;
            for (let t = 0; t < a; t += 1) this.queued.push({ byteLength: r.byteLength, timestamp: e }), e += n;
          }
          return Re.ok(!0);
        }
        trimPastPayloads(r, a) {
          const c = Date.now() - a;
          return r.filter((l) => l.timestamp > c);
        }
        getPayloadSums(r) {
          const a = Date.now();
          return r.reduce((c, l) => {
            const { before: n, after: e } = c;
            return l.timestamp <= a ? { before: n + l.byteLength, after: e } : { before: n, after: e + l.byteLength };
          }, { before: 0, after: 0 });
        }
      }
      const fr = "seiMessageReceived", yt = "error";
      var ft;
      (function(s) {
        s.CREATED = "created", s.INITIALIZED = "initialized", s.DESTROYED = "destroyed";
      })(ft || (ft = {}));
      class Ji extends lt {
        constructor(r) {
          super(), this.sessionId = r, this.state = ft.CREATED, this.transformerId = jo().value, this.prevResultWasError = !1, this.consecutiveErrorResults = 0, this.seiReadCnt = 0, this.seiBytesRead = 0, this.onMessage = (a) => {
            this.onTransformResult(a.data);
          };
        }
        initializeInsertableStreams(r) {
          var a, c;
          this.worker = hi.getWorker(this.sessionId);
          const l = r.receiver.createEncodedStreams(), { readable: n, writable: e } = l;
          (a = this.worker) === null || a === void 0 || a.postMessage({ operation: "video/receive", transformerId: this.transformerId, readable: n, writable: e }, [n, e]), (c = this.worker) === null || c === void 0 || c.addEventListener("message", this.onMessage);
        }
        initializeEncodedTransforms(r) {
          var a;
          this.worker = hi.getWorker(this.sessionId);
          const c = { method: "video/receive", type: "sei", transformerId: this.transformerId };
          r.receiver.transform = new RTCRtpScriptTransform(this.worker, c), (a = this.worker) === null || a === void 0 || a.addEventListener("message", this.onMessage);
        }
        initialize(r, a) {
          if (this.state !== ft.CREATED) return !1;
          const c = Qr(r);
          if (c === Wn.NONE) return !1;
          if (a && c === Wn.INSERTABLE_STREAMS) this.initializeInsertableStreams(r);
          else {
            if (a || c !== Wn.ENCODED_TRANSFORMS) return !1;
            this.initializeEncodedTransforms(r);
          }
          return this.transceiver = r, this.state = ft.INITIALIZED, !0;
        }
        onTransceiverAdd(r) {
          return this.initialize(r, !0);
        }
        onTrackEvent(r) {
          return r.track.kind === "video" && this.initialize(r.transceiver, !1);
        }
        static isSupported(r) {
          return Qr(r) !== Wn.NONE;
        }
        onTransformResult(r) {
          return r.transformerId === this.transformerId && (r.success ? (this.prevResultWasError = !1, this.consecutiveErrorResults = 0, !!r.seiResult && (r.seiResult.forEach((a) => {
            const { payload: c, uuid: l } = a;
            this.updateReadStats(a), this.emit(fr, { uuid: l, payload: c });
          }), r.seiResult.length > 0)) : (this.prevResultWasError && this.consecutiveErrorResults++, this.consecutiveErrorResults >= 300 && this.onError(r, le.TRANSFORM_TOO_MANY_ERRORS), this.prevResultWasError = !0, this.onError(r, le.TRANSFORM_UNEXPECTED_ERROR), !1));
        }
        updateReadStats(r) {
          this.seiReadCnt++, this.seiBytesRead += r.payload.byteLength;
        }
        getReceiverStats() {
          const { seiBytesRead: r, seiReadCnt: a } = this;
          return { seiReadCnt: a, seiBytesRead: r };
        }
        onError(r, a) {
          const { type: c } = r;
          this.emit(yt, { type: c, stageErrorValue: a });
        }
        destroy() {
          var r, a;
          this.state !== ft.DESTROYED && (this.removeAllListeners(), (r = this.worker) === null || r === void 0 || r.removeEventListener("message", this.onMessage), !((a = this.transceiver) === null || a === void 0) && a.receiver && (this.transceiver.receiver.transform = null), this.state = ft.DESTROYED);
        }
        getState() {
          return this.state;
        }
      }
      class Uc {
        constructor(r) {
          this.sessionId = r, this.state = ft.CREATED, this.transformerId = jo().value, this.seiWriteCnt = 0, this.seiBytesWritten = 0, this.onMessage = (a) => {
            this.onTransformResult(a.data);
          };
        }
        initializeInsertableStreams(r, a) {
          var c, l;
          this.worker = hi.getWorker(this.sessionId);
          const n = r.sender.createEncodedStreams(), { readable: e, writable: t } = n;
          (c = this.worker) === null || c === void 0 || c.postMessage({ operation: "video/send", transformerId: this.transformerId, readable: e, writable: t }, [e, t]), (l = this.worker) === null || l === void 0 || l.addEventListener("message", this.onMessage);
        }
        initializeEncodedTransforms(r, a) {
          var c;
          this.worker = hi.getWorker(this.sessionId);
          const l = { method: "video/send", type: "sei", transformerId: this.transformerId, encodingLayers: a };
          r.sender.transform = new RTCRtpScriptTransform(this.worker, l), (c = this.worker) === null || c === void 0 || c.addEventListener("message", this.onMessage);
        }
        initialize(r) {
          var a;
          if (this.state !== ft.CREATED) return !1;
          const c = Yr(r);
          if (c === Wn.NONE) return !1;
          const l = r.sender.getParameters(), n = ((a = l == null ? void 0 : l.encodings) === null || a === void 0 ? void 0 : a.length) || 1;
          if (c === Wn.INSERTABLE_STREAMS) this.initializeInsertableStreams(r, n);
          else {
            if (c !== Wn.ENCODED_TRANSFORMS) return !1;
            this.initializeEncodedTransforms(r, n);
          }
          return this.transceiver = r, this.state = ft.INITIALIZED, !0;
        }
        static isSupported(r) {
          return Yr(r) !== Wn.NONE;
        }
        sendSeiMessage(r, a) {
          var c;
          return this.state === ft.INITIALIZED && this.transceiver ? ((c = this.worker) === null || c === void 0 || c.postMessage({ operation: "insertSei", transformerId: this.transformerId, payload: r, repeatCount: a }), Re.ok(!0)) : Re.err(Be.NOT_PUBLISHING_VIDEO);
        }
        onTransceiverAdd(r) {
          return this.initialize(r);
        }
        onTrackEvent(r) {
          return !1;
        }
        onTransformResult(r) {
          return r.transformerId === this.transformerId && (r.success && this.updateSendStats(r), r.success);
        }
        updateSendStats(r) {
          r.seiResult && r.seiResult.forEach((a) => {
            this.seiWriteCnt++, this.seiBytesWritten += a.payload.byteLength;
          });
        }
        getSenderStats() {
          const { seiBytesWritten: r, seiWriteCnt: a } = this;
          return { seiWriteCnt: a, seiBytesWritten: r };
        }
        destroy() {
          var r;
          this.state !== ft.DESTROYED && (!((r = this.transceiver) === null || r === void 0) && r.receiver && (this.transceiver.receiver.transform = null), this.state = ft.DESTROYED);
        }
        getState() {
          return this.state;
        }
      }
      class fi extends ot {
        constructor(r, a, c, l, n, e, t, i, o) {
          super(je.SELECTED_PAIR_CHANGE, a, c, !1), Object.assign(this.properties, { action: r, protocol: l, local_type: n, local_addr: e, remote_addr: t, local_candidate_priority: i, remote_participant_id: o });
        }
      }
      var qt = function(s, r, a, c) {
        return new (a || (a = Promise))(function(l, n) {
          function e(o) {
            try {
              i(c.next(o));
            } catch (u) {
              n(u);
            }
          }
          function t(o) {
            try {
              i(c.throw(o));
            } catch (u) {
              n(u);
            }
          }
          function i(o) {
            var u;
            o.done ? l(o.value) : (u = o.value, u instanceof a ? u : new a(function(d) {
              d(u);
            })).then(e, t);
          }
          i((c = c.apply(s, [])).next());
        });
      };
      let Yi = null;
      class Kt extends lt {
        constructor(r, a, c, l, n, e, t, i, o) {
          var u;
          if (super(), this.analyticsTracker = e, this.subscribeConfig = o, this.sfuResource = { node: "", cluster: "" }, this.protocol = "", this.incompatibleCodecs = /* @__PURE__ */ new Set(), this.connect = ({ audioOnly: d = !1, traceId: h, iceRestartOptions: S }) => qt(this, void 0, void 0, function* () {
            const { token: T, tag: I, identifier: R, action: w } = this, P = !!S, B = new AbortController();
            let j, x, H;
            this.abortController = B, this.traceId = h, this.protocol = "", this.perfTracker.resetMeasurements(h);
            const K = () => {
              j && this.off(ro, j), x && this.off(Rt, x);
            }, Q = new Promise((ie, ce) => {
              const oe = function({ action: ye, token: Ce, traceId: ve, tag: _e, identifier: Le }) {
                const et = ye === me.SUBSCRIBE ? le.SUBSCRIBE_TIMED_OUT : le.PUBLISH_TIMED_OUT;
                return new $e(Object.assign(Object.assign({}, et), { action: ye, token: Ce, traceId: ve, tag: _e, location: "connect", remoteParticipantId: Le }));
              }({ action: w, token: T, traceId: h, tag: I, identifier: R }), ee = function({ action: ye, token: Ce, traceId: ve, tag: _e }) {
                const Le = le.OPERATION_ABORTED;
                return new $e(Object.assign(Object.assign({}, Le), { token: Ce, traceId: ve, location: "peer-client.connect", tag: _e, action: ye }));
              }({ action: w, token: T, traceId: h, tag: I }), fe = setTimeout(() => {
                this.stop(), this.analyticsTracker.trackError(oe), ce(oe);
              }, 1e4);
              j = (ye) => {
                clearTimeout(fe), P || this.stop(), ce(ye);
              }, x = (ye) => {
                if (ye === xe.CONNECTED) clearTimeout(fe), ie();
                else if (ye === xe.FAILED) {
                  const Ce = function({ action: ve, token: _e, traceId: Le, tag: et }) {
                    return new $e(Object.assign(Object.assign({}, le.PEER_CONNECTION_NETWORK_FAILURE), { token: _e, traceId: Le, location: "peer-client.connect", tag: et, action: ve }));
                  }({ action: w, token: T, traceId: h, tag: I });
                  clearTimeout(fe), ce(Ce);
                }
              }, this.on(ro, j), this.on(Rt, x), H = () => {
                clearTimeout(fe);
              }, B.signal.aborted && (clearTimeout(fe), ce(ee)), B.signal.addEventListener("abort", () => {
                clearTimeout(fe), ce(ee);
              });
            });
            try {
              const ie = yield Promise.all([qt(this, void 0, void 0, function* () {
                P || (yield this.start(), this.mediaStream = yield this.initializePeerConnection(d));
                const oe = S == null ? void 0 : S.assignmentToken, ee = S == null ? void 0 : S.nodeOverride;
                return yield this.exchangeSdp({ iceRestart: P, nodeOverride: ee, assignmentToken: oe, abortController: B }), this.mediaStream;
              }), Q]);
              this.statsReporter.traceId = h;
              const ce = ie[0];
              if (this.abortController = void 0, !P && w === me.PUBLISH) try {
                yield this.verifyOrUpdateTransceiverSync();
              } catch (oe) {
                this.logger.error({ err: oe, msg: "error syncing transceivers" });
              }
              return { mediaStream: ce };
            } catch (ie) {
              throw H && H(), ie;
            } finally {
              K();
            }
          }), this.disconnect = (d = !1) => qt(this, void 0, void 0, function* () {
            var h;
            const { token: S, action: T } = this;
            (h = this.abortController) === null || h === void 0 || h.abort(), this.stop(), this.protocol = "", d ? this.cleanup(T, S.participantID, S, d) : yield this.cleanup(T, S.participantID, S, d);
          }), this.resetTransformers = () => {
            var d, h;
            (d = this.videoSenderTransformer) === null || d === void 0 || d.destroy(), this.videoSenderTransformer = this.createVideoSenderTransformer(), (h = this.videoReceiverTransformer) === null || h === void 0 || h.destroy(), this.videoReceiverTransformer = this.createVideoReceiverTransformer(), this.statsReporter.resetTransformers(this.videoReceiverTransformer, this.videoSenderTransformer);
          }, this.onTrack = (d) => {
            var h, S;
            const { token: T, action: I, traceId: R, identifier: w } = this;
            this.trace(T, R, `onTrack: ${d.track.kind}`, I, w), this.sendInBandMessagingEnabled && ((h = this.videoSenderTransformer) === null || h === void 0 || h.onTrackEvent(d)), this.receiveInBandMessagingEnabled && ((S = this.videoReceiverTransformer) === null || S === void 0 || S.onTrackEvent(d));
          }, this.onIceGatheringStateChange = () => {
            var d, h, S;
            const { token: T, action: I, traceId: R, identifier: w } = this;
            if (((d = this.peerConnection) === null || d === void 0 ? void 0 : d.iceGatheringState) === "gathering" ? this.perfTracker.markIceGatheringStart() : ((h = this.peerConnection) === null || h === void 0 ? void 0 : h.iceGatheringState) === "complete" && this.perfTracker.markIceGatheringStop(), this.peerConnection) {
              const P = this.peerConnection.iceGatheringState, B = new mc(I, T, R, P, w);
              this.analyticsTracker.trackEventNoSharedProps(B);
            }
            this.trace(T, R, `ICE gathering state change: ${(S = this.peerConnection) === null || S === void 0 ? void 0 : S.iceGatheringState}`, I, w);
          }, this.onSelectedCandidatePairChange = () => {
            var d, h, S, T, I, R, w, P, B, j, x, H, K, Q;
            const { token: ie, action: ce, traceId: oe, identifier: ee } = this, fe = (h = (d = this.peerConnection) === null || d === void 0 ? void 0 : d.getReceivers()[0].transport) === null || h === void 0 ? void 0 : h.iceTransport, ye = fe == null ? void 0 : fe.getSelectedCandidatePair();
            if (ye) {
              const { local: Ce, remote: ve } = ye, _e = `Selected candidate pair change (local, remote): ${Ce == null ? void 0 : Ce.candidate}, ${ve == null ? void 0 : ve.candidate}`;
              this.logger.debug({ msg: _e });
              const Le = new fi(ce, ie, oe, (T = (S = ye.local) === null || S === void 0 ? void 0 : S.protocol) !== null && T !== void 0 ? T : "", (R = (I = ye.local) === null || I === void 0 ? void 0 : I.type) !== null && R !== void 0 ? R : "", (P = (w = ye.local) === null || w === void 0 ? void 0 : w.address) !== null && P !== void 0 ? P : "", (j = (B = ye.remote) === null || B === void 0 ? void 0 : B.address) !== null && j !== void 0 ? j : "", (H = (x = ye.local) === null || x === void 0 ? void 0 : x.priority) !== null && H !== void 0 ? H : 0, ee);
              this.analyticsTracker.trackEvent(Le), this.protocol = (Q = (K = ye.local) === null || K === void 0 ? void 0 : K.protocol) !== null && Q !== void 0 ? Q : "";
            }
          }, this.onIceCandidate = (d) => qt(this, void 0, void 0, function* () {
            var h, S;
            const { identifier: T, action: I, traceId: R } = this, w = (h = d.target.localDescription) === null || h === void 0 ? void 0 : h.sdp.includes("relay");
            this.analyticsTracker.trackEventNoSharedProps(new uo(this.token, R, `ice candidate: hasRelay = ${w}, candidate = ${(S = d.candidate) === null || S === void 0 ? void 0 : S.candidate}`, I, T));
          }), this.onMute = () => qt(this, void 0, void 0, function* () {
            const { token: d, action: h, traceId: S, identifier: T } = this;
            this.trace(d, S, "Track has muted", h, T);
          }), this.onUnMute = () => qt(this, void 0, void 0, function* () {
            const { token: d, action: h, traceId: S, identifier: T } = this;
            this.trace(d, S, "Track has unmuted", h, T);
          }), this.fetchAndSetRemoteDescription = (d) => qt(this, void 0, void 0, function* () {
            var h, S, T, I;
            const R = (S = (h = this.peerConnection) === null || h === void 0 ? void 0 : h.localDescription) === null || S === void 0 ? void 0 : S.sdp;
            R || this.logger.warn({ msg: "Unexpected state: No SDP offer when attempting to fetch remote description" });
            const { token: w, traceId: P, action: B, identifier: j, tag: x } = this, { endpointURL: H, nodeOverride: K, assignmentToken: Q, multiCodec: ie, abortController: ce } = d;
            let oe;
            this.perfTracker.markPostStart(), this.perfTracker.markSdpExchangeStart();
            try {
              const ve = Su({ connection: this.stageConnection, action: B, token: w, identifier: this.identifier, tracker: this.analyticsTracker });
              this.perfTracker.setTransport(ve.getTransport());
              const _e = K || Nn("node") || Nn("dataPlaneEndpoint");
              oe = yield ve.exchange({ sdpOffer: R, url: H, traceId: P, forceNode: _e, assignmentToken: Q, multiCodec: ie, abortController: ce, initialLayerPreference: (T = this.simulcastSubscribeConfig) === null || T === void 0 ? void 0 : T.initialLayerPreference });
            } catch (ve) {
              let _e = ve;
              _e instanceof $e || (_e = new $e(Object.assign(Object.assign({}, le.UNEXPECTED_ERROR), { action: B, token: w, traceId: P, tag: x, details: ve instanceof Error ? ve.message : "", location: "sdp-exchange" }))), _e instanceof $e && (this.analyticsTracker.trackError(_e), this.emit(ro, _e));
            }
            if (this.perfTracker.markSdpExchangeStop(), !oe) return;
            const { location: ee, sessionDeleteLink: fe, mediaControls: ye } = oe;
            let Ce = oe.sdpAnswer;
            try {
              Ce = this.mungeSdpAnswer(Ce), oe.sdpAnswer = Ce;
            } catch (ve) {
              this.logger.error({ err: ve, msg: "Error while attempting to munge SDP, keeping original answer" });
            }
            this.statsReporter.sdpAnswer = Ce, this.emit(Bi, oe), ee && (this.whipResource = { location: ee, sessionDeleteLink: fe, mediaControls: ye }, this.sfuResource = function(ve) {
              const _e = ve.match(/https:\/\/([^/]+)\//);
              if (_e) {
                const Le = _e[1].split(".");
                if (Le[0].includes("video-rtx")) return { node: `${Le[0]}.${Le[1]}`, cluster: Le[1] };
              }
            }(ee) || { node: "", cluster: "" }, this.statsReporter.updateSfuResource(this.sfuResource));
            try {
              this.perfTracker.markSetRemoteDescStart(), yield (I = this.peerConnection) === null || I === void 0 ? void 0 : I.setRemoteDescription({ sdp: Ce, type: "answer" }), this.perfTracker.markSetRemoteDescStop(), this.perfTracker.markPostStop();
            } catch (ve) {
              const _e = new $e(Object.assign(Object.assign({}, le.SET_ANSWER_FAILURE), { action: B, token: w, traceId: P, tag: kt(B, j), location: "setRemoteDescription", remoteParticipantId: j, details: ve instanceof Error ? ve.message : "" }));
              this.analyticsTracker.trackError(_e), this.emit(ro, _e);
            }
          }), this.cleanup = (d, h, S, T = !1) => qt(this, void 0, void 0, function* () {
            var I, R, w;
            const P = jo();
            if (this.toggleStageConnectionListeners(!1), this.currentJitterBufferMinDelayInMs = void 0, this.stageConnection = void 0, this.closeFailedPeerConnections(), !(!((I = this.whipResource) === null || I === void 0) && I.location)) return this.trace(S, this.traceId, "whipResource location not known, exiting cleanup", d, h), void this.analyticsTracker.trackError(new $e(Object.assign(Object.assign({}, le.WHIP_URL_MISSING), { action: d, token: S, traceId: this.traceId, tag: kt(d, h), location: d === me.SUBSCRIBE ? "unsubscribe" : "unpublish", requestUUID: P, remoteParticipantId: h })));
            let B = this.whipResource.location;
            if (this.trace(S, this.traceId, `use hostnamecachedurl: ${B}`, d, h), T) {
              if (!((w = this.whipResource) === null || w === void 0) && w.sessionDeleteLink) {
                B = this.whipResource.sessionDeleteLink, this.trace(S, this.traceId, `DELETE via session-delete beacon path: ${B}`, d, h);
                try {
                  navigator.sendBeacon(B, JSON.stringify({ authorization: S.rawToken }));
                } catch (j) {
                  this.analyticsTracker.trackErrorAndThrow(new $e(Object.assign(Object.assign({}, hn(le.WHIP_DELETE_FAILURE, j)), { action: d, token: S, traceId: this.traceId, tag: kt(d, h), location: me.SUBSCRIBE ? "unsubscribe" : "unpublish", requestUUID: P, remoteParticipantId: h })));
                }
              }
            } else try {
              yield g().delete(B, { headers: { Authorization: `Bearer ${S.rawToken}`, "X-Stages-Platform": "web", "X-Stages-Request-ID": P.value, "X-Stages-SDK": "1.28.0", "X-Stages-Session-ID": this.analyticsTracker.getSessionId(), "X-Stages-Trace-ID": this.traceId.value, "X-Stages-WHIP-Version": co } });
            } catch (j) {
              ((R = j.response) === null || R === void 0 ? void 0 : R.status) === 404 ? this.trace(S, this.traceId, `DELETE returned 404, ignoring, action = ${d}, uuid = ${P.value}`, d, h) : this.analyticsTracker.trackErrorAndThrow(new $e(Object.assign(Object.assign({}, hn(le.WHIP_DELETE_FAILURE, j)), { action: d, token: S, traceId: this.traceId, tag: kt(d, h), location: me.SUBSCRIBE ? "unsubscribe" : "unpublish", requestUUID: P, remoteParticipantId: h })));
            }
          }), this.getConnectionState = () => {
            if (!this.peerConnection) return xe.NONE;
            const d = this.peerConnection.connectionState || this.peerConnection.iceConnectionState;
            try {
              return Pa(d);
            } catch {
              return this.logger.warn({ msg: "Unhandled connection state:", rawState: d }), xe.IDLE;
            }
          }, this.onIceCandidateError = (d) => {
            const { token: h, traceId: S, tag: T } = this;
            if (d.errorCode !== 701) {
              const I = new $e(Object.assign(Object.assign({}, le.ICE_CANDIDATE_ERROR), { action: this.action, token: h, traceId: S, tag: T, location: "onIceCandidateError", remoteParticipantId: this.identifier }));
              this.analyticsTracker.trackError(I), this.emit(ro, I);
            }
          }, this.onIceConnectionStateChange = () => {
            var d, h;
            const { token: S, traceId: T, action: I, identifier: R } = this;
            this.trace(S, T, `ICE connection state change: ${(d = this.peerConnection) === null || d === void 0 ? void 0 : d.iceConnectionState}`, I, R), ((h = this.peerConnection) === null || h === void 0 ? void 0 : h.iceConnectionState) === "checking" && this.peerConnection.getTransceivers().forEach(({ receiver: w, sender: P }) => {
              [w, P].forEach((B) => {
                var j, x;
                (x = (j = B == null ? void 0 : B.transport) === null || j === void 0 ? void 0 : j.iceTransport) === null || x === void 0 || x.addEventListener("selectedcandidatepairchange", this.onSelectedCandidatePairChange);
              });
            }), this.onConnectionStateChange();
          }, this.createVideoSenderTransformer = () => new Uc(this.analyticsTracker.getSessionId()), this.createVideoReceiverTransformer = () => {
            const d = new Ji(this.analyticsTracker.getSessionId()), { token: h, tag: S, identifier: T, action: I, traceId: R } = this;
            d.on(fr, (B) => {
              this.emit(Ar, B);
            });
            const w = /* @__PURE__ */ function(B, j) {
              let x = 0;
              return function(...H) {
                const K = Date.now();
                K - x >= j && (x = K, B(...H));
              };
            }((B) => {
              const j = `Transform error occurred: ${B.type}`, x = $a({ traceId: R, token: h, tag: S, identifier: T, action: I, details: j, stageErrorValue: le.TRANSFORM_UNEXPECTED_ERROR });
              this.logger.warn({ err: x, msg: "Error encountered when transforming receiver", error: B });
            }, 1e3), P = (B) => {
              const j = `Too many errors occurred: ${B.type}`, x = $a({ traceId: R, token: h, tag: S, identifier: T, action: I, details: j, stageErrorValue: le.TRANSFORM_TOO_MANY_ERRORS });
              this.logger.error({ err: x, msg: "Too many errors encountered when transforming receiver. Shutting down transformer.", error: B }), d.destroy(), this.analyticsTracker.trackError(x), this.emit(Hr, x);
            };
            return d.on(yt, (B) => {
              B.stageErrorValue.code !== le.TRANSFORM_TOO_MANY_ERRORS.code ? w(B) : P(B);
            }), d;
          }, this.onConnectionStateChange = () => {
            if (this.peerConnection) {
              const h = this.peerConnection.connectionState || this.peerConnection.iceConnectionState, { token: S, traceId: T, identifier: I, action: R } = this, w = new gc(R, S, T, h, I);
              this.analyticsTracker.trackEventNoSharedProps(w), this.trace(S, T, `connection state change: ${h}`, R, I);
            }
            const d = this.getConnectionState();
            switch (d) {
              case xe.CONNECTED:
                this.closeFailedPeerConnections(), this.perfTracker.markActionStop(), this.emit(Rt, d), this.statsReporter.updateMultihostConfiguration(this.publishAudioStream, this.publishVideoStream);
                break;
              case xe.FAILED:
                this.storeFailedPeerConnection(this.peerConnection), this.destroyPeerConnection({ closeConnection: !1 }), this.emit(Rt, d), this.handleConnectionFailure();
                break;
              default:
                this.emit(Rt, d);
            }
          }, this.onIncompatibleCodecs = (d) => qt(this, void 0, void 0, function* () {
            if (d.forEach((T) => {
              let I = !1;
              this.incompatibleCodecs.forEach((R) => {
                R.config === T.config && R.mime === T.mime && (I = !0);
              }), I || this.incompatibleCodecs.add(T);
            }), this.peerConnection) try {
              yield (h = this.peerConnection, S = [...this.incompatibleCodecs], Ma(void 0, void 0, void 0, function* () {
                var T;
                for (const I of h.getSenders()) {
                  const R = I.getParameters();
                  if (R.codecs.length > 1) {
                    const w = R.codecs[0];
                    let P = !1;
                    for (const B of S) zo(w, B) && (P = !0);
                    if (P) {
                      const B = Ba(S, R.codecs);
                      (T = R.encodings) === null || T === void 0 || T.forEach((j) => {
                        j.active && (j.codec = B);
                      }), yield I.setParameters(R);
                    }
                  }
                }
              }));
            } catch (T) {
              const { token: I, action: R, traceId: w, identifier: P } = this, B = new $e(Object.assign(Object.assign({}, le.CODEC_HANDLE_INCOMPATIBLE_UNEXPECTED_ERROR), { action: R, token: I, traceId: w, tag: kt(R, P), location: "onIncompatibleCodecs", remoteParticipantId: P, details: T instanceof Error ? T.message : "" }));
              this.analyticsTracker.trackError(B), this.emit(ro, B);
            }
            var h, S;
          }), this.token = r, this.logger = new Ze(a, jt.WEBRTC), this.action = c, this.tag = l, this.traceId = n, c === me.SUBSCRIBE && !t) throw new Error("Subscribe action provided without subscriber Id");
          this.jitterBufferConfig = o == null ? void 0 : o.jitterBuffer, this.simulcastSubscribeConfig = o == null ? void 0 : o.simulcast, this.subscriberId = t, this.stageConnection = i, this.failedPeerConnections = [], this.receiveInBandMessagingEnabled = !!(!((u = this.subscribeConfig) === null || u === void 0) && u.inBandMessaging.enabled), this.perfTracker = new ht(this.action, this.traceId), this.statsReporter = new Ha(c, r, n, this.identifier, this.analyticsTracker), this.handlePublishingChangedBinding = this.handlePublishingChanged.bind(this), this.toggleStageConnectionListeners(!0);
        }
        get videoMediaId() {
          var r, a;
          return (a = (r = this.videoTransceiver) === null || r === void 0 ? void 0 : r.mid) !== null && a !== void 0 ? a : null;
        }
        toggleStageConnectionListeners(r) {
          var a, c;
          r ? (a = this.stageConnection) === null || a === void 0 || a.on(iu, this.handlePublishingChangedBinding) : (c = this.stageConnection) === null || c === void 0 || c.off(iu, this.handlePublishingChangedBinding);
        }
        updateSubscribeConfig(r) {
          var a, c;
          if (this.jitterBufferConfig = r.jitterBuffer, this.simulcastSubscribeConfig = r.simulcast, this.action === me.SUBSCRIBE) {
            const l = r.inBandMessaging.enabled;
            this.receiveInBandMessagingEnabled !== l && this.logger.warn({ msg: "Cannot mutate in-band messaging config value for receiver" });
          }
          this.applyJitterBufferMinDelayConditionally((c = (a = this.stageConnection) === null || a === void 0 ? void 0 : a.getIsStagePublishing()) !== null && c !== void 0 && c);
        }
        verifyOrUpdateTransceiverSync() {
          var r, a;
          return qt(this, void 0, void 0, function* () {
            if (this.publishVideoStream) {
              const c = this.getTransceiverForKind("video");
              c ? this.publishVideoStream.track.id !== ((r = c.sender.track) === null || r === void 0 ? void 0 : r.id) && (this.logger.debug({ msg: "found out of sync video transceiver... updating" }), yield this.replaceOrUpdateStream(this.publishVideoStream)) : this.logger.warn({ msg: "missing transceiver for video" });
            }
            if (this.publishAudioStream) {
              const c = this.getTransceiverForKind("audio");
              c ? this.publishAudioStream.track.id !== ((a = c.sender.track) === null || a === void 0 ? void 0 : a.id) && (this.logger.debug({ msg: "found out of sync audio transceiver... updating" }), yield this.replaceOrUpdateStream(this.publishAudioStream)) : this.logger.warn({ msg: "missing transceiver for audio" });
            }
          });
        }
        start() {
          return qt(this, void 0, void 0, function* () {
            const { token: r, action: a, traceId: c, identifier: l } = this;
            a !== me.PUBLISH || r.claims.capabilities.allow_publish || this.analyticsTracker.trackErrorAndThrow(new $e(Object.assign(Object.assign({}, hn(le.TOKEN_PERMISSIONS_DENIED, new Error("Cannot publish with subscribe only token"))), { action: a, token: r, traceId: c, tag: kt(a, l), location: "StagePeerClient.start", remoteParticipantId: l })));
            const n = function({ action: e, identifier: t, token: i, analyticsTracker: o }) {
              let u = "";
              const d = dc(i, o);
              switch (e) {
                case me.PUBLISH:
                  u = d.getPublishEndpoint();
                  break;
                case me.SUBSCRIBE:
                  t && (u = d.getSubscribeEndpoint(t));
              }
              return u;
            }({ action: a, identifier: l, token: r.rawToken, analyticsTracker: this.analyticsTracker });
            try {
              this.perfTracker.markActionStart(), this.endpointURL = n, this.createPeerConnection(), this.trace(r, c, "peer connection created", a, l);
            } catch (e) {
              const t = new $e(Object.assign(Object.assign({ action: a }, hn(le.CREATE_PEER_CONNECTION_FAILURE, e)), { token: r, traceId: c, tag: kt(a, l), location: "StagePeerClient.start", remoteParticipantId: l }));
              a === me.PUBLISH && this.emit(Rt, xe.FAILED), this.emit(ro, t), this.analyticsTracker.trackErrorAndThrow(t);
            }
          });
        }
        mungeSdpOffer(r, a, c) {
          if (c.simulcastEnabled && (r = new dt(r).withVideoLayersAllocationRtpHeaderExtension().sdp), a === me.SUBSCRIBE) r = new dt(r).withOpusAudioConfig(Pr(ho), !0).sdp;
          else if (a === me.PUBLISH && c.audioConfig) {
            const { maxBitrateBps: l, stereo: n } = c.audioConfig;
            r = new dt(r).withOpusAudioConfig(l, n).sdp;
          }
          return r;
        }
        mungeSdpAnswer(r) {
          Ai.browser.isFirefox() && this.publishAudioStream && this.action === me.PUBLISH && (r = new dt(r).withOpusAudioConfig(this.publishAudioStream.config.maxBitrateBps, void 0).sdp);
          const a = Ai.browser.isChrome() || Ai.browser.isEdge();
          this.action === me.SUBSCRIBE && a && (r = new dt(r).withoutAudioRtcpRSize().sdp);
          const c = function() {
            const l = Nn("subscribeForceIceProtocol");
            if (l === "tcp" || l === "udp") return l;
          }();
          return this.action === me.SUBSCRIBE && c && (r = new dt(r).withFilteredCandidates(c).sdp), r;
        }
        createPeerConnection() {
          var r;
          this.logger.debug({ msg: "setting up peer connection" }), this.peerConnection && (this.logger.debug({ msg: "peer connection is already established, cleaning up previous connection" }), this.destroyPeerConnection({ closeConnection: !1 })), this.peerConnection = new RTCPeerConnection({ iceTransportPolicy: "all" }), this.statsReporter.start(this.peerConnection, (r = this.publishVideoStream) === null || r === void 0 ? void 0 : r.config.simulcastEnabled), this.peerConnection.addEventListener("connectionstatechange", this.onConnectionStateChange), this.peerConnection.addEventListener("iceconnectionstatechange", this.onIceConnectionStateChange), this.peerConnection.addEventListener("icecandidateerror", this.onIceCandidateError), this.peerConnection.addEventListener("icegatheringstatechange", this.onIceGatheringStateChange), this.peerConnection.addEventListener("icecandidate", this.onIceCandidate), this.peerConnection.addEventListener("track", this.onTrack), this.peerConnection.addEventListener("mute", this.onMute), this.peerConnection.addEventListener("unmute", this.onUnMute);
        }
        destroyPeerConnection(r) {
          var a, c, l, n, e, t, i, o, u;
          this.statsReporter.stop(), (a = this.peerConnection) === null || a === void 0 || a.removeEventListener("connectionstatechange", this.onConnectionStateChange), (c = this.peerConnection) === null || c === void 0 || c.removeEventListener("iceconnectionstatechange", this.onIceConnectionStateChange), (l = this.peerConnection) === null || l === void 0 || l.removeEventListener("icecandidateerror", this.onIceCandidateError), (n = this.peerConnection) === null || n === void 0 || n.removeEventListener("icegatheringstatechange", this.onIceGatheringStateChange), (e = this.peerConnection) === null || e === void 0 || e.removeEventListener("icecandidate", this.onIceCandidate), (t = this.peerConnection) === null || t === void 0 || t.removeEventListener("track", this.onTrack), (i = this.peerConnection) === null || i === void 0 || i.removeEventListener("mute", this.onMute), (o = this.peerConnection) === null || o === void 0 || o.removeEventListener("unmute", this.onUnMute), (r.closeConnection || this.action === me.PUBLISH) && ((u = this.peerConnection) === null || u === void 0 || u.close()), this.peerConnection = void 0;
        }
        closeFailedPeerConnections() {
          for (const r of this.failedPeerConnections) r == null || r.close();
          this.failedPeerConnections = [];
        }
        storeFailedPeerConnection(r) {
          r && this.action !== me.PUBLISH && this.failedPeerConnections.push(r);
        }
        stop() {
          var r, a;
          (r = this.videoReceiverTransformer) === null || r === void 0 || r.destroy(), (a = this.videoSenderTransformer) === null || a === void 0 || a.destroy(), this.destroyPeerConnection({ closeConnection: !0 });
        }
        getTransceiverForKind(r) {
          if (!this.peerConnection) return;
          const a = this.peerConnection.getTransceivers();
          return r === "audio" ? a.find((c) => c.mid === "0") : r === "video" ? a.find((c) => c.mid === "1") : void 0;
        }
        removeTrack(r) {
          return qt(this, void 0, void 0, function* () {
            if (r === "audio" || r === "video") if (this.peerConnection) try {
              const a = this.getTransceiverForKind(r);
              if (!a) return void this.logger.warn({ msg: `tried removing track type ${r} but couldn't find transceiver` });
              yield a.sender.replaceTrack(null), r === at.AUDIO ? this.publishAudioStream = void 0 : this.publishVideoStream = void 0, yield this.statsReporter.updateMultihostConfiguration(this.publishAudioStream, this.publishVideoStream);
            } catch (a) {
              this.logger.warn({ msg: "error replacing track", err: a });
            }
            else r === at.AUDIO ? this.publishAudioStream = void 0 : this.publishVideoStream = void 0;
            else this.logger.warn({ msg: "RemoveTrack called with invalid track type", trackType: r });
          });
        }
        replaceOrUpdateStream(r) {
          return qt(this, void 0, void 0, function* () {
            if (r.track) {
              if (pu(r) ? this.publishAudioStream = r : Ac(r) && (this.publishVideoStream = r), this.peerConnection) try {
                const a = this.getTransceiverForKind(r.track.kind);
                if (!a) return void this.logger.warn({ msg: `tried replacing track type ${r.track.kind} but couldn't find transceiver`, track: r.track });
                if (Ac(r)) {
                  const c = a.sender.getParameters(), l = r.config.encodingLayers;
                  c.encodings = c.encodings.map((n) => {
                    var e;
                    const t = (e = n.rid) !== null && e !== void 0 ? e : "", i = l.find((o) => {
                      var u;
                      return ((u = o.rid) !== null && u !== void 0 ? u : "") === t;
                    });
                    return i ? Object.assign(Object.assign({}, n), i) : n;
                  }), yield a.sender.setParameters(c);
                } else if (pu(r)) {
                  const c = a.sender.getParameters(), l = kr(r)[0];
                  c.encodings = c.encodings.map((n) => Object.assign(Object.assign({}, n), l)), yield a.sender.setParameters(c);
                }
                yield a.sender.replaceTrack(r.track), yield this.statsReporter.updateMultihostConfiguration(this.publishAudioStream, this.publishVideoStream);
              } catch (a) {
                this.logger.warn({ msg: "error replacing track", err: a });
              }
            } else this.logger.warn({ msg: "Unexpected call to replaceOrUpdateStream with no track" });
          });
        }
        initializePeerConnection(r = !1) {
          var a, c, l, n, e, t, i, o;
          return qt(this, void 0, void 0, function* () {
            const { traceId: u, token: d, action: h, identifier: S } = this;
            Kn(this.peerConnection), this.resetTransformers();
            let T = new MediaStream();
            if (h === me.PUBLISH) {
              this.publishAudioStream || (this.publishAudioStream = { track: this.getSilentAudio(), config: { maxBitrateBps: Pr(Ho), stereo: !1 } });
              const I = this.peerConnection.getTransceivers(), R = [];
              I.forEach((K) => {
                var Q;
                R.concat((Q = K.sender.track) === null || Q === void 0 ? void 0 : Q.id);
              }), T = new MediaStream([this.publishAudioStream.track, (a = this.publishVideoStream) === null || a === void 0 ? void 0 : a.track].filter((K) => !!K && !R.includes(K.id)));
              const w = T.getAudioTracks()[0] || "audio", P = T.getVideoTracks()[0] || "video", B = { direction: "sendonly", streams: [T], sendEncodings: kr(this.publishAudioStream) }, j = { direction: "sendrecv", streams: [T], sendEncodings: (c = this.publishVideoStream) === null || c === void 0 ? void 0 : c.config.encodingLayers };
              this.peerConnection.addTransceiver(w, B), this.trace(d, u, `track added, type: ${w.kind || w}`, h, S);
              const x = this.peerConnection.addTransceiver(P, j);
              this.trace(d, u, `track added, type: ${P.kind || P}`, h, S);
              const H = !!(!((n = (l = this.publishVideoStream) === null || l === void 0 ? void 0 : l.config) === null || n === void 0) && n.inBandMessagingEnabled);
              this.sendInBandMessagingEnabled === void 0 ? this.sendInBandMessagingEnabled = H : this.sendInBandMessagingEnabled !== H && this.logger.warn({ msg: "Cannot mutate in-band messaging config value for sender" }), this.sendInBandMessagingEnabled && !Uc.isSupported(x) ? this.handleTransformNotSupported() : this.sendInBandMessagingEnabled && ((e = this.videoSenderTransformer) === null || e === void 0 || e.onTransceiverAdd(x));
            } else h === me.SUBSCRIBE && (d.shouldSendSilentAudio() ? this.peerConnection.addTransceiver(this.getSilentAudio(), { direction: "sendrecv" }) : this.peerConnection.addTransceiver("audio", { direction: "recvonly" }), this.trace(d, u, "track added, type: audio", h, S), r || (this.videoTransceiver = this.peerConnection.addTransceiver("video", { direction: "recvonly" }), this.trace(d, u, "track added, type: video", h, S), this.receiveInBandMessagingEnabled && !Ji.isSupported(this.videoTransceiver) ? this.handleTransformNotSupported() : this.receiveInBandMessagingEnabled && ((t = this.videoReceiverTransformer) === null || t === void 0 || t.onTransceiverAdd(this.videoTransceiver))), this.peerConnection.getTransceivers().forEach((I) => {
              I.receiver ? (this.logger.info({ msg: "dbg: Subscribe succeeded, adding media track to participant mediaStream" }), T == null || T.addTrack(I.receiver.track)) : this.logger.info({ msg: "dbg: Subscribe succeeded, but Transceiver were negotiated without Receiver" });
            }), this.applyJitterBufferMinDelayConditionally((o = (i = this.stageConnection) === null || i === void 0 ? void 0 : i.getIsStagePublishing()) !== null && o !== void 0 && o));
            return T;
          });
        }
        handlePublishingChanged(r) {
          this.logger.debug({ msg: `[handlePublishingChanged (${this.subscriberId})] isStagePublishing: ${r}, currentMinDelay: ${this.currentJitterBufferMinDelayInMs}` }), this.action === me.SUBSCRIBE && this.applyJitterBufferMinDelayConditionally(r);
        }
        applyJitterBufferMinDelayConditionally(r) {
          const a = this.currentJitterBufferMinDelayInMs, c = this.calcJitterBufferMinDelay(r, this.jitterBufferConfig);
          if (r) {
            if (a === void 0 || a > c) {
              const l = `[applyJitterBufferMinDelayConditionally (${this.subscriberId})] participant is publishing and min delay is unset or > configured; attempting to update to ${c}`;
              this.logger.debug({ msg: l }), this.trace(this.token, this.traceId, l, this.action, this.identifier), this.applyAndTrackJitterBufferMinDelay(c);
            }
          } else if (a === void 0 || c !== a) {
            const l = `[applyJitterBufferMinDelayConditionally (${this.subscriberId})] participant is subscribe-only and min delay is unset or != configured; attempting to update to ${c}`;
            this.logger.debug({ msg: l }), this.trace(this.token, this.traceId, l, this.action, this.identifier), this.applyAndTrackJitterBufferMinDelay(c);
          }
        }
        calcJitterBufferMinDelay(r, a) {
          var c, l, n;
          let e = 0;
          if (!(() => {
            const t = RTCRtpReceiver.prototype;
            return !(!t || typeof t != "object") && ("jitterBufferTarget" in t || "playoutDelayHint" in t);
          })()) return 0;
          if (r) e = hr((c = a == null ? void 0 : a.minDelayWhenPublishing) !== null && c !== void 0 ? c : Fn.DEFAULT, r);
          else {
            e = hr((l = a == null ? void 0 : a.minDelayWhenSubscribeOnly) !== null && l !== void 0 ? l : Fn.DEFAULT, r);
            const t = (n = this.stageConnection) === null || n === void 0 ? void 0 : n.jitterBufferMinDelayInMs();
            (a == null ? void 0 : a.minDelayWhenSubscribeOnly) === Fn.DEFAULT && t !== void 0 && (e = t, this.logger.debug({ msg: `[calcJitterBufferMinDelay] overriding min delay with remote value: ${e}` }));
          }
          return e;
        }
        applyAndTrackJitterBufferMinDelay(r) {
          var a, c;
          this.currentJitterBufferMinDelayInMs = r, this.statsReporter.updateJitterBufferMinDelay(r), r !== void 0 && ((c = (a = this.peerConnection) === null || a === void 0 ? void 0 : a.getTransceivers()) === null || c === void 0 || c.forEach((l) => {
            l.receiver && this.applyJitterBufferMinDelay(l.receiver, r);
          }));
        }
        applyJitterBufferMinDelay(r, a) {
          let c = "Unable to set jitter buffer min delay";
          if ("jitterBufferTarget" in r) c = `setting jitterBufferTarget to: ${a} for track: ${r.track.kind}`, this.logger.debug({ msg: c }), r.jitterBufferTarget = a;
          else if ("playoutDelayHint" in r) {
            const l = a / 1e3;
            c = `setting playoutDelayHint to: ${a} for track: ${r.track.kind}`, this.logger.debug({ msg: c }), r.playoutDelayHint = l;
          } else this.logger.warn({ msg: c });
          this.trace(this.token, this.traceId, c, this.action, this.identifier);
        }
        exchangeSdp(r) {
          var a, c, l;
          return qt(this, void 0, void 0, function* () {
            const { traceId: n, token: e, action: t, identifier: i, tag: o, endpointURL: u } = this, { iceRestart: d = !1, nodeOverride: h, assignmentToken: S, abortController: T } = r;
            let I;
            this.logger.debug({ msg: `Exchanging SDP: ${n.value}, iceRestart=${d}, nodeOverride=${h}, assignmentToken=${S}` }), Kn(this.peerConnection), t === me.PUBLISH && ms() && (this.logger.debug({ msg: "Applying publisher codec preference for main profile." }), ((w, P) => {
              var B, j;
              const x = (B = RTCRtpReceiver.getCapabilities("video")) === null || B === void 0 ? void 0 : B.codecs;
              if (!x) return;
              let H = x;
              H = xa(x, "42e0"), P.preferMainProfile && (H = xa(x, "4d00")), (j = w.getTransceivers().find((K) => K.receiver.track.kind === "video")) === null || j === void 0 || j.setCodecPreferences(H);
            })(this.peerConnection, { preferMainProfile: ms() }));
            try {
              this.trace(e, n, "Creating offer", t, i), I = yield this.peerConnection.createOffer({ iceRestart: d });
            } catch (w) {
              const P = new $e(Object.assign(Object.assign({}, hn(le.CREATE_OFFER_FAILURE, w)), { action: t, token: e, traceId: n, tag: o, location: "exchangeSdp", remoteParticipantId: i }));
              this.emit(ro, P), this.analyticsTracker.trackErrorAndThrow(P);
            }
            I.sdp && (I.sdp = this.mungeSdpOffer(I.sdp, t, { simulcastEnabled: (c = (a = this.publishVideoStream) === null || a === void 0 ? void 0 : a.config.simulcastEnabled) !== null && c !== void 0 && c, audioConfig: (l = this.publishAudioStream) === null || l === void 0 ? void 0 : l.config })), this.trace(e, n, "Setting local description", t, i), yield this.peerConnection.setLocalDescription(I), this.trace(e, n, "local description set", t, i), u || this.logger.warn({ msg: "Unexpected state: No endpointURL specified for fetching of remote description." });
            const R = t === me.PUBLISH && ms() || t === me.SUBSCRIBE && ln("multiCodecAnswer");
            yield this.fetchAndSetRemoteDescription({ endpointURL: u, nodeOverride: h, assignmentToken: S, multiCodec: R, abortController: T });
          });
        }
        getReports() {
          var r;
          return qt(this, void 0, void 0, function* () {
            try {
              const a = (yield (r = this.peerConnection) === null || r === void 0 ? void 0 : r.getStats()) || [], c = [];
              return a.forEach((l) => {
                c.push(l);
              }), c;
            } catch {
              return [];
            }
          });
        }
        requestRTCStats(r) {
          return qt(this, void 0, void 0, function* () {
            if (this.peerConnection) return this.statsReporter.getStats(r);
          });
        }
        get identifier() {
          return this.subscriberId || this.token.participantID;
        }
        handleTransformNotSupported() {
          const { token: r, tag: a, identifier: c, action: l, traceId: n } = this, e = $a({ traceId: n, token: r, tag: a, identifier: c, action: l, stageErrorValue: le.TRANSFORM_NOT_SUPPORTED_BY_PLATFORM });
          this.logger.error({ err: e, msg: "Transforms not supported by this platform" }), this.analyticsTracker.trackError(e), this.emit(Hr, e);
        }
        handleConnectionFailure() {
          return qt(this, void 0, void 0, function* () {
            const { token: r, traceId: a, tag: c } = this;
            this.analyticsTracker.trackError(new $e(Object.assign(Object.assign({}, le.PEER_CONNECTION_NETWORK_FAILURE), { action: this.action, token: r, traceId: a, tag: c, location: "onIceCandidateError", remoteParticipantId: this.identifier })));
          });
        }
        getSilentAudio() {
          Yi || (Yi = new AudioContext());
          const r = Yi.createOscillator(), a = Yi.createGain();
          r.connect(a);
          const c = Yi.createMediaStreamDestination();
          return a.connect(c), a.gain.value = 0, r.start(), c.stream.getAudioTracks()[0];
        }
        getActionMeasurements() {
          return this.perfTracker.getMeasurements();
        }
        getProtocol() {
          return this.protocol;
        }
        initStreamsToPublish(r) {
          this.publishVideoStream = r.find(Ac), this.publishAudioStream = r.find(pu);
        }
        getSfuResource() {
          return this.sfuResource;
        }
        getExpectedJitterBufferMinDelayInMs() {
          var r, a;
          return this.calcJitterBufferMinDelay((a = (r = this.stageConnection) === null || r === void 0 ? void 0 : r.getIsStagePublishing()) !== null && a !== void 0 && a, this.jitterBufferConfig);
        }
        trace(r, a, c, l, n) {
          this.analyticsTracker.trackEventNoSharedProps(new uo(r, a, c, l, n));
        }
        sendSeiMessage(r, a) {
          const c = this.getTransceiverForKind("video");
          return this.videoSenderTransformer && this.sendInBandMessagingEnabled ? this.action === me.PUBLISH && c ? this.videoSenderTransformer.sendSeiMessage(r, a) : Re.err(Be.NOT_PUBLISHING_VIDEO) : Re.err(Be.INBAND_MESSAGING_NOT_ENABLED);
        }
      }
      const st = me.SUBSCRIBE;
      class pn {
        constructor(r, a, c) {
          this.analyticsTracker = r, this.token = a, this.remoteId = c, this.action = st;
        }
        trackAttempt({ stageConnectionStats: r, isReassignment: a = !1, traceIdOverride: c, preAttemptSfuResource: l }) {
          const { action: n, analyticsTracker: e, token: t, remoteId: i } = this, o = c || Jn();
          return e.trackEvent(new Pc({ token: this.token, subscribedId: this.remoteId, traceId: o, isEdpConnected: r.isConnected, isReassignment: a, preAttemptSfuResource: l })), { getTraceId: () => o, trackSubscribeStarted({ totalDurationWithRetries: u, retryTimes: d, sfuResource: h, peerClientPerfStats: S, protocol: T }) {
            const { optionsDuration: I, postDuration: R, timeToCandidate: w, timeToConnected: P, sdpExchangeDuration: B, sdpExchangeTransport: j, setRemoteDescDuration: x, peerConnectionDuration: H } = S, { edpInitialConnectDuration: K, edpInitialConnectRetries: Q, edpInitialStateDuration: ie, edpInitialStatePublishingCount: ce, edpStateUpdateCount: oe } = r;
            e.trackEvent(new Pl({ token: t, traceId: o, remoteParticipantId: i, optionsDuration: I, postDuration: R, timeToCandidate: w, totalDuration: P, edpInitialConnectDuration: K, edpInitialConnectRetries: Q, edpInitialStateDuration: ie, edpInitialStatePublishingCount: ce, edpStateUpdateCount: oe, sdpExchangeDuration: B, sdpExchangeTransport: j, setRemoteDescDuration: x, peerConnectionDuration: H, sfuResource: h, totalDurationWithRetries: u, subscribeRetryTimes: d, isReassignment: a, protocol: T }));
          }, trackSubscribeFirstFrame: ({ peerClientPerfStats: u, totalDurationWithRetries: d, sfuResource: h, retryTimes: S, currentJitterBufferMinDelayInMs: T, mediaType: I, firstFrameDuration: R, protocol: w }) => {
            const { sdpExchangeDuration: P, sdpExchangeTransport: B, setRemoteDescDuration: j, peerConnectionDuration: x } = u, { edpInitialConnectDuration: H, edpInitialConnectRetries: K, edpInitialStateDuration: Q, edpInitialStatePublishingCount: ie, edpStateUpdateCount: ce } = r;
            this.analyticsTracker.trackEvent(new Dc({ token: this.token, traceId: o, remoteParticipantId: i, edpInitialConnectDuration: H, edpInitialConnectRetries: K, edpInitialStateDuration: Q, edpInitialStatePublishingCount: ie, edpStateUpdateCount: ce, sdpExchangeDuration: P, sdpExchangeTransport: B, setRemoteDescDuration: j, peerConnectionDuration: x, videoWasPaused: !1, firstFrameDuration: R, mediaType: I, sfuResource: h, totalDurationWithRetries: d, subscribeRetryTimes: S, currentJitterBufferMinDelayInMs: T, protocol: w }));
          }, trackSubscribeFailed(u, d, h) {
            const S = ((R, w, P) => {
              if (R instanceof $e) return R;
              let B = "";
              return R instanceof oo.AxiosError && (B += `AxiosError - ${R.code}`), new $e(Object.assign(Object.assign(Object.assign({}, le.SUBSCRIBE_FAILURE), { action: st, token: w, traceId: P, tag: ir, location: "subscribe", details: `${B} ${R == null ? void 0 : R.message}` }), { fatal: !0 }));
            })(u, t, o);
            e.trackEvent(new Dl({ token: t, traceId: o, remoteParticipantId: i, code: S.code, message: S.message, fatal: S.fatal, nominal: S.nominal, isReassignment: a, protocol: d }));
            const { isConnected: T } = r, I = new $e(Object.assign(Object.assign({}, le.SUBSCRIBE_FAILURE), { action: n, token: t, traceId: o, tag: kt(me.SUBSCRIBE, i), location: "subscribe", remoteParticipantId: i, isEdpConnected: T, details: h }));
            return u instanceof $e && (I.fatal = u.fatal, I.nominal = u.nominal, I.location = `subscribe > ${u.location}`), e.trackError(I), S;
          }, trackUnsubscribe: () => {
            e.trackEvent(new Ju({ token: t, unsubscribedId: i, traceId: o }));
          }, trackEndSucceeded: (u, d) => {
            e.trackEvent(new vu({ token: t, traceId: o, remoteParticipantId: i, isUnsubscribeSuccessful: !0, reason: u, protocol: d }));
          }, trackEndFailed: (u, d) => {
            const h = new $e(Object.assign(Object.assign({}, le.UNSUBSCRIBE_FAILURE), { token: t, traceId: o, tag: kt(me.SUBSCRIBE, i), location: "unsubscribe", remoteParticipantId: i }));
            return u !== or.UNLOAD && u !== or.UNSUBSCRIBE || e.trackError(h), e.trackEvent(new vu({ token: t, traceId: o, remoteParticipantId: i, isUnsubscribeSuccessful: !0, reason: u, protocol: d })), h;
          } };
        }
      }
      class Eu extends ot {
        constructor(r, a, c, l, n, e) {
          super(je.PLAYBACK_LAYER_REQUEST, r, a, !1), Object.assign(this.properties, { media_type: c, remote_participant_id: l, track_id: n, layer_id: e });
        }
      }
      class za extends ot {
        constructor(r, a, c, l, n, e = 1) {
          super(je.PLAYBACK_LAYER_STATE, r, a, !1), Object.assign(this.properties, { media_type: c, remote_participant_id: l, track_id: n, request_count: e });
        }
      }
      var pi, Sn, go, Tt;
      (function(s) {
        s.PAUSE = "pause", s.PLAY = "play";
      })(pi || (pi = {})), function(s) {
        s.IDLE = "idle", s.ACTIVE = "active", s.ERRORED = "errored", s.DESTROYED = "destroyed";
      }(Sn || (Sn = {})), function(s) {
        s.SUCCESS = "success";
      }(go || (go = {})), function(s) {
        s.FAILED = "failed", s.DESTROYED = "destroyed", s.THROTTLED = "throttled";
      }(Tt || (Tt = {}));
      var Xt = function(s, r, a, c) {
        return new (a || (a = Promise))(function(l, n) {
          function e(o) {
            try {
              i(c.next(o));
            } catch (u) {
              n(u);
            }
          }
          function t(o) {
            try {
              i(c.throw(o));
            } catch (u) {
              n(u);
            }
          }
          function i(o) {
            var u;
            o.done ? l(o.value) : (u = o.value, u instanceof a ? u : new a(function(d) {
              d(u);
            })).then(e, t);
          }
          i((c = c.apply(s, [])).next());
        });
      };
      class qa {
        constructor(r) {
          this.state = Sn.IDLE, this.mid = null, this.playbackEndpoint = null, this.layersEndpoint = null, this.stopVideo = () => Xt(this, void 0, void 0, function* () {
            return this.state !== Sn.ACTIVE ? (this.logCommandSkipped("stopVideo"), this.mapSkippedResultFromState(this.state)) : this.sendPlaybackRequest(pi.PAUSE);
          }), this.startVideo = () => Xt(this, void 0, void 0, function* () {
            return this.state !== Sn.ACTIVE ? (this.logCommandSkipped("startVideo"), this.mapSkippedResultFromState(this.state)) : this.sendPlaybackRequest(pi.PLAY);
          }), this.setLayer = (a) => Xt(this, void 0, void 0, function* () {
            return this.state !== Sn.ACTIVE ? (this.logCommandSkipped("setLayer"), this.mapSkippedResultFromState(this.state)) : this.sendLayerRequest(a);
          }), this.unsetLayer = () => Xt(this, void 0, void 0, function* () {
            return this.state !== Sn.ACTIVE ? (this.logCommandSkipped("unsetLayer"), this.mapSkippedResultFromState(this.state)) : this.sendLayerRequest();
          }), this.getLayers = () => Xt(this, void 0, void 0, function* () {
            return this.state !== Sn.ACTIVE ? (this.logCommandSkipped("getLayers"), this.mapSkippedResultFromState(this.state)) : this.sendLayerStateRequest();
          }), this.sendPlaybackRequest = (a) => Xt(this, void 0, void 0, function* () {
            if (!this.mid) return this.logger.warn({ msg: "mid is unexpectedly undefined" }), (0, Re.err)(Tt.FAILED);
            if (!this.playbackEndpoint) return this.logger.warn({ msg: "Playback endpoint is unset and required for playback control requests" }), (0, Re.err)(Tt.FAILED);
            this.logger.info({ msg: `Sending ${a} request to ${this.playbackEndpoint}` });
            const c = a === pi.PAUSE ? { pause: [this.mid] } : { play: [this.mid] }, l = this.createPostWhepRequest(c);
            return fetch(this.playbackEndpoint, l).then((n) => {
              if (n.status >= 300) {
                const e = new Error(`Error sending media controls request: ${n.status}:${n.statusText}`);
                return this.logger.error({ err: e }), (0, Re.err)(Tt.FAILED);
              }
              return this.logger.debug({ msg: `Request to ${a} was successful: ${n.status}` }), (0, Re.ok)(go.SUCCESS);
            }).catch((n) => (this.logger.error({ err: n, msg: "Error sending media controls request" }), (0, Re.err)(Tt.FAILED)));
          }), this.sendLayerRequest = (a) => Xt(this, void 0, void 0, function* () {
            if (!this.mid) return this.logger.warn({ msg: "mid is unexpectedly undefined" }), (0, Re.err)(Tt.FAILED);
            if (!this.layersEndpoint) return this.logger.warn({ msg: "Layers endpoint is unset and required for layer requests" }), (0, Re.err)(Tt.FAILED);
            const c = typeof a == "string", l = c ? { mediaId: this.mid, encodingId: a } : {}, n = c ? `set : ${a}` : "unset layer";
            this.logger.info({ msg: `sendLayerRequest for ${n} at ${this.layersEndpoint}` });
            const e = this.createPostWhepRequest(l);
            return this.trackLayerRequest(a ?? "auto"), fetch(this.layersEndpoint, e).then((t) => this.state === Sn.DESTROYED ? (0, Re.err)(Tt.DESTROYED) : t.status >= 300 ? this.handleLayerRequestError(t.status, t.statusText) : (this.logger.debug({ msg: `Request to ${n} was successful: ${t.status}` }), (0, Re.ok)(go.SUCCESS))).catch((t) => this.handleLayerRequestError(0, t.message));
          }), this.sendLayerStateRequest = () => Xt(this, void 0, void 0, function* () {
            if (!this.mid) return this.logger.warn({ msg: "mid is unexpectedly undefined" }), (0, Re.err)(Tt.FAILED);
            if (!this.layersEndpoint) return this.logger.warn({ msg: "Layers endpoint is unset and required for layer requests" }), (0, Re.err)(Tt.FAILED);
            this.logger.info({ msg: `sendLayerStateRequest for ${this.mid} at ${this.layersEndpoint}` });
            const a = this.createGetWhepRequest();
            return this.trackLayerStateRequest(), fetch(this.layersEndpoint, a).then((c) => Xt(this, void 0, void 0, function* () {
              var l;
              if (this.state === Sn.DESTROYED) return (0, Re.err)(Tt.DESTROYED);
              if (c.status >= 300) return this.handleLayerStateRequestError(c.status, c.statusText);
              const n = yield c.json(), e = (l = n == null ? void 0 : n.layers) !== null && l !== void 0 ? l : [], t = JSON.stringify(e, null, 2);
              return this.logger.debug({ msg: `sendLayerStateRequest was successful: ${t}` }), (0, Re.ok)(e);
            })).catch((c) => this.handleLayerStateRequestError(0, c.message));
          }), this.logger = new Ze(r.logger, jt.REMOTE_PLAYBACK), this.token = r.token, this.traceId = r.traceId, this.analyticsTracker = r.analyticsTracker, this.remoteParticipantId = r.remoteParticipantId;
        }
        set mediaId(r) {
          if (this.state !== Sn.DESTROYED) {
            if (this.mid = r, this.mid === null) return this.logger.info({ msg: "media id is unset, controller is transitioning to idle state" }), void (this.state = Sn.IDLE);
            (this.playbackEndpoint || this.layersEndpoint) && (this.state = Sn.ACTIVE);
          } else this.logCommandSkipped("set mediaId");
        }
        set endpoints(r) {
          var a, c;
          if (this.state !== Sn.DESTROYED) {
            if (this.playbackEndpoint = (a = r.playback) !== null && a !== void 0 ? a : null, this.layersEndpoint = (c = r.layers) !== null && c !== void 0 ? c : null, !this.playbackEndpoint || !this.layersEndpoint) {
              const l = { playbackEndpoint: this.playbackEndpoint, layersEndpoint: this.layersEndpoint };
              return this.logger.info({ msg: `no endpoints are set, transitioning to idle state: ${JSON.stringify(l, null)}` }), void (this.state = Sn.IDLE);
            }
            this.mid && (this.state = Sn.ACTIVE);
          } else this.logCommandSkipped("set endpoints");
        }
        destroy() {
          this.state = Sn.DESTROYED, this.mid = null, this.playbackEndpoint = null, this.layersEndpoint = null;
        }
        logCommandSkipped(r = "command") {
          this.logger.info({ msg: `skipping ${r}, controller state invalid: ${this.state}` });
        }
        mapSkippedResultFromState(r) {
          return r === Sn.DESTROYED ? (0, Re.err)(Tt.DESTROYED) : (0, Re.err)(Tt.FAILED);
        }
        createPostWhepRequest(r) {
          return { method: "POST", headers: this.createRequestHeaders(), body: JSON.stringify(r) };
        }
        createGetWhepRequest() {
          return { method: "GET", headers: this.createRequestHeaders() };
        }
        createRequestHeaders() {
          var r, a;
          return { Authorization: `Bearer ${this.token.rawToken}`, "Content-Type": "application/json", "X-Stages-Platform": "web", "X-Stages-Request-ID": jo().value, "X-Stages-SDK": "1.28.0", "X-Stages-Session-ID": this.analyticsTracker.getSessionId(), "X-Stages-Trace-ID": (a = (r = this.traceId) === null || r === void 0 ? void 0 : r.value) !== null && a !== void 0 ? a : "", "X-Stages-WHIP-Version": co };
        }
        trackLayerRequest(r) {
          var a;
          this.analyticsTracker.trackEventNoSharedProps(new Eu(this.token, this.traceId, Je.VIDEO, this.remoteParticipantId, (a = this.mid) !== null && a !== void 0 ? a : "unknown", r));
        }
        trackLayerStateRequest(r = 1) {
          var a;
          this.analyticsTracker.trackEventNoSharedProps(new za(this.token, this.traceId, Je.VIDEO, this.remoteParticipantId, (a = this.mid) !== null && a !== void 0 ? a : "unknown", r));
        }
        handleLayerRequestError(r, a) {
          const c = `sendLayerRequest failed for reason: ${r} ${a}`;
          let l, n;
          return r === 429 ? (l = Tt.THROTTLED, n = le.WHEP_SET_LAYER_REQUEST_THROTTLED) : (l = Tt.FAILED, n = le.WHEP_SET_LAYER_REQUEST_FAILED), this.trackRequestError(n, c), (0, Re.err)(l);
        }
        handleLayerStateRequestError(r, a) {
          const c = `sendLayerStateRequest failed for reason: ${r} ${a}`;
          let l, n;
          return r === 429 ? (l = Tt.THROTTLED, n = le.WHEP_GET_LAYER_STATE_THROTTLED) : (l = Tt.FAILED, n = le.WHEP_GET_LAYER_STATE_FAILED), this.trackRequestError(n, c), (0, Re.err)(l);
        }
        trackRequestError(r, a) {
          const c = new Error(a);
          this.logger.error({ err: c }), r.message = a;
          const l = this.createError(r);
          this.analyticsTracker.trackError(l);
        }
        createError(r, a) {
          return new $e(Object.assign({ action: me.SUBSCRIBE, traceId: this.traceId, token: this.token, location: "RemotePlaybackController", tag: ir, details: a }, r));
        }
      }
      var Fs, Vs, tn, Ne, nt = function(s, r, a, c) {
        return new (a || (a = Promise))(function(l, n) {
          function e(o) {
            try {
              i(c.next(o));
            } catch (u) {
              n(u);
            }
          }
          function t(o) {
            try {
              i(c.throw(o));
            } catch (u) {
              n(u);
            }
          }
          function i(o) {
            var u;
            o.done ? l(o.value) : (u = o.value, u instanceof a ? u : new a(function(d) {
              d(u);
            })).then(e, t);
          }
          i((c = c.apply(s, [])).next());
        });
      }, pr = function(s, r, a, c) {
        if (a === "a" && !c) throw new TypeError("Private accessor was defined without a getter");
        if (typeof r == "function" ? s !== r || !c : !r.has(s)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
        return a === "m" ? c : a === "a" ? c.call(s) : c ? c.value : r.get(s);
      };
      (function(s) {
        s.DISCONNECTED = "disconnected", s.CONNECTING = "connecting", s.CONNECTED = "connected", s.ERRORED = "errored";
      })(tn || (tn = {})), function(s) {
        s.NONE = "none", s.AUDIO_ONLY = "audio_only", s.AUDIO_VIDEO = "audio_video";
      }(Ne || (Ne = {}));
      class Lr extends lt {
        constructor(r, a, c, l, n, e, t) {
          super(), this.id = r, this.token = a, this.stageConnection = c, this.nonScopedLogger = l, this.analyticsTracker = n, this.desiredSubscribeType = e, Fs.add(this), this.isSubscriptionActive = !1, this.subscriptionState = { connectionState: tn.DISCONNECTED, subscribeInProgress: !1 }, this.previousSignalState = { isTargetPublishing: !1 }, this.failedRetries = 0, this.startConnectingTimestamp = -1, this.throttler = new ws(1e3), this.cleanupFirstFrameTracking = Fo, this.actualSubscribeType = Ne.NONE, this.action = me.SUBSCRIBE, this.updateDesiredSubscribeType = (o) => {
            this.desiredSubscribeType = o, this.attemptToActualizeSubscribeType();
          }, this.updateSubscribeConfig = (o) => {
            this.peerClient.updateSubscribeConfig(o);
          }, this.getDesiredSubscribeType = () => this.desiredSubscribeType, this.attemptToActualizeSubscribeType = () => {
            const o = this.actualSubscribeType, u = this.desiredSubscribeType;
            this.logger.debug({ msg: `Attempt to actualize subscribe type to ${u}` }), this.subscriptionState.connectionState === tn.CONNECTED && u !== Ne.NONE && o !== u && this.applyVideoControlsBySubscribeType(u, o);
          }, this.onParticipantUpdated = (o) => {
            pr(this, Fs, "m", Vs).call(this, o) && (this.logger.debug({ msg: "onParticipantUpdated", participant: o }), this.processStateUpdate({ isTargetPublishing: o.isPublishing }));
          }, this.onParticipantJoined = (o) => {
            pr(this, Fs, "m", Vs).call(this, o) && (this.logger.debug({ msg: "onParticipantJoined", participant: o }), this.processStateUpdate({ isTargetPublishing: o.isPublishing }));
          }, this.onParticipantLeft = (o) => {
            pr(this, Fs, "m", Vs).call(this, o) && (this.logger.debug({ msg: "onParticipantLeft", participant: o }), this.processStateUpdate({ isTargetPublishing: !1 }));
          }, this.onPeerClientConnectionStateChange = (o) => {
            const u = this.stageConnection.getParticipant(this.id);
            this.logger.debug({ msg: `onPeerClientConnectionStateChange: ${o}`, state: o, targetParticipant: u }), this.processStateUpdate({ peerClientState: o });
          }, this.onPeerClientTransformError = (o) => {
            this.emit(au, o);
          }, this.onSdpNegotiated = (o) => {
            this.remotePlaybackController.endpoints = { playback: o.mediaControls, layers: o.layerControls };
          }, this.seiMessageHandler = (o) => {
            this.emit(uc, o);
          }, this.requestRTCStats = (o) => nt(this, void 0, void 0, function* () {
            return this.peerClient.requestRTCStats(o);
          }), this.trySubscribe = (o) => nt(this, void 0, void 0, function* () {
            var u, d;
            if (this.logger.debug({ msg: `Subscribe attempt started: ${o}` }), !this.isSubscriptionActive) return this.logger.warn({ msg: "Subscribe attempt invalid: Subscription is inactive" }), !1;
            this.logger.debug({ msg: "Subscribe attempt is valid." }), this.startConnectingTimestamp < 0 && (this.startConnectingTimestamp = performance.now()), this.subscriptionState.connectionState !== tn.ERRORED && (this.logger.debug({ msg: "Updating state to CONNECTING" }), this.updateState({ connectionState: tn.CONNECTING }));
            const h = this.stageConnection.getConnectionStats(), S = this.peerClient.getExpectedJitterBufferMinDelayInMs(), T = this.peerClient.getSfuResource();
            this.attemptTracker = this.subscribeTracker.trackAttempt({ stageConnectionStats: h, preAttemptSfuResource: T });
            try {
              this.remotePlaybackController.traceId = this.attemptTracker.getTraceId();
              const { mediaStream: I } = yield this.subscribe(this.attemptTracker.getTraceId()), R = performance.now() - this.startConnectingTimestamp, w = this.peerClient.getSfuResource();
              this.remotePlaybackController.mediaId = this.peerClient.videoMediaId;
              const P = this.failedRetries;
              this.attemptToActualizeSubscribeType();
              const B = this.peerClient.getActionMeasurements(), j = this.peerClient.getProtocol();
              if (this.attemptTracker.trackSubscribeStarted({ sfuResource: w, totalDurationWithRetries: R, retryTimes: P, peerClientPerfStats: B, protocol: j }), I) {
                this.cleanupFirstFrameTracking();
                const x = this.actualSubscribeType, H = this.attemptTracker, K = (Q, ie) => {
                  H.trackSubscribeFirstFrame({ peerClientPerfStats: B, sfuResource: w, totalDurationWithRetries: R, retryTimes: P, currentJitterBufferMinDelayInMs: S, mediaType: ie, firstFrameDuration: Q, protocol: j });
                };
                this.cleanupFirstFrameTracking = this.measureFirstFrameDuration({ mediaStream: I, subscribeType: x, callback: K });
              }
              return this.throttler.clear(), this.failedRetries = 0, this.startConnectingTimestamp = -1, I && this.emit(Is, I, this.remotePlaybackController), this.logger.debug({ msg: "Subscribe attempt succeeded" }), !0;
            } catch (I) {
              const R = (d = (u = this.peerClient) === null || u === void 0 ? void 0 : u.getProtocol()) !== null && d !== void 0 ? d : "", w = this.attemptTracker.trackSubscribeFailed(I, R);
              this.logger.error({ log: "Subscribe attempt failed", err: I }), this.onTrySubscribeFailure(w, o);
            }
            return !1;
          });
          const i = Jn();
          this.peerClient = new Kt(a, this.nonScopedLogger, this.action, kt(this.action, r), i, n, r, c, t), this.logger = new Ze(l, jt.SUBSCRIPTION), this.subscribeTracker = new pn(this.analyticsTracker, a, r), this.remotePlaybackController = new qa({ token: a, analyticsTracker: n, traceId: i, logger: this.nonScopedLogger, remoteParticipantId: this.id });
        }
        applyVideoControlsBySubscribeType(r, a) {
          try {
            r === Ne.AUDIO_ONLY ? this.remotePlaybackController.stopVideo().catch((c) => {
              this.logger.error({ err: c, msg: "Remote playback request to stop video failed" });
            }) : r === Ne.AUDIO_VIDEO && this.remotePlaybackController.startVideo().catch((c) => {
              this.logger.error({ err: c, msg: "Remote playback request to start video failed" });
            }), this.actualSubscribeType = r, this.logger.debug({ msg: `Desired subscribe type actualized from ${a} to ${r}.` });
          } catch (c) {
            this.logger.error({ err: c, msg: `Error updating subscribe type from ${a} to ${r}.` });
          }
        }
        processStateUpdate(r) {
          const a = this.previousSignalState, c = Object.assign({}, a, r);
          if (!this.isSubscriptionActive) return void this.logger.warn({ msg: "Unexpected processStateUpdate when subscription is inactive" });
          c.isTargetPublishing ? r.peerClientState === xe.CONNECTED ? this.updateState({ connectionState: tn.CONNECTED, subscribeInProgress: !0 }) : r.peerClientState === xe.FAILED && this.subscriptionState.subscribeInProgress && (this.attemptTracker && this.attemptTracker.trackEndFailed(or.CONNECTION_FAIL, this.peerClient.getProtocol()), this.updateState({ subscribeInProgress: !1 }), this.emit(ui)) : (a.isTargetPublishing && this.subscriptionState.subscribeInProgress && (this.logger.debug({ msg: "Scheduling an unsubscribe on the event loop" }), this.unsubscribe()), this.throttler.clear(), this.updateState({ connectionState: tn.DISCONNECTED }));
          const l = !a.isTargetPublishing && r.isTargetPublishing, n = this.subscriptionState.connectionState === tn.CONNECTED && r.peerClientState === xe.FAILED;
          (l || n) && this.throttledTrySubscribe("onSignalState change: isTargetPublishing is now true"), Object.assign(this.previousSignalState, r);
        }
        onTrySubscribeFailure(r, a) {
          this.logger.debug({ msg: "Changing/keeping state FAILED" });
          const c = r.fatal, l = r.code === le.OPERATION_ABORTED.code, n = this.failedRetries <= 4;
          if (!l && !c && n) {
            const e = 1e3 * Math.pow(2, this.failedRetries);
            this.logger.debug({ msg: `Retrying in ${e}ms` }), this.failedRetries++, this.nextAttemptTimerId = window.setTimeout(() => nt(this, void 0, void 0, function* () {
              this.throttledTrySubscribe(a);
            }), e);
          } else this.updateState({ connectionState: tn.ERRORED }), this.emit(jn, r), this.onTerminalFailure();
        }
        onTerminalFailure() {
          this.previousSignalState.isTargetPublishing = !1, this.startConnectingTimestamp = -1, this.failedRetries = 0;
        }
        start() {
          this.isSubscriptionActive = !0, this.peerClient.on(Rt, this.onPeerClientConnectionStateChange), this.peerClient.on(Bi, this.onSdpNegotiated), this.peerClient.on(Ar, this.seiMessageHandler), this.peerClient.on(Hr, this.onPeerClientTransformError), this.stageConnection.on(yi, this.onParticipantUpdated), this.stageConnection.on(cc, this.onParticipantJoined), this.stageConnection.on(ao, this.onParticipantLeft), this.stageConnection.on(ci, this.onParticipantLeft);
          let r = !0;
          if (this.stageConnection.isConnected()) {
            const a = this.stageConnection.getParticipant(this.id);
            r = !!(a != null && a.isPublishing);
          }
          this.processStateUpdate({ isTargetPublishing: r });
        }
        throttledTrySubscribe(r) {
          return this.throttler.invoke(this.trySubscribe, r);
        }
        updateState(r) {
          r.subscribeInProgress !== void 0 && (this.subscriptionState.subscribeInProgress = r.subscribeInProgress), r.connectionState && this.subscriptionState.connectionState !== r.connectionState && (this.subscriptionState.connectionState = r.connectionState, this.emit(Cs, this.subscriptionState.connectionState));
        }
        stop(r = !1) {
          this.peerClient.off(Rt, this.onPeerClientConnectionStateChange), this.peerClient.off(Hr, this.onPeerClientTransformError), this.peerClient.off(Bi, this.onSdpNegotiated), this.peerClient.off(Ar, this.seiMessageHandler), this.unsubscribe(r), this.throttler.clear(), this.stageConnection.off(yi, this.onParticipantUpdated), this.stageConnection.off(cc, this.onParticipantJoined), this.stageConnection.off(ao, this.onParticipantLeft), this.stageConnection.off(ci, this.onParticipantLeft), this.isSubscriptionActive = !1, this.updateState({ connectionState: tn.DISCONNECTED });
        }
        isActive() {
          return this.isSubscriptionActive;
        }
        subscribe(r, a) {
          return nt(this, void 0, void 0, function* () {
            const { token: c, id: l } = this;
            c.assertTokenIsUnexpired(r, kt(me.SUBSCRIBE, l), "subscribe", l);
            const { mediaStream: n } = yield this.peerClient.connect({ audioOnly: a, traceId: r });
            return { peerClient: this.peerClient, mediaStream: n };
          });
        }
        unsubscribe(r = !1) {
          return nt(this, void 0, void 0, function* () {
            if (window.clearTimeout(this.nextAttemptTimerId), this.remotePlaybackController.destroy(), !this.isSubscriptionActive || !this.attemptTracker || this.subscriptionState.connectionState === tn.DISCONNECTED) return;
            this.cleanupFirstFrameTracking(), this.attemptTracker.trackUnsubscribe();
            const a = r ? or.UNLOAD : or.UNSUBSCRIBE, c = this.peerClient.getProtocol();
            try {
              r ? this.peerClient.disconnect(r) : yield this.peerClient.disconnect(r), this.updateState({ subscribeInProgress: !1 }), this.attemptTracker.trackEndSucceeded(a, c);
            } catch {
              this.attemptTracker.trackEndFailed(a, c);
            }
          });
        }
        triggerIceRestart(r) {
          var a;
          return nt(this, void 0, void 0, function* () {
            const c = this.stageConnection.getConnectionStats(), l = this.peerClient.getSfuResource(), n = this.subscribeTracker.trackAttempt({ stageConnectionStats: c, isReassignment: !0, traceIdOverride: r.traceId, preAttemptSfuResource: l }), e = performance.now();
            try {
              this.emit(so), this.logger.debug({ msg: `Triggering attempt. Current node: ${this.peerClient.getSfuResource().node}` }), yield this.peerClient.connect({ iceRestartOptions: r, traceId: r.traceId }), this.logger.debug({ msg: `Successful ICE restart attempt. Current node: ${this.peerClient.getSfuResource().node}` });
              const t = performance.now() - e, i = this.peerClient.getSfuResource(), o = this.peerClient.getActionMeasurements();
              (a = this.attemptTracker) === null || a === void 0 || a.trackEndSucceeded(or.REASSIGNMENT, this.peerClient.getProtocol()), this.applyVideoControlsBySubscribeType(this.actualSubscribeType, this.actualSubscribeType), n.trackSubscribeStarted({ totalDurationWithRetries: t, sfuResource: i, retryTimes: 0, peerClientPerfStats: o, protocol: this.peerClient.getProtocol() }), this.emit(lc);
            } catch (t) {
              this.emit(bt), this.logger.error({ msg: "ICE restart attempt failed", err: t });
              const i = this.peerClient.getSfuResource(), o = n.trackSubscribeFailed(t, this.peerClient.getProtocol(), `iceRestart=true, startNode=${l.node}, endNode=${i == null ? void 0 : i.node}`);
              throw o.code === le.SUBSCRIBE_TIMED_OUT.code && this.onTrySubscribeFailure(o, "ice restart timeout"), t;
            }
          });
        }
        measureFirstFrameDuration({ mediaStream: r, subscribeType: a, callback: c }) {
          const l = performance.now(), n = (i) => {
            const o = performance.now() - l;
            c(o, i), i === "audio" ? t() : e();
          };
          let e = Fo, t = Fo;
          return a !== Ne.AUDIO_ONLY && (e = function(i, o) {
            return pc(i, "video", o);
          }(r, n)), t = function(i, o) {
            return pc(i, "audio", o);
          }(r, n), () => {
            e(), t();
          };
        }
      }
      var pt, Me;
      Fs = /* @__PURE__ */ new WeakSet(), Vs = function(s) {
        return s.id === this.id;
      }, function(s) {
        s.JOIN_ERROR = "JOIN_ERROR", s.PUBLISH_ERROR = "PUBLISH_ERROR", s.SUBSCRIBE_ERROR = "SUBSCRIBE_ERROR";
      }(pt || (pt = {})), function(s) {
        s[s.TOKEN_MALFORMED = 1] = "TOKEN_MALFORMED", s[s.TOKEN_EXPIRED = 2] = "TOKEN_EXPIRED", s[s.TIMEOUT = 3] = "TIMEOUT", s[s.FAILED = 4] = "FAILED", s[s.CANCELED = 5] = "CANCELED", s[s.STAGE_AT_CAPACITY = 6] = "STAGE_AT_CAPACITY", s[s.CODEC_MISMATCH = 7] = "CODEC_MISMATCH", s[s.TOKEN_NOT_ALLOWED = 8] = "TOKEN_NOT_ALLOWED", s[s.STAGE_DELETED = 9] = "STAGE_DELETED", s[s.PARTICIPANT_DISCONNECTED = 10] = "PARTICIPANT_DISCONNECTED";
      }(Me || (Me = {}));
      const tl = { [Me.TOKEN_MALFORMED]: "Token is malformed", [Me.TOKEN_EXPIRED]: "Token expired and is no longer valid", [Me.TIMEOUT]: "Operation timed out", [Me.FAILED]: "Operation failed", [Me.CANCELED]: "Operation canceled", [Me.STAGE_AT_CAPACITY]: "Stage at capacity", [Me.CODEC_MISMATCH]: "Client codec is not supported", [Me.TOKEN_NOT_ALLOWED]: "Token not allowed to perform operation", [Me.STAGE_DELETED]: "Stage has been deleted, unable to join", [Me.PARTICIPANT_DISCONNECTED]: "Participant has been disconnected, unable to join" }, Gs = { [le.EXPIRED_TOKEN.code]: Me.TOKEN_EXPIRED, [le.MALFORMED_TOKEN.code]: Me.TOKEN_MALFORMED, [le.JOIN_SERVER_BAD_REQUEST.code]: Me.FAILED, [le.TOKEN_PERMISSIONS_DENIED.code]: Me.TOKEN_NOT_ALLOWED, [le.OPERATION_ABORTED.code]: Me.CANCELED, [le.JOIN_TIMED_OUT.code]: Me.TIMEOUT, [le.STAGE_DELETED.code]: Me.STAGE_DELETED, [le.PARTICIPANT_DISCONNECTED.code]: Me.PARTICIPANT_DISCONNECTED, [le.EVENT_PLANE_WS_CREATE_FAILED.code]: Me.FAILED, [le.PUBLISH_TIMED_OUT.code]: Me.TIMEOUT, [le.PUBLISH_FAILURE.code]: Me.FAILED, [le.SUBSCRIBE_TIMED_OUT.code]: Me.TIMEOUT, [le.SUBSCRIBE_FAILURE.code]: Me.FAILED, [le.STAGE_AT_CAPACITY.code]: Me.STAGE_AT_CAPACITY, [le.NO_MATCHING_CODEC.code]: Me.CODEC_MISMATCH, [le.NETWORK_FAILURE.code]: Me.FAILED, [le.INTERNAL_SERVER_ERROR.code]: Me.FAILED, [le.REMOTE_STREAM_NOT_FOUND.code]: Me.FAILED, [le.INTERNAL_MHCP_ERROR.code]: Me.FAILED, [le.UNREACHABLE_MHCP.code]: Me.FAILED, [le.INVALID_SESSION_STATUS.code]: Me.FAILED, [le.MHCP_ABORTED.code]: Me.FAILED, [le.EVENT_PLANE_PONG_TIMEOUT.code]: Me.FAILED, [le.EVENT_PLANE_WS_UNEXPECTED_CLOSE.code]: Me.FAILED }, jc = { [le.SEI_INSERT_NOT_PUBLISHING_VIDEO.code]: "SEI insert failed due to not publishing video", [le.SEI_INSERT_INBAND_NOT_ENABLED.code]: "SEI insert failed due to in-band messaging not being enabled for the stage stream" };
      class jl extends Error {
        constructor(r, a, c) {
          super(), this.code = r, this.category = a, this.message = c, this.name = "StageError", this.errorDetails = [], this.message = `[${a}] ${c}`;
        }
        addDetails(r) {
          this.errorDetails.push(r);
        }
        get details() {
          return this.errorDetails.length ? JSON.stringify(this.errorDetails) : "";
        }
        toString() {
          return `
${this.message}
details - ${this.details}
        `.trim();
        }
      }
      var Fc, mo, ta;
      function Ws(s, r) {
        let a;
        if (s instanceof $e) {
          if (r === pt.JOIN_ERROR && (s.code === le.EVENT_PLANE_PONG_TIMEOUT.code || s.code === le.EVENT_PLANE_WS_UNEXPECTED_CLOSE.code)) return;
          const c = Gs[s.code];
          c && (a = function(l, n, e) {
            var t, i, o;
            const u = tl[l], d = new jl(l, n, u);
            return d.addDetails({ stageErrorMessage: u, stageErrorCode: l, stageErrorCategory: n, stageArn: (t = e.token) === null || t === void 0 ? void 0 : t.stageARN, traceId: (i = e.traceId) === null || i === void 0 ? void 0 : i.value, causeCode: e.code, causeDetails: e.details, causeMessage: e.message, causeLocation: e.location, participantId: (o = e.token) === null || o === void 0 ? void 0 : o.participantID, timeUTC: (/* @__PURE__ */ new Date()).toISOString() }), d;
          }(c, r, s));
        }
        return a;
      }
      (function(s) {
        s.ERROR = "error";
      })(Fc || (Fc = {}));
      class yu extends lt {
        constructor(r) {
          super(), this.logger = r, this.handleError = (a, c, l = !0) => {
            const n = function(t) {
              let i;
              return t instanceof $e && (i = jc[t.code]), i;
            }(a), e = Ws(a, c);
            if (n && this.logger.warn({ msg: n }), e) return l && this.emit(Fc.ERROR, e), e;
          };
        }
      }
      (function(s) {
        s.INTERNAL = "internal", s.REMOTE = "remote", s.API = "api";
      })(mo || (mo = {})), function(s) {
        s.ADDITIVE = "additive", s.REPLACE = "replace";
      }(ta || (ta = {}));
      class Fl {
        constructor(r) {
          this.logger = new Ze(r.logger, jt.CONNECTION), this.subscribeConfig = { defaults: r.subscribeDefaults, participants: {} };
        }
        handleSubscribeConfigUpdate(r, a, c, l = ta.REPLACE) {
          a = ((u) => {
            const d = vc(u);
            if (d.jitterBuffer !== void 0) {
              const h = (S) => {
                if (typeof S == "number") {
                  if (S < 0) return 0;
                  if (S > 4e3) return 4e3;
                }
                return S;
              };
              d.jitterBuffer.minDelayWhenPublishing !== void 0 && (d.jitterBuffer.minDelayWhenPublishing = h(d.jitterBuffer.minDelayWhenPublishing)), d.jitterBuffer.minDelayWhenSubscribeOnly !== void 0 && (d.jitterBuffer.minDelayWhenSubscribeOnly = h(d.jitterBuffer.minDelayWhenSubscribeOnly));
            }
            return d;
          })(a), this.subscribeConfig.participants[r] === void 0 && (this.subscribeConfig.participants[r] = { internalOverrides: {}, apiOverrides: {}, remoteOverrides: {}, lastMerged: this.subscribeConfig.defaults });
          const n = this.subscribeConfig.participants[r];
          switch (c) {
            case mo.INTERNAL:
              n.internalOverrides = this.handleSubscribeConfigLevelMerging(n.internalOverrides, a, l);
              break;
            case mo.REMOTE:
              n.remoteOverrides = this.handleSubscribeConfigLevelMerging(n.remoteOverrides, a, l);
              break;
            case mo.API:
              n.apiOverrides = this.handleSubscribeConfigLevelMerging(n.apiOverrides, a, l);
              break;
            default:
              (function(u) {
                throw new Error(`Unknown case kind: ${u}`);
              })(c);
          }
          const e = Vo(this.subscribeConfig.defaults, n.internalOverrides, n.remoteOverrides, n.apiOverrides);
          if (e === void 0) return this.logger.warn({ msg: `Unable to merge subscribe configs for participant: ${r} | ${n}, ${a}` }), !1;
          const t = (i = n.lastMerged, o = e, (typeof i == "object" && typeof o == "object" && (0, zt.isEqual)(i, o)) === !1);
          var i, o;
          return n.lastMerged = e, this.subscribeConfig.participants[r] = n, t;
        }
        handleExternalSubscribeConfigUpdate(r, a, c, l = ta.REPLACE) {
          const n = ((e) => {
            const t = {};
            return typeof e != "object" ? Re.err(new Error("Invalid input")) : (e.jitterBuffer !== void 0 && (t.jitterBuffer = {}, e.jitterBuffer.minDelay !== void 0 && (t.jitterBuffer.minDelayWhenSubscribeOnly = e.jitterBuffer.minDelay)), e.inBandMessaging !== void 0 && (t.inBandMessaging = { enabled: e.inBandMessaging.enabled === !0 }), e.simulcast !== void 0 && (t.simulcast = {}, e.simulcast.initialLayerPreference !== void 0 && (t.simulcast.initialLayerPreference = e.simulcast.initialLayerPreference)), Re.ok(t));
          })(a);
          return n.ok === !0 && this.handleSubscribeConfigUpdate(r, n.value, c, l);
        }
        handleSubscribeConfigLevelMerging(r, a, c) {
          if (c === ta.REPLACE) return a;
          {
            const l = Vo(r, a);
            return l === void 0 ? (this.logger.warn({ msg: `Unable to merge '${r}' and '${a}' with type ${c}` }), r) : l;
          }
        }
        getSubscribeConfigSnapshot(r) {
          return this.subscribeConfig.participants[r] === void 0 ? ks(this.subscribeConfig.defaults) : ks(this.subscribeConfig.participants[r].lastMerged);
        }
      }
      class Vl extends ot {
        constructor(r) {
          super(je.REASSIGNMENT_REQUEST, r.token, r.traceId, !1), Object.assign(this.properties, { target_local_participant_id: r.targetLocalParticipantId, target_remote_participant_id: r.targetRemoteParticipantId }), this.critical = !0;
        }
      }
      var xt, ct, mn, na, gi, nl = function(s, r, a, c) {
        return new (a || (a = Promise))(function(l, n) {
          function e(o) {
            try {
              i(c.next(o));
            } catch (u) {
              n(u);
            }
          }
          function t(o) {
            try {
              i(c.throw(o));
            } catch (u) {
              n(u);
            }
          }
          function i(o) {
            var u;
            o.done ? l(o.value) : (u = o.value, u instanceof a ? u : new a(function(d) {
              d(u);
            })).then(e, t);
          }
          i((c = c.apply(s, [])).next());
        });
      };
      class Vc extends lt {
        constructor(r, a) {
          super(), this.setGetStats = (c) => {
            this._getInternalStats = c;
          }, this.getStats = () => nl(this, void 0, void 0, function* () {
            return this.requestRTCStats();
          }), this.requestRTCStats = () => nl(this, void 0, void 0, function* () {
            if (!this._getInternalStats) return;
            const c = yield this._getInternalStats(this.mediaStreamTrack);
            return c ? c.rawReport : void 0;
          }), this._getInternalStats = a, this.id = r.id, this.isMuted = !r.enabled, this.mediaStreamTrack = r, this.streamType = this.mediaStreamTrack.kind === "audio" ? Je.AUDIO : Je.VIDEO;
        }
        cleanup() {
          this.removeAllListeners(), this._getInternalStats = void 0;
        }
      }
      (function(s) {
        s.IDLE = "IDLE", s.INITIALIZING = "INITIALIZING", s.ACTIVE = "ACTIVE", s.CONTROLS_PAUSED = "CONTROLS_PAUSED", s.DESTROYED = "DESTROYED";
      })(xt || (xt = {})), function(s) {
        s.LAYERS_CHANGED = "LAYERS_CHANGED", s.LAYER_SELECTED = "LAYER_SELECTED", s.ADAPTION_CHANGED = "ADAPTION_CHANGED";
      }(ct || (ct = {})), function(s) {
        s.LAYERS_CHANGED = "LAYERS_CHANGED", s.LAYER_SELECTED = "LAYER_SELECTED", s.ADAPTION_CHANGED = "ADAPTION_CHANGED";
      }(mn || (mn = {})), function(s) {
        s.UNAVAILABLE = "unavailable", s.SELECTED = "selected";
      }(na || (na = {})), function(s) {
        s.LOCAL_STREAM_MUTE_CHANGED = "localStreamMutedChanged", s.LOCAL_STREAM_INSERT_SEI_MSG_REQUEST = "localStreamInsertSeiMsgRequest";
      }(gi || (gi = {}));
      var mi, cn, En, ra = function(s, r, a, c) {
        return new (a || (a = Promise))(function(l, n) {
          function e(o) {
            try {
              i(c.next(o));
            } catch (u) {
              n(u);
            }
          }
          function t(o) {
            try {
              i(c.throw(o));
            } catch (u) {
              n(u);
            }
          }
          function i(o) {
            var u;
            o.done ? l(o.value) : (u = o.value, u instanceof a ? u : new a(function(d) {
              d(u);
            })).then(e, t);
          }
          i((c = c.apply(s, [])).next());
        });
      };
      class bu extends Vc {
        constructor(r, a) {
          super(r), this.setMuted = (c) => {
            c !== this.isMuted && (this.mediaStreamTrack.enabled = !c, this.isMuted = c, this.emit(gi.LOCAL_STREAM_MUTE_CHANGED, this));
          }, this.insertSeiMessage = (c, l) => ra(this, void 0, void 0, function* () {
            let n;
            if (this.streamType === "audio") n = Be.INVALID_TRACK_TYPE;
            else if (this.mediaConfig.inBandMessaging.enabled) {
              const e = this.validator.validateMessagePayload(c, (l == null ? void 0 : l.repeatCount) || 0);
              n = Re.getErr(e);
            } else n = Be.INBAND_MESSAGING_NOT_ENABLED;
            n ? console.warn(`Unable to insert SEI message due to ${n}`) : this.emit(gi.LOCAL_STREAM_INSERT_SEI_MSG_REQUEST, this, c, l);
          }), this.requestQualityStats = () => ra(this, void 0, void 0, function* () {
            if (!this._getInternalStats) return;
            const c = yield this._getInternalStats(this.mediaStreamTrack);
            return c ? c.stats : void 0;
          }), this.validatedExternalConfig = gu(r, a), this.normalizedConfig = Kr(0, this.validatedExternalConfig), this.mediaConfig = (0, zt.cloneDeep)(this.normalizedConfig), this.validator = new ut(Mn);
        }
      }
      class Tu {
        constructor(r, a) {
          this.strategy = r, this.logger = a;
        }
        setStrategy(r) {
          this.strategy = r;
        }
        hasStrategy(r) {
          return this.strategy[r] !== void 0;
        }
        stageStreamsToPublish() {
          let r = [];
          try {
            r = this.strategy.stageStreamsToPublish(), r = r.filter((l) => l instanceof bu);
          } catch (l) {
            return this.logger.warn({ msg: "error executing stageStreamsToPublish treating this as a no-op", err: l }), console.error("Error executing stageStreamsToPublish", l), Re.err(l);
          }
          let a = 0, c = 0;
          for (const l of r) l.mediaStreamTrack.kind === "audio" ? a++ : l.mediaStreamTrack.kind === "video" && c++;
          if (a > 1 || c > 1) {
            const l = Error("stageStreamsToPublish strategy function returned more than 1 video or audio stream and as a result will not publish", { cause: "UserStrategy" });
            return Re.err(l);
          }
          return Re.ok(r);
        }
        shouldPublishParticipant(r) {
          try {
            return Re.ok(this.strategy.shouldPublishParticipant(r));
          } catch (a) {
            return this.logger.warn({ msg: "error executing shouldPublishParticipant treating this as a no-op", err: a }), console.error("Error executing shouldPublishParticipant", a), Re.err(a);
          }
        }
        shouldSubscribeToParticipant(r) {
          try {
            return Re.ok(this.strategy.shouldSubscribeToParticipant(r));
          } catch (a) {
            return this.logger.warn({ msg: "error executing shouldSubscribeToParticipant. Treating it as a no-op", err: a }), console.error("Error executing shouldSubscribeToParticipant", a), Re.err(a);
          }
        }
        subscribeConfiguration(r) {
          var a, c;
          try {
            return Re.ok((c = (a = this.strategy).subscribeConfiguration) === null || c === void 0 ? void 0 : c.call(a, r));
          } catch (l) {
            return this.logger.warn({ msg: "error executing subscribeConfiguration. Treating it as a no-op", err: l }), console.error("Error executing subscribeConfiguration", l), Re.err(l);
          }
        }
        preferredLayerForStream(r, a) {
          var c, l;
          try {
            return Re.ok((l = (c = this.strategy).preferredLayerForStream) === null || l === void 0 ? void 0 : l.call(c, r, a));
          } catch (n) {
            return this.logger.warn({ msg: "error executing preferredLayerForStream. Treating it as a no-op", err: n }), console.error("Error executing preferredLayerForStream", n), Re.err(n);
          }
        }
      }
      class Cu extends lt {
        constructor(r, a) {
          super(), this.audioMuted = !0, this.videoStopped = !0, this.publishState = cn.NOT_PUBLISHED, this.logger = a, this.info = r, this.audioMuted = r.audioMuted, this.videoStopped = r.videoStopped;
        }
      }
      (function(s) {
        s.PUBLISH = "publish", s.SUBSCRIBE = "subscribe";
      })(mi || (mi = {})), function(s) {
        s.NOT_PUBLISHED = "not_published", s.ATTEMPTING_PUBLISH = "attempting_publish", s.PUBLISHED = "published", s.ERRORED = "errored";
      }(cn || (cn = {})), function(s) {
        s.NOT_SUBSCRIBED = "not_subscribed", s.ATTEMPTING_SUBSCRIBE = "attempting_subscribe", s.SUBSCRIBED = "subscribed", s.ERRORED = "errored";
      }(En || (En = {}));
      function rl(s) {
        return s.map((r) => r.remote);
      }
      function Gl(s) {
        return { label: s.encodingId, bitrateBps: 1e3 * s.bitrate, width: s.width, height: s.height, framesPerSecond: s.framesPerSecond, selected: s.selected };
      }
      function il(s, r) {
        const a = s.width * s.height, c = r.width * r.height;
        return a > c || s.bitrateBps > r.bitrateBps || s.framesPerSecond > r.framesPerSecond ? 1 : a === c && s.bitrateBps === r.bitrateBps && s.framesPerSecond === r.framesPerSecond ? 0 : -1;
      }
      var Iu = function(s, r, a, c) {
        return new (a || (a = Promise))(function(l, n) {
          function e(o) {
            try {
              i(c.next(o));
            } catch (u) {
              n(u);
            }
          }
          function t(o) {
            try {
              i(c.throw(o));
            } catch (u) {
              n(u);
            }
          }
          function i(o) {
            var u;
            o.done ? l(o.value) : (u = o.value, u instanceof a ? u : new a(function(d) {
              d(u);
            })).then(e, t);
          }
          i((c = c.apply(s, [])).next());
        });
      };
      class ol extends lt {
        constructor(r) {
          var a, c, l;
          super(), this.onAdaptionChanged = (n) => {
            this.emit(mn.ADAPTION_CHANGED, n);
          }, this.onLayersChanged = (n) => {
            this.emit(mn.LAYERS_CHANGED, n);
          }, this.onLayerSelected = (n, e) => {
            this.emit(mn.LAYER_SELECTED, n, e);
          }, this.setGetStats = () => {
          }, this.requestRTCStats = () => Iu(this, void 0, void 0, function* () {
            var n;
            return (n = this.internalStream) === null || n === void 0 ? void 0 : n.requestRTCStats();
          }), this.requestQualityStats = () => Iu(this, void 0, void 0, function* () {
            if (this.internalStream) try {
              const n = yield this.internalStream.getInternalStats();
              return n ? n.stats : void 0;
            } catch {
              return;
            }
          }), this.getStats = () => Iu(this, void 0, void 0, function* () {
            var n;
            return (n = this.internalStream) === null || n === void 0 ? void 0 : n.requestRTCStats();
          }), this.setMuted = (n) => {
            var e;
            (e = this.internalStream) === null || e === void 0 || e.setMuted(n);
          }, this.getLayers = () => {
            var n, e;
            return (e = (n = this.internalStream) === null || n === void 0 ? void 0 : n.layers) !== null && e !== void 0 ? e : this.cachedLayers;
          }, this.getSelectedLayer = () => {
            var n, e;
            return (e = (n = this.internalStream) === null || n === void 0 ? void 0 : n.selectedLayer) !== null && e !== void 0 ? e : this.cachedSelectedLayer;
          }, this.getLowestQualityLayer = () => {
            var n, e;
            return (e = (n = this.internalStream) === null || n === void 0 ? void 0 : n.lowestQualityLayer) !== null && e !== void 0 ? e : this.cachedLowestLowestLayer;
          }, this.getHighestQualityLayer = () => {
            var n, e;
            return (e = (n = this.internalStream) === null || n === void 0 ? void 0 : n.highestQualityLayer) !== null && e !== void 0 ? e : this.cachedHighestQualityLayer;
          }, this.internalStream = r, this.cachedId = this.internalStream.id, this.cachedParticipantInfo = (0, zt.cloneDeep)(this.internalStream.participantInfo), this.cachedStreamType = this.internalStream.streamType, this.cachedMediaStreamTrack = (l = (c = (a = this.internalStream.mediaStreamTrack).clone) === null || c === void 0 ? void 0 : c.call(a)) !== null && l !== void 0 ? l : {}, this.cachedIsMuted = this.internalStream.isMuted, this.cachedIsAdapting = this.internalStream.isAdapting, this.cachedLayers = this.internalStream.layers, this.updateCachedStreamData(), this.internalStream.on(ct.ADAPTION_CHANGED, this.onAdaptionChanged), this.internalStream.on(ct.LAYERS_CHANGED, this.onLayersChanged), this.internalStream.on(ct.LAYER_SELECTED, this.onLayerSelected);
        }
        updateCachedStreamData() {
          var r, a, c, l, n;
          this.cachedLayers = (a = (r = this.internalStream) === null || r === void 0 ? void 0 : r.layers) !== null && a !== void 0 ? a : [], this.cachedHighestQualityLayer = (c = this.internalStream) === null || c === void 0 ? void 0 : c.highestQualityLayer, this.cachedLowestLowestLayer = (l = this.internalStream) === null || l === void 0 ? void 0 : l.lowestQualityLayer, this.cachedSelectedLayer = (n = this.internalStream) === null || n === void 0 ? void 0 : n.selectedLayer;
        }
        get id() {
          var r, a;
          return (a = (r = this.internalStream) === null || r === void 0 ? void 0 : r.id) !== null && a !== void 0 ? a : this.cachedId;
        }
        get participantInfo() {
          var r, a;
          return (a = (r = this.internalStream) === null || r === void 0 ? void 0 : r.participantInfo) !== null && a !== void 0 ? a : this.cachedParticipantInfo;
        }
        get streamType() {
          var r, a;
          return (a = (r = this.internalStream) === null || r === void 0 ? void 0 : r.streamType) !== null && a !== void 0 ? a : this.cachedStreamType;
        }
        get mediaStreamTrack() {
          var r, a;
          return (a = (r = this.internalStream) === null || r === void 0 ? void 0 : r.mediaStreamTrack) !== null && a !== void 0 ? a : this.cachedMediaStreamTrack;
        }
        get isMuted() {
          var r, a;
          return (a = (r = this.internalStream) === null || r === void 0 ? void 0 : r.isMuted) !== null && a !== void 0 ? a : this.cachedIsMuted;
        }
        set isMuted(r) {
          var a;
          (a = this.internalStream) === null || a === void 0 || a.setMuted(r);
        }
        get isAdapting() {
          var r, a;
          return (a = (r = this.internalStream) === null || r === void 0 ? void 0 : r.isAdapting) !== null && a !== void 0 ? a : this.cachedIsAdapting;
        }
        cleanup() {
          var r, a, c;
          this.updateCachedStreamData(), (r = this.internalStream) === null || r === void 0 || r.off(ct.ADAPTION_CHANGED, this.onAdaptionChanged), (a = this.internalStream) === null || a === void 0 || a.off(ct.LAYERS_CHANGED, this.onLayersChanged), (c = this.internalStream) === null || c === void 0 || c.off(ct.LAYER_SELECTED, this.onLayerSelected), this.internalStream = void 0, this.removeAllListeners();
        }
      }
      var Ka, Ja, Ru = function(s, r, a, c) {
        return new (a || (a = Promise))(function(l, n) {
          function e(o) {
            try {
              i(c.next(o));
            } catch (u) {
              n(u);
            }
          }
          function t(o) {
            try {
              i(c.throw(o));
            } catch (u) {
              n(u);
            }
          }
          function i(o) {
            var u;
            o.done ? l(o.value) : (u = o.value, u instanceof a ? u : new a(function(d) {
              d(u);
            })).then(e, t);
          }
          i((c = c.apply(s, [])).next());
        });
      };
      class al extends Vc {
        constructor({ track: r, info: a, getStats: c, remotePlaybackController: l, analyticsTracker: n, token: e, subscribeConfig: t }) {
          super(r, c), this.hasRemoteListenersForLayerEvents = () => {
            const o = this.remote;
            return o.hasListenersFor(mn.ADAPTION_CHANGED) || o.hasListenersFor(mn.LAYERS_CHANGED) || o.hasListenersFor(mn.LAYER_SELECTED);
          }, this.setMuted = (o) => {
            this.isMuted = o, this.mediaStreamTrack.enabled = !o;
          }, this.setLayer = (o) => {
            const u = (0, zt.cloneDeep)(o);
            if (this.queueLayerUpdateForValidState(u)) return void this.logger.debug({ msg: `setLayer:${u} queued, skipping for now` });
            const d = function(S, T) {
              if (!S) return (0, Re.ok)(void 0);
              const I = typeof S == "string" ? S : S.label, R = T.filter((w) => w.label === I)[0];
              return R ? (0, Re.ok)(R) : (0, Re.err)(`Provided layer with id ${I} does not exist`);
            }(u, this._layers);
            if (!d.ok) {
              const S = d.error;
              return void this.logger.error({ err: S, msg: "Unable to select layer, skipping selection" });
            }
            const h = d.value;
            if (this.isNextUpdateAdaptionOnly(h)) return this.logger.warn({ msg: "setLayer:dynamic" }), void this.handleDynamicUpdate();
            this.isFirstLayerUpdate() || !this.isRepeatLayerSelection(h) || this.isAdapting ? h && (this.logger.warn({ msg: `setLayer:${JSON.stringify(h)} ` }), this.handleManualUpdate(h)) : this.logger.debug({ msg: "Setting the same layer, same adaption state, skipping selection" });
          }, this.state = xt.INITIALIZING, this.prevState = xt.IDLE, this.analyticsTracker = n, this.token = e, this.id = r.id, this.info = a, this.mediaStreamTrack = r, this.remotePlaybackController = l, this.layerPollingIntervalId = null, this.weakRemoteMap = /* @__PURE__ */ new WeakMap(), this.weakRemoteKey = { id: "remote" }, this.commandMap = /* @__PURE__ */ new Map(), this.subscribeConfig = t, this._isAdapting = !0, this._layers = [], this._selectedLayer = null;
          const i = Zs();
          this.logger = new Ze(new Pe(i), jt.REMOTE_STAGE_STREAM), this.streamType === Je.AUDIO ? this.isMuted = a.audioMuted : this.isMuted = a.videoStopped, this.initializeLayerPolling(), this.pollInternalLayers(!0);
        }
        transitionStateTo(r) {
          this.state !== r && (this.prevState = this.state, this.state = r);
        }
        initializeLayerPolling() {
          ys(this.mediaStreamTrack) ? this.streamType !== Je.AUDIO ? (this.logger.debug({ msg: "Setting up RemoteStageStream, requesting initial layers" }), this.layerPollingIntervalId !== null && clearInterval(this.layerPollingIntervalId), this.layerPollingIntervalId = setInterval(() => {
            this.pollInternalLayers();
          }, this.subscribeConfig.simulcast.layerPollingIntervalMs)) : this.logger.debug({ msg: "Skipping initializing polling for audio streams" }) : this.logger.debug({ msg: "Skipping initializing polling, media track is not active" });
        }
        startLayerPolling() {
          this.layerPollingIntervalId === null ? this.initializeLayerPolling() : this.logger.debug({ msg: "Skipping start polling request, already started" });
        }
        stopLayerPolling() {
          this.layerPollingIntervalId !== null ? (clearInterval(this.layerPollingIntervalId), this.layerPollingIntervalId = null) : this.logger.debug({ msg: "Skipping stop polling request, already stopped" });
        }
        pollInternalLayers(r = !1) {
          if (!ys(this.mediaStreamTrack)) return void this.pauseControls();
          if (this.streamType === Je.AUDIO) return this.logger.debug({ msg: "Skipping layer poll request for audio stream" }), void this.transitionStateTo(xt.ACTIVE);
          const a = !this.hasRemoteListenersForLayerEvents(), c = !this.subscribeConfig.simulcast.layerPollingEnabled;
          !r && a && c ? this.logger.debug({ msg: "Skipping layer request due to no listeners" }) : this.remotePlaybackController.getLayers().then((l) => {
            if (this.isStateValidForLayerUpdates()) {
              if (!l.ok) throw Error(l.error);
              this.updateInternalLayersFromRemote(l.value), this.transitionStateTo(xt.ACTIVE), this.flushCommandQueue();
            } else this.logger.warn({ msg: "Stream controls have been paused, skipping getLayers" });
          }).catch((l) => {
            this.logger.error({ err: l, msg: "Error calling getLayers, returning current layers" });
          });
        }
        updateInternalLayersFromRemote(r) {
          const a = this._layers, c = r.map(Gl).sort(il), l = !(0, zt.isEqual)(c, a);
          this._layers = c;
          const n = this._selectedLayer, e = this._layers.filter((i) => i.selected)[0], t = !(0, zt.isEqual)(e, n);
          n && (n.selected = !1), this._selectedLayer = e, t && (this.trackLayerUpdate(n), this.trackLayerUpdate(e)), this.isCommandQueueEmpty() && (l && this.emitLayersChanged(), t && this.emitLayerSelected(e));
        }
        flushCommandQueue() {
          if (this.isCommandQueueEmpty()) return;
          const r = Array.from(this.commandMap.keys());
          this.logger.debug({ msg: `Flushing active commands from map ${r}` });
          for (const a of this.commandMap.keys()) {
            const c = this.commandMap.get(a);
            c == null || c();
          }
          this.commandMap.clear();
        }
        queueLayerUpdateForValidState(r) {
          if (!r) return this.commandMap.delete("setLayer"), !1;
          if (this.state === xt.INITIALIZING) {
            const a = this.setLayer.bind(this, r);
            return this.commandMap.set("setLayer", a), !0;
          }
          return !1;
        }
        handleDynamicUpdate() {
          if (!this.isStateValidForLayerUpdates()) return void this.logger.warn({ msg: "Stream controls have been paused, skipping dynamic mode transition" });
          const r = this._isAdapting;
          this._isAdapting = !0, this.emitAdaptionChanged(), this.remotePlaybackController.unsetLayer().then((a) => {
            if (!this.isStateValidForLayerUpdates()) return this.logger.warn({ msg: "Stream controls have been paused, skipping dynamic mode transition" }), void this.resetAdaptionStateOnError(r, `Stream in invalid state: ${this.state}`);
            a.ok ? this.logger.debug({ msg: "Layer successfully unset, restarting dynamic adaption" }) : this.resetAdaptionStateOnError(r, a.error);
          }).catch(() => {
          });
        }
        resetAdaptionStateOnError(r, a) {
          this._isAdapting = r, this.emitAdaptionChanged(), this.logger.error({ err: a, msg: "Error unsetting layer, reverting adaption state" });
        }
        handleManualUpdate(r) {
          if (!this.isStateValidForLayerUpdates()) return void this.logger.warn({ msg: "Stream controls have been paused, skipping manual updates" });
          const a = this._isAdapting, c = this._selectedLayer;
          c && (c.selected = !1), this._isAdapting = !1, this._selectedLayer = r, r.selected = !0, a !== this._isAdapting && this.emitAdaptionChanged(), this.updateLocalLayerStateBeforeRemote(r, c), this.trackLayerUpdate(c), this.trackLayerUpdate(r), this.emitLayersChanged(), this.emitLayerSelected(r), this.remotePlaybackController.setLayer(r.label).then((l) => {
            if (!this.isStateValidForLayerUpdates()) {
              this.logger.warn({ msg: "Stream controls have been paused, skipping dynamic mode transition" });
              const n = `Stream in invalid state: ${this.state}`;
              return this.resetAdaptionStateOnError(a, n), void this.resetLayerOnError(c, r, n);
            }
            if (!l.ok) {
              const n = l.error;
              return this.resetAdaptionStateOnError(a, n), void this.resetLayerOnError(c, r, n);
            }
            this.logger.debug({ msg: `Layer successfully selected: ${r.label}` });
          }).catch(() => {
          });
        }
        applyExistingControlState() {
          var r;
          this._isAdapting ? this.remotePlaybackController.unsetLayer().then(() => {
          }).catch(() => {
          }) : !((r = this._selectedLayer) === null || r === void 0) && r.label && this.remotePlaybackController.setLayer(this._selectedLayer.label).then(() => {
          }).catch(() => {
          });
        }
        resetLayerOnError(r, a, c) {
          a && (a.selected = !1), r && (r.selected = !0), this._selectedLayer = r, this.logger.error({ err: c, msg: "Error unsetting layer, leaving current selection in place" }), this.updateLocalLayerStateBeforeRemote(r, a), this.emitLayersChanged(), r !== null && this.emitLayerSelected(r, na.UNAVAILABLE), this.trackLayerUpdate(a), this.trackLayerUpdate(r);
        }
        updateLocalLayerStateBeforeRemote(r, a) {
          this._layers = this._layers.map((c) => c.label === (r == null ? void 0 : r.label) ? r : c.label === (a == null ? void 0 : a.label) ? a : c).sort(il);
        }
        trackLayerUpdate(r) {
          var a, c;
          this.analyticsTracker.trackEventNoSharedProps(new Ua(this.token, Jn(), (a = r == null ? void 0 : r.label) !== null && a !== void 0 ? a : "auto", !0, me.SUBSCRIBE, (c = r == null ? void 0 : r.selected) !== null && c !== void 0 && c, this.info.id));
        }
        isNextUpdateAdaptionOnly(r) {
          return r === void 0 && this.isFirstLayerUpdate() || r === void 0 && !this.isAdapting;
        }
        isFirstLayerUpdate() {
          return this._selectedLayer === null;
        }
        isRepeatLayerSelection(r) {
          var a;
          return ((a = this._selectedLayer) === null || a === void 0 ? void 0 : a.label) === (r == null ? void 0 : r.label);
        }
        isStateValidForLayerUpdates() {
          return this.state === xt.ACTIVE || this.state === xt.INITIALIZING;
        }
        isCommandQueueEmpty() {
          return this.commandMap.size === 0;
        }
        emitLayerSelected(r, a = na.SELECTED) {
          this.logger.debug({ msg: `Emitting layers selected ${JSON.stringify(r, null, 2)}` }), this.emit(ct.LAYER_SELECTED, (0, zt.cloneDeep)(r), a);
        }
        emitLayersChanged() {
          this.emit(ct.LAYERS_CHANGED, (0, zt.cloneDeep)(this._layers));
        }
        emitAdaptionChanged() {
          this.emit(ct.ADAPTION_CHANGED, this._isAdapting);
        }
        get remote() {
          const r = this.weakRemoteMap.get(this.weakRemoteKey);
          if (r) return r;
          const a = new ol(this);
          return this.weakRemoteMap.set(this.weakRemoteKey, a), a;
        }
        get participantInfo() {
          return (0, zt.cloneDeep)(this.info);
        }
        get isAdapting() {
          return this._isAdapting;
        }
        get layers() {
          return (0, zt.cloneDeep)(this._layers);
        }
        get selectedLayer() {
          var r;
          return (0, zt.cloneDeep)((r = this._selectedLayer) !== null && r !== void 0 ? r : void 0);
        }
        get highestQualityLayer() {
          return (0, zt.cloneDeep)(this.layers[this.layers.length - 1]);
        }
        get lowestQualityLayer() {
          return (0, zt.cloneDeep)(this.layers[0]);
        }
        getInternalStats() {
          return Ru(this, void 0, void 0, function* () {
            if (this._getInternalStats) return this._getInternalStats(this.mediaStreamTrack);
          });
        }
        pauseControls() {
          this.transitionStateTo(xt.CONTROLS_PAUSED), this.stopLayerPolling();
        }
        resumeControls() {
          this.applyExistingControlState(), this.startLayerPolling(), this.transitionStateTo(xt.ACTIVE);
        }
        updateSubscribeConfig(r) {
          const a = this.subscribeConfig;
          this.subscribeConfig = r, a.simulcast.layerPollingIntervalMs !== r.simulcast.layerPollingIntervalMs && this.isStateValidForLayerUpdates() && this.initializeLayerPolling();
        }
        cleanup() {
          this.transitionStateTo(xt.DESTROYED), super.cleanup(), this.weakRemoteMap.delete(this.weakRemoteKey), this.stopLayerPolling(), this._layers = [], this._selectedLayer = null, this._isAdapting = !0, this.commandMap.clear();
        }
      }
      (function(s) {
        s.STATE_CHANGE = "stateChange", s.MEDIA_STREAM_ADDED = "mediaStreamAdded", s.MEDIA_STREAM_REMOVED = "mediaStreamRemoved", s.MEDIA_STREAM_MUTE_CHANGED = "mediaStreamMuteChanged", s.ERROR = "error";
      })(Ka || (Ka = {})), function(s) {
        s.SUBSCRIPTION_STATE_CHANGE = "subscriptionStateChange", s.MEDIA_STREAM_SEI_MESSAGE_RECEIVED = "mediaStreamSeiMessageReceived";
      }(Ja || (Ja = {}));
      const Hn = Object.assign(Object.assign({}, Ka), Ja);
      var Hs;
      (function(s) {
        s.PUBLICATION_STATE_CHANGE = "publicationStateChange";
      })(Hs || (Hs = {}));
      const vo = Object.assign(Object.assign({}, Ka), Hs);
      var yr = function(s, r, a, c) {
        return new (a || (a = Promise))(function(l, n) {
          function e(o) {
            try {
              i(c.next(o));
            } catch (u) {
              n(u);
            }
          }
          function t(o) {
            try {
              i(c.throw(o));
            } catch (u) {
              n(u);
            }
          }
          function i(o) {
            var u;
            o.done ? l(o.value) : (u = o.value, u instanceof a ? u : new a(function(d) {
              d(u);
            })).then(e, t);
          }
          i((c = c.apply(s, [])).next());
        });
      };
      class Xn extends Cu {
        constructor(r, a, c, l, n, e, t, i = !1) {
          super(r, new Ze(l, jt.REMOTE_PARTICIPANT)), this.subscribeState = En.NOT_SUBSCRIBED, this.reassigning = !1, this.streams = [], this.left = !1, this.onSubscriptionStateChange = (o) => {
            this.logger.debug({ msg: "subscriptionStateChange", state: o }), o === tn.DISCONNECTED ? this.updateSubscriptionState(En.NOT_SUBSCRIBED) : o === tn.CONNECTED ? this.updateSubscriptionState(En.SUBSCRIBED) : o === tn.CONNECTING ? this.updateSubscriptionState(En.ATTEMPTING_SUBSCRIBE) : o === tn.ERRORED ? (this.emitStreamsRemovedByType(this.getDesiredSubscribeType()), this.cleanupStreams(), this.updateSubscriptionState(En.ERRORED)) : this.logger.warn({ msg: "FIXME onSubscriptionStateChange UNHANDLED STATE", state: o });
          }, this.onSubscriptionStreamRemoved = () => {
            this.logger.debug({ msg: "onSubscriptionStreamRemoved" }), this.emitStreamsRemovedByType(this.getDesiredSubscribeType()), this.cleanupStreams();
          }, this.onSubscriptionStreamCreated = (o, u) => {
            this.logger.debug({ msg: "onSubscriptionStreamCreated", stream: o }), this.pruneInactiveStreams();
            let d = o.getTracks().map((h) => {
              const S = new al({ track: h, info: this.info, getStats: this.subscription.requestRTCStats, remotePlaybackController: u, analyticsTracker: this.analyticsTracker, token: this.token, subscribeConfig: this.subscribeConfig });
              return this.streams.push(S), S;
            });
            this.subscription.getDesiredSubscribeType() === Ne.AUDIO_ONLY && (d = d.filter((h) => h.streamType !== Je.VIDEO)), this.emit(Hn.MEDIA_STREAM_ADDED, d);
          }, this.onSubscriptionError = (o) => {
            this.emit(Hn.ERROR, o);
          }, this.onSubscriptionSeiMessageReceived = (o) => {
            this.emit(Hn.MEDIA_STREAM_SEI_MESSAGE_RECEIVED, o);
          }, this.onSubscriptionTransformError = (o) => {
            this.emit(Hn.ERROR, o);
          }, this.onSubscriptionReassignmentStart = () => {
            for (const o of this.streams) o.pauseControls();
          }, this.onSubscriptionReassignmentDone = () => {
            for (const o of this.streams) o.resumeControls();
          }, this.updateSubscribeStateIfNecessary = (o, u) => {
            if (!this.info.capabilities.has(mi.SUBSCRIBE)) return;
            u !== void 0 && (this.subscribeConfig = u, this.subscription.updateSubscribeConfig(u), this.streams.forEach((S) => {
              S.updateSubscribeConfig(u);
            }));
            const d = o !== Ne.NONE && this.publishState === cn.PUBLISHED, h = this.subscribeState !== En.NOT_SUBSCRIBED && this.subscribeState !== En.ERRORED;
            if (d && !h) this.subscription.updateDesiredSubscribeType(o), this.subscribe();
            else if (!d && h) this.unsubscribe(), this.subscription.updateDesiredSubscribeType(o);
            else if (this.subscribeState === En.SUBSCRIBED && this.subscription.getDesiredSubscribeType() !== o) try {
              o === Ne.AUDIO_ONLY ? this.emit(Hn.MEDIA_STREAM_REMOVED, this.filterStreamsByType(this.streams, Je.VIDEO)) : o === Ne.AUDIO_VIDEO && this.emit(Hn.MEDIA_STREAM_ADDED, this.filterStreamsByType(this.streams, Je.VIDEO)), this.subscription.updateDesiredSubscribeType(o);
            } catch (S) {
              this.logger.error({ err: S, msg: "error updating subscribe type" });
            }
          }, this.updatePublishState = (o) => {
            const u = o && this.publishState === cn.PUBLISHED, d = !o && this.publishState === cn.NOT_PUBLISHED;
            return !u && !d && (this.info.isPublishing = o, this.publishState = o ? cn.PUBLISHED : cn.NOT_PUBLISHED, !0);
          }, this.updateStreamState = (o, u) => {
            this.audioMuted !== o && (this.audioMuted = o, this.info.audioMuted = o, this.updateStreamMuteState(Je.AUDIO, o)), this.videoStopped !== u && (this.videoStopped = u, this.info.videoStopped = u, this.updateStreamMuteState(Je.VIDEO, u));
          }, this.updateStreamMuteState = (o, u) => {
            const d = this.filterStreamsByType(this.streams, o), h = d[d.length - 1];
            if (!h) {
              const S = `state update received for ${this.info.id} for non-existent ${o} stream`;
              return this.logger.warn({ msg: S }), void this.traceRemoteParticipantMsg(S);
            }
            h.setMuted(u), this.emit(Hn.MEDIA_STREAM_MUTE_CHANGED, h);
          }, this.cleanup = () => {
            this.removeAllListeners();
          }, this.quickUnsubscribe = () => this.subscribeState !== En.NOT_SUBSCRIBED && this.subscription.stop(!0), this.getDesiredSubscribeType = () => this.subscription.getDesiredSubscribeType(), this.isReassigning = () => this.reassigning, this.analyticsTracker = t, this.token = a, this.subscribeConfig = e, this.createSubscription = () => {
            const o = new Lr(r.id, a, c, l, t, n, e);
            return o.on(Cs, this.onSubscriptionStateChange), o.on(Is, this.onSubscriptionStreamCreated), o.on(ui, this.onSubscriptionStreamRemoved), o.on(jn, this.onSubscriptionError), o.on(uc, this.onSubscriptionSeiMessageReceived), o.on(au, this.onSubscriptionTransformError), o.on(so, this.onSubscriptionReassignmentStart), o.on(lc, this.onSubscriptionReassignmentDone), o.on(bt, this.onSubscriptionReassignmentDone), o;
          }, this.subscription = this.createSubscription(), i && (this.publishState = cn.PUBLISHED);
        }
        updateSubscriptionState(r) {
          r !== this.subscribeState && (this.subscribeState = r, this.emit(Hn.SUBSCRIPTION_STATE_CHANGE, this.subscribeState));
        }
        pruneInactiveStreams() {
          const r = [];
          this.streams = this.streams.filter((n) => !!ys(n.mediaStreamTrack) || (r.push(n), !1));
          const a = r.length;
          if (a === 0) return;
          const c = this.filterStreamsByType(r, Je.AUDIO).length, l = a - c;
          this.traceRemoteParticipantMsg(`Pruning inactive streams (${c} audio, ${l} video)`), this.emitStreamsRemoved(r), r.forEach((n) => {
            n.remote.cleanup(), n.cleanup();
          });
        }
        filterStreamsByType(r, a) {
          return r.filter((c) => c.streamType === a);
        }
        participantLeave() {
          this.left = !0;
        }
        subscribe() {
          this.left ? this.logger.warn({ msg: "tried to subscribe to a participant that left" }) : (this.updateSubscriptionState(En.ATTEMPTING_SUBSCRIBE), this.logger.debug({ msg: "subscribe" }), this.subscription.start());
        }
        unsubscribe() {
          if (this.subscribeState === En.NOT_SUBSCRIBED) return;
          this.logger.debug({ msg: "unsubscribe" }), this.subscription.stop(), this.subscription.off(Cs, this.onSubscriptionStateChange), this.subscription.off(Is, this.onSubscriptionStreamCreated), this.subscription.off(ui, this.onSubscriptionStreamRemoved), this.subscription.off(jn, this.onSubscriptionError), this.subscription.off(au, this.onSubscriptionTransformError);
          const r = this.getDesiredSubscribeType();
          this.subscription = this.createSubscription(), this.emitStreamsRemovedByType(r), this.updateSubscriptionState(En.NOT_SUBSCRIBED), this.cleanupStreams();
        }
        emitStreamsRemovedByType(r) {
          switch (r) {
            case Ne.AUDIO_VIDEO:
              this.emitStreamsRemoved(this.streams);
              break;
            case Ne.AUDIO_ONLY:
              this.emitStreamsRemoved(this.filterStreamsByType(this.streams, Je.AUDIO));
            case Ne.NONE:
          }
        }
        emitStreamsRemoved(r) {
          this.emit(Hn.MEDIA_STREAM_REMOVED, r);
        }
        cleanupStreams() {
          this.streams.length !== 0 && (this.logger.debug({ msg: "Cleaning up streams due to internal removal" }), this.streams.forEach((r) => {
            r.remote.cleanup(), r.cleanup();
          }), this.streams = []);
        }
        traceRemoteParticipantMsg(r) {
          this.analyticsTracker.trackEventNoSharedProps(new uo(this.token, Jn(), r, me.SUBSCRIBE, this.info.id));
        }
        triggerIceRestart(r) {
          return yr(this, void 0, void 0, function* () {
            this.reassigning = !0;
            try {
              yield this.subscription.triggerIceRestart(r);
            } finally {
              this.reassigning = !1;
            }
          });
        }
      }
      const Gc = me.PUBLISH;
      function sl(s, r, a) {
        return new $e(Object.assign(Object.assign({}, s), { token: r, traceId: a, location: "stage-publication.sendSeiMessage", tag: Qt, action: me.PUBLISH }));
      }
      class wu {
        constructor(r, a) {
          this.analyticsTracker = r, this.token = a, this.action = Gc, this.traceId = Jn();
        }
        trackPublish(r) {
          const { action: a, traceId: c, analyticsTracker: l, token: n } = this;
          return l.trackEvent(new Ol({ token: n, traceId: c })), { getTraceId: () => c, trackPublishStarted({ totalDurationWithRetries: e, retryTimes: t, sfuResource: i, peerClientPerfStats: o, protocol: u }) {
            const { optionsDuration: d, postDuration: h, timeToCandidate: S, timeToConnected: T, sdpExchangeDuration: I, sdpExchangeTransport: R, setRemoteDescDuration: w, peerConnectionDuration: P } = o, { edpInitialConnectDuration: B, edpInitialConnectRetries: j, edpInitialStateDuration: x, edpStateUpdateCount: H } = r;
            l.trackEvent(new Al({ token: n, traceId: c, optionsDuration: d, postDuration: h, timeToCandidate: S, totalDuration: T, edpInitialConnectDuration: B, edpInitialConnectRetries: j, edpInitialStateDuration: x, edpStateUpdateCount: H, sdpExchangeDuration: I, sdpExchangeTransport: R, setRemoteDescDuration: w, peerConnectionDuration: P, publishRetries: t, totalDurationWithRetries: e, sfuResource: i, protocol: u }));
          }, trackPublishFailed(e, t) {
            const i = ((u, d, h) => {
              if (u instanceof $e) return u;
              let S = "";
              return u instanceof oo.AxiosError && (S += `AxiosError - ${u.code}`), new $e(Object.assign(Object.assign(Object.assign({}, le.PUBLISH_FAILURE), { action: Gc, token: d, traceId: h, tag: Qt, location: "publish", details: `${S} ${u.message}` }), { fatal: !0 }));
            })(e, n, c);
            l.trackEvent(new kl({ token: n, traceId: c, code: i.code, message: i.message, fatal: i.fatal, nominal: i.nominal, protocol: t }));
            const o = new $e(Object.assign(Object.assign({}, le.PUBLISH_FAILURE), { action: a, token: n, traceId: c, tag: Qt, location: "publish" }));
            return e instanceof $e && (o.fatal = e.fatal, o.nominal = e.nominal, o.location = `publish > ${e.location}`), l.trackError(o), i;
          }, trackUnpublish: () => {
            l.trackEvent(new mu({ token: n, traceId: c }));
          }, trackEndSucceeded: (e, t) => {
            l.trackEvent(new Yu({ token: n, isUnpublishSuccessful: !0, traceId: c, reason: e, protocol: t }));
          }, trackEndFailed: (e, t) => {
            const i = new $e(Object.assign(Object.assign({}, le.UNPUBLISH_FAILURE), { token: n, traceId: c, tag: Ae, location: "unpublish" }));
            return e !== or.UNLOAD && e !== or.UNPUBLISH || this.analyticsTracker.trackError(i), l.trackEvent(new Yu({ token: n, isUnpublishSuccessful: !1, traceId: c, reason: e, protocol: t })), i;
          }, createSeiNotPublishingVideoError: () => sl(le.SEI_INSERT_NOT_PUBLISHING_VIDEO, n, c), createSeiInBandMessagingNotEnabledError: () => sl(le.SEI_INSERT_INBAND_NOT_ENABLED, n, c) };
        }
      }
      var yn, Zn, _o = function(s, r, a, c) {
        return new (a || (a = Promise))(function(l, n) {
          function e(o) {
            try {
              i(c.next(o));
            } catch (u) {
              n(u);
            }
          }
          function t(o) {
            try {
              i(c.throw(o));
            } catch (u) {
              n(u);
            }
          }
          function i(o) {
            var u;
            o.done ? l(o.value) : (u = o.value, u instanceof a ? u : new a(function(d) {
              d(u);
            })).then(e, t);
          }
          i((c = c.apply(s, [])).next());
        });
      };
      (function(s) {
        s.DISCONNECTED = "disconnected", s.CONNECTING = "connecting", s.CONNECTED = "connected", s.ERRORED = "errored";
      })(yn || (yn = {})), function(s) {
        s.STATE_CHANGE = "stateChange", s.ERROR = "error", s.TRANSFORM_ERROR = "transformError";
      }(Zn || (Zn = {}));
      class Wl extends lt {
        constructor(r, a, c, l) {
          super(), this.token = r, this.stageConnection = a, this.nonScopedLogger = c, this.analyticsTracker = l, this.streamsToPublish = [], this.publicationState = yn.DISCONNECTED, this.latestPubAttemptNum = 0, this.startConnectingTimestamp = -1, this.action = me.PUBLISH, this.start = (n) => {
            this.publicationState === yn.DISCONNECTED || this.publicationState === yn.ERRORED ? (this.streamsToPublish = n, this.latestPubAttemptNum = 0, this.processStateUpdate()) : this.logger.warn({ msg: "publication cannot be started if not in disconnected or error state" });
          }, this.requestRTCStats = (n) => _o(this, void 0, void 0, function* () {
            return this.peerClient.requestRTCStats(n);
          }), this.stop = (n = !1) => _o(this, void 0, void 0, function* () {
            this.peerClient.off(Rt, this.onPeerClientConnectionStateChange), this.peerClient.off(Hr, this.onPeerClientTransformError), yield this.unpublish(n), this.updateState(yn.DISCONNECTED);
          }), this.processStateUpdate = (n) => {
            const { publicationState: e } = this;
            e === yn.DISCONNECTED || e === yn.ERRORED ? this.latestPubAttemptNum === 0 && (this.startConnectingTimestamp = performance.now(), this.updateState(yn.CONNECTING), this.tryPublish()) : e === yn.CONNECTING ? n === xe.CONNECTED && this.updateState(yn.CONNECTED) : e === yn.CONNECTED && n === xe.FAILED && (this.attemptTracker && this.attemptTracker.trackEndFailed(or.CONNECTION_FAIL, this.peerClient.getProtocol()), this.latestPubAttemptNum === 0 && (this.startConnectingTimestamp = performance.now(), this.updateState(yn.CONNECTING), this.tryPublish()));
          }, this.updateState = (n) => {
            this.publicationState = n, this.emit(Zn.STATE_CHANGE, n);
          }, this.tryPublish = () => _o(this, void 0, void 0, function* () {
            if (this.latestPubAttemptNum++, this.latestPubAttemptNum <= 4) {
              const n = this.stageConnection.getConnectionStats();
              this.attemptTracker = this.publishTracker.trackPublish(n);
              try {
                this.logger.debug({ msg: `attempting to publish, attemptNum: ${this.latestPubAttemptNum}` }), yield this.publish(this.streamsToPublish, this.attemptTracker.getTraceId()), this.logger.debug({ msg: "publish succeeded!" });
                const e = this.peerClient.getSfuResource(), t = this.latestPubAttemptNum - 1, i = performance.now() - this.startConnectingTimestamp, o = this.peerClient.getActionMeasurements();
                this.attemptTracker.trackPublishStarted({ sfuResource: e, totalDurationWithRetries: i, retryTimes: t, peerClientPerfStats: o, protocol: this.peerClient.getProtocol() }), this.latestPubAttemptNum = 0;
              } catch (e) {
                this.logger.error({ msg: "publish failed!", err: e });
                const t = this.attemptTracker.trackPublishFailed(e, this.peerClient.getProtocol()), i = t.code === le.OPERATION_ABORTED.code, o = t.fatal, u = this.latestPubAttemptNum === 4;
                if (i) return;
                if (o || u) return this.logger.error({ msg: `Stopping attempts: isFatal=${o}, isLastAttempt=${u}`, err: e }), this.updateState(yn.ERRORED), void this.emit(Zn.ERROR, t);
                const d = 1e3 * Math.pow(2, this.latestPubAttemptNum);
                this.logger.debug({ msg: `attempt failed, retrying in ${d}ms` }), this.nextAttemptTimerId = window.setTimeout(() => {
                  this.tryPublish();
                }, d);
              }
            }
          }), this.publish = (n, e) => _o(this, void 0, void 0, function* () {
            this.peerClient.initStreamsToPublish(n), yield this.peerClient.connect({ audioOnly: !1, traceId: e });
          }), this.unpublish = (n = !1) => _o(this, void 0, void 0, function* () {
            if (window.clearTimeout(this.nextAttemptTimerId), this.publicationState === yn.DISCONNECTED || this.publicationState === yn.ERRORED || !this.attemptTracker) return;
            this.attemptTracker.trackUnpublish();
            const e = n ? or.UNLOAD : or.UNPUBLISH, t = this.peerClient.getProtocol();
            try {
              n ? this.peerClient.disconnect(n) : yield this.peerClient.disconnect(n), this.attemptTracker.trackEndSucceeded(e, t);
            } catch {
              this.attemptTracker.trackEndFailed(e, t);
            }
          }), this.replaceOrUpdateStream = (n) => _o(this, void 0, void 0, function* () {
            this.streamsToPublish.find((e) => e.track.kind === n.track.kind) ? this.streamsToPublish = this.streamsToPublish.map((e) => e.track.kind === n.track.kind ? n : e) : this.streamsToPublish.push(n), yield this.peerClient.replaceOrUpdateStream(n);
          }), this.onPeerClientConnectionStateChange = (n) => {
            this.logger.debug({ msg: `onPeerClientConnectionStateChange: ${n}`, state: n }), this.processStateUpdate(n);
          }, this.onPeerClientTransformError = (n) => {
            this.emit(Zn.TRANSFORM_ERROR, n);
          }, this.onIncompatibleCodecs = (n) => _o(this, void 0, void 0, function* () {
            yield this.peerClient.onIncompatibleCodecs(n);
          }), this.sendSeiMessage = (n, e) => {
            if (this.publicationState !== yn.CONNECTED) return this.attemptTracker && this.emit(Zn.ERROR, this.attemptTracker.createSeiNotPublishingVideoError()), Re.err(Be.NOT_PUBLISHING_VIDEO);
            const t = this.peerClient.sendSeiMessage(n, e), i = Re.getErr(t);
            return i && this.attemptTracker && (i === Be.INBAND_MESSAGING_NOT_ENABLED ? this.emit(Zn.ERROR, this.attemptTracker.createSeiInBandMessagingNotEnabledError()) : i === Be.NOT_PUBLISHING_VIDEO && this.emit(Zn.ERROR, this.attemptTracker.createSeiNotPublishingVideoError())), t;
          }, this.peerClient = new Kt(r, this.nonScopedLogger, this.action, kt(this.action), Jn(), this.analyticsTracker, void 0, a, void 0), this.logger = new Ze(c, jt.PUBLICATION), this.peerClient.on(Rt, this.onPeerClientConnectionStateChange), this.peerClient.on(Hr, this.onPeerClientTransformError), this.publishTracker = new wu(this.analyticsTracker, this.token);
        }
        removeTrack(r) {
          return _o(this, void 0, void 0, function* () {
            this.streamsToPublish = this.streamsToPublish.filter((a) => a.track.kind !== r), yield this.peerClient.removeTrack(r);
          });
        }
      }
      var Gt, Ou = function(s, r, a, c) {
        return new (a || (a = Promise))(function(l, n) {
          function e(o) {
            try {
              i(c.next(o));
            } catch (u) {
              n(u);
            }
          }
          function t(o) {
            try {
              i(c.throw(o));
            } catch (u) {
              n(u);
            }
          }
          function i(o) {
            var u;
            o.done ? l(o.value) : (u = o.value, u instanceof a ? u : new a(function(d) {
              d(u);
            })).then(e, t);
          }
          i((c = c.apply(s, [])).next());
        });
      };
      class Hl extends Cu {
        constructor(r, a, c, l, n) {
          super(r, new Ze(c, jt.LOCAL_PARTICIPANT)), this.onPublicationStateChange = (e) => {
            switch (this.logger.debug({ msg: "publicationStateChange", state: e }), e) {
              case "connected":
                this.connection.setStagePublishing(!0), this.updatePublishState(cn.PUBLISHED);
                break;
              case "connecting":
                this.updatePublishState(cn.ATTEMPTING_PUBLISH);
                break;
              case "errored":
                this.updatePublishState(cn.ERRORED), this.connection.setStagePublishing(!1);
                break;
              default:
                return void this.logger.warn({ msg: "FIXME onPublicationStateChange UNHANDLED STATE", state: e });
            }
          }, this.onPublicationError = (e) => {
            this.emit(vo.ERROR, e);
          }, this.updatePublishState = (e) => {
            this.info.isPublishing = e === cn.PUBLISHED, this.publishState = e, this.emit(vo.PUBLICATION_STATE_CHANGE, this.publishState);
          }, this.handleMute = (e) => {
            e.streamType === Je.AUDIO && (this.audioMuted = e.isMuted, this.info.audioMuted = e.isMuted), e.streamType === Je.VIDEO && (this.videoStopped = e.isMuted, this.info.videoStopped = e.isMuted), this.connection.emitStageState(this.audioMuted, this.videoStopped), this.emit(vo.MEDIA_STREAM_MUTE_CHANGED, e);
          }, this.handleInsertSeiMsgRequest = (e, t, i) => {
            this.sendSeiMessage(t, i == null ? void 0 : i.repeatCount);
          }, this.publish = (e) => {
            this.logger.debug({ msg: "publish" }), e.forEach((i) => {
              i && (this.setupStreamListeners(i), i.streamType === Je.AUDIO ? (this.audioStream = i, this.audioMuted = !i.mediaStreamTrack.enabled, this.info.audioMuted = this.audioMuted) : i.streamType === Je.VIDEO && (this.videoStream = i, this.videoStopped = !i.mediaStreamTrack.enabled, this.info.videoStopped = this.videoStopped), i.setGetStats(this.publication.requestRTCStats));
            }), this.connection.emitStageState(this.audioMuted, this.videoStopped);
            const t = e.map((i) => $u(i));
            this.publication.start(t);
          }, this.cleanup = () => this.removeAllListeners(), this.quickUnpublish = () => this.publishState !== cn.NOT_PUBLISHED && this.publishState !== cn.ERRORED && void this.publication.stop(!0), this.onIncompatibleCodecs = (e) => Ou(this, void 0, void 0, function* () {
            yield this.publication.onIncompatibleCodecs(e);
          }), this.sendSeiMessage = (e, t = 0) => this.publication.sendSeiMessage(e, t), this.sendSeiMessageString = (e, t = 0) => {
            const i = new TextEncoder().encode(e);
            return this.publication.sendSeiMessage(i, t);
          }, this.connection = l, this.createPublication = () => {
            const e = new Wl(a, l, c, n);
            return e.on(Zn.STATE_CHANGE, this.onPublicationStateChange), e.on(Zn.ERROR, this.onPublicationError), e.on(Zn.TRANSFORM_ERROR, this.onPublicationError), e;
          }, this.publication = this.createPublication();
        }
        setupStreamListeners(r) {
          r.on(gi.LOCAL_STREAM_MUTE_CHANGED, this.handleMute), r.streamType === Je.VIDEO && r.on(gi.LOCAL_STREAM_INSERT_SEI_MSG_REQUEST, this.handleInsertSeiMsgRequest);
        }
        removeTrack(r) {
          var a, c, l;
          r.streamType === Je.AUDIO ? ((a = this.audioStream) === null || a === void 0 || a.off(gi.LOCAL_STREAM_MUTE_CHANGED, this.handleMute), this.audioStream = void 0, this.audioMuted = !0, this.info.audioMuted = !0) : r.streamType === Je.VIDEO && ((c = this.videoStream) === null || c === void 0 || c.off(gi.LOCAL_STREAM_MUTE_CHANGED, this.handleMute), (l = this.videoStream) === null || l === void 0 || l.off(gi.LOCAL_STREAM_INSERT_SEI_MSG_REQUEST, this.handleMute), this.videoStream = void 0, this.videoStopped = !0, this.info.videoStopped = !0), this.connection.emitStageState(this.audioMuted, this.videoStopped), this.publication.removeTrack(r.streamType);
        }
        replaceOrAddTrack(r) {
          return Ou(this, void 0, void 0, function* () {
            this.setupStreamListeners(r), r.setGetStats(this.publication.requestRTCStats), r.streamType === Je.AUDIO ? (this.audioStream = r, this.audioMuted = !r.mediaStreamTrack.enabled) : r.streamType === Je.VIDEO && (this.videoStream = r, this.videoStopped = !r.mediaStreamTrack.enabled), this.connection.emitStageState(this.audioMuted, this.videoStopped);
            const a = $u(r);
            yield this.publication.replaceOrUpdateStream(a);
          });
        }
        unpublish() {
          if (this.publishState === cn.NOT_PUBLISHED || this.publishState === cn.ERRORED) return;
          this.logger.debug({ msg: "unpublish" }), this.connection.setStagePublishing(!1), this.publication.stop(), this.publication.off(Zn.STATE_CHANGE, this.onPublicationStateChange), this.publication.off(Zn.ERROR, this.onPublicationError), this.publication.off(Zn.TRANSFORM_ERROR, this.onPublicationError);
          const r = [this.audioStream, this.videoStream].filter((a) => !!a);
          r.forEach((a) => {
            a.cleanup();
          }), this.audioStream = void 0, this.videoStream = void 0, this.emit(vo.MEDIA_STREAM_REMOVED, r), this.updatePublishState(cn.NOT_PUBLISHED), this.publication = this.createPublication();
        }
      }
      (function(s) {
        s.STAGE_CONNECTION_STATE_CHANGED = "stageConnectionStateChanged", s.STAGE_PARTICIPANT_JOINED = "stageParticipantJoined", s.STAGE_PARTICIPANT_LEFT = "stageParticipantLeft", s.STAGE_PARTICIPANT_STREAMS_ADDED = "stageParticipantStreamsAdded", s.STAGE_PARTICIPANT_STREAMS_REMOVED = "stageParticipantStreamsRemoved", s.STAGE_STREAM_MUTE_CHANGED = "stageStreamMuteChanged", s.STAGE_STREAM_SEI_MESSAGE_RECEIVED = "stageStreamSeiMessageReceived", s.STAGE_STREAM_LAYERS_CHANGED = "stageStreamLayersChanged", s.STAGE_STREAM_LAYER_SELECTED = "stageStreamLayerSelected", s.STAGE_STREAM_ADAPTION_CHANGED = "stageStreamAdaptionChanged", s.STAGE_PARTICIPANT_SUBSCRIBE_STATE_CHANGED = "stageParticipantSubscribeStateChanged", s.STAGE_PARTICIPANT_PUBLISH_STATE_CHANGED = "stageParticipantPublishStateChanged", s.ERROR = "error", s.STAGE_LEFT = "stageLeft";
      })(Gt || (Gt = {}));
      var ia = function(s, r, a, c) {
        return new (a || (a = Promise))(function(l, n) {
          function e(o) {
            try {
              i(c.next(o));
            } catch (u) {
              n(u);
            }
          }
          function t(o) {
            try {
              i(c.throw(o));
            } catch (u) {
              n(u);
            }
          }
          function i(o) {
            var u;
            o.done ? l(o.value) : (u = o.value, u instanceof a ? u : new a(function(d) {
              d(u);
            })).then(e, t);
          }
          i((c = c.apply(s, [])).next());
        });
      };
      const Ya = (s) => !!s;
      class Au extends lt {
        constructor(r, a) {
          super(), this.connectionState = Mt.DISCONNECTED, this.participants = /* @__PURE__ */ new Map(), this.connectionStateErrored = !1, this.onConnectionStateChanged = (l, n) => {
            var e, t;
            if (this.connectionState = l, l === Mt.ERRORED && (this.connectionStateErrored = !0), l === Mt.CONNECTED && this.localParticipant && this.localParticipant.publishState !== cn.NOT_PUBLISHED && this.stageConnection.emitStageState((e = this.localParticipant) === null || e === void 0 ? void 0 : e.audioMuted, (t = this.localParticipant) === null || t === void 0 ? void 0 : t.videoStopped), l === Mt.CONNECTED && this.connectionStateErrored && (this.connectionStateErrored = !1, this.refreshStrategy()), l === Mt.DISCONNECTED) {
              if (n && n !== Gn.CLIENT_RECONNECT && n !== Gn.USER_INITIATED) {
                let i = So.UNKNOWN;
                (function(o) {
                  return Object.values(So).includes(o);
                })(n) ? i = n : this.logger.warn({ msg: `DISCONNECTED reason is not a StageLeftReason: ${n}` }), this.cleanup(i);
              }
            } else this.emit(Gt.STAGE_CONNECTION_STATE_CHANGED, this.connectionState);
          }, this.setupLocalParticipantOnce = () => {
            var l;
            this.localParticipant ? this.analyticsTracker.trackEventNoSharedProps(new uo(this.token, (l = this.joinTraceId) !== null && l !== void 0 ? l : new Uu(), "reusing local participant from repeat join", me.JOIN, "")) : this.createLocalParticipant();
          }, this.createLocalParticipant = () => {
            const l = function(n) {
              var e, t;
              const i = /* @__PURE__ */ new Set();
              return n.token.claims.capabilities.allow_publish && i.add(mi.PUBLISH), n.token.claims.capabilities.allow_subscribe && i.add(mi.SUBSCRIBE), { id: n.token.participantID, userId: (e = n.token.userID) !== null && e !== void 0 ? e : "", attributes: (t = n.token.claims.attributes) !== null && t !== void 0 ? t : {}, capabilities: i, isLocal: !0, userInfo: {}, videoStopped: n.videoStopped, audioMuted: n.audioMuted, isPublishing: n.isPublishing };
            }({ token: this.token, videoStopped: !0, audioMuted: !0, isPublishing: !1 });
            this.localParticipant = new Hl(l, this.token, this.logger.unwrap(), this.stageConnection, this.analyticsTracker), this.localParticipant.on(vo.PUBLICATION_STATE_CHANGE, (n) => {
              this.onPublishStateChanged(this.localParticipant.info, n);
            }), this.localParticipant.on(vo.MEDIA_STREAM_REMOVED, this.onLocalStreamsRemoved), this.localParticipant.on(vo.MEDIA_STREAM_MUTE_CHANGED, (n) => {
              this.localParticipant ? this.onStreamMuteChange(this.localParticipant.info, n) : this.logger.warn({ msg: "tried to emit a stream mute change event for undefined local participant" });
            }), this.localParticipant.on(vo.ERROR, (n) => {
              this.errorManager.handleError(n, pt.PUBLISH_ERROR);
            }), this.emit(Gt.STAGE_PARTICIPANT_JOINED, l);
          }, this.onRemoteParticipantJoined = (l) => {
            if (l.id !== this.token.participantID) {
              const n = function(o) {
                return { id: o.id, userId: o.userId, attributes: o.attributes, capabilities: /* @__PURE__ */ new Set([mi.SUBSCRIBE]), isLocal: !1, userInfo: {}, videoStopped: o.videoStopped, audioMuted: o.audioMuted, isPublishing: o.isPublishing };
              }(l);
              if (this.participants.has(n.id)) return void this.logger.warn({ msg: "Remote participant already tracked" });
              let e = Ne.NONE;
              n.capabilities.has(mi.SUBSCRIBE) && (e = Re.getOk_or(this.strategyWrapper.shouldSubscribeToParticipant(n), e), this.updateManagerWithExternalSubscribeConfig(n, "joined"));
              const t = this.configManager.getSubscribeConfigSnapshot(n.id), i = new Xn(n, this.token, this.stageConnection, this.logger.unwrap(), e, t, this.analyticsTracker, l.isPublishing);
              this.participants.set(n.id, i), this.setupRemoteParticipantListeners(i), this.emit(Gt.STAGE_PARTICIPANT_JOINED, i.info), i.updateSubscribeStateIfNecessary(e);
            }
          }, this.setupRemoteParticipantListeners = (l) => {
            l.on(Hn.SUBSCRIPTION_STATE_CHANGE, (n) => {
              this.onParticipantSubscribeStateChanged(l.info.id, n);
            }), l.on(Hn.MEDIA_STREAM_ADDED, (n) => {
              const e = this.participants.get(l.info.id);
              if (e) {
                for (const t of n) this.setupRemoteParticipantStreamEvents(e.info, t);
                this.emit(Gt.STAGE_PARTICIPANT_STREAMS_ADDED, e.info, rl(n)), this.updateStreamLayerForParticipantInfo(l.info, l.streams);
              } else this.logger.warn({ msg: "Got stream add for participant no longer being tracked" });
            }), l.on(Hn.MEDIA_STREAM_REMOVED, (n) => {
              const e = this.participants.get(l.info.id);
              e ? this.emit(Gt.STAGE_PARTICIPANT_STREAMS_REMOVED, e.info, rl(n)) : this.logger.warn({ msg: "Got stream remove for participant no longer being tracked" });
            }), l.on(Hn.MEDIA_STREAM_MUTE_CHANGED, (n) => {
              this.onStreamMuteChange(l.info, n.remote);
            }), l.on(Hn.ERROR, (n) => {
              this.errorManager.handleError(n, pt.SUBSCRIBE_ERROR);
            }), l.on(Hn.MEDIA_STREAM_SEI_MESSAGE_RECEIVED, (n) => {
              this.onSeiMessageReceived(l.info, n);
            });
          }, this.onRemoteParticipantLeft = (l) => {
            if (this.connectionState !== Mt.CONNECTED) return;
            const n = this.participants.get(l);
            n ? (n.participantLeave(), n.unsubscribe(), n.cleanup(), this.participants.delete(l), this.emitParticipantLeave(n.info)) : this.logger.warn({ msg: "Remote participant no longer tracked" });
          }, this.emitParticipantLeave = (l) => {
            this.emit(Gt.STAGE_PARTICIPANT_LEFT, l);
          }, this.onRemoteParticipantStateChanged = (l) => {
            const n = this.participants.get(l.id);
            if (!n) return void this.logger.warn({ msg: "Remote participant updated but not tracked" });
            n.updatePublishState(l.isPublishing) && this.onPublishStateChanged(n.info, n.publishState), n.updateStreamState(l.audioMuted, l.videoStopped);
            const e = this.strategyWrapper.shouldSubscribeToParticipant(n.info);
            if (Re.isNotOk(e)) return;
            this.updateManagerWithExternalSubscribeConfig(n.info, "updated");
            const t = this.configManager.getSubscribeConfigSnapshot(n.info.id), i = Re.getOk_or(e, Ne.NONE);
            n.updateSubscribeStateIfNecessary(i, t);
          }, this.onPublishStateChanged = (l, n) => {
            this.emit(Gt.STAGE_PARTICIPANT_PUBLISH_STATE_CHANGED, l, n);
          }, this.onParticipantSubscribeStateChanged = (l, n) => {
            const e = this.participants.get(l);
            e ? this.emit(Gt.STAGE_PARTICIPANT_SUBSCRIBE_STATE_CHANGED, e.info, n) : this.logger.warn({ msg: "Remote participant subscribe state changed but not tracked" });
          }, this.onLocalStreamsAdded = (l) => {
            this.localParticipant && this.emit(Gt.STAGE_PARTICIPANT_STREAMS_ADDED, this.localParticipant.info, l);
          }, this.onLocalStreamsRemoved = (l) => {
            this.localParticipant && this.emit(Gt.STAGE_PARTICIPANT_STREAMS_REMOVED, this.localParticipant.info, l);
          }, this.onStreamMuteChange = (l, n) => {
            this.emit(Gt.STAGE_STREAM_MUTE_CHANGED, l, n);
          }, this.onSeiMessageReceived = (l, n) => {
            this.emit(Gt.STAGE_STREAM_SEI_MESSAGE_RECEIVED, l, n);
          }, this.leave = () => {
            this.cleanup(So.USER_INITIATED);
          }, this.onBeforeUnloadCleanup = () => {
            var l;
            this.participants.forEach((n) => {
              n.quickUnsubscribe();
            }), (l = this.localParticipant) === null || l === void 0 || l.quickUnpublish(), this.stageConnection.disconnect(), this.emit(Gt.STAGE_CONNECTION_STATE_CHANGED, Mt.DISCONNECTED), this.analyticsTracker.stop(!0);
          }, this.cleanup = (l) => {
            if (!this.localParticipant) return;
            this.analyticsTracker.trackEventNoSharedProps(new Uo({ token: this.token, eventEndpoint: this.token.eventsURL, whipEndpoint: this.token.whipURL, traceId: this.joinTraceId, reason: l })), this.localParticipant.unpublish(), this.localParticipant.cleanup();
            const n = this.localParticipant.info;
            this.localParticipant = void 0, this.emitParticipantLeave(n);
            const e = this.participants.entries();
            for (const [t, i] of e) i.unsubscribe(), this.participants.delete(t), i.cleanup(), this.emitParticipantLeave(i.info);
            hi.destroy(this.analyticsTracker.getSessionId()), this.stageConnection.disconnect(), this.emit(Gt.STAGE_CONNECTION_STATE_CHANGED, Mt.DISCONNECTED), this.emit(Gt.STAGE_LEFT, l), this.analyticsTracker.stop(!1), window.removeEventListener("beforeunload", this.onBeforeUnloadCleanup);
          }, this.refreshStrategy = () => {
            this.participants.forEach((l) => {
              if (l.info.capabilities.has(mi.SUBSCRIBE)) {
                const n = this.strategyWrapper.shouldSubscribeToParticipant(l.info);
                if (Re.isNotOk(n)) return;
                const e = Re.getOk_or(n, Ne.NONE);
                this.updateManagerWithExternalSubscribeConfig(l.info, "updated");
                const t = this.configManager.getSubscribeConfigSnapshot(l.info.id);
                l.updateSubscribeStateIfNecessary(e, t), this.updateStreamLayerForParticipantInfo(l.info, l.streams);
              }
            }), this.updateStreamsToPublishIfNecessary();
          }, this.updateStreamsToPublishIfNecessary = () => {
            var l;
            if (!this.localParticipant || !(!((l = this.localParticipant) === null || l === void 0) && l.info.capabilities.has(mi.PUBLISH))) return;
            const n = this.localParticipant.publishState !== cn.NOT_PUBLISHED && this.localParticipant.publishState !== cn.ERRORED, e = this.strategyWrapper.shouldPublishParticipant(this.localParticipant.info);
            if (Re.isNotOk(e)) return;
            let t = Re.getOk_or(e, !1);
            if (!n && !t) return;
            if (n && !t) return void this.localParticipant.unpublish();
            const i = this.strategyWrapper.stageStreamsToPublish();
            if (Re.isNotOk(i)) {
              const u = Re.getErr(i);
              if (u instanceof Error && u.cause === "UserStrategy") throw u;
              return;
            }
            const o = Re.getOk_or(i, []);
            t = t && o.length > 0, !n && t ? (this.localParticipant.publish(o), this.onLocalStreamsAdded(o)) : this.syncTracksToPublish(o);
          }, this.syncTracksToPublish = (l) => {
            var n;
            if (!this.localParticipant) return;
            const e = this.localParticipant.audioStream, t = this.localParticipant.videoStream, { updates: i, streamsToAdd: o, streamsToRemove: u } = this.determineStreamUpdates(e, t, l);
            if (i.length) {
              for (const d of i) d.newStream ? (n = this.localParticipant) === null || n === void 0 || n.replaceOrAddTrack(d.newStream) : d.oldStream && this.localParticipant.removeTrack(d.oldStream);
              u.length !== 0 && this.onLocalStreamsRemoved(u), o.length !== 0 && this.onLocalStreamsAdded(o);
            }
          }, this.determineStreamUpdates = (l, n, e = []) => {
            const t = [], i = e.slice(0, 2);
            if (i.sort((d, h) => d.streamType === Je.AUDIO ? -1 : 1), i.length === 0) l && t.push({ oldStream: l }), n && t.push({ oldStream: n });
            else if (i.length === 1) {
              const d = i[0];
              d.streamType === Je.AUDIO ? n && t.push({ oldStream: n }) : d.streamType === Je.VIDEO && l && t.push({ oldStream: l });
            }
            i.forEach((d) => {
              var h, S;
              d.streamType === Je.AUDIO ? l ? l.id === d.id && (0, zt.isEqual)(l.mediaConfig, d.mediaConfig) || (!!(!((h = l.mediaConfig) === null || h === void 0) && h.stereo) != !!(!((S = d.mediaConfig) === null || S === void 0) && S.stereo) && this.logger.warn({ msg: "Ignoring change to audio stream's stereo configuration. Re-publish to change stereo configuraiton." }), t.push({ oldStream: l, newStream: d })) : t.push({ newStream: d }) : d.streamType === Je.VIDEO && (n ? n.id === d.id && (0, zt.isEqual)(n.mediaConfig, d.mediaConfig) || t.push({ oldStream: n, newStream: d }) : t.push({ newStream: d }));
            });
            const o = t.map((d) => d.newStream).filter(Ya), u = t.map((d) => d.oldStream).filter(Ya);
            return { updates: t, streamsToAdd: o, streamsToRemove: u };
          }, this.onReassignmentMessage = (l) => ia(this, void 0, void 0, function* () {
            if (ln("disableReassignments")) return void this.logger.debug({ msg: "REASSIGN message ignored: disableReassignments is configured" });
            if (!Ai.browser.isChrome()) return void this.logger.debug({ msg: "REASSIGN message ignored: browser is not chrome" });
            const n = Jn();
            this.trackReassignmentRequest(l, n);
            const e = this.participants.get(l.remoteParticipantId), t = this.token.participantID, i = function(o, { localParticipantId: u, remoteParticipant: d }) {
              const { participantId: h } = o;
              if (u !== h) return Re.err(Object.assign(Object.assign({}, le.REASSIGNMENT_REQUEST_INVALID_LOCAL_PARTICIPANT_ID), { details: `Invalid participantId received: ${h}` }));
              if (!d) return Re.err(Object.assign(Object.assign({}, le.REASSIGNMENT_REQUEST_INVALID_REMOTE_PARTICIPANT_ID), { details: `Invalid remoteParticipantId received: ${d}` }));
              if (d.isReassigning()) return Re.err(le.REASSIGNMENT_REQUEST_ALREADY_IN_PROGRESS);
              const S = d.subscription.peerClient.getConnectionState();
              return [xe.CONNECTED, xe.DISCONNECTED].includes(S) ? Re.ok(d) : Re.err(Object.assign(Object.assign({}, le.REASSIGNMENT_REQUEST_INVALID_REMOTE_PEER_CONNECTION_STATE), { details: `connectionState: ${S}` }));
            }(l, { localParticipantId: t, remoteParticipant: e });
            if (!i.ok) this.trackReassignmentRequestRejected(i.error, n);
            else try {
              const { token: o, nodeOverride: u } = l;
              yield i.value.triggerIceRestart({ assignmentToken: o, traceId: n, nodeOverride: u });
            } catch (o) {
              this.logger.error({ msg: "Reassignment failed.", err: o });
            }
          }), this.onIncompatibleCodecsMessage = (l) => ia(this, void 0, void 0, function* () {
            var n;
            yield (n = this.localParticipant) === null || n === void 0 ? void 0 : n.onIncompatibleCodecs(l.codecs);
          }), this.analyticsTracker = new _s();
          const c = Zs();
          this.logger = new Ze(new Pe(c), jt.STAGE), this.strategyWrapper = new Tu(a, this.logger), this.configManager = new Fl({ logger: this.logger.unwrap(), subscribeDefaults: { jitterBuffer: { minDelayWhenPublishing: Fn.DEFAULT, minDelayWhenSubscribeOnly: Fn.DEFAULT }, inBandMessaging: { enabled: !1 }, simulcast: { initialLayerPreference: Na.LOWEST_QUALITY, layerPollingEnabled: !0, layerPollingIntervalMs: 3e3 } } }), this.errorManager = new yu(this.logger.unwrap());
          try {
            this.token = dc(r, this.analyticsTracker);
          } catch (l) {
            const n = new $e(Object.assign({ action: me.JOIN, token: r, traceId: Jn(), tag: si, location: "Stage.constructor" }, le.MALFORMED_TOKEN));
            throw l instanceof Error && (n.details = l.message), this.errorManager.handleError(n, pt.JOIN_ERROR) || l;
          }
          this.stageConnection = new Us(this.token, this.logger.unwrap(), this.analyticsTracker), this.setupListeners();
        }
        setupListeners() {
          this.stageConnection.on(_n, (r, a) => {
            this.onConnectionStateChanged(r, a);
          }), this.stageConnection.on(cc, (r) => {
            this.onRemoteParticipantJoined(r);
          }), this.stageConnection.on(ao, (r) => {
            this.onRemoteParticipantLeft(r.id);
          }), this.stageConnection.on(yi, (r) => {
            var a;
            r.id !== ((a = this.localParticipant) === null || a === void 0 ? void 0 : a.info.id) && this.onRemoteParticipantStateChanged(r);
          }), this.stageConnection.on(_r, (r) => ia(this, void 0, void 0, function* () {
            yield this.onReassignmentMessage(r);
          })), this.stageConnection.on(an, (r) => ia(this, void 0, void 0, function* () {
            yield this.onIncompatibleCodecsMessage(r);
          })), this.stageConnection.on(Ia, (r) => {
            r instanceof $e && this.analyticsTracker.trackError(r), this.errorManager.handleError(r, pt.JOIN_ERROR);
          }), this.errorManager.on(Fc.ERROR, (r) => {
            this.emit(Gt.ERROR, r);
          });
        }
        setupRemoteParticipantStreamEvents(r, a) {
          const c = a.remote;
          a.on(ct.ADAPTION_CHANGED, (l) => {
            this.emit(Gt.STAGE_STREAM_ADAPTION_CHANGED, r, c, l);
          }), a.on(ct.LAYERS_CHANGED, (l) => {
            this.emit(Gt.STAGE_STREAM_LAYERS_CHANGED, r, c, l), this.updateStreamLayerForParticipantInfo(r, [a]);
          }), a.on(ct.LAYER_SELECTED, (l, n) => {
            this.emit(Gt.STAGE_STREAM_LAYER_SELECTED, r, c, l, n);
          }), a.layers.length > 0 && (this.emit(Gt.STAGE_STREAM_LAYERS_CHANGED, r, c, c.getLayers()), this.emit(Gt.STAGE_STREAM_LAYER_SELECTED, r, c, c.getSelectedLayer(), na.SELECTED));
        }
        join() {
          return ia(this, void 0, void 0, function* () {
            this.analyticsTracker.start(), this.joinTraceId = Jn(), this.analyticsTracker.trackEvent(new Ml({ token: this.token, eventEndpoint: this.token.eventsURL, whipEndpoint: this.token.whipURL, traceId: this.joinTraceId }));
            try {
              this.token.assertTokenIsUnexpired(Jn(), si, "join");
            } catch (r) {
              throw this.errorManager.handleError(r, pt.JOIN_ERROR) || r;
            }
            try {
              this.joinTraceId = yield this.stageConnection.connect(this.joinTraceId), this.connectionState === Mt.CONNECTED && (this.setupLocalParticipantOnce(), this.updateStreamsToPublishIfNecessary()), window.addEventListener("beforeunload", this.onBeforeUnloadCleanup);
            } catch (r) {
              throw this.logger.error({ err: r, msg: "error joining stage" }), this.errorManager.handleError(r, pt.JOIN_ERROR, !1) || r;
            }
          });
        }
        replaceStrategy(r) {
          this.strategyWrapper.setStrategy(r), this.refreshStrategy();
        }
        updateManagerWithExternalSubscribeConfig(r, a) {
          var c;
          const l = Re.getOk(this.strategyWrapper.subscribeConfiguration(r)), n = Re.getOk(this.getRemoteSubscribeConfiguration()), e = this.getInternalSubscribeOverrides(), t = r.id;
          let i = !1;
          l && (i = this.configManager.handleExternalSubscribeConfigUpdate(t, l, mo.API));
          let o = !1;
          n && (o = this.configManager.handleSubscribeConfigUpdate(t, n, mo.REMOTE));
          let u = !1;
          if (e && (u = this.configManager.handleSubscribeConfigUpdate(t, e, mo.INTERNAL)), i || o || u) {
            const d = this.configManager.getSubscribeConfigSnapshot(t);
            this.analyticsTracker.trackEventNoSharedProps(new qu(this.token, (c = this.joinTraceId) !== null && c !== void 0 ? c : Jn(), a === "joined" ? "initial" : "ad-hoc", t, d));
          }
        }
        getRemoteSubscribeConfiguration() {
          return Re.err("todo");
        }
        getInternalSubscribeOverrides() {
          const r = this.strategyWrapper.hasStrategy("preferredLayerForStream"), a = this.hasListenersFor(Gt.STAGE_STREAM_LAYERS_CHANGED) || this.hasListenersFor(Gt.STAGE_STREAM_ADAPTION_CHANGED) || this.hasListenersFor(Gt.STAGE_STREAM_LAYER_SELECTED);
          return { simulcast: { layerPollingEnabled: r || a } };
        }
        updateStreamLayerForParticipantInfo(r, a) {
          a.forEach((c) => {
            if (c.streamType === "audio") return;
            const l = this.strategyWrapper.preferredLayerForStream(r, c.remote), n = Re.getOk_or(l, void 0);
            c.setLayer(n);
          });
        }
        trackReassignmentRequestRejected(r, a) {
          const { token: c } = this, l = new $e(Object.assign(Object.assign({}, r), { token: c, action: me.JOIN, traceId: a, tag: ir, location: "publish" }));
          this.logger.error({ err: l, msg: "Reassignment request rejected." }), this.analyticsTracker.trackError(l);
        }
        trackReassignmentRequest(r, a) {
          const { token: c } = this;
          this.analyticsTracker.trackEvent(new Vl({ token: c, traceId: a, targetLocalParticipantId: r.participantId, targetRemoteParticipantId: r.remoteParticipantId }));
        }
      }
      var So;
      (function(s) {
        s.UNKNOWN = "unknown", s.USER_INITIATED = "user-initiated", s.TOKEN_REUSED = "token-reused", s.PARTICIPANT_DISCONNECTED = "participant-disconnected", s.STAGE_DELETED = "stage-deleted";
      })(So || (So = {}));
      const $l = y;
    })(), ze;
  })());
})(od);
var Bn = od.exports;
async function gd(rn, U, z) {
  const se = {
    video: {
      deviceId: { exact: rn },
      width: { max: U },
      height: { max: z }
    },
    audio: !1
  };
  try {
    return await navigator.mediaDevices.getUserMedia(se);
  } catch (Te) {
    throw Te;
  }
}
async function id(rn) {
  return navigator.mediaDevices.getUserMedia({
    audio: { deviceId: { exact: rn } },
    video: !1
  });
}
class md {
  constructor(U, z) {
    rt(this, "config");
    rt(this, "callbacks");
    rt(this, "localStreams", []);
    rt(this, "localStream", null);
    rt(this, "isPublishing", !1);
    rt(this, "isLocalAudioEnabled", !0);
    rt(this, "defaultVideoResolution", { width: 1280, height: 720 });
    this.config = U, this.callbacks = z;
  }
  async startPublishing() {
    try {
      if (this.localStreams = [], this.config.videoInputDeviceId) {
        const z = (await gd(
          this.config.videoInputDeviceId,
          this.defaultVideoResolution.width,
          this.defaultVideoResolution.height
        )).getVideoTracks()[0];
        if (z) {
          const se = this.config.enableInBandMessaging !== !1 ? { inBandMessaging: { enabled: !0 } } : void 0;
          this.localStreams.push(new Bn.LocalStageStream(z, se));
        }
      }
      if (this.config.audioInputDeviceId) {
        const z = (await id(this.config.audioInputDeviceId)).getAudioTracks()[0];
        z && (z.enabled = this.isLocalAudioEnabled, this.localStreams.push(new Bn.LocalStageStream(z)));
      }
      this.localStreams.length > 0 && (this.localStream = new MediaStream(this.localStreams.map((U) => U.mediaStreamTrack).filter((U) => U)), this.callbacks.onLocalStreamReady && this.callbacks.onLocalStreamReady(this.localStream), this.config.localVideoElement && (this.config.localVideoElement.srcObject = this.localStream, this.config.localVideoElement.muted = !0, this.config.localVideoElement.playsInline = !0, this.config.localVideoElement.play().catch(() => console.warn("Failed to play local video")))), this.isPublishing = !0, this.callbacks.onPublishingStarted && this.callbacks.onPublishingStarted();
    } catch (U) {
      throw console.error("Failed to start publishing:", U), this.callbacks.onError && this.callbacks.onError(U), U;
    }
  }
  stopPublishing() {
    this.localStream && (this.localStream.getTracks().forEach((U) => U.stop()), this.localStream = null), this.localStreams.forEach((U) => {
      var z;
      return (z = U.mediaStreamTrack) == null ? void 0 : z.stop();
    }), this.localStreams = [], this.isPublishing = !1, this.callbacks.onPublishingStopped && this.callbacks.onPublishingStopped();
  }
  toggleVideo() {
    if (!this.localStream) return;
    const U = this.localStream.getVideoTracks()[0];
    U && (U.enabled = !U.enabled, this.callbacks.onVideoToggled && this.callbacks.onVideoToggled(U.enabled));
  }
  toggleAudio() {
    this.setLocalAudioEnabled(!this.isLocalAudioEnabled);
  }
  setLocalAudioEnabled(U) {
    var se;
    this.isLocalAudioEnabled = U;
    const z = (se = this.localStreams.find((Te) => {
      var ze;
      return ((ze = Te.mediaStreamTrack) == null ? void 0 : ze.kind) === "audio";
    })) == null ? void 0 : se.mediaStreamTrack;
    U && !z && this.config.audioInputDeviceId ? id(this.config.audioInputDeviceId).then((Te) => {
      const ze = Te.getAudioTracks()[0];
      ze && (this.localStreams.push(new Bn.LocalStageStream(ze)), this.localStream ? this.localStream.addTrack(ze) : this.localStream = new MediaStream([ze]), this.config.localVideoElement && (this.config.localVideoElement.srcObject = this.localStream, this.config.localVideoElement.play().catch(() => {
      })), this.callbacks.onAudioToggled && this.callbacks.onAudioToggled(!0));
    }).catch(() => {
      this.callbacks.onAudioToggled && this.callbacks.onAudioToggled(!1);
    }) : z && (z.enabled = U, this.callbacks.onAudioToggled && this.callbacks.onAudioToggled(U));
  }
  setLocalVideoEnabled(U) {
    if (!this.localStream) return;
    const z = this.localStream.getVideoTracks()[0];
    z && (z.enabled = U, this.callbacks.onVideoToggled && this.callbacks.onVideoToggled(U));
  }
  getStreams() {
    return this.localStreams.filter((U) => {
      const z = U.mediaStreamTrack;
      return z ? z.kind === "audio" ? this.isLocalAudioEnabled && z.enabled : !0 : !1;
    });
  }
  shouldPublish() {
    return this.config.role === "admin" || this.config.role === "user" && this.isPublishing;
  }
}
class vd {
  constructor(U, z, se) {
    rt(this, "config");
    rt(this, "callbacks");
    rt(this, "mediaManager");
    rt(this, "canvases", /* @__PURE__ */ new Map());
    rt(this, "resizeObservers", /* @__PURE__ */ new Map());
    rt(this, "animationFrameId", null);
    rt(this, "lastRender", 0);
    rt(this, "targetFps", 15);
    rt(this, "isSafari", /Safari/i.test(navigator.userAgent) && !/Chrome/i.test(navigator.userAgent));
    this.config = U, this.callbacks = z, this.mediaManager = se;
  }
  addParticipant(U) {
    if (!this.config.useMultipleCanvas || !this.config.canvasContainerElement) return;
    const z = this.createCanvas(U, this.config.canvasContainerElement);
    this.config.canvasContainerElement.appendChild(z), this.setupResizeObserver(U, z, this.config.canvasContainerElement), this.startRenderLoop();
  }
  removeParticipant(U) {
    this.removeCanvas(U), this.canvases.size === 0 && this.stopRenderLoop();
  }
  createCanvas(U, z) {
    var A, p, v;
    const se = document.createElement("canvas");
    se.id = `participant-canvas-${U}`, se.style.width = "100%", se.style.height = "100%", se.style.display = "block", se.style.objectFit = "cover", (A = this.config.canvasConfig) != null && A.style && Object.assign(se.style, this.config.canvasConfig.style);
    const Te = window.devicePixelRatio || 1, ze = z.getBoundingClientRect();
    se.width = (ze.width || ((p = this.config.canvasConfig) == null ? void 0 : p.width) || 640) * Te, se.height = (ze.height || ((v = this.config.canvasConfig) == null ? void 0 : v.height) || 480) * Te;
    const k = se.getContext("2d");
    return k && (k.scale(Te, Te), k.imageSmoothingEnabled = !0, k.imageSmoothingQuality = this.isSafari ? "medium" : "high"), this.canvases.set(U, se), this.callbacks.onParticipantCanvasCreated && this.callbacks.onParticipantCanvasCreated(U, se), se;
  }
  removeCanvas(U) {
    const z = this.resizeObservers.get(U);
    z && (z.disconnect(), this.resizeObservers.delete(U));
    const se = this.canvases.get(U);
    se && se.parentNode && se.parentNode.removeChild(se), this.canvases.delete(U), this.callbacks.onParticipantCanvasRemoved && this.callbacks.onParticipantCanvasRemoved(U);
  }
  setupResizeObserver(U, z, se) {
    const Te = () => {
      var v, m;
      const k = window.devicePixelRatio || 1, A = se.getBoundingClientRect();
      z.width = (A.width || ((v = this.config.canvasConfig) == null ? void 0 : v.width) || 640) * k, z.height = (A.height || ((m = this.config.canvasConfig) == null ? void 0 : m.height) || 480) * k;
      const p = z.getContext("2d");
      p && (p.scale(k, k), p.imageSmoothingEnabled = !0, p.imageSmoothingQuality = this.isSafari ? "medium" : "high");
    };
    Te();
    const ze = new ResizeObserver(Te);
    ze.observe(se), this.resizeObservers.set(U, ze);
  }
  startRenderLoop() {
    if (this.animationFrameId) return;
    const U = () => {
      const z = performance.now();
      if (z - this.lastRender < 1e3 / this.targetFps) {
        this.animationFrameId = requestAnimationFrame(U);
        return;
      }
      this.lastRender = z, this.canvases.forEach((se, Te) => this.renderCanvas(Te, se)), this.animationFrameId = requestAnimationFrame(U);
    };
    this.animationFrameId = requestAnimationFrame(U);
  }
  stopRenderLoop() {
    this.animationFrameId && (cancelAnimationFrame(this.animationFrameId), this.animationFrameId = null);
  }
  renderCanvas(U, z) {
    const se = z.getContext("2d");
    if (!se) return;
    const Te = window.devicePixelRatio || 1, ze = z.width / Te, k = z.height / Te;
    se.clearRect(0, 0, ze, k), se.fillStyle = "#3c4043", se.fillRect(0, 0, ze, k);
    const A = this.mediaManager.media.get(U), p = A == null ? void 0 : A.videoElement;
    if (p && p.videoWidth > 0 && p.videoHeight > 0 && p) {
      const E = Math.min(ze / p.videoWidth, k / p.videoHeight), C = p.videoWidth * E, _ = p.videoHeight * E, f = (ze - C) / 2, b = (k - _) / 2;
      se.drawImage(p, f, b, C, _);
    } else {
      se.fillStyle = "#222", se.fillRect(0, 0, ze, k);
      const E = U.slice(0, 2).toUpperCase();
      se.fillStyle = "#555", se.beginPath();
      const C = Math.min(ze, k) * 0.28;
      se.arc(ze / 2, k / 2 - 8, C, 0, Math.PI * 2), se.fill(), se.fillStyle = "#ddd", se.font = `${Math.floor(C * 0.9)}px sans-serif`, se.textAlign = "center", se.textBaseline = "middle", se.fillText(E, ze / 2, k / 2 - 8);
    }
    se.fillStyle = "rgba(0,0,0,0.6)", se.fillRect(0, k - 40, ze, 40), se.fillStyle = "#fff", se.font = "12px sans-serif", se.textAlign = "left", se.textBaseline = "middle", se.fillText(U, 8, k - 20);
    const m = this.mediaManager.getVolume(U), y = Math.min(1, m) * (ze - 16);
    y > 0 && (se.fillStyle = m > 0.7 ? "#ea4335" : m > 0.3 ? "#fbbc04" : "#34a853", se.fillRect(8, k - 8, y, 4));
  }
  getCanvases() {
    return new Map(this.canvases);
  }
  getCanvas(U) {
    return this.canvases.get(U) || null;
  }
  cleanup() {
    this.canvases.forEach((U, z) => this.removeCanvas(z)), this.stopRenderLoop();
  }
}
class _d {
  constructor(U, z, se, Te) {
    rt(this, "config");
    rt(this, "callbacks");
    rt(this, "publishManager");
    rt(this, "subscriptionManager");
    rt(this, "stage", null);
    rt(this, "strategyRefreshTimerId", null);
    rt(this, "handlers", {});
    this.config = U, this.callbacks = z, this.publishManager = se, this.subscriptionManager = Te;
  }
  setEventHandlers(U) {
    this.handlers = U;
  }
  async initialize() {
    try {
      this.stage = new Bn.Stage(this.config.token, this.createStrategy()), this.registerEvents(), await this.stage.join();
    } catch (U) {
      throw console.error("Stage initialization failed:", U), U;
    }
  }
  createStrategy() {
    return {
      stageStreamsToPublish: () => this.publishManager.getStreams(),
      shouldPublishParticipant: () => this.publishManager.shouldPublish(),
      shouldSubscribeToParticipant: (U) => this.subscriptionManager.getSubscribeType(U),
      subscribeConfiguration: this.config.enableInBandMessaging !== !1 ? () => ({ inBandMessaging: { enabled: !0 } }) : void 0
    };
  }
  registerEvents() {
    this.stage && (this.handlers.onConnectionStateChanged && this.stage.on(Bn.StageEvents.STAGE_CONNECTION_STATE_CHANGED, this.handlers.onConnectionStateChanged), this.handlers.onParticipantJoined && this.stage.on(Bn.StageEvents.STAGE_PARTICIPANT_JOINED, this.handlers.onParticipantJoined), this.handlers.onParticipantLeft && this.stage.on(Bn.StageEvents.STAGE_PARTICIPANT_LEFT, this.handlers.onParticipantLeft), this.handlers.onParticipantStreamsAdded && this.stage.on(Bn.StageEvents.STAGE_PARTICIPANT_STREAMS_ADDED, this.handlers.onParticipantStreamsAdded), this.handlers.onParticipantStreamsRemoved && this.stage.on(Bn.StageEvents.STAGE_PARTICIPANT_STREAMS_REMOVED, this.handlers.onParticipantStreamsRemoved), this.handlers.onStreamSeiMessageReceived && this.config.enableInBandMessaging !== !1 && this.stage.on(Bn.StageEvents.STAGE_STREAM_SEI_MESSAGE_RECEIVED, this.handlers.onStreamSeiMessageReceived));
  }
  unregisterEvents() {
    this.stage && (this.handlers.onConnectionStateChanged && this.stage.off(Bn.StageEvents.STAGE_CONNECTION_STATE_CHANGED, this.handlers.onConnectionStateChanged), this.handlers.onParticipantJoined && this.stage.off(Bn.StageEvents.STAGE_PARTICIPANT_JOINED, this.handlers.onParticipantJoined), this.handlers.onParticipantLeft && this.stage.off(Bn.StageEvents.STAGE_PARTICIPANT_LEFT, this.handlers.onParticipantLeft), this.handlers.onParticipantStreamsAdded && this.stage.off(Bn.StageEvents.STAGE_PARTICIPANT_STREAMS_ADDED, this.handlers.onParticipantStreamsAdded), this.handlers.onParticipantStreamsRemoved && this.stage.off(Bn.StageEvents.STAGE_PARTICIPANT_STREAMS_REMOVED, this.handlers.onParticipantStreamsRemoved), this.handlers.onStreamSeiMessageReceived && this.stage.off(Bn.StageEvents.STAGE_STREAM_SEI_MESSAGE_RECEIVED, this.handlers.onStreamSeiMessageReceived));
  }
  refreshStrategy() {
    this.strategyRefreshTimerId && clearTimeout(this.strategyRefreshTimerId), this.strategyRefreshTimerId = window.setTimeout(() => {
      var U;
      try {
        (U = this.stage) == null || U.refreshStrategy();
      } catch (z) {
        console.error("Failed to refresh strategy:", z);
      }
      this.strategyRefreshTimerId = null;
    }, 0);
  }
  leave() {
    var U;
    this.unregisterEvents(), (U = this.stage) == null || U.leave(), this.stage = null;
  }
  handleConnectionStateChanged(U) {
    U === Bn.StageConnectionState.CONNECTED && this.callbacks.onConnected ? this.callbacks.onConnected() : U === Bn.StageConnectionState.DISCONNECTED && this.callbacks.onDisconnected && this.callbacks.onDisconnected();
  }
}
class Sd {
  constructor(U, z, se) {
    rt(this, "callbacks");
    rt(this, "mediaManager");
    rt(this, "subscriptionManager");
    rt(this, "intervalId", null);
    this.callbacks = U, this.mediaManager = z, this.subscriptionManager = se;
  }
  start() {
    this.stop(), this.intervalId = window.setInterval(() => {
      this.mediaManager.media.forEach((U, z) => {
        var E, C, _, f;
        const se = this.subscriptionManager.getSubscription(z) || { video: !0, audio: !0 };
        let Te = 0;
        const ze = U.analyser;
        if (ze) {
          const b = new Uint8Array(ze.fftSize);
          ze.getByteTimeDomainData(b);
          let L = 0;
          for (let D = 0; D < b.length; D++) {
            const O = (b[D] - 128) / 128;
            L += O * O;
          }
          Te = Math.min(1, Math.sqrt(L / b.length) * 2);
        }
        const k = U.volume;
        U.volume = k * 0.6 + Te * 0.4, Math.abs(U.volume - k) > 0.02 && this.callbacks.onParticipantVolumeChanged && this.callbacks.onParticipantVolumeChanged(z, U.volume);
        const A = ((E = U.remoteStream) == null ? void 0 : E.getAudioTracks().some((b) => b.readyState === "live")) ?? !1, p = (U == null ? void 0 : U.videoElement) && ((C = U.videoElement) == null ? void 0 : C.videoWidth) > 0 && ((_ = U.videoElement) == null ? void 0 : _.videoHeight) > 0 || (((f = U.remoteStream) == null ? void 0 : f.getVideoTracks().some((b) => b.readyState === "live")) ?? !1), v = {
          hasAudio: se.audio && A,
          hasVideo: se.video && p,
          isActive: !!U.remoteStream && (A || p),
          lastUpdated: Date.now()
        }, m = U.streamStatus, y = m.hasAudio !== v.hasAudio || m.hasVideo !== v.hasVideo || m.isActive !== v.isActive;
        U.streamStatus = v, y && this.callbacks.onStreamStatusChanged && this.callbacks.onStreamStatusChanged(z, v);
      });
    }, 500);
  }
  stop() {
    this.intervalId && (clearInterval(this.intervalId), this.intervalId = null);
  }
}
class Ed {
  constructor() {
    rt(this, "subscriptions", /* @__PURE__ */ new Map());
  }
  setSubscription(U, z) {
    const se = this.subscriptions.get(U) || { video: !0, audio: !0 };
    this.subscriptions.set(U, {
      video: z.video ?? se.video,
      audio: z.audio ?? se.audio
    });
  }
  getSubscription(U) {
    return this.subscriptions.get(U) || null;
  }
  removeSubscription(U) {
    this.subscriptions.delete(U);
  }
  getSubscribeType(U) {
    const z = this.getSubscription(U.id) || { video: !0, audio: !0 };
    return z.video && z.audio || z.video ? Bn.SubscribeType.AUDIO_VIDEO : z.audio ? Bn.SubscribeType.AUDIO_ONLY : Bn.SubscribeType.NONE;
  }
}
class bd {
  constructor(U, z = {}) {
    rt(this, "config");
    rt(this, "callbacks");
    rt(this, "stageManager");
    rt(this, "publishManager");
    rt(this, "participantManager");
    rt(this, "subscriptionManager");
    rt(this, "mediaManager");
    rt(this, "commandManager");
    rt(this, "renderManager");
    rt(this, "statusMonitor");
    this.config = U, this.callbacks = z, this.participantManager = new pd(), this.subscriptionManager = new Ed(), this.mediaManager = new fd(this.callbacks, this.subscriptionManager), this.publishManager = new md(this.config, this.callbacks), this.stageManager = new _d(this.config, this.callbacks, this.publishManager, this.subscriptionManager), this.commandManager = new hd(this.config, this.callbacks, this.publishManager, this.mediaManager), this.renderManager = new vd(this.config, this.callbacks, this.mediaManager), this.statusMonitor = new Sd(this.callbacks, this.mediaManager, this.subscriptionManager), this.stageManager.setEventHandlers({
      onConnectionStateChanged: this.stageManager.handleConnectionStateChanged.bind(this.stageManager),
      onParticipantJoined: this.handleParticipantJoined.bind(this),
      onParticipantLeft: this.handleParticipantLeft.bind(this),
      onParticipantStreamsAdded: this.handleParticipantStreamsAdded.bind(this),
      onParticipantStreamsRemoved: this.handleParticipantStreamsRemoved.bind(this),
      onStreamSeiMessageReceived: this.config.enableInBandMessaging !== !1 ? this.commandManager.handleSeiMessage.bind(this.commandManager) : void 0
    });
  }
  async initialize() {
    try {
      await this.stageManager.initialize(), this.config.role === "admin" && await this.publishManager.startPublishing(), this.statusMonitor.start(), this.callbacks.onInitialized && this.callbacks.onInitialized();
    } catch (U) {
      throw this.callbacks.onError && this.callbacks.onError(U), U;
    }
  }
  async startPublishing() {
    await this.publishManager.startPublishing();
  }
  stopPublishing() {
    this.publishManager.stopPublishing();
  }
  toggleVideo() {
    this.publishManager.toggleVideo();
  }
  toggleAudio() {
    this.publishManager.toggleAudio();
  }
  setLocalAudioEnabled(U) {
    this.publishManager.setLocalAudioEnabled(U);
  }
  setLocalVideoEnabled(U) {
    this.publishManager.setLocalVideoEnabled(U);
  }
  getParticipants() {
    return this.participantManager.getParticipants().map((U) => ({
      id: U.id,
      userId: U.userId,
      role: U.role,
      isPublishing: U.isPublishing
    }));
  }
  leaveStage() {
    this.publishManager.stopPublishing(), this.stageManager.leave(), this.statusMonitor.stop(), this.renderManager.cleanup(), this.mediaManager.cleanupAll(), this.participantManager.clear(), this.callbacks.onStageLeft && this.callbacks.onStageLeft();
  }
  setParticipantSubscription(U, z) {
    this.subscriptionManager.setSubscription(U, z), this.mediaManager.updateSubscription(U), this.stageManager.refreshStrategy();
  }
  getParticipantSubscription(U) {
    return this.subscriptionManager.getSubscription(U);
  }
  muteParticipantAudio(U) {
    this.commandManager.muteAudio(U);
  }
  unmuteParticipantAudio(U) {
    this.commandManager.unmuteAudio(U);
  }
  muteParticipantVideo(U) {
    this.commandManager.muteVideo(U);
  }
  unmuteParticipantVideo(U) {
    this.commandManager.unmuteVideo(U);
  }
  getParticipantVolume(U) {
    return this.mediaManager.getVolume(U);
  }
  getParticipantCanvases() {
    return this.renderManager.getCanvases();
  }
  getParticipantCanvas(U) {
    return this.renderManager.getCanvas(U);
  }
  createCustomParticipantCanvas(U, z) {
    return this.renderManager.createCanvas(U, z);
  }
  removeCustomParticipantCanvas(U) {
    this.renderManager.removeCanvas(U);
  }
  async broadcastCommandViaSei(U, z) {
    return await this.commandManager.broadcastCommand(U, z);
  }
  handleParticipantJoined(U) {
    this.participantManager.add(U), this.subscriptionManager.setSubscription(U.id, { video: !0, audio: !0 }), this.mediaManager.initializeParticipant(U.id), this.renderManager.addParticipant(U.id), this.callbacks.onParticipantJoined && this.callbacks.onParticipantJoined(U.id, U.attributes);
  }
  handleParticipantLeft(U) {
    this.participantManager.remove(U.id), this.subscriptionManager.removeSubscription(U.id), this.mediaManager.cleanup(U.id), this.renderManager.removeParticipant(U.id), this.callbacks.onParticipantLeft && this.callbacks.onParticipantLeft(U.id);
  }
  handleParticipantStreamsAdded(U, z) {
    const se = this.mediaManager.addStreams(U.id, z);
    this.commandManager.checkSelfParticipant(U, z), this.mediaManager.attachStreams(U.id), this.callbacks.onRemoteStreamAdded && this.callbacks.onRemoteStreamAdded(se, U.id);
  }
  handleParticipantStreamsRemoved(U, z) {
    this.mediaManager.removeStreams(U.id, z) || (this.mediaManager.cleanup(U.id), this.callbacks.onRemoteStreamRemoved && this.callbacks.onRemoteStreamRemoved(U.id));
  }
}
export {
  aa as CommandType,
  bd as CommunicationSDK
};
