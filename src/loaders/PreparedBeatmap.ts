import type {StandardBeatmap} from "osu-standard-stable";

const preparedBrand: unique symbol = Symbol("PreparedBeatmap");
const validHandles = new WeakSet<object>();

/** A library-prepared standard map. Its nested model must be treated as read-only. */
export interface PreparedBeatmap {
    readonly beatmap: Readonly<StandardBeatmap>;
    readonly clockRate: number;
    readonly [preparedBrand]: true;
}

export function createPreparedBeatmap(beatmap: StandardBeatmap): PreparedBeatmap {
    const handle: PreparedBeatmap = Object.freeze({beatmap, clockRate: beatmap.difficulty.clockRate, [preparedBrand]: true as const});
    validHandles.add(handle);
    return handle;
}

export function assertPreparedBeatmap(value: unknown): asserts value is PreparedBeatmap {
    if (typeof value !== "object" || value === null || !validHandles.has(value)) {
        throw new TypeError("Expected a PreparedBeatmap returned by BeatmapLoader or a previewer");
    }
}
