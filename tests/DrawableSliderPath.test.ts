import {describe, expect, it, vi} from "vitest";
import {Color4, SliderPath, Vector2} from "osu-classes";
import {Slider} from "osu-standard-stable";
import {DrawableSliderBody} from "../src/drawables/standard/DrawableSliderBody";
import {DrawableSliderPath} from "../src/drawables/standard/DrawableSliderPath";

type StrokeRecord = {
    composite: GlobalCompositeOperation;
    lineWidth: number;
    strokeStyle: string | CanvasGradient | CanvasPattern;
};

function createBufferedContext(): {
    ctx: CanvasRenderingContext2D;
    bufferContext: CanvasRenderingContext2D;
    strokes: StrokeRecord[];
} {
    const strokes: StrokeRecord[] = [];
    const bufferContext = {
        globalCompositeOperation: "source-over" as GlobalCompositeOperation,
        lineWidth: 0,
        strokeStyle: "",
        clearRect: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(() => strokes.push({
            composite: bufferContext.globalCompositeOperation,
            lineWidth: bufferContext.lineWidth,
            strokeStyle: bufferContext.strokeStyle,
        })),
    } as unknown as CanvasRenderingContext2D;
    const buffer = {
        width: 0,
        height: 0,
        getContext: vi.fn(() => bufferContext),
    } as unknown as HTMLCanvasElement;
    const ownerDocument = {
        createElement: vi.fn(() => buffer),
    } as unknown as Document;
    const ctx = {
        canvas: {ownerDocument},
        drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    return {ctx, bufferContext, strokes};
}

describe("DrawableSliderPath", () => {
    it("draws the border and accent strokes along the supplied path", () => {
        const path = {
            path: [new Vector2(0, 0), new Vector2(100, 50)],
        } as SliderPath;
        const drawablePath = new DrawableSliderPath(
            path,
            new Color4(10, 20, 30),
            new Color4(40, 50, 60),
        );
        const {ctx, bufferContext, strokes} = createBufferedContext();

        drawablePath.draw(ctx, new Vector2(25, 30), 32, 0.75);

        const lineCalls = vi.mocked(bufferContext.lineTo).mock.calls;
        expect(lineCalls).toHaveLength(6);
        expect(lineCalls[1][0] - lineCalls[0][0]).toBe(100);
        expect(lineCalls[1][1] - lineCalls[0][1]).toBe(50);
        expect(strokes).toHaveLength(3);
        expect(strokes[0]).toMatchObject({
            composite: "source-over",
            strokeStyle: "rgba(40,50,60,0.75)",
        });
        expect(strokes[0].lineWidth).toBeCloseTo(55.1724, 4);
        expect(strokes[1]).toMatchObject({
            composite: "destination-out",
        });
        expect(strokes[1].lineWidth).toBeCloseTo(46.3448, 4);
        expect(strokes[2]).toMatchObject({
            composite: "source-over",
            strokeStyle: `rgba(10,20,30,${0.75 * 0.92})`,
        });
        expect(strokes[2].lineWidth).toBeCloseTo(46.3448, 4);
        expect(ctx.drawImage).toHaveBeenCalledOnce();
        expect(bufferContext.restore).toHaveBeenCalledOnce();
    });

    it("punches out the opaque centre before drawing the translucent body", () => {
        const path = {path: [new Vector2(0, 0)]} as SliderPath;
        const drawablePath = new DrawableSliderPath(
            path,
            new Color4(10, 20, 30),
            new Color4(40, 50, 60),
        );
        const {ctx, strokes} = createBufferedContext();

        drawablePath.draw(ctx, new Vector2(0, 0), 32, 1);

        expect(drawablePath.bodyAlpha).toBe(0.92);
        expect(strokes.map(({composite, strokeStyle}) => ({composite, strokeStyle}))).toEqual([
            {composite: "source-over", strokeStyle: "rgba(40,50,60,1)"},
            {composite: "destination-out", strokeStyle: "rgba(0,0,0,1)"},
            {composite: "source-over", strokeStyle: "rgba(10,20,30,0.92)"},
        ]);
    });

    it("does not touch the canvas when fully transparent", () => {
        const drawablePath = new DrawableSliderPath(
            {path: []} as unknown as SliderPath,
            new Color4(10, 20, 30),
            new Color4(40, 50, 60),
        );
        const {ctx} = createBufferedContext();

        drawablePath.draw(ctx, new Vector2(0, 0), 32, 0);

        expect(ctx.drawImage).not.toHaveBeenCalled();
    });
});

describe("DrawableSliderBody", () => {
    it("delegates geometry rendering to its slider path", () => {
        const slider = new Slider();
        slider.startTime = 1000;
        slider.timePreempt = 600;
        slider.timeFadeIn = 400;
        slider.startPosition = new Vector2(100, 150);
        slider.scale = 0.5;
        const body = new DrawableSliderBody(
            slider,
            new Color4(10, 20, 30),
            new Color4(40, 50, 60),
        );
        const draw = vi.spyOn(body.sliderPath, "draw").mockImplementation(() => undefined);
        const ctx = {} as CanvasRenderingContext2D;

        body.draw(ctx, 600);

        expect(draw).toHaveBeenCalledWith(ctx, slider.stackedStartPosition, 32, 0.5);
    });
});
