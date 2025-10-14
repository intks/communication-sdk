import { StageParticipantInfo, StageStream } from 'amazon-ivs-web-broadcast';
import { PublishManager } from './publishManager';
export declare class ParticipantManager {
    private participants;
    private publishManager;
    private selfId;
    constructor(publishManager: PublishManager);
    getSelfId(): string | null;
    checkSelfParticipant(participant: StageParticipantInfo, streams: StageStream[]): void;
    add(participant: StageParticipantInfo): void;
    remove(id: string): void;
    getParticipants(): IterableIterator<StageParticipantInfo>;
    clear(): void;
}
