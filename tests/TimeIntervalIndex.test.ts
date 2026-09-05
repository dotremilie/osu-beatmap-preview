import {describe, expect, it} from "vitest";
import TimeIntervalIndex, {TimeInterval} from "../src/utils/TimeIntervalIndex";

describe("TimeIntervalIndex", () => {
    it("includes both boundaries and long intervals while preserving reverse input order", () => {
        const index = new TimeIntervalIndex([
            {startTime: 100, endTime: 200},
            {startTime: -1000, endTime: 1000},
            {startTime: 50, endTime: 100},
            {startTime: 100, endTime: 100},
            {startTime: 201, endTime: 300},
        ]);
        const output: number[] = [];

        index.query(100, 100, output);
        expect(output).toEqual([3, 2, 1, 0]);
        index.query(200, 201, output);
        expect(output).toEqual([4, 1, 0]);
        index.query(-2000, -1000, output);
        expect(output).toEqual([1]);
        index.query(2000, 3000, output);
        expect(output).toEqual([]);
    });

    it("matches overlap selection for shuffled intervals, changing windows, and seeks in both directions", () => {
        const intervals: TimeInterval[] = Array.from({length: 2000}, (_,index) => ({
            startTime: (index * 137) % 10000 - 1000,
            endTime: (index * 137) % 10000 - 1000 + index % 11 * 150,
        }));
        intervals.push({startTime: -5000, endTime: 20000});
        const index = new TimeIntervalIndex(intervals);
        const output: number[] = [];

        for (let query = 0; query < 100; query++) {
            const startTime = query * 571 % 15000 - 3000;
            const endTime = startTime + query % 7 * 100;
            const expected = intervals.flatMap((interval, index) =>
                interval.startTime <= endTime && interval.endTime >= startTime ? [index] : [],
            ).reverse();

            index.query(startTime, endTime, output);
            expect(output).toEqual(expected);
        }
    });

    it("reuses the output and clears it for empty or invalid queries", () => {
        const index = new TimeIntervalIndex([{startTime: 0, endTime: 100}]);
        const output = [42];

        index.query(0, 100, output);
        expect(output).toEqual([0]);
        index.query(100, 0, output);
        expect(output).toEqual([]);
        index.query(Number.NaN, 100, output);
        expect(output).toEqual([]);
        new TimeIntervalIndex([]).query(0, 100, output);
        expect(output).toEqual([]);
    });
});
