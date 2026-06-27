import {HitObject, Ruleset, RulesetBeatmap} from "osu-classes";
import {BeatmapDecoder} from "osu-parsers";
import DrawableHitObject from "../drawables/DrawableHitObject";
import Renderer from "../renderers/Renderer";

export interface PlayfieldOffset {
    x: number;
    y: number;
}

export interface BeatmapPreviewOptions {
    width?: number;
    height?: number;
    devicePixelRatio?: number;
    playfieldOffset?: PlayfieldOffset;
    useBeatmapPreviewTime?: boolean;
}

export interface LoadBeatmapOptions {
    mods?: number;
    useBeatmapPreviewTime?: boolean;
}

const DEFAULT_WIDTH = 640;
const DEFAULT_HEIGHT = 480;
const DEFAULT_PLAYFIELD_OFFSET: PlayfieldOffset = {x: 64, y: 48};

export default abstract class BeatmapPreviewer<
    TBeatmap extends RulesetBeatmap,
    TRenderer extends Renderer<TBeatmap, DrawableHitObject<HitObject>>
> {
    protected readonly canvas: HTMLCanvasElement;
    protected readonly ctx: CanvasRenderingContext2D;

    private readonly decoder = new BeatmapDecoder();
    private readonly ruleset: Ruleset;
    private readonly createRenderer: (ctx: CanvasRenderingContext2D, beatmap: TBeatmap) => TRenderer;
    private readonly playfieldOffset: PlayfieldOffset;
    private readonly useBeatmapPreviewTime: boolean;

    private renderer?: TRenderer;
    private previewTime = 0;
    private width = DEFAULT_WIDTH;
    private height = DEFAULT_HEIGHT;
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
        this.ruleset = ruleset;
        this.createRenderer = createRenderer;
        this.playfieldOffset = options.playfieldOffset ?? DEFAULT_PLAYFIELD_OFFSET;
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
        const rawBeatmap = this.decoder.decodeFromString(osuText);
        return this.loadBeatmap(rawBeatmap as TBeatmap, options);
    }

    public loadBeatmap(beatmap: TBeatmap, options: LoadBeatmapOptions = {}): Readonly<TBeatmap> {
        const mods = this.ruleset.createModCombination(options.mods ?? 0);
        const appliedBeatmap = this.ruleset.applyToBeatmapWithMods(beatmap, mods) as TBeatmap;

        this.renderer = this.createRenderer(this.ctx, appliedBeatmap);
        this.previewTime = (options.useBeatmapPreviewTime ?? this.useBeatmapPreviewTime)
            ? appliedBeatmap.general.previewTime
            : 0;

        return appliedBeatmap;
    }

    public render(timeMs: number): void {
        if (!this.renderer) {
            return;
        }

        this.clear();

        this.ctx.save();
        this.ctx.translate(this.playfieldOffset.x, this.playfieldOffset.y);
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
    }

    public clear(): void {
        this.ctx.clearRect(0, 0, this.width, this.height);
    }

    public dispose(): void {
        this.renderer = undefined;
        this.clear();
    }
}
