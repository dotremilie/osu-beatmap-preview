import {readFileSync} from "node:fs";
import {IBeatmap, ModBitwise} from "osu-classes";
import {BeatmapDecoder} from "osu-parsers";
import {Slider, Spinner, StandardBeatmap, StandardHitObject, StandardRuleset} from "osu-standard-stable";
import {afterEach, describe, expect, expectTypeOf, it, vi} from "vitest";
import {
    BeatmapLoader,
    StandardBeatmapPreviewer,
    StandardBeatmapRenderer,
    StandardTimelinePreviewer,
    StandardTimelineRenderer,
} from "../src";
import {getStandardComboColors} from "../src/utils/StandardComboColors";

const BEATMAP_TEXT = readFileSync(new URL("./fixtures/timeline.osu", import.meta.url), "utf8");

function createContext() {
    return {
        globalAlpha: 1,
        setTransform: vi.fn(),
        getTransform: vi.fn(() => ({a: 1, b: 0, c: 0, d: 1, e: 0, f: 0})),
        clearRect: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        scale: vi.fn(),
        rotate: vi.fn(),
        beginPath: vi.fn(),
        closePath: vi.fn(),
        rect: vi.fn(),
        clip: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        drawImage: vi.fn(),
        createLinearGradient: vi.fn(() => ({addColorStop: vi.fn()})),
        measureText: vi.fn(() => ({
            actualBoundingBoxLeft: 3,
            actualBoundingBoxRight: 3,
            actualBoundingBoxAscent: 6,
            actualBoundingBoxDescent: 0,
        })),
        fillText: vi.fn(),
    };
}

function createCanvas() {
    const context = createContext();
    const canvas = {
        width: 0,
        height: 0,
        style: {width: "", height: ""},
        getContext: () => context,
        ownerDocument: {
            createElement: () => ({width: 0, height: 0, getContext: () => createContext()}),
        },
    } as unknown as HTMLCanvasElement;
    Object.assign(context, {canvas});
    return {canvas, context};
}

function geometry(beatmap: Readonly<StandardBeatmap>) {
    return beatmap.hitObjects.map(object => ({
        startTime: object.startTime,
        endTime: object instanceof Slider || object instanceof Spinner ? object.endTime : object.startTime,
        radius: object.radius,
        startPosition: [object.startPosition.x, object.startPosition.y],
        stackedPosition: [object.stackedStartPosition.x, object.stackedStartPosition.y],
        comboIndex: object.currentComboIndex,
        path: object instanceof Slider ? object.path.path.map(point => [point.x, point.y]) : null,
        controlPoints: object instanceof Slider
            ? object.path.controlPoints.map(point => [point.position.x, point.position.y, point.type])
            : null,
        nested: object.nestedHitObjects.map(nested => ({
            startTime: nested.startTime,
            startPosition: [nested.startPosition.x, nested.startPosition.y],
            radius: nested instanceof StandardHitObject ? nested.radius : null,
        })),
    }));
}

afterEach(() => vi.restoreAllMocks());

