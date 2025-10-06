var s = Object.defineProperty;
var r = (t, a, i) => a in t ? s(t, a, { enumerable: !0, configurable: !0, writable: !0, value: i }) : t[a] = i;
var e = (t, a, i) => r(t, typeof a != "symbol" ? a + "" : a, i);
import { CommandManager as o } from "./commandManager.js";
import { MediaManager as d } from "./mediaManager.js";
import { ParticipantManager as h } from "./participantManager.js";
import { PublishManager as c } from "./publishManager.js";
import { RenderManager as g } from "./renderManager.js";
import { StageManager as l } from "./stageManager.js";
import { StatusMonitor as m } from "./statusMonitor.js";
import { SubscriptionManager as u } from "./subscriptionManager.js";
class A {
  constructor(a, i = {}) {
    e(this, "config");
    e(this, "callbacks");
    e(this, "stageManager");
    e(this, "publishManager");
    e(this, "participantManager");
    e(this, "subscriptionManager");
    e(this, "mediaManager");
    e(this, "commandManager");
    e(this, "renderManager");
    e(this, "statusMonitor");
    this.config = a, this.callbacks = i, this.participantManager = new h(), this.subscriptionManager = new u(), this.mediaManager = new d(this.callbacks, this.subscriptionManager), this.publishManager = new c(this.config, this.callbacks), this.stageManager = new l(this.config, this.callbacks, this.publishManager, this.subscriptionManager), this.commandManager = new o(this.config, this.callbacks, this.publishManager, this.mediaManager), this.renderManager = new g(this.config, this.callbacks, this.mediaManager), this.statusMonitor = new m(this.callbacks, this.mediaManager, this.subscriptionManager), this.stageManager.setEventHandlers({
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
    } catch (a) {
      throw this.callbacks.onError && this.callbacks.onError(a), a;
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
  setLocalAudioEnabled(a) {
    this.publishManager.setLocalAudioEnabled(a);
  }
  setLocalVideoEnabled(a) {
    this.publishManager.setLocalVideoEnabled(a);
  }
  getParticipants() {
    return this.participantManager.getParticipants().map((a) => ({
      id: a.id,
      userId: a.userId,
      role: a.role,
      isPublishing: a.isPublishing
    }));
  }
  leaveStage() {
    this.publishManager.stopPublishing(), this.stageManager.leave(), this.statusMonitor.stop(), this.renderManager.cleanup(), this.mediaManager.cleanupAll(), this.participantManager.clear(), this.callbacks.onStageLeft && this.callbacks.onStageLeft();
  }
  setParticipantSubscription(a, i) {
    this.subscriptionManager.setSubscription(a, i), this.mediaManager.updateSubscription(a), this.stageManager.refreshStrategy();
  }
  getParticipantSubscription(a) {
    return this.subscriptionManager.getSubscription(a);
  }
  muteParticipantAudio(a) {
    this.commandManager.muteAudio(a);
  }
  unmuteParticipantAudio(a) {
    this.commandManager.unmuteAudio(a);
  }
  muteParticipantVideo(a) {
    this.commandManager.muteVideo(a);
  }
  unmuteParticipantVideo(a) {
    this.commandManager.unmuteVideo(a);
  }
  getParticipantVolume(a) {
    return this.mediaManager.getVolume(a);
  }
  getParticipantCanvases() {
    return this.renderManager.getCanvases();
  }
  getParticipantCanvas(a) {
    return this.renderManager.getCanvas(a);
  }
  createCustomParticipantCanvas(a, i) {
    return this.renderManager.createCanvas(a, i);
  }
  removeCustomParticipantCanvas(a) {
    this.renderManager.removeCanvas(a);
  }
  async broadcastCommandViaSei(a, i) {
    return await this.commandManager.broadcastCommand(a, i);
  }
  handleParticipantJoined(a) {
    this.participantManager.add(a), this.subscriptionManager.setSubscription(a.id, { video: !0, audio: !0 }), this.mediaManager.initializeParticipant(a.id), this.renderManager.addParticipant(a.id), this.callbacks.onParticipantJoined && this.callbacks.onParticipantJoined(a.id, a.attributes);
  }
  handleParticipantLeft(a) {
    this.participantManager.remove(a.id), this.subscriptionManager.removeSubscription(a.id), this.mediaManager.cleanup(a.id), this.renderManager.removeParticipant(a.id), this.callbacks.onParticipantLeft && this.callbacks.onParticipantLeft(a.id);
  }
  handleParticipantStreamsAdded(a, i) {
    const n = this.mediaManager.addStreams(a.id, i);
    this.commandManager.checkSelfParticipant(a, i), this.mediaManager.attachStreams(a.id), this.callbacks.onRemoteStreamAdded && this.callbacks.onRemoteStreamAdded(n, a.id);
  }
  handleParticipantStreamsRemoved(a, i) {
    this.mediaManager.removeStreams(a.id, i) || (this.mediaManager.cleanup(a.id), this.callbacks.onRemoteStreamRemoved && this.callbacks.onRemoteStreamRemoved(a.id));
  }
}
export {
  A as CommunicationSDK
};
