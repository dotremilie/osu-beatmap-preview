// Movement adapted from ppy/osu's OsuAutoGenerator and OsuAutoGeneratorBase.
// Copyright (c) ppy Pty Ltd <contact@ppy.sh>. Licensed under the MIT Licence.
// https://github.com/ppy/osu/blob/master/osu.Game.Rulesets.Osu/Replays/OsuAutoGenerator.cs
import {Slider, Spinner} from "osu-standard-stable";
import type {StandardHitObject} from "osu-standard-stable";
import type {PreparedBeatmap} from "../../loaders/PreparedBeatmap";
import {clamp01, outElasticHalf, outQuad} from "./CursorEasing";

const LEFT_BUTTON = 1;
const RIGHT_BUTTON = 2;
const KEY_UP_DELAY_MS = 50;
const REACTION_PLAYBACK_MS = 100;
const ALTERNATING_PLAYBACK_MS = 266;
const PRESS_ANIMATION_PLAYBACK_MS = 400;
const SPINNER_CENTRE = {x: 256, y: 192};
const SPIN_RADIUS = 50;
const SPIN_RADIANS_PER_PLAYBACK_MS = 0.05;

export interface CursorFrame {
    readonly timeMs: number;
    readonly x: number;
    readonly y: number;
    readonly actions: number;
}

export interface CursorState { x: number; y: number; scale: number; actions: number; }
interface MutableFrame { timeMs: number; x: number; y: number; actions: number; released?: boolean; }
interface PressTransform { timeMs: number; fromScale: number; pressed: boolean; }

/** Returns the first item strictly after the supplied time, including equal-time ties. */
function upperBound<T extends {readonly timeMs: number}>(items: readonly T[], timeMs: number): number {
    let low = 0;
    let high = items.length;
    while (low < high) {
        const middle = (low + high) >>> 1;
        if (items[middle].timeMs <= timeMs) low = middle + 1;
        else high = middle;
    }
    return low;
}

function transformScale(transform: PressTransform, timeMs: number, clockRate: number): number {
    const progress = clamp01((timeMs - transform.timeMs) / (PRESS_ANIMATION_PLAYBACK_MS * clockRate));
    return transform.pressed
        ? 1 + 0.2 * outElasticHalf(progress)
        : transform.fromScale + (1 - transform.fromScale) * outQuad(progress);
}

/** Immutable replay data. Evaluation is independent of render order and elapsed frames. */
export default class StandardReplay {
    public readonly frames: readonly CursorFrame[];
    private readonly transforms: readonly Readonly<PressTransform>[];

    constructor(frames: readonly CursorFrame[], private readonly clockRate: number) {
        this.frames = Object.freeze(frames.map(frame => Object.freeze({...frame})));
        const transforms: PressTransform[] = [];
        let previousActions = 0;
        for (const frame of this.frames) {
            const pressed = (frame.actions & ~previousActions) !== 0;
            if (pressed || (frame.actions === 0 && previousActions !== 0)) {
                const previous = transforms[transforms.length - 1];
                transforms.push({timeMs: frame.timeMs, pressed,
                    fromScale: previous ? transformScale(previous, frame.timeMs, clockRate) : 1});
            }
            previousActions = frame.actions;
        }
        this.transforms = Object.freeze(transforms.map(transform => Object.freeze(transform)));
        Object.freeze(this);
    }

    public sample(beatmapTimeMs: number, state: CursorState): boolean {
        if (this.frames.length === 0 || !Number.isFinite(beatmapTimeMs)) return false;
        const index = upperBound(this.frames, beatmapTimeMs) - 1;
        const from = this.frames[Math.max(0, index)];
        const to = this.frames[Math.min(this.frames.length - 1, index + 1)];
        const progress = from === to ? 0 : clamp01((beatmapTimeMs - from.timeMs) / (to.timeMs - from.timeMs));
        state.x = from.x + (to.x - from.x) * progress;
        state.y = from.y + (to.y - from.y) * progress;
        state.actions = index < 0 ? 0 : from.actions;
        const transformIndex = upperBound(this.transforms, beatmapTimeMs) - 1;
        state.scale = transformIndex < 0 ? 1 : transformScale(this.transforms[transformIndex], beatmapTimeMs, this.clockRate);
        return true;
    }
}

