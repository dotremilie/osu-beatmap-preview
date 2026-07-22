import {describe, expect, it, vi} from "vitest";
import {Color4, PathPoint, Vector2} from "osu-classes";
import {Slider, SliderTick} from "osu-standard-stable";
import {DrawableSlider} from "../src/drawables/standard/DrawableSlider";

function createSlider(repeats = 0, withTick = false): Slider {
    const slider = new Slider();
    slider.startTime = 1000;
    slider.startPosition = new Vector2(100, 100);
    slider.path.controlPoints = [
        new PathPoint(new Vector2(0, 0)),
        new PathPoint(new Vector2(100, 0)),
    ];
    slider.path.expectedDistance = 100;
    slider.velocity = 0.1;
    slider.repeats = repeats;
    slider.scale = 0.5;
    slider.nestedHitObjects = [];

    if (withTick) {
        const tick = new SliderTick();
        tick.startTime = 1500;
        tick.startPosition = new Vector2(150, 100);
        tick.timePreempt = 600;
        tick.scale = 0.5;
        slider.nestedHitObjects.push(tick);
    }

    return slider;
}

function createContext(): {
    ctx: CanvasRenderingContext2D;
    gradientStops: Array<[number, string]>;
    strokes: Array<{lineWidth: number; strokeStyle: string | CanvasGradient | CanvasPattern}>;
} {
    const gradientStops: Array<[number, string]> = [];
    const gradient = {
        addColorStop: vi.fn((offset: number, color: string) => gradientStops.push([offset, color])),
    } as unknown as CanvasGradient;
    const strokes: Array<{lineWidth: number; strokeStyle: string | CanvasGradient | CanvasPattern}> = [];
    const ctx = {
        globalAlpha: 1,
        globalCompositeOperation: "source-over" as GlobalCompositeOperation,
        lineWidth: 0,
        strokeStyle: "",
        save: vi.fn(),
        restore: vi.fn(),
        createLinearGradient: vi.fn(() => gradient),
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(() => strokes.push({
            lineWidth: ctx.lineWidth,
            strokeStyle: ctx.strokeStyle,
        })),
        translate: vi.fn(),
        rotate: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    return {ctx, gradientStops, strokes};
}

describe("DrawableSliderBall", () => {
    it("uses Argon's entrance, exit, and follow-circle timings", () => {
        const drawable = new DrawableSlider(createSlider(), new Color4(18, 124, 255)).sliderBall;

        expect(drawable.opacity(999)).toBe(0);
        expect(drawable.opacity(1000)).toBe(0);
        expect(drawable.opacity(1100)).toBeCloseTo(0.96875);
        expect(drawable.opacity(1200)).toBe(1);
        expect(drawable.opacity(2025)).toBeCloseTo(0.03125);
        expect(drawable.opacity(2050)).toBe(0);

        expect(drawable.scale(1000)).toBe(1);
        expect(drawable.scale(1150)).toBeCloseTo(2.35625);
        expect(drawable.scale(1300)).toBe(2.4);
        expect(drawable.scale(2300)).toBe(1);
    });

    it("draws the Argon gradient ball, inset border, chevron, and follow circle", () => {
        const drawable = new DrawableSlider(
            createSlider(),
            new Color4(18, 124, 255),
        ).sliderBall;
        const {ctx, gradientStops, strokes} = createContext();

        drawable.draw(ctx, 1200);

        const arcRadii = vi.mocked(ctx.arc).mock.calls.map((call) => call[2]);
        const ballRadius = 32 * (1 - 8 / 58);
        const borderThickness = 32 * (10 / 58);

        expect(arcRadii).toContainEqual(ballRadius);
        expect(arcRadii).toContainEqual(ballRadius - borderThickness / 2);
        expect(ctx.createLinearGradient).toHaveBeenCalledTimes(2);
        expect(gradientStops).toContainEqual([0, "rgb(18,124,255)"]);
        expect(gradientStops).toContainEqual([1, "rgb(12,82.66666666666667,170)"]);
        expect(strokes.some((stroke) => stroke.strokeStyle === "rgb(255,255,255)")).toBe(true);
        expect(ctx.rotate).toHaveBeenCalledWith(0);
    });

    it("rotates the Argon chevron with the slider's travel direction", () => {
        const slider = createSlider(1);
        const drawable = new DrawableSlider(slider, new Color4(18, 124, 255)).sliderBall;
        const {ctx} = createContext();

        drawable.draw(ctx, slider.startTime + slider.duration * 0.75);

        const rotation = vi.mocked(ctx.rotate).mock.calls[0][0];
        expect(Math.abs(rotation)).toBeCloseTo(Math.PI);
    });

    it("pulses the follow circle when a slider tick is reached", () => {
        const drawable = new DrawableSlider(
            createSlider(0, true),
            new Color4(18, 124, 255),
        ).sliderBall;

        expect(drawable.scale(1500)).toBe(2.4);
        expect(drawable.scale(1540)).toBeCloseTo(2.592);
        expect(drawable.scale(1640)).toBeCloseTo(2.406, 3);
    });
});
