var o = Object.defineProperty;
var d = (a, e, s) => e in a ? o(a, e, { enumerable: !0, configurable: !0, writable: !0, value: s }) : a[e] = s;
var i = (a, e, s) => d(a, typeof e != "symbol" ? e + "" : e, s);
import { Stage as l, StageEvents as t, StageConnectionState as n } from "amazon-ivs-web-broadcast";
class S {
  constructor(e, s, r, h) {
    i(this, "config");
    i(this, "callbacks");
    i(this, "publishManager");
    i(this, "subscriptionManager");
    i(this, "stage", null);
    i(this, "strategyRefreshTimerId", null);
    i(this, "handlers", {});
    this.config = e, this.callbacks = s, this.publishManager = r, this.subscriptionManager = h;
  }
  setEventHandlers(e) {
    this.handlers = e;
  }
  async initialize() {
    try {
      this.stage = new l(this.config.token, this.createStrategy()), this.registerEvents(), await this.stage.join();
    } catch (e) {
      throw console.error("Stage initialization failed:", e), e;
    }
  }
  createStrategy() {
    return {
      stageStreamsToPublish: () => this.publishManager.getStreams(),
      shouldPublishParticipant: () => this.publishManager.shouldPublish(),
      shouldSubscribeToParticipant: (e) => this.subscriptionManager.getSubscribeType(e),
      subscribeConfiguration: this.config.enableInBandMessaging !== !1 ? () => ({ inBandMessaging: { enabled: !0 } }) : void 0
    };
  }
  registerEvents() {
    this.stage && (this.handlers.onConnectionStateChanged && this.stage.on(t.STAGE_CONNECTION_STATE_CHANGED, this.handlers.onConnectionStateChanged), this.handlers.onParticipantJoined && this.stage.on(t.STAGE_PARTICIPANT_JOINED, this.handlers.onParticipantJoined), this.handlers.onParticipantLeft && this.stage.on(t.STAGE_PARTICIPANT_LEFT, this.handlers.onParticipantLeft), this.handlers.onParticipantStreamsAdded && this.stage.on(t.STAGE_PARTICIPANT_STREAMS_ADDED, this.handlers.onParticipantStreamsAdded), this.handlers.onParticipantStreamsRemoved && this.stage.on(t.STAGE_PARTICIPANT_STREAMS_REMOVED, this.handlers.onParticipantStreamsRemoved), this.handlers.onStreamSeiMessageReceived && this.config.enableInBandMessaging !== !1 && this.stage.on(t.STAGE_STREAM_SEI_MESSAGE_RECEIVED, this.handlers.onStreamSeiMessageReceived));
  }
  unregisterEvents() {
    this.stage && (this.handlers.onConnectionStateChanged && this.stage.off(t.STAGE_CONNECTION_STATE_CHANGED, this.handlers.onConnectionStateChanged), this.handlers.onParticipantJoined && this.stage.off(t.STAGE_PARTICIPANT_JOINED, this.handlers.onParticipantJoined), this.handlers.onParticipantLeft && this.stage.off(t.STAGE_PARTICIPANT_LEFT, this.handlers.onParticipantLeft), this.handlers.onParticipantStreamsAdded && this.stage.off(t.STAGE_PARTICIPANT_STREAMS_ADDED, this.handlers.onParticipantStreamsAdded), this.handlers.onParticipantStreamsRemoved && this.stage.off(t.STAGE_PARTICIPANT_STREAMS_REMOVED, this.handlers.onParticipantStreamsRemoved), this.handlers.onStreamSeiMessageReceived && this.stage.off(t.STAGE_STREAM_SEI_MESSAGE_RECEIVED, this.handlers.onStreamSeiMessageReceived));
  }
  refreshStrategy() {
    this.strategyRefreshTimerId && clearTimeout(this.strategyRefreshTimerId), this.strategyRefreshTimerId = window.setTimeout(() => {
      var e;
      try {
        (e = this.stage) == null || e.refreshStrategy();
      } catch (s) {
        console.error("Failed to refresh strategy:", s);
      }
      this.strategyRefreshTimerId = null;
    }, 0);
  }
  leave() {
    var e;
    this.unregisterEvents(), (e = this.stage) == null || e.leave(), this.stage = null;
  }
  handleConnectionStateChanged(e) {
    e === n.CONNECTED && this.callbacks.onConnected ? this.callbacks.onConnected() : e === n.DISCONNECTED && this.callbacks.onDisconnected && this.callbacks.onDisconnected();
  }
}
export {
  S as StageManager
};
