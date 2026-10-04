export function validateCanvasSize(width: number, height: number, devicePixelRatio = 1): void {
    if (![width, height, devicePixelRatio].every(value => Number.isFinite(value) && value > 0)) {
        throw new RangeError("Canvas dimensions and device pixel ratio must be positive finite numbers");
    }
}

export type CanvasProjection = (ctx: CanvasRenderingContext2D, width: number, height: number) => void;

/** Owns a canvas drawing buffer, logical sizing and frame state isolation. */
export default class CanvasSurface {
    public readonly ctx: CanvasRenderingContext2D;
    private logicalWidth = 0;
    private logicalHeight = 0;
    public get width(): number { return this.logicalWidth; }
    public get height(): number { return this.logicalHeight; }
    private devicePixelRatio = 0;

    constructor(private readonly canvas: HTMLCanvasElement) {
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas 2D rendering is not supported");
        this.ctx = ctx;
    }

    public resize(width: number, height: number, devicePixelRatio = globalThis.devicePixelRatio ?? 1): boolean {
        validateCanvasSize(width, height, devicePixelRatio);
        if (width === this.width && height === this.height && devicePixelRatio === this.devicePixelRatio) return false;
        this.logicalWidth = width;
        this.logicalHeight = height;
        this.devicePixelRatio = devicePixelRatio;
        this.canvas.width = Math.max(1, Math.round(width * devicePixelRatio));
        this.canvas.height = Math.max(1, Math.round(height * devicePixelRatio));
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
        this.ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
        return true;
    }

    public clear(): void { this.ctx.clearRect(0, 0, this.width, this.height); }

    public draw(projection: CanvasProjection, paint: () => void): void {
        this.clear();
        this.ctx.save();
        try {
            projection(this.ctx, this.width, this.height);
            paint();
        } finally {
            this.ctx.restore();
        }
    }
}
