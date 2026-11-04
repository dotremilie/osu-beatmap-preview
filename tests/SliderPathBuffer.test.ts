import {Color4, SliderPath, Vector2} from "osu-classes";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {DrawableSliderPath} from "../src/drawables/standard/DrawableSliderPath";
import SliderPathBuffer from "../src/drawables/standard/SliderPathBuffer";
import type {PathBufferContext, PathDrawRequest} from "../src/drawables/standard/SliderPathBuffer";

function createCanvas(width = 640, height = 480) {
    function createContext() {
        return {
            setTransform: vi.fn(),
            getTransform: vi.fn(() => ({a: 1, b: 0, c: 0, d: 1, e: 0, f: 0})),
            clearRect: vi.fn(),
            save: vi.fn(),
            restore: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            stroke: vi.fn(),
            drawImage: vi.fn(),
            globalCompositeOperation: "source-over",
            strokeStyle: "",
        };
    }

    const buffers: {width: number; height: number; getContext: () => ReturnType<typeof createContext>}[] = [];
    const memory = {peakPixels: 0};
    const trackPixels = () => {
        memory.peakPixels = Math.max(memory.peakPixels,
            buffers.reduce((pixels, buffer) => pixels + buffer.width * buffer.height, 0));
    };
    const context = createContext();
    const canvas = {
        width, height,
        ownerDocument: {
            createElement: () => {
                const bufferContext = createContext();
                let bufferWidth = 0;
                let bufferHeight = 0;
                const buffer = {
                    get width() { return bufferWidth; },
                    set width(value: number) { bufferWidth = value; trackPixels(); },
                    get height() { return bufferHeight; },
                    set height(value: number) { bufferHeight = value; trackPixels(); },
                    getContext: () => bufferContext,
                };
                buffers.push(buffer);
                return buffer;
            },
        },
    };
    Object.assign(context, {canvas});
    return {canvas, context, ctx: context as unknown as CanvasRenderingContext2D, buffers, memory};
}

function createPath() {
    const path = new DrawableSliderPath(new SliderPath(), new Color4(40, 60, 80), new Color4(160, 200, 240), undefined, pathBuffer);
    const points = [new Vector2(0, 0), new Vector2(50, 10), new Vector2(100, 20)];
    return {path, points, position: new Vector2(100, 100)};
}

function request(pixelWidth = 2048, pixelHeight = 2048) {
    return {
        width: pixelWidth,
        height: pixelHeight,
        pixelWidth,
        pixelHeight,
        appearance: {x: 0, y: 0, pathRadius: 16, innerPathRadius: 12, borderStyle: "border", bodyStyle: "body"},
        points: [new Vector2(0, 0), new Vector2(100, 0)],
    };
}

let pathBuffer: SliderPathBuffer;
function drawBufferedPath(ctx: CanvasRenderingContext2D, owner: object, request: PathDrawRequest,
                    paint: (ctx: PathBufferContext) => void) {
    let result: HTMLCanvasElement | OffscreenCanvas | null = null;
    pathBuffer.draw(ctx, owner, request, paint, canvas => { result = canvas; });
    return result;
}
beforeEach(() => { pathBuffer = new SliderPathBuffer(); vi.stubGlobal("OffscreenCanvas", undefined); });
afterEach(() => vi.unstubAllGlobals());

