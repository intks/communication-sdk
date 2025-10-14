import { StageConnectionState } from 'amazon-ivs-web-broadcast';
import { PublishManager } from './publishManager';
import { SDKCallbacks, SDKConfig } from './types';
export declare class StageManager {
    private config;
    private callbacks;
    private publishManager;
    private stage;
    private handlers;
    constructor(config: SDKConfig, callbacks: SDKCallbacks, publishManager: PublishManager);
    setEventHandlers(handlers: typeof this.handlers): void;
    initialize(): Promise<void>;
    private createStrategy;
    private registerEvents;
    private unregisterEvents;
    refreshStrategy(): void;
    leave(): void;
    handleConnectionStateChanged(state: StageConnectionState): void;
}
