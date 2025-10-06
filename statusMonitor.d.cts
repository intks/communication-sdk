import { MediaManager } from './mediaManager';
import { SubscriptionManager } from './subscriptionManager';
import { SDKCallbacks } from './types';
export declare class StatusMonitor {
    private callbacks;
    private mediaManager;
    private subscriptionManager;
    private intervalId;
    constructor(callbacks: SDKCallbacks, mediaManager: MediaManager, subscriptionManager: SubscriptionManager);
    start(): void;
    stop(): void;
}
