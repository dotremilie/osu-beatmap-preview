import {Vector2} from "osu-classes";
import {Spinner} from "osu-standard-stable";
import {describe, expect, it} from "vitest";
import {DrawableSpinner} from "../src/drawables/standard/DrawableSpinner";

type Command = {name: string; args: unknown[]};

function createSpinner(hidden = false, overrides: Partial<Spinner> = {}) {
    const object = Object.assign(new Spinner(), {
        startTime: 2000,
        endTime: 6000,
        startPosition: new Vector2(256, 192),
        timePreempt: 1200,
        spinsRequired: 8,
        ...overrides,
    });
    return new DrawableSpinner(object, hidden);
}

/** Records drawing and models the canvas state stack, including transforms. */
function createContext() {
    const commands: Command[] = [];
    const strokes: {lineWidth: number; alpha: number; style: unknown; arcs: number[][]}[] = [];
    const target = {
        globalAlpha: 0.6,
        globalCompositeOperation: "source-over",
        strokeStyle: "magenta" as unknown,
        fillStyle: "navy" as unknown,
        lineWidth: 7,
        lineCap: "square",
        shadowBlur: 3,
        shadowColor: "cyan",
    };
    let transforms: Command[] = [{name: "scale", args: [2, 2]}];
    let arcs: number[][] = [];
    const snapshot = () => ({...target, transforms: [...transforms]});
    const stack: ReturnType<typeof snapshot>[] = [];
    const record = (name: string, ...args: unknown[]) => commands.push({name, args});
    const methods = {
        save() {
            stack.push(snapshot());
            record("save");
        },
        restore() {
            const saved = stack.pop();
            if (!saved) throw new Error("Unbalanced canvas restore");
            const {transforms: savedTransforms, ...styles} = saved;
            Object.assign(target, styles);
            transforms = savedTransforms;
            record("restore");
        },
        beginPath() { arcs = []; record("beginPath"); },
        closePath() { record("closePath"); },
        moveTo(...args: number[]) { record("moveTo", ...args); },
        lineTo(...args: number[]) { record("lineTo", ...args); },
        arc(...args: (number | boolean)[]) {
            arcs.push(args.slice(0, 5) as number[]);
            record("arc", ...args);
        },
        fill() { record("fill"); },
        stroke() {
            strokes.push({lineWidth: target.lineWidth, alpha: target.globalAlpha, style: target.strokeStyle, arcs});
            record("stroke");
        },
        createRadialGradient(...args: number[]) {
            record("createRadialGradient", ...args);
            return {addColorStop: (...stop: unknown[]) => record("addColorStop", ...stop)};
        },
        getTransform() {
            let [a, b, c, d, e, f] = [1, 0, 0, 1, 0, 0];
            for (const {name, args} of transforms) {
                const [x, y] = args as number[];
                if (name === "scale") [a, b, c, d] = [a * x, b * x, c * y, d * y];
                if (name === "translate") [e, f] = [e + a * x + c * y, f + b * x + d * y];
                if (name === "rotate") {
                    const [sin, cos] = [Math.sin(x), Math.cos(x)];
                    [a, b, c, d] = [a * cos + c * sin, b * cos + d * sin, c * cos - a * sin, d * cos - b * sin];
                }
            }
            return {a, b, c, d, e, f};
        },
        ...Object.fromEntries(["translate", "scale", "rotate"].map(name => [name, (...args: number[]) => {
            transforms.push({name, args});
            record(name, ...args);
        }])),
    };
    const ctx = new Proxy(target, {
        get(object, key) {
            return key in methods ? methods[key as keyof typeof methods] : object[key as keyof typeof object];
        },
        set(object, key, value) {
            Reflect.set(object, key, value);
            record(String(key), typeof value === "object" ? "gradient" : value);
            return true;
        },
    }) as unknown as CanvasRenderingContext2D;

    return {ctx, commands, strokes, snapshot, depth: () => stack.length};
}

function drawAt(drawable: DrawableSpinner, time: number) {
    const context = createContext();
    drawable.draw(context.ctx, time);
    return context;
}

