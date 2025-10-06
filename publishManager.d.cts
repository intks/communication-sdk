import { LocalStageStream } from 'amazon-ivs-web-broadcast';
import { SDKCallbacks, SDKConfig } from './types';
export declare class PublishManager {
    private config;
    private callbacks;
    private localStreams;
    private localStream;
    private isPublishing;
    private isLocalAudioEnabled;
    private defaultVideoResolution;
    constructor(config: SDKConfig, callbacks: SDKCallbacks);
    startPublishing(): Promise<void>;
    stopPublishing(): void;
    toggleVideo(): void;
    toggleAudio(): void;
    setLocalAudioEnabled(enabled: boolean): void;
    setLocalVideoEnabled(enabled: boolean): void;
    getStreams(): LocalStageStream[];
    shouldPublish(): boolean;
}
