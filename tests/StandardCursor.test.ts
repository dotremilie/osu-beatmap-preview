import {readFileSync} from "node:fs";
import {afterEach, describe, expect, it, vi} from "vitest";
import {ModBitwise} from "osu-classes";
import {Slider, Spinner} from "osu-standard-stable";
import {BeatmapLoader, StandardBeatmapPreviewer, StandardBeatmapRenderer} from "../src";
import StandardReplay, {CursorState, getAutoplayReplay} from "../src/internal/autoplay/StandardReplay";
import StandardCursor from "../src/internal/autoplay/StandardCursor";
import DrawableCursor from "../src/internal/appearance/DrawableCursor";
import {DrawableCircle} from "../src/drawables/standard/DrawableCircle";
import {DrawableApproachCircle} from "../src/drawables/standard/DrawableApproachCircle";

// Follow-point painting is exercised separately with a complete canvas mock.
vi.mock("../src/internal/appearance/DrawableFollowPoint", () => ({default: class {
    draw(): void {}
    dispose(): void {}
}}));

const fixture = readFileSync(new URL("./fixtures/timeline.osu", import.meta.url), "utf8");
const header = fixture.slice(0, fixture.indexOf("[HitObjects]"));
function prepare(objects: string[], mods = 0) {
    return new BeatmapLoader().loadBeatmapText(`${header}[HitObjects]\n${objects.join("\n")}\n`, {mods});
}
function sample(replay: StandardReplay, timeMs: number): CursorState {
    const state = {x: 0, y: 0, scale: 1, actions: 0};
    expect(replay.sample(timeMs, state)).toBe(true);
    return state;
}
function canvas() {
    let depth = 0;
    const gradient = () => ({addColorStop: vi.fn()});
    const ctx = {
        save: vi.fn(() => depth++), restore: vi.fn(() => depth--),
        beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(), stroke: vi.fn(),
        translate: vi.fn(), scale: vi.fn(), setTransform: vi.fn(), clearRect: vi.fn(),
        getTransform: vi.fn(() => ({a: 1, b: 0, c: 0, d: 1, e: 0, f: 0})),
        createRadialGradient: vi.fn(gradient), createLinearGradient: vi.fn(gradient), globalAlpha: 1,
    };
    return {canvas: {width: 640, height: 480, style: {}, getContext: () => ctx} as unknown as HTMLCanvasElement,
        ctx: ctx as unknown as CanvasRenderingContext2D, depth: () => depth};
}
const circles = ["100,100,1000,1,0,0:0:0:0:", "400,200,1200,1,0,0:0:0:0:", "200,300,5000,1,0,0:0:0:0:"];
afterEach(() => vi.restoreAllMocks());

