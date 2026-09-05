import {describe, expect, it} from "vitest";
import {TimelineViewport} from "../src";

describe("TimelineViewport", () => {
    it("configures object radius independently of time mapping", () => {
        expect(new TimelineViewport().objectRadius).toBe(16);
        const viewport = new TimelineViewport({objectRadius: 20});
        expect(viewport.objectRadius).toBe(20);

        viewport.objectRadius = 6.5;
        expect(viewport.objectRadius).toBe(6.5);
        expect(viewport.positionAtTime(11_000, 10_000, 800)).toBe(600);
        expect(viewport.timeRange).toBe(4000);
    });

    it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
        "rejects invalid object radius %s without changing its value",
        (value) => {
            const viewport = new TimelineViewport({objectRadius: 20});
            expect(() => new TimelineViewport({objectRadius: value})).toThrow(RangeError);
            expect(() => { viewport.objectRadius = value; }).toThrow(RangeError);
            expect(viewport.objectRadius).toBe(20);
        },
    );

    it("configures and changes beat snapping independently of zoom", () => {
        expect(new TimelineViewport().beatSnapDivisor).toBe(4);

        const viewport = new TimelineViewport({timeRange: 2000, beatSnapDivisor: 3});
        expect(viewport.beatSnapDivisor).toBe(3);

        viewport.beatSnapDivisor = 16;
        viewport.zoom(2);

        expect(viewport.beatSnapDivisor).toBe(16);
        expect(viewport.timeRange).toBe(1000);
        viewport.beatSnapDivisor = 1;
        expect(viewport.beatSnapDivisor).toBe(1);
    });

    it.each([0, -1, 1.5, 17, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
        "rejects invalid beat snap divisor %s without changing the configuration",
        (value) => {
            const viewport = new TimelineViewport({beatSnapDivisor: 3});

            expect(() => new TimelineViewport({beatSnapDivisor: value})).toThrow(RangeError);
            expect(() => { viewport.beatSnapDivisor = value; }).toThrow(RangeError);
            expect(viewport.beatSnapDivisor).toBe(3);
        },
    );

    it("keeps the supplied time centered while scrolling and zooming", () => {
        const viewport = new TimelineViewport({timeRange: 4000});

        expect(viewport.timeAtPosition(0, 10_000, 800)).toBe(8000);
        expect(viewport.timeAtPosition(400, 10_000, 800)).toBe(10_000);
        expect(viewport.timeAtPosition(800, 10_000, 800)).toBe(12_000);
        expect(viewport.positionAtTime(11_000, 10_000, 800)).toBe(600);

        viewport.zoom(2);

        expect(viewport.timeAtPosition(400, 10_000, 800)).toBe(10_000);
        expect(viewport.positionAtTime(11_000, 10_000, 800)).toBe(800);
        expect(viewport.positionAtTime(11_000, 11_000, 800)).toBe(400);
    });

    it("round trips pointer coordinates across widths and zoom levels", () => {
        const viewport = new TimelineViewport();

        for (const timeRange of [250, 4000, 60_000]) {
            viewport.timeRange = timeRange;

            for (const width of [320, 800, 1280]) {
                for (const position of [0, width / 3, width / 2, width]) {
                    const time = viewport.timeAtPosition(position, 12_345, width);

                    expect(viewport.positionAtTime(time, 12_345, width)).toBeCloseTo(position);
                }
            }
        }
    });

    it("clamps extreme positive zooms and ranges to usable limits", () => {
        const viewport = new TimelineViewport({timeRange: 1});

        expect(viewport.timeRange).toBe(250);
        viewport.timeRange = 100_000;
        expect(viewport.timeRange).toBe(60_000);
        viewport.zoom(Number.MAX_VALUE);
        expect(viewport.timeRange).toBe(250);
        viewport.zoom(Number.MIN_VALUE);
        expect(viewport.timeRange).toBe(60_000);
    });

    it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
        "rejects invalid range or zoom %s without changing the view",
        (value) => {
            const viewport = new TimelineViewport({timeRange: 2000});

            expect(() => new TimelineViewport({timeRange: value})).toThrow(RangeError);
            expect(() => { viewport.timeRange = value; }).toThrow(RangeError);
            expect(() => viewport.zoom(value)).toThrow(RangeError);
            expect(viewport.timeRange).toBe(2000);
        },
    );
});