/** Builder follows osu!'s ordinary autoplay; delayed Autopilot movement is excluded. */
class StandardAutoGenerator {
    private readonly frames: MutableFrame[] = [];
    private buttonIndex = 0;
    private readonly frameDelayMs: number;

    constructor(private readonly prepared: PreparedBeatmap) {
        this.frameDelayMs = 1000 / 60 * prepared.clockRate;
    }

    public generate(): StandardReplay {
        const objects = this.prepared.beatmap.hitObjects;
        if (objects.length > 0) {
            this.add({timeMs: objects[0].startTime - 1500, x: 256, y: 500, actions: 0});
            for (const object of objects) this.addObject(object);
        }
        return new StandardReplay(this.frames, this.prepared.clockRate);
    }

    private add(frame: MutableFrame): void {
        this.frames.splice(upperBound(this.frames, frame.timeMs), 0, frame);
    }

    private addObject(object: StandardHitObject): void {
        if (object instanceof Spinner && object.spinsRequired === 0) return;
        const last = this.frames[this.frames.length - 1];
        const spinner = object instanceof Spinner ? this.spinnerEntry(last) : undefined;
        const position = spinner ?? object.stackedStartPosition;
        this.moveTo(object, position, spinner?.outside ?? false);
        this.addTracking(object, position, spinner?.direction ?? -1);
    }

    private moveTo(object: StandardHitObject, target: {x: number; y: number}, easeIn: boolean): void {
        let last = this.frames[this.frames.length - 1];
        const waitTimeMs = object.startTime - Math.max(0, object.timePreempt - REACTION_PLAYBACK_MS * this.prepared.clockRate);
        const hasWaited = waitTimeMs > last.timeMs;
        if (hasWaited) {
            last = {...last, timeMs: waitTimeMs, released: false};
            this.add(last);
        }
        const differencePlaybackMs = (object.startTime - last.timeMs) / this.prepared.clockRate;
        const ease = (progress: number) => easeIn ? progress * progress : outQuad(progress);
        if (differencePlaybackMs >= 0) {
            const previous = this.frames[this.frames.length - 2];
            if (previous && last.released && !hasWaited && object.startTime > previous.timeMs) {
                const progress = ease(clamp01((last.timeMs - previous.timeMs) / (object.startTime - previous.timeMs)));
                last.x += (target.x - last.x) * progress;
                last.y += (target.y - last.y) * progress;
            }
            for (let timeMs = last.timeMs + this.frameDelayMs; timeMs < object.startTime; timeMs += this.frameDelayMs) {
                const progress = ease(clamp01((timeMs - last.timeMs) / (object.startTime - last.timeMs)));
                this.add({timeMs: Math.floor(timeMs), x: last.x + (target.x - last.x) * progress,
                    y: last.y + (target.y - last.y) * progress, actions: last.actions});
            }
        }
        this.buttonIndex = differencePlaybackMs >= 0 && differencePlaybackMs < ALTERNATING_PLAYBACK_MS ? this.buttonIndex + 1 : 0;
    }