describe("slider path buffering", () => {
    it("composites unchanged bodies repeatedly without retracing or repainting them", () => {
        const {ctx, context, buffers} = createCanvas();
        const {path, points, position} = createPath();
        for (let frame = 0; frame < 4; frame++) path.draw(ctx, position, 20, 1, points);

        expect(buffers).toHaveLength(1);
        expect(buffers[0].getContext().clearRect).toHaveBeenCalledTimes(1);
        expect(buffers[0].getContext().stroke).toHaveBeenCalledTimes(3);
        expect(buffers[0].getContext().lineTo).toHaveBeenCalledTimes(points.length * 3);
        expect(context.drawImage).toHaveBeenCalledTimes(4);
    });

    it("does not rescan read-only path points after the first draw", () => {
        const {ctx} = createCanvas();
        const model = new SliderPath();
        const points = [new Vector2(0, 0), new Vector2(50, 10), new Vector2(100, 20)];
        Object.defineProperty(model, "path", {value: points});
        let reads = 0;
        for (const point of points) {
            const {x, y} = point;
            Object.defineProperty(point, "x", {get: () => { reads++; return x; }});
            Object.defineProperty(point, "y", {get: () => { reads++; return y; }});
        }
        const path = new DrawableSliderPath(model, new Color4(40, 60, 80), new Color4(160, 200, 240), undefined, pathBuffer);
        path.draw(ctx, new Vector2(100, 100), 20, 1);
        const firstDrawReads = reads;
        expect(firstDrawReads).toBeGreaterThan(0);
        path.draw(ctx, new Vector2(100, 100), 20, 1);
        expect(reads).toBe(firstDrawReads);
    });

    it("reuses an unchanged raster after integer translation without reusing its destination", () => {
        const {ctx, context, buffers} = createCanvas();
        const {path, points, position} = createPath();
        path.draw(ctx, position, 20, 1, points);
        const firstDestination = context.drawImage.mock.calls[0].slice(1);
        position.x += 20;
        position.y += 30;
        path.draw(ctx, position, 20, 1, points);

        expect(buffers[0].getContext().stroke).toHaveBeenCalledTimes(3);
        expect(context.drawImage).toHaveBeenLastCalledWith(
            buffers[0], firstDestination[0] + 20, firstDestination[1] + 30,
            firstDestination[2], firstDestination[3],
        );
    });

    it("detects projected point mutations even when the array and its bounds are unchanged", () => {
        const {ctx, buffers} = createCanvas();
        const {path, points, position} = createPath();
        path.draw(ctx, position, 20, 1, points);
        const dimensions = [buffers[0].width, buffers[0].height];
        points[1].y = 15;
        path.draw(ctx, position, 20, 1, points);

        expect([buffers[0].width, buffers[0].height]).toEqual(dimensions);
        expect(buffers[0].getContext().stroke).toHaveBeenCalledTimes(6);
        expect(buffers[0].getContext().clearRect).toHaveBeenCalledTimes(2);
    });

    it("uses a projected path invalidation id when its vertices change", () => {
        const {ctx, buffers} = createCanvas();
        const {path, points, position} = createPath();
        const bounds = {minX: 0, minY: 0, maxX: 100, maxY: 20};
        path.draw(ctx, position, 20, 1, points, {vertexBounds: bounds, pathInvalidationId: 1});
        path.draw(ctx, position, 20, 1, points, {vertexBounds: bounds, pathInvalidationId: 1});
        expect(buffers[0].getContext().stroke).toHaveBeenCalledTimes(3);
        points[1].y = 15;
        path.draw(ctx, position, 20, 1, points, {vertexBounds: bounds, pathInvalidationId: 2});
        expect(buffers[0].getContext().stroke).toHaveBeenCalledTimes(6);
    });

    it("invalidates when size, opacity, colors or body alpha change and on reverse seeks", () => {
        const {ctx, buffers} = createCanvas();
        const {path, points, position} = createPath();
        path.draw(ctx, position, 20, 1, points);
        path.draw(ctx, position, 21, 1, points);
        path.draw(ctx, position, 21, 0.5, points);
        path.accentColor = new Color4(10, 20, 30);
        path.draw(ctx, position, 21, 0.5, points);
        path.borderColor = new Color4(100, 120, 130);
        path.draw(ctx, position, 21, 0.5, points);
        path.bodyAlpha = 0.4;
        path.draw(ctx, position, 21, 0.5, points);
        path.draw(ctx, position, 21, 1, points);

        expect(buffers).toHaveLength(1);
        expect(buffers[0].getContext().clearRect).toHaveBeenCalledTimes(7);
        expect(buffers[0].getContext().stroke).toHaveBeenCalledTimes(21);
    });

    it("keeps the same three compositing passes and opacity math when repainting a fade", () => {
        const {ctx, buffers} = createCanvas();
        const {path, points, position} = createPath();
        path.draw(ctx, position, 20, 1, points);
        const bufferContext = buffers[0].getContext();
        const passes: {operation: string; style: string}[] = [];
        bufferContext.stroke.mockImplementation(() => {
            passes.push({operation: bufferContext.globalCompositeOperation, style: bufferContext.strokeStyle});
        });
        path.draw(ctx, position, 20, 0.5, points);

        expect(passes).toEqual([
            {operation: "source-over", style: `rgba(160,200,240,${0.5 * path.borderColor.alpha})`},
            {operation: "destination-out", style: "rgba(0,0,0,1)"},
            {operation: "source-over", style: `rgba(40,60,80,${0.5 * path.bodyAlpha * path.accentColor.alpha})`},
        ]);
    });

    it("repaints at the current pixel scale and after visible clipping changes", () => {
        const {ctx, context, canvas, buffers} = createCanvas();
        const {path, points, position} = createPath();
        path.draw(ctx, position, 20, 1, points);
        const originalSize = [buffers[0].width, buffers[0].height];
        canvas.width = 2560;
        canvas.height = 1920;
        context.getTransform.mockReturnValue({a: 4, b: 0, c: 0, d: 4, e: 0, f: 0});
        path.draw(ctx, position, 20, 1, points);
        expect([buffers[0].width, buffers[0].height]).toEqual(originalSize.map(size => size * 4));

        canvas.width = 600;
        path.draw(ctx, position, 20, 1, points);
        expect(buffers[0].width).toBeLessThan(originalSize[0] * 4);
        expect(buffers[0].getContext().clearRect).toHaveBeenCalledTimes(3);
    });

    it("does not allocate or paint fully transparent or offscreen bodies", () => {
        const {ctx, context, buffers} = createCanvas();
        const {path, points, position} = createPath();
        path.draw(ctx, position, 20, 0, points);
        path.draw(ctx, new Vector2(-10_000, -10_000), 20, 1, points);
        expect(buffers).toHaveLength(0);
        expect(context.drawImage).not.toHaveBeenCalled();
    });
});

