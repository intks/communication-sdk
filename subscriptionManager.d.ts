import { StageParticipantInfo, SubscribeType } from 'amazon-ivs-web-broadcast';
export declare class SubscriptionManager {
    private subscriptions;
    setSubscription(id: string, preferences: {
        video?: boolean;
        audio?: boolean;
    }): void;
    getSubscription(id: string): {
        video: boolean;
        audio: boolean;
    } | null;
    removeSubscription(id: string): void;
    getSubscribeType(participant: StageParticipantInfo): SubscribeType;
}
