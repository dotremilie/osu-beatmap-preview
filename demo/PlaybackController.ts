export interface FrameClock {
    now(): number;
    request(callback: FrameRequestCallback): number;
    cancel(id: number): void;
}
const browserClock: FrameClock = {
    now: () => performance.now(),
    request: callback => requestAnimationFrame(callback),
    cancel: id => cancelAnimationFrame(id),
};

/** One clock and one pending frame for playback and all input invalidations. */
export default class PlaybackController {
    private positionMs = 0;
    private durationMs = 1;
    private isPlaying = false;
    public get position(): number { return this.positionMs; }
    public get duration(): number { return this.durationMs; }
    public get playing(): boolean { return this.isPlaying; }
    private frameId?: number;
    private previousFrame = 0;
    private dirty = false;
    private disposed = false;

    constructor(
        private readonly render: () => void,
        private readonly stateChanged: () => void,
        private readonly clock: FrameClock = browserClock,
    ) {}

    public load(durationMs: number, positionMs: number): void {
        this.durationMs = Math.max(1, durationMs);
        this.seek(positionMs);
        this.setPlaying(true);
        this.stateChanged();
    }

    public setPlaying(playing: boolean): void {
        if (this.disposed || this.isPlaying === playing) return;
        this.advance(this.clock.now());
        this.isPlaying = playing;
        this.previousFrame = this.clock.now();
        this.stateChanged();
        this.invalidate();
    }

    public seek(playbackTimeMs: number): void {
        if (!Number.isFinite(playbackTimeMs) || this.disposed) return;
        this.positionMs = Math.max(0, Math.min(playbackTimeMs, this.duration));
        this.previousFrame = this.clock.now();
        this.invalidate();
    }

    public invalidate(): void {
        if (this.disposed) return;
        this.dirty = true;
        this.frameId ??= this.clock.request(this.frame);
    }

    public dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.isPlaying = false;
        if (this.frameId !== undefined) this.clock.cancel(this.frameId);
        this.frameId = undefined;
    }

    private advance(now: number): void {
        if (this.playing) {
            this.positionMs += Math.max(0, now - this.previousFrame);
            if (this.position >= this.duration) this.positionMs = 0;
        }
        this.previousFrame = now;
    }

    private readonly frame = (now: number): void => {
        this.frameId = undefined;
        if (this.disposed) return;
        this.advance(now);
        if (this.dirty || this.playing) {
            this.dirty = false;
            this.render();
        }
        if (this.playing) this.frameId ??= this.clock.request(this.frame);
    };
}
