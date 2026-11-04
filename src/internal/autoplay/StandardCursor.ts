import type {PreparedBeatmap} from "../../loaders/PreparedBeatmap";
import StandardReplay, {CursorState, getAutoplayReplay} from "./StandardReplay";
import DrawableCursor from "../../drawables/standard/DrawableCursor";

const TRAIL_PLAYBACK_MS = 300;
const SAMPLE_PLAYBACK_MS = 1000 / 120;
const MAX_TRAIL_SAMPLES = 37;
// Argon overrides the generic cursor trail's 1.7 exponent.
const TRAIL_FADE_EXPONENT = 4;

export interface TrailSample extends CursorState { opacity: number; }

/** Owns bounded evaluation scratch state, while replay geometry is shared read-only. */
export default class StandardCursor {
    private replay?: StandardReplay;
    private readonly state: CursorState = {x: 0, y: 0, scale: 1, actions: 0};
    private readonly trail: TrailSample[] = [];
    private readonly painter = new DrawableCursor();

    public draw(ctx: CanvasRenderingContext2D, prepared: PreparedBeatmap, beatmapTimeMs: number, cursorTrail = true): void {
        this.replay ??= getAutoplayReplay(prepared);
        if (!this.replay.sample(beatmapTimeMs, this.state)) return;
        if (cursorTrail) this.evaluateTrail(prepared.clockRate, beatmapTimeMs);
        else this.trail.length = 0;
        this.painter.draw(ctx, this.state, this.trail);
    }

    public dispose(): void {
        this.replay = undefined;
        this.trail.length = 0;
    }

    private evaluateTrail(clockRate: number, beatmapTimeMs: number): void {
        const replay = this.replay!;
        const lastTimeMs = replay.frames[replay.frames.length - 1].timeMs;
        const firstTimeMs = replay.frames[0].timeMs;
        let count = 0;
        for (let index = 0; index < MAX_TRAIL_SAMPLES; index++) {
            const agePlaybackMs = (MAX_TRAIL_SAMPLES - 1 - index) * SAMPLE_PLAYBACK_MS;
            const sampleTimeMs = beatmapTimeMs - agePlaybackMs * clockRate;
            if (sampleTimeMs < firstTimeMs || sampleTimeMs > lastTimeMs || agePlaybackMs >= TRAIL_PLAYBACK_MS) continue;
            const sample = this.trail[count] ?? {x: 0, y: 0, scale: 1, actions: 0, opacity: 0};
            replay.sample(sampleTimeMs, sample);
            sample.opacity = Math.pow(1 - agePlaybackMs / TRAIL_PLAYBACK_MS, TRAIL_FADE_EXPONENT);
            if (count > 0 && sample.x === this.trail[count - 1].x && sample.y === this.trail[count - 1].y) {
                Object.assign(this.trail[count - 1], sample);
            } else {
                this.trail[count++] = sample;
            }
        }
        this.trail.length = count;
    }
}
