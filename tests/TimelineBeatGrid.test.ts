import {ControlPointGroup, TimingPoint, TimeSignature} from "osu-classes";
import {describe, expect, it, vi} from "vitest";
import {getTimelineTicks} from "../src/utils/TimelineBeatGrid";

function timingPoint(startTime: number, beatLength: number, timeSignature = TimeSignature.SimpleQuadruple) {
    const point = new TimingPoint(new ControlPointGroup(startTime));
    point.beatLength = beatLength;
    point.timeSignature = timeSignature;

    return point;
}

describe("TimelineBeatGrid", () => {
    it.each([
        [6, [1, 6, 3, 2, 3, 6]],
        [12, [1, 12, 6, 4, 3, 12, 2, 12, 3, 4, 6, 12]],
        [16, [1, 16, 8, 16, 4, 16, 8, 16, 2, 16, 8, 16, 4, 16, 8, 16]],
    ])("classifies subdivisions at snap divisor %s consistently before and after the timing offset", (divisor, expected) => {
        const point = timingPoint(250, 480);
        const forward = getTimelineTicks([point], 250, 729, divisor);
        const backward = getTimelineTicks([point], -230, 249, divisor);

        expect(forward.map(tick => tick.divisor)).toEqual(expected);
        expect(backward.map(tick => tick.divisor)).toEqual(expected);
    });

    it("anchors subdivisions and bars to the timing offset", () => {
        const ticks = getTimelineTicks([timingPoint(250, 500)], 250, 1250, 4);

        expect(ticks).toEqual([
            {time: 250, kind: "bar", divisor: 1},
            {time: 375, kind: "subdivision", divisor: 4},
            {time: 500, kind: "subdivision", divisor: 2},
            {time: 625, kind: "subdivision", divisor: 4},
            {time: 750, kind: "beat", divisor: 1},
            {time: 875, kind: "subdivision", divisor: 4},
            {time: 1000, kind: "subdivision", divisor: 2},
            {time: 1125, kind: "subdivision", divisor: 4},
            {time: 1250, kind: "beat", divisor: 1},
        ]);
    });

    it("extends the first timing point backward through negative time", () => {
        const ticks = getTimelineTicks([timingPoint(250, 500)], -1750, 0, 1);

        expect(ticks).toEqual([
            {time: -1750, kind: "bar", divisor: 1},
            {time: -1250, kind: "beat", divisor: 1},
            {time: -750, kind: "beat", divisor: 1},
            {time: -250, kind: "beat", divisor: 1},
        ]);
    });

    it("resets BPM and measure counting at each timing point", () => {
        const points = [timingPoint(250, 500), timingPoint(1250, 400, TimeSignature.SimpleTriple)];
        const ticks = getTimelineTicks(points, 250, 2850, 1);

        expect(ticks).toEqual([
            {time: 250, kind: "bar", divisor: 1},
            {time: 750, kind: "beat", divisor: 1},
            {time: 1250, kind: "bar", divisor: 1},
            {time: 1650, kind: "beat", divisor: 1},
            {time: 2050, kind: "beat", divisor: 1},
            {time: 2450, kind: "bar", divisor: 1},
            {time: 2850, kind: "beat", divisor: 1},
        ]);
    });

    it("ends the old grid at a timing change that falls between its beats", () => {
        const points = [timingPoint(250, 500), timingPoint(1130, 400)];

        expect(getTimelineTicks(points, 1000, 1950, 1)).toEqual([
            {time: 1130, kind: "bar", divisor: 1},
            {time: 1530, kind: "beat", divisor: 1},
            {time: 1930, kind: "beat", divisor: 1},
        ]);
    });

    it("supports triplet snapping without shifting whole beats", () => {
        const ticks = getTimelineTicks([timingPoint(130, 600)], 130, 1330, 3);

        expect(ticks).toEqual([
            {time: 130, kind: "bar", divisor: 1},
            {time: 330, kind: "subdivision", divisor: 3},
            {time: 530, kind: "subdivision", divisor: 3},
            {time: 730, kind: "beat", divisor: 1},
            {time: 930, kind: "subdivision", divisor: 3},
            {time: 1130, kind: "subdivision", divisor: 3},
            {time: 1330, kind: "beat", divisor: 1},
        ]);
    });

    it("keeps fractional subdivisions on the same beat grid while scrolling", () => {
        const points = [timingPoint(137, 500)];
        const fullTicks = getTimelineTicks(points, 137, 2137, 3);
        const visibleTicks = getTimelineTicks(points, 800, 1800, 3);

        expect(visibleTicks).toEqual(fullTicks.filter(tick => tick.time >= 800 && tick.time <= 1800));
        expect(visibleTicks.some(tick => tick.time === 1137 && tick.kind === "beat")).toBe(true);
        expect(visibleTicks.some(tick => tick.time === 1637 && tick.kind === "beat")).toBe(true);
    });

    it("uses the default timing point when a beatmap has none", () => {
        const ticks = getTimelineTicks([], 0, TimingPoint.DEFAULT_BEAT_LENGTH, 1);

        expect(ticks).toEqual([
            {time: 0, kind: "bar", divisor: 1},
            {time: TimingPoint.DEFAULT_BEAT_LENGTH, kind: "beat", divisor: 1},
        ]);
    });

    it("suppresses dense subdivisions while keeping the BPM and timing offset", () => {
        const ticks = getTimelineTicks([timingPoint(250, 500)], 250, 2250, 8, 200);

        expect(ticks).toEqual([
            {time: 250, kind: "bar", divisor: 1},
            {time: 750, kind: "beat", divisor: 1},
            {time: 1250, kind: "beat", divisor: 1},
            {time: 1750, kind: "beat", divisor: 1},
            {time: 2250, kind: "bar", divisor: 1},
        ]);
    });

    it("coarsens a zoomed-out ruler using whole measures", () => {
        const ticks = getTimelineTicks([timingPoint(250, 500)], 250, 6250, 4, 1500);

        expect(ticks.length).toBeGreaterThan(1);
        expect(ticks[0]).toEqual({time: 250, kind: "bar", divisor: 1});
        expect(ticks.every(tick => tick.kind === "bar" && (tick.time - 250) % 2000 === 0)).toBe(true);
        expect(ticks.slice(1).every((tick, index) => tick.time - ticks[index].time >= 1500)).toBe(true);
    });
});