    private addTracking(object: StandardHitObject, start: {x: number; y: number}, direction: number): void {
        const objectEndMs = object instanceof Slider || object instanceof Spinner ? object.endTime : object.startTime;
        const endTimeMs = objectEndMs + KEY_UP_DELAY_MS + (object instanceof Spinner ? 1 : 0);
        let actions = this.buttonIndex % 2 === 0 ? LEFT_BUTTON : RIGHT_BUTTON;
        const previousIndex = upperBound(this.frames, object.startTime) - 1;
        const previous = this.frames[previousIndex];
        if (previous?.actions) {
            if (previous.actions & actions) actions = actions === LEFT_BUTTON ? RIGHT_BUTTON : LEFT_BUTTON;
            const endIndex = upperBound(this.frames, endTimeMs);
            this.frames.splice(previousIndex + 1, Math.max(0, endIndex - previousIndex - 1));
            for (let index = previousIndex + 1; index < this.frames.length; index++) {
                const frame = this.frames[index];
                if (index < this.frames.length - 1 || frame.actions === previous.actions) frame.actions = actions;
            }
        }
        this.add({timeMs: object.startTime, x: start.x, y: start.y, actions});
        let endPosition: {x: number; y: number} = object.stackedEndPosition;
        if (object instanceof Slider) {
            for (let elapsedMs = this.frameDelayMs; elapsedMs < object.duration; elapsedMs += this.frameDelayMs) {
                const point = object.path.positionAt(object.path.progressAt(elapsedMs / object.duration, object.spans));
                this.add({timeMs: object.startTime + elapsedMs, x: object.stackedStartPosition.x + point.x,
                    y: object.stackedStartPosition.y + point.y, actions});
            }
            this.add({timeMs: object.endTime, x: endPosition.x, y: endPosition.y, actions});
        } else if (object instanceof Spinner) {
            const startAngle = Math.atan2(start.y - SPINNER_CENTRE.y, start.x - SPINNER_CENTRE.x);
            const at = (timeMs: number) => {
                const angle = startAngle + (timeMs - object.startTime) / this.prepared.clockRate * direction * SPIN_RADIANS_PER_PLAYBACK_MS;
                return {x: SPINNER_CENTRE.x + Math.cos(angle) * SPIN_RADIUS, y: SPINNER_CENTRE.y + Math.sin(angle) * SPIN_RADIUS};
            };
            for (let timeMs = object.startTime + this.frameDelayMs; timeMs < object.endTime; timeMs += this.frameDelayMs) {
                this.add({timeMs: Math.floor(timeMs), ...at(timeMs), actions});
            }
            const end = at(object.endTime);
            this.add({timeMs: object.endTime, ...end, actions});
            // Only primitives are copied; the prepared model is never updated.
            endPosition = end;
        }
        if (this.frames[this.frames.length - 1].timeMs <= endTimeMs) {
            this.add({timeMs: endTimeMs, x: endPosition.x, y: endPosition.y, actions: 0, released: true});
        }
    }

    private spinnerEntry(previous: {x: number; y: number}): {x: number; y: number; direction: number; outside: boolean} {
        const x = SPINNER_CENTRE.x - previous.x;
        const y = SPINNER_CENTRE.y - previous.y;
        const distance = Math.hypot(x, y);
        if (distance > SPIN_RADIUS) {
            const angle = Math.asin(SPIN_RADIUS / distance);
            const tangentDistance = Math.sqrt(distance * distance - SPIN_RADIUS * SPIN_RADIUS);
            return {x: previous.x + (x * Math.cos(angle) - y * Math.sin(angle)) / distance * tangentDistance,
                y: previous.y + (x * Math.sin(angle) + y * Math.cos(angle)) / distance * tangentDistance,
                direction: -1, outside: true};
        }
        return distance > 0
            ? {x: SPINNER_CENTRE.x - x / distance * SPIN_RADIUS, y: SPINNER_CENTRE.y - y / distance * SPIN_RADIUS, direction: 1, outside: false}
            : {x: SPINNER_CENTRE.x, y: SPINNER_CENTRE.y - SPIN_RADIUS, direction: 1, outside: false};
    }
}

const replayCache = new WeakMap<PreparedBeatmap, StandardReplay>();

export function getAutoplayReplay(prepared: PreparedBeatmap): StandardReplay {
    let replay = replayCache.get(prepared);
    if (!replay) {
        replay = new StandardAutoGenerator(prepared).generate();
        replayCache.set(prepared, replay);
    }
    return replay;
}
