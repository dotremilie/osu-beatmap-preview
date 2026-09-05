import {StandardBeatmap} from "osu-standard-stable";
import {DrawableTimelineHitObject} from "../drawables/standard/DrawableTimelineHitObject";
import {getStandardComboColors} from "../utils/StandardComboColors";
import TimelineViewport from "../utils/TimelineViewport";
import {getTimelineTicks} from "../utils/TimelineBeatGrid";
import BeatmapRenderer from "./BeatmapRenderer";
import {getTimelineTickStyle} from "./TimelineTickStyle";
import TimeIntervalIndex from "../utils/TimeIntervalIndex";
import {releaseSliderPathCache} from "../drawables/standard/SliderPathRasterCache";

export default class StandardTimelineRenderer extends BeatmapRenderer<StandardBeatmap, DrawableTimelineHitObject> {
    private width = 640;
    private height = 40;
    private readonly intervalIndex: TimeIntervalIndex;
    private readonly visibleIndices: number[] = [];

    constructor(
        ctx: CanvasRenderingContext2D,
        beatmap: StandardBeatmap,
        private readonly viewport = new TimelineViewport(),
    ) {
        super(ctx, beatmap);

        this.intervalIndex = new TimeIntervalIndex(this.drawableHitObjects.map(object => ({
            startTime: object.startTime,
            endTime: Math.max(object.startTime, object.endTime),
        })));
    }

    protected initializeDrawableHitObjects(): void {
        const comboColors = getStandardComboColors(this.beatmap);

        this.drawableHitObjects = this.beatmap.hitObjects.map((object) => new DrawableTimelineHitObject(
            object,
            comboColors[object.comboIndexWithOffsets % comboColors.length],
            this.beatmap.difficulty.clockRate,
        ));
    }

    public resize(width: number, height: number): void {
        this.width = width;
        this.height = height;
        releaseSliderPathCache(this.ctx);
    }

    public dispose(): void {
        releaseSliderPathCache(this.ctx);
    }

    public get objectRadius(): number {
        return this.viewport.objectRadius;
    }

    public set objectRadius(value: number) {
        this.viewport.objectRadius = value;
    }

    public render(time: number): void {
        const {ctx, width, height} = this;
        if (!Number.isFinite(time) || width <= 0 || height <= 0) return;

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, width, height);
        ctx.clip();

        this.drawRuler(time);
        const objectY = this.objectRadius + Math.max(1, this.objectRadius * 2 / 58);
        const halfRange = this.viewport.timeRange / 2;
        const radiusPadding = this.objectRadius / width * this.viewport.timeRange;
        this.intervalIndex.query(time - halfRange - radiusPadding, time + halfRange + radiusPadding, this.visibleIndices);

        // Draw complete objects in reverse order, matching the playfield renderer.
        for (const index of this.visibleIndices) {
            this.drawableHitObjects[index].draw(ctx, time, this.viewport, width, objectY);
        }

        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#ff8fc9";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(width / 2, 0);
        ctx.lineTo(width / 2, height);
        ctx.stroke();
        ctx.fillStyle = "#ff8fc9";
        ctx.beginPath();
        ctx.moveTo(width / 2 - 5, 0);
        ctx.lineTo(width / 2 + 5, 0);
        ctx.lineTo(width / 2, 6);
        ctx.fill();
        ctx.restore();
    }

    private drawRuler(time: number): void {
        const {ctx, width, height, viewport} = this;
        const clockRate = this.beatmap.difficulty.clockRate;
        const ticks = getTimelineTicks(
            this.beatmap.controlPoints.timingPoints,
            (time - viewport.timeRange / 2) * clockRate,
            (time + viewport.timeRange / 2) * clockRate,
            viewport.beatSnapDivisor,
            viewport.timeRange * clockRate / width * 3,
        );

        ctx.globalAlpha = 1;
        ctx.lineCap = "butt";

        for (const tick of ticks) {
            const playbackTime = tick.time / clockRate;
            const x = viewport.positionAtTime(playbackTime, time, width);
            const style = getTimelineTickStyle(tick);
            ctx.strokeStyle = style.color;
            ctx.lineWidth = style.width;
            ctx.beginPath();
            ctx.moveTo(x, Math.max(0, height - style.height));
            ctx.lineTo(x, height);
            ctx.stroke();
        }
    }
}
