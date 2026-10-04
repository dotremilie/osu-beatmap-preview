import {validateCanvasSize} from "../internal/CanvasSurface";
import type {StandardHitObject} from "osu-standard-stable";
import {DrawableSpinner} from "../drawables/standard/DrawableSpinner";
import {DrawableCircle} from "../drawables/standard/DrawableCircle";
import {DrawableSlider} from "../drawables/standard/DrawableSlider";
import BeatmapRenderer from "./BeatmapRenderer";
import {DrawableStandardHitObject} from "../drawables/standard/DrawableStandardHitObject";
import TimeIntervalIndex from "../utils/TimeIntervalIndex";
import SliderPathRasterCache from "../drawables/standard/SliderPathRasterCache";
import {createPlayfieldObjects} from "../internal/StandardAdapter";
import type {PreparedBeatmap} from "../loaders/PreparedBeatmap";
import PlaybackTiming from "../internal/PlaybackTiming";

import StandardCursor from "../internal/autoplay/StandardCursor";
import FollowPointRenderer from "../internal/followpoints/FollowPointRenderer";
import {createFollowPointConnections} from "../internal/followpoints/FollowPoint";

export interface StandardBeatmapRendererOptions { autoplay?: boolean; cursorTrail?: boolean; }

export const CIRCLE_BORDER_WIDTH = 0.15;

export default class StandardBeatmapRenderer extends BeatmapRenderer<DrawableStandardHitObject<StandardHitObject>> {
    private readonly intervalIndex: TimeIntervalIndex;
    private readonly visibleIndices: number[] = [];

    private readonly rasterCache: SliderPathRasterCache;
    private readonly timing: PlaybackTiming;
    private readonly followPoints: FollowPointRenderer;

    private readonly cursor = new StandardCursor();
    private autoplayEnabled: boolean;
    private cursorTrailEnabled: boolean;
    public get autoplay(): boolean { return this.autoplayEnabled; }
    public set autoplay(enabled: boolean) { this.autoplayEnabled = enabled; }
    public get cursorTrail(): boolean { return this.cursorTrailEnabled; }
    public set cursorTrail(enabled: boolean) { this.cursorTrailEnabled = enabled; }

    constructor(ctx: CanvasRenderingContext2D, prepared: PreparedBeatmap, options: StandardBeatmapRendererOptions = {}) {
        const cache = new SliderPathRasterCache();
        super(ctx, prepared, createPlayfieldObjects(prepared, cache));
        this.autoplayEnabled = options.autoplay ?? false;
        this.cursorTrailEnabled = options.cursorTrail ?? true;
        this.rasterCache = cache;
        this.timing = new PlaybackTiming(prepared.clockRate);
        this.followPoints = new FollowPointRenderer(createFollowPointConnections(prepared));

        this.intervalIndex = new TimeIntervalIndex(this.drawableHitObjects.map(object => ({
            startTime: object.hitObject.startTime - object.hitObject.timePreempt,
            endTime: (object instanceof DrawableSlider || object instanceof DrawableSpinner
                ? object.hitObject.endTime : object.hitObject.startTime) + object.HIT_DURATION,
        })));
    }

    public resize(width: number, height: number): void {
        validateCanvasSize(width, height);
        this.rasterCache.release();
    }

    public dispose(): void {
        super.dispose();
        this.rasterCache.release();
        this.cursor.dispose();
        this.followPoints.dispose();
    }

    public render(time: number): void {
        if (this.disposed || !Number.isFinite(time)) return;
        time = this.timing.playbackToBeatmap(time);
        this.intervalIndex.query(time, time, this.visibleIndices);

        this.ctx.save();
        try {
            this.followPoints.draw(this.ctx, time);
            for (const index of this.visibleIndices) {
                this.drawableHitObjects[index].draw(this.ctx, time);
            }

            for (const index of this.visibleIndices) {
                const object = this.drawableHitObjects[index];
                if (object instanceof DrawableSlider) {
                    object.sliderHead.approachCircle.draw(this.ctx, time);
                }

                if (object instanceof DrawableCircle) {
                    object.approachCircle.draw(this.ctx, time);
                }
            }
            if (this.autoplayEnabled) this.cursor.draw(this.ctx, this.prepared, time, this.cursorTrailEnabled);
        } finally {
            this.ctx.restore();
        }
    }
}