describe("slider raster memory budget", () => {
    it("bounds retained pixels while rendering many distinct fullscreen slider bodies", () => {
        const {ctx, buffers} = createCanvas(1024, 1024);
        const points = [new Vector2(0, 0), new Vector2(1100, 1100)];
        const position = new Vector2(0, 0);
        const paths = Array.from({length: 45}, () => createPath().path);

        for (const path of paths) {
            path.draw(ctx, position, 64, 1, points);
            expect(buffers.reduce((pixels, buffer) => pixels + buffer.width * buffer.height, 0))
                .toBeLessThanOrEqual(16 * 1024 * 1024);
        }

        expect(buffers).toHaveLength(paths.length);
        expect(buffers.filter(buffer => buffer.width > 0)).toHaveLength(16);
        expect(buffers[0].width).toBe(0);
        paths[0].draw(ctx, position, 64, 1, points);
        expect(buffers[buffers.length - 1].getContext().stroke).toHaveBeenCalledTimes(3);
        expect(buffers.reduce((pixels, buffer) => pixels + buffer.width * buffer.height, 0))
            .toBe(16 * 1024 * 1024);
    });

    it("bounds aggregate pixels and evicts the least recently used drawable", () => {
        const {ctx, buffers} = createCanvas();
        const owners = Array.from({length: 6}, () => ({}));
        const paint = vi.fn();
        for (let i = 0; i < 4; i++) drawBufferedPath(ctx, owners[i], request(), paint);
        expect(paint).toHaveBeenCalledTimes(4);
        drawBufferedPath(ctx, owners[0], request(), paint);
        expect(paint).toHaveBeenCalledTimes(4);
        drawBufferedPath(ctx, owners[4], request(), paint);

        expect(buffers[0].width).toBe(2048);
        expect(buffers[1].width).toBe(0);
        expect(buffers[1].height).toBe(0);
        expect(buffers.reduce((pixels, buffer) => pixels + buffer.width * buffer.height, 0)).toBe(16 * 1024 * 1024);

        drawBufferedPath(ctx, owners[1], request(), paint);
        expect(paint).toHaveBeenCalledTimes(6);
        expect(buffers[2].width).toBe(0);
        expect(buffers.reduce((pixels, buffer) => pixels + buffer.width * buffer.height, 0)).toBe(16 * 1024 * 1024);
    });

    it("limits the number of tiny surfaces as well as their pixels", () => {
        const {ctx, buffers} = createCanvas();
        for (let i = 0; i < 300; i++) drawBufferedPath(ctx, {}, request(1, 1), vi.fn());
        expect(buffers.filter(buffer => buffer.width > 0)).toHaveLength(256);
        expect(buffers[0].width).toBe(0);
    });

    it("keeps temporary allocations within the budget when a cached raster changes shape", () => {
        const {ctx, memory} = createCanvas();
        const owner = {};
        const paint = vi.fn();
        drawBufferedPath(ctx, owner, request(2048, 4096), paint);
        drawBufferedPath(ctx, {}, request(2048, 4096), paint);
        drawBufferedPath(ctx, owner, request(4096, 2048), paint);

        expect(memory.peakPixels).toBe(16 * 1024 * 1024);
        expect(paint).toHaveBeenCalledTimes(3);
    });

    it("reuses one scratch canvas without retaining its oversized pixels", () => {
        const {ctx, buffers} = createCanvas();
        const paint = vi.fn();
        const large = request(4096, 4097);
        const first = drawBufferedPath(ctx, {}, large, paint);
        expect(buffers[0].width * buffers[0].height).toBe(0);
        drawBufferedPath(ctx, {}, large, paint);
        expect(paint).toHaveBeenCalledTimes(2);
        const second = drawBufferedPath(ctx, {}, request(5000, 4000), paint);
        expect(second).toBe(first);
        expect(buffers).toHaveLength(1);
        expect(paint).toHaveBeenCalledTimes(3);
        expect(buffers[0].width * buffers[0].height).toBe(0);

        drawBufferedPath(ctx, {}, request(), paint);
        expect(buffers).toHaveLength(2);
        pathBuffer.release();
        expect(buffers.every(buffer => buffer.width === 0 && buffer.height === 0)).toBe(true);
    });

    it("releases oversized scratch pixels after compositing, including on errors", () => {
        const {ctx, buffers} = createCanvas();
        const large = request(5000, 4000);
        const paint = vi.fn();
        const composite = vi.fn((buffer: HTMLCanvasElement | OffscreenCanvas) => {
            expect(buffer.width * buffer.height).toBe(20_000_000);
        });
        pathBuffer.draw(ctx, {}, large, paint, composite);
        expect(composite).toHaveBeenCalledOnce();
        expect(buffers[0].width * buffers[0].height).toBe(0);
        expect(() => pathBuffer.draw(ctx, {}, large, paint, () => { throw new Error("composite failed"); }))
            .toThrow("composite failed");
        expect(buffers.every(buffer => buffer.width === 0 && buffer.height === 0)).toBe(true);
    });

    it("keeps contexts independent and releases all pixels explicitly", () => {
        const first = createCanvas();
        const second = createCanvas();
        const secondPathBuffer = new SliderPathBuffer();
        const owner = {};
        const paint = vi.fn();
        drawBufferedPath(first.ctx, owner, request(), paint);
        secondPathBuffer.draw(second.ctx, owner, request(), paint, () => {});
        pathBuffer.release();

        expect(first.buffers[0].width).toBe(0);
        expect(second.buffers[0].width).toBe(2048);
        drawBufferedPath(first.ctx, owner, request(), paint);
        expect(first.buffers).toHaveLength(2);
        expect(paint).toHaveBeenCalledTimes(3);
        pathBuffer.release();
        secondPathBuffer.release();
    });
});

describe("failed raster ownership", () => {
    it.each([[100, 100], [5000, 4000]])("releases failed normal and oversized surfaces %s x %s", (width, height) => {
        const {ctx, buffers} = createCanvas();
        const owner = {};
        const paint = vi.fn(() => { throw new Error("paint failed"); });
        expect(() => drawBufferedPath(ctx, owner, request(width, height), paint)).toThrow("paint failed");
        expect(buffers.every(buffer => buffer.width === 0 && buffer.height === 0)).toBe(true);
        const goodPaint = vi.fn();
        drawBufferedPath(ctx, owner, request(width, height), goodPaint);
        expect(goodPaint).toHaveBeenCalledOnce();
        pathBuffer.release();
        expect(buffers.every(buffer => buffer.width === 0 && buffer.height === 0)).toBe(true);
    });
});
