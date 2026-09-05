import {Ruleset, RulesetBeatmap} from "osu-classes";
import BeatmapLoader, {BeatmapLoaderOptions} from "../loaders/BeatmapLoader";
import BeatmapRenderer from "../renderers/BeatmapRenderer";

export interface Offset {
    x: number;
    y: number;
}

export interface BeatmapPreviewOptions {
    width?: number;
    height?: number;
    devicePixelRatio?: number;
    offset?: Offset;
    useBeatmapPreviewTime?: boolean;
}

export interface PreparedBeatmapOptions {
    useBeatmapPreviewTime?: boolean;
}

export interface LoadBeatmapOptions extends BeatmapLoaderOptions, PreparedBeatmapOptions {}

const DEFAULT_WIDTH = 640;
const DEFAULT_HEIGHT = 480;
const DEFAULT_PLAYFIELD_OFFSET: Offset = {x: 64, y: 48};

export default abstract class BeatmapPreviewer<
    TBeatmap extends RulesetBeatmap,
    TRenderer extends BeatmapRenderer<TBeatmap, unknown>
> {
    protected readonly canvas: HTMLCanvasElement;
    protected readonly ctx: CanvasRenderingContext2D;

    private readonly loader: BeatmapLoader<Ruleset>;
    private readonly createRenderer: (ctx: CanvasRenderingContext2D, beatmap: TBeatmap) => TRenderer;
    private readonly offset: Offset;
    private readonly useBeatmapPreviewTime: boolean;

    private renderer?: TRenderer;
    private previewTime = 0;
    protected width = DEFAULT_WIDTH;
    protected height = DEFAULT_HEIGHT;
    private devicePixelRatio = 1;

    protected constructor(
        canvas: HTMLCanvasElement,
        ruleset: Ruleset,
        createRenderer: (ctx: CanvasRenderingContext2D, beatmap: TBeatmap) => TRenderer,
        options: BeatmapPreviewOptions = {},
    ) {
        const ctx = canvas.getContext("2d");

        if (!ctx) {
            throw new Error("Canvas 2D rendering is not supported");
        }

        this.canvas = canvas;
        this.ctx = ctx;
        this.loader = new BeatmapLoader(ruleset);
        this.createRenderer = createRenderer;
        this.offset = options.offset ?? DEFAULT_PLAYFIELD_OFFSET;
        this.useBeatmapPreviewTime = options.useBeatmapPreviewTime ?? false;

        this.resize(
            options.width ?? DEFAULT_WIDTH,
            options.height ?? DEFAULT_HEIGHT,
            options.devicePixelRatio,
        );
    }

    public get beatmap(): Readonly<TBeatmap> | null {
        return this.renderer?.getBeatmap ?? null;
    }

    public loadBeatmapText(osuText: string, options: LoadBeatmapOptions = {}): Readonly<TBeatmap> {
        return this.loadPreparedBeatmap(this.loader.loadBeatmapText(osuText, options) as TBeatmap, options);
    }

    public loadBeatmap(beatmap: Readonly<TBeatmap>, options: LoadBeatmapOptions = {}): Readonly<TBeatmap> {
        return this.loadPreparedBeatmap(this.loader.loadBeatmap(beatmap, options) as TBeatmap, options);
    }

    /** Attaches a prepared map without reapplying mods. Treat shared maps as read-only. */
    public loadPreparedBeatmap(beatmap: Readonly<TBeatmap>, options: PreparedBeatmapOptions = {}): Readonly<TBeatmap> {
        const renderer = this.createRenderer(this.ctx, beatmap as TBeatmap);
        this.renderer?.dispose();
        renderer.resize(this.width, this.height);
        this.renderer = renderer;
        this.previewTime = (options.useBeatmapPreviewTime ?? this.useBeatmapPreviewTime)
            ? beatmap.general.previewTime
            : 0;

        return beatmap;
    }

    public render(timeMs: number): void {
        if (!this.renderer) {
            return;
        }

        this.clear();

        this.ctx.save();
        this.applyTransform();
        this.renderer.render(timeMs + this.previewTime);
        this.ctx.restore();
    }

    public resize(width: number, height: number, devicePixelRatio = globalThis.devicePixelRatio ?? 1): void {
        this.width = width;
        this.height = height;
        this.devicePixelRatio = devicePixelRatio;

        this.canvas.width = Math.round(width * devicePixelRatio);
        this.canvas.height = Math.round(height * devicePixelRatio);
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
        this.ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
        this.renderer?.resize(width, height);
    }

    protected applyTransform(): void {
        this.ctx.translate(this.offset.x, this.offset.y);
    }

    public clear(): void {
        this.ctx.clearRect(0, 0, this.width, this.height);
    }

    public dispose(): void {
        this.renderer?.dispose();
        this.renderer = undefined;
        this.clear();
    }
}
