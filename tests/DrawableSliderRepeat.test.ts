import {describe, expect, it, vi} from "vitest";
import {Color4, PathPoint, Vector2} from "osu-classes";
import {Slider, SliderRepeat} from "osu-standard-stable";
import {DrawableSlider} from "../src/drawables/standard/DrawableSlider";
import {DrawableSliderRepeat} from "../src/drawables/standard/DrawableSliderRepeat";

function createSliderWithRepeat(): {slider: Slider; repeat: SliderRepeat} {
    const slider = new Slider();
    slider.startTime = 0;
    slider.startPosition = new Vector2(100, 100);
    slider.path.controlPoints = [
        new PathPoint(new Vector2(0, 0)),
        new PathPoint(new Vector2(100, 0)),
    ];
    slider.path.expectedDistance = 100;
    slider.velocity = 0.1;
    slider.repeats = 1;

    const repeat = new SliderRepeat(slider);
    repeat.repeatIndex = 0;
    repeat.startTime = 1000;
    repeat.startPosition = new Vector2(200, 100);
    repeat.timePreempt = 500;
    slider.nestedHitObjects = [repeat];

    return {slider, repeat};
}

describe("DrawableSliderRepeat", () => {
    it("creates and parents every nested slider repeat", () => {
        const {slider, repeat} = createSliderWithRepeat();
        const drawableSlider = new DrawableSlider(slider, new Color4(18, 124, 255));

        expect(drawableSlider.sliderRepeats).toHaveLength(1);
        expect(drawableSlider.sliderRepeats[0].hitObject).toBe(repeat);
        expect(drawableSlider.sliderRepeats[0].parentHitObject).toBe(drawableSlider);
    });

    it("uses the Argon fade and hit scale timings", () => {
        const {repeat} = createSliderWithRepeat();
        const drawableRepeat = new DrawableSliderRepeat(repeat);
        const hiddenRepeat = new DrawableSliderRepeat(repeat, true);

        expect(drawableRepeat.opacity(500)).toBe(0);
        expect(drawableRepeat.opacity(575)).toBeCloseTo(0.5);
        expect(drawableRepeat.opacity(1000)).toBe(1);
        expect(drawableRepeat.opacity(1150)).toBeCloseTo(0.25);
        expect(drawableRepeat.opacity(1300)).toBe(0);
        expect(hiddenRepeat.opacity(999)).toBe(1);
        expect(hiddenRepeat.opacity(1001)).toBe(0);

        expect(drawableRepeat.scale(1000)).toBe(1);
        expect(drawableRepeat.scale(1150)).toBeCloseTo(1.375);
        expect(drawableRepeat.scale(1300)).toBe(1.5);
    });

    it("renders the Argon edge piece pointing back into the slider path", () => {
        const {slider} = createSliderWithRepeat();
        const drawableSlider = new DrawableSlider(slider, new Color4(18, 124, 255));
        const gradient = {addColorStop: vi.fn()};
        const ctx = {
            globalAlpha: 1,
            save: vi.fn(),
            restore: vi.fn(),
            translate: vi.fn(),
            rotate: vi.fn(),
            scale: vi.fn(),
            beginPath: vi.fn(),
            rect: vi.fn(),
            clip: vi.fn(),
            arc: vi.fn(),
            createLinearGradient: vi.fn(() => gradient),
            fill: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            stroke: vi.fn(),
        } as unknown as CanvasRenderingContext2D;

        drawableSlider.sliderRepeats[0].draw(ctx, 750);

        expect(ctx.rotate).toHaveBeenCalledWith(Math.PI);
        const edgeRadius = 32 * (1 - 8 / 58);
        expect(ctx.rect).toHaveBeenCalledWith(-edgeRadius, -edgeRadius, edgeRadius, edgeRadius * 2);
        expect(ctx.createLinearGradient).toHaveBeenCalledWith(-edgeRadius, 0, 0, 0);
        expect(ctx.createLinearGradient).toHaveBeenCalledOnce();
        expect(gradient.addColorStop).toHaveBeenCalledTimes(2);
        expect(ctx.stroke).toHaveBeenCalledTimes(4);
    });

    it("draws repeats above the slider body and below the ball and head", () => {
        const {slider} = createSliderWithRepeat();
        const drawableSlider = new DrawableSlider(slider, new Color4(18, 124, 255));
        const bodyDraw = vi.spyOn(drawableSlider.sliderBody, "draw").mockImplementation(() => undefined);
        const repeatDraw = vi.spyOn(drawableSlider.sliderRepeats[0], "draw").mockImplementation(() => undefined);
        const ballDraw = vi.spyOn(drawableSlider.sliderBall, "draw").mockImplementation(() => undefined);
        const headDraw = vi.spyOn(drawableSlider.sliderHead, "draw").mockImplementation(() => undefined);

        drawableSlider.draw({} as CanvasRenderingContext2D, 750);

        expect(bodyDraw.mock.invocationCallOrder[0]).toBeLessThan(repeatDraw.mock.invocationCallOrder[0]);
        expect(repeatDraw.mock.invocationCallOrder[0]).toBeLessThan(ballDraw.mock.invocationCallOrder[0]);
        expect(ballDraw.mock.invocationCallOrder[0]).toBeLessThan(headDraw.mock.invocationCallOrder[0]);
    });
});