describe("Argon spinner", () => {
    it("reproduces the same drawing after seeking backwards from the outro", () => {
        const drawable = createSpinner();
        const context = createContext();
        drawable.draw(context.ctx, 4000);
        const expected = [...context.commands];
        drawable.draw(context.ctx, 6120);
        drawable.draw(context.ctx, 1600);
        context.commands.length = 0;

        drawable.draw(context.ctx, 4000);

        expect(context.commands).toEqual(expected);
        expect(context.commands.length).toBeGreaterThan(0);
    });

    it("keeps geometry and opacity finite for zero duration and zero preempt", () => {
        for (const hidden of [false, true]) {
            const drawable = createSpinner(hidden, {endTime: 2000, timePreempt: 0, spinsRequired: 0});
            for (const time of [1999, 2000, 2000.5, 2120, 2240]) {
                const {commands} = drawAt(drawable, time);
                const numbers = commands.flatMap(command => command.args.filter(value => typeof value === "number"));
                expect(numbers.every(Number.isFinite)).toBe(true);
                expect(Number.isFinite(drawable.scale(time))).toBe(true);
                expect(drawable.opacity(time)).toBeGreaterThanOrEqual(0);
                expect(drawable.opacity(time)).toBeLessThanOrEqual(1);
            }
            expect(drawAt(drawable, 2000).commands.length).toBeGreaterThan(0);
        }
    });

    it("restores the caller's opacity, drawing styles, and transform after every phase", () => {
        const drawable = createSpinner();
        const context = createContext();
        const initial = context.snapshot();
        for (const time of [1000, 1500, 2000, 4000, 6000, 6120, 6240]) {
            drawable.draw(context.ctx, time);
            expect(context.snapshot()).toEqual(initial);
            expect(context.depth()).toBe(0);
        }
        const outro = drawAt(drawable, 6120);
        expect(outro.strokes.every(stroke => stroke.alpha <= 0.3)).toBe(true);
    });

    it("keeps spinner size independent of circle size", () => {
        const small = createSpinner(false, {scale: 0.3});
        const large = createSpinner(false, {scale: 0.8});
        expect(small.hitObject.radius).not.toBe(large.hitObject.radius);
        expect(drawAt(small, 4000).commands).toEqual(drawAt(large, 4000).commands);
    });

    it("keeps Hidden spinners visible during the spin and fades them over 30% of preempt", () => {
        const normal = createSpinner();
        const hidden = createSpinner(true);
        for (const time of [2000, 4000, 6000]) expect(hidden.opacity(time)).toBe(1);
        expect(normal.HIT_DURATION).toBe(240);
        expect(hidden.HIT_DURATION).toBe(360);
        expect(hidden.opacity(6180)).toBeCloseTo(0.5);
        expect(normal.opacity(6240)).toBe(0);
        expect(hidden.opacity(6240)).toBeGreaterThan(0);
        expect(hidden.opacity(6360)).toBe(0);
        expect(drawAt(hidden, 6360).commands).toEqual([]);
    });

    it("stages the entrance before growing to full size, then expands and fades on completion", () => {
        const drawable = createSpinner();
        expect(drawAt(drawable, 1400).commands).toEqual([]);
        expect(drawable.scale(1500)).toBeGreaterThan(0);
        expect(drawable.scale(1500)).toBeLessThan(0.2);
        expect(drawable.scale(1700)).toBeCloseTo(0.2);
        expect(drawable.scale(2000)).toBeCloseTo(0.2);
        expect(drawable.scale(2300)).toBeGreaterThan(0.2);
        expect(drawable.scale(2600)).toBe(1);
        expect(drawable.scale(6000)).toBe(1);
        expect(drawable.scale(6120)).toBeGreaterThan(1);
        expect(drawable.scale(6320)).toBeCloseTo(1.2);
        expect(drawable.opacity(6120)).toBeCloseTo(0.5);
        expect(drawAt(drawable, 6240).commands).toEqual([]);
    });

    it("fills the progress arcs during the spin and closes the ring during the outro", () => {
        const drawable = createSpinner();
        const quarter = drawAt(drawable, 3000);
        const half = drawAt(drawable, 4000);
        const end = drawAt(drawable, 6000);
        const outro = drawAt(drawable, 6120);
        const progressArc = (context: ReturnType<typeof createContext>) =>
            context.strokes.find(stroke => stroke.lineWidth > 20 && stroke.style === "white")!;
        const ringArc = (context: ReturnType<typeof createContext>) =>
            context.strokes.find(stroke => stroke.arcs.some(arc => arc[2] > 175) && stroke.lineWidth < 10)!;
        const sweep = (stroke: ReturnType<typeof progressArc>) => stroke.arcs[0][4] - stroke.arcs[0][3];

        expect(sweep(progressArc(half))).toBeCloseTo(sweep(progressArc(quarter)) * 2);
        expect(sweep(progressArc(end))).toBeGreaterThan(sweep(progressArc(half)));
        expect(end.strokes.some(stroke => stroke.style === "rgba(255,255,255,0.25)")).toBe(false);
        expect(sweep(ringArc(outro))).toBeGreaterThan(sweep(ringArc(end)));
        expect(ringArc(outro).lineWidth).toBeGreaterThan(ringArc(end).lineWidth);
        expect(progressArc(outro).alpha).toBeLessThan(progressArc(end).alpha);
    });
});
