import BeatmapRenderer from "./BeatmapRenderer";
import TimelineRenderer, {TimelineEntry} from "./TimelineRenderer";
import TimelineViewport from "../utils/TimelineViewport";
import SliderPathBuffer from "../drawables/standard/SliderPathBuffer";
import PlaybackTiming from "../internal/PlaybackTiming";
import {createTimelineEntries} from "../internal/StandardAdapter";
import type {PreparedBeatmap} from "../loaders/PreparedBeatmap";

export default class StandardTimelineRenderer extends BeatmapRenderer<TimelineEntry> {
    private readonly timeline: TimelineRenderer;
    constructor(ctx: CanvasRenderingContext2D, prepared: PreparedBeatmap, viewport = new TimelineViewport()) {
        const pathBuffer = new SliderPathBuffer();
        const entries = createTimelineEntries(prepared, pathBuffer);
        super(ctx, prepared, entries);
        this.timeline = new TimelineRenderer(ctx, entries, prepared.beatmap.controlPoints.timingPoints,
            new PlaybackTiming(prepared.clockRate), pathBuffer, viewport);
    }
    public get objectRadius(): number { return this.timeline.objectRadius; }
    public set objectRadius(value: number) { this.timeline.objectRadius = value; }
    public resize(width: number, height: number): void { this.timeline.resize(width, height); }
    public render(playbackTimeMs: number): void { this.timeline.render(playbackTimeMs); }
    public dispose(): void { super.dispose(); this.timeline.dispose(); }
}
