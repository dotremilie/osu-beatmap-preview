import {readFileSync} from "node:fs";
import {ModBitwise, Vector2} from "osu-classes";
import {Slider, Spinner} from "osu-standard-stable";
import {describe, expect, it, vi} from "vitest";
import {StandardBeatmapPreviewer, StandardTimelinePreviewer} from "../src";
import {DrawableCircle} from "../src/drawables/standard/DrawableCircle";
import {DrawableSliderBody} from "../src/drawables/standard/DrawableSliderBody";
import {DrawableSliderPath} from "../src/drawables/standard/DrawableSliderPath";

// Follow-point painting is exercised separately with a complete canvas mock.
vi.mock("../src/drawables/standard/DrawableFollowPoint", () => ({default: class {
    draw(): void {}
}}));

const BEATMAP_TEXT = readFileSync(new URL("./fixtures/timeline.osu", import.meta.url), "utf8");

function createContext() {
    return {
        setTransform: vi.fn(),
        getTransform: vi.fn(() => ({a: 1, b: 0, c: 0, d: 1, e: 0, f: 0})),
        clearRect: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        scale: vi.fn(),
        rotate: vi.fn(),
        closePath: vi.fn(),
        createLinearGradient: vi.fn(() => ({addColorStop: vi.fn()})),
        beginPath: vi.fn(),
        rect: vi.fn(),
        clip: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        drawImage: vi.fn(),
        measureText: vi.fn(() => ({
            actualBoundingBoxLeft: 3,
            actualBoundingBoxRight: 3,
            actualBoundingBoxAscent: 6,
            actualBoundingBoxDescent: 0,
        })),
        fillText: vi.fn<(text: string, x: number, y: number) => void>(),
    };
}

function createCanvas() {
    const context = createContext();
    const bufferContext = createContext();
    const canvas = {
        width: 0,
        height: 0,
        style: {width: "", height: ""},
        getContext: vi.fn(() => context),
        ownerDocument: {
            createElement: vi.fn(() => ({width: 0, height: 0, getContext: () => bufferContext})),
        },
    } as unknown as HTMLCanvasElement;
    Object.assign(context, {canvas});

    return {canvas, context, bufferContext};
}

function createTimeline(timeRange = 4000) {
    const {canvas, context} = createCanvas();
    const preview = new StandardTimelinePreviewer(canvas, {
        width: 800,
        height: 120,
        devicePixelRatio: 2,
        timeRange,
    });

    return {canvas, context, preview};
}

function objectLabels(context: ReturnType<typeof createCanvas>["context"]) {
    return context.fillText.mock.calls.filter(([text]) => /^\d+$/.test(text));
}

function rulerTicks(context: ReturnType<typeof createCanvas>["context"]) {
    return context.moveTo.mock.calls.slice(0, -2).map(([x, y]) => [x, Math.round(y)]);
}

function emptyBeatmapWithTiming(timingPoints: string) {
    return BEATMAP_TEXT.slice(0, BEATMAP_TEXT.indexOf("[HitObjects]"))
        .replace("0,500,4,1,0,100,1,0", timingPoints) + "[HitObjects]\n";
}