describe("density across timing changes", () => {
    it("bounds a grid with 10,000 closely spaced phase resets", () => {
        const points = Array.from({length: 10000}, (_, index) => timingPoint(index * 2, 500));
        const ticks = getTimelineTicks(points, 0, 20000, 16, 93.75);
        expect(ticks.length).toBeLessThanOrEqual(Math.ceil(20000 / 93.75) + 1);
        for (let index = 1; index < ticks.length; index++) {
            expect(ticks[index].time - ticks[index - 1].time).toBeGreaterThanOrEqual(93.75);
        }
        expect(ticks.every(tick => tick.kind === "bar")).toBe(true);
        expect(ticks[0].time).toBe(0);
    });

    it("retains a stronger nearby tick at its actual time and earlier equal-priority ticks", () => {
        const points = [timingPoint(0, 500), timingPoint(540, 500), timingPoint(550, 500)];
        const ticks = getTimelineTicks(points, 450, 650, 4, 100);
        expect(ticks).toEqual([{time: 540, kind: "bar", divisor: 1}]);
    });

    it("starts from the active segment without visiting earlier timing points", () => {
        const earlier = timingPoint(0, 500);
        const access = vi.spyOn(earlier, "beatLength", "get");
        const points = [earlier, timingPoint(1000, 400), timingPoint(2000, 300)];
        const ticks = getTimelineTicks(points, 2100, 2400, 4);
        expect(access).not.toHaveBeenCalled();
        expect(ticks.every(tick => tick.time >= 2100 && tick.time <= 2400)).toBe(true);
    });
});
