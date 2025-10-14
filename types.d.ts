import { StageParticipantPublishState } from 'amazon-ivs-web-broadcast';
export interface SDKConfig {
    token: string;
    role: 'admin' | 'user';
    enableInBandMessaging?: boolean;
    videoInputDeviceId?: string;
    audioInputDeviceId?: string;
    canvasConfig?: {
        width?: number;
        height?: number;
        style?: Partial<CSSStyleDeclaration>;
    };
}
export declare enum CommandType {
    MuteAudio = "MUTE_AUDIO",
    UnmuteAudio = "UNMUTE_AUDIO",
    MuteVideo = "MUTE_VIDEO",
    UnmuteVideo = "UNMUTE_VIDEO",
    StatusUpdate = "STATUS_UPDATE"
}
export interface RemoteCommand {
    type: CommandType;
    targetParticipantId?: string;
    data?: any;
}
export interface StreamStatus {
    hasAudio: boolean;
    hasVideo: boolean;
    isActive: boolean;
    lastUpdated: number;
}
export interface SDKCallbacks {
    onInitialized?: () => void;
    onConnected?: () => void;
    onDisconnected?: () => void;
    onLocalStreamReady?: (stream: MediaStream) => void;
    onRemoteStreamAdded?: (stream: MediaStream, participantId: string) => void;
    onRemoteStreamRemoved?: (participantId: string) => void;
    onParticipantJoined?: (participantId: string, attributes?: Record<string, unknown>) => void;
    onParticipantLeft?: (participantId: string) => void;
    onParticipantPublishStateChanged?: (participantId: string, publishState: StageParticipantPublishState) => void;
    onVideoToggled?: (enabled: boolean) => void;
    onAudioToggled?: (enabled: boolean) => void;
    onPublishingStarted?: () => void;
    onPublishingStopped?: () => void;
    onError?: (error: Error) => void;
    onStageLeft?: (reason?: string) => void;
    onParticipantMuted?: (participantId: string, type: 'audio' | 'video') => void;
    onParticipantUnmuted?: (participantId: string, type: 'audio' | 'video') => void;
    onCommandReceived?: (command: RemoteCommand) => void;
    onStreamStatusChanged?: (participantId: string, status: StreamStatus) => void;
    onParticipantVolumeChanged?: (participantId: string, volume: number) => void;
    onParticipantCanvasCreated?: (participantId: string, canvas: HTMLCanvasElement) => void;
    onParticipantCanvasRemoved?: (participantId: string) => void;
}
