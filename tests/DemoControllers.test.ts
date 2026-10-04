import {renderPreviewFrame} from "../demo/PreviewFrame";
import {describe, expect, it, vi} from "vitest";
import PlaybackController, {FrameClock} from "../demo/PlaybackController";
import LatestBeatmapLoad from "../demo/LatestBeatmapLoad";
import TimelineInteraction from "../demo/TimelineInteraction";
import type {StandardTimelinePreviewer} from "../src";

function createClock() {
    let time = 0;
    let nextId = 0;
    const pending = new Map<number, FrameRequestCallback>();
    const clock: FrameClock = {
        now: () => time,
        request: callback => { pending.set(++nextId, callback); return nextId; },
        cancel: id => { pending.delete(id); },
    };
    return {clock, pending, frame(now: number) {
        time = now;
        const callbacks = [...pending.values()];
        pending.clear();
        for (const callback of callbacks) callback(time);
    }};
}

describe("demo scheduling", () => {
    it("coalesces seek and zoom invalidations into the latest paused frame", () => {
        const {clock, pending, frame} = createClock();
        const paint = vi.fn();
        const playback = new PlaybackController(paint, vi.fn(), clock);
        playback.load(10000, 0);
        playback.setPlaying(false);
        for (const time of [1000, 2000, 3000]) { playback.seek(time); playback.invalidate(); }
        expect(pending.size).toBe(1);
        frame(16);
        expect(playback.position).toBe(3000);
        expect(paint).toHaveBeenCalledOnce();
        expect(pending.size).toBe(0);
    });

    it("advances by elapsed time, preserves pause position and loops at the end", () => {
        const {clock, pending, frame} = createClock();
        const playback = new PlaybackController(vi.fn(), vi.fn(), clock);
        playback.load(1000, 100);
        frame(50);
        frame(350);
        expect(playback.position).toBe(450);
        playback.setPlaying(false);
        frame(1000);
        expect(playback.position).toBe(450);
        expect(pending.size).toBe(0);
        playback.setPlaying(true);
        frame(1100);
        expect(playback.position).toBe(550);
        frame(1700);
        expect(playback.position).toBe(0);
    });

    it("cancels pending work and ignores invalidations after teardown", () => {
        const {clock, pending, frame} = createClock();
        const paint = vi.fn();
        const playback = new PlaybackController(paint, vi.fn(), clock);
        playback.load(1000, 0);
        playback.dispose();
        playback.dispose();
        playback.invalidate();
        playback.seek(50);
        frame(100);
        expect(pending.size).toBe(0);
        expect(paint).not.toHaveBeenCalled();
    });
});

describe("demo loading", () => {
    it("ignores a slow showcase when a newer local file completes", async () => {
        const loader = new LatestBeatmapLoad();
        let resolve!: (text: string) => void;
        const apply = vi.fn();
        const first = loader.run(() => new Promise<string>(done => { resolve = done; }), apply, vi.fn());
        await loader.run(() => Promise.resolve("local"), apply, vi.fn());
        resolve("showcase");
        await first;
        expect(apply.mock.calls).toEqual([["local"]]);
    });

    it("reports current failures, suppresses stale failures and ignores completion after disposal", async () => {
        const loader = new LatestBeatmapLoad();
        const apply = vi.fn();
        const failed = vi.fn();
        await loader.run(() => Promise.resolve("current"), apply, failed);
        await loader.run(() => Promise.reject(new Error("read failed")), apply, failed);
        expect(apply.mock.calls).toEqual([["current"]]);
        expect(failed).toHaveBeenCalledOnce();
        let reject!: (error: Error) => void;
        const stale = loader.run(() => new Promise<string>((_, done) => { reject = done; }), apply, failed);
        await loader.run(() => Promise.resolve("newer"), apply, failed);
        reject(new Error("stale"));
        await stale;
        expect(failed).toHaveBeenCalledOnce();
        loader.dispose();
        await loader.run(() => Promise.resolve("disposed"), apply, failed);
        expect(apply.mock.calls).toEqual([["current"], ["newer"]]);
    });
});

describe("timeline interaction ownership", () => {
    it.each([true, false])("restores pre-drag playback %s and removes listeners on disposal", wasPlaying => {
        class Canvas extends EventTarget {
            dataset: Record<string, string> = {};
            captured = false;
            getBoundingClientRect() { return {width: 640, left: 0}; }
            setPointerCapture() { this.captured = true; }
            hasPointerCapture() { return this.captured; }
            releasePointerCapture() { this.captured = false; }
            focus() {}
        }
        const canvas = new Canvas();
        const {clock, frame} = createClock();
        const playback = new PlaybackController(vi.fn(), vi.fn(), clock);
        playback.load(10000, 5000);
        playback.setPlaying(wasPlaying);
        frame(0);
        const timeline = {timeRange: 4000, timeAtPosition: (x: number, time: number) => time + (x / 640 - 0.5) * 4000};
        const input = new TimelineInteraction(canvas as unknown as HTMLCanvasElement, timeline as StandardTimelinePreviewer, playback, 640, vi.fn());
        const pointer = (type: string, clientX: number) => {
            const event = Object.assign(new Event(type, {cancelable: true}), {button: 0, pointerId: 1, clientX});
            canvas.dispatchEvent(event);
        };
        pointer("pointerdown", 320);
        expect(playback.playing).toBe(false);
        pointer("pointermove", 480);
        expect(playback.position).toBe(4000);
        pointer("pointerup", 480);
        expect(playback.playing).toBe(wasPlaying);
        expect(canvas.captured).toBe(false);
        input.dispose();
        pointer("pointerdown", 320);
        expect(canvas.captured).toBe(false);
    });
});

describe("fullscreen frame composition", () => {
    it("skips the hidden timeline and refreshes it at current time on exit", () => {
        const playfield = {render: vi.fn()};
        const timeline = {render: vi.fn()};
        renderPreviewFrame(playfield, timeline, 1000, false);
        renderPreviewFrame(playfield, timeline, 2000, true);
        renderPreviewFrame(playfield, timeline, 3000, false);
        expect(playfield.render.mock.calls).toEqual([[1000], [2000], [3000]]);
        expect(timeline.render.mock.calls).toEqual([[1000], [3000]]);
    });
});
