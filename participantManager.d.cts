import { StageParticipantInfo } from 'amazon-ivs-web-broadcast';
import { ParticipantInfo } from './communication';
export declare class ParticipantManager {
    private participants;
    add(participant: StageParticipantInfo): void;
    remove(id: string): void;
    getParticipants(): ParticipantInfo[];
    clear(): void;
}
