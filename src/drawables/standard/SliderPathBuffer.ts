import type {Vector2} from "osu-classes";

type PathBufferCanvas = HTMLCanvasElement | OffscreenCanvas;
export type PathBufferContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface PathDrawRequest {
    width: number;
    height: number;
    pixelWidth: number;
    pixelHeight: number;
    appearance: PathStyle;
    points: readonly Vector2[];
    /** Stable identity or revision for geometry that is known without scanning points. */
    pathInvalidationId?: object | number;
}

export interface PathStyle {
    x: number;
    y: number;
    pathRadius: number;
    innerPathRadius: number;
    borderStyle: string;
    bodyStyle: string;
}

interface BufferedPathState extends Omit<PathDrawRequest, "points"> {
    coordinates?: number[];
}

interface BufferedPath {
    canvas: PathBufferCanvas;
    context: PathBufferContext;
    state?: BufferedPathState;
}

// Limit aggregate backing storage, including maps containing many large sliders.
const MAX_CACHED_PIXELS = 16 * 1024 * 1024;
const MAX_CACHED_ENTRIES = 256;

export default class SliderPathBuffer {
    private readonly entries = new Map<object, BufferedPath>();
    private cachedPixels = 0;
    private scratch?: BufferedPath;

    /** Composites synchronously, then releases an oversized temporary buffer. */
    public draw(ctx: CanvasRenderingContext2D, owner: object, request: PathDrawRequest,
                paint: (ctx: PathBufferContext) => void, composite: (canvas: PathBufferCanvas) => void): void {
        const oversized = request.pixelWidth * request.pixelHeight > MAX_CACHED_PIXELS;
        if (oversized) {
            this.evict(owner);
            this.scratch ??= this.createEntry(ctx) ?? undefined;
            if (!this.scratch) return;
            try {
                composite(this.render(this.scratch, request, paint));
            } finally {
                this.releaseEntry(this.scratch);
            }
            return;
        }
        const canvas = this.get(ctx, owner, request, paint);
        if (canvas) composite(canvas);
    }

    private get(ctx: CanvasRenderingContext2D, owner: object, request: PathDrawRequest, paint: (ctx: PathBufferContext) => void): PathBufferCanvas | null {
        const pixels = request.pixelWidth * request.pixelHeight;

        let entry = this.entries.get(owner);
        if (entry) {
            this.entries.delete(owner);
            this.cachedPixels -= entry.canvas.width * entry.canvas.height;
        }

        while (this.cachedPixels + pixels > MAX_CACHED_PIXELS || this.entries.size >= MAX_CACHED_ENTRIES) {
            this.evict(this.entries.keys().next().value!);
        }

        entry ??= this.createEntry(ctx) ?? undefined;
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

    public release(): void {
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

    private createEntry(ctx: CanvasRenderingContext2D): BufferedPath | null {
        const canvas = typeof OffscreenCanvas !== "undefined"
            ? new OffscreenCanvas(0, 0)
            : ctx.canvas.ownerDocument?.createElement("canvas");
        if (!canvas) return null;

        canvas.width = 0;
        canvas.height = 0;
        const context = canvas.getContext("2d") as PathBufferContext | null;
        return context ? {canvas, context} : null;
    }

    private render(entry: BufferedPath, request: PathDrawRequest, paint: (ctx: PathBufferContext) => void): PathBufferCanvas {
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

        const coordinates = request.pathInvalidationId === undefined
            ? request.points.flatMap(point => [point.x, point.y]) : undefined;
        entry.state = {
            width: request.width,
            height: request.height,
            pixelWidth: request.pixelWidth,
            pixelHeight: request.pixelHeight,
            appearance: {...request.appearance},
            pathInvalidationId: request.pathInvalidationId,
            coordinates,
        };
        return entry.canvas;
    }

    private matches(state: BufferedPathState | undefined, request: PathDrawRequest): boolean {
        if (!state || state.width !== request.width || state.height !== request.height
            || state.pixelWidth !== request.pixelWidth || state.pixelHeight !== request.pixelHeight
            || state.pathInvalidationId !== request.pathInvalidationId) {
            return false;
        }

        for (const key of Object.keys(request.appearance) as (keyof PathStyle)[]) {
            if (state.appearance[key] !== request.appearance[key]) return false;
        }
        if (request.pathInvalidationId !== undefined) return true;
        if (state.coordinates?.length !== request.points.length * 2) return false;
        for (let i = 0; i < request.points.length; i++) {
            if (state.coordinates[i * 2] !== request.points[i].x || state.coordinates[i * 2 + 1] !== request.points[i].y) {
                return false;
            }
        }
        return true;
    }

    private releaseEntry(entry: BufferedPath): void {
        // Clearing references alone leaves backing storage alive until browser GC.
        entry.canvas.width = 0;
        entry.canvas.height = 0;
        entry.state = undefined;
    }
}
