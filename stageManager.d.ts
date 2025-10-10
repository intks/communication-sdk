import { StageConnectionState } from 'amazon-ivs-web-broadcast';
import { PublishManager } from './publishManager';
import { SubscriptionManager } from './subscriptionManager';
import { SDKCallbacks, SDKConfig } from './types';
export declare class StageManager {
    private config;
    private callbacks;
    private publishManager;
    private subscriptionManager;
    private stage;
    private handlers;
    constructor(config: SDKConfig, callbacks: SDKCallbacks, publishManager: PublishManager, subscriptionManager: SubscriptionManager);
    setEventHandlers(handlers: typeof this.handlers): void;
    initialize(): Promise<void>;
    private createStrategy;
    private registerEvents;
    private unregisterEvents;
    refreshStrategy(): void;
    leave(): void;
    handleConnectionStateChanged(state: StageConnectionState): void;
}
