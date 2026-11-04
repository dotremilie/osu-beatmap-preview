import {validateCanvasSize} from "../internal/CanvasSurface";
import type {TimingPoint} from "osu-classes";
import TimelineViewport from "../utils/TimelineViewport";
import {getTimelineTicks} from "../utils/TimelineBeatGrid";
import Renderer from "./Renderer";
import PlaybackTiming from "../internal/PlaybackTiming";
import {getTimelineTickStyle} from "./TimelineTickStyle";
import TimeIntervalIndex from "../utils/TimeIntervalIndex";
import SliderPathBuffer from "../drawables/standard/SliderPathBuffer";

export interface TimelineEntry {
    readonly startTime: number;
    readonly endTime: number;
    draw(ctx: CanvasRenderingContext2D, playbackTimeMs: number, viewport: TimelineViewport, width: number, y: number): void;
}

/** Ruleset-neutral timeline composition; entries supply only their own visuals. */
export default class TimelineRenderer extends Renderer {
    private width = 640;
    private height = 40;
    private readonly intervalIndex: TimeIntervalIndex;
    private readonly visibleIndices: number[] = [];

    constructor(
        ctx: CanvasRenderingContext2D,
        private readonly entries: readonly TimelineEntry[],
        private readonly timingPoints: readonly TimingPoint[],
        private readonly timing: PlaybackTiming,
        private readonly pathBuffer: SliderPathBuffer,
        private readonly viewport = new TimelineViewport(),
    ) {
        super(ctx);

        this.intervalIndex = new TimeIntervalIndex(this.entries.map(object => ({
            startTime: object.startTime,
            endTime: Math.max(object.startTime, object.endTime),
        })));
    }

    public resize(width: number, height: number): void {
        validateCanvasSize(width, height);
        this.width = width;
        this.height = height;
        this.pathBuffer.release();
    }

    public dispose(): void {
        super.dispose();
        this.pathBuffer.release();
    }

    public get objectRadius(): number {
        return this.viewport.objectRadius;
    }

    public set objectRadius(value: number) {
        this.viewport.objectRadius = value;
    }

    public render(time: number): void {
        const {ctx, width, height} = this;
        if (this.disposed || !Number.isFinite(time) || width <= 0 || height <= 0) return;

        ctx.save();
        try {
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
                this.entries[index].draw(ctx, time, this.viewport, width, objectY);
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
        } finally {
            ctx.restore();
        }
    }

    private drawRuler(time: number): void {
        const {ctx, width, height, viewport} = this;
        const clockRate = this.timing.clockRate;
        const ticks = getTimelineTicks(
            this.timingPoints,
            this.timing.playbackToBeatmap(time - viewport.timeRange / 2),
            this.timing.playbackToBeatmap(time + viewport.timeRange / 2),
            viewport.beatSnapDivisor,
            viewport.timeRange * clockRate / width * 3,
        );

        ctx.globalAlpha = 1;
        ctx.lineCap = "butt";

        for (const tick of ticks) {
            const playbackTime = this.timing.beatmapToPlayback(tick.time);
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
