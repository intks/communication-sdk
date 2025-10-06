import { MediaManager } from './mediaManager';
import { SDKCallbacks, SDKConfig } from './types';
export declare class RenderManager {
    private config;
    private callbacks;
    private mediaManager;
    private canvases;
    private resizeObservers;
    private animationFrameId;
    private lastRender;
    private targetFps;
    private isSafari;
    constructor(config: SDKConfig, callbacks: SDKCallbacks, mediaManager: MediaManager);
    addParticipant(id: string): void;
    removeParticipant(id: string): void;
    createCanvas(id: string, container: HTMLElement): HTMLCanvasElement;
    removeCanvas(id: string): void;
    private setupResizeObserver;
    private startRenderLoop;
    private stopRenderLoop;
    private renderCanvas;
    getCanvases(): Map<string, HTMLCanvasElement>;
    getCanvas(id: string): HTMLCanvasElement | null;
    cleanup(): void;
}
