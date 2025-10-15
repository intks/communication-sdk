/**
 * Open a video input device.
 * @param {string} deviceId The device ID.
 * @param {number} width The width.
 * @param {number} height The height.
 * @returns {MediaStream} The media stream.
 */
export declare function openVideoInputDevice(deviceId: string, width: number, height: number): Promise<MediaStream>;
/**
 * Open an audio input device.
 * @param {string} deviceId The device ID.
 * @returns {MediaStream} The media stream.
 */
export declare function openAudioInputDevice(deviceId: string): Promise<MediaStream>;
/**
 * Get the status of a media stream.
 * @param {MediaStream | null} stream The media stream.
 * @returns {Object} The status of the media stream.
 */
export declare function getStreamStatus(stream: MediaStream | null): {
    hasAudio: boolean;
    hasVideo: boolean;
};
