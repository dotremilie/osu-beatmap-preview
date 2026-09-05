import {StandardBeatmap, StandardRuleset} from "osu-standard-stable";
import StandardTimelineRenderer from "../renderers/StandardTimelineRenderer";
import TimelineViewport, {TimelineOptions} from "../utils/TimelineViewport";
import BeatmapPreviewer, {BeatmapPreviewOptions} from "./BeatmapPreviewer";

export interface TimelinePreviewOptions extends Omit<BeatmapPreviewOptions, "offset">, TimelineOptions {}

export default class StandardTimelinePreviewer extends BeatmapPreviewer<StandardBeatmap, StandardTimelineRenderer> {
    private readonly viewport: TimelineViewport;

    constructor(canvas: HTMLCanvasElement, options: TimelinePreviewOptions = {}) {
        const viewport = new TimelineViewport(options);

        super(canvas, new StandardRuleset(), (ctx, beatmap) => new StandardTimelineRenderer(ctx, beatmap, viewport), {
            ...options,
            height: options.height ?? 40,
            offset: {x: 0, y: 0},
        });

        this.viewport = viewport;
    }

    public get timeRange(): number {
        return this.viewport.timeRange;
    }

    public get objectRadius(): number {
        return this.viewport.objectRadius;
    }

    public set objectRadius(value: number) {
        this.viewport.objectRadius = value;
    }

    public set timeRange(value: number) {
        this.viewport.timeRange = value;
    }

    public zoom(factor: number): void {
        this.viewport.zoom(factor);
    }

    public get beatSnapDivisor(): number {
        return this.viewport.beatSnapDivisor;
    }

    public set beatSnapDivisor(value: number) {
        this.viewport.beatSnapDivisor = value;
    }

    /** Converts a logical canvas x coordinate to the time accepted by render(). */
    public timeAtPosition(x: number, currentTime: number): number {
        return this.viewport.timeAtPosition(x, currentTime, this.width);
    }
}
