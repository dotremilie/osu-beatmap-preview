import Renderer from "../renderers/Renderer";

export interface Offset {
    x: number;
    y: number;
}

export interface PreviewerOptions {
    width?: number;
    height?: number;
    devicePixelRatio?: number;
    playfieldOffset?: Offset;
    useBeatmapPreviewTime?: boolean;
}

const DEFAULT_WIDTH = 640;
const DEFAULT_HEIGHT = 480;
const DEFAULT_PLAYFIELD_OFFSET: Offset = {x: 64, y: 48};

export default abstract class Previewer<TRenderer extends Renderer> {
    protected readonly canvas: HTMLCanvasElement;
    protected readonly ctx: CanvasRenderingContext2D;

    private readonly offset: Offset;

    private renderer?: TRenderer;
    private width = DEFAULT_WIDTH;
    private height = DEFAULT_HEIGHT;
    private devicePixelRatio = 1;

    protected constructor(
        canvas: HTMLCanvasElement,
        options: PreviewerOptions = {},
    ) {
        const ctx = canvas.getContext("2d");

        if (!ctx) {
            throw new Error("Canvas 2D rendering is not supported");
        }

        this.canvas = canvas;
        this.ctx = ctx;
        this.offset = options.playfieldOffset ?? DEFAULT_PLAYFIELD_OFFSET;

        this.resize(
            options.width ?? DEFAULT_WIDTH,
            options.height ?? DEFAULT_HEIGHT,
            options.devicePixelRatio,
        );
    }

    public render(time: number): void {
        if (!this.renderer) {
            return;
        }

        this.clear();

        this.ctx.save();
        this.ctx.translate(this.offset.x, this.offset.y);
        this.renderer.render(time);
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
