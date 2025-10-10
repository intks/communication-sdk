import { RemoteCommand, SDKCallbacks, SDKConfig } from './types';
export interface ParticipantInfo {
    id: string;
    role: 'admin' | 'user';
    isPublishing: boolean;
}
interface CommunicationSDKInterface {
    initialize(): Promise<void>;
    startPublishing(): Promise<void>;
    stopPublishing(): void;
    toggleVideo(): void;
    toggleAudio(): void;
    setLocalAudioEnabled(enabled: boolean): void;
    setLocalVideoEnabled(enabled: boolean): void;
    getParticipants(): ParticipantInfo[];
    getSelfId(): string | null;
    leaveStage(): void;
    setParticipantSubscription(participantId: string, preferences: {
        video?: boolean;
        audio?: boolean;
    }): void;
    getParticipantSubscription(participantId: string): {
        video: boolean;
        audio: boolean;
    } | null;
    muteParticipantAudio(participantId: string): void;
    unmuteParticipantAudio(participantId: string): void;
    muteParticipantVideo(participantId: string): void;
    unmuteParticipantVideo(participantId: string): void;
    getParticipantVolume(participantId: string): number;
    getParticipantCanvases(): Map<string, HTMLCanvasElement>;
    getParticipantCanvas(participantId: string): HTMLCanvasElement | null;
    createParticipantCanvas(participantId: string, container: HTMLElement): HTMLCanvasElement;
    removeParticipantCanvas(participantId: string): void;
    broadcastCommand(command: RemoteCommand, repeatCount?: number): Promise<boolean>;
}
export declare class CommunicationSDK implements CommunicationSDKInterface {
    private config;
    private callbacks;
    private stageManager;
    private publishManager;
    private participantManager;
    private subscriptionManager;
    private mediaManager;
    private commandManager;
    private renderManager;
    private statusMonitor;
    constructor(config: SDKConfig, callbacks?: SDKCallbacks);
    initialize(): Promise<void>;
    startPublishing(): Promise<void>;
    stopPublishing(): void;
    toggleVideo(): void;
    toggleAudio(): void;
    setLocalAudioEnabled(enabled: boolean): void;
    setLocalVideoEnabled(enabled: boolean): void;
    getParticipants(): ParticipantInfo[];
    getSelfId(): string | null;
    leaveStage(): void;
    setParticipantSubscription(participantId: string, preferences: {
        video?: boolean;
        audio?: boolean;
    }): void;
    getParticipantSubscription(participantId: string): {
        video: boolean;
        audio: boolean;
    } | null;
    muteParticipantAudio(participantId: string): void;
    unmuteParticipantAudio(participantId: string): void;
    muteParticipantVideo(participantId: string): void;
    unmuteParticipantVideo(participantId: string): void;
    getParticipantVolume(participantId: string): number;
    getParticipantCanvases(): Map<string, HTMLCanvasElement>;
    getParticipantCanvas(participantId: string): HTMLCanvasElement | null;
    createParticipantCanvas(participantId: string, container: HTMLElement): HTMLCanvasElement;
    removeParticipantCanvas(participantId: string): void;
    broadcastCommand(command: RemoteCommand, repeatCount?: number): Promise<boolean>;
    private getLocalStreamStatus;
    private updateParticipantStatus;
    private handleParticipantJoined;
    private handleParticipantLeft;
    private handleParticipantStreamsAdded;
    private handleParticipantStreamsRemoved;
}
export {};
