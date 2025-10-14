import { StageStream } from 'amazon-ivs-web-broadcast';
import { ParticipantManager } from './participantManager';
import { SDKCallbacks, StreamStatus } from './types';
interface ParticipantMediaData {
    remoteStream: MediaStream | null;
    videoElement: HTMLVideoElement | null;
    audioElement: HTMLAudioElement | null;
    audioContext: AudioContext | null;
    analyser: AnalyserNode | null;
    source: MediaStreamAudioSourceNode | null;
    volume: number;
    streamStatus: StreamStatus;
    remoteControlState: {
        hasAudio?: boolean;
        hasVideo?: boolean;
        lastUpdated: number;
    } | null;
}
export declare class MediaManager {
    private callbacks;
    private participantManager;
    private audioContext;
    private isSafari;
    media: Map<string, ParticipantMediaData>;
    constructor(callbacks: SDKCallbacks, participantManager: ParticipantManager);
    initializeParticipant(id: string): void;
    addStreams(id: string, streams: StageStream[]): MediaStream;
    removeStreams(id: string, streams: StageStream[]): boolean;
    attachStreams(id: string): void;
    private updateVideoElement;
    private setupAudioPlayback;
    private cleanupAudio;
    updateStreamStatus(id: string): void;
    getVolume(id: string): number;
    getAnalyser(id: string): AnalyserNode | null;
    cleanup(id: string): void;
    cleanupAll(): void;
    forceRefreshVideoElement(id: string): void;
    setLocalStream(id: string, stream: MediaStream): void;
    setRemoteControlState(id: string, type: 'audio' | 'video', enabled: boolean): void;
    private getAudioContext;
}
export {};