describe("autoplay replay", () => {
    it("handles equal-time replay frames and non-finite sample times without NaNs", () => {
        const replay = new StandardReplay([
            {timeMs: 1000, x: 100, y: 100, actions: 1},
            {timeMs: 1000, x: 200, y: 200, actions: 2},
            {timeMs: 1050, x: 200, y: 200, actions: 0},
        ], 1);
        expect(sample(replay, 1000)).toMatchObject({x: 200, y: 200, actions: 2, scale: 1});
        const state = sample(replay, 1040);
        const before = {...state};
        expect(replay.sample(NaN, state)).toBe(false);
        expect(replay.sample(Infinity, state)).toBe(false);
        expect(state).toEqual(before);
    });

    it("starts a spinner from the centre without a degenerate tangent", () => {
        const prepared = prepare(["256,192,1000,1,0,0:0:0:0:", "256,192,3000,8,0,6000,0:0:0:0:"]);
        const replay = getAutoplayReplay(prepared);
        expect(sample(replay, 3000)).toMatchObject({x: 256, y: 142});
        expect(replay.frames.every(frame => Number.isFinite(frame.x) && Number.isFinite(frame.y))).toBe(true);
    });

    it("hits circle targets, alternates fast presses, waits before distant notes, and releases", () => {
        const prepared = prepare(circles);
        const replay = getAutoplayReplay(prepared);
        for (const object of prepared.beatmap.hitObjects) {
            expect(sample(replay, object.startTime)).toMatchObject({x: object.stackedStartPosition.x, y: object.stackedStartPosition.y});
        }
        expect(sample(replay, 1000).actions).not.toBe(sample(replay, 1200).actions);
        expect(sample(replay, 1250).actions).toBe(0);
        expect(sample(replay, 3000)).toMatchObject({x: 400, y: 200, actions: 0});
        expect(sample(replay, -10000)).toMatchObject({x: 256, y: 500, actions: 0, scale: 1});
        expect(sample(replay, 10000)).toMatchObject({x: 200, y: 300, actions: 0, scale: 1});
    });

    it.each([0, ModBitwise.Hidden, ModBitwise.HardRock, ModBitwise.DoubleTime, ModBitwise.HalfTime])(
        "follows curved/repeated/stacked sliders without mutating geometry, mods %s", mods => {
            const prepared = prepare(["128,192,1000,1,0,0:0:0:0:", "128,192,1100,2,0,B|228:92|328:192,3,200"], mods);
            const slider = prepared.beatmap.hitObjects[1] as Slider;
            const geometry = JSON.stringify(slider.path.path);
            const replay = getAutoplayReplay(prepared);
            const frames = replay.frames.filter(frame => frame.timeMs >= slider.startTime && frame.timeMs <= slider.endTime);
            expect(frames.length).toBeGreaterThan(20);
            for (const frame of frames) {
                const point = slider.path.positionAt(slider.path.progressAt((frame.timeMs - slider.startTime) / slider.duration, slider.spans));
                expect(frame.x).toBeCloseTo(slider.stackedStartPosition.x + point.x, 4);
                expect(frame.y).toBeCloseTo(slider.stackedStartPosition.y + point.y, 4);
            }
            expect(sample(replay, slider.endTime)).toMatchObject({x: slider.stackedEndPosition.x, y: slider.stackedEndPosition.y});
            expect(JSON.stringify(slider.path.path)).toBe(geometry);
        },
    );

    it.each([0, ModBitwise.DoubleTime, ModBitwise.HalfTime])("uses rate-adjusted spinner motion and continuous exit, mods %s", mods => {
        const prepared = prepare(["100,100,1000,1,0,0:0:0:0:", "256,192,3000,8,0,6000,0:0:0:0:"], mods);
        const spinner = prepared.beatmap.hitObjects[1] as Spinner;
        const replay = getAutoplayReplay(prepared);
        const start = sample(replay, spinner.startTime);
        expect(Math.hypot(start.x - 256, start.y - 192)).toBeCloseTo(50);
        const frame = replay.frames.find(frame => frame.timeMs > spinner.startTime && frame.timeMs < spinner.endTime)!;
        const angle = Math.atan2(start.y - 192, start.x - 256) - 1000 / 60 * 0.05;
        expect(frame.x).toBeCloseTo(256 + Math.cos(angle) * 50, 4);
        expect(frame.y).toBeCloseTo(192 + Math.sin(angle) * 50, 4);
        const end = sample(replay, spinner.endTime);
        expect(sample(replay, spinner.endTime + 1)).toMatchObject({x: end.x, y: end.y});
        expect(sample(replay, spinner.endTime + 51).actions).toBe(0);
    });

    it("lets later objects take over overlapping sliders and resolves simultaneous starts", () => {
        const replay = getAutoplayReplay(prepare([
            "100,100,1000,2,0,L|400:100,2,300", "200,200,1500,1,0,0:0:0:0:", "300,300,1500,1,0,0:0:0:0:",
        ]));
        expect(sample(replay, 1500)).toMatchObject({x: 300, y: 300});
        expect(replay.frames.every((frame, index) => index === 0 || replay.frames[index - 1].timeMs <= frame.timeMs)).toBe(true);
        expect(replay.frames.filter(frame => frame.timeMs > 1500 && frame.timeMs < 1550)).toHaveLength(0);
        const forward = sample(replay, 1600);
        sample(replay, 1000);
        expect(sample(replay, 1600)).toEqual(forward);
    });

    it("shares immutable replay data by handle and separates differently prepared maps", () => {
        const prepared = prepare(circles);
        const replay = getAutoplayReplay(prepared);
        expect(getAutoplayReplay(prepared)).toBe(replay);
        expect(getAutoplayReplay(prepare(circles))).not.toBe(replay);
        expect(Object.isFrozen(replay.frames)).toBe(true);
        expect(replay.frames.every(Object.isFrozen)).toBe(true);
    });

    it("evaluates press expansion and release contraction independently of seek order", () => {
        const replay = getAutoplayReplay(prepare(circles));
        const state = sample(replay, 1030);
        expect(state.scale).toBeGreaterThan(1);
        expect(sample(replay, 1190).scale).toBeGreaterThan(1);
        sample(replay, 10000);
        expect(sample(replay, 1030)).toEqual(state);
        expect(sample(replay, 5500).scale).toBe(1);
    });
});

