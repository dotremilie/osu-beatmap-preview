/** Converts explicitly between view playback milliseconds and model milliseconds. */
export default class PlaybackTiming {
    constructor(public readonly clockRate: number, private readonly previewOffsetMs = 0) {}
    public playbackToBeatmap(playbackTimeMs: number): number { return this.offsetPlayback(playbackTimeMs) * this.clockRate; }
    public beatmapToPlayback(beatmapTimeMs: number): number { return beatmapTimeMs / this.clockRate - this.previewOffsetMs; }
    public offsetPlayback(playbackTimeMs: number): number { return playbackTimeMs + this.previewOffsetMs; }
}
