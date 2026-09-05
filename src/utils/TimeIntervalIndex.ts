export interface TimeInterval {
    startTime: number;
    endTime: number;
}

interface IndexedInterval extends TimeInterval {
    index: number;
}

interface IntervalNode extends IndexedInterval {
    maximumEndTime: number;
    left?: IntervalNode;
    right?: IntervalNode;
}

/** An immutable interval tree for selecting overlapping objects without scanning the beatmap. */
export default class TimeIntervalIndex {
    private readonly root?: IntervalNode;

    constructor(intervals: readonly TimeInterval[]) {
        const sorted = intervals.map((interval, index) => ({...interval, index}))
            .sort((a, b) => a.startTime - b.startTime);
        this.root = this.build(sorted, 0, sorted.length);
    }

    /** Replaces the output with overlapping indices in reverse original order, including both boundaries. */
    public query(startTime: number, endTime: number, output: number[]): void {
        output.length = 0;
        if (startTime > endTime || Number.isNaN(startTime) || Number.isNaN(endTime)) return;

        this.collect(this.root, startTime, endTime, output);
        output.sort((a, b) => b - a);
    }

    private build(intervals: readonly IndexedInterval[], start: number, end: number): IntervalNode | undefined {
        if (start >= end) return undefined;

        const middle = Math.floor((start + end) / 2);
        const interval = intervals[middle];
        const left = this.build(intervals, start, middle);
        const right = this.build(intervals, middle + 1, end);

        return {
            ...interval,
            maximumEndTime: Math.max(interval.endTime, left?.maximumEndTime ?? -Infinity, right?.maximumEndTime ?? -Infinity),
            left,
            right,
        };
    }

    private collect(node: IntervalNode | undefined, startTime: number, endTime: number, output: number[]): void {
        if (!node || node.maximumEndTime < startTime) return;

        if (node.startTime <= endTime) {
            this.collect(node.right, startTime, endTime, output);
            if (node.endTime >= startTime) output.push(node.index);
        }

        this.collect(node.left, startTime, endTime, output);
    }
}
