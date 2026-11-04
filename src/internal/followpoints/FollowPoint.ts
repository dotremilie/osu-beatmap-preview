import {Slider, Spinner, StandardHitObject} from "osu-standard-stable";
import type {PreparedBeatmap} from "../../loaders/PreparedBeatmap";
import type {TimeInterval} from "../../utils/TimeIntervalIndex";

export const FOLLOW_POINT_FADE_MS = 400;
const SPACING = 32;
const PREEMPT_MS = 800;

export interface FollowPoint {
    readonly startX: number;
    readonly startY: number;
    readonly endX: number;
    readonly endY: number;
    readonly rotationRadians: number;
    readonly scale: number;
    readonly fadeInTimeMs: number;
    readonly fadeOutTimeMs: number;
}

export interface FollowPointConnection extends TimeInterval {
    readonly points: readonly FollowPoint[];
}

export interface FollowPointState {
    x: number;
    y: number;
    rotationRadians: number;
    scale: number;
    opacity: number;
}

export function createFollowPointConnections(prepared: PreparedBeatmap): readonly FollowPointConnection[] {
    const objects = [...prepared.beatmap.hitObjects].sort((a, b) => a.startTime - b.startTime);
    const connections: FollowPointConnection[] = [];
    for (let index = 1; index < objects.length; index++) {
        const start = objects[index - 1];
        const end = objects[index];
        if (end.isNewCombo || start instanceof Spinner || end instanceof Spinner) continue;
        const startPosition = start.stackedEndPosition;
        const endPosition = end.stackedStartPosition;
        const deltaX = endPosition.x - startPosition.x;
        const deltaY = endPosition.y - startPosition.y;
        const distance = Math.trunc(Math.hypot(deltaX, deltaY));
        if (!Number.isFinite(distance) || distance <= SPACING * 2.5) continue;
        const preemptMs = PREEMPT_MS * Math.min(1, start.timePreempt / StandardHitObject.PREEMPT_MIN);
        const startEndTimeMs = start instanceof Slider ? start.endTime : start.startTime;
        const durationMs = end.startTime - startEndTimeMs;
        const points: FollowPoint[] = [];
        for (let offset = SPACING * 1.5; offset < distance - SPACING; offset += SPACING) {
            const fraction = offset / distance;
            const fadeOutTimeMs = startEndTimeMs + fraction * durationMs;
            points.push(Object.freeze({
                startX: startPosition.x + (fraction - 0.1) * deltaX,
                startY: startPosition.y + (fraction - 0.1) * deltaY,
                endX: startPosition.x + fraction * deltaX,
                endY: startPosition.y + fraction * deltaY,
                rotationRadians: Math.atan2(deltaY, deltaX),
                scale: end.scale,
                fadeInTimeMs: fadeOutTimeMs - preemptMs,
                fadeOutTimeMs,
            }));
        }
        connections.push(Object.freeze({
            startTime: Math.min(...points.map(point => point.fadeInTimeMs)),
            endTime: Math.max(...points.map(point => point.fadeOutTimeMs + FOLLOW_POINT_FADE_MS)),
            points: Object.freeze(points),
        }));
    }
    return Object.freeze(connections);
}

/** Pure beatmap-time evaluation, including fades interrupted before full opacity. */
export function evaluateFollowPoint(point: FollowPoint, beatmapTimeMs: number, state: FollowPointState): boolean {
    if (!Number.isFinite(beatmapTimeMs) || beatmapTimeMs <= point.fadeInTimeMs
        || beatmapTimeMs >= point.fadeOutTimeMs + FOLLOW_POINT_FADE_MS) return false;
    const entrance = Math.min(1, (beatmapTimeMs - point.fadeInTimeMs) / FOLLOW_POINT_FADE_MS);
    const easedEntrance = 1 - (1 - entrance) * (1 - entrance);
    const fadeOutProgress = Math.max(0, (beatmapTimeMs - point.fadeOutTimeMs) / FOLLOW_POINT_FADE_MS);
    const peakOpacity = Math.min(1, (point.fadeOutTimeMs - point.fadeInTimeMs) / FOLLOW_POINT_FADE_MS);
    state.x = point.startX + (point.endX - point.startX) * easedEntrance;
    state.y = point.startY + (point.endY - point.startY) * easedEntrance;
    state.scale = point.scale * (1.5 - 0.5 * easedEntrance);
    state.rotationRadians = point.rotationRadians;
    state.opacity = beatmapTimeMs < point.fadeOutTimeMs ? entrance : peakOpacity * (1 - fadeOutProgress);
    return state.opacity > 0;
}