describe("autoplay cursor lifecycle", () => {
    it("disables trail evaluation while retaining the cursor and reconstructs it on re-enable", () => {
        const prepared = prepare(circles);
        const painter = vi.spyOn(DrawableCursor.prototype, "draw").mockImplementation(() => {});
        const evaluate = vi.spyOn(StandardReplay.prototype, "sample");
        const cursor = new StandardCursor();
        const ctx = canvas().ctx;
        cursor.draw(ctx, prepared, 900);
        const expected = painter.mock.calls[0][2].map(part => ({...part}));
        evaluate.mockClear();
        cursor.draw(ctx, prepared, 900, false);
        expect(evaluate).toHaveBeenCalledTimes(1);
        expect(painter.mock.calls[1][2]).toEqual([]);
        expect(painter.mock.calls[1][1]).toEqual(sample(getAutoplayReplay(prepared), 900));
        cursor.draw(ctx, prepared, 900, true);
        expect(painter.mock.calls[2][2]).toEqual(expected);
        cursor.dispose();
    });

    it("supports trail options and runtime changes on both public classes across map loads", () => {
        vi.spyOn(DrawableCircle.prototype, "draw").mockImplementation(() => {});
        vi.spyOn(DrawableApproachCircle.prototype, "draw").mockImplementation(() => {});
        const draw = vi.spyOn(StandardCursor.prototype, "draw").mockImplementation(() => {});
        const prepared = prepare(circles);
        const renderer = new StandardBeatmapRenderer(canvas().ctx, prepared, {autoplay: true, cursorTrail: false});
        expect(renderer.cursorTrail).toBe(false);
        renderer.render(900);
        expect(draw.mock.lastCall?.[3]).toBe(false);
        renderer.cursorTrail = true;
        renderer.render(900);
        expect(draw.mock.lastCall?.[3]).toBe(true);
        renderer.dispose();
        const preview = new StandardBeatmapPreviewer(canvas().canvas, {autoplay: true, cursorTrail: false});
        preview.loadPreparedBeatmap(prepared);
        preview.render(900);
        expect(draw.mock.lastCall?.[3]).toBe(false);
        preview.cursorTrail = true;
        preview.render(900);
        expect(draw.mock.lastCall?.[3]).toBe(true);
        preview.cursorTrail = false;
        preview.loadPreparedBeatmap(prepare(circles));
        preview.render(900);
        expect(preview.cursorTrail).toBe(false);
        expect(draw.mock.lastCall?.[3]).toBe(false);
        preview.dispose();
    });

    it("uses Argon's fade curve over playback time", () => {
        const prepared = prepare(circles);
        const draw = vi.spyOn(DrawableCursor.prototype, "draw").mockImplementation(() => {});
        new StandardCursor().draw(canvas().ctx, prepared, 900);
        const trail = draw.mock.calls[0][2];
        // The eighteenth of 36 moving samples is 150 playback milliseconds old.
        expect(trail[17].opacity).toBeCloseTo(Math.pow(0.5, 4));
    });

    it("paints small white additive stamps at spatial intervals even for fast jumps", () => {
        const surface = canvas();
        const blending: string[] = [];
        vi.spyOn(surface.ctx, "fill").mockImplementation(() => { blending.push(surface.ctx.globalCompositeOperation); });
        new DrawableCursor().draw(surface.ctx, {x: 100, y: 100, scale: 1, actions: 0}, [
            {x: 0, y: 100, scale: 1, actions: 0, opacity: 0.0625},
            {x: 100, y: 100, scale: 1, actions: 0, opacity: 1},
        ]);
        const gradients = vi.mocked(surface.ctx.createRadialGradient);
        expect(gradients).toHaveBeenCalledTimes(Math.floor(100 / 0.32));
        expect(gradients.mock.calls[0]).toEqual([0.32, 100, 0, 0.32, 100, 1]);
        const stops = gradients.mock.results[0].value.addColorStop;
        expect(stops).toHaveBeenLastCalledWith(1, "rgba(255,255,255,0)");
        expect(blending.slice(0, gradients.mock.calls.length).every(mode => mode === "lighter")).toBe(true);
        expect(surface.depth()).toBe(0);
    });

    it("does not evaluate or allocate an autoplay replay while disabled", () => {
        vi.spyOn(DrawableCircle.prototype, "draw").mockImplementation(() => {});
        vi.spyOn(DrawableApproachCircle.prototype, "draw").mockImplementation(() => {});
        const draw = vi.spyOn(StandardCursor.prototype, "draw");
        const evaluate = vi.spyOn(StandardReplay.prototype, "sample");
        const renderer = new StandardBeatmapRenderer(canvas().ctx, prepare(circles));
        renderer.render(1000);
        renderer.render(1000);
        expect(draw).not.toHaveBeenCalled();
        expect(evaluate).not.toHaveBeenCalled();
        renderer.dispose();
    });

    it("scales the centre glow with the canvas DPR and preserves drawing state", () => {
        const surface = canvas();
        vi.spyOn(surface.ctx, "getTransform").mockReturnValue({a: 2, b: 0} as DOMMatrix);
        let glow = 0;
        vi.spyOn(surface.ctx, "fill").mockImplementation(() => { glow = surface.ctx.shadowBlur; });
        new DrawableCursor().draw(surface.ctx, {x: 100, y: 100, scale: 1.2, actions: 1}, []);
        expect(glow).toBe(40);
        expect(surface.depth()).toBe(0);
    });

    it("restores both renderer and preview transforms when the cursor painter throws", () => {
        vi.spyOn(DrawableCircle.prototype, "draw").mockImplementation(() => {});
        vi.spyOn(DrawableApproachCircle.prototype, "draw").mockImplementation(() => {});
        vi.spyOn(DrawableCursor.prototype, "draw").mockImplementation(() => { throw new Error("paint failed"); });
        const surface = canvas();
        const view = new StandardBeatmapPreviewer(surface.canvas, {autoplay: true});
        view.loadPreparedBeatmap(prepare(circles));
        expect(() => view.render(1000)).toThrow("paint failed");
        expect(surface.depth()).toBe(0);
        view.dispose();
    });

    it("defaults off, toggles next frame, draws last, and cannot render after disposal", () => {
        const events: string[] = [];
        vi.spyOn(DrawableCircle.prototype, "draw").mockImplementation(() => { events.push("circle"); });
        vi.spyOn(DrawableApproachCircle.prototype, "draw").mockImplementation(() => { events.push("approach"); });
        const draw = vi.spyOn(DrawableCursor.prototype, "draw").mockImplementation(() => { events.push("cursor"); });
        const renderer = new StandardBeatmapRenderer(canvas().ctx, prepare(circles));
        renderer.render(1000);
        expect(draw).not.toHaveBeenCalled();
        renderer.autoplay = true;
        events.length = 0;
        renderer.render(1000);
        expect(events[events.length - 1]).toBe("cursor");
        expect(events).toContain("approach");
        renderer.autoplay = false;
        renderer.render(1000);
        expect(draw).toHaveBeenCalledTimes(1);
        renderer.dispose();
        renderer.dispose();
        renderer.autoplay = true;
        renderer.render(1000);
        expect(draw).toHaveBeenCalledTimes(1);
    });

    it("preserves preview settings across maps and aligns clock rate plus preview offset", () => {
        vi.spyOn(DrawableCircle.prototype, "draw").mockImplementation(() => {});
        vi.spyOn(DrawableApproachCircle.prototype, "draw").mockImplementation(() => {});
        const draw = vi.spyOn(DrawableCursor.prototype, "draw").mockImplementation(() => {});
        const view = new StandardBeatmapPreviewer(canvas().canvas, {autoplay: true, useBeatmapPreviewTime: true});
        const prepared = prepare(circles, ModBitwise.DoubleTime);
        view.loadPreparedBeatmap(prepared);
        view.render(100);
        expect(draw.mock.calls[0][1]).toEqual(sample(getAutoplayReplay(prepared), (100 + 1000) * prepared.clockRate));
        view.autoplay = false;
        view.loadPreparedBeatmap(prepare(circles));
        view.render(100);
        expect(draw).toHaveBeenCalledTimes(1);
        expect(view.autoplay).toBe(false);
        view.autoplay = true;
        view.render(100);
        expect(draw).toHaveBeenCalledTimes(2);
        view.dispose();
    });

    it.each([0, ModBitwise.DoubleTime, ModBitwise.HalfTime])("bounds and reproduces trail after seeking or pausing, mods %s", mods => {
        const prepared = prepare(circles, mods);
        const draw = vi.spyOn(DrawableCursor.prototype, "draw").mockImplementation(() => {});
        const cursor = new StandardCursor();
        const ctx = canvas().ctx;
        const capture = (timeMs: number) => {
            cursor.draw(ctx, prepared, timeMs);
            const call = draw.mock.calls[draw.mock.calls.length - 1];
            return JSON.parse(JSON.stringify({cursor: call[1], trail: call[2]}));
        };
        const first = capture(900);
        expect(first.trail.length).toBeGreaterThan(0);
        expect(first.trail.length).toBeLessThanOrEqual(37);
        expect(first.trail.every((part: {opacity: number}) => part.opacity > 0 && part.opacity <= 1)).toBe(true);
        expect(capture(900)).toEqual(first);
        capture(5000);
        expect(capture(900)).toEqual(first);
        expect(capture(10000).trail).toEqual([]);
        expect(capture(3000).trail.length).toBeLessThanOrEqual(1);
        cursor.dispose();
    });

    it("draws nothing for empty maps and keeps views sharing a map independent", () => {
        const draw = vi.spyOn(DrawableCursor.prototype, "draw").mockImplementation(() => {});
        const ctx = canvas().ctx;
        new StandardCursor().draw(ctx, prepare([]), 0);
        expect(draw).not.toHaveBeenCalled();
        const prepared = prepare(circles);
        const first = new StandardCursor();
        const second = new StandardCursor();
        first.draw(ctx, prepared, 900);
        first.dispose();
        second.draw(ctx, prepared, 900);
        expect(draw).toHaveBeenCalledTimes(2);
        expect(draw.mock.calls[0][1]).not.toBe(draw.mock.calls[1][1]);
        second.dispose();
    });

    it("restores canvas state when painting fails", () => {
        const surface = canvas();
        vi.spyOn(surface.ctx, "createRadialGradient").mockImplementation(() => { throw new Error("paint failed"); });
        expect(() => new StandardCursor().draw(surface.ctx, prepare(circles), 900)).toThrow("paint failed");
        expect(surface.depth()).toBe(0);
    });
});
