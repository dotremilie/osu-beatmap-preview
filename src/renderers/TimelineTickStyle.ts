import {TimelineTick} from "../utils/TimelineBeatGrid";

const TICK_COLORS: Readonly<Record<number, string>> = {
    1: "#ffffff",
    2: "#ed1121",
    3: "#8866ee",
    4: "#66ccff",
    5: "#b3d944",
    6: "#eeaa00",
    7: "#b3d944",
    8: "#ffcc22",
    9: "#b3d944",
    12: "#cc6600",
    16: "#6644cc",
};

/** Combines osu!lazer's divisor colors with a compact, bottom-aligned ruler. */
export function getTimelineTickStyle(tick: TimelineTick) {
    const {divisor} = tick;
    const heightRatio = tick.kind === "bar" ? 1
        : divisor === 1 || divisor === 2 ? 0.9
        : divisor === 3 || divisor === 4 ? 0.8
        : divisor === 6 || divisor === 8 ? 0.7 : 0.6;

    return {
        color: TICK_COLORS[divisor] ?? "#ff0000",
        width: tick.kind === "bar" ? 2 : 1,
        height: 10 * heightRatio,
    };
}
