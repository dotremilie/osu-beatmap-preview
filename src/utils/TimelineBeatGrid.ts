import {TimingPoint} from "osu-classes";

const DEFAULT_TIMING_POINT = new TimingPoint();
const TICK_DIVISORS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 16];

export interface TimelineTick {
    time: number;
    kind: "bar" | "beat" | "subdivision";
    divisor: number;
}

/** Builds a grid in beatmap milliseconds, resetting its phase at each timing point. */
export function getTimelineTicks(
    timingPoints: readonly TimingPoint[],
    startTime: number,
    endTime: number,
    beatSnapDivisor: number,
    minimumInterval = 0,
): TimelineTick[] {
    const ticks: TimelineTick[] = [];
    const points = timingPoints.length ? timingPoints : [DEFAULT_TIMING_POINT];

    let low = 0;
    let high = points.length;
    while (low < high) {
        const middle = (low + high) >>> 1;
        if (points[middle].startTime <= startTime) low = middle + 1;
        else high = middle;
    }
    for (let index = Math.max(0, low - 1); index < points.length; index++) {
        const point = points[index];
        if (index > 0 && point.startTime > endTime) break;
        const nextTime = points[index + 1]?.startTime ?? Infinity;
        const segmentStart = index === 0 ? startTime : Math.max(startTime, point.startTime);
        const segmentEnd = Math.min(endTime, nextTime);

        if (segmentStart > segmentEnd || nextTime <= startTime) continue;

        const beatLength = point.beatLength;
        if (!Number.isFinite(beatLength) || beatLength <= 0) continue;

        const beatsPerBar = Math.max(1, point.timeSignature);
        const ticksPerBar = beatSnapDivisor * beatsPerBar;
        const interval = beatLength / beatSnapDivisor;
        let stride = 1;

        // Keep sparse grids musical: hide subdivisions first, then show whole bars.
        if (interval < minimumInterval) {
            stride = beatLength >= minimumInterval
                ? beatSnapDivisor
                : ticksPerBar * Math.ceil(minimumInterval / (beatLength * beatsPerBar));
        }

        const spacing = interval * stride;
        const firstIndex = Math.ceil((segmentStart - point.startTime) / spacing - 1e-9);
        const count = Math.ceil((segmentEnd - segmentStart) / spacing) + 1;

        for (let offset = 0; offset <= count; offset++) {
            const tickIndex = (firstIndex + offset) * stride;
            const time = point.startTime + tickIndex * interval;
            if (time > segmentEnd + 1e-7 || time >= nextTime - 1e-7) break;

            const tick: TimelineTick = {
                time,
                kind: tickIndex % ticksPerBar === 0 ? "bar"
                    : tickIndex % beatSnapDivisor === 0 ? "beat" : "subdivision",
                divisor: TICK_DIVISORS.find(divisor => (tickIndex % beatSnapDivisor * divisor) % beatSnapDivisor === 0) ?? 0,
            };
            const previous = ticks[ticks.length - 1];
            if (previous && tick.time - previous.time < minimumInterval - 1e-7) {
                const priority = {bar: 2, beat: 1, subdivision: 0};
                if (priority[tick.kind] > priority[previous.kind]) ticks[ticks.length - 1] = tick;
            } else {
                ticks.push(tick);
            }
        }
    }

    return ticks;
}
