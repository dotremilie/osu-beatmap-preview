import {readFileSync} from "node:fs";
import {ModBitwise} from "osu-classes";
import {BeatmapDecoder} from "osu-parsers";
import {Circle, Slider, Spinner, StandardRuleset} from "osu-standard-stable";
import {afterEach, describe, expect, it, vi} from "vitest";
import {DrawableApproachCircle} from "../src/drawables/standard/DrawableApproachCircle";
import {DrawableCircle} from "../src/drawables/standard/DrawableCircle";
import {DrawableSlider} from "../src/drawables/standard/DrawableSlider";
import {DrawableSpinner} from "../src/drawables/standard/DrawableSpinner";
import {DrawableTimelineHitObject} from "../src/drawables/standard/DrawableTimelineHitObject";
import StandardBeatmapRenderer from "../src/renderers/StandardBeatmapRenderer";
import StandardTimelineRenderer from "../src/renderers/StandardTimelineRenderer";
import TimelineViewport from "../src/utils/TimelineViewport";

const BEATMAP_TEXT = readFileSync(new URL("./fixtures/timeline.osu", import.meta.url), "utf8");

function createBeatmap(mods = 0, text = BEATMAP_TEXT) {
    const ruleset = new StandardRuleset();
    return ruleset.applyToBeatmapWithMods(new BeatmapDecoder().decodeFromString(text), ruleset.createModCombination(mods));
}

function createContext() {
    return {
        save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), rect: vi.fn(), clip: vi.fn(),
        moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), fill: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
}

afterEach(() => vi.restoreAllMocks());

describe("renderer visibility selection", () => {
    it.each([0, ModBitwise.DoubleTime, ModBitwise.HalfTime, ModBitwise.Hidden | ModBitwise.HardRock])(
        "preserves playfield approach and hit lifetimes, layering, and seeks with mods %s",
        mods => {
            const beatmap = createBeatmap(mods);
            const events: string[] = [];
            const drawTimes: number[] = [];
            for (const drawable of [DrawableCircle, DrawableSlider, DrawableSpinner]) {
                vi.spyOn(drawable.prototype, "draw").mockImplementation(function(this: DrawableCircle | DrawableSlider | DrawableSpinner, _ctx, time) {
                    events.push(`object:${this.hitObject.startTime}`);
                    drawTimes.push(time);
                });
            }
            vi.spyOn(DrawableApproachCircle.prototype, "draw").mockImplementation(function(this: DrawableApproachCircle) {
                events.push(`approach:${this.drawableCircle.hitObject.startTime}`);
            });
            const renderer = new StandardBeatmapRenderer(createContext(), beatmap);
            const times = beatmap.hitObjects.flatMap(object => {
                const start = object.startTime - object.timePreempt;
                const hitDuration = object instanceof Spinner
                    ? Math.max(240, mods & ModBitwise.Hidden ? object.timePreempt * 0.3 : 0)
                    : 150;
                const end = (object instanceof Slider || object instanceof Spinner ? object.endTime : object.startTime)
                    + hitDuration;
                const boundaries = [end + 0.001, start - 0.001, start, end, start + 0.001, end - 0.001];
                if (object instanceof Spinner) boundaries.push(...[150, 239.999, 240, 240.001].map(offset => object.endTime + offset));
                return boundaries;
            });
            times.push(25000, 6000, 1000, 50000, -10000);

            for (const time of times) {
                events.length = 0;
                drawTimes.length = 0;
                const playbackTime = time / beatmap.difficulty.clockRate;
                const renderedTime = playbackTime * beatmap.difficulty.clockRate;
                const visible = beatmap.hitObjects.filter(object =>
                    renderedTime >= object.startTime - object.timePreempt
                    && renderedTime <= (object instanceof Slider || object instanceof Spinner ? object.endTime : object.startTime)
                        + (object instanceof Spinner
                            ? Math.max(240, mods & ModBitwise.Hidden ? object.timePreempt * 0.3 : 0)
                            : 150),
                ).reverse();

                renderer.render(playbackTime);

                expect(events).toEqual([
                    ...visible.map(object => `object:${object.startTime}`),
                    ...visible.filter(object => object instanceof Circle || object instanceof Slider)
                        .map(object => `approach:${object.startTime}`),
                ]);
                expect(drawTimes.every(time => time === renderedTime)).toBe(true);
            }
        },
    );

    it.each([0, ModBitwise.DoubleTime, ModBitwise.HalfTime])(
        "visits only timeline intervals overlapping the padded viewport across seeks and zoom with mods %s",
        mods => {
            const beatmap = createBeatmap(mods);
            const viewport = new TimelineViewport();
            const renderer = new StandardTimelineRenderer(createContext(), beatmap, viewport);
            renderer.resize(800, 40);
            const visibleStarts: number[] = [];
            vi.spyOn(DrawableTimelineHitObject.prototype, "draw").mockImplementation(function(this: DrawableTimelineHitObject) {
                visibleStarts.push(this.startTime);
            });

            for (const [time, range, radius, width] of [
                [6000, 4000, 16, 800], [25000, 1000, 16, 800], [1000, 2000, 32, 1600],
                [50000, 250, 16, 800], [12000, 250, 8, 640], [1000, 60000, 16, 800],
            ]) {
                viewport.timeRange = range;
                viewport.objectRadius = radius;
                renderer.resize(width, 40);
                const playbackTime = time / beatmap.difficulty.clockRate;
                const padding = range / 2 + radius / width * range;
                const expected = beatmap.hitObjects.filter(object => {
                    const start = object.startTime / beatmap.difficulty.clockRate;
                    const end = (object instanceof Slider || object instanceof Spinner ? object.endTime : object.startTime)
                        / beatmap.difficulty.clockRate;
                    return start <= playbackTime + padding && end >= playbackTime - padding;
                }).reverse().map(object => object.startTime / beatmap.difficulty.clockRate);
                visibleStarts.length = 0;

                renderer.render(playbackTime);

                expect(visibleStarts).toEqual(expected);
            }
        },
    );

    it("includes heads exactly at the padded edges and updates selection after radius, zoom, and width changes", () => {
        const circles = [919, 920, 5080, 5081].map(time => `256,192,${time},1,0,0:0:0:0:`).join("\n");
        const beatmap = createBeatmap(0, BEATMAP_TEXT.slice(0, BEATMAP_TEXT.indexOf("[HitObjects]")) + "[HitObjects]\n" + circles);
        const viewport = new TimelineViewport({timeRange: 4000, objectRadius: 16});
        const renderer = new StandardTimelineRenderer(createContext(), beatmap, viewport);
        const visibleStarts: number[] = [];
        vi.spyOn(DrawableTimelineHitObject.prototype, "draw").mockImplementation(function(this: DrawableTimelineHitObject) {
            visibleStarts.push(this.startTime);
        });
        const render = () => {
            visibleStarts.length = 0;
            renderer.render(3000);
            return [...visibleStarts];
        };

        renderer.resize(800, 40);
        expect(render()).toEqual([5080, 920]);
        renderer.objectRadius = 32;
        expect(render()).toEqual([5081, 5080, 920, 919]);
        renderer.resize(1600, 40);
        expect(render()).toEqual([5080, 920]);
        viewport.zoom(2);
        expect(render()).toEqual([]);
        viewport.zoom(0.5);
        expect(render()).toEqual([5080, 920]);
    });
});
