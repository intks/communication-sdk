import { SeiMessage, StageParticipantInfo } from 'amazon-ivs-web-broadcast';
import { MediaManager } from './mediaManager';
import { ParticipantManager } from './participantManager';
import { PublishManager } from './publishManager';
import { RemoteCommand, SDKCallbacks, SDKConfig } from './types';
export declare class CommandManager {
    private config;
    private callbacks;
    private publishManager;
    private mediaManager;
    private participantManager;
    constructor(config: SDKConfig, callbacks: SDKCallbacks, publishManager: PublishManager, mediaManager: MediaManager, participantManager: ParticipantManager);
    handleSeiMessage(_: StageParticipantInfo, msg: SeiMessage): void;
    private applyCommand;
    private handleAudioControl;
    private handleVideoControl;
    private updateAndBroadcastStatus;
    private handleStatusUpdate;
    broadcastCommand(command: RemoteCommand, repeatCount?: number): Promise<boolean>;
    private sendSeiMessage;
    muteAudio(id: string): void;
    unmuteAudio(id: string): void;
    muteVideo(id: string): void;
    unmuteVideo(id: string): void;
}
