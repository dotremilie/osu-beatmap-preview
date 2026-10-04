import type {IBeatmap} from "osu-classes";
import type {StandardBeatmap} from "osu-standard-stable";
import BeatmapLoader, {BeatmapLoaderOptions} from "../loaders/BeatmapLoader";
import {assertPreparedBeatmap, PreparedBeatmap} from "../loaders/PreparedBeatmap";
import BeatmapRenderer from "../renderers/BeatmapRenderer";
import CanvasSurface, {CanvasProjection} from "../internal/CanvasSurface";
import PlaybackTiming from "../internal/PlaybackTiming";

export interface Offset { x: number; y: number; }
export interface BeatmapPreviewOptions {
    width?: number;
    height?: number;
    devicePixelRatio?: number;
    offset?: Offset;
    useBeatmapPreviewTime?: boolean;
}
export interface PreparedBeatmapOptions { useBeatmapPreviewTime?: boolean; }
export interface LoadBeatmapOptions extends BeatmapLoaderOptions, PreparedBeatmapOptions {}

/** Coordinates prepared data, a renderer and an independently owned canvas surface. */
export default abstract class BeatmapPreviewer<TRenderer extends BeatmapRenderer<unknown>> {
    private readonly surface: CanvasSurface;
    private readonly loader = new BeatmapLoader();
    private readonly useBeatmapPreviewTime: boolean;
    private renderer?: TRenderer;
    private timing = new PlaybackTiming(1);

    protected constructor(
        canvas: HTMLCanvasElement,
        private readonly createRenderer: (ctx: CanvasRenderingContext2D, prepared: PreparedBeatmap) => TRenderer,
        private readonly projection: CanvasProjection,
        options: Omit<BeatmapPreviewOptions, "offset"> = {},
    ) {
        this.useBeatmapPreviewTime = options.useBeatmapPreviewTime ?? false;
        this.surface = new CanvasSurface(canvas);
        this.surface.resize(options.width ?? 640, options.height ?? 480, options.devicePixelRatio);
    }

    protected get attachedRenderer(): TRenderer | undefined { return this.renderer; }
    protected get width(): number { return this.surface.width; }
    public get beatmap(): Readonly<StandardBeatmap> | null { return this.renderer?.beatmap ?? null; }

    public loadBeatmapText(text: string, options: LoadBeatmapOptions = {}): PreparedBeatmap {
        return this.loadPreparedBeatmap(this.loader.loadBeatmapText(text, options), options);
    }

    public loadBeatmap(beatmap: Readonly<IBeatmap> | PreparedBeatmap, options: LoadBeatmapOptions = {}): PreparedBeatmap {
        return this.loadPreparedBeatmap(this.loader.loadBeatmap(beatmap, options), options);
    }

    public loadPreparedBeatmap(prepared: PreparedBeatmap, options: PreparedBeatmapOptions = {}): PreparedBeatmap {
        assertPreparedBeatmap(prepared);
        const renderer = this.createRenderer(this.surface.ctx, prepared);
        try {
            renderer.resize(this.surface.width, this.surface.height);
        } catch (error) {
            renderer.dispose();
            throw error;
        }
        this.renderer?.dispose();
        this.renderer = renderer;
        const previewOffsetMs = (options.useBeatmapPreviewTime ?? this.useBeatmapPreviewTime)
            ? prepared.beatmap.general.previewTime : 0;
        this.timing = new PlaybackTiming(prepared.clockRate, previewOffsetMs);
        return prepared;
    }

    public render(playbackTimeMs: number): void {
        const renderer = this.renderer;
        if (!renderer || !Number.isFinite(playbackTimeMs)) return;
        this.surface.draw(this.projection, () => renderer.render(this.timing.offsetPlayback(playbackTimeMs)));
    }

    public resize(width: number, height: number, devicePixelRatio = globalThis.devicePixelRatio ?? 1): void {
        if (this.surface.resize(width, height, devicePixelRatio)) this.renderer?.resize(width, height);
    }

    public clear(): void { this.surface.clear(); }

    public dispose(): void {
        this.renderer?.dispose();
        this.renderer = undefined;
        this.surface.clear();
    }
}
