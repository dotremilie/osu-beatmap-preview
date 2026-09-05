import type {Vector2} from "osu-classes";

type RasterCanvas = HTMLCanvasElement | OffscreenCanvas;
export type SliderPathRasterContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

interface RasterRequest {
    width: number;
    height: number;
    pixelWidth: number;
    pixelHeight: number;
    key: readonly (number | string)[];
    points: readonly Vector2[];
}

interface RasterState extends Omit<RasterRequest, "points"> {
    coordinates: number[];
}

interface RasterEntry {
    canvas: RasterCanvas;
    context: SliderPathRasterContext;
    state?: RasterState;
}

// Limit aggregate backing storage, including maps containing many large sliders.
const MAX_CACHED_PIXELS = 16 * 1024 * 1024;
const MAX_CACHED_ENTRIES = 256;
const caches = new WeakMap<CanvasRenderingContext2D, SliderPathRasterCache>();

class SliderPathRasterCache {
    private readonly entries = new Map<object, RasterEntry>();
    private cachedPixels = 0;
    private scratch?: RasterEntry;

    constructor(private readonly ctx: CanvasRenderingContext2D) {}

    get(owner: object, request: RasterRequest, paint: (ctx: SliderPathRasterContext) => void): RasterCanvas | null {
        const pixels = request.pixelWidth * request.pixelHeight;

        // A single visible raster may exceed the cache budget in fullscreen.
        // Keep only one such surface, shared by all sliders in this context.
        if (pixels > MAX_CACHED_PIXELS) {
            this.evict(owner);
            this.scratch ??= this.createEntry() ?? undefined;
            if (!this.scratch) return null;
            return this.render(this.scratch, request, paint);
        }

        let entry = this.entries.get(owner);
        if (entry) {
            this.entries.delete(owner);
            this.cachedPixels -= entry.canvas.width * entry.canvas.height;
        }

        while (this.cachedPixels + pixels > MAX_CACHED_PIXELS || this.entries.size >= MAX_CACHED_ENTRIES) {
            this.evict(this.entries.keys().next().value!);
        }

        entry ??= this.createEntry() ?? undefined;
        if (!entry) return null;

        try {
            const canvas = this.render(entry, request, paint);
            this.entries.set(owner, entry);
            this.cachedPixels += pixels;
            return canvas;
        } catch (error) {
            this.releaseEntry(entry);
            throw error;
        }
    }

    release(): void {
        for (const entry of this.entries.values()) this.releaseEntry(entry);
        this.entries.clear();
        this.cachedPixels = 0;
        if (this.scratch) this.releaseEntry(this.scratch);
        this.scratch = undefined;
    }

    private evict(owner: object): void {
        const entry = this.entries.get(owner);
        if (!entry) return;
        this.cachedPixels -= entry.canvas.width * entry.canvas.height;
        this.entries.delete(owner);
        this.releaseEntry(entry);
    }

    private createEntry(): RasterEntry | null {
        const canvas = typeof OffscreenCanvas !== "undefined"
            ? new OffscreenCanvas(0, 0)
            : this.ctx.canvas.ownerDocument?.createElement("canvas");
        if (!canvas) return null;

        canvas.width = 0;
        canvas.height = 0;
        const context = canvas.getContext("2d") as SliderPathRasterContext | null;
        return context ? {canvas, context} : null;
    }

    private render(entry: RasterEntry, request: RasterRequest, paint: (ctx: SliderPathRasterContext) => void): RasterCanvas {
        if (this.matches(entry.state, request)) return entry.canvas;

        // Invalidate before painting so a failed draw cannot reuse partial pixels.
        entry.state = undefined;
        // Avoid briefly allocating old-height × new-width when both axes change.
        if (entry.canvas.width !== request.pixelWidth && entry.canvas.height !== request.pixelHeight) {
            entry.canvas.width = 0;
        }
        if (entry.canvas.height !== request.pixelHeight) entry.canvas.height = request.pixelHeight;
        if (entry.canvas.width !== request.pixelWidth) entry.canvas.width = request.pixelWidth;

        const ctx = entry.context;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, request.pixelWidth, request.pixelHeight);
        ctx.setTransform(request.pixelWidth / request.width, 0, 0, request.pixelHeight / request.height, 0, 0);
        ctx.globalCompositeOperation = "source-over";
        paint(ctx);

        const coordinates: number[] = [];
        for (const point of request.points) coordinates.push(point.x, point.y);
        entry.state = {
            width: request.width,
            height: request.height,
            pixelWidth: request.pixelWidth,
            pixelHeight: request.pixelHeight,
            key: [...request.key],
            coordinates,
        };
        return entry.canvas;
    }

    private matches(state: RasterState | undefined, request: RasterRequest): boolean {
        if (!state || state.width !== request.width || state.height !== request.height
            || state.pixelWidth !== request.pixelWidth || state.pixelHeight !== request.pixelHeight
            || state.key.length !== request.key.length || state.coordinates.length !== request.points.length * 2) {
            return false;
        }

        for (let i = 0; i < request.key.length; i++) {
            if (state.key[i] !== request.key[i]) return false;
        }
        for (let i = 0; i < request.points.length; i++) {
            if (state.coordinates[i * 2] !== request.points[i].x || state.coordinates[i * 2 + 1] !== request.points[i].y) {
                return false;
            }
        }
        return true;
    }

    private releaseEntry(entry: RasterEntry): void {
        // Clearing references alone leaves backing storage alive until browser GC.
        entry.canvas.width = 0;
        entry.canvas.height = 0;
        entry.state = undefined;
    }
}

/** Reuses the most recent raster for this drawable within a per-context memory budget. */
export function getSliderPathRaster(
    ctx: CanvasRenderingContext2D,
    owner: object,
    request: RasterRequest,
    paint: (ctx: SliderPathRasterContext) => void,
): RasterCanvas | null {
    let cache = caches.get(ctx);
    if (!cache) {
        cache = new SliderPathRasterCache(ctx);
        caches.set(ctx, cache);
    }
    return cache.get(owner, request, paint);
}

/** Releases cached and scratch pixels when the renderer changes size, beatmap or lifetime. */
export function releaseSliderPathCache(ctx: CanvasRenderingContext2D): void {
    caches.get(ctx)?.release();
    caches.delete(ctx);
}
