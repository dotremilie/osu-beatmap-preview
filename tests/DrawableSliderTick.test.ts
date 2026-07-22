import {describe, expect, it, vi} from "vitest";
import {Color4, PathPoint, Vector2} from "osu-classes";
import {Slider, SliderRepeat, SliderTick} from "osu-standard-stable";
import {DrawableSlider} from "../src/drawables/standard/DrawableSlider";
import {DrawableSliderTick} from "../src/drawables/standard/DrawableSliderTick";

function createSliderWithTick(includeRepeat = false): {slider: Slider; tick: SliderTick} {
    const slider = new Slider();
    slider.startTime = 0;
    slider.startPosition = new Vector2(100, 100);
    slider.path.controlPoints = [
        new PathPoint(new Vector2(0, 0)),
        new PathPoint(new Vector2(100, 0)),
    ];
    slider.path.expectedDistance = 100;
    slider.velocity = 0.1;
    slider.repeats = includeRepeat ? 1 : 0;

    const tick = new SliderTick();
    tick.startTime = 1000;
    tick.startPosition = new Vector2(150, 100);
    tick.spanIndex = 0;
    tick.spanStartTime = 0;
    tick.timePreempt = 600;
    tick.scale = 0.5;
    slider.nestedHitObjects = [tick];

    if (includeRepeat) {
        const repeat = new SliderRepeat(slider);
        repeat.repeatIndex = 0;
        repeat.startTime = 1000;
        repeat.startPosition = new Vector2(200, 100);
        repeat.timePreempt = 500;
        slider.nestedHitObjects.push(repeat);
    }

    return {slider, tick};
}

describe("DrawableSliderTick", () => {
    it("creates and parents every nested slider tick", () => {
        const {slider, tick} = createSliderWithTick();
        const drawableSlider = new DrawableSlider(slider, new Color4(18, 124, 255));

        expect(drawableSlider.sliderTicks).toHaveLength(1);
        expect(drawableSlider.sliderTicks[0].hitObject).toBe(tick);
        expect(drawableSlider.sliderTicks[0].parentHitObject).toBe(drawableSlider);
    });

    it("uses ppy's fade, elastic appearance, hit scale, and Hidden timings", () => {
        const {tick} = createSliderWithTick();
        const drawableTick = new DrawableSliderTick(tick);
        const hiddenTick = new DrawableSliderTick(tick, true);

        expect(drawableTick.opacity(400)).toBe(0);
        expect(drawableTick.opacity(475)).toBeCloseTo(0.5);
        expect(drawableTick.opacity(1000)).toBe(1);
        expect(drawableTick.opacity(1075)).toBeCloseTo(0.03125);
        expect(drawableTick.opacity(1150)).toBe(0);

        expect(hiddenTick.opacity(550)).toBe(1);
        expect(hiddenTick.opacity(775)).toBeCloseTo(0.5);
        expect(hiddenTick.opacity(1000)).toBe(0);

        expect(drawableTick.scale(400)).toBeCloseTo(0.5);
        expect(drawableTick.scale(1000)).toBeCloseTo(1);
        expect(drawableTick.scale(1075)).toBeCloseTo(1.375);
        expect(drawableTick.scale(1150)).toBeCloseTo(1.5);
    });

    it("renders the hollow Argon score point", () => {
        const {slider} = createSliderWithTick();
        const drawableSlider = new DrawableSlider(slider, new Color4(18, 124, 255));
        const ctx = {
            globalAlpha: 1,
            save: vi.fn(),
            restore: vi.fn(),
            beginPath: vi.fn(),
            arc: vi.fn(),
            stroke: vi.fn(),
        } as unknown as CanvasRenderingContext2D;

        drawableSlider.sliderTicks[0].draw(ctx, 1000);

        expect(ctx.arc).toHaveBeenCalledWith(150, 100, 2.25, 0, Math.PI * 2);
        expect(ctx.lineWidth).toBeCloseTo(1.5);
        expect(ctx.strokeStyle).toBe("rgb(18,124,255)");
        expect(ctx.stroke).toHaveBeenCalledOnce();
    });

    it("draws ticks above the body and below repeats, the ball, and the head", () => {
        const {slider} = createSliderWithTick(true);
        const drawableSlider = new DrawableSlider(slider, new Color4(18, 124, 255));
        const bodyDraw = vi.spyOn(drawableSlider.sliderBody, "draw").mockImplementation(() => undefined);
        const tickDraw = vi.spyOn(drawableSlider.sliderTicks[0], "draw").mockImplementation(() => undefined);
        const repeatDraw = vi.spyOn(drawableSlider.sliderRepeats[0], "draw").mockImplementation(() => undefined);
        const ballDraw = vi.spyOn(drawableSlider.sliderBall, "draw").mockImplementation(() => undefined);
        const headDraw = vi.spyOn(drawableSlider.sliderHead, "draw").mockImplementation(() => undefined);

        drawableSlider.draw({} as CanvasRenderingContext2D, 750);

        expect(bodyDraw.mock.invocationCallOrder[0]).toBeLessThan(tickDraw.mock.invocationCallOrder[0]);
        expect(tickDraw.mock.invocationCallOrder[0]).toBeLessThan(repeatDraw.mock.invocationCallOrder[0]);
        expect(repeatDraw.mock.invocationCallOrder[0]).toBeLessThan(ballDraw.mock.invocationCallOrder[0]);
        expect(ballDraw.mock.invocationCallOrder[0]).toBeLessThan(headDraw.mock.invocationCallOrder[0]);
    });
});
