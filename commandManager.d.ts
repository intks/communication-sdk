import { SeiMessage, StageParticipantInfo, StageStream } from 'amazon-ivs-web-broadcast';
import { MediaManager } from './mediaManager';
import { PublishManager } from './publishManager';
import { RemoteCommand, SDKCallbacks, SDKConfig } from './types';
export declare class CommandManager {
    private config;
    private callbacks;
    private publishManager;
    private mediaManager;
    private selfId;
    constructor(config: SDKConfig, callbacks: SDKCallbacks, publishManager: PublishManager, mediaManager: MediaManager);
    checkSelfParticipant(participant: StageParticipantInfo, streams: StageStream[]): void;
    handleSeiMessage(participant: StageParticipantInfo, msg: SeiMessage): void;
    private applyCommand;
    broadcastCommand(command: RemoteCommand, repeatCount?: number): Promise<boolean>;
    muteAudio(id: string): void;
    unmuteAudio(id: string): void;
    muteVideo(id: string): void;
    unmuteVideo(id: string): void;
}
