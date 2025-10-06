import { StageStream } from 'amazon-ivs-web-broadcast';
import { SubscriptionManager } from './subscriptionManager';
import { SDKCallbacks, StreamStatus } from './types';
interface ParticipantMediaData {
    remoteStream: MediaStream | null;
    videoElement: HTMLVideoElement | null;
    audioElement?: HTMLAudioElement | null;
    volume: number;
    streamStatus: StreamStatus;
    audioContext?: AudioContext | null;
    analyser?: AnalyserNode | null;
    source?: MediaStreamAudioSourceNode | null;
}
export declare class MediaManager {
    private callbacks;
    private subscriptionManager;
    private audioContext;
    private selfId;
    private isSafari;
    media: Map<string, ParticipantMediaData>;
    constructor(callbacks: SDKCallbacks, subscriptionManager: SubscriptionManager);
    initializeParticipant(id: string): void;
    addStreams(id: string, streams: StageStream[]): MediaStream;
    removeStreams(id: string, streams: StageStream[]): boolean;
    attachStreams(id: string): void;
    private updateVideoElement;
    private setupAudioPlayback;
    private cleanupAudio;
    updateSubscription(id: string): void;
    updateStreamStatus(id: string): void;
    getVolume(id: string): number;
    getAnalyser(id: string): AnalyserNode | null;
    cleanup(id: string): void;
    cleanupAll(): void;
    setSelfId(id: string): void;
    private getAudioContext;
}
export {};
