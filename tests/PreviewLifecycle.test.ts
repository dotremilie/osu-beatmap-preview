import {readFileSync} from "node:fs";
import {afterEach, describe, expect, expectTypeOf, it, vi} from "vitest";
import {StandardBeatmap} from "osu-standard-stable";
import {BeatmapLoader, PreparedBeatmap, StandardBeatmapPreviewer, StandardBeatmapRenderer, StandardTimelinePreviewer, StandardTimelineRenderer} from "../src";
import CanvasSurface from "../src/internal/CanvasSurface";
import DefaultAppearance from "../src/internal/appearance/DefaultAppearance";
import {DrawableTimelineHitObject} from "../src/drawables/standard/DrawableTimelineHitObject";
import {Color4} from "osu-classes";

const text = readFileSync(new URL("./fixtures/timeline.osu", import.meta.url), "utf8");

function createCanvas() {
    const buffers: {width: number; height: number}[] = [];
    let depth = 0;
    const context = () => ({
        save: vi.fn(() => depth++), restore: vi.fn(() => depth--),
        setTransform: vi.fn(), getTransform: () => ({a: 1, b: 0, c: 0, d: 1, e: 0, f: 0}),
        clearRect: vi.fn(), translate: vi.fn(), scale: vi.fn(), rotate: vi.fn(),
        beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), arc: vi.fn(), rect: vi.fn(), clip: vi.fn(),
        stroke: vi.fn(), fill: vi.fn(), fillText: vi.fn(), drawImage: vi.fn(),
        measureText: () => ({actualBoundingBoxLeft: 3, actualBoundingBoxRight: 3, actualBoundingBoxAscent: 6, actualBoundingBoxDescent: 0}),
        createLinearGradient: () => ({addColorStop: vi.fn()}), globalAlpha: 1,
    });
    const ctx = context();
    const canvas = {
        width: 640, height: 480, style: {width: "", height: ""}, getContext: () => ctx,
        ownerDocument: {createElement: () => {
            const buffer = {width: 0, height: 0, getContext: context};
            buffers.push(buffer);
            return buffer;
        }},
    };
    Object.assign(ctx, {canvas});
    return {canvas: canvas as unknown as HTMLCanvasElement, ctx: ctx as unknown as CanvasRenderingContext2D, buffers, depth: () => depth};
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("prepared map and view boundaries", () => {
    it("returns an opaque frozen handle with a concrete standard model", () => {
        const prepared = new BeatmapLoader().loadBeatmapText(text);
        expectTypeOf(prepared).toEqualTypeOf<PreparedBeatmap>();
        expectTypeOf(prepared.beatmap).toEqualTypeOf<Readonly<StandardBeatmap>>();
        expect(Object.isFrozen(prepared)).toBe(true);
        expect(Object.isFrozen(prepared.beatmap)).toBe(false);
        expect(prepared.clockRate).toBe(prepared.beatmap.difficulty.clockRate);
        // @ts-expect-error Consumers cannot manufacture the private brand.
        const forged: PreparedBeatmap = {beatmap: prepared.beatmap, clockRate: prepared.clockRate};
        expect(() => new StandardBeatmapRenderer(createCanvas().ctx, forged)).toThrow(TypeError);
    });

    it.each([StandardBeatmapPreviewer, StandardTimelinePreviewer])("retains the attached map when rejecting a forged handle", Previewer => {
        const preview = new Previewer(createCanvas().canvas);
        const prepared = preview.loadBeatmapText(text);
        for (const value of [null, {}, {...prepared}, prepared.beatmap]) {
            expect(() => preview.loadPreparedBeatmap(value as PreparedBeatmap)).toThrow(TypeError);
            expect(preview.beatmap).toBe(prepared.beatmap);
        }
        preview.dispose();
        preview.dispose();
        expect(preview.beatmap).toBeNull();
    });

    it("keeps two renderer caches independent even on the same context", () => {
        vi.stubGlobal("OffscreenCanvas", undefined);
        const {ctx, buffers} = createCanvas();
        const prepared = new BeatmapLoader().loadBeatmapText(text);
        const first = new StandardTimelineRenderer(ctx, prepared);
        const second = new StandardTimelineRenderer(ctx, prepared);
        first.render(4000);
        const firstBuffers = buffers.slice();
        expect(firstBuffers.length).toBeGreaterThan(0);
        second.render(4000);
        const secondBuffers = buffers.slice(firstBuffers.length);
        expect(secondBuffers.length).toBeGreaterThan(0);
        first.dispose();
        first.dispose();
        expect(firstBuffers.every(buffer => buffer.width === 0 && buffer.height === 0)).toBe(true);
        expect(secondBuffers.every(buffer => buffer.width > 0 && buffer.height > 0)).toBe(true);
        const allocations = buffers.length;
        second.render(4000);
        expect(buffers).toHaveLength(allocations);
        second.dispose();
        first.render(4000);
        second.render(4000);
        expect(buffers).toHaveLength(allocations);
        expect(buffers.every(buffer => buffer.width === 0 && buffer.height === 0)).toBe(true);
    });

    it("restores frame state when a renderer fails", () => {
        const {canvas, depth} = createCanvas();
        const preview = new StandardBeatmapPreviewer(canvas);
        preview.loadBeatmapText(text);
        vi.spyOn(StandardBeatmapRenderer.prototype, "render").mockImplementation(() => { throw new Error("painting failed"); });
        expect(() => preview.render(1000)).toThrow("painting failed");
        expect(depth()).toBe(0);
    });

    it("restores timeline clipping and nested primitive state on errors", () => {
        const {ctx, depth} = createCanvas();
        const renderer = new StandardTimelineRenderer(ctx, new BeatmapLoader().loadBeatmapText(text));
        vi.spyOn(DrawableTimelineHitObject.prototype, "draw").mockImplementation(() => { throw new Error("entry failed"); });
        expect(() => renderer.render(4000)).toThrow("entry failed");
        expect(depth()).toBe(0);
        vi.spyOn(ctx, "stroke").mockImplementation(() => { throw new Error("stroke failed"); });
        expect(() => new DefaultAppearance().tick(ctx, {x: 0, y: 0}, 12, 3, new Color4(255, 0, 0), 1)).toThrow("stroke failed");
        expect(depth()).toBe(0);
    });
});

describe("canvas resizing", () => {
    it.each([0, -1, NaN, Infinity])("rejects invalid sizing %s atomically", invalid => {
        const {canvas} = createCanvas();
        const surface = new CanvasSurface(canvas);
        surface.resize(640, 480, 1);
        for (const values of [[invalid, 480, 1], [640, invalid, 1], [640, 480, invalid]]) {
            expect(() => surface.resize(...values as [number, number, number])).toThrow(RangeError);
            expect([surface.width, surface.height, canvas.width, canvas.height]).toEqual([640, 480, 640, 480]);
        }
    });

    it("skips identical resizing and invalidates resources for a DPR change", () => {
        const {canvas} = createCanvas();
        const preview = new StandardTimelinePreviewer(canvas);
        preview.loadBeatmapText(text);
        const resize = vi.spyOn(StandardTimelineRenderer.prototype, "resize");
        preview.resize(640, 40, 1);
        expect(resize).not.toHaveBeenCalled();
        preview.resize(640, 40, 2);
        expect(resize).toHaveBeenCalledOnce();
        expect(canvas.width).toBe(1280);
    });
});