describe("StandardTimelinePreviewer", () => {
    it("bounds Aspire slider buffers by the visible canvas around 57 seconds, including fullscreen", () => {
        const {canvas, context} = createCanvas();
        const preview = new StandardBeatmapPreviewer(canvas);
        preview.loadBeatmapText(readFileSync(new URL("../demo/beatmaps/aspire.osu", import.meta.url), "utf8"));

        for (const [width, height, pixelRatio] of [[800, 600, 1], [2560, 1440, 2]]) {
            preview.resize(width, height, pixelRatio);
            const scale = Math.min(width / 640, height / 480);
            const pixelScale = scale * pixelRatio;
            context.getTransform.mockReturnValue({
                a: pixelScale, b: 0, c: 0, d: pixelScale,
                e: ((width - 640 * scale) / 2 + 64 * scale) * pixelRatio,
                f: ((height - 480 * scale) / 2 + 48 * scale) * pixelRatio,
            });
            context.drawImage.mockClear();
            context.drawImage.mockImplementation((buffer) => {
                expect(buffer.width).toBeLessThanOrEqual(canvas.width + pixelScale * 2);
                expect(buffer.height).toBeLessThanOrEqual(canvas.height + pixelScale * 2);
            });

            for (let time = 56_500; time <= 59_000; time += 100) preview.render(time);
            expect(context.drawImage).toHaveBeenCalled();
        }
    });

    it("rasterizes slider bodies at the drawing scale while preserving their logical bounds", () => {
        const {canvas, context, bufferContext} = createCanvas();
        const preview = new StandardBeatmapPreviewer(canvas);
        const beatmap = preview.loadBeatmapText(BEATMAP_TEXT).beatmap;
        const slider = beatmap.hitObjects.find(object => object instanceof Slider) as Slider;
        const color = beatmap.colors.comboColors[0];
        const path = new DrawableSliderPath(slider.path, color, color);
        const ctx = context as unknown as CanvasRenderingContext2D;
        path.draw(ctx, slider.stackedStartPosition, slider.radius, 1);
        const [buffer, x, y, width, height] = context.drawImage.mock.calls[0];

        for (const [scaleX, scaleY] of [[4.5, 4.5], [1.25, 2], [1, 1]]) {
            canvas.width = 640 * scaleX;
            canvas.height = 480 * scaleY;
            context.getTransform.mockReturnValue({a: scaleX, b: 0, c: 0, d: scaleY, e: 0, f: 0});
            path.draw(ctx, slider.stackedStartPosition, slider.radius, 1);

            expect(context.drawImage).toHaveBeenLastCalledWith(buffer, x, y, width, height);
            expect(buffer.width).toBe(Math.ceil(width * scaleX));
            expect(buffer.height).toBe(Math.ceil(height * scaleY));
            expect(bufferContext.setTransform).toHaveBeenLastCalledWith(buffer.width / width, 0, 0, buffer.height / height, 0, 0);
            expect(bufferContext.clearRect).toHaveBeenLastCalledWith(0, 0, buffer.width, buffer.height);
        }
    });

    it.each([
        [1, "#ffffff", 1, 9],
        [2, "#ed1121", 1, 9],
        [3, "#8866ee", 1, 8],
        [4, "#66ccff", 1, 8],
        [5, "#b3d944", 1, 6],
        [6, "#eeaa00", 1, 7],
        [7, "#b3d944", 1, 6],
        [8, "#ffcc22", 1, 7],
        [9, "#b3d944", 1, 6],
        [11, "#ff0000", 1, 6],
        [12, "#cc6600", 1, 6],
        [16, "#6644cc", 1, 6],
    ])("renders lazer tick colors with compact dimensions at snap divisor %s", (divisor, color, width, height) => {
        const {context, preview} = createTimeline(1000);
        const strokes: {color: string | CanvasGradient | CanvasPattern; width: number}[] = [];
        const canvasContext = context as unknown as CanvasRenderingContext2D;
        context.stroke.mockImplementation(() => {
            strokes.push({color: canvasContext.strokeStyle, width: canvasContext.lineWidth});
        });
        preview.beatSnapDivisor = divisor;
        preview.loadBeatmapText(emptyBeatmapWithTiming("250,500,4,1,0,100,1,0"));
        preview.render(750);

        expect(strokes[0]).toEqual({color: "#ffffff", width: 2});
        expect(context.moveTo.mock.calls[0]).toEqual([0, 110]);
        expect(strokes[1]).toEqual({color, width});
        expect(context.moveTo.mock.calls[1][1]).toBeCloseTo(120 - height);
        expect(context.lineTo.mock.calls[1][1]).toBe(120);
    });

    it("scales heads, slider bodies and markers when object radius changes", () => {
        const sliderDraw = vi.spyOn(DrawableSliderBody.prototype, "drawAt");

        try {
            const {canvas, context} = createCanvas();
            const preview = new StandardTimelinePreviewer(canvas, {
                width: 800, height: 120, timeRange: 30_000, objectRadius: 26,
            });
            preview.loadBeatmapText(BEATMAP_TEXT);

            for (const radius of [26, 6.5]) {
                preview.objectRadius = radius;
                vi.clearAllMocks();
                preview.render(8000);

                const y = radius + 1;
                expect(sliderDraw).toHaveBeenCalledWith(
                    context, expect.any(Vector2), radius, 1, expect.any(Array),
                    expect.objectContaining({pathInvalidationId: expect.any(Number)}),
                );
                expect(context.arc).toHaveBeenCalledWith(expect.any(Number), y, radius, 0, Math.PI * 2);
                expect(context.arc).toHaveBeenCalledWith(expect.any(Number), y, radius * 0.25, 0, Math.PI * 2);
                expect(context.arc).toHaveBeenCalledWith(expect.any(Number), y, radius * 0.45, 0, Math.PI * 2);
                expect(preview.timeAtPosition(400, 8000)).toBe(8000);
            }
        } finally {
            sliderDraw.mockRestore();
        }
    });

    it("reuses circle and slider drawing at full opacity without changing beatmap geometry", () => {
        const circleDraw = vi.spyOn(DrawableCircle.prototype, "drawAt");
        const sliderDraw = vi.spyOn(DrawableSliderBody.prototype, "drawAt");

        try {
            const {context, preview} = createTimeline(30_000);
            const beatmap = preview.loadBeatmapText(BEATMAP_TEXT, {mods: ModBitwise.Hidden}).beatmap;
            const geometry = () => beatmap.hitObjects.map(object => ({
                startTime: object.startTime,
                position: object.stackedStartPosition,
                radius: object.radius,
                path: object instanceof Slider ? object.path.path : [],
                nested: object.nestedHitObjects.map(nested => nested.startTime),
            }));
            const before = JSON.stringify(geometry());

            // Every circle and slider is in the past but remains visible in this window.
            preview.render(14_000);
            expect(circleDraw).toHaveBeenCalled();
            expect(sliderDraw).toHaveBeenCalledWith(
                context, expect.any(Vector2), 16, 1, expect.any(Array),
                expect.objectContaining({pathInvalidationId: expect.any(Number)}),
            );
            expect(circleDraw.mock.calls.every(([, , , opacity]) => opacity === 1)).toBe(true);

            preview.zoom(2);
            preview.resize(600, 40, 1);
            preview.render(8000);
            expect(JSON.stringify(geometry())).toBe(before);
        } finally {
            circleDraw.mockRestore();
            sliderDraw.mockRestore();
        }
    });

    it("renders the timing-offset beat grid and updates its configurable snap divisor", () => {
        const {context, preview} = createTimeline(1000);
        preview.loadBeatmapText(emptyBeatmapWithTiming("250,500,4,1,0,100,1,0"));
        preview.render(750);

        expect(preview.beatSnapDivisor).toBe(4);
        expect(rulerTicks(context)).toEqual([
            [0, 110], [100, 112], [200, 111], [300, 112], [400, 111],
            [500, 112], [600, 111], [700, 112], [800, 111],
        ]);

        preview.beatSnapDivisor = 2;
        vi.clearAllMocks();
        preview.render(750);

        expect(rulerTicks(context)).toEqual([
            [0, 110], [200, 111], [400, 111], [600, 111], [800, 111],
        ]);
        expect(preview.timeRange).toBe(1000);
        expect(() => { preview.beatSnapDivisor = 0; }).toThrow(RangeError);
        expect(preview.beatSnapDivisor).toBe(2);
    });

    it("takes the initial snap divisor from options and follows BPM changes without inherited SV ticks", () => {
        const {canvas, context} = createCanvas();
        const preview = new StandardTimelinePreviewer(canvas, {
            width: 800,
            height: 120,
            timeRange: 1000,
            beatSnapDivisor: 1,
        });
        preview.loadBeatmapText(emptyBeatmapWithTiming([
            "250,500,4,1,0,100,1,0",
            "875,-50,4,1,0,100,0,0",
            "1000,250,3,1,0,100,1,0",
        ].join("\n")));
        preview.render(1000);

        expect(preview.beatSnapDivisor).toBe(1);
        expect(rulerTicks(context)).toEqual([[200, 111], [400, 110], [600, 111], [800, 111]]);
    });

    it.each([
        [ModBitwise.None, 1],
        [ModBitwise.DoubleTime, 1.5],
        [ModBitwise.HalfTime, 0.75],
    ])("aligns ruler beats with playback time for mod bitmask %s", (mods, clockRate) => {
        const {context, preview} = createTimeline(1000 / clockRate);
        preview.beatSnapDivisor = 1;
        preview.loadBeatmapText(emptyBeatmapWithTiming("250,500,4,1,0,100,1,0"), {mods});
        preview.render(750 / clockRate);

        const ticks = rulerTicks(context);
        expect(ticks).toHaveLength(3);
        for (const [index, [x]] of ticks.entries()) {
            expect(x).toBeCloseTo(index * 400);
        }
        expect(ticks.map(([, y]) => y)).toEqual([110, 111, 111]);
    });

    it("applies preview time and speed mods to ruler beats together", () => {
        const {canvas, context} = createCanvas();
        const preview = new StandardTimelinePreviewer(canvas, {
            width: 800,
            height: 120,
            timeRange: 1000,
            beatSnapDivisor: 1,
            useBeatmapPreviewTime: true,
        });
        const beatmap = preview.loadBeatmapText(
            emptyBeatmapWithTiming("250,500,4,1,0,100,1,0"),
            {mods: ModBitwise.DoubleTime},
        ).beatmap;
        preview.render(750 / beatmap.difficulty.clockRate - beatmap.general.previewTime);

        const ticks = rulerTicks(context);
        expect(ticks).toHaveLength(3);
        expect(ticks[0][0]).toBeCloseTo(400 - 400 / 1.5);
        expect(ticks[1][0]).toBeCloseTo(400);
        expect(ticks[2][0]).toBeCloseTo(400 + 400 / 1.5);
        expect(ticks.map(([, y]) => y)).toEqual([110, 111, 111]);
    });

    it("renders centered objects and converts a clicked object back to playback time", () => {
        const {context, preview} = createTimeline();
        preview.loadBeatmapText(BEATMAP_TEXT);
        preview.render(1000);

        expect(objectLabels(context)).toEqual(expect.arrayContaining([
            ["1", 400, 20],
            ["2", 500, 20],
        ]));
        expect(context.moveTo).toHaveBeenCalledWith(400, 0);
        expect(context.lineTo).toHaveBeenCalledWith(400, 120);
        expect(context.translate).not.toHaveBeenCalled();

        const clickedTime = preview.timeAtPosition(500, 1000);
        expect(clickedTime).toBe(1500);
        vi.clearAllMocks();
        preview.render(clickedTime);

        expect(objectLabels(context)).toContainEqual(["2", 400, 20]);
    });

    it("zooms and resizes in logical pixels independently of the device pixel ratio", () => {
        const {canvas, context, preview} = createTimeline();
        expect(canvas.width).toBe(1600);
        expect(canvas.height).toBe(240);
        expect(canvas.style.width).toBe("800px");
        expect(context.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);

        preview.loadBeatmapText(BEATMAP_TEXT);
        preview.zoom(2);
        preview.render(1000);

        expect(preview.timeRange).toBe(2000);
        expect(objectLabels(context)).toContainEqual(["2", 600, 20]);

        preview.resize(400, 100, 1.5);
        vi.clearAllMocks();
        preview.render(1000);

        expect(canvas.width).toBe(600);
        expect(canvas.height).toBe(150);
        expect(canvas.style.width).toBe("400px");
        expect(context.clearRect).toHaveBeenCalledWith(0, 0, 400, 100);
        expect(context.rect).toHaveBeenCalledWith(0, 0, 400, 100);
        expect(objectLabels(context)).toContainEqual(["1", 200, 20]);
        expect(objectLabels(context)).toContainEqual(["2", 300, 20]);
        expect(preview.timeAtPosition(300, 1000)).toBe(1500);
    });

    it("uses the current size when loading or replacing a beatmap after resize", () => {
        const {context, preview} = createTimeline();
        preview.resize(600, 100, 1);
        preview.loadBeatmapText(BEATMAP_TEXT);
        preview.render(1000);
        expect(objectLabels(context)).toContainEqual(["1", 300, 20]);

        preview.resize(1000, 140, 1);
        preview.loadBeatmapText(BEATMAP_TEXT);
        vi.clearAllMocks();
        preview.render(1000);
        expect(objectLabels(context)).toContainEqual(["1", 500, 20]);
    });

    it("keeps a long slider visible when both endpoints are outside the window", () => {
        const {context, preview} = createTimeline(1000);
        const beatmap = preview.loadBeatmapText(BEATMAP_TEXT).beatmap;
        const slider = beatmap.hitObjects.find(object => object instanceof Slider);

        expect(slider).toBeInstanceOf(Slider);
        expect(slider?.startTime).toBe(3000);
        expect(slider?.endTime).toBe(13_000);
        preview.render(8000);

        expect(context.drawImage).toHaveBeenCalledOnce();
        const [buffer, left] = context.drawImage.mock.calls[0];
        expect(left).toBeLessThanOrEqual(0);
        expect(left + buffer.width).toBeGreaterThan(800);
        expect(buffer.width).toBeLessThan(900);
        expect(context.arc).toHaveBeenCalled();
        expect(objectLabels(context)).toEqual([]);
        expect(context.fillText.mock.calls.some(([text]) => text === "Spin")).toBe(false);

        vi.clearAllMocks();
        preview.render(12_950);
        expect(context.arc.mock.calls.some(([x, y, radius]) =>
            x === 440 && y === 17 && radius < 16,
        )).toBe(true);
    });

    it.each([
        [ModBitwise.None, 1],
        [ModBitwise.DoubleTime, 1.5],
    ])("shows visible slider repeats at their playback times with mod bitmask %s", (mods, clockRate) => {
        const {context, preview} = createTimeline(4000 / clockRate);
        preview.loadBeatmapText(BEATMAP_TEXT, {mods});
        preview.render(8000 / clockRate);

        const markers = () => context.arc.mock.calls
            .filter(([, , radius]) => radius === 16 * 0.25)
            .map(([x]) => Math.round(x));

        // Both endpoints are offscreen; only repeats, not slider ticks, are marked.
        expect(markers()).toEqual([0, 200, 400, 600, 800]);
        expect(context.arc).toHaveBeenCalledTimes(5);

        preview.zoom(2);
        vi.clearAllMocks();
        preview.render(8000 / clockRate);
        expect(markers()).toEqual([0, 400, 800]);
    });

    it("keeps a single end marker for sliders without repeats", () => {
        const {context, preview} = createTimeline(2000);
        preview.loadBeatmapText(BEATMAP_TEXT.replace("L|328:192,10,200", "L|328:192,1,200"));
        preview.render(3500);

        const markers = context.arc.mock.calls.filter(([, , radius]) => radius === 16 * 0.45);
        expect(markers).toHaveLength(1);
        expect(markers[0][0]).toBe(600);
    });

    it("renders a long spinner duration and label while its endpoints are offscreen", () => {
        const {context, preview} = createTimeline(1000);
        const beatmap = preview.loadBeatmapText(BEATMAP_TEXT).beatmap;
        expect(beatmap.hitObjects.some(object => object instanceof Spinner)).toBe(true);
        preview.render(25_000);

        expect(context.drawImage).toHaveBeenCalledOnce();
        const [buffer, left] = context.drawImage.mock.calls[0];
        expect(left).toBeLessThanOrEqual(0);
        expect(left + buffer.width).toBeGreaterThan(800);
        expect(context.fillText).toHaveBeenCalledWith("Spin", 400, 17);
        expect(objectLabels(context)).toEqual([]);

        vi.clearAllMocks();
        preview.render(20_000);
        expect(context.arc).toHaveBeenCalled();
        expect(objectLabels(context)).toEqual([]);
    });

    it("paints complete earlier objects over overlapping later objects", () => {
        const {context, preview} = createTimeline(1000);
        const overlappingBeatmap = BEATMAP_TEXT.replace(
            "256,192,20000",
            "256,192,12900,5,0,0:0:0:0:\n256,192,20000",
        );
        preview.loadBeatmapText(overlappingBeatmap);
        preview.render(13_000);

        const headLabel = context.fillText.mock.calls.findIndex(([text, x]) => /^\d+$/.test(text) && x === 320);
        expect(context.drawImage).toHaveBeenCalledOnce();
        expect(headLabel).toBeGreaterThanOrEqual(0);
        expect(context.drawImage.mock.invocationCallOrder[0])
            .toBeGreaterThan(context.fillText.mock.invocationCallOrder[headLabel]);
    });

    it.each([-5000, 17_000, 35_000, 45_000])("culls objects entirely outside the window at %s ms", (time) => {
        const {context, preview} = createTimeline(1000);
        preview.loadBeatmapText(BEATMAP_TEXT);
        preview.render(time);

        expect(context.arc).not.toHaveBeenCalled();
        expect(objectLabels(context)).toEqual([]);
        expect(context.fillText.mock.calls.some(([text]) => text === "Spin")).toBe(false);
        expect(context.lineTo).toHaveBeenCalledWith(400, 120);
    });

    it.each([
        [ModBitwise.None, 1],
        [ModBitwise.DoubleTime, 1.5],
        [ModBitwise.HalfTime, 0.75],
    ])("matches playback time for mod bitmask %s", (mods, clockRate) => {
        const {context, preview} = createTimeline();
        const beatmap = preview.loadBeatmapText(BEATMAP_TEXT, {mods}).beatmap;

        expect(beatmap.difficulty.clockRate).toBe(clockRate);
        preview.render(1000 / clockRate);
        expect(objectLabels(context)).toContainEqual(["1", 400, 20]);

        const secondObject = objectLabels(context).find(([text]) => text === "2")!;
        expect(preview.timeAtPosition(secondObject[1], 1000 / clockRate)).toBeCloseTo(1500 / clockRate);
    });

    it("preserves preview-offset timing for rendering and seeking with speed mods", () => {
        const {canvas, context} = createCanvas();
        const preview = new StandardTimelinePreviewer(canvas, {
            width: 800,
            height: 120,
            useBeatmapPreviewTime: true,
            devicePixelRatio: 1,
        });
        const beatmap = preview.loadBeatmapText(BEATMAP_TEXT, {mods: ModBitwise.DoubleTime}).beatmap;
        const currentTime = 1500 / beatmap.difficulty.clockRate - beatmap.general.previewTime;
        preview.render(currentTime);

        expect(objectLabels(context)).toContainEqual(["2", 400, 20]);
        const firstObject = objectLabels(context).find(([text]) => text === "1")!;
        const seekTime = preview.timeAtPosition(firstObject[1], currentTime);
        vi.clearAllMocks();
        preview.render(seekTime);
        const centeredObject = objectLabels(context).find(([text]) => text === "1")!;
        expect(centeredObject[1]).toBeCloseTo(400);

        preview.loadBeatmapText(BEATMAP_TEXT, {useBeatmapPreviewTime: false});
        vi.clearAllMocks();
        preview.render(1000);
        expect(objectLabels(context)).toContainEqual(["1", 400, 20]);
    });

    it("clears and releases the beatmap on disposal, and replaces objects on reload", () => {
        const {context, preview} = createTimeline();
        preview.render(0);
        expect(context.clearRect).not.toHaveBeenCalled();
        preview.loadBeatmapText(BEATMAP_TEXT);
        preview.render(1000);
        expect(preview.beatmap?.hitObjects).toHaveLength(5);

        vi.clearAllMocks();
        preview.dispose();
        expect(preview.beatmap).toBeNull();
        expect(context.clearRect).toHaveBeenCalledOnce();
        preview.render(1000);
        expect(context.arc).not.toHaveBeenCalled();
        expect(context.clearRect).toHaveBeenCalledOnce();

        const replacement = BEATMAP_TEXT.slice(0, BEATMAP_TEXT.indexOf("[HitObjects]"))
            + "[HitObjects]\n256,192,5000,5,0,0:0:0:0:\n";
        preview.loadBeatmapText(replacement);
        vi.clearAllMocks();
        preview.render(5000);
        expect(preview.beatmap?.hitObjects).toHaveLength(1);
        expect(objectLabels(context)).toEqual([["1", 400, 20]]);
        expect(context.arc.mock.calls.filter(([, , radius]) => radius === 16)).toHaveLength(1);
    });

    it("renders a ruler without hitobjects for an empty beatmap", () => {
        const {context, preview} = createTimeline();
        preview.loadBeatmapText(BEATMAP_TEXT.slice(0, BEATMAP_TEXT.indexOf("[HitObjects]")) + "[HitObjects]\n");
        preview.render(0);

        expect(preview.beatmap?.hitObjects).toHaveLength(0);
        expect(context.arc).not.toHaveBeenCalled();
        expect(context.fillText).not.toHaveBeenCalled();
        expect(context.lineTo).toHaveBeenCalledWith(400, 120);
    });
});

