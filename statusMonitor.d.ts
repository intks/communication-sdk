import { MediaManager } from './mediaManager';
import { ParticipantManager } from './participantManager';
import { SDKCallbacks } from './types';
export declare class StatusMonitor {
    private callbacks;
    private mediaManager;
    private participantManager;
    private animationId;
    private lastUpdateTime;
    private updateInterval;
    private volumeThreshold;
    constructor(callbacks: SDKCallbacks, mediaManager: MediaManager, participantManager: ParticipantManager);
    start(): void;
    stop(): void;
    private updateVolumes;
}
