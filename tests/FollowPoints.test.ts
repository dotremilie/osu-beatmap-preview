import {readFileSync} from "node:fs";
import {afterEach, describe, expect, it, vi} from "vitest";
import {ModBitwise} from "osu-classes";
import {Slider, StandardHitObject} from "osu-standard-stable";
import {BeatmapLoader, StandardBeatmapPreviewer, StandardBeatmapRenderer} from "../src";
import {createFollowPointConnections, evaluateFollowPoint, FollowPoint, FollowPointState} from "../src/internal/followpoints/FollowPoint";
import FollowPointRenderer from "../src/internal/followpoints/FollowPointRenderer";
import DrawableFollowPoint from "../src/internal/appearance/DrawableFollowPoint";
import {DrawableCircle} from "../src/drawables/standard/DrawableCircle";
import {DrawableApproachCircle} from "../src/drawables/standard/DrawableApproachCircle";
import StandardCursor from "../src/internal/autoplay/StandardCursor";

const fixture = readFileSync(new URL("./fixtures/timeline.osu", import.meta.url), "utf8");
const header = fixture.slice(0, fixture.indexOf("[HitObjects]"));
const circles = ["100,100,1000,1,0,0:0:0:0:", "400,100,2000,1,0,0:0:0:0:"];
function prepare(objects = circles, mods = 0) {
    return new BeatmapLoader().loadBeatmapText(`${header}[HitObjects]\n${objects.join("\n")}\n`, {mods});
}
function evaluate(point: FollowPoint, timeMs: number) {
    const state: FollowPointState = {x: 0, y: 0, scale: 1, opacity: 0, rotationRadians: 0};
    return evaluateFollowPoint(point, timeMs, state) ? state : undefined;
}
function canvas() {
    let alpha = 1;
    let blending = "source-over";
    const stack: {alpha: number; blending: string}[] = [];
    const ctx = {
        get globalAlpha() { return alpha; }, set globalAlpha(value: number) { alpha = value; },
        get globalCompositeOperation() { return blending; }, set globalCompositeOperation(value: string) { blending = value; },
        save: vi.fn(() => stack.push({alpha, blending})),
        restore: vi.fn(() => { const state = stack.pop()!; alpha = state.alpha; blending = state.blending; }),
        translate: vi.fn(), rotate: vi.fn(), scale: vi.fn(), fill: vi.fn(),
        clearRect: vi.fn(), setTransform: vi.fn(),
        createLinearGradient: vi.fn(() => ({addColorStop: vi.fn()})),
    };
    return {ctx: ctx as unknown as CanvasRenderingContext2D,
        canvas: {width: 640, height: 480, style: {}, getContext: () => ctx} as unknown as HTMLCanvasElement,
        depth: () => stack.length};
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("follow-point geometry", () => {
    it("uses exact spacing, endpoint gaps, scale and immutable models without mutating the map", () => {
        const prepared = prepare();
        const before = JSON.stringify(prepared.beatmap.hitObjects);
        const connections = createFollowPointConnections(prepared);
        const points = connections[0].points;
        expect(points.map(point => point.endX)).toEqual([148, 180, 212, 244, 276, 308, 340]);
        expect(points.every(point => point.endY === 100 && point.rotationRadians === 0)).toBe(true);
        expect(points[0].startX).toBeCloseTo(118);
        expect(points[0].scale).toBe(prepared.beatmap.hitObjects[1].scale);
        expect(Object.isFrozen(connections)).toBe(true);
        expect(Object.isFrozen(points)).toBe(true);
        expect(points.every(Object.isFrozen)).toBe(true);
        expect(JSON.stringify(prepared.beatmap.hitObjects)).toBe(before);
    });

    it.each([[], [circles[0]], [circles[0], "100,100,2000,1,0,0:0:0:0:"],
        [circles[0], "180,100,2000,1,0,0:0:0:0:"], [circles[0], "400,100,2000,5,0,0:0:0:0:"]].map(objects => ({objects})))(
        "omits absent, short, coincident, or new-combo connections: $objects", ({objects}) => {
            expect(createFollowPointConnections(prepare(objects))).toEqual([]);
        },
    );

    it("breaks chains around spinners rather than connecting across them", () => {
        const prepared = prepare([circles[0], "256,192,1500,8,0,1800,0:0:0:0:", circles[1]]);
        expect(createFollowPointConnections(prepared)).toEqual([]);
    });

    it.each([0, ModBitwise.Hidden, ModBitwise.HardRock, ModBitwise.DoubleTime, ModBitwise.HalfTime])(
        "uses stacked endpoints of curved repeated sliders, mods %s", mods => {
            const prepared = prepare(["100,100,1000,1,0,0:0:0:0:",
                "100,100,1100,2,0,B|200:200|300:100,2,200", "400,300,5000,1,0,0:0:0:0:"], mods);
            const slider = prepared.beatmap.hitObjects[1] as Slider;
            const before = JSON.stringify(slider.path.path);
            const points = createFollowPointConnections(prepared).at(-1)!.points;
            const start = slider.stackedEndPosition;
            const end = prepared.beatmap.hitObjects[2].stackedStartPosition;
            const distance = Math.trunc(Math.hypot(end.x - start.x, end.y - start.y));
            const point = points[0];
            expect(point.endX).toBeCloseTo(start.x + 48 / distance * (end.x - start.x));
            expect(point.endY).toBeCloseTo(start.y + 48 / distance * (end.y - start.y));
            expect(point.fadeOutTimeMs).toBeCloseTo(slider.endTime + 48 / distance * (5000 - slider.endTime));
            expect(JSON.stringify(slider.path.path)).toBe(before);
        },
    );

    it("preserves original order for simultaneous starts and retains overlapping connections", () => {
        const simultaneous = createFollowPointConnections(prepare([circles[0],
            "400,100,1000,1,0,0:0:0:0:", "400,400,1000,1,0,0:0:0:0:"]));
        expect(simultaneous).toHaveLength(2);
        expect(simultaneous[0].points[0].rotationRadians).toBe(0);
        expect(simultaneous[1].points[0].rotationRadians).toBe(Math.PI / 2);
        const overlap = createFollowPointConnections(prepare([
            "100,100,1000,2,0,L|400:100,2,300", "400,300,1500,1,0,0:0:0:0:"]));
        expect(overlap).toHaveLength(1);
        expect(overlap[0].startTime).toBeLessThan(overlap[0].endTime);
    });
});

describe("follow-point animation and lifecycle", () => {
    it("matches linear fades, Out easing and exact lifetime boundaries", () => {
        const point = createFollowPointConnections(prepare())[0].points[0];
        expect(evaluate(point, point.fadeInTimeMs)).toBeUndefined();
        const middle = evaluate(point, point.fadeInTimeMs + 200)!;
        expect(middle.opacity).toBe(0.5);
        expect(middle.x).toBeCloseTo(point.startX + 0.75 * (point.endX - point.startX));
        expect(middle.scale).toBeCloseTo(point.scale * 1.125);
        expect(evaluate(point, point.fadeInTimeMs + 400)).toMatchObject({x: point.endX, scale: point.scale, opacity: 1});
        expect(evaluate(point, point.fadeOutTimeMs + 200)?.opacity).toBe(0.5);
        expect(evaluate(point, point.fadeOutTimeMs + 400)).toBeUndefined();
        expect(evaluate(point, NaN)).toBeUndefined();
        expect(evaluate(point, point.fadeInTimeMs + 200)).toEqual(middle);
    });

    it("fades from partial opacity when a high-AR entrance is interrupted", () => {
        const point = {...createFollowPointConnections(prepare())[0].points[0], fadeInTimeMs: 1000, fadeOutTimeMs: 1200};
        expect(evaluate(point, 1200)?.opacity).toBe(0.5);
        expect(evaluate(point, 1400)?.opacity).toBe(0.25);
    });

    it("uses the source preempt reduction and does not change fades under Hidden", () => {
        const normal = createFollowPointConnections(prepare());
        const hidden = createFollowPointConnections(prepare(circles, ModBitwise.Hidden));
        expect(hidden).toEqual(normal);
        const prepared = prepare();
        prepared.beatmap.hitObjects[0].timePreempt = StandardHitObject.PREEMPT_MIN / 4;
        const point = createFollowPointConnections(prepared)[0].points[0];
        expect(point.fadeOutTimeMs - point.fadeInTimeMs).toBe(200);
    });

    it("selects lifetimes, reproduces seeks, and disposes independently", () => {
        const connections = createFollowPointConnections(prepare());
        const painter = vi.spyOn(DrawableFollowPoint.prototype, "draw").mockImplementation(() => {});
        const first = new FollowPointRenderer(connections);
        const second = new FollowPointRenderer(connections);
        const ctx = canvas().ctx;
        first.draw(ctx, -10000);
        expect(painter).not.toHaveBeenCalled();
        const capture = () => { const result: FollowPointState[] = []; painter.mockImplementation((_ctx, state) => { result.push({...state}); }); first.draw(ctx, 1000); return result; };
        const expected = capture();
        expect(expected.length).toBeGreaterThan(0);
        first.draw(ctx, 10000);
        expect(capture()).toEqual(expected);
        first.dispose(); first.dispose();
        painter.mockClear();
        first.draw(ctx, 1000);
        expect(painter).not.toHaveBeenCalled();
        second.draw(ctx, 1000);
        expect(painter).toHaveBeenCalled();
        second.dispose();
    });

    it.each([0, ModBitwise.DoubleTime, ModBitwise.HalfTime])("draws behind objects, with correct playback timing and preview offset, mods %s", mods => {
        const events: string[] = [];
        const states: FollowPointState[] = [];
        vi.spyOn(DrawableFollowPoint.prototype, "draw").mockImplementation((_ctx, state) => { events.push("follow"); states.push({...state}); });
        vi.spyOn(DrawableCircle.prototype, "draw").mockImplementation(() => { events.push("object"); });
        vi.spyOn(DrawableApproachCircle.prototype, "draw").mockImplementation(() => { events.push("approach"); });
        vi.spyOn(StandardCursor.prototype, "draw").mockImplementation(() => { events.push("cursor"); });
        const prepared = prepare(circles, mods);
        const renderer = new StandardBeatmapRenderer(canvas().ctx, prepared, {autoplay: true});
        renderer.render(1000 / prepared.clockRate);
        expect(events.indexOf("follow")).toBe(0);
        expect(events.lastIndexOf("follow")).toBeLessThan(events.indexOf("object"));
        expect(events.lastIndexOf("approach")).toBeLessThan(events.indexOf("cursor"));
        const expected = states.map(state => ({...state}));
        states.length = 0;
        const view = new StandardBeatmapPreviewer(canvas().canvas, {useBeatmapPreviewTime: true});
        view.loadPreparedBeatmap(prepared);
        view.render(1000 / prepared.clockRate - 1000);
        expect(states).toEqual(expected);
        renderer.dispose(); view.dispose();
    });

    it("paints the attributed double-chevron outline with isolated additive blending", () => {
        const paths: string[] = [];
        vi.stubGlobal("Path2D", class { constructor(path: string) { paths.push(path); } });
        const surface = canvas();
        const modes: string[] = [];
        vi.spyOn(surface.ctx, "fill").mockImplementation(() => { modes.push(surface.ctx.globalCompositeOperation); });
        const painter = new DrawableFollowPoint();
        painter.draw(surface.ctx, {x: 100, y: 200, rotationRadians: 1, scale: 0.5, opacity: 0.5});
        expect(paths[0]).toContain("M285.476 272.971");
        expect(modes).toEqual(["lighter", "lighter"]);
        expect(surface.ctx.translate).toHaveBeenCalledWith(-6, -4);
        expect(surface.ctx.translate).toHaveBeenCalledWith(1.5, 0);
        expect(surface.ctx.translate).toHaveBeenCalledWith(5.5, 0);
        expect(surface.ctx.scale).toHaveBeenCalledWith(8 / 512, 8 / 512);
        expect(surface.ctx.globalCompositeOperation).toBe("source-over");
        expect(surface.ctx.globalAlpha).toBe(1);
        expect(surface.depth()).toBe(0);
        painter.dispose();
    });

    it("restores painter and preview transforms on drawing errors", () => {
        vi.stubGlobal("Path2D", class {});
        const surface = canvas();
        vi.spyOn(surface.ctx, "fill").mockImplementation(() => { throw new Error("paint failed"); });
        const view = new StandardBeatmapPreviewer(surface.canvas);
        view.loadPreparedBeatmap(prepare());
        expect(() => view.render(1000)).toThrow("paint failed");
        expect(surface.depth()).toBe(0);
        expect(surface.ctx.globalCompositeOperation).toBe("source-over");
        view.dispose();
    });
});