describe("StandardBeatmapPreviewer canvas compatibility", () => {
    it("centers combo text using its visible glyph bounds at small and regular circle sizes", () => {
        const {context, preview} = createTimeline();
        const beatmap = preview.loadBeatmapText(BEATMAP_TEXT).beatmap;
        const circle = new DrawableCircle(beatmap.hitObjects[0], beatmap.colors.comboColors[0]);

        for (const radius of [13, 40]) {
            for (const comboNumber of [1, 12]) {
                circle.hitObject.currentComboIndex = comboNumber - 1;
                context.measureText.mockReturnValue({
                    actualBoundingBoxLeft: 2,
                    actualBoundingBoxRight: 6,
                    actualBoundingBoxAscent: 8,
                    actualBoundingBoxDescent: 2,
                });
                circle.drawAt(context as unknown as CanvasRenderingContext2D, new Vector2(100, 50), radius);

                expect(context.fillText).toHaveBeenLastCalledWith(String(comboNumber), 98, 53);
                expect(context.arc).toHaveBeenCalledWith(100, 50, radius, 0, Math.PI * 2);
            }
        }
    });

    it("retains the circle's playback position, size and fade when delegating to shared drawing", () => {
        const {context, preview} = createTimeline();
        const beatmap = preview.loadBeatmapText(BEATMAP_TEXT).beatmap;
        const circle = new DrawableCircle(beatmap.hitObjects[0], beatmap.colors.comboColors[0]);
        const drawAt = vi.spyOn(circle, "drawAt");
        const time = circle.hitObject.startTime + 75;

        circle.draw(context as unknown as CanvasRenderingContext2D, time);

        expect(drawAt).toHaveBeenCalledWith(
            context, circle.hitObject.stackedStartPosition,
            circle.hitObject.radius * circle.scale(time), circle.opacity(time),
        );
        expect(circle.opacity(time)).toBeLessThan(1);
    });

    it("fits and centers the playfield after resizing independently of pixel density", () => {
        const {canvas, context} = createCanvas();
        const preview = new StandardBeatmapPreviewer(canvas, {
            width: 320,
            height: 240,
            devicePixelRatio: 2,
        });
        preview.loadBeatmapText(BEATMAP_TEXT);
        preview.render(-5000);

        expect(canvas.width).toBe(640);
        expect(canvas.height).toBe(480);
        expect(context.translate).toHaveBeenCalledWith(64, 48);
        expect(context.clearRect).toHaveBeenCalledWith(0, 0, 320, 240);
        expect(context.scale).toHaveBeenCalledWith(0.5, 0.5);

        preview.resize(640, 480, 1);
        vi.clearAllMocks();
        preview.render(-5000);

        expect(context.clearRect).toHaveBeenCalledWith(0, 0, 640, 480);
        expect(context.translate).toHaveBeenCalledWith(64, 48);
        expect(context.scale).toHaveBeenCalledWith(1, 1);

        for (const [width, height, scale, x, y] of [
            [1920, 1080, 2.25, 240, 0],
            [800, 1200, 1.25, 0, 300],
        ]) {
            preview.resize(width, height, 2);
            vi.clearAllMocks();
            preview.render(1000);

            expect(canvas.width).toBe(width * 2);
            expect(canvas.height).toBe(height * 2);
            expect(canvas.style.width).toBe(`${width}px`);
            expect(canvas.style.height).toBe(`${height}px`);
            expect(context.translate.mock.calls).toEqual([[x, y], [64, 48]]);
            expect(context.scale).toHaveBeenCalledWith(scale, scale);
            expect(context.clearRect).toHaveBeenCalledWith(0, 0, width, height);
        }
    });
});