describe("BeatmapLoader", () => {
    it("uses the injected ruleset and preserves its concrete return type", () => {
        const converted = Object.assign(new StandardBeatmap(), {customResult: true as const});
        class CustomRuleset extends StandardRuleset {
            override applyToBeatmapWithMods(_beatmap: IBeatmap) {
                return converted;
            }
        }
        const ruleset = new CustomRuleset();
        const createMods = vi.spyOn(ruleset, "createModCombination");
        const convert = vi.spyOn(ruleset, "applyToBeatmapWithMods");
        const source = new BeatmapDecoder().decodeFromString(BEATMAP_TEXT);
        const loader = new BeatmapLoader(ruleset);
        const result = loader.loadBeatmap(source, {mods: ModBitwise.Hidden});

        expect(result).toBe(converted);
        expect(createMods).toHaveBeenCalledWith(ModBitwise.Hidden);
        expect(convert).toHaveBeenCalledWith(expect.objectContaining({base: undefined}), createMods.mock.results[0].value);
        expect(convert.mock.calls[0][0].metadata.title).toBe(source.metadata.title);
        expectTypeOf(result.customResult).toEqualTypeOf<true>();
        expectTypeOf(result).toEqualTypeOf<Readonly<typeof converted>>();
    });

    it.each([
        [ModBitwise.Hidden | ModBitwise.DoubleTime, 1.5],
        [ModBitwise.HardRock | ModBitwise.HalfTime, 0.75],
    ])("prepares once and shares the exact modded map between views for mods %s", (mods, clockRate) => {
        const decode = vi.spyOn(BeatmapDecoder.prototype, "decodeFromString");
        const apply = vi.spyOn(StandardRuleset.prototype, "applyToBeatmapWithMods");
        const prepared = new BeatmapLoader(new StandardRuleset()).loadBeatmapText(BEATMAP_TEXT, {mods});
        const preview = new StandardBeatmapPreviewer(createCanvas().canvas);
        const timeline = new StandardTimelinePreviewer(createCanvas().canvas);

        expect(preview.loadPreparedBeatmap(prepared)).toBe(prepared);
        expect(timeline.loadPreparedBeatmap(prepared)).toBe(prepared);
        expect(preview.beatmap).toBe(timeline.beatmap);
        expect(preview.beatmap?.hitObjects[2]).toBe(prepared.hitObjects[2]);
        expect(prepared.mods.bitwise).toBe(mods);
        expect(prepared.difficulty.clockRate).toBe(clockRate);
        expect(decode).toHaveBeenCalledTimes(1);
        expect(apply).toHaveBeenCalledTimes(1);
    });

    it("can prepare a decoded map without a canvas and reset previously applied mods", () => {
        const loader = new BeatmapLoader(new StandardRuleset());
        const text = BEATMAP_TEXT.replace("128,192,3000", "128,150,3000").replace("L|328:192", "L|328:250");
        const modded = loader.loadBeatmapText(text, {mods: ModBitwise.DoubleTime | ModBitwise.HardRock});
        const moddedGeometry = geometry(modded);
        const unmodded = loader.loadBeatmap(modded);
        const expected = loader.loadBeatmapText(text);

        expect(unmodded).not.toBe(modded);
        expect(unmodded.mods.bitwise).toBe(0);
        expect(unmodded.difficulty.clockRate).toBe(1);
        expect(geometry(unmodded)).toEqual(geometry(expected));
        expect(geometry(modded)).toEqual(moddedGeometry);
        expect(modded.mods.bitwise).toBe(ModBitwise.DoubleTime | ModBitwise.HardRock);
        expect(modded.difficulty.clockRate).toBe(1.5);
    });

    it("isolates mod conversion from decoded sources and maps already attached to another view", () => {
        const text = BEATMAP_TEXT.replace("128,192,3000", "128,150,3000").replace("L|328:192", "L|328:250");
        const decoded = new BeatmapDecoder().decodeFromString(text);
        const loader = new BeatmapLoader(new StandardRuleset());
        const prepared = loader.loadBeatmap(decoded);
        const before = geometry(prepared);
        const timeline = new StandardTimelinePreviewer(createCanvas().canvas);
        timeline.loadPreparedBeatmap(prepared);

        const hardRock = loader.loadBeatmap(prepared, {mods: ModBitwise.HardRock});
        const repeatedHardRock = loader.loadBeatmap(hardRock, {mods: ModBitwise.HardRock});

        expect(hardRock.base).toBe(decoded);
        expect(repeatedHardRock.base).toBe(decoded);
        expect(hardRock.hitObjects[2].startPosition.y).toBe(234);
        expect(decoded.hitObjects[2].startPosition.y).toBe(150);
        expect(geometry(repeatedHardRock)).toEqual(geometry(hardRock));
        expect(hardRock.difficulty.circleSize).toBe(repeatedHardRock.difficulty.circleSize);
        expect(geometry(prepared)).toEqual(before);
        expect(timeline.beatmap).toBe(prepared);
        expect(geometry(loader.loadBeatmap(decoded))).toEqual(before);
    });

    it.each([
        ["playfield", StandardBeatmapPreviewer],
        ["timeline", StandardTimelinePreviewer],
    ] as const)("keeps %s standalone loading and explicit mod-reset behavior", (_name, Previewer) => {
        const preview = new Previewer(createCanvas().canvas);
        const modded = preview.loadBeatmapText(BEATMAP_TEXT, {mods: ModBitwise.Hidden | ModBitwise.DoubleTime});
        const unmodded = preview.loadBeatmap(modded);

        expect(preview.beatmap).toBe(unmodded);
        expect(unmodded).not.toBe(modded);
        expect(unmodded.mods.bitwise).toBe(0);
        expect(unmodded.difficulty.clockRate).toBe(1);

        const slower = preview.loadBeatmap(modded, {mods: ModBitwise.HalfTime});
        expect(preview.beatmap).toBe(slower);
        expect(slower.mods.bitwise).toBe(ModBitwise.HalfTime);
        expect(slower.difficulty.clockRate).toBe(0.75);
        expect(modded.difficulty.clockRate).toBe(1.5);
        expect(modded.mods.has(ModBitwise.Hidden)).toBe(true);
    });

    it("keeps constructor preview-time defaults and attachment overrides independent for each view", () => {
        const playfieldRender = vi.spyOn(StandardBeatmapRenderer.prototype, "render").mockImplementation(() => {});
        const timelineRender = vi.spyOn(StandardTimelineRenderer.prototype, "render").mockImplementation(() => {});
        const prepared = new BeatmapLoader(new StandardRuleset()).loadBeatmapText(BEATMAP_TEXT, {mods: ModBitwise.DoubleTime});
        const preview = new StandardBeatmapPreviewer(createCanvas().canvas, {useBeatmapPreviewTime: true});
        const timeline = new StandardTimelinePreviewer(createCanvas().canvas);

        preview.loadPreparedBeatmap(prepared);
        timeline.loadPreparedBeatmap(prepared);
        preview.render(100);
        timeline.render(100);
        expect(playfieldRender).toHaveBeenLastCalledWith(1100);
        expect(timelineRender).toHaveBeenLastCalledWith(100);

        preview.loadPreparedBeatmap(prepared, {useBeatmapPreviewTime: false});
        timeline.loadPreparedBeatmap(prepared, {useBeatmapPreviewTime: true});
        preview.render(200);
        timeline.render(200);
        expect(playfieldRender).toHaveBeenLastCalledWith(200);
        expect(timelineRender).toHaveBeenLastCalledWith(1200);

        preview.loadPreparedBeatmap(prepared);
        timeline.loadPreparedBeatmap(prepared);
        preview.render(300);
        timeline.render(300);
        expect(playfieldRender).toHaveBeenLastCalledWith(1300);
        expect(timelineRender).toHaveBeenLastCalledWith(300);
    });

    it("forwards preview-time options through standalone loading", () => {
        const render = vi.spyOn(StandardBeatmapRenderer.prototype, "render").mockImplementation(() => {});
        const preview = new StandardBeatmapPreviewer(createCanvas().canvas);
        const prepared = preview.loadBeatmapText(BEATMAP_TEXT, {useBeatmapPreviewTime: true});
        preview.render(100);
        expect(render).toHaveBeenLastCalledWith(1100);

        preview.loadBeatmap(prepared, {useBeatmapPreviewTime: false});
        preview.render(100);
        expect(render).toHaveBeenLastCalledWith(100);
    });

    it("allows one view to reload and dispose while the other keeps rendering the shared map", () => {
        const prepared = new BeatmapLoader(new StandardRuleset()).loadBeatmapText(BEATMAP_TEXT);
        const preview = new StandardBeatmapPreviewer(createCanvas().canvas);
        const timelineCanvas = createCanvas();
        const timeline = new StandardTimelinePreviewer(timelineCanvas.canvas);
        preview.loadPreparedBeatmap(prepared);
        timeline.loadPreparedBeatmap(prepared);
        timeline.render(4000);
        const firstDrawCount = timelineCanvas.context.drawImage.mock.calls.length;
        expect(firstDrawCount).toBeGreaterThan(0);

        preview.loadBeatmapText(BEATMAP_TEXT, {mods: ModBitwise.DoubleTime});
        expect(preview.beatmap).not.toBe(prepared);
        expect(timeline.beatmap).toBe(prepared);
        preview.dispose();
        timeline.render(4500);

        expect(preview.beatmap).toBeNull();
        expect(timeline.beatmap).toBe(prepared);
        expect(prepared.difficulty.clockRate).toBe(1);
        expect(timelineCanvas.context.drawImage.mock.calls.length).toBeGreaterThan(firstDrawCount);
    });

    it("preserves shared geometry when the views render, resize, seek and change timeline settings", () => {
        const prepared = new BeatmapLoader(new StandardRuleset()).loadBeatmapText(BEATMAP_TEXT, {mods: ModBitwise.DoubleTime});
        const before = geometry(prepared);
        const preview = new StandardBeatmapPreviewer(createCanvas().canvas);
        const timeline = new StandardTimelinePreviewer(createCanvas().canvas);
        preview.loadPreparedBeatmap(prepared);
        timeline.loadPreparedBeatmap(prepared);

        for (const [time, radius] of [[3000, 24], [7000, 8], [1000, 16]]) {
            timeline.objectRadius = radius;
            timeline.zoom(1.5);
            timeline.resize(800, 80, 2);
            timeline.render(time);
            preview.resize(1280, 960, 2);
            preview.render(time);
        }

        expect(geometry(prepared)).toEqual(before);
        expect(preview.beatmap).toBe(prepared);
        expect(timeline.beatmap).toBe(prepared);
    });

    it("uses default combo colors without adding them to shared beatmap data", () => {
        const text = BEATMAP_TEXT.replace(/\[Colours\][\s\S]*?(?=\[HitObjects\])/, "");
        const prepared = new BeatmapLoader(new StandardRuleset()).loadBeatmapText(text);
        const originalColors = prepared.colors.comboColors;
        expect(originalColors).toEqual([]);
        const preview = new StandardBeatmapPreviewer(createCanvas().canvas);
        const timeline = new StandardTimelinePreviewer(createCanvas().canvas);
        preview.loadPreparedBeatmap(prepared);
        timeline.loadPreparedBeatmap(prepared);
        preview.render(1000);
        timeline.render(1000);

        expect(prepared.colors.comboColors).toBe(originalColors);
        expect(prepared.colors.comboColors).toEqual([]);
        expect(getStandardComboColors(prepared as StandardBeatmap).map(color => [color.red, color.green, color.blue])).toEqual([
            [0, 202, 0], [18, 124, 255], [242, 24, 57], [255, 192, 0],
        ]);
    });
});
